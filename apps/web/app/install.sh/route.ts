/* Ultra mode by Kirk Strobeck */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { NextResponse } from "next/server";

const SCRIPT = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), "../../../../packages/gainmap/install.sh"),
  "utf8",
);

export async function GET() {
  return new NextResponse(SCRIPT, {
    headers: {
      "content-type": "text/x-shellscript",
      "cache-control": "no-store",
    },
  });
}
