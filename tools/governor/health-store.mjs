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

import { readFileSync, existsSync, unlinkSync } from 'node:fs';
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
