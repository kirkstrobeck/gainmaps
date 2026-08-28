import { describe, it, expect } from "vitest";
import {
  parseSvgRoot,
  sanitizeSvgRoot,
  serializeSvgRoot,
  prepareSvgRoot,
  svgRasterSize,
  previewSvgMarkup,
  freezeAnimatedSvgMarkup,
} from "@/lib/svg-raster-dom";

const SIMPLE_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="100" height="200"><rect width="100" height="200"/></svg>`;
const VIEWBOX_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 300"><rect width="400" height="300"/></svg>`;
const TINY_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10"><rect width="10" height="10"/></svg>`;

describe("parseSvgRoot", () => {
  it("parses a valid SVG", () => {
    const root = parseSvgRoot(SIMPLE_SVG);
    expect(root.tagName.toLowerCase()).toBe("svg");
  });

  it("throws on malformed SVG", () => {
    expect(() => parseSvgRoot("not xml at all<<<")).toThrow("SVG could not be parsed.");
  });

  it("throws when root tag is not svg", () => {
    expect(() => parseSvgRoot("<div></div>")).toThrow("File is not a valid SVG document.");
  });
});

describe("sanitizeSvgRoot", () => {
  it("removes <script> elements", () => {
    const svgText = `<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script><rect/></svg>`;
    const root = sanitizeSvgRoot(svgText);
    expect(root.querySelector("script")).toBeNull();
  });

  it("removes on* event handlers", () => {
    const svgText = `<svg xmlns="http://www.w3.org/2000/svg"><rect onclick="alert(1)"/></svg>`;
    const root = sanitizeSvgRoot(svgText);
    const rect = root.querySelector("rect");
    expect(rect?.getAttribute("onclick")).toBeNull();
  });

  it("preserves normal attributes", () => {
    const svgText = `<svg xmlns="http://www.w3.org/2000/svg"><rect width="10" fill="red"/></svg>`;
    const root = sanitizeSvgRoot(svgText);
    expect(root.querySelector("rect")?.getAttribute("fill")).toBe("red");
  });
});

describe("serializeSvgRoot", () => {
  it("returns a string containing svg markup", () => {
    const root = parseSvgRoot(SIMPLE_SVG);
    const result = serializeSvgRoot(root);
    expect(result).toContain("<svg");
    expect(result).toContain("</svg>");
  });
});

describe("prepareSvgRoot", () => {
  it("sets width and height from size", () => {
    const root = prepareSvgRoot(VIEWBOX_SVG, { width: 800, height: 600 });
    expect(root.getAttribute("width")).toBe("800");
    expect(root.getAttribute("height")).toBe("600");
  });

  it("adds xmlns if missing", () => {
    const root = prepareSvgRoot(SIMPLE_SVG, { width: 100, height: 100 });
    expect(root.getAttribute("xmlns")).toBe("http://www.w3.org/2000/svg");
  });

  it("adds viewBox from size if not present", () => {
    const noViewBox = `<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100"><rect/></svg>`;
    const root = prepareSvgRoot(noViewBox, { width: 200, height: 300 });
    expect(root.getAttribute("viewBox")).toBe("0 0 200 300");
  });
});

describe("svgRasterSize", () => {
  it("reads width and height attributes and clamps", () => {
    const size = svgRasterSize(SIMPLE_SVG);
    // 100x200 → min edge 100, scale to 1024 → 1024x2048, max edge 2048 ≤ 4096 so no down-scale
    expect(size.width).toBe(1024);
    expect(size.height).toBe(2048);
  });

  it("uses viewBox when no explicit size", () => {
    const size = svgRasterSize(VIEWBOX_SVG);
    // 400x300 → min edge 300, scale to 1024 → 1365x1024
    expect(size.width).toBeGreaterThan(1000);
    expect(size.height).toBe(1024);
  });

  it("returns minimum fallback for SVG with no size info", () => {
    const noSize = `<svg xmlns="http://www.w3.org/2000/svg"><rect/></svg>`;
    const size = svgRasterSize(noSize);
    expect(size.width).toBe(1024);
    expect(size.height).toBe(1024);
  });

  it("falls back to width-only dimension", () => {
    const widthOnly = `<svg xmlns="http://www.w3.org/2000/svg" width="200"><rect/></svg>`;
    const size = svgRasterSize(widthOnly);
    expect(size.width).toBe(1024);
    expect(size.height).toBe(1024);
  });

  it("falls back to height-only dimension", () => {
    const heightOnly = `<svg xmlns="http://www.w3.org/2000/svg" height="200"><rect/></svg>`;
    const size = svgRasterSize(heightOnly);
    expect(size.width).toBe(1024);
    expect(size.height).toBe(1024);
  });
});

describe("previewSvgMarkup", () => {
  it("returns SVG string with 100% dimensions", () => {
    const result = previewSvgMarkup(SIMPLE_SVG);
    expect(result).toContain('width="100%"');
    expect(result).toContain('height="100%"');
  });

  it("sets preserveAspectRatio", () => {
    const result = previewSvgMarkup(SIMPLE_SVG);
    expect(result).toContain("xMidYMid meet");
  });

  it("adds viewBox from width/height when not already present", () => {
    const result = previewSvgMarkup(SIMPLE_SVG);
    expect(result).toContain("viewBox");
  });

  it("strips script tags", () => {
    const dangerous = `<svg xmlns="http://www.w3.org/2000/svg"><script>x</script></svg>`;
    const result = previewSvgMarkup(dangerous);
    expect(result).not.toContain("<script");
  });
});

describe("freezeAnimatedSvgMarkup", () => {
  it("returns a string with the animated elements removed", () => {
    const animated = `<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100">
      <rect width="10" height="10">
        <animate attributeName="x" values="0;50;0" dur="2s" />
      </rect>
    </svg>`;
    const result = freezeAnimatedSvgMarkup(animated, { width: 100, height: 100 });
    expect(result).not.toContain("<animate");
    expect(result).toContain("<svg");
  });

  it("accepts explicit sample seconds", () => {
    const animated = `<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100">
      <rect><animate attributeName="x" values="0;100" dur="2s" /></rect>
    </svg>`;
    const result = freezeAnimatedSvgMarkup(animated, { width: 100, height: 100 }, 2);
    expect(result).toContain('x="100"');
  });

  it("freezes animateTransform elements", () => {
    const animated = `<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100">
      <rect>
        <animateTransform attributeName="transform" type="rotate" values="0;90" dur="2s" />
      </rect>
    </svg>`;
    const result = freezeAnimatedSvgMarkup(animated, { width: 100, height: 100 }, 2);
    expect(result).not.toContain("animateTransform");
    expect(result).toContain("rotate");
  });

  it("removes animateMotion and set elements", () => {
    const animated = `<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100">
      <rect>
        <animateMotion dur="2s" path="M0,0 L100,100" />
        <set attributeName="display" to="none" dur="2s" />
      </rect>
    </svg>`;
    const result = freezeAnimatedSvgMarkup(animated, { width: 100, height: 100 }, 1);
    expect(result).not.toContain("animateMotion");
    expect(result).not.toContain("<set");
  });

  it("auto-detects keyTimes from keyTimes attribute", () => {
    // keyTimes are present and length matches values — should be used directly
    const animated = `<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100">
      <rect>
        <animate attributeName="x" values="0;50;100" keyTimes="0;0.25;1" dur="4s" />
      </rect>
    </svg>`;
    // pickSampleSeconds finds keyTimes=[0,0.25,1], min interior = 0.25, so sample=0.25*4=1s
    // at 1s: progress=0.25, keyframe at index 1, x="50"
    const result = freezeAnimatedSvgMarkup(animated, { width: 100, height: 100 });
    expect(result).toContain('x="50"');
  });

  it("freezes animateTransform with scale (single value)", () => {
    const animated = `<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100">
      <rect>
        <animateTransform attributeName="transform" type="scale" values="1;2" dur="2s" />
      </rect>
    </svg>`;
    const result = freezeAnimatedSvgMarkup(animated, { width: 100, height: 100 }, 2);
    expect(result).toContain("scale(2)");
  });

  it("freezes animateTransform with scale (two values)", () => {
    const animated = `<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100">
      <rect>
        <animateTransform attributeName="transform" type="scale" values="1 1;2 3" dur="2s" />
      </rect>
    </svg>`;
    const result = freezeAnimatedSvgMarkup(animated, { width: 100, height: 100 }, 2);
    expect(result).toContain("scale(2 3)");
  });

  it("freezes animateTransform with skewX", () => {
    const animated = `<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100">
      <rect>
        <animateTransform attributeName="transform" type="skewX" values="0;30" dur="2s" />
      </rect>
    </svg>`;
    const result = freezeAnimatedSvgMarkup(animated, { width: 100, height: 100 }, 2);
    expect(result).toContain("skewX(30)");
  });

  it("freezes animateTransform with skewY", () => {
    const animated = `<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100">
      <rect>
        <animateTransform attributeName="transform" type="skewY" values="0;45" dur="2s" />
      </rect>
    </svg>`;
    const result = freezeAnimatedSvgMarkup(animated, { width: 100, height: 100 }, 2);
    expect(result).toContain("skewY(45)");
  });

  it("returns null transform for unknown animateTransform type", () => {
    const animated = `<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100">
      <rect>
        <animateTransform attributeName="transform" type="unknown" values="0;1" dur="2s" />
      </rect>
    </svg>`;
    const result = freezeAnimatedSvgMarkup(animated, { width: 100, height: 100 }, 2);
    expect(result).not.toContain("animateTransform");
  });

  it("freezes animateTransform with explicit translate type", () => {
    const animated = `<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100">
      <rect>
        <animateTransform attributeName="transform" type="translate" values="50 50;0 0" dur="2s" />
      </rect>
    </svg>`;
    const result = freezeAnimatedSvgMarkup(animated, { width: 100, height: 100 }, 2);
    expect(result).toContain("translate(0 0)");
  });

  it("freezes animateTransform with default type (no type attr → translate)", () => {
    const animated = `<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100">
      <rect>
        <animateTransform attributeName="transform" values="50 50;10 20" dur="2s" />
      </rect>
    </svg>`;
    const result = freezeAnimatedSvgMarkup(animated, { width: 100, height: 100 }, 2);
    expect(result).toContain("translate(10 20)");
  });

  it("freezes rotate animateTransform with cx and cy (3 params)", () => {
    const animated = `<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100">
      <rect>
        <animateTransform attributeName="transform" type="rotate" values="0 50 50;90 50 50" dur="2s" />
      </rect>
    </svg>`;
    const result = freezeAnimatedSvgMarkup(animated, { width: 100, height: 100 }, 2);
    expect(result).toContain("rotate(90 50 50)");
  });

  it("freezes rotate animateTransform to zero angle (|| 0 fallback)", () => {
    const animated = `<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100">
      <rect>
        <animateTransform attributeName="transform" type="rotate" values="90;0" dur="2s" />
      </rect>
    </svg>`;
    const result = freezeAnimatedSvgMarkup(animated, { width: 100, height: 100 }, 2);
    expect(result).toContain("rotate(0)"); // 0 || 0 = 0
  });

  it("freezes scale animateTransform to zero (|| 1 fallback)", () => {
    const animated = `<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100">
      <rect>
        <animateTransform attributeName="transform" type="scale" values="2;0" dur="2s" />
      </rect>
    </svg>`;
    const result = freezeAnimatedSvgMarkup(animated, { width: 100, height: 100 }, 2);
    expect(result).toContain("scale(1)"); // 0 || 1 = 1
  });

  it("returns null transform when animateTransform has no values and no to attribute", () => {
    const animated = `<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100">
      <rect>
        <animateTransform attributeName="transform" type="rotate" dur="2s" />
      </rect>
    </svg>`;
    // valueAt returns null → transformFromAnimateTransform returns null → no transform set
    const result = freezeAnimatedSvgMarkup(animated, { width: 100, height: 100 }, 1);
    expect(result).not.toContain("animateTransform");
    expect(result).not.toContain('transform="rotate');
  });

  it("freezes skewX animateTransform to zero (|| 0 fallback)", () => {
    const animated = `<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100">
      <rect>
        <animateTransform attributeName="transform" type="skewX" values="30;0" dur="2s" />
      </rect>
    </svg>`;
    const result = freezeAnimatedSvgMarkup(animated, { width: 100, height: 100 }, 2);
    expect(result).toContain("skewX(0)");
  });

  it("freezes skewY animateTransform to zero (|| 0 fallback)", () => {
    const animated = `<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100">
      <rect>
        <animateTransform attributeName="transform" type="skewY" values="45;0" dur="2s" />
      </rect>
    </svg>`;
    const result = freezeAnimatedSvgMarkup(animated, { width: 100, height: 100 }, 2);
    expect(result).toContain("skewY(0)");
  });

  it("freezeAnimatedSvgMarkup on non-animated SVG picks seconds=0 via pickSampleSeconds", () => {
    // No animate elements → pickSampleSeconds returns 0 (early return for empty nodes)
    const result = freezeAnimatedSvgMarkup(SIMPLE_SVG, { width: 100, height: 100 });
    expect(result).toContain("<svg");
    expect(result).not.toContain("<animate");
  });
});
