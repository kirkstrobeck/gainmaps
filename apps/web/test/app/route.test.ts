import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it, expect } from "vitest";
import { GET } from "@/app/install.sh/route";

describe("GET /install.sh", () => {
  it("returns 200", async () => {
    const response = await GET();
    expect(response.status).toBe(200);
  });

  it("has text/x-shellscript content type", async () => {
    const response = await GET();
    expect(response.headers.get("content-type")).toBe("text/x-shellscript");
  });

  it("has no-store cache control", async () => {
    const response = await GET();
    expect(response.headers.get("cache-control")).toBe("no-store");
  });

  it("body starts with a shebang", async () => {
    const response = await GET();
    const text = await response.text();
    expect(text.trim().startsWith("#!/bin/sh")).toBe(true);
  });

  it("body references gainmap", async () => {
    const response = await GET();
    const text = await response.text();
    expect(text).toContain("gainmap");
  });

  it("body matches packages/gainmap/install.sh", async () => {
    const response = await GET();
    const text = await response.text();
    const expected = readFileSync(
      join(process.cwd(), "../../packages/gainmap/install.sh"),
      "utf8",
    );
    expect(text).toBe(expected);
  });
});
