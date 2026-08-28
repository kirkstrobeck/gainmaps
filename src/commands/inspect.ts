import { readFile } from 'node:fs/promises';

import { codecFor } from '../image/registry.js';
import { summarizeIcc } from '../icc/describe.js';

export async function inspect(path: string): Promise<void> {
  const data = await readFile(path);
  const codec = codecFor(data);
  const facts = codec.facts(data);

  console.log(`file          ${path}`);
  console.log(`format        ${codec.name} ${facts.width}x${facts.height} (${data.length} bytes)`);
  console.log(`structure     ${facts.structure}`);
  for (const note of facts.notes) console.log(`  quality     ${note}`);

  const profile = codec.getProfile(data);
  if (!profile) {
    console.log('icc profile   (none embedded)');
    return;
  }

  const summary = summarizeIcc(profile);
  console.log(`icc profile   ${summary.description}`);
  console.log(`  size        ${profile.length} bytes`);
  console.log(`  version     ${summary.version}`);
  console.log(`  space       ${summary.colorSpace} -> ${summary.connectionSpace}`);
}
