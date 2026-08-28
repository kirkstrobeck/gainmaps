import { writeFile } from 'node:fs/promises';

import { summarizeIcc } from '../icc/describe.js';
import { readProfileFromImage } from '../profile/resolve.js';

export async function extract(input: string, output: string): Promise<void> {
  const profile = await readProfileFromImage(input);
  const summary = summarizeIcc(profile);

  await writeFile(output, profile);

  console.log(`extracted     ${summary.description}`);
  console.log(`  from        ${input}`);
  console.log(`  to          ${output} (${profile.length} bytes)`);
}
