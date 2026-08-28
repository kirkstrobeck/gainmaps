/** Decide which ICC profile to assign: explicit file, donor image, or a named preset. */

import { readFile } from 'node:fs/promises';

import { codecFor } from '../image/registry.js';
import { DEFAULT_PRESET, findPreset, presetPath, type Preset } from './presets.js';

export const BUNDLED_PROFILE = presetPath(findPreset(DEFAULT_PRESET));

export interface ProfileSource {
  /** Path to a raw .icc file. */
  profilePath?: string;
  /** Path to an image whose embedded profile should be copied. */
  fromImage?: string;
  /** Name of a bundled preset — see `PRESETS`. */
  preset?: string;
}

export interface ResolvedProfile {
  data: Buffer;
  origin: string;
  /** Set when the profile came from a bundled preset, for output naming. */
  preset?: Preset;
}

export async function readProfileFromImage(path: string): Promise<Buffer> {
  const data = await readFile(path);
  const profile = codecFor(data).getProfile(data);
  if (!profile) throw new Error(`No embedded ICC profile found in ${path}`);
  return profile;
}

function countSources(source: ProfileSource): number {
  return [source.profilePath, source.fromImage, source.preset].filter(Boolean).length;
}

export async function resolveProfile(source: ProfileSource): Promise<ResolvedProfile> {
  if (countSources(source) > 1) {
    throw new Error('Use only one of --profile, --from, or --preset');
  }
  if (source.profilePath) {
    return { data: await readFile(source.profilePath), origin: source.profilePath };
  }
  if (source.fromImage) {
    return {
      data: await readProfileFromImage(source.fromImage),
      origin: `${source.fromImage} (embedded)`,
    };
  }

  const preset = findPreset(source.preset ?? DEFAULT_PRESET);
  const path = presetPath(preset);

  try {
    return { data: await readFile(path), origin: `${path} (preset "${preset.name}")`, preset };
  } catch {
    throw new Error(
      `Bundled profile missing at ${path}. Pass --profile <file.icc> or --from <image>.`,
    );
  }
}
