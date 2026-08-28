/**
 * PNG `iCCP` chunk: profile name, null terminator, compression method 0, then
 * the zlib-deflated ICC profile.
 *
 * The spec forbids `iCCP` alongside `sRGB`, and says `gAMA`/`cHRM` are ignored
 * when a profile is present — so those are dropped to keep viewers unambiguous.
 */

import { deflateSync, inflateSync } from 'node:zlib';

import { colorChunkInsertionPoint, type Chunk } from './chunks.js';

const CONFLICTING = new Set(['sRGB', 'gAMA', 'cHRM', 'iCCP']);
const MAX_NAME_LENGTH = 79;

function sanitizeName(description: string): string {
  const ascii = description.replace(/[^\x20-\x7e]/g, '').trim();
  return (ascii || 'ICC Profile').slice(0, MAX_NAME_LENGTH);
}

export function extractIccFromPng(chunks: Chunk[]): Buffer | null {
  const chunk = chunks.find((candidate) => candidate.type === 'iCCP');
  if (!chunk) return null;

  const nul = chunk.data.indexOf(0);
  if (nul === -1) throw new Error('Malformed iCCP chunk: no name terminator');
  if (chunk.data[nul + 1] !== 0) throw new Error('Unsupported iCCP compression method');

  return inflateSync(chunk.data.subarray(nul + 2));
}

export function setIccInPng(chunks: Chunk[], profile: Buffer, name: string): Chunk[] {
  const label = Buffer.from(sanitizeName(name), 'latin1');
  const data = Buffer.concat([label, Buffer.from([0, 0]), deflateSync(profile, { level: 9 })]);

  const kept = chunks.filter((chunk) => !CONFLICTING.has(chunk.type));
  const at = colorChunkInsertionPoint(kept);
  return [...kept.slice(0, at), { type: 'iCCP', data }, ...kept.slice(at)];
}

/** Concatenated IDAT payload — the compressed pixels, used to prove they're untouched. */
export function pngPixelPayload(chunks: Chunk[]): Buffer {
  return Buffer.concat(chunks.filter((chunk) => chunk.type === 'IDAT').map((chunk) => chunk.data));
}
