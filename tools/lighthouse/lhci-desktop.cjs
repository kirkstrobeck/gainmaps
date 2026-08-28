/** @type {import('@lhci/cli').LhciConfig} */
const port = process.env.LHCI_PORT || 3000;
module.exports = {
  ci: {
    collect: {
      url: [
        `http://127.0.0.1:${port}/`,
        `http://127.0.0.1:${port}/convert`,
        `http://127.0.0.1:${port}/photos`,
        `http://127.0.0.1:${port}/docs`,
        `http://127.0.0.1:${port}/logos`,
        `http://127.0.0.1:${port}/text`,
      ],
      numberOfRuns: 3,
      settings: {
        preset: "desktop",
        // Skip service worker and PWA checks (no HTTPS in local CI)
        disableStorageReset: false,
        chromeFlags: "--no-sandbox --disable-dev-shm-usage",
      },
    },
    assert: {
      assertions: {
        "categories:performance": ["error", { minScore: 1 }],
        "categories:accessibility": ["error", { minScore: 1 }],
        "categories:best-practices": ["error", { minScore: 1 }],
        "categories:seo": ["error", { minScore: 1 }],
      },
    },
    upload: {
      target: "filesystem",
      outputDir: ".lhci-reports/desktop",
    },
  },
};
