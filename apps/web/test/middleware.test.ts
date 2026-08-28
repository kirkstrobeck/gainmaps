import { describe, expect, it } from "vitest";
import { NextRequest } from "next/server";

import { MARKDOWN_PATHS } from "@/lib/page-markdown";
import { middleware } from "@/middleware";

function request(path: string, accept: string): NextRequest {
  return new NextRequest(new URL(path, "https://www.gainmaps.com"), {
    headers: { accept },
  });
}

function varyTokens(response: Response): readonly string[] {
  const vary = response.headers.get("vary");
  if (!vary) return [];
  return vary.split(",").map((part) => part.trim().toLowerCase());
}

describe("markdown-path HTML responses advertise Vary: Accept", () => {
  for (const path of MARKDOWN_PATHS) {
    it(`${path} HTML Vary contains Accept`, () => {
      const response = middleware(request(path, "text/html"));
      expect(varyTokens(response)).toContain("accept");
    });
  }

  it("does not require Vary: Accept on paths without a markdown variant", () => {
    const response = middleware(request("/convert", "text/html"));
    expect(varyTokens(response)).not.toContain("accept");
  });
});

describe("markdown Accept still rewrites MARKDOWN_PATHS", () => {
  for (const path of MARKDOWN_PATHS) {
    it(`${path} rewrites to /api/markdown`, () => {
      const response = middleware(request(path, "text/markdown"));
      const rewrite = response.headers.get("x-middleware-rewrite") ?? "";
      expect(rewrite).toContain("/api/markdown");
      const rewritten = new URL(rewrite);
      expect(rewritten.searchParams.get("path")).toBe(path);
    });
  }
});
