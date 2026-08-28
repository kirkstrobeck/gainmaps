import { describe, it, expect } from "vitest";
import {
  isSvgFile,
  isAnimatedSvg,
  parseSvgLength,
  viewBoxSize,
  clampRasterSize,
  parseClock,
  parseList,
  keyframeIndex,
  stripExtension,
} from "@/lib/svg-raster-pure";

describe("isSvgFile", () => {
  it("returns true for image/svg+xml mime type", () => {
    const file = new File([""], "icon.svg", { type: "image/svg+xml" });
    expect(isSvgFile(file)).toBe(true);
  });

  it("returns true for .svg extension regardless of mime type", () => {
    const file = new File([""], "icon.svg", { type: "application/octet-stream" });
    expect(isSvgFile(file)).toBe(true);
  });

  it("returns true for uppercase .SVG extension", () => {
    const file = new File([""], "ICON.SVG", { type: "" });
    expect(isSvgFile(file)).toBe(true);
  });

  it("returns false for PNG", () => {
    const file = new File([""], "photo.png", { type: "image/png" });
    expect(isSvgFile(file)).toBe(false);
  });
});

describe("isAnimatedSvg", () => {
  it("detects <animate> element", () => {
    expect(isAnimatedSvg("<svg><animate attributeName='x' /></svg>")).toBe(true);
  });

  it("detects <animateTransform> element", () => {
    expect(isAnimatedSvg("<svg><animateTransform type='rotate' /></svg>")).toBe(true);
  });

  it("detects <set> element", () => {
    expect(isAnimatedSvg("<svg><set attributeName='display' /></svg>")).toBe(true);
  });

  it("detects @keyframes in style", () => {
    expect(isAnimatedSvg("<svg><style>@keyframes spin { }</style></svg>")).toBe(true);
  });

  it("detects CSS animation property", () => {
    expect(isAnimatedSvg("<svg><rect style='animation: spin 1s' /></svg>")).toBe(true);
  });

  it("returns false for static SVG", () => {
    expect(isAnimatedSvg("<svg><rect width='100' height='100' /></svg>")).toBe(false);
  });
});

describe("parseSvgLength", () => {
  it("parses plain number", () => expect(parseSvgLength("200")).toBe(200));
  it("parses number with px unit", () => expect(parseSvgLength("200px")).toBe(200));
  it("returns null for percentage", () => expect(parseSvgLength("50%")).toBeNull());
  it("returns null for zero", () => expect(parseSvgLength("0")).toBeNull());
  it("returns null for negative", () => expect(parseSvgLength("-10")).toBeNull());
  it("returns null for null input", () => expect(parseSvgLength(null)).toBeNull());
  it("returns null for empty string", () => expect(parseSvgLength("")).toBeNull());
});

describe("viewBoxSize", () => {
  it("parses space-separated viewBox", () => {
    expect(viewBoxSize("0 0 100 200")).toEqual({ width: 100, height: 200 });
  });

  it("parses comma-separated viewBox", () => {
    expect(viewBoxSize("0,0,300,400")).toEqual({ width: 300, height: 400 });
  });

  it("returns null for null input", () => expect(viewBoxSize(null)).toBeNull());
  it("returns null for zero dimensions", () => expect(viewBoxSize("0 0 0 0")).toBeNull());
  it("returns null for incomplete viewBox", () => expect(viewBoxSize("0 0 100")).toBeNull());
});

describe("clampRasterSize", () => {
  it("scales small images up to MIN_EDGE=1024", () => {
    const { width, height } = clampRasterSize(100, 100);
    expect(width).toBe(1024);
    expect(height).toBe(1024);
  });

  it("scales large images down to MAX_EDGE=4096", () => {
    const { width, height } = clampRasterSize(8000, 8000);
    expect(width).toBe(4096);
    expect(height).toBe(4096);
  });

  it("preserves aspect ratio on scale-up", () => {
    const { width, height } = clampRasterSize(100, 200);
    expect(width / height).toBeCloseTo(0.5, 1);
  });

  it("does not scale images that are already in range", () => {
    const { width, height } = clampRasterSize(1024, 2048);
    expect(width).toBe(1024);
    expect(height).toBe(2048);
  });
});

describe("parseClock", () => {
  it("parses plain seconds", () => expect(parseClock("2")).toBe(2));
  it("parses seconds with unit", () => expect(parseClock("1.5s")).toBe(1.5));
  it("parses milliseconds", () => expect(parseClock("500ms")).toBe(0.5));
  it("returns 0 for null", () => expect(parseClock(null)).toBe(0));
  it("returns 0 for non-numeric", () => expect(parseClock("abc")).toBe(0));
  it("returns 0 for empty string", () => expect(parseClock("")).toBe(0));
});

describe("parseList", () => {
  it("splits semicolon-separated values", () => {
    expect(parseList("a;b;c")).toEqual(["a", "b", "c"]);
  });

  it("trims whitespace from each value", () => {
    expect(parseList(" a ; b ; c ")).toEqual(["a", "b", "c"]);
  });

  it("filters empty entries", () => {
    expect(parseList("a;;b")).toEqual(["a", "b"]);
  });

  it("returns empty array for null", () => expect(parseList(null)).toEqual([]));
});

describe("keyframeIndex", () => {
  it("returns 0 for progress before first keyframe", () => {
    expect(keyframeIndex(0, [0, 0.5, 1])).toBe(0);
  });

  it("returns last index when progress is 1", () => {
    expect(keyframeIndex(1, [0, 0.5, 1])).toBe(2);
  });

  it("returns correct index for mid-progress", () => {
    expect(keyframeIndex(0.5, [0, 0.25, 0.5, 0.75, 1])).toBe(2);
  });

  it("handles single keyframe", () => {
    expect(keyframeIndex(0.5, [0])).toBe(0);
  });
});

describe("stripExtension", () => {
  it("removes .svg extension", () => expect(stripExtension("icon.svg")).toBe("icon"));
  it("removes .png extension", () => expect(stripExtension("photo.png")).toBe("photo"));
  it("handles multiple dots — removes last extension", () => {
    expect(stripExtension("my.icon.svg")).toBe("my.icon");
  });
  it("returns name unchanged if no extension", () => expect(stripExtension("noext")).toBe("noext"));
});
