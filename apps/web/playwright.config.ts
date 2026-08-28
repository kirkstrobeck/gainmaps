import { defineConfig, devices } from "@playwright/test";

const BASE_URL = process.env.PLAYWRIGHT_BASE_URL ?? "http://127.0.0.1:3000";
const executablePath = process.env.CHROMIUM_EXECUTABLE_PATH;

export default defineConfig({
  testMatch: ["smoke.spec.ts", "dpr.spec.ts"],
  use: {
    baseURL: BASE_URL,
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"], launchOptions: { executablePath } },
    },
  ],
});
