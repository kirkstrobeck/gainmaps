import { decompressFrames, parseGIF, type ParsedFrame } from "gifuct-js";
import decodeHeic from "heic-decode";
import UPNG from "upng-js";

import { encodeRgbaToUltraHdrJpeg } from "../lib/gain-map-encode";
import { outputName } from "../lib/output-name";

type ImageFormat = "png" | "jpeg" | "gif" | "heic" | "webp" | "avif" | "bitmap";
type ProgressMessage = {
  type: "progress" | "done" | "error";
  progress?: number;
  phase?: string;
  blob?: Blob;
  name?: string;
  bytesIn?: number;
  bytesOut?: number;
  note?: string;
  error?: string;
};
type PostProgress = (message: ProgressMessage) => void;
type ProcessOptions = {
  boost?: number;
};
type ProcessJobData = {
  type: "PROCESS_IMAGE";
  id: string;
  file: File;
  options: ProcessOptions;
};
type ProcessResult = {
  output: Uint8Array;
  note: string;
};
type RasterImage = {
  width: number;
  height: number;
  pixels: Uint8Array;
};
type GifDims = {
  left: number;
  top: number;
  width: number;
  height: number;
};
type ExtendableWorkerEvent = {
  waitUntil: (promise: Promise<unknown>) => void;
};
type WorkerMessageEvent = ExtendableWorkerEvent & {
  ports: readonly MessagePort[];
  data: unknown;
};
type HdrWorkerScope = {
  skipWaiting: () => Promise<void>;
  clients: { claim: () => Promise<void> };
  addEventListener: {
    (type: "install" | "activate", listener: (event: ExtendableWorkerEvent) => void): void;
    (type: "message", listener: (event: WorkerMessageEvent) => void): void;
  };
};

const scope = self as unknown as HdrWorkerScope;
const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a] as const;

scope.addEventListener("install", (event) => {
  event.waitUntil(scope.skipWaiting());
});

scope.addEventListener("activate", (event) => {
  event.waitUntil(scope.clients.claim());
});

scope.addEventListener("message", (event) => {
  const port = event.ports[0];
  const data = event.data as ProcessJobData | undefined;
  if (!port || data?.type !== "PROCESS_IMAGE") return;
  event.waitUntil(processJob(data, port));
});

async function processJob(data: ProcessJobData, port: MessagePort): Promise<void> {
  const { id, file, options } = data;
  const started = Date.now();
  const post: PostProgress = (message) =>
    port.postMessage({ id, elapsedMs: Date.now() - started, ...message });

  try {
    post({ type: "progress", progress: 4, phase: "Reading file" });
    const input = new Uint8Array(await file.arrayBuffer());
    const boost = clamp(Number(options.boost ?? 0.5), 0, 1);
    const format = detectFormat(input, file);

    post({ type: "progress", progress: 18, phase: "Inspecting container" });
    const processed = await processGainMapPhoto({
      input,
      file,
      format,
      boost,
      post,
    });

    post({
      type: "done",
      progress: 100,
      phase: "Complete",
      blob: new Blob([toArrayBuffer(processed.output)], { type: "image/jpeg" }),
      name: outputName(file.name).name,
      bytesIn: input.byteLength,
      bytesOut: processed.output.byteLength,
      note: processed.note,
    });
  } catch (error) {
    post({
      type: "error",
      progress: 100,
      phase: "Failed",
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

/**
 * Photo path: keep the original as the SDR base, then embed a highlight-selective
 * gain map so HDR displays lift bright regions without a global EV wash.
 */
async function processGainMapPhoto(args: {
  input: Uint8Array;
  file: File;
  format: ImageFormat;
  boost: number;
  post: PostProgress;
}): Promise<ProcessResult> {
  const { file, format, boost, post } = args;

  post({ type: "progress", progress: 28, phase: "Rasterizing photo" });
  const raster = await rasterizePhotoRgba(file, format, args.input);

  post({
    type: "progress",
    progress: 48,
    phase: "Building gain map",
  });
  const out = outputName(file.name);
  const writePhase = out.converted
    ? `Writing gain map JPEG (converted from ${out.fromLabel})`
    : `Writing gain map ${out.ext.slice(1).toUpperCase()}`;
  post({ type: "progress", progress: 84, phase: writePhase });
  const encoded = encodeRgbaToUltraHdrJpeg(raster.pixels, raster.width, raster.height, { boost });

  return {
    output: encoded.output,
    note: encoded.note,
  };
}

async function rasterizePhotoRgba(
  file: File,
  format: ImageFormat,
  input: Uint8Array,
): Promise<RasterImage> {
  if (format === "heic") {
    const decoded = await decodeHeic({ buffer: input });
    if (!decoded?.width || !decoded?.height || !decoded?.data) {
      throw new Error("HEIC did not produce decodable RGBA pixels.");
    }
    return {
      width: decoded.width,
      height: decoded.height,
      pixels: new Uint8Array(decoded.data),
    };
  }

  if (format === "png") {
    const decoded = decodePngFrames(input);
    return {
      width: decoded.width,
      height: decoded.height,
      pixels: new Uint8Array(decoded.frames[0]!),
    };
  }

  if (format === "gif") {
    const decoded = decodeGifFrames(input);
    return {
      width: decoded.width,
      height: decoded.height,
      pixels: new Uint8Array(decoded.frames[0]!),
    };
  }

  return rasterizeToRgba(file);
}

function detectFormat(bytes: Uint8Array, file: File): ImageFormat {
  if (starts(bytes, PNG_SIGNATURE)) return "png";
  if (bytes[0] === 0xff && bytes[1] === 0xd8) return "jpeg";
  if (startsAscii(bytes, "GIF87a") || startsAscii(bytes, "GIF89a")) return "gif";
  if (file.type === "image/heic" || file.type === "image/heif" || /\.(heic|heif)$/i.test(file.name)) {
    return "heic";
  }
  if (file.type === "image/webp") return "webp";
  if (file.type === "image/avif") return "avif";
  return "bitmap";
}

function starts(bytes: Uint8Array, signature: readonly number[]): boolean {
  return signature.every((byte, index) => bytes[index] === byte);
}

function startsAscii(bytes: Uint8Array, value: string): boolean {
  return [...value].every((char, index) => bytes[index] === char.charCodeAt(0));
}

function clamp(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min;
  return Math.min(Math.max(value, min), max);
}

async function rasterizeToRgba(file: File): Promise<RasterImage> {
  if (!("createImageBitmap" in scope) || !("OffscreenCanvas" in scope)) {
    throw new Error("This browser cannot rasterize this format inside a service worker.");
  }
  const bitmap = await createImageBitmap(file);
  const canvas = new OffscreenCanvas(bitmap.width, bitmap.height);
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Could not create a service-worker canvas.");
  context.drawImage(bitmap, 0, 0);
  const imageData = context.getImageData(0, 0, bitmap.width, bitmap.height);
  bitmap.close();
  return {
    width: imageData.width,
    height: imageData.height,
    pixels: new Uint8Array(imageData.data),
  };
}

function decodePngFrames(input: Uint8Array): {
  width: number;
  height: number;
  frames: ArrayBuffer[];
} {
  const decoded = UPNG.decode(toArrayBuffer(input));
  const frames = UPNG.toRGBA8(decoded);
  return {
    width: decoded.width,
    height: decoded.height,
    frames,
  };
}

function decodeGifFrames(input: Uint8Array): {
  width: number;
  height: number;
  frames: ArrayBuffer[];
} {
  const parsed = parseGIF(toArrayBuffer(input));
  const frames = decompressFrames(parsed, true);
  const width = parsed.lsd.width;
  const height = parsed.lsd.height;
  if (!width || !height) throw new Error("GIF is missing logical screen dimensions.");

  const canvas = new Uint8ClampedArray(width * height * 4);
  const frame = frames[0];
  if (!frame) throw new Error("GIF did not contain decodable frames.");
  drawGifPatch(canvas, width, height, frame);
  return {
    width,
    height,
    frames: [toArrayBuffer(new Uint8Array(canvas))],
  };
}

function drawGifPatch(
  canvas: Uint8ClampedArray,
  canvasWidth: number,
  canvasHeight: number,
  frame: ParsedFrame,
): void {
  const dims = frame.dims as GifDims;
  const patch = frame.patch;
  for (let row = 0; row < dims.height; row += 1) {
    for (let col = 0; col < dims.width; col += 1) {
      const source = (row * dims.width + col) * 4;
      const alpha = patch[source + 3] ?? 0;
      if (alpha === 0) continue;
      const x = dims.left + col;
      const y = dims.top + row;
      if (x < 0 || y < 0 || x >= canvasWidth || y >= canvasHeight) continue;
      const target = (y * canvasWidth + x) * 4;
      canvas[target] = patch[source] ?? 0;
      canvas[target + 1] = patch[source + 1] ?? 0;
      canvas[target + 2] = patch[source + 2] ?? 0;
      canvas[target + 3] = alpha;
    }
  }
}

function toArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  const copy = new Uint8Array(bytes.byteLength);
  copy.set(bytes);
  return copy.buffer;
}
