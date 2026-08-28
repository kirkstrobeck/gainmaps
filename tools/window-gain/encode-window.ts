#!/usr/bin/env npx tsx
/**
 * Encode fixtures/window/window.jpeg with the calibrated keep-base Ultra HDR
 * path and write a JPEG for tools/window-gain/compare-hdr.
 */
import { execFileSync } from "node:child_process";
import { createRequire } from "node:module";
import { mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { encodeRgbaToUltraHdrJpeg } from "../../apps/web/lib/gain-map-encode.ts";

const require = createRequire(import.meta.url);
const here = dirname(fileURLToPath(import.meta.url));
const repo = resolve(here, "../..");
const outDir = join(repo, "tmp-window-gain");
const outJpeg = join(outDir, "window-from-jpeg-calibrated.jpg");
const sourceJpeg = join(repo, "fixtures/window/window.jpeg");
const pngScratch = join(outDir, "window-source.png");

function loadUpng(): {
  decode: (buf: ArrayBuffer) => { width: number; height: number };
  toRGBA8: (img: { width: number; height: number }) => ArrayBuffer[];
} {
  try {
    return require(join(repo, "apps/web/node_modules/upng-js"));
  } catch {
    const pnpm = join(repo, "node_modules/.pnpm");
    const dir = readdirSync(pnpm).find((name) => name.startsWith("upng-js@"));
    if (!dir) throw new Error("upng-js not found");
    return require(join(pnpm, dir, "node_modules/upng-js"));
  }
}

mkdirSync(outDir, { recursive: true });
execFileSync("sips", ["-s", "format", "png", sourceJpeg, "--out", pngScratch], { stdio: "pipe" });

const upng = loadUpng();
const png = readFileSync(pngScratch);
const decoded = upng.decode(png.buffer.slice(png.byteOffset, png.byteOffset + png.byteLength));
const rgba = new Uint8Array(upng.toRGBA8(decoded)[0]!);
const encoded = encodeRgbaToUltraHdrJpeg(rgba, decoded.width, decoded.height, {
  boost: 0.5,
  hdrModel: "window",
});
writeFileSync(outJpeg, encoded.output);
process.stdout.write(`${outJpeg}\n${encoded.note}\nbytes=${encoded.output.byteLength}\n`);
