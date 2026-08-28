#!/bin/sh
set -eu

export GAINMAP_NO_UPDATE_CHECK=1

GAINMAP_BIN="${GAINMAP_BIN:-gainmap}"
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PKG_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
FIXTURES="$PKG_DIR/test/fixtures"
INPUT="$FIXTURES/input"
EXPECTED="$FIXTURES/expected"
CHECKSUMS="$FIXTURES/checksums.sha256"

PKG_VERSION="$(node -e "process.stdout.write(require('$PKG_DIR/package.json').version)")"

PASS=0
FAIL=0

ok()  { PASS=$((PASS+1)); printf '\033[32m✓\033[0m %s\n' "$1"; }
fail(){ FAIL=$((FAIL+1)); printf '\033[31m✗\033[0m %s\n' "$1"; }

# 1. --help exits 0 and contains "gainmap"
if "$GAINMAP_BIN" --help 2>&1 | grep -q "gainmap"; then
  ok "--help contains 'gainmap'"
else
  fail "--help contains 'gainmap'"
fi

# 2. --version exits 0 and contains package version
if "$GAINMAP_BIN" --version 2>&1 | grep -qF "gainmap $PKG_VERSION"; then
  ok "--version matches package.json ($PKG_VERSION)"
else
  fail "--version matches package.json ($PKG_VERSION) — got: $("$GAINMAP_BIN" --version 2>&1 || true)"
fi

# 3. Missing input exits 2
if "$GAINMAP_BIN" /nonexistent/missing.png >/dev/null 2>&1; then
  fail "missing input exits non-zero"
else
  CODE=$?
  if [ "$CODE" -eq 2 ]; then
    ok "missing input exits 2"
  else
    fail "missing input exits 2 (got $CODE)"
  fi
fi

# 4. Empty dir exits 2
TMPDIR_EMPTY="$(mktemp -d)"
if "$GAINMAP_BIN" "$TMPDIR_EMPTY" >/dev/null 2>&1; then
  fail "empty dir exits non-zero"
else
  CODE=$?
  if [ "$CODE" -eq 2 ]; then
    ok "empty dir exits 2"
  else
    fail "empty dir exits 2 (got $CODE)"
  fi
fi
rm -rf "$TMPDIR_EMPTY"

# 5. Garbage file exits non-zero
TMPDIR_GARBAGE="$(mktemp -d)"
printf 'not-an-image' > "$TMPDIR_GARBAGE/bad.file"
if "$GAINMAP_BIN" "$TMPDIR_GARBAGE/bad.file" >/dev/null 2>&1; then
  fail "garbage file exits non-zero"
else
  ok "garbage file exits non-zero"
fi
rm -rf "$TMPDIR_GARBAGE"

# 6. Dry-run
if "$GAINMAP_BIN" -n "$INPUT/photo.jpg" >/dev/null 2>&1; then
  ok "dry-run exits 0"
else
  fail "dry-run exits 0"
fi

# 7. --no-clobber: second run skips
TMPDIR_NC="$(mktemp -d)"
cp "$INPUT/photo.jpg" "$TMPDIR_NC/photo.jpg"
"$GAINMAP_BIN" "$TMPDIR_NC/photo.jpg" --offline --quiet -j 1 >/dev/null 2>&1 || true
if "$GAINMAP_BIN" "$TMPDIR_NC/photo.jpg" --no-clobber --offline --quiet -j 1 >/dev/null 2>&1; then
  ok "--no-clobber second run exits 0 (skip)"
else
  fail "--no-clobber second run exits 0 (skip)"
fi
rm -rf "$TMPDIR_NC"

# 8. -f force: both conversions succeed
TMPDIR_F="$(mktemp -d)"
cp "$INPUT/photo.jpg" "$TMPDIR_F/photo.jpg"
if "$GAINMAP_BIN" "$TMPDIR_F/photo.jpg" --offline --quiet -j 1 >/dev/null 2>&1 && \
   "$GAINMAP_BIN" "$TMPDIR_F/photo.jpg" -f --offline --quiet -j 1 >/dev/null 2>&1; then
  ok "-f force both runs succeed"
else
  fail "-f force both runs succeed"
fi
rm -rf "$TMPDIR_F"

# 9. stdin + stdout: output starts with FF D8
TMPOUT="$(mktemp)"
if cat "$INPUT/photo.jpg" | "$GAINMAP_BIN" --stdin --stdout --offline --quiet >"$TMPOUT" 2>/dev/null; then
  MAGIC="$(od -A n -t x1 -N 2 "$TMPOUT" | tr -d ' \n')"
  if [ "$MAGIC" = "ffd8" ]; then
    ok "stdin+stdout output is JPEG"
  else
    fail "stdin+stdout output is JPEG (magic: $MAGIC)"
  fi
else
  fail "stdin+stdout exits 0"
fi
rm -f "$TMPOUT"

# 10. -R recursive and --exclude
TMPDIR_R="$(mktemp -d)"
cp -r "$INPUT/tree" "$TMPDIR_R/"
if "$GAINMAP_BIN" -R "$TMPDIR_R/tree" --exclude '**/skip/**' --offline --quiet -j 1 >/dev/null 2>&1; then
  if [ -f "$TMPDIR_R/tree/a-gain.jpg" ] && [ -f "$TMPDIR_R/tree/nested/b-gain.jpg" ]; then
    ok "-R recursive converts nested"
  else
    fail "-R recursive converts nested"
  fi
  if [ ! -f "$TMPDIR_R/tree/skip/c-gain.jpg" ]; then
    ok "--exclude skips directory"
  else
    fail "--exclude skips directory"
  fi
else
  fail "-R recursive exits 0"
fi
rm -rf "$TMPDIR_R"

# 11. --ext jpg: converts .jpg but not .png
TMPDIR_EXT="$(mktemp -d)"
cp "$INPUT/photo.jpg" "$TMPDIR_EXT/photo.jpg"
cp "$INPUT/white.png" "$TMPDIR_EXT/white.png"
"$GAINMAP_BIN" --ext jpg "$TMPDIR_EXT" --offline --quiet -j 1 >/dev/null 2>&1 || true
if [ -f "$TMPDIR_EXT/photo-gain.jpg" ]; then
  ok "--ext jpg converts photo.jpg"
else
  fail "--ext jpg converts photo.jpg"
fi
if [ ! -f "$TMPDIR_EXT/white-gain.jpg" ]; then
  ok "--ext jpg skips white.png"
else
  fail "--ext jpg skips white.png (unexpected output found)"
fi
rm -rf "$TMPDIR_EXT"

# 12. --continue: corrupt + good file
TMPDIR_CONT="$(mktemp -d)"
printf 'garbage' > "$TMPDIR_CONT/bad.jpg"
cp "$INPUT/photo.jpg" "$TMPDIR_CONT/good.jpg"
"$GAINMAP_BIN" --continue "$TMPDIR_CONT" --offline --quiet -j 1 >/dev/null 2>&1 || true
if [ -f "$TMPDIR_CONT/good-gain.jpg" ]; then
  ok "--continue processes good file even with corrupt input"
else
  fail "--continue processes good file"
fi
rm -rf "$TMPDIR_CONT"

# 13. -o directory/: output to directory
TMPDIR_OUT="$(mktemp -d)"
TMPDIR_SRC="$(mktemp -d)"
cp "$INPUT/photo.jpg" "$TMPDIR_SRC/photo.jpg"
if "$GAINMAP_BIN" "$TMPDIR_SRC/photo.jpg" -o "$TMPDIR_OUT/" --offline --quiet -j 1 >/dev/null 2>&1; then
  ok "-o directory/ exits 0"
else
  fail "-o directory/ exits 0"
fi
rm -rf "$TMPDIR_OUT" "$TMPDIR_SRC"

# 14. convert alias — run an actual conversion
TMPDIR_CONV="$(mktemp -d)"
cp "$INPUT/photo.jpg" "$TMPDIR_CONV/photo.jpg"
if "$GAINMAP_BIN" convert "$TMPDIR_CONV/photo.jpg" --offline --quiet -j 1 >/dev/null 2>&1; then
  ok "convert alias runs actual conversion"
else
  fail "convert alias runs actual conversion"
fi
rm -rf "$TMPDIR_CONV"

# 15. --offline works without network
TMPDIR_OFL="$(mktemp -d)"
cp "$INPUT/photo.jpg" "$TMPDIR_OFL/photo.jpg"
if "$GAINMAP_BIN" "$TMPDIR_OFL/photo.jpg" --offline --quiet -j 1 >/dev/null 2>&1; then
  ok "--offline works"
else
  fail "--offline works"
fi
rm -rf "$TMPDIR_OFL"

# 16. Recursive -o directory mirrors source tree without -gain
TMPDIR_MIRROR="$(mktemp -d)"
cp -r "$INPUT/tree" "$TMPDIR_MIRROR/shots"
TMPDIR_MOUT="$TMPDIR_MIRROR/out"
if "$GAINMAP_BIN" -R "$TMPDIR_MIRROR/shots" -o "$TMPDIR_MOUT" --offline --quiet -j 1 >/dev/null 2>&1; then
  if [ -f "$TMPDIR_MOUT/a.jpg" ] && [ -f "$TMPDIR_MOUT/nested/b.jpg" ]; then
    ok "-R -o dir mirrors nested"
  else
    fail "-R -o dir mirrors nested"
  fi
  if [ ! -f "$TMPDIR_MOUT/a-gain.jpg" ]; then
    ok "-R -o dir does not append -gain"
  else
    fail "-R -o dir does not append -gain"
  fi
else
  fail "-R -o dir exits 0"
fi
rm -rf "$TMPDIR_MIRROR"

# 17. --in-place overwrites the original JPEG and does not write a sibling
TMPDIR_IP="$(mktemp -d)"
cp "$INPUT/photo.jpg" "$TMPDIR_IP/photo.jpg"
BEFORE_HASH="$(sha256sum "$TMPDIR_IP/photo.jpg" | awk '{print $1}')"
if "$GAINMAP_BIN" -i "$TMPDIR_IP/photo.jpg" --offline --quiet -j 1 >/dev/null 2>&1; then
  AFTER_HASH="$(sha256sum "$TMPDIR_IP/photo.jpg" | awk '{print $1}')"
  if [ -f "$TMPDIR_IP/photo.jpg" ] && [ ! -f "$TMPDIR_IP/photo-gain.jpg" ] && [ "$BEFORE_HASH" != "$AFTER_HASH" ]; then
    ok "--in-place overwrites original jpeg"
  else
    fail "--in-place overwrites original jpeg"
  fi
else
  fail "--in-place exits 0"
fi
rm -rf "$TMPDIR_IP"

# Base flags shared by all golden scenarios (must match generate-goldens.sh)
BASE_FLAGS="--offline --quiet -j 1 --quality 92 --boost 0.5 --model highlight --matte white"

# Convert a scenario to a temp file, assert JPEG magic, compare hash to checksums.sha256.
# Usage: check_scenario NAME INPUT [EXTRA_FLAGS]
check_scenario() {
  _cs_name="$1"
  _cs_input="$2"
  _cs_extra="${3:-}"
  _cs_out="$(mktemp /tmp/gainmap-e2e-XXXXXX.jpg)"
  # shellcheck disable=SC2086
  if ! "$GAINMAP_BIN" "$_cs_input" -o "$_cs_out" -f $BASE_FLAGS $_cs_extra >/dev/null 2>&1; then
    rm -f "$_cs_out"
    fail "$_cs_name: conversion failed"
    return
  fi
  _cs_magic="$(od -A n -t x1 -N 2 "$_cs_out" | tr -d ' \n')"
  if [ "$_cs_magic" != "ffd8" ]; then
    rm -f "$_cs_out"
    fail "$_cs_name: not JPEG (magic: $_cs_magic)"
    return
  fi
  _cs_want="$(grep "test/fixtures/expected/${_cs_name}.jpg" "$CHECKSUMS" | awk '{print $1}')"
  if [ -z "$_cs_want" ]; then
    rm -f "$_cs_out"
    fail "$_cs_name: no entry in checksums.sha256"
    return
  fi
  _cs_got="$(sha256sum "$_cs_out" | awk '{print $1}')"
  rm -f "$_cs_out"
  if [ "$_cs_got" = "$_cs_want" ]; then
    ok "$_cs_name: JPEG magic ok, hash matches checksums.sha256"
  else
    fail "$_cs_name: hash mismatch (want $_cs_want, got $_cs_got)"
  fi
}

# suffix-hdr: --suffix puts the output beside the source, not via -o
check_suffix_hdr() {
  _sh_dir="$(mktemp -d)"
  cp "$INPUT/photo.jpg" "$_sh_dir/photo.jpg"
  # shellcheck disable=SC2086
  if ! "$GAINMAP_BIN" "$_sh_dir/photo.jpg" $BASE_FLAGS --suffix -hdr >/dev/null 2>&1; then
    rm -rf "$_sh_dir"
    fail "suffix-hdr: conversion failed"
    return
  fi
  _sh_out="$_sh_dir/photo-hdr.jpg"
  if [ ! -f "$_sh_out" ]; then
    rm -rf "$_sh_dir"
    fail "suffix-hdr: photo-hdr.jpg not created"
    return
  fi
  _sh_magic="$(od -A n -t x1 -N 2 "$_sh_out" | tr -d ' \n')"
  if [ "$_sh_magic" != "ffd8" ]; then
    rm -rf "$_sh_dir"
    fail "suffix-hdr: not JPEG (magic: $_sh_magic)"
    return
  fi
  _sh_want="$(grep "test/fixtures/expected/suffix-hdr.jpg" "$CHECKSUMS" | awk '{print $1}')"
  if [ -z "$_sh_want" ]; then
    rm -rf "$_sh_dir"
    fail "suffix-hdr: no entry in checksums.sha256"
    return
  fi
  _sh_got="$(sha256sum "$_sh_out" | awk '{print $1}')"
  rm -rf "$_sh_dir"
  if [ "$_sh_got" = "$_sh_want" ]; then
    ok "suffix-hdr: JPEG magic ok, hash matches checksums.sha256"
  else
    fail "suffix-hdr: hash mismatch (want $_sh_want, got $_sh_got)"
  fi
}

# 16. Fresh-convert each golden scenario and assert JPEG magic + checksum match
check_scenario "png-default"   "$INPUT/white.png"
check_scenario "jpg-default"   "$INPUT/photo.jpg"
check_scenario "svg-default"   "$INPUT/mark.svg"
check_scenario "gif-default"   "$INPUT/frame.gif"
check_scenario "webp-default"  "$INPUT/shot.webp"
check_scenario "quality-80"    "$INPUT/photo.jpg" "--quality 80"
check_scenario "boost-1"       "$INPUT/photo.jpg" "--boost 1"
check_scenario "headroom-4"    "$INPUT/photo.jpg" "--headroom 4"
check_scenario "model-window"  "$INPUT/photo.jpg" "--model window"
check_scenario "matte-checker" "$INPUT/mark.svg"  "--matte checkerboard"
check_scenario "max-size-4"    "$INPUT/photo.jpg" "--max-size 4"
check_scenario "custom"        "$INPUT/photo.jpg"
check_suffix_hdr

printf '\n'
printf 'Results: %d passed, %d failed\n' "$PASS" "$FAIL"
[ "$FAIL" -eq 0 ] || exit 1
