#!/usr/bin/env bash
# Bridge the OpenCode configuration / credentials from the Mac into the
# container. Usage: opencode-token-sync.sh pull|push|status
#
# OpenCode is BYOK (bring-your-own-key): it stores provider API keys and
# config in ~/.config/opencode/. The whole directory is bind-mounted at
# /home/agent/.config/opencode. This sync script copies the host config into
# the cache so the mount carries current credentials on every boot.
#
# Provider API keys (OpenAI, Anthropic, etc.) do not rotate, so the bridge
# is pull-only. If a key changes on the Mac, re-running boot picks it up.

set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd -P)"

CACHE_HOME="${OPENCODE_CACHE_HOME:-$SCRIPT_DIR/.cache/opencode-home}"
HOST_CONFIG="${HOST_OPENCODE_HOME:-${XDG_CONFIG_HOME:-$HOME/.config}/opencode}"

do_pull() {
  if [ ! -d "$HOST_CONFIG" ]; then
    # No host config: still a valid state for a project that configures via
    # env vars. Create an empty cache dir so the mount point exists.
    mkdir -p "$CACHE_HOME"
    chmod 700 "$CACHE_HOME"
    return 0
  fi

  mkdir -p "$CACHE_HOME"
  chmod 700 "$CACHE_HOME"

  # Copy known config files. rsync is not required; cp of individual files is
  # enough and avoids pulling in secrets that live elsewhere in the config dir.
  for f in config.json settings.json opencode.json providers.json; do
    [ -f "$HOST_CONFIG/$f" ] || continue
    cp -f "$HOST_CONFIG/$f" "$CACHE_HOME/$f"
    chmod 600 "$CACHE_HOME/$f"
  done
}

do_push() {
  : # Provider API keys do not rotate; nothing to push back.
}

do_status() {
  if [ -d "$HOST_CONFIG" ] && [ "$(ls -A "$HOST_CONFIG" 2>/dev/null)" ]; then
    echo "opencode: host config dir: $HOST_CONFIG (populated)"
  else
    echo "opencode: host config dir: $HOST_CONFIG (empty or missing)"
  fi
  if [ -d "$CACHE_HOME" ] && [ "$(ls -A "$CACHE_HOME" 2>/dev/null)" ]; then
    echo "opencode: cache: $CACHE_HOME (populated)"
  else
    echo "opencode: cache: $CACHE_HOME (empty)"
  fi
}

case "${1:-pull}" in
  pull) do_pull ;;
  push) do_push ;;
  status) do_status ;;
  *) echo "usage: opencode-token-sync.sh pull|push|status" >&2; exit 2 ;;
esac
