// Gainmaps by Kirk Strobeck – https://gainmaps.com

/**
 * Encode Ultra HDR gain map JPEGs at multiple widths for logo assets.
 *
 * Logos render in small square tiles (card ~160px, detail ~240px), so four
 * breakpoints spanning the 1024px source canvas cover every device:
 *   logo-gainmap-128.jpg  — retina-card / thumbnail
 *   logo-gainmap-256.jpg  — 2× card / 1× detail
 *   logo-gainmap-512.jpg  — full SDR equivalent
 *   logo-gainmap-1024.jpg — max (DPR-2 at 512px tile)
 *   logo-gainmap.jpg      — alias for logo-gainmap-1024.jpg (backward compat)
 *
 * Shells out to packages/gainmap/dist/cli.js so the encode path matches what
 * the published CLI delivers to end users.
 */
import { execFileSync } from "node:child_process";
import { mkdirSync, writeFileSync, copyFileSync } from "node:fs";
import { join, resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { tmpdir } from "node:os";

import sharp from "sharp";

export const LOGO_WIDTHS = [128, 256, 512, 1024] as const;
type LogoWidth = (typeof LOGO_WIDTHS)[number];

/** Lower quality for smaller variants; full quality at source size. */
const QUALITY: Record<LogoWidth, number> = { 128: 75, 256: 80, 512: 90, 1024: 90 };

const here = dirname(fileURLToPath(import.meta.url));
const CLI = resolve(here, "../../packages/gainmap/dist/cli.js");

async function resizeRgbaSquare(
  pixels: Uint8Array,
  srcSize: number,
  targetSize: number,
): Promise<Uint8Array> {
  const input = Buffer.from(pixels.buffer, pixels.byteOffset, pixels.byteLength);
  const { data } = await sharp(input, {
    raw: { width: srcSize, height: srcSize, channels: 4 },
  })
    .resize({ width: targetSize, height: targetSize, fit: "fill" })
    .raw()
    .toBuffer({ resolveWithObject: true });
  return new Uint8Array(data.buffer, data.byteOffset, data.byteLength);
}

/**
 * Encode and write logo gain map JPEGs at each LOGO_WIDTHS breakpoint into outDir.
 *
 * @param pixels  Raw RGBA at canvas×canvas (always square from build-logos rasterize).
 * @param canvas  Source canvas size in pixels (512 in the current pipeline).
 * @param boost   HDR boost level — use the same constant as the caller.
 */
export async function encodeLogoVariants(
  pixels: Uint8Array,
  canvas: number,
  outDir: string,
  boost: number = 1.0,
): Promise<void> {
  mkdirSync(outDir, { recursive: true });

  const resized = await Promise.all(
    LOGO_WIDTHS.map((w) =>
      (w === canvas
        ? Promise.resolve(pixels)
        : resizeRgbaSquare(pixels, canvas, w)
      ).then((px) => ({ px, w })),
    ),
  );

  const tmp = tmpdir();

  for (const { px, w } of resized) {
    const quality = QUALITY[w as LogoWidth];

    // Write resized RGBA as a temporary PNG for the CLI to consume (PNG keeps alpha).
    const tmpJpeg = join(tmp, `logo-tmp-${w}-${Date.now()}.png`);
    const tmpOut = join(tmp, `logo-out-${w}-${Date.now()}.jpg`);
    const buf = Buffer.from(px.buffer, px.byteOffset, px.byteLength);
    const jpegBuf = await sharp(buf, { raw: { width: w, height: w, channels: 4 } })
      .png()
      .toBuffer();
    writeFileSync(tmpJpeg, jpegBuf);

    execFileSync(process.execPath, [
      CLI,
      tmpJpeg,
      "-o", tmpOut,
      "--boost", String(boost),
      "--quality", String(quality),
      "--matte", "checkerboard",
      "--force",
      "--no-update-check",
    ]);

    const dest = join(outDir, `logo-gainmap-${w}.jpg`);
    copyFileSync(tmpOut, dest);
    if (w === 1024) {
      copyFileSync(tmpOut, join(outDir, "logo-gainmap.jpg"));
    }
  }
}
