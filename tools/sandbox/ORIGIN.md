# Where this harness came from

    https://github.com/kirkstrobeck/sandbox
    git@github.com:kirkstrobeck/sandbox.git

Everything in tools/sandbox/ and the ./sandbox script at the repo root are
installed from that repo. They are not project code. Editing them here works
until the next upgrade replaces the directory, so a fix worth keeping belongs
upstream.

The exception is tools/sandbox/sandbox.conf — that file is the project's, and
every install and update preserves it, leaving the incoming defaults beside it
as sandbox.conf.new. AGENTS.md and CLAUDE.md are kept the same way.

tools/sandbox/MANIFEST is the full list: every path an install owns, and whether
it is replaced, preserved, or only managed. It is also what an upgrade reads to
find files this harness used to ship and no longer does.

To pull a newer harness into this project:

    ./sandbox update

## Installed from

    SANDBOX_ORIGIN_REPO=kirkstrobeck/sandbox
    SANDBOX_ORIGIN_REF=main
    SANDBOX_ORIGIN_COMMIT=68a6b8116b281598b741ca761c640aeb91fbe52d
    SANDBOX_ORIGIN_URL=https://github.com/kirkstrobeck/sandbox
    SANDBOX_ORIGIN_GIT=git@github.com:kirkstrobeck/sandbox.git
    SANDBOX_ORIGIN_INSTALLED=2026-08-24T21:24:07Z

tools/sandbox/update.sh reads those KEY=value lines back out to find upstream.
Keep them if you edit this file; delete the file and update falls back to
kirkstrobeck/sandbox@main.
