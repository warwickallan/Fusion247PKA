// BUILD-015 AsdAIr Stage 1 - the CATALOGUE-GROUNDING INVARIANT regression suite.
//
// WHY THIS FILE IS LOAD-BEARING
//
// On 2026-07-28 an open-ended vision test concluded "the model is unfit for this
// handwriting". That conclusion was WRONG, and provably so: the test had asked a
// model to read arbitrary handwriting and invent a product name, which is not
// what AsdAIr does. Re-run with the household's real catalogue as grounding, the
// SAME model on the SAME image produced:
//
//   open-ended                 catalogue-grounded
//   "gourmet coffee"       ->  "3 gourmet cat food"
//   "camomile cheese"      ->  "1 Dreamies cheese large"
//   "beefs protein"        ->  "1 Weetabix protein"
//   "waffles sausage rolls"->  "4 Walls sausage rolls"
//   "ARLA 1 litre"         ->  "3 semi skimmed Arla 4pts"
//   invented a line        ->  invented nothing
//
// CATALOGUE GROUNDING IS THEREFORE A MANDATORY INVARIANT, not an optional model
// improvement. These tests exist so nobody can quietly regress to open-ended
// transcription and rediscover the same defect months later.
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const { resolveReading, resolveAll, stripLeadingQuantity } = require('./resolveByCatalogue');
const { buildGroundedPrompt } = require('./groundedPrompt');

// A faithful slice of the REAL household catalogue: the ids and aliases are the
// live ones, so this suite proves identity against the actual Supabase rows.
const REGULARS = [
  { id: 1,   name: 'Gourmet GOURMET Mon Petit Intense Cod, Sardine, Salmon Wet Cat Food 6x50g', brand: 'Gourmet',    aka: ['gourmet cat food', 'gourmet'] },
  { id: 2,   name: 'ASDA British Milk Semi Skimmed 6 Pints',                                    brand: 'ASDA',       aka: ['6pt milk', '6pts milk', 'franks 6 pint'] },
  { id: 4,   name: 'Cravendale Arla  Filtered Fresh Semi Skimmed Milk 2L Fresher for Longer',   brand: 'Cravendale', aka: ['arla 4pt milk', 'arla 4pt', 'arla semi', 'milk'] },
  { id: 7,   name: 'ASDA Crispy Skin-On Fries 750g',                                            brand: 'ASDA',       aka: ['chips'] },
  { id: 12,  name: 'Dreamies DREAMIES Cat Treat Biscuits With Cheese Flavour 200g',             brand: 'Dreamies',   aka: ['dreamies cheese', 'dreamies'] },
  { id: 26,  name: 'Weetabix Protein 24 pack cereal',                                           brand: 'Weetabix',   aka: ['weetabix protein'] },
  { id: 102, name: "Wall's 4 Pork Sausage Rolls 220g",                                          brand: "Wall's",     aka: ['walls sausage rolls', 'sausage rolls'] },
  { id: 104, name: 'Mars Caramel Multipack Chocolate Bars 8 x 34.5g',                           brand: 'Mars',       aka: ['mars bars', 'small mars bars'] },
  { id: 23,  name: 'Rustlers All Day Breakfast Sausage Muffin 155g',                            brand: 'Rustlers',   aka: ['sausage baps'] },
  { id: 106, name: 'COOK by ASDA Cook Ground Black Pepper 25g',                                 brand: 'COOK by ASDA', aka: ['black pepper', 'pepper'] },
];

// ── 1. The invariant: identity comes from the catalogue ──────────────────────

test('THE INVARIANT: each known reading maps to the correct live Supabase regular id', () => {
  // These raw_readings are the ACTUAL grounded output measured 2026-07-28, and
  // the ids are the ACTUAL live rows. This is the identity proof.
  const cases = [
    ['3 gourmet cat food',       1,   'Gourmet cat food - the line that open-ended read as "gourmet coffee"'],
    ['1 Dreamies cheese large',  12,  'open-ended read this as "camomile cheese"'],
    ['1 Weetabix protein',       26,  'open-ended read this as "beefs protein"'],
    ['4 Walls sausage rolls',    102, 'open-ended read this as "waffles sausage rolls"'],
    ['1 chips',                  7,   'resolves only because the alias was learned from a real shop'],
    ['3 sausage baps',           23,  "Mum's shorthand for the Rustlers muffin"],
    ['1 pk small Mars bars',     104, 'open-ended read this as "pork pie large"'],
    ['black pepper',             106, 'a genuinely new item added from the last shop'],
  ];
  for (const [reading, expectedId, why] of cases) {
    const r = resolveReading(reading, REGULARS);
    assert.equal(r.matched_regular_id, expectedId, `${reading} -> ${expectedId} (${why})`);
    assert.equal(r.status, 'matched');
    // The canonical name must come from OUR row, never from the reading.
    assert.equal(r.matched_product_name, REGULARS.find((x) => x.id === expectedId).name);
  }
});

test('the canonical product name is never the model text - it is looked up by id', () => {
  const r = resolveReading('3 gourmet cat food', REGULARS);
  assert.match(r.matched_product_name, /Mon Petit/);          // our row
  assert.doesNotMatch(r.matched_product_name, /^3 gourmet/);  // not the reading
});

// ── 2. Refusing to guess ────────────────────────────────────────────────────

test('an unsupported line returns unmatched_new_item rather than the least-bad item', () => {
  const r = resolveReading('1 stardrops 3 in 1 disinfectant', REGULARS);
  assert.equal(r.status, 'unmatched_new_item');
  assert.equal(r.matched_regular_id, null);
});

test('two equally plausible candidates become needs_confirmation, never a coin toss', () => {
  const ambiguous = [
    { id: 300, name: 'Sure Nonstop Quantum Dry 250 ml',    brand: 'Sure', aka: [] },
    { id: 301, name: 'Sure Nonstop Sport Cool 250 ml',     brand: 'Sure', aka: [] },
  ];
  const r = resolveReading('sure nonstop 250 ml', ambiguous);
  assert.equal(r.status, 'needs_confirmation');
  assert.equal(r.matched_regular_id, null);
  assert.equal(r.alternatives.length, 2, 'both candidates must be offered to the human');
});

test('an empty or unreadable line is unreadable, not matched to something', () => {
  assert.equal(resolveReading('   ', REGULARS).status, 'unreadable');
});

// ── 3. Quantities and duplicates ────────────────────────────────────────────

test('a leading quantity never pollutes the match term', () => {
  assert.equal(stripLeadingQuantity('3 gourmet cat food'), 'gourmet cat food');
  assert.equal(stripLeadingQuantity('1 4pk orange lucozade'), '4pk orange lucozade');
  // "1 pk small mars bars" -> the "1 pk" pack-count prefix goes too, which is
  // what lets the alias "small mars bars" match. Verified against the live row.
  assert.equal(stripLeadingQuantity('1 pk small mars bars'), 'small mars bars');
});

test('the same regular appearing twice is flagged possible_duplicate, not ordered twice', () => {
  const out = resolveAll(
    [{ raw_reading: '1 chips' }, { raw_reading: '1 chips' }],
    REGULARS,
  );
  assert.equal(out[0].status, 'matched');
  assert.equal(out[1].status, 'possible_duplicate');
});

// ── 4. The prompt must actually be grounded ─────────────────────────────────

const CATALOGUE = {
  candidates: REGULARS.map((r) => ({ id: r.id, name: r.name, brand: r.brand, aka: r.aka })),
  rules: [{ directive: 'exclude', match_term: 'banana yazoo', matched_product: null, text: 'never buy Banana Yazoo' }],
  last_order: { order_id: 1, lines: [{ item_name: 'Sure Quantum Dry', qty: 3 }] },
};

test('the prompt carries stable candidate IDs and the household aliases', () => {
  const p = buildGroundedPrompt(CATALOGUE);
  assert.ok(p.includes('1: Gourmet GOURMET Mon Petit'), 'candidate id + canonical name must be present');
  assert.ok(p.includes('gourmet cat food'), 'the household alias must be present');
  assert.ok(p.includes('102:'), 'a newly-learned regular must be offered as a candidate');
});

test('the prompt instructs SELECTION of an id, and forbids inventing a name', () => {
  const p = buildGroundedPrompt(CATALOGUE);
  // whitespace-tolerant: the instruction wraps across lines in the prompt
  assert.ok(/matched_regular_id\s+MUST\s+be\s+an\s+id\s+from\s+the\s+list\s+above,\s+or\s+null/.test(p));
  assert.ok(/Never write a product name into matched_regular_id/.test(p));
  assert.ok(/DO NOT pick the least-bad candidate/.test(p));
});

test('the prompt carries standing rules and the previous order as priors', () => {
  const p = buildGroundedPrompt(CATALOGUE);
  assert.ok(p.includes('never buy Banana Yazoo'), 'exclusions must reach the model');
  assert.ok(p.includes('Sure Quantum Dry'), 'the previous order is a required prior (rotation)');
});

test('the prompt forbids adding an invisible line and forbids dropping a low-confidence one', () => {
  const p = buildGroundedPrompt(CATALOGUE);
  assert.ok(/do not add a line that is not visibly there/i.test(p));
  assert.ok(/Do not drop a line because you are unsure/i.test(p));
});

// ── 5. Open-ended transcription must not be the primary path ────────────────

test('the interpretation entry point loads the catalogue BEFORE any model call', () => {
  const src = fs.readFileSync(path.join(__dirname, 'interpret-list.js'), 'utf8');
  const loadAt = src.indexOf('loadCatalogue(client');
  const visionAt = src.indexOf('await vision(');
  assert.ok(loadAt > 0, 'the catalogue must be loaded');
  assert.ok(visionAt > 0, 'a vision call must exist');
  assert.ok(loadAt < visionAt, 'THE INVARIANT: the catalogue is loaded before the model is asked anything');
});

test('the grounded prompt - not the open-ended transcriber - is what the entry point sends', () => {
  const src = fs.readFileSync(path.join(__dirname, 'interpret-list.js'), 'utf8');
  assert.ok(src.includes('buildGroundedPrompt'), 'must use the grounded prompt');
  assert.ok(!/transcribeList/.test(src), 'must NOT fall back to open-ended transcription as the primary path');
});
