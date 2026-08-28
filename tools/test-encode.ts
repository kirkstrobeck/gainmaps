#!/usr/bin/env npx tsx
/**
 * Smoke test for the encodeRgbaToUltraHdrJpeg encode path.
 *
 * Run from the repo root:
 *   npx tsx tools/test-encode.ts
 *
 * Passes when the output JPEG carries an MPF APP2 segment and hdrgm XMP
 * namespace, which proves the gain map payload survived encoding.
 */
import { encodeRgbaToUltraHdrJpeg } from "../apps/web/lib/gain-map-encode.ts";

const WIDTH = 4;
const HEIGHT = 4;

function makeSyntheticRgba(width: number, height: number): Uint8Array {
  const pixels = new Uint8Array(width * height * 4);
  const count = width * height;
  for (let index = 0; index < count; index += 1) {
    const offset = index * 4;
    // Vary brightness so the gain map has non-trivial content.
    const brightness = Math.floor((index / count) * 240) + 10;
    pixels[offset] = brightness;
    pixels[offset + 1] = Math.floor(brightness * 0.9);
    pixels[offset + 2] = Math.floor(brightness * 0.6);
    pixels[offset + 3] = 255;
  }
  return pixels;
}

function hasMpfSegment(data: Uint8Array): boolean {
  for (let index = 0; index < data.length - 8; index += 1) {
    if (data[index] !== 0xff || data[index + 1] !== 0xe2) continue;
    // APP2 found. Check for "MPF\0" at bytes 4-7.
    if (
      data[index + 4] === 0x4d &&
      data[index + 5] === 0x50 &&
      data[index + 6] === 0x46 &&
      data[index + 7] === 0x00
    ) {
      return true;
    }
  }
  return false;
}

function hasHdrgmXmp(data: Uint8Array): boolean {
  const needle = "hdrgm";
  const needleBytes = [...needle].map((c) => c.charCodeAt(0));
  outer: for (let index = 0; index < data.length - needleBytes.length; index += 1) {
    for (let j = 0; j < needleBytes.length; j += 1) {
      if (data[index + j] !== needleBytes[j]) continue outer;
    }
    return true;
  }
  return false;
}

const pixels = makeSyntheticRgba(WIDTH, HEIGHT);
const result = encodeRgbaToUltraHdrJpeg(pixels, WIDTH, HEIGHT, { boost: 0.5 });

if (!hasMpfSegment(result.output)) {
  process.stderr.write("FAIL: output JPEG is missing the MPF APP2 segment\n");
  process.exit(1);
}

if (!hasHdrgmXmp(result.output)) {
  process.stderr.write("FAIL: output JPEG is missing the hdrgm XMP namespace\n");
  process.exit(1);
}

process.stdout.write(
  "PASS: gain map JPEG encodes correctly\n" +
    "  size:     " + result.output.byteLength + " bytes\n" +
    "  headroom: " + result.headroom.toFixed(2) + "x\n" +
    "  note:     " + result.note + "\n",
);
