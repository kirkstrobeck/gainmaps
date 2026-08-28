#!/usr/bin/env bash
# Bridge the Amp API key from the Mac into the container.
# Usage: amp-token-sync.sh pull|push|status
#
# Amp authenticates via AMP_API_KEY (API key). API keys do not rotate, so
# this bridge is pull-only: the container cannot invalidate what the host
# holds, and there is nothing to push back.
#
# The key is written to the cache home that is mounted at
# /home/agent/.config/amp so the CLI finds it on startup, and it is also
# forwarded via docker exec -e in dispatch-amp.sh for agents that read the
# env var directly.

set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd -P)"

CACHE_HOME="${AMP_CACHE_HOME:-$SCRIPT_DIR/.cache/amp-home}"

# Amp may store its key in a config file. Check common locations.
host_amp_config() {
  for f in \
    "$HOME/.config/amp/config.json" \
    "$HOME/.config/amp/auth.json" \
    "$HOME/.amp/config.json"; do
    [ -f "$f" ] && printf '%s\n' "$f" && return 0
  done
  return 1
}

do_pull() {
  local key="${AMP_API_KEY:-}"

  if [ -z "$key" ]; then
    local cfg
    if cfg="$(host_amp_config 2>/dev/null)"; then
      key="$(jq -r '.apiKey // .api_key // empty' "$cfg" 2>/dev/null || true)"
    fi
  fi

  if [ -n "$key" ]; then
    mkdir -p "$CACHE_HOME"
    chmod 700 "$CACHE_HOME"
    printf '%s' "$key" >"$CACHE_HOME/.amp_api_key"
    chmod 600 "$CACHE_HOME/.amp_api_key"
    # Mirror a config file if one exists on the host
    local cfg
    if cfg="$(host_amp_config 2>/dev/null)"; then
      cp -f "$cfg" "$CACHE_HOME/$(basename "$cfg")"
      chmod 600 "$CACHE_HOME/$(basename "$cfg")"
    fi
    return 0
  fi

  # A cached key from an earlier pull is still valid.
  [ -f "$CACHE_HOME/.amp_api_key" ] && [ -s "$CACHE_HOME/.amp_api_key" ] && return 0

  echo "No Amp API key found. Export AMP_API_KEY on the Mac, then re-run boot." >&2
  return 1
}

do_push() {
  : # API keys do not rotate.
}

do_status() {
  if [ -n "${AMP_API_KEY:-}" ]; then
    echo "amp: AMP_API_KEY set in environment"
  elif host_amp_config >/dev/null 2>&1; then
    echo "amp: config file present at $(host_amp_config 2>/dev/null)"
  else
    echo "amp: no API key or config found"
  fi
  if [ -f "$CACHE_HOME/.amp_api_key" ]; then
    echo "amp: cache key: $CACHE_HOME/.amp_api_key (present)"
  else
    echo "amp: cache key: not present"
  fi
}

case "${1:-pull}" in
  pull) do_pull ;;
  push) do_push ;;
  status) do_status ;;
  *) echo "usage: amp-token-sync.sh pull|push|status" >&2; exit 2 ;;
esac
