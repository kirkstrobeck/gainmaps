import { readFile, writeFile } from 'node:fs/promises';
import { basename, dirname, extname, join } from 'node:path';

import { measureGamutDistance, suggestedAmount } from '../color/gamut-distance.js';
import { softenEdges } from '../color/soften.js';
import { CURVES, INVERSE_CURVES } from '../color/transfer.js';
import { parsePng, serializePng, isPng } from '../png/chunks.js';
import { decodePng } from '../png/decode.js';
import { replacePixels } from '../png/encode.js';
import { DEFAULT_PRESET } from '../profile/presets.js';

export interface SoftenOptions {
  output?: string;
  preset?: string;
  amount?: string;
}

function defaultOutput(input: string): string {
  const ext = extname(input) || '.png';
  return join(dirname(input), `${basename(input, ext)}-softened${ext}`);
}

function parseAmount(value: string | undefined, fallback: number): number {
  if (value === undefined) return fallback;
  const amount = Number(value);
  if (!Number.isFinite(amount) || amount < 0 || amount > 1) {
    throw new Error('--amount must be a number between 0 and 1');
  }
  return amount;
}

export async function soften(input: string, options: SoftenOptions): Promise<string> {
  const data = await readFile(input);
  if (!isPng(data)) throw new Error('soften currently reads PNG only');

  const name = options.preset ?? DEFAULT_PRESET;
  const assigned = CURVES[name];
  const inverse = INVERSE_CURVES[name];
  if (!assigned || !inverse) throw new Error(`No transfer curve known for preset "${name}"`);

  const chunks = parsePng(data);
  const image = decodePng(chunks);
  const gamut = measureGamutDistance(image, assigned);
  const amount = parseAmount(options.amount, suggestedAmount(gamut.chromaStretch));
  const report = softenEdges(image, assigned, inverse, amount);

  const output = options.output ?? defaultOutput(input);
  await writeFile(output, serializePng(replacePixels(chunks, report.image)));

  console.log(`softened      ${input}`);
  console.log(`  output      ${output}`);
  console.log(`  preset      ${name}`);
  console.log(`  amount      ${amount.toFixed(2)}`);
  console.log(`  pixels      ${report.softened} anti-aliased pixels adjusted`);

  return output;
}
