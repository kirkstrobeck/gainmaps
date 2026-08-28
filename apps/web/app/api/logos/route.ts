import { NextResponse } from "next/server";
import { COMPANIES } from "@/lib/logos/companies";
import { jsonOk } from "@/lib/api-response";

export async function GET(): Promise<NextResponse> {
  const data = COMPANIES.map((company) => ({
    rank: company.rank,
    name: company.name,
    slug: company.slug,
    svgPath: company.svgPath,
    gainmapPath: company.gainmapPath,
  }));
  return jsonOk(data);
}
