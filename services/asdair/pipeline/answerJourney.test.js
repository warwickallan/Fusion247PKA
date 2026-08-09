// =====================================================================
// BUILD-015 AsdAIr WP-B15-2 - answerJourney.test.js
//
// THE PRODUCT OUTCOME, END TO END, THROUGH THE REAL ADVANCER.
//
// decisionSpine.test.js proves the PARTS: the vocabulary, the refusals, the
// pure transformation, the gate. This file proves the JOURNEY - that a real
// answer, entering by the real command surface, travelling through the real
// runPipeline steps and the real shopStore writers, ends with a line in this
// week's basket that is genuinely different.
//
// That distinction is the whole reason this file exists separately. A suite
// can be entirely green over correct parts that are not wired to each other:
// `buildAnswerLearning` and `recordAnswerLearning` were both complete, both
// tested, and had ZERO production callers, so every answer Warwick ever gave
// died with the shop that asked for it. Unit tests did not catch it because
// each unit was fine. Only the journey shows the gap.
//
// The ONLY stub is the model itself, injected at `deps.interpretAnswer`. Zero
// model spend, and the stub records that it was called so the deterministic
// path can be proven NOT to call it.
//
// FULLY OFFLINE. No database, no network, no model, no credentials.
// =====================================================================

import test from 'node:test';
import assert from 'node:assert/strict';

import { makeHarness, HOUSEHOLD_ID } from './test/harness.js';
import * as commands from './commands.js';
import { runPipeline } from './runPipeline.js';
import { STEPS } from './stages.js';
import { questionKeyFor } from './keys.js';

const REF = 'SHOP-2026-08-03';
const ACTOR = 'telegram:555';
const HANDLE = { shopRef: REF };

async function receiveText(h, text = '3 gourmet cat food\nfruit splits') {
  return commands.receiveList({
    householdId: HOUSEHOLD_ID, listDate: '2026-08-03', sourceKind: 'text',
    rawText: text, actor: ACTOR, telegramChatId: '555', telegramMessageId: '900',
  }, h.deps);
}

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

/**
 * A recording stub for the bounded interpreter.
 *
 * It returns whatever the test tells it to and counts its calls, so "a button
 * spends no model call" is proven by a NUMBER rather than by inspection.
 */
function makeInterpreter(returns) {
  const calls = [];
  const fn = async (grounding) => {
    calls.push(grounding);
    return typeof returns === 'function' ? returns(grounding) : returns;
  };
  fn.calls = calls;
  return fn;
}

/** Drive a fresh shop to its first open question and return the key. */
async function toFirstQuestion(h) {
  await receiveText(h);
  await commands.buildShop({ shopRef: REF, actor: ACTOR }, h.deps);
  await drain(h);
  assert.equal(shopStatus(h), 'NEEDS_DECISION', 'the shop must be waiting on a human');
  assert.equal(h.db.shop_question.length, 1);
  return h.db.shop_question[0].question_key;
}

// =====================================================================
// AC3 - THE FREE-TEXT JOURNEY, END TO END
// =====================================================================

test('AC3 JOURNEY: free text -> interpreter -> structured decision -> a CHANGED line', async () => {
  const interpretAnswer = makeInterpreter({
    decision_kind: 'existing_regular',
    decided_regular_id: 11,
    forward_intent: 'unclear',
    model: 'gpt-5.6-terra',
  });
  const h = makeHarness({ depsOverride: { interpretAnswer } });
  const key = await toFirstQuestion(h);

  // Warwick replies in normal English. Not a candidate label - prose.
  await commands.answerQuestion({
    shopRef: REF, actor: ACTOR, questionKey: key,
    answerText: 'the big bag of the fruity ones', answerSource: 'typed',
  }, h.deps);

  const replan = await runPipeline(HANDLE, h.deps);
  assert.equal(replan.step, STEPS.REPLAN);

  // THE MODEL WAS ASKED, AND ASKED ONCE.
  assert.equal(interpretAnswer.calls.length, 1, 'free text must reach the interpreter exactly once');

  // A STRUCTURED DECISION IS DURABLE.
  assert.equal(h.db.shop_decision.length, 1, 'the answer produced no durable structured decision');
  const decision = h.db.shop_decision[0];
  assert.equal(decision.decision_kind, 'existing_regular');
  assert.equal(Number(decision.decided_regular_id), 11);
  assert.equal(decision.interpreted_by, 'terra');
  assert.equal(decision.interpreted_model, 'gpt-5.6-terra');
  assert.equal(decision.forward_intent, 'unclear', 'the forward signal is STORED even though nothing routes it');

  // WARWICK'S EXACT WORDS SURVIVE, SEPARATELY FROM THE INTERPRETATION.
  assert.equal(h.db.shop_question[0].answer_text, 'the big bag of the fruity ones',
    "the interpretation must never overwrite Warwick's own words");

  // AND THE EVIDENCE OF WHAT THE MODEL WAS GIVEN IS RECORDED.
  assert.ok(decision.decision_evidence && decision.decision_evidence.grounding,
    'a terra decision with no grounding evidence must not exist');
  assert.equal(typeof decision.decision_evidence.grounding.candidates_offered, 'number');

  // ── THE POINT OF THE WHOLE WORK PACKAGE ─────────────────────────────────
  // The next plan pass consumes that decision and the LINE CHANGES.
  const plan = await runPipeline(HANDLE, h.deps);
  assert.equal(plan.to, 'READY_TO_SHOP', 'a decided line must let the shop become ready');
  assert.equal(plan.lines_unresolved.length, 0);
  assert.equal(plan.decisions_applied.length, 1, 'the decision was recorded but never applied to the plan');
  assert.equal(plan.decisions_applied[0].kind, 'existing_regular');
  assert.equal(plan.plan_summary.planned_add, 2,
    'the answered line must now be IN the basket, not held back');
  assert.equal(plan.plan_summary.needs_decision, 0);
});

test('AC3 JOURNEY: the interpreter is given the bounded evidence and nothing else', async () => {
  const interpretAnswer = makeInterpreter({ decision_kind: 'skip_this_week' });
  const h = makeHarness({ depsOverride: { interpretAnswer } });
  const key = await toFirstQuestion(h);
  await commands.answerQuestion({
    shopRef: REF, actor: ACTOR, questionKey: key, answerText: 'skip it', answerSource: 'typed',
  }, h.deps);
  await runPipeline(HANDLE, h.deps);

  const given = interpretAnswer.calls[0];
  // The closed list from the Work Order.
  for (const field of ['original_wording', 'question_text', 'answer_text', 'candidates', 'regulars', 'rules']) {
    assert.ok(field in given, `the interpreter was not given ${field}`);
  }
  assert.equal(given.answer_text, 'skip it', "the model must see Warwick's exact words");
  // And NOT the things it has no business deciding about.
  for (const forbidden of ['shop', 'deps', 'client', 'listItems', 'plan']) {
    assert.equal(forbidden in given, false,
      `the interpreter was handed ${forbidden} - it can decide things it was not asked about`);
  }
});

test('AC3 JOURNEY: a skip decision genuinely removes the line from this week', async () => {
  const h = makeHarness({
    depsOverride: { interpretAnswer: makeInterpreter({ decision_kind: 'skip_this_week' }) },
  });
  const key = await toFirstQuestion(h);
  await commands.answerQuestion({
    shopRef: REF, actor: ACTOR, questionKey: key, answerText: 'not this week', answerSource: 'typed',
  }, h.deps);
  await runPipeline(HANDLE, h.deps);
  const plan = await runPipeline(HANDLE, h.deps);

  assert.equal(plan.to, 'READY_TO_SHOP');
  assert.equal(plan.plan_summary.excluded_this_week, 1, 'the skipped line must leave the basket');
  assert.equal(plan.plan_summary.planned_add, 1, 'and only that line');
});

test('AC2 JOURNEY: a button naming an exact candidate spends NO model call', async () => {
  const interpretAnswer = makeInterpreter({ decision_kind: 'skip_this_week' });
  const h = makeHarness({ depsOverride: { interpretAnswer } });
  const key = await toFirstQuestion(h);

  // A text list produces no catalogue-resolver alternatives, so this question
  // legitimately carries no id-bearing candidate. The card contents are
  // planCandidates' job and are tested there; what is under test HERE is what
  // the answer path does with a tap, so the offered list is set directly.
  const withId = { label: 'Rowntrees Fruit Pastille Lolly', regular_id: 11, source: 'asdair.regulars (resolveByCatalogue)' };
  h.db.shop_question[0].candidates = [withId];

  await commands.answerQuestion({
    shopRef: REF, actor: ACTOR, questionKey: key,
    answerText: withId.label, answerSource: 'button',
  }, h.deps);
  await runPipeline(HANDLE, h.deps);

  assert.equal(interpretAnswer.calls.length, 0,
    'a tap naming an exact candidate must NOT spend a model call - the answer was already certain');
  assert.equal(h.db.shop_decision.length, 1);
  assert.equal(h.db.shop_decision[0].interpreted_by, 'human',
    'no model was asked, so no model may be recorded as the interpreter');
  assert.equal(Number(h.db.shop_decision[0].decided_regular_id), Number(withId.regular_id));
});

test('a runtime with NO interpreter wired does not guess - the line stays unresolved', async () => {
  // The honest failure mode. Nothing is invented, the shop does not become
  // ready, and the state is visible and recoverable on the next pass.
  const h = makeHarness();
  const key = await toFirstQuestion(h);
  await commands.answerQuestion({
    shopRef: REF, actor: ACTOR, questionKey: key, answerText: 'whatever he meant', answerSource: 'typed',
  }, h.deps);
  await runPipeline(HANDLE, h.deps);
  const plan = await runPipeline(HANDLE, h.deps);

  assert.equal(h.db.shop_decision.length, 0, 'no interpreter must mean no decision, never a guessed one');
  assert.notEqual(plan.to, 'READY_TO_SHOP');
  assert.equal(plan.step, STEPS.AWAIT_LINE_RESOLUTION);
});

test('ONE DECISION PER QUESTION, EVER: a re-run does not re-interpret or overwrite', async () => {
  const interpretAnswer = makeInterpreter({
    decision_kind: 'existing_regular', decided_regular_id: 11, model: 'gpt-5.6-terra',
  });
  const h = makeHarness({ depsOverride: { interpretAnswer } });
  const key = await toFirstQuestion(h);
  await commands.answerQuestion({
    shopRef: REF, actor: ACTOR, questionKey: key, answerText: 'the fruity ones', answerSource: 'typed',
  }, h.deps);

  await runPipeline(HANDLE, h.deps);
  const firstId = h.db.shop_decision[0].id;

  // Drive the whole thing again from durable state, as a restarted runner would.
  await drain(h);
  assert.equal(h.db.shop_decision.length, 1, 'a second decision row was written for the same question');
  assert.equal(h.db.shop_decision[0].id, firstId, 'the stored decision was replaced');
  assert.equal(interpretAnswer.calls.length, 1, 'the model was asked twice about the same answer');
});

// =====================================================================
// AC7 - THE CLARIFICATION ROUND, END TO END
// =====================================================================

test('AC7 JOURNEY: clarification_required opens a REAL round-2 question with a parent', async () => {
  const h = makeHarness({
    depsOverride: {
      interpretAnswer: makeInterpreter({
        decision_kind: 'clarification_required',
        clarification_reason: 'he said "the usual" and there are two of them',
      }),
    },
  });
  const key = await toFirstQuestion(h);
  const parentId = h.db.shop_question[0].id;

  await commands.answerQuestion({
    shopRef: REF, actor: ACTOR, questionKey: key, answerText: 'the usual', answerSource: 'typed',
  }, h.deps);
  await runPipeline(HANDLE, h.deps);

  assert.equal(h.db.shop_decision[0].decision_kind, 'clarification_required');

  // The next plan pass must ASK AGAIN rather than guess or stall.
  const plan = await runPipeline(HANDLE, h.deps);

  assert.equal(h.db.shop_question.length, 2, 'ambiguity must produce ANOTHER question, not a guess');
  const round2 = h.db.shop_question.find((q) => Number(q.question_round) === 2);
  assert.ok(round2, 'no round-2 question row was opened');
  assert.equal(String(round2.parent_question_id), String(parentId),
    'the clarification must name its parent so the chain is readable');
  assert.equal(round2.status, 'open');
  assert.equal(round2.question_key, questionKeyFor('fruit splits', 2),
    'the round-2 key must use the round-aware derivation');
  assert.notEqual(round2.question_key, key, 'a clarification must NOT reuse the parent key');

  // Round 1's answer is untouched - his exact words survive the second round.
  const round1 = h.db.shop_question.find((q) => q.id === parentId);
  assert.equal(round1.answer_text, 'the usual', "round 2 must not overwrite round 1's words");
  assert.equal(round1.status, 'answered', 'round 1 must NOT be forced back to open');

  // And the shop is waiting on a human on a real question - not livelocking.
  assert.equal(plan.to, 'NEEDS_DECISION',
    'with a real open clarification the shop waits on the human, via the ordinary branch');
  assert.notEqual(plan.to, 'READY_TO_SHOP');
});

test('AC7 JOURNEY: the clarification round is opened ONCE, not on every pass', async () => {
  const h = makeHarness({
    depsOverride: {
      interpretAnswer: makeInterpreter({
        decision_kind: 'clarification_required', clarification_reason: 'ambiguous',
      }),
    },
  });
  const key = await toFirstQuestion(h);
  await commands.answerQuestion({
    shopRef: REF, actor: ACTOR, questionKey: key, answerText: 'the usual', answerSource: 'typed',
  }, h.deps);
  await drain(h);

  const before = h.db.shop_question.length;
  await drain(h);
  await drain(h);
  assert.equal(h.db.shop_question.length, before,
    'repeated passes must not queue a new clarification each time - the key is stable and ON CONFLICT holds');
});

test('AC7 JOURNEY: answering the clarification round resolves the line and frees the shop', async () => {
  // Round 1 is ambiguous; round 2 is answered by tapping an exact candidate.
  let round = 0;
  const interpretAnswer = makeInterpreter(() => {
    round += 1;
    return round === 1
      ? { decision_kind: 'clarification_required', clarification_reason: 'two sizes' }
      : { decision_kind: 'existing_regular', decided_regular_id: 11 };
  });
  const h = makeHarness({ depsOverride: { interpretAnswer } });
  const key = await toFirstQuestion(h);

  await commands.answerQuestion({
    shopRef: REF, actor: ACTOR, questionKey: key, answerText: 'the usual', answerSource: 'typed',
  }, h.deps);
  await drain(h);

  const round2 = h.db.shop_question.find((q) => Number(q.question_round) === 2);
  assert.ok(round2, 'the clarification round must exist before it can be answered');

  await commands.answerQuestion({
    shopRef: REF, actor: ACTOR, questionKey: round2.question_key,
    answerText: 'the big one', answerSource: 'typed',
  }, h.deps);
  const steps = await drain(h);

  assert.equal(h.db.shop_decision.length, 2, 'each round records its own decision');
  assert.equal(shopStatus(h), 'READY_TO_SHOP',
    'once the clarification is answered the shop must finally be ready');
  assert.ok(steps.length > 0);
});
