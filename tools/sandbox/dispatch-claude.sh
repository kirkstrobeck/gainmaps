#!/usr/bin/env bash
# Claude Code backend for dispatch.sh. Source, don't run.
#
# `--dangerously-skip-permissions` is the entire point of the container: inside
# a throwaway box with one repo bind-mounted, there is no human to ask and
# nothing outside to damage, so asking is pure friction. Running that flag on
# the Mac would be a different thing entirely, which is what the gates prevent.
#
# `--verbose` is required by the Claude CLI when `-p --output-format stream-json`
# is used — without it the CLI refuses to run in print mode.

dispatch_claude() {
  local continue_flag="$1" run_dir_host="$2" run_dir_ctr="$3"

  # Only one inner run at a time. A previous run orphaned by a disconnected
  # client is still holding the repo, and two agents editing the same worktree
  # produce corruption that is very hard to attribute later. Skip the kill when
  # nothing is running — the docker exec round-trip is the expensive part.
  if docker exec "$SANDBOX_NAME" pgrep -f 'claude -p' >/dev/null 2>&1; then
    docker exec "$SANDBOX_NAME" pkill -f 'claude -p' >/dev/null 2>&1 || true
  fi

  # Stderr to a sibling file so spurious warnings (trust dialogs, ignore-entries)
  # don't corrupt the JSON result. The result is written INSIDE the container,
  # to a path on the bind mount. If the client dies mid-run the work still
  # finishes and the answer is still there — `dispatch.sh --result` reads it back.
  docker exec -u agent -w /workspace \
    -e "MSG_FILE=$run_dir_ctr/msg" \
    -e "OUT_FILE=$run_dir_ctr/last.jsonl" \
    -e "ERR_FILE=$run_dir_ctr/last.err" \
    -e "CONT_FLAG=$continue_flag" \
    -e "SANDBOX_INNER_MODEL=${SANDBOX_INNER_MODEL:-}" \
    -e "SANDBOX_MODEL_DAILY=${SANDBOX_MODEL_DAILY:-}" \
    -e "CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC=1" \
    "$SANDBOX_NAME" bash -c '
      msg="$(cat "$MSG_FILE")"
      set -- -p $CONT_FLAG --verbose --dangerously-skip-permissions --output-format stream-json
      [ -n "$SANDBOX_INNER_MODEL" ] && set -- "$@" --model "$SANDBOX_INNER_MODEL"
      claude "$@" "$msg" >"$OUT_FILE" 2>"$ERR_FILE"
    ' </dev/null || true

  # Push before reading: the run may have refreshed the OAuth token, and the
  # rotated refresh token has to get back to the Mac or the human is logged out.
  bash "$SCRIPT_DIR/token-sync.sh" push >&2 || true

  claude_result_from_stream "$run_dir_host/last.jsonl" "$run_dir_host/last.err"
}

# Extract and print the result from a Claude stream-json (JSONL) output file.
# Returns 0 on success, 1 on real failure.
claude_result_from_stream() {
  local jsonl_file="$1" err_file="${2:-}"

  if [ ! -s "$jsonl_file" ]; then
    [ -s "$err_file" ] && cat "$err_file" >&2
    echo "Inner Claude produced no output. Check: docker logs $SANDBOX_NAME" >&2
    return 1
  fi

  # stream-json: look for the final result message.
  # The result is in a line with type="result" and field .result
  local result is_error
  result="$(grep -v '^$' "$jsonl_file" | jq -r 'select(.type == "result") | .result // ""' 2>/dev/null | tail -1 || true)"
  is_error="$(grep -v '^$' "$jsonl_file" | jq -r 'select(.type == "result") | .is_error // false' 2>/dev/null | tail -1 || printf 'false')"

  if [ -z "$result" ]; then
    # Fall back: last assistant text content
    result="$(grep -v '^$' "$jsonl_file" | jq -r 'select(.type == "assistant") | .message.content[]? | select(.type == "text") | .text' 2>/dev/null | tail -1 || true)"
  fi

  if [ -n "$result" ]; then
    printf '%s\n' "$result"
    [ "$is_error" = "true" ] && return 1
    return 0
  fi

  [ -s "$err_file" ] && cat "$err_file" >&2
  # If stream-json is unsupported, fall back to reading the raw output
  if grep -q '"type"' "$jsonl_file" 2>/dev/null; then
    echo "stream-json dispatch produced no result. See: $jsonl_file" >&2
  else
    cat "$jsonl_file" >&2
  fi
  return 1
}

# Extract and print the result from a Claude JSON output file (backward compat).
# Returns 0 on success, 1 on real failure.
claude_result_from_file() {
  local json_file="$1" err_file="${2:-}"

  local raw
  raw="$(cat "$json_file" 2>/dev/null || true)"

  if [ -z "$raw" ]; then
    [ -s "$err_file" ] && cat "$err_file" >&2
    echo "Inner Claude produced no output. Check: docker logs $SANDBOX_NAME" >&2
    return 1
  fi

  # If the file is not valid JSON, it's probably a login/rate-limit message.
  if ! printf '%s' "$raw" | jq -e . >/dev/null 2>&1; then
    [ -s "$err_file" ] && cat "$err_file" >&2
    printf '%s\n' "$raw" >&2
    return 1
  fi

  local result is_error
  result="$(printf '%s' "$raw" | jq -r '.result // ""' 2>/dev/null || true)"
  is_error="$(printf '%s' "$raw" | jq -r '.is_error // false' 2>/dev/null || printf 'false')"

  if [ -n "$result" ]; then
    printf '%s\n' "$result"
    [ "$is_error" = "true" ] && return 1
    return 0
  fi

  # Success with an empty result is still success. Dumping the envelope here is
  # how an orchestrator retries a finished task.
  if [ "$is_error" != "true" ]; then
    return 0
  fi

  [ -s "$err_file" ] && cat "$err_file" >&2
  printf '%s\n' "$raw" >&2
  return 1
}
