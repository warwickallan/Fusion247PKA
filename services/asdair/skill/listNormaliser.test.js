// =====================================================================
// IDEA-012 AsdAIr - skill: listNormaliser.test.js
//
// Runs under: node --test
//
// SYNTHETIC FIXTURES ONLY. Every list block below is invented ("milk",
// "bread", "widget a"). There is ZERO real household data here - nothing
// from the seed, no real names, no real products. This file runs in CI on
// the PUBLIC repo.
//
// Exercises normaliseRawList across:
//   * every quantity form: "2x milk", "milk x2", "milk (2)", "2 milk",
//     "two milk"
//   * bullet + numbered prefixes ("- ", "* ", "1. ", "2. ", "3) ") as LIST
//     MARKERS: a whole numbered list parses as ordinary items at qty 1, while
//     a bare number with no "."/")" ("2 milk") IS a quantity of 2
//   * the leading word-number heuristic: single token -> quantity ("two milk");
//     multiple tokens -> review ("four cheese pizza"); digit forms exempt
//   * blank / whitespace-only lines (skipped, never reviewed)
//   * a trailing note via a parenthetical
//   * default qty = 1
//   * case + whitespace normalisation of item_name
//   * ambiguous lines landing in needs_review (conflicting qty, no item)
//   * STRICTER BAR (2026-07-20): malformed numeric-looking tokens -> review,
//     NEVER silent qty 1 -- signed ("+2 milk", "-2 milk"), decimal
//     ("1.5 milk", "2.5 milk"), unicode/fullwidth + Arabic-indic digits; and
//     marker-only lines ("-", "5.", "2)") surfaced to review, NEVER dropped.
//
// PURE ASCII source only. The unicode-digit fixtures are written with \u
// escapes ("\uFF12" fullwidth two, "\u0662" Arabic-indic two) so this source
// file itself stays ASCII while still exercising non-ASCII digit input.
// =====================================================================

'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { normaliseRawList, _internal } = require('./listNormaliser');

// ---------------------------------------------------------------------
// Fixtures table: synthetic raw block -> expected structured output.
// Each case asserts the FULL { items, needs_review } shape.
// ---------------------------------------------------------------------
const FIXTURES = [
  {
    name: 'quantity form: leading Nx ("2x milk")',
    raw: '2x milk',
    expected: {
      items: [{ item_name: 'milk', requested_qty: 2, note: '' }],
      needs_review: []
    }
  },
  {
    name: 'quantity form: trailing xN ("milk x2")',
    raw: 'milk x2',
    expected: {
      items: [{ item_name: 'milk', requested_qty: 2, note: '' }],
      needs_review: []
    }
  },
  {
    name: 'quantity form: parenthetical number ("milk (2)")',
    raw: 'milk (2)',
    expected: {
      items: [{ item_name: 'milk', requested_qty: 2, note: '' }],
      needs_review: []
    }
  },
  {
    name: 'quantity form: bare leading number ("2 milk")',
    raw: '2 milk',
    expected: {
      items: [{ item_name: 'milk', requested_qty: 2, note: '' }],
      needs_review: []
    }
  },
  {
    name: 'quantity form: leading word number ("two milk")',
    raw: 'two milk',
    expected: {
      items: [{ item_name: 'milk', requested_qty: 2, note: '' }],
      needs_review: []
    }
  },
  {
    name: 'quantity form: leading xN ("x3 eggs")',
    raw: 'x3 eggs',
    expected: {
      items: [{ item_name: 'eggs', requested_qty: 3, note: '' }],
      needs_review: []
    }
  },
  {
    name: 'default quantity is 1 when none given',
    raw: 'bread',
    expected: {
      items: [{ item_name: 'bread', requested_qty: 1, note: '' }],
      needs_review: []
    }
  },
  {
    name: 'bullet prefixes are stripped ("- ", "* ")',
    raw: '- bread\n* butter',
    expected: {
      items: [
        { item_name: 'bread', requested_qty: 1, note: '' },
        { item_name: 'butter', requested_qty: 1, note: '' }
      ],
      needs_review: []
    }
  },
  {
    name: 'numbered prefix is an ordinal, NOT a quantity ("1. jam")',
    raw: '1. jam',
    expected: {
      items: [{ item_name: 'jam', requested_qty: 1, note: '' }],
      needs_review: []
    }
  },
  {
    name: 'ordinal vs bare-number contrast in one block',
    raw: '1. milk\n2 milk',
    expected: {
      items: [
        { item_name: 'milk', requested_qty: 1, note: '' },   // "1." ordinal
        { item_name: 'milk', requested_qty: 2, note: '' }    // "2 " quantity
      ],
      needs_review: []
    }
  },
  {
    name: 'blank and whitespace-only lines are skipped (never reviewed)',
    raw: 'bread\n\n   \n\tbutter',
    expected: {
      items: [
        { item_name: 'bread', requested_qty: 1, note: '' },
        { item_name: 'butter', requested_qty: 1, note: '' }
      ],
      needs_review: []
    }
  },
  {
    name: 'trailing note via parenthetical, alongside a quantity',
    raw: '2x milk (organic)',
    expected: {
      items: [{ item_name: 'milk', requested_qty: 2, note: 'organic' }],
      needs_review: []
    }
  },
  {
    name: 'note only, quantity defaults to 1 ("eggs (free range)")',
    raw: 'eggs (free range)',
    expected: {
      items: [{ item_name: 'eggs', requested_qty: 1, note: 'free range' }],
      needs_review: []
    }
  },
  {
    name: 'case + whitespace normalisation of item_name',
    raw: '  Olive   OIL  ',
    expected: {
      items: [{ item_name: 'olive oil', requested_qty: 1, note: '' }],
      needs_review: []
    }
  },
  {
    name: 'ambiguous: conflicting quantities -> needs_review (not guessed)',
    raw: '2x milk x3',
    expected: {
      items: [],
      needs_review: [{ raw: '2x milk x3', reason: 'conflicting quantities: 3 vs 2' }]
    }
  },
  {
    name: 'ambiguous: quantity but no item text -> needs_review',
    raw: 'x2',
    expected: {
      items: [],
      needs_review: [{ raw: 'x2', reason: 'no item text' }]
    }
  },
  {
    name: 'ambiguous: bare number line, no item text -> needs_review',
    raw: '5',
    expected: {
      items: [],
      needs_review: [{ raw: '5', reason: 'no item text' }]
    }
  },
  {
    name: 'ambiguous: explicit non-positive quantity -> needs_review',
    raw: '0 milk',
    expected: {
      items: [],
      needs_review: [{ raw: '0 milk', reason: 'non-positive quantity: 0' }]
    }
  },
  // ---- FIX-FORWARD: adversarial classes both reviewers flagged as missing ----
  {
    name: 'trailing xN doubled -> conflict, not a welded name ("milk x2 x3")',
    raw: 'milk x2 x3',
    expected: {
      items: [],
      needs_review: [{ raw: 'milk x2 x3', reason: 'conflicting quantities: 3 vs 2' }]
    }
  },
  {
    name: 'trailing xN doubled with a note interleaved ("milk x2 (organic) x3")',
    raw: 'milk x2 (organic) x3',
    expected: {
      items: [],
      needs_review: [{ raw: 'milk x2 (organic) x3', reason: 'conflicting quantities: 3 vs 2' }]
    }
  },
  {
    name: 'upper-bound: quantity above the household cap -> needs_review ("1000 eggs")',
    raw: '1000 eggs',
    expected: {
      items: [],
      needs_review: [{ raw: '1000 eggs', reason: 'implausible quantity: 1000' }]
    }
  },
  {
    name: 'upper-bound: exactly the cap (999) is still a valid quantity',
    raw: '999 eggs',
    expected: {
      items: [{ item_name: 'eggs', requested_qty: 999, note: '' }],
      needs_review: []
    }
  },
  {
    name: 'upper-bound: overflow-scale quantity -> needs_review ("999999999999999999999 milk")',
    raw: '999999999999999999999 milk',
    expected: {
      items: [],
      needs_review: [{ raw: '999999999999999999999 milk', reason: 'implausible quantity: 1e+21' }]
    }
  },
  {
    name: 'word-number collision: "seven up" is a product, not 7x "up" -> needs_review',
    raw: 'seven up',
    expected: {
      items: [],
      needs_review: [{ raw: 'seven up', reason: 'ambiguous word-number vs item name: seven up' }]
    }
  },
  {
    name: 'word-number collision: "five spice" is a product, not 5x "spice" -> needs_review',
    raw: 'five spice',
    expected: {
      items: [],
      needs_review: [{ raw: 'five spice', reason: 'ambiguous word-number vs item name: five spice' }]
    }
  },
  {
    name: 'word-number collision is case/whitespace-insensitive ("Seven   Up")',
    raw: 'Seven   Up',
    expected: {
      items: [],
      needs_review: [{ raw: 'Seven   Up', reason: 'ambiguous word-number vs item name: seven up' }]
    }
  },
  {
    name: 'digit form "7 up" is a stronger quantity signal -> left as-is (item)',
    raw: '7 up',
    expected: {
      items: [{ item_name: 'up', requested_qty: 7, note: '' }],
      needs_review: []
    }
  },
  {
    name: 'collision guard does NOT regress legit word-number quantities ("two milk", "three eggs")',
    raw: 'two milk\nthree eggs',
    expected: {
      items: [
        { item_name: 'milk', requested_qty: 2, note: '' },
        { item_name: 'eggs', requested_qty: 3, note: '' }
      ],
      needs_review: []
    }
  },
  // ---- word-number heuristic: leading spelled number + MULTIPLE tokens ----
  // A spelled leading number followed by more than one token is ambiguous
  // between a quantity and a product name; it routes to review, NEVER a silent
  // truncated-name quantity ("four cheese pizza" must not become 4 x "cheese
  // pizza"). Single-token spelled forms ("two milk") and digit forms ("4 cheese
  // pizza") are unaffected.
  {
    name: 'word-number ambiguity: "four cheese pizza" (multi-token) -> review, never 4x "cheese pizza"',
    raw: 'four cheese pizza',
    expected: {
      items: [],
      needs_review: [{ raw: 'four cheese pizza', reason: 'ambiguous word-number vs item name: four cheese pizza' }]
    }
  },
  {
    name: 'word-number ambiguity: "six pack beer" (multi-token) -> review, never 6x "pack beer"',
    raw: 'six pack beer',
    expected: {
      items: [],
      needs_review: [{ raw: 'six pack beer', reason: 'ambiguous word-number vs item name: six pack beer' }]
    }
  },
  {
    name: 'word-number single-token stays a quantity ("twenty apples" -> 20)',
    raw: 'twenty apples',
    expected: {
      items: [{ item_name: 'apples', requested_qty: 20, note: '' }],
      needs_review: []
    }
  },
  {
    name: 'digit form is EXEMPT: "4 cheese pizza" stays 4 x "cheese pizza" (stronger signal)',
    raw: '4 cheese pizza',
    expected: {
      items: [{ item_name: 'cheese pizza', requested_qty: 4, note: '' }],
      needs_review: []
    }
  },
  // ---- STRICTER BAR (2026-07-20): malformed numeric-looking tokens ----
  // Every one of these previously silently became an item at qty 1 (or, for
  // marker-only lines, was silently dropped). Under the raised NEVER-GUESS /
  // NEVER-DROP bar they must all surface to needs_review.
  {
    name: 'malformed: signed leading token "+2 milk" -> review, never qty 1',
    raw: '+2 milk',
    expected: {
      items: [],
      needs_review: [{ raw: '+2 milk', reason: 'malformed quantity syntax: +2' }]
    }
  },
  {
    name: 'malformed: signed leading token "-2 milk" -> review, never qty 1',
    raw: '-2 milk',
    expected: {
      items: [],
      needs_review: [{ raw: '-2 milk', reason: 'malformed quantity syntax: -2' }]
    }
  },
  {
    name: 'malformed: signed TRAILING token "milk +2" -> review (symmetric)',
    raw: 'milk +2',
    expected: {
      items: [],
      needs_review: [{ raw: 'milk +2', reason: 'malformed quantity syntax: +2' }]
    }
  },
  {
    name: 'malformed: decimal leading token "1.5 milk" -> review, never qty 1',
    raw: '1.5 milk',
    expected: {
      items: [],
      needs_review: [{ raw: '1.5 milk', reason: 'malformed quantity syntax: 1.5' }]
    }
  },
  {
    name: 'malformed: decimal leading token "2.5 milk" -> review, never qty 1',
    raw: '2.5 milk',
    expected: {
      items: [],
      needs_review: [{ raw: '2.5 milk', reason: 'malformed quantity syntax: 2.5' }]
    }
  },
  {
    name: 'malformed: fullwidth unicode digit leading token -> review',
    raw: '\uFF12 milk',          // fullwidth two + " milk"
    expected: {
      items: [],
      needs_review: [{ raw: '\uFF12 milk', reason: 'malformed quantity syntax: \uFF12' }]
    }
  },
  {
    name: 'malformed: Arabic-indic unicode digit leading token -> review',
    raw: '\u0662 milk',          // Arabic-indic two + " milk"
    expected: {
      items: [],
      needs_review: [{ raw: '\u0662 milk', reason: 'malformed quantity syntax: \u0662' }]
    }
  },
  {
    name: 'malformed: unicode digit TRAILING token "milk <fullwidth-2>" -> review (symmetric)',
    raw: 'milk \uFF12',          // "milk " + fullwidth two
    expected: {
      items: [],
      needs_review: [{ raw: 'milk \uFF12', reason: 'malformed quantity syntax: \uFF12' }]
    }
  },
  // A numbered-list marker of ANY magnitude is a LIST MARKER, not a quantity:
  // it is stripped and the item parses at qty 1. This is what makes a real
  // numbered list parse as ordinary items (regression: the prior pass wrongly
  // sent "2." / "3)" list items to review).
  {
    name: 'numbered-list marker "2. milk" is a list marker -> item at qty 1 (NOT review)',
    raw: '2. milk',
    expected: {
      items: [{ item_name: 'milk', requested_qty: 1, note: '' }],
      needs_review: []
    }
  },
  {
    name: 'numbered-list marker "3) eggs" is a list marker -> item at qty 1 (NOT review)',
    raw: '3) eggs',
    expected: {
      items: [{ item_name: 'eggs', requested_qty: 1, note: '' }],
      needs_review: []
    }
  },
  {
    name: 'a FULL numbered list (1./2./3.) parses as three items at qty 1',
    raw: '1. jam\n2. bread\n3. milk',
    expected: {
      items: [
        { item_name: 'jam', requested_qty: 1, note: '' },
        { item_name: 'bread', requested_qty: 1, note: '' },
        { item_name: 'milk', requested_qty: 1, note: '' }
      ],
      needs_review: []
    }
  },
  {
    name: 'numbered-list marker "1. milk" stays an item at qty 1',
    raw: '1. milk',
    expected: {
      items: [{ item_name: 'milk', requested_qty: 1, note: '' }],
      needs_review: []
    }
  },
  {
    name: 'not malformed: in-name integer "omega 3" stays an item at qty 1',
    raw: 'omega 3',
    expected: {
      items: [{ item_name: 'omega 3', requested_qty: 1, note: '' }],
      needs_review: []
    }
  },
  // ---- STRICTER BAR: marker-only lines surfaced, NEVER dropped ----
  {
    name: 'marker-only: dash "-" surfaced to review, never dropped',
    raw: '-',
    expected: {
      items: [],
      needs_review: [{ raw: '-', reason: 'marker-only line' }]
    }
  },
  {
    name: 'marker-only: numeric marker "5." surfaced to review, never dropped',
    raw: '5.',
    expected: {
      items: [],
      needs_review: [{ raw: '5.', reason: 'marker-only line' }]
    }
  },
  {
    name: 'marker-only: paren ordinal marker "2)" surfaced to review, never dropped',
    raw: '2)',
    expected: {
      items: [],
      needs_review: [{ raw: '2)', reason: 'marker-only line' }]
    }
  },
  {
    name: 'marker-only block: bullet + numeric markers each surface separately',
    raw: '- \n5.\n* butter',
    expected: {
      items: [{ item_name: 'butter', requested_qty: 1, note: '' }],
      needs_review: [
        { raw: '-', reason: 'marker-only line' },
        { raw: '5.', reason: 'marker-only line' }
      ]
    }
  },
  {
    name: 'a realistic mixed block: items and one review line together',
    raw: [
      'Weekly list',      // plain item, qty 1
      '- 2x milk',        // bullet + leading Nx
      '* bread (2)',      // bullet + parenthetical qty
      'three eggs',       // word number
      '',                 // blank -> skipped
      'butter x2',        // trailing xN
      '1. jam (low sugar)', // ordinal + note
      '4x 5x widgets'     // conflicting qty -> review
    ].join('\n'),
    expected: {
      items: [
        { item_name: 'weekly list', requested_qty: 1, note: '' },
        { item_name: 'milk', requested_qty: 2, note: '' },
        { item_name: 'bread', requested_qty: 2, note: '' },
        { item_name: 'eggs', requested_qty: 3, note: '' },
        { item_name: 'butter', requested_qty: 2, note: '' },
        { item_name: 'jam', requested_qty: 1, note: 'low sugar' }
      ],
      needs_review: [{ raw: '4x 5x widgets', reason: 'conflicting quantities: 4 vs 5' }]
    }
  }
];

for (const fx of FIXTURES) {
  test('fixture: ' + fx.name, function () {
    const out = normaliseRawList(fx.raw);
    assert.deepEqual(out, fx.expected);
  });
}

// ---------------------------------------------------------------------
// Invariants that must hold across every fixture.
// ---------------------------------------------------------------------
test('invariant: no non-blank line is ever silently dropped (marker-only included)', function () {
  // Stricter bar: EVERY line that is non-blank after trim -- INCLUDING a
  // marker-only line that reduces to empty after prefix-strip -- must resolve
  // to exactly one item or one review. Only truly blank / whitespace-only
  // lines are skipped.
  for (const fx of FIXTURES) {
    const nonBlank = fx.raw
      .split(/\r\n|\r|\n/)
      .filter(function (l) { return l.trim() !== ''; }).length;
    const out = normaliseRawList(fx.raw);
    assert.equal(
      out.items.length + out.needs_review.length,
      nonBlank,
      'every non-blank line -> exactly one item or one review (' + fx.name + ')'
    );
  }
});

test('invariant: every item has a positive-integer requested_qty', function () {
  for (const fx of FIXTURES) {
    const out = normaliseRawList(fx.raw);
    for (const it of out.items) {
      assert.equal(Number.isInteger(it.requested_qty), true);
      assert.equal(it.requested_qty >= 1, true);
      assert.equal(typeof it.item_name, 'string');
      assert.equal(it.item_name.length > 0, true);
      assert.equal(typeof it.note, 'string');
    }
  }
});

// ---------------------------------------------------------------------
// Targeted edge cases and empty/nullish input.
// ---------------------------------------------------------------------
// ---------------------------------------------------------------------
// FIX-FORWARD: explicit NEVER-DROP audit over the adversarial classes.
// Every non-blank line must resolve to EXACTLY one item or one review, and
// every review must preserve its raw line and carry a non-empty reason.
// ---------------------------------------------------------------------
test('NEVER-DROP audit: adversarial lines each yield exactly one item or one review', function () {
  const adversarial = [
    'milk x2 x3',                    // trailing conflict        -> review
    'milk x2 (organic) x3',          // interleaved-note conflict -> review
    '999999999999999999999 milk',    // overflow-scale qty        -> review
    '1000 eggs',                     // over the cap              -> review
    'seven up',                      // word-number collision     -> review
    'five spice',                    // word-number collision     -> review
    '7 up',                          // digit form                -> item
    'two milk',                      // legit word-number qty     -> item
    '999 eggs'                       // exactly the cap           -> item
  ].join('\n');

  const out = normaliseRawList(adversarial);
  const nonBlank = adversarial
    .split(/\r\n|\r|\n/)
    .map(function (l) { return _internal.stripPrefix(l.trim()).trim(); })
    .filter(function (l) { return l !== ''; }).length;

  assert.equal(out.items.length + out.needs_review.length, nonBlank,
    'no adversarial line is dropped or split into two rows');
  assert.equal(out.items.length, 3);
  assert.equal(out.needs_review.length, 6);

  for (const r of out.needs_review) {
    assert.equal(typeof r.raw, 'string');
    assert.equal(r.raw.length > 0, true, 'review preserves the raw line');
    assert.equal(typeof r.reason, 'string');
    assert.equal(r.reason.length > 0, true, 'review carries a reason');
  }
});

test('empty / nullish input returns empty structures, never throws', function () {
  assert.deepEqual(normaliseRawList(''), { items: [], needs_review: [] });
  assert.deepEqual(normaliseRawList('   \n\t\n'), { items: [], needs_review: [] });
  assert.deepEqual(normaliseRawList(null), { items: [], needs_review: [] });
  assert.deepEqual(normaliseRawList(undefined), { items: [], needs_review: [] });
});

test('a pack spec like "2x4 timber" is NOT read as a quantity', function () {
  const out = normaliseRawList('2x4 timber');
  assert.deepEqual(out.items, [{ item_name: '2x4 timber', requested_qty: 1, note: '' }]);
  assert.deepEqual(out.needs_review, []);
});

test('agreeing quantities (paren echoes the prefix) are not a conflict', function () {
  const out = normaliseRawList('2x milk (2)');
  assert.deepEqual(out.items, [{ item_name: 'milk', requested_qty: 2, note: '' }]);
  assert.deepEqual(out.needs_review, []);
});

test('a lone bullet marker is surfaced to needs_review, never dropped', function () {
  // Stricter bar (2026-07-20): supersedes the prior "captures nothing" skip.
  const out = normaliseRawList('- \n*   ');
  assert.deepEqual(out, {
    items: [],
    needs_review: [
      { raw: '-', reason: 'marker-only line' },
      { raw: '*', reason: 'marker-only line' }
    ]
  });
});

test('duplicate item lines are preserved as separate rows (dedupe is the planner\'s job)', function () {
  const out = normaliseRawList('milk\nmilk');
  assert.equal(out.items.length, 2);
});

// ---------------------------------------------------------------------
// Pure-helper unit tests (mirrors planner.js _internal test style).
// ---------------------------------------------------------------------
test('helper normaliseItemName lower-cases and collapses whitespace', function () {
  assert.equal(_internal.normaliseItemName('  Olive   OIL '), 'olive oil');
  assert.equal(_internal.normaliseItemName('MILK'), 'milk');
});

test('helper extractQuantities finds each leading/trailing form', function () {
  assert.deepEqual(_internal.extractQuantities('2 milk'), { qtys: [2], rest: 'milk' });
  assert.deepEqual(_internal.extractQuantities('2x milk'), { qtys: [2], rest: 'milk' });
  assert.deepEqual(_internal.extractQuantities('x2 milk'), { qtys: [2], rest: 'milk' });
  assert.deepEqual(_internal.extractQuantities('milk x2'), { qtys: [2], rest: 'milk' });
  assert.deepEqual(_internal.extractQuantities('two milk'), { qtys: [2], rest: 'milk' });
  assert.deepEqual(_internal.extractQuantities('milk'), { qtys: [], rest: 'milk' });
});

test('helper extractQuantities LOOPS trailing xN (doubled form -> two qtys)', function () {
  // A single trailing pass would keep "milk x2" as rest and only qtys [3].
  assert.deepEqual(_internal.extractQuantities('milk x2 x3'), { qtys: [3, 2], rest: 'milk' });
});

test('helper extractParentheticals splits numeric qty from a text note', function () {
  const num = _internal.extractParentheticals('milk (2)');
  assert.deepEqual(num.qtys, [2]);
  assert.equal(num.note, '');
  const txt = _internal.extractParentheticals('milk (organic)');
  assert.deepEqual(txt.qtys, []);
  assert.equal(txt.note, 'organic');
});

test('helper stripPrefix removes bullets and ordinals but not decimals', function () {
  assert.equal(_internal.stripPrefix('- bread'), 'bread');
  assert.equal(_internal.stripPrefix('* bread'), 'bread');
  assert.equal(_internal.stripPrefix('1. bread'), 'bread');
  assert.equal(_internal.stripPrefix('2) bread'), 'bread');
  assert.equal(_internal.stripPrefix('1.5 litre milk'), '1.5 litre milk');
});

// ---------------------------------------------------------------------
// STRICTER BAR: pure-helper unit tests for the malformed-token detector.
// ---------------------------------------------------------------------
test('helper isMalformedNumericToken flags signed integers', function () {
  assert.equal(_internal.isMalformedNumericToken('+2'), true);
  assert.equal(_internal.isMalformedNumericToken('-2'), true);
  assert.equal(_internal.isMalformedNumericToken('+10'), true);
});

test('helper isMalformedNumericToken flags decimals / dotted numbers', function () {
  assert.equal(_internal.isMalformedNumericToken('1.5'), true);
  assert.equal(_internal.isMalformedNumericToken('2.5'), true);
  assert.equal(_internal.isMalformedNumericToken('.5'), true);
  assert.equal(_internal.isMalformedNumericToken('2.'), true);
  assert.equal(_internal.isMalformedNumericToken('-2.5'), true);
});

test('helper isMalformedNumericToken flags non-ASCII / unicode digits', function () {
  assert.equal(_internal.isMalformedNumericToken('\uFF12'), true); // fullwidth 2
  assert.equal(_internal.isMalformedNumericToken('\u0662'), true); // Arabic-indic 2
  assert.equal(_internal.isMalformedNumericToken('\uFF11\uFF10'), true); // fullwidth "10"
});

test('helper isMalformedNumericToken does NOT flag clean/legit tokens', function () {
  assert.equal(_internal.isMalformedNumericToken('2'), false);   // clean ASCII int
  assert.equal(_internal.isMalformedNumericToken('3'), false);   // "omega 3"
  assert.equal(_internal.isMalformedNumericToken('2x4'), false); // pack spec
  assert.equal(_internal.isMalformedNumericToken('b12'), false); // vitamin name
  assert.equal(_internal.isMalformedNumericToken('milk'), false);
  assert.equal(_internal.isMalformedNumericToken(''), false);
});
