// =====================================================================
// BUILD-015 AsdAIr Stage 1 - runtime-lock.test.mjs
//
// The lock's decision logic, tested against an INJECTED process table rather
// than the real one - so every case that matters can actually be produced,
// including the two that are nearly impossible to stage on a live machine: a
// recycled pid, and a platform that will not tell us a creation time.
//
// The end-to-end behaviour (real processes, real kills, real races) is proved
// separately by proof/run-proofs.mjs. This file is about the reasoning.
//
// Offline. No credentials, no network, no database, no scheduled task.
// =====================================================================

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import {
  acquire, holderStatus, isBlocking, readLockRecord, lockPath, clearLock, stopHolder,
  STARTING_CLAIM_TIMEOUT_MS,
} from './runtime-lock.mjs';

/** A stand-in process table. `runner` is what inspectPid shells out to. */
function fakeRunner(processes) {
  return (script) => {
    const m = /ProcessId=(\d+)/.exec(script);
    const pid = m ? Number(m[1]) : null;
    const p = processes.get(pid);
    if (!p) return '';
    return JSON.stringify({ pid, createdAt: p.createdAt, commandLine: p.commandLine });
  };
}

function scratch(name) {
  const dir = path.join(os.tmpdir(), `asdair-lock-test-${name}-${process.pid}-${Math.random().toString(36).slice(2)}`);
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

const opts = (processes) => ({ platform: 'win32', runner: fakeRunner(processes) });

test('an empty state directory is FREE', () => {
  const dir = scratch('free');
  const s = holderStatus(dir, opts(new Map()));
  assert.equal(s.state, 'free');
  assert.equal(isBlocking(s.state), false);
});

test('a committed lock whose process matches on pid, creation time and command line is HELD', () => {
  const dir = scratch('held');
  const procs = new Map([[4242, { createdAt: '2026-07-28T10:00:00.0000000Z', commandLine: 'node runtime.js --watch' }]]);
  const claim = acquire(dir, { mode: 'live', entry: 'runtime.js', ...opts(procs) });
  assert.equal(claim.ok, true);
  claim.commit({ pid: 4242, process_created_at: '2026-07-28T10:00:00.0000000Z', fingerprint: 'runtime.js' });

  const s = holderStatus(dir, opts(procs));
  assert.equal(s.state, 'held');
  assert.equal(isBlocking(s.state), true);
});

test('a SECOND acquire while the lock is held is refused - this is the single-poller rule', () => {
  const dir = scratch('second');
  const procs = new Map([[4242, { createdAt: '2026-07-28T10:00:00.0000000Z', commandLine: 'node runtime.js --watch' }]]);
  const first = acquire(dir, { mode: 'live', entry: 'runtime.js', ...opts(procs) });
  first.commit({ pid: 4242, process_created_at: '2026-07-28T10:00:00.0000000Z', fingerprint: 'runtime.js' });

  const second = acquire(dir, { mode: 'live', entry: 'runtime.js', ...opts(procs) });
  assert.equal(second.ok, false);
  assert.equal(second.status.state, 'held');
});

test('a lock left by a KILLED process is stale, not live, and is reclaimable', () => {
  const dir = scratch('stale');
  const procs = new Map([[4242, { createdAt: '2026-07-28T10:00:00.0000000Z', commandLine: 'node runtime.js --watch' }]]);
  const first = acquire(dir, { mode: 'live', entry: 'runtime.js', ...opts(procs) });
  first.commit({ pid: 4242, process_created_at: '2026-07-28T10:00:00.0000000Z', fingerprint: 'runtime.js' });

  procs.delete(4242); // the process is killed behind the launcher's back
  const s = holderStatus(dir, opts(procs));
  assert.equal(s.state, 'stale');
  assert.match(s.reason, /stale lock from a killed process is NOT a live poller/);

  const again = acquire(dir, { mode: 'live', entry: 'runtime.js', ...opts(procs) });
  assert.equal(again.ok, true, 'a stale lock must not wedge the runtime out of ever starting again');
});

test('a RECYCLED pid is not mistaken for the runtime', () => {
  const dir = scratch('reuse');
  const procs = new Map([[4242, { createdAt: '2026-07-28T10:00:00.0000000Z', commandLine: 'node runtime.js --watch' }]]);
  const claim = acquire(dir, { mode: 'live', entry: 'runtime.js', ...opts(procs) });
  claim.commit({ pid: 4242, process_created_at: '2026-07-28T10:00:00.0000000Z', fingerprint: 'runtime.js' });

  // Same number, different process entirely.
  procs.set(4242, { createdAt: '2026-07-28T18:30:00.0000000Z', commandLine: 'C:\\Windows\\explorer.exe' });
  const s = holderStatus(dir, opts(procs));
  assert.equal(s.state, 'stale');
  assert.match(s.reason, /REUSED/);
});

test('--stop refuses to kill a process it cannot prove is the runtime', () => {
  const dir = scratch('stop-innocent');
  const procs = new Map([[4242, { createdAt: '2026-07-28T10:00:00.0000000Z', commandLine: 'node runtime.js --watch' }]]);
  const claim = acquire(dir, { mode: 'live', entry: 'runtime.js', ...opts(procs) });
  claim.commit({ pid: 4242, process_created_at: '2026-07-28T10:00:00.0000000Z', fingerprint: 'runtime.js' });
  procs.set(4242, { createdAt: '2026-07-28T18:30:00.0000000Z', commandLine: 'C:\\Windows\\explorer.exe' });

  let killed = null;
  const r = stopHolder(dir, { platform: 'win32', runner: fakeRunner(procs), kill: (pid) => { killed = pid; } });
  assert.equal(killed, null, 'a recycled pid must never be killed');
  assert.equal(r.stopped, false);
  assert.equal(r.cleared, true);
});

test('a command line that is not the runtime is not the runtime, even at the right pid', () => {
  const dir = scratch('fingerprint');
  const procs = new Map([[7, { createdAt: '2026-07-28T10:00:00.0000000Z', commandLine: 'node runtime.js --watch' }]]);
  const claim = acquire(dir, { mode: 'live', entry: 'runtime.js', ...opts(procs) });
  claim.commit({ pid: 7, process_created_at: '2026-07-28T10:00:00.0000000Z', fingerprint: 'runtime.js' });
  procs.set(7, { createdAt: '2026-07-28T10:00:00.0000000Z', commandLine: 'node something-else.js' });
  assert.equal(holderStatus(dir, opts(procs)).state, 'stale');
});

test('an unverifiable holder FAILS CLOSED - it blocks a start rather than allowing a second poller', () => {
  const dir = scratch('unverifiable');
  const procs = new Map([[9, { createdAt: null, commandLine: null }]]);
  fs.writeFileSync(lockPath(dir), JSON.stringify({ state: 'running', pid: 9 }));
  const s = holderStatus(dir, opts(procs));
  assert.equal(s.state, 'unverifiable');
  assert.equal(isBlocking(s.state), true, 'refusing to start costs one interval; a second poller costs the list');
});

test('a launcher that is mid-spawn blocks a racing launcher', () => {
  const dir = scratch('starting');
  const procs = new Map([[process.pid, { createdAt: '2026-07-28T10:00:00.0000000Z', commandLine: 'node ensure-asdair-runtime.mjs' }]]);
  const first = acquire(dir, { mode: 'live', entry: 'runtime.js', ...opts(procs) });
  assert.equal(first.ok, true);
  assert.equal(readLockRecord(dir).state, 'starting');

  const s = holderStatus(dir, opts(procs));
  assert.equal(s.state, 'starting');
  assert.equal(isBlocking(s.state), true);
});

test('a starting claim whose launcher has vanished is stale, so a crashed launcher cannot wedge the runtime', () => {
  const dir = scratch('starting-dead');
  const procs = new Map([[process.pid, { createdAt: '2026-07-28T10:00:00.0000000Z', commandLine: 'node ensure-asdair-runtime.mjs' }]]);
  acquire(dir, { mode: 'live', entry: 'runtime.js', ...opts(procs) });
  procs.delete(process.pid);
  assert.equal(holderStatus(dir, opts(procs)).state, 'stale');
});

test('a starting claim that has hung past its timeout is stale even if the launcher is still there', () => {
  const dir = scratch('starting-hung');
  const procs = new Map([[process.pid, { createdAt: '2026-07-28T10:00:00.0000000Z', commandLine: 'node ensure-asdair-runtime.mjs' }]]);
  acquire(dir, { mode: 'live', entry: 'runtime.js', ...opts(procs) });
  const later = () => Date.now() + STARTING_CLAIM_TIMEOUT_MS + 1000;
  assert.equal(holderStatus(dir, { now: later, ...opts(procs) }).state, 'stale');
});

test('a torn or garbage lock file is stale, never believed and never fatal', () => {
  const dir = scratch('torn');
  fs.writeFileSync(lockPath(dir), '{"pid": 12');
  const s = holderStatus(dir, opts(new Map()));
  assert.equal(s.state, 'stale');
  assert.equal(readLockRecord(dir).malformed, true);
});

test('a legacy bare-pid lock is understood, so upgrading the launcher cannot strand a live poller', () => {
  const dir = scratch('legacy');
  const procs = new Map([[555, { createdAt: '2026-07-28T10:00:00.0000000Z', commandLine: 'node runtime.js --watch' }]]);
  fs.writeFileSync(lockPath(dir), '555\n');
  const rec = readLockRecord(dir);
  assert.equal(rec.pid, 555);
  assert.equal(rec.legacy, true);
  // No creation time was recorded by the old format, so it cannot be verified -
  // and therefore blocks, which is the safe direction.
  assert.equal(isBlocking(holderStatus(dir, opts(procs)).state), true);
});

test('clearLock is idempotent', () => {
  const dir = scratch('clear');
  assert.equal(clearLock(dir), true);
  assert.equal(clearLock(dir), true);
  assert.equal(holderStatus(dir, opts(new Map())).state, 'free');
});
