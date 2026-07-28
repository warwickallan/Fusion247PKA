// =====================================================================
// BUILD-015 AsdAIr Stage 1 - pipeline-runtime/runtime-lock.mjs
//
// THE SINGLE-POLLER LOCK. This file is the whole safety argument.
//
// Telegram getUpdates is a single-consumer, DESTRUCTIVE-ack protocol with no
// lease and no lock of its own: fetching with an offset acks every update below
// it. Two pollers therefore do not "share" the stream - they race it, and the
// loser silently swallows the week's shopping list with no error surfaced
// anywhere. So the runtime is allowed exactly one live instance, and this module
// is what enforces it.
//
// ── WHY A NAIVE PID FILE IS NOT ENOUGH ──────────────────────────────────────
// A pid file plus `process.kill(pid, 0)` has two defects, and both of them are
// the bad kind (they fail OPEN, or they kill the wrong thing):
//
//   1. TOCTOU. "read the lock, see nothing, write the lock" is not atomic. Two
//      launchers racing (logon task + a human double-click) can both read an
//      empty lock and both spawn. Here the lock file is created with O_EXCL
//      ('wx'), so exactly one racer can win, and a stale lock is reclaimed by an
//      atomic rename that likewise only one racer can win.
//
//   2. PID REUSE. Windows recycles process ids briskly. A stale pid that has
//      been reused by some unrelated process reads as "alive", which either
//      wedges the runtime out of ever starting again, or - far worse - makes
//      `--stop` kill an innocent process. So the lock binds the holder to its
//      full identity: pid + the OS-reported process CREATION TIME + a command
//      line fingerprint. All three must match or the holder is not ours.
//
// A lock whose process is genuinely gone is STALE, not live, and is reclaimed.
// A lock we cannot positively verify is treated as HELD (fail closed): refusing
// to start costs one poll interval, starting a second poller costs the list.
//
// No credential is read, written or logged by this module. It knows pids.
// =====================================================================

import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { spawnSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';

/** A 'starting' claim older than this, whose launcher is gone, is abandoned. */
export const STARTING_CLAIM_TIMEOUT_MS = 120_000;

export function lockPath(stateDir) { return path.join(stateDir, 'runtime.pid'); }

// ---------------------------------------------------------------------
// Process identity
// ---------------------------------------------------------------------

/**
 * The OS's view of one process, or null when there is no such process.
 *
 * Returns `{ pid, createdAt, commandLine, verifiable }`. `verifiable` says
 * whether the platform gave us a creation time we can bind to - it is the
 * difference between "this is provably the process we started" and "something
 * with that number exists".
 */
export function inspectPid(pid, { platform = process.platform, runner = defaultRunner } = {}) {
  const n = Number(pid);
  if (!Number.isInteger(n) || n <= 0) return null;

  if (platform === 'win32') {
    const script =
      `$ErrorActionPreference='Stop';` +
      `$p = Get-CimInstance Win32_Process -Filter "ProcessId=${n}" -ErrorAction SilentlyContinue;` +
      `if ($null -eq $p) { '' } else {` +
      `  [pscustomobject]@{ pid=[int]$p.ProcessId;` +
      `    createdAt=$(if ($p.CreationDate) { $p.CreationDate.ToUniversalTime().ToString('o') } else { $null });` +
      `    commandLine=$p.CommandLine } | ConvertTo-Json -Compress }`;
    const out = runner(script);
    if (!out) return null;
    try {
      const parsed = JSON.parse(out);
      if (!parsed || !parsed.pid) return null;
      return {
        pid: Number(parsed.pid),
        createdAt: parsed.createdAt || null,
        commandLine: parsed.commandLine || null,
        verifiable: Boolean(parsed.createdAt),
      };
    } catch { return null; }
  }

  // POSIX best effort: existence via signal 0, start time from /proc when there
  // is one. Honest about what it could not establish rather than pretending.
  try { process.kill(n, 0); } catch { return null; }
  let createdAt = null;
  try {
    const stat = fs.statSync(`/proc/${n}`);
    createdAt = new Date(stat.birthtimeMs || stat.ctimeMs).toISOString();
  } catch { /* not Linux, or no procfs */ }
  let commandLine = null;
  try { commandLine = fs.readFileSync(`/proc/${n}/cmdline`, 'utf8').split('\0').join(' ').trim() || null; } catch { /* no-op */ }
  return { pid: n, createdAt, commandLine, verifiable: Boolean(createdAt) };
}

function defaultRunner(script) {
  const r = spawnSync('powershell', ['-NoProfile', '-NonInteractive', '-Command', script], {
    windowsHide: true, encoding: 'utf8', timeout: 20_000,
  });
  if (r.error || r.status !== 0) return '';
  return String(r.stdout || '').trim();
}

// ---------------------------------------------------------------------
// The lock record
// ---------------------------------------------------------------------

function readRaw(stateDir) {
  try { return fs.readFileSync(lockPath(stateDir), 'utf8'); } catch { return null; }
}

/**
 * Parse the lock file.
 *
 * A legacy lock file containing a bare pid (the shape the first cut of the
 * launcher wrote) is understood, and reported as `legacy: true` - upgrading the
 * launcher must not strand a poller that is genuinely running.
 */
export function readLockRecord(stateDir) {
  const raw = readRaw(stateDir);
  if (raw === null) return null;
  const text = raw.trim();
  if (text === '') return { malformed: true, raw };
  try {
    const parsed = JSON.parse(text);
    if (parsed && typeof parsed === 'object') return parsed;
  } catch { /* fall through to the legacy shape */ }
  const pid = Number(text);
  if (Number.isInteger(pid) && pid > 0) return { pid, legacy: true, state: 'running' };
  return { malformed: true, raw: text };
}

/**
 * Who, if anyone, holds the runtime lock right now.
 *
 * @returns {{state:'free'|'held'|'starting'|'stale'|'unverifiable', record:object|null,
 *            process:object|null, reason:string}}
 *   free          nothing holds it; a start may proceed
 *   held          a verified live runtime holds it; a start must REFUSE
 *   starting      another launcher is mid-spawn; a start must REFUSE
 *   stale         the recorded process is gone (or was replaced); reclaimable
 *   unverifiable  something exists but identity could not be confirmed - treated
 *                 as HELD by every caller (fail closed)
 */
export function holderStatus(stateDir, opts = {}) {
  const now = opts.now || Date.now;
  const record = readLockRecord(stateDir);
  if (record === null) return { state: 'free', record: null, process: null, reason: 'no lock file' };
  if (record.malformed) {
    return { state: 'stale', record, process: null, reason: 'lock file is not readable as a lock record' };
  }

  if (record.state === 'starting') {
    const launcher = inspectPid(record.launcher_pid, opts);
    const age = now() - Date.parse(record.claimed_at || 0);
    if (launcher && !(Number.isFinite(age) && age > STARTING_CLAIM_TIMEOUT_MS)) {
      return { state: 'starting', record, process: launcher, reason: `launcher pid ${record.launcher_pid} is mid-spawn` };
    }
    return {
      state: 'stale', record, process: null,
      reason: launcher ? 'a starting claim exceeded its timeout' : `the claiming launcher (pid ${record.launcher_pid}) is gone`,
    };
  }

  const proc = inspectPid(record.pid, opts);
  if (!proc) {
    return { state: 'stale', record, process: null, reason: `no process with pid ${record.pid} - a stale lock from a killed process is NOT a live poller` };
  }

  // The identity binding. A recycled pid must not read as our runtime.
  if (record.process_created_at && proc.createdAt && record.process_created_at !== proc.createdAt) {
    return {
      state: 'stale', record, process: proc,
      reason: `pid ${record.pid} exists but was created at ${proc.createdAt}, not ${record.process_created_at} - the pid has been REUSED by another process`,
    };
  }
  if (record.fingerprint && proc.commandLine && !proc.commandLine.includes(record.fingerprint)) {
    return {
      state: 'stale', record, process: proc,
      reason: `pid ${record.pid} exists but is not the AsdAIr runtime (command line does not carry "${record.fingerprint}")`,
    };
  }
  if (!record.process_created_at || !proc.createdAt) {
    // Something is there and we could not prove it is not ours. Fail closed.
    return { state: 'unverifiable', record, process: proc, reason: `pid ${record.pid} exists but its identity could not be verified - refusing to assume it is safe to start a second poller` };
  }
  return { state: 'held', record, process: proc, reason: `pid ${record.pid} is the live AsdAIr runtime` };
}

/** True when a start must be refused. Fail closed on anything unproven. */
export function isBlocking(state) {
  return state === 'held' || state === 'starting' || state === 'unverifiable';
}

// ---------------------------------------------------------------------
// Acquire / commit / release
// ---------------------------------------------------------------------

/**
 * Atomically claim the right to start the runtime.
 *
 * Two phases, because the pid we must record does not exist until after the
 * spawn: the claim is written first (so no second launcher can slip in during
 * the spawn), then `commit()` upgrades it to the real holder record.
 *
 * @returns {{ok:true, token:string, commit:Function, abandon:Function}
 *          |{ok:false, status:object}}
 */
export function acquire(stateDir, { mode = 'live', entry = null, now = Date.now, ...opts } = {}) {
  fs.mkdirSync(stateDir, { recursive: true });
  const file = lockPath(stateDir);
  const token = randomUUID();

  for (let attempt = 0; attempt < 3; attempt += 1) {
    const claim = {
      state: 'starting',
      token,
      launcher_pid: process.pid,
      claimed_at: new Date(now()).toISOString(),
      mode,
      entry,
      host: os.hostname(),
    };
    try {
      // O_EXCL. This, not the read above it, is what makes the lock a lock.
      const fd = fs.openSync(file, 'wx');
      try { fs.writeFileSync(fd, `${JSON.stringify(claim, null, 1)}\n`); } finally { fs.closeSync(fd); }
      return {
        ok: true,
        token,
        commit(holder) {
          const record = {
            state: 'running', token, ...holder,
            mode, entry, host: os.hostname(),
            launcher_pid: process.pid,
            started_at: new Date(now()).toISOString(),
          };
          writeAtomic(file, `${JSON.stringify(record, null, 1)}\n`);
          return record;
        },
        abandon() { removeIfToken(stateDir, token); },
      };
    } catch (err) {
      if (err.code !== 'EEXIST') throw err;
    }

    const status = holderStatus(stateDir, { now, ...opts });
    if (isBlocking(status.state)) return { ok: false, status };

    // Stale. Reclaim by an atomic rename - only one racer can win a rename, so
    // two launchers cannot both conclude "it was stale, it is mine now".
    const parked = `${file}.stale-${process.pid}-${Date.now()}`;
    try { fs.renameSync(file, parked); } catch { /* another racer got there first */ }
    try { fs.rmSync(parked, { force: true }); } catch { /* best effort */ }
  }
  return { ok: false, status: holderStatus(stateDir, { now, ...opts }) };
}

function writeAtomic(file, body) {
  const tmp = `${file}.tmp-${process.pid}`;
  fs.writeFileSync(tmp, body);
  fs.renameSync(tmp, file);
}

/** Remove the lock only if it is still the one this token wrote. */
export function removeIfToken(stateDir, token) {
  const record = readLockRecord(stateDir);
  if (record && !record.malformed && token && record.token !== token) return false;
  try { fs.rmSync(lockPath(stateDir), { force: true }); return true; } catch { return false; }
}

/** Unconditionally clear the lock. Used by `--stop` AFTER the holder is dead. */
export function clearLock(stateDir) {
  try { fs.rmSync(lockPath(stateDir), { force: true }); return true; } catch { return false; }
}

/**
 * Terminate the lock holder - and ONLY the lock holder.
 *
 * The identity check is not decoration: without it a stale lock whose pid has
 * been recycled turns `--stop` into "kill a random process". If the holder is
 * not verified ours, nothing is killed and the caller is told why.
 */
export function stopHolder(stateDir, { platform = process.platform, kill = defaultKill, ...opts } = {}) {
  const status = holderStatus(stateDir, opts);
  if (status.state === 'free') return { stopped: false, reason: 'not running', status };
  if (status.state === 'stale') {
    clearLock(stateDir);
    return { stopped: false, cleared: true, reason: `cleared a stale lock: ${status.reason}`, status };
  }
  if (status.state === 'starting') {
    return { stopped: false, reason: 'another launcher is mid-spawn - try again in a moment', status };
  }
  if (status.state === 'unverifiable') {
    return { stopped: false, reason: `refusing to kill pid ${status.record.pid}: ${status.reason}`, status };
  }
  const pid = status.record.pid;
  kill(pid, platform);
  // Confirm rather than assume. The lock is cleared only once the process is
  // provably gone, so a failed kill cannot leave the lock free while the poller
  // is still consuming updates.
  const deadline = Date.now() + 10_000;
  while (Date.now() < deadline) {
    if (!inspectPid(pid, { platform, ...opts })) {
      clearLock(stateDir);
      return { stopped: true, pid, reason: `stopped pid ${pid}`, status };
    }
    sleepSync(250);
  }
  return { stopped: false, pid, reason: `pid ${pid} did not exit - lock deliberately NOT cleared`, status };
}

/** A synchronous pause. Used only while confirming a kill actually landed. */
export function sleepSync(ms) {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
}

function defaultKill(pid, platform) {
  if (platform === 'win32') spawnSync('taskkill', ['/PID', String(pid), '/T', '/F'], { windowsHide: true });
  else { try { process.kill(pid, 'SIGTERM'); } catch { /* already gone */ } }
}
