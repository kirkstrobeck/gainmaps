import posthog from "posthog-js"

import { posthogClientConfig } from "@/lib/posthog-client-config"

function initPostHog(): void {
  const config = posthogClientConfig()
  if (!config) return
  posthog.init(config.token, {
    api_host: config.api_host,
    defaults: config.defaults,
    capture_pageview: "history_change",
    capture_pageleave: true,
    disable_session_recording: true,
    disable_surveys: true,
    capture_performance: false,
  })
  window.gainmapsPostHog = {
    capture: posthog.capture.bind(posthog),
  }
}

initPostHog()
