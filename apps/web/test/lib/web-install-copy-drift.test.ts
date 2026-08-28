import assert from "node:assert/strict";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "vitest";
import { markdownForPath } from "@/lib/page-markdown";
import { PHOTOS } from "@/lib/photos/catalog";

const ROOT = join(process.cwd(), "../..");

function readUtf8(relative: string): string {
  return readFileSync(join(ROOT, relative), "utf8");
}

function packageNameAndVersion(): { name: string; version: string } {
  return JSON.parse(readUtf8("packages/gainmap/package.json")) as {
    name: string;
    version: string;
  };
}

function homebrewFormulaName(className: string): string {
  return className.replace(/([a-z0-9])([A-Z])/g, "$1_$2").toLowerCase();
}

/** Tap-qualified token `user/tap/formula` derived from Formula/gainmap.rb. */
function tapQualifiedFormula(formulaSource: string): string {
  const classMatch = formulaSource.match(/^class (\w+) < Formula/m);
  if (classMatch == null) throw new Error("Formula/gainmap.rb has no Homebrew class");
  const ownerMatch = formulaSource.match(/github\.com\/([^/]+)\//);
  if (ownerMatch == null) throw new Error("Formula/gainmap.rb has no GitHub owner");
  return `${ownerMatch[1]}/tap/${homebrewFormulaName(classMatch[1]!)}`;
}

function photoDirectoryCount(): number {
  const photosRoot = join(process.cwd(), "public/photos");
  if (!existsSync(photosRoot)) return 0;
  return readdirSync(photosRoot).filter((name) =>
    statSync(join(photosRoot, name)).isDirectory(),
  ).length;
}

describe("web install copy drift", () => {
  const { name, version } = packageNameAndVersion();
  const formula = readUtf8("Formula/gainmap.rb");
  const tapQualified = tapQualifiedFormula(formula);
  const npmInstall = `npm install -g ${name}`;
  const brewInstall = `brew install ${tapQualified}`;
  const llms = readUtf8("apps/web/public/llms.txt");
  const developers = [
    readUtf8("apps/web/app/developers/page.tsx"),
    readUtf8("apps/web/components/developers/cli-section.tsx"),
  ].join("\n");

  it("reads package name and version once from packages/gainmap/package.json", () => {
    assert.equal(typeof name, "string");
    assert.ok(name.length > 0, "package.json name must be non-empty");
    assert.match(version, /^\d+\.\d+\.\d+/, "package.json version must be semver");
  });

  it("formula version field matches package.json version", () => {
    assert.ok(
      formula.includes(`version "${version}"`),
      `Formula/gainmap.rb must declare version "${version}"`,
    );
  });

  it("llms.txt npm and brew commands match the canonical package and formula", () => {
    assert.ok(llms.includes(npmInstall), `llms.txt must contain ${npmInstall}`);
    assert.ok(llms.includes(brewInstall), `llms.txt must contain ${brewInstall}`);
  });

  it("developers page npm and brew commands match the canonical package and formula", () => {
    assert.ok(developers.includes(npmInstall), `developers page must contain ${npmInstall}`);
    assert.ok(developers.includes(brewInstall), `developers page must contain ${brewInstall}`);
  });

  it("llms.txt and the developers page agree with each other", () => {
    assert.ok(llms.includes(npmInstall) && developers.includes(npmInstall));
    assert.ok(llms.includes(brewInstall) && developers.includes(brewInstall));
  });

  it("llms.txt photo count matches the /photos catalog, not the on-disk leftover dirs", () => {
    const onDisk = photoDirectoryCount();
    const rendered = PHOTOS.length;
    assert.ok(onDisk === 0 || onDisk >= rendered, "catalog cannot exceed local slug dirs when public/photos exists");
    assert.ok(
      llms.includes(`${rendered} landscape photographs`),
      `llms.txt must state ${rendered} photographs (catalog the gallery renders); ${onDisk} slug dirs exist on disk`,
    );
  });

  it("no surface states a photo count that disagrees with PHOTOS.length", () => {
    const expected = PHOTOS.length;
    const photosPage = readUtf8("apps/web/app/photos/page.tsx");
    const markdown = readUtf8("apps/web/lib/page-markdown.ts");
    const catalog = readUtf8("apps/web/lib/photos/catalog.ts");
    function photoCountClaims(text: string): readonly RegExpMatchArray[] {
      return [
        ...text.matchAll(/\b(\d+)\s+(?:landscape\s+)?(?:Unsplash\s+)?photographs?\b/gi),
      ];
    }

    function statedCounts(label: string, text: string): void {
      for (const match of photoCountClaims(text)) {
        assert.equal(
          Number(match[1]),
          expected,
          `${label} states "${match[0]}" but PHOTOS.length is ${expected}`,
        );
      }
    }

    statedCounts("llms.txt", llms);
    statedCounts("apps/web/app/photos/page.tsx", photosPage);
    statedCounts("apps/web/lib/page-markdown.ts", markdown);
    statedCounts("apps/web/lib/photos/catalog.ts", catalog);

    const wordClaim = /\b(one hundred|forty[-\s]eight)\b/i;
    assert.equal(wordClaim.test(photosPage), false, "photos/page.tsx must not spell a stale photo count");
    assert.equal(wordClaim.test(markdown), false, "page-markdown.ts must not spell a stale photo count");
    assert.equal(wordClaim.test(catalog), false, "catalog.ts must not spell a stale photo count");
    assert.equal(
      photoCountClaims(catalog).length,
      0,
      "catalog.ts must not assert a photo count; PHOTOS.length is the source of truth",
    );
    assert.ok(
      (markdownForPath("/photos") ?? "").includes(`${expected} landscape photographs`),
      "runtime /photos markdown must interpolate PHOTOS.length",
    );
    assert.match(
      photosPage,
      /description:\s*`\$\{PHOTOS\.length\} Unsplash photographs/,
      "photos/page.tsx metadata must interpolate PHOTOS.length",
    );
    assert.match(
      markdown,
      /shows \$\{PHOTOS\.length\} landscape photographs/,
      "page-markdown.ts /photos copy must interpolate PHOTOS.length",
    );
  });
});
