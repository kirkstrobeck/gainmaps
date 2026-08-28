import { describe, it, expect } from "vitest";
import { GET } from "@/app/api/version/route";

describe("GET /api/version", () => {
  it("returns name=gainmap and the package version", async () => {
    const res = await GET();
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.name).toBe("gainmap");
    expect(data.version).toBe("1.1.0");
  });

  it("includes installCommands with npm, brew, curl", async () => {
    const res = await GET();
    const data = await res.json();
    expect(data.installCommands).toHaveProperty("npm");
    expect(data.installCommands).toHaveProperty("brew");
    expect(data.installCommands).toHaveProperty("curl");
  });

  it("includes homebrewFormula", async () => {
    const res = await GET();
    const data = await res.json();
    expect(data.homebrewFormula).toBe("kirkstrobeck/tap/gainmap");
  });
});
