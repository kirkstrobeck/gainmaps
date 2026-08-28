import type { ImageCodec, ImageFacts } from './codec.js';
import { isPng, parsePng, pngDimensions, serializePng } from '../png/chunks.js';
import { extractIccFromPng, pngPixelPayload, setIccInPng } from '../png/icc-chunk.js';

const BIT_DEPTH_OFFSET = 8;
const COLOR_TYPE_OFFSET = 9;

const COLOR_TYPES: Record<number, string> = {
  0: 'grayscale',
  2: 'truecolour',
  3: 'indexed',
  4: 'grayscale+alpha',
  6: 'truecolour+alpha',
};

export const pngCodec: ImageCodec = {
  name: 'PNG',

  matches: isPng,

  facts(data): ImageFacts {
    const chunks = parsePng(data);
    const { width, height } = pngDimensions(chunks);
    const ihdr = chunks.find((chunk) => chunk.type === 'IHDR')!.data;
    const colorType = ihdr.readUInt8(COLOR_TYPE_OFFSET);

    return {
      width,
      height,
      structure: chunks.map((chunk) => chunk.type).join(' '),
      notes: [
        `${ihdr.readUInt8(BIT_DEPTH_OFFSET)}-bit ${COLOR_TYPES[colorType] ?? `type ${colorType}`}`,
        'lossless (no quantization)',
      ],
    };
  },

  getProfile(data) {
    return extractIccFromPng(parsePng(data));
  },

  setProfile(data, profile, name) {
    return serializePng(setIccInPng(parsePng(data), profile, name));
  },

  pixelPayload(data) {
    return pngPixelPayload(parsePng(data));
  },
};
