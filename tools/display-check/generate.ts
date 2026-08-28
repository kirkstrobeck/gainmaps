#!/usr/bin/env tsx
/**
 * Generates apps/web/public/display-check/test.jpg
 *
 * On SDR: the entire image is white — icon is invisible.
 * On HDR: the background is ultra-bright; icon pixels stay at SDR white → visible notch.
 *
 * The alpha channel acts as the gain mask passed to encodeKeepBaseGainMap:
 *   alpha=255 → HDR boost applied (bright square background)
 *   alpha=0   → gain map = 0 (stays at SDR white on HDR)
 */
import { writeFileSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { writeJpegGainMap } from "hdrify";
import {
  encodeKeepBaseGainMap,
  headroomFromBoost,
  flattenRgbaOntoWhite,
} from "../../packages/gainmap/src/encode.js";

const W = 512;
const H = 512;
const CX = W / 2;
const CY = H / 2;

// All pixels white, alpha=255 by default (will get HDR boost)
const pixels = new Uint8Array(W * H * 4);
for (let i = 0; i < W * H; i++) {
  pixels[i * 4 + 0] = 255; // R
  pixels[i * 4 + 1] = 255; // G
  pixels[i * 4 + 2] = 255; // B
  pixels[i * 4 + 3] = 255; // A = opaque → boost
}

// Draw a 5-pointed star centered at (CX, CY) with outer radius 140, inner radius 60.
// Star pixels get alpha=0 → stays at SDR white on HDR (visible notch).
function starPath(cx: number, cy: number, outerR: number, innerR: number, points: number) {
  const verts: [number, number][] = [];
  for (let i = 0; i < points * 2; i++) {
    const angle = (Math.PI / points) * i - Math.PI / 2;
    const r = i % 2 === 0 ? outerR : innerR;
    verts.push([cx + r * Math.cos(angle), cy + r * Math.sin(angle)]);
  }
  return verts;
}

function pointInPolygon(px: number, py: number, poly: [number, number][]): boolean {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const xi = poly[i]![0], yi = poly[i]![1];
    const xj = poly[j]![0], yj = poly[j]![1];
    const intersect = ((yi > py) !== (yj > py)) &&
      (px < ((xj - xi) * (py - yi)) / (yj - yi) + xi);
    if (intersect) inside = !inside;
  }
  return inside;
}

const star = starPath(CX, CY, 140, 60, 5);
for (let y = 0; y < H; y++) {
  for (let x = 0; x < W; x++) {
    if (pointInPolygon(x, y, star)) {
      const idx = (y * W + x) * 4;
      pixels[idx + 3] = 0; // alpha=0 → no HDR boost → stays white on HDR
    }
  }
}

// boost=1.0 gives a high headroom for a dramatic effect
const headroom = headroomFromBoost(1.0);
const sdr = flattenRgbaOntoWhite(pixels, W, H); // all white regardless of alpha
const encoding = encodeKeepBaseGainMap(sdr, W, H, headroom, "highlight", pixels);
const output = writeJpegGainMap(encoding, { quality: 90, format: "ultrahdr" });

const outPath = new URL("../../apps/web/public/display-check/test.jpg", import.meta.url);
const outFile = fileURLToPath(outPath);
mkdirSync(dirname(outFile), { recursive: true });
writeFileSync(outFile, output);
console.log(`Written ${outFile} (${output.byteLength} bytes)`);
