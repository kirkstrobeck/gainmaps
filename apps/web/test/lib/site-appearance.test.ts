import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  DEFAULT_SITE_MODE,
  DEFAULT_SITE_ULTRA,
  SITE_MODE_COOKIE,
  SITE_INTENSITY_COOKIE,
  isSiteMode,
  isSiteUltra,
  parseSiteMode,
  parseSiteUltra,
  readSiteMode,
  readSiteUltra,
  readSiteIntensity,
  applySiteAppearance,
} from "@/lib/site-appearance";

beforeEach(() => {
  delete document.documentElement.dataset.mode;
  delete document.documentElement.dataset.ultra;
  delete document.documentElement.dataset.intensity;
  document.cookie = `${SITE_MODE_COOKIE}=; max-age=0`;
  document.cookie = `site-ultra=; max-age=0`;
  document.cookie = `${SITE_INTENSITY_COOKIE}=; max-age=0`;
});

afterEach(() => vi.unstubAllGlobals());

describe("isSiteMode", () => {
  it("accepts light", () => expect(isSiteMode("light")).toBe(true));
  it("accepts dark", () => expect(isSiteMode("dark")).toBe(true));
  it("rejects other string", () => expect(isSiteMode("auto")).toBe(false));
  it("rejects null", () => expect(isSiteMode(null)).toBe(false));
  it("rejects undefined", () => expect(isSiteMode(undefined)).toBe(false));
});

describe("isSiteUltra", () => {
  it("accepts on", () => expect(isSiteUltra("on")).toBe(true));
  it("accepts off", () => expect(isSiteUltra("off")).toBe(true));
  it("rejects other string", () => expect(isSiteUltra("yes")).toBe(false));
  it("rejects null", () => expect(isSiteUltra(null)).toBe(false));
});

describe("parseSiteMode", () => {
  it("returns value when valid", () => expect(parseSiteMode("light")).toBe("light"));
  it("returns default when invalid", () => expect(parseSiteMode("bad")).toBe(DEFAULT_SITE_MODE));
  it("returns default when null", () => expect(parseSiteMode(null)).toBe(DEFAULT_SITE_MODE));
});

describe("parseSiteUltra", () => {
  it("returns value when valid", () => expect(parseSiteUltra("off")).toBe("off"));
  it("returns default when invalid", () => expect(parseSiteUltra(null)).toBe(DEFAULT_SITE_ULTRA));
});

describe("readSiteMode", () => {
  it("returns default when document is undefined", () => {
    vi.stubGlobal("document", undefined);
    expect(readSiteMode()).toBe(DEFAULT_SITE_MODE);
  });

  it("reads from dataset.mode", () => {
    document.documentElement.dataset.mode = "light";
    expect(readSiteMode()).toBe("light");
  });

  it("reads from cookie when dataset missing", () => {
    document.cookie = `${SITE_MODE_COOKIE}=light`;
    expect(readSiteMode()).toBe("light");
  });

  it("returns default when neither dataset nor cookie set", () => {
    expect(readSiteMode()).toBe(DEFAULT_SITE_MODE);
  });
});

describe("readSiteUltra", () => {
  it("returns default when document is undefined", () => {
    vi.stubGlobal("document", undefined);
    expect(readSiteUltra()).toBe(DEFAULT_SITE_ULTRA);
  });

  it("reads from dataset.ultra", () => {
    document.documentElement.dataset.ultra = "off";
    expect(readSiteUltra()).toBe("off");
  });

  it("reads from cookie when dataset missing", () => {
    document.cookie = "site-ultra=off";
    expect(readSiteUltra()).toBe("off");
  });

  it("returns default when neither set", () => {
    expect(readSiteUltra()).toBe(DEFAULT_SITE_ULTRA);
  });
});

describe("readSiteIntensity", () => {
  it("returns undefined when document is undefined", () => {
    vi.stubGlobal("document", undefined);
    expect(readSiteIntensity()).toBeUndefined();
  });

  it("reads finite number from dataset.intensity", () => {
    document.documentElement.dataset.intensity = "75";
    expect(readSiteIntensity()).toBe(75);
  });

  it("ignores dataset.intensity when not finite", () => {
    document.documentElement.dataset.intensity = "NaN";
    expect(readSiteIntensity()).toBeUndefined();
  });

  it("ignores empty dataset.intensity", () => {
    document.documentElement.dataset.intensity = "";
    expect(readSiteIntensity()).toBeUndefined();
  });

  it("reads from cookie when dataset missing", () => {
    document.cookie = `${SITE_INTENSITY_COOKIE}=50`;
    expect(readSiteIntensity()).toBe(50);
  });

  it("returns undefined for non-finite cookie", () => {
    document.cookie = `${SITE_INTENSITY_COOKIE}=abc`;
    expect(readSiteIntensity()).toBeUndefined();
  });

  it("clamps dataset value to 0-100", () => {
    document.documentElement.dataset.intensity = "150";
    expect(readSiteIntensity()).toBe(100);
  });

  it("clamps cookie value to 0-100", () => {
    document.cookie = `${SITE_INTENSITY_COOKIE}=-5`;
    expect(readSiteIntensity()).toBe(0);
  });
});

describe("applySiteAppearance", () => {
  it("sets mode and ultra on documentElement", () => {
    applySiteAppearance({ mode: "light", ultra: "off" });
    expect(document.documentElement.dataset.mode).toBe("light");
    expect(document.documentElement.dataset.ultra).toBe("off");
  });

  it("sets intensity when provided", () => {
    applySiteAppearance({ mode: "dark", ultra: "on", intensity: 60 });
    expect(document.documentElement.dataset.intensity).toBe("60");
  });

  it("skips intensity when null", () => {
    delete document.documentElement.dataset.intensity;
    applySiteAppearance({ mode: "dark", ultra: "on" });
    expect(document.documentElement.dataset.intensity).toBeUndefined();
  });
});
