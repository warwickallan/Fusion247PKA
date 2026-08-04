// =====================================================================
// BUILD-015 AsdAIr - handoff/mutation.test.js
//
// Runs mutation-proof.js inside the suite, so a guard that quietly stops being
// load-bearing fails the build rather than waiting for someone to remember to
// run a separate script. A trigger that lives in someone's attention has no
// failure signal.
// =====================================================================
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const { runMutations, secondWriterClaimed, staleWriterWrote, secondLiveRowAppeared } = require('./mutation-proof');

test('MUTATION: every two-writers guard is load-bearing - removing it breaks the property', async () => {
  const results = await runMutations();
  assert.equal(results.length, 3, 'a mutation was removed from the set');
  for (const r of results) {
    assert.equal(r.honestFailed, false, `${r.name}: the property is ALREADY broken with the guard in place`);
    assert.equal(r.mutatedFailed, true, `${r.name}: removing the guard changed NOTHING - the corresponding proof is inert and proves nothing`);
    assert.equal(r.caught, true, `${r.name}: not caught`);
  }
});

test('MUTATION detail: without the claim guard, a second writer claims a live request', async () => {
  assert.equal(await secondWriterClaimed({}), false, 'guarded: the second writer must get nothing');
  assert.equal(await secondWriterClaimed({ claimIgnoresLease: true }), true, 'unguarded: the second writer must get through, or the guard is not what stops it');
});

test('MUTATION detail: without the fence, a writer that lost its lease keeps writing', async () => {
  assert.equal(await staleWriterWrote({}), false, 'guarded: the stale write must be rejected');
  assert.equal(await staleWriterWrote({ noFencing: true }), true, 'unguarded: the stale write must succeed, or the fence is not what stops it');
});

test('MUTATION detail: without the partial unique index, a repeated handoff opens a second live request', async () => {
  assert.equal(await secondLiveRowAppeared({}), false, 'guarded: a repeated handoff must resume the existing row');
  assert.equal(await secondLiveRowAppeared({ noLiveRowConstraint: true }), true, 'unguarded: a second live row must appear, or the index is not what prevents it');
});
