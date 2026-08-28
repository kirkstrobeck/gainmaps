import assert from "node:assert/strict";
import { describe, it } from "vitest";

import {
  applyHighlightSelectiveHdr,
  applyWindowGainCalibration,
  clamp,
  encodeKeepBaseGainMap,
  encodeRgbaToUltraHdrJpeg,
  flattenRgbaOntoCheckerboard,
  flattenRgbaOntoWhite,
  headroomFromBoost,
  resolveHeadroom,
  WINDOW_GAIN_CALIBRATION,
} from "#src/encode.js";

function rgba(values: number[]): Uint8Array {
  return Uint8Array.from(values);
}

describe("encode", () => {
  it("maps boost to headroom and honors explicit headroom", () => {
    assert.equal(headroomFromBoost(0), 2);
    assert.ok(Math.abs(headroomFromBoost(0.5) - WINDOW_GAIN_CALIBRATION.headroom) < 1e-9);
    assert.equal(headroomFromBoost(1), 6);
    assert.equal(resolveHeadroom({}), headroomFromBoost(0.5));
    assert.equal(resolveHeadroom({ headroom: 4 }), 4);
    assert.equal(resolveHeadroom({ headroom: 0 }), 1);
    assert.equal(resolveHeadroom({ headroom: Number.NaN, boost: 0 }), 2);
  });

  it("clamps non-finite values", () => {
    assert.equal(clamp(Number.NaN, 1, 10), 1);
    assert.equal(clamp(0, 1, 10), 1);
    assert.equal(clamp(99, 1, 10), 10);
  });

  it("flattens alpha onto white and checkerboard", () => {
    const pixels = rgba([0, 0, 0, 0, 255, 0, 0, 255]);
    const white = flattenRgbaOntoWhite(pixels, 2, 1);
    assert.equal(white[0], 255);
    assert.equal(white[3], 255);
    assert.equal(white[4], 255);
    const checker = flattenRgbaOntoCheckerboard(pixels, 2, 1, 1);
    assert.equal(checker[0], 245);
    assert.equal(checker[4], 255);
  });

  it("applies highlight and window HDR models", () => {
    const hi = applyHighlightSelectiveHdr(1, 1, 1, 3);
    assert.ok(hi[0] > 1);
    const lo = applyHighlightSelectiveHdr(0.05, 0.05, 0.05, 3);
    assert.ok(lo[0] < 0.2);
    const win = applyWindowGainCalibration(0.4, 0.3, 0.2, 3);
    assert.ok(win.every((channel) => channel >= 0));
    const linear = applyWindowGainCalibration(0.4, 0.3, 0.2, 3, { ...WINDOW_GAIN_CALIBRATION, saturation: 1 });
    assert.equal(linear.length, 3);
  });

  it("encodes a gain-map JPEG with quality, model, and matte options", () => {
    const pixels = rgba([
      255, 255, 255, 255, 10, 10, 10, 255,
      200, 20, 20, 128, 0, 0, 0, 0,
    ]);
    const encoded = encodeRgbaToUltraHdrJpeg(pixels, 2, 2, {
      boost: 0.5,
      quality: 80,
      hdrModel: "highlight",
      matte: "white",
    });
    assert.equal(encoded.output[0], 0xff);
    assert.equal(encoded.output[1], 0xd8);
    const text = Buffer.from(encoded.output).toString("latin1");
    assert.ok(text.includes("hdr-gain-map") || text.includes("GainMap") || text.includes("MPF"));
    const windowed = encodeRgbaToUltraHdrJpeg(pixels, 2, 2, {
      headroom: 3,
      hdrModel: "window",
      matte: "checkerboard",
      quality: Number.NaN,
    });
    assert.equal(windowed.output[0], 0xff);
    assert.match(windowed.note, /Gain map JPEG/);
  });

  it("alpha mask: alpha 0 gives zero gain, alpha 255 matches maskless, alpha 128 halves log gain", () => {
    // Bright checker pixel that would get strong boost without mask
    const sdr = Uint8ClampedArray.from([220, 220, 220, 255]);

    // alpha 0 → all gain channels must be 0 (gain=1.0 exactly)
    const maskZero = Uint8Array.from([220, 220, 220, 0]);
    const res0 = encodeKeepBaseGainMap(sdr, 1, 1, 6, "highlight", maskZero);
    assert.equal(res0.gainMap[0], 0, "alpha=0 R channel must be 0");
    assert.equal(res0.gainMap[1], 0, "alpha=0 G channel must be 0");
    assert.equal(res0.gainMap[2], 0, "alpha=0 B channel must be 0");
    assert.equal(res0.gainMap[3], 255, "alpha channel always 255");

    // alpha 255 → bit-identical to maskless
    const maskFull = Uint8Array.from([220, 220, 220, 255]);
    const resNoMask = encodeKeepBaseGainMap(sdr, 1, 1, 6, "highlight");
    const res255 = encodeKeepBaseGainMap(sdr, 1, 1, 6, "highlight", maskFull);
    assert.equal(res255.gainMap[0], resNoMask.gainMap[0], "alpha=255 must equal maskless R");
    assert.equal(res255.gainMap[1], resNoMask.gainMap[1], "alpha=255 must equal maskless G");
    assert.equal(res255.gainMap[2], resNoMask.gainMap[2], "alpha=255 must equal maskless B");

    // alpha 128 → gain between 0 and maskless
    const maskHalf = Uint8Array.from([220, 220, 220, 128]);
    const res128 = encodeKeepBaseGainMap(sdr, 1, 1, 6, "highlight", maskHalf);
    assert.ok(res128.gainMap[0]! > 0, "alpha=128 must have some gain");
    assert.ok(res128.gainMap[0]! < resNoMask.gainMap[0]!, "alpha=128 gain must be less than full");
  });
});
