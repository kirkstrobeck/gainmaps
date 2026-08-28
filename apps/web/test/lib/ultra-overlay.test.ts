import { describe, it, expect } from "vitest";
import { ULTRA_BLEED, ultraOverlayGeometry } from "@/lib/ultra-overlay";

describe("ULTRA_BLEED", () => {
  it("is 0.5", () => {
    expect(ULTRA_BLEED).toBe(0.5);
  });
});

describe("ultraOverlayGeometry", () => {
  it("returns absolute position", () => {
    expect(ultraOverlayGeometry().position).toBe("absolute");
  });

  it("uses default bleed of 0.5", () => {
    const g = ultraOverlayGeometry();
    expect(g.inset).toBe("-50%");
    expect(g.width).toBe("200%");
    expect(g.height).toBe("200%");
  });

  it("accepts custom bleed of 0", () => {
    const g = ultraOverlayGeometry(0);
    expect(g.inset).toBe("0%");
    expect(g.width).toBe("100%");
    expect(g.height).toBe("100%");
  });

  it("accepts custom bleed of 1", () => {
    const g = ultraOverlayGeometry(1);
    expect(g.inset).toBe("-100%");
    expect(g.width).toBe("300%");
    expect(g.height).toBe("300%");
  });

  it("returns four properties", () => {
    const g = ultraOverlayGeometry();
    expect(Object.keys(g)).toEqual(["position", "inset", "width", "height"]);
  });
});
