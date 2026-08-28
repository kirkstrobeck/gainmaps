import pkg from '/workspace/node_modules/.pnpm/playwright-core@1.62.1/node_modules/playwright-core/index.js';
const { chromium } = pkg;
import { mkdirSync } from 'node:fs';

mkdirSync('/workspace/GOAL-EVIDENCE', { recursive: true });

const BASE = 'http://127.0.0.1:3000';
const executablePath = process.env.CHROMIUM_EXECUTABLE_PATH || '/ms-playwright/chromium-1187/chrome-linux/chrome';

const browser = await chromium.launch({ executablePath });

async function shot(url, path, width, height, extraFn) {
  const context = await browser.newContext({ viewport: { width, height } });
  const page = await context.newPage();
  await page.goto(url, { waitUntil: 'networkidle' });
  await page.waitForTimeout(2500);
  if (extraFn) await extraFn(page);
  await page.screenshot({ path, fullPage: false });
  await context.close();
  console.log('Saved:', path);
}

// 1. Desktop dark
await shot(
  `${BASE}/?mode=dark&ultra=on`,
  '/workspace/GOAL-EVIDENCE/r2-after-desktop-dark.png',
  1440, 900,
  async (page) => {
    await page.getByRole('button', { name: 'Got it' }).click({ timeout: 3000 }).catch(() => {});
    await page.waitForTimeout(500);
  }
);

// 2. Desktop light
await shot(
  `${BASE}/?mode=light&ultra=on`,
  '/workspace/GOAL-EVIDENCE/r2-after-desktop-light.png',
  1440, 900,
  async (page) => {
    await page.getByRole('button', { name: 'Got it' }).click({ timeout: 3000 }).catch(() => {});
    await page.waitForTimeout(500);
  }
);

// 3. Mobile dark
await shot(
  `${BASE}/?mode=dark&ultra=on`,
  '/workspace/GOAL-EVIDENCE/r2-after-mobile-dark.png',
  390, 844,
  async (page) => {
    await page.getByRole('button', { name: 'Got it' }).click({ timeout: 3000 }).catch(() => {});
    await page.waitForTimeout(500);
  }
);

// 4. Modal dark (before clicking Got it)
await shot(
  `${BASE}/?mode=dark`,
  '/workspace/GOAL-EVIDENCE/r2-after-modal-dark.png',
  1440, 900
);

await browser.close();
console.log('Done.');
