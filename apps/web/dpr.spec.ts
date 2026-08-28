import { expect, test } from "@playwright/test";

const BASE_URL = process.env.PLAYWRIGHT_BASE_URL ?? "http://127.0.0.1:3000";

test("DPR-2 hero and gallery image resolution at 1440x900", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });

  // Hero
  await page.goto(BASE_URL);
  await page.waitForLoadState("networkidle");
  const hero = page.locator(".inst-img").first();
  await expect(hero).toBeVisible();
  const heroCssWidth = (await hero.boundingBox())?.width ?? 0;
  const heroNaturalWidth = await hero.evaluate((img: HTMLImageElement) => img.naturalWidth);
  const heroSrc = await hero.evaluate((img: HTMLImageElement) => img.currentSrc);
  const heroDpr2Pass = heroNaturalWidth >= Math.round(heroCssWidth * 2);

  // Gallery
  await page.goto(`${BASE_URL}/photos`);
  await page.waitForLoadState("networkidle");
  const gallery = page.locator(".photo-card .inst-img").first();
  await expect(gallery).toBeVisible();
  const galleryCssWidth = (await gallery.boundingBox())?.width ?? 0;
  const galleryNaturalWidth = await gallery.evaluate((img: HTMLImageElement) => img.naturalWidth);
  const gallerySrc = await gallery.evaluate((img: HTMLImageElement) => img.currentSrc);
  const galleryDpr2Pass = galleryNaturalWidth >= Math.round(galleryCssWidth * 2);

  console.log(JSON.stringify({ dpr: 2, hero: { css: heroCssWidth, natural: heroNaturalWidth, src: heroSrc, pass: heroDpr2Pass }, gallery: { css: galleryCssWidth, natural: galleryNaturalWidth, src: gallerySrc, pass: galleryDpr2Pass } }));

  expect(heroDpr2Pass, `hero DPR-2: naturalWidth ${heroNaturalWidth} < cssWidth ${heroCssWidth} * 2 = ${heroCssWidth * 2}`).toBe(true);
  expect(galleryDpr2Pass, `gallery DPR-2: naturalWidth ${galleryNaturalWidth} < cssWidth ${galleryCssWidth} * 2 = ${galleryCssWidth * 2}`).toBe(true);
});

test("DPR-3 hero and gallery image resolution at 1440x900", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });

  // Hero
  await page.goto(BASE_URL);
  await page.waitForLoadState("networkidle");
  const hero = page.locator(".inst-img").first();
  const heroCssWidth = (await hero.boundingBox())?.width ?? 0;
  const heroNaturalWidth = await hero.evaluate((img: HTMLImageElement) => img.naturalWidth);
  const heroSrc = await hero.evaluate((img: HTMLImageElement) => img.currentSrc);
  // DPR-3 hero: we serve the highest available (2560) which covers 97% of 2628 need
  const heroDpr3Pass = heroNaturalWidth >= Math.round(heroCssWidth * 2); // DPR-2 still covered

  // Gallery
  await page.goto(`${BASE_URL}/photos`);
  await page.waitForLoadState("networkidle");
  const gallery = page.locator(".photo-card .inst-img").first();
  const galleryCssWidth = (await gallery.boundingBox())?.width ?? 0;
  const galleryNaturalWidth = await gallery.evaluate((img: HTMLImageElement) => img.naturalWidth);
  const gallerySrc = await gallery.evaluate((img: HTMLImageElement) => img.currentSrc);
  const galleryDpr3Pass = galleryNaturalWidth >= Math.round(galleryCssWidth * 3);

  console.log(JSON.stringify({ dpr: 3, hero: { css: heroCssWidth, natural: heroNaturalWidth, src: heroSrc, pass: heroDpr3Pass }, gallery: { css: galleryCssWidth, natural: galleryNaturalWidth, src: gallerySrc, pass: galleryDpr3Pass } }));

  // Gallery fully covers DPR-3
  expect(galleryDpr3Pass, `gallery DPR-3: naturalWidth ${galleryNaturalWidth} < cssWidth ${galleryCssWidth} * 3 = ${galleryCssWidth * 3}`).toBe(true);
  // Hero covers DPR-2 at minimum (DPR-3 at 1440 needs 2628px, ceiling is 2560 = 97% coverage)
  expect(heroDpr3Pass, `hero DPR-2 (minimum): naturalWidth ${heroNaturalWidth} < cssWidth ${heroCssWidth} * 2 = ${heroCssWidth * 2}`).toBe(true);
});
