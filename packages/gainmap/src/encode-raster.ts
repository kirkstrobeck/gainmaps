import sharp from "sharp";

import { flattenRgbaOntoWhite } from "#src/encode.js";

export type RasterEncodeResult = {
  readonly output: Uint8Array;
  readonly note: string;
};

export async function encodeRgbaToRaster(
  pixels: Uint8Array,
  width: number,
  height: number,
  type: string,
  quality?: number,
): Promise<RasterEncodeResult> {
  if (type === "gif") return encodeGif(pixels, width, height);
  if (type === "png") return encodePng(pixels, width, height);
  if (type === "webp") return encodeWebp(pixels, width, height, quality);
  if (type === "avif") return encodeAvif(pixels, width, height, quality);
  if (type === "tif" || type === "tiff") return encodeTiff(pixels, width, height, type);
  throw new Error("--out-type must be one of: jpg, jpeg, png, webp, avif, tif, tiff, gif");
}

async function encodeGif(
  pixels: Uint8Array,
  width: number,
  height: number,
): Promise<RasterEncodeResult> {
  const flat = flattenRgbaOntoWhite(pixels, width, height);
  const buffer = await sharp(Buffer.from(flat), { raw: { width, height, channels: 4 } })
    .gif()
    .toBuffer();
  return { output: new Uint8Array(buffer), note: "GIF" };
}

async function encodePng(
  pixels: Uint8Array,
  width: number,
  height: number,
): Promise<RasterEncodeResult> {
  const buffer = await rawPipeline(pixels, width, height).png().toBuffer();
  return { output: new Uint8Array(buffer), note: "PNG" };
}

async function encodeWebp(
  pixels: Uint8Array,
  width: number,
  height: number,
  quality: number | undefined,
): Promise<RasterEncodeResult> {
  const buffer = await rawPipeline(pixels, width, height)
    .webp({ quality: quality ?? 92 })
    .toBuffer();
  return { output: new Uint8Array(buffer), note: "WEBP" };
}

async function encodeAvif(
  pixels: Uint8Array,
  width: number,
  height: number,
  quality: number | undefined,
): Promise<RasterEncodeResult> {
  const buffer = await rawPipeline(pixels, width, height)
    .avif({ quality: quality ?? 92 })
    .toBuffer();
  return { output: new Uint8Array(buffer), note: "AVIF" };
}

async function encodeTiff(
  pixels: Uint8Array,
  width: number,
  height: number,
  type: string,
): Promise<RasterEncodeResult> {
  const buffer = await rawPipeline(pixels, width, height).tiff().toBuffer();
  return { output: new Uint8Array(buffer), note: type.toUpperCase() };
}

function rawPipeline(pixels: Uint8Array, width: number, height: number) {
  return sharp(Buffer.from(pixels), { raw: { width, height, channels: 4 } });
}

export default async function Base(
  pixels: Uint8Array,
  width: number,
  height: number,
  type: string,
  quality?: number,
): Promise<RasterEncodeResult> {
  return encodeRgbaToRaster(pixels, width, height, type, quality);
}
