// =====================================================================
// BUILD-015 AsdAIr - handoff/method.test.js
//
// THE METHOD IS PINNED HERE, AGAINST LITERALS HELD IN THIS FILE.
//
// Why this file exists. Until 2026-08-09 `BROWSER_METHOD` carried THREE of the
// behaviours proven by real successful shops and omitted the rest, including
// the two the household had already paid for in a live basket. Nothing failed
// when they went missing, because nothing checked. A method that lives only in
// a data module with no test is one careless edit from being three lines again.
//
// THE RULE FOR EVERY ASSERTION BELOW: the expected value is written out HERE,
// in the test. Nothing is imported from instructions.js and compared against
// itself - that would prove only that the module agrees with itself, which is
// not a proof of anything.
//
// SOURCE OF TRUTH for the behaviour list: the PRESERVATION CONTRACT, section E
// of Deliverables/2026-08-09-pax-browser-method-recovery-audit.md, whose own
// rule is that every line in it is PROVEN BY A REAL RUN.
//
// FULLY OFFLINE. No database, no network, no model, no credentials.
// =====================================================================
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const {
  INSTRUCTIONS_VERSION, BROWSER_METHOD, ENVIRONMENT_CONSTRAINTS,
  PROHIBITED_ACTIONS, RETRIEVAL_CONTRACT, COMPLETION_CONTRACT,
} = require('./instructions');
const { buildHandoff } = require('./buildHandoff');
const { renderChecklist } = require('./renderChecklist');
const { basePacket } = require('./test/fixtures');

// ---------------------------------------------------------------------
// THE BEHAVIOUR LIST - a literal, in execution order.
//
// The audit's section E numbers are named against each one so a reviewer can
// walk from the evidence to this list without trusting either document.
// ---------------------------------------------------------------------
const REQUIRED_METHOD_IDS = [
  'audit_trolley_first',              // E2  - 10 products / 19 items left untouched
  'set_brand_az_ordering',            // ruled (class B), not measured - retained deliberately
  'consume_plan_in_order',            // E1  - never reinterpret the list at the shelf
  'regulars_favourites_first',        // E3  - category/shelf hunting stopped mid-run
  'known_item_retrieval',             // Warwick's Product Ruling 2, 2026-08-09
  'new_item_search_exact_wording',    // preserved from v1 - Warwick's approved wording
  'favourite_and_capture_new_product',// preserved from v1 - the only lever on next week's grid
  'one_session_one_page_context',     // E4  - 15 items off ONE page vs a page per product
  'read_structure_not_pixels',        // E5  - screenshots are blank on the heavy grid
  'reacquire_refs_after_mutation',    // E6  - explicitly, after every mutation
  'batch_adds_and_split_on_failure',  // E7  - a failed batch means OUT OF STOCK
  'verify_each_add_from_trolley',     // E8  - after every pair, after every add
  'unavailable_item_handling',        // E9  - confirm, leave out, offer alternatives
  'quantity_by_stepper_not_typing',   // E11 - typed quantities do not persist
  'reconcile_from_quantity_field',    // E10 - never infer quantity from price
  'batch_questions_into_one_ask',     // E12 - one consolidated question batch
  'stop_at_checkout_ready_basket',    // E13 - every run, no exception
  'record_run_and_mark_reuse',        // E14 - and mark answers for reuse
];

const REQUIRED_PROHIBITION_IDS = [
  'no_checkout', 'no_payment', 'no_delivery_slot', 'no_password_entry', 'no_automatic_substitution',
];

const textOf = (id) => {
  const found = BROWSER_METHOD.find((b) => b.id === id);
  assert.ok(found, `BROWSER_METHOD has no behaviour with id "${id}"`);
  return found.text.toLowerCase();
};

// ---------------------------------------------------------------------
// THE LIST ITSELF
// ---------------------------------------------------------------------

test('METHOD: every proven behaviour is present, in order, and none has been dropped', () => {
  assert.deepEqual(
    BROWSER_METHOD.map((b) => b.id),
    REQUIRED_METHOD_IDS,
    'BROWSER_METHOD no longer matches the proven behaviour set. If a behaviour was deliberately removed, '
    + 'the evidence for removing it belongs in the audit first - not in a quiet edit to the data module.',
  );
});

test('METHOD: v1 carried three of these. The version must have moved', () => {
  assert.ok(INSTRUCTIONS_VERSION >= 2,
    'the method changed materially, so INSTRUCTIONS_VERSION must move - it is what ties a completion report to the wording that was in force');
});

test('METHOD: every behaviour has a stable id and non-empty text, and no duplicates', () => {
  const ids = BROWSER_METHOD.map((b) => b.id);
  assert.equal(new Set(ids).size, ids.length, 'duplicate behaviour id');
  for (const b of BROWSER_METHOD) {
    assert.match(b.id, /^[a-z0-9_]+$/, `id "${b.id}" must be a stable machine-readable slug`);
    assert.ok(b.text && b.text.trim().length > 20, `behaviour "${b.id}" has no usable text`);
  }
});

// ---------------------------------------------------------------------
// THE TWO MOST EXPENSIVE LESSONS
//
// Both were absent from v1. Both were learned in a real basket, and both are
// silent failures: the page shows you the value you typed, and the price looks
// plausible. Neither is checkable by looking at the screen, which is exactly
// why they must be carried as instructions.
// ---------------------------------------------------------------------

test('LESSON: typed quantities do not persist - the stepper is the instruction', () => {
  const t = textOf('quantity_by_stepper_not_typing');
  assert.ok(t.includes('stepper'), 'the stepper must be named as the mechanism');
  assert.ok(/not persist|does not persist/.test(t), 'the reason - the value does not persist - must be stated, not just the rule');
  assert.ok(t.includes('type') || t.includes('typed'), 'typing must be named as the thing that fails');
});

test('LESSON: reconcile from the quantity FIELD, never from the displayed price', () => {
  const t = textOf('reconcile_from_quantity_field');
  assert.ok(t.includes('quantity field') || t.includes('quantity'), 'the actual quantity field must be named');
  assert.ok(t.includes('price'), 'the price must be named as the thing NOT to infer from');
  assert.ok(t.includes('never'), 'this is an absolute, and must read as one');
});

// ---------------------------------------------------------------------
// THE COMPLICATION THAT MUST NOT BE SMOOTHED AWAY
// ---------------------------------------------------------------------

test('BULK ADD is carried as CONDITIONALLY reliable, with both real data points', () => {
  const t = textOf('batch_adds_and_split_on_failure');
  assert.ok(t.includes('25'), 'the 25-item bulk tick that SUCCEEDED must be carried');
  assert.ok(t.includes('14'), 'the 14-item bulk add that FAILED TWICE must be carried - a blanket promise would be a lie');
});

test('BULK ADD: a failed batch is diagnosed as OUT OF STOCK, never as "the batch was too big"', () => {
  // This is the one place a plausible-sounding instruction would encode the
  // WRONG lesson. The evidence is unambiguous: the 14-item batch failed, pairs
  // succeeded, and the stubborn item failed ALONE because it was unavailable.
  // Splitting is how you ISOLATE the offender, not how you shrink the batch.
  const t = textOf('batch_adds_and_split_on_failure');
  assert.ok(t.includes('out-of-stock') || t.includes('out of stock'),
    'a batch failure must be diagnosed as an out-of-stock signal');
  assert.ok(t.includes('isolate') || t.includes('drop'),
    'the split must be described as isolating and dropping the offending item');
  assert.ok(/do not conclude the batch was too big|not.*too big/.test(t),
    'the wrong diagnosis must be explicitly ruled out, or someone will reach for it again');
});

// ---------------------------------------------------------------------
// THE BOUNDARY THAT MAY NEVER WEAKEN
// ---------------------------------------------------------------------

test('BOUNDARY: never checkout, never pay, never enter a credential', () => {
  assert.deepEqual(PROHIBITED_ACTIONS.map((p) => p.id), REQUIRED_PROHIBITION_IDS,
    'a prohibition has been removed or reordered. These are Warwick\'s gates and no change of runtime touches them.');

  const t = textOf('stop_at_checkout_ready_basket');
  assert.ok(t.includes('never'), 'the method itself must carry the boundary, not only the prohibition list');
  assert.ok(t.includes('check out') || t.includes('checkout'));
  assert.ok(t.includes('pay'));
  assert.ok(t.includes('credential') || t.includes('password'));
});

test('BOUNDARY: substitution has no vocabulary anywhere in the method', () => {
  // The absence is the control. If a behaviour ever tells the worker it may
  // choose a replacement, this fails.
  for (const b of BROWSER_METHOD) {
    assert.ok(!/\bsubstitute (it|one|something)\b/.test(b.text.toLowerCase()),
      `behaviour "${b.id}" appears to permit a substitution`);
  }
  const never = PROHIBITED_ACTIONS.find((p) => p.id === 'no_automatic_substitution');
  assert.ok(/do not/i.test(never.text));
});

// ---------------------------------------------------------------------
// WARWICK'S PRODUCT RULING 2
// ---------------------------------------------------------------------

test('RULING 2: all four clauses reach the worker, by id', () => {
  assert.deepEqual(
    RETRIEVAL_CONTRACT.map((c) => c.id),
    ['retrieval_permitted', 'identity_unchanged', 'verify_before_add', 'ambiguity_stops_line'],
  );
});

test('RULING 2: the method says searching does NOT make a known item new', () => {
  const t = textOf('known_item_retrieval');
  assert.ok(t.includes('does not make the item "new"') || t.includes('not make the item'),
    'the identity/retrieval separation is the whole ruling and must be stated in the method itself');
  assert.ok(t.includes('stop') && t.includes('ask'),
    'the stop-and-ask duty must be in the method, not only in the per-line contract');
});

test('RULING 2: the retired instruction is GONE - no behaviour still forbids searching a known item', () => {
  // v1 step 5 read: "NEVER free-search a known item. If a known item cannot be
  // found in its named view, stop that line and report it as not_found - do not
  // search for it." Leaving that in place would have the method contradict the
  // data contract on the same page.
  for (const b of BROWSER_METHOD) {
    const t = b.text.toLowerCase();
    assert.ok(!/never free-search a known item/.test(t),
      `behaviour "${b.id}" still carries the instruction Warwick retired`);
  }
});

test('STOP-AND-ASK: the duty is stated, and ambiguity is not filed as not_found', () => {
  // No LINE_REPORT_STATUSES member was added for this (the label map that
  // renders statuses lives outside this Work Order's file surface), so the duty
  // is carried in words - which means the words have to be checked.
  const joined = COMPLETION_CONTRACT.join(' ').toLowerCase();
  assert.ok(joined.includes('not_found'), 'the contract must name the status it is telling the worker NOT to use');
  assert.ok(joined.includes('question') || joined.includes('ask'),
    'the worker must be told to raise it as a question for Warwick');
});

// ---------------------------------------------------------------------
// THE ENVIRONMENTAL CONSTRAINT - kept separate from the behaviours
// ---------------------------------------------------------------------

test('CONSTRAINT: Regulars cannot be curated, and Favourites is the lever', () => {
  const ids = ENVIRONMENT_CONSTRAINTS.map((c) => c.id);
  assert.deepEqual(ids, ['regulars_not_curatable']);

  const t = ENVIRONMENT_CONSTRAINTS[0].text.toLowerCase();
  assert.ok(t.includes('favourites'), 'the lever must be named, or the constraint is just bad news');

  // It must NOT be smuggled into the proven-behaviour list: the audit records it
  // as a constraint precisely because no run proves an ACTION here.
  assert.ok(!REQUIRED_METHOD_IDS.includes('regulars_not_curatable'));
});

// ---------------------------------------------------------------------
// AC3 - THE WORKER ACTUALLY RECEIVES IT
//
// The artefact carrying the method is worth nothing if the page handed to the
// worker prints three numbered steps. renderChecklist is what the worker reads.
// ---------------------------------------------------------------------

test('DELIVERY: every behaviour reaches the rendered checklist', () => {
  const md = renderChecklist(buildHandoff(basePacket()));
  for (const b of BROWSER_METHOD) {
    assert.ok(md.includes(b.text),
      `behaviour "${b.id}" is in the artefact but never reaches the page the worker actually reads`);
  }
});

test('DELIVERY: prohibitions and the environmental constraint reach the page too', () => {
  const md = renderChecklist(buildHandoff(basePacket()));
  for (const p of PROHIBITED_ACTIONS) assert.ok(md.includes(p.text), `prohibition "${p.id}" never reaches the page`);
  for (const c of ENVIRONMENT_CONSTRAINTS) assert.ok(md.includes(c.text), `constraint "${c.id}" never reaches the page`);
});

test('DELIVERY: the retrieval contract reaches the page WHEN a line needs it', () => {
  const p = basePacket();
  p.lines[0].asda_product_ref = null;
  const md = renderChecklist(buildHandoff(p));

  for (const c of RETRIEVAL_CONTRACT) {
    assert.ok(md.includes(c.text), `retrieval clause "${c.id}" never reaches the page`);
  }
  assert.ok(md.includes('must match: Acme Oat Crunch'),
    'the identity to verify against must be printed on the line itself');
  assert.ok(!md.includes('ref null'), 'a known line with no reference must never render as "ref null"');
});

test('DELIVERY: the retrieval block stays OFF the page when no line needs it', () => {
  const md = renderChecklist(buildHandoff(basePacket()));
  assert.ok(!md.includes('Items with no ASDA reference'),
    'a rule with no line it applies to is noise on a phone being read while shopping');
});
