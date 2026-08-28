#!/usr/bin/env bash
# Codex backend for dispatch.sh. Source, don't run.
#
# Codex has no `--continue`; it resumes an explicit thread id. So the thread id
# from the first run is written to disk and reused, which is what makes
# `dispatch.sh --continue` mean the same thing for both agents.

dispatch_codex() {
  local continue_flag="$1" run_dir_host="$2" run_dir_ctr="$3"
  local thread_file="$CACHE_DIR/codex-thread"
  local thread_id=""

  if [ -n "$continue_flag" ] && [ -f "$thread_file" ]; then
    thread_id="$(cat "$thread_file" 2>/dev/null || true)"
  fi

  docker exec "$SANDBOX_NAME" pkill -f 'codex exec' >/dev/null 2>&1 || true

  docker exec -u agent -w /workspace \
    -e "MSG_FILE=$run_dir_ctr/msg" \
    -e "OUT_FILE=$run_dir_ctr/last.txt" \
    -e "LOG_FILE=$run_dir_ctr/last.jsonl" \
    -e "THREAD_ID=$thread_id" \
    -e "SANDBOX_INNER_MODEL=${SANDBOX_INNER_MODEL:-}" \
    -e "SANDBOX_MODEL_DAILY=${SANDBOX_MODEL_DAILY:-}" \
    "$SANDBOX_NAME" bash -lc '
      msg="$(cat "$MSG_FILE")"
      set -- exec
      [ -n "$THREAD_ID" ] && set -- "$@" resume "$THREAD_ID"
      set -- "$@" --dangerously-bypass-approvals-and-sandbox \
        --json --output-last-message "$OUT_FILE"
      [ -n "$SANDBOX_INNER_MODEL" ] && set -- "$@" --model "$SANDBOX_INNER_MODEL"
      codex "$@" "$msg" >"$LOG_FILE" 2>&1
    ' </dev/null || true

  bash "$SCRIPT_DIR/codex-token-sync.sh" push >&2 || true

  local new_thread
  new_thread="$(jq -r 'select(.type == "thread.started") | .thread_id' \
    "$run_dir_host/last.jsonl" 2>/dev/null | tail -1 || true)"
  [ -n "$new_thread" ] && printf '%s' "$new_thread" >"$thread_file"

  local result
  result="$(cat "$run_dir_host/last.txt" 2>/dev/null || true)"

  # --output-last-message is empty when the run died early. The JSONL stream
  # still holds every assistant message, so the last one is the best answer
  # available — and better than reporting nothing at all.
  if [ -z "$result" ]; then
    result="$(jq -r 'select(.type == "item.completed" and .item.type == "agent_message") | .item.text' \
      "$run_dir_host/last.jsonl" 2>/dev/null | tail -1 || true)"
  fi

  if [ -z "$result" ]; then
    tail -20 "$run_dir_host/last.jsonl" 2>/dev/null >&2 || true
    echo "Inner Codex produced no final message. Raw log tail is above." >&2
    return 1
  fi

  printf '%s\n' "$result"
}
