import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { copyFile } from "node:fs/promises";
import { promisify } from "node:util";
import { readFile } from "node:fs/promises";
import { mkdtemp, writeFile, chmod } from "node:fs/promises";
import { join, dirname } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import { createHash } from "node:crypto";
import { describe, it } from "vitest";

const execFileAsync = promisify(execFile);
const __dirname = dirname(fileURLToPath(import.meta.url));
const PKG_DIR = join(__dirname, "..");
const DIST_CLI = join(PKG_DIR, "dist/cli.js");
const FIXTURES = join(PKG_DIR, "test/fixtures");
const INPUT = join(FIXTURES, "input");

const BASE_FLAGS = [
  "--offline", "--quiet", "-j", "1",
  "--quality", "92", "--boost", "0.5",
  "--model", "highlight", "--matte", "white",
] as const;

type Scenario = {
  readonly name: string;
  readonly input: string;
  readonly extra?: readonly string[];
};

const SCENARIOS: readonly Scenario[] = [
  { name: "png-default",   input: "white.png" },
  { name: "jpg-default",   input: "photo.jpg" },
  { name: "svg-default",   input: "mark.svg" },
  { name: "gif-default",   input: "frame.gif" },
  { name: "webp-default",  input: "shot.webp" },
  { name: "quality-80",    input: "photo.jpg", extra: ["--quality", "80"] },
  { name: "boost-1",       input: "photo.jpg", extra: ["--boost", "1"] },
  { name: "headroom-4",    input: "photo.jpg", extra: ["--headroom", "4"] },
  { name: "model-window",  input: "photo.jpg", extra: ["--model", "window"] },
  { name: "matte-checker", input: "mark.svg",  extra: ["--matte", "checkerboard"] },
  { name: "max-size-4",    input: "photo.jpg", extra: ["--max-size", "4"] },
  { name: "custom",        input: "photo.jpg" },
] as const;

const sha256 = (buf: Buffer): string =>
  createHash("sha256").update(buf).digest("hex");

const convertScenario = async (scenario: Scenario): Promise<Buffer> => {
  const dir = await mkdtemp(join(tmpdir(), "gainmap-e2e-"));
  const out = join(dir, `${scenario.name}.jpg`);
  await execFileAsync(process.execPath, [
    DIST_CLI,
    join(INPUT, scenario.input),
    "-o", out, "-f",
    ...BASE_FLAGS,
    ...(scenario.extra ?? []),
  ]);
  return readFile(out);
};

const convertSuffixHdr = async (): Promise<Buffer> => {
  const dir = await mkdtemp(join(tmpdir(), "gainmap-suffix-"));
  await copyFile(join(INPUT, "photo.jpg"), join(dir, "photo.jpg"));
  await execFileAsync(process.execPath, [
    DIST_CLI,
    join(dir, "photo.jpg"),
    ...BASE_FLAGS,
    "--suffix", "-hdr",
  ]);
  return readFile(join(dir, "photo-hdr.jpg"));
};

const parseChecksums = async (): Promise<ReadonlyMap<string, string>> => {
  const content = await readFile(join(FIXTURES, "checksums.sha256"), "utf8");
  return new Map(
    content
      .trim()
      .split("\n")
      .filter(Boolean)
      .map((line) => {
        const [hash, path] = line.trim().split(/\s+/) as [string, string];
        const name = path.replace("test/fixtures/expected/", "").replace(".jpg", "");
        return [name, hash] as const;
      }),
  );
};

describe("e2e checksum", () => {
  it(
    "fresh CLI output matches sha256 checksums for all scenarios",
    async () => {
      const checksums = await parseChecksums();

      await Promise.all([
        ...SCENARIOS.map(async (scenario) => {
          const buf = await convertScenario(scenario);
          const actualHash = sha256(buf);
          const expectedHash = checksums.get(scenario.name);
          assert.ok(expectedHash, `No checksum entry for ${scenario.name}`);
          assert.equal(actualHash, expectedHash, `Hash mismatch for ${scenario.name}`);
        }),
        (async () => {
          const buf = await convertSuffixHdr();
          const actualHash = sha256(buf);
          const expectedHash = checksums.get("suffix-hdr");
          assert.ok(expectedHash, "No checksum entry for suffix-hdr");
          assert.equal(actualHash, expectedHash, "Hash mismatch for suffix-hdr");
        })(),
      ]);
    },
    120_000,
  );

  it(
    "e2e/run.sh passes with node dist/cli.js as GAINMAP_BIN",
    async () => {
      const runSh = join(PKG_DIR, "e2e/run.sh");
      const wrapperDir = await mkdtemp(join(tmpdir(), "gainmap-e2e-wrapper-"));
      const wrapper = join(wrapperDir, "gainmap");
      await writeFile(wrapper, `#!/bin/sh\nexec ${process.execPath} ${DIST_CLI} "$@"\n`);
      await chmod(wrapper, 0o755);
      const { stdout, stderr } = await execFileAsync("sh", [runSh], {
        env: { ...process.env, GAINMAP_BIN: wrapper, GAINMAP_NO_UPDATE_CHECK: "1" },
        timeout: 600_000,
      }).catch((err: NodeJS.ErrnoException & { stdout?: string; stderr?: string }) => ({
        stdout: err.stdout ?? "",
        stderr: err.stderr ?? "",
        failed: true,
      }));
      const output = stdout + stderr;
      assert.ok(!output.includes("✗"), `run.sh had failures:\n${output}`);
      assert.ok(output.includes("passed"), `run.sh did not report passed:\n${output}`);
    },
    720_000,
  );

  it("png-default conversion is deterministic", async () => {
    const input = join(INPUT, "white.png");

    const run = async () => {
      const dir = await mkdtemp(join(tmpdir(), "gainmap-det-"));
      const out = join(dir, "out.jpg");
      await execFileAsync(process.execPath, [
        DIST_CLI, input,
        "-o", out, "-f",
        "--offline", "--quiet", "-j", "1",
        "--quality", "92", "--boost", "0.5", "--model", "highlight", "--matte", "white",
      ]);
      return sha256(await readFile(out));
    };

    const [h1, h2] = await Promise.all([run(), run()]);
    assert.equal(h1, h2, "Encoder is not deterministic");
  });
});
