// Minimal site-appearance stub for UltraFillCanvas.
// Replace with your project's real appearance system if you have one.

export type SiteUltra = "on" | "off";

export const SITE_APPEARANCE_EVENT = "site-appearance";

export function readSiteUltra(): SiteUltra {
  if (typeof document === "undefined") return "on";
  const fromDom = document.documentElement.dataset.ultra;
  if (fromDom === "on" || fromDom === "off") return fromDom;
  return "on";
}
