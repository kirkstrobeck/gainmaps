import { describe, it } from "vitest";
import assert from "node:assert/strict";
import { readFile, glob } from "node:fs/promises";

const ROOT = "/workspace";

// Pages that delegate their h1 to a child component which uses UltraWord.
const DELEGATING = new Set([
  "apps/web/app/page.tsx",  // delegates to HeroSection → UltraWord
]);

describe("ultra headings", () => {
  it("every page file with an <h1> wraps it in UltraWord", async () => {
    const files: string[] = [];
    for await (const f of glob("apps/web/app/**/{page,client,error,not-found}.tsx", { cwd: ROOT })) {
      files.push(f);
    }
    assert.ok(files.length > 0, "glob found no page files");

    for (const rel of files) {
      if (DELEGATING.has(rel)) continue;
      const text = await readFile(`${ROOT}/${rel}`, "utf8");
      if (!/<h1[\s>]/.test(text)) continue;
      assert.ok(
        text.includes("UltraWord"),
        `${rel} has an <h1> but does not import UltraWord — wrap the heading`,
      );
    }
  });
});
