#!/usr/bin/env bash
# Cursor beforeShellExecution hook. Reads stdin JSON {command:...}, delegates
# to the shared outer-gate.sh with GATE_PROTOCOL=cursor so the response is
# shaped for Cursor rather than Claude Code.
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd -P)"
export GATE_PROTOCOL=cursor
exec bash "$SCRIPT_DIR/../../tools/sandbox/outer-gate.sh"
