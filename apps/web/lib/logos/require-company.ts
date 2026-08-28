import { companyBySlug, type Company } from "@/lib/logos/companies";

/** Resolve a catalog slug or fail at import time — a typo must not render blank. */
export function requireCompany(slug: string): Company {
  const company = companyBySlug(slug);
  if (company == null) throw new Error(`logo slug not found: ${slug}`);
  return company;
}
