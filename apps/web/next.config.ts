import type { NextConfig } from "next";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "../..");

function resolveDistDir(): string {
  if (process.env.NEXT_DIST_DIR) return process.env.NEXT_DIST_DIR;
  // Default `.next` is what Vercel looks for (`routes-manifest.json`). Local
  // prod builds that must not clobber a running `next dev` opt in via
  // NEXT_DIST_DIR=.next-prod (`pnpm build:isolated` / `pnpm start:isolated`).
  return ".next";
}

const nextConfig: NextConfig = {
  distDir: resolveDistDir(),
  typescript: { ignoreBuildErrors: true },
  devIndicators: false,
  outputFileTracingRoot: root,
  reactStrictMode: true,
  // Let our /ingest/flags/ rewrite fire before Next.js redirects the trailing slash.
  skipTrailingSlashRedirect: true,
  images: {
    // Photo tiles are served via plain <img> from Supabase Storage, not next/image.
    remotePatterns: [],
    // Normalize to one quality value to eliminate build warnings and runtime drift.
    qualities: [75],
  },
  async rewrites() {
    return [
      // Specific rewrite strips trailing slash on /flags to avoid PostHog 308 redirect.
      {
        source: "/ingest/flags/",
        destination: "https://us.i.posthog.com/flags",
      },
      {
        source: "/ingest/:path*",
        destination: "https://us.i.posthog.com/:path*",
      },
    ];
  },
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "SAMEORIGIN" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
          {
            key: "Strict-Transport-Security",
            value: "max-age=63072000; includeSubDomains; preload",
          },
          {
            // CSP: PostHog proxied same-origin via /ingest. Fonts self-hosted via next/font.
            // Photo tiles are served from Supabase Storage.
            key: "Content-Security-Policy",
            value: [
              "default-src 'self'",
              `script-src 'self' 'unsafe-inline'${process.env.NODE_ENV === 'development' ? " 'unsafe-eval'" : ""}`,
              "style-src 'self' 'unsafe-inline'",
              "img-src 'self' data: blob: https://icquwwyymqnvhcpufxje.supabase.co",
              "font-src 'self'",
              "connect-src 'self' https://us.i.posthog.com",
              "worker-src 'self' blob:",
              "frame-src https://giscus.app",
              "frame-ancestors 'none'",
            ].join("; "),
          },
        ],
      },
      {
        // The bundled SW includes libheif-js which uses Function() for WASM init.
        // This rule comes AFTER the wildcard so it overrides the wildcard CSP for this path.
        source: "/hdr-service-worker.js",
        headers: [
          {
            key: "Content-Security-Policy",
            value: [
              "default-src 'self'",
              "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
              "connect-src 'self'",
              "worker-src 'self' blob:",
            ].join("; "),
          },
        ],
      },
    ];
  },
};

export default nextConfig;
