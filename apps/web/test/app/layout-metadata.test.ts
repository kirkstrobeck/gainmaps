import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { describe, it, expect } from "vitest";
import { metadata } from "@/app/layout";

function layoutSourcePath(): string {
  const cwdPath = join(process.cwd(), "app/layout.tsx");
  if (existsSync(cwdPath)) {
    return cwdPath;
  }
  return "/workspace/apps/web/app/layout.tsx";
}

describe("layout metadata", () => {
  it("has metadataBase", () => {
    expect(metadata.metadataBase?.toString()).toContain("gainmaps.com");
  });
  it("has openGraph.images", () => {
    expect((metadata.openGraph as { images?: unknown })?.images).toBeDefined();
  });
  it("has alternates.canonical", () => {
    expect(metadata.alternates?.canonical).toBe("/");
  });
});

describe("layout discovery links", () => {
  it("includes service-desc and OpenAPI links in source", async () => {
    const source = await readFile(layoutSourcePath(), "utf8");
    expect(source).toContain('rel="service-desc"');
    expect(source).toContain('href="/openapi.json"');
    expect(source).toContain('type="application/openapi+json"');
  });

  it("includes llms.txt alternate link in source", async () => {
    const source = await readFile(layoutSourcePath(), "utf8");
    expect(source).toContain('rel="alternate"');
    expect(source).toContain('href="/llms.txt"');
  });
});
