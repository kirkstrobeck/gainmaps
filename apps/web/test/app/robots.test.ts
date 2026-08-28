import { describe, it, expect } from "vitest";
import robots from "@/app/robots";

describe("robots", () => {
  it("allows all user agents", () => {
    const result = robots();
    expect((result.rules as { userAgent: string }).userAgent).toBe("*");
    expect((result.rules as { allow: string }).allow).toBe("/");
  });

  it("includes sitemap URL", () => {
    const result = robots();
    expect(result.sitemap).toBe("https://www.gainmaps.com/sitemap.xml");
  });

  it("declares the canonical host", () => {
    const result = robots();
    expect(result.host).toBe("https://www.gainmaps.com");
  });
});
