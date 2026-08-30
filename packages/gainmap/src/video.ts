import { spawn } from "node:child_process";
import { mkdir, stat } from "node:fs/promises";
import { dirname, extname } from "node:path";

import { headroomFromBoost } from "#src/encode.js";

type OutputPlan = { readonly input: string; readonly output: string | null; readonly stdout: boolean };

export type VideoRunner = (command: string, args: readonly string[]) => Promise<void>;

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

export function videoFilter(options: Pick<VideoConvertOptions, "boost" | "headroom">): string {
  const headroom = videoHeadroom(options);
  const exposure = Math.max(0, Math.min(2, Math.log2(headroom)));
  const contrast = Number((1 + exposure * 0.08).toFixed(3));
  const brightness = Number(Math.min(0.12, exposure * 0.025).toFixed(3));
  return [
    `eq=contrast=${contrast}:brightness=${brightness}:saturation=1`,
    "format=yuv420p10le",
  ].join(",");
}

export function ffmpegMp4Args(input: string, output: string, options: VideoConvertOptions): readonly string[] {
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
    "-c:v",
    "libx265",
    "-preset",
    "medium",
    "-crf",
    String(videoCrf(options.quality)),
    "-vf",
    videoFilter(options),
    "-color_primaries",
    "bt2020",
    "-color_trc",
    "smpte2084",
    "-colorspace",
    "bt2020nc",
    "-tag:v",
    "hvc1",
    "-c:a",
    "copy",
    "-movflags",
    "+faststart",
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
  await runner("ffmpeg", ffmpegMp4Args(plan.input, plan.output!, options));
  const info = await stat(plan.output!);
  const note = "Ultra HDR MP4 · " + videoHeadroom(options).toFixed(2) + "x";
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
        reject(Object.assign(new Error("MP4 conversion requires ffmpeg with libx265 support in PATH"), { code: "UNSUPPORTED" }));
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
