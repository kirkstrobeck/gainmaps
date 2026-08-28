#!/usr/bin/env bash
# Bridge the Cursor CLI credential from the Mac into the container's config
# home. Usage: cursor-token-sync.sh pull|status
#
# WHY THIS ONE IS PULL-ONLY, when the Claude and Codex bridges are two-way.
#
# Those two rotate a refresh token: the container refreshes, the Mac's copy dies,
# and the human is silently logged out unless the new one travels back. The
# Cursor CLI does not work that way. Its refresh path re-runs
# loginWithApiKey(apiKey) — the durable secret is the API key, and an API key
# does not rotate. Nothing the container does can invalidate what the Mac holds,
# so there is nothing to push back, and not writing to somebody's login Keychain
# after every dispatch is the better trade.
#
# The consequence is worth stating plainly: a login-only credential (no API key)
# bridges an access token that the container cannot refresh on its own. It works
# until that token expires, and then a dispatch fails with an auth error and
# `agent login` on the Mac fixes it. For a sandbox that runs unattended, set
# CURSOR_API_KEY instead.
#
# WHERE THE CREDENTIAL LIVES. The CLI picks its store by platform: macOS uses the
# login Keychain, Linux uses a file. So the host side reads the Keychain (or the
# host file, if AGENT_CLI_CREDENTIAL_STORE=file is set there) and the container
# side is always a file, at the Linux default path.

set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd -P)"

CACHE_HOME="${CURSOR_CACHE_HOME:-$SCRIPT_DIR/.cache/cursor-home}"
CACHE_AUTH="$CACHE_HOME/auth.json"

# Domain "cursor", from the CLI itself. Keychain entries are one secret per
# service under a single account; the file store is one JSON object.
KEYCHAIN_ACCOUNT="cursor-user"
KEYCHAIN_ACCESS="cursor-access-token"
KEYCHAIN_REFRESH="cursor-refresh-token"
KEYCHAIN_APIKEY="cursor-api-key"

# darwin: ~/.cursor/auth.json — linux: $XDG_CONFIG_HOME/cursor/auth.json
host_auth_file() {
  if [ "$(uname -s)" = "Darwin" ]; then
    printf '%s\n' "$HOME/.cursor/auth.json"
  else
    printf '%s\n' "${XDG_CONFIG_HOME:-$HOME/.config}/cursor/auth.json"
  fi
}

keychain_secret() {
  [ "$(uname -s)" = "Darwin" ] || return 0
  security find-generic-password -s "$1" -a "$KEYCHAIN_ACCOUNT" -w 2>/dev/null || true
}

# The credential as the container's file store wants it, or empty. Never echoed
# anywhere but into the file — this function's output IS the secret.
host_credential() {
  local api_key access refresh file blob

  # An API key beats a login: it is the only form the container can refresh
  # with, so an unattended run that has one never expires mid-task.
  api_key="${CURSOR_API_KEY:-}"
  [ -n "$api_key" ] || api_key="$(keychain_secret "$KEYCHAIN_APIKEY")"
  access="$(keychain_secret "$KEYCHAIN_ACCESS")"
  refresh="$(keychain_secret "$KEYCHAIN_REFRESH")"

  if [ -z "$api_key$access$refresh" ]; then
    file="$(host_auth_file)"
    if [ -r "$file" ]; then
      blob="$(cat "$file" 2>/dev/null || true)"
      # Pass the host's own file through rather than rebuilding it, so a field
      # this script has never heard of survives the trip.
      printf '%s' "$blob" | jq -e 'type == "object"' >/dev/null 2>&1 &&
        { printf '%s' "$blob"; return 0; }
    fi
    return 0
  fi

  jq -nc \
    --arg apiKey "$api_key" \
    --arg accessToken "$access" \
    --arg refreshToken "$refresh" \
    '{apiKey: $apiKey, accessToken: $accessToken, refreshToken: $refreshToken}
     | with_entries(select(.value != ""))'
}

write_cache() {
  local blob="$1" tmp
  mkdir -p "$CACHE_HOME"
  chmod 700 "$CACHE_HOME" 2>/dev/null || true
  tmp="$(mktemp "$CACHE_HOME/.auth.XXXXXX")"
  printf '%s' "$blob" >"$tmp"
  chmod 600 "$tmp"
  mv -f "$tmp" "$CACHE_AUTH"
}

do_pull() {
  local blob
  blob="$(host_credential)"

  if [ -z "$blob" ]; then
    # A cache from an earlier boot is still a working credential; only a
    # completely empty picture is a failure worth stopping for.
    [ -s "$CACHE_AUTH" ] && return 0
    echo "No Cursor credential found. Run 'agent login' on the Mac, or export CURSOR_API_KEY." >&2
    return 1
  fi

  [ "$blob" = "$(cat "$CACHE_AUTH" 2>/dev/null || true)" ] && return 0
  write_cache "$blob"
}

# Which fields exist, never what they are.
do_status() {
  local host cache
  host="$(host_credential)"
  cache="$(cat "$CACHE_AUTH" 2>/dev/null || true)"
  printf 'host  credential: %s\n'  "$(printf '%s' "$host"  | jq -r 'keys | join(", ")' 2>/dev/null || echo none)"
  printf 'cache credential: %s\n'  "$(printf '%s' "$cache" | jq -r 'keys | join(", ")' 2>/dev/null || echo none)"
  printf 'cache path:       %s\n'  "$CACHE_AUTH"
}

case "${1:-pull}" in
  pull) do_pull ;;
  # There is no push. See the header — nothing inside the container rotates a
  # secret the Mac depends on. Kept as an explicit no-op so a caller that treats
  # all three bridges alike does not fail on this one.
  push) : ;;
  status) do_status ;;
  *) echo "usage: cursor-token-sync.sh pull|status" >&2; exit 2 ;;
esac
