#!/usr/bin/env npx tsx
// Gainmaps by Kirk Strobeck – https://gainmaps.com

/**
 * Build Ultra HDR gain map JPEGs and matching SDR siblings for /photos.
 *
 * For every entry in apps/web/lib/photos/catalog.ts:
 *   1. skip if all five Ultra variants (gainmap-400.jpg, gainmap-800.jpg,
 *      gainmap-1280.jpg, gainmap-1600.jpg, gainmap-2048.jpg) already exist under
 *      public/photos/<slug>/ (resume; 2560 is omitted because small landscape
 *      photos won't produce it),
 *   2. download the Unsplash CDN JPEG (long edge capped — see MAX_EDGE),
 *   3. decode to RGBA with sharp,
 *   4. encode via packages/gainmap CLI (boost 1.0 max, highlight model),
 *   5. write gainmap-<w>.jpg and extract standard-<w>.jpg via
 *      `gainmap extract-sdr` into apps/web/public/photos/<slug>/.
 *
 * Both Ultra and Standard siblings are local and share identical dimensions —
 * Standard is the primary JPEG sliced from the gain map file, not a separate
 * Unsplash hotlink. Catalog wiring to these files is a separate step.
 *
 * Run from the repo root:
 *   npx tsx tools/photos/build-photos.ts
 *   npx tsx tools/photos/build-photos.ts --force
 *   npx tsx tools/photos/build-photos.ts --limit=12
 */
import { mkdir, stat } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import sharp from "sharp";

import { PHOTO_WIDTHS, encodeVariants } from "./encode-variants.ts";
import { PHOTOS, type Photo } from "../../apps/web/lib/photos/catalog.ts";

const here = dirname(fileURLToPath(import.meta.url));
const repo = resolve(here, "../..");
const publicRoot = join(repo, "apps/web/public/photos");

const USER_AGENT = "gainmaps-photos/1.0 (https://gainmaps.com; kirk@strobeck.com)";
const BOOST = 1.0;
/** Long edge of the encoded Ultra JPEG. Covers DPR-2 hero at 1440-wide viewports. */
const MAX_EDGE = 2560;
const CONCURRENCY = 2;
const RETRY_STATUSES = new Set([429, 503]);
const MAX_RETRIES = 5;
const RETRY_BASE_MS = 2000;

type Outcome =
  | { readonly ok: true; readonly photo: Photo; readonly note: string; readonly skipped: boolean }
  | { readonly ok: false; readonly photo: Photo; readonly reason: string };

async function main(): Promise<void> {
  const force = process.argv.includes("--force");
  const limit = parseLimit(process.argv);
  const selected = PHOTOS.slice(0, limit);

  console.log(
    `photos: ${selected.length}/${PHOTOS.length}  max-edge=${MAX_EDGE}  boost=${BOOST}  force=${force}`,
  );

  await mkdir(publicRoot, { recursive: true });
  const built = await mapChunked(selected, CONCURRENCY, (photo) => buildOne(photo, force));

  const successes = built.filter((outcome): outcome is Extract<Outcome, { ok: true }> => outcome.ok);
  const generated = successes.filter((outcome) => !outcome.skipped);
  const skipped = successes.filter((outcome) => outcome.skipped);
  const failures = built.filter((outcome): outcome is Extract<Outcome, { ok: false }> => !outcome.ok);

  generated.forEach((outcome) => {
    console.log(`  ok     ${outcome.photo.slug}  ${outcome.note}`);
  });
  skipped.forEach((outcome) => {
    console.log(`  skip   ${outcome.photo.slug}  already on disk`);
  });
  failures.forEach((outcome) => {
    console.log(`  fail   ${outcome.photo.slug}  ${outcome.reason}`);
  });

  console.log("");
  console.log(
    `generated ${generated.length}, skipped ${skipped.length}, failed ${failures.length}`,
  );

  if (failures.length > 0) process.exitCode = 1;
}

async function buildOne(photo: Photo, force: boolean): Promise<Outcome> {
  const directory = join(publicRoot, photo.slug);

  if (!force && (await allVariantsExist(directory))) {
    return { ok: true, photo, note: directory, skipped: true };
  }

  const jpeg = await downloadUnsplash(photo).catch((error: unknown) => errorMessage(error));
  if (typeof jpeg === "string") return { ok: false, photo, reason: jpeg };

  const raster = await rasterize(jpeg).catch((error: unknown) => errorMessage(error));
  if (typeof raster === "string") return { ok: false, photo, reason: `decode failed — ${raster}` };

  await encodeVariants(raster.pixels, raster.width, raster.height, directory, BOOST);
  return { ok: true, photo, note: `${raster.width}×${raster.height} → ${PHOTO_WIDTHS.join("/")}w`, skipped: false };
}

async function allVariantsExist(directory: string): Promise<boolean> {
  // 2560 is omitted: small landscape photos won't produce a 2560 file (source too small).
  const names = ["gainmap-400.jpg", "gainmap-800.jpg", "gainmap-1280.jpg", "gainmap-1600.jpg", "gainmap-2048.jpg"];
  const checks = await Promise.all(names.map((n) => exists(join(directory, n))));
  return checks.every(Boolean);
}

async function downloadUnsplash(photo: Photo, attempt = 0): Promise<Buffer> {
  const url = `https://images.unsplash.com/${photo.unsplashPhotoId}?auto=format&fit=max&w=${MAX_EDGE}&q=90`;
  const response = await fetch(url, {
    headers: { "User-Agent": USER_AGENT, Accept: "image/jpeg,image/*,*/*" },
  });
  if (RETRY_STATUSES.has(response.status) && attempt < MAX_RETRIES) {
    await sleep(retryDelay(response, attempt));
    return downloadUnsplash(photo, attempt + 1);
  }
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return Buffer.from(await response.arrayBuffer());
}

async function rasterize(
  jpeg: Buffer,
): Promise<{ pixels: Uint8Array; width: number; height: number }> {
  const { data, info } = await sharp(jpeg)
    .rotate()
    .resize({
      width: MAX_EDGE,
      height: MAX_EDGE,
      fit: "inside",
      withoutEnlargement: true,
    })
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  if (info.channels !== 4) throw new Error(`expected RGBA, got ${info.channels} channels`);
  return {
    pixels: new Uint8Array(data.buffer, data.byteOffset, data.byteLength),
    width: info.width,
    height: info.height,
  };
}

async function exists(path: string): Promise<boolean> {
  const info = await stat(path).catch(() => undefined);
  return Boolean(info && info.isFile() && info.size > 1024);
}

function parseLimit(argv: readonly string[]): number {
  const flag = argv.find((arg) => arg.startsWith("--limit="));
  if (!flag) return PHOTOS.length;
  const value = Number(flag.slice("--limit=".length));
  if (!Number.isFinite(value) || value < 1) return PHOTOS.length;
  return Math.min(Math.floor(value), PHOTOS.length);
}

function retryDelay(response: Response, attempt: number): number {
  const header = Number(response.headers.get("retry-after"));
  if (Number.isFinite(header) && header > 0) return Math.min(header, 60) * 1000;
  return RETRY_BASE_MS * 2 ** attempt;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function chunk<T>(items: readonly T[], size: number): readonly (readonly T[])[] {
  return Array.from({ length: Math.ceil(items.length / size) }, (_, index) =>
    items.slice(index * size, index * size + size),
  );
}

async function mapChunked<T, R>(
  items: readonly T[],
  size: number,
  fn: (item: T) => Promise<R>,
): Promise<readonly R[]> {
  return chunk(items, size).reduce<Promise<readonly R[]>>(
    async (previous, group) => [...(await previous), ...(await Promise.all(group.map(fn)))],
    Promise.resolve([]),
  );
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

await main();
