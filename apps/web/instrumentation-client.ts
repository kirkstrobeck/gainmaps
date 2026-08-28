import posthog from "posthog-js"

import { posthogClientConfig } from "@/lib/posthog-client-config"

function initPostHog(): void {
  const config = posthogClientConfig()
  if (!config) return
  posthog.init(config.token, {
    api_host: config.api_host,
    defaults: config.defaults,
    disable_session_recording: true,
    disable_surveys: true,
    capture_performance: false,
  })
}

initPostHog()
