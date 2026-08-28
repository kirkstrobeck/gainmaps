export type SiteMode = "light" | "dark";
export type SiteUltra = "on" | "off";

export const SITE_MODE_COOKIE = "site-mode";
export const SITE_ULTRA_COOKIE = "site-ultra";
export const SITE_INTENSITY_COOKIE = "site-intensity";
export const SITE_APPEARANCE_EVENT = "site-appearance";

export const DEFAULT_SITE_MODE: SiteMode = "dark";
export const DEFAULT_SITE_ULTRA: SiteUltra = "on";

export type SiteAppearance = {
  mode: SiteMode;
  ultra: SiteUltra;
  intensity?: number;
};

export function isSiteMode(value: string | null | undefined): value is SiteMode {
  return value === "light" || value === "dark";
}

export function isSiteUltra(value: string | null | undefined): value is SiteUltra {
  return value === "on" || value === "off";
}

export function parseSiteMode(value: string | null | undefined): SiteMode {
  if (isSiteMode(value)) return value;
  return DEFAULT_SITE_MODE;
}

export function parseSiteUltra(value: string | null | undefined): SiteUltra {
  if (isSiteUltra(value)) return value;
  return DEFAULT_SITE_ULTRA;
}

function cookieValue(name: string): string | undefined {
  /* v8 ignore next */
  if (typeof document === "undefined") return undefined;
  const prefix = `${name}=`;
  const row = document.cookie.split("; ").find((part) => part.startsWith(prefix));
  if (!row) return undefined;
  return decodeURIComponent(row.slice(prefix.length));
}

function writeCookie(name: string, value: string) {
  document.cookie = `${name}=${encodeURIComponent(value)}; path=/; samesite=lax; max-age=31536000`;
}

export function readSiteMode(): SiteMode {
  if (typeof document === "undefined") return DEFAULT_SITE_MODE;
  const fromDom = document.documentElement.dataset.mode;
  if (isSiteMode(fromDom)) return fromDom;
  return parseSiteMode(cookieValue(SITE_MODE_COOKIE));
}

export function readSiteUltra(): SiteUltra {
  if (typeof document === "undefined") return DEFAULT_SITE_ULTRA;
  const fromDom = document.documentElement.dataset.ultra;
  if (isSiteUltra(fromDom)) return fromDom;
  return parseSiteUltra(cookieValue(SITE_ULTRA_COOKIE));
}

export function readSiteIntensity(): number | undefined {
  if (typeof document === "undefined") return undefined;
  const fromDom = document.documentElement.dataset.intensity;
  if (fromDom != null && fromDom !== "") {
    const n = Number(fromDom);
    if (Number.isFinite(n)) return Math.min(100, Math.max(0, Math.round(n)));
  }
  const fromCookie = cookieValue(SITE_INTENSITY_COOKIE);
  if (fromCookie == null) return undefined;
  const n = Number(fromCookie);
  if (!Number.isFinite(n)) return undefined;
  return Math.min(100, Math.max(0, Math.round(n)));
}

export function applySiteAppearance(next: SiteAppearance): void {
  document.documentElement.dataset.mode = next.mode;
  document.documentElement.dataset.ultra = next.ultra;
  if (next.intensity == null) return;
  document.documentElement.dataset.intensity = String(next.intensity);
}

function searchFromAppearance(next: SiteAppearance): string {
  const params = new URLSearchParams(window.location.search);
  params.set("mode", next.mode);
  params.set("ultra", next.ultra);
  if (next.intensity != null) params.set("intensity", String(next.intensity));
  return params.toString();
}

export function writeSiteAppearance(next: SiteAppearance): void {
  applySiteAppearance(next);
  writeCookie(SITE_MODE_COOKIE, next.mode);
  writeCookie(SITE_ULTRA_COOKIE, next.ultra);
  if (next.intensity != null) writeCookie(SITE_INTENSITY_COOKIE, String(next.intensity));
  const qs = searchFromAppearance(next);
  /* v8 ignore next */
  const qsPart = qs ? `?${qs}` : "";
  const url = `${window.location.pathname}${qsPart}${window.location.hash}`;
  window.history.replaceState(null, "", url);
  window.dispatchEvent(new CustomEvent(SITE_APPEARANCE_EVENT, { detail: next }));
}

export function appearanceHref(path: string, appearance: SiteAppearance): string {
  if (path.startsWith("http://") || path.startsWith("https://")) return path;
  const url = new URL(path, "https://www.gainmaps.com");
  url.searchParams.set("mode", appearance.mode);
  url.searchParams.set("ultra", appearance.ultra);
  if (appearance.intensity != null) url.searchParams.set("intensity", String(appearance.intensity));
  return `${url.pathname}${url.search}${url.hash}`;
}

export function subscribeSiteAppearance(onStoreChange: () => void) {
  window.addEventListener(SITE_APPEARANCE_EVENT, onStoreChange);
  return () => window.removeEventListener(SITE_APPEARANCE_EVENT, onStoreChange);
}

let _cached: SiteAppearance | null = null;

export function readSiteAppearance(): SiteAppearance {
  const mode = readSiteMode();
  const ultra = readSiteUltra();
  if (_cached && _cached.mode === mode && _cached.ultra === ultra) return _cached;
  _cached = { mode, ultra };
  return _cached;
}
