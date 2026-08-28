import { readdirSync, readFileSync } from "node:fs"
import { join, relative } from "node:path"

import { describe, expect, it } from "vitest"

import {
  POSTHOG_DEFAULTS,
  posthogClientConfig,
} from "@/lib/posthog-client-config"

const WEB_ROOT = process.cwd()
const instrumentationPath = join(WEB_ROOT, "instrumentation-client.ts")
const helperPath = join(WEB_ROOT, "lib/posthog-client-config.ts")
const nextConfigPath = join(WEB_ROOT, "next.config.ts")
const envExamplePath = join(WEB_ROOT, ".env.example")

const POSTHOG_IMPORT_PATTERN =
  /from\s+["']posthog-js["']|require\s*\(\s*["']posthog-js["']\s*\)/

function listSourceFiles(dir: string): readonly string[] {
  const entries = readdirSync(dir, { withFileTypes: true })
  return entries.flatMap((entry) => {
    const full = join(dir, entry.name)
    if (entry.isDirectory()) return listSourceFiles(full)
    if (/\.(ts|tsx)$/.test(entry.name)) return [full]
    return []
  })
}

function filesWithPostHogImport(
  files: readonly string[],
): readonly string[] {
  return files.filter((file) =>
    POSTHOG_IMPORT_PATTERN.test(readFileSync(file, "utf8")),
  )
}

describe("posthogClientConfig", () => {
  it("returns null when token is missing", () => {
    expect(posthogClientConfig({})).toBeNull()
  })

  it("returns null when token is empty string", () => {
    expect(
      posthogClientConfig({ NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN: "" }),
    ).toBeNull()
  })

  it("returns null when token is whitespace-only", () => {
    expect(
      posthogClientConfig({ NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN: "   " }),
    ).toBeNull()
  })

  it("returns config with api_host and defaults when token is present", () => {
    const config = posthogClientConfig({
      NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN: "phc_test",
      NEXT_PUBLIC_POSTHOG_HOST: "/ingest",
    })
    expect(config).toEqual({
      token: "phc_test",
      api_host: "/ingest",
      defaults: POSTHOG_DEFAULTS,
    })
  })

  it("returns config with undefined api_host when host env is missing", () => {
    const config = posthogClientConfig({
      NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN: "phc_test",
    })
    expect(config).toEqual({
      token: "phc_test",
      api_host: undefined,
      defaults: POSTHOG_DEFAULTS,
    })
  })
})

describe("instrumentation-client.ts source", () => {
  const src = readFileSync(instrumentationPath, "utf8")
  const helperSrc = readFileSync(helperPath, "utf8")

  it("statically imports posthog-js", () => {
    expect(src).toMatch(/import\s+posthog\s+from\s+["']posthog-js["']/)
    expect(src).not.toMatch(/import\s*\(\s*["']posthog-js["']\s*\)/)
  })

  it("uses posthogClientConfig helper for token and host", () => {
    expect(src).toMatch(/posthogClientConfig/)
    expect(helperSrc).toMatch(/NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN/)
    expect(helperSrc).toMatch(/NEXT_PUBLIC_POSTHOG_HOST/)
  })

  it("does not hardcode api_host to /ingest", () => {
    expect(src).not.toMatch(/api_host:\s*["']\/ingest["']/)
  })

  it("uses defaults 2026-05-30", () => {
    const mentionsDefaults =
      /defaults:\s*["']2026-05-30["']/.test(src) ||
      /defaults:\s*config\.defaults/.test(src)
    expect(mentionsDefaults).toBe(true)
  })

  it("early-exits when config is missing", () => {
    expect(src).toMatch(/if\s*\(\s*!config\s*\)\s*return/)
  })

  it("does not defer init on window load or document.readyState", () => {
    expect(src).not.toMatch(/addEventListener\s*\(\s*["']load["']/)
    expect(src).not.toMatch(/document\.readyState/)
  })
})

describe("posthog-js import boundaries", () => {
  const appFiles = listSourceFiles(join(WEB_ROOT, "app"))
  const componentFiles = listSourceFiles(join(WEB_ROOT, "components"))
  const scannedFiles = [...appFiles, ...componentFiles]

  it("does not import posthog-js in app/ or components/", () => {
    const offenders = filesWithPostHogImport(scannedFiles)
    expect(offenders.map((f) => relative(WEB_ROOT, f))).toEqual([])
  })

  it("allows posthog-js only in instrumentation-client.ts", () => {
    const allowed = join(WEB_ROOT, "instrumentation-client.ts")
    const webFiles = listSourceFiles(WEB_ROOT).filter(
      (file) => !file.includes("/test/") && !file.includes("\\test\\"),
    )
    const importers = filesWithPostHogImport(webFiles)
    expect(importers).toEqual([allowed])
  })
})

describe("PostHog env and proxy contract", () => {
  it(".env.example documents PostHog keys", () => {
    const envExample = readFileSync(envExamplePath, "utf8")
    expect(envExample).toMatch(/NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN/)
    expect(envExample).toMatch(/NEXT_PUBLIC_POSTHOG_HOST/)
  })

  it("next.config.ts keeps /ingest rewrite and CSP", () => {
    const nextConfig = readFileSync(nextConfigPath, "utf8")
    expect(nextConfig).toMatch(
      /source:\s*["']\/ingest\/:path\*["'][\s\S]*destination:\s*["']https:\/\/us\.i\.posthog\.com\/:path\*["']/,
    )
    expect(nextConfig).toMatch(/connect-src[^;]*'self'/)
    expect(nextConfig).toMatch(/worker-src[^;]*blob:/)
    expect(nextConfig).toMatch(/source:\s*["']\/hdr-service-worker\.js["']/)
  })
})
