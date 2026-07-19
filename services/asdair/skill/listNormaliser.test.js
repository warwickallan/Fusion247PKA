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
//   * bullet + numbered prefixes ("- ", "* ", "1. ") and the ordinal-vs-
//     quantity distinction ("1. milk" -> qty 1 ; "2 milk" -> qty 2)
//   * blank / whitespace-only lines (skipped, never reviewed)
//   * a trailing note via a parenthetical
//   * default qty = 1
//   * case + whitespace normalisation of item_name
//   * ambiguous lines landing in needs_review (conflicting qty, no item)
//
// PURE ASCII only.
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
test('invariant: no non-blank line is ever silently dropped', function () {
  for (const fx of FIXTURES) {
    const nonBlank = fx.raw
      .split(/\r\n|\r|\n/)
      .map(function (l) { return _internal.stripPrefix(l.trim()).trim(); })
      .filter(function (l) { return l !== ''; }).length;
    const out = normaliseRawList(fx.raw);
    assert.equal(
      out.items.length + out.needs_review.length,
      nonBlank,
      'every non-blank, non-bullet-only line -> exactly one item or one review (' + fx.name + ')'
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

test('a lone bullet marker captures nothing', function () {
  const out = normaliseRawList('- \n*   ');
  assert.deepEqual(out, { items: [], needs_review: [] });
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
