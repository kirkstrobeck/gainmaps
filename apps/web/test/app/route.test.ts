import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it, expect } from "vitest";

describe("public/install.sh", () => {
  const publicScript = readFileSync(join(process.cwd(), "public/install.sh"), "utf8");
  const canonical = readFileSync(join(process.cwd(), "../../packages/gainmap/install.sh"), "utf8");

  it("starts with a shebang", () => {
    expect(publicScript.startsWith("#!/bin/sh")).toBe(true);
  });

  it("references gainmap", () => {
    expect(publicScript).toContain("gainmap");
  });

  it("matches packages/gainmap/install.sh", () => {
    expect(publicScript).toBe(canonical);
  });
});
