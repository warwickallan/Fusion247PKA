import { test } from 'node:test';
import assert from 'node:assert/strict';

import fs from 'node:fs';

import { openState, acquireLock } from '../src/state.js';
import { tmpPath } from '../test-helpers/fakes.js';

test('durable state — answered dedup + per-chain rounds persist across reopen', () => {
  const statePath = tmpPath('.json');
  const s1 = openState({ statePath });
  assert.equal(s1.existedAtOpen, false);
  assert.equal(s1.isAnswered('cp-1'), false);
  s1.recordAnswered('cp-1', { reviewedHead: 'abc', verdict: 'APPROVE', promptFingerprint: 'ff', commentId: 'c1' });
  s1.incrementRound('BUILD|WP1|brief');
  s1.incrementRound('BUILD|WP1|brief');

  const s2 = openState({ statePath });
  assert.equal(s2.existedAtOpen, true);
  assert.equal(s2.isAnswered('cp-1'), true);
  assert.equal(s2.getAnswered('cp-1').prompt_fingerprint, 'ff');
  assert.equal(s2.roundCount('BUILD|WP1|brief'), 2);
});

test('cold-start rebuild — mergeAnsweredIds marks thread ids answered', () => {
  const s = openState({ statePath: tmpPath('.json') });
  s.mergeAnsweredIds(['cp-a', 'cp-b']);
  assert.equal(s.isAnswered('cp-a'), true);
  assert.equal(s.isAnswered('cp-b'), true);
});

test('one-watcher lockfile — a second acquire is refused', () => {
  const lockPath = tmpPath('.lock');
  const first = acquireLock({ lockPath });
  assert.equal(first.acquired, true);
  const second = acquireLock({ lockPath });
  assert.equal(second.acquired, false);
  assert.match(second.reason, /another watcher holds the lock/);
  first.release();
  // after release, a fresh acquire succeeds
  const third = acquireLock({ lockPath });
  assert.equal(third.acquired, true);
  third.release();
});

test('lockfile — a stale lock is reclaimed', () => {
  const lockPath = tmpPath('.lock');
  const first = acquireLock({ lockPath, now: 0 });
  assert.equal(first.acquired, true);
  // A much later acquire finds the lock stale and reclaims it.
  const later = acquireLock({ lockPath, now: 10 * 60 * 1000, staleMs: 60 * 1000 });
  assert.equal(later.acquired, true);
  assert.equal(later.reclaimedStale, true);
  later.release();
});

// ── LOCK LIVENESS FIX (BUILD-010-LOCK-LIVENESS-FINAL-FIX-0001) ──────────────────
// The single-watcher lock must judge staleness on the OWNER's liveness + heartbeat
// freshness, NEVER on acquired_at, so a healthy long-running watcher keeps ownership
// indefinitely and a second start is refused. isAlive is injected for determinism.

test('lock liveness — live owner beyond stale threshold (old acquired_at, fresh heartbeat) is REFUSED', () => {
  const lockPath = tmpPath('.lock');
  // First watcher acquired long ago (acquired_at at t=0) but is still heartbeating.
  const first = acquireLock({ lockPath, now: 0, isAlive: () => true, nonce: 'A' });
  assert.equal(first.acquired, true);
  // Simulate a still-alive watcher that refreshed its heartbeat recently, even though
  // acquired_at is now ~1h old and staleMs is only 60s.
  const t = 60 * 60 * 1000; // 1 hour later
  assert.equal(first.heartbeat({ now: t - 1000 }), true); // fresh heartbeat at t-1s
  const second = acquireLock({ lockPath, now: t, staleMs: 60 * 1000, isAlive: () => true, nonce: 'B' });
  assert.equal(second.acquired, false); // #1/#2: live owner keeps the lock regardless of acquired_at age
  assert.match(second.reason, /another watcher holds the lock/);
  first.release();
});

test('lock liveness — dead owner beyond threshold (isAlive→false) is RECLAIMED', () => {
  const lockPath = tmpPath('.lock');
  const first = acquireLock({ lockPath, now: 0, isAlive: () => true, nonce: 'A' });
  assert.equal(first.acquired, true);
  // Owner is now dead (crashed): isAlive→false. Heartbeat is old too.
  const later = acquireLock({ lockPath, now: 10 * 60 * 1000, staleMs: 60 * 1000, isAlive: () => false, nonce: 'B' });
  assert.equal(later.acquired, true); // #3: a genuinely dead watcher's lock is reclaimable
  assert.equal(later.reclaimedStale, true);
  assert.match(later.reason, /dead lock/);
  later.release();
});

test('lock liveness — malformed lock is bounded: reclaim only when mtime is older than staleMs', () => {
  const lockPath = tmpPath('.lock');
  fs.writeFileSync(lockPath, 'not-json-at-all', 'utf8');
  const realStat = fs.statSync(lockPath);
  // Fake fs that reports a controllable mtime so the branch is deterministic.
  const withMtime = (mtimeMs) => ({
    ...fs,
    statSync: (p) => (p === lockPath ? { ...realStat, mtimeMs } : fs.statSync(p)),
  });
  // Fresh corrupt lock (mtime within window) → fail-closed refuse (do not steal).
  const refused = acquireLock({ lockPath, fs: withMtime(1000), now: 1500, staleMs: 60 * 1000, nonce: 'B' });
  assert.equal(refused.acquired, false);
  assert.match(refused.reason, /malformed but fresh/);
  // Stale corrupt lock (mtime older than window) → bounded reclaim.
  const reclaimed = acquireLock({ lockPath, fs: withMtime(0), now: 10 * 60 * 1000, staleMs: 60 * 1000, nonce: 'C' });
  assert.equal(reclaimed.acquired, true);
  assert.equal(reclaimed.reclaimedStale, true);
  assert.match(reclaimed.reason, /malformed lock/);
  reclaimed.release();
});

test('lock ownership — an OLD owner release (nonce A) does NOT delete a NEWER owner lock (nonce B)', () => {
  const lockPath = tmpPath('.lock');
  const oldOwner = acquireLock({ lockPath, now: 0, isAlive: () => false, nonce: 'A' });
  assert.equal(oldOwner.acquired, true);
  // The old owner is declared dead, so a new watcher reclaims and installs nonce B.
  const newOwner = acquireLock({ lockPath, now: 10 * 60 * 1000, staleMs: 60 * 1000, isAlive: () => false, nonce: 'B' });
  assert.equal(newOwner.acquired, true);
  // The late-arriving shutdown of the OLD owner must NOT remove the NEW owner's lock.
  assert.equal(oldOwner.release(), false); // #4: not our lock → refused
  assert.equal(fs.existsSync(lockPath), true);
  const held = JSON.parse(fs.readFileSync(lockPath, 'utf8'));
  assert.equal(held.nonce, 'B'); // newer owner's lock intact
  // The genuine owner can still release it, and graceful shutdown works.
  assert.equal(newOwner.release(), true); // #5: normal graceful release still works
  assert.equal(fs.existsSync(lockPath), false);
});

test('notify dedup cache persists', () => {
  const statePath = tmpPath('.json');
  const s = openState({ statePath });
  assert.equal(s.isNotified('k1'), false);
  s.recordNotified('k1');
  assert.equal(s.isNotified('k1'), true);
  assert.equal(openState({ statePath }).isNotified('k1'), true);
});
