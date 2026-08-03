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
// THE LIVE INCIDENT (SHOP-2026-08-03), CLOSED
//
// Two independent defects combined to crash the real shop: (1) an id-type
// mismatch in loadCatalogue.js made canonical_name null for every MATCHED
// line - covered by services/asdair/interpret/loadCatalogue.test.js, not
// here, since the bug lived in a module this harness deliberately fakes out.
// (2) buildGroundedIntents had no fallback for a line with neither a
// catalogue match nor anything readable. These tests prove (2) end-to-end,
// and prove the RESUMABILITY contract holds across a retry of the exact
// shape SHOP-2026-08-03's own "Retry" tap takes.
// =====================================================================

test('THE LIVE INCIDENT, CLOSED: a genuinely illegible line reaches NEEDS_DECISION as a real question, never a crash', async () => {
  const h = makeHarness({
    modelLines: [
      { line_no: 1, raw_reading: '3 gourmet cat food', quantity: 3 },
      { line_no: 2, raw_reading: '', quantity: null }, // the vision model could not read this line at all
    ],
  });
  await receivePhoto(h);
  await commands.buildShop({ shopRef: REF, actor: ACTOR }, h.deps);
  await runPipeline(HANDLE, h.deps);                    // -> TRANSCRIBING
  const interpret = await runPipeline(HANDLE, h.deps);  // -> PROCESSING
  assert.equal(interpret.ok, true, 'a genuinely unreadable line must never fail the whole shop');
  assert.equal(interpret.lines, 2);

  const line2 = h.db.shop_line.find((l) => l.line_no === 2);
  assert.equal(line2.status, 'unreadable');
  assert.equal(line2.matched_regular_id, null);

  const item2 = h.db.shopping_list_items.find((i) => i.status === 'needs_decision');
  assert.ok(item2, 'the illegible line must still reach the list, flagged for a human');
  assert.match(item2.item_name, /line 2/i, 'the item name must identify which line, so the question is actionable');

  const plan = await runPipeline(HANDLE, h.deps);       // -> NEEDS_DECISION
  assert.equal(plan.to, 'NEEDS_DECISION');
  assert.equal(h.db.shop_question.length, 1, 'the illegible line must become an actual question, not a silent skip');
});

test('THE LIVE INCIDENT, RESUMED: a shop parked FAILED resumes through TRANSCRIBING and completes even when the retried read is STILL illegible', async () => {
  const h = makeHarness({ modelThrows: 'the gateway went away mid-read' });
  await receivePhoto(h);
  await commands.buildShop({ shopRef: REF, actor: ACTOR }, h.deps);
  await runPipeline(HANDLE, h.deps);                    // -> TRANSCRIBING
  const failed = await runPipeline(HANDLE, h.deps);     // an unrelated, genuine gateway failure
  assert.equal(failed.ok, false);
  assert.equal(shopStatus(h), 'FAILED');
  assert.equal(failed.resume_from, 'TRANSCRIBING');

  // A NEW process (a restart), the SAME durable database - Warwick's "Retry"
  // tap. This time the model genuinely runs again and comes back with a line
  // it STILL cannot read: the fix must hold even so.
  const restarted = makeHarness({
    modelLines: [{ line_no: 1, raw_reading: '', quantity: null }],
    seed: h.db,
  });
  await commands.retryStage({ shopRef: REF, actor: ACTOR }, restarted.deps);
  const resumed = await runPipeline(HANDLE, restarted.deps);
  assert.equal(resumed.step, STEPS.RESUME);
  assert.equal(resumed.to, 'TRANSCRIBING');

  const interpreted = await runPipeline(HANDLE, restarted.deps);
  assert.equal(interpreted.ok, true, 'a retried read of a still-illegible line must never crash the shop a second time');
  assert.equal(interpreted.step, STEPS.INTERPRET);
  assert.equal(restarted.db.shop[0].status, 'PROCESSING');

  const plan = await runPipeline(HANDLE, restarted.deps);
  assert.equal(plan.to, 'NEEDS_DECISION');
  assert.equal(restarted.db.shop_question.length, 1);
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
  // The FIRST look at a freshly-RECEIVED shop queues its receipt card, once -
  // durable, deliberate bookkeeping, not the mutation this test guards
  // against. So the "changes nothing" baseline is taken AFTER that one-time
  // side effect; this test is about every look AFTER the first.
  await runPipeline(HANDLE, h.deps);
  const before = JSON.stringify(h.db);
  for (let i = 0; i < 5; i += 1) {
    const r = await runPipeline(HANDLE, h.deps);
    assert.equal(r.stepped, false);
  }
  assert.equal(JSON.stringify(h.db), before, 'a parked shop was mutated by being looked at');
});

// =====================================================================
// THE RECEIPT CARD - SELF-HEALING (the receipt-card gap, closed)
//
// messageForTransition only ever fires on a TRANSITION's `to`, and RECEIVED is
// a shop's creation status - never the `to` of any transition - so no shop,
// ever, had a receipt queued. The fix lives in runPipeline itself: a durable,
// idempotent, self-healing side effect keyed on "has this shop's receipt EVER
// been queued", checked on every pass a shop is found at RECEIVED.
// =====================================================================

test('THE RECEIPT: a freshly received shop gets exactly one receipt card queued', async () => {
  const h = makeHarness();
  await receiveText(h);
  assert.equal(h.db.pipeline_command.filter((c) => c.kind === 'outbox' && c.command === 'receipt').length, 0,
    'receiveList itself must not queue anything - that is runPipeline\'s job, off the request path');

  const r = await runPipeline(HANDLE, h.deps);
  assert.equal(r.step, STEPS.AWAIT_BUILD_COMMAND, 'the receipt is bookkeeping alongside the step, not a step of its own');

  const cards = h.db.pipeline_command.filter((c) => c.kind === 'outbox' && c.command === 'receipt');
  assert.equal(cards.length, 1);
  assert.equal(cards[0].args.shopRef, REF);
  assert.equal(h.db.pending_action.length, 0, 'a queued card is machine bookkeeping, never a household to-do');
});

test('THE RECEIPT: a redelivered message resumes the same shop and never queues a second receipt', async () => {
  const h = makeHarness();
  await receiveText(h);
  await runPipeline(HANDLE, h.deps);   // queues the one receipt

  // The SAME Telegram message, redelivered - createOrResumeShop resumes rather
  // than creating a second shop, exactly as receiveList's own contract promises.
  await receiveText(h);
  await runPipeline(HANDLE, h.deps);
  await runPipeline(HANDLE, h.deps);

  assert.equal(h.db.shop.length, 1, 'a redelivery must not create a second shop');
  assert.equal(h.db.pipeline_command.filter((c) => c.kind === 'outbox' && c.command === 'receipt').length, 1,
    'Warwick would be sent the same receipt twice for one message');
});

test('THE RECEIPT: a shop already durably stuck at RECEIVED before this fix existed is recovered on the very next pass', async () => {
  const h = makeHarness();
  await receiveText(h);
  // The pre-fix world: the shop is sitting at RECEIVED with NO outbox row ever
  // queued for it - exactly SHOP-2026-08-03's real, live state.
  assert.equal(h.db.pipeline_command.filter((c) => c.kind === 'outbox').length, 0);

  // A brand-new process (a restart), pointed at the SAME durable database -
  // nothing carried in memory, exactly as a real deploy+restart would be.
  const restarted = makeHarness({ seed: h.db });
  await runPipeline(HANDLE, restarted.deps);

  const cards = restarted.db.pipeline_command.filter((c) => c.kind === 'outbox' && c.command === 'receipt');
  assert.equal(cards.length, 1, 'a shop that predates this fix was never recovered');
});

test('THE RECEIPT: the outbox key is unique per shop, so two runners racing the SAME check cannot double-send', async () => {
  const h = makeHarness();
  await receiveText(h);

  // Two "concurrent" runners racing the same shop, both reading "not queued
  // yet" before either has written - the exact window a crash-and-retry opens.
  await Promise.all([runPipeline(HANDLE, h.deps), runPipeline(HANDLE, h.deps)]);

  const cards = h.db.pipeline_command.filter((c) => c.kind === 'outbox' && c.command === 'receipt');
  assert.equal(cards.length, 1, 'a race between two runners queued the receipt twice');
});

// =====================================================================
// THE "READING YOUR LIST" PROGRESS CARD - SELF-HEALING
//
// Before this fix, nothing broke the silence between "Build this shop" and
// either a real milestone or a crash. The fix mirrors the receipt card's
// self-healing shape exactly: durable, idempotent (queued AT MOST ONCE ever
// per shop, never re-sent even across a failed-and-retried read), and
// self-healing for a shop already sitting at TRANSCRIBING.
// =====================================================================

test('THE PROGRESS CARD: a photo shop gets exactly one "reading your list" card queued once it is sitting at TRANSCRIBING', async () => {
  const h = makeHarness({ modelLines: MODEL_LINES });
  await receivePhoto(h);
  await commands.buildShop({ shopRef: REF, actor: ACTOR }, h.deps);

  assert.equal(h.db.pipeline_command.filter((c) => c.kind === 'outbox' && c.command === 'progress').length, 0,
    'nothing must be queued before the shop actually reaches TRANSCRIBING');

  const transcribe = await runPipeline(HANDLE, h.deps);
  assert.equal(transcribe.to, 'TRANSCRIBING');
  assert.equal(h.db.pipeline_command.filter((c) => c.kind === 'outbox' && c.command === 'progress').length, 0,
    'the card is checked at snapshot-read time, on the pass that FINDS the shop at TRANSCRIBING - not the one that lands it there');

  // The next pass reads a snapshot showing TRANSCRIBING, so the self-healing
  // check now fires (and then goes on to interpret, in the same call).
  const interpret = await runPipeline(HANDLE, h.deps);
  assert.equal(interpret.step, STEPS.INTERPRET);

  const cards = h.db.pipeline_command.filter((c) => c.kind === 'outbox' && c.command === 'progress');
  assert.equal(cards.length, 1);
  assert.equal(cards[0].args.shopRef, REF);
});

test('THE PROGRESS CARD: a TEXT shop never gets one - it never visits TRANSCRIBING, so there is no model-call silence to fill', async () => {
  const h = makeHarness();
  await receiveText(h);
  await commands.buildShop({ shopRef: REF, actor: ACTOR }, h.deps);
  await drain(h);
  assert.equal(h.db.pipeline_command.filter((c) => c.kind === 'outbox' && c.command === 'progress').length, 0);
});

test('THE PROGRESS CARD: re-entering TRANSCRIBING (a failed-and-retried read) never queues a second card', async () => {
  const h = makeHarness({ modelLines: MODEL_LINES });
  await receivePhoto(h);
  await commands.buildShop({ shopRef: REF, actor: ACTOR }, h.deps);
  await runPipeline(HANDLE, h.deps);   // -> TRANSCRIBING
  await runPipeline(HANDLE, h.deps);   // sitting at TRANSCRIBING: queues the one card, then interprets
  assert.equal(h.db.pipeline_command.filter((c) => c.kind === 'outbox' && c.command === 'progress').length, 1);

  // Simulate a crash-and-retry that puts the shop back at TRANSCRIBING -
  // exactly the shape SHOP-2026-08-03's own retry took.
  h.db.shop[0].status = 'TRANSCRIBING';
  await runPipeline(HANDLE, h.deps);   // -> PROCESSING (interpreted again)

  assert.equal(h.db.pipeline_command.filter((c) => c.kind === 'outbox' && c.command === 'progress').length, 1,
    'Warwick would be told "reading your list" twice for one shop');
});

test('THE PROGRESS CARD: a shop already sitting at TRANSCRIBING before this fix existed is recovered on the very next pass', async () => {
  const h = makeHarness({ modelLines: MODEL_LINES });
  await receivePhoto(h);
  await commands.buildShop({ shopRef: REF, actor: ACTOR }, h.deps);
  await runPipeline(HANDLE, h.deps);   // -> TRANSCRIBING

  // Model the pre-fix world exactly: the shop is sitting at TRANSCRIBING with
  // NO progress card ever queued for it.
  h.db.pipeline_command = h.db.pipeline_command.filter((c) => !(c.kind === 'outbox' && c.command === 'progress'));
  assert.equal(h.db.pipeline_command.filter((c) => c.kind === 'outbox' && c.command === 'progress').length, 0);

  // A brand-new process, pointed at the SAME durable database.
  const restarted = makeHarness({ modelLines: MODEL_LINES, seed: h.db });
  await runPipeline(HANDLE, restarted.deps);

  const cards = restarted.db.pipeline_command.filter((c) => c.kind === 'outbox' && c.command === 'progress');
  assert.equal(cards.length, 1, 'a shop that predates this fix was never recovered');
});

test('THE PROGRESS CARD: the outbox key is unique per shop, so two runners racing the SAME check cannot double-send', async () => {
  const h = makeHarness({ modelLines: MODEL_LINES });
  await receivePhoto(h);
  await commands.buildShop({ shopRef: REF, actor: ACTOR }, h.deps);
  await runPipeline(HANDLE, h.deps);   // -> TRANSCRIBING (queues the receipt; not this card's race window yet)

  // Two "concurrent" runners racing the same shop at TRANSCRIBING, both
  // reading "not queued yet" before either has written - the exact window a
  // crash-and-retry opens.
  await Promise.all([runPipeline(HANDLE, h.deps), runPipeline(HANDLE, h.deps)]);

  const cards = h.db.pipeline_command.filter((c) => c.kind === 'outbox' && c.command === 'progress');
  assert.equal(cards.length, 1, 'a race between two runners queued the progress card twice');
});

test('a milestone card is queued at most ONCE, however many times the milestone is reached', async () => {
  const h = makeHarness();
  await receiveText(h);
  await commands.buildShop({ shopRef: REF, actor: ACTOR }, h.deps);
  await drain(h);
  const planCards = h.db.pipeline_command.filter((c) => c.kind === 'outbox' && c.command === 'plan_ready');
  assert.equal(planCards.length, 1);
  assert.equal(h.db.pending_action.length, 0,
    'a queued card is machine bookkeeping - it must never reach the household outstanding-actions list');

  // Re-enter the milestone: answer nothing, force a re-plan, advance again.
  h.db.shop[0].status = 'PROCESSING';
  await runPipeline(HANDLE, h.deps);
  assert.equal(h.db.pipeline_command.filter((c) => c.kind === 'outbox' && c.command === 'plan_ready').length, 1,
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
  assert.equal(h.db.pipeline_command.filter((c) => c.kind === 'outbox' && c.command === 'failure').length, 1,
    'a shop that stalls silently is worse than one that fails loudly');
  assert.equal(h.db.pending_action.length, 0,
    'a failure card is the pipeline telling Warwick something, not a chore it is giving him');
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

test('a line with neither a catalogue match nor a readable reading is refused to a human, never thrown and never guessed', () => {
  const intents = buildGroundedIntents(
    [{ matched_regular_id: null, canonical_name: null, raw_reading: '   ', status: 'unreadable', alternatives: [] }],
    { sourceId: 's', listDate: '2026-08-03', requestedBy: 't' },
  );
  assert.equal(intents.length, 1, 'the line must never be silently dropped');
  assert.equal(intents[0].command, 'add_list_item');
  assert.equal(intents[0].args.status, 'needs_decision',
    'never dropped, never guessed at - flagged for a human like any other unresolved line');
  assert.equal(intents[0].args.requested_qty, null, 'an unknown quantity is never invented');
  const name = intents[0].args.item_name;
  assert.ok(typeof name === 'string' && name.trim().length > 0, 'add_list_item requires a real, non-empty item_name');
  assert.match(name, /1/, 'the line number must be identifiable so Warwick can act on the question');
  assert.doesNotMatch(name, /gourmet|weetabix|arla|cat food/i,
    'never invent a plausible-sounding product name for text nobody could read');
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
