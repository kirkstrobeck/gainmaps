#!/usr/bin/env bash
# Show what the inner agent is doing right now.
#
#   bash tools/sandbox/tail.sh          # last 40 steps of the current run
#   bash tools/sandbox/tail.sh -f       # follow until the run ends
#
# A dispatch prints one answer at the end and nothing in between, which for a
# ten-minute task looks identical to a hang. This renders the inner transcript
# as a progress readout so the human can see it working.

set -uo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd -P)"
# shellcheck source=common.sh
. "$SCRIPT_DIR/common.sh"

RUN_DIR="$CACHE_DIR/run"
follow=0
[ "${1:-}" = "-f" ] || [ "${1:-}" = "--follow" ] && follow=1

# Codex and Cursor both stream JSONL as they go, into the same last.jsonl;
# Claude's `-p --output-format json` writes one object at the end, so for Claude
# the honest live signal is the process itself.
#
# The two streams are told apart by their own line shapes rather than by a flag,
# because tail.sh has no idea which agent ran and the file does.
render_stream() {
  jq -r '
    if .type == "item.completed" then
      # Codex
      (.item.type) as $t
      | if $t == "agent_message" then "· " + (.item.text // "" | .[0:400])
        elif $t == "command_execution" then "$ " + (.item.command // "")
        elif $t == "file_change" then "~ " + ((.item.changes // []) | map(.path) | join(", "))
        elif $t == "reasoning" then "  " + (.item.text // "" | .[0:200])
        else "· " + $t end
    elif .type == "assistant" then
      # Cursor: text is a content array, flushed at each tool-call boundary.
      "· " + ([.message.content[]? | select(.type == "text") | .text] | add // "" | .[0:400])
    elif .type == "tool_call" and .subtype == "started" then
      # The tool call is a protobuf oneof, so the tool name is the single key
      # inside it and the shape below that varies per tool.
      (.tool_call // {} | keys_unsorted[0] // "tool") as $t
      | "$ " + ($t | sub("ToolCall$"; ""))
        + ((.tool_call[$t]?.args?.command // .tool_call[$t]?.args?.path // "")
           | if . == "" then "" else " " + (. | tostring | .[0:200]) end)
    elif .type == "thinking" then empty
    else empty end' 2>/dev/null
}

if [ -f "$RUN_DIR/last.jsonl" ]; then
  if [ "$follow" = 1 ]; then
    tail -f -n 40 "$RUN_DIR/last.jsonl" | render_stream
    exit 0
  fi
  tail -n 40 "$RUN_DIR/last.jsonl" | render_stream
  exit 0
fi

sandbox_docker_host
if docker exec "$SANDBOX_NAME" pgrep -f 'cursor-agent' >/dev/null 2>&1; then
  echo "Inner Cursor is starting; its stream appears here once the first line lands."
  exit 0
fi
if docker exec "$SANDBOX_NAME" pgrep -f 'agy -p' >/dev/null 2>&1; then
  echo "Inner agy is starting; its stream appears here once the first line lands."
  exit 0
fi
if docker exec "$SANDBOX_NAME" pgrep -f 'claude -p' >/dev/null 2>&1; then
  echo "Inner Claude is running. Its transcript arrives all at once when it finishes."
  echo "Recover it any time with: bash tools/sandbox/dispatch.sh --result"
  exit 0
fi
if docker exec "$SANDBOX_NAME" pgrep -f 'copilot -p' >/dev/null 2>&1; then
  echo "Inner Copilot is running. Its answer arrives when it finishes."
  echo "Recover it any time with: ./sandbox result"
  exit 0
fi
if docker exec "$SANDBOX_NAME" pgrep -x 'amp' >/dev/null 2>&1; then
  echo "Inner Amp is running."
  exit 0
fi
if docker exec "$SANDBOX_NAME" pgrep -f 'opencode run' >/dev/null 2>&1; then
  echo "Inner OpenCode is running."
  exit 0
fi

if [ -f "$RUN_DIR/last.json" ]; then
  jq -r '"finished in \((.duration_ms // 0) / 1000 | floor)s, \(.num_turns // 0) turns"' \
    "$RUN_DIR/last.json" 2>/dev/null || true
  exit 0
fi

echo "No inner run has happened yet."
