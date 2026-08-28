#!/usr/bin/env bash
# OpenCode backend for dispatch.sh. Source, don't run.
#
# OpenCode is a BYOK (bring-your-own-key) agent: it reads provider API keys
# from its config dir (~/.config/opencode/, mounted at /home/agent/.config/opencode).
# There is no separate credential bridge — the user populates their opencode
# config before running, and the mounted directory carries it in.
#
# opencode run -p delivers the answer on stdout (plain text). If -c is
# supported by the installed version it is passed through; if the CLI does not
# recognise it the run still starts, so the flag is advisory.
#
# Output is plain text, not stream-json. tail.sh falls back to process-alive.

opencode_result_from_file() {
  local txt_file="$1" err_file="${2:-}"
  if [ ! -s "$txt_file" ]; then
    [ -s "$err_file" ] && cat "$err_file" >&2
    echo "Inner OpenCode produced no output. Check: docker logs $SANDBOX_NAME" >&2
    return 1
  fi
  cat "$txt_file"
}

dispatch_opencode() {
  local continue_flag="$1" run_dir_host="$2" run_dir_ctr="$3"

  docker exec "$SANDBOX_NAME" pkill -f 'opencode run' >/dev/null 2>&1 || true

  docker exec -u agent -w /workspace \
    -e "MSG_FILE=$run_dir_ctr/msg" \
    -e "OUT_FILE=$run_dir_ctr/last.txt" \
    -e "ERR_FILE=$run_dir_ctr/last.err" \
    -e "CONT_FLAG=$continue_flag" \
    -e "SANDBOX_INNER_MODEL=${SANDBOX_INNER_MODEL:-}" \
    -e "SANDBOX_MODEL_DAILY=${SANDBOX_MODEL_DAILY:-}" \
    "$SANDBOX_NAME" bash -lc '
      msg="$(cat "$MSG_FILE")"
      set -- run -p $CONT_FLAG
      [ -n "$SANDBOX_INNER_MODEL" ] && set -- "$@" --model "$SANDBOX_INNER_MODEL"
      opencode "$@" -- "$msg" >"$OUT_FILE" 2>"$ERR_FILE"
    ' </dev/null || true

  opencode_result_from_file "$run_dir_host/last.txt" "$run_dir_host/last.err"
}
