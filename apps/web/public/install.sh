#!/bin/sh
# gainmap installer — gainmaps.com/install.sh
set -eu

TARBALL="${GAINMAP_TARBALL:-https://registry.npmjs.org/gainmap/-/gainmap-1.1.0.tgz}"
INSTALL_DIR="${GAINMAP_INSTALL_DIR:-$HOME/.local/bin}"
LIBEXEC="${GAINMAP_LIBEXEC:-$HOME/.gainmap/runtime}"
NODE_VERSION="${GAINMAP_NODE_VERSION:-24.19.0}"
TMP="$(mktemp -d)"
NODE_TMP="$(mktemp -d)"
trap 'rm -rf "$TMP" "$NODE_TMP"' EXIT

die() { printf 'gainmap: %s\n' "$1" >&2; exit 1; }

mkdir -p "$INSTALL_DIR" || die "$INSTALL_DIR is not writable — try: GAINMAP_INSTALL_DIR=~/.local/bin curl -fsSL https://gainmaps.com/install.sh | sh"
[ -w "$INSTALL_DIR" ] || die "$INSTALL_DIR is not writable — try: GAINMAP_INSTALL_DIR=~/.local/bin curl -fsSL https://gainmaps.com/install.sh | sh"

case "$TARBALL" in
  http://*|https://*)
    printf 'Downloading gainmap...\n'
    curl -fsSL "$TARBALL" | tar -xz -C "$TMP"
    ;;
  file://*)
    tar -xz -C "$TMP" -f "${TARBALL#file://}"
    ;;
  *)
    tar -xz -C "$TMP" -f "$TARBALL"
    ;;
esac

mkdir -p "$LIBEXEC/bin"
cp -r "$TMP/package/dist" "$TMP/package/package.json" "$LIBEXEC/"

case "$(uname -s)" in
  Darwin) NODE_OS=darwin ;;
  Linux)  NODE_OS=linux ;;
  *)      die "unsupported OS: $(uname -s)" ;;
esac
case "$(uname -m)" in
  x86_64|amd64)  NODE_ARCH=x64 ;;
  arm64|aarch64) NODE_ARCH=arm64 ;;
  *)             die "unsupported arch: $(uname -m)" ;;
esac

NODE_OK=0
if command -v node >/dev/null 2>&1; then
  NODE_MAJOR="$(node -e 'process.stdout.write(String(process.versions.node.split(".")[0]))' 2>/dev/null || echo 0)"
  if [ "$NODE_MAJOR" -ge 24 ] 2>/dev/null; then
    NODE_OK=1
  fi
fi

if [ "$NODE_OK" = "1" ]; then
  cp -L "$(command -v node)" "$LIBEXEC/bin/node"
  chmod 0755 "$LIBEXEC/bin/node"
  cd "$TMP/package"
  npm install --omit=dev --prefix "$LIBEXEC" .
fi
if [ "$NODE_OK" != "1" ]; then
  NODE_TARBALL="${GAINMAP_NODE_TARBALL:-https://nodejs.org/dist/v${NODE_VERSION}/node-v${NODE_VERSION}-${NODE_OS}-${NODE_ARCH}.tar.gz}"
  case "$NODE_TARBALL" in
    http://*|https://*)
      printf 'Downloading Node %s...\n' "$NODE_VERSION"
      curl -fsSL "$NODE_TARBALL" | tar -xz -C "$NODE_TMP"
      ;;
    file://*)
      tar -xz -C "$NODE_TMP" -f "${NODE_TARBALL#file://}"
      ;;
    *)
      tar -xz -C "$NODE_TMP" -f "$NODE_TARBALL"
      ;;
  esac
  NODE_BIN="$(find "$NODE_TMP" -name node -path '*/bin/node' | head -1)"
  [ -n "$NODE_BIN" ] || die "node binary not found in Node tarball"
  cp -L "$NODE_BIN" "$LIBEXEC/bin/node"
  chmod 0755 "$LIBEXEC/bin/node"
  NPM_CLI="$(find "$NODE_TMP" -path '*/lib/node_modules/npm/bin/npm-cli.js' | head -1)"
  [ -n "$NPM_CLI" ] || die "npm-cli.js not found in Node tarball"
  cd "$TMP/package"
  "$LIBEXEC/bin/node" "$NPM_CLI" install --omit=dev --prefix "$LIBEXEC" .
fi

LAUNCHER="$INSTALL_DIR/gainmap"
printf '#!/bin/sh\nexec "%s/bin/node" "%s/dist/cli.js" "$@"\n' "$LIBEXEC" "$LIBEXEC" > "$LAUNCHER"
chmod 0755 "$LAUNCHER"
printf 'gainmap installed to %s\n' "$LAUNCHER"
case ":$PATH:" in
  *":$INSTALL_DIR:"*)
    ;;
  *)
    printf 'Add %s to PATH, e.g. export PATH="%s:$PATH"\n' "$INSTALL_DIR" "$INSTALL_DIR"
    ;;
esac
