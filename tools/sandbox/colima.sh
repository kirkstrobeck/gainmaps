#!/usr/bin/env bash
# Colima VM flags + mount-inotify teardown for the sandbox. Source from boot.sh.
#
# vz + virtiofs stay: they are what make the bind mount fast enough to work in.
# --mount-inotify does NOT. That daemon delivers a host save to the guest by
# chmod'ing the matching guest file, and a chmod is a metadata write that
# propagates straight back out to macOS, where it looks like another host
# change. Paired with any host-side bridge doing the same trick with contents,
# the two sustain an event storm with nobody typing — measured, in the setup
# this starter is generalized from, at 34 inotify events in a 15s window on a
# file nobody had touched.
#
# mac-save-bridge.mjs manufactures that event instead, from INSIDE the guest,
# where the rewrite cannot propagate back out to macOS and restart the cycle.
# See mac-save-bridge.mjs for why polling there beats a framework poll option.

colima_start_flags() {
  printf '%s\n' --vm-type vz --mount-type virtiofs
}

colima_inotify_daemon_running() {
  ps -axo args= | grep -q '[c]olima daemon start.*--inotify'
}

# A stop, not a start. A machine that booted Colima with --mount-inotify still
# has the daemon running, and it keeps injecting until something stops it — so
# boot.sh clearing it is what makes the fix survive into an already-running VM.
stop_colima_inotify() {
  if sandbox_stamp_fresh "$CACHE_DIR/stamps/.inotify-checked" 3600; then
    return 0
  fi
  mkdir -p "$CACHE_DIR/stamps"
  touch "$CACHE_DIR/stamps/.inotify-checked"
  if ! command -v colima >/dev/null 2>&1; then
    return 0
  fi
  if ! colima status >/dev/null 2>&1; then
    return 0
  fi
  if ! colima_inotify_daemon_running; then
    return 0
  fi

  echo "Stopping Colima mount-inotify daemon (mac-save-bridge replaces it)..." >&2
  colima daemon stop "${COLIMA_PROFILE:-default}" >/dev/null 2>&1 || true
}

ensure_colima() {
  if sandbox_stamp_fresh "$CACHE_DIR/stamps/.colima-ok" 60; then
    return 0
  fi
  if ! command -v colima >/dev/null 2>&1; then
    return 0
  fi
  if colima status >/dev/null 2>&1; then
    mkdir -p "$CACHE_DIR/stamps"
    touch "$CACHE_DIR/stamps/.colima-ok"
    return 0
  fi
  echo "Starting Colima..." >&2
  # shellcheck disable=SC2046
  colima start $(colima_start_flags) >&2
  mkdir -p "$CACHE_DIR/stamps"
  touch "$CACHE_DIR/stamps/.colima-ok"
}
