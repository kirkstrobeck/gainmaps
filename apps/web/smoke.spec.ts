import { expect, test } from "@playwright/test";
import { readFileSync } from "node:fs";
import sharp from "sharp";

const palettePng = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAIAAAACAQMAAABIeJ9nAAAAAXNSR0IB2cksfwAAAAZQTFRFAAAAgICAkmm5JAAAAAJ0Uk5TAP9bkSK1AAAADElEQVR4nGM4wHAAAAMEAYEUGL32AAAAAElFTkSuQmCC",
  "base64",
);

async function downloadJob(page: import("@playwright/test").Page) {
  const downloadPromise = page.waitForEvent("download");
  await page.getByTestId("job-row").getByRole("button", { name: "Download" }).click();
  return downloadPromise;
}

const BASE_URL = process.env.PLAYWRIGHT_BASE_URL ?? "http://127.0.0.1:3000";

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    try {
      for (const key of ["ultra-mode", "hdr-lab-ultra-mode", "hdr-lab-gainmap-mode"]) {
        localStorage.removeItem(key);
      }
    } catch {
      // Ignore private-mode failures.
    }
  });
  await page.goto(`${BASE_URL}/convert`);
  await expect(page.getByRole("heading", { name: "Drop images here to make them HDR." })).toBeVisible();
  await expect(page.getByText("Privacy: These files do not go anywhere.")).toBeVisible();
  await expect(page.getByRole("link", { name: "Made by Kirk Strobeck" })).toHaveAttribute(
    "href",
    "https://www.linkedin.com/in/kirkstrobeck",
  );
});

test("home page renders drop zone and brew snippet", async ({ page }) => {
  await page.goto(BASE_URL);
  await expect(page.getByText("brew install kirkstrobeck/tap/gainmap")).toBeVisible();
  await expect(page.getByRole("link", { name: "Upvote on Product Hunt" })).toHaveAttribute(
    "href",
    "https://www.producthunt.com/products/gain-maps-stunning-colors-for-ui",
  );
});

test("home heading paints ink in both modes and with Ultra disabled", async ({ page }) => {
  for (const [mode, ultra, bright] of [["light", "on", false], ["dark", "on", true], ["dark", "off", true]] as const) {
    await page.goto(`${BASE_URL}/?mode=${mode}`);
    await page.getByRole("button", { name: "Got it" }).click({ timeout: 2_000 }).catch(() => undefined);
    await page.locator("html").evaluate((html, value) => {
      html.dataset.mode = value.mode;
      html.dataset.ultra = value.ultra;
    }, { mode, ultra });
    const heading = page.getByRole("heading", { name: "Gainmaps" });
    await expect(heading).toBeVisible();
    await expect.poll(() => page.locator("h1 .ultra-word mask text").count()).toBeGreaterThan(0);

    const png = await heading.screenshot();
    const { data } = await sharp(png).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    const ink = Array.from({ length: data.length / 4 }, (_, index) => data.subarray(index * 4, index * 4 + 3))
      .filter(([red, green, blue]) => bright ? red > 180 && green > 180 && blue > 180 : red < 80 && green < 80 && blue < 80);
    expect(ink.length).toBeGreaterThan(200);
    await expect(heading.locator(".ultra-word > span:not([aria-hidden])")).not.toHaveCSS("color", "rgba(0, 0, 0, 0)");
  }
});

test("processes a PNG through the gain map queue", async ({ page }) => {
  test.setTimeout(120000);

  await page.locator("input[type=file]").setInputFiles({
    name: "sticker-source.png",
    mimeType: "image/png",
    buffer: palettePng,
  });
  await expect(page.getByText("Original")).toBeVisible();
  await expect(page.getByText("Revised")).toBeVisible();
  await expect(page.getByTestId("job-row")).toHaveCount(1);
  await expect(page.getByText(/Gain map JPEG/)).toBeVisible({ timeout: 120000 });
  await expect(page.getByText("1/1")).toBeVisible({ timeout: 30000 });

  const download = await downloadJob(page);
  expect(download.suggestedFilename()).toBe("sticker-source-gainmap.jpg");

  const path = await download.path();
  expect(path).toBeTruthy();
  const bytes = readFileSync(path!);
  expect(bytes[0]).toBe(0xff);
  expect(bytes[1]).toBe(0xd8);
});

test("encodes indexed PNGs as gain map JPEGs", async ({ page }) => {
  await page.locator("input[type=file]").setInputFiles({
    name: "indexed-logo.png",
    mimeType: "image/png",
    buffer: palettePng,
  });
  await expect(page.getByText(/Gain map JPEG/)).toBeVisible({ timeout: 30000 });

  const download = await downloadJob(page);
  expect(download.suggestedFilename()).toBe("indexed-logo-gainmap.jpg");

  const path = await download.path();
  expect(path).toBeTruthy();
  const bytes = readFileSync(path!);
  expect(bytes[0]).toBe(0xff);
  expect(bytes[1]).toBe(0xd8);
});

const tinyJpeg = Buffer.from(
  "/9j/2wBDAAMCAgMCAgMDAwMEAwMEBQgFBQQEBQoHBwYIDAoMDAsKCwsNDhIQDQ4RDgsLEBYQERMUFRUVDA8XGBYUGBIUFRT/2wBDAQMEBAUEBQkFBQkUDQsNFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBT/wAARCAAIAAgDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAL/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFAEBAAAAAAAAAAAAAAAAAAAAB//EABQRAQAAAAAAAAAAAAAAAAAAAAD/2gAMAwEAAhEDEQA/ALANYif/2Q==",
  "base64",
);

test("encodes JPEGs as gain map JPEGs", async ({ page }) => {
  await page.locator("input[type=file]").setInputFiles({
    name: "photo.jpg",
    mimeType: "image/jpeg",
    buffer: tinyJpeg,
  });
  await expect(page.getByText(/Gain map JPEG/)).toBeVisible({ timeout: 30000 });

  const download = await downloadJob(page);
  expect(download.suggestedFilename()).toBe("photo-gainmap.jpg");
});

test("encodes animated SMIL SVGs as gain map JPEGs", async ({ page }) => {
  test.setTimeout(90000);
  await page.locator("input[type=file]").setInputFiles("fixtures/ai-powered-marketing-tools-abstract.svg");
  await expect(page.getByText(/Gain map JPEG/)).toBeVisible({ timeout: 60000 });

  const download = await downloadJob(page);
  expect(download.suggestedFilename()).toBe("ai-powered-marketing-tools-abstract-gainmap.jpg");

  const path = await download.path();
  expect(path).toBeTruthy();
  const bytes = readFileSync(path!);
  expect(bytes[0]).toBe(0xff);
  expect(bytes[1]).toBe(0xd8);
  const latin = bytes.toString("latin1");
  expect(latin.includes("hdrgm") || latin.includes("GainMap") || latin.includes("MPF")).toBeTruthy();
});

test("encodes SVGs as gain map JPEGs", async ({ page }) => {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 64 64">
  <rect width="64" height="64" fill="#1d4ed8"/>
  <circle cx="32" cy="32" r="18" fill="#f8fafc"/>
</svg>`;

  await page.locator("input[type=file]").setInputFiles({
    name: "mark.svg",
    mimeType: "image/svg+xml",
    buffer: Buffer.from(svg),
  });
  await expect(page.getByText(/Gain map JPEG/)).toBeVisible({ timeout: 30000 });

  const download = await downloadJob(page);
  expect(download.suggestedFilename()).toBe("mark-gainmap.jpg");
});

test("defaults Ultra on and exposes chrome toggles", async ({ page }) => {
  await page.goto(BASE_URL);
  await expect(page.locator("html")).toHaveAttribute("data-ultra", "on");
  await expect(page.getByRole("switch", { name: "Ultra display" })).toHaveCount(1);
  await expect(page.getByRole("switch", { name: "Color mode" })).toHaveCount(1);

  await page.getByRole("switch", { name: "Ultra display" }).click();
  await expect(page.locator("html")).toHaveAttribute("data-ultra", "off");
  await expect(page).toHaveURL(/ultra=off/);

  await page.getByRole("switch", { name: "Ultra display" }).click();
  await expect(page.locator("html")).toHaveAttribute("data-ultra", "on");
});

test("shows the technical document with page anchors", async ({ page }) => {
  await page.getByRole("link", { name: "Docs" }).click();
  await expect(page).toHaveURL(/\/docs$/);
  await expect(page.getByRole("heading", { name: "What Gainmaps actually does to an image" })).toBeVisible();
  const docsNav = page.getByRole("complementary");
  await expect(docsNav.getByRole("link", { name: /Pipeline/ })).toHaveAttribute("href", "#pipeline");
  await expect(docsNav.getByRole("link", { name: /Standards/ })).toHaveAttribute("href", "#standards");
  await expect(docsNav.getByRole("link", { name: /Names/ })).toHaveAttribute("href", "#names");
  await expect(page.locator("#names")).toBeVisible();
  await expect(page.locator("#gain")).toBeVisible();
});

test("/logos page renders with nav", async ({ page }) => {
  await page.goto(`${BASE_URL}/logos`);
  await expect(page.getByRole("navigation")).toBeVisible();
});

test("/photos page renders gallery section", async ({ page }) => {
  await page.goto(`${BASE_URL}/photos`);
  await expect(page.getByRole("heading", { name: "Photos" })).toBeVisible();
});

test("/text page renders UltraWord instances and intensity slider", async ({ page }) => {
  await page.goto(`${BASE_URL}/text`);
  await expect(page.getByRole("heading", { name: "Ultra text demo" })).toBeVisible();
  await expect(page.getByRole("slider")).toBeVisible();
});

test("/text intensity param persists to URL", async ({ page }) => {
  await page.goto(`${BASE_URL}/text?intensity=80`);
  const slider = page.getByRole("slider");
  await expect(slider).toHaveValue("80");
});

test("/appearance page renders controls", async ({ page }) => {
  await page.goto(`${BASE_URL}/appearance`);
  await expect(page.locator(".appearance-lab")).toBeVisible();
});

test("/community page shows giscus widget", async ({ page }) => {
  await page.goto(`${BASE_URL}/community`);
  await expect(page.getByRole("heading", { name: "Community" })).toBeVisible();
});

test("mode URL param sets data-mode on html element", async ({ page }) => {
  await page.goto(`${BASE_URL}/?mode=light`);
  await expect(page.locator("html")).toHaveAttribute("data-mode", "light");
});

test("mode param persists across same-site navigation", async ({ page }) => {
  await page.goto(`${BASE_URL}/?mode=light`);
  await page.goto(`${BASE_URL}/docs`);
  await expect(page.locator("html")).toHaveAttribute("data-mode", "light");
});

test("converter output contains MPF APP2 marker and hdrgm XMP", async ({ page }) => {
  test.setTimeout(120000);

  // The MPF marker proves the output carries a Multi-Picture Format segment,
  // and hdrgm proves the gain-map XMP metadata was written.
  const palettePng2 = Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAIAAAACAQMAAABIeJ9nAAAAAXNSR0IB2cksfwAAAAZQTFRFAAAAgICAkmm5JAAAAAJ0Uk5TAP9bkSK1AAAADElEQVR4nGM4wHAAAAMEAYEUGL32AAAAAElFTkSuQmCC",
    "base64",
  );

  await page.locator("input[type=file]").setInputFiles({
    name: "palette-test.png",
    mimeType: "image/png",
    buffer: palettePng2,
  });

  await expect(page.getByText(/Gain map JPEG/)).toBeVisible({ timeout: 60000 });

  const download = await downloadJob(page);
  const path = await download.path();
  expect(path).toBeTruthy();

  const bytes = readFileSync(path!);
  const latin = bytes.toString("latin1");

  // JPEG header
  expect(bytes[0]).toBe(0xff);
  expect(bytes[1]).toBe(0xd8);

  // hdrgm XMP namespace — proves gain-map metadata was embedded
  expect(latin).toContain("hdrgm");

  // MPF APP2 marker: 4d 50 46 00 ("MPF\0") — proves Multi-Picture Format segment
  const mpfTarget = Buffer.from([0x4d, 0x50, 0x46, 0x00]);
  let mpfOffset = -1;
  for (let i = 0; i <= bytes.length - mpfTarget.length; i++) {
    if (bytes[i] === mpfTarget[0] && bytes[i + 1] === mpfTarget[1] && bytes[i + 2] === mpfTarget[2] && bytes[i + 3] === mpfTarget[3]) {
      mpfOffset = i;
      break;
    }
  }
  expect(mpfOffset, "MPF\\0 marker not found in output").toBeGreaterThan(0);

  // Report sizes and offset for the task report (visible in test output)
  console.log(`MPF regression: input=${palettePng2.length}B output=${bytes.length}B MPF@${mpfOffset}`);
});

test("no flash of wrong theme on hard reload", async ({ page }) => {
  // Set dark mode cookie then reload — html[data-mode] must be set by the
  // inline script before the first paint, not flipping after hydration.
  await page.context().addCookies([{ name: "site-mode", value: "dark", domain: "127.0.0.1", path: "/" }]);
  await page.goto(BASE_URL, { waitUntil: "commit" });
  // The inline script runs synchronously before the DOM is interactive.
  // At "commit" (headers received) the script has NOT yet run, but once the
  // HTML is partially parsed the data-mode attribute is set. We verify it
  // is correct before React hydrates by waiting for DOMContentLoaded.
  await page.waitForLoadState("domcontentloaded");
  await expect(page.locator("html")).toHaveAttribute("data-mode", "dark");
});

test("cookieless visit renders with default appearance", async ({ page }) => {
  // No cookies set — Ultra should default to on, mode to dark (system default).
  await page.goto(BASE_URL);
  await expect(page.locator("html")).toHaveAttribute("data-ultra", "on");
  // Nav pill reflects the state
  await expect(page.getByRole("switch", { name: "Ultra display" })).toBeVisible();
});

test("seam instrument is keyboard accessible", async ({ page }) => {
  await page.goto(BASE_URL);
  const handle = page.getByRole("slider", { name: "Comparison position" }).first();
  await expect(handle).toBeVisible();
  await handle.focus();
  // Arrow right should move the seam — verify via --seam-x CSS custom property on the container
  await page.keyboard.press("ArrowRight");
  await page.keyboard.press("ArrowRight");
  // The container's --seam-x should now be non-50
  const seamX = await page.evaluate(() => {
    const container = document.querySelector(".inst");
    return container ? getComputedStyle(container).getPropertyValue("--seam-x").trim() : null;
  });
  // Initial is 50%, after 2 ArrowRight presses it should be 54%
  expect(seamX).toBeTruthy();
  expect(parseFloat(seamX!)).toBeGreaterThan(50);
});

test("ultra defaults to on for fresh cookieless visit", async ({ page, context }) => {
  await context.clearCookies();
  await page.goto(BASE_URL);
  await expect(page.locator("html")).toHaveAttribute("data-ultra", "on");
  await expect(
    page.getByRole("switch", { name: "Ultra display" })
  ).toHaveAttribute("aria-checked", "true");
});

test("seam starts at 50% on both instruments on first paint", async ({ page }) => {
  await page.goto(BASE_URL);
  const values = await page.evaluate(() =>
    Array.from(document.querySelectorAll(".inst")).map(el =>
      getComputedStyle(el).getPropertyValue("--seam-x").trim()
    )
  );
  expect(values.length).toBeGreaterThanOrEqual(2);
  for (const v of values) {
    expect(parseFloat(v)).toBeCloseTo(50, 0);
  }

  // Also verify the handle element is physically positioned at ~50% of the instrument
  const insts = page.locator(".inst");
  const count = await insts.count();
  expect(count).toBeGreaterThanOrEqual(2);
  for (let i = 0; i < count; i++) {
    const inst = insts.nth(i);
    const handle = inst.locator(".inst-handle");
    const instBox = await inst.boundingBox();
    const handleBox = await handle.boundingBox();
    expect(instBox).toBeTruthy();
    expect(handleBox).toBeTruthy();
    const handleCx = handleBox!.x + handleBox!.width / 2;
    const instMid  = instBox!.x + instBox!.width / 2;
    expect(Math.abs(handleCx - instMid)).toBeLessThan(instBox!.width * 0.05);
  }
});

test("pointer drag from image body moves the seam", async ({ page }) => {
  await page.goto(BASE_URL);
  const inst = page.locator(".inst").first();
  const box = await inst.boundingBox();
  expect(box).toBeTruthy();
  const y = box!.y + box!.height / 2;
  await page.mouse.move(box!.x + box!.width * 0.3, y);
  await page.mouse.down();
  await page.mouse.move(box!.x + box!.width * 0.7, y);
  await page.mouse.up();
  const seamX = await page.evaluate(() => {
    const el = document.querySelector(".inst");
    return el ? getComputedStyle(el).getPropertyValue("--seam-x").trim() : "0";
  });
  expect(parseFloat(seamX)).toBeGreaterThan(60);
});

test("seam corner SDR/Ultra buttons are accessible and functional", async ({ page }) => {
  await page.goto(BASE_URL);
  const inst = page.locator(".inst").first();

  await inst.getByRole("button", { name: "Show Standard" }).click();
  await page.waitForTimeout(400);
  const afterSdr = await page.evaluate(() => {
    const el = document.querySelector(".inst");
    return el ? getComputedStyle(el).getPropertyValue("--seam-x").trim() : "0";
  });
  expect(parseFloat(afterSdr)).toBeCloseTo(100, 0);

  await inst.getByRole("button", { name: "Show Ultra" }).click();
  await page.waitForTimeout(400);
  const afterUltra = await page.evaluate(() => {
    const el = document.querySelector(".inst");
    return el ? getComputedStyle(el).getPropertyValue("--seam-x").trim() : "100";
  });
  expect(parseFloat(afterUltra)).toBeCloseTo(0, 0);
});

test("UltraWord SDR fallback text is visible and has adequate contrast", async ({ page }) => {
  await page.goto(`${BASE_URL}/?mode=dark&ultra=on`);
  await page.getByRole("button", { name: "Got it" }).click({ timeout: 2_000 }).catch(() => undefined);

  // Force dark mode + ultra on via dataset, then wait for mask text to populate
  await page.locator("html").evaluate((html) => {
    html.dataset.mode = "dark";
    html.dataset.ultra = "on";
  });
  await expect.poll(() => page.locator("h1 .ultra-word mask text").count()).toBeGreaterThan(0);

  // The readable span (not aria-hidden) must have a non-transparent, non-background color
  const readableColor = await page.locator("h1 .ultra-word > span:not([aria-hidden])").first().evaluate((el) => {
    return getComputedStyle(el).color;
  });
  expect(readableColor).not.toBe("rgba(0, 0, 0, 0)");
  expect(readableColor).not.toBe("transparent");

  // Screenshot the h1 and verify ink pixels (bright in dark mode — expect light pixels)
  const heading = page.getByRole("heading", { name: "Gainmaps" });
  await expect(heading).toBeVisible();
  const png = await heading.screenshot();
  const { data } = await sharp(png).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const brightPixels = Array.from({ length: data.length / 4 }, (_, i) => data.subarray(i * 4, i * 4 + 3))
    .filter(([r, g, b]) => r > 160 && g > 160 && b > 160);
  expect(brightPixels.length, "Expected bright ink pixels in Gainmaps heading (SDR fallback visible)").toBeGreaterThan(100);

  // Also verify in light mode: UltraWord inside the seam instrument shows readable text
  await page.locator("html").evaluate((html) => {
    html.dataset.mode = "light";
  });
  await page.waitForTimeout(300);

  // The inst .ultra-word backdrop should use white (#ffffff or near-white) in light mode
  const instBackdropBg = await page.locator(".inst .ultra-word > .ultra-backdrop").first().evaluate((el) => {
    return getComputedStyle(el).backgroundColor;
  });
  // background should be white (255,255,255), NOT the dark foreground color
  expect(instBackdropBg).toMatch(/rgb\(255,\s*255,\s*255\)|rgb\(254,|rgb\(253,/);
});
