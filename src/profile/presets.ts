/**
 * Named profiles that ship with the tool. Both use the same Rec.2020 primaries
 * — identical to five decimal places — so they pop identically wide. They differ
 * only in transfer curve, and that difference decides whether anti-aliasing
 * survives.
 */

import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));

export interface Preset {
  name: string;
  file: string;
  suffix: string;
  summary: string;
}

export const PRESETS: Preset[] = [
  {
    name: 'pq',
    file: 'rec2020-pq.icc',
    suffix: '-pq',
    summary: 'Rec.2020 + PQ — the Ashby effect. Crushes midtones; destroys anti-aliasing.',
  },
  {
    name: 'gamut',
    file: 'rec2020.icc',
    suffix: '-rec2020',
    summary: 'Rec.2020 + BT.2020 transfer — same wide gamut, tone curve close to sRGB.',
  },
];

export const DEFAULT_PRESET = 'pq';

export function presetPath(preset: Preset): string {
  return resolve(here, '../../profiles', preset.file);
}

export function findPreset(name: string): Preset {
  const preset = PRESETS.find((candidate) => candidate.name === name);
  if (preset) return preset;

  const known = PRESETS.map((candidate) => candidate.name).join(', ');
  throw new Error(`Unknown preset "${name}". Known presets: ${known}`);
}
