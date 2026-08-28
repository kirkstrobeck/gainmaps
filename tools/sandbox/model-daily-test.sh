#!/usr/bin/env bash
# Tests for the daily model snapshot and the manager-model resolution that
# reads it. Run: bash tools/sandbox/model-daily-test.sh
#
# gate-test.sh sources this at the end, so `./sandbox test` reports one set of
# counts for the whole harness. Run on its own it defines its own check/pass/
# fail in the same style and prints its own totals.
#
# NOTHING HERE TOUCHES THE NETWORK, and nothing here touches the developer's
# real snapshot. Every case runs against a private mktemp directory with
# SANDBOX_MODEL_DAILY_FETCH_CMD pointed at a stub — which is the reason that
# hook exists in model-daily.sh at all.

MD_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd -P)"

# Standalone mode. When gate-test.sh sources this, check/pass/fail are already
# defined and the counts have to keep accumulating into its totals.
if ! declare -F check >/dev/null 2>&1; then
  set -uo pipefail
  MD_STANDALONE=1
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

# shellcheck source=model-daily.sh
. "$MD_DIR/model-daily.sh"
# shellcheck source=model.sh
. "$MD_DIR/model.sh"

md_field() { sed -n "s/^$2=//p" "$1" 2>/dev/null | head -1; }

model_daily_tests() {
  local tmp stub_ok stub_fail stub_never log file out
  tmp="$(mktemp -d)" || return 1

  # The environment this runs in may well be a dispatch, which exports all
  # three of these. Left set, they would decide the answers being asserted.
  unset SANDBOX_MODEL SANDBOX_DEFAULT_MODEL SANDBOX_MODEL_DAILY
  export SANDBOX_MODEL_DAILY_MAX_AGE=86400

  # Prevent any network call for the harness sha in _sandbox_model_daily_write.
  # Setting the variable (even to "") activates the env-override path that skips
  # curl. Tests that need a specific sha override this below.
  export SANDBOX_MODEL_DAILY_HARNESS_SHA=""
  export SANDBOX_MODEL_DAILY_HARNESS_REPO=""
  export SANDBOX_MODEL_DAILY_HARNESS_REF=""

  log="$tmp/fetches"
  export MD_FETCH_LOG="$log"
  : >"$log"

  stub_ok="$tmp/fetch-ok.sh"
  cat >"$stub_ok" <<'STUB'
#!/usr/bin/env bash
printf '%s\n' "$1" >>"$MD_FETCH_LOG"
printf '<html><body><p>Claude Opus promo: free tokens this week</p>'
printf '<p>Sonnet pricing unchanged</p><p>gpt and grok plan notes</p></body></html>\n'
STUB

  # A fetch that must never run. It records the call so the assertion can see
  # it, then produces nothing.
  stub_never="$tmp/fetch-never.sh"
  cat >"$stub_never" <<'STUB'
#!/usr/bin/env bash
printf 'CALLED %s\n' "$1" >>"$MD_FETCH_LOG"
STUB

  # Every failure mode at once: no output, nonzero exit.
  stub_fail="$tmp/fetch-fail.sh"
  cat >"$stub_fail" <<'STUB'
#!/usr/bin/env bash
printf '%s\n' "$1" >>"$MD_FETCH_LOG"
exit 1
STUB
  chmod +x "$stub_ok" "$stub_never" "$stub_fail"

  file="$tmp/daily"
  export SANDBOX_MODEL_DAILY_FILE="$file"

  echo
  echo "Daily snapshot — missing, fresh, stale"

  # 1. Missing file: it gets written, and the text comes back on stdout.
  export SANDBOX_MODEL_DAILY_FETCH_CMD="bash $stub_ok"
  out="$(sandbox_model_daily_ensure)"
  check "ensure: writes the file when it is missing" present \
    "$([ -f "$file" ] && echo present || echo missing)"
  check "ensure: prints the snapshot" ok "$(md_field "$file" status)"
  check "ensure: stdout is the file" same \
    "$([ "$out" = "$(cat "$file")" ] && echo same || echo different)"
  check "ensure: fetched every source once" 13 "$(wc -l <"$log" | tr -d ' ')"
  check "ensure: digest kept a promo line" found \
    "$(grep -qi 'promo' "$file" && echo found || echo missing)"
  check "ensure: file is not world-readable" 600 \
    "$(stat -c %a "$file" 2>/dev/null || stat -f %Lp "$file" 2>/dev/null)"

  # 2. Fresh file: no fetch at all. The stub would log a call if it ran.
  : >"$log"
  export SANDBOX_MODEL_DAILY_FETCH_CMD="bash $stub_never"
  out="$(sandbox_model_daily_ensure)"
  check "fresh: no fetch is attempted" 0 "$(wc -l <"$log" | tr -d ' ')"
  check "fresh: still prints the snapshot" ok "$(md_field "$file" status)"
  check "fresh: sandbox_model_daily_fresh agrees" fresh \
    "$(sandbox_model_daily_fresh && echo fresh || echo stale)"

  # 3. Stale file: refetched and overwritten. The BSD/GNU-portable -t form,
  # because this suite runs on the Mac and inside the container.
  : >"$log"
  printf 'status=stale-marker\n' >"$file"
  touch -t 200001010000 "$file"
  check "stale: fresh() says stale" stale \
    "$(sandbox_model_daily_fresh && echo fresh || echo stale)"
  check "stale: age is over a day" old \
    "$([ "$(sandbox_model_daily_age)" -gt 86400 ] && echo old || echo young)"
  export SANDBOX_MODEL_DAILY_FETCH_CMD="bash $stub_ok"
  sandbox_model_daily_ensure >/dev/null
  check "stale: refetches" 13 "$(wc -l <"$log" | tr -d ' ')"
  check "stale: overwrites the old content" gone \
    "$(grep -q 'stale-marker' "$file" && echo present || echo gone)"

  # 6. A fetch that fails end to end still leaves a timestamped stub, so the
  # next dispatch inside MAX_AGE does not try again. This is the whole reason
  # the file is written on the failure path.
  echo
  echo "Daily snapshot — failure is written down, not retried"
  rm -f "$file"
  : >"$log"
  export SANDBOX_MODEL_DAILY_FETCH_CMD="bash $stub_fail"
  local rc
  out="$(sandbox_model_daily_ensure)"; rc=$?
  check "fetch failure: ensure still succeeds" 0 "$rc"
  check "fetch failure: file is still written" present \
    "$([ -f "$file" ] && echo present || echo missing)"
  check "fetch failure: status is unavailable" unavailable "$(md_field "$file" status)"
  check "fetch failure: fetched_at is a timestamp" numeric \
    "$(case "$(md_field "$file" fetched_at)" in ''|*[!0-9]*) echo other ;; *) echo numeric ;; esac)"
  : >"$log"
  export SANDBOX_MODEL_DAILY_FETCH_CMD="bash $stub_never"
  sandbox_model_daily_ensure >/dev/null
  check "fetch failure: next ensure does not retry" 0 "$(wc -l <"$log" | tr -d ' ')"

  # 5. The default path. TMPDIR is given a trailing slash on purpose: that is
  # what macOS hands every process, and it must not produce a doubled slash.
  echo
  echo "Daily snapshot — default path is TMPDIR"
  unset SANDBOX_MODEL_DAILY_FILE
  mkdir -p "$tmp/tmpdir"
  TMPDIR="$tmp/tmpdir/" \
    SANDBOX_MODEL_DAILY_FETCH_CMD="bash $stub_ok" \
    bash -c '. "$1/model-daily.sh"; sandbox_model_daily_ensure' _ "$MD_DIR" >/dev/null
  check "default path: TMPDIR/sandbox-model-daily" present \
    "$([ -f "$tmp/tmpdir/sandbox-model-daily" ] && echo present || echo missing)"
  check "default path: no doubled separator" clean \
    "$(case "$(TMPDIR="$tmp/tmpdir/" _sandbox_model_daily_path)" in *//*) echo doubled ;; *) echo clean ;; esac)"
  export SANDBOX_MODEL_DAILY_FILE="$tmp/nonexistent"

  # Harness autoupdate keys — written from SANDBOX_MODEL_DAILY_HARNESS_SHA env
  # without going through the product-page fetch path (FETCH_CMD / MD_FETCH_LOG).
  echo
  echo "Daily snapshot — harness autoupdate keys"
  export SANDBOX_MODEL_DAILY_FILE="$file"
  rm -f "$file"
  : >"$log"
  export SANDBOX_MODEL_DAILY_FETCH_CMD="bash $stub_ok"
  export SANDBOX_MODEL_DAILY_HARNESS_SHA="abc123sha"
  export SANDBOX_MODEL_DAILY_HARNESS_REPO=""
  export SANDBOX_MODEL_DAILY_HARNESS_REF=""
  sandbox_model_daily_ensure >/dev/null
  check "harness sha: recorded from env" abc123sha "$(md_field "$file" harness_sha)"
  check "harness autoupdate: written as 1" 1 "$(md_field "$file" harness_autoupdate)"
  check "harness repo: env override recorded" "" "$(md_field "$file" harness_repo)"
  check "harness ref: env override recorded" "" "$(md_field "$file" harness_ref)"
  check "harness sha: no extra fetch-log entries" 13 "$(wc -l <"$log" | tr -d ' ')"

  # Empty sha: all harness_* keys are still written (fail-open design).
  rm -f "$file"
  export SANDBOX_MODEL_DAILY_HARNESS_SHA=""
  sandbox_model_daily_ensure >/dev/null
  check "harness sha empty: harness_sha key present" present \
    "$(grep -q '^harness_sha=' "$file" && echo present || echo absent)"
  check "harness sha empty: harness_autoupdate still 1" 1 "$(md_field "$file" harness_autoupdate)"

  # Restore for manager resolution tests.
  export SANDBOX_MODEL_DAILY_FILE="$tmp/nonexistent"
  export SANDBOX_MODEL_DAILY_HARNESS_SHA=""
  export SANDBOX_MODEL_DAILY_HARNESS_REPO=""
  export SANDBOX_MODEL_DAILY_HARNESS_REF=""

  # 4. Manager resolution. Each case leaves exactly one source of an answer
  # standing, because that is the only way to prove the order.
  echo
  echo "Manager model — resolution order"
  unset SANDBOX_MODEL_DAILY_FETCH_CMD
  # Every case below runs its overrides inside a command substitution, so one
  # test cannot decide the next one's answer.
  check "resolve: SANDBOX_MODEL wins" pinned-by-flag \
    "$(SANDBOX_MODEL="pinned-by-flag" SANDBOX_MODEL_DAILY="claude_manager=from-daily" \
       SANDBOX_DEFAULT_MODEL="from-conf" resolve_sandbox_model claude)"
  check "resolve: daily beats sandbox.conf" from-daily \
    "$(SANDBOX_MODEL_DAILY="$(printf 'status=ok\nclaude_manager=from-daily\n')" \
       SANDBOX_DEFAULT_MODEL="from-conf" resolve_sandbox_model claude)"
  check "resolve: an empty daily line is not an answer" from-conf \
    "$(SANDBOX_MODEL_DAILY="$(printf 'status=ok\nclaude_manager=\n')" \
       SANDBOX_DEFAULT_MODEL="from-conf" resolve_sandbox_model claude)"
  check "resolve: another agent's line is not an answer" from-conf \
    "$(SANDBOX_MODEL_DAILY="$(printf 'codex_manager=from-daily\n')" \
       SANDBOX_DEFAULT_MODEL="from-conf" resolve_sandbox_model claude)"
  check "resolve: SANDBOX_DEFAULT_MODEL when the daily says nothing" from-conf \
    "$(SANDBOX_DEFAULT_MODEL="from-conf" resolve_sandbox_model claude)"
  check "resolve: claude fallback" claude-sonnet-4-6 "$(resolve_sandbox_model claude)"
  check "resolve: codex fallback" gpt-5.3-codex "$(resolve_sandbox_model codex)"
  check "resolve: cursor fallback" cursor-grok-4.6-high "$(resolve_sandbox_model cursor)"
  # The outer client's model used to be copied here. It must not be any more.
  check "resolve: the outer model is ignored" claude-sonnet-4-6 \
    "$(ANTHROPIC_MODEL="outer-tiny" resolve_sandbox_model claude)"
  check "resolve: an unknown agent gets no flag" "(empty)" \
    "$(out="$(resolve_sandbox_model banana)"; printf '%s' "${out:-(empty)}")"
  # Wave 1 fallbacks
  check "resolve: copilot fallback is empty" "(empty)" \
    "$(out="$(resolve_sandbox_model copilot)"; printf '%s' "${out:-(empty)}")"
  check "resolve: agy fallback" gemini-2.0-flash "$(resolve_sandbox_model agy)"
  check "resolve: amp fallback is empty" "(empty)" \
    "$(out="$(resolve_sandbox_model amp)"; printf '%s' "${out:-(empty)}")"
  check "resolve: opencode fallback is empty" "(empty)" \
    "$(out="$(resolve_sandbox_model opencode)"; printf '%s' "${out:-(empty)}")"
  # Daily snapshot manager keys for Wave 1 agents
  check "resolve: copilot daily beats fallback" copilot-model-x \
    "$(SANDBOX_MODEL_DAILY="$(printf 'status=ok\ncopilot_manager=copilot-model-x\n')" \
       resolve_sandbox_model copilot)"
  check "resolve: agy daily beats fallback" agy-model-x \
    "$(SANDBOX_MODEL_DAILY="$(printf 'status=ok\nagy_manager=agy-model-x\n')" \
       resolve_sandbox_model agy)"
  check "resolve: amp daily beats fallback" amp-model-x \
    "$(SANDBOX_MODEL_DAILY="$(printf 'status=ok\namp_manager=amp-model-x\n')" \
       resolve_sandbox_model amp)"
  check "resolve: opencode daily beats fallback" opencode-model-x \
    "$(SANDBOX_MODEL_DAILY="$(printf 'status=ok\nopencode_manager=opencode-model-x\n')" \
       resolve_sandbox_model opencode)"

  echo
  echo "Syntax — the scripts a dispatch sources"
  local f
  for f in model-daily.sh model.sh dispatch.sh dispatch-claude.sh dispatch-codex.sh dispatch-cursor.sh \
           dispatch-copilot.sh dispatch-agy.sh dispatch-amp.sh dispatch-opencode.sh; do
    check "bash -n $f" ok "$(bash -n "$MD_DIR/$f" 2>&1 >/dev/null && echo ok || echo "syntax error")"
  done

  # The one mount rule this design must not lose: the snapshot is host-side and
  # crosses as an environment variable. A -v for it in run-args.sh is a
  # regression, not a convenience.
  check "run-args.sh does not mount the snapshot or TMPDIR" absent \
    "$(grep -qE 'TMPDIR|sandbox-model-daily' "$MD_DIR/run-args.sh" && echo present || echo absent)"
  check "every backend passes the snapshot in" 7 \
    "$(grep -l 'SANDBOX_MODEL_DAILY' "$MD_DIR"/dispatch-claude.sh \
        "$MD_DIR"/dispatch-codex.sh "$MD_DIR"/dispatch-cursor.sh \
        "$MD_DIR"/dispatch-copilot.sh "$MD_DIR"/dispatch-agy.sh \
        "$MD_DIR"/dispatch-amp.sh "$MD_DIR"/dispatch-opencode.sh 2>/dev/null | wc -l | tr -d ' ')"
  echo
  echo "prepare_cache — only syncs the dispatched agent"
  # Verify the dispatched-agent-only sync logic for Wave 1 agents (no live network, just script inspection)
  check "agy-token-sync.sh is sourced for agy agent" present \
    "$(grep -q 'agy-token-sync.sh' "$MD_DIR/boot.sh" && echo present || echo absent)"
  check "amp-token-sync.sh is sourced for amp agent" present \
    "$(grep -q 'amp-token-sync.sh' "$MD_DIR/boot.sh" && echo present || echo absent)"
  check "opencode-token-sync.sh is sourced for opencode agent" present \
    "$(grep -q 'opencode-token-sync.sh' "$MD_DIR/boot.sh" && echo present || echo absent)"
  check "copilot-token-sync.sh is sourced for copilot agent" present \
    "$(grep -q 'copilot-token-sync.sh' "$MD_DIR/boot.sh" && echo present || echo absent)"

  rm -rf "$tmp"
}

model_daily_tests

if [ -n "${MD_STANDALONE:-}" ]; then
  echo
  printf '%s passed, %s failed\n' "$pass" "$fail"
  [ "$fail" -eq 0 ]
fi
