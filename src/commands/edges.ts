/** Report whether an image's anti-aliasing survives a given transfer curve. */

import { readFile } from 'node:fs/promises';

import { measureEdges } from '../color/edge-report.js';
import { measureGamutDistance, suggestedAmount } from '../color/gamut-distance.js';
import { CURVES, type TransferCurve } from '../color/transfer.js';
import { decodePng } from '../png/decode.js';
import { isPng, parsePng } from '../png/chunks.js';
import { DEFAULT_PRESET } from '../profile/presets.js';

const percent = (value: number) => `${(value * 100).toFixed(1)}%`;

export async function edges(input: string, presetName?: string): Promise<void> {
  const data = await readFile(input);
  if (!isPng(data)) throw new Error('edges currently reads PNG only — export a PNG and retry');

  const name = presetName ?? DEFAULT_PRESET;
  const assigned = CURVES[name];
  if (!assigned) throw new Error(`No transfer curve known for preset "${name}"`);

  const image = decodePng(parsePng(data));
  const report = measureEdges(image, CURVES.srgb!, assigned);

  console.log(`edges         ${input}`);
  console.log(`  size        ${image.width}x${image.height}, ${image.channels} channels`);
  console.log(`  curve       sRGB as authored -> "${name}" as assigned`);

  if (report.antiAliased === 0) {
    console.log('  anti-alias  none found — hard-edged art, unaffected by the transfer curve');
    return;
  }

  console.log(`  anti-alias  ${report.antiAliased} blended pixels`);
  console.log(`  authored    sits ${percent(report.authored)} between its neighbours`);
  console.log(`  assigned    sits ${percent(report.assigned)} between its neighbours`);
  console.log(`  collapsed   ${percent(report.collapsed)} of them lose half their blend or more`);

  const collapse = report.authored / Math.max(report.assigned, 1e-9);
  if (collapse < 1.5) console.log('  verdict     curve is safe — anti-aliasing survives it');
  if (collapse >= 1.5) {
    console.log(
      `  verdict     anti-aliasing collapses ${collapse.toFixed(1)}x toward the dark side —` +
        ' edges will read as jagged. Try --preset gamut.',
    );
  }

  reportGamut(image, assigned);
}

/** The primaries stretch every edge, whichever curve the preset carries. */
function reportGamut(image: Parameters<typeof measureGamutDistance>[0], assigned: TransferCurve) {
  const gamut = measureGamutDistance(image, assigned);
  /* v8 ignore next -- reportGamut is only called after measureEdges finds edge samples. */
  if (gamut.edges === 0) return;

  console.log(`  distance    dE ${gamut.authored.toFixed(1)} authored (sRGB primaries)`);
  console.log(`              dE ${gamut.primaries.toFixed(1)} with Rec.2020 primaries`);
  console.log(`              dE ${gamut.assigned.toFixed(1)} with this preset's curve too`);

  console.log(
    `  spread      ${gamut.stretch.toFixed(2)}x further overall,` +
      ` ${gamut.chromaStretch.toFixed(2)}x in chroma alone`,
  );

  /* v8 ignore next 3 -- real Rec.2020 primaries stretch sampled chroma for this tool's edge cases. */
  if (gamut.chromaStretch < 1.05) {
    console.log('  soften      not needed — edges span the same perceptual distance');
    return;
  }
  console.log(
    '  soften      one blended pixel per edge now has more ground to cover;' +
      ` try \`soften --amount ${suggestedAmount(gamut.chromaStretch).toFixed(2)}\``,
  );
}
