#!/usr/bin/env npx tsx
import { createHash } from "node:crypto";
import sharp from "sharp";
import { encodeRgbaToUltraHdrJpeg } from "../../apps/web/lib/gain-map-encode.ts";

// Use a synthetic 8×8 RGBA image (all-opaque, white matte = photo case)
const { data } = await sharp({
  create: { width: 8, height: 8, channels: 4, background: { r: 200, g: 180, b: 140, alpha: 255 } }
}).raw().toBuffer({ resolveWithObject: true });
const pixels = new Uint8Array(data.buffer, data.byteOffset, data.byteLength);

// Encode twice — for photos matte is "white" which passes alphaMask=null internally
const a = encodeRgbaToUltraHdrJpeg(pixels, 8, 8, { matte: "white", boost: 1.0 });
const b = encodeRgbaToUltraHdrJpeg(pixels, 8, 8, { matte: "white", boost: 1.0 });

const hashA = createHash("sha256").update(a.output).digest("hex");
const hashB = createHash("sha256").update(b.output).digest("hex");
console.log("encode A:", hashA);
console.log("encode B:", hashB);
console.log(hashA === hashB ? "PASS: deterministic (photo path unchanged)" : "FAIL: non-deterministic");
