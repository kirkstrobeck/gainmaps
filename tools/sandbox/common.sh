#!/usr/bin/env bash
# Shared identity + daemon resolution for the sandbox scripts. Source, don't run.
#
# Every script here must agree on REPO_ROOT and SANDBOX_NAME, or they'll talk to
# different containers. This file is the single place that decides both.

SANDBOX_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd -P)"
# -P resolves symlinks. The path is handed to the host Docker daemon for bind
# mounts, and the daemon only knows physical paths.
REPO_ROOT="$(cd "$SANDBOX_DIR/../.." && pwd -P)"
CACHE_DIR="$SANDBOX_DIR/.cache"

# shellcheck source=config.sh
. "$SANDBOX_DIR/config.sh"

# Colima (and other VMs) may not see this process's /workspace. sandbox.local.conf
# can point docker bind mounts at the host path the daemon actually has.
if [ -n "${SANDBOX_HOST_REPO_ROOT:-}" ]; then
  REPO_ROOT="$SANDBOX_HOST_REPO_ROOT"
  SANDBOX_DIR="$REPO_ROOT/tools/sandbox"
  CACHE_DIR="$SANDBOX_DIR/.cache"
fi

# Hashed suffix, so two worktrees of the same repo get two containers instead of
# fighting over one. Same repo path always yields the same name.
SANDBOX_NAME="${SANDBOX_PROJECT}-sandbox-$(printf '%s' "$REPO_ROOT" | shasum | cut -c1-8)"

export SANDBOX_DIR REPO_ROOT CACHE_DIR SANDBOX_NAME

# Colima, not Docker Desktop. Its socket lives under ~/.colima, and nothing
# creates /var/run/docker.sock, so DOCKER_HOST must be set explicitly. A Docker
# Desktop install that does create the default socket still works — this only
# overrides when a Colima socket is actually there.
sandbox_docker_host() {
  local sock="$HOME/.colima/${COLIMA_PROFILE:-default}/docker.sock"
  if [ -S "$sock" ]; then
    export DOCKER_HOST="unix://$sock"
  fi
}

# Resolved at source time, not left to each caller. Every script here shells out
# to docker, and a script that forgets the call talks to a socket that isn't
# there — which surfaces as "dial unix /var/run/docker.sock: no such file or
# directory" from a command that has nothing to do with sockets.
sandbox_docker_host

sandbox_require_docker() {
  if sandbox_stamp_fresh "$CACHE_DIR/stamps/.docker-ok" 60; then
    SANDBOX_DOCKER_OK=1
    return 0
  fi
  if docker info >/dev/null 2>&1; then
    SANDBOX_DOCKER_OK=1
    mkdir -p "$CACHE_DIR/stamps"
    touch "$CACHE_DIR/stamps/.docker-ok"
    return 0
  fi
  echo "Docker daemon not reachable. Start it with: colima start" >&2
  return 1
}

# Space/newline separated config lists -> one item per line, blanks dropped.
# Word-splits on purpose: SANDBOX_PORTS and SANDBOX_VOLUME_DIRS are written as
# words. Paths that may contain spaces belong in SANDBOX_EXTRA_MOUNTS and must
# go through sandbox_lines instead.
sandbox_list() {
  printf '%s\n' $1
}

# Trim ASCII whitespace from both ends of one line.
sandbox_trim() {
  local s="$1"
  s="${s#"${s%%[![:space:]]*}"}"
  s="${s%"${s##*[![:space:]]}"}"
  printf '%s' "$s"
}

# Newline-delimited config lists -> one item per line. Blanks and comments
# dropped. No word-splitting: safe for paths that contain spaces.
sandbox_lines() {
  local line
  while IFS= read -r line || [ -n "$line" ]; do
    line="$(sandbox_trim "$line")"
    [ -z "$line" ] && continue
    case "$line" in \#*) continue ;; esac
    printf '%s\n' "$line"
  done <<EOF
${1:-}
EOF
}

# Milliseconds since epoch. Uses perl for sub-second precision (date +%s%N is
# Linux-only; macOS/BSD date lacks %N). Falls back to whole seconds.
sandbox_now_ms() {
  perl -MTime::HiRes=time -e 'printf "%d\n", int(time() * 1000)' 2>/dev/null ||
    printf '%s000\n' "$(date +%s)"
}

# True when a stamp file exists and is less than $2 seconds old (default 60).
sandbox_stamp_fresh() {
  [ -f "$1" ] || return 1
  local age
  age="$(perl -e 'print int(time() - (stat($ARGV[0]))[9])' "$1" 2>/dev/null || printf '99999\n')"
  [ "$age" -lt "${2:-60}" ]
}

# Emit a timing line to stderr when SANDBOX_TIMING=1. Args: label start_ms end_ms.
sandbox_timing() {
  [ "${SANDBOX_TIMING:-0}" = "1" ] || return 0
  printf 'timing: %s %dms\n' "$1" "$(( $3 - $2 ))" >&2
}
