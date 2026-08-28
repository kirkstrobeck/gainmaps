import { describe, it, expect } from "vitest";
import { companyBySlug } from "@/lib/logos/companies";
import { requireCompany } from "@/lib/logos/require-company";

describe("requireCompany", () => {
  it("returns the company for a known slug", () => {
    expect(requireCompany("instagram")).toEqual(companyBySlug("instagram"));
  });

  it("throws with a message naming an unknown slug", () => {
    expect(() => requireCompany("no-such-brand")).toThrow(
      "logo slug not found: no-such-brand",
    );
  });
});
