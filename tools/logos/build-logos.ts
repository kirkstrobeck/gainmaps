#!/usr/bin/env npx tsx
// Gainmaps by Kirk Strobeck – https://gainmaps.com

/**
 * Build the assets behind /logos.
 *
 * For every seed in ./sources.ts:
 *   1. resolve a premium full-color brand SVG — api.svgl.app first, then the
 *      Wikimedia file behind the brand's Wikidata P154 claim,
 *   2. save it to apps/web/public/logos/<slug>/logo.svg,
 *   3. rasterize it with sharp onto a transparent 512x512 canvas, contain-fit
 *      and centred, so the mark keeps the holes the vector drew,
 *   4. encode that with encodeLogoVariants (boost 1.0, checkerboard matte)
 *      to apps/web/public/logos/<slug>/logo-gainmap.jpg — JPEG has no alpha,
 *      so what was transparent becomes a soft gray checker rather than a white
 *      plate the mark never had,
 *   5. rewrite apps/web/lib/logos/companies.ts with the seeds that succeeded.
 *
 * Brands without a premium SVG anywhere are skipped and reported; the generated
 * list only ever contains entries whose two files are on disk.
 *
 * Run from the repo root:  npx tsx tools/logos/build-logos.ts
 */
import { mkdir, readdir, rm, rmdir, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import sharp from "sharp";

import { encodeLogoVariants } from "./encode-logo-variants.ts";
import { LOGO_SEEDS, type LogoSeed } from "./sources.ts";

const here = dirname(fileURLToPath(import.meta.url));
const repo = resolve(here, "../..");
const publicRoot = join(repo, "apps/web/public/logos");
const listPath = join(repo, "apps/web/lib/logos/companies.ts");

/** Wikimedia asks automated clients to identify themselves with a contact. */
const USER_AGENT = "gainmaps-logo-pipeline/1.0 (https://gainmaps.com; kirk@strobeck.com)";
const CANVAS = 1024;
/**
 * The mark fills the canvas. Breathing room is the tile's job in CSS, and the
 * display mask is the same SVG contain-fitted to the same square — an inset
 * baked in here would land the mask a few percent off the ink it must cover.
 */
const LOGO_BOX = CANVAS;
const BOOST = 1.0;
const MAX_SVG_BYTES = 3 * 1024 * 1024;
const FETCH_CONCURRENCY = 4;
/**
 * en.wikipedia's Special:FilePath is served by the app servers, not the image
 * CDN, and it throttles a run this size with a 429 partway through. Backing off
 * and retrying costs a few seconds; not retrying costs the logo.
 */
const RETRY_STATUSES = new Set([429, 503]);
const MAX_RETRIES = 5;
const RETRY_BASE_MS = 2000;

type SvglEntry = {
  readonly title: string;
  readonly route?: string | { readonly light?: string; readonly dark?: string };
};

type Resolved = {
  readonly seed: LogoSeed;
  readonly url: string;
  readonly source: "svgl" | "commons";
};

type Outcome =
  | { readonly ok: true; readonly seed: LogoSeed; readonly source: Resolved["source"]; readonly note: string }
  | { readonly ok: false; readonly seed: LogoSeed; readonly reason: string };

async function main(): Promise<void> {
  const svgl = await fetchSvglIndex();
  console.log(`svgl index: ${svgl.size} entries`);

  const commons = await resolveCommonsFiles(LOGO_SEEDS);
  const resolved = LOGO_SEEDS.map((seed) => resolveSeed(seed, svgl, commons));

  const unresolved = resolved.filter((entry): entry is { seed: LogoSeed; url: null } => entry.url === null);
  const ready = resolved.filter((entry): entry is Resolved => entry.url !== null);
  console.log(`resolved ${ready.length}/${LOGO_SEEDS.length} logo URLs`);

  await removeTreeSerially(publicRoot);
  await mkdir(publicRoot, { recursive: true });
  for (const entry of ready) await mkdir(join(publicRoot, entry.seed.slug), { recursive: true });

  const built = await mapChunked(ready, FETCH_CONCURRENCY, buildOne);

  const outcomes: readonly Outcome[] = [
    ...built,
    ...unresolved.map((entry) => ({ ok: false as const, seed: entry.seed, reason: "no premium SVG found" })),
  ];

  const successes = outcomes
    .filter((outcome): outcome is Extract<Outcome, { ok: true }> => outcome.ok)
    .sort((a, b) => a.seed.rank - b.seed.rank);
  const skips = outcomes
    .filter((outcome): outcome is Extract<Outcome, { ok: false }> => !outcome.ok)
    .sort((a, b) => a.seed.rank - b.seed.rank);

  // A seed that failed after its directory was carved out leaves an empty or
  // half-written one behind; the generated list must only name slugs with both
  // files on disk, so sweep the rest away.
  const kept = new Set(successes.map((outcome) => outcome.seed.slug));
  for (const entry of ready) {
    if (!kept.has(entry.seed.slug)) await removeTreeSerially(join(publicRoot, entry.seed.slug));
  }

  await mkdir(dirname(listPath), { recursive: true });
  await writeFile(listPath, renderCompaniesModule(successes.map((outcome) => outcome.seed)), "utf8");

  console.log("");
  successes.forEach((outcome) => {
    console.log(`  ok    ${rankLabel(outcome.seed)} ${outcome.seed.slug.padEnd(22)} ${outcome.source.padEnd(8)} ${outcome.note}`);
  });
  skips.forEach((outcome) => {
    console.log(`  skip  ${rankLabel(outcome.seed)} ${outcome.seed.slug.padEnd(22)} ${outcome.reason}`);
  });
  console.log("");
  console.log(`built ${successes.length} brands, skipped ${skips.length}`);
  console.log(`wrote ${listPath}`);
}

/**
 * Depth-first delete, one syscall at a time.
 *
 * This repo is normally worked on over a bind mount, and that filesystem
 * returns a spurious EACCES when several directory creates or removes land at
 * once — `fs.rm({ recursive: true })` parallelises internally, so it trips over
 * itself on a tree this size. Plain file writes are unaffected, which is why
 * only the directory work is serialised and the fetching still runs wide.
 */
async function removeTreeSerially(target: string): Promise<void> {
  const entries = await readdir(target, { withFileTypes: true }).catch(() => []);
  for (const entry of entries) {
    const child = join(target, entry.name);
    if (entry.isDirectory()) await removeTreeSerially(child);
    else await rm(child, { force: true });
  }
  await rmdir(target).catch(() => undefined);
}

async function buildOne(entry: Resolved): Promise<Outcome> {
  const svg = await downloadSvg(entry.url).catch((error: unknown) => errorMessage(error));
  if (typeof svg === "string") return { ok: false, seed: entry.seed, reason: svg };

  // The directory already exists: main carves the whole tree out up front, so
  // nothing here touches directory metadata. See removeTreeSerially.
  const directory = join(publicRoot, entry.seed.slug);
  const normalizedSvg = normalizeLogoSvg(entry.seed, svg);
  await writeFile(join(directory, "logo.svg"), normalizedSvg);

  const raster = await rasterize(normalizedSvg).catch((error: unknown) => errorMessage(error));
  if (typeof raster === "string") {
    return { ok: false, seed: entry.seed, reason: `rasterize failed — ${raster}` };
  }

  await encodeLogoVariants(raster, CANVAS, directory, BOOST);
  return { ok: true, seed: entry.seed, source: entry.source, note: `${CANVAS}×${CANVAS}` };
}

function normalizeLogoSvg(seed: LogoSeed, svg: Buffer): Buffer {
  if (seed.slug !== "instagram") return svg;
  const text = svg.toString("utf8")
    .replace("viewBox=\"0 0 148.35786 32.804337\"", "viewBox=\"-6 -2 160.35786 36.804337\"")
    .replace("width=\"148.35786mm\"", "width=\"160.35786mm\"")
    .replace("height=\"32.804337mm\"", "height=\"36.804337mm\"")
    .replace(/#000000/g, "#ffffff");
  return Buffer.from(text);
}
/**
 * librsvg renders at 72 dpi against the SVG's intrinsic size, so a 24px icon
 * would come out 24px. Scale the density instead of upscaling the bitmap.
 */
async function rasterize(svg: Buffer): Promise<Uint8Array> {
  const probe = await sharp(svg).metadata();
  const longest = Math.max(probe.width ?? LOGO_BOX, probe.height ?? LOGO_BOX);
  const density = Math.min(2400, Math.max(72, Math.round((72 * LOGO_BOX) / Math.max(longest, 1))));

  const logo = await sharp(svg, { density })
    .resize({ width: LOGO_BOX, height: LOGO_BOX, fit: "inside", withoutEnlargement: false })
    .png()
    .toBuffer();

  const { data } = await sharp({
    create: {
      width: CANVAS,
      height: CANVAS,
      channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    },
  })
    .composite([{ input: logo, gravity: "centre" }])
    .raw()
    .toBuffer({ resolveWithObject: true });

  const pixels = new Uint8Array(data.buffer, data.byteOffset, data.byteLength);
  if (inkCoverage(pixels) < 0.002) throw new Error("rendered blank");
  return pixels;
}

/**
 * librsvg can silently render nothing; a logo that leaves no ink is a failure.
 * Ink is anything not transparent — a white wordmark on a transparent canvas is
 * a logo, not a blank, so colour tells us nothing here and alpha tells us all.
 */
function inkCoverage(pixels: Uint8Array): number {
  const count = pixels.length / 4;
  const inked = Array.from({ length: count }, (_, index) => index).filter(
    (index) => pixels[index * 4 + 3]! > 8,
  ).length;
  return inked / count;
}

async function downloadSvg(url: string, attempt = 0): Promise<Buffer> {
  const response = await fetch(url, { headers: { "User-Agent": USER_AGENT, Accept: "image/svg+xml,*/*" } });
  if (RETRY_STATUSES.has(response.status) && attempt < MAX_RETRIES) {
    await sleep(retryDelay(response, attempt));
    return downloadSvg(url, attempt + 1);
  }
  if (!response.ok) throw new Error(`HTTP ${response.status}`);

  const bytes = Buffer.from(await response.arrayBuffer());
  if (bytes.byteLength > MAX_SVG_BYTES) throw new Error(`SVG too large (${bytes.byteLength} bytes)`);
  // Commons files are sometimes namespace-prefixed at the root (`<svg:svg …>`).
  if (!/<(?:[\w-]+:)?svg[\s>]/i.test(bytes.subarray(0, 4096).toString("utf8"))) {
    throw new Error("response is not an SVG");
  }
  return bytes;
}

/** Honour Retry-After when the server sends one, exponential backoff otherwise. */
function retryDelay(response: Response, attempt: number): number {
  const header = Number(response.headers.get("retry-after"));
  if (Number.isFinite(header) && header > 0) return Math.min(header, 60) * 1000;
  return RETRY_BASE_MS * 2 ** attempt;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function resolveSeed(
  seed: LogoSeed,
  svgl: ReadonlyMap<string, SvglEntry>,
  commons: ReadonlyMap<string, string>,
): Resolved | { seed: LogoSeed; url: null } {
  if (seed.directSvgUrl) return { seed, url: seed.directSvgUrl, source: "commons" };

  const fromSvgl = seed.svglTitle ? svglUrl(svgl.get(seed.svglTitle)) : null;
  if (fromSvgl) return { seed, url: fromSvgl, source: "svgl" };

  const file = seed.commonsFile ?? commons.get(seed.wikipedia);
  if (file && /\.svg$/i.test(file)) return { seed, url: commonsFilePath(file), source: "commons" };

  return { seed, url: null };
}

function svglUrl(entry: SvglEntry | undefined): string | null {
  if (!entry?.route) return null;
  if (typeof entry.route === "string") return entry.route;
  return entry.route.light ?? entry.route.dark ?? null;
}

function commonsFilePath(file: string): string {
  return `https://en.wikipedia.org/wiki/Special:FilePath/${encodeURIComponent(file.replace(/ /g, "_"))}`;
}

async function fetchSvglIndex(): Promise<ReadonlyMap<string, SvglEntry>> {
  const response = await fetch("https://api.svgl.app", { headers: { "User-Agent": USER_AGENT } });
  if (!response.ok) throw new Error(`svgl index: HTTP ${response.status}`);
  const entries = (await response.json()) as readonly SvglEntry[];
  return new Map(entries.map((entry) => [entry.title, entry]));
}

/** Wikipedia title -> Wikidata item -> P154 (logo image) -> Commons file name. */
async function resolveCommonsFiles(seeds: readonly LogoSeed[]): Promise<ReadonlyMap<string, string>> {
  const titles = seeds.map((seed) => seed.wikipedia);
  const items = await mapChunked(chunk(titles, 20), 1, wikidataItemsForTitles);
  const byTitle = new Map(items.flatMap((group) => [...group]));

  const ids = [...new Set([...byTitle.values()])];
  const logos = await mapChunked(chunk(ids, 40), 1, logoFilesForItems);
  const byItem = new Map(logos.flatMap((group) => [...group]));

  return new Map(
    titles.flatMap((title) => {
      const item = byTitle.get(title);
      const file = item ? byItem.get(item) : undefined;
      return file ? [[title, file] as const] : [];
    }),
  );
}

async function wikidataItemsForTitles(titles: readonly string[]): Promise<ReadonlyMap<string, string>> {
  const url = new URL("https://en.wikipedia.org/w/api.php");
  url.search = new URLSearchParams({
    action: "query",
    format: "json",
    formatversion: "2",
    redirects: "1",
    prop: "pageprops",
    ppprop: "wikibase_item",
    titles: titles.join("|"),
  }).toString();

  const data = (await getJson(url)) as {
    query: {
      normalized?: readonly { from: string; to: string }[];
      redirects?: readonly { from: string; to: string }[];
      pages?: readonly { title: string; pageprops?: { wikibase_item?: string } }[];
    };
  };

  const normalized = new Map((data.query.normalized ?? []).map((row) => [row.from, row.to]));
  const redirects = new Map((data.query.redirects ?? []).map((row) => [row.from, row.to]));
  const pages = new Map((data.query.pages ?? []).map((page) => [page.title, page.pageprops?.wikibase_item]));

  return new Map(
    titles.flatMap((title) => {
      const settled = redirects.get(normalized.get(title) ?? title) ?? normalized.get(title) ?? title;
      const item = pages.get(settled);
      return item ? [[title, item] as const] : [];
    }),
  );
}

async function logoFilesForItems(ids: readonly string[]): Promise<ReadonlyMap<string, string>> {
  const url = new URL("https://www.wikidata.org/w/api.php");
  url.search = new URLSearchParams({
    action: "wbgetentities",
    format: "json",
    props: "claims",
    ids: ids.join("|"),
  }).toString();

  const data = (await getJson(url)) as {
    entities: Record<string, { claims?: Record<string, readonly { mainsnak?: { datavalue?: { value?: string } } }[]> }>;
  };

  return new Map(
    Object.entries(data.entities).flatMap(([id, entity]) => {
      const values = (entity.claims?.P154 ?? [])
        .map((claim) => claim.mainsnak?.datavalue?.value)
        .filter((value): value is string => typeof value === "string");
      const svg = values.find((value) => /\.svg$/i.test(value));
      return svg ? [[id, svg] as const] : [];
    }),
  );
}

async function getJson(url: URL): Promise<unknown> {
  const response = await fetch(url, { headers: { "User-Agent": USER_AGENT, Accept: "application/json" } });
  if (!response.ok) throw new Error(`${url.host}: HTTP ${response.status}`);
  return response.json();
}

function rankLabel(seed: LogoSeed): string {
  return `#${seed.rank}`.padEnd(5);
}

function renderCompaniesModule(seeds: readonly LogoSeed[]): string {
  const rows = seeds
    .map((seed) => {
      const fields = [
        `rank: ${seed.rank}`,
        // Optional: most of these brands are product or private brands with no
        // ticker of their own. Omitted entirely rather than written as "".
        ...(seed.ticker ? [`ticker: ${quote(seed.ticker)}`] : []),
        `name: ${quote(seed.name)}`,
        `slug: ${quote(seed.slug)}`,
        `svgPath: ${quote(`/logos/${seed.slug}/logo.svg`)}`,
        `gainmapPath: ${quote(`/logos/${seed.slug}/logo-gainmap.jpg`)}`,
      ];
      return `  { ${fields.join(", ")} },`;
    })
    .join("\n");

  return `/**
 * Generated by tools/logos/build-logos.ts — do not edit by hand.
 *
 * The most recognizable global brands, in Interbrand Best Global Brands 2025
 * order, that have a premium full-color brand SVG. Every entry has both files
 * on disk under apps/web/public.
 */
export type Company = {
  readonly rank: number;
  /** Stock ticker, when the brand is itself a listed company. */
  readonly ticker?: string;
  readonly name: string;
  readonly slug: string;
  readonly svgPath: string;
  readonly gainmapPath: string;
};

export const COMPANIES: readonly Company[] = [
${rows}
];

export function companyBySlug(slug: string): Company | undefined {
  return COMPANIES.find((company) => company.slug === slug);
}

export function logoGainmapSrcset(company: Company): string {
  return [128, 256, 512, 1024].map(w => \`/logos/\${company.slug}/logo-gainmap-\${w}.jpg \${w}w\`).join(", ");
}
`;
}

function quote(value: string): string {
  return JSON.stringify(value);
}

function chunk<T>(items: readonly T[], size: number): readonly (readonly T[])[] {
  return Array.from({ length: Math.ceil(items.length / size) }, (_, index) =>
    items.slice(index * size, index * size + size),
  );
}

/** Sequential over chunks, parallel within one — polite to the upstream APIs. */
async function mapChunked<T, R>(
  items: readonly T[],
  size: number,
  fn: (item: T) => Promise<R>,
): Promise<readonly R[]> {
  return chunk(items, size).reduce<Promise<readonly R[]>>(
    async (previous, group) => [...(await previous), ...(await Promise.all(group.map(fn)))],
    Promise.resolve([]),
  );
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

await main();
