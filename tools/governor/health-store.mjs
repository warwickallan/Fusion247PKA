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
// Every write is temp-file + atomic rename, with a per-writer-unique temp name, so:
//  - a write killed mid-flight leaves the previous good file untouched (never a
//    partial parse on read);
//  - concurrent writers never interleave into the same file (each writes its own full
//    temp file, then rename swaps it in atomically — last rename wins, but the file on
//    disk is always one writer's complete output, never a mix of two).

import { writeFileSync, renameSync, mkdirSync, readFileSync, existsSync, unlinkSync } from 'node:fs';
import { dirname, join } from 'node:path';
import os from 'node:os';
import crypto from 'node:crypto';

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
  mkdirSync(dirname(filePath), { recursive: true });
  const tmpPath = `${filePath}.tmp-${process.pid}-${crypto.randomBytes(4).toString('hex')}`;
  const payload = JSON.stringify(sample);
  writeFileSync(tmpPath, payload);
  renameSync(tmpPath, filePath);
  return filePath;
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
