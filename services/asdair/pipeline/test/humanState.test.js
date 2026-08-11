// =====================================================================
// BUILD-015 AsdAIr Stage 1 - pipeline/test/humanState.test.js
//
// WO-2026-08-11-B15-VISION-01, AC7 proof, for the human_state mapping and
// wiring added to services/asdair/shop/shopStore.js (a file granted to Keel
// by Amendment 2 Finding 1, not by the original file_surface). This test
// lives here, inside pipeline/test/, for the same reason
// groundedPromptRegionContract.test.js does: the Amendment granted exactly
// one file, not a new sibling test file under services/asdair/shop/, so the
// proof reaches across the package boundary via createRequire, exactly as
// pipeline/deps.js already does for this same module.
//
// TWO CLAIMS:
//   1. computeHumanState(status) mirrors migration 020's own backfill CASE
//      exactly, for EVERY status shopState.js's own vocabulary defines - no
//      status is left unmapped, and no value drifts from the migration's.
//   2. applyTransition() - "THE ONLY place asdair.shop.status is written"
//      per the file's own header - writes human_state in the SAME
//      statement as status, computed from the SAME to_status value, and
//      the file's pre-existing single-writer invariant (asserted by
//      shopStore.test.js on the statement text) is left intact: this test
//      proves human_state rides the EXISTING UPDATE, not a second one.
//
// Runs under: node --test (no DB, no model, no network - fakeClient.js,
// services/asdair/shop's own scripted pg stand-in, is READ here exactly as
// pipeline/deps.js already reads shopStore.js itself).
// =====================================================================

import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const shopStore = require('../../shop/shopStore.js');
const { makeClient } = require('../../shop/fakeClient.js');

const { computeHumanState, HUMAN_STATES, HUMAN_STATE_BY_STATUS, applyTransition } = shopStore._internal;

// The full status vocabulary shopState.js defines (BUILD-015 AsdAIr Stage 1,
// shop/shopState.js) - copied here as a literal so this test pins BOTH
// sides independently rather than deriving one from the other, matching the
// house convention runtime-deps.test.mjs already uses for a copied literal.
const ALL_STATUSES = [
  'RECEIVED', 'TRANSCRIBING', 'PROCESSING', 'NEEDS_DECISION', 'READY_TO_SHOP',
  'WAITING_FOR_BROWSER', 'SHOPPING', 'BASKET_READY', 'ORDER_CONFIRMATION_RECEIVED',
  'RECONCILED', 'FAILED', 'CANCELLED',
];

// Migration 020's own backfill CASE, copied VERBATIM
// (services/asdair/db/020_shop_line_provenance_and_human_state.sql, section
// 5) so a drift between the migration and shopStore.js's ongoing writer is
// caught by an EXECUTED comparison, never assumed to stay in sync.
const MIGRATION_020_CASE = {
  RECEIVED: 'ASDAIR_WORKING',
  TRANSCRIBING: 'ASDAIR_WORKING',
  PROCESSING: 'ASDAIR_WORKING',
  NEEDS_DECISION: 'NEEDS_WARWICK',
  READY_TO_SHOP: 'READY_FOR_WARWICK',
  WAITING_FOR_BROWSER: 'BROWSER_WORKING',
  SHOPPING: 'BROWSER_WORKING',
  BASKET_READY: 'READY_FOR_WARWICK',
  ORDER_CONFIRMATION_RECEIVED: 'ASDAIR_WORKING',
  RECONCILED: 'COMPLETE',
  FAILED: 'FAILED',
  CANCELLED: 'COMPLETE',
};

test('computeHumanState: every status in shopState.js\'s vocabulary is mapped - none missing', () => {
  ALL_STATUSES.forEach((status) => {
    assert.doesNotThrow(() => computeHumanState(status), 'status "' + status + '" must be mapped');
  });
});

test('computeHumanState: matches migration 020\'s own backfill CASE, status by status, executed not eyeballed', () => {
  ALL_STATUSES.forEach((status) => {
    assert.equal(computeHumanState(status), MIGRATION_020_CASE[status],
      'status "' + status + '" must map identically to migration 020\'s backfill');
  });
});

test('computeHumanState: every mapped value is one of the six CHECK-enforced human_state values', () => {
  ALL_STATUSES.forEach((status) => {
    assert.ok(HUMAN_STATES.includes(computeHumanState(status)),
      'computeHumanState("' + status + '") returned a value outside the CHECK vocabulary');
  });
});

test('computeHumanState: an unmapped status throws loudly rather than guessing', () => {
  assert.throws(() => computeHumanState('SOME_FUTURE_STATUS_NOBODY_MAPPED_YET'), /has no mapping for status/);
});

test('HUMAN_STATE_BY_STATUS exposes exactly the 12 known statuses, no more, no fewer', () => {
  assert.deepEqual(Object.keys(HUMAN_STATE_BY_STATUS).sort(), ALL_STATUSES.slice().sort());
});

// ---------------------------------------------------------------------
// Wiring: applyTransition() writes human_state in the SAME UPDATE as
// status, computed from spec.to_status - proven against the statement
// actually sent, not merely that the pure function works in isolation.
// ---------------------------------------------------------------------

test('applyTransition: the UPDATE statement assigns human_state alongside status, in ONE statement', async () => {
  const client = makeClient([
    { match: 'UPDATE asdair.shop', rows: [{ id: 42, status: 'READY_TO_SHOP', human_state: 'READY_FOR_WARWICK' }] },
    { match: 'INSERT INTO asdair.shop_event', rows: [{ id: 1 }] },
  ]);

  await applyTransition(client, {
    shop_id: 42,
    from_status: 'PROCESSING',
    to_status: 'READY_TO_SHOP',
    set: { status: 'READY_TO_SHOP' },
    event: { event_type: 'milestone', from_status: 'PROCESSING', to_status: 'READY_TO_SHOP', description: 'ready' },
  });

  const updateCall = client.log.find((entry) => entry.sql.indexOf('UPDATE asdair.shop') === 0);
  assert.ok(updateCall, 'expected an UPDATE asdair.shop statement');
  assert.match(updateCall.sql, /human_state = \$\d+/, 'human_state must be assigned in the SAME UPDATE as status');
  assert.match(updateCall.sql, /status = \$\d+/, 'status must still be assigned - the pre-existing writer is untouched');

  // Exactly ONE UPDATE asdair.shop statement - the single-writer invariant
  // shopStore.test.js already asserts on the source text stays true at
  // RUNTIME too: this addition rides the existing statement, it never adds
  // a second one.
  const updateCount = client.log.filter((entry) => entry.sql.indexOf('UPDATE asdair.shop') === 0).length;
  assert.equal(updateCount, 1);

  // The actual bound parameter value is the CORRECT mapped human_state for
  // the to_status this transition wrote - not merely present, but correct.
  const humanStateParamIndex = Number(updateCall.sql.match(/human_state = \$(\d+)/)[1]) - 1;
  assert.equal(updateCall.params[humanStateParamIndex], 'READY_FOR_WARWICK');
});

test('applyTransition: recordFailure-shaped transitions (to_status FAILED) also write the correct human_state', async () => {
  const client = makeClient([
    { match: 'UPDATE asdair.shop', rows: [{ id: 7, status: 'FAILED', human_state: 'FAILED' }] },
    { match: 'INSERT INTO asdair.shop_event', rows: [{ id: 1 }] },
  ]);

  await applyTransition(client, {
    shop_id: 7,
    from_status: 'PROCESSING',
    to_status: 'FAILED',
    set: { status: 'FAILED', last_error: 'the model refused' },
    event: { event_type: 'failure', from_status: 'PROCESSING', to_status: 'FAILED', description: 'x' },
  });

  const updateCall = client.log.find((entry) => entry.sql.indexOf('UPDATE asdair.shop') === 0);
  const humanStateParamIndex = Number(updateCall.sql.match(/human_state = \$(\d+)/)[1]) - 1;
  assert.equal(updateCall.params[humanStateParamIndex], 'FAILED');
});
