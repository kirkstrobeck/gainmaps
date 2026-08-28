import { describe, it, expect } from "vitest";
import { INSTALL_COMMANDS } from "@/lib/install-commands";

describe("INSTALL_COMMANDS", () => {
  it("has npm, brew, and curl entries", () => {
    expect(INSTALL_COMMANDS.npm).toBeDefined();
    expect(INSTALL_COMMANDS.brew).toBeDefined();
    expect(INSTALL_COMMANDS.curl).toBeDefined();
  });

  it("npm command uses npx gainmap", () => {
    expect(INSTALL_COMMANDS.npm).toContain("npx gainmap");
  });

  it("brew command uses brew install", () => {
    expect(INSTALL_COMMANDS.brew).toContain("brew install");
  });

  it("curl command pipes to sh", () => {
    expect(INSTALL_COMMANDS.curl).toContain("| sh");
  });
});
