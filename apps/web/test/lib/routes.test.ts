import { readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";

import { createElement } from "react";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import sitemap from "@/app/sitemap";
import { SiteFooter } from "@/components/site-footer";
import { FOOTER_LINKS } from "@/lib/nav";
import {
  SITE_ORIGIN,
  STATIC_ROUTES,
  staticSitemapEntries,
} from "@/lib/routes";

const WEB_ROOT = process.cwd();
const APP_DIR = join(WEB_ROOT, "app");

/**
 * Page routes that exist on disk but must not be crawled.
 * Empty on purpose: /bar was a chrome-less scratch demo and was deleted.
 */
const UNLISTED: readonly { path: string; reason: string }[] = [];

function listPageFiles(dir: string): string[] {
  const entries = readdirSync(dir, { withFileTypes: true });
  return entries.flatMap((entry) => {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) return listPageFiles(full);
    if (entry.name === "page.tsx" || entry.name === "page.ts") return [full];
    return [];
  });
}

function routeOf(file: string): string {
  const rel = relative(APP_DIR, file).replaceAll("\\", "/");
  if (rel === "page.tsx" || rel === "page.ts") return "/";
  return `/${rel.replace(/\/page\.tsx?$/, "")}`;
}

function hasDefaultExport(file: string): boolean {
  return /export default /.test(readFileSync(file, "utf8"));
}

function sitemapPathnames(): string[] {
  return sitemap().map((entry) => {
    const path = new URL(entry.url).pathname;
    if (path === "/") return "/";
    return path.replace(/\/$/, "");
  });
}

function escapeRe(text: string): string {
  return text.replaceAll(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function patternOf(route: string): RegExp {
  const parts = route.split(/\[([^\]]+)\]/);
  const body = parts
    .map((part, i) => {
      if (i % 2 === 1) return "[^/]+";
      return escapeRe(part);
    })
    .join("");
  return new RegExp(`^${body}$`);
}

function coveredBySitemap(route: string, paths: string[]): boolean {
  if (paths.includes(route)) return true;
  if (!route.includes("[")) return false;
  const re = patternOf(route);
  return paths.some((path) => re.test(path));
}

function pageFileFor(
  path: string,
  pages: readonly { route: string; file: string }[],
): string | undefined {
  const exact = pages.find((page) => page.route === path);
  if (exact) return exact.file;
  const dynamic = pages.find((page) => {
    if (!page.route.includes("[")) return false;
    return patternOf(page.route).test(path);
  });
  return dynamic?.file;
}

function navHrefs(): string[] {
  const source = readFileSync(join(WEB_ROOT, "components/site-nav.tsx"), "utf8");
  const block = /const LINKS = \[([\s\S]*?)\] as const/.exec(source)?.[1] ?? "";
  return [...block.matchAll(/href:\s*"([^"]+)"/g)].map((match) => match[1]!);
}

describe("staticSitemapEntries", () => {
  it("uses SITE_ORIGIN by default and keeps home unslashed", () => {
    const entries = staticSitemapEntries();
    expect(entries[0]?.url).toBe(SITE_ORIGIN);
    expect(entries).toHaveLength(STATIC_ROUTES.length);
    expect(entries.some((entry) => entry.url === `${SITE_ORIGIN}/docs`)).toBe(
      true,
    );
  });

  it("prefixes a custom base", () => {
    const entries = staticSitemapEntries("https://example.test");
    expect(entries[0]?.url).toBe("https://example.test");
    expect(entries[1]?.url).toBe("https://example.test/convert");
  });
});

describe("sitemap agrees with the page tree", () => {
  const pages = listPageFiles(APP_DIR)
    .filter(hasDefaultExport)
    .map((file) => ({ file, route: routeOf(file) }));
  const paths = sitemapPathnames();
  const unlisted = new Set(UNLISTED.map((item) => item.path));

  it("every static sitemap URL resolves to a page file", () => {
    for (const path of paths) {
      expect(pageFileFor(path, pages), path).toBeDefined();
    }
  });

  it("every page is in the sitemap or UNLISTED", () => {
    for (const page of pages) {
      if (unlisted.has(page.route)) continue;
      expect(coveredBySitemap(page.route, paths), page.route).toBe(true);
    }
  });

  it("every nav href appears in the sitemap", () => {
    const hrefs = navHrefs();
    expect(hrefs.length).toBeGreaterThan(0);
    for (const href of hrefs) {
      expect(paths, href).toContain(href);
    }
  });

  it("sitemap static entries come from STATIC_ROUTES", () => {
    const urls = sitemap().map((entry) => entry.url);
    for (const entry of staticSitemapEntries()) {
      expect(urls).toContain(entry.url);
    }
  });
});

describe("SiteFooter", () => {
  it("links every secondary route and the credit", () => {
    render(createElement(SiteFooter));
    expect(screen.getByRole("link", { name: "Logos" })).toHaveAttribute(
      "href",
      "/logos",
    );
    expect(screen.getByRole("link", { name: "Text" })).toHaveAttribute(
      "href",
      "/text",
    );
    expect(screen.getByRole("link", { name: "Appearance" })).toHaveAttribute(
      "href",
      "/appearance",
    );
    expect(screen.queryByRole("link", { name: "Community" })).toBeNull();
    expect(
      screen.getByRole("link", { name: "Made by Kirk Strobeck" }),
    ).toHaveAttribute("href", "https://www.linkedin.com/in/kirkstrobeck");
  });

  it("footer hrefs are all in the sitemap", () => {
    const paths = sitemapPathnames();
    for (const { href } of FOOTER_LINKS) {
      expect(paths, href).toContain(href);
    }
  });
});
