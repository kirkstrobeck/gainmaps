/**
 * Edge-aware softening for pixels that will be read through a wide-gamut profile.
 * The blend is done in the assigned profile's display-light space, then encoded
 * back to bytes through that profile's inverse curve.
 */

import type { RasterImage } from '../png/decode.js';
import { scanEdges, codesAt, lumaOf, type EdgeSample } from './edge-scan.js';
import { srgbToLinear, type TransferCurve } from './transfer.js';

export interface SoftenReport {
  softened: number;
  image: RasterImage;
}

function clamp01(value: number): number {
  return Math.min(Math.max(value, 0), 1);
}

function toByte(value: number): number {
  return Math.round(clamp01(value) * 255);
}

function authoredPosition(sample: EdgeSample): number {
  const low = lumaOf(sample.low, srgbToLinear);
  const high = lumaOf(sample.high, srgbToLinear);
  const blend = lumaOf(sample.blend, srgbToLinear);
  const span = high - low;
  /* v8 ignore next -- scanEdges only emits samples with a real luminance span. */
  if (Math.abs(span) < 1e-9) return 0.5;
  return clamp01((blend - low) / span);
}

function targetChannel(
  sample: EdgeSample,
  channel: number,
  position: number,
  assigned: TransferCurve,
  inverse: TransferCurve,
): number {
  const low = assigned(sample.low[channel]!);
  const high = assigned(sample.high[channel]!);
  const ideal = low + (high - low) * position;
  return inverse(ideal);
}

export function softenEdges(
  image: RasterImage,
  assigned: TransferCurve,
  inverse: TransferCurve,
  amount: number,
): SoftenReport {
  if (amount < 0 || amount > 1 || !Number.isFinite(amount)) {
    throw new Error('--amount must be a number between 0 and 1');
  }

  const pixels = Buffer.from(image.pixels);
  const out: RasterImage = { ...image, pixels };
  const samples = scanEdges(image);

  for (const sample of samples) {
    const at = (sample.y * image.width + sample.x) * image.channels;
    const current = codesAt(image, sample.x, sample.y);
    const position = authoredPosition(sample);

    for (let c = 0; c < 3; c += 1) {
      const target = targetChannel(sample, c, position, assigned, inverse);
      pixels[at + c] = toByte(current[c]! * (1 - amount) + target * amount);
    }
  }

  return { softened: samples.length, image: out };
}
