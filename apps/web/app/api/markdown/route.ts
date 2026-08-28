import { NextRequest, NextResponse } from "next/server";
import { MARKDOWN_PATHS, markdownForPath } from "@/lib/page-markdown";
import { CORS_HEADERS, jsonNotFound } from "@/lib/api-response";

export async function GET(request: NextRequest): Promise<NextResponse> {
  const path = request.nextUrl.searchParams.get("path") ?? "";
  if (!MARKDOWN_PATHS.has(path)) {
    return jsonNotFound("path", path);
  }
  const content = markdownForPath(path);
  return new NextResponse(content, {
    headers: {
      "content-type": "text/markdown; charset=utf-8",
      vary: "Accept, Accept-Encoding",
      ...CORS_HEADERS,
    },
  });
}
