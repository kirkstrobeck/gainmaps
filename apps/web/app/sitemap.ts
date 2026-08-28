import type { MetadataRoute } from "next";
import { COMPANIES } from "@/lib/logos/companies";
import { PHOTOS } from "@/lib/photos/catalog";
import { SITE_ORIGIN, staticSitemapEntries } from "@/lib/routes";

export default function sitemap(): MetadataRoute.Sitemap {
  const base = SITE_ORIGIN;
  const statics = staticSitemapEntries(base);
  const logoRoutes: MetadataRoute.Sitemap = COMPANIES.map((c) => ({
    url: `${base}/logos/${c.slug}`,
    changeFrequency: "monthly",
    priority: 0.7,
  }));
  const photoRoutes: MetadataRoute.Sitemap = PHOTOS.map((p) => ({
    url: `${base}/photos/${p.slug}`,
    changeFrequency: "monthly",
    priority: 0.7,
  }));
  return [...statics, ...logoRoutes, ...photoRoutes];
}
