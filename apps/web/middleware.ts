import { NextRequest, NextResponse } from "next/server";

import { parseSiteMode, parseSiteUltra } from "@/lib/site-appearance";
import { TEXT_ULTRA_SLIDER_DEFAULT } from "@/lib/text-ultra";
import { PHOTOS } from "@/lib/photos/catalog";
import { MARKDOWN_PATHS } from "@/lib/page-markdown";
import { appendVary } from "@/lib/append-vary";

const CANONICAL_HOST = "www.gainmaps.com";

function clampIntensity(raw: string | undefined | null): number {
  const n = Number(raw ?? TEXT_ULTRA_SLIDER_DEFAULT);
  if (!Number.isFinite(n)) return TEXT_ULTRA_SLIDER_DEFAULT;
  return Math.min(100, Math.max(0, Math.round(n)));
}

function hostName(header: string): string {
  return header.split(":")[0]?.toLowerCase() ?? "";
}

function redirectToCanonical(request: NextRequest, hostname: string): NextResponse | null {
  if (/^light\./i.test(hostname)) {
    const dest = request.nextUrl.clone();
    dest.protocol = "https:";
    dest.port = "";
    dest.hostname = CANONICAL_HOST;
    dest.searchParams.set("mode", "light");
    return NextResponse.redirect(dest, 308);
  }
  if (/^dark\./i.test(hostname)) {
    const dest = request.nextUrl.clone();
    dest.protocol = "https:";
    dest.port = "";
    dest.hostname = CANONICAL_HOST;
    dest.searchParams.set("mode", "dark");
    return NextResponse.redirect(dest, 308);
  }
  if (hostname === "gainmaps.com") {
    const dest = request.nextUrl.clone();
    dest.protocol = "https:";
    dest.port = "";
    dest.hostname = CANONICAL_HOST;
    return NextResponse.redirect(dest, 308);
  }
  return null;
}

function pickHeroPhoto(lastSlug: string | undefined): { slug: string; changed: boolean } {
  const candidates = lastSlug ? PHOTOS.filter((p) => p.slug !== lastSlug) : PHOTOS;
  const pool = candidates.length > 0 ? candidates : PHOTOS;
  const photo = pool[Math.floor(Math.random() * pool.length)] ?? PHOTOS[0]!;
  return { slug: photo.slug, changed: photo.slug !== lastSlug };
}

export function middleware(request: NextRequest) {
  const hostname = hostName(request.headers.get("host") ?? "");
  const hostRedirect = redirectToCanonical(request, hostname);
  if (hostRedirect) return hostRedirect;

  // Check Accept: text/markdown for content pages
  const accept = request.headers.get("accept") ?? "";
  if (accept.includes("text/markdown")) {
    const { pathname } = request.nextUrl;
    if (MARKDOWN_PATHS.has(pathname)) {
      const dest = request.nextUrl.clone();
      dest.pathname = "/api/markdown";
      dest.searchParams.set("path", pathname);
      return NextResponse.rewrite(dest);
    }
    const body = `# 404 — Page Not Found\n\nThis path does not exist on Gainmaps.\n\n## Where to look next\n\n- [Home](/)\n- [Gallery](/photos)\n- [Developers](/developers)\n- [Docs](/docs)\n- [OpenAPI spec](/openapi.json)\n- [Sitemap](/sitemap.xml)\n- [Agent index](/llms.txt)\n`;
    return new NextResponse(body, {
      status: 404,
      headers: {
        "content-type": "text/markdown; charset=utf-8",
        "vary": "Accept, Accept-Encoding",
      },
    });
  }

  const url = request.nextUrl;
  const modeParam = url.searchParams.get("mode");
  const existingMode = request.cookies.get("site-mode")?.value;
  const mode = parseSiteMode(
    modeParam === "light" || modeParam === "dark" ? modeParam : existingMode,
  );

  const ultraParam = url.searchParams.get("ultra");
  const existingUltra = request.cookies.get("site-ultra")?.value;
  const ultra = parseSiteUltra(
    ultraParam === "on" || ultraParam === "off" ? ultraParam : existingUltra,
  );

  const intensityParam = url.searchParams.get("intensity");
  const existingIntensity = request.cookies.get("site-intensity")?.value;
  const intensity = clampIntensity(intensityParam ?? existingIntensity);

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-site-mode", mode);
  requestHeaders.set("x-site-ultra", ultra);
  requestHeaders.set("x-site-intensity", String(intensity));

  // Homepage hero: random photo excluding last-photo cookie so a reload never repeats
  let heroPhotoSlug: string | undefined;
  let heroPhotoCookieChanged = false;
  if (url.pathname === "/") {
    const lastSlug = request.cookies.get("last-photo")?.value;
    const picked = pickHeroPhoto(lastSlug);
    heroPhotoSlug = picked.slug;
    heroPhotoCookieChanged = picked.changed;
    requestHeaders.set("x-hero-photo-slug", picked.slug);
  }

  const response = NextResponse.next({ request: { headers: requestHeaders } });
  if (MARKDOWN_PATHS.has(url.pathname)) {
    appendVary(response.headers, "Accept");
  }

  // Only set cookies when the value changes — prevents no-store Cache-Control
  // on every request, which would disqualify pages from the back/forward cache.
  if (existingMode !== mode) {
    response.cookies.set("site-mode", mode, { path: "/", sameSite: "lax" });
  }
  if (existingUltra !== ultra) {
    response.cookies.set("site-ultra", ultra, { path: "/", sameSite: "lax" });
  }
  if (existingIntensity !== String(intensity)) {
    response.cookies.set("site-intensity", String(intensity), { path: "/", sameSite: "lax" });
  }
  if (heroPhotoSlug && heroPhotoCookieChanged) {
    response.cookies.set("last-photo", heroPhotoSlug, { path: "/", sameSite: "lax", maxAge: 60 * 60 * 24 * 365 });
  }

  return response;
}

export const config = {
  matcher: ["/((?!_next|api|favicon\\.ico|.*\\..*).*)"],
};
