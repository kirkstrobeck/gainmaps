#!/usr/bin/env tsx
import { readdirSync, readFileSync, statSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve("/workspace");
const dir = resolve(root, ".lhci-reports/mobile");

// group files by URL
let files: string[] = [];
try {
  files = readdirSync(dir).filter(f => f.endsWith(".report.json")).sort();
} catch {
  console.log("No mobile reports found");
  process.exit(0);
}

const byUrl = new Map<string, { f: string; mtime: number }[]>();
for (const f of files) {
  const raw = readFileSync(resolve(dir, f), "utf8");
  let r: any;
  try { r = JSON.parse(raw); } catch { continue; }
  const url = r.requestedUrl ?? "unknown";
  const mtime = statSync(resolve(dir, f)).mtimeMs;
  if (!byUrl.has(url)) byUrl.set(url, []);
  byUrl.get(url)!.push({ f, mtime });
}

for (const [url, flist] of byUrl) {
  // pick most recent file for this URL
  flist.sort((a, b) => b.mtime - a.mtime);
  const file = flist[0].f;
  const raw = readFileSync(resolve(dir, file), "utf8");
  let report: any;
  try { report = JSON.parse(raw); } catch { continue; }

  console.log(`\n## URL: ${url}`);
  console.log(`## File: ${file}`);

  // find LCP phase audit
  const audits = report.audits ?? {};
  const lcpAudits = Object.keys(audits).filter(id =>
    id.includes("lcp") && (id.includes("breakdown") || id.includes("phase") || id.includes("lantern"))
  );

  if (lcpAudits.length === 0) {
    console.log("LCP phase audit: absent");
  } else {
    for (const id of lcpAudits) {
      const audit = audits[id];
      console.log(`### Audit ID: ${id}`);
      console.log(`details.items: ${JSON.stringify(audit?.details?.items ?? null, null, 2)}`);
    }
  }
}
