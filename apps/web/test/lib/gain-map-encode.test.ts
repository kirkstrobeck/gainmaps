import { describe, it, expect } from "vitest";
import * as encode from "@/lib/gain-map-encode";

describe("gain-map-encode re-export", () => {
  it("forwards headroomFromBoost and named encode helpers", () => {
    expect(encode.headroomFromBoost(0.5)).toBe(1 + 0.5 * 3);
    expect(encode.DEFAULT_PHOTO_HEADROOM).toBe(3.34);
    expect(typeof encode.encodeRgbaToUltraHdrJpeg).toBe("function");
    expect(typeof encode.encodeKeepBaseGainMap).toBe("function");
    expect(typeof encode.applyHighlightSelectiveHdr).toBe("function");
    expect(typeof encode.applyWindowGainCalibration).toBe("function");
    expect(typeof encode.flattenRgbaOntoCheckerboard).toBe("function");
    expect(typeof encode.flattenRgbaOntoWhite).toBe("function");
    expect(encode.WINDOW_GAIN_CALIBRATION).toEqual({ gain: 1 });
  });
});
