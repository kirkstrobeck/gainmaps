# outer-gate-deny.d

Project-owned deny hooks for the outer Bash gate. Files here survive
`./sandbox update`; the harness never overwrites or deletes your `*.sh` files.
This `README.md` is harness-owned and replaced on every install.

## Contract

- Each `*.sh` file may define one or more functions whose names start with
  `outer_gate_deny_`.
- Each function receives `$1` — the stripped command string (leading
  `VAR=value` assignments removed, same string the gate evaluates).
- To deny: call `deny "reason"` — this exits the gate with a deny decision.
- To allow (skip this rule): return 0 without calling `deny`.
- **Fail-open**: a file with a syntax error or a source error is skipped, not
  fatal. `./sandbox doctor` names skipped files as warnings.
- These hooks run **after** `gate_bypass_if_inner` (inner always passes) and
  **before** every allow branch — including `SANDBOX_EXTRA_ALLOW`. Extra-allow
  cannot override a deny from this directory.
- Named harness denials (git, pnpm, rm, ssh) fire before these hooks, so
  those reasons remain accurate.

## Example

```sh
# tools/sandbox/outer-gate-deny.d/fleet.sh
#
# Deny a project-specific command class that the harness allows broadly.
outer_gate_deny_fleet_scripts() {
  case "$1" in
    bash\ tools/candidates/*)
      deny "fleet scripts run inside the container, not on the host" ;;
  esac
}
```

Place `fleet.sh` (or any `*.sh`) next to this file. It survives `./sandbox update`.
