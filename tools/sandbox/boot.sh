#!/usr/bin/env bash
# Bring the sandbox up. Idempotent: safe to run before every dispatch, cheap
# when nothing has changed. Prints the container name on stdout; everything
# meant for a human goes to stderr, so callers can capture the name cleanly.

set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd -P)"
# shellcheck source=common.sh
. "$SCRIPT_DIR/common.sh"
# shellcheck source=colima.sh
. "$SCRIPT_DIR/colima.sh"
# shellcheck source=run-args.sh
. "$SCRIPT_DIR/run-args.sh"
# shellcheck source=dev-fs.sh
. "$SCRIPT_DIR/dev-fs.sh"
# shellcheck source=credential-expiry.sh
. "$SCRIPT_DIR/credential-expiry.sh"

log() { printf '%s\n' "$*" >&2; }

image_stack() {
  docker image inspect "$SANDBOX_IMAGE" \
    --format "{{index .Config.Labels \"$SANDBOX_STACK_LABEL\"}}" 2>/dev/null || true
}

ensure_image() {
  if [ -z "${SANDBOX_REBUILD:-}" ] && sandbox_stamp_fresh "$CACHE_DIR/stamps/.image-$SANDBOX_STACK" 300; then
    return 0
  fi
  if [ "$(image_stack)" = "$SANDBOX_STACK" ] && [ -z "${SANDBOX_REBUILD:-}" ]; then
    mkdir -p "$CACHE_DIR/stamps"
    touch "$CACHE_DIR/stamps/.image-$SANDBOX_STACK"
    return 0
  fi
  log "Building $SANDBOX_IMAGE (stack $SANDBOX_STACK). First build takes a few minutes."
  docker build \
    --build-arg "NODE_IMAGE=$SANDBOX_NODE_IMAGE" \
    --build-arg "DOCKER_CLI_VERSION=$SANDBOX_DOCKER_CLI_VERSION" \
    --build-arg "PNPM_VERSION=$SANDBOX_PNPM_VERSION" \
    --build-arg "CODEX_VERSION=$SANDBOX_CODEX_VERSION" \
    --build-arg "CURSOR_VERSION=$SANDBOX_CURSOR_VERSION" \
    --build-arg "COPILOT_CLI_VERSION=${SANDBOX_COPILOT_CLI_VERSION:-latest}" \
    --build-arg "AMP_CLI_VERSION=${SANDBOX_AMP_CLI_VERSION:-latest}" \
    --build-arg "OPENCODE_VERSION=${SANDBOX_OPENCODE_VERSION:-latest}" \
    --build-arg "WITH_PLAYWRIGHT=$SANDBOX_WITH_PLAYWRIGHT" \
    --build-arg "PLAYWRIGHT_VERSION=$SANDBOX_PLAYWRIGHT_VERSION" \
    --build-arg "SANDBOX_STACK=$SANDBOX_STACK" \
    --build-arg "HOST_UID=$(id -u)" \
    --build-arg "HOST_GID=$(id -g)" \
    -t "$SANDBOX_IMAGE" "$SCRIPT_DIR" >&2
}

prepare_cache() {
  mkdir -p "$CACHE_DIR/claude-home" "$CACHE_DIR/codex-home" \
           "$CACHE_DIR/cursor-home" "$CACHE_DIR/gh" "$CACHE_DIR/stamps" \
           "$CACHE_DIR/copilot-home" "$CACHE_DIR/agy-home" \
           "$CACHE_DIR/amp-home" "$CACHE_DIR/opencode-home"

  # ~/.claude.json lives inside the claude-home *directory* mount (see
  # entrypoint.sh / ensure_claude_json_link). A FILE bind-mount of claude.json
  # pinned an inode; host rewrites then left the container reading a truncated
  # copy ("JSON Parse error: Unterminated string").
  local cj="$CACHE_DIR/claude-home/claude.json"
  local old_cj="$CACHE_DIR/claude.json"
  if [ ! -f "$cj" ] && [ -f "$old_cj" ]; then
    cp "$old_cj" "$cj" 2>/dev/null || true
  fi
  if ! jq empty "$cj" >/dev/null 2>&1; then
    printf '{}\n' >"$cj"
  fi

  # Seed trust so the inner Claude doesn't stop on a trust dialog.
  # Skip the jq rewrite entirely when both trust keys are already true.
  if ! jq -e --arg r "$REPO_ROOT" \
       '.projects["/workspace"].hasTrustDialogAccepted == true and
        .projects[$r].hasTrustDialogAccepted == true' \
       "$cj" >/dev/null 2>&1; then
    local tmp
    tmp="$(mktemp "$cj.XXXXXX")"
    if jq --arg r "$REPO_ROOT" \
         '.projects |= (. // {}) |
          .projects["/workspace"] |= (. // {}) |
          .projects["/workspace"].hasTrustDialogAccepted = true |
          .projects[$r] |= (. // {}) |
          .projects[$r].hasTrustDialogAccepted = true' \
         "$cj" >"$tmp" 2>/dev/null; then
      mv "$tmp" "$cj"
    else
      rm -f "$tmp"
    fi
  fi

  # Only pull the credential for the agent we are actually dispatching to, plus
  # GitHub (needed for git push regardless of agent). When SANDBOX_AGENT is
  # unset (e.g. direct `./sandbox up`), pull all three so any agent can run.
  local agent="${SANDBOX_AGENT:-}"
  if [ -z "$agent" ]; then
    bash "$SCRIPT_DIR/token-sync.sh" pull >&2 || log "WARN: no Claude credential bridged."
    bash "$SCRIPT_DIR/codex-token-sync.sh" pull >&2 || log "WARN: no Codex credential bridged."
    bash "$SCRIPT_DIR/cursor-token-sync.sh" pull >&2 || log "WARN: no Cursor credential bridged."
  elif ! sandbox_stamp_fresh "$CACHE_DIR/stamps/.cred-synced-$agent" 60; then
    case "$agent" in
      claude)   bash "$SCRIPT_DIR/token-sync.sh" pull >&2 || log "WARN: no Claude credential bridged." ;;
      codex)    bash "$SCRIPT_DIR/codex-token-sync.sh" pull >&2 || log "WARN: no Codex credential bridged." ;;
      cursor)   bash "$SCRIPT_DIR/cursor-token-sync.sh" pull >&2 || log "WARN: no Cursor credential bridged." ;;
      copilot)  bash "$SCRIPT_DIR/copilot-token-sync.sh" pull >&2 || log "WARN: no Copilot (GitHub) credential bridged." ;;
      agy)      bash "$SCRIPT_DIR/agy-token-sync.sh" pull >&2 || log "WARN: no agy credential bridged." ;;
      amp)      bash "$SCRIPT_DIR/amp-token-sync.sh" pull >&2 || log "WARN: no Amp credential bridged." ;;
      opencode) bash "$SCRIPT_DIR/opencode-token-sync.sh" pull >&2 || log "WARN: no OpenCode config bridged." ;;
    esac
    mkdir -p "$CACHE_DIR/stamps"
    touch "$CACHE_DIR/stamps/.cred-synced-$agent"
  fi
  bash "$SCRIPT_DIR/github-token-sync.sh" >&2 || log "WARN: git push from inside the sandbox will not work."
  if [ -z "$agent" ]; then
    credential_expiry_check_all
  else
    credential_expiry_warn "$agent"
  fi
}

container_exists() { docker inspect "$SANDBOX_NAME" >/dev/null 2>&1; }
container_running() { [ "$(docker inspect -f '{{.State.Running}}' "$SANDBOX_NAME" 2>/dev/null)" = "true" ]; }

# One inspect, not one per mount: Colima round-trips were the warm-boot floor.
container_is_current() {
  local info running_image running_fp want_image want_fp
  info="$(docker inspect -f '{{.State.Running}} {{.Image}} {{index .Config.Labels "sandbox.config-fp"}}' \
    "$SANDBOX_NAME" 2>/dev/null || true)"
  [ -n "$info" ] || return 1
  [ "${info%% *}" = "true" ] || return 1
  info="${info#* }"
  running_image="${info%% *}"
  running_fp="${info#* }"
  want_image="$(docker image inspect -f '{{.Id}}' "$SANDBOX_IMAGE" 2>/dev/null || true)"
  [ -n "$want_image" ] && [ "$want_image" = "$running_image" ] || return 1
  want_fp="$(sandbox_config_fingerprint 2>/dev/null || true)"
  [ -z "$want_fp" ] || [ "$want_fp" = "$running_fp" ] || return 1
  return 0
}

# Host ports the container we are about to remove currently holds, as
# "HostIp:HostPort" lines. They belong to us, so the resolver must not count
# them as taken — see SANDBOX_PORTS_RELEASED in run-args.sh.
old_host_ports() {
  docker inspect -f \
    '{{range $p, $bs := .HostConfig.PortBindings}}{{range $bs}}{{.HostIp}}:{{.HostPort}}{{"\n"}}{{end}}{{end}}' \
    "$SANDBOX_NAME" 2>/dev/null || true
}

# Docker names the symptom and stops. The two failures people actually hit here
# have specific fixes, and printing them is the difference between a five-second
# correction and a debugging session.
explain_run_failure() {
  case "$1" in
    *"port is already allocated"*)
      log ""
      log "A host port from SANDBOX_PORTS is held by something else, and the"
      log "auto-pick did not get out of the way: either every port in the scan"
      log "window above it is taken too, or lsof is not on PATH, so the conflict"
      log "only surfaced at docker run."
      log "Free the port, widen the search with SANDBOX_PORT_SCAN_LIMIT, or pin a"
      log "different host port in tools/sandbox/sandbox.local.conf:"
      log "  SANDBOX_PORTS=\"127.0.0.1:3100:3000\""
      ;;
    *"mount source path"*)
      log ""
      log "The Docker daemon could not resolve a mount source. Under Colima the"
      log "daemon runs inside a VM, so the path has to exist there — not only on"
      log "the Mac. See sandbox_mount_args in tools/sandbox/run-args.sh."
      ;;
  esac
}

ensure_container() {
  if container_is_current; then
    return 0
  fi
  if container_exists; then
    log "Sandbox config changed; recreating $SANDBOX_NAME."
    SANDBOX_PORTS_RELEASED="$(old_host_ports)"
    docker rm -f "$SANDBOX_NAME" >/dev/null 2>&1 || true
  fi

  # Once, here, before the args are built: a host port that is taken gets
  # remapped upward and everything downstream — including the -p flags — sees
  # the resolved list rather than the configured one.
  SANDBOX_PORTS_RESOLVED="$(sandbox_resolve_ports)"

  local args=()
  while IFS= read -r line; do
    args+=("$line")
  done < <(sandbox_run_args)

  local err
  if err="$(docker run -d "${args[@]}" "$SANDBOX_IMAGE" sleep infinity 2>&1 >/dev/null)"; then
    log "Started $SANDBOX_NAME."
    return 0
  fi
  log "$err"
  explain_run_failure "$err"
  return 1
}

# Point ~/.claude.json at the directory-mounted copy. Safe to run on every
# boot: ln -sfn is idempotent. Lives in boot.sh so a running image that was
# built before entrypoint.sh grew the same link still works without a rebuild.
ensure_claude_json_link() {
  local cid stamp="$CACHE_DIR/stamps/.claude-json-link"
  cid="$(docker inspect -f '{{.Id}}' "$SANDBOX_NAME" 2>/dev/null || true)"
  [ -n "$cid" ] && [ "$(cat "$stamp" 2>/dev/null || true)" = "$cid" ] && return 0
  docker exec -u 0 "$SANDBOX_NAME" sh -c '
    rm -f /home/agent/.claude.json
    [ -f /home/agent/.claude/claude.json ] || printf "{}\n" > /home/agent/.claude/claude.json
    ln -sfn /home/agent/.claude/claude.json /home/agent/.claude.json
    chown -h agent:$(id -g agent) /home/agent/.claude.json /home/agent/.claude/claude.json
  ' >/dev/null 2>&1 || true
  [ -n "$cid" ] && mkdir -p "$CACHE_DIR/stamps" && printf '%s' "$cid" >"$stamp"
}

ensure_colima
sandbox_require_docker
stop_colima_inotify
ensure_image
prepare_cache
ensure_container
ensure_claude_json_link
fix_volume_ownership
ensure_mac_save_bridge

# Last, and never fatal: at most one line saying a newer harness exists. It
# reports the previous check's answer and refreshes in the background, so a slow
# or absent network costs a boot nothing. Nothing is updated without being asked.
bash "$SCRIPT_DIR/update.sh" --nudge >/dev/null || true

printf '%s\n' "$SANDBOX_NAME"
