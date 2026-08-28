import assert from "node:assert/strict";
import { describe, it } from "vitest";
import sharp from "sharp";

import Base, { encodeRgbaToRaster } from "#src/encode-raster.js";

const pixels = new Uint8Array([255, 0, 0, 255, 0, 255, 0, 128, 0, 0, 255, 200, 255, 255, 0, 0]);

describe("encode-raster", () => {
  it("encodes each raster type and rejects unknown", async () => {
    const png = await encodeRgbaToRaster(pixels, 2, 2, "png");
    assert.equal(png.note, "PNG");
    assert.equal((await sharp(png.output).metadata()).format, "png");

    const webp = await encodeRgbaToRaster(pixels, 2, 2, "webp", 50);
    assert.equal(webp.note, "WEBP");
    assert.equal((await sharp(webp.output).metadata()).format, "webp");

    const avif = await encodeRgbaToRaster(pixels, 2, 2, "avif");
    assert.equal(avif.note, "AVIF");

    const tif = await encodeRgbaToRaster(pixels, 2, 2, "tif");
    assert.equal(tif.note, "TIF");
    const tiff = await encodeRgbaToRaster(pixels, 2, 2, "tiff");
    assert.equal(tiff.note, "TIFF");

    const gif = await encodeRgbaToRaster(pixels, 2, 2, "gif");
    assert.equal(gif.note, "GIF");
    assert.equal((await sharp(gif.output).metadata()).format, "gif");

    await assert.rejects(() => encodeRgbaToRaster(pixels, 2, 2, "bmp"), /must be/);
    const viaBase = await Base(pixels, 2, 2, "png");
    assert.equal(viaBase.note, "PNG");
  });
});
