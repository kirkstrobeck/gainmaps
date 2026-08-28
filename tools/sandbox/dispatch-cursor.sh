#!/usr/bin/env bash
# Cursor CLI backend for dispatch.sh. Source, don't run.
#
# `agent -p --force` is Cursor's headless yolo mode: print the answer, run every
# tool call without asking. Same bargain as the other two backends — the
# permission prompt is the thing that makes an agent useful and the thing you
# should not point at a laptop, so it goes away and the container is what makes
# that safe.
#
# --trust matters more than it looks. In print mode an untrusted workspace stops
# the run rather than prompting, and a bind-mounted repo the container has never
# seen is untrusted by definition. --sandbox disabled turns off Cursor's own
# process sandbox: it is redundant inside a throwaway container with one repo,
# and it is the layer most likely to fail for reasons that have nothing to do
# with the task.
#
# Cursor has no `--continue` that survives a fresh process the way we need, but
# every stream-json line carries session_id, so the id is persisted and resumed
# explicitly — the same trick dispatch-codex.sh plays with thread ids, which is
# what makes `./sandbox -c` mean one thing across all three agents.

# The last `result` line of a stream-json log, falling back to the last thing
# the assistant actually said. A run killed partway through has no result line
# but usually has plenty of assistant text, and reporting that beats reporting
# nothing.
cursor_result_from_log() {
  local log="$1" out
  out="$(jq -r 'select(.type == "result") | .result // empty' "$log" 2>/dev/null | tail -1 || true)"
  [ -n "$out" ] && { printf '%s' "$out"; return 0; }
  jq -r 'select(.type == "assistant")
         | [.message.content[]? | select(.type == "text") | .text] | add // empty' \
    "$log" 2>/dev/null | tail -1 || true
}

dispatch_cursor() {
  local continue_flag="$1" run_dir_host="$2" run_dir_ctr="$3"
  local session_file="$CACHE_DIR/cursor-session"
  local session_id=""

  if [ -n "$continue_flag" ] && [ -f "$session_file" ]; then
    session_id="$(cat "$session_file" 2>/dev/null || true)"
  fi

  # Only one inner run at a time, for the same reason as the other backends: a
  # run orphaned by a disconnected client still holds the worktree.
  docker exec "$SANDBOX_NAME" pkill -f 'cursor-agent' >/dev/null 2>&1 || true

  docker exec -u agent -w /workspace \
    -e "MSG_FILE=$run_dir_ctr/msg" \
    -e "LOG_FILE=$run_dir_ctr/last.jsonl" \
    -e "SESSION_ID=$session_id" \
    -e "SANDBOX_INNER_MODEL=${SANDBOX_INNER_MODEL:-}" \
    -e "SANDBOX_MODEL_DAILY=${SANDBOX_MODEL_DAILY:-}" \
    "$SANDBOX_NAME" bash -lc '
      msg="$(cat "$MSG_FILE")"
      set -- -p --force --trust --sandbox disabled --output-format stream-json
      [ -n "$SESSION_ID" ] && set -- "$@" --resume "$SESSION_ID"
      [ -n "$SANDBOX_INNER_MODEL" ] && set -- "$@" --model "$SANDBOX_INNER_MODEL"
      agent "$@" -- "$msg" >"$LOG_FILE" 2>&1
    ' </dev/null || true

  # Pull-only bridge; the call is here so all three backends read the same.
  bash "$SCRIPT_DIR/cursor-token-sync.sh" push >&2 || true

  local new_session
  new_session="$(jq -r 'select(.session_id != null) | .session_id' \
    "$run_dir_host/last.jsonl" 2>/dev/null | tail -1 || true)"
  [ -n "$new_session" ] && printf '%s' "$new_session" >"$session_file"

  local result
  result="$(cursor_result_from_log "$run_dir_host/last.jsonl")"

  if [ -z "$result" ]; then
    # Not JSON at all usually means the CLI died before it started streaming —
    # an auth failure or a bad --model. That text is the fix; print it.
    tail -20 "$run_dir_host/last.jsonl" 2>/dev/null >&2 || true
    echo "Inner Cursor produced no final message. Raw log tail is above." >&2
    return 1
  fi

  printf '%s\n' "$result"

  local is_error
  is_error="$(jq -r 'select(.type == "result") | .is_error' \
    "$run_dir_host/last.jsonl" 2>/dev/null | tail -1 || true)"
  [ "$is_error" = "true" ] && return 1
  return 0
}
