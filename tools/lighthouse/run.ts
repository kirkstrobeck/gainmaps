#!/usr/bin/env tsx
/**
 * Lighthouse harness: build → start → score → stop.
 *
 * Usage:
 *   pnpm lh              # both presets
 *   pnpm lh:desktop      # desktop only
 *   pnpm lh:mobile       # mobile only
 *
 * Chrome required. Resolved from the Playwright installation at runtime.
 */

import { execSync, spawn, type ChildProcess } from "node:child_process";
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, symlinkSync, unlinkSync, writeFileSync } from "node:fs";
import { createServer } from "node:net";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, "../..");
const webDir = resolve(root, "apps/web");
const pidFile = resolve(webDir, ".next-prod.pid");

const preset = process.argv[2] ?? "both";
if (preset !== "desktop" && preset !== "mobile" && preset !== "both") {
  console.error("Usage: run.ts [desktop|mobile|both]");
  process.exit(1);
}

async function findFreePort(start: number): Promise<number> {
  return new Promise((resolve, reject) => {
    const srv = createServer();
    srv.listen(start, "127.0.0.1", () => {
      const port = (srv.address() as any).port;
      srv.close(() => resolve(port));
    });
    srv.on("error", () => findFreePort(start + 1).then(resolve).catch(reject));
  });
}

function run(cmd: string, cwd = root, env?: NodeJS.ProcessEnv): void {
  execSync(cmd, { stdio: "inherit", cwd, env: env ?? process.env });
}

function lhci(configFile: string): void {
  const cfg = resolve(__dirname, configFile);
  run(`pnpm exec lhci autorun --config="${cfg}"`, root);
}

async function waitForServer(url: string, timeoutMs = 60_000): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const res = await fetch(url);
      if (res.ok) return;
    } catch {
      // not ready yet
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error(`Server at ${url} did not become ready within ${timeoutMs}ms`);
}

async function main(): Promise<void> {
  // Resolve Chromium path from Playwright installation
  let chromePath = "";
  try {
    chromePath = execSync(
      `node -e "const {chromium} = require('/workspace/node_modules/.pnpm/playwright@1.62.1/node_modules/playwright'); console.log(chromium.executablePath())"`,
      { encoding: "utf8" }
    ).trim();
  } catch {
    // fallback: scan /ms-playwright for chromium-* dirs
  }
  if (!chromePath || !existsSync(chromePath)) {
    const msDir = "/ms-playwright";
    const dirs = readdirSync(msDir).filter((d) => d.startsWith("chromium-"));
    for (const d of dirs) {
      const p = `${msDir}/${d}/chrome-linux/chrome`;
      if (existsSync(p)) {
        chromePath = p;
        break;
      }
    }
  }
  if (!chromePath || !existsSync(chromePath)) {
    console.error("Chrome not found. Set CHROME_PATH manually.");
    process.exit(1);
  }
  process.env.CHROME_PATH = chromePath;
  console.log(`Chrome: ${chromePath}`);
  execSync(`"${chromePath}" --version`, { stdio: "inherit" });

  const PORT = await findFreePort(3010);
  const BASE_URL = `http://127.0.0.1:${PORT}`;
  process.env.LHCI_PORT = String(PORT);
  console.log(`Using port: ${PORT}`);

  // Kill any server orphaned by a prior run that was hard-killed before cleanup ran.
  if (existsSync(pidFile)) {
    const raw = readFileSync(pidFile, "utf8").trim();
    const oldPid = parseInt(raw, 10);
    if (!isNaN(oldPid)) {
      try { process.kill(-oldPid, "SIGKILL"); } catch { /* already gone */ }
      const until = Date.now() + 5000;
      let alive = true;
      while (alive && Date.now() < until) {
        await new Promise((r) => setTimeout(r, 100));
        try { process.kill(-oldPid, 0); }
        catch { alive = false; }
      }
    }
    try { unlinkSync(pidFile); } catch { /* ignore */ }
  }

  // Build onto container-local tmpfs so parallel export workers never hammer the
  // virtiofs bind mount (which produces intermittent EACCES under high concurrency).
  // apps/web/.next-prod becomes a symlink; NEXT_DIST_DIR stays ".next-prod" so Next
  // resolves it relative to the project dir and follows the symlink transparently.
  const distDir = resolve(webDir, ".next-prod");
  const tmpDir = "/tmp/next-prod";
  rmSync(tmpDir, { recursive: true, force: true });
  mkdirSync(tmpDir, { recursive: true, mode: 0o777 });
  rmSync(distDir, { recursive: true, force: true });
  symlinkSync(tmpDir, distDir);

  console.log("\n=== Step 1: build ===");
  run("pnpm -C apps/web build:isolated", root);

  console.log("\n=== Step 2: start production server ===");
  const server: ChildProcess = spawn(
    "node_modules/.bin/next",
    ["start", "-p", String(PORT), "--hostname", "127.0.0.1"],
    { cwd: webDir, shell: true, stdio: "inherit", detached: true, env: { ...process.env, NODE_ENV: "production", NEXT_DIST_DIR: ".next-prod" } },
  );
  server.unref();
  const pgid = server.pid!;
  writeFileSync(pidFile, String(pgid), "utf8");

  const cleanup = () => {
    try { process.kill(-pgid, "SIGTERM"); } catch { /* already gone */ }
    try { unlinkSync(pidFile); } catch { /* already removed */ }
  };
  process.on("SIGINT", cleanup);
  process.on("SIGTERM", cleanup);
  process.on("exit", cleanup);

  try {
    await waitForServer(BASE_URL);
    console.log(`Server ready at ${BASE_URL}`);

    console.log("\n=== Step 3: Lighthouse ===");
    if (preset === "desktop" || preset === "both") {
      console.log("\n--- desktop ---");
      lhci("lhci-desktop.cjs");
    }
    if (preset === "mobile" || preset === "both") {
      console.log("\n--- mobile ---");
      lhci("lhci-mobile.cjs");
    }
  } finally {
    cleanup();
  }

  console.log("\n=== Done ===");
  console.log("HTML reports in .lhci-reports/");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
