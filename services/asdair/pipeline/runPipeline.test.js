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
import { createRequire } from 'node:module';

import { makeHarness, makeCatalogue, HOUSEHOLD_ID, makeIntake, textUpdate } from './test/harness.js';
import * as commands from './commands.js';
import {
  runPipeline, listDateOf, buildGroundedIntents, planCandidates, assertCatalogueLoaded,
  trailingPackSize, withoutTrailingPackSizes, excludeForeignListItems,
} from './runPipeline.js';
import { _internal as shopLinesSql } from './shopLines.js';
import { runOnce, loadOpenQuestions, loadDeferredClarifications } from './runtime.js';
import { listQuestions, listOutbox, resolveCommand } from './store.js';
import { STEPS, planOutcome } from './stages.js';
import { questionKeyFor } from './keys.js';

// The REAL planner, for the one test that wraps deps.planBasket to observe what
// stepPlan handed it. It still runs the genuine planner - the wrapper watches
// the seam, it does not replace the behaviour behind it.
const { planBasket: realPlanBasket } = createRequire(import.meta.url)('../skill/planner.js');

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
// GATE ZERO (WP-B15-22) - THE END-TO-END PROOF, THROUGH THE REAL PRODUCTION
// PATH: deps.interpretPhoto -> resolveAll -> shopLines.upsertLines ->
// asdair.shop_line.match_confidence. This is what SHOP-2026-08-10-M64 needed
// and did not have: the model's own per-line confidence, threaded through and
// enforced, rather than dropped between the model reply and the durable row.
// =====================================================================

test('GATE ZERO END TO END: match_confidence is durably populated by a fresh interpret run', async () => {
  const h = makeHarness({
    modelLines: [
      { line_no: 1, raw_reading: '3 gourmet cat food', quantity: 3, confidence: 0.92 },
      { line_no: 2, raw_reading: '1 weetabix protein', quantity: 1, confidence: 0.55 },
      { line_no: 3, raw_reading: 'fruit splits', quantity: null, confidence: 0.4 },
    ],
  });
  await receivePhoto(h);
  await commands.buildShop({ shopRef: REF, actor: ACTOR }, h.deps);
  await runPipeline(HANDLE, h.deps);   // transcribe
  await runPipeline(HANDLE, h.deps);   // interpret

  const line1 = h.db.shop_line.find((l) => l.line_no === 1);
  const line2 = h.db.shop_line.find((l) => l.line_no === 2);
  assert.equal(line1.match_confidence, 0.92,
    'the model\'s own confidence never reached the durable row before WP-B15-22 - this is the fix');
  assert.equal(line2.match_confidence, 0.55);
  assert.ok(line1.match_confidence !== null, 'match_confidence must be a real number, not null, when the model supplied one');
});

test('GATE ZERO END TO END: a confident catalogue match on a line the MODEL was unsure about is forced to needs_confirmation - this is the exact SHOP-2026-08-10-M64 shape', async () => {
  // Line 1 is EXACTLY the shape that resolves cleanly by catalogue alone
  // (it is regular 11's own exact alias, per MODEL_LINES elsewhere in this
  // file) - the ONLY thing making it dangerous here is the model's own low
  // confidence about what it read. Before this gate, a confident catalogue
  // match would have won outright and this would have silently reached
  // Warwick's basket - which is what actually happened on 2026-08-10.
  const h = makeHarness({
    modelLines: [
      { line_no: 1, raw_reading: '3 gourmet cat food', quantity: 3, confidence: 0.3 },
    ],
  });
  await receivePhoto(h);
  await commands.buildShop({ shopRef: REF, actor: ACTOR }, h.deps);
  await runPipeline(HANDLE, h.deps);   // transcribe
  const interpret = await runPipeline(HANDLE, h.deps);   // interpret
  assert.equal(interpret.ok, true);

  const line1 = h.db.shop_line.find((l) => l.line_no === 1);
  assert.equal(line1.match_confidence, 0.3);
  assert.equal(line1.status, 'needs_confirmation',
    'a strong catalogue match must never override the model\'s own low confidence about the reading - '
    + 'a confident catalogue match on a line the model was unsure about is what caused the real incident');
  assert.equal(line1.matched_regular_id, null,
    'a held line must not carry a matched identity either - "needs_confirmation" must mean genuinely unresolved');

  // The shop must still make real, visible progress - a question, not a crash
  // and not a silent basket item.
  const plan = await runPipeline(HANDLE, h.deps);
  assert.equal(plan.to, 'NEEDS_DECISION', 'a gated line must reach a human decision, never a silent basket item');
});

test('GATE ZERO END TO END: the model\'s own "unreadable" status survives to the durable row, even where the catalogue offered a match', async () => {
  const h = makeHarness({
    modelLines: [
      { line_no: 1, raw_reading: '3 gourmet cat food', quantity: 3, status: 'unreadable', confidence: 0.1 },
    ],
  });
  await receivePhoto(h);
  await commands.buildShop({ shopRef: REF, actor: ACTOR }, h.deps);
  await runPipeline(HANDLE, h.deps);
  await runPipeline(HANDLE, h.deps);

  const line1 = h.db.shop_line.find((l) => l.line_no === 1);
  assert.equal(line1.status, 'unreadable', 'the model\'s own "unreadable" verdict must reach the durable row unchanged');
  assert.equal(line1.matched_regular_id, null);
});

test('GATE ZERO END TO END: asdair.shop.transcript_provider/transcript_model/transcript_confidence are populated after a photo interpretation', async () => {
  // Before WP-B15-22, buildShopCreate COULD set these three columns, but only
  // at shop creation - stepInterpret runs long after a shop exists and had no
  // writer for them at all, so every photo shop's transcript columns stayed
  // empty (Deliverables/2026-08-11-GATE-ZERO-source-truth-established.md §1).
  const h = makeHarness({
    visionModel: 'test-vision-model-x',
    modelLines: [
      { line_no: 1, raw_reading: '3 gourmet cat food', quantity: 3, confidence: 0.92 },
      { line_no: 2, raw_reading: '1 weetabix protein', quantity: 1, confidence: 0.55 },
      { line_no: 3, raw_reading: 'fruit splits', quantity: null, confidence: 0.4 },
    ],
  });
  await receivePhoto(h);
  await commands.buildShop({ shopRef: REF, actor: ACTOR }, h.deps);
  await runPipeline(HANDLE, h.deps);   // transcribe
  await runPipeline(HANDLE, h.deps);   // interpret -> PROCESSING

  const shop = h.db.shop.find((s) => s.shop_ref === REF);
  assert.equal(shop.transcript_provider, 'fusion-gateway');
  assert.equal(shop.transcript_model, 'test-vision-model-x',
    'the model id must be RESOLVED at call time (deps.visionModel), never a literal frozen in this test or the code');
  // MINIMUM across lines, not the average - a single badly-read line is
  // exactly what caused SHOP-2026-08-10-M64, and a mean would hide it.
  assert.equal(shop.transcript_confidence, 0.4);
});

test('GATE ZERO END TO END: a TEXT shop never acquires transcript provenance - it was never read by a vision model', async () => {
  const h = makeHarness();
  await receiveText(h);
  await commands.buildShop({ shopRef: REF, actor: ACTOR }, h.deps);
  await runPipeline(HANDLE, h.deps);   // interpret -> PROCESSING for a text shop

  const shop = h.db.shop.find((s) => s.shop_ref === REF);
  assert.equal(shop.transcript_provider, null,
    'a typed list was never read by a vision model - inventing provenance for it would be dishonest');
  assert.equal(shop.transcript_model, null);
  assert.equal(shop.transcript_confidence, null);
});

test('GATE ZERO §4: the plan_ready advisory log flags an IMPLAUSIBLY LOW line count on a photo shop', async () => {
  // No priced comparator is cheaply available at plan_ready (SOP-021's own
  // GBP 120-150 band is "structurally inoperative" - no price column exists;
  // Larry narrowed this to line-count-only, logged, never a new pricing call).
  // A weekly photo shop returning ONE usable line is implausible on its face -
  // exactly the shape of a near-total interpretation failure.
  const logs = [];
  const h = makeHarness({
    modelLines: [{ line_no: 1, raw_reading: 'fruit splits', quantity: null, confidence: 0.9 }],
  });
  h.deps.log = (event, detail) => logs.push({ event, detail });
  await receivePhoto(h);
  await commands.buildShop({ shopRef: REF, actor: ACTOR }, h.deps);
  await runPipeline(HANDLE, h.deps);   // transcribe
  await runPipeline(HANDLE, h.deps);   // interpret
  await runPipeline(HANDLE, h.deps);   // plan -> NEEDS_DECISION

  const advisory = logs.find((l) => l.event === 'plan_ready_line_count_advisory');
  assert.ok(advisory, 'the advisory log never fired at plan_ready');
  assert.equal(advisory.detail.total_requested, 1);
  assert.equal(advisory.detail.implausibly_low, true,
    'a single-line photo interpretation must be flagged, not silently accepted as a normal week');
  assert.equal(advisory.detail.shop_ref, REF);

  // ADVISORY MEANS ADVISORY: the shop still makes real progress and the real
  // plan_ready message still queues, unaltered - nothing here ever blocks.
  assert.equal(h.db.shop.find((s) => s.shop_ref === REF).status, 'NEEDS_DECISION');
  assert.equal(h.db.pipeline_command.filter((c) => c.kind === 'outbox' && c.command === 'plan_ready').length, 1,
    'the plan_ready message must still be queued - advisory logging must never withhold it');
});

test('GATE ZERO §4: the plan_ready advisory log does NOT flag an ordinary multi-line interpretation', async () => {
  const logs = [];
  const h = makeHarness({ modelLines: MODEL_LINES });
  h.deps.log = (event, detail) => logs.push({ event, detail });
  await receivePhoto(h);
  await commands.buildShop({ shopRef: REF, actor: ACTOR }, h.deps);
  await runPipeline(HANDLE, h.deps);   // transcribe
  await runPipeline(HANDLE, h.deps);   // interpret
  await runPipeline(HANDLE, h.deps);   // plan

  const advisory = logs.find((l) => l.event === 'plan_ready_line_count_advisory');
  assert.ok(advisory, 'the advisory log never fired at plan_ready');
  assert.equal(advisory.detail.total_requested, 3);
  assert.equal(advisory.detail.implausibly_low, false, 'an ordinary 3-line week must never be flagged');
});

test('GATE ZERO §4: a TEXT shop never fires the advisory log - it was never read by a vision model', async () => {
  const logs = [];
  const h = makeHarness();
  h.deps.log = (event, detail) => logs.push({ event, detail });
  await receiveText(h);
  await commands.buildShop({ shopRef: REF, actor: ACTOR }, h.deps);
  await runPipeline(HANDLE, h.deps);   // interpret -> PROCESSING
  await runPipeline(HANDLE, h.deps);   // plan

  const advisory = logs.find((l) => l.event === 'plan_ready_line_count_advisory');
  assert.equal(advisory, undefined, 'the line-count sanity signal exists to catch vision misreads, not typed lists');
});

// =====================================================================
// THE PHOTO READ CONFIRMATION CARD (WP-B15-22, Warwick's explicit new
// requirement). Note: this only proves the card is CONSTRUCTED and QUEUED
// (the outbox row this Work Order owns). Rendering it into Telegram text
// needs a `photo_read` case in services/asdair/bot/renderMessages.js's
// MESSAGES table - outside this Work Order's file_surface. Reported, not
// built here; see the final evidence pack.
// =====================================================================

test('PHOTO READ CARD: constructed and queued with real counts after a real interpretation, never on file-receipt alone', async () => {
  const h = makeHarness({
    modelLines: [
      { line_no: 1, raw_reading: '3 gourmet cat food', quantity: 3, confidence: 0.95 },
      { line_no: 2, raw_reading: '1 weetabix protein', quantity: 1, confidence: 0.55 }, // gated -> needs_confirmation
      { line_no: 3, raw_reading: 'fruit splits', quantity: null, confidence: 0.9 },     // unmatched -> not 'matched'
    ],
  });
  await receivePhoto(h);
  // FILE RECEIPT ALONE - no interpretation has happened yet. The card must
  // not exist at this point; it exists to confirm what was READ, and
  // nothing has been read yet.
  assert.equal(
    h.db.pipeline_command.filter((c) => c.kind === 'outbox' && c.command === 'photo_read').length, 0,
    'the card must never be queued merely because the photo file was received',
  );

  await commands.buildShop({ shopRef: REF, actor: ACTOR }, h.deps);
  await runPipeline(HANDLE, h.deps);   // transcribe - still no interpretation
  assert.equal(
    h.db.pipeline_command.filter((c) => c.kind === 'outbox' && c.command === 'photo_read').length, 0,
    'the card must never be queued before the model has actually answered',
  );

  await runPipeline(HANDLE, h.deps);   // interpret -> PROCESSING - NOW it exists
  const queued = h.db.pipeline_command.filter((c) => c.kind === 'outbox' && c.command === 'photo_read');
  assert.equal(queued.length, 1, 'exactly one card must be queued once real interpretation completes');

  const payload = typeof queued[0].args === 'string' ? JSON.parse(queued[0].args) : queued[0].args;
  assert.equal(payload.shopRef, REF);
  assert.equal(payload.productsRead, 3, 'three distinct lines were interpreted');
  assert.equal(payload.itemsKnown, 4, '3 (gourmet) + 1 (weetabix); fruit splits carries no known quantity');
  assert.equal(payload.needsClarification, 2,
    'the gated weetabix line (confidence 0.55) and the unmatched fruit splits line both need clarification');
  assert.equal(payload.implausiblyLow, false);
});

test('PHOTO READ CARD: the implausiblyLow flag is visible on the card itself, not only in the advisory log', async () => {
  const h = makeHarness({
    modelLines: [{ line_no: 1, raw_reading: 'fruit splits', quantity: null, confidence: 0.9 }],
  });
  await receivePhoto(h);
  await commands.buildShop({ shopRef: REF, actor: ACTOR }, h.deps);
  await runPipeline(HANDLE, h.deps);
  await runPipeline(HANDLE, h.deps);

  const queued = h.db.pipeline_command.find((c) => c.kind === 'outbox' && c.command === 'photo_read');
  assert.ok(queued, 'the card was never queued');
  const payload = typeof queued.args === 'string' ? JSON.parse(queued.args) : queued.args;
  assert.equal(payload.productsRead, 1);
  assert.equal(payload.implausiblyLow, true,
    'a near-total interpretation failure must be visible on the durable message record, not silently swallowed');
});

test('PHOTO READ CARD: never fired for a TEXT shop - it was never read by a vision model', async () => {
  const h = makeHarness();
  await receiveText(h);
  await commands.buildShop({ shopRef: REF, actor: ACTOR }, h.deps);
  await runPipeline(HANDLE, h.deps);   // interpret -> PROCESSING for a text shop

  assert.equal(
    h.db.pipeline_command.filter((c) => c.kind === 'outbox' && c.command === 'photo_read').length, 0,
    'a typed list was never "read" in the sense this card confirms',
  );
});

test('PHOTO READ CARD: never re-fired by the re-plan-to-PROCESSING transition after every question is answered', async () => {
  // The re-plan step also transitions a shop TO 'PROCESSING' (once every
  // question is answered) - this card must fire ONLY from stepInterpret's
  // own transition, discriminated by `result.interpreted`, which the re-plan
  // step's return does not carry. Proven via the held-line/answer/replan
  // route used elsewhere in this file.
  const h = makeHarness({
    modelLines: [
      { line_no: 1, raw_reading: '3 gourmet cat food', quantity: 3, confidence: 0.95 },
      { line_no: 2, raw_reading: 'qqzz unreadable scrawl', quantity: null, confidence: 0.9 },
    ],
  });
  await receivePhoto(h);
  await commands.buildShop({ shopRef: REF, actor: ACTOR }, h.deps);
  await runPipeline(HANDLE, h.deps);   // transcribe
  await runPipeline(HANDLE, h.deps);   // interpret -> PROCESSING (the card fires once, here)
  await runPipeline(HANDLE, h.deps);   // plan -> NEEDS_DECISION

  const afterFirstInterpret = h.db.pipeline_command.filter((c) => c.kind === 'outbox' && c.command === 'photo_read').length;
  assert.equal(afterFirstInterpret, 1);

  const q = h.db.shop_question.find((row) => row.status === 'open');
  assert.ok(q, 'the fixture never opened a real question');
  await commands.answerQuestion({
    shopRef: REF, actor: ACTOR, questionKey: q.question_key, skip: true,
  }, h.deps);
  for (let i = 0; i < 4; i += 1) await runPipeline(HANDLE, h.deps);   // re-plan -> PROCESSING -> ...

  assert.equal(
    h.db.pipeline_command.filter((c) => c.kind === 'outbox' && c.command === 'photo_read').length,
    afterFirstInterpret,
    'the re-plan-to-PROCESSING transition (every question answered) must never re-queue this card - '
    + 'nothing was newly "read"',
  );
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
  const round1 = h.db.shop_question.filter((q) => Number(q.question_round) === 1);
  assert.equal(round1.length, 1, 'a second ROUND-1 question row was written for the same line');
  assert.equal(round1[0].status, 'answered', 'the settled question was re-opened');

  // ── CORRECTED 2026-08-09 (WP-B15-2). THE OLD ASSERTION HERE WAS THE DEFECT.
  // It read:
  //   assert.equal(plan.to, 'READY_TO_SHOP',
  //     'once every question is settled the shop must be ready');
  //
  // "Every question is settled" was never the same claim as "every line is
  // decided", and treating them as one is exactly what let a shop go to the
  // basket with a line still needing a human. This answer is FREE TEXT, and
  // this harness wires no interpreter, so nothing structured was derived from
  // it - the line is genuinely still undecided and the shop must NOT be ready.
  //
  // Everything this test was BUILT to prove is untouched and still asserted
  // above: no second question row, and the settled question is not re-opened.
  // What changed is the outcome that follows from them.
  assert.notEqual(plan.to, 'READY_TO_SHOP', 'an answer nothing could interpret must NOT make the shop ready');
  assert.equal(plan.lines_unresolved.length, 1, 'the undecided line must be reported, not silently passed');

  // ── AMENDED AGAIN 2026-08-09 for Codex F2. ────────────────────────────────
  // This block used to assert the shop PARKED at wait:line_resolution and
  // stayed there:
  //   assert.equal(plan.to, null, ...);
  //   assert.equal(plan.step, STEPS.AWAIT_LINE_RESOLUTION, ...);
  //   assert.equal(again.step, STEPS.AWAIT_LINE_RESOLUTION);
  //
  // Correct against the gate, and it was still a dead end: Warwick got a card
  // saying the shop was stuck and no question he could answer. F2 routes an
  // unreadable answer to a real round-2 question instead, so the shop now
  // waits on a HUMAN rather than on nothing.
  //
  // The property this test exists for is unchanged and asserted above - the
  // settled ROUND-1 question is never re-opened or duplicated.
  assert.equal(plan.to, 'NEEDS_DECISION', 'the shop must wait on a human it can actually reach');
  const round2 = h.db.shop_question.filter((q) => Number(q.question_round) === 2);
  assert.equal(round2.length, 1, 'exactly one clarification round must be opened');
  assert.equal(round2[0].status, 'open');

  // AND IT IS NOT A LIVELOCK. Further passes neither re-ask nor pile up rounds.
  await runPipeline(HANDLE, h.deps);
  await runPipeline(HANDLE, h.deps);
  assert.equal(h.db.shop_question.length, 2, 'repeated passes must not queue another round each time');
  assert.equal(h.db.shop_question.filter((q) => q.status === 'answered').length, 1,
    'the settled question must stay settled');
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

// =====================================================================
// WP-B15-14 - THE SUPERVISED STEP'S RETURN LEG
//
// Before this, BOTH supervised transitions had exactly one writer in the whole
// estate - browser-runner/runner.js:504 and :570 - and that arm is off the live
// route and refuses a supervised handoff by design. So Warwick tapped "Build
// ASDA basket" and his shop stopped at WAITING_FOR_BROWSER for ever. It had
// never been noticed because no shop had ever got that far.
//
// Nothing here claims a trolley, opens a browser or talks to ASDA. Asdair
// remains the sole writer against the live ASDA session. These tests drive the
// DURABLE ROWS a supervised operator's own claim/complete writes leave behind,
// which is the only thing the pipeline ever sees of that work.
// =====================================================================

/** Drive the shop to WAITING_FOR_BROWSER with a real durable request. */
async function toWaitingForBrowser(h) {
  await receiveText(h);
  await commands.buildShop({ shopRef: REF, actor: ACTOR }, h.deps);
  await drain(h);
  assert.equal(shopStatus(h), 'READY_TO_SHOP');
  await commands.requestBasketBuild({ shopRef: REF, actor: ACTOR }, h.deps);
  const queued = await runPipeline(HANDLE, h.deps);
  assert.equal(queued.to, 'WAITING_FOR_BROWSER');
  assert.equal(h.db.browser_build_request.length, 1);
  return h.db.browser_build_request[0];
}

/**
 * The operator's report, built from the handoff THE PRODUCT ITSELF wrote onto
 * the durable request. Nothing in it is invented by the test: the seqs and the
 * quantities are the packet's own.
 */
function supervisedReport(h, statusFor = () => 'added') {
  const { handoff } = h.db.browser_build_request[0].progress;
  return {
    packet_fingerprint: handoff.packet_fingerprint,
    shop_ref: handoff.shop_ref,
    lines: handoff.lines.map((l) => {
      const status = statusFor(l);
      const entry = { seq: l.seq, status };
      // `added` and `out_of_stock` must carry a real quantity - what went in, or
      // what was sought. completion.js refuses to default it and so does this.
      if (status === 'added' || status === 'out_of_stock') entry.quantity = l.required_quantity;
      return entry;
    }),
  };
}

/** What claim.js claimHandoff leaves behind when a human picks the work up. */
function operatorPicksUp(h) {
  Object.assign(h.db.browser_build_request[0], { status: 'claimed', claimed_by: 'supervised:warwick' });
}

/** What claim.js completeHandoff leaves behind when the operator reports back. */
function operatorReports(h, report) {
  const row = h.db.browser_build_request[0];
  Object.assign(row, {
    status: 'complete', claimed_by: null, finished_at: '2026-08-03T12:00:00.000Z',
    progress: { ...row.progress, report },
  });
}

const failureEvents = (h) => h.db.shop_event.filter((e) => e.event_type === 'failure');

test('WP-B15-14: a completed SUPERVISED build carries the shop through to BASKET_READY', async () => {
  const h = makeHarness();
  await toWaitingForBrowser(h);

  // THE DEAD END, as it was: nobody has picked the work up, so the shop waits.
  assert.equal((await runPipeline(HANDLE, h.deps)).step, STEPS.AWAIT_RUNNER);
  assert.equal(shopStatus(h), 'WAITING_FOR_BROWSER');

  // A supervised operator claims it. The shop must now say it is being shopped.
  operatorPicksUp(h);
  const started = await runPipeline(HANDLE, h.deps);
  assert.equal(started.step, STEPS.RECORD_BUILD_STARTED);
  assert.equal(started.to, 'SHOPPING');
  assert.equal(shopStatus(h), 'SHOPPING');

  // The operator finishes and reports the basket, line by line.
  operatorReports(h, supervisedReport(h));

  // A BRAND NEW deps container over the SAME database - nothing carried in
  // memory. This is the property that makes the leg real rather than a
  // side effect of one process staying alive.
  const restarted = makeHarness({ seed: h.db });
  const ready = await runPipeline(HANDLE, restarted.deps);
  assert.equal(ready.step, STEPS.RECORD_BASKET_READY);
  assert.equal(ready.to, 'BASKET_READY');
  assert.equal(restarted.db.shop[0].status, 'BASKET_READY',
    'this is the whole work package: a completed supervised build reaches the basket Warwick can check');

  // AC5. THE CHECKOUT BOUNDARY HAS NOT MOVED BY A MILLIMETRE.
  const after = await runPipeline(HANDLE, restarted.deps);
  assert.equal(after.step, STEPS.AWAIT_CONFIRMATION);
  assert.equal(restarted.db.order_confirmation.length, 0, 'nothing may be ordered, paid for or checked out here');
  assert.equal(failureEvents(restarted).length, 0);
});

test('WP-B15-14/AC2: a completion reporting an EMPTY trolley never reaches BASKET_READY', async () => {
  const h = makeHarness();
  await toWaitingForBrowser(h);
  operatorPicksUp(h);
  await runPipeline(HANDLE, h.deps);
  assert.equal(shopStatus(h), 'SHOPPING');

  // Every line reported as not found: the plan intended products and NOTHING
  // went in. Zero products is not a small basket - it is the absence of the
  // thing being claimed. Same rule WP-B15-12 installed in the CDP arm.
  operatorReports(h, supervisedReport(h, () => 'not_found'));

  const refused = await runPipeline(HANDLE, h.deps);
  assert.equal(refused.ok, false, 'the refusal must be LOUD, not a quiet park');
  assert.notEqual(shopStatus(h), 'BASKET_READY',
    'a basket that was not built is NEVER reported as built');

  // AND THE REASON IS DURABLE, where Warwick looks - not only in a log.
  assert.match(String(h.db.shop[0].last_error), /never built|trolley/i);
  assert.equal(failureEvents(h).length, 1);
  assert.equal(failureEvents(h)[0].from_status, 'SHOPPING',
    'the shop must be resumable to exactly where it was when the report was refused');
  assert.equal(refused.resume_from, 'SHOPPING');

  // And Warwick is TOLD. A supervised shop that silently stalls is worse than
  // one that fails loudly, because he would keep waiting for a basket that is
  // never coming.
  const cards = await listOutbox(h.deps, { shopId: h.db.shop[0].id });
  assert.ok(cards.some((c) => c.kind === 'failure'), 'the refusal must reach the phone, not only the database');
});

test('WP-B15-14/AC2: "ASDA had none of it" is a DIFFERENT refusal from a broken report', async () => {
  const h = makeHarness();
  await toWaitingForBrowser(h);
  operatorPicksUp(h);
  await runPipeline(HANDLE, h.deps);

  operatorReports(h, supervisedReport(h, () => 'out_of_stock'));
  const refused = await runPipeline(HANDLE, h.deps);

  assert.equal(refused.ok, false);
  assert.notEqual(shopStatus(h), 'BASKET_READY');
  assert.match(String(h.db.shop[0].last_error), /ASDA had none of it|unavailable/i,
    '"ASDA had none of it" and "the runner is broken" are the same empty trolley and completely different problems');
});

test('WP-B15-14: a SHORTFALL still reaches BASKET_READY - no fill-rate threshold is invented', async () => {
  const h = makeHarness();
  await toWaitingForBrowser(h);
  operatorPicksUp(h);
  await runPipeline(HANDLE, h.deps);

  // One line in the trolley, one not found. Short, but a real basket exists and
  // Warwick can go and check it.
  operatorReports(h, supervisedReport(h, (l) => (l.seq === 1 ? 'added' : 'not_found')));
  const ready = await runPipeline(HANDLE, h.deps);

  assert.equal(ready.to, 'BASKET_READY');
  assert.equal(shopStatus(h), 'BASKET_READY',
    'items go out of stock; stranding a good trolley behind a number nobody chose would be the defect');
});

test('WP-B15-14: a SILENT completion advances nothing - a basket is never inferred from silence', async () => {
  const h = makeHarness();
  await toWaitingForBrowser(h);
  operatorPicksUp(h);
  await runPipeline(HANDLE, h.deps);

  // The request finished carrying no report at all.
  const row = h.db.browser_build_request[0];
  Object.assign(row, { status: 'complete', claimed_by: null });

  const parked = await runPipeline(HANDLE, h.deps);
  assert.equal(parked.step, STEPS.AWAIT_BASKET);
  assert.equal(parked.stepped, false);
  assert.equal(shopStatus(h), 'SHOPPING');
});

test('WP-B15-14: the return leg is IDEMPOTENT - re-running it cannot double-advance', async () => {
  const h = makeHarness();
  await toWaitingForBrowser(h);
  operatorPicksUp(h);
  await runPipeline(HANDLE, h.deps);
  operatorReports(h, supervisedReport(h));
  await runPipeline(HANDLE, h.deps);
  assert.equal(shopStatus(h), 'BASKET_READY');

  const before = JSON.stringify(h.db.shop[0]);
  for (let i = 0; i < 3; i += 1) {
    const r = await runPipeline(HANDLE, h.deps);
    assert.equal(r.stepped, false, 'a shop at BASKET_READY waits for a human; it must not step again');
  }
  assert.equal(JSON.stringify(h.db.shop[0]), before);
});

test('WP-B15-19 AC6, taught to fakePg (WP-B15-22): a progress write that would DESTROY the handoff artefact is refused', async () => {
  // shopStore.updateBrowserProgress's WRITE is a whole-object REPLACE, not a
  // merge, and became a footgun the moment openHandoff started writing the
  // operating contract onto progress.handoff: a caller passing a progress
  // object without it would silently DELETE the artefact. The real statement
  // now carries a WHERE predicate that refuses that write outright; this
  // proves fakePg enforces the SAME predicate, against the REAL shopStore
  // code (test/harness.js binds shopStore.updateBrowserProgress unmodified
  // over the fake client) - not a re-description of the guard.
  const h = makeHarness();
  await toWaitingForBrowser(h);
  const row = h.db.browser_build_request[0];
  assert.ok(row.progress && row.progress.handoff, 'fixture must start carrying a handoff artefact');
  Object.assign(row, { status: 'claimed', claimed_by: 'runner-1' });

  // A caller passing a progress object with NO handoff key must be refused -
  // real Postgres would refuse it via the jsonb_exists guard, and the row
  // must be left completely untouched (never partially applied).
  await assert.rejects(
    () => h.deps.shopStore.updateBrowserProgress(row.id, { counters: { step: 1 } }, {}),
    /carries a handoff artefact and this progress object does not/,
  );
  assert.deepEqual(h.db.browser_build_request[0].progress, row.progress,
    'a refused write must leave the row byte-identical, not partially applied');
  assert.equal(h.db.browser_build_request[0].status, 'claimed', 'a refused write must not flip status to running');

  // A caller that legitimately carries the artefact through (the CDP runner's
  // own progress counters, alongside the untouched handoff) succeeds.
  const carried = { ...row.progress, counters: { step: 1 } };
  const result = await h.deps.shopStore.updateBrowserProgress(row.id, carried, {});
  assert.equal(result.changed, true);
  assert.deepEqual(h.db.browser_build_request[0].progress.handoff, row.progress.handoff,
    'the handoff artefact must survive a write that carried it through');
  assert.equal(h.db.browser_build_request[0].status, 'running');
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

test('WP-B15-07: a FRESH shop can ADVANCE - its collision ref yields the DATE PART only', () => {
  // listDateOf runs on every advancing pass. A shop that started fresh because a
  // terminal one owned its date carries a `-M<message id>` suffix; if that threw
  // here, the fresh shop would die on its first step and Warwick would still get
  // no card - the original lost-list bug moved rather than fixed.
  assert.equal(listDateOf('SHOP-2026-08-10-M63'), '2026-08-10');
  assert.equal(listDateOf('SHOP-2026-08-10-M171031156'), '2026-08-10',
    'the suffix is discarded whatever its length - it is not part of the date');

  // The suffix is NARROW. A lazier relaxation would let these through and put
  // rubbish into list_date.
  for (const bad of ['SHOP-2026-08-10-M', 'SHOP-2026-08-10-63', 'SHOP-2026-08-10-MX', 'SHOP-2026-08-10-M6-M7']) {
    assert.throws(() => listDateOf(bad), /SHOP-YYYY-MM-DD/, `${bad} must be refused`);
  }
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

// =====================================================================
// THE FOUR JOINS (WO-ZI)
//
// Every component below was already complete, already tested, and reachable
// from NOTHING. That is this build's signature defect: `sendQuestionCard` had a
// full renderer, a full suite and no production caller, which is why Warwick
// spent 2026-08-03 answering questions by hand.
//
// So these tests are written to a specific bar: DELETE THE CALLER AND THIS MUST
// GO RED. A test that still passes with the wiring removed is not evidence that
// the wiring exists - it is evidence that the test never looked.
// =====================================================================

/** A settled decision as asdair.rule_qa_log holds it, and as data.js
 *  loadRuleQaLog() hands it to the planner. Synthetic; obvious fixture. */
const PRIOR_ANSWER = {
  id: 901,
  asked_on: '2026-07-06',
  question: 'Which gourmet cat food do you want?',
  answer: 'the Gourmet cat food one, always',
  applies_going_forward: true,
  household_id: HOUSEHOLD_ID,
  promoted_rule_id: null,
};

test('JOIN 1 - PRIOR ANSWERS REACH THE PLANNER: an answer given in July is consulted in August', async () => {
  // The planner is the REAL one. This test does not assert that an object was
  // forwarded; it asserts the planner ACTED on it, which is the only version of
  // this claim worth making.
  let seen = null;
  let produced = null;
  const h = makeHarness({
    planningInputs: {
      rules: [],
      products: [],
      regulars: [...makeCatalogue().regularsById.values()],
      budget: null,
      lastOrder: null,
      priorAnswers: [PRIOR_ANSWER],
    },
    depsOverride: {
      planBasket(input) {
        seen = input;
        produced = realPlanBasket(input);
        return produced;
      },
    },
  });
  await receiveText(h, '3 gourmet cat food');
  await commands.buildShop({ shopRef: REF, actor: ACTOR }, h.deps);
  await runPipeline(HANDLE, h.deps);   // interpret
  await runPipeline(HANDLE, h.deps);   // plan

  // (a) the rows travelled, and they came from loadPlanningInputs rather than
  //     from a literal built at the call site.
  assert.deepEqual(seen.priorAnswers, [PRIOR_ANSWER],
    'stepPlan did not pass priorAnswers to planBasket - an answered question will be asked again');

  // (b) THE PLANNER CONSUMED THEM. planner.js raises this flag only from
  //     priorAnswersForLine(), so it cannot appear when the key is absent.
  const line = produced.items.find((it) => /gourmet/i.test(it.item_name));
  assert.ok(line, 'the fixture line did not reach the plan at all');
  assert.ok(
    (line.flags || []).includes('prior decision on record'),
    `the planner never saw the prior answer - flags were ${JSON.stringify(line.flags)}`,
  );
});

test('JOIN 2 - GROUNDING EVIDENCE: what the model was GIVEN and what it RETURNED is durably recorded, sanitized', async () => {
  const h = makeHarness({ modelLines: MODEL_LINES });
  await receivePhoto(h);
  await commands.buildShop({ shopRef: REF, actor: ACTOR }, h.deps);
  await runPipeline(HANDLE, h.deps);   // -> TRANSCRIBING
  await runPipeline(HANDLE, h.deps);   // -> PROCESSING, the interpretation

  const evidence = h.db.pipeline_command.filter((c) => c.command === 'groundingEvidence');
  assert.equal(evidence.length, 1,
    'the interpretation left no grounding record - a skipped model call is indistinguishable from a real one');
  const args = evidence[0].args;

  // What was SUPPLIED.
  assert.equal(args.catalogue_candidates, 3);
  assert.ok(args.prompt_chars > 0, 'the prompt size was not recorded, so "grounded" is unfalsifiable');
  // What came BACK. This number cannot exist unless something answered - which
  // is the entire reason it is a count and not a flag (D-2026-08-03-04).
  assert.equal(args.readings_returned, 3);
  assert.deepEqual(args.line_nos, [1, 2, 3]);
  assert.deepEqual(args.matched_regular_ids, [11, 12]);
  assert.equal(args.source_kind, 'photo');

  // SANITIZED: counts and ids only. No product name, no raw reading, no prompt
  // text, no path to the photograph - anywhere in the stored row.
  const serialised = JSON.stringify(evidence[0]).toLowerCase();
  for (const leak of ['gourmet', 'weetabix', 'fruit splits', 'shopper-media', '.jpg']) {
    assert.ok(!serialised.includes(leak.toLowerCase()),
      `the grounding record leaked "${leak}" - it must carry counts and ids only`);
  }

  // ONE SHOT, EVER. The ledger's total unique index, not a read-then-write.
  await runPipeline(HANDLE, h.deps);
  assert.equal(h.db.pipeline_command.filter((c) => c.command === 'groundingEvidence').length, 1);
});

test('JOIN 3 - THE item_name CARRIER: a question knows which item it is about, by id and not by parsing a sentence', async () => {
  const h = makeHarness({ modelLines: MODEL_LINES });
  await receivePhoto(h);
  await commands.buildShop({ shopRef: REF, actor: ACTOR }, h.deps);
  await runPipeline(HANDLE, h.deps);   // -> TRANSCRIBING
  await runPipeline(HANDLE, h.deps);   // -> PROCESSING
  await runPipeline(HANDLE, h.deps);   // -> NEEDS_DECISION, opens the question

  const q = h.db.shop_question[0];
  assert.ok(q, 'no question was opened, so there is nothing to carry a name');
  assert.ok(q.list_item_id, 'the question carries no list_item_id - the item name has nothing to travel along');

  // The id points at the RIGHT row, recovered from listItems and not from
  // plan.items (dedupeList drops it, so taking it from the plan yields null).
  const item = h.db.shopping_list_items.find((i) => String(i.id) === String(q.list_item_id));
  assert.ok(item, 'the question points at a list item that does not exist');
  assert.equal(item.item_name, 'fruit splits');

  // And the JOIN delivers it, alongside the photographed wording - which is the
  // field the learning loop turns into next week's alias.
  const joined = await listQuestions(h.deps, h.db.shop[0].id);
  assert.equal(joined.length, 1);
  assert.equal(joined[0].item_name, 'fruit splits',
    'listQuestions returned no item_name, so a card falls back to rendering the whole question sentence');
  assert.equal(joined[0].photographed_wording, 'fruit splits',
    'the photographed wording did not travel - the learning loop has no evidence of what was written');
});

test('JOIN 4 - ANSWER LEARNING: a settled answer becomes a durable rule_qa_log row, once, ever', async () => {
  const h = makeHarness({ modelLines: MODEL_LINES });
  await receivePhoto(h);
  await commands.buildShop({ shopRef: REF, actor: ACTOR }, h.deps);
  await runPipeline(HANDLE, h.deps);   // -> TRANSCRIBING
  await runPipeline(HANDLE, h.deps);   // -> PROCESSING
  await runPipeline(HANDLE, h.deps);   // -> NEEDS_DECISION

  const questionKey = h.db.shop_question[0].question_key;
  assert.equal((await runPipeline(HANDLE, h.deps)).step, STEPS.AWAIT_ANSWERS);

  await commands.answerQuestion({
    shopRef: REF, actor: ACTOR, questionKey,
    answerText: 'Rowntrees Fruit Pastille Split', answerSource: 'button',
  }, h.deps);

  const replan = await runPipeline(HANDLE, h.deps);   // -> REPLAN
  assert.equal(replan.step, STEPS.REPLAN);
  assert.deepEqual(replan.answer_learning.map((l) => l.learned), [true],
    'the shop re-planned without recording what Warwick answered - the answer dies with the shop');

  // THE DURABLE ROW. This is the one that data.js loadRuleQaLog() reads back as
  // `priorAnswers`, which JOIN 1 feeds to the planner. The loop closes here.
  assert.equal(h.db.rule_qa_log.length, 1, 'nothing reached asdair.rule_qa_log');
  const logged = h.db.rule_qa_log[0];
  assert.equal(logged.answer, 'Rowntrees Fruit Pastille Split');
  assert.equal(String(logged.household_id), String(HOUSEHOLD_ID));
  assert.equal(logged.asked_on, '2026-08-03',
    'the decision was dated from a clock rather than from the shop it belongs to');

  // EXPLICIT false, never absent and never inferred. The pipeline holds no
  // human act asserting a standing rule, so no rule may be promoted from it.
  assert.equal(logged.applies_going_forward, false);
  assert.equal(logged.promoted_rule_id, null, 'the pipeline promoted a STANDING RULE from a tapped button');

  // ONCE, EVER. rule_qa_log has no idempotency key of its own, so the one-shot
  // ledger claim is the only thing standing between a re-run and a duplicated
  // decision in the audit log.
  await runPipeline(HANDLE, h.deps);
  await runPipeline(HANDLE, h.deps);
  assert.equal(h.db.rule_qa_log.length, 1, 'a re-run appended a duplicate decision to the audit log');
});

// =====================================================================
// WP-B15-1: THE CONFIRMATION CARD - SELF-HEALING (the gate's production surface)
//
// Until this card, planOutcome's park at wait:interpretation_confirmation wrote
// no event and queued nothing - a photo shop could sit there for days with
// nothing telling anyone it was being waited on (shop 6's live shape). These
// tests mirror the receipt/progress card proofs exactly: queued at most once
// ever per shop, durable, race-safe, and self-healing for a shop that was
// already parked before this code existed.
// =====================================================================

const CONFIRM_CARDS = (db) => db.pipeline_command.filter(
  (c) => c.kind === 'outbox' && c.command === 'confirm_interpretation',
);

/** All-matched model lines: no questions open, so the shop hits the
 *  interpretation gate directly - the pure park, nothing else in play. */
const ALL_MATCHED_LINES = [
  { line_no: 1, raw_reading: '3 gourmet cat food', quantity: 3 },
  { line_no: 2, raw_reading: '1 weetabix protein', quantity: 1 },
];

/** Drive a received photo shop to the interpretation park. */
async function driveToConfirmationPark(h, handle = HANDLE) {
  await commands.buildShop({ shopRef: handle.shopRef, actor: ACTOR }, h.deps);
  await runPipeline(handle, h.deps);        // -> TRANSCRIBING
  await runPipeline(handle, h.deps);        // -> PROCESSING (interpreted)
  return runPipeline(handle, h.deps);       // plan -> parks at the gate
}

/** A 64-hex-char fingerprint fixture - an obvious fake, valid under the CHECK. */
const FP_WEEK_A = 'ab12cd34ef567890'.repeat(4);
const FP_WEEK_B = '90fe87dc65ba4321'.repeat(4);

async function receivePhotoWithFingerprint(h, {
  fingerprint, listDate = '2026-08-03', messageId = '900',
  receivedAt = null,
} = {}) {
  return commands.receiveList({
    householdId: HOUSEHOLD_ID, listDate, sourceKind: 'photo',
    rawMediaPath: 'C:/.fusion247/asdair/shopper-media/fake.jpg', needsReview: true,
    actor: ACTOR, telegramChatId: '555', telegramMessageId: messageId,
    imageFingerprint: fingerprint, imageByteLength: 12345,
    receivedAt: receivedAt || (listDate + 'T19:05:00.000Z'),
  }, h.deps);
}

test('THE CONFIRMATION CARD: parking at the gate queues exactly ONE card, and the park itself is unchanged', async () => {
  const h = makeHarness({ modelLines: ALL_MATCHED_LINES });
  await receivePhoto(h);
  const parked = await driveToConfirmationPark(h);

  assert.equal(parked.step, STEPS.AWAIT_INTERPRETATION_CONFIRMATION);
  assert.equal(parked.stepped, false, 'the card is bookkeeping alongside the park, never a transition');
  assert.equal(shopStatus(h), 'PROCESSING');

  const cards = CONFIRM_CARDS(h.db);
  assert.equal(cards.length, 1);
  assert.equal(cards[0].args.shopRef, REF);
  assert.equal(h.db.pending_action.length, 0, 'a queued card is machine bookkeeping, never a household to-do');
});

test('THE CONFIRMATION CARD: repeated passes over the parked shop never queue a second card', async () => {
  const h = makeHarness({ modelLines: ALL_MATCHED_LINES });
  await receivePhoto(h);
  await driveToConfirmationPark(h);
  for (let i = 0; i < 4; i += 1) {
    const r = await runPipeline(HANDLE, h.deps);
    assert.equal(r.stepped, false);
  }
  assert.equal(CONFIRM_CARDS(h.db).length, 1, 'Warwick would be asked to confirm the same reading twice');
});

test('THE CONFIRMATION CARD: payload is HONEST when no fingerprint was recorded - absence travels as null, counts are real', async () => {
  const h = makeHarness({ modelLines: ALL_MATCHED_LINES });
  await receivePhoto(h);   // the pre-fingerprinting receive path: no binding row
  await driveToConfirmationPark(h);

  const card = CONFIRM_CARDS(h.db)[0];
  assert.equal(card.args.interpretedLines, 2, 'the interpreted count must come from the durable rows');
  assert.equal(card.args.fingerprintPrefix, null, 'no stored fingerprint may be fabricated');
  assert.equal(card.args.priorShopRef, null, 'no prior photo shop exists in this fixture');
  assert.equal(card.args.samePhotoAsPrior, null, 'an impossible comparison must travel as null, never as false-reassurance');
  assert.equal(card.args.receivedAt, '2026-08-03T09:00:00.000Z', 'with no binding, the shop row arrival time anchors the card');
});

test('THE FINGERPRINT BINDING: receiveList persists it once, first-write-wins, inside the receive itself', async () => {
  const h = makeHarness({ modelLines: ALL_MATCHED_LINES });
  await receivePhotoWithFingerprint(h, { fingerprint: FP_WEEK_A });
  assert.equal(h.db.shop_source_image.length, 1);
  assert.equal(h.db.shop_source_image[0].fingerprint, FP_WEEK_A);
  assert.equal(h.db.shop_source_image[0].byte_length, 12345);
  assert.equal(h.db.shop_source_image[0].captured_at, '2026-08-03T19:05:00.000Z');

  // A Telegram redelivery RESUMES the shop - and must adopt the ORIGINAL
  // binding, not overwrite it, even if the redelivered fingerprint differs.
  await receivePhotoWithFingerprint(h, { fingerprint: FP_WEEK_B });
  assert.equal(h.db.shop.length, 1, 'a redelivery must not create a second shop');
  assert.equal(h.db.shop_source_image.length, 1, 'a redelivery must not create a second binding');
  assert.equal(h.db.shop_source_image[0].fingerprint, FP_WEEK_A, 'first write wins - the binding is immutable');
});

test('THE CONFIRMATION CARD: carries the stored fingerprint prefix and the receiver own captured-at time', async () => {
  const h = makeHarness({ modelLines: ALL_MATCHED_LINES });
  await receivePhotoWithFingerprint(h, { fingerprint: FP_WEEK_A });
  await driveToConfirmationPark(h);

  const card = CONFIRM_CARDS(h.db)[0];
  assert.equal(card.args.fingerprintPrefix, FP_WEEK_A.slice(0, 12));
  assert.equal(card.args.fingerprintAlgo, 'sha256');
  assert.equal(card.args.receivedAt, '2026-08-03T19:05:00.000Z', 'the binding captured_at outranks the row timestamp');
});

test('THE WRONG-WEEK COMPARISON: the card names the previous photo shop, and an identical photograph is flagged', async () => {
  // Week A: a photo shop, fingerprinted, driven to its park.
  const h = makeHarness({ modelLines: ALL_MATCHED_LINES });
  await receivePhotoWithFingerprint(h, { fingerprint: FP_WEEK_A });
  await driveToConfirmationPark(h);

  // Week B, DIFFERENT photograph: prior shop named, samePhotoAsPrior false.
  const REF_B = 'SHOP-2026-08-10';
  await receivePhotoWithFingerprint(h, { fingerprint: FP_WEEK_B, listDate: '2026-08-10', messageId: '901' });
  await driveToConfirmationPark(h, { shopRef: REF_B });
  const cardB = CONFIRM_CARDS(h.db).find((c) => c.args.shopRef === REF_B);
  assert.equal(cardB.args.priorShopRef, REF, 'the previous photo shop must be named');
  assert.equal(cardB.args.priorReceivedAt, '2026-08-03T19:05:00.000Z');
  assert.equal(cardB.args.samePhotoAsPrior, false);

  // Week C, the SAME photograph as week B re-sent: flagged true.
  const REF_C = 'SHOP-2026-08-17';
  await receivePhotoWithFingerprint(h, { fingerprint: FP_WEEK_B, listDate: '2026-08-17', messageId: '902' });
  await driveToConfirmationPark(h, { shopRef: REF_C });
  const cardC = CONFIRM_CARDS(h.db).find((c) => c.args.shopRef === REF_C);
  assert.equal(cardC.args.priorShopRef, REF_B);
  assert.equal(cardC.args.samePhotoAsPrior, true, 'an identical re-sent photograph is the wrong-week smoking gun');
});

test('THE CONFIRMATION CARD: a shop ALREADY parked before this code existed (shop 6 shape) recovers on the next pass', async () => {
  // Build the pre-fix world: a photo shop with every question ANSWERED, parked
  // at the gate, with NO confirmation card ever queued - exactly shop 6 live.
  const h = makeHarness({ modelLines: MODEL_LINES });   // line 3 opens a question
  await receivePhoto(h);
  await commands.buildShop({ shopRef: REF, actor: ACTOR }, h.deps);
  await runPipeline(HANDLE, h.deps);        // -> TRANSCRIBING
  await runPipeline(HANDLE, h.deps);        // -> PROCESSING
  await runPipeline(HANDLE, h.deps);        // plan -> NEEDS_DECISION (1 question)
  const q = h.db.shop_question.find((x) => x.status === 'open');
  await commands.answerQuestion({ shopRef: REF, actor: ACTOR, questionKey: q.question_key, answerText: 'Rowntrees Fruit Pastille Lolly' }, h.deps);
  await runPipeline(HANDLE, h.deps);        // replan (answer learning records) -> PROCESSING
  assert.equal(shopStatus(h), 'PROCESSING', 'the replan itself must succeed - a learning failure here would be a different defect, not a gate defect');
  await runPipeline(HANDLE, h.deps);        // plan -> parks at the gate (queues the card, post-fix)

  // Model the pre-fix world exactly: parked, no card ever queued.
  h.db.pipeline_command = h.db.pipeline_command.filter(
    (c) => !(c.kind === 'outbox' && c.command === 'confirm_interpretation'),
  );
  assert.equal(CONFIRM_CARDS(h.db).length, 0);

  // A brand-new process (restart/deploy), pointed at the SAME durable database.
  const restarted = makeHarness({ modelLines: MODEL_LINES, seed: h.db });
  const r = await runPipeline(HANDLE, restarted.deps);
  assert.equal(r.step, STEPS.AWAIT_INTERPRETATION_CONFIRMATION);
  assert.equal(CONFIRM_CARDS(restarted.db).length, 1, 'a shop parked before this fix was never recovered');
  const card = CONFIRM_CARDS(restarted.db)[0];
  assert.equal(card.args.fingerprintPrefix, null, 'a pre-fingerprinting shop must render honest absence, not an invented hash');
  assert.equal(card.args.interpretedLines, 3);
});

test('THE CONFIRMATION CARD: two runners racing the same parked shop cannot double-queue it', async () => {
  const h = makeHarness({ modelLines: ALL_MATCHED_LINES });
  await receivePhoto(h);
  await commands.buildShop({ shopRef: REF, actor: ACTOR }, h.deps);
  await runPipeline(HANDLE, h.deps);        // -> TRANSCRIBING
  await runPipeline(HANDLE, h.deps);        // -> PROCESSING

  // Both runners plan the parked shop concurrently, both read "never queued".
  await Promise.all([runPipeline(HANDLE, h.deps), runPipeline(HANDLE, h.deps)]);
  assert.equal(CONFIRM_CARDS(h.db).length, 1, 'a race between two runners queued the confirmation card twice');
});

test('THE GATE CLEARS: confirmInterpretation after the card -> replan proceeds -> READY_TO_SHOP, and no second card ever', async () => {
  const h = makeHarness({ modelLines: ALL_MATCHED_LINES });
  await receivePhoto(h);
  await driveToConfirmationPark(h);
  assert.equal(CONFIRM_CARDS(h.db).length, 1);

  // The deliberate act - the same command the approve tap dispatches.
  await commands.confirmInterpretation({ shopRef: REF, actor: ACTOR }, h.deps);
  const passed = await runPipeline(HANDLE, h.deps);
  assert.equal(passed.to, 'READY_TO_SHOP', 'the latch must open the gate through the existing chain');

  // Further passes: parked for the basket request, and still exactly one card.
  const after = await runPipeline(HANDLE, h.deps);
  assert.equal(after.step, STEPS.AWAIT_BASKET_REQUEST);
  assert.equal(CONFIRM_CARDS(h.db).length, 1);
});

test('THE CONFIRMATION CARD: a TEXT shop never gets one - it was typed, not read, so there is no gate', async () => {
  const h = makeHarness();
  await receiveText(h);
  await commands.buildShop({ shopRef: REF, actor: ACTOR }, h.deps);
  await drain(h);
  assert.equal(shopStatus(h), 'READY_TO_SHOP');
  assert.equal(CONFIRM_CARDS(h.db).length, 0);
});

// =====================================================================
// B15-3 FIX1 - THE DEFERRED-CLARIFICATION CARD IS SENT ONCE, NOT ONCE A MINUTE
//
// THE LIVE DEFECT. One stuck shop put EIGHTEEN identical "I could not read
// that" cards on Warwick's phone in seventeen minutes, one every ~65 seconds -
// the runtime's poll interval. The enqueue carried a comment claiming
// "IDEMPOTENT BY OUTBOX KEY ... a stuck shop must not become a stream of
// identical cards", and a stream of identical cards is precisely what it was.
//
// ── WHY THE OUTBOX KEY WAS NEVER THAT GUARANTEE ────────────────────────────
// The live idempotency keys ran
//   outbox:1:clarification_deferred:SHOP-2026-08-09:clarification_deferred.q8f8d3866#3
// through `#17`. The trailing `#N` is NOT a suffix on the question key:
// `ledgerFamilyKey` runs `requireKeyComponent` over every component and THROWS
// on a `#`, so eighteen rows could not exist if the key carried one. It is the
// LEDGER GENERATION appended by `ledgerIdempotencyKey`, and store.js derives it
// from how many rows of that family are already TERMINAL.
//
// So the family was CONSTANT and the generation moved: while the card sat
// unsent the family was adopted (one row), and the moment it was SENT its
// generation was spent, so the next pass minted the next generation and queued
// a genuinely new row. That re-issue is deliberate and load-bearing for
// COMMANDS - "ask for the basket again after a pause" - and it is simply not
// the once-ever property a milestone card needs.
//
// ── THE TRAP EVERY TEST OF THIS MUST AVOID ─────────────────────────────────
// A multi-pass test that never RESOLVES what it queued goes GREEN against the
// broken code, because a still-pending row is adopted and no duplicate appears.
// The duplicate exists only once the card has been SENT. Every loop below
// therefore sends what the pass queued - exactly what runtime.drainOutbox does -
// and asserts a ROW COUNT, never an exit code and never a single re-run.
// =====================================================================

const DEFERRED_CARDS = (db) => db.pipeline_command.filter(
  (c) => c.kind === 'outbox' && c.command === 'clarification_deferred',
);

/** The item each deferred card is about, in queue order. */
const DEFERRED_ITEMS = (db) => DEFERRED_CARDS(db).map((c) => (c.args.items || [])[0]);

/**
 * Send everything the pass queued, the way runtime.drainOutbox does: a
 * delivered row is resolved to `done`, which is TERMINAL.
 *
 * This is the whole difference between a test that reproduces the defect and
 * one that passes over it. Nothing here is a shortcut - `resolveCommand(id,
 * 'done', 'sent')` is the literal call drainOutbox makes after bot.send.
 */
async function sendQueuedCards(h) {
  const queued = await listOutbox(h.deps);
  for (const row of queued) await resolveCommand(h.deps, row.id, 'done', 'sent');
  return queued.length;
}

/** A recording stub for the bounded answer interpreter. No model, no spend. */
function scriptedInterpreter(returns) {
  const calls = [];
  const fn = async (grounding) => {
    calls.push(grounding);
    return typeof returns === 'function' ? returns(grounding) : returns;
  };
  fn.calls = calls;
  return fn;
}

const CLARIFY = (reason) => ({ decision_kind: 'clarification_required', clarification_reason: reason });

/** Two readings the household catalogue cannot name, so two lines are held.
 *  `oven gloves` is the live line from shop 7 that produced the eighteen cards. */
const TWO_UNREADABLE_LINES = [
  { line_no: 1, raw_reading: '3 gourmet cat food', quantity: 3 },
  { line_no: 2, raw_reading: 'fruit splits', quantity: null },
  { line_no: 3, raw_reading: 'oven gloves', quantity: null },
];

/**
 * A PHOTO shop - needs_review true, the reading NEVER confirmed - in which
 * every unreadable line has been answered with `clarification_required`.
 *
 * That is the exact live shape: the round-2 question is OWED but the reading
 * gate defers it, so the shop parks and every subsequent pass re-runs stepPlan.
 */
async function toDeferredClarification(h) {
  await receivePhoto(h);
  await commands.buildShop({ shopRef: REF, actor: ACTOR }, h.deps);
  await drain(h);
  assert.equal(shopStatus(h), 'NEEDS_DECISION', 'the fixture must reach a real open question');
  const open = h.db.shop_question.filter((q) => q.status === 'open');
  assert.ok(open.length > 0, 'no question opened - this fixture would be proving nothing');
  for (const q of open) {
    await commands.answerQuestion({
      shopRef: REF, actor: ACTOR, questionKey: q.question_key,
      answerText: 'the usual', answerSource: 'typed',
    }, h.deps);
  }
  return open;
}

test('B15-3 FIX1 / AC1: SIX planning passes over one stuck shop queue exactly ONE deferred-clarification card', async () => {
  const h = makeHarness({
    modelLines: MODEL_LINES,
    depsOverride: { interpretAnswer: scriptedInterpreter(CLARIFY('two sizes')) },
  });
  await toDeferredClarification(h);

  // A LOOP, not copy-pasted calls. The live defect needed eighteen passes to
  // become undeniable; a two-pass test would have gone green while broken.
  const PASSES = 6;
  const seen = [];
  for (let i = 0; i < PASSES; i += 1) {
    await runPipeline(HANDLE, h.deps);
    await sendQueuedCards(h);                 // the runtime delivers what was queued
    seen.push(DEFERRED_CARDS(h.db).length);
  }

  assert.equal(DEFERRED_CARDS(h.db).length, 1,
    `a stuck shop queued ${DEFERRED_CARDS(h.db).length} deferred-clarification cards over ${PASSES} passes `
    + `(running total per pass: ${seen.join(', ')}). Warwick got eighteen of these.`);

  // And the shop really was stuck for the whole loop - so the count above is
  // one card over six live passes, not one pass that quietly stopped running.
  assert.equal(shopStatus(h), 'PROCESSING',
    'the shop must still be parked behind the unconfirmed reading, or the loop proved nothing');
});

test('B15-3 FIX1 / AC1: the same shop stays quiet across a RESTART, not merely within one process', async () => {
  const h = makeHarness({
    modelLines: MODEL_LINES,
    depsOverride: { interpretAnswer: scriptedInterpreter(CLARIFY('two sizes')) },
  });
  await toDeferredClarification(h);
  await runPipeline(HANDLE, h.deps);
  await runPipeline(HANDLE, h.deps);
  await sendQueuedCards(h);
  assert.equal(DEFERRED_CARDS(h.db).length, 1, 'the first pass must still tell him once');

  // A brand-new process pointed at the SAME durable database - a deploy, a
  // reboot, or Larry restarting the runtime on a shop that is still stuck.
  const restarted = makeHarness({
    modelLines: MODEL_LINES, seed: h.db,
    depsOverride: { interpretAnswer: scriptedInterpreter(CLARIFY('two sizes')) },
  });
  for (let i = 0; i < 5; i += 1) {
    await runPipeline(HANDLE, restarted.deps);
    await sendQueuedCards(restarted);
  }
  assert.equal(DEFERRED_CARDS(restarted.db).length, 1,
    'restarting the runtime on a stuck shop restarted the stream of cards');
});

test('B15-3 FIX1 / AC2: TWO held lines get TWO cards - one per line, not one per shop', async () => {
  const h = makeHarness({
    modelLines: TWO_UNREADABLE_LINES,
    depsOverride: { interpretAnswer: scriptedInterpreter(CLARIFY('ambiguous')) },
  });
  const open = await toDeferredClarification(h);
  assert.equal(open.length, 2, 'the fixture needs two genuinely unreadable lines');

  for (let i = 0; i < 6; i += 1) {
    await runPipeline(HANDLE, h.deps);
    await sendQueuedCards(h);
  }

  assert.equal(DEFERRED_CARDS(h.db).length, 2,
    'one-per-line is the property: suppressing repeats must not suppress the second line');
  assert.deepEqual(DEFERRED_ITEMS(h.db).sort(), ['fruit splits', 'oven gloves'],
    'both held lines must be named - a card about only one of them is a silent line');
});

test('B15-3 FIX1 / AC3: the deferral and its honest content are UNCHANGED - the fix is in delivery only', async () => {
  const h = makeHarness({
    modelLines: MODEL_LINES,
    depsOverride: { interpretAnswer: scriptedInterpreter(CLARIFY('I could not tell which you meant')) },
  });
  await toDeferredClarification(h);
  for (let i = 0; i < 4; i += 1) {
    await runPipeline(HANDLE, h.deps);
    await sendQueuedCards(h);
  }

  // THE GATE STILL DEFERS. The round-2 question is owed and is NOT opened while
  // the reading is unconfirmed - that gate recovered a real shop and is not this
  // Work Order's to touch.
  assert.equal(h.db.shop_question.filter((q) => Number(q.question_round) === 2).length, 0,
    'a clarification round was opened before the reading was confirmed - the gate has been weakened');

  // NOTHING WAS GUESSED AND NOTHING REACHED A BASKET.
  assert.notEqual(shopStatus(h), 'READY_TO_SHOP', 'a shop with an undecided line must never be ready');
  const held = h.db.shop_line.find((l) => l.raw_reading === 'fruit splits');
  assert.ok(held, 'the held line must still exist');
  assert.notEqual(held.status, 'matched', 'the held line must not have been quietly matched to something');

  // THE CARD STILL SAYS WHAT IT COULD NOT READ, AND WHY.
  const card = DEFERRED_CARDS(h.db)[0];
  assert.ok(card, 'he must still be told - a silent deferral is the defect this card was added to close');
  assert.deepEqual(card.args.items, ['fruit splits']);
  assert.equal(card.args.reason, 'I could not tell which you meant');
  assert.equal(card.args.shopRef, REF);
});

test('B15-3 FIX1 / AC4: a genuinely NEW held line still notifies - repeats are suppressed, news is not', async () => {
  const h = makeHarness({
    modelLines: MODEL_LINES,
    depsOverride: { interpretAnswer: scriptedInterpreter(CLARIFY('two sizes')) },
  });
  await toDeferredClarification(h);
  for (let i = 0; i < 5; i += 1) {
    await runPipeline(HANDLE, h.deps);
    await sendQueuedCards(h);
  }
  assert.equal(DEFERRED_CARDS(h.db).length, 1, 'the first line must have settled to one card');

  // A SECOND LINE BECOMES HELD, LATER. Warwick corrects the list with a line the
  // catalogue cannot name; it opens its own question, he answers it, and the
  // interpreter says it needs clarifying too. That is NEWS, not a repeat.
  await commands.correctLine({
    shopRef: REF, actor: ACTOR, itemName: 'silver polish', status: 'needs_decision',
  }, h.deps);
  for (let i = 0; i < 4; i += 1) {
    await runPipeline(HANDLE, h.deps);
    await sendQueuedCards(h);
  }
  const fresh = h.db.shop_question.find((q) => q.status === 'open');
  assert.ok(fresh, 'the corrected line must open its own round-1 question');
  await commands.answerQuestion({
    shopRef: REF, actor: ACTOR, questionKey: fresh.question_key,
    answerText: 'the usual', answerSource: 'typed',
  }, h.deps);

  for (let i = 0; i < 5; i += 1) {
    await runPipeline(HANDLE, h.deps);
    await sendQueuedCards(h);
  }

  assert.equal(DEFERRED_CARDS(h.db).length, 2,
    'a NEW held line was suppressed - a fix that silences repeats by silencing everything is the worse defect');
  assert.deepEqual(DEFERRED_ITEMS(h.db), ['fruit splits', 'silver polish'],
    'the second card must be about the NEW line, and the first must not have repeated');
});

// =====================================================================
// WO-2026-08-10-B15-04 AC1 - AT THE LIVE MAGNITUDE, AND THE QUESTION
// THE ORDER ASKED, ANSWERED IN A TEST SO IT IS NEVER RE-ASKED.
//
// The Work Order's amendment read the live keys
//   ...clarification_deferred.q8f8d3866#7 / #9 / #13 / #17 / #20
// as a question key carrying an "incrementing ROUND SUFFIX", and concluded the
// notice FAMILY moves every round so the landed generation guard cannot bite.
//
// THAT READING IS FALSE, and the code makes it structurally impossible:
//   * questionKeyFor returns `q` + 8 hex characters. The round travels INSIDE
//     the hash input and never into the output, at every round.
//   * ledgerFamilyKey runs requireKeyComponent over every component and THROWS
//     on a `#`, so a family key carrying one could not be built at all.
//   * The trailing `#N` is ledgerIdempotencyKey's GENERATION separator.
//
// So the family was CONSTANT at `...q8f8d3866` and the generation was the only
// thing moving - which is exactly what the landed guard asks about.
//
// The two facts below are asserted rather than argued, at twenty passes: the
// magnitude Warwick actually received, not the six the earlier fix proved.
// =====================================================================

test('B15-04 AC1: TWENTY passes over one stuck shop - one card, and the question does not move', async () => {
  const h = makeHarness({
    modelLines: MODEL_LINES,
    depsOverride: { interpretAnswer: scriptedInterpreter(CLARIFY('two sizes')) },
  });
  await toDeferredClarification(h);

  const heldAfterFirst = { key: null, round: null };
  const running = [];
  for (let i = 0; i < 20; i += 1) {
    await runPipeline(HANDLE, h.deps);
    await sendQueuedCards(h);                 // delivered => generation SPENT
    running.push(DEFERRED_CARDS(h.db).length);
    // The held question row, as the enqueue's `held.question_key` sees it on
    // THIS pass. (`needs_clarification_round` lives on the DECISION view, not on
    // shop_question, so the row is identified positionally - there is exactly
    // one, which the assertion below would catch if it ever stopped being true.)
    assert.equal(h.db.shop_question.length, 1, `the fixture grew a second question at pass ${i + 1}`);
    const held = h.db.shop_question[0];
    if (i === 0) { heldAfterFirst.key = held.question_key; heldAfterFirst.round = Number(held.question_round); }
    // THE ORDER'S OPEN QUESTION, ANSWERED EVERY PASS: does question_round
    // advance on the deferred path? It cannot - the branch `continue`s before
    // any openQuestion call, and everIssued(CONFIRM_INTERPRETATION) is
    // monotonic so the branch can never be re-entered after the gate clears.
    assert.equal(held.question_key, heldAfterFirst.key,
      `the held question key moved on pass ${i + 1} - the notice family is not stable`);
    assert.equal(Number(held.question_round), heldAfterFirst.round,
      `question_round advanced on the DEFERRED path at pass ${i + 1}`);
  }

  assert.equal(DEFERRED_CARDS(h.db).length, 1,
    `twenty passes queued ${DEFERRED_CARDS(h.db).length} deferred-clarification cards `
    + `(running total per pass: ${running.join(', ')}). Warwick received about twenty.`);

  // ONE FAMILY, and its key carries the question key with NO generation in it.
  const [card] = DEFERRED_CARDS(h.db);
  assert.ok(String(card.args.ledger_key).endsWith(`clarification_deferred.${heldAfterFirst.key}`),
    `the notice family is not keyed on the stable question key: ${card.args.ledger_key}`);
  assert.equal(String(card.args.ledger_key).includes('#'), false,
    'a `#` in the FAMILY key would mean the round really was in it - ledgerFamilyKey must have thrown');

  assert.equal(shopStatus(h), 'PROCESSING',
    'the shop must still be parked behind the unconfirmed reading, or the loop proved nothing');
});

// =====================================================================
// WO-2026-08-10-B15-04 AC2 - WHY THE SEAM RAN AND FAILED ANYWAY.
//
// SHOP-2026-08-10 exists in the household database with one line reading
// "any gloves, i don't care want to rotate as soon as safe to do so!" - Warwick's
// ANSWER to the deferred-clarification card, eaten as next week's shopping list.
//
// The route-first claim seam (shopperIntake.js, WP-B15-A1) is real, is wired in
// production, and shopperIntake.test.js proves it works. It did not fail. It was
// NEVER ASKED: runOnce builds the claim as
//
//     openQuestions.length === 0 ? null : async (verdict, update) => {...}
//
// and loadOpenQuestions counts only rows with status === 'open'.
//
// THE DEFERRED-CLARIFICATION STATE CONTAINS, BY CONSTRUCTION, ZERO OPEN ROWS.
// The round-1 question is `answered`; the round-2 question is OWED but
// deliberately NOT OPENED while the reading is unconfirmed - the gate that
// recovered shop 6, and asserted by B15-3 FIX1 / AC3 above.
//
// So AsdAIr put a card on his phone SOLICITING AN ANSWER while holding no
// question able to receive one. He answered it. With no open question there was
// no claim, intake was never asked whether the message belonged to anyone, and
// it did the only thing left: made it a shop.
//
// NOT A RACE. Nothing here depends on ordering, timing or interleaving - the
// two tests below are deterministic and single-threaded. It is a state gap: the
// claim predicate consults `open questions` when the honest question is
// `is AsdAIr waiting on Warwick for words?`.
// =====================================================================

/** The real inbound router and callback protocol, wired to fakes. The claim
 *  predicate requires a bot, so a test without one would go red for the wrong
 *  reason and prove nothing about the defect. */
async function makeRoutingBot() {
  const router = await import('../bot/inboundRouter.js');
  const callback = await import('../bot/callbackProtocol.js');
  const messages = await import('../bot/renderMessages.js');
  const sent = [];
  return {
    sent,
    routeAsdairUpdate: router.routeAsdairUpdate,
    parseAnswerArg: callback.parseAnswerArg,
    messages: messages.MESSAGES,
    chatId: '555',
    send: async (chatId, message) => { sent.push({ chatId, message }); return { message_id: 8000 + sent.length }; },
    answerTap: async () => true,
  };
}

/** Warwick's actual words, from the spurious shop's only line. */
const HIS_ANSWER = "any gloves, i don't care want to rotate as soon as safe to do so!";

// ── THE FIX, AND THE THREE ROUTES IT DELIBERATELY DOES NOT TAKE ────────────
//
// Larry's decision, 2026-08-10. None of these was available:
//   (a) record the pending answer on shop_question -> a MIGRATION, out of scope;
//   (b) a new outbox kind -> new Telegram surface, out of scope;
//   (c) open the round-2 question early -> changes the deferral gate that
//       recovered shop 6 and suppresses the confirmation card.
// And the fourth, claim-and-log, is a SILENT SWALLOW - the exact defect class
// the clarification_deferred card exists to close.
//
// SO: the claim RECOGNISES the deferred window; the message is NOT ingested as
// a list; it is NOT written as an answer; and HE IS TOLD, by re-issuing the
// clarification_deferred notice already owed - same kind, same renderer, with
// `messageNotAccepted: true`.
//
// ⛔ WHY THE OBVIOUS ONE-LINE FIX WAS REFUSED - MEASURED, NOT ARGUED.
//
// The tempting fix is to let loadOpenQuestions admit the `answered` round-1 row
// so the existing claim seam becomes reachable. It was tried as a mutation and
// probed:
//
//   report.intake -> { received: 0, claimed: 1 }        <- no spurious shop
//   answers       -> [{ ..., duplicate: true }]
//   answer_text   -> UNCHANGED, still his ORIGINAL round-1 words
//
// answerQuestion is a compare-and-set on status='open', so the already-answered
// row refuses the write and returns `duplicate: true`. runOnce counted that
// receipt toward `settled`, returned TRUE and SWALLOWED the message - his new
// words recorded NOWHERE and he told NOTHING. It converts a VISIBLE defect (a
// spurious shop he can see and delete) into an INVISIBLE one. That latent
// swallow is fixed too - see `recordedAnswerMatches` and the DUPLICATE test.
//
// A GENUINE NEW LIST TYPED IN THIS WINDOW IS REJECTED. Accepted knowingly: it
// is an edge case, it is VISIBLE, and the card says so in as many words.
// Fail-safe and loud beats convenient and wrong.

/** A shop parked on a genuinely OPEN question - the ordinary claim path's state. */
async function seedOpenQuestionShop() {
  const h = makeHarness({ modelLines: MODEL_LINES });
  await receiveText(h, '1 dreamies cheese\n2 gourmet cat food');
  await commands.buildShop({ shopRef: REF, actor: ACTOR }, h.deps);
  await drain(h);
  assert.ok(h.db.shop_question.some((row) => row.status === 'open'),
    'the fixture must reach a real open question');
  return h;
}

/** Drive a shop into the deferred window with its notice actually delivered. */
async function toDeliveredDeferral(h) {
  await toDeferredClarification(h);
  await runPipeline(HANDLE, h.deps);
  await runPipeline(HANDLE, h.deps);
  await sendQueuedCards(h);
  assert.equal(DEFERRED_CARDS(h.db).length, 1, 'the soliciting card never went out - this proves nothing');
}

test('B15-04 AC2: the deferred window is RECOGNISED even though no question row is open', async () => {
  const h = makeHarness({
    modelLines: MODEL_LINES,
    depsOverride: { interpretAnswer: scriptedInterpreter(CLARIFY('two sizes')) },
  });
  await toDeliveredDeferral(h);

  // The state gap itself is unchanged and is NOT what was fixed: the round-2
  // question is still withheld, so `status = 'open'` still matches nothing.
  const open = await loadOpenQuestions(h.deps, { householdId: HOUSEHOLD_ID });
  assert.equal(open.length, 0, 'the deferral gate was weakened - that is not this fix');

  // What changed is that the window is now VISIBLE to the claim decision.
  const deferred = await loadDeferredClarifications(h.deps, { householdId: HOUSEHOLD_ID });
  assert.equal(deferred.length, 1, 'a card was sent soliciting an answer and nothing knows he is owed one');
  assert.equal(deferred[0].shopRef, REF);
});

test('B15-04 AC2: HIS ANSWER IS NOT A SHOPPING LIST, NOT AN ANSWER, AND HE IS TOLD', async () => {
  const h = makeHarness({
    modelLines: MODEL_LINES,
    depsOverride: { interpretAnswer: scriptedInterpreter(CLARIFY('two sizes')) },
  });
  await toDeliveredDeferral(h);
  const answerBefore = h.db.shop_question[0].answer_text;

  // He reads the card and types a bare (non-reply) message on a NEW message id -
  // exactly the live message that became SHOP-2026-08-10.
  const bot = await makeRoutingBot();
  const report = await runOnce(h.deps, {
    householdId: HOUSEHOLD_ID,
    bot,
    intake: makeIntake([textUpdate({ updateId: 2, messageId: 901, text: HIS_ANSWER })]),
  });

  // 1. NOT A LIST. This is the defect Warwick actually suffered.
  assert.equal(report.intake.received, 0, 'his answer was received as a shopping list again');
  assert.deepEqual(h.db.shop.map((s) => s.shop_ref), [REF], 'a second shop was created from his answer');
  assert.ok(h.db.shopping_lists.length <= 1, 'a second shopping list was written from an answer');

  // 2. NOT AN ANSWER. The compare-and-set would have refused it anyway; what
  //    matters is that nothing pretended otherwise and his round-1 words stand.
  assert.equal(h.db.shop_question[0].answer_text, answerBefore, 'his earlier answer was overwritten');
  assert.equal(h.db.shop_question.length, 1, 'a question row was invented to receive the message');

  // 3. HE IS TOLD. Claimed, and a notice queued and delivered saying so. This is
  //    the whole reason this route was chosen over claim-and-log.
  assert.equal(report.intake.claimed, 1, 'nobody owned the message');
  assert.equal(report.refusals.length, 1, 'the refusal is invisible in the pass result');
  assert.equal(report.refusals[0].reason, 'clarification_deferred');
  assert.equal(DEFERRED_CARDS(h.db).length, 2, 'HE WAS NOT TOLD - this is the silent drop, and it is worse');

  const notice = DEFERRED_CARDS(h.db)[1];
  assert.equal(notice.args.messageNotAccepted, true);
  assert.equal(notice.status, 'done', 'the notice was queued but never actually sent to him');

  // And it must read correctly for BOTH readers - the one answering, and the one
  // who genuinely was sending a list and must not think it landed.
  const rendered = bot.messages.clarification_deferred(notice.args).text;
  assert.match(rendered, /NOT started as a/,
    'the card does not tell him his message was not taken as a list');
  assert.match(rendered, /NEW shopping list/,
    'someone who really was sending a list is left thinking it landed');
  assert.match(rendered, /confirm I read this list correctly/,
    'the card does not say what would actually unblock it');
});

test('B15-04 AC2: TWENTY passes with a REDELIVERED message produce ONE notice, not one per pass', async () => {
  const h = makeHarness({
    modelLines: MODEL_LINES,
    depsOverride: { interpretAnswer: scriptedInterpreter(CLARIFY('two sizes')) },
  });
  await toDeliveredDeferral(h);
  const bot = await makeRoutingBot();

  // THE WORST CASE, and the one that rebuilt the storm last time: a state store
  // that never advances, so Telegram redelivers the SAME message every pass.
  // Delivering what each pass queued is what makes the generation SPENT - the
  // exact trap that made the six-pass FIX1 test necessary.
  const update = textUpdate({ updateId: 2, messageId: 901, text: HIS_ANSWER });
  const stuck = makeIntake([update]);
  stuck.state = { async read() { return { lastUpdateId: null }; }, async write() { return null; } };

  const running = [];
  for (let i = 0; i < 20; i += 1) {
    await runOnce(h.deps, { householdId: HOUSEHOLD_ID, bot, intake: stuck });
    await sendQueuedCards(h);
    running.push(DEFERRED_CARDS(h.db).length);
  }

  assert.equal(DEFERRED_CARDS(h.db).length, 2,
    'one deferral notice plus one refusal notice is the whole budget; got '
    + `${DEFERRED_CARDS(h.db).length} (running total per pass: ${running.join(', ')})`);
  assert.deepEqual(h.db.shop.map((s) => s.shop_ref), [REF], 'a redelivered refusal created a shop');
});

test('B15-04 AC2: a genuine new list typed in the window is REJECTED - visibly, not silently', async () => {
  const h = makeHarness({
    modelLines: MODEL_LINES,
    depsOverride: { interpretAnswer: scriptedInterpreter(CLARIFY('two sizes')) },
  });
  await toDeliveredDeferral(h);
  const bot = await makeRoutingBot();

  const report = await runOnce(h.deps, {
    householdId: HOUSEHOLD_ID,
    bot,
    intake: makeIntake([textUpdate({ updateId: 3, messageId: 902, text: '2 milk\n1 bread\n6 eggs' })]),
  });

  // The accepted trade, asserted so nobody discovers it in production: it does
  // NOT become a shop, and he is TOLD rather than left guessing.
  assert.equal(report.intake.received, 0);
  assert.deepEqual(h.db.shop.map((s) => s.shop_ref), [REF]);
  assert.equal(report.refusals.length, 1);
  assert.equal(DEFERRED_CARDS(h.db).length, 2, 'a rejected shopping list was rejected SILENTLY');
  assert.match(bot.messages.clarification_deferred(DEFERRED_CARDS(h.db)[1].args).text,
    /please send it again once this shop is finished/,
    'he is not told what to do with the list he just tried to send');
});

test('B15-04 DUPLICATE: a duplicate receipt with DIFFERENT words is not settled, so nothing is swallowed', async () => {
  // The latent swallow found while proving AC2's cause. answerQuestion is a
  // compare-and-set on status='open', so an already-answered row returns
  // `duplicate: true` having stored nothing. Counting that as settled claims a
  // message whose words were recorded nowhere.
  // THE RACE IS REAL AND IS BUILT HERE, NOT SIMULATED. runOnce reads the open
  // questions BEFORE the fetch. Answering the row from inside getUpdates puts
  // the settle exactly in that window - open when loaded, closed by dispatch.
  const h = await seedOpenQuestionShop();
  const q = h.db.shop_question.find((row) => row.status === 'open');
  assert.ok(q, 'the fixture needs a genuinely open question');

  const bot = await makeRoutingBot();
  const intake = makeIntake([textUpdate({ updateId: 4, messageId: 903, text: 'actually make it the big bag' })]);
  const fetch = intake.telegram.getUpdates;
  intake.telegram.getUpdates = async (args) => {
    const updates = await fetch(args);
    await commands.answerQuestion({
      shopRef: REF, actor: ACTOR, questionKey: q.question_key,
      answerText: 'the 60g one', answerSource: 'button',
    }, h.deps);
    return updates;
  };

  const report = await runOnce(h.deps, { householdId: HOUSEHOLD_ID, bot, intake });

  // His earlier answer stands, and the message was NOT claimed on a write that
  // never happened - so it falls back to intake, which is visible and fixable.
  assert.equal(h.db.shop_question.find((row) => row.question_key === q.question_key).answer_text, 'the 60g one',
    'the compare-and-set was defeated and the recorded answer was overwritten');
  assert.equal(report.intake.claimed, 0,
    'a message whose words were recorded NOWHERE was claimed and swallowed');
  const notRecorded = report.answers.filter((a) => typeof a.error === 'string');
  assert.equal(notRecorded.length, 1, 'the dropped answer left no trace in the pass report');
});

test('B15-04 DUPLICATE: a genuine REDELIVERY of the SAME words is still claimed', async () => {
  // The other half of the rule, and the reason it is a comparison rather than a
  // blanket "never settle on a duplicate": a redelivered message answering the
  // question it already answered must NOT fall through and become a shop.
  const h = await seedOpenQuestionShop();
  const q = h.db.shop_question.find((row) => row.status === 'open');
  const WORDS = 'the 60g one';

  const bot = await makeRoutingBot();
  const intake = makeIntake([textUpdate({ updateId: 4, messageId: 903, text: WORDS })]);
  const fetch = intake.telegram.getUpdates;
  intake.telegram.getUpdates = async (args) => {
    const updates = await fetch(args);
    // The SAME words land first - the redelivery case exactly.
    await commands.answerQuestion({
      shopRef: REF, actor: ACTOR, questionKey: q.question_key,
      answerText: WORDS, answerSource: 'typed',
    }, h.deps);
    return updates;
  };

  const report = await runOnce(h.deps, { householdId: HOUSEHOLD_ID, bot, intake });

  assert.equal(report.intake.claimed, 1,
    'a redelivered answer was not claimed, so it will be eaten as a shopping list');
  assert.equal(report.intake.received, 0, 'a redelivered answer became a shopping list');
  assert.equal(report.answers.filter((a) => typeof a.error === 'string').length, 0,
    'a genuine redelivery was reported as a dropped answer');
});

test('B15-04 AC1: a clarification round key is still `q`+8 hex - the round NEVER reaches the key', () => {
  // The structural half of the same fact, pinned against literal shapes so a
  // future "readable key" refactor cannot quietly reintroduce the storm.
  for (const round of [1, 2, 3, 7, 9, 13, 17, 20, 99]) {
    const k = questionKeyFor('oven gloves', round);
    assert.match(k, /^q[0-9a-f]{8}$/, `round ${round} produced a key of a different shape: ${k}`);
    assert.equal(k.includes('#'), false, `round ${round} put a generation separator in a question key`);
  }
  // Distinct rounds are distinct questions - the round is in the HASH INPUT.
  assert.notEqual(questionKeyFor('oven gloves', 1), questionKeyFor('oven gloves', 2));
});

// =====================================================================
// WP-B15-08 AC5 - A TRAILING PACK SIZE IS NOT AN ORDER QUANTITY
//
// THE LIVE DEFECT, 2026-08-10. The photographed line "ARIEL 4in1 PODS 33" was
// read with quantity 33, and shop_line 21 / list item 230 both carried 33 -
// thirty-three PACKS of laundry pods, roughly GBP 350. The 33 is printed on the
// box; it is part of the product's identity, not a number Warwick wrote.
//
// ── THE ASYMMETRY THIS RULE RESTS ON, STATED SO IT CAN BE ARGUED WITH ───────
// On a handwritten list the quantity is written BEFORE the item, essentially
// always - every one of Warwick's own examples does it ("9 ROLLS", "16
// CAPSULES", "4 x 500ml", "4 x 4pts ARLA", "2pkts TWIX"). A number at the END
// of a product name is part of the name: a pod count, an SPF, WD-40, omega 3.
// So the guard fires ONLY on a trailing bare integer, and ONLY when the
// quantity the reader reported is that very number - which is the evidence
// that the number was lifted off the end of the name rather than read as a
// separate instruction.
//
// COST OF BEING WRONG, both directions, because this is a judgement:
//   wrong here  -> 1 pack instead of 2, visible in the note, one tap to fix.
//   wrong today -> 33 packs of pods, about GBP 350, discovered at the door.
// =====================================================================

test('AC5 the trailing-pack-size rule fires ONLY on a trailing bare integer', () => {
  // FIRES: the number is at the end of a name that has real words before it.
  assert.equal(trailingPackSize('ARIEL 4in1 PODS 33'), 33);
  assert.equal(trailingPackSize('finish dishwasher tablets 60'), 60);

  // DOES NOT FIRE - every leading-quantity form Warwick named. Breaking any of
  // these would be worse than the bug being fixed.
  assert.equal(trailingPackSize('9 ROLLS'), null);
  assert.equal(trailingPackSize('16 CAPSULES'), null);
  assert.equal(trailingPackSize('4 x 500ml'), null);
  assert.equal(trailingPackSize('4 x 4pts ARLA'), null);
  assert.equal(trailingPackSize('2pkts TWIX'), null);

  // DOES NOT FIRE - a size/unit token is not a bare integer.
  assert.equal(trailingPackSize('yazoo 400ml'), null);
  assert.equal(trailingPackSize('milk 2L'), null);
  assert.equal(trailingPackSize('tuna 500g'), null);

  // DOES NOT FIRE - a reading that is ONLY a number has no name to carry a
  // pack size, and a glued form is not a trailing token at all.
  assert.equal(trailingPackSize('33'), null);
  assert.equal(trailingPackSize('7up'), null);
  assert.equal(trailingPackSize(''), null);
  assert.equal(trailingPackSize(null), null);
});

test('AC5 a reading is corrected ONLY when the reported quantity IS the trailing number', () => {
  const corrected = withoutTrailingPackSizes([
    // The live defect: 33 reported, 33 printed on the end of the name.
    { line_no: 1, raw_reading: 'ARIEL 4in1 PODS 33', quantity: 33 },
    // The SAME name, but the reader read no quantity off it. Nothing to correct.
    { line_no: 2, raw_reading: 'ARIEL 4in1 PODS 33', quantity: null },
    // The SAME name with a quantity that is NOT the trailing number - Warwick
    // genuinely asked for two boxes. Left exactly alone.
    { line_no: 3, raw_reading: 'ARIEL 4in1 PODS 33', quantity: 2 },
    // Leading quantities, untouched.
    { line_no: 4, raw_reading: '9 ROLLS', quantity: 9 },
    { line_no: 5, raw_reading: '4 x 4pts ARLA', quantity: 4 },
    { line_no: 6, raw_reading: '2pkts TWIX', quantity: 2 },
  ]);

  assert.equal(corrected[0].quantity, null, 'the pack size was still taken as an order quantity');
  assert.equal(corrected[0].raw_reading, 'ARIEL 4in1 PODS 33',
    'the raw reading must survive verbatim - the evidence is never edited');
  assert.equal(corrected[0].pack_size_reading, 33, 'the correction left no evidence behind it');
  assert.equal(corrected[1].quantity, null);
  assert.equal(corrected[1].pack_size_reading, undefined, 'nothing was corrected, so nothing may be claimed');
  assert.equal(corrected[2].quantity, 2, 'a genuine quantity was destroyed by the pack-size guard');
  assert.equal(corrected[3].quantity, 9);
  assert.equal(corrected[4].quantity, 4);
  assert.equal(corrected[5].quantity, 2);
});

test('AC5 END TO END: a photographed pack size never reaches the list as a quantity', async () => {
  const h = makeHarness({
    modelLines: [
      { line_no: 1, raw_reading: 'ARIEL 4in1 PODS 33', quantity: 33 },
      { line_no: 2, raw_reading: '3 gourmet cat food', quantity: 3 },
    ],
  });
  await receivePhoto(h);
  await commands.buildShop({ shopRef: REF, actor: ACTOR }, h.deps);
  await runPipeline(HANDLE, h.deps);   // transcribe
  await runPipeline(HANDLE, h.deps);   // interpret

  const ariel = h.db.shop_line.find((l) => l.raw_reading === 'ARIEL 4in1 PODS 33');
  assert.equal(ariel.quantity, null, 'shop_line still carries 33 - thirty-three packs of pods');
  assert.equal(ariel.raw_reading, 'ARIEL 4in1 PODS 33', 'the photographed wording must survive verbatim');

  // add_list_item stores the schema default of 1 for an unknown quantity, which
  // is the right answer for a pack: one box.
  const item = h.db.shopping_list_items.find((i) => /ariel/i.test(i.item_name));
  assert.equal(item.requested_qty, 1, 'the list still asks for 33 - about GBP 350 of laundry pods');
  assert.match(String(item.note), /pack size/i,
    'the correction is invisible to Warwick - he cannot spot a wrong call he is never shown');

  // The other line is untouched: a leading quantity is a real instruction.
  const cat = h.db.shop_line.find((l) => l.raw_reading === '3 gourmet cat food');
  assert.equal(cat.quantity, 3, 'a leading quantity was destroyed - worse than the bug');
});

// =====================================================================
// WP-B15-10 - THE SHARED LIST, AND WHAT IS AND IS NOT FIXED HERE
//
// THE LIVE FAILURE, 2026-08-10. Warwick's real photograph minted a correct
// fresh shop, SHOP-2026-08-10-M64, which then bound to list_id 20 - the list of
// the CANCELLED SHOP-2026-08-10 - and item 210 from the dead week became an
// unanswerable question in his live shop. `listDateOf` strips the -M<n> suffix
// by design (WP-B15-07 needs the date part to survive every downstream pin),
// `buildGroundedIntents` puts that bare date on every intent as `list_date`,
// and `findOrCreateDraftList` selects on (household_id,
// status='next_week_draft', list_date) - so the fresh shop selected the dead
// shop's list. Cancelling a SHOP never changed the LIST.
//
// WHY NO SECOND LIST IS MINTED HERE. `asdair.shopping_lists` carries
// `unique (household_id, list_date)` (services/asdair/db/001_asdair_schema.sql:251,
// and NO later migration alters it). Two shops on one calendar date therefore
// CANNOT hold two list rows - that is the schema, not a choice this code makes,
// and changing it is a migration this Work Order may not write.
//
// The tests below pin what IS true at this head: the shared row is real, the
// dead week's item is PRESERVED EVIDENCE and is never repaired, and a
// redelivery of the same message still resolves to one list with one row per
// item. They deliberately do NOT assert that the dead item is excluded from the
// working set - it is not, at this head, and a test claiming otherwise would be
// the false green this suite exists to prevent.
// =====================================================================

/** The dead week: a draft list on the same date, carrying one item nobody in
 *  the new shop ever asked for. Synthetic; never real household data. */
function deadWeekSeed() {
  return {
    shopping_lists: [{ id: 20, household_id: HOUSEHOLD_ID, status: 'next_week_draft', list_date: '2026-08-03' }],
    shopping_list_items: [{
      id: 210, list_id: 20, item_name: 'HAM ON THE BONE', matched_product_id: null,
      requested_qty: 1, added_qty: null, status: 'needs_decision', price: null,
      note: 'typed the night before, for the week that was cancelled',
      one_week_only: false,
    }],
  };
}

/** Drive a fresh photo shop to the point where it has planned, recording every
 *  listItems set the planner was handed. */
async function planWithDeadWeek(seedOverride) {
  const handed = [];
  const h = makeHarness({
    seed: seedOverride === undefined ? deadWeekSeed() : seedOverride,
    modelLines: [
      { line_no: 1, raw_reading: '3 gourmet cat food', quantity: 3 },
      { line_no: 2, raw_reading: 'fruit splits', quantity: null },
    ],
  });
  h.deps.planBasket = (input) => {
    handed.push(input.listItems.map((i) => String(i.item_name)));
    return realPlanBasket(input);
  };
  await receivePhoto(h);
  await commands.buildShop({ shopRef: REF, actor: ACTOR }, h.deps);
  await runPipeline(HANDLE, h.deps);   // transcribe
  await runPipeline(HANDLE, h.deps);   // interpret
  await runPipeline(HANDLE, h.deps);   // plan
  return { h, handed };
}

test('WP-B15-22 RECLAIM: the fresh shop ADOPTS the pre-existing unowned date-keyed list rather than orphaning it, and stays SAFE because exclusion still runs', async () => {
  // ── THIS TEST'S THIRD NAME, AND THE FULL HISTORY BELONGS HERE ────────────
  // Round 1 (pre-019): "the fresh shop binds the SHARED list row" - true, and
  // it was the 2026-08-10 defect itself: date alone could not distinguish two
  // shops, so sharing was forced and unprotected.
  // Round 2 (WP-B15-21 integrated, no reclaim yet): rewritten to assert the
  // fresh shop gets its OWN separate list - correct for that intermediate
  // state, where findOrCreateDraftList's shop-owned branch never looked at a
  // pre-existing unowned list at all.
  // Round 3 (WP-B15-22 reclaim fix, THIS state): findOrCreateDraftList now
  // RECLAIMS a pre-existing UNOWNED same-date list instead of stranding it
  // behind a fresh one (asdairCommands.mjs's own `reclaimUnownedList`) - so
  // list 20 (unowned in this fixture - the dead shop 99 only ever CLAIMED
  // item 210 via a shop_line row, it never OWNED the list via shop_id) is
  // adopted by the fresh shop again. This is SAFE, unlike round 1, because
  // ownership and the foreign-claims exclusion mechanism are BOTH still live:
  // shop 99's shop_line claim on item 210 still excludes it from THIS shop's
  // plan (proven by the AC1 tests below, which still pass), and Postgres's
  // `uq_lists_shop` still refuses a second list for the SAME shop_id. Sharing
  // a list is no longer dangerous BECAUSE something excludes what does not
  // belong, not because sharing itself became impossible.
  const { h } = await planWithDeadWeek();
  assert.equal(h.db.shopping_lists.length, 1,
    'the pre-existing unowned list should be RECLAIMED, not left behind while a second one is minted');
  assert.equal(String(h.db.shop[0].list_id), '20',
    'the fresh shop must adopt the pre-existing unowned list for this exact date');
  const ownList = h.db.shopping_lists.find((l) => String(l.id) === String(h.db.shop[0].list_id));
  assert.ok(ownList, 'the shop points at a list row that does not exist');
  assert.equal(String(ownList.shop_id), String(h.db.shop[0].id),
    'the reclaimed list must now be OWNED by this shop\'s shop_id, not merely coincide on date');
});

test('B15-10 AC7: the dead week item is PRESERVED EVIDENCE - never deleted, never mutated', async () => {
  const { h } = await planWithDeadWeek();
  const dead = h.db.shopping_list_items.find((i) => String(i.id) === '210');
  assert.ok(dead, 'the dead week item was deleted - this order repairs no data');
  assert.equal(dead.item_name, 'HAM ON THE BONE', 'the dead item was renamed');
  assert.equal(dead.status, 'needs_decision', 'the dead item status was rewritten');
  assert.equal(dead.requested_qty, 1, 'the dead item quantity was rewritten');
  assert.equal(String(dead.list_id), '20', 'the dead item was moved to another list');
});

test('B15-10 AC2: a re-interpret of the SAME message mints no second list and no duplicate rows', async () => {
  const { h, handed } = await planWithDeadWeek();
  const listCount = h.db.shopping_lists.length;
  const before = h.db.shopping_list_items.filter((i) => String(i.list_id) === '20').length;
  const handedBefore = handed.length;

  // The same inbound message, interpreted again - a crash retry, a reprocess.
  // Nothing about the message changed, so nothing durable may be duplicated.
  h.db.shop[0].status = 'TRANSCRIBING';
  await runPipeline(HANDLE, h.deps);   // interpret again
  await runPipeline(HANDLE, h.deps);   // plan again

  assert.equal(h.db.shopping_lists.length, listCount,
    'a second list was minted for a message that had already been consumed');
  assert.equal(h.db.shopping_list_items.filter((i) => String(i.list_id) === '20').length, before,
    'the re-run duplicated list items. What carries this is the UPSERT on '
    + '(list_id, lower(item_name)) inside add_list_item - NOT the idempotency_key, which '
    + 'asdairCommands.execute never reads');
  assert.ok(handed.length > handedBefore, 'the re-run never reached the planner');
  assert.ok(handed[handed.length - 1].some((n) => /gourmet/i.test(n)),
    'the re-run lost this shop own items');
});

test('B15-10 AC2: the shop own items are all present exactly once after the re-run', async () => {
  // list_id is read off the shop rather than assumed, so this stays correct
  // whichever of the two WP-B15-22 mechanisms is in play (reclaim of the
  // pre-existing list 20, or a fresh one, should that mechanism ever change
  // again) - the fixture's own constant is never trusted directly.
  const { h } = await planWithDeadWeek();
  h.db.shop[0].status = 'TRANSCRIBING';
  await runPipeline(HANDLE, h.deps);
  const ownListId = String(h.db.shop[0].list_id);
  const names = h.db.shopping_list_items
    .filter((i) => String(i.list_id) === ownListId)
    .map((i) => String(i.item_name).toLowerCase());
  const dupes = names.filter((n, i) => names.indexOf(n) !== i);
  assert.deepEqual(dupes, [], `the same item exists twice on one list: ${JSON.stringify(dupes)}`);
  assert.ok(names.some((n) => /gourmet/i.test(n)));
  assert.ok(names.some((n) => /fruit splits/i.test(n)));
});

// =====================================================================
// WP-B15-10 AC4 - A SUGGESTION GOOD ENOUGH TO PRINT IS GOOD ENOUGH TO TAP
//
// Warwick was asked "Which product is BATCHLORS MAC N CHEESE?" on a card that
// PRINTED the answer as text he could not tap, because the two halves of the
// card draw on different tables:
//   buttons     <- interpret/resolveByCatalogue.js over asdair.regulars (ids)
//   suggestions <- skill/planner.js over asdair.products (NAMES ONLY)
// This closes the half that closes WITHOUT GUESSING: an EXACT normalised match
// onto a household regular becomes a real candidate carrying a real id.
//
// IT IS NOT A THRESHOLD AND MUST NEVER BECOME ONE. The same suggestion channel
// offered toothpaste for "any gloves" and tea towels for "ham on the bone".
// Nothing here resolves a line, ranks a near-miss, or removes a question.
// =====================================================================

const B15_10_REGULARS = [
  { id: 41, name: "Batchelors Pasta 'n' Sauce Mac 'n' Cheese Pasta Sachet 99g", aka: ['batchelors mac n cheese'] },
  { id: 42, name: 'Vanish Pre-Treat Gel', aka: [] },
];

test('B15-10 AC4: a printed suggestion that EXACTLY names a household regular becomes a tappable candidate', () => {
  const out = planCandidates(
    { item_name: 'BATCHLORS MAC N CHEESE', alternatives: [{ name: "Batchelors Pasta 'n' Sauce Mac 'n' Cheese Pasta Sachet 99g" }] },
    null,
    B15_10_REGULARS,
  );
  const hit = out.find((c) => Number(c.regular_id) === 41);
  assert.ok(hit, 'the answer was printed on the card and he still could not tap it');
  assert.equal(hit.label, "Batchelors Pasta 'n' Sauce Mac 'n' Cheese Pasta Sachet 99g",
    'the label must be the REGULAR own name - the row stores an id and the name comes from the id');
  assert.match(String(hit.source), /planner suggestion/, 'the provenance of a candidate must stay honest');
});

test('B15-10 AC4: an exact match on a household ALIAS also counts - it is still exact, never fuzzy', () => {
  const out = planCandidates(
    { item_name: 'x', alternatives: [{ name: 'BATCHELORS MAC N CHEESE' }] },
    null,
    B15_10_REGULARS,
  );
  assert.ok(out.some((c) => Number(c.regular_id) === 41),
    'a recorded household alias is an exact identity and must resolve like the name');
});

test('B15-10 AC4/AC5: a suggestion naming NOTHING in the catalogue NEVER acquires an id', () => {
  const out = planCandidates(
    { item_name: 'any gloves', alternatives: [{ name: 'Aquafresh Complete Care Whitening Toothpaste 75ml' }] },
    null,
    B15_10_REGULARS,
  );
  const toothpaste = out.find((c) => c.label === 'Aquafresh Complete Care Whitening Toothpaste 75ml');
  assert.ok(toothpaste, 'the suggestion must still be shown - this change closes no information');
  assert.equal(toothpaste.regular_id, undefined,
    'a near miss acquired an id. This is the real card Warwick received: auto-resolving this '
    + 'channel would have bought TOOTHPASTE for a glove request');
  assert.match(String(toothpaste.source), /no product id/);
});

test('B15-10 AC4/AC5: nothing is ranked and nothing is invented - a partial name is NOT a match', () => {
  const out = planCandidates(
    { item_name: 'x', alternatives: [{ name: 'Batchelors Pasta' }, { name: 'Vanish Pre Treat Gel Extra' }] },
    null,
    B15_10_REGULARS,
  );
  assert.equal(out.filter((c) => c.regular_id !== undefined).length, 0,
    'a substring was treated as an identity - that is the least-bad match this path forbids');
  assert.equal(out.length, 2, 'the suggestions must still be shown as text');
});

test('B15-10 AC4: the resolver own candidates still come FIRST and are never duplicated', () => {
  const out = planCandidates(
    { item_name: 'x', alternatives: [{ name: 'Vanish Pre-Treat Gel' }] },
    { alternatives: [{ regular_id: 42, name: 'Vanish Pre-Treat Gel' }] },
    B15_10_REGULARS,
  );
  assert.equal(out.filter((c) => Number(c.regular_id) === 42).length, 1,
    'the same product was offered twice under two provenances');
  assert.match(String(out[0].source), /resolveByCatalogue/, 'the trustworthy channel must lead');
});

test('B15-10 AC4: the two-argument form is byte-for-byte the behaviour it always had', () => {
  const planLine = { item_name: 'x', alternatives: [{ name: 'Vanish Pre-Treat Gel' }, { name: 'Something Else' }] };
  const interpreted = { alternatives: [{ regular_id: 42, name: 'Vanish Pre-Treat Gel' }] };
  assert.deepEqual(
    planCandidates(planLine, interpreted),
    planCandidates(planLine, interpreted, []),
    'the default for `regulars` changed behaviour - every existing caller would have moved',
  );
});

test('B15-10 AC4/AC5: the REMEMBERED-CHOICE validation set is deliberately NOT widened', () => {
  // resolveRememberedChoices calls the two-argument form on purpose: the set a
  // stored memory is VALIDATED against must stay the resolver's. Widening it
  // would let a planner suggestion revive a choice Warwick made, which is a
  // resolution wearing an offer's clothes.
  const narrow = planCandidates(
    { item_name: 'x', alternatives: [{ name: 'Vanish Pre-Treat Gel' }] },
    null,
  );
  assert.equal(narrow.filter((c) => c.regular_id !== undefined).length, 0,
    'the default widened the memory-validation set - a suggestion must never validate a memory');
});

test('B15-10 AC4 END TO END: the question card carries the id, so the printed answer is tappable', async () => {
  const h = makeHarness({
    modelLines: [
      { line_no: 1, raw_reading: '3 gourmet cat food', quantity: 3 },
      // Nothing in the catalogue reads as this, so it stays a real question -
      // which is the point: the fix must not make the question disappear.
      { line_no: 2, raw_reading: 'qqzz unreadable scrawl', quantity: null },
    ],
  });
  // The planner suggests, by NAME ONLY, a product that IS a household regular -
  // exactly the shape of the Batchelors line on Warwick's real card.
  h.deps.planBasket = (input) => {
    const out = realPlanBasket(input);
    for (const item of out.items || []) {
      if (/qqzz/i.test(String(item.item_name))) {
        item.alternatives = [{ name: 'Gourmet cat food' }];
      }
    }
    return out;
  };
  await receivePhoto(h);
  await commands.buildShop({ shopRef: REF, actor: ACTOR }, h.deps);
  await runPipeline(HANDLE, h.deps);   // transcribe
  await runPipeline(HANDLE, h.deps);   // interpret
  await runPipeline(HANDLE, h.deps);   // plan

  const q = h.db.shop_question.find((row) => /qqzz/i.test(String(row.question_text)));
  assert.ok(q, 'the unresolved line must still raise a real question - AC5, uncertainty is still spoken');
  const cands = typeof q.candidates === 'string' ? JSON.parse(q.candidates) : (q.candidates || []);
  const tappable = cands.find((c) => Number(c.regular_id) === 11);
  assert.ok(tappable,
    'the card printed the answer as untappable text. This is the exact defect Warwick hit: '
    + '"its bloody obvious!"');
  assert.equal(tappable.label, 'Gourmet cat food',
    'the offered label must be the regular own name, looked up from the id');
});

// =====================================================================
// WP-B15-10 - THE WORKING SET: EXCLUDE ONLY WHAT ANOTHER SHOP PROVABLY OWNS
//
// ⚠️ WP-B15-22 NOTE, READ BEFORE TOUCHING ANYTHING BELOW - THIS IS THE THIRD
// AND CURRENT STATE, superseding two earlier versions of this note. Read the
// per-test history comments below for the full three-round story; the
// summary:
//
//   Round 1 (pre-019): two DIFFERENT shops on one date were FORCED to share
//   one list, unprotected - the actual 2026-08-10 incident.
//   Round 2 (WP-B15-21 integrated, no reclaim): findOrCreateDraftList's
//   shop-owned branch never looked at a pre-existing unowned same-date list
//   at all - sharing became structurally impossible, but a genuine NEW gap
//   opened: an item added via the cockpit (or left on the unowned lane)
//   before this week's shop-owned list existed was durably ORPHANED. Reported
//   to Larry rather than fixed outside this Work Order's original surface.
//   Round 3 (THIS state - Larry extended file_surface to services/
//   control-plane/wp-d-proof/asdairCommands.mjs specifically to close it):
//   findOrCreateDraftList now RECLAIMS a pre-existing unowned same-date list
//   (reclaimUnownedList) rather than orphaning it. `sharedListSeed()`'s list
//   20 IS reclaimed by the fresh shop again - sharing is BACK, deliberately,
//   and it is SAFE this time because ownership (shop_id) and the foreign-
//   claims exclusion mechanism below are BOTH still fully live: a claim made
//   by ANOTHER shop's shop_line row is still excluded from THIS shop's plan
//   regardless of which list the item physically sits on. Round 1's danger
//   was sharing with NOTHING protecting it; round 3's sharing is protected
//   twice over (ownership prevents a genuinely different week's list from
//   ever colliding across two DIFFERENT dates; exclusion prevents a
//   genuinely foreign claim on the SAME list from ever reaching the plan).
//

// THE LIVE FAILURE, 2026-08-10. SHOP-2026-08-10-M64 bound to list_id 20, the
// list of the CANCELLED SHOP-2026-08-10, and item 210 from the dead week became
// an unanswerable question in Warwick's live shop.
//
// THE DIRECTION IS THE DESIGN. An ALLOWLIST keyed on shop_line links was built
// first and this suite killed it: stepInterpret is the ONLY caller of
// linkListItem, so a line added by stepApplyCorrections - Warwick correcting or
// adding one - and a line added by the cockpit's add_regular_to_next_week -
// which has no shop context and can never link - carry no claim at all, and the
// allowlist silently dropped both. Tests 2 and 3 below ARE that regression and
// must never be deleted.
//
// ⚠️ THE EXCLUSION STATEMENT IS ANSWERED BY test/fakePg.js ITSELF.
// A local harness used to answer it here by matching the exported SQL constant
// and applying its own hand-written semantics. It modelled the INTENT, not the
// statement - so inverting the SQL to the allowlist direction left EVERY
// behavioural test below GREEN, and only a shape test caught it. WP-B15-15 moved
// the handler into fakePg, derived from the statement text; the harness was
// deleted at integration (2026-08-10). These tests now go RED on that inversion.
// =====================================================================

/** A dead shop (id 99) that already owns list 20, plus an item nobody claims -
 *  the shape a cockpit `add_regular_to_next_week` leaves behind. */
function sharedListSeed() {
  return {
    shopping_lists: [{ id: 20, household_id: HOUSEHOLD_ID, status: 'next_week_draft', list_date: '2026-08-03' }],
    shopping_list_items: [
      {
        id: 210, list_id: 20, item_name: 'HAM ON THE BONE', matched_product_id: null,
        requested_qty: 1, added_qty: null, status: 'needs_decision', price: null,
        note: 'typed the night before, for the week that was cancelled', one_week_only: false,
      },
      {
        id: 211, list_id: 20, item_name: 'Cockpit Added Regular', matched_product_id: null,
        requested_qty: 2, added_qty: null, status: 'requested', price: null,
        note: 'added via cockpit', one_week_only: false,
      },
    ],
    // The DEAD shop's interpretation claims 210 - and claims NOTHING of 211,
    // because the cockpit route has no shop and never links.
    shop_line: [{
      id: 900, shop_id: 99, line_no: 1, raw_reading: 'HAM ON THE BONE', quantity: null,
      matched_regular_id: null, match_basis: null, match_confidence: null, alternatives: [],
      status: 'unmatched_new_item', confirmed_by: null, confirmed_at: null, corrected: false,
      list_item_id: 210,
    }],
  };
}

/** Drive a fresh shop onto the shared list, recording what the planner is handed. */
// `wire` is OPT-IN FAULT INJECTION ONLY. It has no default: the exclusion
// statement is answered by test/fakePg.js, and a default that intercepted it
// here is exactly what made these tests blind to the SQL until 2026-08-10.
async function planOnSharedList({ seed = sharedListSeed(), wire = null } = {}) {
  const handed = [];
  const logs = [];
  const h = makeHarness({
    seed,
    modelLines: [
      { line_no: 1, raw_reading: '3 gourmet cat food', quantity: 3 },
      { line_no: 2, raw_reading: 'fruit splits', quantity: null },
    ],
  });
  if (wire) wire(h);
  h.deps.log = (event, detail) => logs.push({ event, detail });
  const realPlan = h.deps.planBasket;
  h.deps.planBasket = (input) => {
    handed.push(input.listItems.map((i) => String(i.item_name)));
    return realPlan(input);
  };
  await receivePhoto(h);
  await commands.buildShop({ shopRef: REF, actor: ACTOR }, h.deps);
  await runPipeline(HANDLE, h.deps);   // transcribe
  await runPipeline(HANDLE, h.deps);   // interpret
  await runPipeline(HANDLE, h.deps);   // plan
  return { h, handed, logs, last: () => handed[handed.length - 1] || [] };
}

test('B15-10 AC1: the DEAD shop item is excluded from the plan', async () => {
  const { last } = await planOnSharedList();
  assert.ok(!last().some((n) => /HAM ON THE BONE/i.test(n)),
    `a cancelled week's item reached the plan: ${JSON.stringify(last())}`);
});

test('B15-10 AC1: Warwick is never ASKED about the dead shop item', async () => {
  const { h } = await planOnSharedList();
  const asked = h.db.shop_question.map((q) => String(q.question_text));
  assert.ok(asked.length > 0, 'no question at all was raised - the fixture stopped proving anything');
  assert.ok(!asked.some((t) => /HAM ON THE BONE/i.test(t)),
    `an unanswerable question from a cancelled week reached him: ${JSON.stringify(asked)}`);
});

test('WP-B15-22 GAP CLOSED: a cockpit item added to the UNOWNED lane before this week\'s shop-owned list exists SURVIVES - reclaimed, not orphaned', async () => {
  // ── THIS TEST'S HISTORY, IN FULL ──────────────────────────────────────────
  // 1. "AC1 REGRESSION THAT KILLED THE ALLOWLIST: an UNCLAIMED item still
  //    reaches the plan" - true while every shop shared one date-keyed list
  //    unconditionally (no ownership concept at all).
  // 2. "KNOWN GAP, REPORTED NOT FIXED" - WP-B15-21 alone (no reclaim yet)
  //    gave the fresh shop its OWN separate list and never looked at what was
  //    on the old unowned one - "Cockpit Added Regular" was genuinely,
  //    durably stranded. Reported to Larry rather than fixed outside surface.
  // 3. THIS STATE - Larry extended file_surface to
  //    services/control-plane/wp-d-proof/asdairCommands.mjs specifically to
  //    close this. findOrCreateDraftList now RECLAIMS a pre-existing unowned
  //    same-date list (reclaimUnownedList) rather than orphaning it: the item
  //    Warwick added from the cockpit lands on the SAME list his photo shop's
  //    own items land on, because that list is now his shop's list.
  const { last, h } = await planOnSharedList();
  assert.ok(last().some((n) => /Cockpit Added Regular/i.test(n)),
    `an item Warwick added from the cockpit was silently dropped: ${JSON.stringify(last())}`);
  const item = h.db.shopping_list_items.find((i) => /Cockpit Added Regular/i.test(String(i.item_name)));
  assert.ok(item, 'the cockpit item must still exist, not deleted');
  assert.equal(String(item.list_id), String(h.db.shop[0].list_id),
    'the cockpit item must be on THIS shop\'s own (reclaimed) list, not stranded on an orphaned one');
});

test('B15-10 AC1 REGRESSION THAT KILLED THE ALLOWLIST: a CORRECTED line still reaches the plan', async () => {
  // stepApplyCorrections writes through add_list_item and never links either.
  const { h, handed } = await planOnSharedList();
  await commands.correctLine({
    shopRef: REF, actor: ACTOR, itemName: 'silver polish', status: 'needs_decision',
  }, h.deps);
  // The shop parks on its OWN open question until that is settled, so settle it
  // deterministically - a skip needs no model - and let the shop replan.
  for (const q of h.db.shop_question.filter((row) => row.status === 'open')) {
    await commands.answerQuestion({
      shopRef: REF, actor: ACTOR, questionKey: q.question_key, skip: true,
    }, h.deps);
  }
  const before = handed.length;
  for (let i = 0; i < 4; i += 1) await runPipeline(HANDLE, h.deps);

  assert.ok(handed.length > before, 'the correction never reached a planning pass');
  const after = handed[handed.length - 1];
  assert.ok(after.some((n) => /silver polish/i.test(n)),
    `a line Warwick corrected was silently dropped: ${JSON.stringify(after)}`);
  assert.ok(!after.some((n) => /HAM ON THE BONE/i.test(n)),
    'the dead item came back once corrections were applied');
});

test('B15-10 AC1: an item BOTH shops claim is kept - mine wins over foreign', async () => {
  const seed = sharedListSeed();
  // The dead shop also asked for gourmet cat food. add_list_item upserts on
  // (list_id, lower(item_name)), so there is ONE row and both claim it.
  seed.shopping_list_items.push({
    id: 212, list_id: 20, item_name: 'Gourmet cat food', matched_product_id: null,
    requested_qty: 3, added_qty: null, status: 'requested', price: null, note: null,
    one_week_only: false,
  });
  seed.shop_line.push({
    id: 901, shop_id: 99, line_no: 2, raw_reading: '3 gourmet cat food', quantity: 3,
    matched_regular_id: 11, match_basis: 'exact alias', match_confidence: null, alternatives: [],
    status: 'matched', confirmed_by: null, confirmed_at: null, corrected: false, list_item_id: 212,
  });
  const { last } = await planOnSharedList({ seed });
  assert.ok(last().some((n) => /gourmet/i.test(n)),
    'a product THIS shop asked for was dropped because a dead shop asked for it too');
});

test('B15-10 AC1: the shop own items all reach the plan', async () => {
  const { last } = await planOnSharedList();
  assert.ok(last().some((n) => /gourmet/i.test(n)), 'a resolved line of THIS shop went missing');
  assert.ok(last().some((n) => /fruit splits/i.test(n)), 'an unresolved line of THIS shop went missing');
});

test('B15-10 FAIL OPEN: a claim read that FAILS filters NOTHING, and says so', async () => {
  // ── RESTORED TO ITS ORIGINAL MEANING, WP-B15-22 RECLAIM FIX ──────────────
  // With the reclaim fix (asdairCommands.mjs's reclaimUnownedList), the fresh
  // shop genuinely adopts list 20 - shop.list_id IS '20' again, so a failed
  // foreign-claims read is genuinely a read against THIS shop's own list, one
  // that DOES carry another shop's claim (item 210, claimed by dead shop 99's
  // shop_line row). That is exactly what "FAIL OPEN" needs to prove: with the
  // read broken, nothing can be excluded, so the dead shop's item is NOT
  // filtered out - the degraded path is the UNFILTERED one, on purpose, in
  // preference to risking a wrongful drop while the database is unhappy.
  const { h, last, logs } = await planOnSharedList({
    wire: (harness) => {
      const inner = harness.deps.readQuery;
      harness.deps.readQuery = async (text, params) => {
        if (text === shopLinesSql.SELECT_FOREIGN_CLAIMS_SQL) throw new Error('connection reset by peer');
        return inner(text, params);
      };
      return harness;
    },
  });

  // NOTHING is removed on a read this code could not make. Filtering on a
  // failed read would silently recreate the allowlist defect at the exact
  // moment the database is already unhappy.
  assert.ok(last().some((n) => /HAM ON THE BONE/i.test(n)),
    'a failed claim read still filtered the working set - the degraded path MUST be the unfiltered one');
  assert.ok(last().some((n) => /gourmet/i.test(n)));

  const failed = logs.filter((l) => l.event === 'foreign_claim_read_failed');
  assert.equal(failed.length > 0, true, 'the degradation was silent - a drop nobody can see is a drop nobody fixes');
  assert.match(String(failed[0].detail.detail), /connection reset by peer/, 'the reason must travel');
  assert.equal(String(failed[0].detail.shop_ref), REF);
  assert.equal(String(failed[0].detail.list_id), '20',
    'the read that failed must genuinely be against the shop\'s own (reclaimed) list 20');
  assert.ok(h.db.shop_question.length > 0, 'the shop must still make progress on a degraded read');
});

test('B15-10: the exclusion is PURE and its direction is pinned', () => {
  const items = [{ id: 1, item_name: 'mine' }, { id: 2, item_name: 'theirs' }, { id: 3, item_name: 'nobody' }];
  // Only the provably-foreign row goes.
  assert.deepEqual(
    excludeForeignListItems(items, ['2'], ['1']).map((i) => i.item_name),
    ['mine', 'nobody'],
    'an unclaimed row was dropped - unclaimed belongs to nobody and stays',
  );
  // Nothing provably foreign means nothing is touched.
  assert.deepEqual(excludeForeignListItems(items, [], []).length, 3);
  assert.deepEqual(excludeForeignListItems(items, null, null).length, 3);
  // Mine wins even when a foreign shop claims it too.
  assert.deepEqual(excludeForeignListItems(items, ['1', '2'], ['1']).map((i) => i.id), [1, 3]);
  // Ids compare across string/number - a bigint arrives from pg as either.
  assert.deepEqual(excludeForeignListItems(items, [2], [1]).map((i) => i.id), [1, 3]);
});

// =====================================================================
// WP-B15-10 - `lines_unresolved` VERSUS WP-B15-09'S BOARD: DISJOINT, NOT DUPLICATE
//
// Larry asked whether the board supersedes this card entirely. ESTABLISHED BY
// EXECUTION: it does not, and the two can never speak at the same time.
//
//   * `planOutcome` (stages.js:337-355) reaches AWAIT_LINE_RESOLUTION - the only
//     branch that queues this card - ONLY after `openQuestions > 0` has already
//     returned. So the card fires ONLY when there are ZERO open questions.
//   * The board's `blocked` is `outstanding.length > 0`, and `outstanding` is
//     the rows with `status === 'open'` (runtime.js boardStateOf). With zero
//     open questions the board either does not exist at all (queueBoard returns
//     `no questions`) or renders `blocked: false` - it positively says nothing
//     is blocking the shop.
//
// So in the one state this card describes, the board is silent or WRONG.
// Retiring it would restore the silent park Veritas D-2 was raised on. This
// test pins the DISJOINTNESS, which is what "never a second voice" actually
// requires - the card cannot duplicate a board that is not speaking.
// =====================================================================

test('B15-10: the lines_unresolved card can only fire where the board reports NOTHING open', () => {
  // The gate ordering is the guarantee. Any open question takes the first
  // branch, so the park - and therefore the card - is unreachable while the
  // board has anything outstanding to show.
  assert.equal(
    planOutcome({ openQuestions: 1, needsReview: false, interpretationConfirmed: true, unresolvedLines: 5 }).to,
    'NEEDS_DECISION',
    'the park became reachable with a question open - the card would then be a second voice '
    + 'beside the board, which is the defect WP-B15-09 closed',
  );
  const parked = planOutcome({
    openQuestions: 0, needsReview: false, interpretationConfirmed: true, unresolvedLines: 5,
  });
  assert.equal(parked.step, STEPS.AWAIT_LINE_RESOLUTION);
  assert.equal(parked.to, null, 'the park must not transition - that livelocks the shop');
});
