#!/usr/bin/env bash
# Send one message to the inner agent and print its answer.
#
# This is the only door between the outer agent and the sandbox. Everything the
# outer agent is forbidden to do on the host — install, build, test, commit,
# push, edit source — it asks for here.
#
#   bash tools/sandbox/dispatch.sh "run the test suite"
#   bash tools/sandbox/dispatch.sh --continue "now fix the failure"
#   bash tools/sandbox/dispatch.sh --agent cursor "run the test suite"
#   bash tools/sandbox/dispatch.sh --model gpt-5 "run the test suite"
#   bash tools/sandbox/dispatch.sh --file msg.txt
#   bash tools/sandbox/dispatch.sh --result        # re-read the last answer
#
# The message travels through a file, never through a shell argument, so quotes,
# newlines, backticks and $() in a prompt stay literal text. A long message
# from the outer agent should use --file: the gate denies pipes.

set -uo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd -P)"
# shellcheck source=common.sh
. "$SCRIPT_DIR/common.sh"
# shellcheck source=agent.sh
. "$SCRIPT_DIR/agent.sh"
# shellcheck source=model-daily.sh
. "$SCRIPT_DIR/model-daily.sh"
# shellcheck source=model.sh
. "$SCRIPT_DIR/model.sh"
# shellcheck source=dispatch-claude.sh
. "$SCRIPT_DIR/dispatch-claude.sh"
# shellcheck source=dispatch-codex.sh
. "$SCRIPT_DIR/dispatch-codex.sh"
# shellcheck source=dispatch-cursor.sh
. "$SCRIPT_DIR/dispatch-cursor.sh"
# shellcheck source=dispatch-copilot.sh
. "$SCRIPT_DIR/dispatch-copilot.sh"
# shellcheck source=dispatch-agy.sh
. "$SCRIPT_DIR/dispatch-agy.sh"
# shellcheck source=dispatch-amp.sh
. "$SCRIPT_DIR/dispatch-amp.sh"
# shellcheck source=dispatch-opencode.sh
. "$SCRIPT_DIR/dispatch-opencode.sh"
# shellcheck source=credential-expiry.sh
. "$SCRIPT_DIR/credential-expiry.sh"

RUN_DIR="$CACHE_DIR/run"
RUN_DIR_CTR="/workspace/${SANDBOX_DIR#"$REPO_ROOT"/}/.cache/run"

usage() {
  sed -n '2,18p' "${BASH_SOURCE[0]}" | sed 's/^# \{0,1\}//' >&2
  exit "${1:-0}"
}

continue_flag=""
want_result=0
message=""

while [ $# -gt 0 ]; do
  case "$1" in
    -c|--continue) continue_flag="--continue"; shift ;;
    -a|--agent) SANDBOX_AGENT="${2:-}"; shift 2 ;;
    -m|--model) SANDBOX_MODEL="${2:-}"; shift 2 ;;
    --file|--message-file)
      [ -n "${2:-}" ] && [ -r "$2" ] || { echo "cannot read message file: ${2:-}" >&2; exit 2; }
      message="$(cat "$2")"
      shift 2
      ;;
    --result) want_result=1; shift ;;
    -h|--help) usage 0 ;;
    --) shift; message="$*"; break ;;
    -*) echo "Unknown option: $1" >&2; usage 2 ;;
    *) message="$*"; break ;;
  esac
done

agent="$(resolve_sandbox_agent noprompt)" || exit 2
export SANDBOX_AGENT="$agent"

# Recovery path. A dispatch that outlived its client still finished inside the
# container and still wrote its answer to disk; this reads that back without
# spending another run.
if [ "$want_result" = 1 ]; then
  case "$agent" in
    claude)
      if [ -f "$RUN_DIR/last.jsonl" ]; then
        claude_result_from_stream "$RUN_DIR/last.jsonl" "$RUN_DIR/last.err"
        exit $?
      fi
      [ -f "$RUN_DIR/last.json" ] || { echo "No previous Claude result." >&2; exit 1; }
      claude_result_from_file "$RUN_DIR/last.json" "$RUN_DIR/last.err"
      exit $? ;;
    codex)
      [ -f "$RUN_DIR/last.txt" ] || { echo "No previous Codex result." >&2; exit 1; }
      cat "$RUN_DIR/last.txt"
      exit 0 ;;
    cursor)
      [ -f "$RUN_DIR/last.jsonl" ] || { echo "No previous Cursor result." >&2; exit 1; }
      cursor_result_from_log "$RUN_DIR/last.jsonl"
      printf '\n'
      exit 0 ;;
    copilot)
      [ -f "$RUN_DIR/last.txt" ] || { echo "No previous Copilot result." >&2; exit 1; }
      cat "$RUN_DIR/last.txt"
      exit 0 ;;
    agy)
      [ -f "$RUN_DIR/last.jsonl" ] || { echo "No previous agy result." >&2; exit 1; }
      agy_result_from_stream "$RUN_DIR/last.jsonl"
      exit $? ;;
    amp)
      if [ -f "$RUN_DIR/last.txt" ]; then
        cat "$RUN_DIR/last.txt"; exit 0
      fi
      [ -f "$RUN_DIR/last.jsonl" ] || { echo "No previous Amp result." >&2; exit 1; }
      jq -r 'select(.type == "result") | .result // empty' "$RUN_DIR/last.jsonl" 2>/dev/null | tail -1
      exit 0 ;;
    opencode)
      [ -f "$RUN_DIR/last.txt" ] || { echo "No previous OpenCode result." >&2; exit 1; }
      cat "$RUN_DIR/last.txt"
      exit 0 ;;
  esac
fi

# Reading stdin only when it isn't a terminal keeps an argument-less invocation
# from silently hanging on a keyboard nobody is at.
if [ -z "$message" ] && [ ! -t 0 ]; then
  message="$(cat)"
fi
if [ -z "${message//[[:space:]]/}" ]; then
  echo "Nothing to dispatch: give a message as an argument or on stdin." >&2
  usage 2
fi

_t_dispatch_start="$(sandbox_now_ms)"
require_agent_credential "$agent" || exit 1
credential_expiry_warn "$agent"

# Today's model/plan/promo snapshot, fetched at most once a day for every
# sandbox on this machine. It stays on the host — the text is handed to the
# container as an environment variable, never as a mount — and it is what lets
# the inner manager pick a worker model without spending a web search on it.
# Empty is fine and is the fail-open answer; nothing downstream requires it. A
# value already in the environment is somebody overriding today's snapshot on
# purpose, so it is left alone.
if [ -z "${SANDBOX_MODEL_DAILY:-}" ]; then
  SANDBOX_MODEL_DAILY="$(sandbox_model_daily_ensure 2>/dev/null || true)"
fi
export SANDBOX_MODEL_DAILY

# The MANAGER model, not the outer one. What runs inside routes and reviews;
# the worker it spawns does the work at a cheaper tier. See model.sh.
SANDBOX_INNER_MODEL="$(resolve_sandbox_model "$agent")"
export SANDBOX_INNER_MODEL

_t_boot_start="$(sandbox_now_ms)"
container="$(bash "$SCRIPT_DIR/boot.sh")" || {
  echo "Sandbox failed to start. See the errors above." >&2
  exit 1
}
SANDBOX_NAME="$container"
sandbox_timing "boot" "$_t_boot_start" "$(sandbox_now_ms)"

# The image bakes AGENT.md in at build time, so an edit to it would otherwise
# need a rebuild before the inner agent read a word of it. The bind mount
# already has the current copy, so refresh the three user-global locations from
# there on every dispatch. Skip the docker exec when the file is unchanged
# (same sha256 as the last copy) — one fewer docker exec on every warm boot.
_t_agentmd_start="$(sandbox_now_ms)"
_agent_md_src="$SCRIPT_DIR/AGENT.md"
_agent_md_hash_file="$CACHE_DIR/.agent-md-hash"
_agent_md_cur_hash=""
if [ -r "$_agent_md_src" ]; then
  _agent_md_cur_hash="$(sha256sum "$_agent_md_src" 2>/dev/null | awk '{print $1}' ||
                        md5sum "$_agent_md_src" 2>/dev/null | awk '{print $1}' || true)"
fi
if [ -z "$_agent_md_cur_hash" ] || \
   [ "$_agent_md_cur_hash" != "$(cat "$_agent_md_hash_file" 2>/dev/null || true)" ]; then
  # Best effort: an instruction file that could not be copied is the image's
  # slightly older one, which is not worth failing a run over.
  docker exec -u agent -e "HOME=/home/agent" "$SANDBOX_NAME" bash -c '
    src="$0"
    [ -r "$src" ] || exit 0
    mkdir -p /home/agent/.claude /home/agent/.codex /home/agent/.cursor/rules \
             /home/agent/.gemini /home/agent/.config/amp /home/agent/.config/opencode
    cp -f "$src" /home/agent/.claude/CLAUDE.md
    cp -f "$src" /home/agent/.codex/AGENTS.md
    cp -f "$src" /home/agent/.gemini/AGENTS.md
    cp -f "$src" /home/agent/.config/amp/AGENTS.md
    cp -f "$src" /home/agent/.config/opencode/instructions.md
    # Cursor learns a user-global rule only through the alwaysApply frontmatter
    # entrypoint.sh writes, so the same header is rebuilt around the new text.
    {
      printf -- "---\ndescription: You are the inner agent inside the sandbox container.\nalwaysApply: true\n---\n\n"
      cat "$src"
    } >/home/agent/.cursor/rules/sandbox-inner.mdc
  ' "/workspace/${SANDBOX_DIR#"$REPO_ROOT"/}/AGENT.md" >/dev/null 2>&1 || true
  [ -n "$_agent_md_cur_hash" ] && printf '%s' "$_agent_md_cur_hash" >"$_agent_md_hash_file"
fi
sandbox_timing "agent-md" "$_t_agentmd_start" "$(sandbox_now_ms)"

mkdir -p "$RUN_DIR"
printf '%s' "$message" >"$RUN_DIR/msg"
rm -f "$RUN_DIR/last.json" "$RUN_DIR/last.txt" "$RUN_DIR/last.jsonl"

echo "→ $agent (manager)${SANDBOX_INNER_MODEL:+ · $SANDBOX_INNER_MODEL} ..." >&2

_t_inner_start="$(sandbox_now_ms)"
case "$agent" in
  claude)   dispatch_claude   "$continue_flag" "$RUN_DIR" "$RUN_DIR_CTR" ;;
  codex)    dispatch_codex    "$continue_flag" "$RUN_DIR" "$RUN_DIR_CTR" ;;
  cursor)   dispatch_cursor   "$continue_flag" "$RUN_DIR" "$RUN_DIR_CTR" ;;
  copilot)  dispatch_copilot  "$continue_flag" "$RUN_DIR" "$RUN_DIR_CTR" ;;
  agy)      dispatch_agy      "$continue_flag" "$RUN_DIR" "$RUN_DIR_CTR" ;;
  amp)      dispatch_amp      "$continue_flag" "$RUN_DIR" "$RUN_DIR_CTR" ;;
  opencode) dispatch_opencode "$continue_flag" "$RUN_DIR" "$RUN_DIR_CTR" ;;
esac
sandbox_timing "inner" "$_t_inner_start" "$(sandbox_now_ms)"
sandbox_timing "total" "$_t_dispatch_start" "$(sandbox_now_ms)"
