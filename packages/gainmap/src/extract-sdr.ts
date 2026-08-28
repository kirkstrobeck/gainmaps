/**
 * Extract the primary (SDR) JPEG from an Ultra HDR / gain map JPEG.
 *
 * Ultra HDR appends the gain map as an MPF secondary image after the primary
 * JPEG's EOI. The primary image IS the SDR rendition — same pixels and
 * dimensions the encoder wrote — so slicing the first complete SOI..EOI yields
 * a byte-identical SDR sibling without re-encoding.
 */

export type ExtractSdrErrorCode = "NO_SOI" | "NO_EOI";

export class ExtractSdrError extends Error {
  readonly code: ExtractSdrErrorCode;

  constructor(code: ExtractSdrErrorCode, message: string) {
    super(message);
    this.name = "ExtractSdrError";
    this.code = code;
  }
}

const MARKER_SOS = 0xda;
const MARKER_EOI = 0xd9;
const MARKER_SOI = 0xd8;
const MARKER_TEM = 0x01;
const MARKER_RST0 = 0xd0;
const MARKER_RST7 = 0xd7;

/**
 * Return the primary JPEG bytes (first complete SOI..EOI) from a gain map JPEG.
 * Walks marker structure; does not use a naive EOI byte search.
 */
export function extractSdrPrimary(bytes: Uint8Array): Uint8Array {
  if (bytes.length < 2 || bytes[0] !== 0xff || bytes[1] !== MARKER_SOI) {
    throw new ExtractSdrError("NO_SOI", "input is not a JPEG (missing SOI)");
  }
  const end = walkMarkersToEoi(bytes, 2);
  return bytes.subarray(0, end);
}

function walkMarkersToEoi(bytes: Uint8Array, start: number): number {
  const at = skipFill(bytes, start);
  if (at + 1 >= bytes.length) {
    throw new ExtractSdrError("NO_EOI", "no EOI found in primary JPEG");
  }
  if (bytes[at] !== 0xff) {
    throw new ExtractSdrError("NO_EOI", "malformed JPEG before EOI");
  }
  const marker = bytes[at + 1]!;
  if (marker === MARKER_EOI) return at + 2;
  if (marker === MARKER_SOS) {
    const segLen = segmentPayloadLength(bytes, at);
    return scanEntropyCodedEoi(bytes, at + 2 + segLen);
  }
  if (!markerHasLength(marker)) {
    return walkMarkersToEoi(bytes, at + 2);
  }
  const segLen = segmentPayloadLength(bytes, at);
  return walkMarkersToEoi(bytes, at + 2 + segLen);
}

function markerHasLength(marker: number): boolean {
  if (marker === MARKER_TEM) return false;
  if (marker >= MARKER_RST0 && marker <= MARKER_EOI) return false;
  return true;
}

function segmentPayloadLength(bytes: Uint8Array, markerAt: number): number {
  if (markerAt + 3 >= bytes.length) {
    throw new ExtractSdrError("NO_EOI", "truncated JPEG segment before EOI");
  }
  const len = (bytes[markerAt + 2]! << 8) | bytes[markerAt + 3]!;
  if (len < 2) {
    throw new ExtractSdrError("NO_EOI", "invalid JPEG segment length");
  }
  if (markerAt + 2 + len > bytes.length) {
    throw new ExtractSdrError("NO_EOI", "truncated JPEG segment before EOI");
  }
  return len;
}

/**
 * After SOS, scan entropy-coded data for the terminating EOI.
 * Skips stuffed FF00 bytes and FFD0–FFD7 restart markers.
 */
function scanEntropyCodedEoi(bytes: Uint8Array, start: number): number {
  const at = findEntropyMarker(bytes, start);
  if (at < 0) {
    throw new ExtractSdrError("NO_EOI", "no EOI found in primary JPEG");
  }
  const next = bytes[at + 1]!;
  if (next === 0x00) return scanEntropyCodedEoi(bytes, at + 2);
  if (next >= MARKER_RST0 && next <= MARKER_RST7) {
    return scanEntropyCodedEoi(bytes, at + 2);
  }
  if (next === MARKER_EOI) return at + 2;
  if (next === 0xff) return scanEntropyCodedEoi(bytes, at + 1);
  throw new ExtractSdrError("NO_EOI", "unexpected marker in entropy-coded data");
}

function findEntropyMarker(bytes: Uint8Array, start: number): number {
  let i = start;
  while (i < bytes.length) {
    if (bytes[i] === 0xff) {
      if (i + 1 >= bytes.length) return -1;
      return i;
    }
    i++;
  }
  return -1;
}

function skipFill(bytes: Uint8Array, start: number): number {
  let i = start;
  while (i < bytes.length && bytes[i] === 0xff) {
    if (i + 1 >= bytes.length) return i;
    if (bytes[i + 1] !== 0xff) return i;
    i++;
  }
  return i;
}
