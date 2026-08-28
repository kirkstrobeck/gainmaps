#!/usr/bin/env bash
# Amp backend for dispatch.sh. Source, don't run.
#
# Amp authenticates via AMP_API_KEY. The key does not rotate, so this bridge
# is pull-only. The key is forwarded as an environment variable; no filesystem
# credential is mounted.
#
# Amp tracks work in "threads". After each run, the thread id is extracted
# from the JSONL stream and persisted; ./sandbox -c resumes it with
# `amp threads continue <id>`.
#
# --stream-json produces JSONL. The thread id lives in the thread.started
# event, same shape as Codex.

amp_result_from_stream() {
  local jsonl_file="$1" err_file="${2:-}"

  if [ ! -s "$jsonl_file" ]; then
    [ -s "$err_file" ] && cat "$err_file" >&2
    echo "Inner Amp produced no output. Check: docker logs $SANDBOX_NAME" >&2
    return 1
  fi

  local result
  result="$(jq -r 'select(.type == "result") | .result // empty' \
    "$jsonl_file" 2>/dev/null | tail -1 || true)"

  if [ -z "$result" ]; then
    # Amp fallback: last assistant message in the stream
    result="$(jq -r 'select(.type == "assistant") | .message // empty' \
      "$jsonl_file" 2>/dev/null | tail -1 || true)"
  fi

  if [ -z "$result" ]; then
    [ -s "$err_file" ] && cat "$err_file" >&2
    tail -20 "$jsonl_file" >&2 2>/dev/null || true
    echo "Inner Amp produced no final message." >&2
    return 1
  fi

  printf '%s\n' "$result"
}

dispatch_amp() {
  local continue_flag="$1" run_dir_host="$2" run_dir_ctr="$3"
  local thread_file="$CACHE_DIR/amp-thread"
  local thread_id=""

  if [ -n "$continue_flag" ] && [ -f "$thread_file" ]; then
    thread_id="$(cat "$thread_file" 2>/dev/null || true)"
  fi

  docker exec "$SANDBOX_NAME" pkill -f 'amp -x' >/dev/null 2>&1 || true

  # AMP_API_KEY from the host env is forwarded; if absent and not in the mounted
  # amp-home, the CLI will fail with an auth error.
  local amp_key="${AMP_API_KEY:-}"
  # Also read from cache if the token-sync wrote it there
  [ -z "$amp_key" ] && amp_key="$(cat "$CACHE_DIR/amp-home/.amp_api_key" 2>/dev/null || true)"

  docker exec -u agent -w /workspace \
    -e "MSG_FILE=$run_dir_ctr/msg" \
    -e "LOG_FILE=$run_dir_ctr/last.jsonl" \
    -e "ERR_FILE=$run_dir_ctr/last.err" \
    -e "THREAD_ID=$thread_id" \
    -e "AMP_API_KEY=${amp_key:-}" \
    -e "SANDBOX_INNER_MODEL=${SANDBOX_INNER_MODEL:-}" \
    -e "SANDBOX_MODEL_DAILY=${SANDBOX_MODEL_DAILY:-}" \
    "$SANDBOX_NAME" bash -lc '
      msg="$(cat "$MSG_FILE")"
      if [ -n "$THREAD_ID" ]; then
        set -- threads continue "$THREAD_ID"
      else
        set -- -x --dangerously-allow-all --stream-json
        [ -n "$SANDBOX_INNER_MODEL" ] && set -- "$@" --model "$SANDBOX_INNER_MODEL"
        set -- "$@" "$msg"
      fi
      amp "$@" >"$LOG_FILE" 2>"$ERR_FILE"
    ' </dev/null || true

  local new_thread
  new_thread="$(jq -r 'select(.type == "thread.started") | .thread_id' \
    "$run_dir_host/last.jsonl" 2>/dev/null | tail -1 || true)"
  [ -n "$new_thread" ] && printf '%s' "$new_thread" >"$thread_file"

  amp_result_from_stream "$run_dir_host/last.jsonl" "$run_dir_host/last.err"
}
