/**
 * Minimal PNG pixel decoder: inflate the IDAT stream and undo the per-scanline
 * filters. Only what this tool needs — 8-bit truecolour, with or without alpha,
 * non-interlaced. Enough to inspect what a profile assignment does to edges.
 */

import { inflateSync } from 'node:zlib';

import { pngDimensions, type Chunk } from './chunks.js';
import { pngPixelPayload } from './icc-chunk.js';

export interface RasterImage {
  width: number;
  height: number;
  /** Bytes per pixel: 3 for RGB, 4 for RGBA. */
  channels: number;
  /** Row-major, `width * height * channels` bytes. */
  pixels: Buffer;
}

const SUPPORTED_CHANNELS: Record<number, number> = { 2: 3, 6: 4 };

function paeth(a: number, b: number, c: number): number {
  const p = a + b - c;
  const pa = Math.abs(p - a);
  const pb = Math.abs(p - b);
  const pc = Math.abs(p - c);
  if (pa <= pb && pa <= pc) return a;
  if (pb <= pc) return b;
  return c;
}

function unfilterRow(type: number, row: Buffer, previous: Buffer, bpp: number): void {
  for (let i = 0; i < row.length; i += 1) {
    const left = i >= bpp ? row[i - bpp]! : 0;
    const up = previous[i]!;
    const upLeft = i >= bpp ? previous[i - bpp]! : 0;

    if (type === 1) row[i] = (row[i]! + left) & 0xff;
    if (type === 2) row[i] = (row[i]! + up) & 0xff;
    if (type === 3) row[i] = (row[i]! + ((left + up) >> 1)) & 0xff;
    if (type === 4) row[i] = (row[i]! + paeth(left, up, upLeft)) & 0xff;
  }
}

export function decodePng(chunks: Chunk[]): RasterImage {
  const ihdr = chunks.find((chunk) => chunk.type === 'IHDR');
  if (!ihdr) throw new Error('Malformed PNG: missing IHDR');

  const depth = ihdr.data.readUInt8(8);
  const colorType = ihdr.data.readUInt8(9);
  const interlace = ihdr.data.readUInt8(12);
  const channels = SUPPORTED_CHANNELS[colorType];

  if (depth !== 8) throw new Error(`Unsupported PNG bit depth: ${depth}`);
  if (!channels) throw new Error(`Unsupported PNG colour type: ${colorType}`);
  if (interlace !== 0) throw new Error('Unsupported PNG: interlaced');

  const { width, height } = pngDimensions(chunks);
  const raw = inflateSync(pngPixelPayload(chunks));
  const stride = width * channels;

  const pixels = Buffer.alloc(stride * height);
  let previous = Buffer.alloc(stride);

  for (let y = 0; y < height; y += 1) {
    const at = y * (stride + 1);
    if (at + stride >= raw.length + 1) throw new Error('Malformed PNG: truncated scanlines');

    const row = pixels.subarray(y * stride, (y + 1) * stride);
    raw.copy(row, 0, at + 1, at + 1 + stride);
    unfilterRow(raw.readUInt8(at), row, previous, channels);
    previous = row;
  }

  return { width, height, channels, pixels };
}

export function pixelAt(image: RasterImage, x: number, y: number): number[] {
  const at = (y * image.width + x) * image.channels;
  return Array.from(image.pixels.subarray(at, at + image.channels));
}
