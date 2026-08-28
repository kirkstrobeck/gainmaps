import pkg from '/workspace/node_modules/.pnpm/playwright-core@1.62.1/node_modules/playwright-core/index.js';
const { chromium } = pkg;
import { mkdirSync } from 'node:fs';

mkdirSync('/workspace/GOAL-EVIDENCE', { recursive: true });

const BASE = 'https://www.gainmaps.com';
const executablePath = process.env.CHROMIUM_EXECUTABLE_PATH || '/ms-playwright/chromium-1187/chrome-linux/chrome';

const browser = await chromium.launch({ executablePath });

async function shot(url, path, width, height, extraFn) {
  const context = await browser.newContext({ viewport: { width, height } });
  const page = await context.newPage();
  await page.goto(url, { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForTimeout(3000);
  if (extraFn) await extraFn(page);
  await page.screenshot({ path, fullPage: false });
  await context.close();
  console.log('Saved:', path);
}

// 1. Desktop dark
await shot(
  `${BASE}/?mode=dark&ultra=on`,
  '/workspace/GOAL-EVIDENCE/r2-prod-desktop-dark.png',
  1440, 900,
  async (page) => {
    await page.getByRole('button', { name: 'Got it' }).click({ timeout: 3000 }).catch(() => {});
    await page.waitForTimeout(500);
  }
);

// 2. Desktop light
await shot(
  `${BASE}/?mode=light&ultra=on`,
  '/workspace/GOAL-EVIDENCE/r2-prod-desktop-light.png',
  1440, 900,
  async (page) => {
    await page.getByRole('button', { name: 'Got it' }).click({ timeout: 3000 }).catch(() => {});
    await page.waitForTimeout(500);
  }
);

// 3. Mobile dark
await shot(
  `${BASE}/?mode=dark&ultra=on`,
  '/workspace/GOAL-EVIDENCE/r2-prod-mobile-dark.png',
  390, 844,
  async (page) => {
    await page.getByRole('button', { name: 'Got it' }).click({ timeout: 3000 }).catch(() => {});
    await page.waitForTimeout(500);
  }
);

await browser.close();
console.log('Done.');
