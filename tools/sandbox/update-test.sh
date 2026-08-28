#!/usr/bin/env bash
# Tests for sandbox_autoupdate_should. Run: bash tools/sandbox/update-test.sh
#
# gate-test.sh sources this so the check/pass/fail counters accumulate into
# the harness-wide total. Run on its own it defines its own counters.
#
# NOTHING HERE TOUCHES THE NETWORK, runs install.sh, or modifies the repo.
# sandbox_autoupdate_should is a pure predicate whose inputs are all passed as
# positional arguments, so every case here is fully offline.

UT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd -P)"

# Standalone mode — when gate-test.sh sources this, check/pass/fail are already
# defined and the counts have to keep accumulating into its totals.
if ! declare -F check >/dev/null 2>&1; then
  set -uo pipefail
  UT_STANDALONE=1
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

# Source update.sh to get sandbox_autoupdate_should and related functions.
# update.sh has a [ "${BASH_SOURCE[0]}" = "$0" ] guard so main() will not run
# when sourced. We capture the env-beat-config vars before sourcing so they are
# not clobbered by common.sh / config.sh defaults.
if ! declare -F sandbox_autoupdate_should >/dev/null 2>&1; then
  UPDATE_CHECK_ENV="${SANDBOX_UPDATE_CHECK:-}"
  AUTOUPDATE_ENV="${SANDBOX_AUTOUPDATE:-}"
  # shellcheck source=update.sh
  . "$UT_DIR/update.sh"
fi

update_tests() {
  echo
  echo "sandbox_autoupdate_should — autoupdate predicate"

  # Two distinct 40-char shas so the "different" case is unambiguous.
  local HS="aaaa000000000000000000000000000000000000"
  local LC="bbbb000000000000000000000000000000000000"
  local HR="kirkstrobeck/sandbox"
  local HF="main"

  # autoupdate_on=1, update_check_off=0, source_repo=0 is the "all clear" state.

  check "should: different sha + autoupdate on + matching origin → yes" yes \
    "$(sandbox_autoupdate_should "$HS" "$LC" "$HR" "$HF" "$HR" "$HF" 1 0 0 && echo yes || echo no)"

  check "should: current sha → no" no \
    "$(sandbox_autoupdate_should "$HS" "$HS" "$HR" "$HF" "$HR" "$HF" 1 0 0 && echo yes || echo no)"

  check "should: autoupdate off → no" no \
    "$(sandbox_autoupdate_should "$HS" "$LC" "$HR" "$HF" "$HR" "$HF" 0 0 0 && echo yes || echo no)"

  check "should: UPDATE_CHECK=0 → no" no \
    "$(sandbox_autoupdate_should "$HS" "$LC" "$HR" "$HF" "$HR" "$HF" 1 1 0 && echo yes || echo no)"

  check "should: empty harness sha → no" no \
    "$(sandbox_autoupdate_should ""    "$LC" "$HR" "$HF" "$HR" "$HF" 1 0 0 && echo yes || echo no)"

  check "should: empty local commit → no" no \
    "$(sandbox_autoupdate_should "$HS" ""    "$HR" "$HF" "$HR" "$HF" 1 0 0 && echo yes || echo no)"

  check "should: source repo present → no" no \
    "$(sandbox_autoupdate_should "$HS" "$LC" "$HR" "$HF" "$HR" "$HF" 1 0 1 && echo yes || echo no)"

  check "should: origin repo mismatch → no" no \
    "$(sandbox_autoupdate_should "$HS" "$LC" "$HR" "$HF" "other/sandbox" "$HF" 1 0 0 && echo yes || echo no)"

  check "should: origin ref mismatch → no" no \
    "$(sandbox_autoupdate_should "$HS" "$LC" "$HR" "$HF" "$HR" "dev" 1 0 0 && echo yes || echo no)"

  # Default for autoupdate_on is now 0 (off). Omitting arg 7 must mean no.
  check "should: default autoupdate off (no arg 7) → no" no \
    "$(sandbox_autoupdate_should "$HS" "$LC" "$HR" "$HF" "$HR" "$HF" && echo yes || echo no)"

  echo
  echo "Syntax — update.sh and update-test.sh"
  check "bash -n update.sh" ok \
    "$(bash -n "$UT_DIR/update.sh" 2>&1 && echo ok || echo "syntax error")"
  check "bash -n update-test.sh" ok \
    "$(bash -n "$UT_DIR/update-test.sh" 2>&1 && echo ok || echo "syntax error")"

  echo
  echo "update.sh re-exec — self-overwrite exits 0"
  # Create a minimal offline environment: a fake project + a fake source whose
  # install.sh overwrites update.sh in the target, simulating the real scenario.
  # No network is involved because --from uses a local path.
  _ut_proj="$(mktemp -d)"
  _ut_src="$(mktemp -d)"
  mkdir -p "$_ut_proj/tools/sandbox" "$_ut_src/tools/sandbox"
  # Give the fake project a complete tools/sandbox so common.sh, manifest.sh etc. work.
  cp "$UT_DIR"/*.sh "$UT_DIR/MANIFEST" "$_ut_proj/tools/sandbox/" 2>/dev/null || true
  # The fake source's MANIFEST lists update.sh as a replace file.
  cp "$UT_DIR/MANIFEST" "$_ut_src/tools/sandbox/"
  # The fake install.sh overwrites update.sh to simulate the real self-overwrite.
  printf '#!/usr/bin/env bash\nprintf "# replaced\n" > "%s/tools/sandbox/update.sh"\n' \
    "$_ut_proj" >"$_ut_src/install.sh"
  chmod 755 "$_ut_src/install.sh"
  _ut_rc=0
  SANDBOX_TARGET="$_ut_proj" bash "$_ut_proj/tools/sandbox/update.sh" \
    --from "$_ut_src" 2>/dev/null || _ut_rc=$?
  check "update: self-overwrite exits 0" 0 "$_ut_rc"
  rm -rf "$_ut_proj" "$_ut_src"
}

update_tests

if [ -n "${UT_STANDALONE:-}" ]; then
  echo
  printf '%s passed, %s failed\n' "$pass" "$fail"
  [ "$fail" -eq 0 ]
fi
