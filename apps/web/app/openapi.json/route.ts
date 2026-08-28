import { NextResponse } from "next/server";
import { buildOpenApiSpec } from "@/lib/openapi-spec";
import { CORS_HEADERS } from "@/lib/api-response";

export async function GET(): Promise<NextResponse> {
  return NextResponse.json(buildOpenApiSpec(), {
    headers: {
      ...CORS_HEADERS,
      "cache-control": "public, max-age=86400",
    },
  });
}
