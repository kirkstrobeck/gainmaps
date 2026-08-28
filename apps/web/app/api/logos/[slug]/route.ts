import { NextResponse } from "next/server";
import { companyBySlug } from "@/lib/logos/companies";
import { jsonOk, jsonNotFound } from "@/lib/api-response";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ slug: string }> },
): Promise<NextResponse> {
  const { slug } = await params;
  const company = companyBySlug(slug);
  if (!company) return jsonNotFound("logo", slug);
  return jsonOk({ rank: company.rank, name: company.name, slug: company.slug, svgPath: company.svgPath, gainmapPath: company.gainmapPath });
}
