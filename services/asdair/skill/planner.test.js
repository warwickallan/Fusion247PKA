// =====================================================================
// IDEA-012 AsdAIr - WP1 skill: planner.test.js
//
// Runs under: node --test
//
// SYNTHETIC FIXTURES ONLY. Every item, product, rule, and name below is
// invented ("Widget A", "Generic Milk 2L", household id 1/2). There is
// ZERO real household data here - nothing from the seed, no real names,
// no real Asda products. This file runs in CI on the PUBLIC repo.
//
// Exercises every branch of planner.js:
//   * no-qty -> 1
//   * dedupe / sum
//   * product match (household-scoped preferred over global)
//   * unmatched-but-listed -> needs_decision + "no explicit product mapping"
//   * needs_decision: out of stock, flagged-on-list, ambiguous, rule
//   * never auto-substitute (alternatives surfaced, not applied)
//   * excluded_this_week (item status + one-week rule)
//   * one_week_only honoured, never promoted
//   * budget within / below / above / unknown
//   * rule 'map' directive + inactive rule ignored
//   * NEVER emits a checkout / pay action
//
// PURE ASCII only.
// =====================================================================

'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { planBasket, _internal } = require('./planner');

// Convenience: find an output line by item_name.
function byName(plan, name) {
  return plan.items.find(function (it) { return it.item_name === name; });
}

const HH = 1;        // active household under test
const OTHER = 2;     // a different household

const budget = { min_normal: 120, max_normal: 150, currency: 'GBP', household_id: HH };

const products = [
  { id: 10, list_term: 'Generic Milk 2L', matched_product: 'Store Brand Milk 2L', category: 'dairy', household_id: HH },
  { id: 11, list_term: 'Generic Milk 2L', matched_product: 'Other Brand Milk 2L', category: 'dairy', household_id: null },
  { id: 12, list_term: 'Widget A', matched_product: 'Widget A Deluxe', category: 'household', household_id: null },
  { id: 13, list_term: 'Gadget Z', matched_product: 'Gadget Z Pack', category: 'household', household_id: OTHER },
  { id: 14, list_term: 'Twin Item', matched_product: 'Twin Item One', category: 'misc', household_id: HH },
  { id: 15, list_term: 'Twin Item', matched_product: 'Twin Item Two', category: 'misc', household_id: HH }
];

// ---------------------------------------------------------------------

test('rule 2: missing quantity defaults to 1', function () {
  const plan = planBasket({
    listItems: [{ item_name: 'Widget A' }],
    products: products, rules: [], budget: budget, household: HH
  });
  const w = byName(plan, 'Widget A');
  assert.equal(w.requested_qty, 1);
  assert.equal(w.planned_qty, 1);
  assert.equal(w.status, 'add');
});

test('helper normaliseQty coerces bad values to 1 and keeps positive ints', function () {
  assert.equal(_internal.normaliseQty(undefined), 1);
  assert.equal(_internal.normaliseQty(null), 1);
  assert.equal(_internal.normaliseQty(''), 1);
  assert.equal(_internal.normaliseQty(0), 1);
  assert.equal(_internal.normaliseQty(-3), 1);
  assert.equal(_internal.normaliseQty('4'), 4);
  assert.equal(_internal.normaliseQty(2.9), 2);
});

// SUPERSEDED AND REPLACED, 2026-08-04 (WO-Y), on Warwick's ruling after the
// integration builder found the defect by execution.
//
// This test used to assert that duplicate lines had their counts SUMMED:
// "2 Widget A" + "3 widget a" + "Widget A" == 6. Rule 3 says duplicate entries
// are deduped to a single line; it says nothing about arithmetic. Summing is an
// inference, and it was being made silently in one direction - so a list
// reading "2 milk" and "3 milk" quietly ordered five.
//
// The assertion is REPLACED, not deleted, and the three cases below carry more
// proof than the one line they replace.
test('rule 3: duplicate lines with the SAME written quantity collapse to one line at that quantity', function () {
  const plan = planBasket({
    listItems: [
      { item_name: 'Widget A', requested_qty: 2 },
      { item_name: 'widget a', requested_qty: 2 }   // different case, same item
    ],
    products: products, rules: [], budget: budget, household: HH
  });
  const rows = plan.items.filter(function (it) { return it.item_name.toLowerCase() === 'widget a'; });
  assert.equal(rows.length, 1, 'duplicates collapse to one line');
  assert.equal(rows[0].requested_qty, 2, 'a repetition is not an addition');
  assert.equal(rows[0].planned_qty, 2);
  assert.equal(rows[0].status, 'add');
});

test('rule 3 + rule 2: duplicate lines with NO written quantity collapse to one line at 1', function () {
  const plan = planBasket({
    listItems: [
      { item_name: 'Widget A' },
      { item_name: 'widget a' },
      { item_name: 'WIDGET A' }
    ],
    products: products, rules: [], budget: budget, household: HH
  });
  const rows = plan.items.filter(function (it) { return it.item_name.toLowerCase() === 'widget a'; });
  assert.equal(rows.length, 1);
  assert.equal(rows[0].requested_qty, 1, 'three bare repetitions of one item are one item');
  assert.equal(rows[0].status, 'add');
});

test('rule 3: DIFFERENT written quantities are a QUESTION, never a sum', function () {
  // The real defect: "2 milk" and "3 milk" silently became five.
  const plan = planBasket({
    listItems: [
      { item_name: 'Widget A', requested_qty: 2 },
      { item_name: 'widget a', requested_qty: 3 }
    ],
    products: products, rules: [], budget: budget, household: HH
  });
  const rows = plan.items.filter(function (it) { return it.item_name.toLowerCase() === 'widget a'; });
  assert.equal(rows.length, 1, 'it is still one line');
  const w = rows[0];

  assert.notEqual(w.requested_qty, 5, 'the quantities must NOT be added together');
  assert.equal(w.status, 'needs_decision', 'the list says two different things; that is a question');
  assert.equal(w.planned_qty, 0, 'nothing is planned until Warwick says which');
  assert.ok(w.flags.includes('quantity conflict'));
  assert.ok(w.flags.includes('never auto-substitute'));
  assert.match(w.note, /two different quantities for this item \(2 and 3\)/,
    'BOTH written quantities must be on the card, so Warwick sees what was on the page');
  assert.equal(plan.summary.needs_decision, 1);
});

test('rule 3: an absent quantity alongside an explicit one is NOT a conflict', function () {
  // "milk" plus "2 milk" is one item written twice, once with a count. Only
  // two DIFFERENT written numbers are a genuine disagreement.
  const plan = planBasket({
    listItems: [
      { item_name: 'Widget A' },
      { item_name: 'widget a', requested_qty: 2 }
    ],
    products: products, rules: [], budget: budget, household: HH
  });
  const w = plan.items.filter(function (it) { return it.item_name.toLowerCase() === 'widget a'; })[0];
  assert.equal(w.requested_qty, 2);
  assert.equal(w.status, 'add');
  assert.equal(w.flags.includes('quantity conflict'), false);
});

test('rule 3: junk in a quantity field never manufactures a conflict', function () {
  const plan = planBasket({
    listItems: [
      { item_name: 'Widget A', requested_qty: 2 },
      { item_name: 'widget a', requested_qty: 'lots' },
      { item_name: 'widget a', requested_qty: 0 },
      { item_name: 'widget a', requested_qty: -4 }
    ],
    products: products, rules: [], budget: budget, household: HH
  });
  const w = plan.items.filter(function (it) { return it.item_name.toLowerCase() === 'widget a'; })[0];
  assert.equal(w.requested_qty, 2, 'only a real written number counts as a statement of quantity');
  assert.equal(w.status, 'add');
  assert.equal(w.flags.includes('quantity conflict'), false);
});

test('rule 9: household-scoped product beats a global mapping', function () {
  const plan = planBasket({
    listItems: [{ item_name: 'Generic Milk 2L', requested_qty: 1 }],
    products: products, rules: [], budget: budget, household: HH
  });
  const m = byName(plan, 'Generic Milk 2L');
  assert.equal(m.matched_product, 'Store Brand Milk 2L');
  assert.equal(m.status, 'add');
});

test('household scoping: a product owned by another household is not matched', function () {
  const plan = planBasket({
    listItems: [{ item_name: 'Gadget Z', requested_qty: 1 }],
    products: products, rules: [], budget: budget, household: HH
  });
  const g = byName(plan, 'Gadget Z');
  assert.equal(g.matched_product, null);
  // Defect C: this line's ORIGINAL point -- the foreign product is not matched
  // -- is unchanged and still asserted above. Only the STATUS expectation moved
  // from 'add' to 'needs_decision': an item the planner cannot identify at all
  // now goes to a human (rule 6) instead of being silently added.
  assert.equal(g.status, 'needs_decision');
  assert.equal(g.planned_qty, 0);
  assert.ok(g.flags.includes('no explicit product mapping'));
});

test('scope leak: explicit matched_product_id owned by ANOTHER household -> needs_decision, foreign product NOT applied', function () {
  // The line explicitly references product id 13 (Gadget Z), which is owned by
  // OTHER, not the active household HH. Resolving that id ALONE would leak a
  // cross-household product into the basket. The planner must refuse it: send
  // the line to a human, never auto-substitute, and never set matched_product
  // to the foreign product. Synthetic ids only; no real household data.
  const plan = planBasket({
    listItems: [{ item_name: 'Gadget Z', requested_qty: 4, matched_product_id: 13 }],
    products: products, rules: [], budget: budget, household: HH
  });
  const g = byName(plan, 'Gadget Z');
  assert.equal(g.status, 'needs_decision');
  assert.equal(g.planned_qty, 0, 'nothing added pending a human decision');
  assert.equal(g.matched_product, null, 'the cross-household product is NOT applied');
  assert.notEqual(g.matched_product, 'Gadget Z Pack');
  assert.ok(g.flags.includes('product id household scope mismatch'));
  assert.ok(g.flags.includes('never auto-substitute'));
});

test('scope control: explicit matched_product_id pointing to a GLOBAL product is accepted (add)', function () {
  // Product id 12 (Widget A) is global (household_id null): any household may
  // resolve it by explicit id.
  const plan = planBasket({
    listItems: [{ item_name: 'Widget A', requested_qty: 2, matched_product_id: 12 }],
    products: products, rules: [], budget: budget, household: HH
  });
  const w = byName(plan, 'Widget A');
  assert.equal(w.status, 'add');
  assert.equal(w.planned_qty, 2);
  assert.equal(w.matched_product, 'Widget A Deluxe');
  assert.ok(!w.flags.includes('product id household scope mismatch'));
});

test('scope control: explicit matched_product_id pointing to the ACTIVE household product is accepted (add)', function () {
  // Product id 10 (Generic Milk 2L) belongs to the active household HH.
  const plan = planBasket({
    listItems: [{ item_name: 'Generic Milk 2L', requested_qty: 1, matched_product_id: 10 }],
    products: products, rules: [], budget: budget, household: HH
  });
  const m = byName(plan, 'Generic Milk 2L');
  assert.equal(m.status, 'add');
  assert.equal(m.planned_qty, 1);
  assert.equal(m.matched_product, 'Store Brand Milk 2L');
  assert.ok(!m.flags.includes('product id household scope mismatch'));
});

test('scope: an explicit matched_product_id that resolves to NO product falls through to term matching', function () {
  // id 999 does not exist. Behaviour must be unchanged: fall through to term
  // matching, which finds the active-household Generic Milk 2L (id 10).
  const plan = planBasket({
    listItems: [{ item_name: 'Generic Milk 2L', requested_qty: 1, matched_product_id: 999 }],
    products: products, rules: [], budget: budget, household: HH
  });
  const m = byName(plan, 'Generic Milk 2L');
  assert.equal(m.status, 'add');
  assert.equal(m.matched_product, 'Store Brand Milk 2L');
  assert.ok(!m.flags.includes('product id household scope mismatch'));
});

// DEFECT C: this test previously asserted the OLD BROKEN behaviour --
// "unmatched but explicitly listed still plans as add with a flag". That was
// wrong against standing rule 6 ("not confidently matched -> needs_decision,
// with alternatives surfaced for a human"): an item the planner could not
// identify at all was silently added, and a genuinely ambiguous list produced
// needs_decision: 0. The old rationale was that a human would find the item in
// Favourites / Regulars at run time (rule 4) -- but the planner could not SEE
// Regulars, so that rationale never held. It can now (defect B), so anything
// still unresolved after all four resolution sources really is unidentified.
// The expectation is corrected here rather than the assertion weakened.
test('rule 6 (defect C): an unmatched item -> needs_decision, never a silent add', function () {
  const plan = planBasket({
    listItems: [{ item_name: 'Totally Unknown Thing', requested_qty: 2 }],
    products: products, rules: [], budget: budget, household: HH
  });
  const u = byName(plan, 'Totally Unknown Thing');
  assert.equal(u.status, 'needs_decision');
  assert.equal(u.matched_product, null);
  assert.equal(u.planned_qty, 0, 'nothing is added pending a human decision');
  assert.ok(u.flags.includes('no explicit product mapping'));
  assert.ok(u.flags.includes('never auto-substitute'));
  assert.equal(plan.summary.needs_decision, 1, 'it is COUNTED in the summary');
  assert.equal(plan.summary.planned_add, 0);
});

test('rule 6: ambiguous match (two household products) -> needs_decision, no substitute', function () {
  const plan = planBasket({
    listItems: [{ item_name: 'Twin Item', requested_qty: 1 }],
    products: products, rules: [], budget: budget, household: HH
  });
  const t = byName(plan, 'Twin Item');
  assert.equal(t.status, 'needs_decision');
  assert.equal(t.planned_qty, 0, 'nothing added pending a human decision');
  assert.ok(t.flags.includes('ambiguous match'));
  assert.ok(t.flags.includes('never auto-substitute'));
});

test('rule 6: out-of-stock item -> needs_decision, alternatives surfaced but NEVER applied', function () {
  const plan = planBasket({
    listItems: [{
      item_name: 'Widget A', requested_qty: 1, in_stock: false,
      alternatives: [{ alternative_name: 'Widget A Alt', price: 3.5 }]
    }],
    products: products, rules: [], budget: budget, household: HH
  });
  const w = byName(plan, 'Widget A');
  assert.equal(w.status, 'needs_decision');
  assert.equal(w.planned_qty, 0);
  // matched_product stays the ORIGINAL match, never the alternative.
  assert.equal(w.matched_product, 'Widget A Deluxe');
  assert.notEqual(w.matched_product, 'Widget A Alt');
  assert.ok(w.flags.includes('out of stock'));
  assert.ok(w.flags.includes('never auto-substitute'));
  assert.ok(w.flags.includes('alternatives available'));
  assert.ok(w.note.includes('Widget A Alt'), 'alternative name is surfaced in the note only');
});

test('needs_decision flagged directly on the list line is honoured', function () {
  const plan = planBasket({
    listItems: [{ item_name: 'Widget A', requested_qty: 1, status: 'needs_decision' }],
    products: products, rules: [], budget: budget, household: HH
  });
  const w = byName(plan, 'Widget A');
  assert.equal(w.status, 'needs_decision');
  assert.ok(w.flags.includes('flagged on list'));
  assert.ok(w.flags.includes('never auto-substitute'));
});

test('rule 10: excluded_this_week via item status is honoured and not promoted', function () {
  const plan = planBasket({
    listItems: [{ item_name: 'Widget A', requested_qty: 5, status: 'excluded_this_week' }],
    products: products, rules: [], budget: budget, household: HH
  });
  const w = byName(plan, 'Widget A');
  assert.equal(w.status, 'excluded_this_week');
  assert.equal(w.planned_qty, 0);
  assert.ok(w.flags.includes('excluded this week only'));
  assert.ok(!w.flags.includes('excluded by standing rule'), 'one-week is not a standing rule');
});

test('summary: excluded total reconciles BOTH kinds, with additive breakdown keys', function () {
  const rules = [
    { id: 1, scope: 'product', active: true, directive: 'exclude', match_term: 'Widget A', household_id: HH }
  ];
  const plan = planBasket({
    listItems: [
      { item_name: 'Widget A', requested_qty: 1 },                                      // standing exclude
      { item_name: 'Generic Milk 2L', requested_qty: 1, status: 'excluded_this_week' }, // one-week exclude
      { item_name: 'Totally Unknown Thing', requested_qty: 1 }                          // unidentified
    ],
    products: products, rules: rules, budget: budget, household: HH
  });
  assert.equal(byName(plan, 'Widget A').status, 'excluded');
  assert.equal(byName(plan, 'Generic Milk 2L').status, 'excluded_this_week');
  assert.equal(plan.summary.excluded, 2, 'total counts BOTH exclusion kinds');
  assert.equal(plan.summary.excluded_standing, 1);
  assert.equal(plan.summary.excluded_this_week, 1);
  // Defect C: the third line is unidentified, so it is now needs_decision
  // rather than a silent add. The exclusion book-keeping this test exists for
  // is untouched; the reconciliation invariant is asserted explicitly below.
  assert.equal(plan.summary.planned_add, 0);
  assert.equal(plan.summary.needs_decision, 1);
  const s = plan.summary;
  assert.equal(
    s.planned_add + s.needs_decision + s.excluded,
    s.total_requested,
    'every line lands in exactly one summary bucket'
  );
  assert.equal(s.excluded_standing + s.excluded_this_week, s.excluded);
});

test('rule directive: standing exclude rule -> status excluded + standing-rule flag (qty 0)', function () {
  // A learned, PERMANENT "never buy this again" hard rule. It must be labelled
  // as a STANDING exclusion, distinct from a transient one-week exclusion.
  const rules = [
    { id: 1, scope: 'product', active: true, directive: 'exclude', match_term: 'Widget A', household_id: HH }
  ];
  const plan = planBasket({
    listItems: [{ item_name: 'Widget A', requested_qty: 1 }],
    products: products, rules: rules, budget: budget, household: HH
  });
  const w = byName(plan, 'Widget A');
  assert.equal(w.status, 'excluded');
  assert.equal(w.planned_qty, 0, 'a standing exclude is never added');
  assert.ok(w.flags.includes('excluded by standing rule'));
  assert.ok(!w.flags.includes('excluded this week only'), 'not mislabelled as one-week');
});

test('rule directive: standing exclude surfaces the rule reason when present', function () {
  const rules = [
    {
      id: 1, scope: 'product', active: true, directive: 'exclude',
      match_term: 'banana fizz', reason: 'household dislikes this flavour', household_id: HH
    }
  ];
  const plan = planBasket({
    listItems: [{ item_name: 'banana fizz', requested_qty: 2 }],
    products: [], rules: rules, budget: budget, household: HH
  });
  const b = byName(plan, 'banana fizz');
  assert.equal(b.status, 'excluded');
  assert.equal(b.planned_qty, 0);
  assert.ok(b.flags.includes('excluded by standing rule'));
  assert.ok(b.note.includes('household dislikes this flavour'), 'reason surfaced in the note');
});

test('precedence: a standing exclude wins over a one-week mark on the same line', function () {
  // The line is ALSO flagged one-week, but a permanent "never buy" must not be
  // mislabelled as transient. Standing exclude takes precedence.
  const rules = [
    { id: 1, scope: 'product', active: true, directive: 'exclude', match_term: 'Widget A', household_id: HH }
  ];
  const plan = planBasket({
    listItems: [{ item_name: 'Widget A', requested_qty: 1, status: 'excluded_this_week', one_week_only: true }],
    products: products, rules: rules, budget: budget, household: HH
  });
  const w = byName(plan, 'Widget A');
  assert.equal(w.status, 'excluded', 'standing wins over one-week');
  assert.equal(w.planned_qty, 0);
  assert.ok(w.flags.includes('excluded by standing rule'));
  assert.ok(!w.flags.includes('excluded this week only'));
});

test('rule directive: needs_decision rule -> needs_decision, never substitute', function () {
  const rules = [
    { id: 2, scope: 'product', active: true, directive: 'needs_decision', match_term: 'Widget A' }
  ];
  const plan = planBasket({
    listItems: [{ item_name: 'Widget A', requested_qty: 1 }],
    products: products, rules: rules, budget: budget, household: HH
  });
  const w = byName(plan, 'Widget A');
  assert.equal(w.status, 'needs_decision');
  assert.ok(w.flags.includes('flagged by rule'));
  assert.ok(w.flags.includes('never auto-substitute'));
});

test('rule directive: map rule overrides the matched product', function () {
  const rules = [
    { id: 3, scope: 'product', active: true, directive: 'map', match_term: 'Widget A', matched_product: 'Widget A Rule Pick' }
  ];
  const plan = planBasket({
    listItems: [{ item_name: 'Widget A', requested_qty: 1 }],
    products: products, rules: rules, budget: budget, household: HH
  });
  const w = byName(plan, 'Widget A');
  assert.equal(w.matched_product, 'Widget A Rule Pick');
  assert.equal(w.status, 'add');
  assert.ok(w.flags.includes('product mapped by rule'));
});

test('inactive rule is ignored', function () {
  const rules = [
    { id: 4, scope: 'product', active: false, directive: 'exclude', match_term: 'Widget A' }
  ];
  const plan = planBasket({
    listItems: [{ item_name: 'Widget A', requested_qty: 1 }],
    products: products, rules: rules, budget: budget, household: HH
  });
  const w = byName(plan, 'Widget A');
  assert.equal(w.status, 'add', 'an inactive exclude must not exclude');
});

test('free-text-only rule (no directive) is informational and does not change the plan', function () {
  const rules = [
    { id: 5, scope: 'global', active: true, category: 'general', rule_text: 'Prefer own-brand where sensible.' }
  ];
  const plan = planBasket({
    listItems: [{ item_name: 'Widget A', requested_qty: 1 }],
    products: products, rules: rules, budget: budget, household: HH
  });
  const w = byName(plan, 'Widget A');
  assert.equal(w.status, 'add');
  assert.equal(w.matched_product, 'Widget A Deluxe');
});

// ---------------------------------------------------------------------
// Directive-column path (Option A): the four structured columns that
// data.js loadRules() now returns from asdair.rules --
//   directive, match_term, match_category, matched_product
// -- driving planBasket end to end. Synthetic flavour term only
// ("banana fizz"); NO real household or personal data.
// ---------------------------------------------------------------------

test('directive columns: needs_decision rule matched by match_term -> needs_decision, qty 0, never auto-substitute', function () {
  // The "always ask me about this flavour" class of household rule, surfaced
  // via the structured columns. A synthetic flavour preference, nothing real.
  const rules = [
    {
      id: 100, scope: 'product', active: true,
      directive: 'needs_decision', match_term: 'banana fizz',
      match_category: null, matched_product: null, household_id: HH
    }
  ];
  const plan = planBasket({
    listItems: [{ item_name: 'banana fizz', requested_qty: 3 }],
    products: [], rules: rules, budget: budget, household: HH
  });
  const b = byName(plan, 'banana fizz');
  assert.equal(b.status, 'needs_decision');
  assert.equal(b.planned_qty, 0, 'nothing added pending a human decision');
  assert.ok(b.flags.includes('flagged by rule'));
  assert.ok(b.flags.includes('never auto-substitute'));
});

test('directive columns: map rule matched by match_term -> matched_product set to the rule value + "product mapped by rule" flag', function () {
  const rules = [
    {
      id: 101, scope: 'product', active: true,
      directive: 'map', match_term: 'banana fizz',
      match_category: null, matched_product: 'Store Brand Banana Fizz 1L',
      household_id: HH
    }
  ];
  const plan = planBasket({
    listItems: [{ item_name: 'banana fizz', requested_qty: 1 }],
    products: [], rules: rules, budget: budget, household: HH
  });
  const b = byName(plan, 'banana fizz');
  assert.equal(b.matched_product, 'Store Brand Banana Fizz 1L');
  assert.equal(b.status, 'add');
  assert.ok(b.flags.includes('product mapped by rule'));
});

test('directive columns: info directive and active=false rule with a matching match_term have NO planning effect', function () {
  const rules = [
    // Informational directive: must be ignored even though match_term matches.
    {
      id: 102, scope: 'product', active: true,
      directive: 'info', match_term: 'banana fizz',
      match_category: null, matched_product: 'Should Not Apply', household_id: HH
    },
    // Inactive map: must also be ignored despite matching.
    {
      id: 103, scope: 'product', active: false,
      directive: 'map', match_term: 'banana fizz',
      match_category: null, matched_product: 'Also Should Not Apply', household_id: HH
    }
  ];
  const plan = planBasket({
    listItems: [{ item_name: 'banana fizz', requested_qty: 2 }],
    products: [], rules: rules, budget: budget, household: HH
  });
  const b = byName(plan, 'banana fizz');
  // The point of this test -- info / inactive rules map NOTHING -- is asserted
  // here and is unchanged.
  assert.equal(b.matched_product, null, 'no product was mapped');
  assert.ok(!b.flags.includes('product mapped by rule'), 'no rule mapping was applied');
  assert.ok(b.flags.includes('no explicit product mapping'));
  // Defect C: with nothing mapped and no products / regulars to fall back on,
  // the line is unidentified, so rule 6 sends it to a human rather than adding
  // it silently. Only the status expectation moved.
  assert.equal(b.status, 'needs_decision');
  assert.equal(b.planned_qty, 0);
});

test('rule 10: one_week_only is flagged for this list only', function () {
  const plan = planBasket({
    listItems: [{ item_name: 'Widget A', requested_qty: 1, one_week_only: true }],
    products: products, rules: [], budget: budget, household: HH
  });
  const w = byName(plan, 'Widget A');
  assert.ok(w.flags.includes('one week only'));
  assert.equal(w.status, 'add');
});

test('rule 7: budget flag WITHIN when total lands in the band', function () {
  const plan = planBasket({
    listItems: [{ item_name: 'Widget A', requested_qty: 1, price: 130 }],
    products: products, rules: [], budget: budget, household: HH
  });
  assert.equal(plan.summary.estimated_total, 130);
  assert.equal(plan.summary.budget_flag, 'within');
});

test('rule 7: budget flag BELOW when total is under the band (flag only, still add)', function () {
  const plan = planBasket({
    listItems: [{ item_name: 'Widget A', requested_qty: 2, price: 10 }],
    products: products, rules: [], budget: budget, household: HH
  });
  assert.equal(plan.summary.estimated_total, 20);
  assert.equal(plan.summary.budget_flag, 'below');
  const w = byName(plan, 'Widget A');
  assert.equal(w.status, 'add', 'below-budget never blocks');
  assert.ok(w.flags.includes('basket below budget band'));
});

test('rule 7: budget flag ABOVE when total exceeds the band', function () {
  const plan = planBasket({
    listItems: [{ item_name: 'Widget A', requested_qty: 4, price: 50 }],
    products: products, rules: [], budget: budget, household: HH
  });
  assert.equal(plan.summary.estimated_total, 200);
  assert.equal(plan.summary.budget_flag, 'above');
});

test('rule 7: budget flag UNKNOWN when any add item has no price', function () {
  // Defect C: the unpriced line must be a line that actually PLANS TO ADD, so
  // the fixture now uses a MATCHED product with no price ('Generic Milk 2L')
  // instead of an unmatched one. An unmatched line is needs_decision now and so
  // is excluded from the estimate by design, which would not have exercised
  // this rule at all. The behaviour under test is unchanged and still asserted.
  const plan = planBasket({
    listItems: [
      { item_name: 'Widget A', requested_qty: 1, price: 100 },
      { item_name: 'Generic Milk 2L', requested_qty: 1 }  // matched, but no price
    ],
    products: products, rules: [], budget: budget, household: HH
  });
  assert.equal(byName(plan, 'Generic Milk 2L').status, 'add', 'the unpriced line really is an add line');
  assert.equal(plan.summary.estimated_total, null);
  assert.equal(plan.summary.budget_flag, 'unknown');
});

test('needs_decision and excluded lines are not counted in the budget estimate', function () {
  const plan = planBasket({
    listItems: [
      { item_name: 'Widget A', requested_qty: 1, price: 130 },
      { item_name: 'Twin Item', requested_qty: 1, price: 999 },                       // ambiguous -> needs_decision
      { item_name: 'Generic Milk 2L', requested_qty: 1, price: 999, status: 'excluded_this_week' }
    ],
    products: products, rules: [], budget: budget, household: HH
  });
  assert.equal(plan.summary.estimated_total, 130, 'only add lines count');
  assert.equal(plan.summary.budget_flag, 'within');
  assert.equal(plan.summary.needs_decision, 1);
  assert.equal(plan.summary.excluded, 1);
  assert.equal(plan.summary.planned_add, 1);
});

test('summary counts reflect the mix of statuses', function () {
  const plan = planBasket({
    listItems: [
      { item_name: 'Widget A', requested_qty: 1 },                                   // add
      { item_name: 'Twin Item', requested_qty: 1 },                                  // needs_decision (ambiguous)
      { item_name: 'Generic Milk 2L', requested_qty: 1, status: 'excluded_this_week' } // excluded
    ],
    products: products, rules: [], budget: budget, household: HH
  });
  assert.equal(plan.summary.total_requested, 3);
  assert.equal(plan.summary.planned_add, 1);
  assert.equal(plan.summary.needs_decision, 1);
  assert.equal(plan.summary.excluded, 1);
});

test('rule 8: the plan NEVER contains any checkout / pay / place-order action', function () {
  const plan = planBasket({
    listItems: [
      { item_name: 'Widget A', requested_qty: 1, price: 130 },
      { item_name: 'Twin Item', requested_qty: 1 }
    ],
    products: products, rules: [], budget: budget, household: HH
  });
  const blob = JSON.stringify(plan).toLowerCase();
  assert.equal(/checkout/.test(blob), false, 'no checkout token');
  assert.equal(/\bpay\b/.test(blob), false, 'no pay token');
  assert.equal(/place[_\s-]?order/.test(blob), false, 'no place-order token');
  // Output surface is strictly plan data: items + summary, no action verbs.
  assert.deepEqual(Object.keys(plan).sort(), ['items', 'summary']);
  plan.items.forEach(function (it) {
    assert.deepEqual(
      Object.keys(it).sort(),
      ['alternatives', 'flags', 'item_name', 'matched_product', 'note', 'planned_qty', 'requested_qty', 'status']
    );
    assert.ok(['add', 'needs_decision', 'excluded_this_week', 'excluded'].includes(it.status));
    assert.ok(Array.isArray(it.alternatives), 'alternatives is always an array (suggestion-only, additive)');
  });
});

test('determinism: identical inputs yield identical output', function () {
  const input = {
    listItems: [
      { item_name: 'Widget A', requested_qty: 2, price: 40 },
      { item_name: 'Twin Item', requested_qty: 1 },
      { item_name: 'Generic Milk 2L', requested_qty: 1, price: 2.5 }
    ],
    products: products, rules: [], budget: budget, household: HH
  };
  const a = JSON.stringify(planBasket(input));
  const b = JSON.stringify(planBasket(input));
  assert.equal(a, b);
});

test('empty / missing inputs do not throw and return an empty plan', function () {
  const plan = planBasket({});
  assert.deepEqual(plan.items, []);
  assert.equal(plan.summary.total_requested, 0);
  assert.equal(plan.summary.estimated_total, null);
  assert.equal(plan.summary.budget_flag, 'unknown');
});

// ---------------------------------------------------------------------
// Finding 1 (HIGH) - status precedence must NOT mask a scope mismatch.
// A foreign-household matched_product_id (id 13, Gadget Z, owned by OTHER)
// that ALSO trips another status must STILL carry the scope-mismatch flag,
// and the foreign product must never reach matched_product. Synthetic ids
// only; no real household data.
// ---------------------------------------------------------------------

test('Finding 1: foreign id + out_of_stock STILL flags scope mismatch and never applies the foreign product', function () {
  const plan = planBasket({
    listItems: [{ item_name: 'Gadget Z', requested_qty: 2, matched_product_id: 13, in_stock: false }],
    products: products, rules: [], budget: budget, household: HH
  });
  const g = byName(plan, 'Gadget Z');
  assert.equal(g.status, 'needs_decision');
  assert.equal(g.planned_qty, 0, 'nothing added pending a human decision');
  assert.equal(g.matched_product, null, 'the cross-household product is NOT applied');
  assert.notEqual(g.matched_product, 'Gadget Z Pack');
  assert.ok(g.flags.includes('product id household scope mismatch'),
    'scope mismatch is surfaced even though the line is also out of stock');
  assert.ok(g.flags.includes('never auto-substitute'));
});

test('Finding 1: foreign id + excluded_this_week STILL flags scope mismatch (flag never silently dropped)', function () {
  const plan = planBasket({
    listItems: [{ item_name: 'Gadget Z', requested_qty: 2, matched_product_id: 13, status: 'excluded_this_week' }],
    products: products, rules: [], budget: budget, household: HH
  });
  const g = byName(plan, 'Gadget Z');
  // The exclusion legitimately keeps the status (an excluded line is never
  // bought), but the data-integrity flag must still be recorded.
  assert.equal(g.status, 'excluded_this_week');
  assert.equal(g.planned_qty, 0);
  assert.equal(g.matched_product, null, 'the cross-household product is NOT applied');
  assert.ok(g.flags.includes('product id household scope mismatch'),
    'scope mismatch is surfaced even when a one-week exclusion won the status');
  assert.ok(g.flags.includes('never auto-substitute'));
});

test('Finding 1: foreign id + rule needs_decision STILL flags scope mismatch and never applies the foreign product', function () {
  const rules = [
    { id: 200, scope: 'product', active: true, directive: 'needs_decision', match_term: 'Gadget Z', household_id: HH }
  ];
  const plan = planBasket({
    listItems: [{ item_name: 'Gadget Z', requested_qty: 2, matched_product_id: 13 }],
    products: products, rules: rules, budget: budget, household: HH
  });
  const g = byName(plan, 'Gadget Z');
  assert.equal(g.status, 'needs_decision');
  assert.equal(g.planned_qty, 0);
  assert.equal(g.matched_product, null, 'the cross-household product is NOT applied');
  assert.notEqual(g.matched_product, 'Gadget Z Pack');
  assert.ok(g.flags.includes('product id household scope mismatch'),
    'scope mismatch is surfaced even alongside a rule-driven needs_decision');
  assert.ok(g.flags.includes('never auto-substitute'));
});

// ---------------------------------------------------------------------
// Finding 2 (HIGH) - dedupe must not silently drop a conflicting foreign id.
// Two duplicate lines with the SAME normalised item_name where a LATER
// duplicate carries a different household's id must surface the scope
// mismatch, not first-wins the earlier (valid) id and hide the foreign one.
// ---------------------------------------------------------------------

test('Finding 2: duplicate lines whose SECOND carries a foreign id -> merged line surfaces the scope mismatch', function () {
  const plan = planBasket({
    listItems: [
      { item_name: 'Generic Milk 2L', requested_qty: 1, matched_product_id: 10 },  // active-household id (would first-win)
      { item_name: 'Generic Milk 2L', requested_qty: 1, matched_product_id: 13 }   // foreign id (must NOT be dropped)
    ],
    products: products, rules: [], budget: budget, household: HH
  });
  const rows = plan.items.filter(function (it) { return it.item_name.toLowerCase() === 'generic milk 2l'; });
  assert.equal(rows.length, 1, 'duplicates still collapse to one line');
  const m = rows[0];
  // Both lines wrote qty 1, so there is no quantity disagreement here - the
  // subject of this test is the FOREIGN ID, and that is unchanged.
  // (Was `2` while dedupe summed counts; corrected 2026-08-04 with the rule.)
  assert.equal(m.requested_qty, 1);
  assert.equal(m.status, 'needs_decision', 'a hidden foreign id is not silently accepted as add');
  assert.equal(m.planned_qty, 0);
  assert.equal(m.matched_product, null, 'neither the active nor the foreign product is auto-applied on conflict');
  assert.notEqual(m.matched_product, 'Gadget Z Pack', 'the foreign product is never applied');
  assert.ok(m.flags.includes('product id household scope mismatch'),
    'the second duplicate foreign id is scope-checked, not dropped by first-wins');
  assert.ok(m.flags.includes('never auto-substitute'));
});

test('Finding 2 control: duplicate lines repeating the SAME id behave exactly as before (add, no conflict)', function () {
  const plan = planBasket({
    listItems: [
      { item_name: 'Widget A', requested_qty: 2, matched_product_id: 12 },  // global id
      { item_name: 'Widget A', requested_qty: 3, matched_product_id: 12 }   // same id repeated
    ],
    products: products, rules: [], budget: budget, household: HH
  });
  const rows = plan.items.filter(function (it) { return it.item_name.toLowerCase() === 'widget a'; });
  assert.equal(rows.length, 1);
  const w = rows[0];
  assert.equal(w.requested_qty, 5, 'counts summed as before');
  assert.equal(w.planned_qty, 5);
  assert.equal(w.status, 'add');
  assert.equal(w.matched_product, 'Widget A Deluxe');
  assert.ok(!w.flags.includes('product id household scope mismatch'), 'same-id repeat is not a conflict');
});

test('Finding 2 control: an id-bearing line plus a no-id duplicate still first-wins the single id (no regression)', function () {
  const plan = planBasket({
    listItems: [
      { item_name: 'Generic Milk 2L', requested_qty: 1, matched_product_id: 10 },  // active-household id
      { item_name: 'Generic Milk 2L', requested_qty: 1 }                           // no id -> no conflict
    ],
    products: products, rules: [], budget: budget, household: HH
  });
  const rows = plan.items.filter(function (it) { return it.item_name.toLowerCase() === 'generic milk 2l'; });
  assert.equal(rows.length, 1);
  const m = rows[0];
  assert.equal(m.requested_qty, 2);
  assert.equal(m.status, 'add');
  assert.equal(m.matched_product, 'Store Brand Milk 2L', 'active-household id resolves as before');
  assert.ok(!m.flags.includes('product id household scope mismatch'));
});

test('Finding 2 control: duplicate lines both carrying the SAME foreign id still fail safe as scope mismatch', function () {
  const plan = planBasket({
    listItems: [
      { item_name: 'Gadget Z', requested_qty: 1, matched_product_id: 13 },
      { item_name: 'Gadget Z', requested_qty: 1, matched_product_id: 13 }
    ],
    products: products, rules: [], budget: budget, household: HH
  });
  const rows = plan.items.filter(function (it) { return it.item_name.toLowerCase() === 'gadget z'; });
  assert.equal(rows.length, 1);
  const g = rows[0];
  assert.equal(g.status, 'needs_decision');
  assert.equal(g.matched_product, null);
  assert.ok(g.flags.includes('product id household scope mismatch'));
});

// ---------------------------------------------------------------------
// Finding 6 (LOW) - a target-less ACTIONABLE directive must NOT apply to
// EVERY line. A 'map' / 'exclude' / 'needs_decision' rule with NO target
// (both match_term and match_category null/empty) is ignored, exactly like
// an 'info' row -- it never matches any line. Otherwise a target-less 'map'
// would silently rewrite every item's matched_product and a target-less
// 'exclude' would empty the whole basket: a wrong-but-confident plan.
// (A DB CHECK enforces the same server-side, belt-and-braces.) Synthetic
// fixtures only; no real household data.
// ---------------------------------------------------------------------

test('Finding 6: a target-less map directive (no match_term / match_category) does NOT rewrite items', function () {
  const rules = [
    {
      id: 300, scope: 'global', active: true, directive: 'map',
      match_term: null, match_category: null,
      matched_product: 'Should Not Apply To Everything'
    }
  ];
  const plan = planBasket({
    listItems: [
      { item_name: 'Widget A', requested_qty: 1 },
      { item_name: 'Generic Milk 2L', requested_qty: 1 }
    ],
    products: products, rules: rules, budget: budget, household: HH
  });
  const w = byName(plan, 'Widget A');
  const m = byName(plan, 'Generic Milk 2L');
  // Each line resolves by its OWN normal product match, never the rule value.
  assert.equal(w.matched_product, 'Widget A Deluxe', 'target-less map must not overwrite Widget A');
  assert.equal(m.matched_product, 'Store Brand Milk 2L', 'target-less map must not overwrite Generic Milk 2L');
  assert.equal(w.matched_product !== 'Should Not Apply To Everything', true);
  assert.ok(!w.flags.includes('product mapped by rule'), 'no line is mapped by a target-less rule');
  assert.ok(!m.flags.includes('product mapped by rule'));
  assert.equal(w.status, 'add');
  assert.equal(m.status, 'add');
});

test('Finding 6: a target-less exclude directive (no match_term / match_category) does NOT empty the basket', function () {
  const rules = [
    {
      id: 301, scope: 'household', active: true, directive: 'exclude',
      match_term: '', match_category: '', household_id: HH
    }
  ];
  const plan = planBasket({
    listItems: [
      { item_name: 'Widget A', requested_qty: 2 },
      { item_name: 'Generic Milk 2L', requested_qty: 1 }
    ],
    products: products, rules: rules, budget: budget, household: HH
  });
  const w = byName(plan, 'Widget A');
  const m = byName(plan, 'Generic Milk 2L');
  assert.equal(w.status, 'add', 'a target-less exclude must not exclude Widget A');
  assert.equal(m.status, 'add', 'a target-less exclude must not exclude Generic Milk 2L');
  assert.equal(w.planned_qty, 2, 'the basket is not emptied');
  assert.equal(m.planned_qty, 1);
  assert.ok(!w.flags.includes('excluded by standing rule'));
  assert.ok(!m.flags.includes('excluded by standing rule'));
  assert.equal(plan.summary.planned_add, 2, 'both lines still plan to add');
  assert.equal(plan.summary.excluded, 0, 'nothing was excluded by the target-less rule');
});

// =====================================================================
// DEFECT B: the planner can now SEE the household's Regulars.
//
// asdair.regulars carries nearly all of the household's real resolution
// knowledge (brand, `aka` aliases, asda_product_id, substitutes_allowed) and
// planBasket could not see any of it, so items the household buys every week
// resolved to nothing and the plan was confidently wrong.
//
// Regulars are the LOWEST-priority resolution source; products mappings and
// rules directives keep priority. SYNTHETIC fixtures only.
// =====================================================================

const regulars = [
  {
    id: 90, household_id: HH, name: 'Generic Cordial 1L', brand: 'Generic',
    aka: ['squash', 'juice thing'], category: 'drinks',
    asda_product_id: 'SYN-90', typical_qty: 1, substitutes_allowed: true, active: true
  },
  {
    id: 91, household_id: null, name: 'Global Spread 500g', brand: null,
    aka: ['spread'], category: 'dairy',
    asda_product_id: null, typical_qty: 1, substitutes_allowed: true, active: true
  },
  {
    id: 92, household_id: HH, name: 'Locked Item', brand: 'Brandy',
    aka: [], category: 'misc',
    asda_product_id: 'SYN-92', typical_qty: 2, substitutes_allowed: false, active: true
  },
  {
    id: 93, household_id: HH, name: 'Retired Item', brand: null,
    aka: ['retired'], category: 'misc',
    asda_product_id: null, typical_qty: 1, substitutes_allowed: true, active: false
  },
  {
    id: 94, household_id: OTHER, name: 'Foreign Regular', brand: null,
    aka: ['foreign thing'], category: 'misc',
    asda_product_id: null, typical_qty: 1, substitutes_allowed: true, active: true
  },
  // Two ACTIVE household regulars answering the same term -> ambiguous.
  {
    id: 95, household_id: HH, name: 'Twin Loaf White', brand: null,
    aka: ['twin loaf'], category: 'bakery',
    asda_product_id: 'SYN-95', typical_qty: 1, substitutes_allowed: true, active: true
  },
  {
    id: 96, household_id: HH, name: 'Twin Loaf Brown', brand: null,
    aka: ['twin loaf'], category: 'bakery',
    asda_product_id: 'SYN-96', typical_qty: 1, substitutes_allowed: true, active: true
  }
];

test('defect B: an item found ONLY in regulars now resolves (brand + name, id surfaced)', function () {
  const plan = planBasket({
    listItems: [{ item_name: 'Generic Cordial 1L', requested_qty: 2 }],
    products: products, rules: [], regulars: regulars, budget: budget, household: HH
  });
  const c = byName(plan, 'Generic Cordial 1L');
  assert.equal(c.matched_product, 'Generic Cordial 1L', 'brand already leads the name, not doubled');
  assert.equal(c.status, 'add');
  assert.equal(c.planned_qty, 2);
  assert.ok(c.flags.includes('matched from regulars'));
  assert.ok(c.note.includes('regulars asda_product_id SYN-90'));
});

test('defect B: an aka alias resolves, case-insensitively', function () {
  const plan = planBasket({
    listItems: [{ item_name: 'SQUASH', requested_qty: 1 }],
    products: products, rules: [], regulars: regulars, budget: budget, household: HH
  });
  const s = byName(plan, 'SQUASH');
  assert.equal(s.matched_product, 'Generic Cordial 1L');
  assert.ok(s.flags.includes('matched from regulars'));
});

test('defect B: brand is prepended when the name does not already carry it', function () {
  const plan = planBasket({
    listItems: [{ item_name: 'Locked Item', requested_qty: 1 }],
    products: products, rules: [], regulars: regulars, budget: budget, household: HH
  });
  const l = byName(plan, 'Locked Item');
  assert.equal(l.matched_product, 'Brandy Locked Item');
});

test('defect B: substitutes_allowed = false surfaces an informational flag', function () {
  const plan = planBasket({
    listItems: [{ item_name: 'Locked Item', requested_qty: 1 }],
    products: products, rules: [], regulars: regulars, budget: budget, household: HH
  });
  const l = byName(plan, 'Locked Item');
  assert.ok(l.flags.includes('no substitutes allowed'));
});

test('defect B: a GLOBAL regular resolves for any household', function () {
  const plan = planBasket({
    listItems: [{ item_name: 'spread', requested_qty: 1 }],
    products: products, rules: [], regulars: regulars, budget: budget, household: HH
  });
  const s = byName(plan, 'spread');
  assert.equal(s.matched_product, 'Global Spread 500g');
  assert.equal(s.note, '', 'no asda_product_id on this row -> nothing appended');
});

test('defect B: an INACTIVE regular never resolves', function () {
  const plan = planBasket({
    listItems: [{ item_name: 'retired', requested_qty: 1 }],
    products: products, rules: [], regulars: regulars, budget: budget, household: HH
  });
  const r = byName(plan, 'retired');
  assert.equal(r.matched_product, null, 'active = false is not a resolution source');
  assert.ok(!r.flags.includes('matched from regulars'));
});

test('defect B: a regular owned by ANOTHER household is NEVER used (no cross-household leak)', function () {
  const plan = planBasket({
    listItems: [{ item_name: 'foreign thing', requested_qty: 1 }],
    products: products, rules: [], regulars: regulars, budget: budget, household: HH
  });
  const f = byName(plan, 'foreign thing');
  assert.equal(f.matched_product, null);
  assert.notEqual(f.matched_product, 'Foreign Regular');
  assert.ok(!f.flags.includes('matched from regulars'));
});

test('defect B / rule 6: two active regulars on the same term -> needs_decision, never a pick', function () {
  // This is the reported live failure: a genuinely ambiguous item (two real
  // candidates) must reach a human, never be silently resolved.
  const plan = planBasket({
    listItems: [{ item_name: 'twin loaf', requested_qty: 1 }],
    products: products, rules: [], regulars: regulars, budget: budget, household: HH
  });
  const t = byName(plan, 'twin loaf');
  assert.equal(t.status, 'needs_decision');
  assert.equal(t.planned_qty, 0, 'nothing added pending a human decision');
  assert.equal(t.matched_product, null, 'neither candidate is picked');
  assert.ok(t.flags.includes('ambiguous match'));
  assert.ok(t.flags.includes('ambiguous regulars match'));
  assert.ok(t.flags.includes('never auto-substitute'));
  assert.equal(plan.summary.needs_decision, 1);
});

test('defect B: PRECEDENCE - a products.list_term mapping still beats a regulars match', function () {
  const withClash = regulars.concat([{
    id: 97, household_id: HH, name: 'Regulars Milk', brand: null,
    aka: ['generic milk 2l'], category: 'dairy',
    asda_product_id: 'SYN-97', typical_qty: 1, substitutes_allowed: true, active: true
  }]);
  const plan = planBasket({
    listItems: [{ item_name: 'Generic Milk 2L', requested_qty: 1 }],
    products: products, rules: [], regulars: withClash, budget: budget, household: HH
  });
  const m = byName(plan, 'Generic Milk 2L');
  assert.equal(m.matched_product, 'Store Brand Milk 2L', 'products mapping wins');
  assert.ok(!m.flags.includes('matched from regulars'));
});

test('defect B: PRECEDENCE - a map directive rule still beats a regulars match', function () {
  const mapRules = [{
    id: 401, scope: 'product', active: true, directive: 'map',
    match_term: 'squash', match_category: null,
    matched_product: 'Rule Mapped Cordial', household_id: HH
  }];
  const plan = planBasket({
    listItems: [{ item_name: 'squash', requested_qty: 1 }],
    products: products, rules: mapRules, regulars: regulars, budget: budget, household: HH
  });
  const s = byName(plan, 'squash');
  assert.equal(s.matched_product, 'Rule Mapped Cordial', 'the map directive wins');
  assert.ok(s.flags.includes('product mapped by rule'));
  assert.ok(!s.flags.includes('matched from regulars'));
});

test('defect B: PRECEDENCE - a scope-mismatched explicit id is NOT rescued by regulars', function () {
  const withGadget = regulars.concat([{
    id: 98, household_id: HH, name: 'Regulars Gadget', brand: null,
    aka: ['gadget z'], category: 'household',
    asda_product_id: 'SYN-98', typical_qty: 1, substitutes_allowed: true, active: true
  }]);
  const plan = planBasket({
    listItems: [{ item_name: 'Gadget Z', requested_qty: 1, matched_product_id: 13 }],
    products: products, rules: [], regulars: withGadget, budget: budget, household: HH
  });
  const g = byName(plan, 'Gadget Z');
  assert.equal(g.status, 'needs_decision');
  assert.equal(g.matched_product, null, 'the line still fails safe to a human');
  assert.ok(g.flags.includes('product id household scope mismatch'));
});

test('defect B: planBasket stays PURE - omitting regulars equals passing [], and repeats exactly', function () {
  const items = [{ item_name: 'Widget A', requested_qty: 1 }];
  const a = planBasket({ listItems: items, products: products, rules: [], budget: budget, household: HH });
  const b = planBasket({ listItems: items, products: products, rules: [], regulars: [], budget: budget, household: HH });
  assert.deepEqual(a, b);
  const c = planBasket({ listItems: items, products: products, rules: [], regulars: regulars, budget: budget, household: HH });
  const d = planBasket({ listItems: items, products: products, rules: [], regulars: regulars, budget: budget, household: HH });
  assert.deepEqual(c, d);
});

test('defect B helper: regularAliases returns name + aka, distinct and normalised', function () {
  assert.deepEqual(
    _internal.regularAliases({ name: '  Twin  Loaf White ', aka: ['TWIN LOAF', 'twin loaf', ''] }),
    ['twin loaf white', 'twin loaf']
  );
  assert.deepEqual(_internal.regularAliases({ name: 'X', aka: null }), ['x']);
  assert.deepEqual(_internal.regularAliases(null), []);
});

test('defect B helper: regularDisplayName prepends brand only when needed', function () {
  assert.equal(_internal.regularDisplayName({ name: 'Locked Item', brand: 'Brandy' }), 'Brandy Locked Item');
  assert.equal(_internal.regularDisplayName({ name: 'Brandy Locked Item', brand: 'Brandy' }), 'Brandy Locked Item');
  assert.equal(_internal.regularDisplayName({ name: 'Plain', brand: null }), 'Plain');
  assert.equal(_internal.regularDisplayName({ name: '', brand: 'OnlyBrand' }), 'OnlyBrand');
  assert.equal(_internal.regularDisplayName({ name: '', brand: '' }), null);
});

// =====================================================================
// DEFECT C: an item that resolves to nothing identifiable goes to
// needs_decision with candidates surfaced -- NEVER status 'add' with a flag.
//
// Standing rule 6 ("out of stock or not confidently matched -> needs_decision,
// with alternatives surfaced for a human. NEVER auto-substitute") was enforced
// by the operator rather than by the code: an unmatched line fell through to
// 'add', so a genuinely ambiguous list produced needs_decision: 0.
//
// CONFIDENTLY MATCHED (the rule chosen, mirrored from planner.js): the planner
// can NAME a specific product for the line -- matched_product is non-null after
// all four sources (explicit in-scope id > products.list_term > `map` directive
// > regulars). Nothing else counts.
// =====================================================================

test('defect C: an unidentified line surfaces RANKED candidates for the human', function () {
  // Rule 6 requires alternatives to be SURFACED, not applied. The line carries
  // a category hint, so the ranker can propose same-category candidates.
  const plan = planBasket({
    listItems: [{ item_name: 'Unknown Dairy Thing', requested_qty: 1, category: 'dairy' }],
    products: products, rules: [], regulars: [], budget: budget, household: HH
  });
  const u = byName(plan, 'Unknown Dairy Thing');
  assert.equal(u.status, 'needs_decision');
  assert.equal(u.matched_product, null, 'no candidate is ever applied');
  assert.ok(u.alternatives.length > 0, 'candidates are surfaced for a human');
  u.alternatives.forEach(function (a) {
    assert.ok(typeof a.name === 'string' && a.name !== '');
    assert.ok(typeof a.score === 'number');
  });
});

test('defect C: CONTROL - a confidently matched line still plans to add', function () {
  // The four resolution sources, each proving a confident match is untouched.
  const cases = [
    { label: 'products.list_term', line: { item_name: 'Widget A', requested_qty: 1 }, rules: [], regs: [] },
    { label: 'explicit in-scope id', line: { item_name: 'Widget A', requested_qty: 1, matched_product_id: 12 }, rules: [], regs: [] },
    {
      label: 'map directive',
      line: { item_name: 'mapped thing', requested_qty: 1 },
      rules: [{
        id: 501, scope: 'product', active: true, directive: 'map',
        match_term: 'mapped thing', match_category: null,
        matched_product: 'Mapped Thing Deluxe', household_id: HH
      }],
      regs: []
    },
    { label: 'regulars', line: { item_name: 'squash', requested_qty: 1 }, rules: [], regs: regulars }
  ];
  cases.forEach(function (c) {
    const plan = planBasket({
      listItems: [c.line], products: products, rules: c.rules,
      regulars: c.regs, budget: budget, household: HH
    });
    const it = plan.items[0];
    assert.equal(it.status, 'add', c.label + ' must still plan to add');
    assert.ok(it.matched_product, c.label + ' must name a product');
    assert.equal(plan.summary.planned_add, 1, c.label);
    assert.equal(plan.summary.needs_decision, 0, c.label);
  });
});

test('defect C: the summary contract still reconciles across a mixed basket', function () {
  const rules = [
    { id: 601, scope: 'product', active: true, directive: 'exclude', match_term: 'Widget A', household_id: HH }
  ];
  const plan = planBasket({
    listItems: [
      { item_name: 'Widget A', requested_qty: 1 },                                       // standing exclude
      { item_name: 'Generic Milk 2L', requested_qty: 1, status: 'excluded_this_week' },   // one-week exclude
      { item_name: 'Twin Item', requested_qty: 1 },                                       // ambiguous
      { item_name: 'Totally Unknown Thing', requested_qty: 1 },                           // unidentified
      { item_name: 'squash', requested_qty: 3 }                                           // regulars match -> add
    ],
    products: products, rules: rules, regulars: regulars, budget: budget, household: HH
  });
  const s = plan.summary;
  assert.equal(s.total_requested, 5);
  assert.equal(s.planned_add, 1);
  assert.equal(s.needs_decision, 2, 'the ambiguous AND the unidentified line both count');
  assert.equal(s.excluded, 2, 'total of BOTH exclusion kinds');
  assert.equal(s.excluded_standing, 1);
  assert.equal(s.excluded_this_week, 1);
  assert.equal(s.excluded_standing + s.excluded_this_week, s.excluded, 'breakdown is additive');
  assert.equal(
    s.planned_add + s.needs_decision + s.excluded,
    s.total_requested,
    'every line lands in exactly one summary bucket'
  );
  // planned_qty is 0 for everything that is not an add line.
  plan.items.forEach(function (it) {
    if (it.status !== 'add') assert.equal(it.planned_qty, 0, it.item_name + ' must plan 0 units');
  });
});

test('defect C: the reported live failure no longer yields needs_decision 0', function () {
  // The live symptom: a list whose items the planner could not identify came
  // back entirely as 'add' with needs_decision: 0 -- a confidently wrong plan.
  const plan = planBasket({
    listItems: [
      { item_name: 'twin loaf', requested_qty: 1 },            // two real candidates
      { item_name: 'Totally Unknown Thing', requested_qty: 1 } // nothing identifiable
    ],
    products: products, rules: [], regulars: regulars, budget: budget, household: HH
  });
  assert.equal(plan.summary.needs_decision, 2);
  assert.equal(plan.summary.planned_add, 0);
  plan.items.forEach(function (it) {
    assert.ok(it.flags.includes('never auto-substitute'), it.item_name);
    assert.equal(it.matched_product, null, it.item_name + ' is never auto-resolved');
  });
});

test('defect C: an unidentified line is excluded from the budget estimate', function () {
  const plan = planBasket({
    listItems: [
      { item_name: 'Widget A', requested_qty: 1, price: 130 },
      { item_name: 'Totally Unknown Thing', requested_qty: 1, price: 500 }
    ],
    products: products, rules: [], regulars: [], budget: budget, household: HH
  });
  assert.equal(byName(plan, 'Totally Unknown Thing').status, 'needs_decision');
  assert.equal(plan.summary.estimated_total, 130, 'only the add line is estimated');
  assert.equal(plan.summary.budget_flag, 'within');
});
