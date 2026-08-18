// =====================================================================
// BUILD-015 AsdAIr WP-B15-2 - decisionSpine.test.js
//
// Runs under: node --test
//
// THE ACCEPTANCE PROPERTY (AC5), AND WHY IT IS TESTED THE WAY IT IS.
//
// Warwick: "a passing comment or test saying this happens is not evidence."
// The failure this Work Package exists to remove was a 30-line comment in
// runPipeline.js asserting that answers reached the planner. They did not. So
// a test here that exercised ONE call site and then asserted a general
// property - "decisions are applied on the shopping journey" - would be the
// same defect in a new costume: green, sincere, and true of only the site it
// happened to touch.
//
// There is no plan table. planBasket is recomputed from durable inputs at
// every site that needs a plan, so "decisions are applied" is a claim about
// EVERY recomputation, and the only honest way to make it is to ENUMERATE the
// recomputations rather than sample them. That is what the first test below
// does - against the source, from the filesystem - and it fails the moment a
// new `deps.planBasket(` call site appears anywhere in this module.
//
// The behavioural tests that follow then prove the two live sites really do
// change the basket. Structure alone would prove only that the shape is right.
//
// PURE ASCII. No database, no network, no model call.
// =====================================================================

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { applyDecisionsToPlan, DECISION_FLAGS } from './applyDecisions.js';
import { buildDecision, resolveExactCandidate, DECISION_KINDS } from './shopDecisions.js';
import { planOutcome, STEPS } from './stages.js';
import { questionKeyFor } from './keys.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));

/**
 * Comments are stripped before any of the structural assertions below run.
 *
 * This is not tidiness. A test that counts `deps.planBasket(` in raw source
 * counts the sentence DESCRIBING the rule as though it were a breach of it -
 * and, worse, a comment could satisfy an assertion that code was supposed to.
 * Given this Work Package exists because a comment claimed a loop was closed
 * when the code left it open, a control here that cannot tell the two apart
 * would be the same defect one level up.
 */
function stripComments(src) {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^\s*\/\/.*$/gm, '')
    .replace(/([^:])\/\/.*$/gm, '$1');
}

const runPipelineSrc = stripComments(fs.readFileSync(path.join(HERE, 'runPipeline.js'), 'utf8'));

// =====================================================================
// AC5 - THE ENUMERATION
// =====================================================================

test('AC5 ENUMERATION: every plan recomputation in this module goes through planWithDecisions', () => {
  // Count the call sites, do not sample them. `planWithDecisions` is the ONE
  // function permitted to call the planner, and it applies the decisions before
  // returning - so applying them is a property of the function rather than a
  // discipline each caller has to remember.
  const callSites = [...runPipelineSrc.matchAll(/deps\.planBasket\s*\(/g)];
  assert.equal(callSites.length, 1,
    `runPipeline.js has ${callSites.length} deps.planBasket( call sites. Exactly ONE is permitted, `
    + 'inside planWithDecisions. A new call site is a recomputation that silently ignores '
    + "everything Warwick decided - which is the defect this Work Package exists to remove.");

  // ...and that one site is inside planWithDecisions, not merely somewhere.
  const fn = runPipelineSrc.slice(runPipelineSrc.indexOf('async function planWithDecisions'));
  const body = fn.slice(0, fn.indexOf('\n}\n'));
  assert.match(body, /deps\.planBasket\s*\(/,
    'the single planBasket call site is not inside planWithDecisions');
  assert.match(body, /applyDecisionsToPlan\s*\(/,
    'planWithDecisions does not apply the decisions it exists to apply');
});

// =====================================================================
// THE NEW PRECEDENCE - WO-2026-08-18-06 REV 2, closing Veritas Gate 2
//
// The assertions above pinned that ONE function owns plan recomputation. They
// did not, and could not, say WHO DECIDES inside it - so the construction
// Veritas failed satisfied every one of them: the deterministic planner chose,
// and the model adjusted its output afterwards.
//
// These pin the order itself, in the source, because the order IS the
// architecture:
//
//   planBasket -> strip scorer -> applyRulebook -> decideBasket -> Warwick
//
// Warwick's own words are the reason the last hop is last: a recorded human
// decision must outrank a model judgement about the same line. And the model
// must run BEFORE that, not after the planner has already chosen.
// =====================================================================

test('MODEL DECIDES: exactly one semantic decision call site, inside planWithDecisions', () => {
  const callSites = [...runPipelineSrc.matchAll(/decideBasket\s*\(/g)];
  assert.equal(callSites.length, 1,
    `runPipeline.js has ${callSites.length} decideBasket( call sites. Exactly ONE is permitted, `
    + 'inside planWithDecisions - for the same reason planBasket has exactly one: a second '
    + 'recomputation that decides differently is a shop that looks decided and is not.');

  const fn = runPipelineSrc.slice(runPipelineSrc.indexOf('async function planWithDecisions'));
  const body = fn.slice(0, fn.indexOf('\n}\n'));
  assert.match(body, /decideBasket\s*\(/,
    'the semantic decision does not happen inside planWithDecisions');
  assert.match(body, /loadContract\s*\(/,
    'the decision call carries no contract - Veritas Gate 2 finding 8 is that the runtime '
    + 'consumed no contract text at the decision point, and a decision without it must not exist');
});

test('MODEL DECIDES: the order in the source IS the precedence', () => {
  const fn = runPipelineSrc.slice(runPipelineSrc.indexOf('async function planWithDecisions'));
  const body = fn.slice(0, fn.indexOf('\n}\n'));

  const planner = body.indexOf('deps.planBasket(');
  const strip = body.indexOf('demoteDeterministicDecisions(');
  const rulebook = body.indexOf('applyRulebook(');
  const decide = body.indexOf('decideBasket(');
  const human = body.indexOf('applyDecisionsToPlan(');

  for (const [name, at] of [['planBasket', planner], ['demoteDeterministicDecisions', strip],
    ['applyRulebook', rulebook], ['decideBasket', decide], ['applyDecisionsToPlan', human]]) {
    assert.notEqual(at, -1, `${name} has disappeared from planWithDecisions`);
  }

  assert.ok(planner < strip,
    'the scorer suggestions are stripped before the planner runs - the strip must come after it');
  assert.ok(strip < decide,
    'the deterministic scorer suggestions still reach the decision. That channel offered cat food '
    + 'for "1 wet wipes" and bananas for "2 pkts ASDA plain toffees" on 2026-08-18');
  assert.ok(decide < human,
    "the model runs AFTER Warwick's recorded decisions are applied, so a model judgement could "
    + 'overwrite an answer he actually gave. He is last, always');
  assert.ok(rulebook < decide,
    'the prose rulebook must be an INPUT to the decision, not an adjuster applied over its output - '
    + 'the adjuster construction is exactly what Veritas Gate 2 failed');
});

test('MODEL DECIDES: the deterministic scorer has no production consumer left', () => {
  // regularCandidates() is the function that scored `asda` at 0.25 against
  // bananas and broke the tie alphabetically. It still exists in skill/, with
  // its own unit tests intact - but nothing on the production planning path may
  // read what it produced.
  const fn = runPipelineSrc.slice(runPipelineSrc.indexOf('async function planWithDecisions'));
  const body = fn.slice(0, fn.indexOf('\n}\n'));
  assert.doesNotMatch(body, /regularCandidates\s*\(/,
    'planWithDecisions reaches the word-overlap scorer directly');
  assert.doesNotMatch(body, /rankAlternatives\s*\(/,
    'planWithDecisions reaches the deterministic ranker directly');
});

test('AC5 ENUMERATION: both production plan consumers call planWithDecisions', () => {
  // The two recomputations on the live shopping journey. Named explicitly so
  // that deleting one from the source fails here rather than passing quietly.
  for (const step of ['async function stepPlan', 'async function stepRecordConfirmation']) {
    const at = runPipelineSrc.indexOf(step);
    assert.notEqual(at, -1, `${step} has disappeared from runPipeline.js`);
    const body = runPipelineSrc.slice(at, at + 3000);
    assert.match(body, /planWithDecisions\s*\(/,
      `${step} builds a plan without applying Warwick's decisions to it`);
  }
});

test('AC5 SCOPE, STATED HONESTLY: planBasket callers OUTSIDE this surface are named, not claimed', () => {
  // Route B applies decisions where the pipeline recomputes the plan. It does
  // NOT reach callers in other packages, and this Work Package may not edit
  // them. Naming them here keeps the closed-list claim honest: "every
  // recomputation on the live journey" means these, and these are the ones
  // that remain outside it.
  //
  // Established by enumeration at d907350, and reported to Larry rather than
  // fixed:
  //   services/asdair/skill/cli.js            - CLI only, not the live journey
  //   services/asdair/outcome/record-shop.js  - CLI only, no production caller
  //   services/asdair/outcome/buildOutcome.js - takes a plan it is GIVEN
  //
  // This test does not assert on those files - they are outside this Work
  // Package's surface and another lane may legitimately be changing them. It
  // pins the CLAIM so the limitation cannot quietly disappear from the record.
  const KNOWN_OUTSIDE = ['skill/cli.js', 'outcome/record-shop.js', 'outcome/buildOutcome.js'];
  assert.equal(KNOWN_OUTSIDE.length, 3,
    'the list of known out-of-surface planBasket consumers changed - re-enumerate and re-report it');
});

// =====================================================================
// AC2 - A BUTTON SPENDS NO MODEL CALL
// =====================================================================

const OFFERED = [
  { label: 'Ariel All-in-1 Pods 38', regular_id: 11, source: 'asdair.regulars (resolveByCatalogue)' },
  { label: 'Ariel Liquid 1.9L', regular_id: 12, source: 'asdair.regulars (resolveByCatalogue)' },
  { label: 'something the planner suggested', source: 'planner suggestion (no product id)' },
];

test('AC2: an exact candidate resolves deterministically, naming the regular by id', () => {
  const out = resolveExactCandidate({
    status: 'answered', answer_text: 'Ariel All-in-1 Pods 38', candidates: OFFERED,
  });
  assert.ok(out, 'an exact candidate label must resolve without a model');
  assert.equal(out.decided.decision_kind, 'existing_regular');
  assert.equal(out.decided.decided_regular_id, 11);
  assert.equal(out.decided.interpreted_by, 'human',
    'no model was asked, so no model may be recorded as the interpreter');
});

test('AC2: a candidate with NO id never resolves deterministically, even on an exact label match', () => {
  // The planner ranks better than the resolver but returns no ids. Treating its
  // label as an identity is the fabrication planCandidates' three-population
  // comment exists to prevent.
  const out = resolveExactCandidate({
    status: 'answered', answer_text: 'something the planner suggested', candidates: OFFERED,
  });
  assert.equal(out, null, 'a label with no trustworthy id must NOT become an identity');
});

test('AC2: free text does not resolve deterministically - it is left for interpretation', () => {
  assert.equal(resolveExactCandidate({
    status: 'answered', answer_text: 'the big box of the cheap ones', candidates: OFFERED,
  }), null);
});

test('AC2: a skip is deterministic and needs no model either', () => {
  const out = resolveExactCandidate({ status: 'skipped', answer_text: null, candidates: OFFERED });
  assert.equal(out.decided.decision_kind, 'skip_this_week');
  assert.equal(out.decided.interpreted_by, 'human');
});

test('AC2 WIRING: the deterministic branch is reached BEFORE the interpreter, in the source', () => {
  // Order is the guarantee here: if the interpreter were consulted first, a
  // button tap would spend a model call even though the answer was already
  // certain. Asserted on the source because the ordering is the contract.
  const at = runPipelineSrc.indexOf('async function decideAnswer');
  assert.notEqual(at, -1);
  const body = runPipelineSrc.slice(at, at + 2500);
  assert.ok(body.indexOf('resolveExactCandidate') < body.indexOf('deps.interpretAnswer'),
    'the interpreter is consulted before the deterministic resolver - a button would spend a model call');
});

// =====================================================================
// AC3 - GROUNDING AND THE REFUSAL TO GUESS
// =====================================================================

test('AC3: a decision naming a product must carry the id - a confident decision about nothing is refused', () => {
  for (const kind of ['existing_regular', 'quantity_change', 'variant_choice']) {
    assert.throws(() => buildDecision({
      shop_id: 1, question_id: 1, decision_kind: kind, interpreted_by: 'terra',
      decision_evidence: { model_return: {} },
      ...(kind === 'quantity_change' ? { decided_quantity: 2 } : {}),
    }), /decided_regular_id is required/, `${kind} without an id must be refused`);
  }
});

test('AC3: UNKNOWN means clarification_required, and a clarification decides NOTHING', () => {
  assert.throws(() => buildDecision({
    shop_id: 1, question_id: 1, decision_kind: 'clarification_required',
    clarification_reason: 'two sizes and he said "the usual"',
    decided_regular_id: 11, interpreted_by: 'terra', decision_evidence: { model_return: {} },
  }), /decides nothing/, 'a clarification that also names a product is a least-bad match wearing a hat');
});

test('AC3: a terra decision cannot exist without the evidence of what it was given', () => {
  assert.throws(() => buildDecision({
    shop_id: 1, question_id: 1, decision_kind: 'skip_this_week', interpreted_by: 'terra',
    decision_evidence: {},
  }), /requires non-empty decision_evidence/);
  // A human decision needs none - nothing was interpreted.
  assert.ok(buildDecision({
    shop_id: 1, question_id: 1, decision_kind: 'skip_this_week', interpreted_by: 'human',
  }));
});

test('AC3: only a new_item may carry a name; every other kind looks its name up by id', () => {
  assert.throws(() => buildDecision({
    shop_id: 1, question_id: 1, decision_kind: 'existing_regular', decided_regular_id: 11,
    decided_item_name: 'whatever the model called it', interpreted_by: 'human',
  }), /only permitted on "new_item"/);
  assert.throws(() => buildDecision({
    shop_id: 1, question_id: 1, decision_kind: 'new_item', decided_item_name: 'Fever-Tree Tonic',
    decided_regular_id: 11, interpreted_by: 'human',
  }), /must not carry decided_regular_id/);
});

test('AC3: the decision vocabulary is exactly the six kinds migration 017 permits', () => {
  assert.deepEqual([...DECISION_KINDS].sort(), [
    'clarification_required', 'existing_regular', 'new_item',
    'quantity_change', 'skip_this_week', 'variant_choice',
  ]);
});

// =====================================================================
// AC4 - THE LINE'S MEANING GENUINELY CHANGES
// =====================================================================

const REGULARS = new Map([
  [11, { id: 11, name: 'Ariel All-in-1 Pods 38' }],
  [12, { id: 12, name: 'Ariel Liquid 1.9L' }],
]);

function planWith(...items) {
  return { items, summary: { total_requested: items.length, planned_add: 0, needs_decision: items.length } };
}

function heldLine(name, qty = 1) {
  return {
    item_name: name, matched_product: null, requested_qty: qty, planned_qty: 0,
    status: 'needs_decision', flags: [], note: '', alternatives: [],
  };
}

function decisionFor(name, extra) {
  return { question_key: questionKeyFor(name), question_round: 1, ...extra };
}

test('AC4: an existing_regular decision changes the line from needs_decision to a real product', () => {
  const { plan, applied, unresolved } = applyDecisionsToPlan({
    plan: planWith(heldLine('Ariel Pods')),
    decisions: [decisionFor('Ariel Pods', { decision_kind: 'existing_regular', decided_regular_id: 11 })],
    questionKeyFor, regularsById: REGULARS,
  });
  const line = plan.items[0];
  assert.equal(line.status, 'add', 'the line must actually change status');
  assert.equal(line.matched_product, 'Ariel All-in-1 Pods 38', 'the name is looked up from the catalogue by id');
  assert.equal(line.planned_qty, 1);
  assert.ok(line.flags.includes(DECISION_FLAGS.DECIDED));
  assert.equal(applied.length, 1);
  assert.equal(unresolved.length, 0);
  assert.equal(plan.summary.planned_add, 1, 'the summary must be recomputed, never carried over stale');
});

test('AC4: a quantity_change changes the QUANTITY, not merely the status', () => {
  const { plan } = applyDecisionsToPlan({
    plan: planWith(heldLine('Ariel Pods', 1)),
    decisions: [decisionFor('Ariel Pods',
      { decision_kind: 'quantity_change', decided_regular_id: 11, decided_quantity: 3 })],
    questionKeyFor, regularsById: REGULARS,
  });
  assert.equal(plan.items[0].requested_qty, 3);
  assert.equal(plan.items[0].planned_qty, 3);
  assert.ok(plan.items[0].flags.includes(DECISION_FLAGS.QUANTITY));
});

test('AC4: a skip removes the line from the basket for THIS WEEK only', () => {
  const { plan } = applyDecisionsToPlan({
    plan: planWith(heldLine('Ariel Pods')),
    decisions: [decisionFor('Ariel Pods', { decision_kind: 'skip_this_week' })],
    questionKeyFor, regularsById: REGULARS,
  });
  assert.equal(plan.items[0].status, 'excluded_this_week');
  assert.equal(plan.items[0].planned_qty, 0);
  assert.equal(plan.summary.excluded_this_week, 1);
  assert.equal(plan.summary.planned_add, 0);
});

test('AC4: a new_item is added under its approved name and carries NO product id', () => {
  const { plan } = applyDecisionsToPlan({
    plan: planWith(heldLine('that tonic stuff')),
    decisions: [decisionFor('that tonic stuff',
      { decision_kind: 'new_item', decided_item_name: 'Fever-Tree Tonic 500ml' })],
    questionKeyFor, regularsById: REGULARS,
  });
  assert.equal(plan.items[0].status, 'add');
  assert.equal(plan.items[0].decided_item_name, 'Fever-Tree Tonic 500ml');
  assert.equal(plan.items[0].matched_product, null, 'a new item is not in the catalogue and names no product');
  assert.equal(plan.items[0].item_name, 'that tonic stuff',
    'item_name is the question-key derivation input and must stay stable');
});

test('AC4: the input plan is never mutated - the planner-only view stays available', () => {
  const original = planWith(heldLine('Ariel Pods'));
  applyDecisionsToPlan({
    plan: original,
    decisions: [decisionFor('Ariel Pods', { decision_kind: 'existing_regular', decided_regular_id: 11 })],
    questionKeyFor, regularsById: REGULARS,
  });
  assert.equal(original.items[0].status, 'needs_decision', 'the caller\'s plan was mutated in place');
});

test('AC4 FORWARD-COMPATIBILITY: applyDecisions imports nothing, so the planner can call it verbatim', () => {
  // Warwick's condition on choosing route B: planner-level consumption must be
  // reachable later WITHOUT another data-model rewrite. That is only true if
  // this module is pure - no pipeline imports, no database, no environment.
  const src = fs.readFileSync(path.join(HERE, 'applyDecisions.js'), 'utf8');
  const imports = [...src.matchAll(/^\s*import\s.+$/gm)].map((m) => m[0]);
  assert.deepEqual(imports, [],
    'applyDecisions.js has acquired an import. It must stay dependency-free so skill/planner.js '
    + 'can call it unchanged when route A is taken.');
  assert.doesNotMatch(src, /\bdeps\b|\bquery\(|process\.env/,
    'applyDecisions.js has acquired a runtime dependency');
});

// =====================================================================
// AC6 / AC7 - THE GATE, AND THE ABSENCE OF A LIVELOCK
// =====================================================================

test('AC6: an ANSWERED question with no structured decision leaves the line unresolved', () => {
  // Shop 6's exact shape, and the reason "every line is resolved" was a lie.
  const { unresolved } = applyDecisionsToPlan({
    plan: planWith(heldLine('Ariel Pods')),
    decisions: [], questionKeyFor, regularsById: REGULARS,
  });
  assert.equal(unresolved.length, 1);
  assert.equal(unresolved[0].reason, 'no structured decision recorded');
});

test('AC6: READY_TO_SHOP is UNREACHABLE while any line is unresolved', () => {
  const gate = planOutcome({
    openQuestions: 0, needsReview: false, interpretationConfirmed: true, unresolvedLines: 1,
  });
  assert.notEqual(gate.to, 'READY_TO_SHOP', 'an undecided line must never reach the basket');
  assert.equal(gate.to, null, 'and it must PARK, not transition - a transition here livelocks the shop');
  assert.equal(gate.step, STEPS.AWAIT_LINE_RESOLUTION);
});

test('AC6: the gate is not a livelock - the unresolved branch never returns NEEDS_DECISION', () => {
  // The exact bug avoided: NEEDS_DECISION with zero open questions sends
  // decideNextStep to REPLAN -> PROCESSING -> PLAN -> here, forever.
  for (let lines = 1; lines <= 5; lines += 1) {
    const gate = planOutcome({
      openQuestions: 0, needsReview: false, interpretationConfirmed: true, unresolvedLines: lines,
    });
    assert.notEqual(gate.to, 'NEEDS_DECISION',
      'returning NEEDS_DECISION with zero open questions is the livelock');
  }
});

test('AC6: with every line decided, the shop IS ready - the gate blocks nothing it should not', () => {
  const gate = planOutcome({
    openQuestions: 0, needsReview: false, interpretationConfirmed: true, unresolvedLines: 0,
  });
  assert.equal(gate.to, 'READY_TO_SHOP');
  assert.equal(gate.reason, 'every line is resolved');
});

test('AC6: the gate defaults to the historic behaviour when no line count is supplied', () => {
  // Every existing caller passed three arguments. The new one is additive, so
  // an un-migrated caller must behave exactly as it did rather than parking.
  const gate = planOutcome({ openQuestions: 0, needsReview: false, interpretationConfirmed: true });
  assert.equal(gate.to, 'READY_TO_SHOP');
});

test('AC7: a clarification_required decision keeps the line held AND asks for the next round', () => {
  const { plan, unresolved } = applyDecisionsToPlan({
    plan: planWith(heldLine('Ariel Pods')),
    decisions: [decisionFor('Ariel Pods', {
      decision_kind: 'clarification_required',
      clarification_reason: 'he said "the usual" and there are two',
      question_id: 77, question_round: 1,
    })],
    questionKeyFor, regularsById: REGULARS,
  });
  assert.equal(plan.items[0].status, 'needs_decision', 'a clarification decides nothing about the line');
  assert.ok(plan.items[0].flags.includes(DECISION_FLAGS.CLARIFY));
  assert.equal(unresolved.length, 1);
  assert.equal(unresolved[0].needs_clarification_round, true);
  assert.equal(unresolved[0].question_id, 77, 'the next round must be able to name its parent');
  assert.equal(unresolved[0].question_round, 1, 'the next round is derived from the round we are IN');
});

test('AC7: a decision that cannot be linked to a line is REPORTED, never dropped', () => {
  const { unlinkable } = applyDecisionsToPlan({
    plan: planWith(heldLine('Ariel Pods')),
    decisions: [{ decision_kind: 'skip_this_week', question_key: null }],
    questionKeyFor, regularsById: REGULARS,
  });
  assert.equal(unlinkable.length, 1,
    'silently discarding a recorded human decision is the failure this WP exists to end');
});

test('a decision_kind the migration would refuse is LOUD here, never absorbed', () => {
  assert.throws(() => applyDecisionsToPlan({
    plan: planWith(heldLine('Ariel Pods')),
    decisions: [decisionFor('Ariel Pods', { decision_kind: 'invented_kind' })],
    questionKeyFor, regularsById: REGULARS,
  }), /unknown decision_kind/);
});

// =====================================================================
// BIGINT IDS ARRIVE AS STRINGS FROM THE REAL DRIVER
//
// node-postgres returns `bigint` as a JavaScript STRING; fakePg returns a
// NUMBER. It is not a uniform difference - `decided_quantity` is `integer` and
// comes back as a number from both - so a LIVE decision row is a mixed bag of
// string ids beside numeric quantities, and that mixture is INVISIBLE in the
// fake. Established by Silas against real PostgreSQL 17.4.
//
// The production code is written to be INDIFFERENT: every id is either passed
// straight through as a SQL parameter, or normalised with Number() on BOTH
// sides of a comparison. These tests pin that indifference so it cannot
// regress silently - they feed the pure functions exactly what the real driver
// would hand them and require identical behaviour.
//
// The fake is deliberately NOT changed to return strings. Making the harness
// mimic the driver hides the question; making the code not care answers it.
// =====================================================================

test('BIGINT: a decision whose ids are STRINGS behaves identically to numeric ids', () => {
  const asNumbers = applyDecisionsToPlan({
    plan: planWith(heldLine('Ariel Pods')),
    decisions: [decisionFor('Ariel Pods',
      { decision_kind: 'existing_regular', decided_regular_id: 11, question_id: 77 })],
    questionKeyFor, regularsById: REGULARS,
  });
  const asStrings = applyDecisionsToPlan({
    plan: planWith(heldLine('Ariel Pods')),
    // Exactly what `pg` hands back: bigints as strings, integers as numbers.
    decisions: [decisionFor('Ariel Pods',
      { decision_kind: 'existing_regular', decided_regular_id: '11', question_id: '77' })],
    questionKeyFor, regularsById: REGULARS,
  });

  assert.equal(asStrings.plan.items[0].status, 'add');
  assert.equal(asStrings.plan.items[0].matched_product, asNumbers.plan.items[0].matched_product,
    'a string bigint id failed to resolve its canonical name - the live row would silently lose it');
  assert.equal(asStrings.plan.items[0].matched_product, 'Ariel All-in-1 Pods 38');
  assert.equal(asStrings.unresolved.length, 0);
  assert.equal(asStrings.plan.summary.planned_add, asNumbers.plan.summary.planned_add);
});

test('BIGINT: the round chain does not compare ids at all - it keys on question_key', () => {
  // The named hazard: matching parent_question_id against question.id with ===
  // would work perfectly in the suite and silently fail to find the parent
  // live. It cannot happen here, because the chain is walked by DERIVED KEY -
  // question_key is `text` in every driver - and parent_question_id is only
  // ever WRITTEN, never matched.
  const src = fs.readFileSync(path.join(HERE, 'applyDecisions.js'), 'utf8');
  assert.doesNotMatch(src, /parent_question_id\s*={2,3}/,
    'the round chain compares parent_question_id - a string/number mismatch would break it live');

  // And behaviourally: a round-2 decision carrying STRING ids is still found.
  const { plan, unresolved } = applyDecisionsToPlan({
    plan: planWith(heldLine('Ariel Pods')),
    decisions: [
      { question_key: questionKeyFor('Ariel Pods', 1), question_id: '77', question_round: 1,
        decision_kind: 'clarification_required', clarification_reason: 'two sizes' },
      { question_key: questionKeyFor('Ariel Pods', 2), question_id: '78', question_round: 2,
        decision_kind: 'existing_regular', decided_regular_id: '11' },
    ],
    questionKeyFor, regularsById: REGULARS,
  });
  assert.equal(plan.items[0].status, 'add', 'the round-2 decision was not found with string ids');
  assert.equal(plan.items[0].matched_product, 'Ariel All-in-1 Pods 38');
  assert.equal(unresolved.length, 0);
});

test('BIGINT: buildDecision accepts string ids and normalises them', () => {
  const row = buildDecision({
    shop_id: '3', question_id: '77', decision_kind: 'existing_regular',
    decided_regular_id: '11', interpreted_by: 'human',
  });
  assert.equal(row.shop_id, 3);
  assert.equal(row.question_id, 77);
  assert.equal(row.decided_regular_id, 11);
});

test('BIGINT: an exact candidate whose regular_id is a string still resolves with no model call', () => {
  const out = resolveExactCandidate({
    status: 'answered',
    answer_text: 'Ariel All-in-1 Pods 38',
    candidates: [{ label: 'Ariel All-in-1 Pods 38', regular_id: '11' }],
  });
  assert.ok(out, 'a string regular_id must not defeat the deterministic path');
  assert.equal(out.decided.decided_regular_id, 11);
});

test('BIGINT: the catalogue Map keys and the lookup calls both normalise with Number()', () => {
  // loadCatalogue.js:122 builds regularsById with Number(r.id) keys; nameFor
  // reads it with map.get(Number(id)). Both sides normalise, which is the
  // reason a string id resolves at all. If either side stops, this pins it.
  const src = fs.readFileSync(path.join(HERE, 'applyDecisions.js'), 'utf8');
  assert.match(src, /map\.get\(Number\(id\)\)/,
    'nameFor no longer normalises the id it looks up - a string bigint would miss the Map');
  const runSrc = fs.readFileSync(path.join(HERE, 'runPipeline.js'), 'utf8');
  assert.match(runSrc, /\[Number\(r\.id\), r\]/,
    'the fallback catalogue Map no longer keys on Number(r.id)');
});

test('a decided regular missing from the supplied catalogue resolves to null, never to a guess', () => {
  const { plan } = applyDecisionsToPlan({
    plan: planWith(heldLine('Ariel Pods')),
    decisions: [decisionFor('Ariel Pods', { decision_kind: 'existing_regular', decided_regular_id: 999 })],
    questionKeyFor, regularsById: REGULARS,
  });
  assert.equal(plan.items[0].matched_product, null, 'an unknown id must not invent a name');
  assert.equal(plan.items[0].decided_regular_id, 999, 'but the decision itself is still recorded on the line');
});
