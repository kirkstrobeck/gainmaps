import { describe, it, expect } from "vitest";
import { GET as logosGET } from "@/app/api/logos/route";
import { GET as logoSlugGET } from "@/app/api/logos/[slug]/route";

describe("GET /api/logos", () => {
  it("returns 200 with an array", async () => {
    const res = await logosGET();
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(Array.isArray(data)).toBe(true);
    expect(data.length).toBeGreaterThan(0);
    expect(data[0]).toHaveProperty("slug");
    expect(data[0]).toHaveProperty("svgPath");
  });

  it("has CORS header", async () => {
    const res = await logosGET();
    expect(res.headers.get("access-control-allow-origin")).toBe("*");
  });
});

describe("GET /api/logos/[slug]", () => {
  it("returns 200 for valid slug", async () => {
    const res = await logoSlugGET(new Request("http://localhost/api/logos/instagram"), {
      params: Promise.resolve({ slug: "instagram" }),
    });
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.slug).toBe("instagram");
  });

  it("returns 404 for invalid slug", async () => {
    const res = await logoSlugGET(new Request("http://localhost/api/logos/no-such-logo"), {
      params: Promise.resolve({ slug: "no-such-logo" }),
    });
    expect(res.status).toBe(404);
    const data = await res.json();
    expect(data.error.code).toBe("NOT_FOUND");
  });
});
