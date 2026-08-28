/**
 * Read a profile's colorant primaries. These define the gamut — the reason
 * Rec.2020 art looks impossibly saturated. They are independent of the transfer
 * curve, which is what makes swapping PQ for BT.2020 keep the look and fix edges.
 */

import { findIccTag } from './tags.js';

/** The `XYZ ` type signature carries a significant trailing space. */
const XYZ_TYPE = 'XYZ ';

export type XyzTriplet = [number, number, number];

/** ICC s15Fixed16Number: signed 16.16 fixed point. */
function s15Fixed16(data: Buffer, offset: number): number {
  return data.readInt32BE(offset) / 65536;
}

/** The XYZ value of an `XYZ `-typed tag such as rXYZ / gXYZ / bXYZ / wtpt. */
export function readIccXyzTag(profile: Buffer, tag: string): XyzTriplet | null {
  const data = findIccTag(profile, tag);
  if (!data || data.length < 20) return null;
  if (data.subarray(0, 4).toString('latin1') !== XYZ_TYPE) return null;
  return [s15Fixed16(data, 8), s15Fixed16(data, 12), s15Fixed16(data, 16)];
}

/** True when two profiles describe the same gamut within `tolerance`. */
export function sameGamut(a: Buffer, b: Buffer, tolerance = 1e-3): boolean {
  for (const tag of ['rXYZ', 'gXYZ', 'bXYZ', 'wtpt']) {
    const left = readIccXyzTag(a, tag);
    const right = readIccXyzTag(b, tag);
    if (!left || !right) return false;
    for (let i = 0; i < 3; i += 1) {
      if (Math.abs(left[i]! - right[i]!) > tolerance) return false;
    }
  }
  return true;
}
