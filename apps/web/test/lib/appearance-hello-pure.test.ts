import { describe, it, expect } from "vitest";
import {
  srgb8ToLinear,
  fieldRgb,
  inkRgb,
  inkScale,
  packUniform,
  UNIFORM_FLOATS,
  type HelloState,
} from "@/lib/appearance-hello-pure";

describe("srgb8ToLinear", () => {
  it("converts black (0) to 0", () => {
    expect(srgb8ToLinear(0)).toBe(0);
  });

  it("converts white (255) to ~1", () => {
    expect(srgb8ToLinear(255)).toBeCloseTo(1, 3);
  });

  it("uses linear segment for dark values", () => {
    const result = srgb8ToLinear(10);
    expect(result).toBeCloseTo(10 / 255 / 12.92, 5);
  });

  it("uses gamma curve for bright values", () => {
    const x = 200 / 255;
    const expected = Math.pow((x + 0.055) / 1.055, 2.4);
    expect(srgb8ToLinear(200)).toBeCloseTo(expected, 5);
  });
});

describe("fieldRgb", () => {
  it("returns black for dark mode", () => {
    const state: HelloState = { ultra: true, resolved: "dark", scale: 2 };
    const rgb = fieldRgb(state);
    expect(rgb).toEqual({ r: 0, g: 0, b: 0 });
  });

  it("returns base brightness for light mode without ultra", () => {
    const state: HelloState = { ultra: false, resolved: "light", scale: 1 };
    const rgb = fieldRgb(state);
    const base = srgb8ToLinear(0xf2);
    expect(rgb.r).toBeCloseTo(base, 5);
  });

  it("amplifies light-mode field by scale when ultra is on", () => {
    const scale = 2;
    const state: HelloState = { ultra: true, resolved: "light", scale };
    const rgb = fieldRgb(state);
    const base = srgb8ToLinear(0xf2);
    expect(rgb.r).toBeCloseTo(base * scale, 5);
  });

  it("does not amplify when ultra is off", () => {
    const state: HelloState = { ultra: false, resolved: "light", scale: 3 };
    const rgb = fieldRgb(state);
    const base = srgb8ToLinear(0xf2);
    expect(rgb.r).toBeCloseTo(base, 5);
  });
});

describe("inkRgb", () => {
  it("returns near-black for light mode", () => {
    const state: HelloState = { ultra: false, resolved: "light", scale: 1 };
    const rgb = inkRgb(state);
    expect(rgb.r).toBeLessThan(0.02);
    expect(rgb.g).toBeLessThan(0.02);
  });

  it("returns white (1,1,1) for dark mode", () => {
    const state: HelloState = { ultra: false, resolved: "dark", scale: 1 };
    const rgb = inkRgb(state);
    expect(rgb).toEqual({ r: 1, g: 1, b: 1 });
  });
});

describe("inkScale", () => {
  it("returns scale for dark ultra mode with scale > 1", () => {
    const state: HelloState = { ultra: true, resolved: "dark", scale: 2.5 };
    expect(inkScale(state)).toBe(2.5);
  });

  it("returns 1 for light mode", () => {
    const state: HelloState = { ultra: true, resolved: "light", scale: 3 };
    expect(inkScale(state)).toBe(1);
  });

  it("returns 1 when ultra is off", () => {
    const state: HelloState = { ultra: false, resolved: "dark", scale: 3 };
    expect(inkScale(state)).toBe(1);
  });

  it("returns 1 when scale is exactly 1", () => {
    const state: HelloState = { ultra: true, resolved: "dark", scale: 1 };
    expect(inkScale(state)).toBe(1);
  });
});

describe("packUniform", () => {
  it("produces Float32Array of UNIFORM_FLOATS length", () => {
    const field = { r: 0.5, g: 0.5, b: 0.5 };
    const ink = { r: 1, g: 1, b: 1 };
    const data = packUniform(100, 200, 1.5, field, ink);
    expect(data).toBeInstanceOf(Float32Array);
    expect(data.length).toBe(UNIFORM_FLOATS);
  });

  it("encodes viewport at index 0 and 1", () => {
    const data = packUniform(640, 480, 1, { r: 0, g: 0, b: 0 }, { r: 1, g: 1, b: 1 });
    expect(data[0]).toBe(640);
    expect(data[1]).toBe(480);
  });

  it("encodes glyphScale at index 2", () => {
    const data = packUniform(100, 100, 2.5, { r: 0, g: 0, b: 0 }, { r: 1, g: 1, b: 1 });
    expect(data[2]).toBeCloseTo(2.5, 4);
  });

  it("encodes field color at indices 4-6", () => {
    const field = { r: 0.1, g: 0.2, b: 0.3 };
    const data = packUniform(100, 100, 1, field, { r: 0, g: 0, b: 0 });
    expect(data[4]).toBeCloseTo(0.1, 4);
    expect(data[5]).toBeCloseTo(0.2, 4);
    expect(data[6]).toBeCloseTo(0.3, 4);
  });

  it("encodes ink color at indices 8-10", () => {
    const ink = { r: 0.7, g: 0.8, b: 0.9 };
    const data = packUniform(100, 100, 1, { r: 0, g: 0, b: 0 }, ink);
    expect(data[8]).toBeCloseTo(0.7, 4);
    expect(data[9]).toBeCloseTo(0.8, 4);
    expect(data[10]).toBeCloseTo(0.9, 4);
  });
});
