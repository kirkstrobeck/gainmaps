/** Read image size and chroma sampling from the JPEG frame header. */

import type { JpegStructure } from './structure.js';

export interface FrameInfo {
  width: number;
  height: number;
  /** e.g. "4:4:4" or "4:2:0", derived from the luma sampling factors. */
  sampling: string;
}

function isFrameMarker(marker: number): boolean {
  if (marker < 0xc0 || marker > 0xcf) return false;
  return marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc;
}

function describeSampling(payload: Buffer, components: number): string {
  if (components < 3) return 'grayscale';
  // Frame header: precision(1) height(2) width(2) count(1), then per component
  // id(1) sampling(1) quantization-table(1). Luma sampling is the 2nd of those.
  const factor = payload.readUInt8(7);
  const horizontal = factor >> 4;
  const vertical = factor & 0x0f;
  if (horizontal === 1 && vertical === 1) return '4:4:4';
  if (horizontal === 2 && vertical === 1) return '4:2:2';
  if (horizontal === 2 && vertical === 2) return '4:2:0';
  return `${horizontal}x${vertical}`;
}

export function readFrameInfo(jpeg: JpegStructure): FrameInfo | null {
  const frame = jpeg.segments.find((segment) => isFrameMarker(segment.marker));
  if (!frame || frame.payload.length < 6) return null;

  const components = frame.payload.readUInt8(5);
  return {
    height: frame.payload.readUInt16BE(1),
    width: frame.payload.readUInt16BE(3),
    sampling: frame.payload.length >= 9 ? describeSampling(frame.payload, components) : 'unknown',
  };
}

/**
 * Average of the luma quantization table. Values near 1 mean a near-lossless
 * encode; larger values mean detail was already discarded.
 */
export function lumaQuantizationAverage(jpeg: JpegStructure): number | null {
  const dqt = jpeg.segments.find((segment) => segment.marker === 0xdb);
  if (!dqt || dqt.payload.length < 65) return null;

  const precision = dqt.payload.readUInt8(0) >> 4;
  let total = 0;
  for (let i = 0; i < 64; i += 1) {
    total += precision === 0 ? dqt.payload.readUInt8(1 + i) : dqt.payload.readUInt16BE(1 + i * 2);
  }
  return total / 64;
}
