#!/usr/bin/env bash
# Bridge the host's GitHub auth into the container as a gh config directory.
# Host-side only. Usage: github-token-sync.sh [--quiet]
#
# THE TOKEN IS NEVER PRINTED. Not to stdout, not to stderr, not into an error
# message, not into a log. It travels host env -> variable -> file descriptor
# and stops there. Do not add `set -x` to this file.
#
# WHY A TOKEN AND NOT A KEY. Nothing under ~/.ssh is touched and no key is
# mounted. A token is revocable from the GitHub UI, is scoped, and expires; an
# SSH private key is none of those things, and handing one to a container
# running an agent with permissions disabled is handing over the whole account.

set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd -P)"
GH_DIR="${SANDBOX_GH_DIR:-$SCRIPT_DIR/.cache/gh}"
HOSTS_FILE="$GH_DIR/hosts.yml"
TOKEN_HASH_FILE="$GH_DIR/.token-hash"

quiet=0
[ "${1:-}" = "--quiet" ] && quiet=1
say() { [ "$quiet" = 1 ] || printf '%s\n' "$*" >&2; }

read_token() {
  if [ -n "${GH_TOKEN:-}" ]; then
    printf '%s' "$GH_TOKEN"
    return 0
  fi
  if [ -n "${GITHUB_TOKEN:-}" ]; then
    printf '%s' "$GITHUB_TOKEN"
    return 0
  fi
  if command -v gh >/dev/null 2>&1; then
    gh auth token 2>/dev/null || true
  fi
}

# Resolving the login doubles as a liveness check: a revoked or expired token
# fails here, on the host, with a clear message — instead of surfacing later as
# a mysterious push failure inside the container.
resolve_login() {
  GH_TOKEN="$1" gh api user --jq .login 2>/dev/null || true
}

write_hosts() {
  local token="$1" login="$2" tmp
  mkdir -p "$GH_DIR"
  chmod 700 "$GH_DIR"
  # mktemp + chmod + mv: the file never exists at its final name in a
  # world-readable state, not even for the instant between create and chmod.
  #
  # Renaming is safe HERE because the container mounts the DIRECTORY. It would
  # not be safe for a single bind-mounted file — Docker binds the inode, so a
  # rename hands the host a new inode while the container reads the old one
  # forever.
  tmp="$(mktemp "$GH_DIR/.hosts.XXXXXX")"
  chmod 600 "$tmp"
  {
    printf 'github.com:\n'
    printf '    git_protocol: https\n'
    printf '    users:\n'
    printf '        %s:\n' "$login"
    printf '            oauth_token: %s\n' "$token"
    printf '    user: %s\n' "$login"
    printf '    oauth_token: %s\n' "$token"
  } >"$tmp"
  mv -f "$tmp" "$HOSTS_FILE"
}

# Hash the token for cache-key comparison — never printed, only compared.
token_hash() {
  printf '%s' "$1" | sha256sum 2>/dev/null | awk '{print $1}' ||
    printf '%s' "$1" | md5sum 2>/dev/null | awk '{print $1}' ||
    printf 'fallback\n'
}

# True when hosts.yml is fresh (< 15 min) and the stored token hash matches.
# Skips the network call to gh api user.
login_cache_valid() {
  local token="$1"
  [ -f "$HOSTS_FILE" ] || return 1
  [ -f "$TOKEN_HASH_FILE" ] || return 1
  local age
  age="$(perl -e 'print int(time() - (stat($ARGV[0]))[9])' "$HOSTS_FILE" 2>/dev/null || printf '99999\n')"
  [ "$age" -lt 900 ] 2>/dev/null || return 1
  [ "$(token_hash "$token")" = "$(cat "$TOKEN_HASH_FILE" 2>/dev/null || true)" ]
}

# Extract the stored login from the existing hosts.yml (never calls gh).
read_cached_login() {
  grep '^ *user: ' "$HOSTS_FILE" 2>/dev/null | awk '{print $2}' | tail -1
}

# Fresh hosts.yml is enough for a warm dispatch: skip `gh auth token` and
# `gh api user`. Re-check at most every 15 minutes, or when the file is gone.
if [ -f "$HOSTS_FILE" ]; then
  age="$(perl -e 'print int(time() - (stat($ARGV[0]))[9])' "$HOSTS_FILE" 2>/dev/null || printf '99999\n')"
  if [ "$age" -lt 900 ] 2>/dev/null; then
    login="$(read_cached_login)"
    [ -n "$login" ] && say "GitHub auth: using cached login for $login."
    exit 0
  fi
fi

token="$(read_token)"
if [ -z "$token" ]; then
  say "No GitHub token on the host. Run 'gh auth login' (or export GH_TOKEN)."
  say "The sandbox will still start; git push from inside will not work."
  exit 1
fi

if ! command -v gh >/dev/null 2>&1; then
  say "gh is not installed on the host, so the token cannot be verified."
  say "Install it with: brew install gh"
  exit 1
fi

if login_cache_valid "$token"; then
  login="$(read_cached_login)"
  say "GitHub auth: using cached login for $login."
else
  login="$(resolve_login "$token")"
  if [ -z "$login" ]; then
    say "The host GitHub token was rejected by the API. Run 'gh auth login' again."
    exit 1
  fi
  write_hosts "$token" "$login"
  # Store a hash of the token (never the token itself) so the next call can
  # detect whether it changed without re-running gh api user.
  {
    mkdir -p "$GH_DIR"
    token_hash "$token" >"$TOKEN_HASH_FILE"
    chmod 600 "$TOKEN_HASH_FILE"
  } 2>/dev/null || true
  say "GitHub auth bridged for $login (token stays in $GH_DIR, which is gitignored)."
fi
