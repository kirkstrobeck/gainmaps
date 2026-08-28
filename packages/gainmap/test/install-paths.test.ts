import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { readFile } from "node:fs/promises";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it } from "vitest";

const execFileAsync = promisify(execFile);
const __dirname = dirname(fileURLToPath(import.meta.url));
const PKG_DIR = join(__dirname, "..");

describe("install paths", () => {
  it("install.sh passes sh -n syntax check", async () => {
    await execFileAsync("sh", ["-n", join(PKG_DIR, "install.sh")]);
  });

  it("install.sh bundles Node instead of requiring it", async () => {
    const script = await readFile(join(PKG_DIR, "install.sh"), "utf8");
    assert.equal(script.includes("node is required"), false);
    assert.ok(script.includes("GAINMAP_NODE_TARBALL"));
  });

  it("Formula version matches package.json", async () => {
    const pkg = JSON.parse(
      await readFile(join(PKG_DIR, "package.json"), "utf8"),
    ) as { version: string };
    const formula = await readFile(
      join(PKG_DIR, "../../Formula/gainmap.rb"),
      "utf8",
    );
    assert.ok(
      formula.includes(`version "${pkg.version}"`),
      `Formula must contain version "${pkg.version}"`,
    );
  });

  it("bin.gainmap is ./dist/cli.js", async () => {
    const pkg = JSON.parse(
      await readFile(join(PKG_DIR, "package.json"), "utf8"),
    ) as { bin: Record<string, string> };
    assert.equal(pkg.bin["gainmap"], "./dist/cli.js");
  });

  it("package.json files includes test/fixtures", async () => {
    const pkg = JSON.parse(
      await readFile(join(PKG_DIR, "package.json"), "utf8"),
    ) as { files: string[] };
    assert.ok(
      pkg.files.includes("test/fixtures"),
      "files must include test/fixtures",
    );
  });

  it("package.json files includes dist", async () => {
    const pkg = JSON.parse(
      await readFile(join(PKG_DIR, "package.json"), "utf8"),
    ) as { files: string[] };
    assert.ok(
      pkg.files.some((f) => f === "dist" || f.startsWith("dist/")),
      "files must include dist (for dist/cli.js)",
    );
  });

  it("package.json files includes install.sh", async () => {
    const pkg = JSON.parse(
      await readFile(join(PKG_DIR, "package.json"), "utf8"),
    ) as { files: string[] };
    assert.ok(
      pkg.files.includes("install.sh"),
      "files must include install.sh",
    );
  });

  it("npm pack --dry-run includes dist/cli.js", async () => {
    const { stdout } = await execFileAsync(
      "npm",
      ["pack", "--dry-run", "--json"],
      { cwd: PKG_DIR },
    );
    const packed = JSON.parse(stdout) as Array<{ files: Array<{ path: string }> }>;
    const paths = packed[0]!.files.map((f) => f.path);
    assert.ok(
      paths.some((p) => p.includes("dist/cli.js")),
      `pack must include dist/cli.js; got: ${paths.join(", ")}`,
    );
  });

  it("npm pack --dry-run includes test/fixtures", async () => {
    const { stdout } = await execFileAsync(
      "npm",
      ["pack", "--dry-run", "--json"],
      { cwd: PKG_DIR },
    );
    const packed = JSON.parse(stdout) as Array<{ files: Array<{ path: string }> }>;
    const paths = packed[0]!.files.map((f) => f.path);
    assert.ok(
      paths.some((p) => p.includes("test/fixtures")),
      `pack must include test/fixtures; got: ${paths.slice(0, 5).join(", ")}`,
    );
  });
});
