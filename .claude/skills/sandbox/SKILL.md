---
name: sandbox
description: Use when work in this repo needs to run — builds, tests, installs, git, edits to project files. Explains how to dispatch to the containerized inner agent, watch it, recover a lost result, and fix a broken sandbox.
metadata:
  internal: true
---

# Sandbox

You relay. The inner agent works. See `AGENTS.md` for the rule; this is the
reference for carrying it out.

## Commands

| Command | Does |
| --- | --- |
| `./sandbox "task"` | Dispatch. Prints the inner agent's answer. |
| `./sandbox -c "task"` | Dispatch continuing the previous thread. |
| `./sandbox result` | Re-read the last answer without spending a run. |
| `./sandbox tail -f` | Live progress of the current run. |
| `./sandbox up` | Start the container (dispatch does this for you). |
| `./sandbox status` | Container state, ports, hot-reload, whether a run is live. |
| `./sandbox doctor` | Check the host setup and name the fix for each problem. |
| `./sandbox run <cmd>` | Run one command inside the container. |
| `./sandbox shell` | Interactive shell inside the container. |
| `./sandbox rebuild` | Force an image rebuild. |
| `./sandbox stop` | Stop the container; cache and credentials survive. |
| `./sandbox test` | Run the gate test suite. |
| `./sandbox update` | Upgrade `tools/sandbox` from the repo it was installed from. |

A long message is safer as a file than as an argument:
`./sandbox --file path` (or `./sandbox --message-file path`).
Do not pipe into `./sandbox` — the outer gate treats a pipe as chaining.

## Writing the dispatch

One message, no follow-up questions possible. Include the paths you found, the
acceptance check (the literal command), and whether to commit. Read the repo
first — you are allowed to read, and a dispatch built on a guess costs a full
run to discover it was wrong.

## When something goes wrong

**Denied by a hook.** Working as designed. Dispatch it.

**"Sandbox failed to start."** Run `./sandbox doctor`. Almost always Colima is
down: `colima start --vm-type vz --mount-type virtiofs`.

**Dispatch returns a login or auth error.** The credential expired on the Mac.
The human runs `claude`, `codex login`, or `agent login` on the host and signs
in; the next dispatch re-bridges it. You cannot sign in for them. For Cursor
specifically, a login-only credential cannot refresh inside the container —
`CURSOR_API_KEY` is the fix if it keeps happening.

**Credential expiry warnings.** `WARN: … credential expires in ~Nh` printed during boot or dispatch means you have roughly that long before the next dispatch will fail with an auth error. Re-auth on the Mac before you hit the deadline. `./sandbox doctor` shows current expiry state for all credentials. Set `SANDBOX_AUTH_WARN_HOURS` in `sandbox.conf` to change the lead time (default 12 hours). For Cursor login-only tokens with no expiry info, prefer `CURSOR_API_KEY` for unattended runs.

**`git push` fails inside the container.** The GitHub token didn't bridge. The
human runs `gh auth login` on the Mac, then `./sandbox up` re-syncs it. No SSH
key is ever mounted — this is a scoped, revocable token by design.

**Edits on the Mac don't reload in the container.** Check
`./sandbox status` for the hot-reload line. `./sandbox up` restarts the bridge.
Do not add a polling watcher to the dev server; polling from the repo root over
virtiofs is two orders of magnitude slower than the native path.

**Config changed but the container ignores it.** Ports, mounts, and volumes are
fixed at creation. `./sandbox up` detects the drift and recreates. If it
doesn't, `./sandbox rebuild`.

## Upgrading the harness

`tools/sandbox/` is installed from https://github.com/kirkstrobeck/sandbox, not
written for this project — `tools/sandbox/ORIGIN.md` records the repo, ref and
commit. A fix you make in there is overwritten by the next upgrade, so it
belongs upstream.

`./sandbox update` fetches that repo and reruns its `install.sh` here.
`tools/sandbox/MANIFEST` is the list of paths an install owns: `replace` paths
are overwritten and are deleted if the new harness dropped them, `preserve`
paths (`sandbox.conf`, `AGENTS.md`, `CLAUDE.md`) are kept, `manage` paths
(`.cache/`, `sandbox.local.conf`, merged files) are never touched. Hooks are
re-merged and the added/updated/removed files are printed. It is the one CLI
verb that writes to the project on the host, so run it when the human asks for
it — not on your own initiative — and follow it with `./sandbox up`.

`./sandbox up` compares the daily snapshot's `harness_sha` to the installed
commit. If behind and `SANDBOX_AUTOUPDATE=1`, it updates the harness and
recreates the container. If `SANDBOX_AUTOUPDATE=0`, it prints a nudge line
instead. `SANDBOX_UPDATE_CHECK=0` silences both.

## Choosing the inner agent and model

The inner agent is the same product as the outer one, auto-detected from your
own environment: Codex outer → Codex inner, Claude → Claude, Cursor → Cursor.
Override per dispatch with `./sandbox -a cursor "task"`, or permanently with
`SANDBOX_DEFAULT_AGENT` in `tools/sandbox/sandbox.conf`.

**Not the same model.** What a dispatch starts is a manager: it writes a spec,
spawns cheaper workers for the edits and the tests, reviews, and answers. The
manager model is resolved by `tools/sandbox/model.sh` — `SANDBOX_MODEL`
(`./sandbox -m <id>`, one run), else a non-empty `<agent>_manager=` line in the
daily snapshot, else `SANDBOX_DEFAULT_MODEL`, else a high-value default per
agent. The outer client's model is deliberately not copied; the two halves have
different jobs.

The snapshot is `SANDBOX_MODEL_DAILY`: model/plan/promo text the **host**
fetches at most once every 24 hours into `$TMPDIR/sandbox-model-daily` and hands
to the container as an environment variable. It is read first and refetched only
when missing or stale, it is shared by every sandbox on the machine, and it is
**not a new mount** — the container never sees that path. A failed fetch still
writes a stub, so a dead network costs one attempt a day rather than one per
dispatch.

The snapshot also stores the upstream harness sha. `./sandbox up` compares it to
the installed commit: if behind and `SANDBOX_AUTOUPDATE=1`, the harness is
updated automatically before the container starts. The default is `0` (off) —
autoupdate rewrites host gate scripts, so it requires an explicit opt-in. Set
`SANDBOX_AUTOUPDATE=1` in `sandbox.conf` to enable, or `SANDBOX_UPDATE_CHECK=0`
to silence both the nudge and autoupdate.

You do not pick worker models and you do not tell the manager how to split the
job. The manager's standing rule is that tokens build scripts and only scripts
do work; those scripts stay in the project tree.

## Never

Read, print, or commit anything under `tools/sandbox/.cache/` — it holds live
OAuth tokens and a GitHub token.
