/** PNG chunk-level reader and writer. Chunk data is never re-encoded. */

import { crc32 } from './crc32.js';

export const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

export interface Chunk {
  type: string;
  data: Buffer;
}

export function isPng(data: Buffer): boolean {
  return data.length >= 8 && data.subarray(0, 8).equals(PNG_SIGNATURE);
}

export function parsePng(data: Buffer): Chunk[] {
  if (!isPng(data)) throw new Error('Not a PNG: bad signature');

  const chunks: Chunk[] = [];
  let pos = 8;

  while (pos + 8 <= data.length) {
    const length = data.readUInt32BE(pos);
    const type = data.subarray(pos + 4, pos + 8).toString('latin1');
    const end = pos + 12 + length;
    if (end > data.length) throw new Error(`Malformed PNG: chunk ${type} overruns file`);

    chunks.push({ type, data: data.subarray(pos + 8, pos + 8 + length) });
    if (type === 'IEND') return chunks;
    pos = end;
  }

  throw new Error('Malformed PNG: no IEND chunk');
}

export function serializePng(chunks: Chunk[]): Buffer {
  const parts: Buffer[] = [PNG_SIGNATURE];

  for (const chunk of chunks) {
    const header = Buffer.alloc(8);
    header.writeUInt32BE(chunk.data.length, 0);
    header.write(chunk.type, 4, 'latin1');

    const crc = Buffer.alloc(4);
    crc.writeUInt32BE(crc32(Buffer.concat([header.subarray(4), chunk.data])), 0);

    parts.push(header, chunk.data, crc);
  }

  return Buffer.concat(parts);
}

/** Index of the first chunk that iCCP must precede (PLTE or IDAT). */
export function colorChunkInsertionPoint(chunks: Chunk[]): number {
  const at = chunks.findIndex((chunk) => chunk.type === 'PLTE' || chunk.type === 'IDAT');
  return at === -1 ? Math.max(chunks.length - 1, 1) : at;
}

export function pngDimensions(chunks: Chunk[]): { width: number; height: number } {
  const ihdr = chunks.find((chunk) => chunk.type === 'IHDR');
  if (!ihdr || ihdr.data.length < 8) throw new Error('Malformed PNG: missing IHDR');
  return { width: ihdr.data.readUInt32BE(0), height: ihdr.data.readUInt32BE(4) };
}
