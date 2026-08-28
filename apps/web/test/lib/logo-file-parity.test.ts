import { describe, it, expect } from "vitest";
import { execSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { COMPANIES } from "@/lib/logos/companies";

const REPO_ROOT = join(process.cwd(), "../..");
const WIDTHS = [128, 256, 512, 1024] as const;
const HEX_COLOR_PATTERN = /#[0-9a-f]{3,8}\b/gi;
const EXPLICIT_PAINT_PATTERN = /\b(?:fill|stroke)\s*=\s*"(?!none\b)[^"]+"|style\s*=\s*"[^"]*(?:fill|stroke)\s*:/i;
const ROOT_FILL_PATTERN = /<svg\b[^>]*\bfill\s*=\s*"(?!none\b)[^"]+"/i;
const DARK_PAINT_PATTERN = /(?:fill|stroke)\s*=\s*"(?:#(?:000|000000|111|111111|1d1d1b|222|222222)|black|rgb\(\s*0\s*,\s*0\s*,\s*0\s*\))"|(?:fill|stroke)\s*:\s*(?:#(?:000|000000|111|111111|1d1d1b|222|222222)|black|rgb\(\s*0\s*,\s*0\s*,\s*0\s*\))/i;

// Run git ls-files once for the entire test suite; calling it per-company OOMs.
const TRACKED_LOGOS: Set<string> = new Set(
  execSync("git ls-files -z -- apps/web/public/logos", { cwd: REPO_ROOT })
    .toString()
    .split("\0")
    .filter(Boolean)
    .map((f) => join(REPO_ROOT, f)),
);

function hexLuminance(hex: string): number {
  const raw = hex.slice(1);
  const expanded = raw.length === 3 || raw.length === 4
    ? raw.slice(0, 3).split("").map((c) => c + c).join("")
    : raw.slice(0, 6);
  if (expanded.length !== 6) return 1;
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(expanded.slice(i, i + 2), 16) / 255);
  return 0.2126 * r! + 0.7152 * g! + 0.0722 * b!;
}

function visibleTags(svg: string): string[] {
  return [...svg.matchAll(/<(path|polygon|polyline|rect|circle|ellipse|text)\b[^>]*>/gi)].map((m) => m[0]);
}

describe("logo file parity (git-tracked)", () => {
  it("enumerates at least one company", () => {
    expect(COMPANIES.length).toBeGreaterThan(0);
  });

  it("keeps source SVG logos reversed for bright-on-dark display", () => {
    const failures: string[] = [];
    for (const company of COMPANIES) {
      const relativePath = `apps/web/public/logos/${company.slug}/logo.svg`;
      const absolutePath = join(REPO_ROOT, relativePath);
      const svg = readFileSync(absolutePath, "utf8");
      const rootHasPaint = ROOT_FILL_PATTERN.test(svg);

      if (DARK_PAINT_PATTERN.test(svg)) {
        failures.push(`${company.slug}: contains explicit black/dark paint`);
      }

      const darkHexes = [...new Set(svg.match(HEX_COLOR_PATTERN) ?? [])]
        .filter((color) => hexLuminance(color) < 0.36);
      if (darkHexes.length > 0) {
        failures.push(`${company.slug}: contains dark color token(s) ${darkHexes.join(", ")}`);
      }

      const implicitPaintTags = visibleTags(svg).filter((tag) => !EXPLICIT_PAINT_PATTERN.test(tag));
      if (!rootHasPaint && implicitPaintTags.length > 0) {
        failures.push(`${company.slug}: has implicit default-black paint`);
      }
    }
    expect(failures, failures.join("\n")).toEqual([]);
  });

  it("every company has all gainmap and sdr width variants tracked in git", () => {
    const missing: string[] = [];
    for (const company of COMPANIES) {
      for (const w of WIDTHS) {
        const gainmap = join(REPO_ROOT, `apps/web/public/logos/${company.slug}/logo-gainmap-${w}.jpg`);
        const sdr = join(REPO_ROOT, `apps/web/public/logos/${company.slug}/logo-sdr-${w}.jpg`);
        if (!TRACKED_LOGOS.has(gainmap)) missing.push(`${company.slug}/logo-gainmap-${w}.jpg`);
        if (!TRACKED_LOGOS.has(sdr)) missing.push(`${company.slug}/logo-sdr-${w}.jpg`);
      }
    }
    expect(missing, `missing from git index:\n${missing.join("\n")}`).toEqual([]);
  });
});
