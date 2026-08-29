import assert from "node:assert/strict";
import { mkdtemp, mkdir, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, it, vi } from "vitest";
import sharp from "sharp";

import Base, { reportCrash, run, shouldRunMain, USAGE } from "#src/cli.js";
import { readPackageVersion } from "#src/version.js";

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

describe("cli", () => {
  it("prints help and version", async () => {
    capture();
    assert.equal(await run(["--help"]), 0);
    assert.ok(logs.stdout.includes("gainmap"));
    assert.ok(USAGE.includes("--recursive"));
    assert.ok(USAGE.includes("--in-place"));
    assert.ok(USAGE.includes("photo-gain.jpg"));
    assert.ok(USAGE.includes("clip.mp4"));
    assert.ok(USAGE.includes("HDR MP4 transcode"));
    assert.equal(await run(["-V"]), 0);
    assert.match(logs.stdout, new RegExp("gainmap " + readPackageVersion()));
    assert.ok(logs.stdout.includes("github.com/kirkstrobeck/gainmaps") || USAGE.includes("github.com/kirkstrobeck/gainmaps"));
    assert.ok(USAGE.includes("Contributions welcome"));
    assert.equal(await run(["update"]), 0);
    assert.ok(logs.stderr.includes("git pull") || logs.stderr.includes("Docker") || logs.stderr.includes("Updating"));
  });

  it("rejects missing input and bad flags", async () => {
    capture();
    assert.equal(await run([]), 2);
    assert.equal(await run(["--model", "nope", "x.png"]), 2);
    assert.equal(await run(["--matte", "nope", "x.png"]), 2);
    assert.equal(await run(["--quality", "0", "x.png"]), 2);
    assert.equal(await run(["--quality", "101", "x.png"]), 2);
    assert.equal(await run(["--boost", "2", "x.png"]), 2);
    assert.equal(await run(["--max-size", "0", "x.png"]), 2);
    assert.equal(await run(["--jobs", "-3", "x.png"]), 2);
  });

  it("converts a file, convert alias, dry-run, and empty directory", async () => {
    capture();
    const dir = await mkdtemp(join(tmpdir(), "gainmap-cli-"));
    const pngInput = await png(dir, "shot.png");
    const input = await jpeg(dir, "shot.jpg");
    assert.equal(await run(["convert", pngInput, "-o", join(dir, "out.jpg"), "-v"]), 0);
    assert.equal(await run([input, "-n"]), 0);
    assert.ok(logs.stderr.includes("->"));
    const empty = join(dir, "empty");
    await mkdir(empty);
    assert.equal(await run([empty]), 2);
    assert.equal(await run([join(dir, "missing.png")]), 2);
    const mp4 = join(dir, "clip.mp4");
    await writeFile(mp4, Buffer.from("video"));
    assert.equal(await run([mp4, "-n"]), 0);
    assert.ok(logs.stderr.includes("clip-gain.mp4"));
    assert.equal(await run([mp4, "--stdout"]), 2);
    assert.equal(await run([pngInput, "-o", join(dir, "bad.mp4")]), 2);
  });

  it("handles recursive dir output, exclude, force, and quiet", async () => {
    capture();
    const dir = await mkdtemp(join(tmpdir(), "gainmap-tree-"));
    const nested = join(dir, "nested");
    await mkdir(nested);
    await jpeg(dir, "a.jpg");
    await jpeg(nested, "b.jpg");
    const out = join(dir, "out");
    await mkdir(out);
    assert.equal(await run(["-R", dir, "-o", out + "/", "--exclude", "**/nested/**", "--quiet", "-j", "1"]), 0);
    assert.equal(await run(["-r", dir, "-o", out, "-f", "--quality", "80", "--boost", "0.2", "--headroom", "3", "--model", "window", "--matte", "checkerboard", "--max-size", "64", "--suffix", "-hdr"]), 0);
    await writeFile(join(dir, "bad.png"), Buffer.from("not-a-png"));
    assert.equal(await run([join(dir, "bad.png"), "--continue", "-o", join(out, "bad.jpg"), "-f"]), 1);
  });

  it("covers main helpers and Base", async () => {
    capture();
    assert.equal(shouldRunMain(undefined, import.meta.url), false);
    assert.equal(shouldRunMain("/nope.js", import.meta.url), false);
    assert.equal(shouldRunMain(fileURLToPath(import.meta.url), import.meta.url), true);
    reportCrash(new Error("boom"));
    reportCrash("boom");
    const prev = process.argv;
    process.argv = ["node", "cli", "--help"];
    await Base();
    process.argv = ["node", "cli"];
    await Base();
    process.argv = prev;
  });

  it("notices a newer version and supports auto-update", async () => {
    capture();
    const cache = await mkdtemp(join(tmpdir(), "gainmap-notice-"));
    vi.stubEnv("GAINMAP_NO_UPDATE_CHECK", "");
    vi.stubEnv("GAINMAP_CACHE_DIR", cache);
    delete process.env.GAINMAP_NO_UPDATE_CHECK;
    vi.stubGlobal("fetch", async () => ({ ok: true, json: async () => ({ version: "9.9.9" }) }));
    assert.equal(await run(["--help"]), 0);
    assert.ok(logs.stderr.includes("9.9.9"));
    assert.equal(await run(["--self-update"]), 0);
    const dir = await mkdtemp(join(tmpdir(), "gainmap-auto-"));
    const input = await jpeg(dir, "shot.jpg");
    assert.equal(await run([input, "-n", "--auto-update"]), 0);
    assert.ok(logs.stderr.includes("Updated") || logs.stderr.includes("Re-run"));
    assert.equal(await run([input, "-n", "--offline"]), 0);
  });
});

describe("cli output paths", () => {
  it("writes a default sibling copy with -gain and leaves the source alone", async () => {
    capture();
    const dir = await mkdtemp(join(tmpdir(), "gainmap-sib-"));
    const input = await jpeg(dir, "photo.jpg");
    const before = await readFile(input);
    assert.equal(await run([input]), 0);
    const dest = join(dir, "photo-gain.jpg");
    assert.equal((await readFile(dest))[0], 0xff);
    assert.deepEqual(await readFile(input), before);
  });

  it("writes recursive sibling copies beside nested sources", async () => {
    capture();
    const dir = await mkdtemp(join(tmpdir(), "gainmap-rsib-"));
    const nested = join(dir, "nested");
    await mkdir(nested);
    await jpeg(dir, "a.jpg");
    const nestedSrc = await jpeg(nested, "b.jpg");
    const srcBytes = await readFile(nestedSrc);
    assert.equal(await run(["-R", dir]), 0);
    assert.equal((await readFile(join(dir, "a-gain.jpg")))[0], 0xff);
    assert.equal((await readFile(join(nested, "b-gain.jpg")))[0], 0xff);
    assert.deepEqual(await readFile(nestedSrc), srcBytes);
  });

  it("writes -o as an exact file for one image", async () => {
    capture();
    const dir = await mkdtemp(join(tmpdir(), "gainmap-ofile-"));
    const input = await jpeg(dir, "photo.jpg");
    const dest = join(dir, "hdr.jpg");
    assert.equal(await run([input, "-o", dest]), 0);
    assert.equal((await readFile(dest))[0], 0xff);
    assert.equal(await run([input, "-o", dest, "-f"]), 0);
  });

  it("rejects recursive -o that is a jpeg path or an existing file", async () => {
    capture();
    const dir = await mkdtemp(join(tmpdir(), "gainmap-odir-"));
    await jpeg(dir, "a.jpg");
    assert.equal(await run(["-R", dir, "-o", join(dir, "hdr.jpg")]), 2);
    assert.ok(logs.stderr.includes("must be"));
    const existing = join(dir, "not-a-dir.bin");
    await writeFile(existing, Buffer.from("x"));
    assert.equal(await run(["-R", dir, "-o", existing]), 2);
    assert.ok(logs.stderr.includes("must be"));
  });

  it("mirrors recursive -o directories without appending -gain", async () => {
    capture();
    const dir = await mkdtemp(join(tmpdir(), "gainmap-mirror-"));
    const nested = join(dir, "nested");
    await mkdir(nested);
    await jpeg(dir, "a.jpg");
    await jpeg(nested, "b.jpg");
    const out = join(dir, "out");
    assert.equal(await run(["-R", dir, "-o", out]), 0);
    assert.equal((await readFile(join(out, "a.jpg")))[0], 0xff);
    assert.equal((await readFile(join(out, "nested", "b.jpg")))[0], 0xff);
    await assert.rejects(readFile(join(out, "a-gain.jpg")));
  });

  it("appends --suffix for sibling copies and for -o directories", async () => {
    capture();
    const dir = await mkdtemp(join(tmpdir(), "gainmap-sfx-"));
    const nested = join(dir, "nested");
    await mkdir(nested);
    const input = await jpeg(dir, "photo.jpg");
    await jpeg(nested, "b.jpg");
    assert.equal(await run([input, "--suffix", "-hdr"]), 0);
    assert.equal((await readFile(join(dir, "photo-hdr.jpg")))[0], 0xff);
    const out = join(dir, "out");
    assert.equal(await run(["-R", dir, "-o", out, "--suffix", "-hdr", "--ext", "jpg"]), 0);
    assert.equal((await readFile(join(out, "photo-hdr.jpg")))[0], 0xff);
    assert.equal((await readFile(join(out, "nested", "b-hdr.jpg")))[0], 0xff);
  });

  it("overwrites a jpeg in place and rejects png, -o, stdout, no-clobber, and stdin", async () => {
    capture();
    const dir = await mkdtemp(join(tmpdir(), "gainmap-ip-"));
    const input = await jpeg(dir, "photo.jpg");
    const before = await readFile(input);
    assert.equal(await run(["-i", input]), 0);
    const after = await readFile(input);
    assert.notDeepEqual(after, before);
    assert.equal(after[0], 0xff);
    await assert.rejects(readFile(join(dir, "photo-gain.jpg")));
    const pngInput = await png(dir, "photo.png");
    assert.equal(await run(["--in-place", pngInput]), 2);
    assert.ok(logs.stderr.includes("requires"));
    assert.equal(await run(["-i", input, "-o", join(dir, "x.jpg")]), 2);
    assert.ok(logs.stderr.includes("must be"));
    assert.equal(await run(["-i", input, "--stdout"]), 2);
    assert.equal(await run(["-i", input, "--no-clobber"]), 2);
    assert.equal(await run(["-i", "--stdin"]), 2);
  });

  it("overwrites each jpeg recursively in place", async () => {
    capture();
    const dir = await mkdtemp(join(tmpdir(), "gainmap-rip-"));
    const nested = join(dir, "nested");
    await mkdir(nested);
    const a = await jpeg(dir, "a.jpg");
    const b = await jpeg(nested, "b.jpg");
    const beforeA = await readFile(a);
    const beforeB = await readFile(b);
    assert.equal(await run(["-R", "-i", dir]), 0);
    assert.notDeepEqual(await readFile(a), beforeA);
    assert.notDeepEqual(await readFile(b), beforeB);
    await assert.rejects(readFile(join(dir, "a-gain.jpg")));
    await assert.rejects(readFile(join(nested, "b-gain.jpg")));
  });

  it("overwrites an existing sibling copy with -f", async () => {
    capture();
    const dir = await mkdtemp(join(tmpdir(), "gainmap-force-"));
    const input = await jpeg(dir, "photo.jpg");
    assert.equal(await run([input]), 0);
    assert.equal(await run([input]), 0);
    assert.ok(logs.stderr.includes("skip"));
    assert.equal(await run([input, "-f"]), 0);
    assert.ok(logs.stderr.includes("photo-gain.jpg"));
  });

  it("rejects multi-file non-recursive -o that is a file", async () => {
    capture();
    const dir = await mkdtemp(join(tmpdir(), "gainmap-multi-"));
    const a = await jpeg(dir, "a.jpg");
    const b = await jpeg(dir, "b.jpg");
    assert.equal(await run([a, b, "-o", join(dir, "out.jpg")]), 2);
    assert.ok(logs.stderr.includes("must be"));
  });

  it("treats recursive -o missing non-jpeg path as a directory", async () => {
    capture();
    const dir = await mkdtemp(join(tmpdir(), "gainmap-missdir-"));
    const nested = join(dir, "nested");
    await mkdir(nested);
    await jpeg(dir, "a.jpg");
    await jpeg(nested, "b.jpg");
    const out = join(dir, "new-out");
    assert.equal(await run(["-R", dir, "-o", out, "-n"]), 0);
    assert.ok(logs.stderr.includes("new-out"));
    assert.ok(logs.stderr.includes("nested"));
    assert.equal(await run(["-R", dir, "-o", join(dir, "slash-out") + String.fromCharCode(92), "-n"]), 0);
  });
});
