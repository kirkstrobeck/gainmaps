import { describe, it, expect, vi, afterEach } from "vitest";
import { rasterizeSvgToPng } from "@/lib/svg-raster";

class FakeImage {
  onload: (() => void) | null = null;
  onerror: (() => void) | null = null;
  set src(_value: string) {
    queueMicrotask(() => this.onload?.());
  }
}

class FailingImage extends FakeImage {
  override set src(_value: string) {
    queueMicrotask(() => this.onerror?.());
  }
}

describe("rasterizeSvgToPng", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("rasterizes static SVG markup to a PNG file", async () => {
    vi.stubGlobal("Image", FakeImage);
    URL.createObjectURL = vi.fn(() => "blob:svg");
    URL.revokeObjectURL = vi.fn();
    HTMLCanvasElement.prototype.getContext = () =>
      ({
        clearRect: vi.fn(),
        drawImage: vi.fn(),
      }) as unknown as CanvasRenderingContext2D;
    HTMLCanvasElement.prototype.toBlob = (cb: BlobCallback) => cb(new Blob(["png"], { type: "image/png" }));
    const file = new File(
      ['<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10"></svg>'],
      "mark.svg",
      { type: "image/svg+xml" },
    );
    const out = await rasterizeSvgToPng(file);
    expect(out.type).toBe("image/png");
    expect(out.name).toBe("mark.png");
  });

  it("freezes animated SVG markup before rasterizing", async () => {
    vi.stubGlobal("Image", FakeImage);
    URL.createObjectURL = vi.fn(() => "blob:svg");
    URL.revokeObjectURL = vi.fn();
    HTMLCanvasElement.prototype.getContext = () =>
      ({
        clearRect: vi.fn(),
        drawImage: vi.fn(),
      }) as unknown as CanvasRenderingContext2D;
    HTMLCanvasElement.prototype.toBlob = (cb: BlobCallback) => cb(new Blob(["png"]));
    const file = new File(
      ['<svg xmlns="http://www.w3.org/2000/svg"><animate attributeName="x" /></svg>'],
      "spin.svg",
      { type: "image/svg+xml" },
    );
    const out = await rasterizeSvgToPng(file);
    expect(out.name).toBe("spin.png");
  });

  it("rejects when the browser cannot decode the SVG", async () => {
    vi.stubGlobal("Image", FailingImage);
    URL.createObjectURL = vi.fn(() => "blob:svg");
    URL.revokeObjectURL = vi.fn();
    const file = new File(["<svg></svg>"], "bad.svg", { type: "image/svg+xml" });
    await expect(rasterizeSvgToPng(file)).rejects.toThrow(/could not decode/);
  });

  it("rejects when a 2d context cannot be created", async () => {
    vi.stubGlobal("Image", FakeImage);
    URL.createObjectURL = vi.fn(() => "blob:svg");
    URL.revokeObjectURL = vi.fn();
    HTMLCanvasElement.prototype.getContext = () => null;
    const file = new File(
      ['<svg xmlns="http://www.w3.org/2000/svg" width="4" height="4"></svg>'],
      "mark.svg",
      { type: "image/svg+xml" },
    );
    await expect(rasterizeSvgToPng(file)).rejects.toThrow(/Could not create a canvas/);
  });

  it("rejects when toBlob returns null", async () => {
    vi.stubGlobal("Image", FakeImage);
    URL.createObjectURL = vi.fn(() => "blob:svg");
    URL.revokeObjectURL = vi.fn();
    HTMLCanvasElement.prototype.getContext = () =>
      ({
        clearRect: vi.fn(),
        drawImage: vi.fn(),
      }) as unknown as CanvasRenderingContext2D;
    HTMLCanvasElement.prototype.toBlob = (cb: BlobCallback) => cb(null);
    const file = new File(
      ['<svg xmlns="http://www.w3.org/2000/svg" width="4" height="4"></svg>'],
      "mark.svg",
      { type: "image/svg+xml" },
    );
    await expect(rasterizeSvgToPng(file)).rejects.toThrow(/rasterization failed/);
  });
});
