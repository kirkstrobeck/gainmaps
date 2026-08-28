import * as fs from "fs";
import * as path from "path";

const PRESETS = ["desktop", "mobile"] as const;
const AUDITS = [
  "largest-contentful-paint",
  "first-contentful-paint",
  "speed-index",
  "total-blocking-time",
  "cumulative-layout-shift",
  "mainthread-work-breakdown",
  "total-byte-weight",
];

interface ReportData {
  requestedUrl: string;
  performance: number | "absent";
  accessibility: number | "absent";
  bestPractices: number | "absent";
  seo: number | "absent";
  audits: Record<string, number | "absent">;
}

function val(v: unknown): number | "absent" {
  if (v === undefined || v === null) return "absent";
  return v as number;
}

function parseReport(filePath: string): ReportData {
  const raw = JSON.parse(fs.readFileSync(filePath, "utf-8"));
  const audits: Record<string, number | "absent"> = {};
  for (const key of AUDITS) {
    audits[key] = raw.audits?.[key]?.numericValue ?? "absent";
  }
  return {
    requestedUrl: raw.requestedUrl ?? "absent",
    performance: val(raw.categories?.performance?.score),
    accessibility: val(raw.categories?.accessibility?.score),
    bestPractices: val(raw.categories?.["best-practices"]?.score),
    seo: val(raw.categories?.seo?.score),
    audits,
  };
}

function formatNum(v: number | "absent"): string {
  if (v === "absent") return "absent";
  return String(v);
}

const lines: string[] = [];

for (const preset of PRESETS) {
  const dir = path.join("/workspace/.lhci-reports", preset);
  if (!fs.existsSync(dir)) {
    lines.push(`## ${preset}\n\n_No reports found._\n`);
    continue;
  }

  const files = fs
    .readdirSync(dir)
    .filter((f) => f.endsWith(".report.json"))
    .map((f) => path.join(dir, f))
    .sort();

  // Group by route
  const byRoute = new Map<string, ReportData[]>();
  for (const f of files) {
    const data = parseReport(f);
    const route = data.requestedUrl;
    if (!byRoute.has(route)) byRoute.set(route, []);
    byRoute.get(route)!.push(data);
  }

  lines.push(`## ${preset}\n`);

  for (const [route, runs] of byRoute) {
    lines.push(`### ${route}\n`);
    lines.push(
      `| run | performance | accessibility | best-practices | seo | lcp | fcp | speed-index | tbt | cls | mainthread | total-bytes |`
    );
    lines.push(`| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |`);
    runs.forEach((r, i) => {
      lines.push(
        `| ${i + 1} | ${formatNum(r.performance)} | ${formatNum(r.accessibility)} | ${formatNum(r.bestPractices)} | ${formatNum(r.seo)} | ${formatNum(r.audits["largest-contentful-paint"])} | ${formatNum(r.audits["first-contentful-paint"])} | ${formatNum(r.audits["speed-index"])} | ${formatNum(r.audits["total-blocking-time"])} | ${formatNum(r.audits["cumulative-layout-shift"])} | ${formatNum(r.audits["mainthread-work-breakdown"])} | ${formatNum(r.audits["total-byte-weight"])} |`
      );
    });
    lines.push("");
  }
}

console.log(lines.join("\n"));
