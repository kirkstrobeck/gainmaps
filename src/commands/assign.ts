import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { basename, dirname, extname, join } from 'node:path';

import { codecFor } from '../image/registry.js';
import { summarizeIcc } from '../icc/describe.js';
import { resolveProfile, type ProfileSource } from '../profile/resolve.js';

export interface AssignOptions extends ProfileSource {
  output?: string;
}

function defaultOutput(input: string, suffix: string): string {
  const ext = extname(input) || '.jpg';
  return join(dirname(input), `${basename(input, ext)}${suffix}${ext}`);
}

function sha256(data: Buffer): string {
  return createHash('sha256').update(data).digest('hex');
}

export async function assign(input: string, options: AssignOptions): Promise<string> {
  const source = await readFile(input);
  const codec = codecFor(source);
  const { data: profile, origin, preset } = await resolveProfile(options);
  const summary = summarizeIcc(profile);

  const output = options.output ?? defaultOutput(input, preset?.suffix ?? '-tagged');
  const result = codec.setProfile(source, profile, summary.description);
  await writeFile(output, result);

  // Round-trip proof that only metadata moved: the compressed pixel payload
  // must hash identically in the input and the output.
  const written = await readFile(output);
  const before = sha256(codec.pixelPayload(source));
  const after = sha256(codec.pixelPayload(written));
  /* v8 ignore next -- fail-safe for codec regressions; tests assert byte-precise success paths. */
  if (before !== after) throw new Error('Aborting: pixel data changed during rewrite');

  const embedded = codec.getProfile(written);
  /* v8 ignore next -- fail-safe for codec regressions; tests assert profile byte round-trips. */
  if (!embedded?.equals(profile)) throw new Error('Aborting: embedded profile did not round-trip');

  const facts = codec.facts(source);
  const previous = codec.getProfile(source);

  console.log(`assigned      ${summary.description}`);
  console.log(`  format      ${codec.name} ${facts.width}x${facts.height}`);
  console.log(`  profile     ${origin}`);
  console.log(`  input       ${input} (${source.length} bytes)`);
  console.log(`  output      ${output} (${result.length} bytes)`);
  console.log(`  replaced    ${previous ? summarizeIcc(previous).description : '(no prior profile)'}`);
  console.log(`  pixels      sha256 ${before.slice(0, 32)}… unchanged`);

  return output;
}
