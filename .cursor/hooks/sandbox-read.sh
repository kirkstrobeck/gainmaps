#!/usr/bin/env bash
# Cursor beforeReadFile hook.
#
# The outer agent is allowed to READ the repo — that is how it writes a
# dispatch that is not a guess. The write gate's allowlist does not apply here.
# The only path that must not be read is tools/sandbox/.cache/, which holds
# live OAuth tokens.
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd -P)"
# shellcheck source=../../tools/sandbox/gate-lib.sh
. "$SCRIPT_DIR/../../tools/sandbox/gate-lib.sh"
export GATE_PROTOCOL=cursor

gate_bypass_if_inner

payload="$(gate_read_payload)"
raw="$(printf '%s' "$payload" | jq -r '.file_path // .tool_input.file_path // empty' 2>/dev/null)"
[ -z "$raw" ] && allow "no path to evaluate"

case "$raw" in
  /*) path="$raw" ;;
  *) path="$PWD/$raw" ;;
esac

case "$path/" in
  "$PROJECT_ROOT/tools/sandbox/.cache/"*)
    deny "tools/sandbox/.cache holds live credentials. Never read it. $DISPATCH_MSG" ;;
esac

allow "outer agent may read the repo"
