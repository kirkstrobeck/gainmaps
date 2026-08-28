/**
 * Write a decoded raster back into an existing PNG's chunk list. Only the IDAT
 * stream is rebuilt; IHDR, iCCP and everything else are carried across untouched,
 * so a softened file keeps whatever profile and metadata it already had.
 */

import { deflateSync, constants } from 'node:zlib';

import type { Chunk } from './chunks.js';
import type { RasterImage } from './decode.js';
import { bestFilteredRow } from './filter.js';

export function encodeIdat(image: RasterImage): Buffer {
  const stride = image.width * image.channels;
  const rows: Buffer[] = [];
  let previous: Buffer<ArrayBufferLike> = Buffer.alloc(stride);

  for (let y = 0; y < image.height; y += 1) {
    const row = image.pixels.subarray(y * stride, (y + 1) * stride);
    rows.push(bestFilteredRow(row, previous, image.channels));
    previous = row;
  }

  return deflateSync(Buffer.concat(rows), { level: constants.Z_BEST_COMPRESSION });
}

/** Swap the pixel data in, keeping every other chunk in its original order. */
export function replacePixels(chunks: Chunk[], image: RasterImage): Chunk[] {
  const idat: Chunk = { type: 'IDAT', data: encodeIdat(image) };
  const out: Chunk[] = [];
  let written = false;

  for (const chunk of chunks) {
    if (chunk.type !== 'IDAT') {
      out.push(chunk);
      continue;
    }
    if (written) continue;
    out.push(idat);
    written = true;
  }

  if (!written) throw new Error('Malformed PNG: no IDAT chunk to replace');
  return out;
}
