import { readFileSync } from "node:fs";

export function parseSemver(raw: string): readonly [number, number, number] | null {
  const core = raw.trim().replace(/^v/i, "").split("+")[0]!.split("-")[0]!;
  const parts = core.split(".");
  if (parts.length < 2) return null;
  const major = Number(parts[0]);
  const minor = Number(parts[1]);
  const patch = parts.length < 3 ? 0 : Number(parts[2]);
  if (!Number.isInteger(major) || !Number.isInteger(minor) || !Number.isInteger(patch)) return null;
  return [major, minor, patch];
}

export function compareSemver(a: string, b: string): number {
  const left = parseSemver(a);
  const right = parseSemver(b);
  if (left == null || right == null) return 0;
  if (left[0] !== right[0]) return left[0]! - right[0]!;
  if (left[1] !== right[1]) return left[1]! - right[1]!;
  return left[2]! - right[2]!;
}

export function isNewer(latest: string, current: string): boolean {
  return compareSemver(latest, current) > 0;
}

export function readPackageVersion(): string {
  const pkg = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8")) as { version: string };
  return pkg.version;
}
