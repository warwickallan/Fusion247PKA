import { test } from 'node:test';
import assert from 'node:assert/strict';

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

test('notify dedup cache persists', () => {
  const statePath = tmpPath('.json');
  const s = openState({ statePath });
  assert.equal(s.isNotified('k1'), false);
  s.recordNotified('k1');
  assert.equal(s.isNotified('k1'), true);
  assert.equal(openState({ statePath }).isNotified('k1'), true);
});
