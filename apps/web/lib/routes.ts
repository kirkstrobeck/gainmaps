import type { MetadataRoute } from "next";

export const SITE_ORIGIN = "https://www.gainmaps.com";

export type StaticRoute = {
  readonly path: string;
  readonly changeFrequency: "monthly";
  readonly priority: number;
};

const MONTHLY = "monthly" as const;

export const STATIC_ROUTES: readonly StaticRoute[] = [
  { path: "/", changeFrequency: MONTHLY, priority: 1.0 },
  { path: "/convert", changeFrequency: MONTHLY, priority: 0.7 },
  { path: "/convert/how-it-works", changeFrequency: MONTHLY, priority: 0.7 },
  { path: "/docs", changeFrequency: MONTHLY, priority: 0.7 },
  { path: "/logos", changeFrequency: MONTHLY, priority: 0.7 },
  { path: "/photos", changeFrequency: MONTHLY, priority: 0.7 },
  { path: "/text", changeFrequency: MONTHLY, priority: 0.7 },
  { path: "/appearance", changeFrequency: MONTHLY, priority: 0.7 },
  { path: "/developers", changeFrequency: MONTHLY, priority: 0.7 },
  { path: "/about",      changeFrequency: MONTHLY, priority: 0.7 },
  { path: "/contact",    changeFrequency: MONTHLY, priority: 0.7 },
  { path: "/privacy",    changeFrequency: MONTHLY, priority: 0.7 },
];

function absoluteUrl(base: string, path: string): string {
  if (path === "/") return base;
  return `${base}${path}`;
}

export function staticSitemapEntries(
  base: string = SITE_ORIGIN,
): MetadataRoute.Sitemap {
  return STATIC_ROUTES.map((route) => ({
    url: absoluteUrl(base, route.path),
    changeFrequency: route.changeFrequency,
    priority: route.priority,
  }));
}
