import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "vitest";

const REQUIRED = {
  statements: 100,
  branches: 100,
  functions: 100,
  lines: 100,
} as const;

function numberedThreshold(source: string, key: string): number {
  const match = source.match(new RegExp(`${key}:\\s*(\\d+)`));
  if (match == null) throw new Error(`vitest config missing ${key} threshold`);
  return Number(match[1]);
}

function thresholdsOf(source: string): typeof REQUIRED {
  return {
    statements: numberedThreshold(source, "statements"),
    branches: numberedThreshold(source, "branches"),
    functions: numberedThreshold(source, "functions"),
    lines: numberedThreshold(source, "lines"),
  };
}

function packageDirsUnder(parent: string): readonly string[] {
  return readdirSync(parent)
    .map((name) => join(parent, name))
    .filter((path) => statSync(path).isDirectory() && existsSync(join(path, "package.json")));
}

function workspaceDirs(): readonly string[] {
  return [".", ...packageDirsUnder("apps"), ...packageDirsUnder("packages")];
}

function testScript(dir: string): string {
  const pkg = JSON.parse(readFileSync(join(dir, "package.json"), "utf8")) as {
    scripts?: { test?: string };
  };
  const script = pkg.scripts?.test;
  if (script == null) throw new Error(`${dir} has no test script`);
  return script;
}

describe("workspace coverage thresholds", () => {
  it("every workspace package has vitest 100/100/100/100 and a coverage test script", () => {
    const dirs = workspaceDirs();
    assert.ok(dirs.length >= 3, `expected root + apps + packages, got ${dirs.join(", ")}`);
    for (const dir of dirs) {
      const configPath = join(dir, "vitest.config.ts");
      assert.equal(existsSync(configPath), true, `${dir} is missing vitest.config.ts`);
      assert.deepEqual(
        thresholdsOf(readFileSync(configPath, "utf8")),
        REQUIRED,
        `${dir} must enforce 100% coverage thresholds`,
      );
      assert.match(
        testScript(dir),
        /--coverage\b/,
        `${dir} test script must run vitest with --coverage`,
      );
    }
  });
});
