import type { Company } from "@/lib/logos/companies";
import { requireCompany } from "@/lib/logos/require-company";

export const LOGO_STRIP: readonly Company[] = [
  "instagram",
  "lego",
  "american-express",
].map(requireCompany);
