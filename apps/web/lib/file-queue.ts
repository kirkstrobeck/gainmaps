// Module-level store for the home-page → convert handoff.
let queued: File[] = [];
export function enqueueFiles(files: File[]) { queued = files; }
export function dequeueFiles(): File[] { const out = queued; queued = []; return out; }
