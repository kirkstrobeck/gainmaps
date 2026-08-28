import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { serializePng } from "../src/png/chunks.js";
import { encodeIdat } from "../src/png/encode.js";
import type { RasterImage } from "../src/png/decode.js";
import { parseJpeg, serializeJpeg } from "../src/jpeg/structure.js";
import { APP0, APP1 } from "../src/jpeg/markers.js";
import { setIccProfile } from "../src/jpeg/icc-segments.js";

export const LETTER = [255, 253, 242, 255] as const;
export const BLEND = [78, 93, 166, 255] as const;
export const BACKGROUND = [53, 70, 155, 255] as const;
export const WIDTH = 8;
export const HEIGHT = 32;
export const BLEND_X = 1;
export const BACKGROUND_X = 2;

function rgbaRow(): Buffer {
  const cells = [
    [...LETTER],
    [...BLEND],
    ...Array.from({ length: WIDTH - 2 }, () => [...BACKGROUND]),
  ];
  return Buffer.from(cells.flat());
}

function rgbaPixels(): Buffer {
  return Buffer.concat(Array.from({ length: HEIGHT }, rgbaRow));
}

function ihdr(): Buffer {
  const data = Buffer.alloc(13);
  data.writeUInt32BE(WIDTH, 0);
  data.writeUInt32BE(HEIGHT, 4);
  data.writeUInt8(8, 8);
  data.writeUInt8(6, 9);
  return data;
}

function gama(): Buffer {
  const data = Buffer.alloc(4);
  data.writeUInt32BE(45455, 0);
  return data;
}

export function syntheticRgbaImage(): RasterImage {
  return { width: WIDTH, height: HEIGHT, channels: 4, pixels: rgbaPixels() };
}

export function syntheticRgbaPng(): Buffer {
  const image = syntheticRgbaImage();
  return serializePng([
    { type: "IHDR", data: ihdr() },
    { type: "sRGB", data: Buffer.from([0]) },
    { type: "gAMA", data: gama() },
    { type: "IDAT", data: encodeIdat(image) },
    { type: "IEND", data: Buffer.alloc(0) },
  ]);
}

function dqtNearLossless(): Buffer {
  const payload = Buffer.alloc(65);
  payload.fill(1, 1);
  return payload;
}

function sof444(): Buffer {
  const payload = Buffer.alloc(15);
  payload.writeUInt8(8, 0);
  payload.writeUInt16BE(HEIGHT, 1);
  payload.writeUInt16BE(WIDTH, 3);
  payload.writeUInt8(3, 5);
  payload.writeUInt8(1, 6);
  payload.writeUInt8(0x11, 7);
  payload.writeUInt8(2, 9);
  payload.writeUInt8(0x11, 10);
  payload.writeUInt8(3, 12);
  payload.writeUInt8(0x11, 13);
  return payload;
}

function jfifApp0(): Buffer {
  const payload = Buffer.alloc(14);
  payload.write("JFIF\0", 0, "latin1");
  payload.writeUInt8(1, 5);
  payload.writeUInt8(1, 6);
  payload.writeUInt16BE(1, 8);
  payload.writeUInt16BE(1, 10);
  return payload;
}

export function syntheticJpeg(): Buffer {
  return serializeJpeg({
    segments: [
      { marker: APP0, payload: jfifApp0() },
      { marker: APP1, payload: Buffer.from("Exif\0\0", "latin1") },
      { marker: 0xdb, payload: dqtNearLossless() },
      { marker: 0xc0, payload: sof444() },
    ],
    scan: Buffer.from([0xff, 0xda, 0, 2, 0xff, 0xd9]),
  });
}

export function syntheticJpegWithProfile(profile: Buffer): Buffer {
  return serializeJpeg(setIccProfile(parseJpeg(syntheticJpeg()), profile));
}

export async function writeSyntheticCliFixtures(): Promise<{ png: string; jpeg: string; donor: string }> {
  const dir = await mkdtemp(join(tmpdir(), "cli-fix-"));
  const png = join(dir, "edge.png");
  const jpeg = join(dir, "edge.jpg");
  const donor = join(dir, "donor.jpg");
  await writeFile(png, syntheticRgbaPng());
  await writeFile(jpeg, syntheticJpeg());
  await writeFile(donor, syntheticJpegWithProfile(await readFile("profiles/rec2020-pq.icc")));
  return { png, jpeg, donor };
}
