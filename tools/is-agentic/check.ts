#!/usr/bin/env tsx
/**
 * Check the is-agentic.com score for the site.
 *
 * Exits non-zero when the score is below MIN_SCORE.
 * Called by .github/workflows/is-agentic.yml and runnable locally:
 *
 *   npx tsx tools/is-agentic/check.ts
 *   pnpm is-agentic
 */

// Minimum score required. Must only ever be raised, never lowered.
// Target is 100. Current baseline measured 2026-08-26.
const MIN_SCORE = 58;

const TARGET_URL = "https://www.gainmaps.com";

interface IsAgenticReport {
  score: number;
  score_label: string;
  scanned_at: string;
  issues?: Array<{ id: string; name: string; result: string; details?: string }>;
}

async function main() {
  console.log(`Checking is-agentic score for ${TARGET_URL} …`);

  const { execSync } = await import("node:child_process");
  let raw: string;
  try {
    raw = execSync(`npx is-agentic ${TARGET_URL} --json`, {
      encoding: "utf-8",
      timeout: 60_000,
    });
  } catch (err) {
    console.error("Failed to run is-agentic:", err);
    process.exit(1);
  }

  let report: IsAgenticReport;
  try {
    report = JSON.parse(raw);
  } catch {
    console.error("Could not parse is-agentic JSON output:\n", raw);
    process.exit(1);
  }

  const { score, score_label, scanned_at, issues } = report;

  console.log(`\nScanned at : ${scanned_at}`);
  console.log(`Score      : ${score} / 100  (${score_label})`);
  console.log(`Required   : ${MIN_SCORE}`);

  const failing = (issues ?? []).filter((i) => i.result === "failed");
  if (failing.length) {
    console.log("\nFailing checks:");
    for (const issue of failing) {
      console.log(`  ✗ [${issue.id}] ${issue.name}`);
      if (issue.details) console.log(`      ${issue.details}`);
    }
  }

  if (score < MIN_SCORE) {
    console.error(
      `\n✗ Score ${score} is below the required minimum of ${MIN_SCORE}.`,
    );
    process.exit(1);
  }

  console.log(`\n✓ Score ${score} meets the required minimum of ${MIN_SCORE}.`);
}

main();
