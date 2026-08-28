import assert from "node:assert/strict";
import { describe, it, vi } from "vitest";
import sharp from "sharp";

vi.mock("heic-decode", () => ({
  default: async () => ({ width: 1, height: 1, data: new Uint8ClampedArray([1, 2, 3, 255]).buffer }),
}));

import { clampSvgEdge, decodeImage, detectFormat, formatFromHint, isSupportedFormat } from "#src/decode.js";

async function pngBytes(): Promise<Uint8Array> {
  return new Uint8Array(await sharp({ create: { width: 2, height: 2, channels: 4, background: { r: 12, g: 34, b: 56, alpha: 1 } } }).png().toBuffer());
}

describe("decode", () => {
  it("detects formats from magic and hints", () => {
    assert.equal(detectFormat(Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])), "png");
    assert.equal(detectFormat(Uint8Array.from([0xff, 0xd8, 0xff])), "jpeg");
    assert.equal(detectFormat(Uint8Array.from([0x47, 0x49, 0x46, 0x38, 0x39, 0x61])), "gif");
    const webp = new Uint8Array(12);
    webp.set(Buffer.from("RIFF"), 0);
    webp.set(Buffer.from("WEBP"), 8);
    assert.equal(detectFormat(webp), "webp");
    const avif = new Uint8Array(12);
    avif.set(Buffer.from("ftyp"), 4);
    avif.set(Buffer.from("avif"), 8);
    assert.equal(detectFormat(avif), "avif");
    const heic = new Uint8Array(12);
    heic.set(Buffer.from("ftyp"), 4);
    heic.set(Buffer.from("heic"), 8);
    assert.equal(detectFormat(heic), "heic");
    const avis = new Uint8Array(12);
    avis.set(Buffer.from("ftyp"), 4);
    avis.set(Buffer.from("avis"), 8);
    assert.equal(detectFormat(avis), "avif");
    const mif1 = new Uint8Array(12);
    mif1.set(Buffer.from("ftyp"), 4);
    mif1.set(Buffer.from("mif1"), 8);
    assert.equal(detectFormat(mif1), "heic");
    assert.equal(detectFormat(Uint8Array.from([0x49, 0x49, 0x2a, 0x00])), "tiff");
    assert.equal(detectFormat(Uint8Array.from([0x4d, 0x4d, 0x00, 0x2a])), "tiff");
    assert.equal(detectFormat(Buffer.from("<svg></svg>")), "svg");
    assert.equal(detectFormat(Buffer.from("<?xml version='1.0'?><svg></svg>")), "svg");
    assert.equal(detectFormat(Uint8Array.from([0x00])), "unknown");
    assert.equal(detectFormat(Uint8Array.from([0x00]), "photo.JPEG"), "jpeg");
    assert.equal(formatFromHint("a.png"), "png");
    assert.equal(formatFromHint("a.gif"), "gif");
    assert.equal(formatFromHint("a.webp"), "webp");
    assert.equal(formatFromHint("a.avif"), "avif");
    assert.equal(formatFromHint("a.heif"), "heic");
    assert.equal(formatFromHint("a.tiff"), "tiff");
    assert.equal(formatFromHint("a.svg"), "svg");
    assert.equal(formatFromHint("a.bin"), "unknown");
    assert.equal(isSupportedFormat("png"), true);
    assert.equal(isSupportedFormat("unknown"), false);
  });

  it("covers short-buffer magic checks", () => {
    assert.equal(detectFormat(Uint8Array.from([])), "unknown");
    assert.equal(detectFormat(Uint8Array.from([0xff])), "unknown");
    assert.equal(detectFormat(new Uint8Array(3)), "unknown");
    const shortRiff = new Uint8Array(8);
    shortRiff.set(Buffer.from("RIFF"));
    assert.equal(detectFormat(shortRiff), "unknown");
  });

  it("decodes png via sharp and heic via heic-decode", async () => {
    const png = await decodeImage(await pngBytes(), "x.png");
    assert.equal(png.width, 2);
    assert.equal(png.height, 2);
    const limited = await decodeImage(await pngBytes(), "x.png", 1);
    assert.ok(limited.width <= 2);
    const heic = new Uint8Array(12);
    heic.set(Buffer.from("ftyp"), 4);
    heic.set(Buffer.from("heic"), 8);
    const raster = await decodeImage(heic, "x.heic");
    assert.equal(raster.width, 1);
    const resized = await decodeImage(heic, "x.heic", 8);
    assert.equal(resized.width, 1);
    await assert.rejects(decodeImage(Uint8Array.from([0x00, 0x01]), "x.bin"), /Unsupported/);
  });

  it("clamps SVG edges", () => {
    assert.deepEqual(clampSvgEdge(0, 0), { width: 1024, height: 1024 });
    const up = clampSvgEdge(10, 20);
    assert.equal(up.height, 1024);
    const down = clampSvgEdge(8000, 4000);
    assert.equal(down.width, 4096);
    assert.deepEqual(clampSvgEdge(2000, 1000), { width: 2000, height: 1000 });
  });

  it("decodes gif and svg options through sharp", async () => {
    const svg = Buffer.from("<svg xmlns='http://www.w3.org/2000/svg' width='8' height='8'><rect width='8' height='8' fill='#fff'/></svg>");
    const raster = await decodeImage(new Uint8Array(svg), "mark.svg");
    assert.ok(raster.width >= 8);
    const gif = await sharp({ create: { width: 2, height: 2, channels: 3, background: "blue" } }).gif().toBuffer();
    const gifRaster = await decodeImage(new Uint8Array(gif), "x.gif");
    assert.equal(gifRaster.width, 2);
  });
});
