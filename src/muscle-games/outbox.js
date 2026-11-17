// Score outbox: a run whose save fails (offline, Wi-Fi drop, server hiccup) is kept in this browser and sent again
// later — when the page loads, when the device comes back online, and every 20 s while something is waiting.
// The host saves by runId, so sending a run twice never counts it twice.
// Runs are tagged with the host's playerId and only sent while that same player is signed in, so a shared
// classroom computer never uploads one student's run under another student's account.

const KEY = 'muscle-games:outbox';
const MAX_RUNS = 50;
const MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

function load() {
  try {
    const list = JSON.parse(localStorage.getItem(KEY));
    const since = Date.now() - MAX_AGE_MS;
    return Array.isArray(list) ? list.filter((e) => e?.run?.runId && e.queuedAt > since) : [];
  } catch {
    return [];
  }
}

function store(list) {
  try {
    if (list.length) localStorage.setItem(KEY, JSON.stringify(list.slice(-MAX_RUNS)));
    else localStorage.removeItem(KEY);
  } catch {
    /* storage unavailable: the run stays only in memory for this page */
  }
}

const listeners = new Set();
const notify = () => listeners.forEach((fn) => fn());

/** Calls fn whenever the outbox changes; returns an unsubscribe function. */
export function onOutboxChange(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

/** Runs still waiting for this player. */
export const pendingFor = (playerId) => load().filter((e) => e.playerId === playerId).map((e) => e.run.runId);

function enqueue(run, playerId) {
  // A newer report of the same run (Diameter resumed after leaving) replaces the older one.
  store([...load().filter((e) => e.run.runId !== run.runId), { run, playerId, queuedAt: Date.now() }]);
  notify();
}

function remove(runId) {
  store(load().filter((e) => e.run.runId !== runId));
  notify();
}

/** Sends a run now; on failure keeps it for later. Resolves to 'saved' or 'queued'. */
export async function deliver(save, run, playerId) {
  if (!save) return 'saved';
  try {
    await save(run);
    return 'saved';
  } catch (err) {
    console.error('[MuscleGames] saving the run failed; it will be sent again later', err);
    enqueue(run, playerId);
    return 'queued';
  }
}

let flushing = false;

/** Sends every waiting run of this player, oldest first; stops at the first failure (still offline). */
export async function flush(save, playerId) {
  if (!save || flushing) return;
  flushing = true;
  try {
    for (const e of load().filter((x) => x.playerId === playerId)) {
      try {
        await save(e.run);
        remove(e.run.runId);
      } catch {
        break;
      }
    }
  } finally {
    flushing = false;
  }
}
