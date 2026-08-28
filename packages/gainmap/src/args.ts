export type FlagValue = string | true;

export type ParsedArgs = {
  readonly positionals: readonly string[];
  readonly flags: Readonly<Record<string, FlagValue | readonly string[]>>;
};

const ALIASES: Record<string, string> = {
  o: "output",
  out: "output",
  f: "force",
  i: "in-place",
  n: "dry-run",
  q: "quality",
  R: "recursive",
  r: "recursive",
  j: "jobs",
  v: "verbose",
  h: "help",
  V: "version",
};

const BOOLEAN_FLAGS = new Set([
  "help",
  "version",
  "force",
  "in-place",
  "no-clobber",
  "dry-run",
  "stdout",
  "stdin",
  "recursive",
  "quiet",
  "verbose",
  "continue",
  "update",
  "self-update",
  "auto-update",
  "no-update-check",
  "offline",
]);

const VALUED_FLAGS = new Set([
  "output",
  "out-type",
  "suffix",
  "quality",
  "boost",
  "headroom",
  "model",
  "matte",
  "max-size",
  "ext",
  "exclude",
  "jobs",
]);
const REPEATABLE_FLAGS = new Set(["exclude"]);

export function parseArgs(argv: readonly string[]): ParsedArgs {
  return parseAt(argv, 0, [], {});
}

function parseAt(
  argv: readonly string[],
  index: number,
  positionals: readonly string[],
  flags: Record<string, FlagValue | readonly string[]>,
): ParsedArgs {
  if (index >= argv.length) return { positionals, flags };
  const token = argv[index]!;
  if (token === "--") return { positionals: [...positionals, ...argv.slice(index + 1)], flags };
  if (!token.startsWith("-") || token === "-") {
    return parseAt(argv, index + 1, [...positionals, token], flags);
  }
  const raw = token.replace(/^-+/, "");
  const eq = raw.indexOf("=");
  const name = eq === -1 ? raw : raw.slice(0, eq);
  const key = ALIASES[name] ?? name
  if (!BOOLEAN_FLAGS.has(key)) {
    if (!VALUED_FLAGS.has(key)) {
      throw new Error("unsupported option: " + (token.startsWith("--") ? "--" : "-") + name)
    }
  };
  if (eq !== -1) {
    return parseAt(argv, index + 1, positionals, withFlag(flags, key, raw.slice(eq + 1)));
  }
  if (BOOLEAN_FLAGS.has(key)) {
    return parseAt(argv, index + 1, positionals, withFlag(flags, key, true));
  }
  const next = argv[index + 1];
  if (next == null) {
    throw new Error("--" + key + " requires a value");
  }
  return parseAt(argv, index + 2, positionals, withFlag(flags, key, next));
}

function withFlag(
  flags: Record<string, FlagValue | readonly string[]>,
  key: string,
  value: FlagValue,
): Record<string, FlagValue | readonly string[]> {
  if (!REPEATABLE_FLAGS.has(key)) return { ...flags, [key]: value };
  const prev = flags[key];
  if (Array.isArray(prev)) return { ...flags, [key]: [...prev, String(value)] };
  if (typeof prev === "string") return { ...flags, [key]: [prev, String(value)] };
  return { ...flags, [key]: String(value) };
}

export function flagString(flags: ParsedArgs["flags"], key: string): string | undefined {
  const value = flags[key];
  if (typeof value === "string") return value;
  if (value === true) throw new Error("--" + key + " requires a value");
  if (Array.isArray(value)) return value[value.length - 1];
  return undefined;
}

export function flagStrings(flags: ParsedArgs["flags"], key: string): readonly string[] {
  const value = flags[key];
  if (Array.isArray(value)) return value;
  if (typeof value === "string") return [value];
  return [];
}

export function flagBool(flags: ParsedArgs["flags"], key: string): boolean {
  return flags[key] === true;
}

export function flagNumber(flags: ParsedArgs["flags"], key: string): number | undefined {
  const raw = flagString(flags, key);
  if (raw == null) return undefined;
  const value = Number(raw);
  if (!Number.isFinite(value)) throw new Error("--" + key + " must be a number");
  return value;
}
