import { describe, it, expect } from "vitest";
import { GET } from "@/app/api/markdown/route";
import { NextRequest } from "next/server";
import { markdownForPath } from "@/lib/page-markdown";

describe("GET /api/markdown", () => {
  it("returns 200 with text/markdown for /", async () => {
    const req = new NextRequest("http://localhost/api/markdown?path=/");
    const res = await GET(req);
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("text/markdown");
  });

  it("has Vary: Accept, Accept-Encoding header", async () => {
    const req = new NextRequest("http://localhost/api/markdown?path=/");
    const res = await GET(req);
    expect(res.headers.get("vary")).toBe("Accept, Accept-Encoding");
  });

  it("returns markdown content with # heading for /about", async () => {
    const req = new NextRequest("http://localhost/api/markdown?path=/about");
    const res = await GET(req);
    expect(res.status).toBe(200);
    const text = await res.text();
    expect(text).toContain("# About");
  });

  it("returns markdown content for /contact", async () => {
    const req = new NextRequest("http://localhost/api/markdown?path=/contact");
    const res = await GET(req);
    expect(res.status).toBe(200);
    const text = await res.text();
    expect(text).toContain("# Contact");
  });

  it("returns markdown content for /privacy", async () => {
    const req = new NextRequest("http://localhost/api/markdown?path=/privacy");
    const res = await GET(req);
    expect(res.status).toBe(200);
  });

  it("returns 404 JSON for unknown path", async () => {
    const req = new NextRequest("http://localhost/api/markdown?path=/unknown");
    const res = await GET(req);
    expect(res.status).toBe(404);
    const data = await res.json();
    expect(data.error.code).toBe("NOT_FOUND");
  });

  it("returns 404 JSON when path is omitted", async () => {
    const req = new NextRequest("http://localhost/api/markdown");
    const res = await GET(req);
    expect(res.status).toBe(404);
  });
});

describe("markdownForPath", () => {
  it("returns null when the path has no markdown body", () => {
    expect(markdownForPath("/no-such-page")).toBeNull();
  });
});
