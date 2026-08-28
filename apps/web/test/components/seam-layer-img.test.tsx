import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, act } from "@testing-library/react";
import { SeamLayerImg } from "@/components/seam-layer-img";

afterEach(() => {
  vi.unstubAllGlobals();
});

const base = {
  src: "/photos/x/standard-400.jpg",
  srcSet: "/photos/x/standard-400.jpg 400w",
  sizes: "380px",
  alt: "layer",
  width: 400,
  height: 300,
  loading: "lazy" as const,
  fetchPriority: "low" as const,
  className: "inst-img",
};

describe("SeamLayerImg", () => {
  it("always sets src when defer is false", () => {
    render(<SeamLayerImg {...base} />);
    expect(screen.getByAltText("layer")).toHaveAttribute("src", base.src);
  });

  it("omits src until the card is near the viewport", () => {
    class IO {
      observe(): void {}
      disconnect(): void {}
    }
    vi.stubGlobal("IntersectionObserver", IO);
    render(<SeamLayerImg {...base} defer />);
    expect(screen.getByAltText("layer").getAttribute("src")).toBeFalsy();
  });

  it("sets src once the observer reports intersecting", () => {
    const observers: Array<(entries: Array<{ isIntersecting: boolean }>) => void> = [];
    class IO {
      constructor(cb: (entries: Array<{ isIntersecting: boolean }>) => void) {
        observers.push(cb);
      }
      observe(): void {}
      disconnect(): void {}
    }
    vi.stubGlobal("IntersectionObserver", IO);
    render(<SeamLayerImg {...base} defer />);
    expect(screen.getByAltText("layer").getAttribute("src")).toBeFalsy();
    act(() => {
      observers[0]!([{ isIntersecting: true }]);
    });
    expect(screen.getByAltText("layer")).toHaveAttribute("src", base.src);
  });
});
