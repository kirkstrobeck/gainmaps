/**
 * Read and write the APP2 `ICC_PROFILE` segments that carry an embedded profile.
 *
 * Layout per JPEG/ICC spec: 12-byte "ICC_PROFILE\0" tag, 1-byte chunk number
 * (1-based), 1-byte chunk count, then that slice of the profile bytes.
 */

import { APP0, APP1, APP2 } from './markers.js';
import { MAX_SEGMENT_PAYLOAD, type JpegStructure, type Segment } from './structure.js';

const ICC_TAG = Buffer.from('ICC_PROFILE\0', 'latin1');
const HEADER_LENGTH = ICC_TAG.length + 2;
const MAX_CHUNK_DATA = MAX_SEGMENT_PAYLOAD - HEADER_LENGTH;

function isIccSegment(segment: Segment): boolean {
  return (
    segment.marker === APP2 &&
    segment.payload.length >= HEADER_LENGTH &&
    segment.payload.subarray(0, ICC_TAG.length).equals(ICC_TAG)
  );
}

/** Reassemble the embedded ICC profile, or null when the JPEG carries none. */
export function extractIccProfile(jpeg: JpegStructure): Buffer | null {
  const chunks = jpeg.segments.filter(isIccSegment);
  if (chunks.length === 0) return null;

  const ordered = chunks
    .map((segment) => ({
      index: segment.payload.readUInt8(ICC_TAG.length),
      data: segment.payload.subarray(HEADER_LENGTH),
    }))
    .sort((a, b) => a.index - b.index);

  return Buffer.concat(ordered.map((chunk) => chunk.data));
}

function buildIccSegments(profile: Buffer): Segment[] {
  const total = Math.ceil(profile.length / MAX_CHUNK_DATA);
  if (total > 255) throw new Error(`ICC profile too large to embed: ${profile.length} bytes`);

  return Array.from({ length: total }, (_, i) => {
    const header = Buffer.alloc(HEADER_LENGTH);
    ICC_TAG.copy(header, 0);
    header.writeUInt8(i + 1, ICC_TAG.length);
    header.writeUInt8(total, ICC_TAG.length + 1);
    const slice = profile.subarray(i * MAX_CHUNK_DATA, (i + 1) * MAX_CHUNK_DATA);
    return { marker: APP2, payload: Buffer.concat([header, slice]) };
  });
}

/** Index just past the leading JFIF/Exif segments, where ICC conventionally goes. */
function insertionPoint(segments: Segment[]): number {
  let index = 0;
  while (index < segments.length) {
    const marker = segments[index].marker;
    if (marker !== APP0 && marker !== APP1) break;
    index += 1;
  }
  return index;
}

/**
 * Replace any embedded profile with `profile`. Segments are metadata only, so
 * the scan — the actual pixels — is passed through untouched.
 */
export function setIccProfile(jpeg: JpegStructure, profile: Buffer): JpegStructure {
  const kept = jpeg.segments.filter((segment) => !isIccSegment(segment));
  const at = insertionPoint(kept);
  const segments = [...kept.slice(0, at), ...buildIccSegments(profile), ...kept.slice(at)];
  return { segments, scan: jpeg.scan };
}
