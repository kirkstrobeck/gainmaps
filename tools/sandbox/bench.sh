#!/usr/bin/env bash
# ./sandbox bench — time a canonical dispatch and print the result in ms.
#
# Warms the container first so the number reflects dispatch latency on a
# running box, not image build or container start time. Verifies that the
# inner agent actually wrote foo.md, then deletes it.
#
# Environment:
#   SANDBOX_BENCH_AGENT      agent to use (default: claude)
#   SANDBOX_BENCH_BUDGET_MS  exit 1 when slower than this (default: 2270)
#   SANDBOX_TIMING=1         print per-stage breakdown via dispatch.sh

set -uo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd -P)"
# shellcheck source=common.sh
. "$SCRIPT_DIR/common.sh"

BENCH_AGENT="${SANDBOX_BENCH_AGENT:-claude}"
export SANDBOX_AGENT="$BENCH_AGENT"
BENCH_BUDGET="${SANDBOX_BENCH_BUDGET_MS:-2270}"
BENCH_PROMPT="Write a file named foo.md at the repository root that contains exactly the word foo followed by a newline. Do not commit. Do not run tests. Do not create any other files."
FOO="$REPO_ROOT/foo.md"

# Always emit stage timings on stderr for bench runs.
export SANDBOX_TIMING=1

# Warm the container so we are measuring dispatch latency, not image build.
bash "$SCRIPT_DIR/boot.sh" >/dev/null 2>&1

t0="$(sandbox_now_ms)"
bash "$SCRIPT_DIR/dispatch.sh" -a "$BENCH_AGENT" "$BENCH_PROMPT" >/dev/null
t1="$(sandbox_now_ms)"
elapsed=$(( t1 - t0 ))

rc=0
if [ -f "$FOO" ]; then
  contents="$(cat "$FOO")"
  rm -f "$FOO"
  # Accept "foo" or "foo\n" — the agent may or may not include the trailing newline.
  case "$contents" in
    foo|"foo
") ;;
    *) printf 'bench: %dms (foo.md content wrong: %s)\n' "$elapsed" "$contents" >&2; rc=1 ;;
  esac
else
  printf 'bench: %dms (foo.md not written)\n' "$elapsed" >&2
  rc=1
fi

printf 'bench: %dms\n' "$elapsed"

if [ "$rc" -eq 0 ] && [ -n "${SANDBOX_BENCH_BUDGET_MS:-}" ] && [ "$elapsed" -gt "$BENCH_BUDGET" ]; then
  printf 'bench: OVER BUDGET %dms > %dms\n' "$elapsed" "$BENCH_BUDGET" >&2
  rc=1
fi

exit "$rc"
