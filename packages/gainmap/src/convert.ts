import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
import { dirname, extname } from "node:path";

import { decodeImage } from "#src/decode.js";
import { encodeRgbaToUltraHdrJpeg } from "#src/encode.js";
import { encodeRgbaToRaster } from "#src/encode-raster.js";
import { convertMp4Plan, isVideoPlan, type VideoRunner } from "#src/video.js";
import {
  assertJpegOutputPath,
  isJpegTypeFamily,
  typeFromOutputPath,
} from "#src/output-path.js";

type OutputPlan = { readonly input: string; readonly output: string | null; readonly stdout: boolean };

export type ConvertOptions = {
  readonly boost?: number;
  readonly headroom?: number;
  readonly quality?: number;
  readonly hdrModel?: "highlight" | "window";
  readonly matte?: "white" | "checkerboard";
  readonly dryRun: boolean;
  readonly force: boolean;
  readonly maxSize?: number;
  readonly quiet: boolean;
  readonly verbose: boolean;
  readonly continueOnError: boolean;
  readonly jobs: number;
  readonly videoRunner?: VideoRunner;
};

export type ConvertResult = {
  readonly input: string;
  readonly output: string | null;
  readonly skipped: boolean;
  readonly bytesOut: number;
  readonly note: string;
};

export function formatError(error: unknown): string {
  if (error instanceof Error) return error.message;
  return String(error);
}

export async function convertPlans(
  plans: readonly OutputPlan[],
  options: ConvertOptions,
  stdinBytes?: Uint8Array,
  writeStdout: (bytes: Uint8Array) => void = (bytes) => { process.stdout.write(bytes); },
  log: (message: string) => void = (message) => { process.stderr.write(message + String.fromCharCode(10)); },
): Promise<{ readonly results: readonly ConvertResult[]; readonly failures: number }> {
  const batches = await mapLimit(plans, options.jobs, (plan, index) =>
    convertOne(plan, options, stdinBytes, writeStdout, (message) => {
      if (options.quiet) return;
      if (plans.length > 1) {
        log(progress(index + 1, plans.length, message));
        return;
      }
      log(message);
    }),
  );
  return { results: batches.map((item) => item.result), failures: batches.filter((item) => item.failed).length };
}

async function convertOne(
  plan: OutputPlan,
  options: ConvertOptions,
  stdinBytes: Uint8Array | undefined,
  writeStdout: (bytes: Uint8Array) => void,
  log: (message: string) => void,
): Promise<{ readonly result: ConvertResult; readonly failed: boolean }> {
  try {
    const result = await convertPlan(plan, options, stdinBytes, writeStdout, log);
    return { result, failed: false };
  } catch (error) {
    const message = formatError(error);
    if (!options.continueOnError) throw error;
    log("error: " + plan.input + ": " + message);
    return {
      result: { input: plan.input, output: plan.output, skipped: true, bytesOut: 0, note: message },
      failed: true,
    };
  }
}

export async function convertPlan(
  plan: OutputPlan,
  options: ConvertOptions,
  stdinBytes: Uint8Array | undefined,
  writeStdout: (bytes: Uint8Array) => void,
  log: (message: string) => void,
): Promise<ConvertResult> {
  if (isVideoPlan(plan)) return convertMp4Plan(plan, options, log);
  if (plan.output != null && !options.force && !options.dryRun && (await exists(plan.output))) {
    log("skip (exists, pass -f to overwrite) " + plan.input + " -> " + plan.output);
    return { input: plan.input, output: plan.output, skipped: true, bytesOut: 0, note: "exists" };
  }
  if (options.dryRun) {
    const dest = plan.stdout ? "-" : plan.output;
    log(plan.input + " -> " + dest);
    return { input: plan.input, output: plan.output, skipped: false, bytesOut: 0, note: "dry-run" };
  }
  const inputBytes = await inputBytesFor(plan.input, stdinBytes);
  const raster = await decodeImage(inputBytes, plan.input, options.maxSize);
  if (usesGainMapEncoder(plan)) {
    return writeGainMap(plan, options, raster, writeStdout, log);
  }
  return writeRaster(plan, options, raster, log);
}

function usesGainMapEncoder(plan: OutputPlan): boolean {
  if (plan.stdout) return true;
  if (plan.output == null) return true;
  const type = typeFromOutputPath(plan.output);
  if (type == null) return true;
  return isJpegTypeFamily(type);
}

async function writeGainMap(
  plan: OutputPlan,
  options: ConvertOptions,
  raster: { readonly pixels: Uint8Array; readonly width: number; readonly height: number },
  writeStdout: (bytes: Uint8Array) => void,
  log: (message: string) => void,
): Promise<ConvertResult> {
  const encoded = encodeRgbaToUltraHdrJpeg(raster.pixels, raster.width, raster.height, options);
  const outExt = plan.output != null ? extname(plan.output) : "";
  const extLabel = outExt ? outExt.slice(1).toUpperCase() : "";
  const note = extLabel ? encoded.note.replace(/^Gain map JPEG\b/, `Gain map ${extLabel}`) : encoded.note;
  if (plan.stdout) {
    writeStdout(encoded.output);
    return { input: plan.input, output: null, skipped: false, bytesOut: encoded.output.byteLength, note };
  }
  assertJpegOutputPath(plan.output!);
  await mkdir(dirname(plan.output!), { recursive: true });
  await writeFile(plan.output!, encoded.output);
  const inExt = extname(plan.input).toLowerCase();
  const wasConverted = inExt !== ".jpg" && inExt !== ".jpeg";
  if (wasConverted) {
    log(plan.input + " -> " + plan.output + " (gain maps require a JPEG container; output written as .jpg)");
  }
  if (!wasConverted) {
    log(plan.input + " -> " + plan.output);
  }
  return { input: plan.input, output: plan.output, skipped: false, bytesOut: encoded.output.byteLength, note };
}

async function writeRaster(
  plan: OutputPlan,
  options: ConvertOptions,
  raster: { readonly pixels: Uint8Array; readonly width: number; readonly height: number },
  log: (message: string) => void,
): Promise<ConvertResult> {
  const type = typeFromOutputPath(plan.output!)!;
  const encoded = await encodeRgbaToRaster(
    raster.pixels,
    raster.width,
    raster.height,
    type,
    options.quality,
  );
  await mkdir(dirname(plan.output!), { recursive: true });
  await writeFile(plan.output!, encoded.output);
  log(plan.input + " -> " + plan.output);
  return {
    input: plan.input,
    output: plan.output,
    skipped: false,
    bytesOut: encoded.output.byteLength,
    note: encoded.note,
  };
}

async function exists(path: string): Promise<boolean> {
  try {
    await stat(path);
    return true;
  } catch {
    return false;
  }
}

async function inputBytesFor(input: string, stdinBytes: Uint8Array | undefined): Promise<Uint8Array> {
  if (input !== "-") return new Uint8Array(await readFile(input));
  if (stdinBytes == null) throw new Error("stdin is empty");
  return stdinBytes;
}

function progress(index: number, total: number, message: string): string {
  return index + "/" + total + " " + message;
}

async function mapLimit<T, R>(
  items: readonly T[],
  limit: number,
  fn: (item: T, index: number) => Promise<R>,
): Promise<readonly R[]> {
  if (items.length === 0) return [];
  const concurrency = Math.max(1, limit);
  const batch = items.slice(0, concurrency);
  const rest = items.slice(concurrency);
  const done = await Promise.all(batch.map((item, index) => fn(item, index)));
  const more = await mapLimit(rest, concurrency, (item, index) => fn(item, index + batch.length));
  return [...done, ...more];
}
