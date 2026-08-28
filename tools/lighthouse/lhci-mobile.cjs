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
        // Default emulation is mobile (Moto G4 at 375×667)
        throttlingMethod: "simulate",
        chromeFlags: "--no-sandbox --disable-dev-shm-usage",
      },
    },
    assert: {
      assertions: {
        // measured mobile floor 0.87 minus noise margin; desktop holds minScore 1
        "categories:performance": ["error", { minScore: 0.85 }],
        "categories:accessibility": ["error", { minScore: 1 }],
        "categories:best-practices": ["error", { minScore: 1 }],
        "categories:seo": ["error", { minScore: 1 }],
      },
    },
    upload: {
      target: "filesystem",
      outputDir: ".lhci-reports/mobile",
    },
  },
};
