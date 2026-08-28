import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { describe, it } from "vitest";

const ROOT = "/workspace/apps/web";
const SOURCE = /\.(?:tsx|ts|css)$/;
const TOKEN = /var\((--[\w-]+)/g;
const DEFINITION = /(--[\w-]+)\s*:/g;
const NEXT_FONT = /variable:\s*"(--[\w-]+)"/g;

async function sourceFiles(directory: string): Promise<string[]> {
  const entries = await readdir(directory, { withFileTypes: true });
  const nested = await Promise.all(entries.map(async (entry) => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) return sourceFiles(path);
    if (SOURCE.test(entry.name)) return [path];
    return [];
  }));
  return nested.flat();
}

describe("CSS custom properties", () => {
  it("defines every var token used by the web source", async () => {
    const globals = await readFile(join(ROOT, "app/globals.css"), "utf8");
    const layout = await readFile(join(ROOT, "app/layout.tsx"), "utf8");
    const definitions = new Set([...globals.matchAll(DEFINITION), ...layout.matchAll(NEXT_FONT)].map((match) => match[1]));
    const references = new Set<string>();

    const files = (await Promise.all(["app", "components", "lib"].map((directory) => sourceFiles(join(ROOT, directory))))).flat();
    for (const file of files) {
      const content = await readFile(file, "utf8");
      for (const match of content.matchAll(TOKEN)) references.add(match[1]);
    }

    const missing = [...references].filter((token) => !definitions.has(token)).sort();
    assert.deepEqual(missing, [], `undefined CSS custom properties: ${missing.join(", ")}`);
  });
});
