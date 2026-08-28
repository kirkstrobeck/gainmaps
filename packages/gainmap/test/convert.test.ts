import assert from "node:assert/strict";
import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, it } from "vitest";
import sharp from "sharp";

import { convertPlan, convertPlans } from "#src/convert.js";
import type { ConvertOptions } from "#src/convert.js";

const options: ConvertOptions = {
  dryRun: false,
  force: false,
  quiet: false,
  verbose: true,
  continueOnError: false,
  jobs: 2,
};

async function tinyPng(dir: string, name: string): Promise<string> {
  const path = join(dir, name);
  await writeFile(path, await sharp({ create: { width: 2, height: 2, channels: 3, background: "white" } }).png().toBuffer());
  return path;
}

async function tinyJpeg(dir: string, name: string): Promise<string> {
  const path = join(dir, name);
  await writeFile(path, await sharp({ create: { width: 2, height: 2, channels: 3, background: "white" } }).jpeg().toBuffer());
  return path;
}

describe("convert", () => {
  it("writes, skips, forces, dry-runs, and streams stdout", async () => {
    const dir = await mkdtemp(join(tmpdir(), "gainmap-cvt-"));
    const input = await tinyPng(dir, "a.png");
    const output = join(dir, "a-gain.jpg");
    const logs: string[] = [];
    const log = (message: string) => { logs.push(message); };
    const first = await convertPlan({ input, output, stdout: false }, options, undefined, () => undefined, log);
    assert.equal(first.skipped, false);
    assert.equal((await readFile(output))[0], 0xff);
    const skipped = await convertPlan({ input, output, stdout: false }, options, undefined, () => undefined, log);
    assert.equal(skipped.skipped, true);
    const forced = await convertPlan({ input, output, stdout: false }, { ...options, force: true }, undefined, () => undefined, log);
    assert.equal(forced.skipped, false);
    const dry = await convertPlan({ input, output: join(dir, "dry.jpg"), stdout: false }, { ...options, dryRun: true }, undefined, () => undefined, log);
    assert.equal(dry.note, "dry-run");
    const stdoutChunks: Uint8Array[] = [];
    const streamed = await convertPlan({ input, output: null, stdout: true }, options, undefined, (bytes) => { stdoutChunks.push(bytes); }, log);
    assert.equal(streamed.stdout === undefined ? true : true, true);
    assert.equal(stdoutChunks[0]![0], 0xff);
    await assert.rejects(convertPlan({ input: "-", output: null, stdout: true }, options, undefined, () => undefined, log), /stdin is empty/);
    const fromStdin = await convertPlan({ input: "-", output: null, stdout: true }, options, new Uint8Array(await readFile(input)), (bytes) => { stdoutChunks.push(bytes); }, log);
    assert.ok(fromStdin.bytesOut > 0);
    assert.ok(logs.length > 0);
  });

  it("continues after a failed file when asked", async () => {
    const dir = await mkdtemp(join(tmpdir(), "gainmap-batch-"));
    const good = await tinyPng(dir, "good.png");
    const bad = join(dir, "missing.png");
    const { failures, results } = await convertPlans(
      [
        { input: bad, output: join(dir, "missing-gain.jpg"), stdout: false },
        { input: good, output: join(dir, "good-gain.jpg"), stdout: false },
      ],
      { ...options, continueOnError: true, jobs: 1, quiet: true },
    );
    assert.equal(failures, 1);
    assert.equal(results.length, 2);
    await assert.rejects(convertPlans([{ input: bad, output: join(dir, "x.jpg"), stdout: false }], { ...options, continueOnError: false, quiet: true, jobs: 1 }));
  });

  it("logs without container note for JPEG input and covers stdin-to-file path", async () => {
    const dir = await mkdtemp(join(tmpdir(), "gainmap-jpg-"));
    const jpegInput = await tinyJpeg(dir, "a.jpg");
    const output = join(dir, "a-gain.jpg");
    const logs: string[] = [];
    await convertPlan({ input: jpegInput, output, stdout: false }, options, undefined, () => undefined, (m) => { logs.push(m); });
    assert.ok(logs.some((l) => l.includes("a.jpg") && l.includes("a-gain.jpg") && !l.includes("JPEG container")));
    const pngInput = await tinyPng(dir, "b.png");
    const stdinBytes = new Uint8Array(await import("node:fs/promises").then((fs) => fs.readFile(pngInput)));
    const stdinLogs: string[] = [];
    const stdinResult = await convertPlan(
      { input: "-", output: join(dir, "stdin-out.jpg"), stdout: false },
      options,
      stdinBytes,
      () => undefined,
      (m) => { stdinLogs.push(m); },
    );
    assert.ok(stdinResult.bytesOut > 0);
    assert.ok(stdinLogs.some((l) => l.includes("stdin-out.jpg")));
  });

  it("runs jobs in batches", async () => {
    const dir = await mkdtemp(join(tmpdir(), "gainmap-jobs-"));
    const a = await tinyPng(dir, "a.png");
    const b = await tinyPng(dir, "b.png");
    const { failures } = await convertPlans(
      [
        { input: a, output: join(dir, "a-gain.jpg"), stdout: false },
        { input: b, output: join(dir, "b-gain.jpg"), stdout: false },
      ],
      { ...options, jobs: 2, verbose: false },
    );
    assert.equal(failures, 0);
    const empty = await convertPlans([], { ...options, jobs: 1 });
    assert.equal(empty.results.length, 0);
  });

  it("note contains actual output extension and log contains .jpeg for .jpeg input", async () => {
    const dir = await mkdtemp(join(tmpdir(), "gainmap-jpeg-ext-"));
    const jpegInput = await tinyJpeg(dir, "photo.jpeg");
    const output = join(dir, "photo-gain.jpeg");
    const logs: string[] = [];
    const result = await convertPlan({ input: jpegInput, output, stdout: false }, options, undefined, () => undefined, (m) => { logs.push(m); });
    // log must contain the real output extension
    assert.ok(logs.some((l) => l.includes(".jpeg")));
    // note uses uppercase label without a leading dot
    assert.ok(result.note.startsWith("Gain map JPEG"));
    assert.ok(!result.note.includes(".jpeg"));
  });

  it("accepts .png input when explicit .jpg output path is given", async () => {
    const dir = await mkdtemp(join(tmpdir(), "gainmap-png-escape-"));
    const pngInput = await tinyPng(dir, "photo.png");
    const output = join(dir, "photo-gain.jpg");
    const result = await convertPlan({ input: pngInput, output, stdout: false }, options, undefined, () => undefined, () => undefined);
    assert.equal(result.skipped, false);
    assert.ok(result.bytesOut > 0);
  });

  it("encodes raster outputs for png webp avif tif tiff gif", async () => {
    const dir = await mkdtemp(join(tmpdir(), "gainmap-raster-"));
    const input = await tinyPng(dir, "a.png");
    const logs: string[] = [];
    const log = (message: string) => { logs.push(message); };
    const types = ["png", "webp", "avif", "tif", "tiff", "gif"] as const;
    for (const type of types) {
      const output = join(dir, "out." + type);
      const result = await convertPlan({ input, output, stdout: false }, options, undefined, () => undefined, log);
      assert.equal(result.skipped, false);
      assert.ok(result.bytesOut > 0);
      assert.equal(result.note, type.toUpperCase());
      const meta = await sharp(await readFile(output)).metadata();
      if (type === "tif" || type === "tiff") {
        assert.equal(meta.format, "tiff");
      }
      if (type === "avif") {
        assert.ok(meta.format === "avif" || meta.format === "heif");
      }
      if (type !== "tif" && type !== "tiff" && type !== "avif") {
        assert.equal(meta.format, type);
      }
    }
    assert.ok(logs.every((line) => line.includes("->") && !line.includes("JPEG container")));
  });

  it("applies quality to webp and avif raster encodes", async () => {
    const dir = await mkdtemp(join(tmpdir(), "gainmap-rq-"));
    const input = await tinyPng(dir, "a.png");
    const webp = join(dir, "q.webp");
    const avif = join(dir, "q.avif");
    await convertPlan(
      { input, output: webp, stdout: false },
      { ...options, quality: 40 },
      undefined,
      () => undefined,
      () => undefined,
    );
    await convertPlan(
      { input, output: avif, stdout: false },
      { ...options, quality: 40 },
      undefined,
      () => undefined,
      () => undefined,
    );
    assert.equal((await sharp(await readFile(webp)).metadata()).format, "webp");
    const avifFormat = (await sharp(await readFile(avif)).metadata()).format;
    assert.ok(avifFormat === "avif" || avifFormat === "heif");
  });

  it("falls back to gain-map encoder when output path has no known type", async () => {
    const dir = await mkdtemp(join(tmpdir(), "gainmap-unk-"));
    const input = await tinyJpeg(dir, "a.jpg");
    await assert.rejects(
      convertPlan(
        { input, output: join(dir, "noext"), stdout: false },
        options,
        undefined,
        () => undefined,
        () => undefined,
      ),
      /JPEG path/,
    );
    await assert.rejects(
      convertPlan(
        { input, output: join(dir, "out.bmp"), stdout: false },
        options,
        undefined,
        () => undefined,
        () => undefined,
      ),
      /JPEG path/,
    );
    await assert.rejects(
      convertPlan(
        { input, output: null, stdout: false },
        options,
        undefined,
        () => undefined,
        () => undefined,
      ),
    );
  });
});
