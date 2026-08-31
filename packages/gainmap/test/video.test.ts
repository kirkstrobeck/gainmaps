import assert from "node:assert/strict";
import { chmod, mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, it } from "vitest";

import { convertPlan, convertPlans, type ConvertOptions } from "#src/convert.js";
import {
  assertMp4Plan,
  convertMp4Plan,
  ffmpegMp4Args,
  isMp4Path,
  isVideoPlan,
  pqLutExpression,
  preferredVideoEncoder,
  spawnProcess,
  videoCrf,
  videoFilter,
  videoHeadroom,
  videoPeakNits,
  videoToolboxQuality,
  x265HdrParams,
} from "#src/video.js";

const options: ConvertOptions = {
  dryRun: false,
  force: false,
  quiet: false,
  verbose: true,
  continueOnError: false,
  jobs: 1,
};

async function fakeMp4(dir: string, name = "clip.mp4"): Promise<string> {
  const path = join(dir, name);
  await writeFile(path, Buffer.from("not-real-mp4-but-good-enough-for-planning"));
  return path;
}

describe("video mp4 helpers", () => {
  it("detects mp4 paths and video plans", () => {
    assert.equal(isMp4Path(null), false);
    assert.equal(isMp4Path(undefined), false);
    assert.equal(isMp4Path("clip.MP4"), true);
    assert.equal(isMp4Path("clip.mov"), false);
    assert.equal(isVideoPlan({ input: "clip.mp4", output: "clip-gain.mp4", stdout: false }), true);
    assert.equal(isVideoPlan({ input: "clip.jpg", output: "clip.mp4", stdout: false }), true);
    assert.equal(isVideoPlan({ input: "clip.jpg", output: "clip-gain.jpg", stdout: false }), false);
  });

  it("rejects unsupported mp4 plan shapes", () => {
    assert.doesNotThrow(() => assertMp4Plan({ input: "clip.mp4", output: "clip-gain.mp4", stdout: false }));
    assert.throws(() => assertMp4Plan({ input: "-", output: "clip.mp4", stdout: false }), /file path/);
    assert.throws(() => assertMp4Plan({ input: "clip.mp4", output: null, stdout: true }), /stdout/);
    assert.throws(() => assertMp4Plan({ input: "clip.jpg", output: "clip.mp4", stdout: false }), /requires MP4 input/);
    assert.throws(() => assertMp4Plan({ input: "clip.mp4", output: null, stdout: false }), /requires a file path/);
    assert.throws(() => assertMp4Plan({ input: "clip.mp4", output: "clip.jpg", stdout: false }), /requires MP4 output/);
  });

  it("maps quality and gain settings to deterministic ffmpeg arguments", () => {
    assert.equal(videoCrf(undefined), 18);
    assert.equal(videoCrf(1), 32);
    assert.equal(videoCrf(100), 12);
    assert.equal(videoCrf(101), 12);
    assert.equal(videoCrf(0), 32);
    assert.equal(videoToolboxQuality(undefined), 72);
    assert.equal(videoToolboxQuality(101), 100);
    assert.equal(videoToolboxQuality(0), 1);
    assert.equal(preferredVideoEncoder("darwin", {}), "hevc_videotoolbox");
    assert.equal(preferredVideoEncoder("linux", {}), "libx265");
    assert.equal(preferredVideoEncoder("darwin", { GAINMAP_VIDEO_ENCODER: "libx265" }), "libx265");
    assert.equal(videoHeadroom({ headroom: 0.5 }), 1);
    assert.equal(videoHeadroom({ headroom: 2 }), 2);
    assert.ok(videoHeadroom({ boost: 0.5 }) > 1);
    assert.equal(videoPeakNits({ headroom: 0.5 }), 100);
    assert.equal(videoPeakNits({ headroom: 4 }), 400);
    assert.equal(videoPeakNits({ headroom: 16 }), 1000);
    assert.match(pqLutExpression({ headroom: 4 }), /0\.04/);
    const filter = videoFilter({ headroom: 16 });
    assert.doesNotMatch(filter, /zscale|eq=/);
    assert.match(filter, /colorspace=iall=bt709:all=bt2020/);
    assert.match(filter, /format=gbrp16le/);
    assert.match(filter, /lutrgb=/);
    assert.match(filter, /format=yuv420p10le/);
    const hdrParams = x265HdrParams({ headroom: 4 });
    assert.match(hdrParams, /transfer=smpte2084/);
    assert.match(hdrParams, /master-display=/);
    assert.match(hdrParams, /max-cll=400,160/);
    const x265Args = ffmpegMp4Args("in.mp4", "out.mp4", { ...options, quality: 80, headroom: 4 }, "libx265");
    assert.deepEqual(x265Args.slice(0, 5), ["-hide_banner", "-nostdin", "-y", "-i", "in.mp4"]);
    assert.ok(x265Args.includes("libx265"));
    assert.ok(x265Args.includes("-x265-params"));
    assert.ok(x265Args.some((arg) => arg.includes("hdr10=1")));
    assert.ok(x265Args.some((arg) => arg.includes("max-cll=400,160")));
    assert.ok(x265Args.includes("bt2020"));
    assert.ok(x265Args.includes("smpte2084"));
    assert.ok(x265Args.includes("hvc1"));
    assert.equal(x265Args.at(-1), "out.mp4");

    const quickTimeArgs = ffmpegMp4Args("in.mp4", "out.mp4", { ...options, quality: 80, headroom: 4 }, "hevc_videotoolbox");
    assert.ok(quickTimeArgs.includes("hevc_videotoolbox"));
    assert.ok(quickTimeArgs.includes("main10"));
    assert.ok(quickTimeArgs.includes("-q:v"));
    assert.ok(quickTimeArgs.includes("p010le"));
    assert.ok(!quickTimeArgs.includes("-x265-params"));
    assert.equal(quickTimeArgs.at(-1), "out.mp4");
  });
});

describe("mp4 conversion", () => {
  it("dry-runs, skips existing output, and runs ffmpeg through an injectable runner", async () => {
    const dir = await mkdtemp(join(tmpdir(), "gainmap-video-"));
    const input = await fakeMp4(dir);
    const output = join(dir, "clip-gain.mp4");
    const logs: string[] = [];
    const dry = await convertMp4Plan(
      { input, output, stdout: false },
      { ...options, dryRun: true },
      (message) => logs.push(message),
    );
    assert.equal(dry.note, "dry-run");
    assert.ok(logs.at(-1)?.includes("clip-gain.mp4"));

    await writeFile(output, Buffer.from("existing"));
    const skipped = await convertMp4Plan(
      { input, output, stdout: false },
      options,
      (message) => logs.push(message),
    );
    assert.equal(skipped.skipped, true);
    assert.equal(skipped.note, "exists");

    const calls: Array<{ command: string; args: readonly string[] }> = [];
    const converted = await convertPlan(
      { input, output, stdout: false },
      {
        ...options,
        force: true,
        quality: 90,
        headroom: 3,
        videoRunner: async (command, args) => {
          calls.push({ command, args });
          await writeFile(output, Buffer.from("converted-video"));
        },
      },
      undefined,
      () => undefined,
      (message) => logs.push(message),
    );
    assert.equal(converted.skipped, false);
    assert.equal(converted.bytesOut, Buffer.byteLength("converted-video"));
    assert.equal(converted.note, "Ultra HDR MP4 · 3.00x · 300 nits");
    assert.equal(calls[0]!.command, "ffmpeg");
    assert.ok(calls[0]!.args.includes("-c:a"));
    assert.equal(await readFile(output, "utf8"), "converted-video");
  });


  it("falls back from Apple VideoToolbox to x265 when the default macOS encoder is unavailable", async () => {
    const dir = await mkdtemp(join(tmpdir(), "gainmap-video-fallback-"));
    const input = await fakeMp4(dir);
    const output = join(dir, "clip-gain.mp4");
    const originalEncoder = process.env.GAINMAP_VIDEO_ENCODER;
    process.env.GAINMAP_VIDEO_ENCODER = "hevc_videotoolbox";
    const calls: Array<{ command: string; args: readonly string[] }> = [];
    try {
      const converted = await convertMp4Plan(
        { input, output, stdout: false },
        {
          ...options,
          force: true,
          videoRunner: async (command, args) => {
            calls.push({ command, args });
            if (args.includes("hevc_videotoolbox")) throw new Error("no VideoToolbox");
            await writeFile(output, Buffer.from("fallback-video"));
          },
        },
        () => undefined,
      );
      assert.equal(converted.note, "Ultra HDR MP4 · 3.34x · 334 nits");
    } finally {
      if (originalEncoder == null) delete process.env.GAINMAP_VIDEO_ENCODER;
      else process.env.GAINMAP_VIDEO_ENCODER = originalEncoder;
    }
    assert.ok(calls[0]!.args.includes("hevc_videotoolbox"));
    assert.ok(calls[1]!.args.includes("libx265"));
  });

  it("uses the default ffmpeg runner when no runner is injected", async () => {
    const dir = await mkdtemp(join(tmpdir(), "gainmap-video-default-runner-"));
    const input = await fakeMp4(dir);
    const output = join(dir, "clip-gain.mp4");
    await assert.rejects(
      convertMp4Plan({ input, output, stdout: false }, { ...options, force: true }, () => undefined),
      /MP4 conversion requires ffmpeg|ffmpeg failed/,
    );
  });

  it("continues after mp4 failures when requested", async () => {
    const dir = await mkdtemp(join(tmpdir(), "gainmap-video-fail-"));
    const input = await fakeMp4(dir);
    const output = join(dir, "clip-gain.mp4");
    const { failures, results } = await convertPlans(
      [{ input, output, stdout: false }],
      {
        ...options,
        continueOnError: true,
        videoRunner: async () => {
          throw new Error("no encoder");
        },
      },
    );
    assert.equal(failures, 1);
    assert.equal(results[0]!.skipped, true);
    assert.equal(results[0]!.note, "no encoder");
  });

  it("rejects image-to-mp4 and mp4-to-image conversions", async () => {
    const dir = await mkdtemp(join(tmpdir(), "gainmap-video-reject-"));
    await writeFile(join(dir, "photo.jpg"), Buffer.from([0xff, 0xd8, 0xff, 0xd9]));
    const input = await fakeMp4(dir);
    await assert.rejects(convertPlan({ input: join(dir, "photo.jpg"), output: join(dir, "photo.mp4"), stdout: false }, options, undefined, () => undefined, () => undefined), /MP4 output requires MP4 input/);
    await assert.rejects(convertPlan({ input, output: join(dir, "clip.jpg"), stdout: false }, options, undefined, () => undefined, () => undefined), /MP4 input requires MP4 output/);
    await assert.rejects(convertPlan({ input, output: null, stdout: true }, options, undefined, () => undefined, () => undefined), /stdout/);
  });
});

describe("spawnProcess", () => {
  it("resolves successful child processes and reports process failures", async () => {
    await spawnProcess(process.execPath, ["-e", "process.exit(0)"]);
    await assert.rejects(
      spawnProcess(process.execPath, ["-e", "process.stderr.write('bad video'); process.exit(4)"]),
      /ffmpeg failed: bad video/,
    );
    await assert.rejects(spawnProcess(process.execPath, ["-e", "process.exit(4)"]), /ffmpeg failed$/);
  });

  it("maps missing and unexecutable binaries to clear errors", async () => {
    await assert.rejects(spawnProcess("gainmap-ffmpeg-does-not-exist", []), /requires ffmpeg/);
    const dir = await mkdtemp(join(tmpdir(), "gainmap-video-eacces-"));
    const bin = join(dir, "not-executable");
    await writeFile(bin, "#!/bin/sh\nexit 0\n");
    await chmod(bin, 0o644);
    await assert.rejects(spawnProcess(bin, []), /EACCES|permission/i);
  });
});
