/**
 * The two transfer functions that matter here: sRGB (what these pixels were
 * authored against) and PQ / SMPTE ST 2084 (how the assigned profile makes a
 * viewer read them). Both map an 8-bit code value to display luminance.
 */

const PQ_M1 = 2610 / 16384;
const PQ_M2 = (2523 / 4096) * 128;
const PQ_C1 = 3424 / 4096;
const PQ_C2 = (2413 / 4096) * 32;
const PQ_C3 = (2392 / 4096) * 32;

export const PQ_PEAK_NITS = 10000;
export const SRGB_REFERENCE_NITS = 100;

/** sRGB EOTF: code value 0..1 -> relative luminance 0..1. */
export function srgbToLinear(value: number): number {
  if (value <= 0.04045) return value / 12.92;
  return ((value + 0.055) / 1.055) ** 2.4;
}

export function linearToSrgb(linear: number): number {
  if (linear <= 0.0031308) return linear * 12.92;
  return 1.055 * linear ** (1 / 2.4) - 0.055;
}

/** PQ EOTF: code value 0..1 -> absolute luminance in nits, 0..10000. */
export function pqToNits(value: number): number {
  const powered = Math.max(value, 0) ** (1 / PQ_M2);
  const numerator = Math.max(powered - PQ_C1, 0);
  const denominator = PQ_C2 - PQ_C3 * powered;
  return PQ_PEAK_NITS * (numerator / denominator) ** (1 / PQ_M1);
}

/** PQ inverse EOTF: absolute luminance in nits -> code value 0..1. */
export function nitsToPq(nits: number): number {
  const y = Math.min(Math.max(nits, 0) / PQ_PEAK_NITS, 1) ** PQ_M1;
  return ((PQ_C1 + PQ_C2 * y) / (1 + PQ_C3 * y)) ** PQ_M2;
}

/** BT.2020 EOTF: code value 0..1 -> relative luminance 0..1. */
export function bt2020ToLinear(value: number): number {
  if (value < 0.081) return value / 4.5;
  return ((value + 0.099) / 1.099) ** (1 / 0.45);
}

export function linearToBt2020(linear: number): number {
  if (linear < 0.018) return linear * 4.5;
  return 1.099 * linear ** 0.45 - 0.099;
}

/** A transfer curve normalized to its own white, so curves are comparable. */
export type TransferCurve = (value: number) => number;

export const CURVES: Record<string, TransferCurve> = {
  srgb: srgbToLinear,
  gamut: bt2020ToLinear,
  pq: (value) => pqToNits(value) / PQ_PEAK_NITS,
};

/**
 * Each curve's inverse, normalized the same way. Softening has to blend in the
 * light the viewer actually sees, then write code values back — which needs both
 * directions of whichever curve the assigned profile carries.
 */
export const INVERSE_CURVES: Record<string, TransferCurve> = {
  srgb: linearToSrgb,
  gamut: linearToBt2020,
  pq: (linear) => nitsToPq(linear * PQ_PEAK_NITS),
};
