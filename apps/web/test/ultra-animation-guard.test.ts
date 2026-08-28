import { describe, it } from "vitest";
import assert from "node:assert/strict";
import { readFile, glob } from "node:fs/promises";

const ROOT = "/workspace";
const GLOBALS_CSS = `${ROOT}/apps/web/app/globals.css`;
const ULTRA_WORD = `${ROOT}/apps/web/components/ultra-word.tsx`;
const SKILL_MD = `${ROOT}/skills/ultra-text/SKILL.md`;
const ULTRA_PROMPT = `${ROOT}/apps/web/lib/ultra-prompt.ts`;

describe("ultra animation guard", () => {
  it("globals.css has no entrance or scroll animation declarations", async () => {
    const css = await readFile(GLOBALS_CSS, "utf8");

    // These named keyframes and scroll-driven declarations must not appear ANYWHERE
    // in the file. The prefers-reduced-motion: reduce block only uses animation-duration
    // and animation-iteration-count — it never defines named keyframes or animation-timeline.
    assert.ok(
      !/@keyframes hero-rise/.test(css),
      "globals.css still contains @keyframes hero-rise — remove the entrance animation block",
    );
    assert.ok(
      !/@keyframes reveal-rise/.test(css),
      "globals.css still contains @keyframes reveal-rise — remove the scroll-reveal animation block",
    );
    assert.ok(
      !/animation-timeline:\s*view\(\)/.test(css),
      "globals.css still uses animation-timeline: view() — remove the scroll-driven animation",
    );
    // Named animation shorthand (e.g. "animation: hero-rise ...") must not appear.
    // The reduce block uses animation-duration, not the animation shorthand.
    assert.ok(
      !/animation:\s+(?!0\.01ms)/.test(css),
      "globals.css has an animation: shorthand declaration — remove it (entrance/scroll animations are prohibited near ultra text)",
    );
  });

  it("no file in app/ or components/ uses hero-stage or reveal animation classes", async () => {
    const patterns = [
      "apps/web/app/**/*.tsx",
      "apps/web/components/**/*.tsx",
    ];

    for (const pattern of patterns) {
      for await (const rel of glob(pattern, { cwd: ROOT })) {
        const text = await readFile(`${ROOT}/${rel}`, "utf8");
        assert.ok(
          !text.includes("hero-stage"),
          `${rel} still contains the "hero-stage" animation class — remove it`,
        );
        // Match the class as a standalone word in className strings.
        // Catches: className="reveal ...", className="... reveal ...", className="...reveal"
        assert.ok(
          !/(?:^|[\s"'])reveal(?:[\s"']|$)/.test(text),
          `${rel} still contains the "reveal" scroll-animation class — remove it`,
        );
      }
    }
  });

  it("UltraWord component has no animate-* classes, inline animation, or opacity/transform transition", async () => {
    const src = await readFile(ULTRA_WORD, "utf8");

    assert.ok(
      !/\banimate-[a-z]/.test(src),
      "ultra-word.tsx uses a Tailwind animate-* utility — remove it; ultra text must never be animated",
    );
    assert.ok(
      !/\banimation\s*:/.test(src),
      "ultra-word.tsx has an inline animation style — remove it",
    );
    // Transition on opacity or transform would composite the HDR canvas into SDR range
    assert.ok(
      !/transition.*opacity/.test(src) && !/transition.*transform/.test(src),
      "ultra-word.tsx has a transition on opacity or transform — remove it",
    );
  });

  it("SKILL.md and ultra-prompt.ts both document the dual-mask (inset) and the animation constraint", async () => {
    const [skill, prompt] = await Promise.all([
      readFile(SKILL_MD, "utf8"),
      readFile(ULTRA_PROMPT, "utf8"),
    ]);

    // Dual-mask / inset invariant
    const INSET_PHRASES = ["maskInsetId", "0.5 px inset", "inset"];
    const skillHasInset = INSET_PHRASES.some((p) => skill.includes(p));
    const promptHasInset = INSET_PHRASES.some((p) => prompt.includes(p));
    assert.ok(
      skillHasInset,
      "SKILL.md no longer documents the 0.5 px inset mask (maskInsetId) — restore it",
    );
    assert.ok(
      promptHasInset,
      "ultra-prompt.ts no longer documents the 0.5 px inset mask — SKILL.md and ultra-prompt.ts must stay in sync",
    );

    // Animation constraint invariant
    const ANIM_PHRASES = ["Never animate", "never animate", "cannot be animated", "must never be animated"];
    const skillHasAnim = ANIM_PHRASES.some((p) => skill.includes(p));
    const promptHasAnim = ANIM_PHRASES.some((p) => prompt.includes(p));
    assert.ok(
      skillHasAnim,
      "SKILL.md no longer states the animation prohibition — restore the 'Never animate ultra text' section",
    );
    assert.ok(
      promptHasAnim,
      "ultra-prompt.ts no longer states the animation prohibition — SKILL.md and ultra-prompt.ts must stay in sync",
    );
  });
});
