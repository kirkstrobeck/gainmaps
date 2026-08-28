import assert from "node:assert/strict";
import { mkdtemp, mkdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, it, vi } from "vitest";

import {
  CACHE_TTL_MS,
  cacheDirFor,
  checkUpdate,
  detectInstall,
  printUpdateNotice,
  runProcess,
  selfUpdate,
  spawnExitCode,
  shouldSkipUpdateCheck,
  updateNotice,
  type RunCommandFn,
} from "#src/update.js";
import { compareSemver, isNewer, parseSemver, readPackageVersion } from "#src/version.js";

describe("version", () => {
  it("parses and compares semver", () => {
    assert.deepEqual(parseSemver("1.2.3"), [1, 2, 3]);
    assert.deepEqual(parseSemver("v2.0.0"), [2, 0, 0]);
    assert.deepEqual(parseSemver("1.4"), [1, 4, 0]);
    assert.deepEqual(parseSemver("1.0.0-beta+build"), [1, 0, 0]);
    assert.equal(parseSemver("nope"), null);
    assert.equal(parseSemver("1"), null);
    assert.equal(parseSemver("1.x.0"), null);
    assert.equal(parseSemver("x.1.0"), null);
    assert.equal(parseSemver("1.2.x"), null);
    assert.equal(compareSemver("1.0.0", "1.0.0"), 0);
    assert.ok(compareSemver("1.1.0", "1.0.0") > 0);
    assert.ok(compareSemver("1.0.0", "2.0.0") < 0);
    assert.ok(compareSemver("1.0.1", "1.0.0") > 0);
    assert.equal(compareSemver("nope", "1.0.0"), 0);
    assert.equal(isNewer("1.0.1", "1.0.0"), true);
    assert.equal(isNewer("1.0.0", "1.0.0"), false);
    assert.match(readPackageVersion(), /^\d+\.\d+\.\d+$/);
  });
});

describe("update check", () => {
  it("resolves cache dirs and skip flags", () => {
    assert.equal(cacheDirFor({ GAINMAP_CACHE_DIR: "/tmp/g" }), "/tmp/g");
    assert.ok(cacheDirFor({ XDG_CACHE_HOME: "/xdg" }).endsWith("gainmap"));
    assert.ok(cacheDirFor({}).includes(".cache"));
    assert.equal(shouldSkipUpdateCheck({}, { quiet: true, offline: false, noUpdateCheck: false }), true);
    assert.equal(shouldSkipUpdateCheck({}, { quiet: false, offline: true, noUpdateCheck: false }), true);
    assert.equal(shouldSkipUpdateCheck({}, { quiet: false, offline: false, noUpdateCheck: true }), true);
    assert.equal(shouldSkipUpdateCheck({ GAINMAP_NO_UPDATE_CHECK: "1" }, { quiet: false, offline: false, noUpdateCheck: false }), true);
    assert.equal(shouldSkipUpdateCheck({ GAINMAP_OFFLINE: "1" }, { quiet: false, offline: false, noUpdateCheck: false }), true);
    assert.equal(shouldSkipUpdateCheck({ GAINMAP_REEXEC: "1" }, { quiet: false, offline: false, noUpdateCheck: false }), true);
    assert.equal(shouldSkipUpdateCheck({}, { quiet: false, offline: false, noUpdateCheck: false }), false);
    assert.ok(updateNotice("1.0.0", "1.2.0").includes("1.2.0"));
  });

  it("detects docker, brew, npm, and dev installs", () => {
    assert.equal(detectInstall("/x", { GAINMAP_IN_DOCKER: "1" }), "docker");
    assert.equal(detectInstall("/x", {}, { hasDockerEnvFile: true }), "docker");
    assert.equal(detectInstall("/opt/homebrew/Cellar/gainmap/1.0.0/bin/gainmap", {}, { hasDockerEnvFile: false }), "brew");
    assert.equal(detectInstall("/home/linuxbrew/.linuxbrew/bin/gainmap", {}, { hasDockerEnvFile: false }), "brew");
    assert.equal(detectInstall("/opt/homebrew/bin/gainmap", { HOMEBREW_PREFIX: "/opt/homebrew" }, { hasDockerEnvFile: false }), "brew");
    assert.equal(detectInstall("/usr/bin/gainmap", { HOMEBREW_PREFIX: "/opt/homebrew" }, { hasDockerEnvFile: false }), "dev");
    assert.equal(detectInstall("/usr/lib/node_modules/gainmap/dist/cli.js", {}, { hasDockerEnvFile: false }), "npm");
    assert.equal(detectInstall("/usr/lib/node_modules/.bin/gainmap", {}, { hasDockerEnvFile: false }), "npm");
    assert.equal(detectInstall("/home/me/.gainmap/runtime/dist/cli.js", {}, { hasDockerEnvFile: false }), "curl");
    assert.equal(detectInstall("/opt/gainmap-runtime/dist/cli.js", { GAINMAP_LIBEXEC: "/opt/gainmap-runtime" }, { hasDockerEnvFile: false }), "curl");
    assert.equal(detectInstall("/repo/packages/gainmap/dist/cli.js", {}, { hasDockerEnvFile: false }), "dev");
    detectInstall("/x", {});
  });

  it("uses cache, fetch, 404, errors, and stale fallback", async () => {
    const dir = await mkdtemp(join(tmpdir(), "gainmap-upd-"));
    const logs: string[] = [];
    const write = (m: string) => { logs.push(m); };
    printUpdateNotice("1.0.0", "2.0.0", write);
    assert.ok(logs[0]!.includes("2.0.0"));
    printUpdateNotice("1.0.0", "2.0.0");
    await writeFile(join(dir, "latest.json"), JSON.stringify({ version: "9.0.0", checkedAt: 1 }));
    const cached = await checkUpdate({ cacheDir: dir, currentVersion: "1.0.0", now: () => 2, fetch: async () => { throw new Error("no"); } });
    assert.equal(cached, "9.0.0");
    const current = await checkUpdate({ cacheDir: dir, currentVersion: "9.0.0", now: () => 2, fetch: async () => { throw new Error("no"); } });
    assert.equal(current, null);
    const freshDir = await mkdtemp(join(tmpdir(), "gainmap-upd2-"));
    const fetched = await checkUpdate({
      cacheDir: freshDir,
      currentVersion: "1.0.0",
      now: () => 10,
      fetch: async () => ({ ok: true, json: async () => ({ version: "1.5.0" }) }) as Response,
    });
    assert.equal(fetched, "1.5.0");
    const same = await checkUpdate({
      cacheDir: freshDir,
      currentVersion: "1.5.0",
      now: () => 11,
      fetch: async () => ({ ok: true, json: async () => ({ version: "1.5.0" }) }) as Response,
    });
    assert.equal(same, null);
    const equalFetch = await checkUpdate({
      cacheDir: await mkdtemp(join(tmpdir(), "gainmap-eq-")),
      currentVersion: "1.5.0",
      now: () => 1,
      fetch: async () => ({ ok: true, json: async () => ({ version: "1.5.0" }) }) as Response,
    });
    assert.equal(equalFetch, null);
    const missing = await checkUpdate({
      cacheDir: await mkdtemp(join(tmpdir(), "gainmap-404-")),
      currentVersion: "1.0.0",
      now: () => 1,
      fetch: async () => ({ ok: false, status: 404, json: async () => ({}) }) as Response,
    });
    assert.equal(missing, null);
    const badJson = await checkUpdate({
      cacheDir: await mkdtemp(join(tmpdir(), "gainmap-bad-")),
      currentVersion: "1.0.0",
      now: () => 1,
      fetch: async () => ({ ok: true, json: async () => ({}) }) as Response,
    });
    assert.equal(badJson, null);
    const boom = await checkUpdate({
      cacheDir: await mkdtemp(join(tmpdir(), "gainmap-boom-")),
      currentVersion: "1.0.0",
      now: () => 1,
      fetch: async () => { throw new Error("offline"); },
    });
    assert.equal(boom, null);
    const staleDir = await mkdtemp(join(tmpdir(), "gainmap-stale-"));
    await writeFile(join(staleDir, "latest.json"), JSON.stringify({ version: "8.0.0", checkedAt: 1 }));
    const staleHit = await checkUpdate({
      cacheDir: staleDir,
      currentVersion: "1.0.0",
      now: () => 1 + CACHE_TTL_MS + 5,
      fetch: async () => { throw new Error("offline"); },
    });
    assert.equal(staleHit, "8.0.0");
    const stale404 = await checkUpdate({
      cacheDir: staleDir,
      currentVersion: "1.0.0",
      now: () => 1 + CACHE_TTL_MS + 6,
      fetch: async () => ({ ok: false, status: 500, json: async () => ({}) }) as Response,
    });
    assert.equal(stale404, "8.0.0");
    await writeFile(join(staleDir, "latest.json"), "{not json");
    const invalid = await checkUpdate({
      cacheDir: staleDir,
      currentVersion: "1.0.0",
      now: () => 1,
      fetch: async () => ({ ok: false, status: 404, json: async () => ({}) }) as Response,
    });
    assert.equal(invalid, null);
    const fileAsDir = join(dir, "latest.json");
    await checkUpdate({
      cacheDir: fileAsDir,
      currentVersion: "1.0.0",
      now: () => 99,
      fetch: async () => ({ ok: true, json: async () => ({ version: "3.0.0" }) }) as Response,
    });
  });

  it("self-updates by channel and covers spawn", async () => {
    const logs: string[] = [];
    const write = (m: string) => { logs.push(m); };
    assert.equal(await selfUpdate({ env: { GAINMAP_IN_DOCKER: "1" }, execPath: "/x", write }), 0);
    assert.ok(logs.some((line) => line.includes("Docker")));
    logs.length = 0;
    assert.equal(await selfUpdate({ execPath: "/repo/dist/cli.js", env: {}, write, hasDockerEnvFile: false }), 0);
    assert.ok(logs.some((line) => line.includes("git pull")));
    const brew = await selfUpdate({
      execPath: "/opt/homebrew/Cellar/gainmap/bin/gainmap",
      env: {},
      hasDockerEnvFile: false,
      runCommand: async (cmd, args) => {
        assert.equal(cmd, "brew");
        assert.deepEqual(args, ["upgrade", "gainmap"]);
        return 0;
      },
    });
    assert.equal(brew, 0);
    const npm = await selfUpdate({
      execPath: "/usr/lib/node_modules/gainmap/dist/cli.js",
      env: {},
      hasDockerEnvFile: false,
      runCommand: async (cmd) => {
        assert.equal(cmd, "npm");
        return 0;
      },
    });
    assert.equal(npm, 0);
    const curl = await selfUpdate({
      execPath: "/home/me/.gainmap/runtime/dist/cli.js",
      env: {},
      hasDockerEnvFile: false,
      runCommand: async (cmd, args) => {
        assert.equal(cmd, "sh");
        assert.ok(args.includes("-c"));
        return 0;
      },
    });
    assert.equal(curl, 0);
    const failed = await selfUpdate({
      execPath: "/opt/homebrew/Cellar/gainmap/bin/gainmap",
      env: {},
      hasDockerEnvFile: false,
      write,
      runCommand: async () => { throw new Error("brew missing"); },
    });
    assert.equal(failed, 1);
    const raw = await selfUpdate({
      execPath: "/opt/homebrew/Cellar/gainmap/bin/gainmap",
      env: {},
      hasDockerEnvFile: false,
      write,
      runCommand: async () => { throw "nope"; },
    });
    assert.equal(raw, 1);
    assert.equal(await runProcess(process.execPath, ["-e", "process.exit(0)"]), 0);
    assert.equal(await runProcess(process.execPath, ["-e", "process.exit(3)"]), 3);
    await assert.rejects(runProcess("gainmap-command-does-not-exist", []));
    await selfUpdate({ env: { GAINMAP_IN_DOCKER: "1" }, execPath: "/x" });
    assert.equal(spawnExitCode(null), 1);
    assert.equal(spawnExitCode(0), 0);
    const prevArgv = process.argv;
    process.argv = ["node"];
    assert.equal(await selfUpdate({ env: { GAINMAP_IN_DOCKER: "1" }, write }), 0);
    process.argv = prevArgv;
    assert.equal(await selfUpdate({
      execPath: "/opt/homebrew/Cellar/gainmap/bin/gainmap",
      env: {},
      hasDockerEnvFile: false,
      write,
    }), 1);
    const typedDir = await mkdtemp(join(tmpdir(), "gainmap-typed-"));
    await writeFile(join(typedDir, "latest.json"), JSON.stringify({ version: 9, checkedAt: 1 }));
    const typed = await checkUpdate({
      cacheDir: typedDir,
      currentVersion: "1.0.0",
      now: () => 1,
      fetch: async () => ({ ok: false, status: 404, json: async () => ({}) }) as Response,
    });
    assert.equal(typed, null);
    const typedDir2 = await mkdtemp(join(tmpdir(), "gainmap-typed2-"));
    await writeFile(join(typedDir2, "latest.json"), JSON.stringify({ version: "9.0.0", checkedAt: "nope" }));
    const typed2 = await checkUpdate({
      cacheDir: typedDir2,
      currentVersion: "1.0.0",
      now: () => 1,
      fetch: async () => ({ ok: false, status: 404, json: async () => ({}) }) as Response,
    });
    assert.equal(typed2, null);
  });
});
