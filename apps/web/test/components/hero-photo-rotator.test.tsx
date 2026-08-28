import { act, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { HeroPhotoRotator } from "@/components/hero-photo-rotator";
import { PHOTOS } from "@/lib/photos/catalog";

vi.mock("@/components/seam-compare", () => ({
  SeamComparePhoto: ({ photo }: { photo: { slug: string } }) => <div data-testid="seam-photo">{photo.slug}</div>,
}));

vi.mock("@/components/photo-pair", () => ({
  PhotoCredit: ({ photo }: { photo: { photographer: string } }) => <div data-testid="photo-credit">{photo.photographer}</div>,
}));

type ObserverCallback = (entries: IntersectionObserverEntry[]) => void;
let observerCallback: ObserverCallback | null = null;
let imageCount = 0;

class MockIntersectionObserver {
  constructor(callback: ObserverCallback) {
    observerCallback = callback;
  }
  observe = vi.fn();
  disconnect = vi.fn();
}

class MockImage {
  complete = false;
  decoding = "auto";
  onload: (() => void) | null = null;
  onerror: (() => void) | null = null;
  sizes = "";
  src = "";
  srcset = "";
  decode = vi.fn(() => Promise.resolve());
  constructor() {
    imageCount += 1;
  }
}

function stubMotion(matches: boolean) {
  vi.stubGlobal("matchMedia", vi.fn(() => ({
    matches,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    addListener: vi.fn(),
    removeListener: vi.fn(),
  })));
}

describe("HeroPhotoRotator", () => {
  beforeEach(() => {
    imageCount = 0;
    observerCallback = null;
    vi.stubGlobal("IntersectionObserver", MockIntersectionObserver);
    vi.stubGlobal("Image", MockImage);
    vi.stubGlobal("requestAnimationFrame", vi.fn(() => 1));
    vi.stubGlobal("cancelAnimationFrame", vi.fn());
    stubMotion(false);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("renders a no-number SVG circle loading bar", () => {
    render(<HeroPhotoRotator initialPhoto={PHOTOS[0]!} photos={PHOTOS.slice(0, 3)} />);
    const ring = screen.getByLabelText("Photo rotation progress");
    expect(ring.tagName.toLowerCase()).toBe("svg");
    expect(ring).toHaveTextContent("");
    expect(ring.querySelectorAll("circle")).toHaveLength(2);
  });

  it("does not preload the next photo until the photo area enters the viewport", () => {
    render(<HeroPhotoRotator initialPhoto={PHOTOS[0]!} photos={PHOTOS.slice(0, 3)} />);
    expect(imageCount).toBe(0);

    act(() => {
      observerCallback?.([{ isIntersecting: true } as IntersectionObserverEntry]);
    });

    expect(imageCount).toBe(2);
  });

  it("does not rotate or preload when reduced motion is requested", () => {
    stubMotion(true);
    render(<HeroPhotoRotator initialPhoto={PHOTOS[0]!} photos={PHOTOS.slice(0, 3)} />);

    act(() => {
      observerCallback?.([{ isIntersecting: true } as IntersectionObserverEntry]);
    });

    expect(screen.queryByLabelText("Photo rotation progress")).toBeNull();
    expect(imageCount).toBe(0);
  });
});
