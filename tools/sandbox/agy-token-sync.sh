#!/usr/bin/env bash
# Bridge the Antigravity (agy) / Gemini credential from the Mac into the
# container's ~/.gemini directory. Usage: agy-token-sync.sh pull|push|status
#
# WHY PULL-ONLY. agy uses Google OAuth for interactive login. The refresh
# token path re-runs the OAuth dance server-side; the container cannot refresh
# Google credentials on behalf of the Mac. So nothing the container does
# invalidates what the host holds, and there is nothing to push back.
#
# GEMINI_API_KEY (env) takes precedence over an OAuth login for the same
# reason as CURSOR_API_KEY in cursor-token-sync.sh: an API key never expires
# mid-run, which matters for a dispatch that can run for 20+ minutes.
#
# If neither an API key nor an OAuth credential is present, the credential
# check fails with the command that fixes it rather than failing inside the
# container later.

set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd -P)"

CACHE_HOME="${AGY_CACHE_HOME:-$SCRIPT_DIR/.cache/agy-home}"
HOST_GEMINI="${HOST_GEMINI_HOME:-$HOME/.gemini}"

# The OAuth credential file. The actual filename may differ between agy
# versions — fall back to the directory itself.
host_credential_file() {
  for name in credentials.json oauth_credentials.json .credentials.json; do
    [ -f "$HOST_GEMINI/$name" ] && printf '%s\n' "$HOST_GEMINI/$name" && return 0
  done
  return 1
}

do_pull() {
  # API key takes priority: it is the credential that can survive an unattended run.
  if [ -n "${GEMINI_API_KEY:-}" ]; then
    mkdir -p "$CACHE_HOME"
    printf '%s\n' "$GEMINI_API_KEY" >"$CACHE_HOME/.api_key"
    chmod 600 "$CACHE_HOME/.api_key"
    return 0
  fi

  local cred
  if cred="$(host_credential_file 2>/dev/null)"; then
    mkdir -p "$CACHE_HOME"
    cp -f "$cred" "$CACHE_HOME/$(basename "$cred")"
    chmod 600 "$CACHE_HOME/$(basename "$cred")"
    return 0
  fi

  # A previous pull may have left a working credential in cache.
  [ -d "$CACHE_HOME" ] && [ "$(ls -A "$CACHE_HOME" 2>/dev/null)" ] && return 0

  echo "No agy/Gemini credential found. Run 'agy auth login' (or export GEMINI_API_KEY) on the Mac." >&2
  return 1
}

do_push() {
  : # Google OAuth does not rotate in a way the container can push back.
}

do_status() {
  if [ -n "${GEMINI_API_KEY:-}" ]; then
    echo "agy: GEMINI_API_KEY set in environment"
  elif host_credential_file >/dev/null 2>&1; then
    echo "agy: Google OAuth credential present at $(host_credential_file 2>/dev/null)"
  else
    echo "agy: no credential found"
  fi
  if [ -d "$CACHE_HOME" ] && [ "$(ls -A "$CACHE_HOME" 2>/dev/null)" ]; then
    echo "agy: cache: $CACHE_HOME (populated)"
  else
    echo "agy: cache: $CACHE_HOME (empty)"
  fi
}

case "${1:-pull}" in
  pull) do_pull ;;
  push) do_push ;;
  status) do_status ;;
  *) echo "usage: agy-token-sync.sh pull|push|status" >&2; exit 2 ;;
esac
