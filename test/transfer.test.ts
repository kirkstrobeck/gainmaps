import { describe, it } from 'vitest';
import assert from 'node:assert/strict';

import {
  CURVES,
  PQ_PEAK_NITS,
  bt2020ToLinear,
  linearToBt2020,
  linearToSrgb,
  nitsToPq,
  pqToNits,
  srgbToLinear,
} from '../src/color/transfer.js';

const close = (actual: number, expected: number, tolerance: number) =>
  assert.ok(
    Math.abs(actual - expected) <= tolerance,
    `expected ${actual} to be within ${tolerance} of ${expected}`,
  );

describe('transfer curves', () => {
  it('anchors sRGB at both ends and round-trips', () => {
    assert.equal(srgbToLinear(0), 0);
    close(srgbToLinear(1), 1, 1e-12);
    close(linearToSrgb(srgbToLinear(0.5)), 0.5, 1e-12);
  });

  it('matches the published PQ anchors', () => {
    close(pqToNits(1), PQ_PEAK_NITS, 1e-6);
    close(pqToNits(0.5), 92.2, 0.5);
    close(nitsToPq(pqToNits(0.7)), 0.7, 1e-9);
    close(nitsToPq(100), 0.5081, 1e-3);
  });

  it('keeps BT.2020 within a few percent of sRGB', () => {
    for (const code of [0.25, 0.5, 0.75]) {
      close(bt2020ToLinear(code), srgbToLinear(code), 0.05);
      close(linearToBt2020(bt2020ToLinear(code)), code, 1e-12);
    }
  });

  it('shows PQ crushing midtones that sRGB and BT.2020 keep', () => {
    // Mid-grey: sRGB and BT.2020 land in the low twenties percent of white.
    // PQ puts it under 1% — this is the whole cause of the jagged edges.
    close(CURVES.srgb!(128 / 255), 0.2159, 1e-3);
    close(CURVES.gamut!(128 / 255), 0.2615, 1e-3);
    assert.ok(CURVES.pq!(128 / 255) < 0.01, `PQ mid-grey was ${CURVES.pq!(128 / 255)}`);
  });

  it('normalizes every curve to its own white', () => {
    for (const [name, curve] of Object.entries(CURVES)) {
      close(curve(1), 1, 1e-9);
      assert.equal(curve(0), 0, `${name} should be black at zero`);
    }
  });
});
