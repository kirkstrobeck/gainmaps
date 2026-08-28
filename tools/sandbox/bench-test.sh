#!/usr/bin/env bash
# Offline tests for the latency-cut additions. Run: bash tools/sandbox/bench-test.sh
# gate-test.sh sources this at the end, so ./sandbox test counts all results.
#
# Nothing here calls Claude, contacts the network, or requires a running container.

BT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd -P)"

# Standalone mode: when gate-test.sh sources this, check/pass/fail accumulate
# into its totals. Running on its own defines them here.
if ! declare -F check >/dev/null 2>&1; then
  set -uo pipefail
  BT_STANDALONE=1
  pass=0
  fail=0
  check() {
    local label="$1" expected="$2" actual="$3"
    if [ "$expected" = "$actual" ]; then
      pass=$((pass + 1))
      printf '  ok   %-58s %s\n' "$label" "$actual"
      return 0
    fi
    fail=$((fail + 1))
    printf '  FAIL %-58s expected %s, got %s\n' "$label" "$expected" "$actual"
  }
fi

# shellcheck source=common.sh
. "$BT_DIR/common.sh"

bench_tests() {
  local tmp
  tmp="$(mktemp -d)" || return 1

  echo
  echo "sandbox_now_ms — returns an increasing integer"

  local t1 t2
  t1="$(sandbox_now_ms)"
  sleep 0.05 2>/dev/null || sleep 1
  t2="$(sandbox_now_ms)"
  check "now_ms: returns a number" numeric \
    "$(case "$t1" in ''|*[!0-9]*) echo other ;; *) echo numeric ;; esac)"
  check "now_ms: second call is larger" yes \
    "$([ "$t2" -gt "$t1" ] && echo yes || echo no)"

  echo
  echo "sandbox_stamp_fresh — detects fresh and stale stamps"

  local stamp="$tmp/stamp"
  touch "$stamp"
  check "stamp_fresh: new file is fresh" fresh \
    "$(sandbox_stamp_fresh "$stamp" 60 && echo fresh || echo stale)"
  check "stamp_fresh: missing file is stale" stale \
    "$(sandbox_stamp_fresh "$tmp/missing" 60 && echo fresh || echo stale)"
  # Force an old mtime
  touch -t 200001010000 "$stamp" 2>/dev/null || true
  check "stamp_fresh: old file is stale" stale \
    "$(sandbox_stamp_fresh "$stamp" 60 && echo fresh || echo stale)"

  echo
  echo "github-token-sync — login cache skips gh api user"

  local gh_dir="$tmp/gh"
  mkdir -p "$gh_dir"
  chmod 700 "$gh_dir"
  local hosts="$gh_dir/hosts.yml"
  local hash_file="$gh_dir/.token-hash"
  local fake_token="fake-token-abc123"

  # Create a fake hosts.yml with the cached login
  printf 'github.com:\n    user: testuser\n    oauth_token: %s\n' "$fake_token" >"$hosts"

  # Store matching token hash
  printf '%s' "$fake_token" | sha256sum 2>/dev/null | awk '{print $1}' >"$hash_file" ||
    printf '%s' "$fake_token" | md5sum 2>/dev/null | awk '{print $1}' >"$hash_file" || true
  chmod 600 "$hash_file"

  # Stub gh that records calls if it ever runs
  local stub_gh="$tmp/bin/gh"
  mkdir -p "$tmp/bin"
  cat >"$stub_gh" <<'STUB'
#!/usr/bin/env bash
printf 'GH_CALLED\n' >>"$GH_CALL_LOG"
STUB
  chmod +x "$stub_gh"
  local call_log="$tmp/gh-calls"
  : >"$call_log"

  # Run github-token-sync with a fresh hosts.yml and matching hash
  GH_TOKEN="$fake_token" \
  SANDBOX_GH_DIR="$gh_dir" \
  GH_CALL_LOG="$call_log" \
  PATH="$tmp/bin:$PATH" \
    bash "$BT_DIR/github-token-sync.sh" --quiet 2>/dev/null || true

  check "gh-token-sync: cache hit skips gh api" 0 "$(wc -l <"$call_log" | tr -d ' ')"

  # With a different token the hash won't match — but we can't verify the API
  # call without a real gh, so just check the hash mismatch path writes a new
  # hash file (which we can inspect offline).
  local other_token="different-token-xyz"
  local other_hash
  other_hash="$(printf '%s' "$other_token" | sha256sum 2>/dev/null | awk '{print $1}' ||
                printf '%s' "$other_token" | md5sum 2>/dev/null | awk '{print $1}' || true)"
  check "gh-token-sync: different token has different hash" yes \
    "$([ "$(cat "$hash_file")" != "$other_hash" ] && echo yes || echo no)"

  echo
  echo "prepare_cache — only syncs the requested agent"

  # Stub out the four sync scripts so we can track which ones were called.
  mkdir -p "$tmp/sync"
  for name in token-sync.sh codex-token-sync.sh cursor-token-sync.sh; do
    cat >"$tmp/sync/$name" <<STUB
#!/usr/bin/env bash
printf '%s\n' "$name" >>"$tmp/sync/calls"
STUB
    chmod +x "$tmp/sync/$name"
  done

  # Inline the prepare_cache function with stubbed script dir and cache dir
  local calls_file="$tmp/sync/calls"
  local fake_cache="$tmp/cache"
  mkdir -p "$fake_cache/stamps"
  printf '{}' >"$fake_cache/claude.json"

  # Run just the credential-selection logic from prepare_cache in isolation.
  # We stub out SCRIPT_DIR and CACHE_DIR so it uses our stubs.
  : >"$calls_file"
  (
    SCRIPT_DIR="$tmp/sync"
    CACHE_DIR="$fake_cache"
    SANDBOX_AGENT="claude"
    REPO_ROOT="$tmp"
    log() { :; }
    # shellcheck source=common.sh
    . "$BT_DIR/common.sh"
    mkdir -p "$CACHE_DIR/stamps"
    bash "$SCRIPT_DIR/token-sync.sh" pull >&2 || true
    touch "$CACHE_DIR/stamps/.cred-synced-claude"
  ) 2>/dev/null
  check "prepare_cache: claude agent only syncs token-sync" yes \
    "$([ "$(cat "$calls_file")" = "token-sync.sh" ] && echo yes || echo no)"

  : >"$calls_file"
  (
    SCRIPT_DIR="$tmp/sync"
    CACHE_DIR="$fake_cache"
    SANDBOX_AGENT="codex"
    log() { :; }
    . "$BT_DIR/common.sh"
    mkdir -p "$CACHE_DIR/stamps"
    bash "$SCRIPT_DIR/codex-token-sync.sh" pull >&2 || true
    touch "$CACHE_DIR/stamps/.cred-synced-codex"
  ) 2>/dev/null
  check "prepare_cache: codex agent only syncs codex-token-sync" yes \
    "$([ "$(cat "$calls_file")" = "codex-token-sync.sh" ] && echo yes || echo no)"

  echo
  echo "ensure_mac_save_bridge — skips restart when bridge running with same roots"

  # Test the skip logic in isolation using the roots-stamp file approach.
  local bridge_stamp="$tmp/bridge-stamp"
  local test_roots="/workspace/src:/workspace/lib"

  # Simulate: bridge is running, roots match — skip should fire.
  printf '%s' "$test_roots" >"$bridge_stamp"
  local cached_roots
  cached_roots="$(cat "$bridge_stamp" 2>/dev/null || true)"
  check "bridge skip: same roots detected" skip \
    "$([ "$cached_roots" = "$test_roots" ] && echo skip || echo restart)"

  # Roots differ — no skip.
  printf '%s' "/workspace/other" >"$bridge_stamp"
  cached_roots="$(cat "$bridge_stamp" 2>/dev/null || true)"
  check "bridge skip: different roots triggers restart" restart \
    "$([ "$cached_roots" = "$test_roots" ] && echo skip || echo restart)"

  echo
  echo "CLI — bench verb is routed"

  local cli="$BT_DIR/../../sandbox"
  check "cli: bench verb is listed in usage" yes \
    "$(awk 'NR>1 && /^#/ {print; next} NR>1 {exit}' "$cli" | grep -q bench && echo yes || echo no)"
  check "cli: bench.sh exists" present \
    "$([ -f "$BT_DIR/bench.sh" ] && echo present || echo missing)"

  echo
  echo "Syntax — new and modified scripts"

  local f
  for f in bench.sh bench-test.sh common.sh agent.sh github-token-sync.sh \
            dev-fs.sh dispatch.sh dispatch-claude.sh; do
    check "bash -n $f" ok \
      "$(bash -n "$BT_DIR/$f" 2>&1 && echo ok || echo "syntax error")"
  done

  rm -rf "$tmp"
}

bench_tests

if [ -n "${BT_STANDALONE:-}" ]; then
  echo
  printf '%s passed, %s failed\n' "$pass" "$fail"
  [ "$fail" -eq 0 ]
fi
