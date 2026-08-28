import { chromium } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';

const OUT = '/workspace/GOAL-EVIDENCE';
fs.mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch();

async function shot(name: string, url: string, opts: { width?: number; height?: number; dark?: boolean; openModal?: boolean }) {
  const { width = 1440, height = 900, dark = false, openModal = false } = opts;
  const ctx = await browser.newContext({
    viewport: { width, height },
    colorScheme: dark ? 'dark' : 'light',
  });
  const page = await ctx.newPage();
  if (!openModal) {
    await page.addInitScript(() => { localStorage.setItem('display-check-dismissed', '1'); });
  } else {
    await page.addInitScript(() => { localStorage.removeItem('display-check-dismissed'); });
  }
  await page.goto(url, { waitUntil: 'networkidle' });
  await page.waitForTimeout(3000);
  await page.screenshot({ path: path.join(OUT, `${name}.png`), fullPage: false });
  await ctx.close();
}

await shot('before-homepage-dark-desktop', 'http://localhost:3000', { dark: true });
await shot('before-homepage-light-desktop', 'http://localhost:3000', { dark: false });
await shot('before-homepage-mobile', 'http://localhost:3000', { width: 390, height: 844, dark: true });
await shot('before-modal-dark', 'http://localhost:3000', { dark: true, openModal: true });
await shot('before-modal-light', 'http://localhost:3000', { dark: false, openModal: true });

await browser.close();
console.log('Screenshots saved to', OUT);
