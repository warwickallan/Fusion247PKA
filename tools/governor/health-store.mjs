// Session Health Store (BUILD-018 T-02)
//
// Ephemeral, machine-local, keyed by session_id (AD-2). Deliberately NOT under
// C:\.fusion247\** because GL-012 governs the SECRETS STORE and private-application
// session logs (see GL-012 §6a) — this data is neither: it is non-secret operational
// telemetry (context %, compaction count, timestamps) for a build whose
// `private_surface` is `none`. GL-012's deny-by-default boundary and declared-surface
// requirement do not apply to this store.
//
// Deliberately NOT inside any git working tree, and not fixed to one checkout's path:
// a governor session may run from the primary checkout or from any worktree of this
// same repo, and health state must resolve to one canonical location regardless of
// which checkout is currently active — a repo-relative path would silently fork state
// per checkout.
//
// Default root: ~/.mypka/governor/health/<projectKey>/<sessionId>.json
// Override via MYPKA_GOVERNOR_HEALTH_DIR (portability seam for Q-3 / T-12 — a second
// estate adapter can point this at its own root without touching the store logic).
//
// Every write goes through the SHARED primitive in atomic-write.mjs (T-18) —
// temp-file + atomic rename, per-writer-unique temp name, bounded retry on a
// transient Windows sharing failure, and temp cleanup on every path. What that
// buys, stated at exactly the strength it has been proven to:
//  - a write killed mid-flight leaves the previous good file untouched (never a
//    partial parse on read);
//  - the file on disk is always ONE writer's complete output, never a mix of two —
//    rename is all-or-nothing, and last rename wins.
//
// CORRECTED 2026-08-01 (D-5 / T-18). This header previously claimed concurrent
// writers "never interleave" and let that stand as proof of concurrent-write
// safety. Never interleaving is true and remains true — but it was never the same
// claim as concurrent writers SUCCEEDING, and they frequently did not: under 16
// concurrent writers with 16 concurrent readers, 7 of 16 writes (43.8%) failed
// outright with EPERM and each orphaned its temp file permanently. The retry in
// atomic-write.mjs is what closes that gap. State what was proven, not what it
// implies.
//
// Residual, stated honestly: this target is last-write-wins by design, so a
// sample can still be superseded by a later writer. That is intended. What is no
// longer true is that a sample is silently LOST because its rename lost a race.

import { readFileSync, existsSync, unlinkSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import os from 'node:os';
import { atomicWriteFileSync } from './atomic-write.mjs';

export function projectKeyFor(cwd) {
  if (!cwd || typeof cwd !== 'string') {
    throw new TypeError('cwd must be a non-empty string');
  }
  return cwd.replace(/[:\\/]/g, '-');
}

export function healthStoreDir({ cwd = process.cwd(), homeDir = os.homedir(), envOverride = process.env.MYPKA_GOVERNOR_HEALTH_DIR } = {}) {
  if (envOverride) return envOverride;
  return join(homeDir, '.mypka', 'governor', 'health', projectKeyFor(cwd));
}

// ---------------------------------------------------------------------------
// WO-OR-18 — closing the SPLIT-STORE hazard without flattening the store
// ---------------------------------------------------------------------------
// THE HAZARD (Codex TQA-002). The directory above is keyed by `cwd`, so one session's
// statusLine and its own Stop hook can resolve DIFFERENT directories when they run from
// different checkouts of this same repository. The reader then finds nothing and the
// footer goes BLIND while a perfectly valid observation for that exact session sits one
// directory away. It fails SAFE — a true token count with no grade, never a false
// percentage — which is why it was parked rather than blocking, not why it was fine. The
// module header above has always said health state "must resolve to one canonical
// location regardless of which checkout is currently active"; the cwd key contradicted
// that stated intent.
//
// THE OBVIOUS FIX IS WRONG, AND THIS IS THE PART WORTH READING. Deleting the projectKey
// level looks like the clean answer and would re-open a defect that was closed by
// deletion three Work Orders ago. That level is NOT dead: `footer.resolveHealthSample`
// rule 2 enumerates it to find the NEWEST sample when the session id is unknown, and
// returns `approximate: true` — the `~` in `ctx ~NN%`. Flatten the store and that
// enumeration reaches across every checkout AND across unrelated projects; this machine's
// store holds a `C--ClaudeJobs` key, a different repository entirely. The footer would
// then render an approximate percentage borrowed from another project's session, which is
// precisely the cross-session inference WO-OR-09 removed from `resolveWindowTokens`.
//
// SO THE TWO LOOKUPS ARE SEPARATED, because they rest on different things:
//   * session id UNKNOWN -> stays scoped to one project key. It has only SIMILARITY
//     (same project, recent) to go on, so its blast radius must stay small.
//   * session id KNOWN   -> may resolve across project keys, because a session id is
//     IDENTITY. That is the same principle WO-OR-09 settled: identity may cross a
//     boundary that similarity may not.
//
// The sweep is deliberately narrow: direct path first, siblings only on a MISS, and a
// candidate is accepted only when the record's own `session_id` equals the one asked for.
// `MYPKA_GOVERNOR_HEALTH_DIR` pins an exact directory and therefore has no siblings by
// construction — the sweep is skipped entirely when it is set, so the portability seam
// (and every test that uses it) behaves exactly as before.

function healthRootDir({ homeDir = os.homedir(), envOverride = process.env.MYPKA_GOVERNOR_HEALTH_DIR } = {}) {
  // An explicitly pinned root is the whole store, not one project key within it.
  if (envOverride) return null;
  return join(homeDir, '.mypka', 'governor', 'health');
}

// Find `<sessionId>.json` under any project key other than the one already tried.
// Returns the newest matching record, or null. Never throws: an unreadable store must
// degrade to "no sample", never to an exception on a telemetry path.
function findAcrossProjectKeys(sessionId, opts, alreadyTried) {
  const root = healthRootDir(opts);
  if (!root) return null;
  let best = null;
  try {
    for (const entry of readdirSync(root, { withFileTypes: true })) {
      if (!entry.isDirectory()) continue;
      const candidate = join(root, entry.name, `${sessionId}.json`);
      if (candidate === alreadyTried) continue;
      try {
        if (!existsSync(candidate)) continue;
        const data = JSON.parse(readFileSync(candidate, 'utf8'));
        // IDENTITY, asserted rather than assumed. The file is keyed by session id so this
        // is normally tautological — and it is the single invariant this whole sweep
        // rests on, which is exactly why it is checked instead of trusted.
        if (!data || data.session_id !== sessionId) continue;
        const mtime = statSync(candidate).mtimeMs;
        if (!best || mtime > best.mtime) best = { data, path: candidate, mtime };
      } catch { /* one bad record must not blind the sweep */ }
    }
  } catch { return null; }
  return best;
}

export function healthFilePath(sessionId, opts = {}) {
  if (!sessionId || typeof sessionId !== 'string') {
    throw new TypeError('sessionId must be a non-empty string');
  }
  return join(healthStoreDir(opts), `${sessionId}.json`);
}

export function writeHealthSample(sessionId, sample, opts = {}) {
  const filePath = healthFilePath(sessionId, opts);
  // A CONSTANT payload, not a producer: this target is last-write-wins and the
  // sample owes nothing to the file's prior contents, so replaying the identical
  // bytes on a retry is exactly right here. (`delegation-gate.mjs` passes a
  // producer for the opposite reason — see atomic-write.mjs's M1 note.)
  return atomicWriteFileSync(filePath, JSON.stringify(sample));
}

export function readHealthSample(sessionId, opts = {}) {
  const filePath = healthFilePath(sessionId, opts);
  if (!existsSync(filePath)) {
    // WO-OR-18: not in THIS checkout's project key. The session id is unique, so a record
    // under another key is the same session's record — see the note above healthRootDir.
    const found = findAcrossProjectKeys(sessionId, opts, filePath);
    if (found) {
      return { ok: true, data: found.data, path: found.path, resolvedAcrossProjectKey: true };
    }
    return { ok: false, reason: 'missing', path: filePath };
  }
  try {
    const raw = readFileSync(filePath, 'utf8');
    return { ok: true, data: JSON.parse(raw), path: filePath };
  } catch (err) {
    return { ok: false, reason: 'unreadable', error: err.message, path: filePath };
  }
}

export function deleteHealthSample(sessionId, opts = {}) {
  const filePath = healthFilePath(sessionId, opts);
  if (existsSync(filePath)) unlinkSync(filePath);
}
