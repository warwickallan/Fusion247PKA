// =====================================================================
// BUILD-015 AsdAIr - B15-3: rulebook.test.js
//
// Runs under: node --test
//
// THE PROPERTY UNDER TEST:
//
//   a household rule expressing a JUDGEMENT - one the deterministic planner
//   drops on the floor - reaches the reasoning consumer as the household's own
//   prose, and its answer changes a planned line, attributably, or becomes a
//   question. Never silence.
//
// -- WHAT CHANGED ON 2026-08-09, AND WHY THESE CASES ARE THE ONES THEY ARE ---
//
// R1 proved that property with three cases, and all three happened to be about
// MONEY: rule 31 (best value by price per wash), rule 36 (buy up to the multibuy
// quantity), rule 37 ("any 2 for GBP X" pair rounding). Warwick then archived
// the best-value judgement outright:
//
//   "AsdAIr should prepare the right shop reliably. It does not need to become
//    a arbitrage desk."
//
// The property is unchanged and the rulebook's job is unchanged - what changed
// is that the job is now the household's genuinely NON-PRICE prose. So the three
// cases are RE-CUT, not deleted: a rotation rule that names a product, a
// standing-quantity rule that changes a count, and a basket-wide size rule that
// reaches a line no targeted rule names. Every mechanism the old three exercised
// - set_product, set_quantity, basket scope, attribution - is still exercised.
//
// Two tests were ADDED rather than re-cut: the ARCHIVED block below is the
// control that fails if price arithmetic re-enters. Its behavioural half plans a
// catalogue that DOES carry prices and proves none of that money reaches the
// packet or the prompt; its source half scans this module for a vocabulary
// pinned in README.md, not here, so widening the code cannot widen its check.
//
// -- AND WHAT WARWICK THEN CORRECTED, LATER THE SAME DAY ---------------------
//
// R3 (above) swept RULE 37 into the archive along with 31 and 36. Warwick
// overruled that, in as many words:
//
//   "DO NOT ARCHIVE RULE 37. I am explicitly retaining the Sure rule. You have
//    conflated two different classes of behaviour: PRICE/VALUE JUDGEMENT -
//    archive this ... DETERMINABLE HOUSEHOLD SHOPPING POLICY - retain this.
//    Rule 37 is in this class. ... Do not discard a deterministic
//    quantity/variant rule merely because its prose mentions a multibuy
//    context."
//
// THE TEST IS WHETHER THE OUTCOME NEEDS PRICE ARITHMETIC, NOT WHETHER THE PROSE
// MENTIONS AN OFFER. Rule 37 states its own outcome arithmetically and
// price-free - "Mum 3 male -> add 1 female = 4". Rounding an odd quantity up to
// the next even number needs no price, no offer state and no browser, which is
// exactly what the rule-37 cases below drive from a catalogue with NO price
// field at all.
//
// So the suite GROWS rather than swapping again: rule 37's regression coverage
// comes back, and every non-price case R3 added in its place stays. The
// ARCHIVED control is untouched and still fires - a correct rule-37
// implementation does not strain it, because rule 37 needs no money.
//
// ONE HALF OF RULE 37 IS NOT DELIVERABLE HERE, AND IT IS SAID RATHER THAN
// QUIETLY DROPPED. The rule's second clause - "add a FEMALE variant to complete
// the last pair" - is an ADD-A-PRODUCT-TO-THE-BASKET outcome. The safety
// envelope has three verbs (set_product, set_quantity, ask) and none of them
// can put a new line in a basket; `set_product` may only re-resolve a line the
// planner already held, and only from candidates that line itself offered - and
// a `map`-resolved Sure line offers none. Adding a fourth verb is a design
// decision this module's own header refuses to take on its own. What IS proven
// below is that the clause is never lost: the planner's advisory echo puts rule
// 37's full words on the line, and the grounding packet carries them verbatim
// to the consumer. See the return for WO-2026-08-09-08.
//
// -- WHAT THE FAKE CONSUMER PROVES, AND WHAT IT CANNOT ----------------------
//
// `terraFake` below is a STAND-IN for Terra. It is not a model and it does not
// reason. It is deliberately built so that it can only answer from what the
// GROUNDING ACTUALLY CARRIED: it iterates the rule ids the grounding attached
// to each line, and computes its answer from the candidates and note text in
// the packet. Give it a grounding with no rules and it says nothing.
//
// That makes it a real test of THIS module's job - selection, assembly,
// attribution, the safety envelope, and the question path.
//
// It is NOT evidence that Terra judges correctly. Nothing offline can be. The
// first real evidence of that is a live shop, and this Work Order does not and
// cannot produce it.
//
// -- PROVENANCE OF THE FIXTURES - read this before trusting a row -----------
//
//   LIVE-VERIFIED (queried 2026-08-04, recorded in ruleConsumption.test.js):
//     rule 23  map     match_term "sure male"  -> a fixed Sure variant
//     rule 32  info    match_term "sure male"
//     rule 38  info    match_term NULL   <- global, no target
//     rule 12  needs_decision  match_term "Nescafe Azera"
//
//   LIVE-VERIFIED (queried 2026-08-09, staged at
//   Deliverables/2026-08-09-live-rule-corpus-and-value-rule-identification.md):
//     rule 37  info    match_term "sure male"  <- rule_text below is the LIVE
//       wording, transliterated to ASCII ("GBP X" for the currency symbol) to
//       hold this file's pure-ASCII rule. Nothing else about it is paraphrased,
//       and the transliteration cannot matter to the outcome: the outcome is
//       arithmetic on a quantity, which is the whole reason the rule was kept.
//
//   CONSTRUCTED (realistic shape, values NOT from the live database): rules 41,
//     42 and 43, every product row and its price, and the pack sizes. THE LIVE
//     `products` AND `regulars` TABLES CARRY NO PRICE COLUMN AT ALL - the priced
//     rows below exist ONLY so the archival control has real money to prove is
//     being dropped.
//
// PURE ASCII throughout - "GBP", never a currency symbol.
// =====================================================================
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const { planBasket } = require('./planner.js');
const rulebook = require('./rulebook.js');

const HOUSEHOLD = 1;

// ---------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------

const RULES = Object.freeze([
  // DETERMINISTIC and untouched by this module.
  {
    id: 23, directive: 'map', scope: 'product', active: true, household_id: HOUSEHOLD,
    match_term: 'sure male', match_category: null,
    matched_product: 'Sure Men Anti-Perspirant (blue variant)',
    rule_text: 'Sure male means the blue Sure Men anti-perspirant.'
  },
  {
    id: 12, directive: 'needs_decision', scope: 'product', active: true, household_id: HOUSEHOLD,
    match_term: 'Nescafe Azera', match_category: null, matched_product: null,
    rule_text: 'Only buy Nescafe Azera when it is on offer - ask me.'
  },
  {
    id: 40, directive: 'exclude', scope: 'product', active: true, household_id: HOUSEHOLD,
    match_term: 'banana yazoo', match_category: null, matched_product: null,
    rule_text: 'Never buy banana Yazoo.'
  },

  // THE DEAD 59% - every one of these is dropped by actionableRules(), and NONE
  // of them is about money. That is the point after 2026-08-09.
  {
    id: 32, directive: 'info', scope: 'product', active: true, household_id: HOUSEHOLD,
    match_term: 'sure male', match_category: null, matched_product: null,
    rule_text: 'Sure male: rotate the scent each week.'
  },
  // RULE 37 - RETAINED BY WARWICK, 2026-08-09, and this is the LIVE row.
  //
  // Its prose opens on a multibuy context and its OUTCOME is pure arithmetic on
  // a quantity: 3 is odd, so the next even number is 4. No price, no offer
  // state, no browser. It is here to prove that distinction holds under
  // execution and not merely in a comment.
  {
    id: 37, directive: 'info', scope: 'product', active: true, household_id: HOUSEHOLD,
    match_term: 'sure male', match_category: null, matched_product: null,
    rule_text: 'Sure "any 2 for GBP X": round qty UP to an even number to capture every pair; '
      + 'add a FEMALE variant to complete the last pair (Mum 3 male -> add 1 female = 4). '
      + 'Combines with the rotate-variant rule (Warwick 2026-07-21).'
  },
  {
    id: 38, directive: 'info', scope: 'household', active: true, household_id: HOUSEHOLD,
    match_term: null, match_category: null, matched_product: null,
    rule_text: 'An add-to-trolley failure is usually out of stock, not a bad match.'
  },
  {
    id: 41, directive: 'info', scope: 'product', active: true, household_id: HOUSEHOLD,
    match_term: 'shower gel', match_category: null, matched_product: null,
    rule_text: 'Shower gel: rotate the scent - never the same one two weeks running.'
  },
  {
    id: 42, directive: 'info', scope: 'product', active: true, household_id: HOUSEHOLD,
    match_term: 'milk', match_category: null, matched_product: null,
    rule_text: 'Milk: we get through 2 bottles a week - if the list says fewer, make it 2.'
  },
  {
    id: 43, directive: 'info', scope: 'household', active: true, household_id: HOUSEHOLD,
    match_term: null, match_category: null, matched_product: null,
    rule_text: 'Where a line does not say a size, we always want the FAMILY size.'
  }
]);

// CONSTRUCTED, AND PRICED ON PURPOSE. Three Ariel packs in one category, with
// real money on every row. No rule in this corpus asks for a bargain, and the
// ARCHIVED control below proves none of these figures reaches the consumer.
const PRICED_PODS = Object.freeze([
  { id: 101, list_term: 'ariel 12', matched_product: 'Ariel All-in-1 Pods Original 12 Washes', category: 'laundry', household_id: null, price: 4.50 },
  { id: 102, list_term: 'ariel 35', matched_product: 'Ariel All-in-1 Pods Original 35 Washes', category: 'laundry', household_id: null, price: 9.00 },
  { id: 103, list_term: 'ariel 76', matched_product: 'Ariel All-in-1 Pods Original 76 Washes', category: 'laundry', household_id: null, price: 16.00 }
]);

// The SAME rows with the price column the live schema does not have.
const UNPRICED_PODS = Object.freeze(PRICED_PODS.map(function (p) {
  const copy = Object.assign({}, p);
  delete copy.price;
  return Object.freeze(copy);
}));

// NO `price` KEY, AND THAT IS THE POINT - the live `products` table has no price
// column at all, and rule 37's outcome must be reachable from exactly this. The
// rule-37 cases below assert the absence structurally before they assert the
// behaviour, so a catalogue that quietly grew a price could never make them
// pass on money.
const SURE_PRODUCT = Object.freeze({
  id: 201, list_term: 'sure male', matched_product: 'Sure Men Anti-Perspirant (blue variant)',
  category: 'toiletries', household_id: null
});

const UNPRICED_SURE = Object.freeze([SURE_PRODUCT]);

// Two scents under one list term - so the planner holds the line as ambiguous
// and rule 41 has something to rotate BETWEEN.
const SHOWER_GELS = Object.freeze([
  { id: 301, list_term: 'shower gel', matched_product: 'ASDA Shower Gel Active 500ml', category: 'toiletries', household_id: null },
  { id: 302, list_term: 'shower gel', matched_product: 'ASDA Shower Gel Sea Minerals 500ml', category: 'toiletries', household_id: null }
]);

const MILK = Object.freeze({
  id: 401, list_term: 'milk', matched_product: 'ASDA British Semi Skimmed Milk 2 Pints',
  category: 'dairy', household_id: null
});

// One of these says FAMILY in its name, which is what the basket-wide rule 43
// is looking for. Nothing here is a price comparison: it is a size preference.
const KITCHEN_ROLL = Object.freeze([
  { id: 501, list_term: 'kitchen roll', matched_product: 'ASDA Kitchen Roll 2 Rolls', category: 'household', household_id: null },
  { id: 502, list_term: 'kitchen roll', matched_product: 'ASDA Kitchen Roll Family Pack 6 Rolls', category: 'household', household_id: null }
]);

const LAST_WEEK = 'last week: ASDA Shower Gel Active 500ml';

function plan(listItems, products) {
  return planBasket({
    listItems: listItems,
    rules: RULES,
    products: products || [],
    regulars: [],
    budget: { household_id: HOUSEHOLD, currency: 'GBP', min_normal: 50, max_normal: 120 },
    household: HOUSEHOLD
  });
}

// ---------------------------------------------------------------------
// The stand-in reasoning consumer.
//
// EVERY handler below answers ONLY from the grounding it was given. None of
// them can see the fixtures, the expected result, or which line is which. A
// grounding that carries no rule for a line produces no judgement for it.
//
// NOTE WHAT NONE OF THEM CAN DO ANY MORE: there is no price in the packet, so
// no handler can compute one. That is structural, not a matter of discipline.
// ---------------------------------------------------------------------
const HANDLERS = {
  // Rule 41 - ROTATION. What was bought last time arrives in the line's own
  // note; the answer is a candidate that is not that. No arithmetic at all.
  '41': function (line) {
    if (!line.may_set_product) return { kind: 'ask', why: 'this line is not one I may name a product for' };
    const seen = String(line.note || '').match(/last week:\s*([^;]+)/i);
    if (!seen) return { kind: 'ask', why: 'I was not told what was bought last week, so I cannot rotate it' };
    const previous = seen[1].trim().toLowerCase();
    const fresh = line.candidates.filter(function (c) {
      return String(c.name).trim().toLowerCase() !== previous;
    });
    if (fresh.length === 0) return { kind: 'ask', why: 'every choice offered is the one bought last week' };
    return { kind: 'set_product', product: fresh[0].name, why: 'not the one bought last week' };
  },

  // Rule 42 - a STANDING QUANTITY. The number is the household's own, read out
  // of its own words in the packet.
  '42': function (line, rule) {
    if (!line.may_set_quantity) return null;
    const m = String(rule.text).match(/make it (\d+)/i);
    if (!m) return null;
    const want = Number(m[1]);
    if (!Number.isInteger(want) || want === Number(line.planned_qty)) return null;
    return { kind: 'set_quantity', quantity: want, why: 'the household gets through ' + want + ' a week' };
  },

  // Rule 37 - EVEN-NUMBER ROUNDING. The household's own words say what "round
  // up" means here, and the answer is arithmetic on the line's own planned
  // count. THERE IS NOTHING FOR A PRICE TO DO IN THIS FUNCTION, and there is no
  // price in the packet for it to read even if there were: `line` carries
  // item_name, statuses, counts, note, and candidate NAMES.
  '37': function (line, rule) {
    if (!line.may_set_quantity) return null;
    if (!/round\s+qty\s+UP\s+to\s+an\s+even\s+number/i.test(rule.text)) return null;
    const q = Number(line.planned_qty);
    if (!Number.isInteger(q) || q < 1) return null;
    if (q % 2 === 0) return null;   // already an even number - every pair is captured
    return {
      kind: 'set_quantity',
      quantity: q + 1,
      // The second clause of the rule cannot be APPLIED by this module (there is
      // no verb that adds a basket line), so it is SAID. Silence is the one
      // option this module never takes.
      why: 'rounded ' + q + ' up to ' + (q + 1)
        + ' so every pair is captured; the household rule says the completing unit is a FEMALE variant'
    };
  },

  // Rule 43 - a BASKET-WIDE size preference. It belongs to whatever line turns
  // out to offer the size it names, which is exactly why it has no target.
  '43': function (line, rule) {
    if (!line.may_set_product) return null;
    const m = String(rule.text).match(/we always want the ([A-Za-z ]+?) size/i);
    if (!m) return null;
    const wanted = m[1].trim().toLowerCase();
    const hit = line.candidates.find(function (c) {
      return String(c.name).toLowerCase().indexOf(wanted) !== -1;
    });
    if (!hit) return null;
    return { kind: 'set_product', product: hit.name, why: 'it is the ' + wanted + ' size' };
  }
};

function terraFake(options) {
  const opts = options || {};
  const calls = [];
  const fn = async function (grounding) {
    calls.push(grounding);
    if (opts.throws) throw new Error(opts.throws);
    if (opts.judgements) return { judgements: opts.judgements(grounding) };
    if (opts.rawText !== undefined) return opts.rawText;
    const judgements = [];
    grounding.lines.forEach(function (line) {
      line.rule_ids.forEach(function (id) {
        const handler = HANDLERS[String(id)];
        if (!handler) return;
        const rule = grounding.rules.find(function (r) { return String(r.id) === String(id); });
        if (!rule) return;
        const j = handler(line, rule, grounding);
        if (!j) return;
        judgements.push(Object.assign({ line_no: line.line_no, rule_id: id }, j));
      });
    });
    return opts.raw ? JSON.stringify({ judgements: judgements }) : { judgements: judgements };
  };
  fn.calls = calls;
  return fn;
}

function itemNamed(result, name) {
  return result.items.find(function (it) { return it.item_name === name; });
}

// =====================================================================
// AC1 - the inert rules reach the reasoning consumer as prose
// =====================================================================

test('AC1: the rules actionableRules() drops are enumerated, and it is the judgement layer', () => {
  const inert = rulebook.inertRules(RULES, HOUSEHOLD).map(function (r) { return r.id; }).sort(function (a, b) { return a - b; });
  assert.deepEqual(inert, [32, 37, 38, 41, 42, 43],
    'the inert set is not the six judgement/advisory rules - check it against actionableRules()');

  // and the deterministic ones are NOT swept up with them
  [12, 23, 40].forEach(function (id) {
    assert.ok(inert.indexOf(id) === -1, 'rule ' + id + ' is deterministic and must stay out of the rulebook path');
  });
});

test('AC1: the assembled prose carries the household words, verbatim, with rule ids', () => {
  const result = plan([{ item_name: 'shower gel', requested_qty: 1, note: LAST_WEEK }], SHOWER_GELS);
  const grounding = rulebook.buildRulebookGrounding(result, RULES, HOUSEHOLD);
  assert.ok(grounding, 'no grounding was built for a basket the rulebook speaks about');
  const prompt = rulebook.buildRulebookPrompt(grounding);

  assert.match(prompt, /\[rule 41\]/, 'rule 41 is not identified in the prose');
  assert.ok(prompt.indexOf('Shower gel: rotate the scent - never the same one two weeks running.') !== -1,
    "rule 41's own words are not in the prose - a paraphrase is not the household's rule");
  assert.ok(prompt.indexOf('Where a line does not say a size, we always want the FAMILY size.') !== -1,
    "rule 43's own words are not in the prose");
  assert.match(prompt, /shower gel/, 'the line the rule speaks about is not in the prose');
  assert.match(prompt, /ASDA Shower Gel Sea Minerals 500ml/, 'the candidates were not offered to the consumer');
  assert.match(prompt, /set_product \| ask|set_product/, 'the prose does not tell the consumer what it may do');
});

test('AC1: nothing is consulted, and nothing changes, when no inert rule speaks about the basket', async () => {
  // A corpus with NO judgement layer at all - the world before the prose rules
  // were written. No prose to carry, so no call and no cost.
  const deterministicOnly = RULES.filter(function (r) { return [12, 23, 40].indexOf(r.id) !== -1; });
  const result = plan([{ item_name: 'bread', requested_qty: 1 }], []);
  const consult = terraFake();
  const out = await rulebook.applyRulebook({ plan: result, rules: deterministicOnly, household: HOUSEHOLD, consult: consult });
  assert.equal(consult.calls.length, 0, 'a model call was made for a basket with no relevant rule');
  assert.equal(out.grounding, null);
  assert.equal(out.audit.consulted, false, 'a no-op must not report itself as a consultation that approved the plan');
  assert.deepEqual(out.plan.items[0].status, result.items[0].status);
});

test('AC1: a basket-wide rule DOES reach an ordinary unidentified line', async () => {
  // The other direction of the same boundary, and the reason a rule with no
  // target exists: a size rule belongs to whatever line turns out to offer a
  // size, so a line no targeted rule names is still shown while something may
  // be done to it. Costed deliberately - see the selection comment in
  // rulebook.js.
  const result = plan([{ item_name: 'bread', requested_qty: 1 }], []);
  const grounding = rulebook.buildRulebookGrounding(result, RULES, HOUSEHOLD);
  assert.ok(grounding, 'a basket-wide judgement rule reached no line at all');
  assert.deepEqual(grounding.rules.map(function (r) { return r.id; }).sort(), [38, 43]);
  assert.deepEqual(grounding.lines[0].rule_ids, [38, 43]);
});

// =====================================================================
// AC2 - relevance, and the direction it fails in
// =====================================================================

test('AC2: a rule about another item is not sent, and the omission is COUNTED not hidden', async () => {
  const result = plan([{ item_name: 'milk', requested_qty: 1 }], [MILK]);
  const grounding = rulebook.buildRulebookGrounding(result, RULES, HOUSEHOLD);
  const sent = grounding.rules.map(function (r) { return r.id; }).sort(function (a, b) { return a - b; });

  assert.deepEqual(sent, [38, 42, 43], 'the wrong rule set was sent for a milk-only basket');
  assert.ok(sent.indexOf(41) === -1, 'a shower-gel rule was sent for a basket with no shower gel');
  assert.ok(sent.indexOf(37) === -1, 'a Sure rule was sent for a basket with no Sure line');
  assert.equal(grounding.omitted_rule_count, 3,
    'the rules that spoke about nothing here (32, 37, 41) are not counted - an omission must be visible');
});

test('AC2: relevance is OVER-INCLUSIVE - an advisory-grade similarity still carries the rule', () => {
  // "shower gel bottle" is not the rule 41 term. The planner would need a
  // CONFIDENT grade before letting a rule buy anything; selection deliberately
  // accepts a weaker match, because the cost of a false positive is a sentence
  // the consumer ignores and the cost of a false negative is the rule dying.
  const result = plan([{ item_name: 'shower gel bottle', requested_qty: 1 }], SHOWER_GELS);
  const grounding = rulebook.buildRulebookGrounding(result, RULES, HOUSEHOLD);
  assert.ok(grounding.rules.some(function (r) { return r.id === 41; }),
    'rule 41 was not selected for a line that names its subject in different words');
});

test('AC2: a basket-scope rule reaches only the lines something may be done to', () => {
  const result = plan([
    { item_name: 'banana yazoo', requested_qty: 1 },              // excluded by rule 40
    { item_name: 'milk', requested_qty: 1 }                       // an ordinary add line
  ], [MILK]);
  const grounding = rulebook.buildRulebookGrounding(result, RULES, HOUSEHOLD);
  const shown = grounding.lines.map(function (l) { return l.item_name; });
  assert.deepEqual(shown, ['milk'],
    'an excluded line was sent to the consumer under a basket-wide rule');
});

// =====================================================================
// AC3 - a NON-PRICE judgement rule changes a line the deterministic path
//       gets wrong. RE-CUT from R1's three money cases, mechanism for
//       mechanism: set_product, set_quantity, basket scope.
// =====================================================================

test('AC3 rule 41: the deterministic path asks which shower gel; a ROTATION rule names one', async () => {
  const listItems = [{ item_name: 'shower gel', requested_qty: 1, note: LAST_WEEK }];
  const before = plan(listItems, SHOWER_GELS);

  // THE DETERMINISTIC ANSWER, AND IT IS THE ONE WARWICK COMPLAINED ABOUT.
  assert.equal(before.items[0].status, 'needs_decision');
  assert.equal(before.summary.needs_decision, 1);

  const out = await rulebook.applyRulebook({ plan: before, rules: RULES, household: HOUSEHOLD, consult: terraFake() });
  const line = out.plan.items[0];

  assert.equal(line.status, 'add', 'the line is still a question after the rulebook ran');
  assert.equal(line.matched_product, 'ASDA Shower Gel Sea Minerals 500ml',
    'the rotation did not move off the scent bought last week');
  assert.equal(line.planned_qty, 1);
  assert.equal(out.plan.summary.needs_decision, 0);
  assert.equal(out.plan.summary.planned_add, 1);
  assert.ok(line.flags.indexOf('chosen by household rule') !== -1);
  assert.ok(/rule 41/.test(line.note), 'the change does not say which rule caused it');
});

test('AC3 rule 42: a standing-quantity rule that has never fired changes the quantity', async () => {
  const listItems = [{ item_name: 'milk', requested_qty: 1 }];
  const before = plan(listItems, [MILK]);

  assert.equal(before.items[0].status, 'add');
  assert.equal(before.items[0].planned_qty, 1, 'the deterministic plan should buy exactly what was asked for');

  const out = await rulebook.applyRulebook({ plan: before, rules: RULES, household: HOUSEHOLD, consult: terraFake() });
  const line = out.plan.items[0];

  assert.equal(line.planned_qty, 2, 'rule 42 did not raise the quantity to the household standing count');
  assert.equal(line.matched_product, 'ASDA British Semi Skimmed Milk 2 Pints',
    'the deterministic match must still decide WHICH product');
  assert.ok(line.flags.indexOf('quantity set by household rule') !== -1);
});

test('AC3 rule 43: a BASKET-WIDE rule changes a line no targeted rule names', async () => {
  const listItems = [{ item_name: 'kitchen roll', requested_qty: 1 }];
  const before = plan(listItems, KITCHEN_ROLL);

  assert.equal(before.items[0].status, 'needs_decision', 'the deterministic plan should not pick a pack size');

  const out = await rulebook.applyRulebook({ plan: before, rules: RULES, household: HOUSEHOLD, consult: terraFake() });
  const line = out.plan.items[0];

  assert.equal(line.matched_product, 'ASDA Kitchen Roll Family Pack 6 Rolls',
    'the basket-wide size rule did not reach a line no targeted rule speaks about');
  assert.equal(line.status, 'add');
  assert.ok(/rule 43/.test(line.note), 'the change does not say which rule caused it');
});

// =====================================================================
// AC3 rule 37 - RESTORED (Warwick, 2026-08-09). A DETERMINABLE HOUSEHOLD
//               POLICY, not a bargain judgement. Its regression coverage comes
//               back; nothing R3 put in its place is removed to make room.
// =====================================================================

test('AC3 rule 37: an ODD Sure quantity is rounded UP to the next even number, from a catalogue with NO price', async () => {
  // ESTABLISH THE GROUND FIRST. A control that did not examine what it claims to
  // is worse than no control, so the absence of money is asserted before any
  // behaviour is, and it is asserted about the actual fixture this test plans.
  UNPRICED_SURE.forEach(function (row) {
    assert.ok(!Object.prototype.hasOwnProperty.call(row, 'price'),
      'the Sure catalogue grew a price field - this case would no longer prove rule 37 is price-free');
  });

  const listItems = [{ item_name: 'sure male', requested_qty: 3 }];
  const before = plan(listItems, UNPRICED_SURE);

  // THE DETERMINISTIC ANSWER, AND IT IS THE ONE THE HOUSEHOLD RULE EXISTS TO FIX.
  assert.equal(before.items[0].status, 'add');
  assert.equal(before.items[0].planned_qty, 3, 'the deterministic plan should buy exactly what was asked for');
  assert.equal(before.summary.estimated_total, null,
    'the unpriced fixture produced a basket estimate - there is money in this path after all');

  const grounding = rulebook.buildRulebookGrounding(before, RULES, HOUSEHOLD);
  assert.ok(grounding.rules.some(function (r) { return r.id === 37; }),
    'rule 37 did not reach the consumer at all');
  // The consumer is handed no money to work from. Same recursive walk the
  // ARCHIVED control uses, applied to the packet this case actually sends.
  (function walk(node, at) {
    if (node === null || typeof node !== 'object') return;
    if (Array.isArray(node)) { node.forEach(function (v, i) { walk(v, at + '[' + i + ']'); }); return; }
    Object.keys(node).forEach(function (k) {
      assert.ok(!/price|cost|amount|gbp/i.test(k),
        'the rule-37 packet carries a money field "' + k + '" at ' + at);
      walk(node[k], at + '.' + k);
    });
  })(grounding, 'grounding');

  const out = await rulebook.applyRulebook({ plan: before, rules: RULES, household: HOUSEHOLD, consult: terraFake() });
  const line = out.plan.items[0];

  assert.equal(line.planned_qty, 4, 'rule 37 did not round the odd quantity up to the next even number');
  assert.equal(line.matched_product, 'Sure Men Anti-Perspirant (blue variant)',
    'the deterministic map rule 23 must still decide WHICH product');
  assert.ok(line.flags.indexOf('quantity set by household rule') !== -1);
  assert.ok(line.flags.indexOf('rulebook rule 37') !== -1, 'the change does not carry rule 37 as its cause');
  assert.ok(/rule 37/.test(line.note), 'the change does not say which rule caused it');

  const applied = out.audit.applied.filter(function (a) { return String(a.rule_id) === '37'; });
  assert.deepEqual(applied.map(function (a) { return [a.from, a.to]; }), [[3, 4]],
    'the audit does not record 3 -> 4 attributed to rule 37');
});

test('AC3 rule 37: the boundary is SWEPT, not spot-checked - odds move, evens are left alone', async () => {
  // The rule is about parity, so parity is where it can be wrong. Both sides of
  // the boundary are exercised rather than the single example the rule's prose
  // happens to quote.
  const cases = [[1, 2], [2, 2], [3, 4], [4, 4], [5, 6]];
  for (const [asked, expected] of cases) {
    const before = plan([{ item_name: 'sure male', requested_qty: asked }], UNPRICED_SURE);
    assert.equal(before.items[0].planned_qty, asked, 'fixture drifted at requested_qty ' + asked);
    const out = await rulebook.applyRulebook({ plan: before, rules: RULES, household: HOUSEHOLD, consult: terraFake() });
    assert.equal(out.plan.items[0].planned_qty, expected,
      'rule 37 turned ' + asked + ' into ' + out.plan.items[0].planned_qty + ', not ' + expected);
    if (asked === expected) {
      assert.equal(out.audit.applied.filter(function (a) { return String(a.rule_id) === '37'; }).length, 0,
        'an already-even quantity was "changed" to itself at requested_qty ' + asked);
    }
  }
});

test('AC3 rule 37: the FEMALE-variant clause is NEVER LOST - it reaches the consumer and the line, verbatim', async () => {
  // THE HONEST HALF OF THIS RULE. `add a FEMALE variant to complete the last
  // pair` is an add-a-line outcome and no verb in the safety envelope can
  // perform it (see this file's header). What must never happen is the clause
  // falling silently on the floor - that is the exact defect this whole module
  // exists to end. So it is proven to survive in the two places a person and a
  // model can each see it.
  const FEMALE_CLAUSE = 'add a FEMALE variant to complete the last pair (Mum 3 male -> add 1 female = 4)';
  const rule37 = RULES.find(function (r) { return r.id === 37; });
  assert.ok(rule37.rule_text.indexOf(FEMALE_CLAUSE) !== -1,
    'the fixture no longer carries the clause this test is about - re-point it');

  const before = plan([{ item_name: 'sure male', requested_qty: 3 }], UNPRICED_SURE);

  // (a) THE PERSON. The deterministic planner's advisory echo already attaches
  //     the household's own words to the line, before the rulebook runs at all.
  assert.ok(String(before.items[0].note || '').indexOf(FEMALE_CLAUSE) !== -1,
    "the planner's advisory echo dropped rule 37's female-variant clause from the line");

  // (b) THE CONSUMER. The grounding packet and the rendered prompt carry the
  //     rule's text verbatim, so a model reading it is told about the variant
  //     even though this module cannot act on it.
  const grounding = rulebook.buildRulebookGrounding(before, RULES, HOUSEHOLD);
  const sent37 = grounding.rules.find(function (r) { return String(r.id) === '37'; });
  assert.equal(sent37.text, rule37.rule_text,
    "rule 37 reached the consumer without the household's own words");
  assert.ok(rulebook.buildRulebookPrompt(grounding).indexOf(FEMALE_CLAUSE) !== -1,
    'the rendered prompt dropped the female-variant clause');

  // (c) AND AFTER THE JUDGEMENT. The applied change says, on the line, that the
  //     completing unit is a female variant - so the handoff a person reads is
  //     not silently "4 male".
  const out = await rulebook.applyRulebook({ plan: before, rules: RULES, household: HOUSEHOLD, consult: terraFake() });
  assert.match(String(out.plan.items[0].note), /FEMALE variant/,
    'the rounded line says nothing about the variant the household asked for');
});

test('AC3: the same reply arriving as raw model TEXT behaves identically', async () => {
  const before = plan([{ item_name: 'shower gel', requested_qty: 1, note: LAST_WEEK }], SHOWER_GELS);
  const out = await rulebook.applyRulebook({
    plan: before, rules: RULES, household: HOUSEHOLD, consult: terraFake({ raw: true })
  });
  assert.equal(out.plan.items[0].matched_product, 'ASDA Shower Gel Sea Minerals 500ml');
});

// =====================================================================
// ARCHIVED - the best-value judgement is gone, and this is the control that
//            fails if it comes back (Warwick, 2026-08-09).
//
// Two halves, and the FIRST one is the load-bearing one. A source scan says
// what the module does not SAY; the behavioural test says what the module does
// not DO, which is the property Warwick actually bought.
// =====================================================================

test('ARCHIVED: a PRICED catalogue still produces a packet and a prompt with no money in it', () => {
  const result = plan([{ item_name: 'ariel pods', requested_qty: 1, category: 'laundry' }], PRICED_PODS);

  // The fixture really is priced - if this ever stops being true the rest of
  // this test proves nothing, which is exactly the "control over ground it did
  // not examine" failure.
  assert.ok(result.items[0].alternatives.length >= 3, 'the priced fixture stopped producing candidates');
  assert.ok(result.items[0].alternatives.some(function (a) { return Number(a.price) > 0; }),
    'the planner is no longer carrying prices, so this control is testing nothing');

  const grounding = rulebook.buildRulebookGrounding(result, RULES, HOUSEHOLD);
  assert.ok(grounding, 'no grounding was built for the priced basket');
  assert.ok(grounding.lines[0].candidates.length >= 3, 'the candidates did not reach the packet at all');

  // 1. NO KEY anywhere in the packet is a price by any name.
  (function walk(node, at) {
    if (node === null || typeof node !== 'object') return;
    if (Array.isArray(node)) { node.forEach(function (v, i) { walk(v, at + '[' + i + ']'); }); return; }
    Object.keys(node).forEach(function (k) {
      assert.ok(!/price|cost|amount|gbp/i.test(k),
        'the grounding packet carries a money field "' + k + '" at ' + at + ' - the best-value judgement is archived');
      walk(node[k], at + '.' + k);
    });
  })(grounding, 'grounding');

  // 2. NO VALUE from the priced fixture appears anywhere in the packet.
  const packet = JSON.stringify(grounding);
  [4.5, 9, 16].forEach(function (v) {
    assert.ok(packet.indexOf(String(v)) === -1,
      'the fixture price ' + v + ' reached the grounding packet');
  });

  // 3. The RENDERED prompt carries no money in any form - not a figure, not a
  //    currency, not "unknown". Saying a price is unknown still invites shopping
  //    on it, which is why "(price unknown)" was removed rather than kept.
  const prompt = rulebook.buildRulebookPrompt(grounding);
  assert.doesNotMatch(prompt, /GBP/, 'the prompt renders a currency');
  assert.doesNotMatch(prompt, /£/, 'the prompt renders a currency symbol');
  assert.doesNotMatch(prompt, /\d+\.\d{2}/, 'the prompt renders a money-shaped figure');
  assert.doesNotMatch(prompt, /price/i, 'the prompt still talks about price');
  assert.doesNotMatch(prompt, /best value|per wash|multibuy|cheapest/i,
    'the prompt still invites a bargain judgement');
});

test('ARCHIVED: rulebook.js contains none of the price vocabulary README.md pins', () => {
  // CODE ONLY, and the same discipline as the AC6 test below: comments are
  // stripped first, because this module's own archival comment quotes the very
  // words it must never execute, and a check that trips over the warning against
  // the thing is a check nobody keeps.
  //
  // SPLIT ON /\r?\n/, NEVER '\n'. The estate's checked-out files are CRLF.
  const raw = fs.readFileSync(path.join(__dirname, 'rulebook.js'), 'utf8');
  const src = raw
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .split(/\r?\n/).map(function (l) { return l.replace(/(^|[^:])\/\/.*$/, '$1'); }).join('\n');

  // PROVE THE STRIPPER ACTUALLY STRIPPED. Without this, the CRLF defect above
  // turns the scan below into a false POSITIVE and everyone learns to delete the
  // test rather than fix it. This phrase exists only inside a comment.
  assert.ok(raw.indexOf('arbitrage desk') !== -1,
    'the archival comment moved - re-point this guard before trusting the scan');
  assert.ok(src.indexOf('arbitrage desk') === -1,
    'comments were NOT stripped (CRLF?) - every result below would be a false positive');

  // The forbidden vocabulary is read from README.md, NOT from a literal in this
  // test and NOT from the module under test - so widening the code cannot widen
  // its own check. The literal below pins README.md in turn, so quietly deleting
  // a token there fails here.
  const readme = fs.readFileSync(path.join(__dirname, 'README.md'), 'utf8');
  const block = readme.match(/ARCHIVED-PRICE-VOCABULARY:[\s\S]*?\/ARCHIVED-PRICE-VOCABULARY/);
  assert.ok(block, 'the ARCHIVED-PRICE-VOCABULARY block is gone from README.md - re-point this test');
  const forbidden = [];
  block[0].split(/\r?\n/).forEach(function (l) {
    const m = l.match(/^-\s+`([^`]+)`\s*$/);
    if (m) forbidden.push(m[1]);
  });
  assert.deepEqual(forbidden.slice().sort(),
    ['best value', 'cheapest', 'multibuy', 'per wash', 'price'],
    'README.md no longer pins the vocabulary this control was written against');

  const lower = src.toLowerCase();
  forbidden.forEach(function (token) {
    assert.equal(lower.indexOf(token.toLowerCase()), -1,
      'rulebook.js code mentions "' + token + '" - the best-value judgement is ARCHIVED and must not be re-grown, '
      + 'not even behind a flag');
  });
});

// =====================================================================
// AC4 - attribution
// =====================================================================

test('AC4: every applied change names its rule id, on the line and in the audit', async () => {
  const before = plan([
    { item_name: 'shower gel', requested_qty: 1, note: LAST_WEEK },
    { item_name: 'milk', requested_qty: 1 }
  ], SHOWER_GELS.concat([MILK]));

  const out = await rulebook.applyRulebook({ plan: before, rules: RULES, household: HOUSEHOLD, consult: terraFake() });

  assert.ok(out.audit.applied.length >= 2, 'expected both judgement rules to change something');
  out.audit.applied.forEach(function (entry) {
    assert.ok(entry.rule_id !== null && entry.rule_id !== undefined, 'an applied change carries no rule id');
    assert.ok(out.audit.rules_sent.indexOf(entry.rule_id) !== -1,
      'change attributed to rule ' + entry.rule_id + ' which was never sent');
    const item = out.plan.items[entry.line_no - 1];
    assert.ok(item.flags.indexOf('rulebook rule ' + entry.rule_id) !== -1,
      'the changed line does not carry the rule flag - "why did it do that" has no answer');
    assert.ok(item.note.indexOf('rule ' + entry.rule_id) !== -1,
      'the changed line does not name the rule in words a person reads');
    assert.ok(entry.from !== undefined && entry.to !== undefined, 'the audit does not record what changed');
  });
});

test('AC4: a judgement attributed to a rule that was never sent is REFUSED and made visible', async () => {
  const before = plan([{ item_name: 'shower gel', requested_qty: 1, note: LAST_WEEK }], SHOWER_GELS);
  const out = await rulebook.applyRulebook({
    plan: before, rules: RULES, household: HOUSEHOLD,
    consult: terraFake({
      judgements: function () {
        return [{ line_no: 1, rule_id: 999, kind: 'set_product', product: 'ASDA Shower Gel Sea Minerals 500ml', why: 'invented' }];
      }
    })
  });
  assert.equal(out.plan.items[0].status, 'needs_decision', 'an unattributable change was applied');
  assert.ok(out.plan.items[0].flags.indexOf('rulebook answer rejected') !== -1);
  assert.equal(out.audit.rejected.length, 1);
  assert.match(out.audit.rejected[0].reason, /not among the rules sent/);
});

// =====================================================================
// AC5 - uncertainty is SPOKEN
// =====================================================================

test('AC5: with nothing to rotate FROM, rule 41 asks - it does not fall back on the deterministic answer', async () => {
  // The line carries no record of what was bought last week, so the rule cannot
  // be applied. That must become a question, not a silent pick.
  const before = plan([{ item_name: 'shower gel', requested_qty: 1 }], SHOWER_GELS);
  const out = await rulebook.applyRulebook({ plan: before, rules: RULES, household: HOUSEHOLD, consult: terraFake() });
  const line = out.plan.items[0];

  assert.equal(line.status, 'needs_decision', 'an unanswerable rule silently resolved the line');
  assert.ok(line.flags.indexOf('rulebook question') !== -1, 'the question is not marked as coming from the rulebook');
  assert.ok(line.note.indexOf('rule 41') !== -1, 'the question does not say which rule could not be applied');
  assert.ok(line.note.indexOf('Shower gel: rotate the scent - never the same one two weeks running.') !== -1,
    "the question does not carry the household's own words - which is the whole defect");
  assert.ok(/bought last week/i.test(line.note), "the consumer's reason for asking was dropped");
});

test('AC5: the packet is IDENTICAL whether or not the catalogue carries prices', () => {
  // R1 proved an absent price was said rather than rendered as "GBP 0.00". That
  // assertion has no subject any more: no price is rendered either way. The
  // property that replaces it is stronger - the presence of money in the
  // catalogue makes NO difference to what the consumer is shown.
  const priced = rulebook.buildRulebookGrounding(
    plan([{ item_name: 'ariel pods', requested_qty: 1, category: 'laundry' }], PRICED_PODS), RULES, HOUSEHOLD);
  const unpriced = rulebook.buildRulebookGrounding(
    plan([{ item_name: 'ariel pods', requested_qty: 1, category: 'laundry' }], UNPRICED_PODS), RULES, HOUSEHOLD);

  assert.deepEqual(priced, unpriced, 'a priced catalogue produced a different packet from an unpriced one');
  assert.equal(rulebook.buildRulebookPrompt(priced), rulebook.buildRulebookPrompt(unpriced),
    'a priced catalogue produced a different prompt from an unpriced one');
});

test('AC5: an ADD line the consumer is unsure about becomes a question, never a silent add', async () => {
  const before = plan([{ item_name: 'milk', requested_qty: 1 }], [MILK]);
  assert.equal(before.items[0].status, 'add');

  const out = await rulebook.applyRulebook({
    plan: before, rules: RULES, household: HOUSEHOLD,
    consult: terraFake({
      judgements: function (g) {
        return [{ line_no: g.lines[0].line_no, rule_id: 42, kind: 'ask', why: 'rules 42 and 43 point different ways on this line' }];
      }
    })
  });
  const line = out.plan.items[0];
  assert.equal(line.status, 'needs_decision', 'an unresolved judgement left the line silently in the basket');
  assert.equal(line.planned_qty, 0, 'a held line is still being bought');
  assert.ok(/rules 42 and 43 point different ways/.test(line.note), 'the contradiction was not spoken');
  assert.equal(out.plan.summary.needs_decision, 1);
});

test('AC5: an unknown verb from the consumer is treated as ask, not ignored', async () => {
  const before = plan([{ item_name: 'milk', requested_qty: 1 }], [MILK]);
  const out = await rulebook.applyRulebook({
    plan: before, rules: RULES, household: HOUSEHOLD,
    consult: terraFake({ judgements: function () { return [{ line_no: 1, rule_id: 42, kind: 'buy_two_free_one', why: 'made up' }]; } })
  });
  assert.equal(out.plan.items[0].status, 'needs_decision');
  assert.match(out.audit.rejected[0].reason, /unknown judgement kind/);
});

test('AC5: a product nobody offered becomes a question, never a purchase', async () => {
  const before = plan([{ item_name: 'shower gel', requested_qty: 1, note: LAST_WEEK }], SHOWER_GELS);
  const out = await rulebook.applyRulebook({
    plan: before, rules: RULES, household: HOUSEHOLD,
    consult: terraFake({
      judgements: function () {
        return [{ line_no: 1, rule_id: 41, kind: 'set_product', product: 'ASDA Shower Gel Coconut 1L', why: 'a different scent' }];
      }
    })
  });
  assert.equal(out.plan.items[0].status, 'needs_decision', 'a product that was never offered reached the basket');
  assert.notEqual(out.plan.items[0].matched_product, 'ASDA Shower Gel Coconut 1L');
  assert.ok(/not among the choices offered/.test(out.plan.items[0].note));
});

test('AC5: an unreachable consumer is LOUD on every affected line and in the summary', async () => {
  const before = plan([{ item_name: 'shower gel', requested_qty: 1, note: LAST_WEEK }], SHOWER_GELS);
  const out = await rulebook.applyRulebook({
    plan: before, rules: RULES, household: HOUSEHOLD, consult: terraFake({ throws: 'gateway unreachable' })
  });
  assert.equal(out.plan.items[0].flags.indexOf('rulebook not consulted') !== -1, true,
    'a line whose rules never ran looks exactly like a line with no rules');
  assert.match(out.plan.summary.rulebook.error, /gateway unreachable/);
  assert.equal(out.audit.applied.length, 0);
});

test('AC5: an unreadable reply is not read as approval', async () => {
  const before = plan([{ item_name: 'shower gel', requested_qty: 1, note: LAST_WEEK }], SHOWER_GELS);
  const out = await rulebook.applyRulebook({
    plan: before, rules: RULES, household: HOUSEHOLD, consult: terraFake({ rawText: 'I think you should buy the big one.' })
  });
  assert.ok(out.audit.error, 'an unparseable reply was accepted silently');
  assert.equal(out.plan.items[0].status, 'needs_decision');
});

// =====================================================================
// The safety envelope
// =====================================================================

test('SAFETY: a line held BY A RULE cannot be resolved by the rulebook', async () => {
  const before = plan([{ item_name: 'bottle Azera coffee', requested_qty: 1, category: 'coffee' }], [
    { id: 601, list_term: 'azera', matched_product: 'Nescafe Azera Americano 100g', category: 'coffee', household_id: null, price: 5.00 }
  ]);
  assert.equal(before.items[0].status, 'needs_decision');
  assert.ok(before.items[0].flags.indexOf('flagged by rule') !== -1, 'fixture drifted: rule 12 no longer holds this line');

  const out = await rulebook.applyRulebook({
    plan: before, rules: RULES, household: HOUSEHOLD,
    consult: terraFake({
      judgements: function (g) {
        if (!g.lines.length) return [];
        return [{ line_no: g.lines[0].line_no, rule_id: g.lines[0].rule_ids[0], kind: 'set_product', product: 'Nescafe Azera Americano 100g', why: 'it is the only one' }];
      }
    })
  });
  assert.equal(out.plan.items[0].status, 'needs_decision', 'a rule-held line was resolved by the rulebook');
});

test('SAFETY: an excluded line is never revived, and exclusion stays deterministic', async () => {
  const before = plan([{ item_name: 'banana yazoo', requested_qty: 1 }], []);
  assert.equal(before.items[0].status, 'excluded');

  const out = await rulebook.applyRulebook({
    plan: before, rules: RULES, household: HOUSEHOLD,
    consult: terraFake({ judgements: function () { return [{ line_no: 1, rule_id: 43, kind: 'set_quantity', quantity: 2, why: 'family size' }]; } })
  });
  assert.equal(out.plan.items[0].status, 'excluded');
  assert.equal(out.plan.items[0].planned_qty, 0);
});

test('SAFETY: a quantity outside the bound is refused and asked about', async () => {
  const before = plan([{ item_name: 'milk', requested_qty: 1 }], [MILK]);
  const out = await rulebook.applyRulebook({
    plan: before, rules: RULES, household: HOUSEHOLD,
    consult: terraFake({ judgements: function () { return [{ line_no: 1, rule_id: 42, kind: 'set_quantity', quantity: 76, why: 'the pack says 76' }]; } })
  });
  assert.equal(out.plan.items[0].status, 'needs_decision');
  assert.equal(out.plan.items[0].planned_qty, 0);
  assert.match(out.audit.rejected[0].reason, /outside 1\.\.24/);
  assert.equal(rulebook.MAX_JUDGED_QTY, 24, 'the bound moved - re-read the comment that justifies it');
});

test('SAFETY: a stale basket estimate is dropped rather than reported wrong', async () => {
  const before = plan([{ item_name: 'milk', requested_qty: 1, price: 4.00 }], [MILK]);
  assert.equal(before.summary.estimated_total, 4, 'fixture drifted: the estimate is no longer computed');

  const out = await rulebook.applyRulebook({ plan: before, rules: RULES, household: HOUSEHOLD, consult: terraFake() });
  assert.equal(out.plan.items[0].planned_qty, 2);
  assert.equal(out.plan.summary.estimated_total, null, 'a basket estimate computed for 1 unit was kept after buying 2');
  assert.equal(out.plan.summary.budget_flag, 'unknown');
  assert.equal(out.plan.summary.rulebook.estimate_invalidated, true);
});

test('SAFETY: the input plan is never mutated', async () => {
  const before = plan([{ item_name: 'shower gel', requested_qty: 1, note: LAST_WEEK }], SHOWER_GELS);
  const snapshot = JSON.stringify(before);
  await rulebook.applyRulebook({ plan: before, rules: RULES, household: HOUSEHOLD, consult: terraFake() });
  assert.equal(JSON.stringify(before), snapshot, 'applyRulebook mutated the plan it was given');
});

test('SAFETY: another household\'s rules are never consulted', () => {
  const foreign = RULES.map(function (r) { return Object.assign({}, r, { household_id: 99 }); });
  const result = plan([{ item_name: 'shower gel', requested_qty: 1, note: LAST_WEEK }], SHOWER_GELS);
  assert.equal(rulebook.inertRules(foreign, HOUSEHOLD).length, 0);
  assert.equal(rulebook.buildRulebookGrounding(result, foreign, HOUSEHOLD), null);
});

// =====================================================================
// AC6 - no new deterministic directive type
// =====================================================================

test('AC6: the rulebook introduces no directive value, pinned to the DB CHECK constraint', () => {
  // CODE ONLY. Comments are stripped first: this module's own prohibition
  // comment quotes the directive types it must never add, and a check that
  // trips over the warning against the thing is a check nobody keeps.
  //
  // SPLIT ON /\r?\n/, NEVER '\n'. The estate's checked-out files are CRLF. Splitting
  // on '\n' alone leaves a trailing '\r' on every line; '.' does not match '\r', so
  // `//.*$` never reaches the end of the line and NOTHING is stripped. The prohibition
  // comment then trips the very assertion it was written to survive. This test passed
  // in the lane worktree (LF, freshly written) and failed on the integrated head after
  // git normalised the file to CRLF -- a false positive, proven by there being zero
  // non-comment matches. Larry, 2026-08-09, at reconciliation.
  const src = fs.readFileSync(path.join(__dirname, 'rulebook.js'), 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .split(/\r?\n/).map(function (l) { return l.replace(/(^|[^:])\/\/.*$/, '$1'); }).join('\n');

  // The permitted set is read from the MIGRATION, not from a literal in this
  // test and not from the module under test - so widening the code cannot
  // widen its own check.
  const sql = fs.readFileSync(path.join(__dirname, '..', 'db', '007_rules_rotate_directive.sql'), 'utf8');
  const check = sql.match(/check \(directive in \(([^)]*)\)\)/);
  assert.ok(check, 'could not read the directive CHECK constraint from db/007 - re-point this test');
  const permitted = check[1].split(',').map(function (s) { return s.trim().replace(/^''|''$/g, ''); });
  assert.deepEqual(permitted.slice().sort(), ['exclude', 'info', 'map', 'needs_decision', 'rotate']);

  // Every directive string this module compares against.
  const compared = [];
  const re = /(?:directive|\bd)\s*[!=]==?\s*'([a-z_]+)'/g;
  let m;
  while ((m = re.exec(src)) !== null) { if (compared.indexOf(m[1]) === -1) compared.push(m[1]); }
  compared.forEach(function (d) {
    assert.ok(permitted.indexOf(d) !== -1,
      'rulebook.js knows a directive "' + d + '" that the schema does not permit - a new directive type is exactly what this lane must not grow');
  });

  // and it never writes one
  assert.doesNotMatch(src, /directive\s*[:=]\s*'/,
    'rulebook.js assigns a directive value - rules are Warwick\'s data, not this module\'s output');
});

test('AC6: the judgement vocabulary is three verbs and one of them is "ask"', () => {
  assert.deepEqual(rulebook.JUDGEMENT_KINDS.slice().sort(), ['ask', 'set_product', 'set_quantity']);
});

// =====================================================================
// Regression: the deterministic half is untouched
// =====================================================================

test('REGRESSION: map and exclude still decide, with or without the rulebook', async () => {
  const listItems = [
    { item_name: 'sure male', requested_qty: 2 },
    { item_name: 'banana yazoo', requested_qty: 1 }
  ];
  const before = plan(listItems, [SURE_PRODUCT]);
  const out = await rulebook.applyRulebook({ plan: before, rules: RULES, household: HOUSEHOLD, consult: terraFake() });

  assert.equal(itemNamed(out.plan, 'sure male').matched_product, 'Sure Men Anti-Perspirant (blue variant)');
  assert.equal(itemNamed(out.plan, 'sure male').planned_qty, 2, 'a quantity was changed by a rule that says nothing about this line');
  assert.equal(itemNamed(out.plan, 'banana yazoo').status, 'excluded');
});
