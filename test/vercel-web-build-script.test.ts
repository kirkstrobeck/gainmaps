import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "vitest";

describe("apps/web build script", () => {
  it("does not set NEXT_DIST_DIR (Vercel resolves routes-manifest.json from .next)", () => {
    // Incident: 48c95e8 put NEXT_DIST_DIR=.next-prod on `build`. Vercel
    // looks for /apps/web/.next/routes-manifest.json after compile and
    // failed every deploy. Isolation belongs on `build:isolated` only.
    const pkg = JSON.parse(
      readFileSync("apps/web/package.json", "utf8"),
    ) as { scripts: { build: string } };
    assert.equal(
      /\bNEXT_DIST_DIR\b/.test(pkg.scripts.build),
      false,
      "build must not set NEXT_DIST_DIR — Vercel reads routes-manifest.json from .next",
    );
  });
});
