import assert from "node:assert/strict";
import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, it, vi } from "vitest";
import sharp from "sharp";

vi.mock("#src/update.js", async (importOriginal) => {
  const actual = await importOriginal<typeof import("#src/update.js")>();
  return {
    ...actual,
    shouldSkipUpdateCheck: () => false,
    checkUpdate: async () => "9.9.9",
    selfUpdate: async () => 1,
    printUpdateNotice: actual.printUpdateNotice,
  };
});

import { run } from "#src/cli.js";

afterEach(() => {
  vi.restoreAllMocks();
});

describe("cli auto-update failure", () => {
  it("returns the updater exit code", async () => {
    vi.spyOn(process.stderr, "write").mockImplementation(() => true);
    vi.spyOn(process.stdout, "write").mockImplementation(() => true);
    const dir = await mkdtemp(join(tmpdir(), "gainmap-failupd-"));
    const input = join(dir, "shot.jpg");
    await writeFile(input, await sharp({ create: { width: 2, height: 2, channels: 3, background: "red" } }).jpeg().toBuffer());
    assert.equal(await run([input, "-n", "--auto-update"]), 1);
  });
});
