#!/usr/bin/env npx tsx
/**
 * Bulk high-key Unsplash landscape photo finder.
 * Searches many queries, measures luma, and outputs ALL passing catalog entries.
 * Selection bar: p99Luma >= 0.95 AND whiteFrac >= 0.05
 *
 * Run: npx tsx tools/photos/bulk-find.ts
 * Output: catalog objects printed to stdout, summary to /tmp/bulk-find.md
 */
import { appendFileSync, writeFileSync } from "node:fs";

import { PHOTOS } from "../../apps/web/lib/photos/catalog.ts";
import { clearsSelectionBar, measureJpeg } from "./luma-metrics.ts";
import {
  downloadRendition,
  fetchSearchPage,
  photoIdFromRaw,
  toCatalogFields,
  type CatalogFields,
} from "./unsplash-napi.ts";

const REPORT = "/tmp/bulk-find.md";

const QUERIES = [
  // Original queries
  "aerial snow mountains",
  "glacier from above",
  "paragliding snow alps",
  "overcast snow field",
  "sunlit fog forest",
  "white sand dunes",
  "iceberg",
  // Additional high-key landscape queries
  "sunrise over ocean",
  "snowy mountain peak sunlight",
  "beach aerial turquoise water",
  "white fog misty forest",
  "desert sand golden light",
  "alpine lake reflection",
  "waterfall mist bright",
  "arctic tundra snow",
  "salt flats reflective",
  "cotton clouds aerial",
  "bright sky meadow",
  "sunlit canyon rock",
  "tropical beach white sand",
  "storm clouds dramatic",
  "snow field tracks",
  "glacier blue ice",
  "misty morning valley",
  "white sand beach aerial",
  "sunburst mountain peak",
  // More variety
  "foggy mountain valley",
  "snow covered forest winter",
  "dramatic clouds landscape",
  "bright sunlight ocean waves",
  "sand dunes aerial view",
  "lake reflection mountains blue",
  "misty waterfall long exposure",
  "snowy peaks blue sky",
  "white cliffs coastal",
  "frozen lake ice patterns",
  "rolling hills fog morning",
  "lavender field bright sun",
  "cherry blossom bright spring",
  "wheat field golden summer",
  "rice terraces bright green",
  "coral reef aerial turquoise",
  "salt lake pink reflection",
  "marble canyon bright rock",
  "arctic landscape white sky",
  "nordic landscape winter",
  "fjord reflection bright",
  "hot air balloon sky",
  "meadow wildflowers bright",
  "coastal cliffs bright day",
  "snowstorm landscape",
  "moonrise landscape bright",
] as const;

const REJECT = /\b(portrait|headshot|selfie|product|logo|typography|lettering|packaging)\b/i;

function log(line: string): void {
  process.stdout.write(`${line}\n`);
  appendFileSync(REPORT, `${line}\n`);
}

function catalogObject(c: CatalogFields): string {
  return (
    `{ id: ${JSON.stringify(c.id)}, slug: ${JSON.stringify(c.slug)}, ` +
    `unsplashPhotoId: ${JSON.stringify(c.unsplashPhotoId)}, ` +
    `photographer: ${JSON.stringify(c.photographer)}, ` +
    `photographerUrl: ${JSON.stringify(c.photographerUrl)}, ` +
    `photoUrl: ${JSON.stringify(c.photoUrl)}, ` +
    `width: ${c.width}, height: ${c.height}, alt: ${JSON.stringify(c.alt)} }`
  );
}

function isTaken(id: string, slug: string, unsplashPhotoId: string): boolean {
  return PHOTOS.some((p) => p.id === id || p.slug === slug || p.unsplashPhotoId === unsplashPhotoId);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

type Candidate = CatalogFields & { readonly query: string };

async function fetchCandidates(): Promise<readonly Candidate[]> {
  const seen = new Set<string>();
  const seenSlugs = new Set<string>(); // guard against in-session slug collisions
  const all: Candidate[] = [];

  for (const query of QUERIES) {
    try {
      // fetch 2 pages per query to get more results
      for (const page of [1, 2]) {
        await sleep(300);
        const hits = await fetchSearchPage(query, page);
        for (const hit of hits) {
          const photoId = photoIdFromRaw(hit.urls?.raw ?? "");
          if (!photoId) continue;
          if (hit.width <= hit.height) continue; // portrait
          const alt = (hit.alt_description ?? hit.description ?? "").trim();
          if (REJECT.test(alt)) continue;
          let fields = toCatalogFields(hit, photoId);
          if (!fields.photographer || !fields.alt) continue;
          if (isTaken(fields.id, fields.slug, fields.unsplashPhotoId)) continue;
          if (seen.has(fields.id)) continue;
          // If the slug collides with another candidate in this session, suffix
          // with the photo id to guarantee uniqueness.
          if (seenSlugs.has(fields.slug)) {
            fields = { ...fields, slug: `${fields.slug}-${fields.id}` };
          }
          seen.add(fields.id);
          seenSlugs.add(fields.slug);
          all.push({ ...fields, query });
        }
      }
      log(`  fetched query "${query}": ${all.length} candidates so far`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      log(`  WARN: query "${query}" failed: ${msg}`);
    }
  }
  return all;
}

async function measureAndFilter(candidates: readonly Candidate[]): Promise<readonly CatalogFields[]> {
  const winners: CatalogFields[] = [];
  let checked = 0;
  for (const c of candidates) {
    try {
      await sleep(100);
      const jpeg = await downloadRendition(c.unsplashPhotoId, 640);
      const m = await measureJpeg(jpeg, 320);
      checked++;
      if (clearsSelectionBar(m)) {
        winners.push(c);
        log(`PASS  ${c.id}  p99=${m.p99Luma.toFixed(3)}  wf=${m.whiteFrac.toFixed(3)}  "${c.alt.slice(0, 60)}"`);
        log(`  CATALOG: ${catalogObject(c)}`);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      log(`  SKIP ${c.id}: ${msg}`);
    }
    if (winners.length >= 100) {
      log("Reached 100 winners, stopping early.");
      break;
    }
  }
  log(`\nTotal checked: ${checked}, Total passed: ${winners.length}`);
  return winners;
}

async function main(): Promise<void> {
  writeFileSync(REPORT, "# Bulk high-key photo search\n\n");
  log("## Fetching search results...\n");
  const candidates = await fetchCandidates();
  log(`\nTotal unique candidates: ${candidates.length}`);
  log("\n## Measuring luma...\n");
  const winners = await measureAndFilter(candidates);
  log("\n## Summary\n");
  log(`Winners: ${winners.length}`);
  log("\n## Catalog objects for all winners:\n");
  for (const w of winners) {
    log(catalogObject(w));
  }
}

await main();
