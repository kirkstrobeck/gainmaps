import { spawn } from "node:child_process";
import { mkdir, stat } from "node:fs/promises";
import { dirname, extname } from "node:path";

import { headroomFromBoost } from "#src/encode.js";

type OutputPlan = { readonly input: string; readonly output: string | null; readonly stdout: boolean };

export type VideoRunner = (command: string, args: readonly string[]) => Promise<void>;

export type VideoEncoder = "hevc_videotoolbox" | "libx265";
export type VideoTransfer = "hlg" | "pq";

export type VideoConvertOptions = {
  readonly boost?: number;
  readonly headroom?: number;
  readonly quality?: number;
  readonly dryRun: boolean;
  readonly force: boolean;
  readonly videoRunner?: VideoRunner;
};

export const VIDEO_EXTENSIONS = ["mp4"] as const;

export function isMp4Path(path: string | null | undefined): boolean {
  return path != null && extname(path).toLowerCase() === ".mp4";
}

export function isVideoPlan(plan: OutputPlan): boolean {
  return isMp4Path(plan.input) || isMp4Path(plan.output);
}

export function assertMp4Plan(plan: OutputPlan): void {
  if (plan.input === "-") throw Object.assign(new Error("MP4 video input requires a file path, not stdin"), { code: "UNSUPPORTED" });
  if (plan.stdout) throw Object.assign(new Error("--stdout is not supported for MP4 video"), { code: "UNSUPPORTED" });
  if (!isMp4Path(plan.input)) throw Object.assign(new Error("MP4 output requires MP4 input"), { code: "UNSUPPORTED" });
  if (plan.output == null) throw Object.assign(new Error("MP4 video output requires a file path"), { code: "UNSUPPORTED" });
  if (!isMp4Path(plan.output)) throw Object.assign(new Error("MP4 input requires MP4 output"), { code: "UNSUPPORTED" });
}

export function videoHeadroom(options: Pick<VideoConvertOptions, "boost" | "headroom">): number {
  if (options.headroom != null && Number.isFinite(options.headroom)) return Math.max(options.headroom, 1);
  return headroomFromBoost(options.boost ?? 0.5);
}

export function videoCrf(quality: number | undefined): number {
  if (quality == null) return 18;
  const clamped = Math.max(1, Math.min(100, Math.round(quality)));
  return Math.round(32 - ((clamped - 1) / 99) * 20);
}

export function videoToolboxQuality(quality: number | undefined): number {
  if (quality == null) return 72;
  return Math.max(1, Math.min(100, Math.round(quality)));
}

export function preferredVideoEncoder(platform: NodeJS.Platform = process.platform, env: NodeJS.ProcessEnv = process.env): VideoEncoder {
  if (env.GAINMAP_VIDEO_ENCODER === "hevc_videotoolbox" || env.GAINMAP_VIDEO_ENCODER === "libx265") return env.GAINMAP_VIDEO_ENCODER;
  return platform === "darwin" ? "hevc_videotoolbox" : "libx265";
}

export function videoPeakNits(options: Pick<VideoConvertOptions, "boost" | "headroom">): number {
  return Math.round(Math.max(100, Math.min(1000, videoHeadroom(options) * 100)));
}

export function preferredVideoTransfer(encoder: VideoEncoder): VideoTransfer {
  return encoder === "hevc_videotoolbox" ? "hlg" : "pq";
}

export function hlgLutExpression(options: Pick<VideoConvertOptions, "boost" | "headroom">): string {
  const scale = Number(Math.min(6, videoHeadroom(options)).toFixed(5));
  const linear = "min(pow(max(val/maxval\\,0)\\,2.2)*" + scale + "\\,1)";
  return "maxval*pow(" + linear + "\\,0.42)";
}


export function pqLutExpression(options: Pick<VideoConvertOptions, "boost" | "headroom">): string {
  const normalizedPeak = Number((videoPeakNits(options) / 10000).toFixed(5));
  const linear = "pow(max(val/maxval\\,0)\\,2.2)*" + normalizedPeak;
  const powered = "pow(" + linear + "\\,0.1593017578125)";
  const pq = "(0.8359375+18.8515625*" + powered + ")/(1+18.6875*" + powered + ")";
  return "clip(maxval*pow(" + pq + "\\,78.84375)\\,0\\,maxval)";
}

export function videoFilter(options: Pick<VideoConvertOptions, "boost" | "headroom">, transfer: VideoTransfer = "pq"): string {
  const lut = transfer === "hlg" ? hlgLutExpression(options) : pqLutExpression(options);
  return [
    "colorspace=iall=bt709:all=bt2020:format=yuv444p10:fast=0",
    "format=gbrp16le",
    "lutrgb=r=" + lut + ":g=" + lut + ":b=" + lut,
    "format=yuv420p10le",
  ].join(",");
}

export function x265HdrParams(options: Pick<VideoConvertOptions, "boost" | "headroom">): string {
  const peak = videoPeakNits(options);
  return [
    "hdr10=1",
    "hdr-opt=1",
    "repeat-headers=1",
    "colorprim=bt2020",
    "transfer=smpte2084",
    "colormatrix=bt2020nc",
    "master-display=G(8500,39850)B(6550,2300)R(35400,14600)WP(15635,16450)L(10000000,1)",
    "max-cll=" + peak + "," + Math.round(peak * 0.4),
  ].join(":");
}

export function ffmpegMp4Args(input: string, output: string, options: VideoConvertOptions, encoder: VideoEncoder = preferredVideoEncoder()): readonly string[] {
  const transfer = preferredVideoTransfer(encoder);
  const colorTransfer = transfer === "hlg" ? "arib-std-b67" : "smpte2084";
  const encoderArgs = encoder === "hevc_videotoolbox"
    ? [
        "-c:v",
        "hevc_videotoolbox",
        "-profile:v",
        "main10",
        "-q:v",
        String(videoToolboxQuality(options.quality)),
      ]
    : [
        "-c:v",
        "libx265",
        "-preset",
        "medium",
        "-crf",
        String(videoCrf(options.quality)),
        "-x265-params",
        x265HdrParams(options),
      ];
  const pixelFormat = encoder === "hevc_videotoolbox" ? "p010le" : "yuv420p10le";
  return [
    "-hide_banner",
    "-nostdin",
    "-y",
    "-i",
    input,
    "-map",
    "0:v:0",
    "-map",
    "0:a?",
    ...encoderArgs,
    "-vf",
    videoFilter(options, transfer),
    "-pix_fmt",
    pixelFormat,
    "-color_primaries",
    "bt2020",
    "-color_trc",
    colorTransfer,
    "-colorspace",
    "bt2020nc",
    "-tag:v",
    "hvc1",
    "-c:a",
    "copy",
    "-movflags",
    "+faststart+write_colr",
    output,
  ];
}

export async function convertMp4Plan(
  plan: OutputPlan,
  options: VideoConvertOptions,
  log: (message: string) => void,
): Promise<{ readonly input: string; readonly output: string | null; readonly skipped: boolean; readonly bytesOut: number; readonly note: string }> {
  assertMp4Plan(plan);
  if (plan.output != null && !options.force && !options.dryRun && (await exists(plan.output))) {
    log("skip (exists, pass -f to overwrite) " + plan.input + " -> " + plan.output);
    return { input: plan.input, output: plan.output, skipped: true, bytesOut: 0, note: "exists" };
  }
  if (options.dryRun) {
    log(plan.input + " -> " + plan.output);
    return { input: plan.input, output: plan.output, skipped: false, bytesOut: 0, note: "dry-run" };
  }
  await mkdir(dirname(plan.output!), { recursive: true });
  const runner = options.videoRunner ?? spawnProcess;
  let encoder = preferredVideoEncoder();
  try {
    await runner("ffmpeg", ffmpegMp4Args(plan.input, plan.output!, options, encoder));
  } catch (error) {
    if (encoder !== "hevc_videotoolbox") throw error;
    encoder = "libx265";
    await runner("ffmpeg", ffmpegMp4Args(plan.input, plan.output!, options, encoder));
  }
  const info = await stat(plan.output!);
  const encoderNote = encoder === "hevc_videotoolbox" ? " · QuickTime HLG" : " · HDR10 PQ";
  const note = "Ultra HDR MP4 · " + videoHeadroom(options).toFixed(2) + "x · " + videoPeakNits(options) + " nits" + encoderNote;
  log(plan.input + " -> " + plan.output);
  return { input: plan.input, output: plan.output, skipped: false, bytesOut: info.size, note };
}

export function spawnProcess(command: string, args: readonly string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, [...args], { stdio: ["ignore", "ignore", "pipe"] });
    let stderr = "";
    child.stderr?.on("data", (chunk) => {
      stderr += String(chunk);
    });
    child.on("error", (error: NodeJS.ErrnoException) => {
      if (error.code === "ENOENT") {
        reject(Object.assign(new Error("MP4 conversion requires ffmpeg with hevc_videotoolbox or libx265 support in PATH"), { code: "UNSUPPORTED" }));
        return;
      }
      reject(error);
    });
    child.on("close", (code) => {
      if (code === 0) {
        resolve();
        return;
      }
      const detail = stderr.trim();
      reject(new Error("ffmpeg failed" + (detail ? ": " + detail : "")));
    });
  });
}

async function exists(path: string): Promise<boolean> {
  try {
    await stat(path);
    return true;
  } catch {
    return false;
  }
}
