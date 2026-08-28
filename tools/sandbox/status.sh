#!/usr/bin/env bash
# What is running, and how to stop it.
#
#   bash tools/sandbox/status.sh          show state
#   bash tools/sandbox/status.sh --stop   stop the container (cache is kept)

set -uo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd -P)"
# shellcheck source=common.sh
. "$SCRIPT_DIR/common.sh"
# shellcheck source=dev-fs.sh
. "$SCRIPT_DIR/dev-fs.sh"

sandbox_docker_host

if [ "${1:-}" = "--stop" ]; then
  docker stop "$SANDBOX_NAME" >/dev/null 2>&1 && echo "Stopped $SANDBOX_NAME."
  # Credentials and node_modules survive on purpose: stopping is a pause, not a
  # reset. `docker rm -f` plus removing tools/sandbox/.cache is the real reset.
  exit 0
fi

echo "project    $SANDBOX_PROJECT"
echo "container  $SANDBOX_NAME"
echo "image      $SANDBOX_IMAGE (stack $SANDBOX_STACK)"

state="$(docker inspect -f '{{.State.Status}}' "$SANDBOX_NAME" 2>/dev/null || echo "not created")"
echo "state      $state"

if [ "$state" != "running" ]; then
  echo
  echo "Start it with: ./sandbox up"
  exit 0
fi

ports="$(docker inspect -f '{{range $p, $c := .NetworkSettings.Ports}}{{$p}} {{end}}' "$SANDBOX_NAME" 2>/dev/null || true)"
echo "ports      ${ports:-none}"

bridge="stopped"
bridge_running && bridge="watching $(watch_roots | tr ':' ' ')"
echo "hot-reload $bridge"

busy=""
docker exec "$SANDBOX_NAME" pgrep -f 'claude -p' >/dev/null 2>&1 && busy="claude"
docker exec "$SANDBOX_NAME" pgrep -f 'codex exec' >/dev/null 2>&1 && busy="codex"
docker exec "$SANDBOX_NAME" pgrep -f 'cursor-agent' >/dev/null 2>&1 && busy="cursor"
docker exec "$SANDBOX_NAME" pgrep -f 'copilot -p' >/dev/null 2>&1 && busy="copilot"
docker exec "$SANDBOX_NAME" pgrep -f 'agy -p' >/dev/null 2>&1 && busy="agy"
docker exec "$SANDBOX_NAME" pgrep -x 'amp' >/dev/null 2>&1 && busy="amp"
docker exec "$SANDBOX_NAME" pgrep -f 'opencode run' >/dev/null 2>&1 && busy="opencode"
echo "inner run  ${busy:-idle}"
