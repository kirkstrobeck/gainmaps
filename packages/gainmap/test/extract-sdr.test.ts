import assert from "node:assert/strict";
import { describe, it } from "vitest";

import { encodeRgbaToUltraHdrJpeg } from "#src/encode.js";
import { ExtractSdrError, extractSdrPrimary } from "#src/extract-sdr.js";

function rgba(width: number, height: number): Uint8Array {
  return Uint8Array.from(
    { length: width * height * 4 },
    (_, i) => (i % 4 === 3 ? 255 : ((i % 4) * 40 + 80) & 0xff),
  );
}

/** Minimal SOS + entropy containing FF00 stuffing, a restart, then EOI. */
function craftEntropyJpeg(): Uint8Array {
  return Uint8Array.from([
    0xff, 0xd8,
    0xff, 0xda, 0x00, 0x02,
    0x11, 0x22, 0xff, 0x00,
    0x33, 0xff, 0xd0, 0x44,
    0xff, 0xd9,
    0xff, 0xd8, 0xff, 0xd9,
  ]);
}

describe("extractSdrPrimary", () => {
  it("extracts the primary SOI..EOI from a gain map JPEG", () => {
    const encoded = encodeRgbaToUltraHdrJpeg(rgba(4, 4), 4, 4, { boost: 0.5 });
    const primary = extractSdrPrimary(encoded.output);
    assert.equal(primary[0], 0xff);
    assert.equal(primary[1], 0xd8);
    assert.equal(primary[primary.length - 2], 0xff);
    assert.equal(primary[primary.length - 1], 0xd9);
    assert.ok(primary.length < encoded.output.length);
  });

  it("skips FF00 stuffing and FFD0-FFD7 restarts in entropy", () => {
    const primary = extractSdrPrimary(craftEntropyJpeg());
    assert.deepEqual(
      [...primary],
      [0xff, 0xd8, 0xff, 0xda, 0x00, 0x02, 0x11, 0x22, 0xff, 0x00, 0x33, 0xff, 0xd0, 0x44, 0xff, 0xd9],
    );
  });

  it("throws NO_SOI when the buffer is not a JPEG", () => {
    assert.throws(
      () => extractSdrPrimary(Uint8Array.from([0x00, 0x01, 0x02])),
      (error: unknown) => error instanceof ExtractSdrError && error.code === "NO_SOI",
    );
    assert.throws(
      () => extractSdrPrimary(Uint8Array.from([0xff])),
      (error: unknown) => error instanceof ExtractSdrError && error.code === "NO_SOI",
    );
  });

  it("throws NO_EOI on truncated, invalid, and unexpected structures", () => {
    const cases: readonly Uint8Array[] = [
      Uint8Array.from([0xff, 0xd8, 0xff, 0xda, 0x00, 0x02, 0x11, 0x22]),
      Uint8Array.from([0xff, 0xd8, 0xff, 0xda, 0x00, 0x02, 0xff, 0xc0]),
      Uint8Array.from([0xff, 0xd8, 0xff, 0xe0, 0x00]),
      Uint8Array.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x01]),
      Uint8Array.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x00]),
      Uint8Array.from([0xff, 0xd8, 0x11, 0x22]),
      Uint8Array.from([0xff, 0xd8, 0xff, 0xda, 0x00, 0x02, 0x01, 0xff]),
      Uint8Array.from([0xff, 0xd8, 0xff]),
    ];
    for (const bytes of cases) {
      assert.throws(
        () => extractSdrPrimary(bytes),
        (error: unknown) => error instanceof ExtractSdrError && error.code === "NO_EOI",
      );
    }
  });

  it("honours fill bytes, TEM/RST, and early EOI", () => {
    const withFill = Uint8Array.from([
      0xff, 0xd8,
      0xff, 0xff, 0xe0, 0x00, 0x04, 0x41, 0x42,
      0xff, 0xda, 0x00, 0x02,
      0x01, 0xff, 0xff, 0xd9,
    ]);
    assert.equal(extractSdrPrimary(withFill).length, withFill.length);
    const withTem = Uint8Array.from([0xff, 0xd8, 0xff, 0x01, 0xff, 0xd0, 0xff, 0xd9]);
    assert.equal(extractSdrPrimary(withTem).length, withTem.length);
    assert.deepEqual(
      [...extractSdrPrimary(Uint8Array.from([0xff, 0xd8, 0xff, 0xd9]))],
      [0xff, 0xd8, 0xff, 0xd9],
    );
  });
});
