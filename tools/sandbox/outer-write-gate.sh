#!/usr/bin/env bash
# PreToolUse hook for Edit|Write|MultiEdit|NotebookEdit. Wired in
# .claude/settings.json alongside outer-gate.sh.
#
# WHY THIS EXISTS: blocking Bash is only half the boundary. An outer agent that
# is denied every shell path into the repo will reach for the Edit tool instead
# — no hook, no prompt, a source file on the Mac quietly hand-edited — and the
# only thing standing in the way is a human noticing the tool call and saying
# no. That is not a control. This makes it mechanical.
#
# Default is DENY for every path. The exceptions are the two places the outer
# agent legitimately owns: its own Claude Code configuration, and this harness.

set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd -P)"
# shellcheck source=gate-lib.sh
. "$SCRIPT_DIR/gate-lib.sh"

gate_bypass_if_inner

# Collapse . and .. lexically, BEFORE touching the filesystem. Doing it with the
# filesystem first lets `.claude/../src/app.ts` resolve through an allowed
# prefix and land somewhere it shouldn't.
gate_normalize() {
  local path="$1" out="" part
  set -f
  local IFS=/
  # shellcheck disable=SC2086
  for part in $path; do
    case "$part" in
      ''|.) continue ;;
      ..) out="${out%/*}" ;;
      *) out="$out/$part" ;;
    esac
  done
  set +f
  printf '%s' "${out:-/}"
}

# Resolve to a real path even when the file does not exist yet — a Write to a
# not-yet-created file still needs judging. Walk up to the deepest existing
# directory, resolve that physically, then re-attach the tail.
gate_resolve() {
  local path="$1"
  case "$path" in
    /*) : ;;
    *) path="$PWD/$path" ;;
  esac
  path="$(gate_normalize "$path")"

  local head="$path" tail=""
  while [ ! -d "$head" ] && [ "$head" != "/" ] && [ -n "$head" ]; do
    tail="${head##*/}${tail:+/$tail}"
    head="${head%/*}"
    [ -z "$head" ] && head="/"
  done

  local real
  real="$(cd "$head" 2>/dev/null && pwd -P)" || real="$head"
  [ -n "$tail" ] && real="$real/$tail"

  # Follow a symlinked leaf: a link inside an allowed directory pointing at a
  # source file outside it would otherwise sail straight through. Bounded,
  # because a symlink loop must not hang the hook.
  local hops=0
  while [ -L "$real" ] && [ "$hops" -lt 8 ]; do
    local target
    target="$(readlink "$real")" || break
    case "$target" in
      /*) : ;;
      *) target="${real%/*}/$target" ;;
    esac
    real="$(gate_normalize "$target")"
    hops=$((hops + 1))
  done

  printf '%s' "$real"
}

# The outer agent's own state — session files, settings, scratch — is not
# project code and blocking it would break the client itself.
gate_is_outer_state() {
  case "$1/" in
    "${HOME:-/nonexistent}/.claude/"*) return 0 ;;
    /private/tmp/claude-*/*|/tmp/claude-*/*) return 0 ;;
  esac
  return 1
}

gate_is_allowed() {
  local p="$1"
  gate_is_outer_state "$p" && return 0
  # Credentials are never readable or writable from the outer side, even though
  # the broader tools/sandbox/ prefix is allowed for harness files.
  case "$p/" in
    "$PROJECT_ROOT/tools/sandbox/.cache/"*) return 1 ;;
  esac
  case "$p/" in
    "$PROJECT_ROOT/.claude/"*) return 0 ;;
    "$PROJECT_ROOT/.cursor/"*) return 0 ;;
    "$PROJECT_ROOT/tools/sandbox/"*) return 0 ;;
  esac
  # Exact matches, not prefixes: the CLI wrapper and the outer agent's own
  # instruction file are harness, but a file merely starting with those names
  # (sandbox.ts, AGENTS.md.bak) is ordinary project code.
  case "$p" in
    "$PROJECT_ROOT/sandbox"|"$PROJECT_ROOT/AGENTS.md"|"$PROJECT_ROOT/CLAUDE.md") return 0 ;;
  esac
  return 1
}

payload="$(gate_read_payload)"
tool="$(printf '%s' "$payload" | jq -r '.tool_name // "edit"' 2>/dev/null)"

# Every shape these tools use to name a target, in one expression. A new field
# added upstream shows up as "no paths found", which denies — the safe way for
# this particular gate to be wrong.
paths="$(printf '%s' "$payload" | jq -r '
  [ .tool_input.file_path?,
    .tool_input.notebook_path?,
    (.tool_input.edits? // [] | .[]? | .file_path?),
    .file_path? ]
  | map(select(type == "string" and length > 0)) | .[]' 2>/dev/null)"

if [ -z "$paths" ]; then
  deny "Could not read a file path from this $tool call, so it cannot be judged. $DISPATCH_MSG"
fi

# Load project write-gate deny hooks once before iterating paths.
# ORDER: after gate_bypass_if_inner; before gate_is_allowed allows anything.
# A project can deny a path the harness would allow. inner always bypasses first.
# Fail-open: syntax-error or source-error files are skipped (doctor.sh warns).
_wgdeny_d="$SCRIPT_DIR/outer-write-gate-deny.d"
if [ -d "$_wgdeny_d" ]; then
  for _wgdeny_f in "$_wgdeny_d"/*.sh; do
    [ -f "$_wgdeny_f" ] || continue
    bash -n "$_wgdeny_f" >/dev/null 2>&1 || continue
    . "$_wgdeny_f" 2>/dev/null || continue
  done
fi

while IFS= read -r raw; do
  [ -z "$raw" ] && continue
  resolved="$(gate_resolve "$raw")"
  # Run project write-gate deny hooks before harness allowlist.
  if [ -d "$_wgdeny_d" ]; then
    while IFS= read -r _wgdeny_fn; do
      [ -z "$_wgdeny_fn" ] && continue
      "$_wgdeny_fn" "$resolved" 2>/dev/null || true
    done <<WGDENYFNS
$(declare -F | awk '$3 ~ /^outer_write_gate_deny_/ {print $3}')
WGDENYFNS
  fi
  if ! gate_is_allowed "$resolved"; then
    deny "Editing $resolved on the host is the inner agent's job. $DISPATCH_MSG"
  fi
done <<EOF
$paths
EOF

allow "target is sandbox harness or agent configuration"
