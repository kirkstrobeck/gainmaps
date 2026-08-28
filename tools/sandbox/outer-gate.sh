#!/usr/bin/env bash
# PreToolUse hook for Bash. Wired in .claude/settings.json.
#
# THE RULE THIS ENFORCES: the outer agent never does the work. It relays. The
# work happens inside the container, where permissions are off on purpose.
#
# Asking an agent nicely, in a prompt, to always dispatch instead of running
# things itself does not hold. It holds for a while, and then a plausible little
# command shows up — just checking the branch, just a quick install — and the
# boundary is gone with nothing to stop it. This hook is the mechanical version
# of that instruction, and mechanical is the only kind that survives.
#
# Default is DENY. The allowlist below is small on purpose: it covers the
# commands needed to observe and repair the sandbox itself, and nothing that can
# change the repo, install anything, or reach the network.

set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd -P)"
# shellcheck source=gate-lib.sh
. "$SCRIPT_DIR/gate-lib.sh"

gate_bypass_if_inner

payload="$(gate_read_payload)"
# Claude payload: .tool_input.command; Cursor beforeShellExecution: .command at top level.
cmd="$(printf '%s' "$payload" | jq -r '.tool_input.command // .command // ""' 2>/dev/null)"
[ -z "$cmd" ] && allow "no command to evaluate"

# Leading VAR=value assignments are not the command. Strip them so
# `FOO=1 git push` is judged as `git push`, not as an unknown token.
stripped="$(printf '%s' "$cmd" | sed -E 's/^[[:space:]]*([A-Za-z_][A-Za-z0-9_]*=[^[:space:]]*[[:space:]]+)*//')"
first="$(printf '%s' "$stripped" | awk 'NR==1{print $1; exit}')"

# Chaining check runs against the skeleton, never the raw string — see
# skeleton.awk. If the skeleton can't be produced, fall back to the raw text,
# which errs toward "chained" and therefore toward denying.
skeleton="$(printf '%s' "$stripped" | awk -f "$SCRIPT_DIR/skeleton.awk" 2>/dev/null)"
[ -z "$skeleton" ] && skeleton="$stripped"

chained=0
case "$skeleton" in
  *';'*|*'&&'*|*'||'*|*'|'*|*'`'*|*'$('*|*'
'*) chained=1 ;;
esac

allow_unchained() {
  [ "$chained" = 0 ] && allow "$1"
}

# Named denials come first so the human-facing reason explains the actual rule
# instead of a generic refusal.
case "$first" in
  git|gh|hub)
    deny "Version control belongs to the inner agent, which has the bridged GitHub token. $DISPATCH_MSG" ;;
  npm|pnpm|yarn|bun|npx|node|deno|tsx|make|cargo|go|python|python3|pip|pip3|uv|poetry|rake|mvn|gradle)
    deny "Toolchain commands run inside the sandbox, against the container's own dependency tree. $DISPATCH_MSG" ;;
  rm|mv|cp|chmod|chown|ln|dd|mkfs|shutdown|reboot)
    deny "Filesystem mutation on the host is never the outer agent's job. $DISPATCH_MSG" ;;
  ssh|scp|rsync|wget|nc|ncat|telnet)
    deny "Network access belongs to the inner agent. $DISPATCH_MSG" ;;
esac

# --- Project deny hooks (evaluated before every allow) ----------------------
# ORDER (must not be changed without updating this comment):
#   1. gate_bypass_if_inner — inner must still run fleet scripts
#   2. Named harness denials above (git/pnpm/rm/ssh) — so their reasons stay
#   3. SANDBOX_EXTRA_DENY globs (this block) — before every allow branch
#   4. outer-gate-deny.d hooks (this block) — project *.sh, survive updates
#   5. All allow branches below (bash tools/sandbox/*, ./sandbox, docker, …)
#   extra-allow cannot override extra-deny.

# SANDBOX_EXTRA_DENY: project globs evaluated before allow branches.
if gate_extra_deny_matches "$stripped"; then
  deny "project deny rule matched. $DISPATCH_MSG"
fi

# outer-gate-deny.d: source every *.sh and call outer_gate_deny_* functions.
# Fail-open: a syntax-error or source-error file is skipped, not fatal.
# doctor.sh surfaces skipped files as warnings.
_ogdeny_d="$SCRIPT_DIR/outer-gate-deny.d"
if [ -d "$_ogdeny_d" ]; then
  _ogdeny_called=""
  for _ogdeny_f in "$_ogdeny_d"/*.sh; do
    [ -f "$_ogdeny_f" ] || continue
    bash -n "$_ogdeny_f" >/dev/null 2>&1 || continue
    . "$_ogdeny_f" 2>/dev/null || continue
    while IFS= read -r _ogdeny_fn; do
      [ -z "$_ogdeny_fn" ] && continue
      case " $_ogdeny_called " in *" $_ogdeny_fn "*) continue ;; esac
      _ogdeny_called="$_ogdeny_called $_ogdeny_fn"
      "$_ogdeny_fn" "$stripped" 2>/dev/null || true
    done <<OGDENYFNS
$(declare -F | awk '$3 ~ /^outer_gate_deny_/ {print $3}')
OGDENYFNS
  done
fi

# --- Allowed: driving and inspecting the sandbox itself ---------------------
case "$stripped" in
  bash\ "$SCRIPT_DIR"/*|bash\ tools/sandbox/*|./tools/sandbox/*)
    allow_unchained "sandbox harness command" ;;
  bash\ -n\ tools/sandbox/*)
    allow_unchained "syntax check of a sandbox script" ;;
  # The CLI wrapper is the intended door. Every verb behind it drives the
  # container or dispatches into it, with one deliberate exception: `update`
  # replaces tools/sandbox with a newer copy from upstream. That is a harness
  # operation, not project work — it touches no file the project owns, and the
  # result is a reviewable diff — so it stays on this side of the line.
  ./sandbox|./sandbox\ *|bash\ ./sandbox\ *|bash\ sandbox\ *)
    allow_unchained "sandbox CLI" ;;
esac

# --- Allowed: read-only Docker and Colima introspection ---------------------
case "$stripped" in
  docker\ ps*|docker\ inspect*|docker\ logs*|docker\ info*|docker\ version*|\
  docker\ image\ inspect*|docker\ image\ ls*|docker\ volume\ ls*|docker\ volume\ inspect*)
    allow_unchained "read-only docker inspection" ;;
esac

# Lifecycle verbs are allowed only against this project's own containers, so a
# stray `docker rm -f` can't take out something else running on the machine.
case "$stripped" in
  docker\ exec*sandbox*|docker\ restart*sandbox*|docker\ start*sandbox*|\
  docker\ stop*sandbox*|docker\ rm*sandbox*)
    allow_unchained "lifecycle command scoped to a sandbox container" ;;
esac

# --- Allowed: reading sandbox config and docs on the host -------------------
case "$stripped" in
  cat\ .claude/*|cat\ tools/sandbox/*|cat\ AGENTS.md*|cat\ README.md*|\
  ls\ .claude*|ls\ tools/sandbox*|ls\ .cursor*)
    allow_unchained "reading sandbox configuration" ;;
esac

# --- Allowed: harmless first tokens ----------------------------------------
case "$first" in
  pwd|echo|printf|jq|open|lsof|colima|realpath|readlink|basename|dirname|\
  date|whoami|id|uname|which|command|sleep|true)
    allow_unchained "read-only host command" ;;
esac

# curl is allowed for exactly one thing: checking whether the dev server the
# container published is actually answering on the Mac. Every URL in the command
# must be loopback, or it is a network fetch and belongs to inner.
if [ "$first" = "curl" ]; then
  urls="$(printf '%s' "$stripped" | grep -oE '[a-zA-Z][a-zA-Z0-9+.-]*://[^[:space:]"'"'"']+' || true)"
  if [ "$chained" = 0 ] && [ -n "$urls" ] &&
     ! printf '%s\n' "$urls" | grep -qvE '^https?://(127\.0\.0\.1|localhost|\[::1\])(:[0-9]+)?([/?#]|$)'; then
    allow "loopback reachability check"
  fi
  deny "curl to a non-loopback address belongs to the inner agent. $DISPATCH_MSG"
fi

# After named denials, never before: a project cannot hand outer back git/pnpm/rm.
if gate_extra_allow_matches "$stripped"; then
  allow_unchained "project extra allow"
fi

deny "$DISPATCH_MSG"
