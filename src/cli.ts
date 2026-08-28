#!/usr/bin/env -S npx tsx
/** Entry point: assign / inspect / extract / edges / soften. */

import { flagString, parseArgs } from './cli/args.js';
import { assign } from './commands/assign.js';
import { edges } from './commands/edges.js';
import { extract } from './commands/extract.js';
import { inspect } from './commands/inspect.js';
import { soften } from './commands/soften.js';
import { PRESETS } from './profile/presets.js';

const PRESET_HELP = PRESETS.map((preset) => `    ${preset.name.padEnd(7)} ${preset.summary}`).join(
  '\n',
);

const USAGE = `hdr-tag — retag a JPEG or PNG with a wide-gamut ICC profile (pixels untouched)

  assign  <input> [-o out] [--preset name] [--profile f.icc] [--from donor]
  inspect <file>
  extract <input> -o profile.icc
  edges   <file.png> [--preset name]
  soften  <file.png> [-o out] [--preset name] [--amount 0..1]

Flags
  -o, --out       output path (assign defaults to <name><preset-suffix><ext>)
  -s, --preset    bundled profile to assign (default: pq)
  -p, --profile   ICC file to assign instead of a preset
  -f, --from      copy the profile embedded in another image
  --amount         softening strength, default inferred from edge chroma stretch

Presets
${PRESET_HELP}

Anti-aliased art (logos, type, stickers) loses its edge blending under PQ.
Run "edges" first — it says which preset the artwork can take.
`;

async function main(): Promise<void> {
  const { positionals, flags } = parseArgs(process.argv.slice(2));
  const [command, input] = positionals;

  if (!command || flags.help) {
    console.log(USAGE);
    return;
  }
  if (!input) throw new Error(`Missing input file for "${command}"`);

  if (command === 'assign') {
    await assign(input, {
      output: flagString(flags, 'out'),
      preset: flagString(flags, 'preset'),
      profilePath: flagString(flags, 'profile'),
      fromImage: flagString(flags, 'from'),
    });
    return;
  }
  if (command === 'inspect') {
    await inspect(input);
    return;
  }
  if (command === 'edges') {
    await edges(input, flagString(flags, 'preset'));
    return;
  }
  if (command === 'soften') {
    await soften(input, {
      output: flagString(flags, 'out'),
      preset: flagString(flags, 'preset'),
      amount: flagString(flags, 'amount'),
    });
    return;
  }
  if (command === 'extract') {
    const out = flagString(flags, 'out');
    if (!out) throw new Error('extract requires -o <profile.icc>');
    await extract(input, out);
    return;
  }

  throw new Error(`Unknown command "${command}"\n\n${USAGE}`);
}

main().catch((error: unknown) => {
  console.error(`error: ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
});
