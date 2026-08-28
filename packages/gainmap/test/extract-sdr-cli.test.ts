import assert from "node:assert/strict";
import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Readable } from "node:stream";
import { afterEach, describe, it, vi } from "vitest";
import sharp from "sharp";

import { run } from "#src/cli.js";
import { encodeRgbaToUltraHdrJpeg } from "#src/encode.js";
import { exitCodeForExtract } from "#src/extract-sdr-cmd.js";

const logs: { stdout: string; stderr: string } = { stdout: "", stderr: "" };

function capture() {
  logs.stdout = "";
  logs.stderr = "";
  vi.spyOn(process.stdout, "write").mockImplementation((chunk) => {
    logs.stdout += String(chunk);
    return true;
  });
  vi.spyOn(process.stderr, "write").mockImplementation((chunk) => {
    logs.stderr += String(chunk);
    return true;
  });
}

afterEach(() => {
  vi.restoreAllMocks();
});

function rgba(width: number, height: number): Uint8Array {
  return Uint8Array.from(
    { length: width * height * 4 },
    (_, i) => (i % 4 === 3 ? 255 : ((i % 4) * 40 + 80) & 0xff),
  );
}

describe("gainmap extract-sdr CLI", () => {
  it("writes SDR via -o and documents the subcommand in help", async () => {
    capture();
    assert.equal(await run(["--help"]), 0);
    assert.ok(logs.stdout.includes("extract-sdr"));
    const dir = await mkdtemp(join(tmpdir(), "gainmap-extract-"));
    const gainmapPath = join(dir, "in-gainmap.jpg");
    const outPath = join(dir, "out-sdr.jpg");
    const encoded = encodeRgbaToUltraHdrJpeg(rgba(3, 3), 3, 3, { quality: 80 });
    await writeFile(gainmapPath, encoded.output);
    assert.equal(await run(["extract-sdr", gainmapPath, "-o", outPath, "--force", "--no-update-check"]), 0);
    const meta = await sharp(await readFile(outPath)).metadata();
    assert.equal(meta.format, "jpeg");
    assert.equal(meta.width, 3);
    assert.equal(meta.height, 3);
  });

  it("rejects missing input, missing files, and non-JPEG with exit 2", async () => {
    capture();
    assert.equal(await run(["extract-sdr", "--no-update-check"]), 2);
    assert.equal(await run(["extract-sdr", join(tmpdir(), "no-such-gainmap.jpg"), "--no-update-check"]), 2);
    const dir = await mkdtemp(join(tmpdir(), "gainmap-extract-bad-"));
    const bad = join(dir, "nope.bin");
    await writeFile(bad, Buffer.from("not-jpeg"));
    assert.equal(await run(["extract-sdr", bad, "-o", join(dir, "x.jpg"), "--force", "--no-update-check"]), 2);
  });

  it("skips existing outputs without --force and supports default -sdr path", async () => {
    capture();
    const dir = await mkdtemp(join(tmpdir(), "gainmap-extract-skip-"));
    const gainmapPath = join(dir, "photo.jpg");
    const encoded = encodeRgbaToUltraHdrJpeg(rgba(2, 2), 2, 2, {});
    await writeFile(gainmapPath, encoded.output);
    const defaultOut = join(dir, "photo-sdr.jpg");
    await writeFile(defaultOut, Buffer.from("exists"));
    assert.equal(await run(["extract-sdr", gainmapPath, "--no-update-check"]), 0);
    assert.ok(logs.stderr.includes("skip"));
    assert.equal(await run(["extract-sdr", gainmapPath, "--force", "--no-update-check"]), 0);
    assert.equal((await sharp(await readFile(defaultOut)).metadata()).format, "jpeg");
  });

  it("writes stdout, reads stdin, and maps write failures to exit 1", async () => {
    capture();
    const dir = await mkdtemp(join(tmpdir(), "gainmap-extract-io-"));
    const gainmapPath = join(dir, "in.jpg");
    const encoded = encodeRgbaToUltraHdrJpeg(rgba(2, 2), 2, 2, {});
    await writeFile(gainmapPath, encoded.output);
    assert.equal(await run(["extract-sdr", gainmapPath, "--stdout", "--no-update-check"]), 0);
    assert.ok(logs.stdout.length > 0);
    assert.equal(
      await run(["extract-sdr", gainmapPath, "-o", join(dir, "x.png"), "--force", "--no-update-check"]),
      2,
    );
    const blocker = join(dir, "as-file");
    await writeFile(blocker, Buffer.from("x"));
    assert.equal(
      await run(["extract-sdr", gainmapPath, "-o", join(blocker, "out.jpg"), "--force", "--no-update-check"]),
      1,
    );
    Object.defineProperty(process, "stdin", {
      value: Readable.from([Buffer.from(encoded.output)]),
      configurable: true,
    });
    assert.equal(await run(["extract-sdr", "-", "--stdout", "--no-update-check"]), 0);
    assert.equal(
      await run(["extract-sdr", gainmapPath, "-o", join(dir, "fresh-sdr.jpg"), "--no-update-check"]),
      0,
    );
    assert.equal(exitCodeForExtract("disk full"), 1);
    assert.equal(exitCodeForExtract(Object.assign(new Error("nope"), { code: "NO_SOI" })), 2);
  });
});
