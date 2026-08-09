// =====================================================================
// BUILD-015 AsdAIr - B15-3 lane R1: rulebook.test.js
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
// -- WHAT THE FAKE CONSUMER PROVES, AND WHAT IT CANNOT ----------------------
//
// `terraFake` below is a STAND-IN for Terra. It is not a model and it does not
// reason. It is deliberately built so that it can only answer from what the
// GROUNDING ACTUALLY CARRIED: it iterates the rule ids the grounding attached
// to each line, and computes its answer from the candidates, prices and note
// text in the packet. Give it a grounding with no rules and it says nothing.
//
// That makes it a real test of THIS module's job - selection, assembly,
// attribution, the safety envelope, and the question path - and it is exactly
// why the mutation run (rulebook path returns no rules) makes the three named
// cases go wrong again.
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
//     rule 36  info    match_term NULL   <- global, no target
//     rule 37  info    match_term "sure male"
//     rule 38  info    match_term NULL   <- global, no target
//     rule 12  needs_decision  match_term "Nescafe Azera"
//
//   LIVE-VERIFIED SHAPE, CONSTRUCTED TEXT: rule 31 (Ariel Pods, best value by
//     price-per-wash) is recorded in the Work Order as active since 2026-07-20
//     and never fired. Its exact stored wording was not re-queryable here, so
//     the rule_text below is CONSTRUCTED and paraphrases it.
//
//   CONSTRUCTED (realistic shape, values NOT from the live database): every
//     product row and its price, the Ariel pack sizes, the shower-gel offer
//     wording, and rule 41. THE LIVE `products` AND `regulars` TABLES CARRY NO
//     PRICE COLUMN AT ALL - so a priced candidate list is a shape this planner
//     supports and the live corpus does not yet supply. Where a test depends on
//     a price it proves the MECHANISM, not the live case, and the no-price
//     behaviour is proved separately (see the AC5 block).
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

  // THE DEAD 59% - every one of these is dropped by actionableRules().
  {
    id: 31, directive: 'info', scope: 'product', active: true, household_id: HOUSEHOLD,
    match_term: 'ariel pods', match_category: null, matched_product: null,
    rule_text: 'Ariel Pods: pick the BEST VALUE by price per wash.'
  },
  {
    id: 36, directive: 'info', scope: 'household', active: true, household_id: HOUSEHOLD,
    match_term: null, match_category: null, matched_product: null,
    rule_text: 'If a multibuy gives 50 percent or more off the EXTRA item(s), buy up to the offer quantity.'
  },
  {
    id: 37, directive: 'info', scope: 'product', active: true, household_id: HOUSEHOLD,
    match_term: 'sure male', match_category: null, matched_product: null,
    rule_text: 'Sure male: round the quantity up to complete a pair.'
  },
  {
    id: 32, directive: 'info', scope: 'product', active: true, household_id: HOUSEHOLD,
    match_term: 'sure male', match_category: null, matched_product: null,
    rule_text: 'Sure male: rotate the scent each week.'
  },
  {
    id: 38, directive: 'info', scope: 'household', active: true, household_id: HOUSEHOLD,
    match_term: null, match_category: null, matched_product: null,
    rule_text: 'An add-to-trolley failure is usually out of stock, not a bad match.'
  }
]);

// CONSTRUCTED. Three Ariel packs in one category, with prices and wash counts
// in the NAME - which is exactly how a supermarket writes them, and exactly the
// kind of arithmetic-on-prose no deterministic matcher in this service does.
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

const SURE_PRODUCT = Object.freeze({
  id: 201, list_term: 'sure male', matched_product: 'Sure Men Anti-Perspirant (blue variant)',
  category: 'toiletries', household_id: null
});

const SHOWER_GEL = Object.freeze({
  id: 301, list_term: 'shower gel', matched_product: 'ASDA Shower Gel Active 500ml',
  category: 'toiletries', household_id: null
});

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
// grounding that carries no rule for a line produces no judgement for it - which
// is the property the mutation run depends on.
// ---------------------------------------------------------------------
function washesIn(name) {
  const m = String(name || '').match(/(\d+)\s*washes/i);
  return m ? Number(m[1]) : null;
}

const HANDLERS = {
  // Rule 31 - best value by price per wash, computed from the candidate list in
  // the packet. No price, or no wash count -> a question. Never a guess.
  '31': function (line) {
    if (!line.may_set_product) return { kind: 'ask', why: 'this line is not one I may name a product for' };
    const usable = line.candidates.filter(function (c) {
      return c.price !== null && c.price !== undefined && washesIn(c.name) !== null;
    });
    if (usable.length === 0 || usable.length !== line.candidates.length) {
      return { kind: 'ask', why: 'I was given no price per pack, so I cannot work out the price per wash' };
    }
    let best = null;
    usable.forEach(function (c) {
      const per = Number(c.price) / washesIn(c.name);
      if (best === null || per < best.per) best = { name: c.name, per: per };
    });
    return { kind: 'set_product', product: best.name, why: 'GBP ' + best.per.toFixed(3) + ' per wash, the lowest of the packs offered' };
  },

  // Rule 36 - a multibuy whose EXTRA item is at least half off. The offer lives
  // in the line's own note, as free text, which is where a shelf price actually
  // arrives from.
  '36': function (line) {
    if (!line.may_set_quantity) return null;
    const multi = String(line.note || '').match(/any\s+(\d+)\s+for\s+(?:GBP\s*)?([\d.]+)/i);
    const single = String(line.note || '').match(/single\s+(?:GBP\s*)?([\d.]+)/i);
    if (!multi || !single) return null;   // no offer on this line - nothing to say
    const qty = Number(multi[1]);
    const bundle = Number(multi[2]);
    const one = Number(single[1]);
    const extras = qty - 1;
    if (extras < 1 || one <= 0) return { kind: 'ask', why: 'the offer wording on this line does not tell me what the extra item costs' };
    const perExtra = (bundle - one) / extras;
    const discount = 1 - (perExtra / one);
    if (discount < 0.5) return null;
    return { kind: 'set_quantity', quantity: qty, why: 'the extra item is ' + Math.round(discount * 100) + ' percent off, so the offer quantity is the better buy' };
  },

  // Rule 37 - complete a pair. Reads the rule's own words for what "complete"
  // means here rather than assuming it.
  '37': function (line, rule) {
    if (!line.may_set_quantity) return null;
    if (!/pair/i.test(rule.text)) return null;
    const q = Number(line.planned_qty);
    if (!Number.isInteger(q) || q < 1) return null;
    if (q % 2 === 0) return null;   // already a whole number of pairs
    return { kind: 'set_quantity', quantity: q + 1, why: 'rounded up from ' + q + ' to complete a pair' };
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
  assert.deepEqual(inert, [31, 32, 36, 37, 38],
    'the inert set is not the five judgement/advisory rules - check it against actionableRules()');

  // and the deterministic ones are NOT swept up with them
  [12, 23, 40].forEach(function (id) {
    assert.ok(inert.indexOf(id) === -1, 'rule ' + id + ' is deterministic and must stay out of the rulebook path');
  });
});

test('AC1: the assembled prose carries the household words, verbatim, with rule ids', () => {
  const result = plan([{ item_name: 'ariel pods', requested_qty: 1, category: 'laundry' }], PRICED_PODS);
  const grounding = rulebook.buildRulebookGrounding(result, RULES, HOUSEHOLD);
  assert.ok(grounding, 'no grounding was built for a basket the rulebook speaks about');
  const prompt = rulebook.buildRulebookPrompt(grounding);

  assert.match(prompt, /\[rule 31\]/, 'rule 31 is not identified in the prose');
  assert.ok(prompt.indexOf('Ariel Pods: pick the BEST VALUE by price per wash.') !== -1,
    "rule 31's own words are not in the prose - a paraphrase is not the household's rule");
  assert.ok(prompt.indexOf('If a multibuy gives 50 percent or more off the EXTRA item(s), buy up to the offer quantity.') !== -1,
    "rule 36's own words are not in the prose");
  assert.match(prompt, /ariel pods/, 'the line the rule speaks about is not in the prose');
  assert.match(prompt, /Ariel All-in-1 Pods Original 76 Washes/, 'the candidates were not offered to the consumer');
  assert.match(prompt, /set_product \| ask|set_product/, 'the prose does not tell the consumer what it may do');
});

test('AC1: nothing is consulted, and nothing changes, when no inert rule speaks about the basket', async () => {
  // A corpus with NO judgement layer at all - the world before rule 31 was
  // written. No prose to carry, so no call and no cost.
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
  // The other direction of the same boundary, and the reason rule 36 exists:
  // an offer rule belongs to whatever line turns out to carry an offer, so a
  // line no targeted rule names is still shown while something may be done to
  // it. Costed deliberately - see the selection comment in rulebook.js.
  const result = plan([{ item_name: 'bread', requested_qty: 1 }], []);
  const grounding = rulebook.buildRulebookGrounding(result, RULES, HOUSEHOLD);
  assert.ok(grounding, 'a basket-wide judgement rule reached no line at all');
  assert.deepEqual(grounding.rules.map(function (r) { return r.id; }).sort(), [36, 38]);
  assert.deepEqual(grounding.lines[0].rule_ids, [36, 38]);
});

// =====================================================================
// AC2 - relevance, and the direction it fails in
// =====================================================================

test('AC2: a rule about another item is not sent, and the omission is COUNTED not hidden', async () => {
  const result = plan([{ item_name: 'ariel pods', requested_qty: 1, category: 'laundry' }], PRICED_PODS);
  const grounding = rulebook.buildRulebookGrounding(result, RULES, HOUSEHOLD);
  const sent = grounding.rules.map(function (r) { return r.id; }).sort(function (a, b) { return a - b; });

  assert.deepEqual(sent, [31, 36, 38], 'the wrong rule set was sent for an Ariel-only basket');
  assert.ok(sent.indexOf(37) === -1, 'a Sure rule was sent for a basket with no Sure line');
  assert.equal(grounding.omitted_rule_count, 2,
    'the rules that spoke about nothing here (32, 37) are not counted - an omission must be visible');
});

test('AC2: relevance is OVER-INCLUSIVE - an advisory-grade similarity still carries the rule', () => {
  // "76 ariel pods box" is not the rule 31 term. The planner would need a
  // CONFIDENT grade before letting a rule buy anything; selection deliberately
  // accepts a weaker match, because the cost of a false positive is a sentence
  // the consumer ignores and the cost of a false negative is the rule dying.
  const result = plan([{ item_name: 'ariel pods box', requested_qty: 1, category: 'laundry' }], PRICED_PODS);
  const grounding = rulebook.buildRulebookGrounding(result, RULES, HOUSEHOLD);
  assert.ok(grounding.rules.some(function (r) { return r.id === 31; }),
    'rule 31 was not selected for a line that names its subject in different words');
});

test('AC2: a basket-scope rule reaches only the lines something may be done to', () => {
  const result = plan([
    { item_name: 'banana yazoo', requested_qty: 1 },              // excluded by rule 40
    { item_name: 'shower gel', requested_qty: 1 }                 // an ordinary add line
  ], [SHOWER_GEL]);
  const grounding = rulebook.buildRulebookGrounding(result, RULES, HOUSEHOLD);
  const shown = grounding.lines.map(function (l) { return l.item_name; });
  assert.deepEqual(shown, ['shower gel'],
    'an excluded line was sent to the consumer under a basket-wide rule');
});

// =====================================================================
// AC3 - a judgement rule changes a line the deterministic path gets wrong
// =====================================================================

test('AC3 rule 31: the deterministic path asks which Ariel; the rulebook picks the best value per wash', async () => {
  const listItems = [{ item_name: 'ariel pods', requested_qty: 1, category: 'laundry' }];
  const before = plan(listItems, PRICED_PODS);

  // THE DETERMINISTIC ANSWER, AND IT IS THE ONE WARWICK COMPLAINED ABOUT.
  assert.equal(before.items[0].status, 'needs_decision');
  assert.equal(before.items[0].matched_product, null);
  assert.equal(before.summary.needs_decision, 1);

  const out = await rulebook.applyRulebook({ plan: before, rules: RULES, household: HOUSEHOLD, consult: terraFake() });
  const line = out.plan.items[0];

  assert.equal(line.status, 'add', 'the line is still a question after the rulebook ran');
  assert.equal(line.matched_product, 'Ariel All-in-1 Pods Original 76 Washes',
    'the best value per wash (GBP 0.211) was not chosen - 12 washes is GBP 0.375, 35 is GBP 0.257');
  assert.equal(line.planned_qty, 1);
  assert.equal(out.plan.summary.needs_decision, 0);
  assert.equal(out.plan.summary.planned_add, 1);
  assert.ok(line.flags.indexOf('chosen by household rule') !== -1);
});

test('AC3 rule 37: a pair-rounding rule that has never fired changes the quantity', async () => {
  const listItems = [{ item_name: 'sure male', requested_qty: 3 }];
  const before = plan(listItems, [SURE_PRODUCT]);

  assert.equal(before.items[0].status, 'add');
  assert.equal(before.items[0].planned_qty, 3, 'the deterministic plan should buy exactly what was asked for');

  const out = await rulebook.applyRulebook({ plan: before, rules: RULES, household: HOUSEHOLD, consult: terraFake() });
  const line = out.plan.items[0];

  assert.equal(line.planned_qty, 4, 'rule 37 did not round the quantity up to complete a pair');
  assert.equal(line.matched_product, 'Sure Men Anti-Perspirant (blue variant)',
    'the deterministic map rule 23 must still decide WHICH product');
  assert.ok(line.flags.indexOf('quantity set by household rule') !== -1);
});

test('AC3 rule 36: a multibuy rule that has never fired buys up to the offer quantity', async () => {
  const listItems = [{
    item_name: 'shower gel', requested_qty: 1,
    note: 'shelf: any 2 for GBP 5.00, single GBP 4.00'
  }];
  const before = plan(listItems, [SHOWER_GEL]);

  assert.equal(before.items[0].status, 'add');
  assert.equal(before.items[0].planned_qty, 1, 'the deterministic plan buys one and ignores the offer');

  const out = await rulebook.applyRulebook({ plan: before, rules: RULES, household: HOUSEHOLD, consult: terraFake() });
  const line = out.plan.items[0];

  assert.equal(line.planned_qty, 2, 'rule 36 did not buy up to the offer quantity');
  assert.ok(/rule 36/.test(line.note), 'the change does not say which rule caused it');
});

test('AC3: the same reply arriving as raw model TEXT behaves identically', async () => {
  const before = plan([{ item_name: 'ariel pods', requested_qty: 1, category: 'laundry' }], PRICED_PODS);
  const out = await rulebook.applyRulebook({
    plan: before, rules: RULES, household: HOUSEHOLD, consult: terraFake({ raw: true })
  });
  assert.equal(out.plan.items[0].matched_product, 'Ariel All-in-1 Pods Original 76 Washes');
});

// =====================================================================
// AC4 - attribution
// =====================================================================

test('AC4: every applied change names its rule id, on the line and in the audit', async () => {
  const before = plan([
    { item_name: 'ariel pods', requested_qty: 1, category: 'laundry' },
    { item_name: 'sure male', requested_qty: 3 }
  ], PRICED_PODS.concat([SURE_PRODUCT]));

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
  const before = plan([{ item_name: 'ariel pods', requested_qty: 1, category: 'laundry' }], PRICED_PODS);
  const out = await rulebook.applyRulebook({
    plan: before, rules: RULES, household: HOUSEHOLD,
    consult: terraFake({
      judgements: function () {
        return [{ line_no: 1, rule_id: 999, kind: 'set_product', product: 'Ariel All-in-1 Pods Original 76 Washes', why: 'invented' }];
      }
    })
  });
  assert.equal(out.plan.items[0].matched_product, null, 'an unattributable change was applied');
  assert.equal(out.plan.items[0].status, 'needs_decision');
  assert.ok(out.plan.items[0].flags.indexOf('rulebook answer rejected') !== -1);
  assert.equal(out.audit.rejected.length, 1);
  assert.match(out.audit.rejected[0].reason, /not among the rules sent/);
});

// =====================================================================
// AC5 - uncertainty is SPOKEN
// =====================================================================

test('AC5: with no price data rule 31 asks - it does not fall back on the deterministic answer', async () => {
  // This is the LIVE shape: neither `products` nor `regulars` carries a price.
  const before = plan([{ item_name: 'ariel pods', requested_qty: 1, category: 'laundry' }], UNPRICED_PODS);
  const out = await rulebook.applyRulebook({ plan: before, rules: RULES, household: HOUSEHOLD, consult: terraFake() });
  const line = out.plan.items[0];

  assert.equal(line.status, 'needs_decision', 'an unanswerable rule silently resolved the line');
  assert.equal(line.matched_product, null, 'a product was guessed without the data the rule needs');
  assert.ok(line.flags.indexOf('rulebook question') !== -1, 'the question is not marked as coming from the rulebook');
  assert.ok(line.note.indexOf('rule 31') !== -1, 'the question does not say which rule could not be applied');
  assert.ok(line.note.indexOf('Ariel Pods: pick the BEST VALUE by price per wash.') !== -1,
    "the question does not carry the household's own words - which is the whole defect");
  assert.ok(/price per wash/i.test(line.note), 'the consumer\'s reason for asking was dropped');
});

test('AC5: an absent price is SAID, never rendered as GBP 0.00', () => {
  // A free pack wins every price-per-wash comparison there is. Number(null) is
  // 0, so this is one coercion away from being the most expensive bug here.
  const result = plan([{ item_name: 'ariel pods', requested_qty: 1, category: 'laundry' }], UNPRICED_PODS);
  const prompt = rulebook.buildRulebookPrompt(rulebook.buildRulebookGrounding(result, RULES, HOUSEHOLD));
  assert.ok(prompt.indexOf('(price unknown)') !== -1, 'an unpriced candidate does not say so');
  assert.doesNotMatch(prompt, /GBP 0\.00/, 'an absent price was rendered as a free product');
});

test('AC5: an ADD line the consumer is unsure about becomes a question, never a silent add', async () => {
  const before = plan([{ item_name: 'sure male', requested_qty: 3 }], [SURE_PRODUCT]);
  assert.equal(before.items[0].status, 'add');

  const out = await rulebook.applyRulebook({
    plan: before, rules: RULES, household: HOUSEHOLD,
    consult: terraFake({
      judgements: function (g) {
        return [{ line_no: g.lines[0].line_no, rule_id: 37, kind: 'ask', why: 'rules 32 and 37 point different ways on this line' }];
      }
    })
  });
  const line = out.plan.items[0];
  assert.equal(line.status, 'needs_decision', 'an unresolved judgement left the line silently in the basket');
  assert.equal(line.planned_qty, 0, 'a held line is still being bought');
  assert.ok(/rules 32 and 37 point different ways/.test(line.note), 'the contradiction was not spoken');
  assert.equal(out.plan.summary.needs_decision, 1);
});

test('AC5: an unknown verb from the consumer is treated as ask, not ignored', async () => {
  const before = plan([{ item_name: 'sure male', requested_qty: 3 }], [SURE_PRODUCT]);
  const out = await rulebook.applyRulebook({
    plan: before, rules: RULES, household: HOUSEHOLD,
    consult: terraFake({ judgements: function () { return [{ line_no: 1, rule_id: 37, kind: 'buy_two_free_one', why: 'made up' }]; } })
  });
  assert.equal(out.plan.items[0].status, 'needs_decision');
  assert.match(out.audit.rejected[0].reason, /unknown judgement kind/);
});

test('AC5: a product nobody offered becomes a question, never a purchase', async () => {
  const before = plan([{ item_name: 'ariel pods', requested_qty: 1, category: 'laundry' }], PRICED_PODS);
  const out = await rulebook.applyRulebook({
    plan: before, rules: RULES, household: HOUSEHOLD,
    consult: terraFake({
      judgements: function () {
        return [{ line_no: 1, rule_id: 31, kind: 'set_product', product: 'Ariel Pods 200 Washes Mega Box', why: 'best value' }];
      }
    })
  });
  assert.equal(out.plan.items[0].matched_product, null, 'a product that was never offered reached the basket');
  assert.equal(out.plan.items[0].status, 'needs_decision');
  assert.ok(/not among the choices offered/.test(out.plan.items[0].note));
});

test('AC5: an unreachable consumer is LOUD on every affected line and in the summary', async () => {
  const before = plan([{ item_name: 'ariel pods', requested_qty: 1, category: 'laundry' }], PRICED_PODS);
  const out = await rulebook.applyRulebook({
    plan: before, rules: RULES, household: HOUSEHOLD, consult: terraFake({ throws: 'gateway unreachable' })
  });
  assert.equal(out.plan.items[0].flags.indexOf('rulebook not consulted') !== -1, true,
    'a line whose rules never ran looks exactly like a line with no rules');
  assert.match(out.plan.summary.rulebook.error, /gateway unreachable/);
  assert.equal(out.audit.applied.length, 0);
});

test('AC5: an unreadable reply is not read as approval', async () => {
  const before = plan([{ item_name: 'ariel pods', requested_qty: 1, category: 'laundry' }], PRICED_PODS);
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
    { id: 401, list_term: 'azera', matched_product: 'Nescafe Azera Americano 100g', category: 'coffee', household_id: null, price: 5.00 }
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
    consult: terraFake({ judgements: function () { return [{ line_no: 1, rule_id: 36, kind: 'set_quantity', quantity: 2, why: 'offer' }]; } })
  });
  assert.equal(out.plan.items[0].status, 'excluded');
  assert.equal(out.plan.items[0].planned_qty, 0);
});

test('SAFETY: a quantity outside the bound is refused and asked about', async () => {
  const before = plan([{ item_name: 'sure male', requested_qty: 3 }], [SURE_PRODUCT]);
  const out = await rulebook.applyRulebook({
    plan: before, rules: RULES, household: HOUSEHOLD,
    consult: terraFake({ judgements: function () { return [{ line_no: 1, rule_id: 37, kind: 'set_quantity', quantity: 76, why: 'the pack says 76' }]; } })
  });
  assert.equal(out.plan.items[0].status, 'needs_decision');
  assert.equal(out.plan.items[0].planned_qty, 0);
  assert.match(out.audit.rejected[0].reason, /outside 1\.\.24/);
  assert.equal(rulebook.MAX_JUDGED_QTY, 24, 'the bound moved - re-read the comment that justifies it');
});

test('SAFETY: a stale basket estimate is dropped rather than reported wrong', async () => {
  const before = plan([{ item_name: 'sure male', requested_qty: 3, price: 4.00 }], [SURE_PRODUCT]);
  assert.equal(before.summary.estimated_total, 12, 'fixture drifted: the estimate is no longer computed');

  const out = await rulebook.applyRulebook({ plan: before, rules: RULES, household: HOUSEHOLD, consult: terraFake() });
  assert.equal(out.plan.items[0].planned_qty, 4);
  assert.equal(out.plan.summary.estimated_total, null, 'a basket estimate computed for 3 units was kept after buying 4');
  assert.equal(out.plan.summary.budget_flag, 'unknown');
  assert.equal(out.plan.summary.rulebook.estimate_invalidated, true);
});

test('SAFETY: the input plan is never mutated', async () => {
  const before = plan([{ item_name: 'ariel pods', requested_qty: 1, category: 'laundry' }], PRICED_PODS);
  const snapshot = JSON.stringify(before);
  await rulebook.applyRulebook({ plan: before, rules: RULES, household: HOUSEHOLD, consult: terraFake() });
  assert.equal(JSON.stringify(before), snapshot, 'applyRulebook mutated the plan it was given');
});

test('SAFETY: another household\'s rules are never consulted', () => {
  const foreign = RULES.map(function (r) { return Object.assign({}, r, { household_id: 99 }); });
  const result = plan([{ item_name: 'ariel pods', requested_qty: 1, category: 'laundry' }], PRICED_PODS);
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
  const src = fs.readFileSync(path.join(__dirname, 'rulebook.js'), 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .split('\n').map(function (l) { return l.replace(/(^|[^:])\/\/.*$/, '$1'); }).join('\n');

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
  assert.equal(itemNamed(out.plan, 'sure male').planned_qty, 2, 'an even quantity was changed by a pair rule');
  assert.equal(itemNamed(out.plan, 'banana yazoo').status, 'excluded');
});
