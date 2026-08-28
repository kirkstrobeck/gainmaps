export const POSTHOG_DEFAULTS = "2026-05-30" as const

export type PostHogClientInit = {
  token: string
  api_host: string | undefined
  defaults: typeof POSTHOG_DEFAULTS
}

export function posthogClientConfig(
  env: NodeJS.ProcessEnv = process.env,
): PostHogClientInit | null {
  const token = env.NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN
  if (!token?.trim()) return null
  return {
    token,
    api_host: env.NEXT_PUBLIC_POSTHOG_HOST,
    defaults: POSTHOG_DEFAULTS,
  }
}
