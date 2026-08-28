import { beforeEach, describe, expect, it } from "vitest";
import { render } from "@testing-library/react";

import { UltraWord } from "@/components/ultra-word";
import { foundationHeadroomFor, TEXT_ULTRA_FOUNDATION_RATIO } from "@/lib/text-ultra";

function rect(): DOMRect {
  return { left: 10, top: 20, height: 30 } as DOMRect;
}

describe("UltraWord", () => {
  beforeEach(() => {
    Object.defineProperty(Range.prototype, "getBoundingClientRect", { configurable: true, value: rect });
  });

  it("keeps the selectable word readable as the fallback", () => {
    const { container } = render(<UltraWord text="Gain" typeClassName="font-bold" intensity={1.5} />);
    const readable = container.querySelector(".ultra-word > span");
    expect(readable).toHaveClass("text-[var(--foreground)]");
    expect(readable).not.toHaveClass("text-transparent");
  });

  it("uses SVG text rather than foreignObject for the mask", () => {
    const { container } = render(<UltraWord text="maps" typeClassName="font-bold" intensity={1.5} />);
    expect(container.querySelector("mask text")).toHaveTextContent("maps");
    expect(container.querySelector("foreignObject")).toBeNull();
  });

  it("groups wrapped text fragments into one SVG mask line", () => {
    const { container } = render(<UltraWord text="Gain maps" typeClassName="font-bold" intensity={1} />);
    expect(container.querySelector("mask text")).toHaveTextContent("Gain maps");
  });

  it("uses a 0.5px inset mask and softened top Ultra fill", () => {
    const { container } = render(<UltraWord text="Glow" typeClassName="font-bold" intensity={4} />);
    const insetMask = container.querySelectorAll("mask")[1];
    const insetText = insetMask?.querySelector("text");
    expect(insetText?.getAttribute("stroke-width")).toBe("1");
    expect(insetText?.getAttribute("filter")).toMatch(/^url\(#.+b\)$/);
    expect(container.querySelector("feGaussianBlur")?.getAttribute("stdDeviation")).toBe("0.3");
    const foundation = container.querySelector(".ultra-word > .ultra-fill-foundation");
    const inner = container.querySelector(".ultra-word > .ultra-fill-inner");
    expect(foundation).toBeInTheDocument();
    expect(foundation?.getAttribute("data-ultra-headroom")).toBe(String(foundationHeadroomFor(4)));
    expect(TEXT_ULTRA_FOUNDATION_RATIO).toBe(0.75);
    expect(inner).toBeInTheDocument();
    expect(inner?.getAttribute("data-ultra-headroom")).toBe("4");
  });
});
