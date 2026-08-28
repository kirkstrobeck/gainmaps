import "@testing-library/jest-dom/vitest";
import { afterEach, vi } from "vitest";
import { cleanup } from "@testing-library/react";
import { resetNavState } from "@/test/helpers/nav";

afterEach(() => {
  cleanup();
  resetNavState();
});

vi.mock("gainmap/encode", () => ({
  DEFAULT_PHOTO_HEADROOM: 3.34,
  WINDOW_GAIN_CALIBRATION: { gain: 1 },
  applyHighlightSelectiveHdr: vi.fn(),
  applyWindowGainCalibration: vi.fn(),
  encodeKeepBaseGainMap: vi.fn(),
  encodeRgbaToUltraHdrJpeg: vi.fn(),
  flattenRgbaOntoCheckerboard: vi.fn(),
  flattenRgbaOntoWhite: vi.fn(),
  headroomFromBoost: (boost: number) => 1 + boost * 3,
}));

vi.mock("next/font/google", () => ({
  Archivo: () => ({ variable: "font-archivo" }),
  Bricolage_Grotesque: () => ({ variable: "font-bricolage" }),
  JetBrains_Mono: () => ({ variable: "font-mono" }),
}));

vi.mock("next/navigation", async () => {
  const { navState } = await import("@/test/helpers/nav");
  return {
    usePathname: () => navState.pathname,
    useRouter: () => ({ push: navState.push, replace: navState.replace }),
    useSearchParams: () => ({ get: navState.searchGet }),
    notFound: () => navState.notFound(),
  };
});

vi.mock("next/headers", async () => {
  const { headerState } = await import("@/test/helpers/nav");
  return {
    headers: async () => ({
      get: (key: string) => (key === "x-hero-photo-slug" ? headerState.heroSlug : null),
    }),
    cookies: async () => ({
      get: (key: string) => {
        const value = headerState.cookie[key];
        if (!value) return undefined;
        return { value };
      },
    }),
  };
});

Object.defineProperty(globalThis, "matchMedia", {
  writable: true,
  configurable: true,
  value: (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
    addListener: () => undefined,
    removeListener: () => undefined,
    dispatchEvent: () => false,
  }),
});

class ResizeObserverStub {
  observe(): void {}
  unobserve(): void {}
  disconnect(): void {}
}
globalThis.ResizeObserver = ResizeObserverStub;

Object.defineProperty(Range.prototype, "getBoundingClientRect", {
  configurable: true,
  value: () => ({ left: 0, top: 0, width: 0, height: 0 }),
});

if (typeof URL.createObjectURL !== "function") {
  URL.createObjectURL = () => "blob:mock";
}
if (typeof URL.revokeObjectURL !== "function") {
  URL.revokeObjectURL = () => undefined;
}

if (typeof globalThis.crypto.randomUUID !== "function") {
  Object.defineProperty(globalThis.crypto, "randomUUID", {
    configurable: true,
    value: () => "00000000-0000-4000-8000-000000000000",
  });
}

vi.stubGlobal("requestAnimationFrame", () => 1);
vi.stubGlobal("cancelAnimationFrame", () => undefined);
