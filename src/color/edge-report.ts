/**
 * Anti-aliasing survives a transfer curve only if intermediate pixels still land
 * between their neighbours after decoding. PQ's curve is so steep in the shadows
 * that they collapse onto the darker side, turning a soft edge into a jagged one.
 *
 * This measures that: for every anti-aliased pixel, where does it sit between its
 * darkest and brightest neighbour, before and after the curve?
 */

import type { RasterImage } from '../png/decode.js';
import type { TransferCurve } from './transfer.js';

/** Rec.2020 luma weights — the profile's own primaries. */
const WEIGHTS = [0.2627, 0.678, 0.0593];

/** A blended pixel counts as collapsed once it keeps under half its authored gap. */
const COLLAPSE_THRESHOLD = 0.5;

export interface EdgeReport {
  /** Pixels that sit strictly between a darker and a brighter neighbour. */
  antiAliased: number;
  /** Mean position between neighbours under the authoring curve, 0..1. */
  authored: number;
  /** Mean position under the assigned curve, 0..1. */
  assigned: number;
  /**
   * Share of blended pixels the assigned curve pushes below half their authored
   * position — the ones that stop reading as a blend and join the dark side.
   * Bounded 0..1, unlike a luminance ratio, which explodes near black.
   */
  collapsed: number;
}

function luminance(image: RasterImage, x: number, y: number, curve: TransferCurve): number {
  const at = (y * image.width + x) * image.channels;
  let total = 0;
  for (let c = 0; c < 3; c += 1) total += WEIGHTS[c]! * curve(image.pixels[at + c]! / 255);
  return total;
}

function opaque(image: RasterImage, x: number, y: number): boolean {
  if (image.channels < 4) return true;
  return image.pixels[(y * image.width + x) * image.channels + 3] === 255;
}

/** Where `value` sits between `low` and `high`, or null if they are too close. */
function position(value: number, low: number, high: number): number | null {
  /* v8 ignore next -- callers pre-filter flat spans before requesting a position. */
  if (high - low < 1e-6) return null;
  return (value - low) / (high - low);
}

export function measureEdges(
  image: RasterImage,
  authoring: TransferCurve,
  assigned: TransferCurve,
): EdgeReport {
  let count = 0;
  let authoredTotal = 0;
  let assignedTotal = 0;
  let collapsedCount = 0;

  for (let y = 1; y < image.height - 1; y += 1) {
    for (let x = 1; x < image.width - 1; x += 1) {
      if (!opaque(image, x, y)) continue;

      const left = luminance(image, x - 1, y, authoring);
      const right = luminance(image, x + 1, y, authoring);
      const here = luminance(image, x, y, authoring);
      const low = Math.min(left, right);
      const high = Math.max(left, right);

      // Only pixels that genuinely bridge a step — not noise, not flat fill.
      if (high - low < 0.05) continue;
      if (here <= low + 1e-6 || here >= high - 1e-6) continue;

      const authored = position(here, low, high);
      const lowAssigned = Math.min(
        luminance(image, x - 1, y, assigned),
        luminance(image, x + 1, y, assigned),
      );
      const highAssigned = Math.max(
        luminance(image, x - 1, y, assigned),
        luminance(image, x + 1, y, assigned),
      );
      const target = position(luminance(image, x, y, assigned), lowAssigned, highAssigned);
      /* v8 ignore next -- authored spans are pre-filtered; assigned spans only collapse, not flatten exactly. */
      if (authored === null || target === null) continue;

      count += 1;
      authoredTotal += authored;
      assignedTotal += target;
      if (target < authored * COLLAPSE_THRESHOLD) collapsedCount += 1;
    }
  }

  if (count === 0) return { antiAliased: 0, authored: 0, assigned: 0, collapsed: 0 };

  return {
    antiAliased: count,
    authored: authoredTotal / count,
    assigned: assignedTotal / count,
    collapsed: collapsedCount / count,
  };
}
