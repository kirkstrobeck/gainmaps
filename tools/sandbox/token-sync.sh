#!/usr/bin/env bash
# Two-way sync of the Claude Code OAuth credential between the Mac and the
# container's mounted home. Usage: token-sync.sh pull|push|status
#
# WHY TWO-WAY. Anthropic rotates the refresh token on every refresh: the old one
# stops working the moment a new one is issued. So a one-way copy at boot is a
# time bomb. The container refreshes, the Mac keeps the dead token, and the next
# time the human opens Claude Code on the Mac they are logged out with no
# obvious cause. Whichever side refreshed last is the authority, and expiresAt
# is how we tell which side that was.
#
# On macOS the host credential lives in the login Keychain, not in a file, so
# both stores are read and the newer one wins.

set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd -P)"

CACHE_HOME="${CLAUDE_CACHE_HOME:-$SCRIPT_DIR/.cache/claude-home}"
CACHE_CRED="$CACHE_HOME/.credentials.json"
HOST_CRED="${HOST_CLAUDE_HOME:-$HOME/.claude}/.credentials.json"
KEYCHAIN_SERVICE="Claude Code-credentials"

read_keychain() {
  [ "$(uname -s)" = "Darwin" ] || return 0
  security find-generic-password -s "$KEYCHAIN_SERVICE" -w 2>/dev/null || true
}

read_file() {
  [ -f "$1" ] || return 0
  cat "$1" 2>/dev/null || true
}

expires_at() {
  printf '%s' "${1:-}" | jq -r '.claudeAiOauth.expiresAt // 0' 2>/dev/null || printf '0'
}

# Pick whichever blob carries the later expiry. Ties keep the first argument,
# which makes "already in sync" a no-op instead of a pointless rewrite.
newest() {
  local a="$1" b="$2"
  local ea eb
  ea="$(expires_at "$a")"
  eb="$(expires_at "$b")"
  [ -z "$b" ] && { printf '%s' "$a"; return; }
  [ -z "$a" ] && { printf '%s' "$b"; return; }
  if [ "$eb" -gt "$ea" ] 2>/dev/null; then
    printf '%s' "$b"
    return
  fi
  printf '%s' "$a"
}

write_cache() {
  local blob="$1" tmp
  mkdir -p "$CACHE_HOME"
  tmp="$(mktemp "$CACHE_HOME/.cred.XXXXXX")"
  printf '%s' "$blob" >"$tmp"
  chmod 600 "$tmp"
  mv -f "$tmp" "$CACHE_CRED"
}

do_pull() {
  local host_blob cache_blob winner
  host_blob="$(newest "$(read_keychain)" "$(read_file "$HOST_CRED")")"
  cache_blob="$(read_file "$CACHE_CRED")"

  if [ -z "$host_blob" ] && [ -z "$cache_blob" ]; then
    echo "No Claude credential found. Run 'claude' on the Mac and sign in, then re-run boot." >&2
    return 1
  fi

  winner="$(newest "$cache_blob" "$host_blob")"
  [ "$winner" = "$cache_blob" ] && return 0
  write_cache "$winner"
}

do_push() {
  local cache_blob host_blob
  cache_blob="$(read_file "$CACHE_CRED")"
  [ -z "$cache_blob" ] && return 0
  host_blob="$(newest "$(read_keychain)" "$(read_file "$HOST_CRED")")"

  # Only travel back to the Mac when the container genuinely refreshed. An
  # unconditional push would happily overwrite a newer host token with an older
  # container one and log the human out — the exact failure this file prevents.
  [ "$(newest "$host_blob" "$cache_blob")" = "$host_blob" ] && return 0

  if [ -f "$HOST_CRED" ]; then
    printf '%s' "$cache_blob" >"$HOST_CRED"
    chmod 600 "$HOST_CRED"
  fi
  if [ "$(uname -s)" = "Darwin" ]; then
    security add-generic-password -U -s "$KEYCHAIN_SERVICE" -a "$USER" -w "$cache_blob" 2>/dev/null || true
  fi
  echo "Claude credential refreshed inside the sandbox; pushed back to the host." >&2
}

do_status() {
  printf 'host  expiresAt: %s\n' "$(expires_at "$(newest "$(read_keychain)" "$(read_file "$HOST_CRED")")")"
  printf 'cache expiresAt: %s\n' "$(expires_at "$(read_file "$CACHE_CRED")")"
}

case "${1:-pull}" in
  pull) do_pull ;;
  push) do_push ;;
  status) do_status ;;
  *) echo "usage: token-sync.sh pull|push|status" >&2; exit 2 ;;
esac
