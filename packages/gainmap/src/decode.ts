import decodeHeic from "heic-decode";
import sharp from "sharp";

export type RasterImage = {
  readonly width: number;
  readonly height: number;
  readonly pixels: Uint8Array;
};

export type ImageFormat =
  | "png"
  | "jpeg"
  | "gif"
  | "webp"
  | "avif"
  | "heic"
  | "tiff"
  | "svg"
  | "unknown";

export const DEFAULT_EXTENSIONS = [
  "jpg", "jpeg", "png", "webp", "avif", "gif", "tif", "tiff", "svg", "heic", "heif", "mp4",
] as const;

const PNG = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a] as const;
const MIN_SVG_EDGE = 1024;
const MAX_SVG_EDGE = 4096;

export function detectFormat(input: Uint8Array, hint = ""): ImageFormat {
  if (startsWith(input, PNG)) return "png";
  if (input.length >= 2 && input[0] === 0xff && input[1] === 0xd8) return "jpeg";
  if (startsWithAscii(input, "GIF8")) return "gif";
  if (startsWithAscii(input, "RIFF") && asciiAt(input, 8, 4) === "WEBP") return "webp";
  if (isFtyp(input, ["avif", "avis"])) return "avif";
  if (isFtyp(input, ["heic", "heif", "mif1", "msf1"])) return "heic";
  if (isTiff(input)) return "tiff";
  if (looksLikeSvg(input)) return "svg";
  return formatFromHint(hint);
}

export function formatFromHint(hint: string): ImageFormat {
  const ext = hint.toLowerCase().replace(/^.*\./, "");
  if (ext === "jpg" || ext === "jpeg") return "jpeg";
  if (ext === "png") return "png";
  if (ext === "gif") return "gif";
  if (ext === "webp") return "webp";
  if (ext === "avif") return "avif";
  if (ext === "heic" || ext === "heif") return "heic";
  if (ext === "tif" || ext === "tiff") return "tiff";
  if (ext === "svg") return "svg";
  return "unknown";
}

export function isSupportedFormat(format: ImageFormat): boolean {
  return format !== "unknown";
}

export async function decodeImage(
  input: Uint8Array,
  hint = "",
  maxSize?: number,
): Promise<RasterImage> {
  const format = detectFormat(input, hint);
  if (format === "unknown") throw new Error("Unsupported image type");
  if (format === "heic") return decodeHeicRaster(input, maxSize);
  return decodeWithSharp(input, format, maxSize);
}

async function decodeHeicRaster(input: Uint8Array, maxSize?: number): Promise<RasterImage> {
  const copy = new Uint8Array(input);
  const decoded = await decodeHeic({ buffer: copy.buffer });
  const pixels = new Uint8Array(decoded.data);
  if (maxSize == null) return { width: decoded.width, height: decoded.height, pixels };
  return resizeRgba(pixels, decoded.width, decoded.height, maxSize);
}

async function decodeWithSharp(input: Uint8Array, format: ImageFormat, maxSize?: number): Promise<RasterImage> {
  const pipeline = sharp(input, sharpOptions(format)).ensureAlpha();
  const sized = maxSize == null ? pipeline : pipeline.resize({
    width: maxSize,
    height: maxSize,
    fit: "inside",
    withoutEnlargement: true,
  });
  const { data, info } = await sized.raw().toBuffer({ resolveWithObject: true });
  return { width: info.width, height: info.height, pixels: new Uint8Array(data) };
}

function sharpOptions(format: ImageFormat): NonNullable<Parameters<typeof sharp>[1]> {
  if (format === "gif") return { animated: false, pages: 1, failOn: "none" };
  if (format === "svg") return { density: 144, failOn: "none" };
  return { failOn: "none" };
}

async function resizeRgba(pixels: Uint8Array, width: number, height: number, maxSize: number): Promise<RasterImage> {
  const { data, info } = await sharp(pixels, { raw: { width, height, channels: 4 } })
    .resize({ width: maxSize, height: maxSize, fit: "inside", withoutEnlargement: true })
    .raw()
    .toBuffer({ resolveWithObject: true });
  return { width: info.width, height: info.height, pixels: new Uint8Array(data) };
}

function startsWith(input: Uint8Array, magic: readonly number[]): boolean {
  if (input.length < magic.length) return false;
  return magic.every((byte, index) => input[index] === byte);
}

function startsWithAscii(input: Uint8Array, text: string): boolean {
  return asciiAt(input, 0, text.length) === text;
}

function asciiAt(input: Uint8Array, start: number, length: number): string {
  if (input.length < start + length) return "";
  return String.fromCharCode(...input.slice(start, start + length));
}

function isFtyp(input: Uint8Array, brands: readonly string[]): boolean {
  if (asciiAt(input, 4, 4) !== "ftyp") return false;
  const brand = asciiAt(input, 8, 4);
  return brands.includes(brand);
}

function isTiff(input: Uint8Array): boolean {
  if (input.length < 4) return false;
  const le = input[0] === 0x49 && input[1] === 0x49 && input[2] === 0x2a && input[3] === 0x00;
  const be = input[0] === 0x4d && input[1] === 0x4d && input[2] === 0x00 && input[3] === 0x2a;
  return le || be;
}

function looksLikeSvg(input: Uint8Array): boolean {
  const head = new TextDecoder("utf8", { fatal: false }).decode(input.slice(0, 256)).trimStart();
  return head.startsWith("<svg") || head.startsWith("<?xml");
}

export function clampSvgEdge(width: number, height: number): { width: number; height: number } {
  const long = Math.max(width, height);
  if (long <= 0) return { width: MIN_SVG_EDGE, height: MIN_SVG_EDGE };
  if (long < MIN_SVG_EDGE) {
    const scale = MIN_SVG_EDGE / long;
    return { width: Math.round(width * scale), height: Math.round(height * scale) };
  }
  if (long > MAX_SVG_EDGE) {
    const scale = MAX_SVG_EDGE / long;
    return { width: Math.round(width * scale), height: Math.round(height * scale) };
  }
  return { width, height };
}
