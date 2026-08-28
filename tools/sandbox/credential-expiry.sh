# Source-only library. Caller must set CACHE_DIR.

credential_expiry_warn_hours() {
  printf '%s' "${SANDBOX_AUTH_WARN_HOURS:-12}"
}

# Returns Unix epoch seconds when the credential expires, or empty string.
credential_expiry_epoch() {
  local service="$1"
  case "$service" in
    claude)   _ce_epoch_claude ;;
    codex)    _ce_epoch_codex ;;
    cursor)   _ce_epoch_cursor ;;
    github|copilot) _ce_epoch_github ;;
    *)        printf '' ;;
  esac
}

# Returns 0 (true) if credential expires within $hours hours from now.
credential_expiry_within_hours() {
  local service="$1" hours="$2"
  local exp
  exp="$(credential_expiry_epoch "$service")"
  [ -z "$exp" ] && return 1
  local now
  now="$(date +%s)"
  [ "$((now + hours * 3600))" -ge "$exp" ]
}

# Warn to stderr if credential for $agent (and GitHub) expires soon.
# Set CREDENTIAL_EXPIRY_NO_DEDUP=1 to bypass the 1-hour dedup stamp (doctor).
credential_expiry_warn() {
  local agent="$1"
  local hours
  hours="$(credential_expiry_warn_hours)"

  case "$agent" in
    claude|codex|cursor|agy|amp|opencode)
      _ce_warn_service "$agent" "$hours"
      ;;
    copilot)
      _ce_warn_service "github" "$hours"
      ;;
  esac
  # GitHub always (needed for git push regardless of agent)
  if [ "$agent" != "copilot" ]; then
    _ce_warn_service "github" "$hours"
  fi
}

# Warn for every credential (used when SANDBOX_AGENT unset, e.g. ./sandbox up).
credential_expiry_check_all() {
  local hours
  hours="$(credential_expiry_warn_hours)"
  for _ce_svc in claude codex cursor github; do
    _ce_warn_service "$_ce_svc" "$hours"
  done
}

# --- internal helpers ---------------------------------------------------------

_ce_format_epoch() {
  local epoch="$1"
  date -r "$epoch" "+%b %d %H:%M" 2>/dev/null ||
  date -d "@$epoch" "+%b %d %H:%M" 2>/dev/null ||
  printf '%s' "$epoch"
}

_ce_warn_service() {
  local service="$1" hours="$2"
  local exp diff_s diff_h label fix_msg

  # exp is resolved first, while the caller's own "now" (if any, e.g. a
  # test double for _ce_epoch_* that closes over a local "now") is still
  # the nearest one in scope — declaring our own "now" local up top would
  # shadow it via bash's dynamic scoping before credential_expiry_epoch runs.
  exp="$(credential_expiry_epoch "$service")"
  [ -z "$exp" ] && return 0

  local now
  now="$(date +%s)"
  diff_s="$((exp - now))"

  # Not expiring within the window
  [ "$diff_s" -gt "$((hours * 3600))" ] && return 0

  # Dedup: skip if already warned within the last hour (bypass with CREDENTIAL_EXPIRY_NO_DEDUP)
  if [ -z "${CREDENTIAL_EXPIRY_NO_DEDUP:-}" ] && [ -n "${CACHE_DIR:-}" ]; then
    local stamp="$CACHE_DIR/stamps/.auth-warn-$service"
    if [ -f "$stamp" ]; then
      local age
      age="$(perl -e 'print int(time() - (stat($ARGV[0]))[9])' "$stamp" 2>/dev/null || printf '99999')"
      [ "$age" -lt 3600 ] 2>/dev/null && return 0
    fi
    mkdir -p "$CACHE_DIR/stamps"
    touch "$CACHE_DIR/stamps/.auth-warn-$service"
  fi

  label="$(_ce_service_label "$service")"
  fix_msg="$(_ce_fix_message "$service")"
  local at
  at="$(_ce_format_epoch "$exp")"

  if [ "$diff_s" -le 0 ]; then
    diff_h="$(( (-diff_s + 3599) / 3600 ))"
    printf 'WARN: %s credential expired ~%dh ago (%s). %s\n' \
      "$label" "$diff_h" "$at" "$fix_msg" >&2
  else
    diff_h="$(( (diff_s + 3599) / 3600 ))"
    printf 'WARN: %s credential expires in ~%dh (%s). %s\n' \
      "$label" "$diff_h" "$at" "$fix_msg" >&2
  fi
}

_ce_service_label() {
  case "$1" in
    claude)  printf 'Claude' ;;
    codex)   printf 'Codex' ;;
    cursor)  printf 'Cursor' ;;
    github)  printf 'GitHub' ;;
    copilot) printf 'GitHub (Copilot)' ;;
    *)       printf '%s' "$1" ;;
  esac
}

_ce_fix_message() {
  case "$1" in
    claude)  printf "Re-auth on the Mac: run 'claude' and sign in." ;;
    codex)   printf "Re-auth on the Mac: run 'codex login'." ;;
    cursor)  printf "Re-auth on the Mac: run 'agent login', or set CURSOR_API_KEY for unattended runs." ;;
    github)  printf "Re-auth on the Mac: run 'gh auth login'." ;;
    copilot) printf "Re-auth on the Mac: run 'gh auth login'." ;;
    *)       printf "Re-auth on the Mac." ;;
  esac
}

_ce_epoch_claude() {
  # Read keychain blob (macOS) and host file; take the one with the later expiresAt.
  # expiresAt is in milliseconds (JS Date.now()); divide by 1000 for Unix seconds.
  local kc_blob file_blob best ms
  kc_blob=""
  if [ "$(uname -s)" = "Darwin" ]; then
    kc_blob="$(security find-generic-password -s "Claude Code-credentials" -w 2>/dev/null || true)"
  fi
  local host_file="${HOST_CLAUDE_HOME:-$HOME/.claude}/.credentials.json"
  file_blob="$(cat "$host_file" 2>/dev/null || true)"

  # Pick the newer blob by expiresAt
  local kc_ea file_ea
  kc_ea="$(printf '%s' "$kc_blob" | jq -r '.claudeAiOauth.expiresAt // 0' 2>/dev/null || printf '0')"
  file_ea="$(printf '%s' "$file_blob" | jq -r '.claudeAiOauth.expiresAt // 0' 2>/dev/null || printf '0')"

  if [ "$kc_ea" -gt "$file_ea" ] 2>/dev/null; then
    ms="$kc_ea"
  else
    ms="$file_ea"
  fi

  [ -z "$ms" ] || [ "$ms" = "0" ] || [ "$ms" = "null" ] && { printf ''; return; }
  # Detect ms vs s: values > year 2100 in seconds (4102444800) must be ms
  if [ "$ms" -gt 4102444800 ] 2>/dev/null; then
    printf '%s' "$((ms / 1000))"
  else
    printf '%s' "$ms"
  fi
}

_ce_epoch_codex() {
  # Codex auth.json only carries last_refresh (ISO-8601), not an expiry.
  # We cannot infer expiry without knowing the token lifetime, so return empty.
  printf ''
}

_ce_epoch_cursor() {
  # An API key never expires — skip.
  local api_key="${CURSOR_API_KEY:-}"
  if [ -z "$api_key" ] && [ "$(uname -s)" = "Darwin" ]; then
    api_key="$(security find-generic-password -s "cursor-api-key" -a "cursor-user" -w 2>/dev/null || true)"
  fi
  [ -n "$api_key" ] && { printf ''; return; }

  # Login-only: try to decode the JWT exp from the access token.
  local access_token=""
  if [ "$(uname -s)" = "Darwin" ]; then
    access_token="$(security find-generic-password -s "cursor-access-token" -a "cursor-user" -w 2>/dev/null || true)"
  fi
  if [ -z "$access_token" ]; then
    local auth_file="$HOME/.cursor/auth.json"
    [ "$(uname -s)" != "Darwin" ] && auth_file="${XDG_CONFIG_HOME:-$HOME/.config}/cursor/auth.json"
    access_token="$(jq -r '.accessToken // empty' "$auth_file" 2>/dev/null || true)"
  fi
  [ -z "$access_token" ] && { printf ''; return; }
  _ce_jwt_exp "$access_token"
}

_ce_epoch_github() {
  # Env tokens have no expiry metadata — no false alarms.
  [ -n "${GH_TOKEN:-}" ] || [ -n "${GITHUB_TOKEN:-}" ] && { printf ''; return; }

  # gh auth status --json may expose expiry in newer gh versions.
  local json gh_cmd
  gh_cmd="${CREDENTIAL_EXPIRY_GH_STATUS_CMD:-}"
  if [ -n "$gh_cmd" ]; then
    json="$(bash -c "$gh_cmd" 2>/dev/null || true)"
  elif command -v gh >/dev/null 2>&1; then
    json="$(gh auth status --json expiresAt 2>/dev/null || true)"
  fi
  [ -z "$json" ] && { printf ''; return; }

  # Try common expiry field names
  local exp
  exp="$(printf '%s' "$json" | jq -r '.. | (.expiresAt // .expires_at // .expiry // empty) | select(. != null and . != "")' 2>/dev/null | head -1 || true)"
  [ -z "$exp" ] && { printf ''; return; }

  # Unix timestamp or ISO-8601?
  if printf '%s' "$exp" | grep -qE '^[0-9]+$'; then
    printf '%s' "$exp"
  else
    date -d "$exp" +%s 2>/dev/null ||
    python3 -c "from datetime import datetime; import sys; print(int(datetime.fromisoformat(sys.argv[1].replace('Z','+00:00')).timestamp()))" "$exp" 2>/dev/null ||
    printf ''
  fi
}

# Decode a JWT and extract the exp claim (Unix seconds). Returns empty if not a JWT.
_ce_jwt_exp() {
  local token="$1"
  # JWTs have three base64url segments separated by '.'
  local payload
  payload="$(printf '%s' "$token" | cut -d. -f2)"
  [ -z "$payload" ] && { printf ''; return; }
  # base64url → base64 padding
  local padded
  padded="$(printf '%s' "$payload" | tr '_-' '/+' | awk '{ n=length($0)%4; if(n==2) $0=$0"=="; else if(n==3) $0=$0"="; print }')"
  local decoded
  decoded="$(printf '%s' "$padded" | base64 -d 2>/dev/null || printf '')"
  [ -z "$decoded" ] && { printf ''; return; }
  printf '%s' "$decoded" | jq -r '.exp // empty' 2>/dev/null || printf ''
}
