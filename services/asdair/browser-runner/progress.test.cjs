'use strict';
const { test } = require('node:test');
const assert = require('node:assert');
const P = require('./progress.cjs');
const { validatePlan } = require('./commands.cjs');

const step = (id, ref, origin) => ({ step_id: id, command: 'add_known_product', product_ref: ref, origin });

test('the four contract keys are always present, never absent-or-guessable', () => {
  const p = P.normalise(undefined);
  for (const k of P.REPORTED_KEYS) assert.ok(Object.prototype.hasOwnProperty.call(p, k), `${k} must always be present`);
  assert.strictEqual(p.regulars_added, 0);
  assert.strictEqual(p.searched_added, 0);
  assert.strictEqual(p.basket_product_count, 0);
  assert.strictEqual(p.estimated_total, null);
  assert.strictEqual(p.human_reauth_required, false);
});

test('counters split regulars from search-adds', () => {
  let p = P.normalise({});
  p = P.markCompleted(p, step('s1', '489747', 'regular'));
  p = P.markCompleted(p, { step_id: 's2', command: 'select_search_result', product_ref: '544334', term: 'mixed herbs' });
  assert.strictEqual(p.regulars_added, 1);
  assert.strictEqual(p.searched_added, 1);
  assert.strictEqual(p.last_successful_browser_step, 'select_search_result:544334:mixed herbs');
});

test('recording the same step twice never double-counts - the anti-duplicate rule', () => {
  let p = P.normalise({});
  p = P.markCompleted(p, step('s1', '489747', 'regular'));
  p = P.markCompleted(p, step('s1', '489747', 'regular'));
  assert.strictEqual(p.regulars_added, 1);
  assert.strictEqual(p._completed_steps.length, 1);
});

test('a restart never replays a completed add', () => {
  const plan = validatePlan([
    { step_id: 's1', command: 'add_known_product', product_ref: '489747', origin: 'regular' },
    { step_id: 's2', command: 'add_known_product', product_ref: '544334', origin: 'searched' },
    { step_id: 's3', command: 'set_quantity', product_ref: '544334', qty: 2 },
  ]);
  let p = P.normalise({});
  p = P.markCompleted(p, plan[0]);
  p = P.markCompleted(p, plan[1]);
  const left = P.remainingPlan(plan, p);
  assert.deepStrictEqual(left.map((s) => s.step_id), ['s3']);
  // and reconstructing from a round-trip through JSON (as the database does)
  const reloaded = JSON.parse(JSON.stringify(p));
  assert.deepStrictEqual(P.remainingPlan(plan, reloaded).map((s) => s.step_id), ['s3']);
});

test('the crash window is visible: a step in flight is neither done nor forgotten', () => {
  const plan = validatePlan([{ step_id: 's1', command: 'add_known_product', product_ref: '489747' }]);
  let p = P.markInFlight(P.normalise({}), 's1');
  assert.strictEqual(P.inFlightStepId(p), 's1');
  assert.deepStrictEqual(P.remainingPlan(plan, p).map((s) => s.step_id), ['s1'], 'still remaining - it was never recorded done');
  p = P.markCompleted(p, plan[0]);
  assert.strictEqual(P.inFlightStepId(p), null, 'completing clears the in-flight marker');
});

test('unavailable items are reported and the step is closed, never substituted', () => {
  const s = { step_id: 's9', command: 'add_known_product', product_ref: '111222', name: 'Thing' };
  const p = P.markUnavailable(P.normalise({}), s, 'Out of stock');
  assert.strictEqual(p.unavailable_items.length, 1);
  assert.strictEqual(p.regulars_added, 0, 'an unavailable item is not counted as added');
  assert.ok(P.completedStepIds(p).has('s9'), 'and it is not retried on the next pass');
});

test('failures and holds accumulate rather than overwrite', () => {
  let p = P.normalise({});
  p = P.markFailed(p, { step_id: 'a', command: 'add_known_product', product_ref: '1' }, 'boom');
  p = P.markFailed(p, { step_id: 'b', command: 'add_known_product', product_ref: '2' }, 'bang');
  p = P.markHeld(p, { step_id: 'c', command: 'add_known_product', product_ref: '3' }, 'ambiguous');
  p = P.markHeld(p, { step_id: 'c', command: 'add_known_product', product_ref: '3' }, 'ambiguous');
  assert.strictEqual(p.failed_actions.length, 2);
  assert.strictEqual(p.held_items.length, 1, 'holding the same step twice is idempotent');
});

test('a pending favourite is recorded once and cleared when it finally lands', () => {
  const s = { step_id: 'f1', command: 'add_to_favourites', product_ref: '489747' };
  let p = P.markPendingFavourite(P.normalise({}), s, 'control not found');
  p = P.markPendingFavourite(p, s, 'control not found');
  assert.strictEqual(p.pending_favourite_actions.length, 1);
  p = P.markCompleted(p, s);
  assert.strictEqual(p.pending_favourite_actions.length, 0);
});

test('a basket read fills exactly the two basket keys', () => {
  const p = P.applyBasketRead(P.normalise({}), { product_count: '2', order_total: '4.50' });
  assert.strictEqual(p.basket_product_count, 2);
  assert.strictEqual(p.estimated_total, '4.50');
});

test('re-authentication is recorded as a report, with a timestamp', () => {
  const p = P.setReauthRequired(P.normalise({}), true, 'landed on login.asda.com');
  assert.strictEqual(p.human_reauth_required, true);
  assert.match(p._reauth_detected_at, /^\d{4}-\d{2}-\d{2}T/);
  assert.strictEqual(P.setReauthRequired(p, false).human_reauth_required, false);
});

test('an unknown runner state is refused rather than stored', () => {
  assert.throws(() => P.setRunnerState(P.normalise({}), 'checkout'), /unknown runner state/);
});

test('intended adds are counted from the plan, by DISTINCT product, ignoring reads and controls', () => {
  const plan = validatePlan([
    { step_id: 'a', command: 'add_known_product', product_ref: '489747', origin: 'regular' },
    { step_id: 'b', command: 'select_search_result', term: 'mixed herbs', product_ref: '544334' },
    { step_id: 'c', command: 'set_quantity', product_ref: '544334', qty: 2 },
    { step_id: 'd', command: 'read_basket_line_count' },
    { step_id: 'e', command: 'open_trolley' },
    { step_id: 'f', command: 'add_to_favourites', product_ref: '489747' },
  ]);
  assert.strictEqual(P.intendedAdds(plan), 2,
    'only the two commands that PUT a product in the trolley count, and each product once');
  assert.strictEqual(P.intendedAdds([]), 0);
  assert.strictEqual(P.intendedAdds(undefined), 0, 'an absent plan intends nothing rather than throwing');
});

test('the shortfall is the SUBTRACTION nothing was doing: intended minus added, with the reasons beside it', () => {
  const plan = validatePlan([
    { step_id: 'a', command: 'add_known_product', product_ref: '489747', origin: 'regular' },
    { step_id: 'b', command: 'add_known_product', product_ref: '544334', origin: 'regular' },
    { step_id: 'c', command: 'add_known_product', product_ref: '111222', origin: 'regular' },
  ]);
  let p = P.normalise({});
  p = P.markCompleted(p, plan[0]);
  p = P.markUnavailable(p, plan[1], 'Out of stock');
  p = P.markFailed(p, plan[2], 'the add control never appeared');
  p = P.applyBasketRead(p, { product_count: '1', order_total: '2.25' });
  p = P.applyShortfall(p, plan);

  const sf = p.basket_shortfall;
  assert.strictEqual(sf.intended, 3);
  assert.strictEqual(sf.added, 1);
  assert.strictEqual(sf.missing, 2);
  assert.strictEqual(sf.unavailable, 1);
  assert.strictEqual(sf.failed, 1);
  assert.strictEqual(sf.basket_product_count, 1);
});

test('an uncomputed shortfall reads as null, never as a clean zero', () => {
  assert.strictEqual(P.normalise({}).basket_shortfall, null,
    '"nobody measured" and "nothing was missing" must never look the same');
  assert.strictEqual(P.normalise({ basket_shortfall: [1, 2] }).basket_shortfall, null,
    'and a malformed value is not trusted into looking like a measurement');
  assert.strictEqual(P.applyShortfall(P.normalise({}), []).basket_shortfall.missing, 0,
    'a measured zero IS an object');
});

test('the four-key contract with Telegram and the Cockpit was NOT widened by this change', () => {
  assert.deepStrictEqual([...P.REPORTED_KEYS],
    ['regulars_added', 'searched_added', 'basket_product_count', 'estimated_total'],
    'basket_shortfall is reported through summary(), never by changing a contract owned outside this folder');
});

test('summary reports every key the control surface promises', () => {
  const s = P.summary(P.normalise({}));
  for (const k of ['regulars_added', 'searched_added', 'basket_product_count', 'estimated_total',
    'basket_shortfall',
    'held_items', 'unavailable_items', 'failed_actions', 'pending_favourite_actions',
    'last_successful_browser_step', 'human_reauth_required']) {
    assert.ok(Object.prototype.hasOwnProperty.call(s, k), `summary must report ${k}`);
  }
});
