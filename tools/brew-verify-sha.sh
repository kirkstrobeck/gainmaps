#!/bin/sh
# Verify that Formula/gainmap.rb sha256 matches the published GitHub release tarball.
# Fails with exit 1 when the checked-in sha does not match the downloaded artifact.
# Run: sh tools/brew-verify-sha.sh
set -eu

FORMULA="$(cd "$(dirname "$0")/.." && pwd)/Formula/gainmap.rb"

VERSION="$(grep -E '^\s+version ' "$FORMULA" | sed 's/.*version "//' | sed 's/".*//')"
EXPECTED="$(grep -E '^\s+sha256 ' "$FORMULA" | sed 's/.*sha256 "//' | sed 's/".*//')"
URL="https://github.com/kirkstrobeck/gainmaps/releases/download/v${VERSION}/gainmap-${VERSION}.tgz"

echo "Formula version : $VERSION"
echo "Formula sha256  : $EXPECTED"
echo "Release URL     : $URL"

TMP="$(mktemp)"
trap 'rm -f "$TMP"' EXIT

if curl -fsSL "$URL" -o "$TMP" 2>/dev/null; then
  ACTUAL="$(sha256sum "$TMP" 2>/dev/null | awk '{print $1}' || shasum -a 256 "$TMP" | awk '{print $1}')"
  echo "Artifact sha256 : $ACTUAL"
  if [ "$ACTUAL" = "$EXPECTED" ]; then
    echo "OK — sha256 matches"
  else
    echo "FAIL — sha256 mismatch"
    exit 1
  fi
else
  echo "FAIL — could not download $URL (release may not exist yet)"
  exit 1
fi
