#!/usr/bin/env npx tsx
/**
 * Parse CATALOG lines from bulk-find output and add them to catalog.ts.
 * Usage: npx tsx tools/photos/add-to-catalog.ts /tmp/bulk-find-stdout.txt <needed>
 */
import { readFileSync, writeFileSync } from "node:fs";
import { PHOTOS } from "../../apps/web/lib/photos/catalog.ts";

const bulkFindOutput = process.argv[2] ?? "/tmp/bulk-find-stdout.txt";
const needed = parseInt(process.argv[3] ?? "73", 10);

const raw = readFileSync(bulkFindOutput, "utf-8");

// Extract catalog objects from CATALOG lines (strip leading "  CATALOG: ")
const catalogLines: string[] = [];
const seenIds = new Set<string>(PHOTOS.map((p) => p.id));

for (const line of raw.split("\n")) {
  const match = line.match(/^\s*CATALOG:\s*(\{.+\})\s*$/);
  if (!match) continue;
  const objStr = match[1]!;
  // Extract id from the object string to deduplicate
  const idMatch = objStr.match(/id:\s*"([^"]+)"/);
  if (!idMatch) continue;
  const id = idMatch[1]!;
  if (seenIds.has(id)) continue;
  seenIds.add(id);
  catalogLines.push(objStr);
  if (catalogLines.length >= needed) break;
}

console.log(`Found ${catalogLines.length} new catalog entries (needed ${needed})`);
if (catalogLines.length < needed) {
  console.warn(`WARNING: Only found ${catalogLines.length} entries, not ${needed}`);
}

// Read catalog.ts
const catalogPath = "/workspace/apps/web/lib/photos/catalog.ts";
const catalogContent = readFileSync(catalogPath, "utf-8");

// Find the closing `];` of the PHOTOS array
const insertionMarker = "\n];\n";
const idx = catalogContent.lastIndexOf(insertionMarker);
if (idx === -1) {
  throw new Error("Could not find closing ];\\ in catalog.ts");
}

// Build the new entries string
const newEntries = catalogLines.map((obj) => `  ${obj},`).join("\n");
const newContent =
  catalogContent.slice(0, idx) +
  "\n" +
  newEntries +
  catalogContent.slice(idx);

writeFileSync(catalogPath, newContent, "utf-8");
console.log(`Added ${catalogLines.length} entries to catalog.ts`);
console.log(`New total: ${PHOTOS.length + catalogLines.length} photos`);
