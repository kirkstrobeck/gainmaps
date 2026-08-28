#!/usr/bin/env bash
# Run a command inside the sandbox, or open a shell in it.
#
#   bash tools/sandbox/run.sh                 # interactive shell in /workspace
#   bash tools/sandbox/run.sh pnpm test       # one command, exit code preserved
#
# This is for a human. The outer agent does not get to use it as a bypass — the
# Bash gate only lets it start the sandbox scripts, and anything an agent wants
# run inside belongs in a dispatch so the inner agent owns the whole task.

set -uo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd -P)"
# shellcheck source=common.sh
. "$SCRIPT_DIR/common.sh"

container="$(bash "$SCRIPT_DIR/boot.sh")" || exit 1

# -t only when there really is a terminal, otherwise docker mangles piped output
# with carriage returns and CI logs come out unreadable.
tty_flags=(-i)
[ -t 0 ] && [ -t 1 ] && tty_flags=(-it)

if [ $# -eq 0 ]; then
  exec docker exec "${tty_flags[@]}" -u agent -w /workspace "$container" bash -l
fi

exec docker exec "${tty_flags[@]}" -u agent -w /workspace "$container" \
  bash -lc 'exec "$@"' _ "$@"
