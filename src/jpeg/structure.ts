/**
 * Split a JPEG into its metadata segments and its untouched entropy-coded scan.
 *
 * Only the segments before SOS are modelled. Everything from SOS onward is kept
 * as an opaque buffer, which is what guarantees pixel data is never rewritten.
 */

import { isStandalone, isTerminal, SOI } from './markers.js';

export interface Segment {
  /** Second byte of the marker, e.g. 0xE2 for APP2. */
  marker: number;
  /** Segment body with the 2-byte length prefix removed. */
  payload: Buffer;
}

export interface JpegStructure {
  segments: Segment[];
  /** SOS marker and all following bytes, byte-for-byte from the source. */
  scan: Buffer;
}

const MAX_PAYLOAD = 0xffff - 2;

export function parseJpeg(data: Buffer): JpegStructure {
  if (data.length < 4 || data[0] !== 0xff || data[1] !== SOI) {
    throw new Error('Not a JPEG: missing SOI marker (FFD8)');
  }

  const segments: Segment[] = [];
  let pos = 2;

  while (pos < data.length) {
    if (data[pos] !== 0xff) {
      throw new Error(`Malformed JPEG: expected marker at offset ${pos}`);
    }
    // Fill bytes: any number of 0xFF may precede the marker code.
    let codeAt = pos + 1;
    while (codeAt < data.length && data[codeAt] === 0xff) codeAt += 1;
    if (codeAt >= data.length) throw new Error('Malformed JPEG: truncated marker');

    const marker = data[codeAt];
    if (isTerminal(marker)) return { segments, scan: data.subarray(pos) };

    if (isStandalone(marker)) {
      segments.push({ marker, payload: Buffer.alloc(0) });
      pos = codeAt + 1;
      continue;
    }

    const lengthAt = codeAt + 1;
    if (lengthAt + 2 > data.length) throw new Error('Malformed JPEG: truncated segment length');
    const length = data.readUInt16BE(lengthAt);
    if (length < 2) throw new Error(`Malformed JPEG: bad segment length ${length}`);

    const end = lengthAt + length;
    if (end > data.length) throw new Error('Malformed JPEG: segment overruns file');

    segments.push({ marker, payload: data.subarray(lengthAt + 2, end) });
    pos = end;
  }

  throw new Error('Malformed JPEG: no SOS or EOI marker found');
}

export function serializeJpeg(jpeg: JpegStructure): Buffer {
  const parts: Buffer[] = [Buffer.from([0xff, SOI])];

  for (const segment of jpeg.segments) {
    if (segment.payload.length > MAX_PAYLOAD) {
      throw new Error(`Segment payload too large: ${segment.payload.length} bytes`);
    }
    if (segment.payload.length === 0) {
      parts.push(Buffer.from([0xff, segment.marker]));
      continue;
    }
    const header = Buffer.alloc(4);
    header.writeUInt8(0xff, 0);
    header.writeUInt8(segment.marker, 1);
    header.writeUInt16BE(segment.payload.length + 2, 2);
    parts.push(header, segment.payload);
  }

  parts.push(jpeg.scan);
  return Buffer.concat(parts);
}

export const MAX_SEGMENT_PAYLOAD = MAX_PAYLOAD;
