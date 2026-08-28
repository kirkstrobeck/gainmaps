import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": fileURLToPath(new URL(".", import.meta.url)),
    },
  },
  test: {
    include: ["test/**/*.test.{ts,tsx}"],
    environment: "jsdom",
    setupFiles: ["./vitest.setup.ts"],
    testTimeout: 60000,
    maxWorkers: 1,
    fileParallelism: false,
    css: false,
    coverage: {
      provider: "v8",
      reporter: ["text-summary", "json-summary"],
      all: true,
      include: [
        "app/**/*.{ts,tsx}",
        "components/**/*.{ts,tsx}",
        "lib/**/*.ts",
      ],
      exclude: [
        // Next.js font loader + globals.css — importing in jsdom OOMs the vitest worker
        "app/layout.tsx",
      ],
      thresholds: {
        statements: 100,
        branches: 100,
        functions: 100,
        lines: 100,
      },
    },
  },
});
