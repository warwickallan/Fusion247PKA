// =====================================================================
// BUILD-015 AsdAIr - pipeline/decisionCorpus.test.js
//
// THE MEASUREMENT THAT DECIDES WHETHER THIS CHANGE IS REAL, ON REAL DATA.
//
// Closing Veritas Gate 2 (a0a71f5), defects 1-5 and 8. Warwick, 2026-08-18:
// "MODEL DECIDES. PLANNER / EXECUTOR EXECUTES."
//
// ── WHY THIS FILE EXISTS AND WHAT MAKES IT HONEST ─────────────────────────
// The corpus is `pipeline/testdata/mum-list-2026-08-17.expected.json`: 37 real
// lines from a sha256-pinned photograph, each carrying the id it MUST resolve
// to and, for many, a `forbid` list of ids that would buy the wrong thing. It
// is scored against the real 109-row household catalogue and the real 39 active
// rules. Nobody involved can grade their own homework against it: the expected
// answers were reconciled by Warwick from the photograph before this Work Order
// existed.
//
// ⚠️ THE TRAP THIS FILE DELIBERATELY AVOIDS. Run through `interpret/` alone,
// this corpus already scores 37 of 37 - `measure-known-list.js` says so today,
// on the OLD code. So a test asserting "the toffees resolve to regular 33"
// would pass without this Work Order having happened, and would prove nothing.
// The Gate 2 defect is NOT in the interpret stage; it is in what happens to the
// lines the exact lookup does NOT bind. That is what is measured here.
//
// ── THE BEFORE NUMBERS, REPRODUCED OFFLINE FROM COMMITTED DATA ────────────
// Driving these 37 lines through `planBasket` as the live path did, 17 lines
// reach the decision point and the deterministic scorer offers candidates for
// 16 of them. SEVEN are offered a product their own `forbid` list names. The
// two Warwick actually received on Telegram on 2026-08-18 reproduce exactly:
//
//   line 33 "2 pkts ASDA plain toffees" -> ham, eggs, freezer bags,
//                                          quarter pounders, BANANAS
//   line 29 "1 wet wipes"               -> Gourmet Mon Petit WET CAT FOOD
//
// Those are not paraphrases. They are the strings this suite asserts on, and
// they match `pipeline_command` id 282 - the bytes delivered as Telegram
// message 134 - quoted in the Veritas receipt.
//
// The assertions below therefore carry their own mutation: the BEFORE block
// fails if the defect ever stops reproducing, and the AFTER block fails if the
// fix stops holding. A test that only checked the AFTER state would go green on
// a build where the scorer had simply been handed better data.
// =====================================================================

import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

import { demoteDeterministicDecisions } from './runPipeline.js';

const require = createRequire(import.meta.url);
const { planBasket } = require('../skill/planner.js');
const { decideBasket, DecisionUnavailableError } = require('../skill/decide.js');
const { loadContract } = require('../skill/contract.js');
const { loadFixtureCatalogue, loadKnownList } = require('../interpret/knownList.js');

const catalogue = loadFixtureCatalogue();
const known = loadKnownList();
const contract = loadContract();

const listItems = known.lines.map((l) => ({ item_name: l.reading, requested_qty: l.qty }));

function mechanicalPlan() {
  return planBasket({
    listItems,
    rules: catalogue.rules,
    products: [],
    regulars: catalogue.regulars,
    budget: null,
    lastOrder: null,
    household: 1,
  });
}

/** A line the exact lookup did not bind - i.e. a real decision point. */
function isDecisionLine(item) {
  return item.status === 'needs_decision' || !item.matched_product;
}

const nameById = new Map(catalogue.regulars.map((r) => [Number(r.id), String(r.name)]));

/** The names of every id a corpus line explicitly forbids. */
function forbiddenNamesFor(line) {
  return (line.forbid || []).map((id) => nameById.get(Number(id))).filter(Boolean);
}

/** Was line index `i` a decision point in the plan as it reached the model? */
function needsDecisionAt(plan, i) {
  return isDecisionLine(plan.items[i]);
}

// =====================================================================
// BEFORE - the defect, reproduced from committed data
// =====================================================================

test('BEFORE: the deterministic scorer offers products the corpus explicitly FORBIDS', () => {
  const plan = mechanicalPlan();
  let decisionLines = 0;
  let offeredForbidden = 0;

  plan.items.forEach((item, i) => {
    if (!isDecisionLine(item)) return;
    decisionLines += 1;
    const offered = (item.alternatives || []).map((a) => String(a.name));
    const forbidden = forbiddenNamesFor(known.lines[i]).filter((n) => offered.includes(n));
    if (forbidden.length > 0) offeredForbidden += 1;
  });

  assert.equal(decisionLines, 17,
    'the corpus no longer reaches the decision point the way the live run did - this measurement '
    + 'is only meaningful while it does');
  assert.ok(offeredForbidden >= 7,
    `the scorer offered a forbidden product on ${offeredForbidden} lines; the live run of 2026-08-18 `
    + 'reproduced at 7. If this number has fallen, the scorer was TUNED - which Warwick explicitly '
    + 'refused: "Do not explain it away, narrow the contract, or tune the existing scorer."');
});

test('BEFORE: the toffees line is offered bananas - the exact board Warwick received', () => {
  const plan = mechanicalPlan();
  const i = known.lines.findIndex((l) => l.n === 33);
  const offered = (plan.items[i].alternatives || []).map((a) => String(a.name));

  // pipeline_command id 282, the bytes sent as Telegram message 134.
  assert.ok(offered.includes('ASDA 6 Bananas'),
    'the measured live defect no longer reproduces; this suite can no longer prove the fix');
  assert.ok(offered.includes('ASDA 10 Slices Honey Roast Dry Cured Ham 250g'));
  assert.ok(offered.includes('ASDA 20 Medium Zip Seal Food & Freezer Bags'));
  assert.equal(offered.includes('ASDA Dairy Toffee 180g'), false,
    'the household DOES hold the right answer (regular 33) and the scorer still ranked it nowhere');
});

test('BEFORE: "1 wet wipes" is offered CAT FOOD', () => {
  const plan = mechanicalPlan();
  const i = known.lines.findIndex((l) => l.n === 29);
  const offered = (plan.items[i].alternatives || []).map((a) => String(a.name));
  assert.ok(offered.some((n) => /Cat Food/i.test(n)),
    'the cat-food defect no longer reproduces from committed data');
});

test('BEFORE: a line reading MALE is offered the women\'s aerosols the corpus forbids', () => {
  const plan = mechanicalPlan();
  const i = known.lines.findIndex((l) => l.n === 30);
  const offered = (plan.items[i].alternatives || []).map((a) => String(a.name));
  const forbidden = forbiddenNamesFor(known.lines[i]).filter((n) => offered.includes(n));
  assert.ok(forbidden.length >= 1,
    'Veritas defect 5 no longer reproduces - the ignored-MALE case is what this pins');
});

// =====================================================================
// AFTER - the deterministic layer cannot reach the human at all
// =====================================================================

test('AFTER: NO decision line carries a deterministic candidate, on any of the 37 lines', () => {
  const plan = demoteDeterministicDecisions(mechanicalPlan());
  const leaked = [];
  plan.items.forEach((item, i) => {
    if (!isDecisionLine(item)) return;
    if ((item.alternatives || []).length > 0) {
      leaked.push({ n: known.lines[i].n, offered: item.alternatives.map((a) => a.name) });
    }
  });
  assert.deepEqual(leaked, [],
    'a deterministic suggestion survived to the decision point. That channel is what Gate 2 failed');
});

test('AFTER: not one forbidden product survives the decision, anywhere in the plan', async () => {
  // Measured AFTER the decision, not before it. A tolerant binding legitimately
  // survives the strip - removing it is AsdAIr's job, through the correction
  // channel, which is the whole point of sending it as `binding: "tolerant"`.
  const out = await decideOverCorpus(correctConsult);
  const plan = out.plan;
  const hits = [];
  plan.items.forEach((item, i) => {
    const forbidden = forbiddenNamesFor(known.lines[i]);
    (item.alternatives || []).forEach((a) => {
      if (forbidden.includes(String(a.name))) hits.push({ n: known.lines[i].n, name: a.name });
    });
    if (item.matched_product && forbidden.includes(String(item.matched_product))) {
      hits.push({ n: known.lines[i].n, bound: item.matched_product });
    }
  });
  assert.deepEqual(hits, [], 'a product the corpus forbids is still reachable');
});

test('AFTER: an EXACT unambiguous lookup is untouched - a lookup is not a decision', () => {
  // The fast path the goal contract preserves in terms: "stored id if present
  // (fast path)". Stripping the scorer must not cost a single binding that the
  // catalogue was certain about.
  const before = mechanicalPlan();
  const after = demoteDeterministicDecisions(before);
  before.items.forEach((item, i) => {
    if (isDecisionLine(item)) return;
    assert.equal(after.items[i].matched_product, item.matched_product,
      `line ${known.lines[i].n} lost an exact catalogue binding`);
    assert.equal(after.items[i].status, item.status);
  });
});

// =====================================================================
// THE DECISION - what the model is given, and what it is allowed to do
// =====================================================================

/**
 * A consult that answers the corpus correctly.
 *
 * ⚠️ IT IS A STAND-IN, AND IT PROVES PLUMBING - NEVER JUDGEMENT. Its answers
 * come from the corpus, so it is the test telling itself the truth. What these
 * assertions establish is that a correct decision REACHES the basket, that the
 * deterministic layer cannot overrule it, and that a wrong one is refused.
 * Whether a real model answers correctly is proven by the joined live run, and
 * by nothing in this file. Under `network: none` there is no honest way to
 * claim otherwise, and claiming it is the failure mode this estate keeps
 * paying for.
 */
function correctConsult(grounding) {
  const decisions = [];

  grounding.decision_line_nos.forEach((n) => {
    const line = known.lines.find((l) => l.n === n);
    const e = (line && line.expect) || {};
    if (e.kind === 'regular') {
      decisions.push({ line_no: n, verdict: 'select', regular_id: e.id, reason: 'household regular' });
      return;
    }
    if (e.kind === 'one_of') {
      decisions.push({ line_no: n, verdict: 'select', regular_id: e.ids[0], reason: 'one of two honest answers' });
      return;
    }
    decisions.push({
      line_no: n, verdict: 'search', product: line.reading,
      search_terms: [line.reading], reason: 'no household row - a normal case',
    });
  });

  // The CORRECTION channel: a tolerant binding the model believes is wrong.
  // Exercised here on the one line where it really is wrong - the conditioner
  // bound to a shampoo - and left alone on the eighteen where the tolerant
  // match was right, which is the behaviour that keeps the fast path fast.
  (grounding.correctable_line_nos || []).forEach((n) => {
    const line = known.lines.find((l) => l.n === n);
    const e = (line && line.expect) || {};
    const entry = grounding.lines.find((l) => l.line_no === n);
    if (e.kind !== 'regular') return;
    if (String(entry.already_bound) === nameById.get(Number(e.id))) return;   // right already
    decisions.push({
      line_no: n, verdict: 'select', regular_id: e.id,
      reason: `"${entry.already_bound}" is not what this line says`,
    });
  });

  return { decisions };
}

async function decideOverCorpus(consult) {
  return decideBasket({
    plan: demoteDeterministicDecisions(mechanicalPlan()),
    regulars: catalogue.regulars,
    rules: catalogue.rules,
    contract,
    household: 1,
    consult,
  });
}

test('AC2: the decision call carries the contract, the 109-row catalogue, the 39 rules and ALL 37 lines', async () => {
  let seen = null;
  await decideOverCorpus((g) => { seen = g; return correctConsult(g); });

  assert.ok(seen, 'the decision consumer was never called - the model is not in the path');
  assert.equal(seen.catalogue.length, 109, 'the household catalogue did not reach the decision');
  assert.equal(seen.rules.length, 39, 'the household rules did not reach the decision');
  assert.equal(seen.lines.length, 37,
    'the model saw only its own workload - it must see the WHOLE list to reason across lines');
  assert.equal(seen.contract_sha256, contract.sha256,
    'the contract digest in the call does not match the contract on disk');
  assert.ok(seen.contract.includes('semantic decision-maker'),
    'the approved contract text is not in the decision call - Veritas Gate 2 finding 8');
  assert.ok(seen.contract.includes('abstain only on genuine ambiguity'),
    'the resolution order the contract mandates did not reach the decision');
  assert.ok(seen.contract.includes('Asdair decides; code executes'),
    'the specialist contract did not reach the decision call');
});

test('AC1: every line the MODEL decides reaches the corpus outcome, and nothing forbidden is bound', async () => {
  // Scoped to the DECISION LINES on purpose. A line the exact catalogue lookup
  // already bound never reaches the model - asserting the model bound it would
  // be asserting something no model did, which is the shape of a test that
  // passes for the wrong reason.
  const mechanical = demoteDeterministicDecisions(mechanicalPlan());
  const out = await decideOverCorpus(correctConsult);
  const wrong = [];

  out.plan.items.forEach((item, i) => {
    const line = known.lines[i];
    const e = line.expect || {};
    const forbid = (line.forbid || []).map(Number);

    if (needsDecisionAt(mechanical, i)) {
      const bound = item.decided_regular_id === undefined ? null : Number(item.decided_regular_id);
      if (e.kind === 'regular' && bound !== Number(e.id)) wrong.push({ n: line.n, want: e.id, got: bound });
      if (e.kind === 'one_of' && (bound === null || !e.ids.map(Number).includes(bound))) {
        wrong.push({ n: line.n, want: e.ids, got: bound });
      }
      if (bound !== null && forbid.includes(bound)) wrong.push({ n: line.n, forbiddenBound: bound });
      return;
    }

    // A line the lookup bound: it must at least not have bought something the
    // corpus forbids. This is what caught the shampoo/conditioner defect.
    const boundName = item.matched_product ? String(item.matched_product) : null;
    if (boundName && forbiddenNamesFor(line).includes(boundName)) {
      wrong.push({ n: line.n, forbiddenByLookup: boundName });
    }
  });

  assert.deepEqual(wrong, [], 'the decision did not reach the corpus outcome');

  const i33 = known.lines.findIndex((l) => l.n === 33);
  assert.equal(out.plan.items[i33].matched_product, 'ASDA Dairy Toffee 180g',
    'the toffees line still does not buy toffees');
});

test('AC1: the shampoo/conditioner collision is handed to AsdAIr, not bought twice', async () => {
  // FOUND BY THE CORPUS, NOT BY THE GATE 2 REVIEW. The tolerant matcher bound
  // line 31 ("hair conditioner, blue label") and line 32 ("shampoo") to the SAME
  // shampoo - so the basket silently bought one product twice and no conditioner,
  // with no question raised. `forbid` on each line names the other product.
  const before = mechanicalPlan();
  const i31 = known.lines.findIndex((l) => l.n === 31);
  const i32 = known.lines.findIndex((l) => l.n === 32);
  assert.equal(before.items[i31].matched_product, before.items[i32].matched_product,
    'the collision no longer reproduces - this test can no longer prove the fix');

  // The binding is not deleted - 18 of the 19 tolerant bindings on this corpus
  // are RIGHT, and deleting them would push 36 of 37 lines to the model. It is
  // marked CORRECTABLE and sent to AsdAIr in the one call it was already making.
  assert.ok(before.items[i31].flags.includes('matched tolerantly'),
    'the tolerant binding is not marked, so asdair is never told it may overturn it');
  assert.equal(before.items[0].flags.includes('matched tolerantly'), true,
    'the corpus no longer exercises the tolerant path at all');

  const out = await decideOverCorpus(correctConsult);
  assert.equal(Number(out.plan.items[i31].decided_regular_id), 17,
    'asdair did not get to decide the conditioner line');
  assert.notEqual(out.plan.items[i31].matched_product, out.plan.items[i32].matched_product,
    'the basket still buys the same product for both the shampoo and the conditioner line');
});

test('AC1: a genuinely new product becomes a SEARCH, not a question', async () => {
  const out = await decideOverCorpus(correctConsult);
  // Lines 18 (Ben & Jerry's) and 29 (wet wipes) are `kind: new` in the corpus.
  [18, 29].forEach((n) => {
    const i = known.lines.findIndex((l) => l.n === n);
    const item = out.plan.items[i];
    assert.equal(item.status, 'add',
      `line ${n} became a question. "A previously unseen product is a NORMAL case" - goal contract`);
    assert.ok(item.flags.includes('new item - resolve by ASDA search'));
    assert.ok(Array.isArray(item.search_terms) && item.search_terms.length > 0,
      `line ${n} is to be searched for and no search terms were carried`);
  });
  assert.ok(out.audit.searched.length >= 2);
});

test('INVENTION GUARD: an id the household does not hold is REFUSED, and the line asks instead', async () => {
  const out = await decideOverCorpus((g) => ({
    decisions: g.decision_line_nos.map((n) => ({
      line_no: n, verdict: 'select', regular_id: 999999, reason: 'a product that does not exist',
    })),
  }));

  out.plan.items.forEach((item, i) => {
    if (!isDecisionLine(mechanicalPlan().items[i])) return;
    assert.notEqual(item.status, 'add', `line ${known.lines[i].n} bought an invented identity`);
  });
  assert.ok(out.audit.rejected.length >= 17, 'the invention guard did not fire on every line');
  assert.equal(out.audit.selected.length, 0, 'an invented id reached the basket');
});

test('INVENTION GUARD: an invented CANDIDATE is dropped from the card rather than printed', async () => {
  const out = await decideOverCorpus((g) => ({
    decisions: g.decision_line_nos.map((n) => ({
      line_no: n, verdict: 'ask', question: 'which?',
      candidates: [{ regular_id: 999999, label: 'A Product Nobody Holds' }, { regular_id: 33 }],
    })),
  }));
  const printed = out.plan.items.flatMap((it) => (it.alternatives || []).map((a) => a.name));
  assert.equal(printed.includes('A Product Nobody Holds'), false,
    'a candidate carrying an id the household does not hold was printed on a card');
  assert.ok(printed.includes('ASDA Dairy Toffee 180g'), 'the valid candidate was dropped too');
});

// =====================================================================
// FAIL LOUD - the property that keeps the scorer dead
// =====================================================================

test('THE STRIP IS LOAD-BEARING: a line the model does NOT answer keeps NO scorer candidate', async () => {
  // ── WHY THIS TEST EXISTS: A MUTATION THAT SURVIVED ────────────────────────
  // Removing `demoteDeterministicDecisions` from the production path was caught
  // by the source-order assertion in decisionSpine.test.js and by NOTHING
  // BEHAVIOURAL - because on every line the model DOES answer, `decideBasket`
  // overwrites `alternatives` anyway, so the strip looks redundant.
  //
  // It is not redundant on the one path that matters most: a line the model
  // silently omits. There the strip is the ONLY thing standing between the
  // household and a card offering cat food for wet wipes. So the mutation is
  // pinned here, where it bites.
  const out = await decideOverCorpus((g) => ({
    // Answer exactly one line, and leave every other decision line unanswered.
    decisions: [{
      line_no: g.decision_line_nos[0], verdict: 'search',
      product: 'something', search_terms: ['something'],
    }],
  }));

  assert.ok(out.audit.undecided.length >= 10,
    'the model answered lines it was not given - this test no longer exercises the omission path');

  const leaked = [];
  out.audit.undecided.forEach((n) => {
    const item = out.plan.items[n - 1];
    (item.alternatives || []).forEach((a) => leaked.push({ n, name: a.name }));
  });
  assert.deepEqual(leaked, [],
    'a line the model never answered was still offered deterministic candidates. That is the '
    + 'exact board Warwick received on 2026-08-18');
});

test('FAIL LOUD: no reasoning consumer bound means the shop STOPS, never a scorer fallback', async () => {
  await assert.rejects(
    () => decideBasket({
      plan: demoteDeterministicDecisions(mechanicalPlan()),
      regulars: catalogue.regulars, rules: catalogue.rules, contract, household: 1,
      consult: undefined,
    }),
    (err) => err instanceof DecisionUnavailableError && /MUST NOT decide in its place/.test(err.message),
    'an unbound model degraded silently - which is the behaviour Gate 2 failed',
  );
});

test('FAIL LOUD: a model that throws stops the shop', async () => {
  await assert.rejects(
    () => decideOverCorpus(() => { throw new Error('gateway unreachable'); }),
    (err) => err instanceof DecisionUnavailableError && /gateway unreachable/.test(err.message),
  );
});

test('FAIL LOUD: an unreadable reply is never read as a decision', async () => {
  await assert.rejects(
    () => decideOverCorpus(() => 'I think you should buy some nice biscuits'),
    (err) => err instanceof DecisionUnavailableError,
    'prose was accepted as a decision',
  );
});

test('FAIL LOUD: no contract means no decision - finding 8 cannot recur by accident', async () => {
  await assert.rejects(
    () => decideBasket({
      plan: demoteDeterministicDecisions(mechanicalPlan()),
      regulars: catalogue.regulars, rules: catalogue.rules, household: 1,
      contract: null, consult: correctConsult,
    }),
    (err) => err instanceof DecisionUnavailableError && /contract was not supplied/.test(err.message),
  );
});

test('AN EXACT LOOKUP IS SETTLED: the model may not overturn it, however confidently', async () => {
  const before = mechanicalPlan();
  const out = await decideOverCorpus((g) => ({
    // Answer EVERY line, including the ones the catalogue bound exactly.
    decisions: g.lines.map((l) => ({
      line_no: l.line_no, verdict: 'select', regular_id: 33, reason: 'everything is toffee',
    })),
  }));

  const exactLines = before.items
    .map((item, i) => ({ item, i }))
    .filter(({ item }) => !isDecisionLine(item) && !item.flags.includes('matched tolerantly'));

  assert.ok(exactLines.length >= 1, 'the corpus no longer contains an exact binding to protect');
  exactLines.forEach(({ item, i }) => {
    assert.equal(out.plan.items[i].matched_product, item.matched_product,
      `line ${known.lines[i].n}: the model overwrote an identity that was never in doubt`);
  });
  assert.ok(out.audit.rejected.some((r) => /already bound by exact lookup/.test(r.why)),
    'the refusal was not recorded, so a reviewer could not see that it happened');
});

test('A TOLERANT BINDING IS CORRECTABLE, and the change is recorded as a correction', async () => {
  const before = mechanicalPlan();
  const i31 = known.lines.findIndex((l) => l.n === 31);
  const out = await decideOverCorpus(correctConsult);

  assert.notEqual(out.plan.items[i31].matched_product, before.items[i31].matched_product,
    'the wrong tolerant binding survived the decision');
  const record = out.audit.corrected.find((c) => c.line_no === 31);
  assert.ok(record, 'a binding changed and nothing recorded that it had been something else');
  assert.equal(record.was, 'TRESemme Rich Moisture HAIR SHAMPOO 680 ml');
});

// =====================================================================
// THE LIVE RETAILER SURFACE - not exercised here, and NOT foreclosed
//
// Warwick, 2026-08-18 (order amendment 8b5b3ff): "The fact that no committed
// fixture contains the live Favourites list does NOT waive the requirement for
// the joined production route to inspect/use the live Favourites surface."
//
// Nothing in the estate holds that list, so nothing offline can exercise it and
// NOTHING HERE FABRICATES ONE. What these assertions hold open is the SHAPE: the
// decision call must be able to receive the live Favourites / Regulars grid the
// moment the browser lane reads it, and must never treat "nobody looked" as
// "looked and it was not there". Veritas proves the behaviour on the joined
// live route; this proves the door is not nailed shut.
// =====================================================================

test('LIVE SURFACE: the decision call ADMITS live Favourites evidence when it is supplied', async () => {
  let seen = null;
  await decideBasket({
    plan: demoteDeterministicDecisions(mechanicalPlan()),
    regulars: catalogue.regulars,
    rules: catalogue.rules,
    contract,
    household: 1,
    retailerEvidence: {
      source: 'asda favourites grid',
      captured_at: '2026-08-18T19:00:00Z',
      favourites: [{ name: 'ASDA Dairy Toffee 180g', product_ref: '3707569' }],
      regulars: [{ name: 'Lurpak Slightly Salted Butter 200g' }],
    },
    consult: (g) => { seen = g; return correctConsult(g); },
  });

  assert.ok(seen.live_retailer_surface,
    'the live retailer surface cannot reach the decision at all - the shape forecloses the '
    + 'established method, whose FIRST step is the live Favourites / Regulars grid');
  assert.equal(seen.live_retailer_surface.favourites[0].name, 'ASDA Dairy Toffee 180g');
  assert.equal(seen.live_retailer_surface.source, 'asda favourites grid');

  const { buildDecisionPrompt } = require('../skill/decide.js');
  const prompt = buildDecisionPrompt(seen);
  assert.match(prompt, /ASDA Dairy Toffee 180g/,
    'the live surface reached the grounding and never reached the model');
  assert.match(prompt, /THE ESTABLISHED SHOPPING METHOD/,
    'the decision is not told the method whose first step is the live surface');
});

test('LIVE SURFACE: ABSENT is reported as NOT INSPECTED, never as an empty Favourites list', async () => {
  // The distinction this Work Order must not blur. An empty list asserts that
  // the grid was READ and did not contain the product - a fact nobody
  // established - and would push a line to `search` on evidence never gathered.
  let seen = null;
  await decideOverCorpus((g) => { seen = g; return correctConsult(g); });

  assert.equal(seen.live_retailer_surface, null,
    'an un-inspected retailer surface was reported as an empty result, which is a claim about '
    + 'the live account that nothing in this route ever checked');

  const { buildDecisionPrompt } = require('../skill/decide.js');
  const prompt = buildDecisionPrompt(seen);
  assert.match(prompt, /NOT INSPECTED ON THIS ROUTE/,
    'the model is not told the difference between "not in Favourites" and "nobody looked"');
  assert.doesNotMatch(prompt, /"favourites":\[\]/,
    'an empty Favourites array was sent as though the grid had been read');
});

test('LIVE SURFACE: no offline path fabricates one', () => {
  // The order is explicit: record the gap, do not manufacture a source. So the
  // corpus path must produce exactly nothing here, from anywhere.
  const g = require('../skill/decide.js').buildDecisionGrounding({
    plan: demoteDeterministicDecisions(mechanicalPlan()),
    regulars: catalogue.regulars,
    rules: catalogue.rules,
    contract,
    household: 1,
  });
  assert.equal(g.live_retailer_surface, null,
    'a Favourites source appeared from somewhere offline. Nothing in the estate holds that list, '
    + 'so anything here would be invented');
});
