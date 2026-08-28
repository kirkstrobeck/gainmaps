import type { ImageCodec, ImageFacts } from './codec.js';
import { markerName, SOI } from '../jpeg/markers.js';
import { parseJpeg, serializeJpeg } from '../jpeg/structure.js';
import { extractIccProfile, setIccProfile } from '../jpeg/icc-segments.js';
import { lumaQuantizationAverage, readFrameInfo } from '../jpeg/dimensions.js';

function qualityNote(average: number): string {
  if (average <= 1.5) return `luma quantization avg ${average.toFixed(1)} (near-lossless)`;
  if (average <= 6) return `luma quantization avg ${average.toFixed(1)} (high quality)`;
  return `luma quantization avg ${average.toFixed(1)} (detail already discarded)`;
}

export const jpegCodec: ImageCodec = {
  name: 'JPEG',

  matches(data) {
    return data.length >= 2 && data[0] === 0xff && data[1] === SOI;
  },

  facts(data): ImageFacts {
    const jpeg = parseJpeg(data);
    const frame = readFrameInfo(jpeg);
    const notes: string[] = [];

    if (frame) notes.push(`chroma sampling ${frame.sampling}`);
    const average = lumaQuantizationAverage(jpeg);
    if (average !== null) notes.push(qualityNote(average));

    return {
      width: frame?.width ?? 0,
      height: frame?.height ?? 0,
      structure: jpeg.segments.map((segment) => markerName(segment.marker)).join(' '),
      notes,
    };
  },

  getProfile(data) {
    return extractIccProfile(parseJpeg(data));
  },

  setProfile(data, profile) {
    return serializeJpeg(setIccProfile(parseJpeg(data), profile));
  },

  pixelPayload(data) {
    return parseJpeg(data).scan;
  },
};
