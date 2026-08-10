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
      // Qty 1 is UNCHANGED. What changed is WHY: "omega 3" used to need a hand-
      // curated entry in TRAILING_NUMBER_COLLISIONS to survive; it is now the
      // ordinary outcome of the general pack-size rule, so the curated list is
      // gone and no future product has to be added to one by hand.
      items: [{
        item_name: 'omega 3',
        requested_qty: 1,
        note: 'pack size 3 read from the product name, not as an order quantity - asking for 1'
      }],
      needs_review: []
    }
  },
  // ---- TRAILING BARE NUMBER = PACK SIZE, NOT AN ORDER QUANTITY (WP-B15-11) ----
  //
  // REQUIREMENT CHANGE, not a weakened assertion (Warwick, 2026-08-10, via
  // WO-2026-08-10-11): "fix the shared semantic rule/class wherever necessary so
  // money-risk behaviour cannot survive on another input path."
  //
  // The three fixtures below previously asserted the OPPOSITE - that a trailing
  // bare integer IS an order quantity. That rule cost roughly GBP 350 on the
  // photographed path ("ARIEL 4in1 PODS 33" ordered 33 boxes of laundry pods),
  // was corrected there by WP-B15-08, and survived here on the typed path. The
  // number at the end of a product name is print on a box - a pod count, an SPF,
  // a 4in1 - and on a hand-written list the quantity is written BEFORE the item
  // ("9 ROLLS", "16 CAPSULES", "4 x 500ml"). It is now pack-size evidence on
  // EVERY input path: the line asks for 1, and the number STAYS in the name as
  // the evidence of what was actually written.
  //
  // Direction of every inversion here: the ordered quantity moves DOWN to 1, or
  // is unchanged. Nothing below makes the parser order MORE than it did before.
  {
    name: 'requirement change: a trailing bare number is a PACK SIZE, not a quantity ("milk 2")',
    raw: 'milk 2',
    expected: {
      items: [{
        item_name: 'milk 2',
        requested_qty: 1,
        note: 'pack size 2 read from the product name, not as an order quantity - asking for 1'
      }],
      needs_review: []
    }
  },
  {
    name: 'requirement change: pack size after a multi-word name ("yazoo strawberry 4")',
    raw: 'yazoo strawberry 4',
    expected: {
      items: [{
        item_name: 'yazoo strawberry 4',
        requested_qty: 1,
        note: 'pack size 4 read from the product name, not as an order quantity - asking for 1'
      }],
      needs_review: []
    }
  },
  {
    name: 'requirement change: pack size alongside a parenthetical note ("bread 3 (thick sliced)")',
    raw: 'bread 3 (thick sliced)',
    expected: {
      // The human's own note comes FIRST; the parser's annotation rides after it.
      items: [{
        item_name: 'bread 3',
        requested_qty: 1,
        note: 'thick sliced; pack size 3 read from the product name, not as an order quantity - asking for 1'
      }],
      needs_review: []
    }
  },
  {
    // THE LIVE DEFECT, on the typed path, in Warwick's own words.
    name: 'THE MONEY DEFECT, typed: "ARIEL 4in1 PODS 33" is ONE box, not thirty-three',
    raw: 'ARIEL 4in1 PODS 33',
    expected: {
      items: [{
        item_name: 'ariel 4in1 pods 33',
        requested_qty: 1,
        note: 'pack size 33 read from the product name, not as an order quantity - asking for 1'
      }],
      needs_review: []
    }
  },
  // ---- NEGATIVE / BOUNDARY: a trailing number that is NOT a quantity ----
  {
    name: 'over-match guard: a trailing SIZE token is not a quantity ("yazoo 400ml")',
    raw: 'yazoo 400ml',
    expected: {
      items: [{ item_name: 'yazoo 400ml', requested_qty: 1, note: '' }],
      needs_review: []
    }
  },
  {
    name: 'over-match guard: a trailing VOLUME token is not a quantity ("milk 2L")',
    raw: 'milk 2L',
    expected: {
      items: [{ item_name: 'milk 2l', requested_qty: 1, note: '' }],
      needs_review: []
    }
  },
  {
    name: 'over-match guard: a mid-line pack number is not a quantity ("tuna 4 pack")',
    raw: 'tuna 4 pack',
    expected: {
      items: [{ item_name: 'tuna 4 pack', requested_qty: 1, note: '' }],
      needs_review: []
    }
  },
  {
    name: 'over-match guard: a glued in-name number is not a quantity ("7up")',
    raw: '7up',
    expected: {
      items: [{ item_name: '7up', requested_qty: 1, note: '' }],
      needs_review: []
    }
  },
  {
    name: 'over-match guard: identity number "factor 50" stays qty 1 (no curated list needed)',
    raw: 'factor 50',
    expected: {
      items: [{
        item_name: 'factor 50',
        requested_qty: 1,
        note: 'pack size 50 read from the product name, not as an order quantity - asking for 1'
      }],
      needs_review: []
    }
  },
  {
    name: 'over-match guard: identity number "wd 40" stays qty 1 (no curated list needed)',
    raw: 'wd 40',
    expected: {
      items: [{
        item_name: 'wd 40',
        requested_qty: 1,
        note: 'pack size 40 read from the product name, not as an order quantity - asking for 1'
      }],
      needs_review: []
    }
  },
  {
    name: 'collision name WITH an explicit trailing quantity still parses ("omega 3 x2")',
    raw: 'omega 3 x2',
    expected: {
      items: [{ item_name: 'omega 3', requested_qty: 2, note: '' }],
      needs_review: []
    }
  },
  {
    name: 'collision name with a LEADING quantity still parses ("2x omega 3")',
    raw: '2x omega 3',
    expected: {
      items: [{ item_name: 'omega 3', requested_qty: 2, note: '' }],
      needs_review: []
    }
  },
  // ---- AN EXPLICIT QUANTITY BESIDE A PACK SIZE IS A GENUINE REQUEST ----
  //
  // REQUIREMENT CHANGE (WP-B15-11). These two were conflicts only because the
  // trailing number was being read as a second, competing quantity. Now that it
  // is pack-size evidence there is no conflict to have, and the line means
  // exactly what it says. This is the SAME rule runPipeline.js applies to the
  // photographed path: "a reading whose quantity is something else ('ARIEL 4in1
  // PODS 33', quantity 2) is a genuine request for two boxes and is left exactly
  // alone - destroying that would be worse than the bug."
  //
  // No pack-size note here: an explicit quantity was written, nothing was
  // corrected, and there is nothing to tell the reader about.
  {
    name: 'requirement change: explicit xN beside a pack size is a real request ("milk 2 x3")',
    raw: 'milk 2 x3',
    expected: {
      items: [{ item_name: 'milk 2', requested_qty: 3, note: '' }],
      needs_review: []
    }
  },
  {
    name: 'requirement change: leading quantity beside a pack size is a real request ("2 milk 3")',
    raw: '2 milk 3',
    expected: {
      items: [{ item_name: 'milk 3', requested_qty: 2, note: '' }],
      needs_review: []
    }
  },
  {
    name: 'requirement change: a large pack size asks for 1, it is not an implausible qty ("milk 1000")',
    raw: 'milk 1000',
    expected: {
      // Previously review ("implausible quantity: 1000"), because 1000 was being
      // read as an order. As a pack size it is unremarkable and the order is 1.
      items: [{
        item_name: 'milk 1000',
        requested_qty: 1,
        note: 'pack size 1000 read from the product name, not as an order quantity - asking for 1'
      }],
      needs_review: []
    }
  },
  // ---- NEVER GUESS: a trailing number that is NEITHER a quantity NOR a pack size ----
  {
    name: 'trailing bare zero is not a pack size and not a quantity -> review ("milk 0")',
    raw: 'milk 0',
    expected: {
      items: [],
      needs_review: [{ raw: 'milk 0', reason: 'non-positive quantity: 0' }]
    }
  },
  {
    name: 'trailing bare number past integer precision -> review, never a silent name',
    raw: 'milk 999999999999999999999',
    expected: {
      items: [],
      needs_review: [{ raw: 'milk 999999999999999999999', reason: 'implausible quantity: 999999999999999999999' }]
    }
  },
  {
    name: 'trailing numeric look-alike is still malformed, not a bare qty ("milk 2.")',
    raw: 'milk 2.',
    expected: {
      items: [],
      needs_review: [{ raw: 'milk 2.', reason: 'malformed quantity syntax: 2.' }]
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

test('helper extractQuantities NEVER reads a trailing bare integer as a quantity', function () {
  // REQUIREMENT CHANGE (WP-B15-11): this helper previously returned
  // { qtys: [2], rest: 'milk' } for "milk 2". The number is pack-size evidence,
  // so it is neither consumed nor stripped - it stays in the name.
  assert.deepEqual(_internal.extractQuantities('milk 2'), { qtys: [], rest: 'milk 2' });
  assert.deepEqual(_internal.extractQuantities('yazoo strawberry 4'), { qtys: [], rest: 'yazoo strawberry 4' });
  assert.deepEqual(_internal.extractQuantities('ARIEL 4in1 PODS 33'), { qtys: [], rest: 'ARIEL 4in1 PODS 33' });
});

test('helper extractQuantities does NOT strip a trailing UNIT/SIZE or glued number', function () {
  // The token must be pure ASCII digits to end of line, whitespace-separated.
  assert.deepEqual(_internal.extractQuantities('yazoo 400ml'), { qtys: [], rest: 'yazoo 400ml' });
  assert.deepEqual(_internal.extractQuantities('milk 2L'), { qtys: [], rest: 'milk 2L' });
  assert.deepEqual(_internal.extractQuantities('7up'), { qtys: [], rest: '7up' });
  assert.deepEqual(_internal.extractQuantities('2x4 timber'), { qtys: [], rest: '2x4 timber' });
  // anchored to END of line, so a mid-line pack number survives
  assert.deepEqual(_internal.extractQuantities('tuna 4 pack'), { qtys: [], rest: 'tuna 4 pack' });
});

test('the curated TRAILING_NUMBER_COLLISIONS list is GONE, not merely unused', function () {
  // REQUIREMENT CHANGE (WP-B15-11). The list existed because "milk 2" and
  // "omega 3" are syntactically identical, so a curated exception was the only
  // way to protect a product whose identity ends in a number. Once NO trailing
  // bare number is a quantity, every one of them is protected by the general
  // rule and the list has nothing left to do. Asserted as ABSENT so it cannot
  // quietly come back as a second place where this decision is made.
  assert.equal(_internal.TRAILING_NUMBER_COLLISIONS, undefined,
    'the curated collision list must not exist alongside the general rule');
  const src = require('node:fs').readFileSync(require('node:path').join(__dirname, 'listNormaliser.js'), 'utf8');
  assert.equal(src.includes('TRAILING_NUMBER_COLLISIONS'), false,
    'no dead curated collision list may remain in the source');
  // The names it used to carry are handled by the general rule instead.
  assert.deepEqual(_internal.extractQuantities('omega 3'), { qtys: [], rest: 'omega 3' });
  assert.deepEqual(_internal.extractQuantities('factor 50'), { qtys: [], rest: 'factor 50' });
  assert.deepEqual(_internal.extractQuantities('wd 40'), { qtys: [], rest: 'wd 40' });
  // ...and an explicit quantity in another form is still read.
  assert.deepEqual(_internal.extractQuantities('omega 3 x2'), { qtys: [2], rest: 'omega 3' });
  assert.deepEqual(_internal.extractQuantities('2x omega 3'), { qtys: [2], rest: 'omega 3' });
});

test('a doubled trailing bare form is no longer two competing quantities', function () {
  // REQUIREMENT CHANGE (WP-B15-11): was { qtys: [3, 2], rest: 'milk' }.
  assert.deepEqual(_internal.extractQuantities('milk 2 3'), { qtys: [], rest: 'milk 2 3' });
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

// =====================================================================
// WP-B15-11 - THE SHARED PACK-SIZE RULE, AND THE FORMS IT MUST NOT BREAK
//
// AC1: one rule, exported, so the photographed and typed paths cannot drift.
// AC2: a fix that breaks leading quantities is worse than the bug.
// =====================================================================

test('AC1 the pack-size rule is EXPORTED from this module, so one rule can serve every path', function () {
  // The rule must be reachable by the pipeline's photographed path as well.
  // services/asdair/skill is CommonJS and services/asdair/pipeline is ESM, so a
  // shared rule can ONLY live on this side of the boundary: CJS cannot
  // synchronously require an ESM module, while ESM imports this one already
  // (services/fusion-capture-gateway/src/transcription/transcriptionStage.js).
  const mod = require('./listNormaliser');
  assert.equal(typeof mod.trailingPackSize, 'function',
    'trailingPackSize must be a public export, not a private helper');
  assert.equal(typeof _internal.trailingPackSize, 'function');
});

test('AC1 the shared rule draws the four boundaries the photographed path documents', function () {
  const { trailingPackSize } = require('./listNormaliser');
  // These four boundaries are the contract runPipeline.js states for the
  // photographed path. They are pinned here as VALUES, not by importing that
  // module: it belongs to a parallel work package, and a test that reaches into
  // another branch's file would fail for reasons that are not about this rule.
  //
  // 1. whitespace before the digits is REQUIRED - a glued form is untouched
  assert.equal(trailingPackSize('7up'), null);
  assert.equal(trailingPackSize('2x4'), null);
  assert.equal(trailingPackSize('b12'), null);
  // 2. pure ASCII digits to end of line - a size or unit token is untouched
  assert.equal(trailingPackSize('yazoo 400ml'), null);
  assert.equal(trailingPackSize('milk 2L'), null);
  assert.equal(trailingPackSize('tuna 500g'), null);
  assert.equal(trailingPackSize('milk 2.'), null);
  assert.equal(trailingPackSize('milk +2'), null);
  assert.equal(trailingPackSize('milk \uFF12'), null); // fullwidth digit
  // 3. at least one NON-NUMERIC token must precede it - a bare number has no
  //    name for a pack size to belong to
  assert.equal(trailingPackSize('33'), null);
  assert.equal(trailingPackSize('2 33'), null);
  assert.equal(trailingPackSize(''), null);
  assert.equal(trailingPackSize('   '), null);
  // 4. a safe positive integer, or nothing
  assert.equal(trailingPackSize('milk 0'), null);
  assert.equal(trailingPackSize('milk 999999999999999999999'), null);
  // ...and the cases it DOES fire on
  assert.equal(trailingPackSize('ARIEL 4in1 PODS 33'), 33);
  assert.equal(trailingPackSize('milk 2'), 2);
  assert.equal(trailingPackSize('omega 3'), 3);
  assert.equal(trailingPackSize('yazoo strawberry 4'), 4);
  assert.equal(trailingPackSize('  ariel pods 33  '), 33);
  // non-string input is not a crash
  assert.equal(trailingPackSize(null), null);
  assert.equal(trailingPackSize(undefined), null);
  assert.equal(trailingPackSize(33), null);
});

test('AC2 every LEADING quantity form Warwick writes is untouched', function () {
  // Warwick's own examples, from the Work Order. On a hand-written list the
  // quantity is written BEFORE the item - that asymmetry is the whole reason
  // the trailing rule is safe, so breaking these would be worse than the bug.
  const cases = [
    ['4 x 4pts ARLA', { item_name: '4pts arla', requested_qty: 4, note: '' }],
    ['9 ROLLS', { item_name: 'rolls', requested_qty: 9, note: '' }],
    ['16 CAPSULES', { item_name: 'capsules', requested_qty: 16, note: '' }],
    ['4 x 500ml', { item_name: '500ml', requested_qty: 4, note: '' }],
    ['2x milk', { item_name: 'milk', requested_qty: 2, note: '' }],
    ['x2 milk', { item_name: 'milk', requested_qty: 2, note: '' }],
    ['two milk', { item_name: 'milk', requested_qty: 2, note: '' }],
    ['milk x2', { item_name: 'milk', requested_qty: 2, note: '' }],
    ['milk (2)', { item_name: 'milk', requested_qty: 2, note: '' }],
  ];
  for (const [raw, expected] of cases) {
    const out = normaliseRawList(raw);
    assert.deepEqual(out.needs_review, [], `"${raw}" must not become a review line`);
    assert.deepEqual(out.items, [expected], `"${raw}" must keep its leading quantity`);
  }
});

test('AC2 "2pkts TWIX" is PINNED at its current behaviour, and the gap is recorded here', function () {
  // MEASURED, not assumed (preflight, governance head 9b11ea8): the glued form
  // "2pkts" yields qty 1 TODAY, because no leading-quantity form matches a digit
  // with no whitespace after it. The Work Order originally asserted this was 2;
  // it is not, and Larry corrected the criterion to no-regression rather than
  // have a glued leading-quantity rule invented here.
  //
  // WHY NOT FIX IT: the naive rule "digits glued to letters at the start are a
  // quantity" turns "7up" into 7 x "up" and "4in1" into 4 x "in1". Making it
  // safe needs a curated unit-token allowlist (pkt/pkts/pt/pts/...), which is a
  // separate piece of work with its own fixtures. It UNDER-orders, which is the
  // money-safe direction. Reported for Warwick's queue; pinned here so that if
  // anyone does build that rule, this test tells them it changed.
  const out = normaliseRawList('2pkts TWIX');
  assert.deepEqual(out.items, [{ item_name: '2pkts twix', requested_qty: 1, note: '' }]);
  assert.deepEqual(out.needs_review, []);
});

test('AC1 the money defect cannot be reached through the public entry point', function () {
  // The one assertion that decides this Work Package on the typed path.
  const out = normaliseRawList('ARIEL 4in1 PODS 33');
  assert.equal(out.items.length, 1);
  assert.equal(out.items[0].requested_qty, 1,
    'a trailing pack size must NEVER become an order quantity - this line cost GBP 350');
  assert.equal(out.items[0].item_name, 'ariel 4in1 pods 33',
    'the number stays in the name: it is the evidence of what was written');
  assert.match(out.items[0].note, /^pack size 33 read from the product name/);
});

test('the pack-size annotation is attached ONLY where the parser actually corrected something', function () {
  // Mirrors runPipeline.js: the note rides on a line whose quantity was taken
  // from the pack size. Where an explicit quantity was written, nothing was
  // corrected and there is nothing to tell the reader.
  assert.equal(normaliseRawList('milk 2').items[0].note,
    'pack size 2 read from the product name, not as an order quantity - asking for 1');
  assert.equal(normaliseRawList('milk 2 x3').items[0].note, '');
  assert.equal(normaliseRawList('2 milk 3').items[0].note, '');
  assert.equal(normaliseRawList('milk').items[0].note, '');
  assert.equal(normaliseRawList('milk 2L').items[0].note, '');
});
