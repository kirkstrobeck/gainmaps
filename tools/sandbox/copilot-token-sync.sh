#!/usr/bin/env bash
# Bridge the Copilot credential from the Mac into the container.
# Usage: copilot-token-sync.sh pull|push|status
#
# Copilot authenticates through the GitHub OAuth token: the same token
# github-token-sync.sh bridges for git push. There is no separate secret to
# rotate. This script exists so prepare_cache can treat all agents uniformly,
# but its pull/push are both no-ops — the real work is in github-token-sync.sh,
# which already ran before this is called.
#
# Inside the container, the COPILOT_GITHUB_TOKEN env var is set from the bridged
# gh token via dispatch-copilot.sh. Nothing is written to a cache file because
# there is nothing to write.

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd -P)"

CACHE_DIR="${COPILOT_CACHE_DIR:-$SCRIPT_DIR/.cache/copilot-home}"

do_pull() {
  # The GitHub token is bridged by github-token-sync.sh; nothing extra is needed.
  # Fail loudly if that bridge produced nothing — Copilot cannot authenticate.
  local gh_hosts="${GH_CACHE_HOME:-$SCRIPT_DIR/.cache/gh}/hosts.yml"
  if [ ! -f "$gh_hosts" ]; then
    echo "No GitHub token found. Run 'gh auth login' on the Mac, then re-run boot." >&2
    return 1
  fi
  mkdir -p "$CACHE_DIR"
}

do_push() {
  : # GitHub OAuth tokens do not rotate inside the container for Copilot.
}

do_status() {
  local gh_hosts="${GH_CACHE_HOME:-$SCRIPT_DIR/.cache/gh}/hosts.yml"
  if [ -f "$gh_hosts" ]; then
    echo "copilot: GitHub token present (via gh hosts.yml)"
  else
    echo "copilot: no GitHub token"
  fi
}

case "${1:-pull}" in
  pull) do_pull ;;
  push) do_push ;;
  status) do_status ;;
  *) echo "usage: copilot-token-sync.sh pull|push|status" >&2; exit 2 ;;
esac
