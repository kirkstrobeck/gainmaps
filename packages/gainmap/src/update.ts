import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";
import { spawn } from "node:child_process";

import { isNewer, readPackageVersion } from "#src/version.js";

export const NPM_LATEST_URL = "https://registry.npmjs.org/gainmap/latest";
export const REPO_URL = "https://github.com/kirkstrobeck/gainmaps.com";
export const CACHE_TTL_MS = 24 * 60 * 60 * 1000;

export type InstallMethod = "docker" | "brew" | "npm" | "curl" | "dev";

export type UpdateCheckDeps = {
  readonly fetch?: typeof globalThis.fetch;
  readonly now?: () => number;
  readonly cacheDir?: string;
  readonly currentVersion?: string;
};

export type DetectInstallDeps = {
  readonly hasDockerEnvFile?: boolean;
};

export type RunCommandFn = (cmd: string, args: readonly string[]) => Promise<number>;

type CacheEntry = {
  readonly version: string;
  readonly checkedAt: number;
};

export function cacheDirFor(env: NodeJS.ProcessEnv = process.env): string {
  if (env.GAINMAP_CACHE_DIR) return env.GAINMAP_CACHE_DIR;
  if (env.XDG_CACHE_HOME) return join(env.XDG_CACHE_HOME, "gainmap");
  return join(homedir(), ".cache", "gainmap");
}

export function detectInstall(
  execPath: string,
  env: NodeJS.ProcessEnv,
  deps: DetectInstallDeps = {},
): InstallMethod {
  if (env.GAINMAP_IN_DOCKER === "1") return "docker";
  const dockerEnvFile = deps.hasDockerEnvFile ?? existsSync("/.dockerenv");
  if (dockerEnvFile) return "docker";
  if (execPath.includes("/Cellar/gainmap") || execPath.includes("/linuxbrew/")) return "brew";
  const prefix = env.HOMEBREW_PREFIX;
  if (prefix && execPath.startsWith(prefix) && execPath.includes("gainmap")) return "brew";
  if (execPath.includes(".gainmap")) return "curl";
  const libexec = env.GAINMAP_LIBEXEC;
  if (libexec && execPath.includes(libexec)) return "curl";
  if (execPath.includes("node_modules/gainmap") || execPath.includes("node_modules/.bin/gainmap")) return "npm";
  return "dev";
}

export function updateNotice(current: string, latest: string): string {
  const nl = String.fromCharCode(10);
  return "gainmap " + current + " " + String.fromCharCode(8594) + " " + latest + " is available." + nl + "Run: gainmap --update" + nl + REPO_URL;
}

export function printUpdateNotice(current: string, latest: string, write = writeStderr): void {
  write(updateNotice(current, latest));
}

function writeStderr(message: string): void {
  process.stderr.write(message + String.fromCharCode(10));
}

export function shouldSkipUpdateCheck(
  env: NodeJS.ProcessEnv,
  flags: { readonly quiet: boolean; readonly offline: boolean; readonly noUpdateCheck: boolean },
): boolean {
  if (flags.quiet) return true;
  if (flags.offline) return true;
  if (flags.noUpdateCheck) return true;
  if (env.GAINMAP_NO_UPDATE_CHECK === "1") return true;
  if (env.GAINMAP_OFFLINE === "1") return true;
  if (env.GAINMAP_REEXEC === "1") return true;
  return false;
}

async function readCache(dir: string): Promise<CacheEntry | null> {
  try {
    const parsed = JSON.parse(await readFile(join(dir, "latest.json"), "utf8")) as CacheEntry;
    if (typeof parsed.version !== "string" || typeof parsed.checkedAt !== "number") return null;
    return parsed;
  } catch {
    return null;
  }
}

async function writeCache(dir: string, entry: CacheEntry): Promise<void> {
  try {
    await mkdir(dir, { recursive: true });
    await writeFile(join(dir, "latest.json"), JSON.stringify(entry));
  } catch {
    return;
  }
}

export async function checkUpdate(deps: UpdateCheckDeps = {}): Promise<string | null> {
  const fetchFn = deps.fetch ?? globalThis.fetch;
  const nowFn = deps.now ?? Date.now;
  const cacheDir = deps.cacheDir ?? cacheDirFor();
  const currentVersion = deps.currentVersion ?? readPackageVersion();
  const now = nowFn();
  const cached = await readCache(cacheDir);
  if (cached != null && now - cached.checkedAt < CACHE_TTL_MS) {
    if (isNewer(cached.version, currentVersion)) return cached.version;
    return null;
  }
  try {
    const response = await fetchFn(NPM_LATEST_URL, { signal: AbortSignal.timeout(1500) });
    if (!response.ok) {
      if (cached != null && isNewer(cached.version, currentVersion)) return cached.version;
      return null;
    }
    const data = (await response.json()) as { version?: string };
    if (typeof data.version !== "string") return null;
    await writeCache(cacheDir, { version: data.version, checkedAt: now });
    if (isNewer(data.version, currentVersion)) return data.version;
    return null;
  } catch {
    if (cached != null && isNewer(cached.version, currentVersion)) return cached.version;
    return null;
  }
}

export function spawnExitCode(code: number | null): number {
  if (code == null) return 1;
  return code;
}

export function runProcess(cmd: string, args: readonly string[]): Promise<number> {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, [...args], { stdio: "inherit" });
    child.on("error", reject);
    child.on("close", (code) => resolve(spawnExitCode(code)));
  });
}

export async function selfUpdate(deps: {
  readonly execPath?: string;
  readonly env?: NodeJS.ProcessEnv;
  readonly runCommand?: RunCommandFn;
  readonly hasDockerEnvFile?: boolean;
  readonly write?: (message: string) => void;
} = {}): Promise<number> {
  const write = deps.write ?? writeStderr;
  const execPath = deps.execPath ?? (process.argv[1] ?? "");
  const env = deps.env ?? process.env;
  const method = detectInstall(execPath, env, { hasDockerEnvFile: deps.hasDockerEnvFile });
  if (method === "docker") {
    write("This Docker image cannot self-update. Rebuild:");
    write("docker build -t gainmap packages/gainmap");
    write("docker run --rm -v " + String.fromCharCode(34, 36) + "PWD:/work" + String.fromCharCode(34) + " gainmap --help");
    return 0;
  }
  if (method === "dev") {
    write("Updating from source:");
    write("git pull && pnpm install && pnpm --filter gainmap build");
    write(REPO_URL);
    return 0;
  }
  const runCommand = deps.runCommand ?? runProcess;
  try {
    if (method === "brew") return await runCommand("brew", ["upgrade", "gainmap"]);
    if (method === "curl") return await runCommand("sh", ["-c", "curl -fsSL https://gainmaps.com/install.sh | sh"]);
    return await runCommand("npm", ["install", "-g", "gainmap@latest"]);
  } catch (error) {
    if (error instanceof Error) {
      write("error: " + error.message);
      return 1;
    }
    write("error: " + String(error));
    return 1;
  }
}
