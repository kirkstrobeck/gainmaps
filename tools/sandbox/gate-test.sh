#!/usr/bin/env bash
# Tests for the two PreToolUse gates. Run: bash tools/sandbox/gate-test.sh
#
# These gates are the only mechanical thing keeping the outer agent off the
# host, so "it looked right" is not good enough. Every case below is a decision
# the gates have to keep making after someone edits them.
#
# SANDBOX_GATE_FORCE makes the gates evaluate their rules even when the test
# happens to run inside a container.

set -uo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd -P)"
export SANDBOX_GATE_FORCE=1
export PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd -P)"

pass=0
fail=0

decision_of() {
  printf '%s' "$1" | jq -r '.hookSpecificOutput.permissionDecision // "ERROR"' 2>/dev/null
}

cursor_decision_of() {
  printf '%s' "$1" | jq -r '.permission // "ERROR"' 2>/dev/null
}

cursor_shell_case() {
  local expected="$1" cmd="$2"
  local out
  out="$(jq -nc --arg c "$cmd" '{command:$c}' |
    GATE_PROTOCOL=cursor bash "$SCRIPT_DIR/outer-gate.sh" 2>/dev/null)"
  check "cursor shell: $cmd" "$expected" "$(cursor_decision_of "$out")"
}

cursor_write_case() {
  local expected="$1" path="$2"
  local out
  out="$(jq -nc --arg p "$path" '{tool_input:{file_path:$p}}' |
    GATE_PROTOCOL=cursor bash "$SCRIPT_DIR/outer-write-gate.sh" 2>/dev/null)"
  check "cursor write: $path" "$expected" "$(cursor_decision_of "$out")"
}

cursor_read_case() {
  local expected="$1" path="$2"
  local out
  out="$(jq -nc --arg p "$path" '{file_path:$p}' |
    GATE_PROTOCOL=cursor bash "$PROJECT_ROOT/.cursor/hooks/sandbox-read.sh" 2>/dev/null)"
  check "cursor read: $path" "$expected" "$(cursor_decision_of "$out")"
}

check() {
  local label="$1" expected="$2" actual="$3"
  if [ "$expected" = "$actual" ]; then
    pass=$((pass + 1))
    printf '  ok   %-58s %s\n' "$label" "$actual"
    return 0
  fi
  fail=$((fail + 1))
  printf '  FAIL %-58s expected %s, got %s\n' "$label" "$expected" "$actual"
}

bash_case() {
  local expected="$1" cmd="$2"
  local out
  out="$(jq -nc --arg c "$cmd" '{tool_name:"Bash",tool_input:{command:$c}}' |
    bash "$SCRIPT_DIR/outer-gate.sh" 2>/dev/null)"
  check "bash: $cmd" "$expected" "$(decision_of "$out")"
}

write_case() {
  local expected="$1" path="$2"
  local out
  out="$(jq -nc --arg p "$path" '{tool_name:"Edit",tool_input:{file_path:$p}}' |
    bash "$SCRIPT_DIR/outer-write-gate.sh" 2>/dev/null)"
  check "edit: $path" "$expected" "$(decision_of "$out")"
}

echo "Bash gate — the work belongs to inner"
bash_case deny  'git status'
bash_case deny  'git push origin main'
bash_case deny  'gh pr create --fill'
bash_case deny  'pnpm install'
bash_case deny  'npm run build'
bash_case deny  'node scripts/seed.js'
bash_case deny  'rm -rf build'
bash_case deny  'curl https://example.com'
bash_case deny  'ssh deploy@host'
bash_case deny  'cat src/app.ts'
bash_case deny  'GIT_DIR=.git git log'

echo
echo "Bash gate — driving and observing the sandbox is allowed"
bash_case allow 'bash tools/sandbox/dispatch.sh "fix the header"'
bash_case allow 'bash tools/sandbox/boot.sh'
bash_case allow './sandbox "fix the header"'
bash_case allow './sandbox -c "now add a test"'
bash_case allow './sandbox -a cursor "fix the header"'
bash_case allow './sandbox -m gpt-5 "fix the header"'
bash_case allow './sandbox run pnpm test'
bash_case allow './sandbox status'
# The deliberate exception: `update` writes to tools/sandbox on the host. It is
# a harness operation with a reviewable diff, and the CLI is the door for it.
bash_case allow './sandbox update'
bash_case allow './sandbox update --check'
bash_case allow 'bash -n tools/sandbox/boot.sh'
bash_case allow 'docker ps'
bash_case allow 'docker logs my-sandbox-1234abcd'
bash_case allow 'docker restart my-sandbox-1234abcd'
bash_case allow 'cat tools/sandbox/sandbox.conf'
bash_case allow 'ls .claude/skills'
bash_case allow 'pwd'
bash_case allow 'colima status'
bash_case allow 'curl -sS http://localhost:3000/'
bash_case allow 'curl -I http://127.0.0.1:3000/health'

echo
echo "Bash gate — chaining cannot smuggle a denied command past an allowed one"
bash_case deny  'pwd && git push'
bash_case deny  'docker ps; rm -rf /'
bash_case deny  'echo $(git rev-parse HEAD)'
bash_case deny  'echo `whoami`'
bash_case deny  'bash tools/sandbox/boot.sh | tee /tmp/out'
bash_case deny  './sandbox up && git push'
bash_case deny  'curl http://localhost:3000 && curl https://evil.example'

echo
echo "Bash gate — quoted operators are text, not chaining"
bash_case allow 'bash tools/sandbox/dispatch.sh "commit this; then push"'
bash_case allow "bash tools/sandbox/dispatch.sh 'fix a && b in the parser'"
# An unterminated quote is input we cannot parse, so it reads as chained.
bash_case deny  'bash tools/sandbox/dispatch.sh "oops'

echo
echo "Write gate — host source files are off limits"
write_case deny  "$PROJECT_ROOT/src/app.ts"
write_case deny  "$PROJECT_ROOT/package.json"
write_case deny  "$PROJECT_ROOT/README.md"
write_case deny  "/etc/hosts"
# The whole point of normalizing before resolving: an allowed prefix must not
# be usable as a launchpad into the rest of the repo.
write_case deny  "$PROJECT_ROOT/.claude/../src/app.ts"
write_case deny  "$PROJECT_ROOT/tools/sandbox/../../src/app.ts"

echo
echo "Write gate — the harness and agent config are the outer agent's own"
write_case allow "$PROJECT_ROOT/.claude/settings.json"
write_case allow "$PROJECT_ROOT/.claude/skills/sandbox/SKILL.md"
write_case allow "$PROJECT_ROOT/.cursor/rules/sandbox.mdc"
write_case allow "$PROJECT_ROOT/tools/sandbox/sandbox.conf"
write_case allow "$PROJECT_ROOT/sandbox"
write_case allow "$PROJECT_ROOT/AGENTS.md"
write_case allow "$PROJECT_ROOT/CLAUDE.md"
write_case allow "$HOME/.claude/settings.json"
# The exact-match rule has to stay exact.
write_case deny  "$PROJECT_ROOT/sandbox.ts"
write_case deny  "$PROJECT_ROOT/AGENTS.md.bak"

echo
echo "Write gate — a call with no readable path is denied, not waved through"
no_path="$(jq -nc '{tool_name:"Edit",tool_input:{}}' | bash "$SCRIPT_DIR/outer-write-gate.sh" 2>/dev/null)"
check "edit: (no file_path)" deny "$(decision_of "$no_path")"

multi="$(jq -nc --arg a "$PROJECT_ROOT/.claude/x.md" --arg b "$PROJECT_ROOT/src/app.ts" \
  '{tool_name:"MultiEdit",tool_input:{edits:[{file_path:$a},{file_path:$b}]}}' |
  bash "$SCRIPT_DIR/outer-write-gate.sh" 2>/dev/null)"
check "multiedit: one allowed + one denied" deny "$(decision_of "$multi")"

echo
echo "Inside the sandbox the gates stand down"
inner="$(SANDBOX_GATE_FORCE= SANDBOX_INNER=1 bash -c \
  'jq -nc "{tool_name:\"Bash\",tool_input:{command:\"git push\"}}" | bash "$0"' \
  "$SCRIPT_DIR/outer-gate.sh" 2>/dev/null)"
check "bash: git push (SANDBOX_INNER=1)" allow "$(decision_of "$inner")"

echo
echo "Cursor protocol — GATE_PROTOCOL=cursor emits {permission, user_message, agent_message}"
cursor_shell_case deny  'git status'
cursor_shell_case allow './sandbox "x"'
cursor_write_case deny  "$PROJECT_ROOT/src/app.ts"
cursor_write_case allow "$PROJECT_ROOT/tools/sandbox/foo.sh"
cursor_read_case  deny  "$PROJECT_ROOT/tools/sandbox/.cache/x"
cursor_read_case  allow "$PROJECT_ROOT/docs/agents.md"
cursor_read_case  allow "$PROJECT_ROOT/src/app.ts"
inner_cursor="$(SANDBOX_GATE_FORCE= SANDBOX_INNER=1 bash -c \
  'jq -nc "{command:\"git status\"}" | GATE_PROTOCOL=cursor bash "$0"' \
  "$SCRIPT_DIR/outer-gate.sh" 2>/dev/null)"
check "cursor shell: git status (SANDBOX_INNER=1)" allow "$(cursor_decision_of "$inner_cursor")"

echo
echo "Write gate — .cache is denied even though tools/sandbox/ is broadly allowed"
write_case deny  "$PROJECT_ROOT/tools/sandbox/.cache/credentials.json"
write_case deny  "$PROJECT_ROOT/tools/sandbox/.cache/stamps/anything"

echo
echo "Bash gate — project extra allow is after named denials"
# Control: deny with no extra-allow in scope. Unset to prevent any SANDBOX_EXTRA_ALLOW
# set in the environment (e.g. from sandbox.conf loaded by the test runner) from leaking in.
out_deny_ctrl="$(jq -nc --arg c 'bash tools/dev-start.sh --foo' \
  '{tool_name:"Bash",tool_input:{command:$c}}' |
  SANDBOX_EXTRA_ALLOW='' bash "$SCRIPT_DIR/outer-gate.sh" 2>/dev/null)"
check "bash: dev-start.sh denied without extra-allow" deny "$(decision_of "$out_deny_ctrl")"
out="$(jq -nc --arg c 'bash tools/dev-start.sh --foo' \
  '{tool_name:"Bash",tool_input:{command:$c}}' |
  SANDBOX_EXTRA_ALLOW='bash tools/dev-start.sh*' bash "$SCRIPT_DIR/outer-gate.sh" 2>/dev/null)"
check "bash: extra-allow project script" allow "$(decision_of "$out")"
out="$(jq -nc --arg c 'git status' \
  '{tool_name:"Bash",tool_input:{command:$c}}' |
  SANDBOX_EXTRA_ALLOW='git*' bash "$SCRIPT_DIR/outer-gate.sh" 2>/dev/null)"
check "bash: extra-allow cannot grant git" deny "$(decision_of "$out")"
out="$(jq -nc --arg c 'pnpm install' \
  '{tool_name:"Bash",tool_input:{command:$c}}' |
  SANDBOX_EXTRA_ALLOW='pnpm *' bash "$SCRIPT_DIR/outer-gate.sh" 2>/dev/null)"
check "bash: extra-allow cannot grant pnpm" deny "$(decision_of "$out")"
out="$(jq -nc --arg c 'rm -rf build' \
  '{tool_name:"Bash",tool_input:{command:$c}}' |
  SANDBOX_EXTRA_ALLOW='rm *' bash "$SCRIPT_DIR/outer-gate.sh" 2>/dev/null)"
check "bash: extra-allow cannot grant rm" deny "$(decision_of "$out")"
bash_case allow './sandbox --file tools/sandbox/sandbox.conf'
bash_case deny  'printf %s x | ./sandbox'

echo
echo "Bash gate — SANDBOX_EXTRA_DENY globs"
out_xd1="$(jq -nc --arg c 'bash tools/candidates/run.sh' \
  '{tool_name:"Bash",tool_input:{command:$c}}' |
  SANDBOX_EXTRA_DENY='bash tools/candidates/*' SANDBOX_EXTRA_ALLOW='' \
  bash "$SCRIPT_DIR/outer-gate.sh" 2>/dev/null)"
check "bash: extra-deny denies the glob" deny "$(decision_of "$out_xd1")"

out_xd2="$(jq -nc --arg c 'bash tools/candidates/run.sh' \
  '{tool_name:"Bash",tool_input:{command:$c}}' |
  SANDBOX_EXTRA_DENY='bash tools/candidates/*' SANDBOX_EXTRA_ALLOW='bash tools/*' \
  bash "$SCRIPT_DIR/outer-gate.sh" 2>/dev/null)"
check "bash: extra-deny wins over extra-allow" deny "$(decision_of "$out_xd2")"

out_xd3="$(jq -nc --arg c 'bash tools/dev-start.sh --foo' \
  '{tool_name:"Bash",tool_input:{command:$c}}' |
  SANDBOX_EXTRA_DENY='bash tools/candidates/*' SANDBOX_EXTRA_ALLOW='bash tools/dev-start.sh*' \
  bash "$SCRIPT_DIR/outer-gate.sh" 2>/dev/null)"
check "bash: extra-allow still allows when extra-deny does not match" allow "$(decision_of "$out_xd3")"

out_xd4="$(jq -nc --arg c 'git status' \
  '{tool_name:"Bash",tool_input:{command:$c}}' |
  SANDBOX_EXTRA_DENY='' SANDBOX_EXTRA_ALLOW='git*' \
  bash "$SCRIPT_DIR/outer-gate.sh" 2>/dev/null)"
check "bash: git still denied with extra-allow git*" deny "$(decision_of "$out_xd4")"

inner_xd="$(SANDBOX_GATE_FORCE= SANDBOX_INNER=1 bash -c \
  'jq -nc "{tool_name:\"Bash\",tool_input:{command:\"bash tools/candidates/run.sh\"}}" |
   SANDBOX_EXTRA_DENY="bash tools/candidates/*" bash "$0"' \
  "$SCRIPT_DIR/outer-gate.sh" 2>/dev/null)"
check "bash: SANDBOX_INNER bypasses extra-deny" allow "$(decision_of "$inner_xd")"

cursor_xd="$(jq -nc --arg c 'bash tools/candidates/run.sh' '{command:$c}' |
  GATE_PROTOCOL=cursor SANDBOX_EXTRA_DENY='bash tools/candidates/*' \
  bash "$SCRIPT_DIR/outer-gate.sh" 2>/dev/null)"
check "cursor: extra-deny emits {permission:deny}" deny "$(cursor_decision_of "$cursor_xd")"

echo
echo "Bash gate — outer-gate-deny.d hooks"
_ogd_tmp="$(mktemp -d)"
mkdir -p "$_ogd_tmp/outer-gate-deny.d"
# Copy gate scripts to temp dir so SCRIPT_DIR points there
cp "$SCRIPT_DIR/outer-gate.sh" "$SCRIPT_DIR/gate-lib.sh" "$_ogd_tmp/"
cat >"$_ogd_tmp/outer-gate-deny.d/fleet.sh" <<'FLEETEOF'
outer_gate_deny_fleet() {
  case "$1" in
    bash\ tools/candidates/*) deny "fleet" ;;
  esac
}
FLEETEOF
out_fleet="$(jq -nc --arg c 'bash tools/candidates/run.sh' \
  '{tool_name:"Bash",tool_input:{command:$c}}' |
  SANDBOX_EXTRA_DENY='' SANDBOX_EXTRA_ALLOW='' \
  bash "$_ogd_tmp/outer-gate.sh" 2>/dev/null)"
check "bash: deny.d fleet hook denies fleet command" deny "$(decision_of "$out_fleet")"

out_fleet_sb="$(jq -nc --arg c './sandbox "x"' \
  '{tool_name:"Bash",tool_input:{command:$c}}' |
  SANDBOX_EXTRA_DENY='' SANDBOX_EXTRA_ALLOW='' \
  bash "$_ogd_tmp/outer-gate.sh" 2>/dev/null)"
check "bash: deny.d fleet hook does not deny ./sandbox" allow "$(decision_of "$out_fleet_sb")"

out_fleet_pwd="$(jq -nc --arg c 'pwd' \
  '{tool_name:"Bash",tool_input:{command:$c}}' |
  SANDBOX_EXTRA_DENY='' SANDBOX_EXTRA_ALLOW='' \
  bash "$_ogd_tmp/outer-gate.sh" 2>/dev/null)"
check "bash: deny.d fleet hook does not deny pwd" allow "$(decision_of "$out_fleet_pwd")"

# Syntax error file is skipped; gate still works
printf '#!/bin/bash\nthis is not "valid bash\n' \
  >"$_ogd_tmp/outer-gate-deny.d/broken.sh"
out_broken="$(jq -nc --arg c 'pwd' \
  '{tool_name:"Bash",tool_input:{command:$c}}' |
  SANDBOX_EXTRA_DENY='' SANDBOX_EXTRA_ALLOW='' \
  bash "$_ogd_tmp/outer-gate.sh" 2>/dev/null)"
check "bash: syntax-error deny.d file skipped; pwd still allows" allow "$(decision_of "$out_broken")"

# inner bypass still wins even with deny.d
inner_fleet="$(SANDBOX_GATE_FORCE= SANDBOX_INNER=1 bash -c \
  'jq -nc "{tool_name:\"Bash\",tool_input:{command:\"bash tools/candidates/run.sh\"}}" |
   SANDBOX_EXTRA_DENY="" bash "$0"' \
  "$_ogd_tmp/outer-gate.sh" 2>/dev/null)"
check "bash: SANDBOX_INNER bypasses deny.d hooks" allow "$(decision_of "$inner_fleet")"

rm -rf "$_ogd_tmp"

echo
echo "Write gate — outer-write-gate-deny.d hooks"
_wgd_tmp="$(mktemp -d)"
mkdir -p "$_wgd_tmp/outer-write-gate-deny.d"
cp "$SCRIPT_DIR/outer-write-gate.sh" "$SCRIPT_DIR/gate-lib.sh" "$_wgd_tmp/"
cat >"$_wgd_tmp/outer-write-gate-deny.d/protect.sh" <<PROTEOF
outer_write_gate_deny_conf() {
  case "\$1" in
    "$PROJECT_ROOT/tools/sandbox/sandbox.conf") deny "protected by project rule" ;;
  esac
}
PROTEOF
out_wgd_deny="$(jq -nc --arg p "$PROJECT_ROOT/tools/sandbox/sandbox.conf" \
  '{tool_name:"Edit",tool_input:{file_path:$p}}' |
  bash "$_wgd_tmp/outer-write-gate.sh" 2>/dev/null)"
check "write: deny.d rule denies sandbox.conf" deny "$(decision_of "$out_wgd_deny")"

out_wgd_other="$(jq -nc --arg p "$PROJECT_ROOT/tools/sandbox/gate-lib.sh" \
  '{tool_name:"Edit",tool_input:{file_path:$p}}' |
  bash "$_wgd_tmp/outer-write-gate.sh" 2>/dev/null)"
check "write: deny.d rule does not deny other harness writes" allow "$(decision_of "$out_wgd_other")"

inner_wgd="$(SANDBOX_GATE_FORCE= SANDBOX_INNER=1 bash -c \
  'jq -nc --arg p "'"$PROJECT_ROOT/tools/sandbox/sandbox.conf"'" \
    "{tool_name:\"Edit\",tool_input:{file_path:\$p}}" |
   bash "$0"' \
  "$_wgd_tmp/outer-write-gate.sh" 2>/dev/null)"
check "write: SANDBOX_INNER bypasses write-gate deny.d" allow "$(decision_of "$inner_wgd")"

rm -rf "$_wgd_tmp"

echo
echo "CLI — unknown single-token verbs and quoted sentences"
cli_rc=0
cli_out="$(bash "$PROJECT_ROOT/sandbox" down 2>&1)" || cli_rc=$?
check "cli: ./sandbox down exits 2" 2 "$cli_rc"
check "cli: ./sandbox down names the verb" unknown \
  "$(printf '%s' "$cli_out" | grep -q 'unknown verb: down' && echo unknown || echo other)"
# A quoted multi-word sentence must NOT trigger unknown-verb; it should reach dispatch.
# Use a temp launcher copy with a stub dispatch.sh so the real dispatcher (which does
# pkill claude and starts a container) is never reached during testing.
_cli_tmp="$(mktemp -d)"
mkdir -p "$_cli_tmp/tools/sandbox"
cp "$PROJECT_ROOT/sandbox" "$_cli_tmp/sandbox"
printf '#!/usr/bin/env bash\necho DISPATCH\nexit 0\n' >"$_cli_tmp/tools/sandbox/dispatch.sh"
chmod 755 "$_cli_tmp/tools/sandbox/dispatch.sh"
cli_sentence_out="$(bash "$_cli_tmp/sandbox" "add a health check endpoint" 2>&1)" || true
check "cli: quoted sentence does not print unknown verb" nodispatch \
  "$(printf '%s' "$cli_sentence_out" | grep -q 'unknown verb' && echo dispatch || echo nodispatch)"
check "cli: quoted sentence reaches dispatch" DISPATCH \
  "$(printf '%s' "$cli_sentence_out" | grep -q 'DISPATCH' && echo DISPATCH || echo missing)"
rm -rf "$_cli_tmp"

echo
echo "Claude result extraction — success is not an envelope dump"
# shellcheck source=dispatch-claude.sh
. "$SCRIPT_DIR/dispatch-claude.sh"
_ext_dir="$(mktemp -d)"
printf '%s\n' '{"type":"result","subtype":"success","is_error":false,"result":"hello from inner"}' >"$_ext_dir/ok.jsonl"
ext_out="$(claude_result_from_stream "$_ext_dir/ok.jsonl")"; ext_rc=$?
check "claude stream: success prints result" "hello from inner" "$ext_out"
check "claude stream: success exit 0" 0 "$ext_rc"
printf '%s\n' '{"is_error":false,"subtype":"success","result":""}' >"$_ext_dir/empty.json"
ext_out="$(claude_result_from_file "$_ext_dir/empty.json")"; ext_rc=$?
check "claude json: empty success is exit 0" 0 "$ext_rc"
check "claude json: empty success does not dump envelope" nodump \
  "$(printf '%s' "$ext_out" | grep -q is_error && echo dump || echo nodump)"
rm -rf "$_ext_dir"

echo
echo "Worktree pointer — common dir is outside the repo"
_wt="$(mktemp -d)"
mkdir -p "$_wt/parent/.git/worktrees/leaf" "$_wt/leaf"
printf 'gitdir: %s\n' "$_wt/parent/.git/worktrees/leaf" >"$_wt/leaf/.git"
_wt_got="$(
  # shellcheck source=common.sh
  . "$SCRIPT_DIR/common.sh"
  # shellcheck source=run-args.sh
  . "$SCRIPT_DIR/run-args.sh"
  REPO_ROOT="$_wt/leaf"
  sandbox_git_common_dir
)"
check "worktree: common dir resolves" "$(cd "$_wt/parent/.git" && pwd -P)" "$_wt_got"
rm -rf "$_wt"

echo
echo "Manifest — every path install claims to own is really here"
# The gates are not the only thing that fails silently. A MANIFEST that lists a
# file the tree does not have installs a project into a state where the next
# update deletes files that were never written, and nothing notices until
# somebody's harness is missing a script. This is the cheapest possible guard:
# run it wherever the tests run.
# shellcheck source=manifest.sh
. "$SCRIPT_DIR/manifest.sh"
MANIFEST_FILE="$SCRIPT_DIR/MANIFEST"

if [ ! -r "$MANIFEST_FILE" ]; then
  check "manifest: tools/sandbox/MANIFEST exists" present missing
else
  check "manifest: tools/sandbox/MANIFEST exists" present present
  missing_paths="$(manifest_missing_sources "$PROJECT_ROOT" "$MANIFEST_FILE" || true)"
  if [ -z "$missing_paths" ]; then
    check "manifest: every replace/preserve path is in the tree" complete complete
  else
    check "manifest: every replace/preserve path is in the tree" complete "missing $(printf '%s ' $missing_paths)"
  fi

  # The other direction. A harness file nobody listed is a file no install
  # copies and no update removes — it exists here and nowhere else.
  unlisted=""
  while IFS= read -r f; do
    [ -n "$f" ] || continue
    manifest_entries "$MANIFEST_FILE" | awk -v p="$f" '$2 == p { found = 1 } END { exit !found }' ||
      unlisted="$unlisted $f"
  done <<EOF
$(cd "$PROJECT_ROOT" && find tools/sandbox -type f \
    ! -path 'tools/sandbox/.cache/*' \
    ! -path 'tools/sandbox/outer-gate-deny.d/*.sh' \
    ! -path 'tools/sandbox/outer-write-gate-deny.d/*.sh' \
    ! -name 'sandbox.local.conf' ! -name 'sandbox.conf.new' ! -name 'ORIGIN.md' \
    ! -name '.install-hashes' 2>/dev/null | sort)
EOF
  if [ -z "$unlisted" ]; then
    check "manifest: no harness file is missing from it" complete complete
  else
    check "manifest: no harness file is missing from it" complete "unlisted$unlisted"
  fi
fi

# The daily model snapshot and the manager-model resolution that reads it. It
# shares check/pass/fail rather than running as a subprocess, so `./sandbox test`
# reports one honest number for the whole harness instead of two.
# shellcheck source=model-daily-test.sh
. "$SCRIPT_DIR/model-daily-test.sh"

# Latency-cut additions: sandbox_now_ms, stamp-fresh, github cache, bridge skip.
# shellcheck source=bench-test.sh
. "$SCRIPT_DIR/bench-test.sh"

# Autoupdate predicate: sandbox_autoupdate_should and update.sh syntax.
# shellcheck source=update-test.sh
. "$SCRIPT_DIR/update-test.sh"
# shellcheck source=credential-expiry-test.sh
. "$SCRIPT_DIR/credential-expiry-test.sh"

echo
echo "Wave 1 agents — require_agent_credential is wired"
# shellcheck source=agent.sh
. "$SCRIPT_DIR/agent.sh"
# Verify the Wave-1 placeholder is gone: none of the four should echo "Wave 1"
for _w1_agent in copilot agy amp opencode; do
  _w1_out="$(SANDBOX_DIR="$SCRIPT_DIR" require_agent_credential "$_w1_agent" 2>&1 || true)"
  check "require_agent_credential $_w1_agent: no Wave-1 stub" absent \
    "$(printf '%s' "$_w1_out" | grep -q 'Wave 1' && echo present || echo absent)"
done
# resolve_sandbox_agent accepts all seven names via SANDBOX_AGENT
for _w1_agent in copilot agy amp opencode; do
  check "resolve_sandbox_agent: accepts $_w1_agent via SANDBOX_AGENT" "$_w1_agent" \
    "$(SANDBOX_AGENT="$_w1_agent" resolve_sandbox_agent noprompt 2>/dev/null)"
done

echo
echo "Wave 1 agents — dispatch files syntax"
for _w1_f in dispatch-copilot.sh dispatch-agy.sh dispatch-amp.sh dispatch-opencode.sh; do
  check "bash -n $_w1_f" ok \
    "$(bash -n "$SCRIPT_DIR/$_w1_f" 2>&1 >/dev/null && echo ok || echo "syntax error")"
done
for _w1_f in copilot-token-sync.sh agy-token-sync.sh amp-token-sync.sh opencode-token-sync.sh; do
  check "bash -n $_w1_f" ok \
    "$(bash -n "$SCRIPT_DIR/$_w1_f" 2>&1 >/dev/null && echo ok || echo "syntax error")"
done

if [ -f "$PROJECT_ROOT/install.sh" ]; then
echo
echo "install.sh — dry-run does not change files; no --force refuses foreign files"
_itmp="$(mktemp -d)"
mkdir -p "$_itmp/tools/sandbox"
printf '#!/usr/bin/env bash\necho hi\n' >"$_itmp/tools/sandbox/my-project-script.sh"
# dry-run against this repo (SRC=PROJECT_ROOT since install.sh is next to tools/sandbox)
_irc=0
SANDBOX_TARGET="$_itmp" bash "$PROJECT_ROOT/install.sh" --dry-run 2>/dev/null || _irc=$?
check "install: dry-run exits 0" 0 "$_irc"
check "install: dry-run keeps foreign file" present \
  "$([ -f "$_itmp/tools/sandbox/my-project-script.sh" ] && echo present || echo gone)"
# without --force: must refuse (nonzero) because of the foreign file
_irc2=0
SANDBOX_TARGET="$_itmp" bash "$PROJECT_ROOT/install.sh" 2>/dev/null || _irc2=$?
check "install: refuses foreign file without --force" nonzero \
  "$([ "$_irc2" -ne 0 ] && echo nonzero || echo zero)"
check "install: foreign file present after refusal" present \
  "$([ -f "$_itmp/tools/sandbox/my-project-script.sh" ] && echo present || echo gone)"
rm -rf "$_itmp"
fi

echo
printf '%s passed, %s failed\n' "$pass" "$fail"
[ "$fail" -eq 0 ]
