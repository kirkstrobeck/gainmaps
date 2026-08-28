#!/usr/bin/env bash
set -euo pipefail

PKG_DIR="$(cd "$(dirname "$0")/.." && pwd)"
CLI="node $PKG_DIR/dist/cli.js"
INPUT="$PKG_DIR/test/fixtures/input"
EXPECTED="$PKG_DIR/test/fixtures/expected"
CHECKSUMS="$PKG_DIR/test/fixtures/checksums.sha256"

mkdir -p "$EXPECTED"

BASE_FLAGS="--offline --quiet -j 1 --quality 92 --boost 0.5 --model highlight --matte white"

die() { echo "ERROR: $1" >&2; exit 1; }

run_scenario() {
  local name="$1"
  local input="$2"
  local extra_flags="${3:-}"
  local output="$EXPECTED/${name}.jpg"

  printf 'Generating %s...\n' "$name"

  local tmp1
  local tmp2
  tmp1="$(mktemp /tmp/gainmap-det-XXXXXX.jpg)"
  tmp2="$(mktemp /tmp/gainmap-det-XXXXXX.jpg)"
  trap 'rm -f "$tmp1" "$tmp2"' RETURN

  # shellcheck disable=SC2086
  $CLI "$input" -o "$tmp1" -f $BASE_FLAGS $extra_flags
  # shellcheck disable=SC2086
  $CLI "$input" -o "$tmp2" -f $BASE_FLAGS $extra_flags

  local h1 h2
  h1="$(sha256sum "$tmp1" | cut -d' ' -f1)"
  h2="$(sha256sum "$tmp2" | cut -d' ' -f1)"

  [ "$h1" = "$h2" ] || die "Non-deterministic output for $name: $h1 != $h2"

  cp "$tmp1" "$output"

  local magic
  magic="$(od -A n -t x1 -N 2 "$output" | tr -d ' \n')"
  [ "$magic" = "ffd8" ] || die "$output is not a JPEG (magic: $magic)"

  printf 'OK: %s\n' "$name"
}

run_scenario "png-default" "$INPUT/white.png"
run_scenario "jpg-default" "$INPUT/photo.jpg"
run_scenario "svg-default" "$INPUT/mark.svg"
run_scenario "gif-default" "$INPUT/frame.gif"
run_scenario "webp-default" "$INPUT/shot.webp"
run_scenario "quality-80" "$INPUT/photo.jpg" "--quality 80"
run_scenario "boost-1" "$INPUT/photo.jpg" "--boost 1"
run_scenario "headroom-4" "$INPUT/photo.jpg" "--headroom 4"
run_scenario "model-window" "$INPUT/photo.jpg" "--model window"
run_scenario "matte-checker" "$INPUT/mark.svg" "--matte checkerboard"
run_scenario "max-size-4" "$INPUT/photo.jpg" "--max-size 4"

# custom-output scenario (same as jpg-default but with explicit -o)
printf 'Generating custom-output...\n'
# shellcheck disable=SC2086
$CLI "$INPUT/photo.jpg" -o "$EXPECTED/custom.jpg" -f $BASE_FLAGS
printf 'OK: custom-output\n'

# suffix-hdr scenario: copy photo.jpg to temp dir, run with --suffix
printf 'Generating suffix-hdr...\n'
TMP_SFXDIR="$(mktemp -d)"
trap 'rm -rf "$TMP_SFXDIR"' EXIT
cp "$INPUT/photo.jpg" "$TMP_SFXDIR/photo.jpg"
# shellcheck disable=SC2086
$CLI "$TMP_SFXDIR/photo.jpg" $BASE_FLAGS --suffix -hdr
cp "$TMP_SFXDIR/photo-hdr.jpg" "$EXPECTED/suffix-hdr.jpg"
printf 'OK: suffix-hdr\n'

# Write checksums
printf 'Writing checksums...\n'
> "$CHECKSUMS"
for f in "$EXPECTED"/*.jpg; do
  rel="test/fixtures/expected/$(basename "$f")"
  sha256sum "$f" | awk -v rel="$rel" '{print $1 "  " rel}' >> "$CHECKSUMS"
done

printf 'Done! checksums.sha256 written.\n'
cat "$CHECKSUMS"
