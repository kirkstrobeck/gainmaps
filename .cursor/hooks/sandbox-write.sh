#!/usr/bin/env bash
# Cursor preToolUse(Write) hook. Reads stdin JSON, delegates to the shared
# outer-write-gate.sh with GATE_PROTOCOL=cursor. Also used for Delete.
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd -P)"
export GATE_PROTOCOL=cursor
exec bash "$SCRIPT_DIR/../../tools/sandbox/outer-write-gate.sh"
