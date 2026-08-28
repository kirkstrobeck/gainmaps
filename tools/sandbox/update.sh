#!/usr/bin/env bash
# Pull a newer harness into this project from the repo it was installed from.
#
#   bash tools/sandbox/update.sh           fetch upstream and reinstall over this project
#   bash tools/sandbox/update.sh --check   ask upstream whether there is anything newer
#   bash tools/sandbox/update.sh --nudge   one quiet line, only if the last check said yes
#
# Flags: --ref REF, --repo OWNER/NAME, --from PATH (a local checkout instead of
# a download), --force.
#
# The upgrade itself is install.sh, fetched with the rest of the tarball and run
# against this directory. Nothing about which files are preserved is decided
# here — sandbox.conf, AGENTS.md and CLAUDE.md survive because install.sh says
# so, and a second copy of that rule is how the two quietly stop agreeing.
#
# Everything is wrapped in functions and called from the last line, because this
# script is one of the files the upgrade replaces underneath itself.

set -uo pipefail
# Read before config.sh gets a chance to set its default over the top. These
# are kill switches; the environment must beat the config file so that
# `SANDBOX_UPDATE_CHECK=0 ./sandbox up` is actually quiet in a project whose
# sandbox.conf says 1.
UPDATE_CHECK_ENV="${SANDBOX_UPDATE_CHECK:-}"
AUTOUPDATE_ENV="${SANDBOX_AUTOUPDATE:-}"

# When re-exec'd from a temp copy, BASH_SOURCE[0] points at /tmp; the original
# directory is passed through SANDBOX_SCRIPT_DIR so siblings are still found.
SCRIPT_DIR="${SANDBOX_SCRIPT_DIR:-$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd -P)}"
# shellcheck source=common.sh
. "$SCRIPT_DIR/common.sh"
# shellcheck source=manifest.sh
. "$SCRIPT_DIR/manifest.sh"

ORIGIN_FILE="$SCRIPT_DIR/ORIGIN.md"
STAMP="$CACHE_DIR/update-check"
INSTALL_HASHES_FILE="$SCRIPT_DIR/.install-hashes"
# Global, not a local in cmd_update: the EXIT trap runs after that function has
# returned, and a local would be out of scope by then.
CLEANUP_DIR=""
# One check a day. This is a courtesy line in someone's terminal, not a service.
STAMP_MAX_AGE="${SANDBOX_UPDATE_CHECK_MAX_AGE:-86400}"
DEFAULT_REPO="kirkstrobeck/sandbox"
DEFAULT_REF="main"

log() { printf '%s\n' "$*" >&2; }
die() { printf 'error: %s\n' "$*" >&2; exit 1; }

# ORIGIN.md is markdown for a human first; the KEY=value lines in it are the
# machine-readable half. Missing file, missing key and empty value all mean the
# same thing to every caller: fall back to the default.
origin_value() {
  [ -r "$ORIGIN_FILE" ] || return 0
  sed -n "s/^[[:space:]]*$1=//p" "$ORIGIN_FILE" | head -1 | tr -d '\r'
}

# The one place that decides which repo/ref this project tracks: the flags, then
# the environment, then ORIGIN.md, then the upstream defaults.
resolve_origin() {
  REPO="${REPO_FLAG:-${SANDBOX_REPO:-$(origin_value SANDBOX_ORIGIN_REPO)}}"
  REF="${REF_FLAG:-${SANDBOX_REF:-$(origin_value SANDBOX_ORIGIN_REF)}}"
  [ -n "$REPO" ] || REPO="$DEFAULT_REPO"
  [ -n "$REF" ] || REF="$DEFAULT_REF"
  LOCAL_COMMIT="$(origin_value SANDBOX_ORIGIN_COMMIT)"
}

# The commit behind REF, from the API. Unauthenticated on purpose: a background
# check is not a place to be handling someone's token, and 60 requests an hour
# is generous for something that runs once a day.
#
# Every way this fails is a thing a person can act on — a typo'd ref reads
# nothing like a flaky network — so the reason is kept rather than flattened
# into an empty string. The answer comes back in a global rather than on stdout
# because a command substitution is a subshell, and the reason would not survive
# the trip back.
UPSTREAM_SHA=""
UPSTREAM_ERR=""
upstream_head() {
  UPSTREAM_SHA=""; UPSTREAM_ERR=""
  command -v curl >/dev/null 2>&1 || { UPSTREAM_ERR="curl is not on PATH"; return 1; }
  local body code
  body="$(mktemp)"
  code="$(curl -sL -m "${SANDBOX_UPDATE_TIMEOUT:-8}" -o "$body" -w '%{http_code}' \
    -H 'Accept: application/vnd.github+json' \
    "https://api.github.com/repos/$REPO/commits/$REF" 2>/dev/null)"
  case "$code" in
    200) UPSTREAM_SHA="$(jq -r '.sha // empty' <"$body" 2>/dev/null)" ;;
    404) UPSTREAM_ERR="github.com has no $REPO@$REF" ;;
    409) UPSTREAM_ERR="$REPO exists on github.com but has no commits yet" ;;
    403|429) UPSTREAM_ERR="github.com rate-limited the check; it will retry tomorrow" ;;
    000|'') UPSTREAM_ERR="could not reach github.com" ;;
    *) UPSTREAM_ERR="github.com answered HTTP $code" ;;
  esac
  rm -f "$body"
  [ -z "$UPSTREAM_ERR" ]
}

stamp_write() {
  mkdir -p "$CACHE_DIR" 2>/dev/null || return 0
  printf '%s %s %s\n' "$(date +%s)" "$1" "${2:-}" >"$STAMP" 2>/dev/null || true
}

stamp_field() {
  [ -r "$STAMP" ] || return 0
  awk -v n="$1" 'NR==1{print $n}' "$STAMP"
}

stamp_age() {
  local when
  when="$(stamp_field 1)"
  case "$when" in ''|*[!0-9]*) echo 999999999; return 0 ;; esac
  echo $(( $(date +%s) - when ))
}

short() { printf '%s' "${1:0:7}"; }

# Pure predicate — returns 0 when cmd_nudge should run cmd_update, 1 otherwise.
# All conditions are passed as positional arguments so the test suite can call
# it with arbitrary values without touching the network or the filesystem.
#
#   $1  harness_sha        sha from the daily file (or "")
#   $2  local_commit       sha from ORIGIN.md (or "")
#   $3  harness_repo       repo from the daily file (e.g. "kirkstrobeck/sandbox")
#   $4  harness_ref        ref from the daily file  (e.g. "main")
#   $5  origin_repo        repo from ORIGIN.md / resolve_origin
#   $6  origin_ref         ref from ORIGIN.md / resolve_origin
#   $7  autoupdate_on      "1" when SANDBOX_AUTOUPDATE is active (default 0)
#   $8  update_check_off   "1" when SANDBOX_UPDATE_CHECK=0 (kill switch active)
#   $9  source_repo        "1" when install.sh is at REPO_ROOT (source tree)
sandbox_autoupdate_should() {
  local harness_sha="$1"  local_commit="$2"
  local harness_repo="$3" harness_ref="$4"
  local origin_repo="$5"  origin_ref="$6"
  local autoupdate_on="${7:-0}"
  local update_check_off="${8:-0}"
  local source_repo="${9:-0}"
  [ "$update_check_off" = "1" ] && return 1
  [ "$source_repo"      = "1" ] && return 1
  [ "$origin_repo" = "$harness_repo" ] || return 1
  [ "$origin_ref"  = "$harness_ref"  ] || return 1
  [ -n "$harness_sha"  ] || return 1
  [ -n "$local_commit" ] || return 1
  [ "$harness_sha" = "$local_commit" ] && return 1
  [ "$autoupdate_on" = "1" ] || return 1
  return 0
}

cmd_check() {
  # shellcheck source=model-daily.sh
  . "$SCRIPT_DIR/model-daily.sh"
  # Prefer the daily file's sha when it is fresh — avoids a second GitHub call
  # on a day we already fetched the upstream sha for the nudge.
  if sandbox_model_daily_fresh; then
    local _daily_sha
    _daily_sha="$(sed -n 's/^harness_sha=//p' "$(_sandbox_model_daily_path)" 2>/dev/null | head -1)"
    if [ -n "$_daily_sha" ]; then
      UPSTREAM_SHA="$_daily_sha"
      UPSTREAM_ERR=""
    else
      upstream_head
    fi
  else
    upstream_head
  fi

  local STATUS="unknown"
  if [ -z "$UPSTREAM_SHA" ] || [ -z "$LOCAL_COMMIT" ]; then
    STATUS="unknown"
  elif [ "$UPSTREAM_SHA" = "$LOCAL_COMMIT" ]; then
    STATUS="current"
  else
    STATUS="outdated"
  fi
  stamp_write "$STATUS" "$UPSTREAM_SHA"

  case "$STATUS" in
    current)  log "up to date with $REPO@$REF ($(short "$LOCAL_COMMIT"))" ;;
    outdated) log "an update is available for $REPO@$REF — run: ./sandbox update" ;;
    unknown)
      if [ -n "$UPSTREAM_ERR" ]; then
        log "cannot tell: $UPSTREAM_ERR"
      else
        log "cannot tell: no commit recorded in tools/sandbox/ORIGIN.md — ./sandbox update stamps one"
      fi
      ;;
  esac
  # Exit 1 means "there is an update", not "the check broke" — doctor reads the
  # text, but a script can read the status.
  [ "$STATUS" = outdated ] && return 1
  return 0
}

# Called from boot.sh on every `./sandbox up`. Two rules: never block, and
# never speak unless there is something to say.
#
# The daily model file is both the data source (harness_sha) and the clock:
# sandbox_model_daily_ensure ensures today's file is present and returns its
# text. No separate background refresh or stamp write for the nudge path.
cmd_nudge() {
  [ "${UPDATE_CHECK_ENV:-${SANDBOX_UPDATE_CHECK:-1}}" = "0" ] && return 0

  # shellcheck source=model-daily.sh
  . "$SCRIPT_DIR/model-daily.sh"
  local daily_text daily_sha daily_repo daily_ref
  daily_text="$(sandbox_model_daily_ensure)"
  daily_sha="$(printf '%s\n' "$daily_text" | sed -n 's/^harness_sha=//p' | head -1)"
  daily_repo="$(printf '%s\n' "$daily_text" | sed -n 's/^harness_repo=//p' | head -1)"
  daily_ref="$(printf '%s\n' "$daily_text" | sed -n 's/^harness_ref=//p' | head -1)"

  resolve_origin  # sets REPO, REF, LOCAL_COMMIT from ORIGIN.md

  local autoupdate_on=1 update_check_off=0 source_repo=0
  [ "${UPDATE_CHECK_ENV:-${SANDBOX_UPDATE_CHECK:-1}}" = "0" ] && update_check_off=1
  [ "${AUTOUPDATE_ENV:-${SANDBOX_AUTOUPDATE:-0}}" = "1" ]     || autoupdate_on=0
  [ -f "$REPO_ROOT/install.sh" ]                              && source_repo=1

  if sandbox_autoupdate_should \
       "$daily_sha" "$LOCAL_COMMIT" \
       "$daily_repo" "$daily_ref" \
       "$REPO" "$REF" \
       "$autoupdate_on" "$update_check_off" "$source_repo"; then
    log "Updating sandbox harness to $(short "$daily_sha") (daily snapshot)."
    cmd_update
    return $?
  fi

  # Different sha, matching origin, but autoupdate is off → nudge line only.
  if [ "$source_repo" = "0" ] && [ "$update_check_off" = "0" ] && \
     [ -n "$daily_sha" ] && [ -n "$LOCAL_COMMIT" ] && \
     [ "$daily_sha" != "$LOCAL_COMMIT" ] && \
     [ "$REPO" = "$daily_repo" ] && [ "$REF" = "$daily_ref" ]; then
    log "A newer sandbox harness is available ($REPO@$REF) — run: ./sandbox update"
  fi
  return 0
}

# What to hash before and after, so the change report is about the paths the
# install actually owns rather than whatever happened to be under three
# hardcoded roots. The union of the old and new manifests is the right set: a
# path only the old one has is exactly the file about to be removed, and hashing
# the union at both ends is what makes "removed" appear in the report instead of
# the file just quietly vanishing.
#
# ORIGIN.md is excluded — its timestamp changes on every run and it would report
# itself as the only change. .cache never appears because it is `manage`.
changed_paths() {
  local old="$REPO_ROOT/tools/sandbox/MANIFEST" new="$1/tools/sandbox/MANIFEST"
  { manifest_paths "$old" replace
    manifest_paths "$old" preserve
    manifest_paths "$new" replace
    manifest_paths "$new" preserve
  } 2>/dev/null | sort -u | grep -v '^tools/sandbox/ORIGIN\.md$'
}

# "<sha>  <path>" for every path in the set that currently exists. A path that
# is absent simply produces no line, which is what lets the awk diff below call
# it added or removed.
hash_paths() {
  ( cd "$REPO_ROOT" 2>/dev/null || exit 0
    while IFS= read -r p; do
      [ -n "$p" ] && [ -f "$p" ] || continue
      shasum "$p" 2>/dev/null
    done )
}

report_changes() {
  local out
  out="$(awk 'NR==FNR{a[$2]=$1;next}
              {if(!($2 in a)) print "  added    " $2
               else if(a[$2]!=$1) print "  updated  " $2
               delete a[$2]}
              END{for(p in a) print "  removed  " p}' "$1" "$2" | sort -k2)"
  if [ -n "$out" ]; then
    printf '%s\n' "$out" >&2
  else
    log "  (nothing — this project was already on that revision)"
  fi
}

fetch_source() {
  local dest="$1"
  for tool in curl tar; do
    command -v "$tool" >/dev/null 2>&1 ||
      die "$tool is required to fetch $REPO@$REF. brew install $tool"
  done
  log "Fetching $REPO@$REF ..."
  curl -fsSL "https://codeload.github.com/$REPO/tar.gz/$REF" |
    tar -xz -C "$dest" --strip-components=1 ||
    die "could not download $REPO@$REF"
}

# Warn about replace-mode files that have been edited since the last install.
# Hashes are stored in INSTALL_HASHES_FILE after each successful install.
# Format: one "sha  path" line per file (shasum output).
warn_replace_drift() {
  [ -r "$INSTALL_HASHES_FILE" ] || return 0
  local drifted="" stored_sha path current_sha
  while IFS= read -r line; do
    [ -n "$line" ] || continue
    stored_sha="${line%% *}"
    path="${line#*  }"
    [ -n "$path" ] || continue
    [ -f "$REPO_ROOT/$path" ] || continue
    current_sha="$(shasum "$REPO_ROOT/$path" 2>/dev/null | cut -d' ' -f1)"
    [ "$current_sha" = "$stored_sha" ] && continue
    drifted="${drifted}  $path"$'\n'
  done <"$INSTALL_HASHES_FILE"
  if [ -n "$drifted" ]; then
    log "warning: these replace files were edited locally and will be overwritten:"
    printf '%s' "$drifted" >&2
  fi
}

# Write hashes for the replace-mode files now on disk, keyed off the new manifest.
write_install_hashes() {
  local src="$1" manifest="$src/tools/sandbox/MANIFEST"
  [ -r "$manifest" ] || return 0
  local tmp
  tmp="$(mktemp)"
  ( cd "$REPO_ROOT" 2>/dev/null || exit 0
    while IFS= read -r p; do
      [ -n "$p" ] && [ -f "$p" ] && shasum "$p" 2>/dev/null
    done < <(manifest_paths "$manifest" replace)
  ) >"$tmp"
  mv "$tmp" "$INSTALL_HASHES_FILE"
}

cmd_update() {
  # install.sh replaces this script underneath the running bash process. Re-exec
  # from a temp copy now so the rest of this function reads from a stable file.
  # SANDBOX_UPDATE_REEXEC=1 prevents the temp copy from re-execing again.
  if [ -z "${SANDBOX_UPDATE_REEXEC:-}" ]; then
    local _reexec_tmp
    _reexec_tmp="$(mktemp)"
    cp "${BASH_SOURCE[0]}" "$_reexec_tmp"
    chmod 755 "$_reexec_tmp"
    local _reexec_args=()
    [ -n "${FORCE:-}"     ] && _reexec_args+=(--force)
    [ -n "${DRY_RUN:-}"   ] && _reexec_args+=(--dry-run)
    [ -n "${FROM:-}"      ] && _reexec_args+=(--from "$FROM")
    [ -n "${REPO_FLAG:-}" ] && _reexec_args+=(--repo "$REPO_FLAG")
    [ -n "${REF_FLAG:-}"  ] && _reexec_args+=(--ref "$REF_FLAG")
    SANDBOX_UPDATE_REEXEC=1 SANDBOX_SCRIPT_DIR="$SCRIPT_DIR" exec bash "$_reexec_tmp" "${_reexec_args[@]}"
  fi

  # install.sh at the project root means this IS the starter repo, not a project
  # that installed it — the harness here is the working copy, and overwriting it
  # with upstream would discard exactly the work someone is in the middle of.
  if [ -f "$REPO_ROOT/install.sh" ] && [ -z "$FORCE" ]; then
    die "$REPO_ROOT looks like the sandbox source repo itself (install.sh is at the root).
       Updating would overwrite your working copy with upstream. Use git pull, or --force."
  fi

  local src commit=""
  trap '[ -n "${CLEANUP_DIR:-}" ] && rm -rf "$CLEANUP_DIR"' EXIT
  if [ -n "$FROM" ]; then
    src="$(cd "$FROM" 2>/dev/null && pwd -P)" || die "no such directory: $FROM"
    [ -d "$src/tools/sandbox" ] && [ -f "$src/install.sh" ] ||
      die "$FROM is not a sandbox checkout (no install.sh + tools/sandbox)"
    command -v git >/dev/null 2>&1 && commit="$(git -C "$src" rev-parse HEAD 2>/dev/null || true)"
  else
    src="$(mktemp -d)"
    CLEANUP_DIR="$src"
    fetch_source "$src"
    # A tarball has no sha in it, and this is the moment the network is already
    # in hand, so record what the ref pointed at while we can. Empty is fine:
    # ORIGIN.md then says so and the daily check stays quiet.
    upstream_head || true
    commit="$UPSTREAM_SHA"
  fi

  [ -f "$src/install.sh" ] || die "the fetched tree has no install.sh"

  log "Updating the sandbox harness in $REPO_ROOT"
  log "  from $REPO@$REF${FROM:+ (local checkout $src)}"
  log ""

  # Warn before overwriting any replace files the project has locally edited.
  warn_replace_drift

  local before after paths
  before="$(mktemp)"; after="$(mktemp)"; paths="$(mktemp)"
  # Computed once, from the two manifests as they are right now — the "after"
  # pass has to look at the same set of paths or a removal reads as a no-op.
  changed_paths "$src" >"$paths"
  hash_paths <"$paths" >"$before"

  local install_flags=""
  [ -n "${DRY_RUN:-}" ] && install_flags="--dry-run"
  [ -n "$FORCE" ] && install_flags="${install_flags:+$install_flags }--force"

  SANDBOX_REPO="$REPO" SANDBOX_REF="$REF" SANDBOX_TARGET="$REPO_ROOT" \
    SANDBOX_ORIGIN_COMMIT="$commit" \
    bash "$src/install.sh" $install_flags ||
    die "install.sh failed; nothing further was changed"

  if [ -z "${DRY_RUN:-}" ]; then
    hash_paths <"$paths" >"$after"
    rm -f "$paths"
    log ""
    log "Changed:"
    report_changes "$before" "$after"
    rm -f "$before" "$after"

    # Record hashes of replace-mode files so the next update can detect drift.
    write_install_hashes "$src"

    # The new harness is on disk and the recorded commit moved with it, so the
    # cached answer is stale by definition.
    rm -f "$STAMP"

    log ""
    log "Ports, mounts and volumes are fixed at container creation — run ./sandbox up"
    log "to pick up a harness change, and ./sandbox doctor if anything looks off."
  else
    rm -f "$paths" "$before" "$after"
  fi
}

main() {
  local mode="update"
  REPO_FLAG=""; REF_FLAG=""; FROM=""; FORCE=""; DRY_RUN=""
  while [ $# -gt 0 ]; do
    case "$1" in
      --check)    mode="check" ;;
      --nudge)    mode="nudge" ;;
      --dry-run)  DRY_RUN=1 ;;
      --force)    FORCE=1 ;;
      --repo)     REPO_FLAG="${2:-}"; shift ;;
      --ref)      REF_FLAG="${2:-}"; shift ;;
      --from)     FROM="${2:-}"; shift ;;
      -h|--help)
        awk 'NR>1 && /^#/ {sub(/^# ?/, ""); print; next} NR>1 {exit}' "${BASH_SOURCE[0]}" >&2
        return 0 ;;
      *) die "unknown argument: $1" ;;
    esac
    shift
  done

  command -v jq >/dev/null 2>&1 || die "jq is required. brew install jq"
  resolve_origin

  case "$mode" in
    check)  cmd_check ;;
    nudge)  cmd_nudge ;;
    update) cmd_update ;;
  esac
}

[ "${BASH_SOURCE[0]}" = "$0" ] && main "$@"
