import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  SITE_MODE_COOKIE,
  SITE_ULTRA_COOKIE,
  SITE_INTENSITY_COOKIE,
  SITE_APPEARANCE_EVENT,
  writeSiteAppearance,
  appearanceHref,
  subscribeSiteAppearance,
  readSiteAppearance,
} from "@/lib/site-appearance";

beforeEach(() => {
  delete document.documentElement.dataset.mode;
  delete document.documentElement.dataset.ultra;
  delete document.documentElement.dataset.intensity;
  document.cookie = `${SITE_MODE_COOKIE}=; max-age=0`;
  document.cookie = `${SITE_ULTRA_COOKIE}=; max-age=0`;
  document.cookie = `${SITE_INTENSITY_COOKIE}=; max-age=0`;
});

afterEach(() => vi.unstubAllGlobals());

describe("writeSiteAppearance", () => {
  it("updates documentElement dataset", () => {
    writeSiteAppearance({ mode: "light", ultra: "off" });
    expect(document.documentElement.dataset.mode).toBe("light");
    expect(document.documentElement.dataset.ultra).toBe("off");
  });

  it("writes mode and ultra cookies", () => {
    writeSiteAppearance({ mode: "light", ultra: "off" });
    expect(document.cookie).toContain(`${SITE_MODE_COOKIE}=`);
    expect(document.cookie).toContain(`${SITE_ULTRA_COOKIE}=`);
  });

  it("writes intensity cookie when provided", () => {
    writeSiteAppearance({ mode: "dark", ultra: "on", intensity: 80 });
    expect(document.cookie).toContain(`${SITE_INTENSITY_COOKIE}=`);
  });

  it("skips intensity cookie when absent", () => {
    writeSiteAppearance({ mode: "dark", ultra: "on" });
    expect(document.cookie).not.toContain(SITE_INTENSITY_COOKIE);
  });

  it("dispatches site-appearance event", () => {
    const handler = vi.fn();
    window.addEventListener(SITE_APPEARANCE_EVENT, handler);
    writeSiteAppearance({ mode: "dark", ultra: "on" });
    expect(handler).toHaveBeenCalledTimes(1);
    window.removeEventListener(SITE_APPEARANCE_EVENT, handler);
  });

  it("updates window location search", () => {
    writeSiteAppearance({ mode: "light", ultra: "off" });
    expect(window.location.search).toContain("mode=light");
    expect(window.location.search).toContain("ultra=off");
  });
});

describe("appearanceHref", () => {
  it("preserves http absolute urls unchanged", () => {
    const result = appearanceHref("http://example.com", { mode: "dark", ultra: "on" });
    expect(result).toBe("http://example.com");
  });

  it("preserves https absolute urls unchanged", () => {
    const result = appearanceHref("https://example.com", { mode: "dark", ultra: "on" });
    expect(result).toBe("https://example.com");
  });

  it("builds relative url with mode and ultra params", () => {
    const result = appearanceHref("/photos", { mode: "light", ultra: "off" });
    expect(result).toContain("mode=light");
    expect(result).toContain("ultra=off");
  });

  it("adds intensity param when provided", () => {
    const result = appearanceHref("/photos", { mode: "dark", ultra: "on", intensity: 70 });
    expect(result).toContain("intensity=70");
  });

  it("omits intensity param when absent", () => {
    const result = appearanceHref("/photos", { mode: "dark", ultra: "on" });
    expect(result).not.toContain("intensity");
  });
});

describe("subscribeSiteAppearance", () => {
  it("adds and removes event listener", () => {
    const cb = vi.fn();
    const unsub = subscribeSiteAppearance(cb);
    window.dispatchEvent(new CustomEvent(SITE_APPEARANCE_EVENT));
    expect(cb).toHaveBeenCalledTimes(1);
    unsub();
    window.dispatchEvent(new CustomEvent(SITE_APPEARANCE_EVENT));
    expect(cb).toHaveBeenCalledTimes(1);
  });
});

describe("readSiteAppearance", () => {
  it("builds appearance from DOM state", () => {
    document.documentElement.dataset.mode = "dark";
    document.documentElement.dataset.ultra = "on";
    const result = readSiteAppearance();
    expect(result.mode).toBe("dark");
    expect(result.ultra).toBe("on");
  });

  it("returns cached object on repeated identical call", () => {
    document.documentElement.dataset.mode = "dark";
    document.documentElement.dataset.ultra = "on";
    const a = readSiteAppearance();
    const b = readSiteAppearance();
    expect(a).toBe(b);
  });

  it("updates cache when mode changes", () => {
    document.documentElement.dataset.mode = "dark";
    document.documentElement.dataset.ultra = "on";
    const first = readSiteAppearance();
    document.documentElement.dataset.mode = "light";
    const second = readSiteAppearance();
    expect(second).not.toBe(first);
    expect(second.mode).toBe("light");
  });
});
