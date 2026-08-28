#!/usr/bin/env bash
# Check the host before anything expensive happens.
#
# Every failure here has one specific fix, so the check prints the fix rather
# than the symptom. Nothing in this file changes the project — the only write is
# the update-check stamp under .cache/, which is run state.
#
# FAIL is reserved for things that actually stop a run: no Docker, no jq, or
# credentials that could leak into a commit. Everything the sandbox can start
# without — git on the host, a git repo at all, colima, an agent login — is a
# warn, because an empty project directory is a supported place to work.

set -uo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd -P)"
# shellcheck source=common.sh
. "$SCRIPT_DIR/common.sh"
# shellcheck source=run-args.sh
. "$SCRIPT_DIR/run-args.sh"
# shellcheck source=colima.sh
. "$SCRIPT_DIR/colima.sh"
# shellcheck source=credential-expiry.sh
. "$SCRIPT_DIR/credential-expiry.sh"

fails=0
ok()   { printf '  ok    %s\n' "$*"; }
warn() { printf '  warn  %s\n' "$*"; }
bad()  { printf '  FAIL  %s\n' "$*"; fails=$((fails + 1)); }

echo "host"
for tool in jq docker; do
  command -v "$tool" >/dev/null 2>&1 && ok "$tool" || bad "$tool missing — brew install $tool"
done
# git on the host is only used to copy your commit identity into the container
# and to bridge a gh token. Without it the sandbox still runs.
command -v git >/dev/null 2>&1 && ok "git" \
  || warn "git missing — brew install git (only needed to push from inside the sandbox)"
command -v colima >/dev/null 2>&1 && ok "colima" \
  || warn "colima missing — brew install colima (or use another Docker daemon)"

echo "docker daemon"
sandbox_docker_host
if docker info >/dev/null 2>&1; then
  ok "reachable at ${DOCKER_HOST:-default socket}"
  colima_inotify_daemon_running \
    && warn "colima --inotify daemon is running; boot.sh will stop it (it storms the guest)" \
    || ok "no colima inotify daemon"
else
  bad "not reachable — colima start $(colima_start_flags)"
fi

_doctor_expiry() {
  local service="$1"
  local exp hours_left at now
  exp="$(credential_expiry_epoch "$service")"
  [ -z "$exp" ] && return
  now="$(date +%s)"
  at="$(_ce_format_epoch "$exp")"
  if [ "$((exp - now))" -le 0 ]; then
    warn "$(_ce_service_label "$service") credential EXPIRED ($at) — $(_ce_fix_message "$service")"
  else
    hours_left=$(( (exp - now + 3599) / 3600 ))
    local warn_h
    warn_h="$(credential_expiry_warn_hours)"
    if [ "$hours_left" -le "$warn_h" ]; then
      warn "$(_ce_service_label "$service") credential expires in ~${hours_left}h ($at) — $(_ce_fix_message "$service")"
    else
      ok "$(_ce_service_label "$service") credential expires in ~${hours_left}h ($at)"
    fi
  fi
}
echo "credentials"
if security find-generic-password -s "Claude Code-credentials" -w >/dev/null 2>&1; then
  ok "Claude Code (macOS Keychain)"
else
  warn "no Claude credential — run 'claude' on the Mac and sign in"
fi
_doctor_expiry claude
[ -f "$HOME/.codex/auth.json" ] && ok "Codex (~/.codex/auth.json)" \
  || warn "no Codex credential — run 'codex login' on the Mac"
_doctor_expiry codex
if [ -n "${CURSOR_API_KEY:-}" ]; then
  ok "Cursor (CURSOR_API_KEY in the environment)"
elif security find-generic-password -s "cursor-access-token" -a "cursor-user" -w >/dev/null 2>&1; then
  ok "Cursor (macOS Keychain)"
elif [ -f "$HOME/.cursor/auth.json" ]; then
  ok "Cursor (~/.cursor/auth.json)"
else
  warn "no Cursor credential — run 'agent login' on the Mac, or export CURSOR_API_KEY"
fi
_doctor_expiry cursor
if [ -n "${GH_TOKEN:-${GITHUB_TOKEN:-}}" ] || gh auth token >/dev/null 2>&1; then
  ok "GitHub token available (git push will work inside the sandbox)"
  ok "Copilot (reuses GitHub token)"
else
  warn "no GitHub token — run 'gh auth login' if the inner agent needs to push"
  warn "no Copilot credential — Copilot reuses the GitHub token; run 'gh auth login'"
fi
_doctor_expiry github
if [ -n "${AGY_API_KEY:-${GEMINI_API_KEY:-}}" ]; then
  ok "agy / Antigravity (AGY_API_KEY or GEMINI_API_KEY in environment)"
elif [ -d "$HOME/.gemini" ] && [ -n "$(ls -A "$HOME/.gemini" 2>/dev/null)" ]; then
  ok "agy / Antigravity (~/.gemini directory)"
else
  warn "no agy credential — set AGY_API_KEY (or GEMINI_API_KEY) or run 'agy auth'"
fi
if [ -n "${AMP_API_KEY:-}" ]; then
  ok "Amp (AMP_API_KEY in environment)"
elif [ -f "${XDG_CONFIG_HOME:-$HOME/.config}/amp/auth.json" ] || [ -f "$HOME/.amp/auth.json" ]; then
  ok "Amp (auth.json present)"
else
  warn "no Amp credential — set AMP_API_KEY or run 'amp auth login'"
fi
if [ -d "${XDG_CONFIG_HOME:-$HOME/.config}/opencode" ] && \
   [ -n "$(ls -A "${XDG_CONFIG_HOME:-$HOME/.config}/opencode" 2>/dev/null)" ]; then
  ok "OpenCode (~/.config/opencode config present)"
else
  warn "no OpenCode config — add provider keys to ~/.config/opencode/config.json"
fi

echo "project"
if command -v git >/dev/null 2>&1 && git -C "$REPO_ROOT" rev-parse --git-dir >/dev/null 2>&1; then
  ok "git repo at $REPO_ROOT"
else
  warn "not a git repo at $REPO_ROOT — fine; the sandbox mounts the directory either way"
fi
# Stays a FAIL even with no git repo. The line costs nothing now, and the day
# someone runs 'git init' here it is the difference between a gitignored token
# and a committed one.
grep -qs 'tools/sandbox/.cache' "$REPO_ROOT/.gitignore" \
  && ok ".cache is gitignored" \
  || bad ".cache is NOT gitignored — it holds credentials. Add tools/sandbox/.cache/ to $REPO_ROOT/.gitignore"

if [ -f "$REPO_ROOT/.git" ]; then
  common="$(sandbox_git_common_dir 2>/dev/null || true)"
  gitdir_line="$(head -1 "$REPO_ROOT/.git" 2>/dev/null || true)"
  gitdir="${gitdir_line#gitdir:}"
  gitdir="$(sandbox_trim "$gitdir")"
  if [ -z "$common" ]; then
    bad "linked worktree: .git points at a gitdir boot cannot mount ($gitdir). Git inside the container will fail."
  elif [ ! -d "$common" ]; then
    bad "linked worktree: common dir $common is not a directory on the host"
  else
    ok "linked worktree; boot will bind $common"
  fi
fi

echo "disk"
df_m=""
if command -v colima >/dev/null 2>&1; then
  df_m="$(colima ssh -- df -m / 2>/dev/null | awk 'NR==2{print $4}' || true)"
fi
if [ -z "$df_m" ]; then
  df_m="$(df -m / 2>/dev/null | awk 'NR==2{print $4}' || true)"
fi
case "$df_m" in
  ''|*[!0-9]*) warn "could not read Docker/VM free space" ;;
  *)
    if [ "$df_m" -lt 5120 ]; then
      warn "Docker filesystem has ${df_m}M free — an image rebuild or pnpm install needs multiple GB"
    else
      ok "Docker filesystem has ${df_m}M free"
    fi
    ;;
esac

echo "harness"
# The manifest is what an upgrade deletes by. A `replace` path it claims but the
# project does not have means the last install was interrupted or somebody
# removed a harness file by hand, and either way the next update's change report
# will be wrong about it. Warn, never fail: the sandbox still runs.
if [ -r "$SCRIPT_DIR/MANIFEST" ]; then
  # shellcheck source=manifest.sh
  . "$SCRIPT_DIR/manifest.sh"
  if absent="$(manifest_missing_sources "$REPO_ROOT" "$SCRIPT_DIR/MANIFEST")"; then
    ok "manifest v$(manifest_version "$SCRIPT_DIR/MANIFEST") — every owned path is present"
  else
    warn "manifest lists paths this project does not have — re-run './sandbox update':"
    printf '        %s\n' $absent
  fi
else
  warn "no tools/sandbox/MANIFEST — installed before it existed. './sandbox update' writes one"
fi
# Where tools/sandbox came from, and whether it has moved since. Doctor is the
# one place a synchronous network call is appropriate — you asked for a report —
# so this checks now rather than reading the cached answer boot.sh uses. Never a
# FAIL: an old harness runs fine, and so does one that cannot reach github.com.
if [ -f "$SCRIPT_DIR/ORIGIN.md" ]; then
  ok "installed from $(sed -n 's/^[[:space:]]*SANDBOX_ORIGIN_URL=//p' "$SCRIPT_DIR/ORIGIN.md" | head -1)"
  update_status="$(bash "$SCRIPT_DIR/update.sh" --check 2>&1)"
  case "$update_status" in
    "up to date"*) ok "$update_status" ;;
    *)             warn "$update_status" ;;
  esac
elif [ -f "$REPO_ROOT/install.sh" ]; then
  # install.sh at the root: this is the sandbox repo itself, where tools/sandbox
  # is the working copy rather than something installed. Nothing to check.
  ok "this is the sandbox source repo — tools/sandbox is the working copy"
else
  warn "no tools/sandbox/ORIGIN.md — installed before it existed. './sandbox update' writes one"
fi

echo "gates"
if [ -f "$REPO_ROOT/.claude/settings.json" ] &&
   grep -q 'outer-gate.sh' "$REPO_ROOT/.claude/settings.json" 2>/dev/null; then
  ok "PreToolUse hooks wired in .claude/settings.json"
else
  warn "Claude hooks not wired — the outer agent can still act on the host"
fi
if [ -f "$REPO_ROOT/.cursor/hooks.json" ] &&
   grep -q 'sandbox-shell' "$REPO_ROOT/.cursor/hooks.json" 2>/dev/null; then
  ok "beforeShellExecution wired in .cursor/hooks.json"
else
  warn "Cursor hooks not wired in .cursor/hooks.json — Cursor outer agent is not enforced"
fi

# Warn about deny.d files with syntax errors (they are silently skipped by the gate).
for _doctor_deny_d in \
    "$REPO_ROOT/tools/sandbox/outer-gate-deny.d" \
    "$REPO_ROOT/tools/sandbox/outer-write-gate-deny.d"; do
  [ -d "$_doctor_deny_d" ] || continue
  for _doctor_deny_f in "$_doctor_deny_d"/*.sh; do
    [ -f "$_doctor_deny_f" ] || continue
    if ! bash -n "$_doctor_deny_f" >/dev/null 2>&1; then
      warn "deny.d file has syntax error (skipped by gate): $_doctor_deny_f"
    fi
  done
done

echo
[ "$fails" -eq 0 ] && { echo "Ready. Run: ./sandbox \"hello\""; exit 0; }
echo "$fails blocking problem(s) above."
exit 1
