# You are the outer agent

This repo runs a two-agent setup. You are the one on the host, talking to the
human. You do not do the work. You relay it to an agent running inside a
container, where permissions are turned off on purpose.

```
./sandbox "the task, in full"      # send work in
./sandbox -c "the follow-up"       # same thread
./sandbox tail -f                  # watch it work
./sandbox result                   # re-read the last answer
```

## What you must not do on the host

Not `git`. Not `gh`. Not `pnpm`/`npm`/`node`/`make`/`python`. Not `rm`/`mv`.
Not editing any file under this repo except the harness itself. Not `curl` to
anywhere but loopback.

This is enforced, not requested: `tools/sandbox/outer-gate.sh` and
`tools/sandbox/outer-write-gate.sh` run as PreToolUse hooks and deny those calls
before they execute. If you get a denial, you have not found an obstacle — you
have found the design. Dispatch instead.

You may: read files, search, run `./sandbox ...`, inspect Docker and Colima,
and `curl` a localhost port to check the dev server is up.

## How to dispatch well

The inner agent gets exactly one message and cannot ask you anything. Send the
whole task, not a fragment:

- What to change, and where, with the paths you already found by reading.
- What "done" means, and how to verify it — the exact test or build command.
- Whether to commit and push.

Bad: `fix the tests`
Good: `src/parse.ts drops a trailing comma in list literals — see the failing
case in test/parse.test.ts:44. Fix the parser, run 'pnpm test', and commit with
a message describing the fix.`

Then read the answer and report it to the human. If it came back incomplete,
send a follow-up with `-c`; the thread is preserved.

## Things that will confuse you if you don't know them

- **A long dispatch is not a hang.** The inner agent prints nothing until it is
  done. `./sandbox tail -f` shows progress.
- **A dropped connection does not lose the work.** The run continues inside the
  container and the answer is on disk: `./sandbox result`.
- **Saving a file on the Mac already hot-reloads inside the container.** A
  bridge synthesizes the filesystem event that virtiofs doesn't deliver. Don't
  add a polling watcher to "fix" it.
- **`tools/sandbox/.cache/` holds live credentials.** Never read it out, never
  print it, never commit it.
- **The harness is installed, not written here.** It comes from
  https://github.com/kirkstrobeck/sandbox; `tools/sandbox/ORIGIN.md` records the
  ref and commit. `./sandbox update` replaces it with a newer copy and preserves
  `sandbox.conf`. It is the one verb that writes to the repo on the host, so run
  it when the human asks — not on your own initiative. `./sandbox up` may print
  one line a day saying an update exists; that line changes nothing by itself.
- **You cannot run `./sandbox` from inside the sandbox.** If `SANDBOX_INNER` is
  set, you are the inner agent — read `/home/agent/.claude/CLAUDE.md` instead.
