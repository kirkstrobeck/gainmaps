/**
 * The second reason edges get harsh, and the one a preset swap cannot fix.
 *
 * Rec.2020's primaries sit further apart than sRGB's, so the *same* code values
 * land further apart perceptually. An edge that was authored with one blended
 * pixel bridging a gap of N now has to bridge a gap of 1.4N with that same one
 * pixel. Nothing was lost — the transition is simply under-sampled for the
 * contrast it now carries, and reads as a hard step.
 *
 * Measured in CIE76 dE between the two flat sides of every anti-aliased edge.
 */

import type { RasterImage } from '../png/decode.js';
import { srgbToLinear, type TransferCurve } from './transfer.js';
import { REC2020_TO_XYZ, SRGB_TO_XYZ } from './matrices.js';
import { codesToLab, deltaChroma, deltaE76 } from './lab.js';
import { scanEdges } from './edge-scan.js';

export interface GamutReport {
  /** Anti-aliased pixels sampled. */
  edges: number;
  /** Mean dE across an edge as authored: sRGB curve, sRGB primaries. */
  authored: number;
  /** Mean dE with only the primaries swapped — the curve held at sRGB. */
  primaries: number;
  /** Mean dE as the assigned profile reads it: its own curve and primaries. */
  assigned: number;
  /** primaries / authored. How much further apart the same edge now sits. */
  stretch: number;
  /** The same ratio for chroma alone, where the primaries do all their work. */
  chromaStretch: number;
}

/**
 * How much softening the stretch calls for, 0..1. An edge spanning 1.5x further
 * needs roughly half again as much transition, so the excess over 1.0 is the
 * dial. Capped, because past a point you are blurring the artwork, not the edge.
 */
const MAX_AMOUNT = 0.6;

export function suggestedAmount(chromaStretch: number): number {
  return Math.min(Math.max(chromaStretch - 1, 0), MAX_AMOUNT);
}

export function measureGamutDistance(image: RasterImage, assigned: TransferCurve): GamutReport {
  const samples = scanEdges(image);
  if (samples.length === 0) {
    return { edges: 0, authored: 0, primaries: 0, assigned: 0, stretch: 1, chromaStretch: 1 };
  }

  let authoredTotal = 0;
  let primariesTotal = 0;
  let assignedTotal = 0;
  let authoredChroma = 0;
  let primariesChroma = 0;

  for (const sample of samples) {
    const asAuthored = [
      codesToLab(sample.low, srgbToLinear, SRGB_TO_XYZ),
      codesToLab(sample.high, srgbToLinear, SRGB_TO_XYZ),
    ] as const;
    const asWideGamut = [
      codesToLab(sample.low, srgbToLinear, REC2020_TO_XYZ),
      codesToLab(sample.high, srgbToLinear, REC2020_TO_XYZ),
    ] as const;

    authoredTotal += deltaE76(asAuthored[0], asAuthored[1]);
    primariesTotal += deltaE76(asWideGamut[0], asWideGamut[1]);
    authoredChroma += deltaChroma(asAuthored[0], asAuthored[1]);
    primariesChroma += deltaChroma(asWideGamut[0], asWideGamut[1]);
    assignedTotal += deltaE76(
      codesToLab(sample.low, assigned, REC2020_TO_XYZ),
      codesToLab(sample.high, assigned, REC2020_TO_XYZ),
    );
  }

  /* v8 ignore next -- scanEdges only emits samples with non-zero authored edge distance. */
  const stretch = authoredTotal > 0 ? primariesTotal / authoredTotal : 1;

  return {
    edges: samples.length,
    authored: authoredTotal / samples.length,
    primaries: primariesTotal / samples.length,
    assigned: assignedTotal / samples.length,
    stretch,
    /* v8 ignore next -- sampled anti-aliased colour edges have non-zero authored chroma. */
    chromaStretch: authoredChroma > 0 ? primariesChroma / authoredChroma : 1,
  };
}
