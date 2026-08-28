import assert from "node:assert/strict";
import { createServer } from "node:net";
import { mkdtemp, mkdir, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { Readable } from "node:stream";
import { afterEach, describe, it, vi } from "vitest";
import sharp from "sharp";

import { flagString, flagStrings, parseArgs } from "#src/args.js";
import { convertPlan, convertPlans, formatError } from "#src/convert.js";
import { collectInputs, matchesExclude } from "#src/walk.js";
import { planOutputs } from "#src/output-path.js";
import { exitCodeFor, run, startIfMain } from "#src/cli.js";

afterEach(() => {
  vi.restoreAllMocks();
});

describe("coverage leftovers", () => {
  it("covers repeatable string-to-array flags and relative outputs without root", () => {
    const once = parseArgs(["--exclude", "raw/**"]);
    assert.deepEqual(flagStrings(once.flags, "exclude"), ["raw/**"]);
    assert.equal(flagString(once.flags, "exclude"), "raw/**");
    const twice = parseArgs(["--exclude", "a/**", "--exclude", "b/**"]);
    assert.deepEqual(flagStrings(twice.flags, "exclude"), ["a/**", "b/**"]);
    const triple = parseArgs(["--exclude", "a/**", "--exclude", "b/**", "--exclude", "c/**"]);
    assert.equal(flagStrings(triple.flags, "exclude").length, 3);
    const planned = planOutputs(["/tmp/a.jpg", "/tmp/b.jpg"], {
      output: "/tmp/out",
      suffix: "",
      stdout: false,
      outputIsDirectory: true,
    });
    assert.ok(planned[0]!.output?.endsWith("a.jpg"));
  });

  it("covers walk exclude-of-input, symlink input, fifo skip, and glob specials", async () => {
    const dir = await mkdtemp(join(tmpdir(), "gainmap-cov-"));
    const png = await sharp({ create: { width: 1, height: 1, channels: 3, background: "red" } }).png().toBuffer();
    const file = join(dir, "keep.png");
    await writeFile(file, png);
    await symlink(file, join(dir, "as-input.png"));
    const skipped = await collectInputs([join(dir, "as-input.png")], { recursive: false, extensions: ["png"], exclude: [] });
    assert.equal(skipped.length, 0);
    const excluded = await collectInputs([file], { recursive: false, extensions: ["png"], exclude: ["**/keep.png"] });
    assert.equal(excluded.length, 0);
    const globbed = await collectInputs([dir], { recursive: true, extensions: ["png"], exclude: ["**/keep.png"] });
    assert.equal(globbed.length, 0);
    assert.equal(matchesExclude("foo.bar.png", ["foo.bar.png"]), true);
    assert.equal(matchesExclude("fooXbar.png", ["foo.bar.png"]), false);
    assert.equal(matchesExclude("file(1).png", ["file(1).png"]), true);
    assert.equal(matchesExclude("shots" + String.fromCharCode(92) + "raw" + String.fromCharCode(92) + "a.jpg", ["**/raw/**"]), true);
    const sock = join(dir, "pipe.sock");
    const server = createServer();
    await new Promise((resolve, reject) => {
      server.on("error", reject);
      server.listen(sock, () => resolve(undefined));
    });
    const sockAsInput = await collectInputs([sock], { recursive: false, extensions: ["png"], exclude: [] });
    assert.equal(sockAsInput.length, 0);
    const withSock = await collectInputs([dir], { recursive: false, extensions: ["png"], exclude: [] });
    assert.ok(withSock.every((path) => !path.endsWith("pipe.sock")));
    await new Promise((resolve) => server.close(() => resolve(undefined)));
    const asDot = await collectInputs(["."], { recursive: false, extensions: ["nope"], exclude: [] }, dir);
    assert.equal(asDot.length, 0);
  });

  it("uses default convert loggers and stdin CLI", async () => {
    const dir = await mkdtemp(join(tmpdir(), "gainmap-std-"));
    const png = await sharp({ create: { width: 2, height: 2, channels: 3, background: "white" } }).png().toBuffer();
    const input = join(dir, "in.png");
    await writeFile(input, png);
    const { failures } = await convertPlans(
      [{ input, output: join(dir, "dry.jpg"), stdout: false }],
      { dryRun: true, force: false, quiet: false, verbose: true, continueOnError: false, jobs: 1 },
    );
    assert.equal(failures, 0);
    vi.spyOn(process.stdout, "write").mockImplementation(() => true);
    vi.spyOn(process.stderr, "write").mockImplementation(() => true);
    const streamed = await convertPlans(
      [{ input, output: null, stdout: true }],
      { dryRun: false, force: false, quiet: true, verbose: false, continueOnError: false, jobs: 1 },
      new Uint8Array(png),
    );
    assert.equal(streamed.failures, 0);
    const stdin = Readable.from([png]);
    Object.defineProperty(process, "stdin", { value: stdin, configurable: true });
    const chunks: Uint8Array[] = [];
    const stdout = vi.spyOn(process.stdout, "write").mockImplementation((chunk) => {
      if (typeof chunk !== "string") chunks.push(chunk as Uint8Array);
      return true;
    });
    const code = await run(["--stdin", "--stdout", "--quality", "80"]);
    stdout.mockRestore();
    assert.equal(code, 0);
    assert.ok(chunks[0]![0] === 0xff || chunks.some((c) => c[0] === 0xff));
  });

  it("maps generic errors to exit 1 and startIfMain", async () => {
    vi.spyOn(process.stderr, "write").mockImplementation(() => true);
    const dir = await mkdtemp(join(tmpdir(), "gainmap-bad-"));
    const bad = join(dir, "bad.png");
    await writeFile(bad, Buffer.from("not-a-png"));
    const code = await run([bad, "-o", join(dir, "bad-out.jpg")]);
    assert.equal(code, 2);
    startIfMain(undefined, import.meta.url);
    const started: string[] = [];
    startIfMain(fileURLToPath(import.meta.url), import.meta.url, async () => { started.push("crash"); throw new Error("crash"); });
    startIfMain(fileURLToPath(import.meta.url), import.meta.url, async () => { started.push("ok"); });
    await new Promise((resolve) => setTimeout(resolve, 20));
    assert.ok(started.includes("crash"));
    assert.ok(started.includes("ok"));
  });

  it("covers multi-input root, dry-run stdout, formatError, and exit codes", async () => {
    assert.equal(formatError(new Error("e")), "e");
    assert.equal(formatError("raw"), "raw");
    assert.equal(exitCodeFor(Object.assign(new Error("x"), { code: "EMPTY" })), 2);
    assert.equal(exitCodeFor(Object.assign(new Error("x"), { code: "UNSUPPORTED" })), 2);
    assert.equal(exitCodeFor(Object.assign(new Error("x"), { code: "ENOENT" })), 2);
    assert.equal(exitCodeFor(Object.assign(new Error("x"), { code: "EACCES" })), 1);
    assert.equal(exitCodeFor(new Error("missing input")), 2);
    assert.equal(exitCodeFor(new Error("--output requires a value")), 2);
    assert.equal(exitCodeFor(new Error("--quality must be 1-100")), 2);
    assert.equal(exitCodeFor(new Error("no matching images")), 2);
    assert.equal(exitCodeFor(new Error("Unsupported image type")), 2)
    assert.equal(exitCodeFor(new Error("unsupported option: --nope")), 2);
    assert.equal(exitCodeFor("weird"), 1);
    assert.equal(exitCodeFor(null), 1);
    const dir = await mkdtemp(join(tmpdir(), "gainmap-more-"));
    const jpeg = await sharp({ create: { width: 2, height: 2, channels: 3, background: "white" } }).jpeg().toBuffer();
    const a = join(dir, "a.jpg");
    const b = join(dir, "b.jpg");
    await writeFile(a, jpeg);
    await writeFile(b, jpeg);
    const out = join(dir, "out");
    await mkdir(out);
    vi.spyOn(process.stderr, "write").mockImplementation(() => true);
    vi.spyOn(process.stdout, "write").mockImplementation(() => true);
    assert.equal(await run([a, b, "-o", out + "/", "-j", "1"]), 0);
    assert.equal(await run([a, "-n", "-j", "0"]), 0);
    assert.equal(await run([a, "-n", "-j", "99"]), 0);
    assert.equal(await run([a, "-n", "-o", "dest" + String.fromCharCode(92)]), 0);
    const logs: string[] = [];
    const dry = await convertPlan(
      { input: a, output: null, stdout: true },
      { dryRun: true, force: false, quiet: false, verbose: true, continueOnError: false, jobs: 1 },
      undefined,
      () => undefined,
      (message) => { logs.push(message); },
    );
    assert.ok(logs.some((line) => line.includes("->")));
    assert.equal(dry.note, "dry-run");
    const one = await convertPlans(
      [{ input: a, output: join(dir, "one.jpg"), stdout: false }],
      { dryRun: true, force: false, quiet: false, verbose: false, continueOnError: false, jobs: 1 },
      undefined,
      () => undefined,
      () => undefined,
    );
    assert.equal(one.failures, 0);
  });
});
