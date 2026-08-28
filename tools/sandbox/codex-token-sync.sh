#!/usr/bin/env bash
# Two-way sync of the Codex credential between the Mac and the container's
# mounted home. Usage: codex-token-sync.sh pull|push|status
#
# Same hazard as the Claude side — a rotated refresh token stranding the host —
# with a different tell. Codex stores auth.json with a `last_refresh` timestamp,
# so that string decides which copy is authoritative. It is ISO-8601, so a plain
# lexical comparison orders it correctly without parsing dates.
#
# The two agents' credentials are kept in separate cache homes on purpose. One
# shared home would put an OpenAI token and an Anthropic token in the same
# directory, and every mount that needed one would carry both.

set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd -P)"

HOST_HOME="${HOST_CODEX_HOME:-$HOME/.codex}"
CACHE_HOME="${CODEX_CACHE_HOME:-$SCRIPT_DIR/.cache/codex-home}"
HOST_AUTH="$HOST_HOME/auth.json"
CACHE_AUTH="$CACHE_HOME/auth.json"

refresh_time() {
  [ -f "$1" ] || return 0
  jq -r '.last_refresh // ""' "$1" 2>/dev/null || true
}

copy_auth() {
  local src="$1" dest="$2" tmp
  mkdir -p "$(dirname "$dest")"
  tmp="$(mktemp "$(dirname "$dest")/.auth.XXXXXX")"
  cat "$src" >"$tmp"
  chmod 600 "$tmp"
  mv -f "$tmp" "$dest"
}

do_pull() {
  if [ ! -f "$HOST_AUTH" ] && [ ! -f "$CACHE_AUTH" ]; then
    echo "No Codex credential found. Run 'codex login' on the Mac, then re-run boot." >&2
    return 1
  fi
  [ -f "$HOST_AUTH" ] || return 0

  local host_t cache_t
  host_t="$(refresh_time "$HOST_AUTH")"
  cache_t="$(refresh_time "$CACHE_AUTH")"
  if [ -f "$CACHE_AUTH" ] && [[ "$cache_t" > "$host_t" ]]; then
    return 0
  fi
  copy_auth "$HOST_AUTH" "$CACHE_AUTH"
}

do_push() {
  [ -f "$CACHE_AUTH" ] || return 0

  local host_t cache_t
  host_t="$(refresh_time "$HOST_AUTH")"
  cache_t="$(refresh_time "$CACHE_AUTH")"
  # Strictly newer only. Equal timestamps mean nothing refreshed, and copying
  # anyway would churn the host file for no reason.
  if [ -n "$cache_t" ] && [[ "$cache_t" > "$host_t" ]]; then
    copy_auth "$CACHE_AUTH" "$HOST_AUTH"
    echo "Codex credential refreshed inside the sandbox; pushed back to the host." >&2
  fi
}

do_status() {
  printf 'host  last_refresh: %s\n' "$(refresh_time "$HOST_AUTH")"
  printf 'cache last_refresh: %s\n' "$(refresh_time "$CACHE_AUTH")"
}

case "${1:-pull}" in
  pull) do_pull ;;
  push) do_push ;;
  status) do_status ;;
  *) echo "usage: codex-token-sync.sh pull|push|status" >&2; exit 2 ;;
esac
