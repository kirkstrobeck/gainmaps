import { lstat, readdir } from "node:fs/promises";
import { extname, relative, resolve } from "node:path";

import { DEFAULT_EXTENSIONS } from "#src/decode.js";

export type WalkOptions = {
  readonly recursive: boolean;
  readonly extensions: readonly string[];
  readonly exclude: readonly string[];
};

export function parseExtensionList(raw: string | undefined): readonly string[] {
  if (raw == null || raw.trim() === "") return DEFAULT_EXTENSIONS;
  return raw.split(",").map((part) => part.trim().replace(/^\./, "").toLowerCase()).filter(Boolean);
}

export function matchesExclude(path: string, patterns: readonly string[]): boolean {
  if (patterns.length === 0) return false;
  return patterns.some((pattern) => globMatch(path, pattern) || globMatch(path.split(String.fromCharCode(92)).join("/"), pattern));
}

export async function collectInputs(
  inputs: readonly string[],
  options: WalkOptions,
  cwd = process.cwd(),
): Promise<readonly string[]> {
  const lists = await Promise.all(inputs.map((input) => collectOne(resolve(cwd, input), options, cwd)));
  return unique(lists.flat());
}

async function collectOne(path: string, options: WalkOptions, cwd: string): Promise<readonly string[]> {
  const rel = relative(cwd, path) || path;
  if (matchesExclude(rel, options.exclude) || matchesExclude(path, options.exclude)) return [];
  const stat = await lstat(path);
  if (stat.isSymbolicLink()) return [];
  if (stat.isFile()) {
    if (!hasAllowedExtension(path, options.extensions)) {
      throw Object.assign(new Error("Unsupported media type: " + path), { code: "UNSUPPORTED" });
    }
    return [path];
  }
  if (!stat.isDirectory()) return [];
  return walkDir(path, options, cwd);
}

async function walkDir(dir: string, options: WalkOptions, cwd: string): Promise<readonly string[]> {
  const entries = await readdir(dir, { withFileTypes: true });
  const nested = await Promise.all(entries.map((entry) => {
    const full = resolve(dir, entry.name);
    const rel = relative(cwd, full);
    if (matchesExclude(rel, options.exclude)) return Promise.resolve([] as readonly string[]);
    if (entry.isSymbolicLink()) return Promise.resolve([] as readonly string[]);
    if (entry.isDirectory()) {
      if (!options.recursive) return Promise.resolve([] as readonly string[]);
      return walkDir(full, options, cwd);
    }
    if (!entry.isFile()) return Promise.resolve([] as readonly string[]);
    if (!hasAllowedExtension(entry.name, options.extensions)) return Promise.resolve([] as readonly string[]);
    return Promise.resolve([full] as readonly string[]);
  }));
  return nested.flat();
}

export function hasAllowedExtension(name: string, extensions: readonly string[]): boolean {
  const ext = extname(name).replace(/^\./, "").toLowerCase();
  return extensions.includes(ext);
}

function unique(paths: readonly string[]): readonly string[] {
  return [...new Set(paths)];
}

function globMatch(path: string, pattern: string): boolean {
  const slash = String.fromCharCode(92);
  const normalized = path.split(slash).join("/");
  const pieces = pattern.split(slash).join("/").split("**");
  const source = "^" + pieces.map((part, index) => {
    const escaped = [...part].map((ch) => (".+^?${}()|[]".includes(ch) ? String.fromCharCode(92) + ch : ch)).join("").split("*").join("[^/]*");
    if (index < pieces.length - 1) return escaped + ".*";
    return escaped;
  }).join("") + "$";
  return new RegExp(source).test(normalized);
}
