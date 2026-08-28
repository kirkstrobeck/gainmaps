#!/usr/bin/env bash
# Read tools/sandbox/MANIFEST. Source, don't run.
#
# The manifest is the list of paths an install owns. Before it existed,
# ownership was implicit — install.sh deleted tools/sandbox and copied a new one
# — which worked for files inside that directory and quietly failed for
# everything outside it. A file the harness stopped shipping stayed in every
# project that had ever installed it, forever, and nothing reported it.
#
# So the source of truth moved into a checked-in file that install.sh, update.sh,
# doctor.sh and gate-test.sh all read. Adding a path is one line; removing a path
# is deleting that line, and the next `./sandbox update` deletes the file.

# One entry per line: "<mode> <path>". Comments and blank lines are dropped, and
# so is the "version N" header, which is metadata rather than an entry.
#
# Paths are project-relative and are filtered here rather than at each call
# site. install.sh does `rm -rf "$TARGET/$path"` for a path that left the
# manifest, and the manifest it reads for that is the one already in the
# project — a file this script cannot vouch for. An absolute path or a `..`
# component would walk that delete straight out of the project, so those entries
# never make it out of the parser.
manifest_entries() {
  [ -r "$1" ] || return 0
  sed -e 's/#.*//' -e 's/[[:space:]]\{1,\}$//' "$1" |
    awk 'NF >= 2 && $1 != "version" {
      p = $2
      if (p ~ /^\//) next
      if (p == ".." || p ~ /(^|\/)\.\.(\/|$)/) next
      print $1 " " p
    }'
}

manifest_paths() {
  local file="$1" want="${2:-}"
  manifest_entries "$file" | awk -v w="$want" '(w == "" || $1 == w) { print $2 }'
}

manifest_mode() {
  manifest_entries "$1" | awk -v p="$2" '$2 == p { print $1; exit }'
}

manifest_version() {
  [ -r "$1" ] || { printf '0\n'; return 0; }
  sed -e 's/#.*//' "$1" | awk '$1 == "version" { print $2; exit }'
}

# Drift guard. Every path the manifest says is copied from the source tree has to
# actually be in the source tree, or an install writes a manifest promising files
# it never delivered — and the next update then "removes" them. Prints the
# missing paths and returns 1.
#
# `manage` paths are exempt: they are merged, generated, or the project's own,
# and by definition do not exist in the source tree.
manifest_missing_sources() {
  local src="$1" file="$2" mode path missing=0
  while read -r mode path; do
    [ -n "$path" ] || continue
    case "$mode" in replace|preserve) ;; *) continue ;; esac
    [ -e "$src/$path" ] && continue
    printf '%s\n' "$path"
    missing=1
  done <<EOF
$(manifest_entries "$file")
EOF
  [ "$missing" -eq 0 ]
}
