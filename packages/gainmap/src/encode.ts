import {
  sRGBToLinear,
  writeJpegGainMap,
  type EncodingResult,
} from "hdrify";

export type GainMapHdrModel = "highlight" | "window";

export type GainMapEncodeOptions = {
  /** 0..1 UI boost. 0.5 is default photo headroom. */
  boost?: number;
  /** Explicit headroom multiplier; overrides boost when set. */
  headroom?: number;
  /** JPEG quality 1-100 for the SDR base. Default 92. */
  quality?: number;
  hdrModel?: GainMapHdrModel;
  matte?: "white" | "checkerboard";
};

export type GainMapEncodeResult = {
  output: Uint8Array;
  note: string;
  width: number;
  height: number;
  headroom: number;
};

export type WindowGainCalibration = {
  readonly headroom: number;
  readonly ev: number;
  readonly saturation: number;
  readonly scale: readonly [number, number, number];
  readonly offset: readonly [number, number, number];
};

export const WINDOW_GAIN_CALIBRATION: WindowGainCalibration = {
  headroom: 3.3431570529937744,
  ev: 1.8088424205780029,
  saturation: 0.92088139057159424,
  scale: [0.97700381278991699, 1.0064921379089355, 1.0169353485107422],
  offset: [-0.12703368067741394, -0.18058346211910248, -0.2131592333316803],
};

export const DEFAULT_PHOTO_HEADROOM = WINDOW_GAIN_CALIBRATION.headroom;

export function headroomFromBoost(boost: number): number {
  const mid = DEFAULT_PHOTO_HEADROOM;
  if (boost <= 0.5) return 2 + (boost / 0.5) * (mid - 2);
  return mid + ((boost - 0.5) / 0.5) * (6 - mid);
}

export function flattenRgbaOntoWhite(
  pixels: Uint8Array,
  width: number,
  height: number,
): Uint8ClampedArray {
  return flattenRgba(pixels, width, height, () => [255, 255, 255]);
}

const CHECKER_SQUARE = 16;
const CHECKER_LIGHT = 245;
const CHECKER_DARK = 226;

export function flattenRgbaOntoCheckerboard(
  pixels: Uint8Array,
  width: number,
  height: number,
  square: number = CHECKER_SQUARE,
): Uint8ClampedArray {
  return flattenRgba(pixels, width, height, (x, y) => {
    const shade =
      (Math.floor(x / square) + Math.floor(y / square)) % 2 === 0 ? CHECKER_LIGHT : CHECKER_DARK;
    return [shade, shade, shade];
  });
}

function flattenRgba(
  pixels: Uint8Array,
  width: number,
  height: number,
  matteAt: (x: number, y: number) => readonly [number, number, number],
): Uint8ClampedArray {
  const sdr = new Uint8ClampedArray(width * height * 4);
  const count = width * height;
  for (let index = 0; index < count; index += 1) {
    const offset = index * 4;
    const alpha = pixels[offset + 3]! / 255;
    const matte = matteAt(index % width, Math.floor(index / width));
    sdr[offset] = Math.round(pixels[offset]! * alpha + matte[0] * (1 - alpha));
    sdr[offset + 1] = Math.round(pixels[offset + 1]! * alpha + matte[1] * (1 - alpha));
    sdr[offset + 2] = Math.round(pixels[offset + 2]! * alpha + matte[2] * (1 - alpha));
    sdr[offset + 3] = 255;
  }
  return sdr;
}

export function applyHighlightSelectiveHdr(
  r: number,
  g: number,
  b: number,
  headroom: number,
): [number, number, number] {
  const y = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  const t = smoothstep(0.28, 0.88, y);
  const weight = t * t;
  const gain = 1 + weight * (Math.max(headroom, 1) - 1);
  return [r * gain, g * gain, b * gain];
}

export function applyWindowGainCalibration(
  r: number,
  g: number,
  b: number,
  headroom: number,
  calibration: WindowGainCalibration = WINDOW_GAIN_CALIBRATION,
): [number, number, number] {
  const { ev, saturation, scale, offset } = calibration;
  const evAdj = ev + Math.log2(Math.max(headroom, 1.0001) / calibration.headroom);
  const m = 2 ** evAdj;
  const rr = Math.max(0, r * m * scale[0] + offset[0]);
  const gg = Math.max(0, g * m * scale[1] + offset[1]);
  const bb = Math.max(0, b * m * scale[2] + offset[2]);
  if (Math.abs(saturation - 1) <= 1e-4) return [rr, gg, bb];
  const y = 0.2126 * rr + 0.7152 * gg + 0.0722 * bb;
  return [
    Math.max(0, y + (rr - y) * saturation),
    Math.max(0, y + (gg - y) * saturation),
    Math.max(0, y + (bb - y) * saturation),
  ];
}

type HdrMapper = (r: number, g: number, b: number, headroom: number) => [number, number, number];

function hdrMapperFor(model: GainMapHdrModel): HdrMapper {
  if (model === "window") return applyWindowGainCalibration;
  return applyHighlightSelectiveHdr;
}

export function encodeKeepBaseGainMap(
  sdr: Uint8ClampedArray,
  width: number,
  height: number,
  headroom: number,
  hdrModel: GainMapHdrModel = "highlight",
  alphaMask?: Uint8Array | null,
): EncodingResult {
  const offsetSdr = [1 / 64, 1 / 64, 1 / 64] as [number, number, number];
  const offsetHdr = [1 / 64, 1 / 64, 1 / 64] as [number, number, number];
  const gamma = [1, 1, 1] as [number, number, number];
  const minContentBoost = 1;
  const maxContentBoost = Math.max(headroom, 1.0001);
  const minLog2 = Math.log2(minContentBoost);
  const maxLog2 = Math.log2(maxContentBoost);
  const invLogRange = 1 / (maxLog2 - minLog2);
  const gainMap = new Uint8ClampedArray(sdr.length);
  const mapHdr = hdrMapperFor(hdrModel);
  const count = width * height;
  for (let index = 0; index < count; index += 1) {
    const offset = index * 4;
    gainMap[offset + 3] = 255;
    const alphaW = alphaMask ? alphaMask[offset + 3]! / 255 : 1;
    if (alphaW === 0) {
      gainMap[offset] = 0;
      gainMap[offset + 1] = 0;
      gainMap[offset + 2] = 0;
      continue;
    }
    const sdrR = sRGBToLinear(sdr[offset]! / 255);
    const sdrG = sRGBToLinear(sdr[offset + 1]! / 255);
    const sdrB = sRGBToLinear(sdr[offset + 2]! / 255);
    const [hdrR, hdrG, hdrB] = mapHdr(sdrR, sdrG, sdrB, headroom);
    const gainR = (hdrR + offsetHdr[0]) / (sdrR + offsetSdr[0]);
    const gainG = (hdrG + offsetHdr[1]) / (sdrG + offsetSdr[1]);
    const gainB = (hdrB + offsetHdr[2]) / (sdrB + offsetSdr[2]);
    gainMap[offset] = Math.round(255 * clamp((Math.log2(Math.max(gainR, 1e-8)) - minLog2) * invLogRange * alphaW, 0, 1) ** gamma[0]);
    gainMap[offset + 1] = Math.round(255 * clamp((Math.log2(Math.max(gainG, 1e-8)) - minLog2) * invLogRange * alphaW, 0, 1) ** gamma[1]);
    gainMap[offset + 2] = Math.round(255 * clamp((Math.log2(Math.max(gainB, 1e-8)) - minLog2) * invLogRange * alphaW, 0, 1) ** gamma[2]);
  }
  return {
    sdr,
    gainMap,
    width,
    height,
    metadata: {
      gamma,
      offsetSdr,
      offsetHdr,
      gainMapMin: [minLog2, minLog2, minLog2],
      gainMapMax: [maxLog2, maxLog2, maxLog2],
      hdrCapacityMin: 0,
      hdrCapacityMax: Math.max(0, maxLog2),
    },
  };
}

export function resolveHeadroom(options: GainMapEncodeOptions): number {
  if (options.headroom != null && Number.isFinite(options.headroom)) {
    return Math.max(Number(options.headroom), 1);
  }
  return headroomFromBoost(clamp(Number(options.boost ?? 0.5), 0, 1));
}

export function encodeRgbaToUltraHdrJpeg(
  pixels: Uint8Array,
  width: number,
  height: number,
  options: GainMapEncodeOptions = {},
): GainMapEncodeResult {
  const headroom = resolveHeadroom(options);
  const hdrModel = options.hdrModel ?? "highlight";
  const quality = clamp(Number(options.quality ?? 92), 1, 100);
  const sdr =
    options.matte === "checkerboard"
      ? flattenRgbaOntoCheckerboard(pixels, width, height)
      : flattenRgbaOntoWhite(pixels, width, height);
  // Logos use checkerboard matte; pass original alpha so background pixels are not boosted.
  // Photos use white matte; pass null — their all-255 alpha makes behavior bit-identical.
  const alphaMask = options.matte === "checkerboard" ? pixels : null;
  const encoding = encodeKeepBaseGainMap(sdr, width, height, headroom, hdrModel, alphaMask);
  const output = writeJpegGainMap(encoding, { quality, format: "ultrahdr" });
  return {
    output,
    width,
    height,
    headroom,
    note: `Gain map JPEG · ${headroom.toFixed(2)}× · ${width}×${height}`,
  };
}

export function clamp(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min;
  return Math.min(Math.max(value, min), max);
}

function smoothstep(edge0: number, edge1: number, x: number): number {
  const t = clamp((x - edge0) / (edge1 - edge0), 0, 1);
  return t * t * (3 - 2 * t);
}
