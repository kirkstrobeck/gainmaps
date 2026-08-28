import type { Page } from "@playwright/test";

const SAMPLER_CODE = `
(function() {
  window.__fps_ts = [];
  window.__fps_running = false;
  function tick(ts) {
    window.__fps_ts.push(ts);
    if (window.__fps_running) requestAnimationFrame(tick);
  }
  window.__fps_start = function() {
    window.__fps_ts = [];
    window.__fps_running = true;
    requestAnimationFrame(tick);
  };
  window.__fps_stop = function() {
    window.__fps_running = false;
    return window.__fps_ts.slice();
  };
})();
`;

export async function installSampler(page: Page): Promise<void> {
  await page.evaluate(SAMPLER_CODE);
}

export async function startSampler(page: Page): Promise<void> {
  await page.evaluate("window.__fps_start()");
}

export async function stopSampler(page: Page): Promise<number[]> {
  return page.evaluate<number[]>("window.__fps_stop()");
}
