import assert from "node:assert/strict";
import { mkdtemp, mkdir, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, it, vi } from "vitest";
import sharp from "sharp";

import { run, USAGE } from "#src/cli.js";

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

async function png(dir: string, name: string) {
  const path = join(dir, name);
  await writeFile(path, await sharp({ create: { width: 2, height: 2, channels: 3, background: "red" } }).png().toBuffer());
  return path;
}

async function jpeg(dir: string, name: string) {
  const path = join(dir, name);
  await writeFile(path, await sharp({ create: { width: 2, height: 2, channels: 3, background: "red" } }).jpeg().toBuffer());
  return path;
}

async function transparentPng(dir: string, name: string) {
  const path = join(dir, name);
  const pixels = Buffer.from([255, 0, 0, 128, 0, 255, 0, 64, 0, 0, 255, 200, 255, 255, 0, 0]);
  await writeFile(path, await sharp(pixels, { raw: { width: 2, height: 2, channels: 4 } }).png().toBuffer());
  return path;
}

describe("cli out-type", () => {
  it("documents --out and --out-type in usage", () => {
    assert.ok(USAGE.includes("--out"));
    assert.ok(USAGE.includes("--out-type"));
    assert.ok(USAGE.includes("dest.webp"));
  });

  it("directory plus --out-type png writes png", async () => {
    capture();
    const dir = await mkdtemp(join(tmpdir(), "gainmap-otp-"));
    const input = await png(dir, "a.png");
    const out = join(dir, "out");
    assert.equal(await run([input, "--out", out, "--out-type", "png"]), 0);
    const dest = join(out, "a.png");
    const bytes = await readFile(dest);
    assert.notEqual(bytes[0], 0xff);
    const meta = await sharp(bytes).metadata();
    assert.equal(meta.format, "png");
  });

  it("file --out dest.webp without --out-type writes webp", async () => {
    capture();
    const dir = await mkdtemp(join(tmpdir(), "gainmap-otw-"));
    const input = await png(dir, "a.png");
    const dest = join(dir, "dest.webp");
    assert.equal(await run([input, "--out", dest]), 0);
    const meta = await sharp(await readFile(dest)).metadata();
    assert.equal(meta.format, "webp");
  });

  it("mismatch --out file.png --out-type jpeg errors exit 2", async () => {
    capture();
    const dir = await mkdtemp(join(tmpdir(), "gainmap-otm-"));
    const input = await png(dir, "a.png");
    assert.equal(await run([input, "--out", join(dir, "file.png"), "--out-type", "jpeg"]), 2);
    assert.ok(logs.stderr.includes("must") || logs.stderr.includes("agree"));
  });

  it("-R --out dir --out-type webp nests webp files", async () => {
    capture();
    const dir = await mkdtemp(join(tmpdir(), "gainmap-otr-"));
    const nested = join(dir, "nested");
    await mkdir(nested);
    await jpeg(dir, "a.jpg");
    await jpeg(nested, "b.jpg");
    const out = join(dir, "out");
    assert.equal(await run(["-R", dir, "--out", out, "--out-type", "webp"]), 0);
    const nestedOut = join(out, "nested", "b.webp");
    const meta = await sharp(await readFile(nestedOut)).metadata();
    assert.equal(meta.format, "webp");
  });

  it("--out alias equals --output for dest.webp", async () => {
    capture();
    const dir = await mkdtemp(join(tmpdir(), "gainmap-ota-"));
    const input = await png(dir, "a.png");
    const dest = join(dir, "alias.webp");
    assert.equal(await run([input, "--out", dest]), 0);
    assert.equal((await sharp(await readFile(dest)).metadata()).format, "webp");
  });

  it("--out-type without --out exits 2", async () => {
    capture();
    const dir = await mkdtemp(join(tmpdir(), "gainmap-otn-"));
    const input = await png(dir, "a.png");
    assert.equal(await run([input, "--out-type", "png"]), 2);
    assert.ok(logs.stderr.includes("requires") || logs.stderr.includes("must be"));
  });

  it("unknown --out-type foo and .foo exit 2", async () => {
    capture();
    const dir = await mkdtemp(join(tmpdir(), "gainmap-otu-"));
    const input = await png(dir, "a.png");
    const out = join(dir, "out");
    assert.equal(await run([input, "--out", out, "--out-type", "foo"]), 2);
    assert.equal(await run([input, "--out", out, "--out-type", ".foo"]), 2);
  });

  it("--out dest.jpg --out-type jpeg agrees and writes gain-map JPEG", async () => {
    capture();
    const dir = await mkdtemp(join(tmpdir(), "gainmap-otj-"));
    const input = await png(dir, "a.png");
    const dest = join(dir, "dest.jpg");
    assert.equal(await run([input, "--out", dest, "--out-type", "jpeg"]), 0);
    assert.equal((await readFile(dest))[0], 0xff);
  });

  it("--out-type .WEBP with directory dest works", async () => {
    capture();
    const dir = await mkdtemp(join(tmpdir(), "gainmap-otc-"));
    const input = await png(dir, "a.png");
    const out = join(dir, "out");
    assert.equal(await run([input, "--out", out, "--out-type", ".WEBP"]), 0);
    assert.equal((await sharp(await readFile(join(out, "a.webp"))).metadata()).format, "webp");
  });

  it("--out dest.webp --out-type webp agrees", async () => {
    capture();
    const dir = await mkdtemp(join(tmpdir(), "gainmap-otg-"));
    const input = await png(dir, "a.png");
    const dest = join(dir, "dest.webp");
    assert.equal(await run([input, "--out", dest, "--out-type", "webp"]), 0);
    assert.equal((await sharp(await readFile(dest)).metadata()).format, "webp");
  });

  it("png and webp raster keep alpha from transparent source", async () => {
    capture();
    const dir = await mkdtemp(join(tmpdir(), "gainmap-otaa-"));
    const input = await transparentPng(dir, "alpha.png");
    const pngDest = join(dir, "out.png");
    const webpDest = join(dir, "out.webp");
    assert.equal(await run([input, "--out", pngDest]), 0);
    assert.equal(await run([input, "--out", webpDest]), 0);
    const pngMeta = await sharp(await readFile(pngDest)).metadata();
    const webpMeta = await sharp(await readFile(webpDest)).metadata();
    assert.ok((pngMeta.channels ?? 0) >= 4 || pngMeta.hasAlpha === true);
    assert.ok((webpMeta.channels ?? 0) >= 4 || webpMeta.hasAlpha === true);
  });

  it("--out-type jpeg on a directory writes .jpeg via gain-map encoder", async () => {
    capture();
    const dir = await mkdtemp(join(tmpdir(), "gainmap-otjd-"));
    const input = await png(dir, "a.png");
    const out = join(dir, "out");
    assert.equal(await run([input, "--out", out, "--out-type", "jpeg"]), 0);
    const dest = join(out, "a.jpeg");
    assert.equal((await readFile(dest))[0], 0xff);
  });

  it("--stdout --out-type png and --out - --out-type png exit 2", async () => {
    capture();
    const dir = await mkdtemp(join(tmpdir(), "gainmap-ots-"));
    const input = await png(dir, "a.png");
    assert.equal(await run([input, "--stdout", "--out-type", "png"]), 2);
    assert.equal(await run([input, "--out", "-", "--out-type", "png"]), 2);
  });

  it("-R --out dest.webp still requires a directory", async () => {
    capture();
    const dir = await mkdtemp(join(tmpdir(), "gainmap-otf-"));
    await jpeg(dir, "a.jpg");
    assert.equal(await run(["-R", dir, "--out", join(dir, "dest.webp")]), 2);
    assert.ok(logs.stderr.includes("must be"));
  });

  it("treats missing --out without extension as a non-directory file dest", async () => {
    capture();
    const dir = await mkdtemp(join(tmpdir(), "gainmap-otnd-"));
    const input = await png(dir, "a.png");
    assert.equal(await run([input, "--out", join(dir, "noext")]), 2);
    assert.ok(logs.stderr.includes("must be"));
  });

  it("treats an existing file --out as a file not a directory", async () => {
    capture();
    const dir = await mkdtemp(join(tmpdir(), "gainmap-otef-"));
    const input = await png(dir, "a.png");
    const dest = join(dir, "existing.webp");
    await writeFile(dest, Buffer.from("x"));
    assert.equal(await run([input, "--out", dest, "-f"]), 0);
    assert.equal((await sharp(await readFile(dest)).metadata()).format, "webp");
  });

  it("treats an existing directory --out as a directory for a single file", async () => {
    capture();
    const dir = await mkdtemp(join(tmpdir(), "gainmap-oted-"));
    const input = await png(dir, "a.png");
    const out = join(dir, "outdir");
    await mkdir(out);
    assert.equal(await run([input, "--out", out]), 0);
    assert.equal((await readFile(join(out, "a.jpg")))[0], 0xff);
  });

  it("rejects --out-type heic and --out dest.heic", async () => {
    capture()
    const dir = await mkdtemp(join(tmpdir(), "gainmap-oth-"))
    const input = await png(dir, "a.png")
    assert.equal(await run([input, "--out-type", "heic"]), 2)
    assert.match(logs.stderr, /unsupported/)
    assert.match(logs.stderr, /heic/i)
    assert.equal(await run([input, "--out", join(dir, "dest.heic")]), 2)
    assert.equal(await run([input, "--out", join(dir, "dest.svg")]), 2)
    assert.equal(await run([input, "--out-type", "heif"]), 2)
    assert.equal(await run([input, "--out", join(dir, "dest.heif")]), 2)
    assert.equal(await run([input, "--out", join(dir, "out"), "--out-type", "svg"]), 2)
  });
});
