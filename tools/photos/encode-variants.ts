// Gainmaps by Kirk Strobeck – https://gainmaps.com

/**
 * Encode Ultra HDR gain map JPEGs at multiple widths from a single RGBA buffer.
 *
 * Called by build-photos.ts after rasterising at max edge. Produces:
 *   gainmap-400.jpg   — thumbnail / narrow viewport
 *   gainmap-800.jpg   — mid-size
 *   gainmap-1280.jpg  — full size
 *   gainmap-1600.jpg  — large desktop / DPR-2 gallery
 *   gainmap-2048.jpg  — high-DPR desktop
 *   gainmap-2560.jpg  — max (DPR-2 hero at 1440-wide viewport)
 *   standard-400.jpg  — SDR primary extracted via `gainmap extract-sdr`
 *   standard-800.jpg
 *   standard-1280.jpg
 *   standard-1600.jpg
 *   standard-2048.jpg
 *   standard-2560.jpg
 *
 * Shells out to packages/gainmap/dist/cli.js so the encode and SDR extract paths
 * match what the published CLI delivers to end users.
 */
import { execFileSync } from "node:child_process";
import { mkdirSync, writeFileSync, copyFileSync } from "node:fs";
import { join, resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { tmpdir } from "node:os";

import sharp from "sharp";

export const PHOTO_WIDTHS = [400, 800, 1280, 1600, 2048, 2560] as const;
type PhotoWidth = (typeof PHOTO_WIDTHS)[number];

/** Lower quality for smaller variants to save more bytes; full quality at max. */
const QUALITY: Record<PhotoWidth, number> = { 400: 75, 800: 80, 1280: 90, 1600: 85, 2048: 88, 2560: 90 };

const here = dirname(fileURLToPath(import.meta.url));
const CLI = resolve(here, "../../packages/gainmap/dist/cli.js");

async function resizeRgba(
  pixels: Uint8Array,
  srcWidth: number,
  srcHeight: number,
  targetWidth: number,
): Promise<{ pixels: Uint8Array; width: number; height: number }> {
  const input = Buffer.from(pixels.buffer, pixels.byteOffset, pixels.byteLength);
  const { data, info } = await sharp(input, {
    raw: { width: srcWidth, height: srcHeight, channels: 4 },
  })
    .resize({ width: targetWidth, fit: "inside", withoutEnlargement: true })
    .raw()
    .toBuffer({ resolveWithObject: true });
  return {
    pixels: new Uint8Array(data.buffer, data.byteOffset, data.byteLength),
    width: info.width,
    height: info.height,
  };
}

/**
 * Encode and write gain map JPEGs at each PHOTO_WIDTHS breakpoint into outDir.
 *
 * @param pixels  Raw RGBA at srcWidth × srcHeight (from rasterize()).
 * @param boost   HDR boost level — use the same constant as the caller.
 */
export async function encodeVariants(
  pixels: Uint8Array,
  srcWidth: number,
  srcHeight: number,
  outDir: string,
  boost: number = 1.0,
): Promise<void> {
  mkdirSync(outDir, { recursive: true });

  const resized = await Promise.all(
    PHOTO_WIDTHS.map((w) =>
      resizeRgba(pixels, srcWidth, srcHeight, w).then((r) => ({ ...r, targetW: w })),
    ),
  );

  const tmp = tmpdir();

  for (const { pixels: px, width, height, targetW } of resized) {
    if (Math.max(width, height) < targetW) continue; // source too small; skip this breakpoint
    const quality = QUALITY[targetW as PhotoWidth];

    // Write resized RGBA as a temporary JPEG for the CLI to consume.
    const tmpJpeg = join(tmp, `gainmap-tmp-${targetW}-${Date.now()}.jpg`);
    const tmpOut = join(tmp, `gainmap-out-${targetW}-${Date.now()}.jpg`);
    const buf = Buffer.from(px.buffer, px.byteOffset, px.byteLength);
    const jpegBuf = await sharp(buf, { raw: { width, height, channels: 4 } })
      .jpeg({ quality: 100 })
      .toBuffer();
    writeFileSync(tmpJpeg, jpegBuf);

    execFileSync(process.execPath, [
      CLI,
      tmpJpeg,
      "-o", tmpOut,
      "--boost", String(boost),
      "--quality", String(quality),
      "--matte", "white",
      "--force",
      "--no-update-check",
    ]);

    const tmpSdr = join(tmp, `gainmap-sdr-${targetW}-${Date.now()}.jpg`);
    execFileSync(process.execPath, [
      CLI,
      "extract-sdr",
      tmpOut,
      "-o", tmpSdr,
      "--force",
      "--no-update-check",
    ]);

    const dest = join(outDir, `gainmap-${targetW}.jpg`);
    copyFileSync(tmpOut, dest);
    copyFileSync(tmpSdr, join(outDir, `standard-${targetW}.jpg`));
  }
}
