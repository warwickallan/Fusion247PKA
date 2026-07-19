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
import { randomUUID } from 'node:crypto';

import { SECRET_HOME } from './config.js';

export const DEFAULT_STATE_PATH = path.join(SECRET_HOME, 'tower-baton-state.json');
export const DEFAULT_LOCK_PATH = path.join(SECRET_HOME, 'tower-baton.lock');
// A lock whose HEARTBEAT is older than this is treated as stale (a crashed/hung prior
// watcher) and reclaimed. NOTE: staleness is judged on `heartbeat_at`, NOT `acquired_at`
// — a healthy watcher refreshes heartbeat_at forever, so it keeps ownership indefinitely
// no matter how old its acquired_at gets. That is the fix for the reclaim-of-a-live-lock bug.
export const DEFAULT_LOCK_STALE_MS = 5 * 60 * 1000;

function emptyState() {
  return { version: 1, answered: {}, rounds: {}, notified: {}, in_progress: {}, pending_failures: {} };
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
        data.in_progress = data.in_progress ?? {};
        data.pending_failures = data.pending_failures ?? {};
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

    recordAnswered(checkpointId, { reviewedHead, verdict, promptFingerprint, commentId, now = Date.now(), mergeReady = null } = {}) {
      data.answered[checkpointId] = { reviewed_head: reviewedHead ?? null, verdict: verdict ?? null, prompt_fingerprint: promptFingerprint ?? null, comment_id: commentId ?? null, answered_at: now, merge_ready: mergeReady };
      // A terminal answer clears any two-mode in-progress marker for this checkpoint.
      if (data.in_progress) delete data.in_progress[checkpointId];
      persist();
    },

    // Two-mode in-progress marker (MEDIUM G): once Codex has posted its APPROVE reply and
    // the run is routing to the Fable cold-final, this records that the codex step is DONE
    // so a retry/crash resumes at the FABLE step (never re-runs codex / re-posts the codex
    // reply). Cleared by recordAnswered when the Fable terminal is recorded.
    isInProgress(checkpointId) { return Boolean(data.in_progress?.[checkpointId]); },
    getInProgress(checkpointId) { return data.in_progress?.[checkpointId] ?? null; },
    recordInProgress(checkpointId, { stage, codexVerdict, reviewedHead, promptFingerprint, codexCommentId, chainKey, now = Date.now() } = {}) {
      // Fence-of-record (Fable fence-gap #6): NEVER mark a checkpoint in-progress once it
      // has been terminally answered. A superseded/abandoned run that resolves late must
      // not re-open an awaiting_fable marker on an already-closed checkpoint.
      if (data.answered?.[checkpointId]) return;
      data.in_progress = data.in_progress ?? {};
      data.in_progress[checkpointId] = { stage: stage ?? 'awaiting_fable', codex_verdict: codexVerdict ?? null, reviewed_head: reviewedHead ?? null, prompt_fingerprint: promptFingerprint ?? null, codex_comment_id: codexCommentId ?? null, chain_key: chainKey ?? null, at: now };
      persist();
    },
    clearInProgress(checkpointId) { if (data.in_progress) { delete data.in_progress[checkpointId]; persist(); } },

    // DURABLE PENDING-FAILURE OUTBOX (HIGH-2). A recoverable-failure verdict is written
    // here BEFORE the ClickUp post is attempted and marked delivered ONLY after the post is
    // confirmed. If the process crashes mid-post the pending record survives on disk, so the
    // failure evidence is never lost between the decision to post and the confirmed publish.
    getPendingFailure(checkpointId) { return data.pending_failures?.[checkpointId] ?? null; },
    recordPendingFailure(checkpointId, { stage, kind, reason, elapsedMs, operationId, reviewedHead, now = Date.now() } = {}) {
      data.pending_failures = data.pending_failures ?? {};
      data.pending_failures[checkpointId] = {
        checkpoint_id: checkpointId, stage: stage ?? 'unknown', kind: kind ?? 'run_failed',
        reason: reason ?? null, elapsed_ms: elapsedMs ?? null, operation_id: operationId ?? null,
        reviewed_head: reviewedHead ?? null, delivered: false, at: now,
      };
      persist();
      return data.pending_failures[checkpointId];
    },
    markFailureDelivered(checkpointId, operationId = null, now = Date.now()) {
      const rec = data.pending_failures?.[checkpointId];
      // Only mark delivered when the operation id matches (or none was tracked) so a newer
      // pending record for the same checkpoint is not falsely marked by a stale confirmation.
      if (!rec) return false;
      if (operationId && rec.operation_id && rec.operation_id !== operationId) return false;
      rec.delivered = true; rec.delivered_at = now;
      persist();
      return true;
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
 * Default PID-liveness probe. `process.kill(pid, 0)` sends no signal but performs the
 * permission/existence check: it throws ESRCH when the process is gone (→ dead) and
 * EPERM when it exists but we lack permission to signal it (→ alive). Injectable into
 * acquireLock so tests are deterministic (no reliance on real, live PIDs).
 */
export function defaultIsAlive(pid) {
  const n = Number(pid);
  if (!Number.isFinite(n) || n <= 0) return false;
  try { process.kill(n, 0); return true; }
  catch (e) { return e?.code === 'EPERM'; } // EPERM = alive-but-no-perm; ESRCH = dead
}

/**
 * Acquire the single-watcher lock (atomic O_CREAT|O_EXCL). Lock payload is
 * { pid, nonce, acquired_at, heartbeat_at }; the per-acquisition `nonce` is what proves
 * ownership for heartbeat() and release(). Returns
 * { acquired, release, heartbeat, nonce, reason, reclaimedStale? }.
 *
 * Reclaim policy (judged on the OWNER's liveness + heartbeat freshness, never acquired_at):
 *   - live owner  = isAlive(pid) && (now - heartbeat_at) < staleMs  → REFUSE (no double-watcher)
 *   - dead/hung   = !isAlive(pid) OR heartbeat older than staleMs   → RECLAIM
 *   - malformed   = bounded: reclaim only if the file's mtime is older than staleMs;
 *                   otherwise fail-closed REFUSE (do not steal a fresh-but-corrupt lock).
 */
export function acquireLock({
  lockPath = DEFAULT_LOCK_PATH,
  fs = fsDefault,
  staleMs = DEFAULT_LOCK_STALE_MS,
  now = Date.now(),
  isAlive = defaultIsAlive,
  nonce = randomUUID(),
} = {}) {
  const dir = path.dirname(lockPath);
  try { fs.mkdirSync(dir, { recursive: true }); } catch { /* dir may exist */ }

  const ourNonce = nonce;
  const write = (acquiredAt = now) => {
    const fd = fs.openSync(lockPath, 'wx'); // wx = O_CREAT|O_EXCL|O_WRONLY — fails if present
    try {
      fs.writeSync(fd, JSON.stringify({ pid: process.pid, nonce: ourNonce, acquired_at: acquiredAt, heartbeat_at: now }));
    } finally { fs.closeSync(fd); }
  };
  const ok = (extra) => ({
    acquired: true,
    nonce: ourNonce,
    release: makeRelease(lockPath, fs, ourNonce),
    heartbeat: makeHeartbeat(lockPath, fs, ourNonce),
    ...extra,
  });
  const refuse = (reason) => ({ acquired: false, reason, release() { return false; }, heartbeat() { return false; } });
  const reclaim = (reason) => {
    try { fs.unlinkSync(lockPath); write(); }
    catch (e2) { return refuse(`stale-lock reclaim failed: ${String(e2?.message ?? e2)}`); }
    return ok({ reclaimedStale: true, reason });
  };

  // Fast path — no lock present.
  try {
    write();
    return ok({ reclaimedStale: false, reason: 'acquired' });
  } catch (e) {
    if (e?.code !== 'EEXIST') return refuse(`lock error: ${String(e?.message ?? e)}`);
  }

  // A lock file exists — inspect the recorded owner.
  let held = null;
  try { held = JSON.parse(fs.readFileSync(lockPath, 'utf8')); } catch { held = null; }
  const valid = held && typeof held === 'object' && held.pid != null && Number.isFinite(Number(held.heartbeat_at));

  if (!valid) {
    // Malformed/unparseable — bounded reclaim on mtime only; never steal a fresh corrupt lock.
    let mtimeMs = Infinity;
    try { mtimeMs = fs.statSync(lockPath).mtimeMs; } catch { mtimeMs = Infinity; }
    const mtimeAge = now - Number(mtimeMs);
    if (mtimeAge > staleMs) return reclaim(`reclaimed malformed lock (mtime age ${Math.round(mtimeAge / 1000)}s)`);
    return refuse('lock file is malformed but fresh (mtime within stale window) — failing closed, not stealing');
  }

  const heldAlive = isAlive(held.pid);
  const hbAge = now - Number(held.heartbeat_at);
  const liveOwner = heldAlive && hbAge < staleMs;
  if (liveOwner) {
    return refuse(`another watcher holds the lock (pid ${held.pid}) — not double-processing`);
  }
  // Dead (!isAlive) OR hung (alive but heartbeat older than staleMs) → reclaim.
  return reclaim(
    heldAlive
      ? `reclaimed hung lock (pid ${held.pid} alive but heartbeat age ${Math.round(hbAge / 1000)}s > stale)`
      : `reclaimed dead lock (pid ${held.pid} not alive, heartbeat age ${Math.round(hbAge / 1000)}s)`,
  );
}

/**
 * release(): remove the lock ONLY if we still own it (recorded nonce === our nonce).
 * An older process's shutdown therefore cannot delete a NEWER owner's lock. If the file
 * is already gone we treat that as released. Returns true when we removed our own lock.
 */
function makeRelease(lockPath, fs, ourNonce) {
  return function release() {
    let held = null;
    let existed = true;
    try { held = JSON.parse(fs.readFileSync(lockPath, 'utf8')); }
    catch (e) { held = null; if (e?.code === 'ENOENT') existed = false; }
    // A valid lock owned by someone else → do NOT touch it (ownership rule #4).
    if (held && typeof held === 'object' && held.nonce !== ourNonce) return false;
    if (!existed) return true; // already gone — nothing to release
    try { fs.unlinkSync(lockPath); return true; } catch { return false; }
  };
}

/**
 * heartbeat(): refresh heartbeat_at=now, but ONLY while we still own the lock (recorded
 * nonce === ours). If the nonce no longer matches (someone reclaimed a hung/dead lock),
 * stop refreshing and report loss so the caller can log it. Returns true while owned.
 */
function makeHeartbeat(lockPath, fs, ourNonce) {
  return function heartbeat({ now = Date.now(), log } = {}) {
    let held = null;
    try { held = JSON.parse(fs.readFileSync(lockPath, 'utf8')); } catch { held = null; }
    if (!held || held.nonce !== ourNonce) {
      if (typeof log === 'function') log('[TOWER] lock heartbeat: ownership lost (lock reclaimed or removed) — stopping heartbeat');
      return false;
    }
    held.heartbeat_at = now;
    try {
      const tmp = `${lockPath}.hb-${process.pid}`;
      fs.writeFileSync(tmp, JSON.stringify(held), 'utf8');
      fs.renameSync(tmp, lockPath); // atomic replace — keeps pid/nonce/acquired_at
      return true;
    } catch { return false; }
  };
}
