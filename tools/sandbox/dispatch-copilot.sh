#!/usr/bin/env bash
# GitHub Copilot backend for dispatch.sh. Source, don't run.
#
# Copilot authenticates through the bridged GitHub OAuth token. Inside the
# container gh is configured from the mounted ~/.config/gh directory, so
# `gh auth token` returns the token without any extra setup. The env var
# COPILOT_GITHUB_TOKEN is what the CLI reads.
#
# Copilot has no --continue / resume mechanism. ./sandbox -c is silently
# accepted (the flag is dropped) and a fresh session starts. Document this
# clearly rather than crashing on it.
#
# Output is plain text, not stream-json, so tail.sh falls back to the
# process-alive path rather than rendering JSONL.
#
# Flags (verify against `copilot --help` if behavior changes):
#   -p             print mode, non-interactive
#   --autopilot    skip all approval prompts
#   --no-ask-user  never prompt the user for input
#   --allow-all    allow every tool / command

copilot_result_from_file() {
  local txt_file="$1" err_file="${2:-}"
  if [ ! -s "$txt_file" ]; then
    [ -s "$err_file" ] && cat "$err_file" >&2
    echo "Inner Copilot produced no output. Check: docker logs $SANDBOX_NAME" >&2
    return 1
  fi
  cat "$txt_file"
}

dispatch_copilot() {
  local continue_flag="$1" run_dir_host="$2" run_dir_ctr="$3"

  if [ -n "$continue_flag" ]; then
    echo "WARN: Copilot has no --continue mechanism; starting a fresh session." >&2
  fi

  docker exec "$SANDBOX_NAME" pkill -f 'copilot -p' >/dev/null 2>&1 || true

  docker exec -u agent -w /workspace \
    -e "MSG_FILE=$run_dir_ctr/msg" \
    -e "OUT_FILE=$run_dir_ctr/last.txt" \
    -e "ERR_FILE=$run_dir_ctr/last.err" \
    -e "SANDBOX_INNER_MODEL=${SANDBOX_INNER_MODEL:-}" \
    -e "SANDBOX_MODEL_DAILY=${SANDBOX_MODEL_DAILY:-}" \
    "$SANDBOX_NAME" bash -lc '
      msg="$(cat "$MSG_FILE")"
      export COPILOT_GITHUB_TOKEN="$(gh auth token 2>/dev/null || true)"
      set -- -p --autopilot --no-ask-user --allow-all
      [ -n "$SANDBOX_INNER_MODEL" ] && set -- "$@" --model "$SANDBOX_INNER_MODEL"
      copilot "$@" "$msg" >"$OUT_FILE" 2>"$ERR_FILE"
    ' </dev/null || true

  copilot_result_from_file "$run_dir_host/last.txt" "$run_dir_host/last.err"
}
