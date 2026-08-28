#!/usr/bin/env npx tsx
/**
 * Find high-key Unsplash landscape photos for gain-map fit.
 * Selection bar: p99Luma >= 0.95 AND whiteFrac >= 0.05
 * Run: npx tsx tools/photos/find-highkey.ts
 */
import { appendFileSync, writeFileSync } from "node:fs";

import { PHOTOS } from "../../apps/web/lib/photos/catalog.ts";
import { clearsSelectionBar, fmt, measureJpeg, type LumaMetrics } from "./luma-metrics.ts";
import {
  downloadRendition,
  fetchSearchPage,
  photoIdFromRaw,
  toCatalogFields,
  type CatalogFields,
} from "./unsplash-napi.ts";

const REPORT = "/tmp/photo-swap.md";
const QUERIES = [
  "aerial snow mountains",
  "glacier from above",
  "paragliding snow alps",
  "overcast snow field",
  "sunlit fog forest",
  "white sand dunes",
  "iceberg",
] as const;
const REJECT = /\b(portrait|headshot|selfie|product|logo|typography|lettering|packaging)\b/i;
const USER_AGENT_SLEEP_MS = 80;

type Candidate = CatalogFields & { readonly query: string };

type Measured = Candidate & LumaMetrics & { readonly bar: "PASS" | "FAIL"; readonly note: string };

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

function tableHeader(): string {
  return [
    "| query | id | slug | maxLuma | p99Luma | p95Luma | whiteFrac | brightFrac | bar |",
    "| --- | --- | --- | ---: | ---: | ---: | ---: | ---: | --- |",
  ].join("\n");
}

function tableRow(row: Measured): string {
  return (
    `| ${row.query} | ${row.id} | ${row.slug} | ${fmt(row.maxLuma)} | ${fmt(row.p99Luma)} | ` +
    `${fmt(row.p95Luma)} | ${fmt(row.whiteFrac)} | ${fmt(row.brightFrac)} | ${row.bar} |`
  );
}

function rejectReason(hitAlt: string, width: number, height: number, photoId: string | null): string | null {
  if (!photoId) return "no photo id";
  if (width <= height) return "not landscape";
  if (REJECT.test(hitAlt)) return "portrait/product/text";
  return null;
}

function isTaken(id: string, slug: string, unsplashPhotoId: string): boolean {
  return PHOTOS.some((p) => p.id === id || p.slug === slug || p.unsplashPhotoId === unsplashPhotoId);
}

async function hitsForQuery(query: string, page: number): Promise<readonly Candidate[]> {
  const hits = await fetchSearchPage(query, page);
  return hits.flatMap((hit) => {
    const photoId = photoIdFromRaw(hit.urls?.raw ?? "");
    const alt = (hit.alt_description ?? hit.description ?? "").trim();
    const reject = rejectReason(alt, hit.width, hit.height, photoId);
    if (reject) return [];
    const fields = toCatalogFields(hit, photoId!);
    if (isTaken(fields.id, fields.slug, fields.unsplashPhotoId)) return [];
    if (!fields.photographer || !fields.alt) return [];
    return [{ ...fields, query }];
  });
}

function uniqueCandidates(items: readonly Candidate[]): readonly Candidate[] {
  return items.filter((item, index) => items.findIndex((x) => x.id === item.id) === index);
}

async function allCandidates(): Promise<readonly Candidate[]> {
  const pages = await QUERIES.reduce<Promise<readonly Candidate[]>>(async (prev, query) => {
    const acc = await prev;
    await sleep(200);
    return [...acc, ...(await hitsForQuery(query, 1))];
  }, Promise.resolve([]));
  return uniqueCandidates(pages);
}

async function measureOne(c: Candidate): Promise<Measured> {
  try {
    const jpeg = await downloadRendition(c.unsplashPhotoId, 640);
    const m = await measureJpeg(jpeg, 320);
    const bar = clearsSelectionBar(m) ? "PASS" : "FAIL";
    return { ...c, ...m, bar, note: "" };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return {
      ...c,
      maxLuma: Number.NaN,
      p99Luma: Number.NaN,
      p95Luma: Number.NaN,
      whiteFrac: Number.NaN,
      brightFrac: Number.NaN,
      pixelCount: 0,
      bar: "FAIL",
      note: message,
    };
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function measureAll(candidates: readonly Candidate[]): Promise<readonly Measured[]> {
  return candidates.reduce<Promise<readonly Measured[]>>(async (prev, candidate) => {
    const acc = await prev;
    const row = await measureOne(candidate);
    log(tableRow(row));
    if (row.note) log(`  note: ${row.note}`);
    await sleep(USER_AGENT_SLEEP_MS);
    return [...acc, row];
  }, Promise.resolve([]));
}

function rank(rows: readonly Measured[]): readonly Measured[] {
  return [...rows].sort((a, b) => b.whiteFrac - a.whiteFrac || b.p99Luma - a.p99Luma);
}

async function main(): Promise<void> {
  writeFileSync(REPORT, "# Photo swap — high-key replacement search\n\n");
  log("## P1 — searches");
  log("");
  QUERIES.forEach((q) => log(`- \`${q}\``));
  log("");
  log("Selection bar: `p99Luma >= 0.95` AND `whiteFrac >= 0.05` (stricter than the audit pass rule).");
  log("Method: Rec.709 Y on 0..1 sRGB (not linearized). Download long-edge 640, then sharp 320 inside-fit.");
  log("");
  const candidates = await allCandidates();
  log(`Candidates after landscape / catalog / reject filters: ${candidates.length}`);
  log("");
  log("### Measured (catalog-order of fetch, streaming)");
  log("");
  log(tableHeader());
  const rows = await measureAll(candidates);
  const ranked = rank(rows);
  log("");
  log("### Ranked by whiteFrac (best first)");
  log("");
  log(tableHeader());
  ranked.forEach((row) => log(tableRow(row)));
  const winners = ranked.filter((row) => row.bar === "PASS");
  log("");
  log(`Cleared selection bar: ${winners.length} / ${rows.length}`);
  if (winners.length === 0) {
    log("No candidate cleared the selection bar.");
    process.exitCode = 1;
    return;
  }
  const winner = winners[0]!;
  log("");
  log("### Winner (highest whiteFrac that clears the bar)");
  log("");
  log(catalogObject(winner));
  log("");
  log(
    `metrics: maxLuma ${fmt(winner.maxLuma)}  p99Luma ${fmt(winner.p99Luma)}  ` +
      `p95Luma ${fmt(winner.p95Luma)}  whiteFrac ${fmt(winner.whiteFrac)}  brightFrac ${fmt(winner.brightFrac)}`,
  );
}

await main();
