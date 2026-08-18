// =====================================================================
// WO-2026-08-18-04 - A WRONGLY ACCEPTED ANSWER IS NO LONGER PERMANENT.
//
// THE JOURNEY, THROUGH THE REAL SURFACE, ENDING IN A DIFFERENT BASKET.
//
// Warwick, 2026-08-18, unparking TEN gap 6:
//
//   "an answer that matches nothing at all is still accepted and cannot be
//    changed afterwards. That permanence is not acceptable as the completed
//    North Star."
//
// -- WHY THIS FILE ASSERTS ON THE PLANNER AND NOT ON THE ROW -----------------
//
// A correction that lands in a row nothing reads is the single most repeated
// defect class in this build, and it is invisible to any test that checks the
// row it wrote. So the headline assertion here is that THE SAME LINE RESOLVES
// TO A DIFFERENT CATALOGUE PRODUCT before and after, read out of the planner's
// own `decisions_applied` - not out of asdair.shop_question.
//
// -- AND WHY IT DRIVES THE SHOP TO READY_TO_SHOP FIRST ----------------------
//
// Because that is where Warwick is standing when he finds out. The plan_ready
// card is the FIRST thing that shows him what his answer did, and until this
// Work Order `READY_TO_SHOP` had exactly one outgoing edge - to
// `WAITING_FOR_BROWSER`. A correction made at the only moment he could have
// known to make one was therefore recorded, audited, and completely inert. A
// journey that stopped at NEEDS_DECISION would have passed against that defect.
//
// FULLY OFFLINE. Fake pg, injected bot, stubbed interpreter. No database, no
// network, no model spend, no credentials, no live runtime.
// =====================================================================

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

import { makeHarness, makeIntake, HOUSEHOLD_ID } from './test/harness.js';
import * as commands from './commands.js';
import { runPipeline } from './runPipeline.js';
import { runOnce } from './runtime.js';
import { decideNextStep, STEPS } from './stages.js';
import * as store from './store.js';
import { questionKeyFor } from './keys.js';

const REF = 'SHOP-2026-08-03';
const ACTOR = 'telegram:555';
const HANDLE = { shopRef: REF };
const here = import.meta.dirname;

/**
 * The stub interpreter, keyed on WARWICK'S WORDS.
 *
 * Deliberately a lookup rather than a constant: the whole proof is that two
 * different answers resolve to two different catalogue products, so a stub that
 * returned the same decision for anything would make the headline assertion
 * unfalsifiable. The catalogue is the harness's own (11 Gourmet, 12 Weetabix
 * Protein, 13 Arla) and the mapping is arbitrary - what matters is that it is
 * DIFFERENT per answer.
 */
const BY_WORDS = {
  'the mini milks': 12,
  'the fruity ones': 11,
  'the twisters': 13,
};

function makeInterpreter() {
  const calls = [];
  const fn = async (grounding) => {
    calls.push(grounding);
    const id = BY_WORDS[String(grounding.answer_text || '').trim()];
    if (!id) return { decision_kind: 'clarification_required', clarification_reason: 'unreadable' };
    return { decision_kind: 'existing_regular', decided_regular_id: id, model: 'stub' };
  };
  fn.calls = calls;
  return fn;
}

async function makeBot() {
  const router = await import('../bot/inboundRouter.js');
  const messages = await import('../bot/renderMessages.js');
  const callback = await import('../bot/callbackProtocol.js');
  const sent = [];
  return {
    sent,
    routeAsdairUpdate: router.routeAsdairUpdate,
    parseAnswerArg: callback.parseAnswerArg,
    messages: messages.MESSAGES,
    chatId: '555',
    send: async (chatId, message) => { sent.push({ chatId, message }); return { message_id: 900 + sent.length }; },
    answerTap: async () => true,
    resolveQuestionByMessage: () => null,
    resolveCandidate: () => null,
  };
}

/** A bare typed message. The shape Warwick actually uses: he types, he does not
 *  press buttons ("I dont have a bloody card I can type an answer"). */
function typed(updateId, text) {
  return {
    update_id: updateId,
    message: { message_id: 7000 + updateId, from: { id: 555 }, chat: { id: 555, type: 'private' }, text },
  };
}

/** Run the advancer to a standstill, returning the last plan step it took. */
async function drain(h, max = 12) {
  const steps = [];
  for (let i = 0; i < max; i += 1) {
    const r = await runPipeline(HANDLE, h.deps);
    steps.push(r);
    if (!r.stepped) break;
  }
  return steps;
}

const lastPlan = (steps) => steps.filter((s) => s.step === STEPS.PLAN).pop() || null;
const shopStatus = (h) => h.db.shop[0].status;
const rowOf = (h, key) => h.db.shop_question.find((q) => q.question_key === key);
const appliedFor = (plan, itemName) =>
  (plan.decisions_applied || []).find((a) => a.item_name === itemName) || null;

/**
 * A shop with TWO genuinely unresolved lines, both settled - one of them
 * WRONGLY - and driven all the way to READY_TO_SHOP.
 *
 * The mis-bind reproduces the 2026-08-17 shape: words meant for one question
 * recorded against another. answerQuestion is a compare-and-set, so on arrival
 * that write is permanent and (before this Work Order) cancelling the week was
 * the only way out.
 */
async function shopPlannedOnAWrongAnswer() {
  const interpretAnswer = makeInterpreter();
  const h = makeHarness({ depsOverride: { interpretAnswer } });
  const bot = await makeBot();

  await commands.receiveList({
    householdId: HOUSEHOLD_ID, listDate: '2026-08-03', sourceKind: 'text',
    rawText: '3 gourmet cat food\nfruit splits\nice lollies',
    actor: ACTOR, telegramChatId: '555', telegramMessageId: '900',
  }, h.deps);
  await commands.buildShop({ shopRef: REF, actor: ACTOR }, h.deps);
  await drain(h);

  const keys = h.db.shop_question.map((q) => q.question_key);
  assert.equal(keys.length, 2, 'the fixture needs exactly two open questions');
  assert.equal(keys[0], questionKeyFor('fruit splits'),
    'board ordinal 1 must be the fruit splits question, or the correction names the wrong line');

  // THE MIS-BIND. "the mini milks" answers the ICE LOLLIES question and is
  // written onto the FRUIT SPLITS one.
  await commands.answerQuestion({
    shopRef: REF, actor: ACTOR, questionKey: keys[0], answerText: 'the mini milks', answerSource: 'typed',
  }, h.deps);
  await commands.answerQuestion({
    shopRef: REF, actor: ACTOR, questionKey: keys[1], answerText: 'the twisters', answerSource: 'typed',
  }, h.deps);

  const steps = await drain(h);
  assert.equal(shopStatus(h), 'READY_TO_SHOP',
    'the shop must reach the state where Warwick first SEES what his answer did');

  // A pass with no inbound message, so the BOARD - the surface carrying the
  // numbers he corrects by - actually reaches his phone.
  await runOnce(h.deps, { householdId: HOUSEHOLD_ID, intake: makeIntake([]), bot });

  return { h, bot, keys, planBefore: lastPlan(steps), interpretAnswer };
}

// =====================================================================
// THE HEADLINE
// =====================================================================

test('⭐ AC1-AC4 THE JOURNEY: a wrong answer is superseded through the ordinary surface, and the SHOP CHANGES', async () => {
  const { h, bot, keys, planBefore } = await shopPlannedOnAWrongAnswer();

  // -- WHERE THE BASKET STOOD ON THE WRONG ANSWER ---------------------------
  const before = appliedFor(planBefore, 'fruit splits');
  assert.equal(before.regular_id, 12, 'the wrong answer must actually have reached the basket');
  assert.equal(before.question_key, keys[0]);

  // He has already asked for the basket. This is the ordinary case, not a
  // contrived one: he taps "Build ASDA basket" on the plan_ready card and only
  // then reads the line properly.
  await commands.requestBasketBuild({ shopRef: REF, actor: ACTOR }, h.deps);

  // -- AC3: THE CORRECTION, TYPED. NO SHELL, NO ID, NO OPERATOR -------------
  // One ordinary Telegram message, carrying a number he read off the board and
  // a word. Nothing technical, and nothing Larry has to do.
  const pass = await runOnce(h.deps, {
    householdId: HOUSEHOLD_ID,
    intake: makeIntake([typed(1, 'change 1: the fruity ones')]),
    bot,
  });
  // `claimed` is the ROUTER's count: the message was recognised as ours and
  // never offered to intake. `received` is intake minting a shop from it, which
  // is the worst outcome this path has and must be zero.
  assert.equal(pass.intake.claimed, 1,
    'the correction was not claimed by the router');
  assert.equal(pass.intake.received, 0,
    'the correction was handed to intake as a new shopping list - the worst outcome this path has');

  // -- AC4-b: THE TROLLEY DID NOT MOVE --------------------------------------
  // A basket-build request was outstanding the whole time. It must NOT have been
  // claimed: building from the very answer being superseded is worse than not
  // correcting at all.
  assert.equal(h.db.browser_build_request.length, 0,
    'a browser build was queued while a correction was outstanding');
  assert.equal(shopStatus(h), 'NEEDS_DECISION',
    'the shop did not come back from READY_TO_SHOP, so the correction is inert');

  // -- AC2: THE ORIGINAL SURVIVES -------------------------------------------
  const originalRow = rowOf(h, keys[0]);
  assert.equal(originalRow.answer_text, 'the mini milks',
    "the original answer was overwritten - AC2 fails even if everything else works");
  assert.equal(originalRow.status, 'answered');
  assert.ok(originalRow.answered_at, 'the original answer lost its timestamp');
  assert.equal(Number(originalRow.question_round), 1);

  // ...and the successor is CHAINED to it, which is what makes the trail
  // walkable rather than merely present.
  const successor = h.db.shop_question.find((q) => Number(q.question_round) === 2);
  assert.ok(successor, 'no round-2 question was opened, so nothing superseded anything');
  assert.equal(String(successor.parent_question_id), String(originalRow.id));
  assert.equal(successor.answer_text, 'the fruity ones');
  assert.equal(successor.status, 'answered');

  // ...and the audit row says WHO, WHEN, WHAT IT WAS and WHAT IT BECAME, in one
  // place, without joining anything. `actor` lives only here: shop_question has
  // never carried a column for it.
  const ledger = h.db.pipeline_command.filter((c) => c.command === 'correctAnswer');
  assert.equal(ledger.length, 1, 'exactly one correction was issued and one must be recorded');
  const audit = ledger[0].args;
  assert.equal(audit.actor, ACTOR);
  assert.equal(audit.superseded_answer_text, 'the mini milks');
  assert.equal(audit.superseded_answered_at, originalRow.answered_at);
  assert.equal(audit.answer_text, 'the fruity ones');
  assert.equal(audit.item_name, 'fruit splits');
  assert.equal(audit.successor_question_key, successor.question_key);
  assert.ok(ledger[0].created_at, 'the audit row carries no time of its own');

  // -- AC4: THE PLANNER ACTS ON THE CORRECTED ANSWER ------------------------
  // THE POINT OF THE WHOLE WORK ORDER. Read from the planner's own output, so a
  // correction that changed a row and nothing else fails here.
  const steps = await drain(h);
  const planAfter = lastPlan(steps);
  assert.ok(planAfter, 'the shop never re-planned, so nothing consumed the correction');

  const after = appliedFor(planAfter, 'fruit splits');
  assert.equal(after.regular_id, 11,
    'the SAME LINE still resolves to the product the WRONG answer chose - the correction never reached the decision point');
  assert.equal(after.question_key, successor.question_key,
    'the plan is still keyed to the superseded round');
  assert.notEqual(after.regular_id, before.regular_id,
    'before and after are identical, so this test would pass without any correction at all');

  // The rest of the basket is untouched: a correction changes one line.
  assert.equal(appliedFor(planAfter, 'ice lollies').regular_id, 13);
  assert.equal(planAfter.lines_unresolved.length, 0);

  // And the shop moves on from there, which is the second half of AC4.
  assert.equal(shopStatus(h), 'WAITING_FOR_BROWSER',
    'the shop did not resume after the correction - the outstanding basket request must be honoured once the line is settled');
  assert.equal(h.db.browser_build_request.length, 1,
    'the basket build is owed once the correction has settled, and must not be lost');
});

// =====================================================================
// AC1 - THE HALF THAT MUST NOT MOVE
// =====================================================================

test('AC1 a PLAIN reply still cannot overwrite a settled answer - first-answer-wins is intact', async () => {
  const { h, bot, keys } = await shopPlannedOnAWrongAnswer();

  // The same words, the same board number, the same surface - WITHOUT the
  // keyword. This is the accidental double tap and the second thought, and it
  // must do nothing, exactly as before this Work Order.
  await runOnce(h.deps, {
    householdId: HOUSEHOLD_ID,
    intake: makeIntake([typed(2, '1: the fruity ones')]),
    bot,
  });

  assert.equal(rowOf(h, keys[0]).answer_text, 'the mini milks',
    'a plain reply overwrote a settled answer - first-answer-wins has been dismantled');
  assert.equal(h.db.shop_question.filter((q) => Number(q.question_round) === 2).length, 0,
    'a plain reply opened a correction round - the accident and the intent are no longer distinguishable');
  assert.equal(h.db.pipeline_command.filter((c) => c.command === 'correctAnswer').length, 0,
    'a plain reply issued a correctAnswer command');
  assert.equal(shopStatus(h), 'READY_TO_SHOP', 'a plain reply moved the shop backwards');
});

test('AC1 the SAME correction arriving twice changes nothing the second time', async () => {
  const { h, bot } = await shopPlannedOnAWrongAnswer();
  const msg = 'change 1: the fruity ones';

  await runOnce(h.deps, { householdId: HOUSEHOLD_ID, intake: makeIntake([typed(3, msg)]), bot });
  const afterFirst = h.db.shop_question.length;
  await drain(h);

  // A Telegram redelivery reproduces the same text. The current answer for this
  // line ALREADY says what it asks for, so there is nothing to change and no
  // round is opened. Found by this test: the first implementation walked to the
  // chain tip and opened round 3, so every retry would have grown the chain by
  // one and made the audit trail unreadable.
  await runOnce(h.deps, { householdId: HOUSEHOLD_ID, intake: makeIntake([typed(4, msg)]), bot });
  assert.equal(h.db.shop_question.length, afterFirst,
    'a redelivered correction opened another round - every retry would add one');
  assert.equal(h.db.shop_question.filter((q) => Number(q.question_round) === 3).length, 0);
  assert.equal(h.db.shop_question.filter((q) => Number(q.question_round) === 2).length, 1);
});

test('AC1 correcting TWICE walks the chain - the second change is not lost behind the first', async () => {
  const { h, bot } = await shopPlannedOnAWrongAnswer();

  await runOnce(h.deps, { householdId: HOUSEHOLD_ID, intake: makeIntake([typed(5, 'change 1: the fruity ones')]), bot });
  await drain(h);
  // He changes his mind again. The BOARD still numbers the original question 1,
  // so a naive implementation would collide on round 2's key and silently no-op
  // - his second change lost behind a receipt saying it landed.
  await runOnce(h.deps, { householdId: HOUSEHOLD_ID, intake: makeIntake([typed(6, 'change 1: the twisters')]), bot });

  const round3 = h.db.shop_question.find((q) => Number(q.question_round) === 3);
  assert.ok(round3, 'the second correction was swallowed by the first');
  assert.equal(round3.answer_text, 'the twisters');

  const steps = await drain(h);
  const plan = lastPlan(steps);
  assert.equal(appliedFor(plan, 'fruit splits').regular_id, 13,
    'the basket followed the FIRST correction, not the latest thing he said');

  // Every earlier answer is still readable, in order, off the chain alone.
  const chain = [];
  let cursor = round3;
  while (cursor) {
    chain.unshift(cursor.answer_text);
    cursor = cursor.parent_question_id === null || cursor.parent_question_id === undefined
      ? null
      : h.db.shop_question.find((q) => String(q.id) === String(cursor.parent_question_id));
  }
  assert.deepEqual(chain, ['the mini milks', 'the fruity ones', 'the twisters'],
    'the audit chain does not read back as the sequence he actually gave');
});

// =====================================================================
// AC4-b - THE GATE, ASKED OF THE DECIDER DIRECTLY
// =====================================================================

test('AC4-b the runner will NOT queue a browser build while a correction is outstanding', async () => {
  const { h } = await shopPlannedOnAWrongAnswer();
  await commands.requestBasketBuild({ shopRef: REF, actor: ACTOR }, h.deps);

  // With ONLY the basket request outstanding, the runner queues the build.
  // Establishing that first is what makes the assertion below mean something:
  // otherwise "no build was queued" could be true for any reason at all.
  const withoutCorrection = decideNextStep(await store.readSnapshot(h.deps, HANDLE));
  assert.equal(withoutCorrection.step, STEPS.QUEUE_BROWSER_BUILD,
    'the control case does not queue a build, so the assertion below proves nothing');

  await commands.correctAnswer({
    shopRef: REF, actor: ACTOR, questionKey: h.db.shop_question[0].question_key,
    answerText: 'the fruity ones', answerSource: 'typed',
  }, h.deps);

  const withCorrection = decideNextStep(await store.readSnapshot(h.deps, HANDLE));
  assert.equal(withCorrection.step, STEPS.REOPEN_FOR_CORRECTION,
    'a basket build outranked an outstanding correction');
  assert.equal(withCorrection.to, 'NEEDS_DECISION');
});

test('AC4-b a question open on an ALREADY PLANNED shop blocks the basket too, whatever opened it', async () => {
  // The fail-safe half. Before this Work Order the READY_TO_SHOP branch consulted
  // only the pending basket request and never looked at open questions at all,
  // so a shop that acquired one after planning would have shopped straight past
  // it. Driven through the real store rather than a hand-built snapshot.
  const { h } = await shopPlannedOnAWrongAnswer();
  await commands.requestBasketBuild({ shopRef: REF, actor: ACTOR }, h.deps);
  await h.deps.shopStore.openQuestion({
    shop_id: h.db.shop[0].id,
    question_key: 'qLATEONE1',
    question_text: 'Which product is "something else"?',
    candidates: [],
  });

  const next = decideNextStep(await store.readSnapshot(h.deps, HANDLE));
  assert.equal(next.step, STEPS.REOPEN_FOR_CORRECTION,
    'a basket build was queued over an open question on a planned shop');
  assert.equal(next.to, 'NEEDS_DECISION');
  assert.equal(h.db.browser_build_request.length, 0);
});

// =====================================================================
// THE REFUSALS - a correction that cannot be made to work is REFUSED LOUDLY
// =====================================================================

test('correctAnswer ANSWERS an open question rather than superseding anything', async () => {
  const interpretAnswer = makeInterpreter();
  const h = makeHarness({ depsOverride: { interpretAnswer } });
  await commands.receiveList({
    householdId: HOUSEHOLD_ID, listDate: '2026-08-03', sourceKind: 'text',
    rawText: '3 gourmet cat food\nfruit splits', actor: ACTOR,
    telegramChatId: '555', telegramMessageId: '900',
  }, h.deps);
  await commands.buildShop({ shopRef: REF, actor: ACTOR }, h.deps);
  await drain(h);

  // "change 3" against a line whose newest round is still OPEN. Nothing is
  // settled, so nothing is superseded - and answering an open row overwrites
  // nothing, so AC1 is not in play at all.
  //
  // REFUSING HERE WAS THE FIRST DESIGN AND IT WAS WRONG: the throw propagates
  // into the inbound claim path, the claim is declined, and his words go on to
  // intake as a NEW SHOPPING LIST. Protecting a rule that was not in danger, at
  // the cost of the worst failure this system has.
  const res = await commands.correctAnswer({
    shopRef: REF, actor: ACTOR, questionKey: h.db.shop_question[0].question_key,
    answerText: 'the fruity ones',
  }, h.deps);

  assert.equal(res.answered_open_round, true);
  assert.equal(res.corrected, false, 'nothing was settled, so nothing may be reported as corrected');
  assert.equal(h.db.shop_question.length, 1, 'answering an open round must not open a new one');
  assert.equal(h.db.shop_question[0].answer_text, 'the fruity ones');
  assert.equal(h.db.shop_question[0].status, 'answered');
});

test('correctAnswer REFUSES a correction with no replacement answer', async () => {
  const { h, keys } = await shopPlannedOnAWrongAnswer();
  await assert.rejects(
    () => commands.correctAnswer({ shopRef: REF, actor: ACTOR, questionKey: keys[0] }, h.deps),
    /answerText/,
    'a bare "change 3:" must not be able to wipe a settled answer to null',
  );
  assert.equal(rowOf(h, keys[0]).answer_text, 'the mini milks');
});

test('correctAnswer REFUSES rather than writing a successor the planner could never find', async () => {
  // THE SILENT FAILURE THIS GUARD EXISTS TO CONVERT INTO A LOUD ONE.
  // applyDecisionsToPlan walks questionKeyFor(item_name, round) upward from
  // round 1, so a successor whose key does not derive from the same name at the
  // next round is invisible: recorded, audited, and inert. Simulated by taking
  // the name away from a settled question, which is exactly the state a legacy
  // or hand-written row could be in.
  const { h, keys } = await shopPlannedOnAWrongAnswer();
  const row = rowOf(h, keys[0]);
  row.list_item_id = null;

  await assert.rejects(
    () => commands.correctAnswer({
      shopRef: REF, actor: ACTOR, questionKey: keys[0], answerText: 'the fruity ones',
    }, h.deps),
    /cannot reproduce question key/,
    'a successor was written from a name that does not derive this key - the correction would be inert',
  );
  assert.equal(h.db.shop_question.filter((q) => Number(q.question_round) === 2).length, 0,
    'a refused correction opened a round anyway');
});

// =====================================================================
// THE 17 AUGUST RESIDUAL - the rows this Work Order was commissioned for
// =====================================================================

test('the corpus residual: rows 6 and 8 bound WITHOUT an established target, and are now correctable', () => {
  // WO-2026-08-18-03 established, against the nine real rows, that policy A
  // refuses a CONTRADICTING answer (rows 4 and 5) and still BINDS an answer that
  // names nothing at all (rows 6 and 8). Warwick acknowledged that residual and
  // refused to accept it as permanent. This assertion pins WHICH rows the
  // residual is, against the committed corpus, so the thing this Work Order
  // closes cannot quietly become a different thing.
  const corpus = JSON.parse(fs.readFileSync(
    path.join(here, 'testdata', '2026-08-17-shop-33-answers.json'), 'utf8',
  ));
  // TWO different reasons produce `answersQuestion: null`, and only one of them
  // is the residual. Rows 7 and 9 were NEVER RECORDED on the real run - there is
  // no answer to correct. Rows 6 and 8 carry Warwick's actual words against no
  // established target, which is the answer that binds and could not be taken
  // back. Filtering on the null alone conflates the two, which is exactly the
  // kind of quiet scope drift this pin exists to catch - and did.
  const neverRecorded = corpus.rows.filter((r) => r.establishment === 'never-recorded').map((r) => r.n);
  assert.deepEqual(neverRecorded, [7, 9], 'the never-recorded rows moved');

  const unestablished = corpus.rows
    .filter((r) => r.answersQuestion === null && r.answerText !== null)
    .map((r) => r.n);
  assert.deepEqual(unestablished, [6, 8],
    'the corpus residual moved - re-read WO-2026-08-18-03 AC4 before trusting this Work Order scope');

  // And each of them names a real line, so a correction has something to be
  // ABOUT. A residual against an unnamed line could not be corrected by number.
  for (const n of unestablished) {
    const row = corpus.rows[n - 1];
    assert.ok(typeof row.item === 'string' && row.item.trim() !== '');
    assert.ok(typeof row.answerText === 'string' && row.answerText.trim() !== '');
  }
});

test('the corpus residual, REPLAYED: a wrongly bound real answer is superseded and the basket follows', async () => {
  // The same journey as the headline, driven by Warwick's OWN WORDS from the
  // 17 August run rather than by invented ones. Row 6 - "there is a rule about
  // this" - is an answer that establishes nothing, binds anyway, and until now
  // could never be taken back.
  const corpus = JSON.parse(fs.readFileSync(
    path.join(here, 'testdata', '2026-08-17-shop-33-answers.json'), 'utf8',
  ));
  const row6 = corpus.rows[5];

  const interpretAnswer = makeInterpreter();
  const h = makeHarness({ depsOverride: { interpretAnswer } });
  const bot = await makeBot();

  await commands.receiveList({
    householdId: HOUSEHOLD_ID, listDate: '2026-08-03', sourceKind: 'text',
    rawText: '3 gourmet cat food\nfruit splits\nice lollies',
    actor: ACTOR, telegramChatId: '555', telegramMessageId: '900',
  }, h.deps);
  await commands.buildShop({ shopRef: REF, actor: ACTOR }, h.deps);
  await drain(h);
  const keys = h.db.shop_question.map((q) => q.question_key);

  // HIS REAL WORDS, on a question they do not answer. The interpreter cannot
  // read them either, so this settles as a clarification - which is the honest
  // outcome and is still a settled row he could not previously change.
  await commands.answerQuestion({
    shopRef: REF, actor: ACTOR, questionKey: keys[0],
    answerText: row6.answerText, answerSource: 'typed',
  }, h.deps);
  await commands.answerQuestion({
    shopRef: REF, actor: ACTOR, questionKey: keys[1], answerText: 'the twisters', answerSource: 'typed',
  }, h.deps);
  await drain(h);
  await runOnce(h.deps, { householdId: HOUSEHOLD_ID, intake: makeIntake([]), bot });

  assert.equal(rowOf(h, keys[0]).answer_text, row6.answerText,
    'the fixture must actually carry his real words');

  await runOnce(h.deps, {
    householdId: HOUSEHOLD_ID,
    intake: makeIntake([typed(9, 'change 1: the fruity ones')]),
    bot,
  });
  const plan = lastPlan(await drain(h));

  assert.equal(appliedFor(plan, 'fruit splits').regular_id, 11,
    'his real 17 August answer could still not be taken back');
  assert.equal(rowOf(h, keys[0]).answer_text, row6.answerText,
    'his exact original words were destroyed by the correction');
});
