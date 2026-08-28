#!/usr/bin/env bash
# Loads sandbox.conf (+ the gitignored sandbox.local.conf) over a set of
# defaults. Source, don't run. Expects SANDBOX_DIR and REPO_ROOT to be set —
# common.sh is the only intended caller.

: "${SANDBOX_DIR:?config.sh must be sourced from common.sh}"
: "${REPO_ROOT:?config.sh must be sourced from common.sh}"

# Defaults first, so a config file only has to state what it changes and an
# older config never leaves a new variable unset.
SANDBOX_PROJECT="$(printf '%s' "${REPO_ROOT##*/}" | tr 'A-Z' 'a-z' | tr -c 'a-z0-9_-' '-')"
SANDBOX_STACK="v3"
SANDBOX_PORTS=""
SANDBOX_VOLUME_DIRS="node_modules"
SANDBOX_WATCH_DIRS="src"
SANDBOX_WATCH_INTERVAL_MS="250"
SANDBOX_WATCH_EXT="\\.(tsx?|jsx?|mjs|cjs|css|json)$"
SANDBOX_DEFAULT_AGENT="claude"
SANDBOX_DEFAULT_MODEL=""
SANDBOX_NODE_IMAGE="node:24-bookworm-slim"
SANDBOX_DOCKER_CLI_VERSION="27.5.1"
SANDBOX_PNPM_VERSION="10.15.0"
SANDBOX_CODEX_VERSION="latest"
SANDBOX_CURSOR_VERSION="latest"
SANDBOX_COPILOT_CLI_VERSION="latest"
SANDBOX_AMP_CLI_VERSION="latest"
SANDBOX_OPENCODE_VERSION="latest"
SANDBOX_WITH_PLAYWRIGHT="0"
SANDBOX_PLAYWRIGHT_VERSION="1.55.0"
SANDBOX_UPDATE_CHECK="1"
SANDBOX_AUTOUPDATE="0"
SANDBOX_EXTRA_MOUNTS=""
SANDBOX_EXTRA_ENV=""
SANDBOX_EXTRA_ALLOW=""
SANDBOX_EXTRA_DENY=""
SANDBOX_AUTH_WARN_HOURS="12"

# shellcheck source=sandbox.conf
[ -r "$SANDBOX_DIR/sandbox.conf" ] && . "$SANDBOX_DIR/sandbox.conf"
# shellcheck disable=SC1091
[ -r "$SANDBOX_DIR/sandbox.local.conf" ] && . "$SANDBOX_DIR/sandbox.local.conf"

SANDBOX_IMAGE="${SANDBOX_IMAGE:-${SANDBOX_PROJECT}-sandbox:local}"
SANDBOX_STACK_LABEL="dev.sandbox.agent-stack"

export SANDBOX_PROJECT SANDBOX_STACK SANDBOX_PORTS SANDBOX_VOLUME_DIRS \
  SANDBOX_WATCH_DIRS SANDBOX_WATCH_INTERVAL_MS SANDBOX_WATCH_EXT \
  SANDBOX_DEFAULT_AGENT SANDBOX_DEFAULT_MODEL SANDBOX_NODE_IMAGE \
  SANDBOX_DOCKER_CLI_VERSION SANDBOX_PNPM_VERSION SANDBOX_CODEX_VERSION \
  SANDBOX_CURSOR_VERSION SANDBOX_COPILOT_CLI_VERSION SANDBOX_AMP_CLI_VERSION \
  SANDBOX_OPENCODE_VERSION SANDBOX_WITH_PLAYWRIGHT \
  SANDBOX_PLAYWRIGHT_VERSION SANDBOX_UPDATE_CHECK SANDBOX_AUTOUPDATE \
  SANDBOX_EXTRA_MOUNTS SANDBOX_EXTRA_ENV SANDBOX_EXTRA_ALLOW SANDBOX_EXTRA_DENY \
  SANDBOX_AUTH_WARN_HOURS \
  SANDBOX_IMAGE SANDBOX_STACK_LABEL

# Docker refuses volume names with slashes or dots, and two different repo paths
# must not collide onto one volume. Encode the path, don't truncate it.
sandbox_volume_name() {
  printf 'sv_%s' "$(printf '%s' "$1" | tr -c 'A-Za-z0-9' '_')"
}
