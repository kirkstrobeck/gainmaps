import { describe, it, expect } from "vitest";
import { cn } from "@/lib/utils";

describe("cn", () => {
  it("merges class names", () => {
    expect(cn("a", "b")).toBe("a b");
  });

  it("handles conditional classes", () => {
    expect(cn("base", false && "skip", "added")).toBe("base added");
  });

  it("deduplicates conflicting tailwind classes", () => {
    expect(cn("p-2", "p-4")).toBe("p-4");
  });

  it("handles undefined and null gracefully", () => {
    expect(cn(undefined, null, "x")).toBe("x");
  });

  it("returns empty string for no inputs", () => {
    expect(cn()).toBe("");
  });
});
