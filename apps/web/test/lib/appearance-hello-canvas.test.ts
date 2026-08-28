import { describe, it, expect, beforeEach } from "vitest";
import { readState, syncCanvasSize, helloCenterY } from "@/lib/appearance-hello-canvas";

function makeCanvas(w = 100, h = 100): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  return canvas;
}

function makeLab(overrides: Record<string, string> = {}): HTMLElement {
  const lab = document.createElement("div");
  Object.assign(lab.dataset, { ultra: "off", resolved: "dark", ...overrides });
  return lab;
}

describe("readState", () => {
  it("reads ultra=on from dataset", () => {
    const lab = makeLab({ ultra: "on", resolved: "light" });
    const state = readState(lab);
    expect(state.ultra).toBe(true);
    expect(state.resolved).toBe("light");
  });

  it("ultra defaults to false when not 'on'", () => {
    const lab = makeLab({ ultra: "off" });
    const state = readState(lab);
    expect(state.ultra).toBe(false);
  });

  it("resolved defaults to 'dark' when not 'light'", () => {
    const lab = makeLab({ resolved: "anything" });
    const state = readState(lab);
    expect(state.resolved).toBe("dark");
  });

  it("reads scale from --ultra-scale CSS property", () => {
    const lab = makeLab();
    lab.style.setProperty("--ultra-scale", "2.5");
    const state = readState(lab);
    expect(state.scale).toBeCloseTo(2.5, 4);
  });

  it("defaults scale to 1 when not set", () => {
    const lab = makeLab();
    const state = readState(lab);
    expect(state.scale).toBe(1);
  });

  it("defaults scale to 1 for non-finite value", () => {
    const lab = makeLab();
    lab.style.setProperty("--ultra-scale", "NaN");
    const state = readState(lab);
    expect(state.scale).toBe(1);
  });
});

describe("syncCanvasSize", () => {
  beforeEach(() => {
    Object.defineProperty(window, "devicePixelRatio", { value: 1, configurable: true });
  });

  it("returns false when size unchanged", () => {
    const canvas = makeCanvas(100, 100);
    expect(syncCanvasSize(canvas, 100, 100)).toBe(false);
  });

  it("returns true and updates size on change", () => {
    const canvas = makeCanvas(50, 50);
    const changed = syncCanvasSize(canvas, 200, 300);
    expect(changed).toBe(true);
    expect(canvas.width).toBe(200);
    expect(canvas.height).toBe(300);
  });

  it("clamps dpr to 2", () => {
    Object.defineProperty(window, "devicePixelRatio", { value: 4, configurable: true });
    const canvas = makeCanvas(1, 1);
    syncCanvasSize(canvas, 100, 100);
    expect(canvas.width).toBe(200);
    expect(canvas.height).toBe(200);
  });

  it("falls back to dpr=1 when devicePixelRatio is 0", () => {
    Object.defineProperty(window, "devicePixelRatio", { value: 0, configurable: true });
    const canvas = makeCanvas(1, 1);
    syncCanvasSize(canvas, 100, 100);
    expect(canvas.width).toBe(100);
    expect(canvas.height).toBe(100);
  });
});

describe("helloCenterY", () => {
  it("returns cssH/2 when .appearance-main is not found", () => {
    const lab = document.createElement("div");
    expect(helloCenterY(lab, 400)).toBe(200);
  });

  it("returns center of .appearance-main relative to lab", () => {
    const lab = document.createElement("div");
    const main = document.createElement("div");
    main.className = "appearance-main";
    lab.appendChild(main);
    // jsdom getBoundingClientRect returns zeros by default
    // so center = 0 - 0 + 0/2 = 0
    expect(helloCenterY(lab, 400)).toBe(0);
  });
});
