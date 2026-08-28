/**
 * Find horizontal anti-aliasing samples: an opaque pixel whose luminance sits
 * strictly between its left and right neighbours. Shared by the edge report and
 * the gamut-distance measurement so both look at exactly the same pixels.
 */

import type { RasterImage } from '../png/decode.js';
import { srgbToLinear } from './transfer.js';
import type { Triplet } from './matrices.js';

/** Rec.2020 luma weights — the profile's own primaries. */
export const LUMA_WEIGHTS = [0.2627, 0.678, 0.0593];

/** Minimum neighbour separation before a pixel counts as bridging an edge. */
const MIN_STEP = 0.05;

export interface EdgeSample {
  x: number;
  y: number;
  /** Codes 0..1 of the darker flat side. */
  low: Triplet;
  /** Codes 0..1 of the brighter flat side. */
  high: Triplet;
  /** Codes 0..1 of the blended pixel between them. */
  blend: Triplet;
}

export function codesAt(image: RasterImage, x: number, y: number): Triplet {
  const at = (y * image.width + x) * image.channels;
  return [image.pixels[at]! / 255, image.pixels[at + 1]! / 255, image.pixels[at + 2]! / 255];
}

export function opaque(image: RasterImage, x: number, y: number): boolean {
  if (image.channels < 4) return true;
  return image.pixels[(y * image.width + x) * image.channels + 3] === 255;
}

export function lumaOf(codes: Triplet, linearize: (v: number) => number): number {
  return (
    LUMA_WEIGHTS[0]! * linearize(codes[0]) +
    LUMA_WEIGHTS[1]! * linearize(codes[1]) +
    LUMA_WEIGHTS[2]! * linearize(codes[2])
  );
}

export function scanEdges(image: RasterImage): EdgeSample[] {
  const samples: EdgeSample[] = [];

  for (let y = 1; y < image.height - 1; y += 1) {
    for (let x = 1; x < image.width - 1; x += 1) {
      if (!opaque(image, x, y)) continue;
      if (!opaque(image, x - 1, y) || !opaque(image, x + 1, y)) continue;

      const leftCodes = codesAt(image, x - 1, y);
      const rightCodes = codesAt(image, x + 1, y);
      const blend = codesAt(image, x, y);

      const left = lumaOf(leftCodes, srgbToLinear);
      const right = lumaOf(rightCodes, srgbToLinear);
      const here = lumaOf(blend, srgbToLinear);

      const low = Math.min(left, right);
      const high = Math.max(left, right);
      if (high - low < MIN_STEP) continue;
      if (here <= low + 1e-6 || here >= high - 1e-6) continue;

      const darker = left < right ? leftCodes : rightCodes;
      const brighter = left < right ? rightCodes : leftCodes;
      samples.push({ x, y, low: darker, high: brighter, blend });
    }
  }

  return samples;
}
