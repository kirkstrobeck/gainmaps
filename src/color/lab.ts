/** CIE Lab under D65, plus the CIE76 distance. Used to compare how far apart
 * two colours sit when the same code values are read through different profiles. */

import { applyMatrix, type Matrix3, type Triplet } from './matrices.js';

const WHITE: Triplet = [0.95047, 1.0, 1.08883];
const EPSILON = 216 / 24389;
const KAPPA = 24389 / 27;

function pivot(value: number): number {
  if (value > EPSILON) return Math.cbrt(value);
  return (KAPPA * value + 16) / 116;
}

export function xyzToLab(xyz: Triplet): Triplet {
  const fx = pivot(xyz[0] / WHITE[0]);
  const fy = pivot(xyz[1] / WHITE[1]);
  const fz = pivot(xyz[2] / WHITE[2]);
  return [116 * fy - 16, 500 * (fx - fy), 200 * (fy - fz)];
}

/** Decode a code triple through a curve and primaries, then express it as Lab. */
export function codesToLab(codes: Triplet, linearize: (v: number) => number, matrix: Matrix3): Triplet {
  const linear: Triplet = [linearize(codes[0]), linearize(codes[1]), linearize(codes[2])];
  return xyzToLab(applyMatrix(matrix, linear));
}

export function deltaE76(a: Triplet, b: Triplet): number {
  return Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
}

/** The chromatic part of the distance alone — how far apart two colours sit in
 *  hue and saturation, ignoring lightness. Wider primaries move this, not L. */
export function deltaChroma(a: Triplet, b: Triplet): number {
  return Math.hypot(a[1] - b[1], a[2] - b[2]);
}
