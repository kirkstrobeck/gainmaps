import { describe, it, expect } from "vitest";
import { GET as photosGET } from "@/app/api/photos/route";
import { GET as photoSlugGET } from "@/app/api/photos/[slug]/route";

describe("GET /api/photos", () => {
  it("returns 200 with an array", async () => {
    const res = await photosGET();
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(Array.isArray(data)).toBe(true);
    expect(data.length).toBeGreaterThan(0);
    expect(data[0]).toHaveProperty("slug");
    expect(data[0]).toHaveProperty("gainmapSrc");
    expect(data[0]).toHaveProperty("standardSrc");
  });

  it("has CORS header", async () => {
    const res = await photosGET();
    expect(res.headers.get("access-control-allow-origin")).toBe("*");
  });
});

describe("GET /api/photos/[slug]", () => {
  it("returns 200 for valid slug", async () => {
    const slug = "a-seal-rests-on-a-shallow-sandbar-in-calm-water";
    const res = await photoSlugGET(new Request(`http://localhost/api/photos/${slug}`), {
      params: Promise.resolve({ slug }),
    });
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.slug).toBe(slug);
  });

  it("returns 404 for invalid slug", async () => {
    const res = await photoSlugGET(new Request("http://localhost/api/photos/no-such-photo"), {
      params: Promise.resolve({ slug: "no-such-photo" }),
    });
    expect(res.status).toBe(404);
    const data = await res.json();
    expect(data.error.code).toBe("NOT_FOUND");
  });
});
