import { chromium } from '@playwright/test';

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, colorScheme: 'dark' });
const page = await ctx.newPage();
await page.addInitScript(() => { localStorage.setItem('display-check-dismissed', '1'); });
await page.goto('http://localhost:3000', { waitUntil: 'networkidle' });
await page.waitForTimeout(3000);

const diagnostic = await page.evaluate(() => {
  const h1 = document.querySelector('h1');
  const h1UltraWord = h1?.querySelector('.ultra-word');
  const h1Svg = h1UltraWord?.querySelector('svg');
  const h1Mask = h1Svg?.querySelector('mask');
  const h1Texts = Array.from(h1Mask?.querySelectorAll('text') ?? []);
  const h1Backdrop = h1UltraWord?.querySelector('.ultra-backdrop') as HTMLElement | null;
  const h1Readable = h1UltraWord?.querySelector('span') as HTMLElement | null;

  const readableRect = h1Readable?.getBoundingClientRect();
  const svgRect = h1Svg?.getBoundingClientRect();
  const backdropRect = h1Backdrop?.getBoundingClientRect();

  return {
    h1Text: h1?.textContent?.trim(),
    h1SvgStyle: h1Svg ? { width: h1Svg.style.width, height: h1Svg.style.height, position: h1Svg.style.position, inset: h1Svg.style.inset } : null,
    svgBoundingRect: svgRect ? { left: svgRect.left, top: svgRect.top, width: svgRect.width, height: svgRect.height } : null,
    readableBoundingRect: readableRect ? { left: readableRect.left, top: readableRect.top, width: readableRect.width, height: readableRect.height } : null,
    backdropBoundingRect: backdropRect ? { left: backdropRect.left, top: backdropRect.top, width: backdropRect.width, height: backdropRect.height } : null,
    h1MaskId: h1Mask?.id,
    h1TextElements: h1Texts.map(t => ({ text: t.textContent, x: t.getAttribute('x'), y: t.getAttribute('y'), fill: t.getAttribute('fill') })),
    h1BackdropMaskStyle: h1Backdrop ? window.getComputedStyle(h1Backdrop).mask : null,
    h1BackdropBg: h1Backdrop ? window.getComputedStyle(h1Backdrop).background : null,
    h1BackdropBgColor: h1Backdrop ? window.getComputedStyle(h1Backdrop).backgroundColor : null,
    htmlDataUltra: document.documentElement.getAttribute('data-ultra'),
    htmlDataMode: document.documentElement.getAttribute('data-mode'),
  };
});

console.log('DIAGNOSTIC:', JSON.stringify(diagnostic, null, 2));

// Also check nav UltraWord
const navDiag = await page.evaluate(() => {
  const nav = document.querySelector('nav');
  const navUltraWord = nav?.querySelector('.ultra-word');
  const navSvg = navUltraWord?.querySelector('svg');
  const navMask = navSvg?.querySelector('mask');
  const navTexts = Array.from(navMask?.querySelectorAll('text') ?? []);
  return {
    navTextElements: navTexts.map(t => ({ text: t.textContent, x: t.getAttribute('x'), y: t.getAttribute('y') })),
  };
});
console.log('NAV DIAGNOSTIC:', JSON.stringify(navDiag, null, 2));

await browser.close();
