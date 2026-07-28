// =====================================================================
// BUILD-015 AsdAIr Stage 1 - pipeline/runPipeline.test.js
//
// RESUMABILITY AND IDEMPOTENCY OF THE ADVANCER ITSELF.
//
// The method throughout: never carry state between assertions in a variable.
// Every "restart" is a fresh runPipeline call that re-reads the SAME durable
// database, which is exactly what happens after a crash, a reboot or a deploy.
// If a test passes only because something was still in memory, it is not
// testing resumability - so nothing here is.
//
// FULLY OFFLINE. No database, no network, no model, no credentials file.
// =====================================================================

import test from 'node:test';
import assert from 'node:assert/strict';

import { makeHarness, makeCatalogue, HOUSEHOLD_ID } from './test/harness.js';
import * as commands from './commands.js';
import { runPipeline, listDateOf, buildGroundedIntents, planCandidates, assertCatalogueLoaded } from './runPipeline.js';
import { STEPS } from './stages.js';
import { questionKeyFor } from './keys.js';

const REF = 'SHOP-2026-08-03';
const ACTOR = 'telegram:555';
const HANDLE = { shopRef: REF };

/** A handwritten list as the grounded model READS it - raw readings only.
 *  The model never names a product; identity comes from the catalogue. */
const MODEL_LINES = [
  { line_no: 1, raw_reading: '3 gourmet cat food', quantity: 3 },
  { line_no: 2, raw_reading: '1 weetabix protein', quantity: 1 },
  { line_no: 3, raw_reading: 'fruit splits', quantity: null },
];

async function receiveText(h, text = '3 gourmet cat food\n1 weetabix protein') {
  return commands.receiveList({
    householdId: HOUSEHOLD_ID, listDate: '2026-08-03', sourceKind: 'text',
    rawText: text, actor: ACTOR, telegramChatId: '555', telegramMessageId: '900',
  }, h.deps);
}

async function receivePhoto(h) {
  return commands.receiveList({
    householdId: HOUSEHOLD_ID, listDate: '2026-08-03', sourceKind: 'photo',
    rawMediaPath: 'C:/.fusion247/asdair/shopper-media/fake.jpg', needsReview: true,
    actor: ACTOR, telegramChatId: '555', telegramMessageId: '900',
  }, h.deps);
}

/** Drive the pipeline until it parks. Returns every step it took. */
async function drain(h, max = 12) {
  const steps = [];
  for (let i = 0; i < max; i += 1) {
    const r = await runPipeline(HANDLE, h.deps);
    steps.push(r);
    if (!r.stepped) break;
  }
  return steps;
}

const shopStatus = (h) => h.db.shop[0].status;

// =====================================================================
// THE HAPPY PATH
// =====================================================================

test('the full text path: received -> interpreted -> planned -> ready, one step per call', async () => {
  const h = makeHarness();
  await receiveText(h);

  assert.equal((await runPipeline(HANDLE, h.deps)).step, STEPS.AWAIT_BUILD_COMMAND);
  await commands.buildShop({ shopRef: REF, actor: ACTOR }, h.deps);

  const one = await runPipeline(HANDLE, h.deps);
  assert.equal(one.step, STEPS.INTERPRET);
  assert.equal(one.to, 'PROCESSING');
  assert.equal(shopStatus(h), 'PROCESSING', 'exactly ONE step per call - it must not have run on');

  const two = await runPipeline(HANDLE, h.deps);
  assert.equal(two.step, STEPS.PLAN);
  assert.equal(two.to, 'READY_TO_SHOP');

  const three = await runPipeline(HANDLE, h.deps);
  assert.equal(three.step, STEPS.AWAIT_BASKET_REQUEST);
  assert.equal(three.stepped, false);
});

test('THE GROUNDED PATH: the model reads, the CATALOGUE names, the human is asked about the rest', async () => {
  const h = makeHarness({ modelLines: MODEL_LINES });
  await receivePhoto(h);
  await commands.buildShop({ shopRef: REF, actor: ACTOR }, h.deps);

  const transcribe = await runPipeline(HANDLE, h.deps);
  assert.equal(transcribe.step, STEPS.TRANSCRIBE);
  assert.equal(transcribe.to, 'TRANSCRIBING');

  const interpret = await runPipeline(HANDLE, h.deps);
  assert.equal(interpret.step, STEPS.INTERPRET);
  assert.equal(interpret.lines, 3);

  // The names on the real list came from OUR rows, by id - not from the model.
  const names = h.db.shopping_list_items.map((i) => i.item_name).sort();
  assert.deepEqual(names, ['Gourmet cat food', 'Weetabix Protein', 'fruit splits'].sort());
  assert.ok(!names.includes('3 gourmet cat food'), 'a raw reading leaked into the list as a product name');

  // The interpretation is DURABLE (migration 008), one row per page line.
  assert.equal(h.db.shop_line.length, 3);
  const line1 = h.db.shop_line.find((l) => l.line_no === 1);
  assert.equal(line1.status, 'matched');
  assert.equal(line1.matched_regular_id, 11);
  assert.equal(line1.raw_reading, '3 gourmet cat food', 'the raw reading must survive verbatim');
  assert.ok(!('canonical_name' in line1), 'the canonical NAME must not be stored - it is looked up by id');

  const line3 = h.db.shop_line.find((l) => l.line_no === 3);
  assert.equal(line3.status, 'unmatched_new_item');
  assert.equal(line3.matched_regular_id, null);
  assert.equal(line3.quantity, null, 'a quantity that was not visibly written stays null, never 1');

  // Every interpreted line is bound to the list item it became - the replay guard.
  for (const l of h.db.shop_line) assert.ok(l.list_item_id, `line ${l.line_no} was never bound to its list item`);

  const plan = await runPipeline(HANDLE, h.deps);
  assert.equal(plan.step, STEPS.PLAN);
  assert.equal(plan.to, 'NEEDS_DECISION', 'an unresolved line must reach a human, not a basket');
  assert.equal(h.db.shop_question.length, 1);
  assert.equal(h.db.shop_question[0].question_key, questionKeyFor('fruit splits'));
});

// =====================================================================
// IDEMPOTENCY OF THE ADVANCER
// =====================================================================

test('IDEMPOTENCY: re-running the interpret step creates NO duplicate list, list item or interpreted line', async () => {
  const h = makeHarness({ modelLines: MODEL_LINES });
  await receivePhoto(h);
  await commands.buildShop({ shopRef: REF, actor: ACTOR }, h.deps);
  await runPipeline(HANDLE, h.deps);          // -> TRANSCRIBING
  await runPipeline(HANDLE, h.deps);          // -> PROCESSING (interpreted)

  const listsAfter = h.db.shopping_lists.length;
  const itemsAfter = h.db.shopping_list_items.length;
  const linesAfter = h.db.shop_line.length;
  const listId = h.db.shop[0].list_id;

  // Simulate a crash AFTER the interpretation but BEFORE the transition landed,
  // by putting the shop back and re-running the identical step.
  h.db.shop[0].status = 'TRANSCRIBING';
  const again = await runPipeline(HANDLE, h.deps);

  assert.equal(again.step, STEPS.INTERPRET);
  assert.equal(h.db.shopping_lists.length, listsAfter, 'a second list was created');
  assert.equal(h.db.shopping_list_items.length, itemsAfter, 'the list was duplicated');
  assert.equal(h.db.shop_line.length, linesAfter, 'the interpretation was appended instead of updated');
  assert.equal(h.db.shop[0].list_id, listId, 'the shop was bound to a different list');
});

test('IDEMPOTENCY: re-planning opens NO second question and never re-asks an answered one', async () => {
  // A TYPED list, so the interpretation gate is not in play - this test is
  // about the question loop and nothing else. A typed list is still grounded
  // against the catalogue, which is how "fruit splits" becomes a question.
  const h = makeHarness();
  await receiveText(h, '3 gourmet cat food\nfruit splits');
  await commands.buildShop({ shopRef: REF, actor: ACTOR }, h.deps);
  await drain(h);
  assert.equal(shopStatus(h), 'NEEDS_DECISION');
  assert.equal(h.db.shop_question.length, 1);
  const key = h.db.shop_question[0].question_key;

  // Answer it, then let the pipeline re-plan.
  await commands.answerQuestion({ shopRef: REF, actor: ACTOR, questionKey: key, answerText: 'Rowntrees Fruit Pastille Lolly' }, h.deps);
  const replan = await runPipeline(HANDLE, h.deps);
  assert.equal(replan.step, STEPS.REPLAN);
  assert.equal(replan.to, 'PROCESSING');

  const plan = await runPipeline(HANDLE, h.deps);
  assert.equal(plan.step, STEPS.PLAN);
  assert.equal(h.db.shop_question.length, 1, 'a second question row was written for the same line');
  assert.equal(h.db.shop_question[0].status, 'answered', 'the settled question was re-opened');
  assert.equal(plan.to, 'READY_TO_SHOP', 'once every question is settled the shop must be ready');
});

test('IDEMPOTENCY: repeated basket requests RESUME one browser request - they never queue a second', async () => {
  const h = makeHarness();
  await receiveText(h);
  await commands.buildShop({ shopRef: REF, actor: ACTOR }, h.deps);
  await drain(h);
  assert.equal(shopStatus(h), 'READY_TO_SHOP');

  await commands.requestBasketBuild({ shopRef: REF, actor: ACTOR }, h.deps);
  await commands.requestBasketBuild({ shopRef: REF, actor: 'cockpit:warwick' }, h.deps);
  const queued = await runPipeline(HANDLE, h.deps);
  assert.equal(queued.step, STEPS.QUEUE_BROWSER_BUILD);
  assert.equal(queued.to, 'WAITING_FOR_BROWSER');
  assert.equal(h.db.browser_build_request.length, 1);

  // A further pass has nothing to do - a supervised human claims the request.
  const parked = await runPipeline(HANDLE, h.deps);
  assert.equal(parked.step, STEPS.AWAIT_RUNNER);
  assert.equal(h.db.browser_build_request.length, 1);
});

test('IDEMPOTENCY: calling runPipeline repeatedly on a parked shop changes nothing at all', async () => {
  const h = makeHarness();
  await receiveText(h);
  const before = JSON.stringify(h.db);
  for (let i = 0; i < 5; i += 1) {
    const r = await runPipeline(HANDLE, h.deps);
    assert.equal(r.stepped, false);
  }
  assert.equal(JSON.stringify(h.db), before, 'a parked shop was mutated by being looked at');
});

test('a milestone card is queued at most ONCE, however many times the milestone is reached', async () => {
  const h = makeHarness();
  await receiveText(h);
  await commands.buildShop({ shopRef: REF, actor: ACTOR }, h.deps);
  await drain(h);
  const planCards = h.db.pending_action.filter((a) => a.action_type === 'msg:plan_ready');
  assert.equal(planCards.length, 1);

  // Re-enter the milestone: answer nothing, force a re-plan, advance again.
  h.db.shop[0].status = 'PROCESSING';
  await runPipeline(HANDLE, h.deps);
  assert.equal(h.db.pending_action.filter((a) => a.action_type === 'msg:plan_ready').length, 1,
    'the same card was queued twice - Warwick would be notified twice for one event');
});

// =====================================================================
// RESUMABILITY - KILLED AT EVERY STAGE
// =====================================================================

test('RESUMABILITY: from EVERY live stage, a fresh process re-derives the next step from Postgres alone', async () => {
  // One shop is walked to each stage; then a BRAND NEW deps object (a new
  // "process") is pointed at the same database and must continue correctly.
  const stages = [
    ['RECEIVED', STEPS.INTERPRET],
    ['TRANSCRIBING', STEPS.INTERPRET],
    ['PROCESSING', STEPS.PLAN],
    ['READY_TO_SHOP', STEPS.AWAIT_BASKET_REQUEST],
    ['WAITING_FOR_BROWSER', STEPS.AWAIT_RUNNER],
    ['SHOPPING', STEPS.AWAIT_BASKET],
    ['BASKET_READY', STEPS.AWAIT_CONFIRMATION],
  ];

  for (const [stage, expected] of stages) {
    const h = makeHarness({ modelLines: MODEL_LINES });
    await receiveText(h);
    await commands.buildShop({ shopRef: REF, actor: ACTOR }, h.deps);
    h.db.shop[0].status = stage;
    if (stage === 'PROCESSING') h.db.shop[0].list_id = null; // no list yet either

    // A NEW deps container over the SAME database - nothing carried in memory.
    const restarted = makeHarness({ modelLines: MODEL_LINES, seed: h.db });
    const r = await runPipeline(HANDLE, restarted.deps);
    assert.equal(r.step, expected, `a restart at ${stage} chose the wrong next step`);
  }
});

test('RESUMABILITY: a process killed mid-interpretation loses nothing and duplicates nothing', async () => {
  const h = makeHarness({ modelLines: MODEL_LINES, modelThrows: 'the gateway went away mid-read' });
  await receivePhoto(h);
  await commands.buildShop({ shopRef: REF, actor: ACTOR }, h.deps);
  await runPipeline(HANDLE, h.deps);                    // -> TRANSCRIBING

  const failed = await runPipeline(HANDLE, h.deps);     // the model dies
  assert.equal(failed.ok, false);
  assert.equal(shopStatus(h), 'FAILED');
  assert.equal(failed.resume_from, 'TRANSCRIBING', 'the resume point must be where it failed FROM');
  assert.equal(h.db.shop_line.length, 0, 'a failed read must not leave a half-written interpretation');
  assert.equal(h.db.shopping_list_items.length, 0);

  // A NEW process, the same database. The shop is parked, visible, resumable.
  const restarted = makeHarness({ modelLines: MODEL_LINES, seed: h.db });
  const parked = await runPipeline(HANDLE, restarted.deps);
  assert.equal(parked.step, STEPS.AWAIT_RETRY);
  assert.equal(parked.to, 'TRANSCRIBING');

  await commands.retryStage({ shopRef: REF, actor: ACTOR }, restarted.deps);
  const resumed = await runPipeline(HANDLE, restarted.deps);
  assert.equal(resumed.step, STEPS.RESUME);
  assert.equal(resumed.to, 'TRANSCRIBING');

  const interpreted = await runPipeline(HANDLE, restarted.deps);
  assert.equal(interpreted.step, STEPS.INTERPRET);
  assert.equal(interpreted.lines, 3, 'the resumed read must produce the whole list, once');
  assert.equal(restarted.db.shop_line.length, 3);
});

test('RESUMABILITY: failing twice does NOT decay the resume target', async () => {
  const h = makeHarness({ modelThrows: 'gateway down' });
  await receivePhoto(h);
  await commands.buildShop({ shopRef: REF, actor: ACTOR }, h.deps);
  await runPipeline(HANDLE, h.deps);                    // -> TRANSCRIBING
  await runPipeline(HANDLE, h.deps);                    // fail 1

  await commands.retryStage({ shopRef: REF, actor: ACTOR }, h.deps);
  await runPipeline(HANDLE, h.deps);                    // resume -> TRANSCRIBING
  await runPipeline(HANDLE, h.deps);                    // fail 2

  const parked = await runPipeline(HANDLE, h.deps);
  assert.equal(parked.step, STEPS.AWAIT_RETRY);
  assert.equal(parked.to, 'TRANSCRIBING', 'the resume target decayed after a second failure');
});

test('A FAILURE IS VISIBLE: the shop says FAILED, keeps its error, and a card is queued', async () => {
  const h = makeHarness({ modelThrows: 'the vision gateway refused the request' });
  await receivePhoto(h);
  await commands.buildShop({ shopRef: REF, actor: ACTOR }, h.deps);
  await runPipeline(HANDLE, h.deps);
  await runPipeline(HANDLE, h.deps);

  assert.equal(h.db.shop[0].status, 'FAILED');
  assert.match(h.db.shop[0].last_error, /vision gateway refused/);
  assert.equal(h.db.shop_event.filter((e) => e.event_type === 'failure').length, 1);
  assert.equal(h.db.pending_action.filter((a) => a.action_type === 'msg:failure').length, 1,
    'a shop that stalls silently is worse than one that fails loudly');
});

test('a human confirmation on an interpreted line SURVIVES a later re-read', async () => {
  const h = makeHarness({ modelLines: MODEL_LINES });
  await receivePhoto(h);
  await commands.buildShop({ shopRef: REF, actor: ACTOR }, h.deps);
  await runPipeline(HANDLE, h.deps);
  await runPipeline(HANDLE, h.deps);

  // Warwick confirms line 3 himself.
  const shopLines = await import('./shopLines.js');
  await shopLines.markCorrected(h.deps, h.db.shop[0].id, 3, 'telegram:555');
  h.db.shop_line.find((l) => l.line_no === 3).raw_reading = 'Fruit Splits (confirmed)';

  // The photo is read again (a retry, a reprocess). The confirmed line must not
  // be overwritten by a fresh guess.
  h.db.shop[0].status = 'TRANSCRIBING';
  const again = await runPipeline(HANDLE, h.deps);
  assert.equal(again.lines_confirmed_and_kept, 1);
  assert.equal(h.db.shop_line.find((l) => l.line_no === 3).raw_reading, 'Fruit Splits (confirmed)',
    'a re-read overwrote a decision the human had already made');
});

// =====================================================================
// ILLEGAL MOVES AND CONCURRENCY
// =====================================================================

test('ILLEGAL TRANSITIONS ARE REFUSED - RECONCILED can never go back to SHOPPING', async () => {
  const h = makeHarness();
  await receiveText(h);
  h.db.shop[0].status = 'RECONCILED';
  await assert.rejects(
    () => h.deps.shopStore.transition(h.db.shop[0].id, 'SHOPPING', 'nope'),
    /terminal/,
  );
  // And the advancer will not even try.
  const r = await runPipeline(HANDLE, h.deps);
  assert.equal(r.step, STEPS.DONE);
  assert.equal(h.db.shop[0].status, 'RECONCILED');
});

test('a terminal shop is untouchable, whatever commands are outstanding', async () => {
  const h = makeHarness();
  await receiveText(h);
  await commands.buildShop({ shopRef: REF, actor: ACTOR }, h.deps);
  await commands.requestBasketBuild({ shopRef: REF, actor: ACTOR }, h.deps);
  h.db.shop[0].status = 'CANCELLED';
  const before = JSON.stringify(h.db.shop[0]);
  const r = await runPipeline(HANDLE, h.deps);
  assert.equal(r.step, STEPS.DONE);
  assert.equal(JSON.stringify(h.db.shop[0]), before);
});

test('CONCURRENCY: two runners racing the same shop - one advances, the other reports a lost race', async () => {
  const h = makeHarness();
  await receiveText(h);
  await commands.buildShop({ shopRef: REF, actor: ACTOR }, h.deps);
  await runPipeline(HANDLE, h.deps);        // -> PROCESSING

  // Both runners take their snapshot at PROCESSING. Runner A lands first.
  const a = await runPipeline(HANDLE, h.deps);
  assert.equal(a.stepped, true);
  assert.equal(a.to, 'READY_TO_SHOP');

  // Runner B is still holding the stale PROCESSING snapshot. Reproduced by
  // asking the store to move PROCESSING -> READY_TO_SHOP again: the guarded
  // UPDATE matches zero rows.
  await assert.rejects(
    () => h.deps.shopStore._internal.inTransaction({}, (client) => h.deps.shopStore._internal.applyTransition(client, {
      shop_id: h.db.shop[0].id, from_status: 'PROCESSING', to_status: 'READY_TO_SHOP',
      set: { status: 'READY_TO_SHOP' },
      event: { event_type: 'transition', from_status: 'PROCESSING', to_status: 'READY_TO_SHOP', description: 'race' },
    })),
    /modified concurrently/,
  );
  assert.equal(h.db.shop[0].status, 'READY_TO_SHOP', 'the loser must not have moved the shop');
});

test('a lost race is reported as a lost race, NOT recorded as a failure of the shop', async () => {
  const h = makeHarness();
  await receiveText(h);
  await commands.buildShop({ shopRef: REF, actor: ACTOR }, h.deps);

  // The other runner advances the shop between our snapshot and our write. The
  // guarded transition then matches zero rows and the whole step rolls back.
  h.deps.executeIntents = async (intents) => {
    h.db.shop[0].status = 'PROCESSING';        // somebody else got there first
    return { listId: 1, results: intents.map(() => ({ item_id: 1 })) };
  };
  h.db.shopping_lists.push({ id: 1, household_id: 1, status: 'next_week_draft', list_date: '2026-08-03' });

  const r = await runPipeline(HANDLE, h.deps);
  assert.equal(r.claimed, false);
  assert.equal(r.stepped, false);
  assert.match(r.reason, /another runner advanced this shop first/);
  assert.notEqual(h.db.shop[0].status, 'FAILED', 'a lost race must never park a perfectly healthy shop');
});

// =====================================================================
// CANCEL, PAUSE, CORRECTIONS
// =====================================================================

test('cancel takes effect from any live stage and is written exactly once', async () => {
  const h = makeHarness();
  await receiveText(h);
  await commands.buildShop({ shopRef: REF, actor: ACTOR }, h.deps);
  await runPipeline(HANDLE, h.deps);
  await commands.cancelShop({ shopRef: REF, actor: ACTOR, reason: 'wrong week' }, h.deps);

  const cancelled = await runPipeline(HANDLE, h.deps);
  assert.equal(cancelled.step, STEPS.CANCEL);
  assert.equal(h.db.shop[0].status, 'CANCELLED');

  const after = await runPipeline(HANDLE, h.deps);
  assert.equal(after.step, STEPS.DONE);
  assert.equal(h.db.shop_event.filter((e) => e.to_status === 'CANCELLED').length, 1);
});

test('pausing releases the browser request and returns the week to READY_TO_SHOP', async () => {
  const h = makeHarness();
  await receiveText(h);
  await commands.buildShop({ shopRef: REF, actor: ACTOR }, h.deps);
  await drain(h);
  await commands.requestBasketBuild({ shopRef: REF, actor: ACTOR }, h.deps);
  await runPipeline(HANDLE, h.deps);
  assert.equal(shopStatus(h), 'WAITING_FOR_BROWSER');

  await commands.pauseBasketBuild({ shopRef: REF, actor: ACTOR }, h.deps);
  const paused = await runPipeline(HANDLE, h.deps);
  assert.equal(paused.step, STEPS.PAUSE_BUILD);
  assert.equal(paused.browser_request_cancelled, true);
  assert.equal(shopStatus(h), 'READY_TO_SHOP', 'a paused build must not lose the week');
  assert.equal(h.db.browser_build_request[0].status, 'cancelled');

  // And it can be asked for again - a fresh live request, not a resurrected one.
  await commands.requestBasketBuild({ shopRef: REF, actor: ACTOR }, h.deps);
  await runPipeline(HANDLE, h.deps);
  assert.equal(h.db.browser_build_request.length, 2);
  assert.equal(shopStatus(h), 'WAITING_FOR_BROWSER');
});

test('a correction is applied once and never duplicates the line it corrects', async () => {
  const h = makeHarness();
  await receiveText(h);
  await commands.buildShop({ shopRef: REF, actor: ACTOR }, h.deps);
  await runPipeline(HANDLE, h.deps);                  // interpret
  const itemCount = h.db.shopping_list_items.length;

  await commands.correctLine({ shopRef: REF, actor: ACTOR, itemName: 'Gourmet cat food', requestedQty: 6 }, h.deps);
  const applied = await runPipeline(HANDLE, h.deps);
  assert.equal(applied.step, STEPS.APPLY_CORRECTIONS);
  assert.equal(h.db.shopping_list_items.length, itemCount, 'the correction added a duplicate line');
  assert.equal(h.db.shopping_list_items.find((i) => i.item_name === 'Gourmet cat food').requested_qty, 6);

  // The command is consumed; a further pass has nothing to correct.
  const next = await runPipeline(HANDLE, h.deps);
  assert.equal(next.step, STEPS.PLAN);
});

// =====================================================================
// THE INTERPRETATION GATE
// =====================================================================

test('a REVIEWED list is not declared ready to shop until a human confirms the interpretation', async () => {
  // A photo list with everything matched: no questions, but needs_review is set.
  const h = makeHarness({
    modelLines: [
      { line_no: 1, raw_reading: '3 gourmet cat food', quantity: 3 },
      { line_no: 2, raw_reading: '1 weetabix protein', quantity: 1 },
    ],
  });
  await receivePhoto(h);
  await commands.buildShop({ shopRef: REF, actor: ACTOR }, h.deps);
  await runPipeline(HANDLE, h.deps);      // -> TRANSCRIBING
  await runPipeline(HANDLE, h.deps);      // -> PROCESSING

  const gated = await runPipeline(HANDLE, h.deps);
  assert.equal(gated.step, STEPS.AWAIT_INTERPRETATION_CONFIRMATION);
  assert.equal(gated.stepped, false);
  assert.equal(shopStatus(h), 'PROCESSING');

  await commands.confirmInterpretation({ shopRef: REF, actor: ACTOR }, h.deps);
  const passed = await runPipeline(HANDLE, h.deps);
  assert.equal(passed.to, 'READY_TO_SHOP');
});

// =====================================================================
// THE PURE HELPERS
// =====================================================================

test('the list date comes from the WEEK REF, never from a clock', () => {
  assert.equal(listDateOf('SHOP-2026-08-03'), '2026-08-03');
  assert.throws(() => listDateOf('SHOP-BAD'), /SHOP-YYYY-MM-DD/);
  assert.throws(() => listDateOf(null), /SHOP-YYYY-MM-DD/);
});

test('an EMPTY catalogue is refused - open-ended transcription is the measured-wrong method', () => {
  assert.throws(() => assertCatalogueLoaded(null, 'interpretation'), /Never interpret a shopping list without/);
  assert.throws(() => assertCatalogueLoaded({ household_id: 1, candidates: [] }, 'interpretation'), /EMPTY catalogue/);
  const ok = makeCatalogue();
  assert.equal(assertCatalogueLoaded(ok, 'interpretation'), ok);
});

test('a matched line takes its name from the catalogue; an unmatched one keeps the raw reading', () => {
  const intents = buildGroundedIntents([
    { matched_regular_id: 11, canonical_name: 'Gourmet cat food', raw_reading: '3 gormay cat fud', quantity: 3, match_basis: 'exact alias', alternatives: [] },
    { matched_regular_id: null, canonical_name: null, raw_reading: 'fruit splits', quantity: null, status: 'unmatched_new_item', alternatives: [] },
  ], { sourceId: 'src', listDate: '2026-08-03', requestedBy: 'test' });

  assert.equal(intents[0].args.item_name, 'Gourmet cat food');
  assert.equal(intents[0].args.status, 'requested');
  assert.equal(intents[1].args.item_name, 'fruit splits');
  assert.equal(intents[1].args.status, 'needs_decision', 'an unresolved line must reach a human');
  assert.equal(intents[1].args.requested_qty, null, 'an unknown quantity is never invented');
  for (const i of intents) assert.equal(i.command, 'add_list_item');
});

test('a line with neither a catalogue match nor a readable reading is refused, not guessed', () => {
  assert.throws(
    () => buildGroundedIntents([{ matched_regular_id: null, canonical_name: null, raw_reading: '   ' }],
      { sourceId: 's', listDate: '2026-08-03', requestedBy: 't' }),
    /neither a catalogue match nor a readable raw_reading/,
  );
});

// ── THE product_alternatives DEFECT ───────────────────────────────────
test('CANDIDATE IDS: only the catalogue resolver may supply a regulars id - the planner supplies names only', () => {
  const planLine = {
    item_name: 'yazoo',
    // planner.rankAlternatives / regularCandidates shape: NO id field exists.
    alternatives: [{ name: 'Yazoo Chocolate 400ml', price: 1.2, reason: 'partial match in regulars', score: 0.9 }],
  };
  const interpreted = {
    raw_reading: 'yazoo',
    // resolveByCatalogue shape, mapped by the pipeline to a NAMED regular_id.
    alternatives: [{ regular_id: 21, name: 'Yazoo Chocolate 400ml' }, { regular_id: 22, name: 'Yazoo Strawberry 400ml' }],
  };

  const candidates = planCandidates(planLine, interpreted);
  const withIds = candidates.filter((c) => c.regular_id !== undefined);
  assert.equal(withIds.length, 2);
  assert.deepEqual(withIds.map((c) => c.regular_id), [21, 22]);
  for (const c of withIds) assert.match(c.source, /asdair\.regulars/);

  // The planner's suggestion is present by NAME and carries no id at all.
  const plannerOnly = planCandidates({ ...planLine, alternatives: [{ name: 'Something Else' }] }, null);
  assert.equal(plannerOnly.length, 1);
  assert.equal(plannerOnly[0].regular_id, undefined,
    'a planner suggestion carries no product id - emitting one would be inventing it');
  assert.match(plannerOnly[0].source, /no product id/);
});

test('CANDIDATE IDS: a product_alternatives row\'s own `id` can never be mistaken for a regulars id', () => {
  // asdair.product_alternatives rows reach the planner as { alternative_name,
  // price } - and even if an `id` rode along, it is that row's OWN primary key.
  const planLine = { item_name: 'milk', alternatives: [{ id: 4021, alternative_name: 'Cravendale 4pt', price: 2.5 }] };
  const candidates = planCandidates(planLine, null);
  assert.equal(candidates.length, 1);
  assert.equal(candidates[0].label, 'Cravendale 4pt');
  assert.equal(candidates[0].regular_id, undefined,
    'a product_alternatives primary key was passed off as a regulars id');
  assert.equal(Object.prototype.hasOwnProperty.call(candidates[0], 'id'), false);
});

test('the candidate list is bounded, so a card can never exceed what a phone can show', () => {
  const many = Array.from({ length: 30 }, (_, i) => ({ name: `alt ${i}` }));
  assert.ok(planCandidates({ alternatives: many }, null).length <= 8);
});
