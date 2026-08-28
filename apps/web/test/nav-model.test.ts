import { describe, it } from "vitest";
import assert from "node:assert/strict";
import { PRIMARY_NAV_LINKS, FOOTER_LINKS, FOOTER_SECONDARY_LINKS } from "@/lib/nav";
import { STATIC_ROUTES } from "@/lib/routes";

describe("nav model", () => {
  it("every static route is reachable within 2 clicks via nav or footer", () => {
    const navHrefs = new Set(FOOTER_LINKS.map((l) => l.href));
    navHrefs.add("/"); // home is the Gainmaps wordmark in nav
    // slug routes (/photos/[slug], /logos/[slug]) are reached via gallery/logos pages
    const slugPrefixes = ["/photos/", "/logos/"];

    for (const route of STATIC_ROUTES) {
      const directlyLinked = navHrefs.has(route.path);
      const viaParent = slugPrefixes.some((prefix) => route.path.startsWith(prefix));
      assert.ok(
        directlyLinked || viaParent,
        `Route ${route.path} is not reachable within 2 clicks — add it to FOOTER_LINKS or PRIMARY_NAV_LINKS`,
      );
    }
  });

  it("PRIMARY_NAV_LINKS hides the unfinished community page", () => {
    const hrefs = PRIMARY_NAV_LINKS.map((l) => l.href);
    assert.equal(hrefs.includes("/community"), false);
  });

  it("FOOTER_LINKS includes all primary nav links", () => {
    const footerHrefs = new Set(FOOTER_LINKS.map((l) => l.href));
    for (const link of PRIMARY_NAV_LINKS) {
      assert.ok(footerHrefs.has(link.href), `Footer missing primary nav link: ${link.href}`);
    }
  });

  it("FOOTER_SECONDARY_LINKS includes Logos, Text, Appearance", () => {
    const hrefs = FOOTER_SECONDARY_LINKS.map((l) => l.href);
    assert.ok(hrefs.includes("/logos"), "Footer secondary must include /logos");
    assert.ok(hrefs.includes("/text"), "Footer secondary must include /text");
    assert.ok(hrefs.includes("/appearance"), "Footer secondary must include /appearance");
  });
});
