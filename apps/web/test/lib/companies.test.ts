import { describe, it, expect } from "vitest";
import { COMPANIES, companyBySlug, logoGainmapSrcset } from "@/lib/logos/companies";

describe("COMPANIES", () => {
  it("is a non-empty array", () => {
    expect(Array.isArray(COMPANIES)).toBe(true);
    expect(COMPANIES.length).toBeGreaterThan(0);
  });

  it("every entry has required fields", () => {
    for (const c of COMPANIES) {
      expect(typeof c.name).toBe("string");
      expect(typeof c.slug).toBe("string");
      expect(typeof c.rank).toBe("number");
      expect(typeof c.svgPath).toBe("string");
      expect(typeof c.gainmapPath).toBe("string");
    }
  });
});

describe("companyBySlug", () => {
  it("returns company for existing slug", () => {
    const first = COMPANIES[0]!;
    expect(companyBySlug(first.slug)).toBe(first);
  });

  it("returns undefined for missing slug", () => {
    expect(companyBySlug("no-such-company")).toBeUndefined();
  });
});

describe("logoGainmapSrcset", () => {
  it("contains four width variants", () => {
    const company = COMPANIES[0]!;
    const parts = logoGainmapSrcset(company).split(", ");
    expect(parts.length).toBe(4);
  });

  it("contains 128w 256w 512w 1024w", () => {
    const company = COMPANIES[0]!;
    const src = logoGainmapSrcset(company);
    expect(src).toContain("128w");
    expect(src).toContain("256w");
    expect(src).toContain("512w");
    expect(src).toContain("1024w");
  });
});
