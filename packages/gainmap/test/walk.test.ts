import assert from "node:assert/strict";
import { mkdir, symlink, writeFile } from "node:fs/promises";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, it } from "vitest";
import sharp from "sharp";

import { collectInputs, hasAllowedExtension, matchesExclude, parseExtensionList } from "#src/walk.js";
import { DEFAULT_EXTENSIONS } from "#src/decode.js";

describe("walk", () => {
  it("parses extension lists and exclude globs", () => {
    assert.deepEqual(parseExtensionList(undefined), DEFAULT_EXTENSIONS);
    assert.deepEqual(parseExtensionList("  "), DEFAULT_EXTENSIONS);
    assert.deepEqual(parseExtensionList(".PNG, jpg"), ["png", "jpg"]);
    assert.equal(hasAllowedExtension("a.PNG", ["png"]), true);
    assert.equal(hasAllowedExtension("a.txt", ["png"]), false);
    assert.equal(matchesExclude("shots/raw/a.jpg", ["**/raw/**"]), true);
    assert.equal(matchesExclude("shots/a.jpg", ["**/raw/**"]), false);
    assert.equal(matchesExclude("a.jpg", []), false);
  });

  it("walks flat vs recursive directories and skips symlinks", async () => {
    const dir = await mkdtemp(join(tmpdir(), "gainmap-walk-"));
    const nested = join(dir, "nested");
    await mkdir(nested);
    const png = await sharp({ create: { width: 1, height: 1, channels: 3, background: "red" } }).png().toBuffer();
    await writeFile(join(dir, "a.png"), png);
    await writeFile(join(nested, "b.png"), png);
    await writeFile(join(dir, "skip.txt"), "nope");
    await symlink(join(dir, "a.png"), join(dir, "link.png"));
    const flat = await collectInputs([dir], { recursive: false, extensions: ["png"], exclude: [] });
    assert.equal(flat.length, 1);
    const deep = await collectInputs([dir], { recursive: true, extensions: ["png"], exclude: [] });
    assert.equal(deep.length, 2);
    const excluded = await collectInputs([dir], { recursive: true, extensions: ["png"], exclude: ["**/nested/**"] });
    assert.equal(excluded.length, 1);
    await assert.rejects(collectInputs([join(dir, "skip.txt")], { recursive: false, extensions: ["png"], exclude: [] }), /Unsupported/);
  });
});
