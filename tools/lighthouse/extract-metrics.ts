#!/usr/bin/env tsx
import { readdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve("/workspace");

function getReports(preset: "desktop" | "mobile") {
  const dir = resolve(root, `.lhci-reports/${preset}`);
  let files: string[] = [];
  try {
    files = readdirSync(dir).filter(f => f.endsWith(".report.json"));
  } catch {
    console.log(`No reports found at ${dir}`);
    return;
  }
  console.log(`\n## ${preset.toUpperCase()} REPORTS (${files.length} files)\n`);
  for (const file of files.sort()) {
    const path = resolve(dir, file);
    const raw = readFileSync(path, "utf8");
    let report: any;
    try {
      report = JSON.parse(raw);
    } catch {
      console.log(`PARSE ERROR: ${file}`);
      continue;
    }
    const url = report.requestedUrl ?? "absent";
    const perf = report.categories?.performance?.score ?? "absent";
    const a11y = report.categories?.accessibility?.score ?? "absent";
    const seo = report.categories?.seo?.score ?? "absent";
    const bp = report.categories?.["best-practices"]?.score ?? "absent";
    const lcp = report.audits?.["largest-contentful-paint"]?.numericValue ?? "absent";
    const fcp = report.audits?.["first-contentful-paint"]?.numericValue ?? "absent";
    const si = report.audits?.["speed-index"]?.numericValue ?? "absent";
    const tbt = report.audits?.["total-blocking-time"]?.numericValue ?? "absent";
    const cls = report.audits?.["cumulative-layout-shift"]?.numericValue ?? "absent";
    const mw = report.audits?.["mainthread-work-breakdown"]?.numericValue ?? "absent";
    const boot = report.audits?.["bootup-time"]?.numericValue ?? "absent";
    const tbw = report.audits?.["total-byte-weight"]?.numericValue ?? "absent";

    console.log(`### ${file}`);
    console.log(`- requestedUrl: ${url}`);
    console.log(`- performance: ${perf}`);
    console.log(`- accessibility: ${a11y}`);
    console.log(`- seo: ${seo}`);
    console.log(`- best-practices: ${bp}`);
    console.log(`- LCP (ms): ${lcp}`);
    console.log(`- FCP (ms): ${fcp}`);
    console.log(`- speed-index (ms): ${si}`);
    console.log(`- TBT (ms): ${tbt}`);
    console.log(`- CLS: ${cls}`);
    console.log(`- mainthread-work-breakdown (ms): ${mw}`);
    console.log(`- bootup-time (ms): ${boot}`);
    console.log(`- total-byte-weight (bytes): ${tbw}`);
    console.log();
  }
}

getReports("desktop");
getReports("mobile");
