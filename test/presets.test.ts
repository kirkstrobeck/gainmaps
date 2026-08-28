import { describe, it } from 'vitest';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

import { DEFAULT_PRESET, PRESETS, findPreset, presetPath } from '../src/profile/presets.js';
import { resolveProfile } from '../src/profile/resolve.js';
import { summarizeIcc } from '../src/icc/describe.js';
import { readIccXyzTag } from '../src/icc/primaries.js';

describe('presets', () => {
  it('ships every declared profile', async () => {
    for (const preset of PRESETS) {
      const data = await readFile(presetPath(preset));
      assert.ok(data.length > 0, `${preset.file} is empty`);
    }
  });

  it('names a real default', () => {
    assert.equal(findPreset(DEFAULT_PRESET).name, DEFAULT_PRESET);
  });

  it('lists the known presets when asked for an unknown one', () => {
    assert.throws(() => findPreset('nope'), /pq/);
    assert.throws(() => findPreset('nope'), /gamut/);
  });

  it('gives each preset a distinct output suffix', () => {
    const suffixes = new Set(PRESETS.map((preset) => preset.suffix));
    assert.equal(suffixes.size, PRESETS.length);
  });
});

describe('profile resolution', () => {
  it('defaults to the PQ preset', async () => {
    const resolved = await resolveProfile({});
    assert.equal(resolved.preset?.name, 'pq');
    assert.equal(summarizeIcc(resolved.data).description, 'Rec2020 Gamut with PQ Transfer');
  });

  it('resolves the gamut preset to the BT.2020 profile', async () => {
    const resolved = await resolveProfile({ preset: 'gamut' });
    assert.equal(resolved.preset?.name, 'gamut');
    assert.match(summarizeIcc(resolved.data).description, /BT\.?2020/i);
  });

  it('refuses more than one profile source', async () => {
    await assert.rejects(
      resolveProfile({ preset: 'pq', profilePath: 'profiles/rec2020.icc' }),
      /only one of/,
    );
  });

  it('carries no preset when an explicit file is given', async () => {
    const resolved = await resolveProfile({ profilePath: 'profiles/rec2020.icc' });
    assert.equal(resolved.preset, undefined);
  });
});

describe('preset gamut equivalence', () => {
  // The "pop" comes from the primaries, not the transfer curve. Both presets
  // must describe the same Rec.2020 gamut, or the gamut preset would be a
  // different look rather than the same look with usable edges.
  it('gives both presets the same Rec.2020 primaries', async () => {
    const pq = await readFile(presetPath(findPreset('pq')));
    const gamut = await readFile(presetPath(findPreset('gamut')));

    for (const tag of ['rXYZ', 'gXYZ', 'bXYZ', 'wtpt'] as const) {
      const a = readIccXyzTag(pq, tag);
      const b = readIccXyzTag(gamut, tag);
      assert.ok(a && b, `both profiles need a ${tag} tag`);
      for (let i = 0; i < 3; i += 1) {
        assert.ok(
          Math.abs(a![i]! - b![i]!) < 1e-3,
          `${tag}[${i}] differs: ${a![i]} vs ${b![i]}`,
        );
      }
    }
  });
});
