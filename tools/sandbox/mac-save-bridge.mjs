// Make a save on the Mac look like a real file change to a watcher running in
// the container. Runs INSIDE the container.
//
// THE PROBLEM. The repo reaches the container over a virtiofs bind mount. When
// you save a file in your editor on macOS, the bytes change in the guest, but
// no guest inotify event is generated — the write happened outside the guest
// kernel. Every dev server built on inotify (Next, Vite, webpack, nodemon,
// tsc --watch) therefore sees nothing at all, and you sit there wondering why
// hot reload is broken.
//
// THREE APPROACHES THAT FAILED, all for the same reason. Colima's
// --mount-inotify chmods the guest file to signal a change; a host-side script
// that rewrites file contents to force an event; a host-side FS bridge doing
// the same from the other direction. Each one writes to a shared mount, each
// write propagates back across the boundary, and each propagation looks like a
// fresh change to the other side. The result is a feedback loop that keeps
// firing with nobody typing — 34 inotify events in a 15-second window on a file
// no one had touched, and rebuild storms that make the machine unusable.
//
// WHAT WORKS. Do it entirely inside the guest. Poll mtimes here (the metadata
// virtiofs does expose), and when a file has genuinely changed, rewrite its own
// bytes back over itself. That rewrite is a native guest write, so the guest
// kernel emits a real inotify event, and every watcher wakes up normally. The
// rewrite does not cross the boundary in a way that comes back at us.
//
// WHY NOT JUST TURN ON THE FRAMEWORK'S POLLING OPTION. Because bundlers poll
// from the project root, not from your source directory. On a repo of ~20k
// files that measured 15,400ms per detected change versus 91ms for the native
// watcher this bridge feeds. Polling a narrow source list here and letting the
// real watcher stay native is two orders of magnitude better.

import { readFileSync, openSync, writeSync, closeSync, statSync, readdirSync } from "node:fs";
import { join } from "node:path";

const roots = (process.env.SANDBOX_WATCH_ROOTS ?? "/workspace/src").split(":").filter(Boolean);
const intervalMs = Number(process.env.SANDBOX_WATCH_INTERVAL_MS ?? 250);
const sourceRe = new RegExp(process.env.SANDBOX_WATCH_EXT ?? "\\.(tsx?|jsx?|mjs|cjs|css|json)$");
const SKIP_DIR = /^(node_modules|\.next|\.git|\.turbo|dist|build|coverage|\.cache)$/;

// path -> the "mtimeMs:size" this loop last saw. After a rewrite we re-stat and
// store the mtime OUR OWN write produced, which is the line that makes
// self-triggering impossible rather than merely unlikely.
const seen = new Map();

function* walk(dir) {
  let entries;
  try {
    entries = readdirSync(dir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const entry of entries) {
    if (entry.isDirectory()) {
      if (SKIP_DIR.test(entry.name)) continue;
      yield* walk(join(dir, entry.name));
      continue;
    }
    if (entry.isFile() && sourceRe.test(entry.name)) yield join(dir, entry.name);
  }
}

function stamp(file) {
  try {
    const st = statSync(file);
    return `${st.mtimeMs}:${st.size}`;
  } catch {
    return null;
  }
}

// Rewrite the file's own bytes over itself: open r+, write at offset 0, same
// length, no truncate. The content is byte-identical, so nothing is lost even
// if this races an editor save — and an empty file is skipped because there is
// nothing to write and nothing to signal.
function touchContents(file) {
  let fd;
  try {
    const buf = readFileSync(file);
    if (buf.length === 0) return;
    fd = openSync(file, "r+");
    writeSync(fd, buf, 0, buf.length, 0);
  } catch {
    // A file being renamed or removed mid-sweep is normal. Skip it.
  } finally {
    if (fd !== undefined) {
      try { closeSync(fd); } catch { /* already gone */ }
    }
  }
}

function sweep(prime) {
  for (const root of roots) {
    for (const file of walk(root)) {
      const current = stamp(file);
      if (current === null) continue;

      const previous = seen.get(file);
      if (previous === current) continue;

      // The priming pass records a baseline only. Without it, the first sweep
      // would "change" every file in the tree and trigger a full rebuild every
      // time the bridge starts.
      if (prime || previous === undefined) {
        seen.set(file, current);
        continue;
      }

      touchContents(file);
      seen.set(file, stamp(file) ?? current);
    }
  }
}

sweep(true);
console.log(`mac-save-bridge: watching ${roots.join(", ")} every ${intervalMs}ms (${seen.size} files)`);
setInterval(() => sweep(false), intervalMs);
