#!/usr/bin/env bash
# Antigravity (agy) backend for dispatch.sh. Source, don't run.
#
# agy is the Gemini CLI successor. It authenticates through Google OAuth,
# stored at ~/.gemini/ — the same directory mounted at /home/agent/.gemini.
# GEMINI_API_KEY is forwarded if set on the host; otherwise the CLI uses
# whatever credential the OAuth login left behind.
#
# agy supports native --conversation <id> resume. The conversation id is
# persisted after each run and reused when ./sandbox -c is passed.
#
# --output-format stream-json produces JSONL identical in shape to Claude
# Code's stream-json, so the same result extraction applies.
#
# --print-timeout is set far above the default (5 m) because a manager-plus-
# worker dispatch can easily run for 15-20 minutes; the timeout kills the
# whole run if it fires.

agy_result_from_stream() {
  local jsonl_file="$1" err_file="${2:-}"

  if [ ! -s "$jsonl_file" ]; then
    [ -s "$err_file" ] && cat "$err_file" >&2
    echo "Inner agy produced no output. Check: docker logs $SANDBOX_NAME" >&2
    return 1
  fi

  local result is_error
  result="$(grep -v '^$' "$jsonl_file" | jq -r 'select(.type == "result") | .result // ""' 2>/dev/null | tail -1 || true)"
  is_error="$(grep -v '^$' "$jsonl_file" | jq -r 'select(.type == "result") | .is_error // false' 2>/dev/null | tail -1 || printf 'false')"

  if [ -z "$result" ]; then
    result="$(grep -v '^$' "$jsonl_file" | jq -r 'select(.type == "assistant") | .message.content[]? | select(.type == "text") | .text' 2>/dev/null | tail -1 || true)"
  fi

  if [ -n "$result" ]; then
    printf '%s\n' "$result"
    [ "$is_error" = "true" ] && return 1
    return 0
  fi

  [ -s "$err_file" ] && cat "$err_file" >&2
  echo "Inner agy produced no final message. See: $jsonl_file" >&2
  return 1
}

dispatch_agy() {
  local continue_flag="$1" run_dir_host="$2" run_dir_ctr="$3"
  local conv_file="$CACHE_DIR/agy-conversation"
  local conv_id=""

  if [ -n "$continue_flag" ] && [ -f "$conv_file" ]; then
    conv_id="$(cat "$conv_file" 2>/dev/null || true)"
  fi

  docker exec "$SANDBOX_NAME" pkill -f 'agy -p' >/dev/null 2>&1 || true

  docker exec -u agent -w /workspace \
    -e "MSG_FILE=$run_dir_ctr/msg" \
    -e "LOG_FILE=$run_dir_ctr/last.jsonl" \
    -e "ERR_FILE=$run_dir_ctr/last.err" \
    -e "CONV_ID=$conv_id" \
    -e "GEMINI_API_KEY=${GEMINI_API_KEY:-}" \
    -e "SANDBOX_INNER_MODEL=${SANDBOX_INNER_MODEL:-}" \
    -e "SANDBOX_MODEL_DAILY=${SANDBOX_MODEL_DAILY:-}" \
    "$SANDBOX_NAME" bash -lc '
      msg="$(cat "$MSG_FILE")"
      set -- -p --dangerously-skip-permissions --output-format stream-json \
             --print-timeout 1200
      [ -n "$CONV_ID" ] && set -- "$@" --conversation "$CONV_ID"
      [ -n "$SANDBOX_INNER_MODEL" ] && set -- "$@" --model "$SANDBOX_INNER_MODEL"
      agy "$@" "$msg" >"$LOG_FILE" 2>"$ERR_FILE"
    ' </dev/null || true

  # No push back: Google OAuth does not rotate in a way the container can
  # surface to the Mac. Pull-only; if the token expires, re-login on the Mac.

  local new_conv
  new_conv="$(jq -r 'select(.conversation_id != null) | .conversation_id' \
    "$run_dir_host/last.jsonl" 2>/dev/null | tail -1 || true)"
  [ -n "$new_conv" ] && printf '%s' "$new_conv" >"$conv_file"

  agy_result_from_stream "$run_dir_host/last.jsonl" "$run_dir_host/last.err"
}
