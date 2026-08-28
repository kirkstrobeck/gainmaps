import { readFileSync, readdirSync, existsSync } from "node:fs";
import { join, resolve } from "node:path";

const preset = process.argv[2] ?? "desktop";
const reportsDir = resolve("/workspace/.lhci-reports", preset);

if (!existsSync(reportsDir)) {
  console.error(`No reports directory: ${reportsDir}`);
  process.exit(1);
}

type LhrItem = Record<string, unknown>;
type LhrAudit = {
  score: number | null;
  displayValue?: string;
  numericValue?: number;
  details?: { overallSavingsMs?: number; overallSavingsBytes?: number; items?: LhrItem[] };
};
type Report = {
  categories: Record<string, { score: number | null }>;
  audits: Record<string, LhrAudit>;
};

function readReport(path: string): Report {
  return JSON.parse(readFileSync(path, "utf8")) as Report;
}

const byUrl = new Map<string, string[]>();
const representativeByUrl = new Map<string, string>();
const manifestPath = join(reportsDir, "manifest.json");

const useManifest = existsSync(manifestPath);
if (useManifest) {
  const manifest = JSON.parse(readFileSync(manifestPath, "utf8")) as Array<{
    url: string; isRepresentativeRun: boolean; jsonPath: string;
  }>;
  for (const e of manifest) {
    if (!byUrl.has(e.url)) byUrl.set(e.url, []);
    byUrl.get(e.url)!.push(e.jsonPath);
    if (e.isRepresentativeRun) representativeByUrl.set(e.url, e.jsonPath);
  }
}
if (!useManifest) {
  const files = readdirSync(reportsDir).filter(f => f.endsWith(".report.json")).map(f => join(reportsDir, f));
  for (const f of files) {
    let url = f;
    try {
      const r = JSON.parse(readFileSync(f, "utf8")) as { finalUrl?: string; requestedUrl?: string };
      url = r.finalUrl ?? r.requestedUrl ?? f;
    } catch { /* keep url = f */ }
    if (!byUrl.has(url)) byUrl.set(url, []);
    byUrl.get(url)!.push(f);
  }
}

const urls = [...byUrl.keys()].sort((a, b) => {
  const pa = a.replace(/^https?:\/\/[^/]+/, "") || "/";
  const pb = b.replace(/^https?:\/\/[^/]+/, "") || "/";
  if (pa === "/") return -1;
  if (pb === "/") return 1;
  return pa.localeCompare(pb);
});

function pickMedian(filePaths: string[]): string {
  const scored = filePaths.map(f => {
    try { return { f, score: readReport(f).categories.performance?.score ?? 0 }; }
    catch { return { f, score: 0 }; }
  }).sort((a, b) => a.score - b.score);
  return scored[Math.floor(scored.length / 2)].f;
}

const PERF_METRICS = [
  "first-contentful-paint", "largest-contentful-paint", "total-blocking-time",
  "cumulative-layout-shift", "speed-index", "server-response-time",
];

const ITEM_AUDITS = [
  "uses-responsive-images", "uses-optimized-images", "modern-image-formats",
  "unused-javascript", "legacy-javascript", "uses-long-cache-ttl",
  "unsized-images", "render-blocking-resources", "total-byte-weight",
  "bf-cache", "largest-contentful-paint-element", "layout-shift-elements",
];

const sep = "─".repeat(72);

function fmtItem(item: LhrItem): string {
  const node = item["node"] as { snippet?: string; nodeLabel?: string; selector?: string } | undefined;
  const rawUrl = (item["url"] as string | undefined)
    ?? node?.snippet
    ?? (item["source"] as { url?: string } | undefined)?.url
    ?? "";
  const parts: string[] = [];
  if (rawUrl) parts.push(rawUrl.length > 120 ? "…" + rawUrl.slice(-119) : rawUrl);
  for (const f of ["totalBytes", "wastedBytes", "wastedMs", "cacheLifetimeMs", "reason", "failureType", "score"]) {
    if (item[f] != null) parts.push(`${f}=${item[f]}`);
  }
  if (node?.nodeLabel) parts.push(`nodeLabel=${node.nodeLabel}`);
  if (node?.selector) parts.push(`selector=${node.selector}`);
  return parts.join("  ");
}

for (const fullUrl of urls) {
  const filePaths = byUrl.get(fullUrl)!;
  const displayUrl = fullUrl.replace(/^https?:\/\/[^/]+/, "") || "/";
  const medianPath = representativeByUrl.get(fullUrl) ?? pickMedian(filePaths);
  let rep: Report;
  try { rep = readReport(medianPath); }
  catch {
    console.log(`\n${sep}\nURL: ${displayUrl}  [ERROR reading report]\n`);
    continue;
  }

  const pf = rep.categories.performance?.score;
  const a11y = rep.categories.accessibility?.score;
  const bp = rep.categories["best-practices"]?.score;
  const seo = rep.categories.seo?.score;
  const allScores = filePaths
    .map(f => { try { return readReport(f).categories.performance?.score ?? null; } catch { return null; } })
    .filter((s): s is number => s !== null).sort((a, b) => a - b);

  console.log(`\n${sep}`);
  console.log(`URL: ${displayUrl}  (${filePaths.length} runs, median: ${medianPath.replace(/.*\//, "")})`);
  console.log(`  performance: ${pf?.toFixed(2) ?? "null"}  accessibility: ${a11y?.toFixed(2) ?? "null"}  best-practices: ${bp?.toFixed(2) ?? "null"}  seo: ${seo?.toFixed(2) ?? "null"}`);
  console.log(`  perf spread: [${allScores.map(s => s.toFixed(2)).join(", ")}]`);

  console.log("\n  METRICS:");
  for (const id of PERF_METRICS) {
    const audit = rep.audits[id];
    if (!audit) continue;
    const val = audit.numericValue != null ? audit.numericValue.toFixed(1) : "n/a";
    console.log(`    ${id.padEnd(28)} ${val.padStart(10)}  ${audit.displayValue ?? ""}`);
  }

  const perfRefs = rep.categories.performance?.auditRefs as Array<{ id: string }> | undefined;
  if (perfRefs) {
    const failing = perfRefs
      .map(r => ({ id: r.id, audit: rep.audits[r.id] }))
      .filter(({ audit }) => audit?.score != null && audit.score < 1);
    if (failing.length > 0) {
      console.log("\n  FAILING AUDITS (score < 1.00):");
      for (const { id, audit } of failing) {
        const savMs = audit.details?.overallSavingsMs != null ? `  savingsMs=${audit.details.overallSavingsMs.toFixed(0)}` : "";
        const savB = audit.details?.overallSavingsBytes != null ? `  savingsBytes=${audit.details.overallSavingsBytes.toFixed(0)}` : "";
        console.log(`    ${id.padEnd(40)} score=${audit.score!.toFixed(2)}  ${audit.displayValue ?? ""}${savMs}${savB}`);
      }
    }
  }

  const hasItemAudits = ITEM_AUDITS.some(id => (rep.audits[id]?.details?.items?.length ?? 0) > 0);
  if (hasItemAudits) {
    console.log("\n  AUDIT ITEMS:");
    for (const id of ITEM_AUDITS) {
      const items = rep.audits[id]?.details?.items;
      if (!items || items.length === 0) continue;
      console.log(`    ${id}:`);
      for (const item of items.slice(0, 20)) console.log(`      ${fmtItem(item)}`);
      if (items.length > 20) console.log(`      … ${items.length - 20} more items omitted`);
    }
  }
}

console.log(`\n${sep}`);
console.log("HDR-SERVICE-WORKER NETWORK REQUEST SCAN (manifest reports):");
const allManifestFiles = [...new Set([...byUrl.values()].flat())];
const hits: Array<{ report: string; url: string; transferSize: number }> = [];
for (const f of allManifestFiles) {
  try {
    const items = (readReport(f).audits["network-requests"]?.details as { items?: Array<{ url?: string; transferSize?: number }> } | undefined)?.items ?? [];
    for (const item of items) {
      if (item.url?.includes("hdr-service-worker"))
        hits.push({ report: f.replace(/.*\//, ""), url: item.url, transferSize: item.transferSize ?? 0 });
    }
  } catch { /* skip */ }
}
if (hits.length === 0) console.log("  Not requested on any route in any report.");
for (const h of hits) console.log(`  ${h.report}: ${h.url} (${h.transferSize} bytes)`);
console.log(`\n${sep}\nDone.\n`);
