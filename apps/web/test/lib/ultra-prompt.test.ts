import { describe, it, expect } from "vitest";
import { ULTRA_HEADING_PROMPT } from "@/lib/ultra-prompt";

describe("ULTRA_HEADING_PROMPT", () => {
  it("describes the three-layer Ultra heading stack", () => {
    expect(ULTRA_HEADING_PROMPT).toContain("WebGPU canvas");
    expect(ULTRA_HEADING_PROMPT).toContain("startUltraFill");
    expect(ULTRA_HEADING_PROMPT.startsWith("/* paste this exact text")).toBe(true);
  });
});
