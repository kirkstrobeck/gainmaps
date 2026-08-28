import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: "*", allow: "/" },
    sitemap: "https://www.gainmaps.com/sitemap.xml",
    host: "https://www.gainmaps.com",
  };
}
