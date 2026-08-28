import { readFile } from "node:fs/promises";
import { join } from "node:path";

const HEADERS = {
  "content-type": "text/plain; charset=utf-8",
  "cache-control": "public, max-age=3600, stale-while-revalidate=86400",
} as const;

export async function llmsTxtResponse(): Promise<Response> {
  const content = await readFile(join(process.cwd(), "public/llms.txt"), "utf8");
  return new Response(content, { headers: HEADERS });
}
