#!/usr/bin/env bash
# Shared plumbing for the PreToolUse gates. Source, don't run.
#
# Both gates emit the same decision envelope and share the same bypass rules.
# One copy means a fix to the decision shape cannot land in one gate and quietly
# miss the other — which is exactly how a hole stays open in practice: the Bash
# path gets hardened, the Edit path is forgotten, and the agent walks through it.

GATE_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd -P)"
PROJECT_ROOT="${PROJECT_ROOT:-$(cd "$GATE_DIR/../.." && pwd -P)}"

DISPATCH_MSG='Do not run this on the host. Dispatch: ./sandbox "<message>" or ./sandbox -c "<message>". See AGENTS.md.'

# Claude Code reads this exact JSON shape from a PreToolUse hook. Exit 0 always:
# a nonzero exit is a hook *error*, which is not the same thing as a deny and is
# handled differently by the client.
#
# When GATE_PROTOCOL=cursor the hook is a Cursor beforeShellExecution /
# preToolUse / beforeReadFile handler, which expects a different envelope.
decide() {
  local decision="$1" reason="$2"
  if [ "${GATE_PROTOCOL:-}" = "cursor" ]; then
    jq -nc --arg p "$decision" --arg r "$reason" \
      '{permission:$p,user_message:$r,agent_message:$r}'
  else
    jq -nc --arg d "$decision" --arg r "$reason" \
      '{hookSpecificOutput:{hookEventName:"PreToolUse",permissionDecision:$d,permissionDecisionReason:$r}}'
  fi
  exit 0
}

allow() { decide allow "$1"; }
deny()  { decide deny  "$1"; }

# The gates exist to keep the OUTER agent out of the host. Inside the container
# there is nothing left to protect, and leaving them armed would block the inner
# agent from doing the work it was dispatched to do.
#
# GATE_FORCE exists for the test harness: it makes a host shell evaluate the
# rules as if it were outer, even when run from inside.
gate_bypass_if_inner() {
  if [ -n "${SANDBOX_GATE_FORCE:-}" ]; then
    return 0
  fi
  if [ -n "${SANDBOX_INNER:-}" ]; then
    allow "inside sandbox"
  fi
  if [ -f /.dockerenv ] || [ -d /workspace ]; then
    allow "inside sandbox"
  fi
}

# Fail open, deliberately. A gate that crashes on an unexpected payload and
# denies everything makes the agent unusable and gets disabled by the human
# within the hour — at which point the protection is zero instead of partial.
gate_read_payload() {
  local payload
  payload="$(cat)"
  if [ -z "$payload" ]; then
    allow "no hook payload"
  fi
  if ! command -v jq >/dev/null 2>&1; then
    allow "jq unavailable; gate cannot evaluate"
  fi
  printf '%s' "$payload"
}

# Project extra-allow globs, evaluated AFTER named denials. Never source
# sandbox.conf here — a $(git ...) in that file would fork on every Bash tool
# call. Env wins (tests); otherwise extract the one assignment from the conf
# files without executing them.
_gate_trim() {
  local s="$1"
  s="${s#"${s%%[![:space:]]*}"}"
  s="${s%"${s##*[![:space:]]}"}"
  printf '%s' "$s"
}

# Parametrized extractor: reads VARNAME from env (wins) or parses conf files.
# Never source the conf — a $(git ...) there would fork on every Bash tool call.
gate_extra_conf_patterns() {
  local varname="$1"
  local envval
  eval "envval=\"\${${varname}:-}\""
  if [ -n "$envval" ]; then
    printf '%s\n' "$envval"
    return 0
  fi
  local file
  for file in "$PROJECT_ROOT/tools/sandbox/sandbox.conf" \
              "$PROJECT_ROOT/tools/sandbox/sandbox.local.conf"; do
    [ -r "$file" ] || continue
    awk -v VAR="$varname" '
      $0 ~ ("^[[:space:]]*" VAR "=") {
        sub("^[[:space:]]*" VAR "=", "")
        if ($0 ~ /^"/) {
          sub(/^"/, "")
          if ($0 ~ /"$/) { sub(/"$/, ""); print; next }
          print
          inq = 1
          next
        }
        print
      }
      inq {
        if ($0 ~ /"$/) { sub(/"$/, ""); print; inq = 0; next }
        print
      }
    ' "$file"
  done
}

gate_extra_allow_patterns() { gate_extra_conf_patterns SANDBOX_EXTRA_ALLOW; }
gate_extra_deny_patterns()  { gate_extra_conf_patterns SANDBOX_EXTRA_DENY;  }

gate_extra_allow_matches() {
  local stripped="$1" pat
  while IFS= read -r pat; do
    pat="$(_gate_trim "$pat")"
    [ -z "$pat" ] && continue
    case "$pat" in \#*) continue ;; esac
    case "$stripped" in
      $pat) return 0 ;;
    esac
  done <<EOF
$(gate_extra_allow_patterns)
EOF
  return 1
}

gate_extra_deny_matches() {
  local stripped="$1" pat
  while IFS= read -r pat; do
    pat="$(_gate_trim "$pat")"
    [ -z "$pat" ] && continue
    case "$pat" in \#*) continue ;; esac
    case "$stripped" in
      $pat) return 0 ;;
    esac
  done <<EOF
$(gate_extra_deny_patterns)
EOF
  return 1
}
