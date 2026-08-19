// =====================================================================
// BUILD-015 AsdAIr WO-2026-08-18-07 - laneFailureIsNotSilent.test.js
//
// Runs under: node --test
//
// FAILURE MUST NEVER BE SILENT - PROVEN BY THE ROW IT PRODUCES.
//
// -- THE INCIDENT ------------------------------------------------------------
// `runtime.js` bound the browser lane's `announce` to a LOG LINE ONLY. On
// 2026-08-18 four browser build requests were terminated for want of three
// environment variables and NOTHING reached anybody: the newest
// `pipeline_command` row was id 282 at 14:13:35Z, hours earlier. Veritas,
// defect 2: "That terminal failure is silent to the human."
//
// -- WHY THIS FILE ASSERTS A ROW AND NOT A LOG CALL --------------------------
// A test that asserted `log()` was called would satisfy the letter of "tell the
// human" and miss the entire point - a journal line IS the defect. What makes a
// message reach Warwick is a durable `asdair.pipeline_command` row of kind
// `outbox` whose `command` has a registered renderer, which `drainOutbox` then
// sends. So that is what is asserted: the row, its contents, its idempotency,
// and that the renderer for its kind exists.
//
// `announceBasketOutcome` is EXPORTED from runtime.js for exactly this reason.
// It used to be an inline arrow inside `realWiring`, reachable only by standing
// up the whole runtime - so the only available proof would have been a source
// grep, which is the shape of evidence this build has been burned by.
//
// -- NOT PROVEN HERE ---------------------------------------------------------
// That Telegram delivered it. `drainOutbox` and the sender are exercised
// elsewhere; the first real delivery of THIS card belongs to a live run.
//
// PURE ASCII. Fake Postgres, no network, no model call.
// =====================================================================

import test from 'node:test';
import assert from 'node:assert/strict';

import { announceBasketOutcome, BASKET_BLOCKED_ON_ENVIRONMENT, LANE_TERMINAL_CONDITIONS } from './runtime.js';
import * as commands from './commands.js';
import { makeHarness, HOUSEHOLD_ID } from './test/harness.js';
import { MESSAGES } from '../bot/renderMessages.js';

const ACTOR = 'warwick';
const REF = 'SHOP-2026-08-18';

async function shopExists() {
  const h = makeHarness();
  await commands.receiveList({
    householdId: HOUSEHOLD_ID, listDate: '2026-08-18', sourceKind: 'text', rawText: '1 wet wipes',
    actor: ACTOR, telegramChatId: '555', telegramMessageId: '900',
  }, h.deps);
  return { h, shopId: h.db.shop[0].id };
}

const outboxRows = (h) => h.db.pipeline_command.filter(
  (c) => c.kind === 'outbox' && c.command === BASKET_BLOCKED_ON_ENVIRONMENT,
);

const payloadOf = (row) => (typeof row.args === 'string' ? JSON.parse(row.args) : row.args);

function blockedPayload(shopId, over = {}) {
  return {
    kind: BASKET_BLOCKED_ON_ENVIRONMENT,
    shop_ref: REF,
    shop_id: shopId,
    household_id: HOUSEHOLD_ID,
    request_id: 7,
    blockers: [{ kind: 'launcher-config', detail: 'launcher configuration missing: chromePath, profileDir, port.' }],
    attempts: 1,
    max_attempts: 5,
    terminal: false,
    ...over,
  };
}

// =====================================================================
// AC5 - THE NOTIFICATION IS EMITTED, WITH THE ROW IT PRODUCES
// =====================================================================

test('AC5: the announcement writes a durable OUTBOX ROW, not a log line', async () => {
  const { h, shopId } = await shopExists();
  const logged = [];

  const written = await announceBasketOutcome(h.deps, blockedPayload(shopId), {
    log: (event, detail) => logged.push({ event, detail }),
  });

  assert.ok(written, 'announceBasketOutcome returned nothing - no row was enqueued');
  const rows = outboxRows(h);
  assert.equal(rows.length, 1, 'the browser lane failed and no outbox row exists - this is the 2026-08-18 defect');
  assert.equal(rows[0].kind, 'outbox');
  assert.equal(rows[0].command, BASKET_BLOCKED_ON_ENVIRONMENT);
  assert.equal(String(rows[0].shop_id), String(shopId));
  assert.equal(rows[0].status, 'pending', 'the row is not pending, so drainOutbox will never send it');

  // The log line still happens - it was never the problem, it was never the
  // answer either.
  assert.ok(logged.some((l) => l.event === 'basket_outcome'));
});

test('AC5: the row carries what the card needs, and NOT the launcher detail', async () => {
  const { h, shopId } = await shopExists();
  await announceBasketOutcome(h.deps, blockedPayload(shopId));

  const p = payloadOf(outboxRows(h)[0]);
  assert.equal(p.shopRef, REF);
  assert.deepEqual(p.blockers, [{ kind: 'launcher-config' }]);
  assert.equal(p.attempts, 1);
  assert.equal(p.maxAttempts, 5);
  assert.equal(p.terminal, false);

  // The blocker's `detail` names environment variables. A card is not a config
  // reference - pipeline-runtime/RUNBOOK.md is - and a payload that carries
  // machine detail into a Telegram message is how one starts leaking.
  assert.equal(JSON.stringify(p).includes('chromePath'), false,
    'the launcher detail reached the outbox payload');
});

test('AC5: the row RENDERS - an unregistered kind is a silent drop, which is the defect again', async () => {
  const { h, shopId } = await shopExists();
  await announceBasketOutcome(h.deps, blockedPayload(shopId));
  const p = payloadOf(outboxRows(h)[0]);

  const render = MESSAGES[BASKET_BLOCKED_ON_ENVIRONMENT];
  assert.equal(typeof render, 'function',
    'no renderer is registered for this kind - runtime.js drainOutbox resolves such a row "abandoned" '
    + 'and discards it, so the fix would itself be silent');

  const card = render(p);
  assert.match(card.text, /could not start the ASDA browser/i);
  assert.match(card.text, /Nothing has been added to a basket/i);
  assert.match(card.text, /launcher-config/);
  assert.ok(Array.isArray(card.reply_markup.inline_keyboard));
});

test('AC5: ONCE per shop per distinct fact - a second pass adds nothing', async () => {
  const { h, shopId } = await shopExists();
  await announceBasketOutcome(h.deps, blockedPayload(shopId));
  // The lane fails again on the next pass, and the one after that.
  await announceBasketOutcome(h.deps, blockedPayload(shopId, { attempts: 2 }));
  await announceBasketOutcome(h.deps, blockedPayload(shopId, { attempts: 3 }));

  assert.equal(outboxRows(h).length, 1,
    'a repeating failure became a stream of identical cards - eighteen in seventeen minutes is the '
    + 'measured cost of getting this wrong');
});

test('AC5: reaching the CEILING is a distinct fact, and he is told that too', async () => {
  const { h, shopId } = await shopExists();
  await announceBasketOutcome(h.deps, blockedPayload(shopId));
  await announceBasketOutcome(h.deps, blockedPayload(shopId, { attempts: 5, terminal: true }));

  const rows = outboxRows(h);
  assert.equal(rows.length, 2,
    'AsdAIr stopped trying and the only card he ever got says it is still trying - he would wait for nothing');
  assert.deepEqual(rows.map((r) => payloadOf(r).terminal), [false, true]);

  const card = MESSAGES[BASKET_BLOCKED_ON_ENVIRONMENT](payloadOf(rows[1]));
  assert.match(card.text, /stopped trying/i);
  assert.match(card.text, /pick this\s+same job back up/i);
});

test('AC5: a SUCCESSFUL basket writes no outbox row from here - there is one announcement path, not two', async () => {
  const { h, shopId } = await shopExists();
  const written = await announceBasketOutcome(h.deps, {
    kind: 'basket_ready', shop_ref: REF, shop_id: shopId, household_id: HOUSEHOLD_ID, request_id: 7,
    reconciliation: { ready: { ready: true } },
  });
  assert.equal(written, null);
  assert.equal(h.db.pipeline_command.filter((c) => c.kind === 'outbox').length, 0,
    '"Mum\'s basket is ready" is issued by advanceAll/queueShopCards - a second truth about one event '
    + 'is the defect the browser lane Work Order removed');
});

test('AC5: an announcement with no shop cannot become a row, and says so by returning null', async () => {
  const { h } = await shopExists();
  const written = await announceBasketOutcome(h.deps, blockedPayload(null));
  assert.equal(written, null);
  assert.equal(outboxRows(h).length, 0);
});


// =====================================================================
// WO-2026-08-19-01 AC5 - EVERY TERMINAL CONDITION, NOT JUST THE ONE THAT
// HAPPENED LAST TIME.
//
// The environment card above was built after 2026-08-18. It closed the
// condition that had just bitten. Two others were still silent:
//
//   basket_not_ready   reached announceBasketOutcome and was DROPPED - the
//                      guard returned null for every kind but the environment
//                      one. A run that finished `failed` over an untruthful
//                      reconciliation wrote a log line and nothing else.
//   basket_run_error   did not exist. consume-request's catch released the
//                      lease and rethrew without announcing, and at the
//                      attempt ceiling that release marks the request `failed`
//                      permanently while naming no _failure_class - so
//                      requeueEnvironmentFailures can never recover it either.
//                      Silent AND unrecoverable.
//
// Both now map onto the EXISTING `failure` outbox kind and its existing
// renderer. A new kind would need a new renderer, and a kind with no renderer
// is abandoned by drainOutbox - discarded, nobody told - which is the very
// failure this file is about.
// =====================================================================

const failureRows = (h) => h.db.pipeline_command.filter(
  (c) => c.kind === 'outbox' && c.command === 'failure',
);

test('AC5 INVENTORY: every lane terminal condition is accounted for, one way or the other', () => {
  const kinds = Object.keys(LANE_TERMINAL_CONDITIONS);
  assert.ok(kinds.length >= 4,
    `expected the lane inventory to name at least 4 conditions, found ${kinds.length}`);
  for (const [kind, spec] of Object.entries(LANE_TERMINAL_CONDITIONS)) {
    assert.ok(spec.why && spec.why.length > 10, `${kind} has no stated reason`);
    if (spec.outboxKind === null) continue;
    // THE ABANDONED-ROW GUARD. drainOutbox looks the renderer up by kind and
    // discards a row it cannot render, telling nobody. An outbox kind with no
    // renderer is therefore a silent failure dressed as a fix.
    assert.ok(Object.prototype.hasOwnProperty.call(MESSAGES, spec.outboxKind),
      `${kind} enqueues outbox kind "${spec.outboxKind}", which has NO renderer in `
      + 'bot/renderMessages.js - drainOutbox would abandon the row and nobody would be told');
  }
});

test('AC5: basket_not_ready writes a durable outbox row - it used to write nothing', async () => {
  const { h, shopId } = await shopExists();
  const written = await announceBasketOutcome(h.deps, {
    kind: 'basket_not_ready',
    shop_ref: REF,
    shop_id: shopId,
    household_id: HOUSEHOLD_ID,
    request_id: 7,
    blockers: [{ kind: 'quantity-not-established', line: 4 }, { kind: 'unexplained-absence', line: 9 }],
  });
  assert.ok(written, 'an untruthful reconciliation produced no outbox row');
  const rows = failureRows(h);
  assert.equal(rows.length, 1);
  assert.equal(String(rows[0].shop_id), String(shopId));
  assert.equal(rows[0].status, 'pending', 'the row is not pending, so drainOutbox will never send it');
  const pay = payloadOf(rows[0]);
  assert.equal(pay.shopRef, REF);
  assert.match(pay.detail, /quantity-not-established/,
    'the card does not say what stopped the basket');
  assert.doesNotMatch(pay.detail, /chromePath|profileDir|ASDAIR_/,
    'an environment variable name reached a card - a card is not a config reference');
});

test('AC5: basket_run_error writes a durable outbox row, and says it is terminal', async () => {
  const { h, shopId } = await shopExists();
  await announceBasketOutcome(h.deps, {
    kind: 'basket_run_error',
    shop_ref: REF,
    shop_id: shopId,
    household_id: HOUSEHOLD_ID,
    request_id: 7,
    detail: 'browser build request names shop 99, which does not exist',
    attempts: 5,
    max_attempts: 5,
    terminal: true,
  });
  const rows = failureRows(h);
  assert.equal(rows.length, 1, 'the error path is still silent');
  const pay = payloadOf(rows[0]);
  assert.match(pay.detail, /does not exist/, 'the error sentence did not reach the card');
  assert.equal(pay.stage, 'browser basket');
});

test('AC5: SUCCESS still writes nothing here - one event, one truth', async () => {
  const { h, shopId } = await shopExists();
  const written = await announceBasketOutcome(h.deps, {
    kind: 'basket_ready', shop_ref: REF, shop_id: shopId, household_id: HOUSEHOLD_ID, request_id: 7,
  });
  assert.equal(written, null,
    'a second basket-ready card was written - advanceAll -> queueShopCards already issues it');
  assert.equal(failureRows(h).length, 0);
});

test('AC5: one failing pass, one card - not one card per pass', async () => {
  const { h, shopId } = await shopExists();
  const payload = {
    kind: 'basket_run_error',
    shop_ref: REF,
    shop_id: shopId,
    household_id: HOUSEHOLD_ID,
    request_id: 7,
    detail: 'the same error again',
    attempts: 1,
    max_attempts: 5,
    terminal: false,
  };
  await announceBasketOutcome(h.deps, payload);
  await announceBasketOutcome(h.deps, payload);
  await announceBasketOutcome(h.deps, payload);
  assert.equal(failureRows(h).length, 1,
    'eighteen identical cards in seventeen minutes is the measured cost of getting this wrong');

  // But crossing into TERMINAL is a genuinely different fact, and he is told.
  await announceBasketOutcome(h.deps, { ...payload, terminal: true, attempts: 5 });
  assert.equal(failureRows(h).length, 2,
    'AsdAIr stopped trying and did not say so');
});

test('AC5: an UNMAPPED kind is logged rather than vanishing', async () => {
  const { h, shopId } = await shopExists();
  const logged = [];
  const written = await announceBasketOutcome(
    h.deps,
    { kind: 'basket_something_nobody_mapped', shop_ref: REF, shop_id: shopId, household_id: HOUSEHOLD_ID },
    { log: (event, detail) => logged.push({ event, detail }) },
  );
  assert.equal(written, null);
  assert.ok(logged.some((l) => l.event === 'basket_outcome_unmapped'),
    'an unmapped outcome disappeared without trace - which is how basket_not_ready hid for a week');
});
