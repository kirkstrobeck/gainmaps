/** Pick the codec that matches a file's magic bytes. */

import type { ImageCodec } from './codec.js';
import { jpegCodec } from './jpeg-codec.js';
import { pngCodec } from './png-codec.js';

export const CODECS: ImageCodec[] = [jpegCodec, pngCodec];

export function codecFor(data: Buffer): ImageCodec {
  const codec = CODECS.find((candidate) => candidate.matches(data));
  if (codec) return codec;
  throw new Error(`Unsupported format — expected ${CODECS.map((c) => c.name).join(' or ')}`);
}
