import { NextResponse } from "next/server";

export const CORS_HEADERS = {
  "access-control-allow-origin": "*",
  "cache-control": "public, max-age=3600, stale-while-revalidate=86400",
} as const;

export type ApiError = { error: { code: string; message: string; hint: string } };

export function jsonOk<T>(data: T): NextResponse<T> {
  return NextResponse.json(data, { headers: CORS_HEADERS });
}

export function jsonNotFound(resource: string, slug: string): NextResponse<ApiError> {
  return NextResponse.json(
    { error: { code: "NOT_FOUND", message: `${resource} "${slug}" not found`, hint: `GET /api/${resource.toLowerCase()}s for the full list` } },
    { status: 404, headers: CORS_HEADERS },
  );
}
