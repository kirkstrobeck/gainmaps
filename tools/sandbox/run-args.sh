#!/usr/bin/env bash
# Builds the `docker run` argument list for the sandbox container. Source after
# common.sh. Kept apart from boot.sh so the mount layout can be read — and
# argued with — without wading through lifecycle logic.

# Linked worktrees store an absolute host gitdir in a `.git` *file*. Binding
# only the worktree leaves that path empty inside the container, and every git
# command fails. Read the pointer file on the host — never fork git from the
# gate, and never put $(git ...) in sandbox.conf.
sandbox_git_common_dir() {
  local git_entry="$REPO_ROOT/.git"
  [ -f "$git_entry" ] || return 0
  local gitdir_line gitdir common
  gitdir_line="$(head -1 "$git_entry" 2>/dev/null)"
  case "$gitdir_line" in
    gitdir:*) ;;
    *) return 0 ;;
  esac
  gitdir="${gitdir_line#gitdir:}"
  gitdir="$(sandbox_trim "$gitdir")"
  case "$gitdir" in
    /*) ;;
    *) gitdir="$REPO_ROOT/$gitdir" ;;
  esac
  # gitdir is .git/worktrees/<name>; the common dir is two levels up.
  common="$(cd "$gitdir/../.." 2>/dev/null && pwd -P)" || return 0
  case "$common" in
    "$REPO_ROOT"|"$REPO_ROOT"/*) return 0 ;;
  esac
  printf '%s\n' "$common"
}

sandbox_worktree_mount_args() {
  local common
  common="$(sandbox_git_common_dir)"
  [ -z "$common" ] && return 0
  printf '%s\n' -v "$common:$common:rw"
}

sandbox_extra_mount_args() {
  local spec host dest mode rest
  while IFS= read -r spec; do
    [ -z "$spec" ] && continue
    host="${spec%%:*}"
    rest="${spec#*:}"
    case "$rest" in
      *:*) dest="${rest%:*}" ; mode="${rest##*:}" ;;
      *)   dest="$rest" ; mode="rw" ;;
    esac
    case "$mode" in rw|ro) ;; *) mode="rw" ;; esac
    [ -n "$host" ] && [ -n "$dest" ] || continue
    printf '%s\n' -v "$host:$dest:$mode"
  done < <(sandbox_lines "${SANDBOX_EXTRA_MOUNTS:-}")
}

# Mount the repo at BOTH /workspace and its real host path.
#
# The container shares the host's Docker socket, so when the inner agent starts
# a sibling container (a database, a test service) with a bind mount, the daemon
# resolving that mount is the one on the Mac. It has never heard of /workspace.
# Mounting the repo a second time at its literal host path means a path that
# works inside also works when handed to the daemon.
sandbox_mount_args() {
  printf '%s\n' \
    -v "$REPO_ROOT:/workspace" \
    -v "$REPO_ROOT:$REPO_ROOT" \
    -v "$CACHE_DIR/claude-home:/home/agent/.claude" \
    -v "$CACHE_DIR/codex-home:/home/agent/.codex" \
    -v "$CACHE_DIR/cursor-home:/home/agent/.config/cursor" \
    -v "$CACHE_DIR/gh:/home/agent/.config/gh" \
    -v "$CACHE_DIR/agy-home:/home/agent/.gemini" \
    -v "$CACHE_DIR/amp-home:/home/agent/.config/amp" \
    -v "$CACHE_DIR/opencode-home:/home/agent/.config/opencode"
  sandbox_worktree_mount_args
  sandbox_extra_mount_args

  # The socket, so the inner agent can start sibling containers.
  #
  # The mount SOURCE is resolved by the daemon, not by the Mac. Under Colima the
  # daemon lives in a VM, where the Mac's ~/.colima/<profile>/docker.sock does
  # not exist — and a unix socket cannot cross virtiofs anyway, so handing over
  # the host path fails with "error while creating mount source path ...
  # operation not supported". The socket every supported daemon can see is its
  # own, at /var/run/docker.sock. Gate on the daemon answering rather than on a
  # file existing on the Mac, for the same reason: the Mac is not where the path
  # gets looked up.
  if [ "${SANDBOX_DOCKER_OK:-}" = 1 ] || docker info >/dev/null 2>&1; then
    printf '%s\n' -v "${SANDBOX_DOCKER_SOCK:-/var/run/docker.sock}:/var/run/docker.sock"
  fi

  # Named volumes shadow the bind mount at these paths. node_modules must be
  # container-private because the Mac's tree is built for darwin and the
  # container needs linux; build caches are here because thousands of small
  # writes per rebuild are painfully slow over virtiofs.
  local dir vol
  while IFS= read -r dir; do
    [ -z "$dir" ] && continue
    vol="$(sandbox_volume_name "${SANDBOX_NAME}_${dir}")"
    printf '%s\n' -v "$vol:/workspace/$dir"
  done < <(sandbox_list "$SANDBOX_VOLUME_DIRS")
}

# Host-port conflicts are resolved, not reported.
#
# The host half of a port binding is a preference, not a requirement: it is the
# number a human types into a browser, and nothing inside the container ever
# sees it. So when something else on the Mac already listens there, walk upward
# until a port is free and publish that instead. The container port is left
# alone — code inside the sandbox keeps binding 3000 no matter what the Mac
# ended up calling it.
#
# Nothing is written back to sandbox.local.conf. A remap is a fact about this
# boot, not a decision about the project, and a harness that quietly edits your
# config is worse than one that prints a line saying what it did.

# How far to walk before giving up and letting Docker fail with its own message.
SANDBOX_PORT_SCAN_LIMIT="${SANDBOX_PORT_SCAN_LIMIT:-20}"

# Host ports the resolver must treat as free even if lsof still sees them:
# "HostIp:HostPort" per line. boot.sh fills this with the bindings of the
# container it just removed. Docker frees those when the container goes, but the
# proxy teardown is not instant, and without this a recreate races its own old
# container and walks the URL the human had bookmarked.
SANDBOX_PORTS_RELEASED="${SANDBOX_PORTS_RELEASED:-}"

# Resolved bindings, one per line. boot.sh sets this once before `docker run`;
# empty means "nobody resolved anything" and the configured list is used as-is.
SANDBOX_PORTS_RESOLVED="${SANDBOX_PORTS_RESOLVED:-}"

_sandbox_ports_taken=""

# True when something is already listening on the host side of a binding.
#
# lsof is queried by port number and filtered by address here, rather than with
# the tidier `-iTCP@addr:port`, because that form misses the case that actually
# bites: a process listening on 0.0.0.0 blocks a bind to 127.0.0.1 but does not
# appear in a query scoped to 127.0.0.1. Docker's bind would fail on a port lsof
# had just called free.
#
# No lsof — a non-macOS host, a stripped PATH — means no opinion: report free
# and let Docker decide, which is exactly the behaviour before any of this.
sandbox_port_busy() {
  local addr="$1" port="$2" laddr
  command -v lsof >/dev/null 2>&1 || return 1
  while IFS= read -r laddr; do
    [ -z "$laddr" ] && continue
    laddr="${laddr%:*}" # "127.0.0.1:3000" -> "127.0.0.1", "[::1]:3000" -> "[::1]"
    # A wildcard listener blocks every bind, and a wildcard request collides
    # with every listener. Otherwise it takes an exact address match.
    case "$laddr" in '*' | '0.0.0.0' | '::' | '[::]') return 0 ;; esac
    case "$addr" in '' | '*' | '0.0.0.0' | '::' | '[::]') return 0 ;; esac
    [ "$laddr" = "$addr" ] && return 0
  done < <(lsof -nP -iTCP:"$port" -sTCP:LISTEN -Fn 2>/dev/null | sed -n 's/^n//p')
  return 1
}

# Free for our purposes: not claimed by an earlier entry in this same pass, and
# either just released by the container we removed or not listening at all.
sandbox_port_available() {
  local addr="$1" port="$2" released
  case "$_sandbox_ports_taken" in *" $addr:$port "*) return 1 ;; esac
  while IFS= read -r released; do
    [ "$released" = "$addr:$port" ] && return 0
  done <<EOF
$SANDBOX_PORTS_RELEASED
EOF
  ! sandbox_port_busy "$addr" "$port"
}

# Reads SANDBOX_PORTS, writes the effective bindings on stdout, explains any
# remap on stderr.
sandbox_resolve_ports() {
  local spec addr rest host container candidate tries
  _sandbox_ports_taken=""
  while IFS= read -r spec; do
    [ -z "$spec" ] && continue

    # Only the two documented forms are rewritten. A bare container port, an
    # IPv6 literal, a range, a /udp suffix — passed through untouched, because
    # guessing at a form we do not parse is worse than Docker's own error.
    case "$spec" in
      \[*) printf '%s\n' "$spec" && continue ;;
      *:*:*)
        addr="${spec%%:*}"
        rest="${spec#*:}"
        host="${rest%%:*}"
        container="${rest#*:}"
        ;;
      *:*)
        addr=""
        host="${spec%%:*}"
        container="${spec#*:}"
        ;;
      *) printf '%s\n' "$spec" && continue ;;
    esac
    # Both halves must be plain port numbers. The :-x substitutes a non-digit
    # for an empty half, so a malformed spec falls through to Docker too.
    case "${host:-x}${container:-x}" in *[!0-9]*) printf '%s\n' "$spec" && continue ;; esac

    candidate="$host"
    tries=0
    while ! sandbox_port_available "$addr" "$candidate"; do
      tries=$((tries + 1))
      if [ "$tries" -gt "$SANDBOX_PORT_SCAN_LIMIT" ]; then
        printf 'WARN: no free host port in %s..%s; keeping %s and letting Docker decide.\n' \
          "$host" "$((host + SANDBOX_PORT_SCAN_LIMIT))" "${addr:+$addr:}$host" >&2
        candidate="$host"
        break
      fi
      candidate=$((candidate + 1))
    done

    _sandbox_ports_taken="$_sandbox_ports_taken $addr:$candidate "
    if [ "$candidate" != "$host" ]; then
      printf 'Host port %s is in use; publishing %s -> container %s instead.\n' \
        "${addr:+$addr:}$host" "${addr:+$addr:}$candidate" "$container" >&2
    fi
    printf '%s\n' "${addr:+$addr:}$candidate:$container"
  done < <(sandbox_list "$SANDBOX_PORTS")
}

sandbox_port_args() {
  local port
  while IFS= read -r port; do
    [ -z "$port" ] && continue
    printf '%s\n' -p "$port"
  done < <(sandbox_list "${SANDBOX_PORTS_RESOLVED:-$SANDBOX_PORTS}")
}

sandbox_env_args() {
  printf '%s\n' \
    -e "SANDBOX_INNER=1" \
    -e "SANDBOX_PROJECT=$SANDBOX_PROJECT" \
    -e "HOST_REPO_ROOT=$REPO_ROOT"

  # Mirrored so commits made inside carry the human's identity, not root's.
  local name email
  name="$(git -C "$REPO_ROOT" config user.name 2>/dev/null || true)"
  email="$(git -C "$REPO_ROOT" config user.email 2>/dev/null || true)"
  [ -n "$name" ] && printf '%s\n' -e "HOST_GIT_NAME=$name"
  [ -n "$email" ] && printf '%s\n' -e "HOST_GIT_EMAIL=$email"

  local entry
  while IFS= read -r entry; do
    [ -z "$entry" ] && continue
    printf '%s\n' -e "$entry"
  done < <(sandbox_lines "${SANDBOX_EXTRA_ENV:-}")
}

# Fingerprint the shape of what docker run will be called with, for
# container_is_current in boot.sh. Does not include remapped host ports.
sandbox_config_fingerprint() {
  {
    sandbox_mount_args
    sandbox_env_args
    sandbox_list "$SANDBOX_VOLUME_DIRS"
    sandbox_list "$SANDBOX_PORTS"
    printf '%s\n' "$SANDBOX_STACK"
  } | shasum | cut -c1-40
}

sandbox_run_args() {
  printf '%s\n' \
    --name "$SANDBOX_NAME" \
    --label "sandbox.project=$SANDBOX_PROJECT" \
    --label "sandbox.config-fp=$(sandbox_config_fingerprint 2>/dev/null || true)" \
    -w /workspace \
    --add-host "host.docker.internal:host-gateway"
  sandbox_mount_args
  sandbox_port_args
  sandbox_env_args
}
