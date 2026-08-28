import { describe, it, expect } from "vitest";
import {
  TEXT_ULTRA_HEADROOM_MIN,
  TEXT_ULTRA_HEADROOM_MAX,
  TEXT_ULTRA_INTENSITY,
  TEXT_ULTRA_SLIDER_DEFAULT,
  headroomToSlider,
  sliderToHeadroom,
} from "@/lib/text-ultra";

describe("constants", () => {
  it("min is 1", () => expect(TEXT_ULTRA_HEADROOM_MIN).toBe(1));
  it("max is 4", () => expect(TEXT_ULTRA_HEADROOM_MAX).toBe(4));
  it("intensity equals max", () => expect(TEXT_ULTRA_INTENSITY).toBe(TEXT_ULTRA_HEADROOM_MAX));
  it("slider default is 100", () => expect(TEXT_ULTRA_SLIDER_DEFAULT).toBe(100));
});

describe("headroomToSlider", () => {
  it("min headroom maps to 0", () => {
    expect(headroomToSlider(TEXT_ULTRA_HEADROOM_MIN)).toBe(0);
  });

  it("max headroom maps to 100", () => {
    expect(headroomToSlider(TEXT_ULTRA_HEADROOM_MAX)).toBe(100);
  });

  it("midpoint headroom maps to 50", () => {
    const mid = (TEXT_ULTRA_HEADROOM_MIN + TEXT_ULTRA_HEADROOM_MAX) / 2;
    expect(headroomToSlider(mid)).toBe(50);
  });

  it("NaN returns 70", () => {
    expect(headroomToSlider(NaN)).toBe(70);
  });

  it("Infinity returns 70", () => {
    expect(headroomToSlider(Infinity)).toBe(70);
  });

  it("below min clamps to 0", () => {
    expect(headroomToSlider(-999)).toBe(0);
  });

  it("above max clamps to 100", () => {
    expect(headroomToSlider(999)).toBe(100);
  });
});

describe("sliderToHeadroom", () => {
  it("slider 0 returns min headroom", () => {
    expect(sliderToHeadroom(0)).toBeCloseTo(TEXT_ULTRA_HEADROOM_MIN);
  });

  it("slider 100 returns max headroom", () => {
    expect(sliderToHeadroom(100)).toBeCloseTo(TEXT_ULTRA_HEADROOM_MAX);
  });

  it("slider 50 returns midpoint", () => {
    const mid = (TEXT_ULTRA_HEADROOM_MIN + TEXT_ULTRA_HEADROOM_MAX) / 2;
    expect(sliderToHeadroom(50)).toBeCloseTo(mid);
  });

  it("NaN slider uses default", () => {
    const result = sliderToHeadroom(NaN);
    expect(Number.isFinite(result)).toBe(true);
  });

  it("negative slider clamps to 0", () => {
    expect(sliderToHeadroom(-10)).toBeCloseTo(TEXT_ULTRA_HEADROOM_MIN);
  });

  it("slider > 100 clamps to 100", () => {
    expect(sliderToHeadroom(200)).toBeCloseTo(TEXT_ULTRA_HEADROOM_MAX);
  });
});
