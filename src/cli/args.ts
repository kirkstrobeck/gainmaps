/** Tiny flag parser: `--key value`, `--key=value`, and `-o` / `-h` aliases. */

export interface ParsedArgs {
  positionals: string[];
  flags: Record<string, string | true>;
}

const ALIASES: Record<string, string> = {
  o: 'out',
  h: 'help',
  p: 'profile',
  f: 'from',
  s: 'preset',
};

export function parseArgs(argv: string[]): ParsedArgs {
  const positionals: string[] = [];
  const flags: Record<string, string | true> = {};

  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (!token.startsWith('-')) {
      positionals.push(token);
      continue;
    }

    const raw = token.replace(/^-+/, '');
    const eq = raw.indexOf('=');
    const name = eq === -1 ? raw : raw.slice(0, eq);
    const key = ALIASES[name] ?? name;

    if (eq !== -1) {
      flags[key] = raw.slice(eq + 1);
      continue;
    }

    const next = argv[i + 1];
    if (next && !next.startsWith('-')) {
      flags[key] = next;
      i += 1;
      continue;
    }
    flags[key] = true;
  }

  return { positionals, flags };
}

export function flagString(flags: ParsedArgs['flags'], key: string): string | undefined {
  const value = flags[key];
  if (typeof value === 'string') return value;
  if (value === true) throw new Error(`--${key} requires a value`);
  return undefined;
}
