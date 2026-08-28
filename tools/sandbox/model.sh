#!/usr/bin/env bash
# Decide which model the inner MANAGER runs. Source, don't run. Expects
# SANDBOX_DIR (common.sh sets it) when reading host config files.
#
# The inner agent is the same PRODUCT as the outer one (agent.sh). It is
# deliberately NOT the same model. What dispatch launches inside the container
# is a manager: it writes a short spec, spawns a cheaper worker to do the edits
# and the tests, reviews what came back, and accepts or retries. So the model
# chosen here has to be good enough to route and review, and nothing more —
# the per-task work is not billed at this tier.
#
# Copying the outer client's model, which this file used to do, is the wrong
# answer for that job in both directions. An outer agent on a small fast model
# would hand the container a manager that cannot review; an outer agent on the
# flagship would bill every routing decision at flagship rates. The outer model
# is now ignored on purpose.
#
# WHERE THE ANSWER COMES FROM, in order:
#
#   1. SANDBOX_MODEL         — `./sandbox -m`. Explicit, wins over everything.
#   2. <agent>_manager= from the daily snapshot (model-daily.sh), when that
#      line is non-empty. This is the hook for a promo or a plan change.
#   3. SANDBOX_DEFAULT_MODEL — a project-wide manager pin in sandbox.conf.
#   4. A high-value default per agent — see the table below.
#   5. Empty, and no --model flag is passed. Only reachable for an agent this
#      file has never heard of.
#
# Step 4 is the one that changed. Passing nothing used to be the honest answer
# because nothing readable said what the outer model was; now the harness has an
# opinion about what the manager needs to be, and a CLI default that happens to
# be a cheap chat tier would quietly make the manager the weakest part of the
# run. These ids are handed through verbatim, so they have to be ones the chosen
# agent understands — when one goes stale, this is the single line to change.
_sandbox_manager_fallback() {
  case "$1" in
    # High enough to route and review. Not the flagship, and deliberately not a
    # fast/mini/haiku/composer tier — those are what the WORKERS get.
    claude)   printf 'claude-sonnet-4-6\n' ;;
    cursor)   printf 'cursor-grok-4.6-high\n' ;;
    codex)    printf 'gpt-5.3-codex\n' ;;
    # copilot: Copilot selects the model from its plan; passing a model id may
    # not be supported by all CLI versions. Empty = CLI default.
    copilot)  printf '\n' ;;
    # agy (Antigravity): Gemini model. gemini-2.0-flash is the mid-tier reasoning
    # model appropriate for manager work; bump to 2.5-pro for harder tasks.
    agy)      printf 'gemini-2.0-flash\n' ;;
    # amp: Amp routes internally; --model is accepted but may not map to the same
    # namespace as other CLIs. Empty = Amp default routing.
    amp)      printf '\n' ;;
    # opencode: BYOK, model is configured in ~/.config/opencode/config.json.
    opencode) printf '\n' ;;
    *)        printf '\n' ;;
  esac
}

# Today's snapshot, as text. dispatch.sh exports SANDBOX_MODEL_DAILY before it
# launches, so that is the normal path; the file is read directly only for
# callers that never went through dispatch, and only while it is fresh — a
# month-old promo is not a reason to pin a model.
_sandbox_daily_text() {
  if [ -n "${SANDBOX_MODEL_DAILY:-}" ]; then
    printf '%s\n' "$SANDBOX_MODEL_DAILY"
    return 0
  fi
  command -v sandbox_model_daily_fresh >/dev/null 2>&1 || return 0
  sandbox_model_daily_fresh || return 0
  cat "$(_sandbox_model_daily_path)" 2>/dev/null
}

# `claude_manager=<id>` out of that text. Blank is the expected value and means
# "no opinion" — the fetcher does not invent ids, see model-daily.sh.
_sandbox_daily_manager() {
  _sandbox_daily_text |
    sed -n "s/^[[:space:]]*$1_manager=//p" |
    head -1 |
    tr -d '\r' |
    sed -e 's/^[[:space:]]*//' -e 's/[[:space:]]*$//'
}

resolve_sandbox_model() {
  local agent="$1" model=""

  if [ -n "${SANDBOX_MODEL:-}" ]; then
    printf '%s\n' "$SANDBOX_MODEL"
    return 0
  fi

  model="$(_sandbox_daily_manager "$agent")"
  [ -n "$model" ] || model="${SANDBOX_DEFAULT_MODEL:-}"
  [ -n "$model" ] || model="$(_sandbox_manager_fallback "$agent")"

  printf '%s\n' "$model"
}
