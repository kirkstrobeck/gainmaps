import { describe, it, expect } from "vitest";
import { LOGO_STRIP } from "@/lib/logos/logo-strip";

describe("LOGO_STRIP", () => {
  it("contains exactly 3 entries", () => {
    expect(LOGO_STRIP).toHaveLength(3);
  });

  it("is instagram, lego, american-express in that order", () => {
    expect(LOGO_STRIP.map((c) => c.slug)).toEqual([
      "instagram",
      "lego",
      "american-express",
    ]);
  });
});
