import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const pkgPath = resolve(process.cwd(), "package.json");
const nextConfigPath = resolve(process.cwd(), "next.config.ts");

describe("Vercel distDir contract", () => {
  it("build script does not set NEXT_DIST_DIR", () => {
    // Incident: 48c95e8 put NEXT_DIST_DIR=.next-prod on `build`. Vercel
    // resolves routes-manifest.json from the default `.next` and every
    // deploy failed after a successful compile. Isolation is opt-in on
    // `build:isolated` only.
    const pkg = JSON.parse(readFileSync(pkgPath, "utf8")) as {
      scripts: { build: string };
    };
    expect(pkg.scripts.build).not.toMatch(/\bNEXT_DIST_DIR\b/);
  });

  it("isolated scripts force NODE_ENV=production so a development shell cannot emit a slow bundle", () => {
    const pkg = JSON.parse(readFileSync(pkgPath, "utf8")) as {
      scripts: { "build:isolated": string; "start:isolated": string };
    };
    expect(pkg.scripts["build:isolated"]).toMatch(/\bNODE_ENV=production\b/);
    expect(pkg.scripts["start:isolated"]).toMatch(/\bNODE_ENV=production\b/);
  });

  it("next.config does not force .next-prod when NODE_ENV is production", () => {
    const src = readFileSync(nextConfigPath, "utf8");
    expect(src).not.toMatch(
      /NODE_ENV\s*===\s*["']production["'][\s\S]{0,80}\.next-prod/,
    );
  });
});
