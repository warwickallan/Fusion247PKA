// Tower baton — durable LOCAL state + single-watcher lockfile (NO Supabase, NO ftw).
//
// State home is OUTSIDE the repo: C:\.fusion247\tower-baton-state.json (a cache),
// with the lock at C:\.fusion247\tower-baton.lock. Dedup + recovery live here.
//
// Fable's nits, addressed here + in watcher.js:
//   #2 (thread is source of truth, file is cache) — on cold start the watcher
//      rebuilds `answered` by scanning the ClickUp thread; this file only caches it.
//   #3 (one-watcher lockfile) — acquireLock uses an atomic O_CREAT|O_EXCL create;
//      a second watcher fails to acquire and exits (no double-processing).
//   #4 (round counter PER checkpoint-chain) — rounds[chainKey] bounds correction
//      rounds; max 3 → escalate.
//
// State shape (v1):
//   { version, answered: { <checkpoint_id>: {reviewed_head, verdict,
//     prompt_fingerprint, comment_id, answered_at} }, rounds: { <chainKey>: n },
//     notified: { <dedup_key>: ts } }

import fsDefault from 'node:fs';
import path from 'node:path';

import { SECRET_HOME } from './config.js';

export const DEFAULT_STATE_PATH = path.join(SECRET_HOME, 'tower-baton-state.json');
export const DEFAULT_LOCK_PATH = path.join(SECRET_HOME, 'tower-baton.lock');
// A held lock older than this is treated as stale (a crashed prior watcher) and reclaimed.
export const DEFAULT_LOCK_STALE_MS = 5 * 60 * 1000;

function emptyState() {
  return { version: 1, answered: {}, rounds: {}, notified: {} };
}

/**
 * Open the durable state store. `existedAtOpen` reports whether a state file was
 * already present (the watcher uses it to choose the "online" vs "recovered" message).
 */
export function openState({ statePath = DEFAULT_STATE_PATH, fs = fsDefault } = {}) {
  let data = emptyState();
  let existedAtOpen = false;
  try {
    if (fs.existsSync(statePath)) {
      existedAtOpen = true;
      const parsed = JSON.parse(fs.readFileSync(statePath, 'utf8'));
      if (parsed && typeof parsed === 'object') {
        data = { ...emptyState(), ...parsed };
        data.answered = data.answered ?? {};
        data.rounds = data.rounds ?? {};
        data.notified = data.notified ?? {};
      }
    }
  } catch {
    // A corrupt cache is not fatal — the thread is the source of truth; start empty.
    data = emptyState();
  }

  function persist() {
    const dir = path.dirname(statePath);
    try { fs.mkdirSync(dir, { recursive: true }); } catch { /* dir may exist */ }
    const tmp = `${statePath}.tmp-${process.pid}`;
    fs.writeFileSync(tmp, JSON.stringify(data, null, 2), 'utf8');
    fs.renameSync(tmp, statePath); // atomic replace
  }

  return {
    statePath,
    existedAtOpen,
    raw() { return data; },

    isAnswered(checkpointId) { return Boolean(data.answered[checkpointId]); },
    getAnswered(checkpointId) { return data.answered[checkpointId] ?? null; },

    recordAnswered(checkpointId, { reviewedHead, verdict, promptFingerprint, commentId, now = Date.now() } = {}) {
      data.answered[checkpointId] = { reviewed_head: reviewedHead ?? null, verdict: verdict ?? null, prompt_fingerprint: promptFingerprint ?? null, comment_id: commentId ?? null, answered_at: now };
      persist();
    },

    /** Merge a set of already-answered checkpoint_ids discovered on the thread (cold-start rebuild). */
    mergeAnsweredIds(ids) {
      for (const id of ids ?? []) {
        if (!data.answered[id]) data.answered[id] = { reviewed_head: null, verdict: null, prompt_fingerprint: null, comment_id: null, answered_at: null, source: 'thread-rebuild' };
      }
      persist();
    },

    roundCount(chainKey) { return data.rounds[chainKey] ?? 0; },
    incrementRound(chainKey) { data.rounds[chainKey] = (data.rounds[chainKey] ?? 0) + 1; persist(); return data.rounds[chainKey]; },

    isNotified(dedupKey) { return Boolean(data.notified[dedupKey]); },
    recordNotified(dedupKey, now = Date.now()) { data.notified[dedupKey] = now; persist(); },

    persist,
  };
}

/**
 * Acquire the single-watcher lock (atomic O_CREAT|O_EXCL). Returns
 * { acquired, release, reason }. A stale lock (older than staleMs) is reclaimed.
 */
export function acquireLock({ lockPath = DEFAULT_LOCK_PATH, fs = fsDefault, staleMs = DEFAULT_LOCK_STALE_MS, now = Date.now() } = {}) {
  const dir = path.dirname(lockPath);
  try { fs.mkdirSync(dir, { recursive: true }); } catch { /* dir may exist */ }

  const write = () => {
    const fd = fs.openSync(lockPath, 'wx'); // wx = O_CREAT|O_EXCL|O_WRONLY — fails if present
    try { fs.writeSync(fd, JSON.stringify({ pid: process.pid, acquired_at: now })); } finally { fs.closeSync(fd); }
  };

  try {
    write();
  } catch (e) {
    if (e?.code !== 'EEXIST') return { acquired: false, reason: `lock error: ${String(e?.message ?? e)}`, release() {} };
    // Present — is it stale?
    let held = null;
    try { held = JSON.parse(fs.readFileSync(lockPath, 'utf8')); } catch { held = null; }
    const age = held?.acquired_at ? now - Number(held.acquired_at) : Infinity;
    if (age > staleMs) {
      try { fs.unlinkSync(lockPath); write(); }
      catch (e2) { return { acquired: false, reason: `stale-lock reclaim failed: ${String(e2?.message ?? e2)}`, release() {} }; }
      return { acquired: true, reclaimedStale: true, reason: `reclaimed stale lock (age ${Math.round(age / 1000)}s)`, release: makeRelease(lockPath, fs) };
    }
    return { acquired: false, reason: `another watcher holds the lock (pid ${held?.pid ?? '?'}) — not double-processing`, release() {} };
  }
  return { acquired: true, reclaimedStale: false, reason: 'acquired', release: makeRelease(lockPath, fs) };
}

function makeRelease(lockPath, fs) {
  return function release() { try { fs.unlinkSync(lockPath); } catch { /* already gone */ } };
}
