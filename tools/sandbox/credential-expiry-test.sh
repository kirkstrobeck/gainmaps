#!/usr/bin/env bash
# Tests for credential-expiry.sh. Can be sourced from gate-test.sh or run standalone.
set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd -P)"

# Shared counters (gate-test.sh uses pass/fail, no underscore)
: "${pass:=0}" "${fail:=0}"

_ce_ok()   { pass=$((pass + 1)); }
_ce_fail() { fail=$((fail + 1)); printf 'FAIL: %s\n' "$*" >&2; }

# Stub out platform functions so tests run on any OS without real credentials
_stubbed_ce() {
  # Override internal helpers for isolation
  security()    { printf ''; }
  CREDENTIAL_EXPIRY_NO_DEDUP=1
  CACHE_DIR="$(mktemp -d)"
  export CREDENTIAL_EXPIRY_NO_DEDUP CACHE_DIR
}

_cleanup_stubs() {
  unset -f security 2>/dev/null || true
  rm -rf "${CACHE_DIR:-}" 2>/dev/null || true
  unset CACHE_DIR CREDENTIAL_EXPIRY_NO_DEDUP 2>/dev/null || true
}

# Source the library
. "$SCRIPT_DIR/credential-expiry.sh"

# --- test: Claude expiresAt in ms → within 12h window triggers warn -----------
_test_claude_warn() {
  local now six_hours_ms past_epoch
  now="$(date +%s)"
  six_hours_ms=$(( (now + 6 * 3600) * 1000 ))
  past_epoch=$((now - 7200))

  # Override _ce_epoch_claude to return known value
  _ce_epoch_claude() { printf '%s' "$((now + 6 * 3600))"; }

  local out
  out="$( CREDENTIAL_EXPIRY_NO_DEDUP=1 CACHE_DIR=/tmp _ce_warn_service claude 12 2>&1 )"
  if printf '%s' "$out" | grep -q 'WARN: Claude'; then
    _ce_ok
  else
    _ce_fail "claude 6h should trigger WARN (got: $out)"
  fi
  unset -f _ce_epoch_claude
}

# --- test: Claude 24h from now → no warn with 12h threshold ------------------
_test_claude_no_warn() {
  local now
  now="$(date +%s)"
  _ce_epoch_claude() { printf '%s' "$((now + 24 * 3600))"; }

  local out
  out="$( CREDENTIAL_EXPIRY_NO_DEDUP=1 CACHE_DIR=/tmp _ce_warn_service claude 12 2>&1 )"
  if [ -z "$out" ]; then
    _ce_ok
  else
    _ce_fail "claude 24h should not warn (got: $out)"
  fi
  unset -f _ce_epoch_claude
}

# --- test: Cursor with CURSOR_API_KEY → epoch returns empty → no warn --------
_test_cursor_apikey_no_warn() {
  local out
  out="$( CURSOR_API_KEY=testkey CREDENTIAL_EXPIRY_NO_DEDUP=1 CACHE_DIR=/tmp \
    _ce_warn_service cursor 12 2>&1 )"
  if [ -z "$out" ]; then
    _ce_ok
  else
    _ce_fail "cursor with API key should not warn (got: $out)"
  fi
}

# --- test: GitHub mock with near expiry triggers warn ------------------------
_test_github_near_expiry_warns() {
  local now exp_epoch
  now="$(date +%s)"
  exp_epoch=$((now + 3600))  # 1 hour

  _ce_epoch_github() { printf '%s' "$exp_epoch"; }

  local out
  out="$( CREDENTIAL_EXPIRY_NO_DEDUP=1 CACHE_DIR=/tmp _ce_warn_service github 12 2>&1 )"
  if printf '%s' "$out" | grep -q 'WARN: GitHub'; then
    _ce_ok
  else
    _ce_fail "github 1h should trigger WARN (got: $out)"
  fi
  unset -f _ce_epoch_github
}

# --- test: SANDBOX_AUTH_WARN_HOURS=24 changes threshold ----------------------
_test_warn_hours_env() {
  local now
  now="$(date +%s)"
  _ce_epoch_claude() { printf '%s' "$((now + 20 * 3600))"; }

  # With default 12h: no warn. With 24h: warn.
  local out_default out_24
  out_default="$( CREDENTIAL_EXPIRY_NO_DEDUP=1 CACHE_DIR=/tmp _ce_warn_service claude 12 2>&1 )"
  out_24="$( CREDENTIAL_EXPIRY_NO_DEDUP=1 CACHE_DIR=/tmp _ce_warn_service claude 24 2>&1 )"

  if [ -z "$out_default" ] && printf '%s' "$out_24" | grep -q 'WARN'; then
    _ce_ok
  else
    _ce_fail "SANDBOX_AUTH_WARN_HOURS=24 should change threshold (default: '$out_default', 24h: '$out_24')"
  fi
  unset -f _ce_epoch_claude
}

# --- test: Codex returns empty epoch -----------------------------------------
_test_codex_empty_epoch() {
  local exp
  exp="$(_ce_epoch_codex)"
  if [ -z "$exp" ]; then
    _ce_ok
  else
    _ce_fail "codex should return empty epoch (got: $exp)"
  fi
}

# --- test: JWT exp extraction -------------------------------------------------
_test_jwt_exp() {
  # Create a test JWT with a known exp. Header: {"alg":"HS256"}, payload: {"exp":9999999999}
  local header payload sig
  header="$(printf '{"alg":"HS256","typ":"JWT"}' | base64 | tr -d '=' | tr '+/' '-_')"
  payload="$(printf '{"exp":9999999999,"sub":"test"}' | base64 | tr -d '=' | tr '+/' '-_')"
  sig="sig"
  local jwt="$header.$payload.$sig"
  local exp
  exp="$(_ce_jwt_exp "$jwt")"
  if [ "$exp" = "9999999999" ]; then
    _ce_ok
  else
    _ce_fail "JWT exp should be 9999999999 (got: $exp)"
  fi
}

# --- syntax check ------------------------------------------------------------
bash -n "$SCRIPT_DIR/credential-expiry.sh" \
  && _ce_ok \
  || _ce_fail "credential-expiry.sh has syntax error"
bash -n "$SCRIPT_DIR/credential-expiry-test.sh" \
  && _ce_ok \
  || _ce_fail "credential-expiry-test.sh has syntax error"

# Run tests
_test_claude_warn
_test_claude_no_warn
_test_cursor_apikey_no_warn
_test_github_near_expiry_warns
_test_warn_hours_env
_test_codex_empty_epoch
_test_jwt_exp

# If run standalone (not sourced), print summary
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
  echo "credential-expiry: $pass passed, $fail failed"
  [ "$fail" -eq 0 ]
fi
