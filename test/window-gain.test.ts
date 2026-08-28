import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { accessSync, constants, existsSync, mkdirSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it } from "vitest";

const repo = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const windowDir = join(repo, "fixtures/window");
const toolsDir = join(repo, "tools/window-gain");
const outDir = join(repo, "tmp-window-gain");
const candidateJpeg = join(outDir, "window-from-jpeg-calibrated.jpg");
const referenceHeic = join(windowDir, "window-gain.HEIC");
const calibrationPath = join(windowDir, "calibration.json");

const isDarwin = process.platform === "darwin";
const fixtureNames = ["window.jpeg", "window-gain.HEIC", "window-gain.jpeg", "calibration.json"];
const fixturesPresent = fixtureNames.every((name) => existsSync(join(windowDir, name)));

function ensureCompareBinary(): string {
  const bin = join(toolsDir, "compare-hdr");
  try {
    accessSync(bin, constants.X_OK);
    return bin;
  } catch {
    execFileSync(
      "swiftc",
      ["-O", join(toolsDir, "compare-hdr.swift"), "-o", bin, "-framework", "AppKit", "-framework", "ImageIO", "-framework", "CoreGraphics"],
      { stdio: "pipe" },
    );
    return bin;
  }
}

describe.runIf(fixturesPresent)("window gain-map fixtures", () => {
  it("reads local calibration against HEIC reference", () => {
    const calibration = JSON.parse(readFileSync(calibrationPath, "utf8")) as {
      source: string;
      reference: string;
      headroom: number;
      fit: { meanAbs: number; points: number };
    };
    assert.equal(calibration.source, "fixtures/window/window.jpeg");
    assert.equal(calibration.reference, "fixtures/window/window-gain.HEIC");
    assert.ok(calibration.headroom > 1);
    assert.ok(calibration.fit.points >= 1000);
    assert.ok(calibration.fit.meanAbs < 0.09, "stored fit must stay tight against HEIC");
  });
});

describe.runIf(isDarwin && fixturesPresent)("window.jpeg → window-gain.HEIC point mapping", () => {
  it("encodes window.jpeg and matches window-gain.HEIC after HDR expand", () => {
    mkdirSync(outDir, { recursive: true });
    execFileSync("pnpm", ["exec", "tsx", join(toolsDir, "encode-window.ts")], {
      cwd: repo,
      stdio: "pipe",
      env: process.env,
    });
    assert.ok(existsSync(candidateJpeg), "calibrated encode must write candidate JPEG");

    const compare = ensureCompareBinary();
    const result = spawnSync(
      compare,
      [candidateJpeg, referenceHeic, "--points", "2000", "--max-mean", "0.12"],
      { encoding: "utf8" },
    );
    if (result.stdout) process.stdout.write(result.stdout);
    if (result.stderr) process.stderr.write(result.stderr);
    assert.equal(result.status, 0, "HDR point mapping exceeded meanAbs budget vs window-gain.HEIC");

    const report = JSON.parse(result.stdout) as { meanAbs: number; p90: number; refLuma: number; candLuma: number };
    assert.ok(report.meanAbs <= 0.12);
    assert.ok(Math.abs(report.candLuma - report.refLuma) / report.refLuma < 0.15);
  });
});
