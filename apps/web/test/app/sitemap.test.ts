import { describe, it, expect } from "vitest";
import sitemap from "@/app/sitemap";
import { COMPANIES } from "@/lib/logos/companies";
import { PHOTOS } from "@/lib/photos/catalog";

describe("sitemap", () => {
  const entries = sitemap();

  it("returns an array", () => {
    expect(Array.isArray(entries)).toBe(true);
  });

  it("includes the home page entry", () => {
    const home = entries.find((e) => e.url === "https://www.gainmaps.com");
    expect(home).toBeDefined();
    expect(home?.priority).toBe(1.0);
  });

  it("includes all static routes", () => {
    const urls = entries.map((e) => e.url);
    expect(urls).toContain("https://www.gainmaps.com/convert");
    expect(urls).toContain("https://www.gainmaps.com/docs");
    expect(urls).toContain("https://www.gainmaps.com/photos");
    expect(urls).toContain("https://www.gainmaps.com/logos");
    expect(urls).toContain("https://www.gainmaps.com/text");
    expect(urls).not.toContain("https://www.gainmaps.com/community");
    expect(urls).toContain("https://www.gainmaps.com/appearance");
  });

  it("includes a logo entry for each company", () => {
    const logoUrls = entries
      .map((e) => e.url)
      .filter((u) => u.startsWith("https://www.gainmaps.com/logos/"));
    expect(logoUrls.length).toBe(COMPANIES.length);
  });

  it("includes a photo entry for each catalog photo", () => {
    const photoUrls = entries
      .map((e) => e.url)
      .filter((u) => u.startsWith("https://www.gainmaps.com/photos/"));
    expect(photoUrls.length).toBe(PHOTOS.length);
  });

  it("total count equals statics + companies + photos", () => {
    const STATIC_COUNT = 12; // /, /convert, /convert/how-it-works, /docs, /logos, /photos, /text, /appearance, /developers, /about, /contact, /privacy
    expect(entries.length).toBe(STATIC_COUNT + COMPANIES.length + PHOTOS.length);
  });

  it("uses changeFrequency monthly for all entries", () => {
    expect(entries.every((e) => e.changeFrequency === "monthly")).toBe(true);
  });
});
