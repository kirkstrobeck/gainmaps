import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "vitest";
import assert from "node:assert/strict";

// All three install channels must reference the same version as packages/gainmap/package.json.
// This test fails if any one source is bumped independently, preventing silent drift.
describe("version-drift", () => {
  const root = join(process.cwd(), "../..");

  const pkg = JSON.parse(readFileSync(join(root, "packages/gainmap/package.json"), "utf8")) as { version: string };
  const version = pkg.version;

  it("Formula/gainmap.rb url is a GitHub release tarball", () => {
    const formula = readFileSync(join(root, "Formula/gainmap.rb"), "utf8");
    assert.ok(
      formula.includes(`/releases/download/v${version}/gainmap-${version}.tgz`),
      "Formula/gainmap.rb url must match package.json version (/releases/download/v.../gainmap-....tgz)",
    );
  });

  it("Formula/gainmap.rb version field matches package.json", () => {
    const formula = readFileSync(join(root, "Formula/gainmap.rb"), "utf8");
    assert.ok(
      formula.includes(`version "${version}"`),
      `Formula/gainmap.rb version field must be "${version}"`,
    );
  });

  it("packages/gainmap/install.sh TARBALL default references package.json version", () => {
    const script = readFileSync(join(root, "packages/gainmap/install.sh"), "utf8");
    assert.ok(
      script.includes(`gainmap-${version}.tgz`),
      `packages/gainmap/install.sh TARBALL must reference gainmap-${version}.tgz`,
    );
    assert.ok(
      script.includes("registry.npmjs.org/gainmap"),
      "packages/gainmap/install.sh default TARBALL must be the npm registry",
    );
  });

  it("install.sh copies stay identical to packages/gainmap/install.sh", () => {
    const canonical = readFileSync(join(root, "packages/gainmap/install.sh"), "utf8");
    const publicCopy = readFileSync(join(root, "apps/web/public/install.sh"), "utf8");
    assert.equal(publicCopy, canonical, "apps/web/public/install.sh must match packages/gainmap/install.sh");
  });
});
