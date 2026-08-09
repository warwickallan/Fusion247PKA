// =====================================================================
// BUILD-015 AsdAIr - WO-Y: ruleConsumption.test.js
//
// Runs under: node --test
//
// THE PROPERTY UNDER TEST, as accepted by Larry on 2026-08-04 (it supersedes
// the Work Order's original wording, which was wrong about its own first
// example):
//
//   a list line covered by an active rule or a prior answer must not enter the
//   question queue as an UNRESOLVED / UNIDENTIFIED line; where a rule
//   deliberately holds it, the question must carry that rule's reason and any
//   recorded prior answer.
//
// The distinction matters and is the whole point. Rules 12 and 25 are
// `needs_decision` directives: asking IS their job, because "buy only if on
// offer" cannot be evaluated without a price the schema does not have. The
// 2026-08-03 defect was never that Azera was asked about. It was that Azera was
// asked about as an unidentified item with NO reason attached, so Warwick
// re-derived an answer he had recorded on 2026-07-06.
//
// PROVENANCE OF THE FIXTURES - read this before trusting a row.
//
//   LIVE-VERIFIED (queried by Larry, 2026-08-04):
//     rule 12  needs_decision  match_term "Nescafe Azera"  matched_product NULL
//     rule 25  needs_decision  match_term "Nescafe"        matched_product NULL
//     rule 32  info            match_term "sure male"
//     rule 36  info            match_term NULL  <- global, no target
//     rule 37  info            match_term "sure male"
//     rule 38  info            match_term NULL  <- global, no target
//     regular 15  "Yazoo Chocolate Milk Drink 400ml"
//                 aka ["chocolate yazoo", "choc yazoo", "choc yazoos"]
//     regular 11  "ASDA British Double Gloucester 400g"
//                 aka ["double gloucester"]
//
//   CONSTRUCTED (shape is realistic, exact values NOT verified against the
//   live database, and marked again at each use): the Azera regular and its
//   aliases, the two Sure variants, the Ariel Pods regular, every rule_qa_log
//   row, and all rule_text / reason wording. Where a test depends on a
//   constructed value it proves the MECHANISM, not the live case.
//
// PURE ASCII throughout - no currency symbols, so the multibuy rule's wording
// is paraphrased with "GBP" rather than reproduced byte-for-byte.
// =====================================================================

'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const { planBasket } = require('./planner.js');

const HOUSEHOLD = 1;

// ---------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------

// LIVE-VERIFIED directive/match_term values; reason/rule_text wording is
// CONSTRUCTED (the live text is recorded in the Work Order, not reproduced
// here byte-for-byte because it carries a currency symbol).
function liveRules() {
  return [
    {
      id: 12, active: true, household_id: null, scope: 'product',
      directive: 'needs_decision', match_term: 'Nescafe Azera',
      match_category: null, matched_product: null,
      rule_text: 'Nescafe means Azera only; add only if on offer, otherwise flag the full price and do not add.',
      reason: 'Azera is the household coffee; a plain Americano is not an acceptable substitute.',
      note: null
    },
    {
      id: 25, active: true, household_id: null, scope: 'product',
      directive: 'needs_decision', match_term: 'Nescafe',
      match_category: null, matched_product: null,
      rule_text: 'Nescafe generic-phrasing trigger: flag for a human because Azera is added only if on offer.',
      reason: 'Generic Nescafe phrasing always needs a human.',
      note: null
    },
    {
      id: 32, active: true, household_id: null, scope: 'product',
      directive: 'info', match_term: 'sure male',
      match_category: null, matched_product: null,
      rule_text: 'Sure male: ROTATE the variant each week - pick DIFFERENT from the previous order',
      reason: null, note: null
    },
    {
      id: 36, active: true, household_id: null, scope: 'global',
      directive: 'info', match_term: null,
      match_category: null, matched_product: null,
      rule_text: 'OFFER RULE: if a multibuy gives >=50% off the EXTRA item(s), buy up to the offer quantity.',
      reason: null, note: null
    },
    {
      id: 37, active: true, household_id: null, scope: 'product',
      directive: 'info', match_term: 'sure male',
      match_category: null, matched_product: null,
      rule_text: 'Sure any 2 for GBP X: round qty UP to an even number to capture every pair; add a FEMALE variant to complete the last pair.',
      reason: null, note: null
    },
    {
      id: 38, active: true, household_id: null, scope: 'global',
      directive: 'info', match_term: null,
      match_category: null, matched_product: null,
      rule_text: 'REAL cause of add-to-trolley failing = the item is OUT OF STOCK, not an expired slot.',
      reason: null, note: null
    }
  ];
}

function ruleById(rules, id) {
  return rules.filter(function (r) { return r.id === id; })[0];
}

// regulars 15 and 11 are LIVE-VERIFIED. The rest are CONSTRUCTED.
function regulars() {
  return [
    // --- LIVE-VERIFIED ---
    { id: 15, household_id: HOUSEHOLD, name: 'Yazoo Chocolate Milk Drink 400ml',
      aka: ['chocolate yazoo', 'choc yazoo', 'choc yazoos'], asda_product_id: null },
    { id: 11, household_id: HOUSEHOLD, name: 'ASDA British Double Gloucester 400g',
      aka: ['double gloucester'], asda_product_id: null },

    // --- CONSTRUCTED: shape realistic, values unverified ---
    { id: 90, household_id: HOUSEHOLD, name: 'Nescafe Azera Barista Style Instant Coffee 100g',
      aka: ['azera coffee', 'nescafe azera'], asda_product_id: null },
    { id: 91, household_id: HOUSEHOLD, name: 'Sure Men Quantum Dry Anti-Perspirant',
      aka: ['sure male'], asda_product_id: null },
    { id: 92, household_id: HOUSEHOLD, name: 'Sure Men Sensitive Anti-Perspirant',
      aka: ['sure male'], asda_product_id: null },
    { id: 93, household_id: HOUSEHOLD, name: 'Ariel All-in-1 Pods Original 38 Washes',
      aka: ['ariel pods'], asda_product_id: null }
  ];
}

// ---------------------------------------------------------------------
// rule_qa_log fixtures.
//
// ROWS 2 AND 5 ARE LIVE, VERBATIM (queried by Warwick, 2026-08-04). They are
// the reason this file changed after the first pass: the constructed
// single-topic rows the first version used proved the mechanism and completely
// missed the real shapes.
//
// ROWS 1, 3 AND 4 ARE ALSO LIVE AND VERBATIM (supplied 2026-08-04, after the
// first pass shipped with constructed stand-ins for them). Row 1 turned out
// NOT to be single-topic: it is a GLOBAL POLICY row carrying two policies, no
// `Key=` fragments, and no product name at all - a fourth shape the first
// implementation had no answer for. All five rows in this file are now real.
// ---------------------------------------------------------------------
const LIVE_BATCH_QUESTION =
  'First Telegram-photo shop threw 7 ambiguities: Ariel Pods size, Sure variant, '
  + 'Sausage Baps, Wall\'s pack size, Soooo perfume scent, Custard&Jelly pots, Fruit Splits.';

const LIVE_BATCH_ANSWER =
  'Ariel=best value/wash; Sure=rotate variant weekly (different each time); '
  + 'Sausage Baps=Rustlers Sausage Muffin; Wall\'s=4-pack; perfume=So...? Honey Oud; '
  + 'Custard&Jelly=DISCONTINUED/ignore; '
  + 'Fruit Splits=ice lollies, fallback Just Essentials Fruit Lollies 8x35ml.';

const LIVE_POINTER_ANSWER =
  'Established the product-specific matching rules now recorded in asdair.rules '
  + 'with scope=product (rules 10-16, 18-22).';

// LIVE, VERBATIM. A GLOBAL POLICY row: two policies, no `Key=` fragments, and
// no product named anywhere. promoted_rule_id 2 is a target-less global rule.
const LIVE_POLICY_QUESTION =
  'How should items with no quantity, and duplicate list entries, be handled?';
const LIVE_POLICY_ANSWER =
  'Items with no quantity default to 1; duplicate list entries are deduped to a single line.';

// The two target-less GLOBAL rules row 1 was promoted into. Its content
// independently confirms both, which is a free consistency check on the
// planner's own rule-1/rule-2/rule-3 behaviour (normaliseQty and dedupeList).
function globalPolicyRules() {
  return [
    { id: 2, active: true, household_id: null, scope: 'global', directive: 'info',
      match_term: null, match_category: null, matched_product: null,
      rule_text: 'A missing quantity defaults to 1.', reason: null, note: null },
    { id: 3, active: true, household_id: null, scope: 'global', directive: 'info',
      match_term: null, match_category: null, matched_product: null,
      rule_text: 'Duplicate list entries are deduped to a single line.', reason: null, note: null }
  ];
}

// A TARGETED rule, so rows 3 and 4 (promoted_rule_id 17) are correctly NOT
// classified as policy.
function yazooFlavourRule() {
  return {
    id: 17, active: true, household_id: null, scope: 'product', directive: 'exclude',
    match_term: 'banana yazoo', match_category: null, matched_product: null,
    rule_text: 'Never buy Banana Yazoo - Banana is disliked.',
    reason: 'Banana is disliked.', note: null
  };
}

function priorAnswers() {
  return [
    // --- LIVE, VERBATIM ---
    { id: 1, asked_on: '2026-07-06', household_id: HOUSEHOLD,
      question: LIVE_POLICY_QUESTION, answer: LIVE_POLICY_ANSWER,
      applies_going_forward: true, promoted_rule_id: 2 },
    { id: 3, asked_on: '2026-07-13', household_id: HOUSEHOLD,
      question: 'Yazoo flavour preference?',
      answer: 'Never Banana (disliked); default to Chocolate or Strawberry; flag if only Banana is in stock.',
      applies_going_forward: true, promoted_rule_id: 17 },
    { id: 4, asked_on: '2026-07-13', household_id: HOUSEHOLD,
      question: 'Banana Yazoo appeared on a list and was held (needs_decision). What is the standing rule?',
      answer: 'Never buy Banana Yazoo again - hard rule (Banana disliked). Exclude it whenever it appears; '
        + 'Chocolate/Strawberry are the accepted flavours.',
      applies_going_forward: true, promoted_rule_id: 17 },
    { id: 2, asked_on: '2026-07-21', household_id: HOUSEHOLD,
      question: 'How were the product-specific matching decisions captured?',
      answer: LIVE_POINTER_ANSWER,
      applies_going_forward: true, promoted_rule_id: null },
    { id: 5, asked_on: '2026-07-21', household_id: HOUSEHOLD,
      question: LIVE_BATCH_QUESTION, answer: LIVE_BATCH_ANSWER,
      applies_going_forward: true, promoted_rule_id: null }
  ];
}

// CONSTRUCTED. The previous shop held the Quantum Dry variant.
function lastOrderWithQuantumDry() {
  return {
    household_id: HOUSEHOLD,
    order: { id: 700 },
    lines: [
      { item_name: 'sure male', matched_product: 'Sure Men Quantum Dry Anti-Perspirant',
        added_qty: 3, regular_id: 91 }
    ]
  };
}

function plan(listItems, overrides) {
  const o = overrides || {};
  return planBasket({
    listItems: listItems,
    rules: o.rules !== undefined ? o.rules : liveRules(),
    products: o.products !== undefined ? o.products : [],
    regulars: o.regulars !== undefined ? o.regulars : regulars(),
    budget: null,
    household: o.household !== undefined ? o.household : HOUSEHOLD,
    lastOrder: o.lastOrder,
    rotation: o.rotation,
    priorAnswers: o.priorAnswers
  });
}

function lineFor(result, name) {
  const hit = result.items.filter(function (it) { return it.item_name === name; })[0];
  assert.ok(hit, 'expected a plan line for ' + JSON.stringify(name));
  return hit;
}

// ---------------------------------------------------------------------
// 1. THE AZERA CASE - a rule that deliberately holds must say WHY.
// ---------------------------------------------------------------------

test('"bottle Azera coffee" is held by rule 12 AND the question carries rule 12s reason', function () {
  const line = lineFor(plan([{ item_name: 'bottle Azera coffee', requested_qty: 1 }]), 'bottle Azera coffee');

  assert.equal(line.status, 'needs_decision', 'rule 12 is a needs_decision directive - asking IS its job');
  assert.ok(line.flags.includes('flagged by rule'),
    'the hold must be attributed to the rulebook, not to the line being unidentifiable');
  assert.equal(line.flags.includes('no explicit product mapping'), false,
    'this is the defect: it must NOT reach Warwick as an unidentified line');
  assert.match(line.note, /held by rule: Azera is the household coffee/,
    'the recorded reason must travel with the question');
});

test('rule 25 ("Nescafe") alone does NOT fire on "bottle Azera coffee"', function () {
  // The dangerous direction, twice over:
  //   * the two strings share nothing, so a bare word-overlap threshold would
  //     still fire rule 25 here;
  //   * and the line resolves to a product whose NAME begins "Nescafe", so a
  //     naive "also match the resolved product" rule fires it too - which it
  //     did, until termIsSpecificEnoughToNameAProduct() was added. A one-word
  //     brand term would otherwise claim that brand's entire range forever.
  const rules = [ruleById(liveRules(), 25)];
  const line = lineFor(plan([{ item_name: 'bottle Azera coffee', requested_qty: 1 }], { rules: rules }),
    'bottle Azera coffee');

  assert.equal(line.flags.includes('flagged by rule'), false, 'rule 25 must not claim this line');
  assert.equal(/held by rule/.test(line.note), false);
});

test('rule 25 DOES still fire on the generic phrasing it was written for', function () {
  // The other half: narrowing rule 25 must not switch it off. The week the
  // list just says "Nescafe" is precisely its job.
  const rules = [ruleById(liveRules(), 25)];
  const line = lineFor(plan([{ item_name: 'Nescafe', requested_qty: 1 }], { rules: rules }), 'Nescafe');
  assert.ok(line.flags.includes('flagged by rule'));
  assert.match(line.note, /held by rule: Generic Nescafe phrasing always needs a human\./);
});

test('an ADVISORY-grade rule match may HOLD a line but may never name a product', function () {
  const line = lineFor(plan([{ item_name: 'bottle Azera coffee', requested_qty: 1 }]), 'bottle Azera coffee');
  // It resolved through the regulars alias "azera coffee" (CONSTRUCTED alias),
  // never through the advisory rule match - rule 12 carries matched_product
  // NULL live, so there is nothing for it to name even if it wanted to.
  assert.equal(line.planned_qty, 0, 'a held line never puts units in the basket');
  assert.equal(line.flags.includes('product mapped by rule'), false,
    'an advisory-grade match must never apply a mapping');
});

// ---------------------------------------------------------------------
// 2. PRIOR ANSWERS - rule_qa_log, finally read.
// ---------------------------------------------------------------------

test('LIVE BATCH ROW: "Ariel Pods" gets ITS fragment, not all seven answers', function () {
  const line = lineFor(
    plan([{ item_name: 'Ariel Pods', requested_qty: 1 }], { priorAnswers: priorAnswers() }),
    'Ariel Pods'
  );
  assert.ok(line.flags.includes('prior decision on record'));
  assert.match(line.note, /prior decision \(2026-07-21\): best value\/wash/);

  // The failure this second pass exists to prevent: six other households'
  // decisions arriving on a card about laundry detergent.
  ['Rustlers', 'Honey Oud', 'DISCONTINUED', 'Fruit Lollies', '4-pack'].forEach(function (leak) {
    assert.equal(line.note.indexOf(leak), -1, 'the card must not carry the ' + leak + ' answer');
  });
  assert.equal(line.flags.includes('prior batch answer not split'), false);
});

test('LIVE BATCH ROW: "Sure male" gets its own fragment from the same row', function () {
  const line = lineFor(
    plan([{ item_name: 'Sure male', requested_qty: 1 }], { priorAnswers: priorAnswers() }),
    'Sure male'
  );
  assert.match(line.note, /prior decision \(2026-07-21\): rotate variant weekly \(different each time\)/);
  assert.equal(line.note.indexOf('best value/wash'), -1, 'the Ariel answer belongs to the Ariel line');
});

test('LIVE POINTER ROW: an answer that names rules is never surfaced as a decision', function () {
  // Live row 2 states no decision - it says where the decisions went. Rules
  // 10-16 / 18-22 do not speak to this line, so nothing at all is surfaced.
  const only = priorAnswers().filter(function (qa) { return qa.id === 2; });
  const line = lineFor(plan([{ item_name: 'Ariel Pods', requested_qty: 1 }], { priorAnswers: only }), 'Ariel Pods');

  assert.equal(line.flags.includes('prior decision on record'), false);
  assert.equal(line.flags.includes('prior decision recorded as rules'), false);
  assert.equal(line.note.indexOf('asdair.rules'), -1, 'this must never reach a card');
  assert.equal(line.note.indexOf('scope=product'), -1);
});

test('POINTER REFUSAL is load-bearing: even when the question names the line, it is not a decision', function () {
  // The test above passes partly because the live row 2 question names no
  // product, so it would not link anyway. That makes it a weak proof of the
  // refusal. This is the strong one: the same pointer TEXT under a question
  // that does name the line. The refusal is now the only thing standing
  // between "Established the product-specific matching rules now recorded in
  // asdair.rules..." and Warwick's card.
  const pointerNamingTheLine = [{
    id: 97, asked_on: '2026-07-21', household_id: HOUSEHOLD,
    question: 'What did we decide about Ariel Pods?',
    answer: LIVE_POINTER_ANSWER,
    applies_going_forward: true, promoted_rule_id: null
  }];
  const line = lineFor(
    plan([{ item_name: 'Ariel Pods', requested_qty: 1 }], { priorAnswers: pointerNamingTheLine }),
    'Ariel Pods'
  );
  assert.equal(line.flags.includes('prior decision on record'), false,
    'an answer that names rules instead of stating one is not a decision');
  assert.equal(line.note.indexOf('asdair.rules'), -1);
  assert.equal(line.note.indexOf('Established the product-specific'), -1);
});

test('LIVE POINTER ROW: followed to a rule that DOES speak here, it records provenance only', function () {
  const only = priorAnswers().filter(function (qa) { return qa.id === 2; });
  // Rule 12 is one of the rules the pointer names (10-16), and it holds this line.
  const line = lineFor(
    plan([{ item_name: 'bottle Azera coffee', requested_qty: 1 }], { priorAnswers: only }),
    'bottle Azera coffee'
  );
  assert.ok(line.flags.includes('prior decision recorded as rules'));
  assert.equal(line.note.indexOf('asdair.rules'), -1, 'the pointer text itself is still never quoted');
  assert.match(line.note, /held by rule: Azera is the household coffee/,
    'what the human sees is the RULE, which is where the decision actually lives');
});

test('a compound answer that cannot be isolated SAYS SO, and shows the raw text', function () {
  // Two overlapping keys both name the line, so no single fragment can be
  // trusted. Neither dumping nor dropping is acceptable - both directions are
  // made visible instead.
  const ambiguous = [{
    id: 99, asked_on: '2026-07-21', household_id: HOUSEHOLD,
    question: 'Batch: Sure male and Sure male sensitive?',
    answer: 'Sure=rotate weekly; Sure male=blue range only',
    applies_going_forward: true, promoted_rule_id: null
  }];
  const line = lineFor(plan([{ item_name: 'Sure male', requested_qty: 1 }], { priorAnswers: ambiguous }), 'Sure male');

  assert.ok(line.flags.includes('prior batch answer not split'));
  assert.ok(line.flags.includes('prior decision on record'));
  assert.match(line.note, /a prior batch answer from 2026-07-21 covers this; it could not be split automatically/);
  assert.match(line.note, /Sure=rotate weekly; Sure male=blue range only/, 'the raw text must still be shown');
});

test('a compound answer whose keys name nothing on this line also says so', function () {
  const noKey = [{
    id: 98, asked_on: '2026-07-21', household_id: HOUSEHOLD,
    question: 'Batch covering the tinned tomatoes and more',
    answer: 'Ariel=best value/wash; Sure=rotate variant weekly',
    applies_going_forward: true, promoted_rule_id: null
  }];
  const line = lineFor(plan([{ item_name: 'tinned tomatoes', requested_qty: 1 }], { priorAnswers: noKey }), 'tinned tomatoes');

  assert.ok(line.flags.includes('prior batch answer not split'));
  assert.equal(line.note.indexOf('prior decision (2026-07-21): best value/wash'), -1,
    'it must not pick a fragment it could not justify');
});

test('REFUSAL: a line the batch row says nothing about links to nothing', function () {
  // The fragment-key link must not become a back door. None of the seven keys
  // names bread, and the question does not either.
  const line = lineFor(
    plan([{ item_name: 'Warburtons white bread', requested_qty: 1 }], { priorAnswers: priorAnswers() }),
    'Warburtons white bread'
  );
  assert.equal(line.flags.includes('prior decision on record'), false);
  assert.equal(line.flags.includes('prior batch answer not split'), false);
  assert.equal(line.note.indexOf('best value/wash'), -1);
});

test('REFUSAL: a fragment key needs ALL its words, not one of them', function () {
  const { fragmentKeyMatchesLine } = require('./planner.js')._internal;
  assert.equal(fragmentKeyMatchesLine('Fruit Splits', 'fruit juice'), false,
    '"Fruit Splits" must not claim a line that only says "fruit"');
  assert.equal(fragmentKeyMatchesLine('Sausage Baps', 'sausages'), false);
  assert.equal(fragmentKeyMatchesLine('Ariel', 'Ariel Pods'), true);
});

test('LIVE ROW 4: a single-topic answer is still emitted whole', function () {
  const rules = liveRules().concat([yazooFlavourRule()]);
  const line = lineFor(
    plan([{ item_name: 'banana yazoo', requested_qty: 1 }],
      { rules: rules, priorAnswers: priorAnswers() }),
    'banana yazoo'
  );
  assert.match(line.note, /prior decision \(2026-07-13\): Never buy Banana Yazoo again/);
  assert.equal(line.flags.includes('prior batch answer not split'), false);
  assert.ok(line.flags.includes('prior decision on record'));
});

test('LIVE ROW 4: "hard rule (Banana disliked)" is not misread as a rule REFERENCE', function () {
  // A genuine near-miss: the answer contains the literal word "rule" and the
  // question ends "What is the standing rule?". Requiring DIGITS after the
  // word is what stops row 4 being silently reclassified as a pointer and
  // dropped - which would lose a hard household exclusion.
  const { referencedRuleIds } = require('./planner.js')._internal;
  const row4 = priorAnswers().filter(function (qa) { return qa.id === 4; })[0];
  assert.deepEqual(referencedRuleIds(row4.answer), []);
  assert.deepEqual(referencedRuleIds(row4.question), []);
});

// ---------------------------------------------------------------------
// LIVE ROW 1 - the GLOBAL POLICY shape, and the fourth outcome.
// ---------------------------------------------------------------------

test('LIVE POLICY ROW: list mechanics never land on a product card', function () {
  const rules = liveRules().concat(globalPolicyRules());
  const line = lineFor(
    plan([{ item_name: 'Double Glouester cheese', requested_qty: 1 }],
      { rules: rules, priorAnswers: priorAnswers() }),
    'Double Glouester cheese'
  );
  assert.equal(line.note.indexOf('Items with no quantity default to 1'), -1,
    'a policy about list handling is not a decision about cheese');
  assert.equal(line.note.indexOf('deduped'), -1);
  assert.equal(line.flags.includes('prior batch answer not split'), false);
});

test('POLICY REFUSAL is load-bearing: it holds even when the question names the line', function () {
  // The live row 1 question happens to name no product, so it would not link
  // by question text anyway - which would make the test above a weak proof,
  // green because the scenario cannot occur rather than because the guard
  // works. This is the strong one: the same policy ANSWER under a question
  // that does name the line, so route 1 would link and only the guard stops
  // it. Mutation-tested.
  const policyNamingTheLine = [{
    id: 96, asked_on: '2026-07-06', household_id: HOUSEHOLD,
    question: 'How should duplicate cheese entries and items with no quantity be handled?',
    answer: LIVE_POLICY_ANSWER,
    applies_going_forward: true, promoted_rule_id: 2
  }];
  const rules = liveRules().concat(globalPolicyRules());
  const line = lineFor(
    plan([{ item_name: 'cheese', requested_qty: 1 }],
      { rules: rules, priorAnswers: policyNamingTheLine }),
    'cheese'
  );
  assert.equal(line.flags.includes('prior decision on record'), false,
    'a decision recorded as a target-less GLOBAL rule is about every line, so about no product');
  assert.equal(line.note.indexOf('Items with no quantity default to 1'), -1);
});

test('a row promoted to a TARGETED rule is not policy, and still links', function () {
  // The other half of the asymmetry: rows 3 and 4 also carry a
  // promoted_rule_id. Rule 17 has a target, so they are ordinary decisions.
  const { isPolicyAnswer } = require('./planner.js')._internal;
  const rows = priorAnswers();
  const rules = globalPolicyRules().concat([yazooFlavourRule()]);

  assert.equal(isPolicyAnswer(rows.filter(function (r) { return r.id === 1; })[0], rules), true);
  assert.equal(isPolicyAnswer(rows.filter(function (r) { return r.id === 4; })[0], rules), false);
});

test('an UNRESOLVABLE promoted_rule_id fails towards surfacing, never towards silence', function () {
  // Dropping a stating row because its promoted rule is inactive or unloaded
  // would lose recorded knowledge - the exact failure this Work Order exists
  // to end. Unknown must mean "not policy".
  const { isPolicyAnswer } = require('./planner.js')._internal;
  const row = { promoted_rule_id: 4242, answer: 'x' };
  assert.equal(isPolicyAnswer(row, globalPolicyRules()), false);
  assert.equal(isPolicyAnswer(row, []), false);
});

test('the global policy row confirms the planner rules it was promoted into', function () {
  // Row 1 says: no quantity -> 1, and duplicates dedupe to one line. That is
  // rules 2 and 3, and the planner has always implemented both. A free
  // consistency check between the household's recorded words and the code.
  //
  // CORRECTED 2026-08-04 (WO-ZJ). This asserted 3, "a missing quantity defaults
  // to 1, then sums". The row itself (LIVE_POLICY_ANSWER, verbatim) says only
  // "Items with no quantity default to 1; duplicate list entries are deduped to
  // a single line." It says NOTHING about arithmetic -- "then sums" was this
  // test over-reading Warwick's own recorded words, which is precisely the
  // inference planner.js:1338 exists to forbid. The row was always right; the
  // test was misquoting it. Only the ONE written quantity is a statement of
  // quantity, so the merged line is 2.
  const result = plan([
    { item_name: 'choc yazoo' },                        // no quantity at all
    { item_name: 'choc yazoo', requested_qty: 2 }       // duplicate entry
  ]);
  assert.equal(result.items.length, 1, 'duplicate entries dedupe to a single line');
  assert.equal(result.items[0].requested_qty, 2, 'the one written quantity stands; the row says dedupe, never sum');
});

test('the global policy row: its OTHER half - no quantity anywhere still defaults to 1', function () {
  // Restores coverage the correction above would otherwise lose. Once the
  // explicit 2 legitimately wins, that scenario no longer demonstrates the
  // row's first clause ("Items with no quantity default to 1"), so it is
  // proven here directly, against a pair of duplicates that state no quantity
  // at all. Both halves of the household's recorded policy stay checked.
  const bare = plan([
    { item_name: 'choc yazoo' },
    { item_name: 'choc yazoo' }
  ]);
  assert.equal(bare.items.length, 1, 'duplicate entries dedupe to a single line');
  assert.equal(bare.items[0].requested_qty, 1, 'no quantity written anywhere -> 1, never 2');
});

test('a rule reference is not confused with a quantity or a pack size', function () {
  const { referencedRuleIds } = require('./planner.js')._internal;
  assert.deepEqual(referencedRuleIds('rules 10-16, 18-22'), [10, 11, 12, 13, 14, 15, 16, 18, 19, 20, 21, 22]);
  assert.deepEqual(referencedRuleIds('rule 7'), [7]);
  assert.deepEqual(referencedRuleIds("Wall's=4-pack; Fruit Lollies 8x35ml"), [],
    'a pack size must never be read as a rule reference');
  assert.deepEqual(referencedRuleIds(LIVE_BATCH_ANSWER), [],
    'the live batch answer states decisions; it points at no rule');
});

test('WITHOUT the prior answers input the same line carries nothing - the loader is load-bearing', function () {
  const line = lineFor(plan([{ item_name: 'Ariel Pods', requested_qty: 1 }]), 'Ariel Pods');
  assert.equal(line.flags.includes('prior decision on record'), false);
  assert.equal(/prior decision/.test(line.note), false);
});

test('a prior answer NEVER names a product', function () {
  // "best value/wash" is a selection heuristic, not an identity - and
  // evaluating it needs a price the schema does not have.
  const withAnswer = lineFor(
    plan([{ item_name: 'Ariel Pods', requested_qty: 1 }], { priorAnswers: priorAnswers() }),
    'Ariel Pods'
  );
  const withoutAnswer = lineFor(plan([{ item_name: 'Ariel Pods', requested_qty: 1 }]), 'Ariel Pods');
  assert.equal(withAnswer.matched_product, withoutAnswer.matched_product,
    'consulting the log must not change WHICH product was resolved');
});

test('a one-off answer (applies_going_forward false) is ignored', function () {
  const oneOff = priorAnswers().map(function (qa) {
    return Object.assign({}, qa, { applies_going_forward: false });
  });
  const line = lineFor(plan([{ item_name: 'Ariel Pods', requested_qty: 1 }], { priorAnswers: oneOff }), 'Ariel Pods');
  assert.equal(line.flags.includes('prior decision on record'), false);
});

test('another household\'s recorded answer never reaches this household', function () {
  const foreign = priorAnswers().map(function (qa) {
    return Object.assign({}, qa, { household_id: 999 });
  });
  const line = lineFor(plan([{ item_name: 'Ariel Pods', requested_qty: 1 }], { priorAnswers: foreign }), 'Ariel Pods');
  assert.equal(line.flags.includes('prior decision on record'), false);
});

// ---------------------------------------------------------------------
// 3. ROTATION - reachable from the rulebook, with NO pipeline change.
// ---------------------------------------------------------------------

test('a `rotate` rule makes rotation happen with no `rotation` argument at all', function () {
  // This is the wiring-free path: stepPlan() already passes `rules` and
  // `lastOrder`, so a rotate directive is all that is missing.
  const rules = liveRules();
  ruleById(rules, 32).directive = 'rotate';   // what the handed-back migration does

  const line = lineFor(
    plan([{ item_name: 'Sure male', requested_qty: 1 }],
      { rules: rules, lastOrder: lastOrderWithQuantumDry() }),
    'Sure male'
  );

  assert.equal(line.status, 'add');
  assert.equal(line.matched_product, 'Sure Men Sensitive Anti-Perspirant',
    'it must pick a variant DIFFERENT from the one the last order held');
  assert.ok(line.flags.includes('rotated from last order'));
});

test('while rule 32 stays `info`, rotation does NOT happen - the data change is genuinely required', function () {
  // Proves the handback is honest: the code alone does not silently fix this,
  // and the household's data was not quietly edited to suit the planner.
  const line = lineFor(
    plan([{ item_name: 'Sure male', requested_qty: 1 }], { lastOrder: lastOrderWithQuantumDry() }),
    'Sure male'
  );
  assert.equal(line.flags.includes('rotated from last order'), false);
  assert.equal(line.status, 'needs_decision', 'two regulars answer "sure male", so it is ambiguous');
  assert.ok(line.flags.includes('ambiguous regulars match'));
});

test('LIVE 2026-08-04: rules 23 + 32 + 37 together produce NO question', function () {
  // Warwick read the live rows in full on 2026-08-04. They COMPOSE - they do
  // not clash:
  //   23  map    "Sure male" -> "Sure Men Anti-Perspirant Deodorant (blue variant)"
  //   32  rotate "Sure male (men's blue)": rotate the scent weekly
  //   37  info   "Sure male": round the quantity up to complete a pair
  // 23 picks the family, 32 picks this week's member, 37 handles quantity.
  //
  // db/007 recorded these as a conflict. That premise was WRONG, and if the
  // conflict detector had shipped as written, Sure would have become a
  // needs_decision EVERY WEEK - the exact failure this Work Order exists to
  // end. This test is the guard against reintroducing it.
  const rules = liveRules();
  ruleById(rules, 32).directive = 'rotate';                       // migration 013, APPLIED live
  ruleById(rules, 32).rule_text =
    'Sure male (mens "blue"): ROTATE the variant each week - pick DIFFERENT from the previous order';
  rules.push({
    id: 23, active: true, household_id: null, scope: 'product',
    directive: 'map', match_term: 'Sure male', match_category: null,
    matched_product: 'Sure Men Anti-Perspirant Deodorant (blue variant)',
    rule_text: 'Sure male = the mens blue range.', reason: null, note: null
  });

  const result = plan([{ item_name: 'Sure male', requested_qty: 1 }],
    { rules: rules, lastOrder: lastOrderWithQuantumDry() });
  const line = lineFor(result, 'Sure male');

  assert.equal(line.status, 'add', 'three complementary rules must not manufacture a question');
  assert.equal(result.summary.needs_decision, 0);
  assert.equal(line.flags.includes('rotation conflict'), false);
  assert.equal(line.matched_product, 'Sure Men Sensitive Anti-Perspirant',
    'the rotation still picks a variant different from the last order');
  assert.ok(line.flags.includes('rotation refines mapped family'));
  assert.match(line.note, /rotation refined the mapped family "Sure Men Anti-Perspirant Deodorant \(blue variant\)"/,
    'the family rule 23 chose stays traceable');
  assert.ok(line.flags.includes('rule advisory'), 'rule 37 still speaks about the quantity');
});

test('an explicit rotation argument still wins over the rulebook', function () {
  const rules = liveRules();
  ruleById(rules, 32).directive = 'rotate';
  const line = lineFor(
    plan([{ item_name: 'Sure male', requested_qty: 1 }], {
      rules: rules,
      lastOrder: lastOrderWithQuantumDry(),
      rotation: [{ active: true, household_id: null, match_term: 'sure male',
        candidates: ['Sure Men Cool Fresh Anti-Perspirant'] }]
    }),
    'Sure male'
  );
  assert.equal(line.matched_product, 'Sure Men Cool Fresh Anti-Perspirant');
});

// ---------------------------------------------------------------------
// 4. ADVISORIES - `info` rules carried, never actioned.
// ---------------------------------------------------------------------

test('targeted `info` rules 32 and 37 attach to the Sure line instead of being discarded', function () {
  const line = lineFor(plan([{ item_name: 'Sure male', requested_qty: 1 }]), 'Sure male');
  assert.ok(line.flags.includes('rule advisory'));
  assert.match(line.note, /rule advisory: Sure male: ROTATE the variant each week/);
  assert.match(line.note, /rule advisory: Sure any 2 for GBP X/);
});

test('GLOBAL `info` rules 36 and 38 reach basket review, once, and are attached to no line', function () {
  const result = plan([
    { item_name: 'Sure male', requested_qty: 1 },
    { item_name: '2 yazoo choc', requested_qty: 2 }
  ]);

  assert.equal(result.summary.advisories.length, 2, 'both target-less global rules must surface');
  const ids = result.summary.advisories.map(function (a) { return a.rule_id; }).sort();
  assert.deepEqual(ids, [36, 38]);
  assert.match(result.summary.advisories[0].text, /OFFER RULE/);

  result.items.forEach(function (it) {
    assert.equal(/OFFER RULE/.test(it.note), false,
      'a global rule must not be pasted onto every line - that is noise, and noise hides signal');
  });
});

test('an advisory never changes status, quantity or product', function () {
  const withInfoRules = plan([{ item_name: '2 yazoo choc', requested_qty: 2 }]);
  const withoutAnyRules = plan([{ item_name: '2 yazoo choc', requested_qty: 2 }], { rules: [] });

  const a = lineFor(withInfoRules, '2 yazoo choc');
  const b = lineFor(withoutAnyRules, '2 yazoo choc');
  assert.equal(a.status, b.status);
  assert.equal(a.planned_qty, b.planned_qty);
  assert.equal(a.matched_product, b.matched_product);
});

test('an advisory with an UNRECOGNISED scope still speaks - it can neither buy nor drop anything', function () {
  const rules = liveRules().filter(function (r) { return r.id === 37; });
  rules[0].scope = 'something-nobody-planned-for';
  const line = lineFor(plan([{ item_name: 'Sure male', requested_qty: 1 }], { rules: rules }), 'Sure male');
  assert.ok(line.flags.includes('rule advisory'),
    'silencing the rulebook over an unexpected scope string is the failure this WO exists to end');
});

test('an ACTIONABLE directive with an unrecognised scope is still refused', function () {
  // The other half of the asymmetry: an advisory speaks, a directive does not act.
  const rules = liveRules().filter(function (r) { return r.id === 12; });
  rules[0].scope = 'something-nobody-planned-for';
  const line = lineFor(plan([{ item_name: 'Nescafe Azera', requested_qty: 1 }], { rules: rules }), 'Nescafe Azera');
  assert.equal(line.flags.includes('flagged by rule'), false);
});

// ---------------------------------------------------------------------
// 5. TOLERANT RESOLUTION - the two live alias failures of 2026-08-03.
// ---------------------------------------------------------------------

test('"2 yazoo choc" resolves to regular 15 by WORD ORDER and never becomes a question', function () {
  const line = lineFor(plan([{ item_name: '2 yazoo choc', requested_qty: 2 }]), '2 yazoo choc');
  assert.equal(line.status, 'add');
  assert.equal(line.matched_product, 'Yazoo Chocolate Milk Drink 400ml');
  assert.ok(line.flags.includes('matched from regulars'));
});

test('"Double Glouester cheese" resolves to regular 11 through a ONE-LETTER misspelling', function () {
  const line = lineFor(plan([{ item_name: 'Double Glouester cheese', requested_qty: 1 }]), 'Double Glouester cheese');
  assert.equal(line.status, 'add');
  assert.equal(line.matched_product, 'ASDA British Double Gloucester 400g');
});

test('REFUSAL: a genuinely different product still becomes a question', function () {
  // Yazoo do make a strawberry one. It shares "yazoo" with the chocolate
  // alias, and buying chocolate instead is exactly the failure that is far
  // worse than asking.
  const line = lineFor(plan([{ item_name: 'Yazoo strawberry', requested_qty: 1 }]), 'Yazoo strawberry');
  assert.equal(line.status, 'needs_decision');
  assert.notEqual(line.matched_product, 'Yazoo Chocolate Milk Drink 400ml');
  assert.equal(line.matched_product, null);
});

test('REFUSAL: "double cream" is not Double Gloucester', function () {
  const line = lineFor(plan([{ item_name: 'double cream', requested_qty: 1 }]), 'double cream');
  assert.equal(line.matched_product, null);
  assert.equal(line.status, 'needs_decision');
});

test('EXACT alias matching still wins, so no previously-resolving line can change its answer', function () {
  const line = lineFor(plan([{ item_name: 'choc yazoo', requested_qty: 1 }]), 'choc yazoo');
  assert.equal(line.matched_product, 'Yazoo Chocolate Milk Drink 400ml');
  assert.equal(line.status, 'add');
});

// ---------------------------------------------------------------------
// 6. Scope and back-compatibility.
// ---------------------------------------------------------------------

test('global rules (household_id NULL) are NOT dropped by the household filter', function () {
  // WO-Y candidate cause 5, tested directly rather than reasoned about.
  const line = lineFor(plan([{ item_name: 'Sure male', requested_qty: 1 }], { household: 42 }), 'Sure male');
  assert.ok(line.flags.includes('rule advisory'), 'a household_id NULL rule applies to every household');
});

test('the summary keeps every pre-existing key and adds advisories additively', function () {
  const result = plan([{ item_name: '2 yazoo choc', requested_qty: 2 }]);
  ['total_requested', 'planned_add', 'needs_decision', 'excluded', 'excluded_standing',
    'excluded_this_week', 'estimated_total', 'currency', 'budget_flag'].forEach(function (k) {
    assert.ok(Object.prototype.hasOwnProperty.call(result.summary, k), 'summary must still carry ' + k);
  });
  assert.ok(Array.isArray(result.summary.advisories));
});

test('with no rules, no prior answers and no last order, planning is unchanged', function () {
  const result = plan([{ item_name: 'choc yazoo', requested_qty: 1 }], { rules: [] });
  assert.equal(result.summary.advisories.length, 0);
  assert.equal(lineFor(result, 'choc yazoo').status, 'add');
});

// ---------------------------------------------------------------------
// 7. THE DEAD 59% (B15-3 lane R1).
//
// Section 5 above proves an `info` rule's WORDS reach a human. It has never
// proved that the rule DOES anything - because until now it did not. rules 32,
// 36, 37 and 38 have been active for weeks, are echoed onto a note, and have
// never changed a product, a quantity or a status.
//
// These two tests hold the boundary between the two paths: what the
// deterministic planner refuses to act on is exactly what the prose rulebook
// picks up, and neither set leaks into the other.
// ---------------------------------------------------------------------

const rulebook = require('./rulebook.js');

test('the rules the deterministic planner drops are exactly the ones the rulebook picks up', function () {
  const rules = liveRules();
  const { actionableRules } = require('./planner.js')._internal;
  const actionable = actionableRules(rules).map(function (r) { return r.id; }).sort();
  const inert = rulebook.inertRules(rules, HOUSEHOLD).map(function (r) { return r.id; }).sort();

  assert.deepEqual(actionable, [12, 25], 'the deterministic set changed - re-read actionableRules()');
  assert.deepEqual(inert, [32, 36, 37, 38], 'the inert set changed - the two paths must partition the corpus');

  // No rule is in both, and none is in neither.
  inert.forEach(function (id) {
    assert.ok(actionable.indexOf(id) === -1, 'rule ' + id + ' is claimed by both paths');
  });
  assert.equal(actionable.length + inert.length, rules.length,
    'a rule belongs to neither path - it is on the floor, which is the defect this closes');
});

test('a judgement rule that has never fired reaches the reasoning consumer as its own words', function () {
  const rules = liveRules();
  const result = plan([{ item_name: 'Sure male', requested_qty: 3 }], { rules: rules });
  const grounding = rulebook.buildRulebookGrounding(result, rules, HOUSEHOLD);

  assert.ok(grounding, 'the Sure rules still reach nothing');
  const ids = grounding.rules.map(function (r) { return r.id; }).sort();
  assert.deepEqual(ids, [32, 36, 37, 38]);

  const prompt = rulebook.buildRulebookPrompt(grounding);
  assert.ok(prompt.indexOf(ruleById(rules, 37).rule_text) !== -1,
    "rule 37's own words are not in the prose sent to the consumer");
  assert.ok(prompt.indexOf(ruleById(rules, 36).rule_text) !== -1,
    "rule 36's own words are not in the prose sent to the consumer");
});
