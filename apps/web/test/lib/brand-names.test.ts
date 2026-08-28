import { describe, it, expect } from "vitest";
import { BRAND_NAMES } from "@/lib/brand-names";

describe("BRAND_NAMES", () => {
  it("is a non-empty array", () => {
    expect(Array.isArray(BRAND_NAMES)).toBe(true);
    expect(BRAND_NAMES.length).toBeGreaterThan(0);
  });

  it("every entry has required fields", () => {
    for (const row of BRAND_NAMES) {
      expect(typeof row.name).toBe("string");
      expect(typeof row.fullName).toBe("string");
      expect(typeof row.platform).toBe("string");
      expect(typeof row.meaning).toBe("string");
    }
  });

  it("contains HDR entry", () => {
    const hdr = BRAND_NAMES.find((r) => r.name === "HDR");
    expect(hdr).toBeDefined();
  });
});
