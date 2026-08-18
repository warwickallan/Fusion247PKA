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

import { announceBasketOutcome, BASKET_BLOCKED_ON_ENVIRONMENT } from './runtime.js';
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
