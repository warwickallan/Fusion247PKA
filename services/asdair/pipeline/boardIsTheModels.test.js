// =====================================================================
// BUILD-015 AsdAIr WO-2026-08-18-07 - boardIsTheModels.test.js
//
// Runs under: node --test
//
// THE BOARD THE HUMAN TAPS, AND THE TAP THAT MUST NOT BIND.
//
// -- THE INCIDENT THESE PROOFS ARE ABOUT -------------------------------------
// Veritas graded BUILD-015 requirement 8 FAIL on 2026-08-18 against the durable
// rows that render Warwick's phone. All seven `asdair.shop_question` rows for
// shop 37 were `open`, at round 1, carrying the DETERMINISTIC SCORER's
// candidates:
//
//   76512  "Which product is '1 wet wipes'?"   -> ONE option, a tin of cat food
//   76514  "2 pkts ASDA plain toffees"         -> ham and eggs
//   76510  "1 x 4pk Ben & Jerrys cookie dough" -> ASDA 4 Beef Quarter Pounders
//   76509  (no candidates at all)
//
// The Work Order before this one inverted the decision path so the model
// decides. It did not change WHO BUILDS THE CARD. And because
// `applyDecisionsToPlan` runs AFTER `decideBasket` by design - "the human is
// last" - a tap on the cat food would have become a binding the model could not
// overturn.
//
// -- WHAT IS PROVEN HERE, AND WHAT IS DELIBERATELY NOT -----------------------
// AC1  the card is built from the model's own output, BY CONSTRUCTION.
// AC2  a tap on a candidate the model never produced does not bind - and
//      Warwick's genuine decisions still do, which is the half that must not
//      break.
// AC3  a condemned board is superseded rather than left standing, the shop
//      stops waiting on it, and the supersession terminates.
//
// NOT proven here, and it is not this file's to prove: that any of it has run
// in production. That needs a real photograph through the joined route, and
// component proof is not the production path.
//
// PURE ASCII. No database, no network, no model call.
// =====================================================================

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  applyDecisionsToPlan, classifyQuestionBoards, decisionBindsASupersededBoard,
  MODEL_CANDIDATE_SOURCE, DECISION_FLAGS,
} from './applyDecisions.js';
import { runPipeline, modelCardCandidates, planCandidates, MODEL_ASK_FLAG } from './runPipeline.js';
import { boardStateOf } from './runtime.js';
import { questionKeyFor } from './keys.js';
import * as commands from './commands.js';
import { makeHarness, makeCatalogue, HOUSEHOLD_ID } from './test/harness.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ACTOR = 'warwick';

/** Comments stripped before any structural assertion, for the reason
 *  decisionSpine.test.js states: a comment describing a rule must never be able
 *  to satisfy an assertion the CODE was supposed to. */
function stripComments(src) {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^\s*\/\/.*$/gm, '')
    .replace(/([^:])\/\/.*$/gm, '$1');
}

const runPipelineSrc = stripComments(fs.readFileSync(path.join(HERE, 'runPipeline.js'), 'utf8'));

// =====================================================================
// AC1 - THE BOARD IS BUILT FROM THE DECISION, BY CONSTRUCTION
// =====================================================================

test('AC1 LOCK 2: a line WITHOUT the model ask flag yields no candidates, however full its alternatives are', () => {
  // THE MUTATION, and it is the exact live defect. These are shop 37's own
  // scorer suggestions, in the scorer's own shape, sitting on the field the
  // card builder reads. Lock 1 (demoteDeterministicDecisions empties this field
  // before the decision runs) is a claim about call ORDER. This is the lock
  // that makes it a property of the DATA: without the model's own flag, nothing
  // leaves this function.
  const scorerLine = {
    item_name: '1 wet wipes',
    status: 'needs_decision',
    flags: ['matched from regulars', 'matched tolerantly'],
    alternatives: [
      { name: 'Gourmet GOURMET Mon Petit Intense Cod, Sardine, Salmon Wet Cat Food 6x50g', regular_id: 41, score: 0.25 },
      { name: 'ASDA 4 Beef Quarter Pounders 454g', regular_id: 42, score: 0.25 },
    ],
  };
  assert.deepEqual(modelCardCandidates(scorerLine), [],
    'a scorer suggestion reached a question card - this is the 2026-08-18 defect, restored');

  // And the same line, once the model has actually asked about it, DOES offer -
  // so the assertion above is not passing because the function returns [] for
  // everything it is given.
  const decided = { ...scorerLine, flags: [...scorerLine.flags, MODEL_ASK_FLAG] };
  assert.equal(modelCardCandidates(decided).length, 2,
    'the guard refuses everything - it is not discriminating, it is just empty');
});

test('AC1: every candidate that leaves the card builder carries model provenance', () => {
  const line = {
    item_name: 'ariel pods',
    flags: [MODEL_ASK_FLAG],
    alternatives: [
      { name: 'Ariel 3-in-1 Pods 38pk', regular_id: 21 },
      { name: 'Ariel All-in-1 Pods 50pk', regular_id: 22 },
      { name: 'something the household holds no row for', regular_id: null },
    ],
  };
  const out = modelCardCandidates(line);
  assert.equal(out.length, 3);
  for (const c of out) {
    assert.equal(c.source, MODEL_CANDIDATE_SOURCE, `candidate ${JSON.stringify(c)} carries no model provenance`);
  }
  // The id-bearing ones keep their id; the label-only one has NO id rather than
  // an invented one - the rule planCandidates already obeyed, and which must
  // not be lost in the move.
  assert.deepEqual(out.map((c) => (c.regular_id === undefined ? null : c.regular_id)), [21, 22, null]);
});

test('AC1: the two populations genuinely differ - planCandidates still returns the scorer population', () => {
  // planCandidates is NOT deleted: `resolveRememberedChoices` still uses its
  // two-argument form for a different purpose. This pins that the change is a
  // change of SOURCE and not a rename - if these two ever agree, the test above
  // stops proving anything at all.
  const line = {
    item_name: '1 wet wipes',
    flags: [],
    alternatives: [{ name: 'Gourmet cat food', regular_id: 41, score: 0.25 }],
  };
  assert.equal(planCandidates(line, null).length, 1,
    'planCandidates no longer returns the planner population - this test is now vacuous');
  assert.equal(modelCardCandidates(line).length, 0);
});

test('AC1 ENUMERATION: the ONE question-opening call site takes the model board and nothing else', () => {
  const sites = [...runPipelineSrc.matchAll(/deps\.shopStore\.openQuestion\s*\(\{/g)];
  assert.equal(sites.length, 1,
    `runPipeline.js has ${sites.length} openQuestion call sites. Exactly ONE is permitted - a second `
    + 'one is a board whose provenance nobody checked.');

  const at = sites[0].index;
  const body = runPipelineSrc.slice(at, runPipelineSrc.indexOf('});', at));
  assert.match(body, /candidates:\s*cardCandidates/,
    'the question card is no longer built from the model board');
  assert.doesNotMatch(body, /planCandidates\s*\(/,
    'planCandidates is building a question card again - that is the population that offered cat food');

  // -- AND WHERE `cardCandidates` COMES FROM, WHICH THE SLICE ABOVE CANNOT SEE
  // Found by mutation: restoring the defect at the ASSIGNMENT
  // (`const cardCandidates = planCandidates(...)`) left the call site above
  // byte-identical, so the two assertions above still passed while the card was
  // once again built by the scorer. The journey tests below caught it; this one
  // did not, and a structural control that misses the mutation it exists to
  // catch is worse than no structural control.
  const assignments = [...runPipelineSrc.matchAll(/const\s+cardCandidates\s*=\s*([A-Za-z_$][\w$]*)\s*\(/g)];
  assert.equal(assignments.length, 1,
    `cardCandidates is assigned at ${assignments.length} sites. Exactly ONE is permitted.`);
  assert.equal(assignments[0][1], 'modelCardCandidates',
    `the question board is built by ${assignments[0][1]}(), not by modelCardCandidates() - `
    + 'that is the population that offered a tin of cat food for "1 wet wipes"');
});

test('AC1 DRIFT GUARD: skill/decide.js still writes the exact flag the card builder keys on', () => {
  // MODEL_ASK_FLAG is MIRRORED, not imported: skill/ is outside this Work
  // Order's file surface. A mirrored literal is a drift risk and this is the
  // thing that closes it - if decide.js renames its flag, every card silently
  // goes empty, and this fails first and says why.
  const decideSrc = fs.readFileSync(path.join(HERE, '..', 'skill', 'decide.js'), 'utf8');
  assert.ok(decideSrc.includes(`'${MODEL_ASK_FLAG}'`),
    `skill/decide.js no longer writes the flag "${MODEL_ASK_FLAG}". runPipeline.modelCardCandidates `
    + 'keys on it, so every question card would silently lose its options.');
});

// =====================================================================
// AC2 - A TAP CANNOT OVERRIDE THE MODEL ON A LINE THE MODEL RESOLVED
// =====================================================================

const heldLine = (name) => ({
  item_name: name, status: 'needs_decision', planned_qty: 0, flags: [], requested_qty: 1,
});
const planWith = (...items) => ({ items, summary: {} });
const REGULARS = new Map([
  [41, { id: 41, name: 'Gourmet Mon Petit Wet Cat Food 6x50g' }],
  [7, { id: 7, name: 'ASDA Baby Wipes 12pk' }],
]);

const SCORER_BOARD = [{
  label: 'Gourmet GOURMET Mon Petit Intense Cod, Sardine, Salmon Wet Cat Food 6x50g',
  regular_id: 41,
  source: 'planner suggestion, matched to asdair.regulars by exact name',
}];

const MODEL_BOARD = [{
  label: 'Gourmet Mon Petit Wet Cat Food 6x50g',
  regular_id: 41,
  source: MODEL_CANDIDATE_SOURCE,
}];

function decisionOn(itemName, { candidates, regularId = 41, kind = 'existing_regular', round = 1 }) {
  return {
    question_key: questionKeyFor(itemName, round),
    question_id: '76512',
    question_round: round,
    decision_kind: kind,
    decided_regular_id: regularId,
    question_candidates: candidates,
  };
}

test('AC2 DIRECTION 1: a tap on a candidate the model NEVER produced does not bind', () => {
  const { plan, applied, unresolved } = applyDecisionsToPlan({
    plan: planWith(heldLine('1 wet wipes')),
    decisions: [decisionOn('1 wet wipes', { candidates: SCORER_BOARD })],
    questionKeyFor,
    regularsById: REGULARS,
  });

  assert.equal(plan.items[0].status, 'needs_decision',
    'the cat food bound to "1 wet wipes" - this is requirement 8, restored');
  assert.equal(plan.items[0].decided_regular_id, undefined);
  assert.ok(plan.items[0].flags.includes(DECISION_FLAGS.SUPERSEDED_BOARD),
    'the line does not say WHY the answer did not bind - a silent refusal is a lost answer');
  assert.equal(applied.length, 0);
  assert.equal(unresolved.length, 1);
  assert.equal(unresolved[0].superseded_board, true);
  assert.equal(Number(unresolved[0].question_round), 1);
  assert.equal(unresolved[0].question_id, '76512');
});

test('AC2 DIRECTION 2: the SAME decision on a MODEL board binds - Warwick still outranks the model', () => {
  // THE MUTATION. Exactly one string differs from the test above: the
  // candidate's `source`. The item, the decision, the id and the catalogue are
  // identical. If either test passed for some other reason, both would agree -
  // and they do not.
  const { plan, applied, unresolved } = applyDecisionsToPlan({
    plan: planWith(heldLine('1 wet wipes')),
    decisions: [decisionOn('1 wet wipes', { candidates: MODEL_BOARD })],
    questionKeyFor,
    regularsById: REGULARS,
  });

  assert.equal(plan.items[0].status, 'add', 'a genuine decision on a model board was refused');
  assert.equal(plan.items[0].decided_regular_id, 41);
  assert.equal(plan.items[0].matched_product, 'Gourmet Mon Petit Wet Cat Food 6x50g');
  assert.ok(plan.items[0].flags.includes(DECISION_FLAGS.DECIDED));
  assert.equal(applied.length, 1);
  assert.equal(unresolved.length, 0);
});

test('AC2: HIS OWN WORDS are never refused - an id that was not on the board binds', () => {
  // He typed "the Asda baby wipes". The interpreter resolved it to regular 7,
  // which the scorer board never offered. That is not a poisoned tap, and
  // refusing it would strand the shop on the very answer that fixes it.
  const { plan, unresolved } = applyDecisionsToPlan({
    plan: planWith(heldLine('1 wet wipes')),
    decisions: [decisionOn('1 wet wipes', { candidates: SCORER_BOARD, regularId: 7 })],
    questionKeyFor,
    regularsById: REGULARS,
  });
  assert.equal(plan.items[0].status, 'add', 'a typed answer was refused as though it were a tap');
  assert.equal(plan.items[0].decided_regular_id, 7);
  assert.equal(unresolved.length, 0);
});

test('AC2: a decision that binds NO identity is untouched by the rule', () => {
  for (const kind of ['skip_this_week', 'new_item']) {
    const { plan, applied } = applyDecisionsToPlan({
      plan: planWith(heldLine('1 wet wipes')),
      decisions: [{
        question_key: questionKeyFor('1 wet wipes', 1),
        question_id: '76512',
        question_round: 1,
        decision_kind: kind,
        decided_regular_id: null,
        decided_item_name: 'baby wipes',
        question_candidates: SCORER_BOARD,
      }],
      questionKeyFor,
      regularsById: REGULARS,
    });
    assert.equal(applied.length, 1, `${kind} on a scorer board was refused - it took no identity from it`);
    assert.notEqual(plan.items[0].status, 'needs_decision');
  }
});

test('AC2: the guard FAILS OPEN on an absent join and CLOSED on present evidence', () => {
  // A caller that does not supply `question_candidates` - every pre-existing
  // call site, and every test written before this rule - must behave exactly as
  // it did. The rule must never invent a refusal out of a missing join.
  assert.equal(decisionBindsASupersededBoard({ decided_regular_id: 41 }), false);
  assert.equal(decisionBindsASupersededBoard({ decided_regular_id: 41, question_candidates: [] }), false);
  assert.equal(decisionBindsASupersededBoard({ decided_regular_id: 41, question_candidates: SCORER_BOARD }), true);
  assert.equal(decisionBindsASupersededBoard({ decided_regular_id: 41, question_candidates: MODEL_BOARD }), false);
  // A string bigint from a driver that hands ids back as text must still match.
  assert.equal(decisionBindsASupersededBoard({
    decided_regular_id: '41',
    question_candidates: [{ regular_id: '41', source: 'planner suggestion (no product id)' }],
  }), true);
});

// =====================================================================
// AC3 - A CONDEMNED BOARD IS SUPERSEDED, NOT LEFT STANDING
// =====================================================================

const openQ = (over) => ({
  id: 1, status: 'open', question_round: 1, parent_question_id: null,
  list_item_id: 10, candidates: [], ...over,
});

test('AC3 CLASSIFIER: what AsdAIr is and is not entitled to wait on', () => {
  const scorer = openQ({ id: 76512, candidates: SCORER_BOARD });
  const model = openQ({ id: 76513, candidates: MODEL_BOARD });
  const empty = openQ({ id: 76509, candidates: [] });

  const beforeAnyDecision = classifyQuestionBoards([scorer, model, empty], { modelHasDecided: false });
  assert.deepEqual(beforeAnyDecision.condemned.map((q) => q.id).sort(), [76509, 76512],
    'a scorer board and an empty pre-decision board must both be condemned');
  assert.deepEqual(beforeAnyDecision.blocking.map((q) => q.id), [76513]);

  // Once the model HAS decided for this shop, an empty board is a legitimate
  // outcome - it can honestly have nothing to offer - and condemning it would
  // open a fresh round on every pass, forever.
  const afterADecision = classifyQuestionBoards([scorer, model, empty], { modelHasDecided: true });
  assert.deepEqual(afterADecision.condemned.map((q) => q.id), [76512]);
  assert.deepEqual(afterADecision.blocking.map((q) => q.id).sort(), [76509, 76513]);

  // A row with a successor is history, whatever it carries. This is what makes
  // the supersession terminate.
  const withSuccessor = classifyQuestionBoards(
    [scorer, openQ({ id: 99, question_round: 2, parent_question_id: 76512, candidates: MODEL_BOARD })],
    { modelHasDecided: false },
  );
  assert.deepEqual(withSuccessor.superseded.map((q) => q.id), [76512]);
  assert.deepEqual(withSuccessor.blocking.map((q) => q.id), [99]);
  assert.equal(withSuccessor.condemned.length, 0);

  // An ANSWERED row is not open, and is none of the three.
  const answered = classifyQuestionBoards([openQ({ id: 5, status: 'answered', candidates: SCORER_BOARD })], {});
  assert.equal(answered.blocking.length + answered.condemned.length + answered.superseded.length, 0);
});

test('AC3 CLASSIFIER MUTATION: it is the provenance string that condemns, nothing else', () => {
  const q = openQ({ id: 76512, candidates: [{ label: 'x', regular_id: 41, source: MODEL_CANDIDATE_SOURCE }] });
  assert.equal(classifyQuestionBoards([q], { modelHasDecided: true }).condemned.length, 0);
  const mutated = { ...q, candidates: [{ ...q.candidates[0], source: 'planner suggestion (no product id)' }] };
  assert.equal(classifyQuestionBoards([mutated], { modelHasDecided: true }).condemned.length, 1,
    'changing only the provenance string did not change the verdict - the classifier is not reading it');
});

test('AC3 BOARD: a superseded card LEAVES the board, and the ordinals do not move', () => {
  // The gate and the board must not disagree about which rows are history. A
  // condemned card that stops blocking the shop but stays on Warwick's phone
  // beside its own successor is the artefact still sitting in front of him -
  // cat food on one card, AsdAIr's real options on the next.
  const rows = [
    { id: 76512, status: 'open', question_key: 'k1', item_name: '1 wet wipes', question_round: 1, parent_question_id: null, candidates: SCORER_BOARD },
    { id: 76599, status: 'open', question_key: 'k2', item_name: '1 wet wipes', question_round: 2, parent_question_id: 76512, candidates: MODEL_BOARD },
    { id: 76600, status: 'open', question_key: 'k3', item_name: '2 pkts toffees', question_round: 1, parent_question_id: null, candidates: MODEL_BOARD },
  ];

  const state = boardStateOf(rows);
  const shown = state.outstanding.map((o) => o.questionKey);
  assert.deepEqual(shown, ['k2', 'k3'],
    'the superseded round-1 card is still on the board beside the card that replaced it');

  // THE ORDINALS ARE EACH ROW'S OWN INDEX OVER THE FULL LIST and do not shift
  // when a row is dropped from the display. A tap from a card sent before the
  // supersession therefore still addresses the question it always did - it is
  // refused as a stale card by the render contract, which is the correct
  // refusal, rather than silently resolving to a DIFFERENT line.
  assert.deepEqual(state.outstanding.map((o) => o.n), [2, 3]);
  assert.equal(state.byOrdinal.get(1).questionKey, 'k1',
    'the superseded row left the ordinal map - an old tap would now resolve to the wrong question');
  assert.equal(state.byOrdinal.size, 3);

  // MUTATION: break the parent link and the condemned card comes straight back.
  const orphaned = [rows[0], { ...rows[1], parent_question_id: null }, rows[2]];
  assert.deepEqual(boardStateOf(orphaned).outstanding.map((o) => o.questionKey), ['k1', 'k2', 'k3'],
    'the board is not reading parent_question_id at all - it dropped the row for some other reason');
});

test('AC3 ROUND WALK: a round-2 decision applies even when round 1 was never decided', () => {
  // THE LATENT DEFECT THIS WORK ORDER EXPOSED. The walk used to `break` on the
  // first round with no decision, on the ground that "rounds are opened
  // consecutively" - true only while the ONLY thing that opened round N+1 was a
  // round-N clarification decision. Supersession opens round 2 with round 1
  // UNDECIDED, so under the old break Warwick's answer to the new card would
  // have applied to nothing, and the shop would have sat unresolved while he
  // had already settled it.
  const { plan, applied } = applyDecisionsToPlan({
    plan: planWith(heldLine('1 wet wipes')),
    decisions: [{
      question_key: questionKeyFor('1 wet wipes', 2),
      question_id: '90',
      question_round: 2,
      decision_kind: 'existing_regular',
      decided_regular_id: 7,
      question_candidates: MODEL_BOARD,
    }],
    questionKeyFor,
    regularsById: REGULARS,
  });
  assert.equal(plan.items[0].status, 'add', 'the round-2 answer was lost behind an undecided round 1');
  assert.equal(applied.length, 1);
});

// =====================================================================
// AC1 + AC3 - THE JOURNEY, THROUGH THE REAL ADVANCER
// =====================================================================

const CAT_FOOD = {
  id: 11, name: 'Gourmet cat food', brand: 'Gourmet', category: 'pet',
  aka: ['gourmet cat food', 'gourmet'], typical_qty: 3, asda_product_id: 'A11', substitutes_allowed: false,
};
const WIPES_A = {
  id: 41, name: 'ASDA Baby Wipes 12pk', brand: 'ASDA', category: 'household',
  aka: ['wet wipes'], typical_qty: 1, asda_product_id: 'A41', substitutes_allowed: false,
};
const WIPES_B = {
  id: 42, name: 'ASDA Antibacterial Wipes 12pk', brand: 'ASDA', category: 'household',
  aka: ['wet wipes'], typical_qty: 1, asda_product_id: 'A42', substitutes_allowed: false,
};

const CATALOGUE = () => makeCatalogue({ regulars: [CAT_FOOD, WIPES_A, WIPES_B] });
const LIST = '3 gourmet cat food\n1 wet wipes';
const REF = 'SHOP-2026-08-18';
const HANDLE = { shopRef: REF };

/** The model, offering the two real variants it can see. */
const asksAboutWipes = (grounding) => (grounding.decision_line_nos || []).map((n) => ({
  line_no: n,
  verdict: 'ask',
  question: 'Which wipes?',
  candidates: [{ regular_id: 41 }, { regular_id: 42 }],
  reason: 'two grounded variants share this alias',
}));

async function drain(h, max = 12) {
  const steps = [];
  for (let i = 0; i < max; i += 1) {
    const r = await runPipeline(HANDLE, h.deps);
    steps.push(r);
    if (!r.stepped) break;
  }
  return steps;
}

async function shopAskingAboutWipes(script = {}) {
  const h = makeHarness({ catalogue: CATALOGUE(), ...script });
  await commands.receiveList({
    householdId: HOUSEHOLD_ID, listDate: '2026-08-18', sourceKind: 'text', rawText: LIST,
    actor: ACTOR, telegramChatId: '555', telegramMessageId: '900',
  }, h.deps);
  await commands.buildShop({ shopRef: REF, actor: ACTOR }, h.deps);
  const steps = await drain(h);
  return { h, steps };
}

const candidatesOf = (q) => (Array.isArray(q.candidates) ? q.candidates : JSON.parse(q.candidates || '[]'));

test('AC1 JOURNEY: every candidate on every card a real pass opens carries model provenance', async () => {
  const { h } = await shopAskingAboutWipes({ decisions: asksAboutWipes });

  const questions = h.db.shop_question;
  assert.ok(questions.length > 0, 'the shop opened no questions - this journey proves nothing');
  let offered = 0;
  for (const q of questions) {
    for (const c of candidatesOf(q)) {
      offered += 1;
      assert.equal(c.source, MODEL_CANDIDATE_SOURCE,
        `question ${q.question_key} offered a candidate from "${c.source}"`);
    }
  }
  assert.ok(offered >= 2, `only ${offered} candidate(s) reached a card - the assertion above ran on nothing`);
});

test('AC1 JOURNEY: a line the model could not settle gets an HONEST empty card, not a bare one', async () => {
  // The harness's DEFAULT decide returns `ask` with no candidates - "I could
  // not settle this". Question 76509 reached Warwick's phone in exactly that
  // state, with no options and no explanation, and it is the other half of the
  // requirement-8 defect. Provenance is what AC1 requires; saying so is what
  // stops an empty card being indistinguishable from a broken one.
  const { h } = await shopAskingAboutWipes();
  const q = h.db.shop_question[0];
  assert.equal(candidatesOf(q).length, 0);
  assert.match(q.question_text, /no suggestion it is confident in/i,
    'a card with no options and no explanation is question 76509, restored');
});

test('AC3 JOURNEY: a condemned board is SUPERSEDED and the shop stops waiting on it', async () => {
  const { h } = await shopAskingAboutWipes({ decisions: asksAboutWipes });
  const original = h.db.shop_question[0];
  assert.equal(original.status, 'open');

  // THE LIVE SHAPE, INJECTED. This is shop 37's board: the scorer's candidates
  // on an open round-1 row, and no decision evidence for the shop, because the
  // model had never been consulted when that row was written.
  original.candidates = SCORER_BOARD;
  const originalKey = original.question_key;
  const originalText = original.question_text;
  h.db.pipeline_command = h.db.pipeline_command.filter((c) => c.command !== 'decisionEvidence');

  await drain(h);

  const successor = h.db.shop_question.find((q) => String(q.parent_question_id) === String(original.id));
  assert.ok(successor, 'the condemned board was left standing - nothing regenerated it');
  assert.equal(Number(successor.question_round), 2);
  const cands = candidatesOf(successor);
  assert.ok(cands.length > 0, 'the successor offered nothing');
  for (const c of cands) assert.equal(c.source, MODEL_CANDIDATE_SOURCE);
  assert.match(successor.question_text, /built by the old planner/i,
    'the successor does not say why he is being asked again');

  // THE ORIGINAL ROW IS NEVER REWRITTEN. It is the record of what he was
  // actually asked, and `parent_question_id` is what makes the supersession
  // legible without editing history.
  assert.equal(original.question_key, originalKey);
  assert.equal(original.question_text, originalText);
  assert.deepEqual(original.candidates, SCORER_BOARD);

  // AND IT NO LONGER HOLDS THE SHOP.
  const boards = classifyQuestionBoards(
    h.db.shop_question.map((q) => ({ ...q, candidates: candidatesOf(q) })),
    { modelHasDecided: true },
  );
  assert.ok(boards.superseded.some((q) => String(q.id) === String(original.id)),
    'the condemned round-1 card is still counted as a question AsdAIr is waiting on');
});

test('AC3 JOURNEY: supersession TERMINATES - no round 3 on any later pass', async () => {
  const { h } = await shopAskingAboutWipes({ decisions: asksAboutWipes });
  const original = h.db.shop_question[0];
  original.candidates = SCORER_BOARD;
  h.db.pipeline_command = h.db.pipeline_command.filter((c) => c.command !== 'decisionEvidence');

  await drain(h);
  const afterFirst = h.db.shop_question.length;
  await drain(h);
  await drain(h);
  assert.equal(h.db.shop_question.length, afterFirst,
    'a later pass opened another round - a supersession that loops is worse than the board it replaced');
  assert.equal(h.db.shop_question.filter((q) => Number(q.question_round) >= 3).length, 0);
});

// =====================================================================
// WO-2026-08-19-01 AC1 - THE RUNTIME MUST NOT NARRATE A STATE IT IS NOT IN.
//
// TWO MINUTES after the supersession above worked exactly as designed, shop 37
// transitioned NEEDS_DECISION -> PROCESSING announcing
//
//     "every question is answered - re-planning with the answers in place"
//
// with ALL SEVEN of its questions still `open` and NONE of them answered.
//
// The transition was correct - supersession re-plans a parked shop on purpose.
// The SENTENCE was false, and `asdair.shop_event.description` is the only place
// a human ever reads it back. Larry would have read that line in a month and
// believed it.
//
// These two proofs pin the sentence to the rows instead of to the happy path.
// They run the SAME shop-37 reproduction as the supersession journey above, so
// they prove it on the production route rather than on a mock of it.
// =====================================================================
test('AC1: the re-plan does NOT claim answers it has not got', async () => {
  const { h } = await shopAskingAboutWipes({ decisions: asksAboutWipes });
  const original = h.db.shop_question[0];
  original.candidates = SCORER_BOARD;
  h.db.pipeline_command = h.db.pipeline_command.filter((c) => c.command !== 'decisionEvidence');

  await drain(h);

  const replans = h.db.shop_event.filter((e) => String(e.to_status) === 'PROCESSING'
    && /re-plan/i.test(String(e.description || '')));
  assert.ok(replans.length > 0,
    'the fixture no longer reaches the re-plan transition - this proof would pass vacuously');

  const unsettled = h.db.shop_question.filter((q) => q.status !== 'answered' && q.status !== 'skipped');
  assert.ok(unsettled.length > 0,
    'the fixture no longer leaves an unsettled question - this proof would pass vacuously');

  for (const e of replans) {
    // THE DEFECT, NAMED AS A LITERAL. Nothing may announce a settled board
    // while a single row is neither answered nor skipped.
    assert.doesNotMatch(String(e.description), /every question is answered/i,
      `a re-plan claimed every question was answered while ${unsettled.length} were not: ${e.description}`);
    assert.ok(!String(e.description).includes('with the answers in place'),
      `a re-plan said the answers were in place while ${unsettled.length} question(s) were not settled: ${e.description}`);
    // AND IT MUST SAY WHAT IS TRUE, not merely omit what is false. The count
    // is the one AT THE MOMENT OF THE TRANSITION, which is not `unsettled`
    // measured after the drain - so this asserts it reported a REAL non-zero
    // count rather than pinning a number the event could not have known.
    assert.ok(/ not;/.test(String(e.description)),
      `the re-plan did not report an unsettled count at all: ${e.description}`);
    assert.ok(!String(e.description).includes(', 0 not;'),
      `the re-plan reported ZERO unsettled while questions were open: ${e.description}`);
  }
});

test('AC1 MUTATION GUARD: the settled-board sentence is still reachable when the board REALLY is settled', () => {
  // The fix must not have been made by deleting the honest branch. This asserts
  // the positive wording exists in the source and is guarded by a zero test,
  // so a future edit cannot satisfy the proof above by never claiming anything.
  const src = fs.readFileSync(new URL('./runPipeline.js', import.meta.url), 'utf8');
  assert.ok(src.includes('all ${questions.length} question(s) answered or skipped'),
    'the fully-settled wording was removed rather than made conditional');
  assert.ok(src.includes('const open = questions.filter('),
    'the reason is no longer derived from the question rows');
  assert.ok(src.includes('open.length === 0'),
    'the settled sentence is no longer guarded by a real zero test');
});
