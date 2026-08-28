#!/usr/bin/env bash
set -euo pipefail

# Runs as root, sets up the agent user's world, then drops privileges for the
# long-lived container process.

# Match the host Docker socket GID so the agent user can talk to the host Docker
# daemon (Colima) through the mounted socket. Without this, every sibling
# container command fails with a bare permission error.
if [ -S /var/run/docker.sock ]; then
  sock_gid="$(stat -c '%g' /var/run/docker.sock)"
  if [ "$sock_gid" != "0" ] && ! id -G agent | tr ' ' '\n' | grep -qx "$sock_gid"; then
    getent group "$sock_gid" >/dev/null || groupadd -g "$sock_gid" docker-host
    usermod -aG "$sock_gid" agent
  fi
fi

# Inner's user-global instructions come from the baked-in rules, so it does the
# work directly instead of recursively dispatching back into its own sandbox.
# Every agent's filename is seeded, because any of the three may be the one
# running and none of them reads the others' conventions.
#
# This matters more than it looks: the project's own AGENTS.md says "you are the
# OUTER agent, dispatch everything". An inner agent that reads only that file
# would dutifully try to dispatch to itself. The user-global copy is what
# outranks it.
mkdir -p /home/agent/.claude /home/agent/.codex /home/agent/.cursor/rules \
         /home/agent/.gemini /home/agent/.config/amp /home/agent/.config/opencode

# ~/.claude.json lives in the directory mount, never as its own file mount.
# A file bind-mount pins an inode; host rewrites then desync and truncate it.
if [ ! -L /home/agent/.claude.json ]; then
  rm -f /home/agent/.claude.json
fi
[ -f /home/agent/.claude/claude.json ] || printf '{}\n' > /home/agent/.claude/claude.json
ln -sfn /home/agent/.claude/claude.json /home/agent/.claude.json
chown -h agent:"$(id -g agent)" /home/agent/.claude.json /home/agent/.claude/claude.json 2>/dev/null || true

if [ -f /etc/sandbox-agent.md ]; then
  cp -f /etc/sandbox-agent.md /home/agent/.claude/CLAUDE.md 2>/dev/null || true
  cp -f /etc/sandbox-agent.md /home/agent/.codex/AGENTS.md 2>/dev/null || true
  # Cursor's user-global equivalent is a rule with alwaysApply, so the same text
  # gets the frontmatter that makes it always apply.
  {
    printf -- '---\ndescription: You are the inner agent inside the sandbox container.\nalwaysApply: true\n---\n\n'
    cat /etc/sandbox-agent.md
  } >/home/agent/.cursor/rules/sandbox-inner.mdc 2>/dev/null || true
  # agy reads ~/.gemini/AGENTS.md as its user-global instruction file.
  cp -f /etc/sandbox-agent.md /home/agent/.gemini/AGENTS.md 2>/dev/null || true
  # Amp reads ~/.config/amp/AGENTS.md (or system.md — check current docs).
  cp -f /etc/sandbox-agent.md /home/agent/.config/amp/AGENTS.md 2>/dev/null || true
  # OpenCode reads ~/.config/opencode/instructions.md as its system prompt file.
  cp -f /etc/sandbox-agent.md /home/agent/.config/opencode/instructions.md 2>/dev/null || true
  chown -R agent:"$(id -g agent)" \
    /home/agent/.claude/CLAUDE.md /home/agent/.codex/AGENTS.md \
    /home/agent/.cursor \
    /home/agent/.gemini/AGENTS.md \
    /home/agent/.config/amp/AGENTS.md \
    /home/agent/.config/opencode/instructions.md 2>/dev/null || true
fi

as_agent() { gosu agent env HOME=/home/agent "$@"; }

# Mirror the host git identity so commits made inside carry the right author.
# Best-effort throughout: a transient config failure must never stop the
# container from starting, or a bad `git config` bricks the whole sandbox.
if [ -n "${HOST_GIT_NAME:-}" ]; then
  as_agent git config --global user.name "$HOST_GIT_NAME" || true
fi
if [ -n "${HOST_GIT_EMAIL:-}" ]; then
  as_agent git config --global user.email "$HOST_GIT_EMAIL" || true
fi

# Authenticate git to GitHub through the bridged token. gh reads the hosts.yml
# that github-token-sync.sh wrote into the mounted config dir and hands git a
# username/password on demand — no key, no ssh-agent, no prompt.
as_agent git config --global \
  'credential.https://github.com.helper' '!gh auth git-credential' || true

# DELIBERATE: the SSH->HTTPS rewrite lives in the container's ~/.gitconfig, not
# in the repo. .git/config is inside the bind-mounted worktree — the SAME FILE
# the Mac uses — so rewriting `origin` to suit the container would break every
# push the human makes outside it. Here, an SSH-form remote silently resolves to
# HTTPS and picks up the bridged token; on the Mac the remote is untouched.
as_agent git config --global 'url.https://github.com/.insteadOf' 'git@github.com:' || true

# Never let a bare `git commit` (no -m/-F) open an editor and hang a
# non-interactive agent run forever. Failing fast is the desired behavior.
as_agent git config --global core.editor /bin/false || true
export GIT_EDITOR=/bin/false VISUAL=/bin/false EDITOR=/bin/false

# Marker the gates read: anything running in here is already inside the
# boundary, so the outer-agent restrictions must not apply.
export SANDBOX_INNER=1

exec gosu agent env HOME=/home/agent SANDBOX_INNER=1 "$@"
