# outer-write-gate-deny.d

Project-owned deny hooks for the outer write gate (Edit/Write/MultiEdit/
NotebookEdit). Files here survive `./sandbox update`; the harness never
overwrites or deletes your `*.sh` files. This `README.md` is harness-owned
and replaced on every install.

## Contract

- Each `*.sh` file may define one or more functions whose names start with
  `outer_write_gate_deny_`.
- Each function receives `$1` — the **resolved absolute path** of the file
  being written (symlinks followed, `.`/`..` removed).
- To deny: call `deny "reason"` — this exits the gate with a deny decision.
- To allow (skip this rule): return 0 without calling `deny`.
- **Fail-open**: a file with a syntax error or a source error is skipped, not
  fatal. `./sandbox doctor` names skipped files as warnings.
- These hooks run **after** `gate_bypass_if_inner` (inner always passes) and
  **before** `gate_is_allowed` — a project can deny a path the harness would
  allow. Inner bypass cannot be un-denied by a project hook.

## Example

```sh
# tools/sandbox/outer-write-gate-deny.d/protect-conf.sh
#
# Prevent the outer agent from editing sandbox.conf even though
# tools/sandbox/ is in the harness allowlist.
outer_write_gate_deny_conf() {
  case "$1" in
    */tools/sandbox/sandbox.conf)
      deny "sandbox.conf is managed by the project; edit it manually" ;;
  esac
}
```
