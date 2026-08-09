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

const {
  runMutations, secondWriterClaimed, staleWriterWrote, secondLiveRowAppeared,
  secondProductTabOpened, regularFreeSearched, misSortedPacketAccepted,
  searchWentUnbounded, wrongBasketReportedVerified, requestOpenedWithoutMethod,
} = require('./mutation-proof');

test('MUTATION: every guard is load-bearing - removing it breaks the property', async () => {
  const results = await runMutations();
  assert.equal(results.length, 9, 'a mutation was removed from the set');
  for (const r of results) {
    assert.equal(r.honestFailed, false, `${r.name}: the property is ALREADY broken with the guard in place`);
    assert.equal(r.mutatedFailed, true, `${r.name}: removing the guard changed NOTHING - the corresponding proof is inert and proves nothing`);
    assert.equal(r.caught, true, `${r.name}: not caught`);
  }
});

test('MUTATION: all SIX named browser behaviours are covered, by name', async () => {
  // Warwick named six. A set that quietly lost one would still go green above,
  // because every REMAINING mutation would still be caught. So the roster is
  // pinned here, against a literal written out in this file.
  const { MUTATIONS } = require('./mutation-proof');
  const required = [
    'secondProductTab',        // (a) a second product tab is opened
    'regularsBypassed',        // (b) Regulars/Favourites bypassed for a known regular
    'sortContractIgnored',     // (c) Brand A-Z ordering omitted
    'searchByDefault',         // (d) per-item search as the default, not a bounded fallback
    'verificationSkipped',     // (e) trolley verification skipped
    'methodPayloadAbsent',     // (f) the BROWSER_METHOD payload absent from the production path
  ];
  const names = MUTATIONS.map((m) => m.name);
  for (const r of required) assert.ok(names.includes(r), `mutation "${r}" has gone missing from the set`);

  // Each names the method step it protects, so a reader can walk from
  // instructions.js to the proof without trusting either.
  for (const m of MUTATIONS.filter((x) => required.includes(x.name))) {
    assert.ok(typeof m.behaviour === 'string' && m.behaviour.length > 0, `${m.name} does not say which behaviour it is`);
    assert.ok(typeof m.method_step === 'string' && m.method_step.length > 0, `${m.name} names no method step`);
  }
});

// ── the six, individually - so a failure says WHICH behaviour regressed ─────

test('MUTATION detail (a): without the one-tab guard, the arm opens a tab per product', async () => {
  assert.equal(await secondProductTabOpened({}), false, 'guarded: a second page target must be refused');
  assert.equal(await secondProductTabOpened({ allowSecondTab: true }), true, 'unguarded: the tabs must appear, or the guard is not what stops them');
});

test('MUTATION detail (b): without the guard, a known regular with a reference gets free-searched', async () => {
  assert.equal(await regularFreeSearched({}), false, 'guarded: the packet must be refused');
  assert.equal(await regularFreeSearched({ regularsBypassed: true }), true, 'unguarded: the free-searched line must get through');
});

test('MUTATION detail (c): without the sort assertion, a mis-sorted packet ships', async () => {
  assert.equal(await misSortedPacketAccepted({}), false, 'guarded: brand A-Z is asserted, not assumed');
  assert.equal(await misSortedPacketAccepted({ sortContractIgnored: true }), true, 'unguarded: the mis-sorted packet must build');
});

test('MUTATION detail (d): without the bounded-search mechanism, search becomes the default', async () => {
  assert.equal(await searchWentUnbounded({}), false, 'guarded: a searched known item carries its retrieval duties');
  assert.equal(await searchWentUnbounded({ searchByDefault: true }), true, 'unguarded: it must reach the worker with none');
});

test('MUTATION detail (e): without the line-derived verdict, a wrong basket reports VERIFIED', async () => {
  assert.equal(await wrongBasketReportedVerified({}), false, 'guarded: a missing product must block verification');
  assert.equal(await wrongBasketReportedVerified({ verificationSkipped: true }), true, 'unguarded: the wrong basket must pass');
});

test('MUTATION detail (f): without the producer refusal, a request opens carrying no method', async () => {
  assert.equal(await requestOpenedWithoutMethod({}), false, 'guarded: the producer must refuse before anything durable happens');
  assert.equal(await requestOpenedWithoutMethod({ methodPayloadAbsent: true }), true, 'unguarded: the contract-less request must be opened');
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
