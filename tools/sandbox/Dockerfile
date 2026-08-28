# The sandbox image. Everything the inner agent is allowed to touch lives in
# here; the Mac keeps nothing but the repo bind mount and the credential files
# boot.sh copies in.

ARG NODE_IMAGE=node:24-bookworm-slim
FROM ${NODE_IMAGE}

ARG DOCKER_CLI_VERSION=27.5.1
ARG PNPM_VERSION=10.15.0
ARG CODEX_VERSION=latest
ARG CURSOR_VERSION=latest
ARG COPILOT_CLI_VERSION=latest
ARG AMP_CLI_VERSION=latest
ARG OPENCODE_VERSION=latest
ARG WITH_PLAYWRIGHT=0
ARG PLAYWRIGHT_VERSION=1.55.0
ARG HOST_UID=1000
ARG HOST_GID=1000
ARG SANDBOX_STACK=v3

# boot.sh reads this label off the built image and rebuilds when it drifts from
# sandbox.conf. Without it, a Dockerfile change silently never reaches anyone
# who already has an image cached.
LABEL dev.sandbox.agent-stack="${SANDBOX_STACK}"

ENV DEBIAN_FRONTEND=noninteractive \
    NODE_ENV=development \
    PNPM_HOME=/usr/local/pnpm \
    PATH=/usr/local/pnpm:$PATH

RUN apt-get update && apt-get install -y --no-install-recommends \
      ca-certificates curl gnupg git less jq ripgrep procps psmisc \
      openssh-client unzip xz-utils gosu tini python3 \
    && rm -rf /var/lib/apt/lists/*

# GitHub CLI from GitHub's own apt repo — Debian's package is far behind and the
# token bridge depends on `gh auth git-credential`, which older builds lack.
RUN mkdir -p /etc/apt/keyrings \
    && curl -fsSL https://cli.github.com/packages/githubcli-archive-keyring.gpg \
       -o /etc/apt/keyrings/githubcli-archive-keyring.gpg \
    && chmod go+r /etc/apt/keyrings/githubcli-archive-keyring.gpg \
    && echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/githubcli-archive-keyring.gpg] https://cli.github.com/packages stable main" \
       > /etc/apt/sources.list.d/github-cli.list \
    && apt-get update && apt-get install -y --no-install-recommends gh \
    && rm -rf /var/lib/apt/lists/*

# Static Docker CLI, NOT Debian's docker.io. Debian ships a client speaking API
# 1.41; Colima's daemon is newer, and the mismatch shows up as confusing
# "client is newer/older than server" failures on the first sibling-container
# command. Pinning the static binary keeps the client under our control.
RUN set -eux; \
    arch="$(dpkg --print-architecture)"; \
    case "$arch" in \
      amd64) dl_arch=x86_64 ;; \
      arm64) dl_arch=aarch64 ;; \
      *) echo "unsupported arch: $arch" >&2; exit 1 ;; \
    esac; \
    curl -fsSL "https://download.docker.com/linux/static/stable/${dl_arch}/docker-${DOCKER_CLI_VERSION}.tgz" \
      -o /tmp/docker.tgz; \
    tar -xzf /tmp/docker.tgz -C /tmp; \
    install -m 0755 /tmp/docker/docker /usr/local/bin/docker; \
    rm -rf /tmp/docker /tmp/docker.tgz; \
    docker --version

# Agent CLIs. These are the whole point of the image: the inner agent runs here
# with permission checks off, because the container is the boundary.
RUN npm install -g \
      "pnpm@${PNPM_VERSION}" \
      "@anthropic-ai/claude-code@latest" \
      "@openai/codex@${CODEX_VERSION}" \
    && npm cache clean --force

# Wave 1 agent CLIs. Installed best-effort: a failed install is logged but does
# not break the image build. The binary is tried at dispatch time; if it is
# missing the dispatch fails with a clear "command not found" message directing
# the user to install manually or add to the Dockerfile.
#
# Copilot CLI: @github/copilot-cli is the published npm package for the
# standalone headless Copilot agent. Package name subject to change; verify
# against https://www.npmjs.com/org/github.
#
# Amp: @sourcegraph/amp-cli provides the `amp` binary.
#
# OpenCode: opencode on npm.
#
# agy (Antigravity): the Gemini CLI successor. Not yet on npm as of the current
# image build; install-on-first-dispatch is the fallback (the container has node,
# so `npm install -g agy` inside the container works without a rebuild).
RUN npm install -g \
      "@github/copilot-cli@${COPILOT_CLI_VERSION}" \
      "@sourcegraph/amp-cli@${AMP_CLI_VERSION}" \
      "opencode@${OPENCODE_VERSION}" \
    2>/dev/null || echo "WARN: one or more Wave-1 CLIs failed to install; dispatch will error if that CLI is requested." \
    && npm cache clean --force 2>/dev/null || true

# The Cursor CLI is not on npm. Its installer downloads a self-contained package
# and symlinks the binary into ~/.local/bin, which would put it in root's home
# during a build; the tarball goes to a system path here instead, and both names
# the CLI answers to are linked so `agent` and `cursor-agent` both work.
#
# CURSOR_VERSION=latest reads the version out of the official install script
# rather than guessing a URL — that script is where Cursor publishes which lab
# build is current. Pin an explicit version in sandbox.conf for a reproducible
# image; `latest` is a floating dependency by definition.
RUN set -eux; \
    case "$(dpkg --print-architecture)" in \
      amd64) cur_arch=x64 ;; \
      arm64) cur_arch=arm64 ;; \
      *) echo "unsupported arch for the Cursor CLI" >&2; exit 1 ;; \
    esac; \
    ver="${CURSOR_VERSION}"; \
    if [ "$ver" = "latest" ]; then \
      ver="$(curl -fsSL https://cursor.com/install \
             | sed -n 's#.*/lab/\([0-9][^/"]*\)/.*#\1#p' | head -1)"; \
      [ -n "$ver" ] || { echo "could not read the current Cursor CLI version" >&2; exit 1; }; \
    fi; \
    mkdir -p /usr/local/share/cursor-agent; \
    curl -fsSL "https://downloads.cursor.com/lab/${ver}/linux/${cur_arch}/agent-cli-package.tar.gz" \
      | tar --strip-components=1 -xzf - -C /usr/local/share/cursor-agent; \
    ln -sf /usr/local/share/cursor-agent/cursor-agent /usr/local/bin/agent; \
    ln -sf /usr/local/share/cursor-agent/cursor-agent /usr/local/bin/cursor-agent; \
    agent --version

# Browsers are big; most projects don't need them. Off by default.
ENV PLAYWRIGHT_BROWSERS_PATH=/ms-playwright
RUN if [ "${WITH_PLAYWRIGHT}" = "1" ]; then \
      npx --yes "playwright@${PLAYWRIGHT_VERSION}" install --with-deps chromium \
      && chmod -R a+rX /ms-playwright; \
    fi

# The agent user must own files at the host UID/GID, or every file the container
# writes lands on the Mac owned by somebody else. The node base image already
# claims uid 1000, so make room before creating ours.
RUN set -eux; \
    if id node >/dev/null 2>&1; then userdel -r node 2>/dev/null || userdel node; fi; \
    if ! getent group "${HOST_GID}" >/dev/null; then groupadd -g "${HOST_GID}" agent; fi; \
    useradd -m -u "${HOST_UID}" -g "${HOST_GID}" -s /bin/bash agent; \
    mkdir -p /home/agent/.claude /home/agent/.codex /home/agent/.cursor \
             /home/agent/.cursor/rules /home/agent/.config/gh \
             /home/agent/.config/cursor /home/agent/.local/bin /workspace; \
    chown -R "${HOST_UID}:${HOST_GID}" /home/agent /workspace

# The repo arrives as a bind mount owned by the host user, and git refuses to
# operate in a tree it thinks belongs to someone else. Inside a throwaway
# container with one human's code, that check protects nothing.
RUN git config --system --add safe.directory '*'

# Inner agent rules, seeded into every agent's home dir by the entrypoint.
COPY AGENT.md /etc/sandbox-agent.md
COPY entrypoint.sh /usr/local/bin/sandbox-entrypoint
COPY mac-save-bridge.mjs /usr/local/lib/mac-save-bridge.mjs
RUN chmod 0755 /usr/local/bin/sandbox-entrypoint

WORKDIR /workspace
# tini reaps the zombies that a long-lived `sleep infinity` container otherwise
# accumulates from every docker exec that dies mid-run.
ENTRYPOINT ["/usr/bin/tini", "--", "/usr/local/bin/sandbox-entrypoint"]
CMD ["sleep", "infinity"]
