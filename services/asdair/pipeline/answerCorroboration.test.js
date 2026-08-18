// =====================================================================
// WO-2026-08-18-03 AC1 - THE CORROBORATION GATE, ON ITS OWN.
//
// The replay in answerBindingReplay.test.js drives the whole loop. This
// file proves the RULE, directly, on the real words from 2026-08-17 - so
// a failure here says which half is wrong without anyone reading a trace.
//
// The load-bearing assertion is the PAIR: the same sentence is REFUSED
// against the question it was mis-bound to and ACCEPTED against the
// question it answers. A gate that refused both would be a mute button.
// =====================================================================

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

import { tokenise, questionTokens, corroboration } from './answerCorroboration.js';

const CORPUS = JSON.parse(
  fs.readFileSync(path.join(import.meta.dirname, 'testdata', '2026-08-17-shop-33-answers.json'), 'utf8'),
);

/** The nine questions as `correlateTypedAnswer` sees them - the shape
 *  loadOpenQuestions builds. */
const OPEN = CORPUS.rows.map((r) => ({
  questionKey: `q${r.n}`,
  questionText: r.questionText,
  itemName: r.item,
  ordinal: r.n,
  candidates: [],
  renderedCandidates: [],
}));

const q = (n) => OPEN[n - 1];
const answerOf = (n) => CORPUS.rows[n - 1].answerText;

// ── the corpus is what it claims to be ──────────────────────────────────────

test('the committed corpus is the nine rows of shop 33, with two never recorded', () => {
  assert.equal(CORPUS.rows.length, 9, 'nine questions were opened in one planning pass');
  assert.equal(CORPUS.rows.filter((r) => r.answerText === null).length, 2,
    'two answers were never recorded - rows 7 and 9');
  assert.equal(CORPUS.rows.filter((r) => r.answerText !== null).length, 7,
    'seven answers were written, in 2.5 seconds');
});

// ── tokenisation ────────────────────────────────────────────────────────────

test('tokenise drops what cannot be evidence and folds plurals onto their singular', () => {
  // Two-character tokens match everything and mean nothing.
  assert.equal(tokenise('1 x 4pk').has('4pk'), true);
  assert.equal(tokenise('1 x 4pk').has('pk'), false, 'a two-character token is not evidence');

  // Plurals. "toffee"/"toffees" and "lolly"/"lollies" are the same word here,
  // and an exact-match rule that missed them would ask him about an answer that
  // plainly named the item.
  assert.deepEqual([...tokenise('toffees')], ['toffee']);
  assert.deepEqual([...tokenise('lollies')], ['lolly']);
  assert.deepEqual([...tokenise('wipes')], ['wipe']);
  assert.deepEqual([...tokenise('eggs')], ['egg']);
  // ...without mangling a word that legitimately ends in a double s.
  assert.deepEqual([...tokenise('glass')], ['glass']);
  assert.deepEqual([...tokenise('glasses')], ['glass']);

  // Retailer and packaging noise never tells two products apart.
  assert.equal(tokenise('the large asda pack').size, 0);
});

test('questionTokens reads the ITEM, never the identical wrapper every question carries', () => {
  // Every question this product asks is `Which product is "<item>"?`. If the
  // wrapper were fed in, the word "product" would corroborate the entire open
  // set at once and the gate would pass everything.
  const tokens = questionTokens({ questionText: 'Which product is "1 pk fruit lolly ice"?' });
  assert.equal(tokens.has('product'), false, 'the wrapper is not evidence about any question');
  assert.equal(tokens.has('which'), false);
  assert.deepEqual([...tokens].sort(), ['fruit', 'ice', 'lolly']);
});

test('questionTokens falls back to the quoted span when item_name is null - it is LEFT-joined in production', () => {
  const withItem = questionTokens({ itemName: '1 Sweetex', questionText: 'Which product is "1 Sweetex"?' });
  const withoutItem = questionTokens({ itemName: null, questionText: 'Which product is "1 Sweetex"?' });
  assert.deepEqual([...withItem], ['sweetex']);
  assert.deepEqual([...withoutItem], ['sweetex'], 'a question with no carrier still has evidence');
});

test('a candidate label is evidence - an answer naming what he was offered is exactly the support we want', () => {
  const tokens = questionTokens({
    itemName: '1 wet wipes',
    candidates: [{ label: 'Nivea Biodegradable Cleansing Wipes 25pk', regular_id: 7 }],
  });
  assert.equal(tokens.has('nivea'), true);
  assert.equal(tokens.has('wipe'), true);
});

// ── THE PAIR. This is the repair, in two assertions. ────────────────────────

test('⭐ THE SAME WORDS: refused against the question they were mis-bound to, ACCEPTED against the question they answer', () => {
  const words = answerOf(4);   // "Ice lollies are in favourites. stupid question"
  assert.equal(words, 'Ice lollies are in favourites. stupid question');

  const wrong = corroboration({ answerText: words, question: q(4), scoped: OPEN });
  assert.equal(wrong.corroborated, false,
    'nothing in these words supports the Ben & Jerry\'s question - this is the write that cost the shop');
  assert.deepEqual(wrong.on, []);

  const right = corroboration({ answerText: words, question: q(5), scoped: OPEN });
  assert.equal(right.corroborated, true,
    'the same words DO support the fruit lolly ice question - the gate discriminates, it does not mute');
  assert.deepEqual(right.on, ['ice', 'lolly']);
});

test('⭐ AND AGAIN ON ROW 5: wet body wipes is refused against fruit lolly ice and accepted against wet wipes', () => {
  const words = answerOf(5);   // "new item. wet body wipes for women"
  assert.equal(corroboration({ answerText: words, question: q(5), scoped: OPEN }).corroborated, false);

  const right = corroboration({ answerText: words, question: q(6), scoped: OPEN });
  assert.equal(right.corroborated, true);
  assert.deepEqual(right.on, ['wet', 'wipe']);
});

// ── the three that were RIGHT must stay right ───────────────────────────────

test('rows 1-3 bound correctly on the real run and the gate leaves them alone', () => {
  const one = corroboration({ answerText: answerOf(1), question: q(1), scoped: OPEN });
  assert.equal(one.corroborated, true, '"6 eggs?! Ffs" plainly names the eggs question');
  assert.deepEqual(one.on, ['egg']);

  const two = corroboration({ answerText: answerOf(2), question: q(2), scoped: OPEN });
  assert.equal(two.corroborated, true);
  assert.deepEqual(two.on, ['bar', 'cow', 'skinny']);

  const three = corroboration({ answerText: answerOf(3), question: q(3), scoped: OPEN });
  assert.equal(three.corroborated, true);
  assert.deepEqual(three.on, ['bean', 'heinz']);
});

// ── the honest ones stay honest ─────────────────────────────────────────────

test('an answer carrying no product word at all corroborates NOTHING - it is asked about, never placed', () => {
  // Row 6, "there is a rule about this". The Work Order records it as genuinely
  // ambiguous between two questions and forbids resolving it to make a cleaner
  // test. The gate agrees with that: it supports neither, so neither is written.
  const words = answerOf(6);
  for (const row of CORPUS.rows) {
    assert.equal(corroboration({ answerText: words, question: q(row.n), scoped: OPEN }).corroborated, false,
      `these words must not support question ${row.n}`);
  }
});

test('row 8 is NOT ESTABLISHED, and the gate does not pretend otherwise', () => {
  // "n favourites FFS stupid question" is plausibly the toffees answer. Nothing
  // in the words says so, so it is asked about rather than written. That is the
  // cost of this repair and it is reported, not hidden.
  assert.equal(corroboration({ answerText: answerOf(8), question: q(8), scoped: OPEN }).corroborated, false);
});

// ── the uniqueness rule ─────────────────────────────────────────────────────

test('a word shared by two open questions names NEITHER of them', () => {
  // "asda" is in question 1 and question 8 of the real corpus. An answer saying
  // "the asda one" is not evidence about either, and before the uniqueness rule
  // it would have been enough to write one of them permanently.
  const both = ['asda'];
  assert.equal(questionTokens(q(1)).has('asda'), false, 'asda is a stopword outright');
  assert.equal(both.length, 1);

  // The rule itself, on a token that is NOT a stopword: two open questions both
  // about toffee.
  const scoped = [
    { questionKey: 'a', itemName: 'asda plain toffees' },
    { questionKey: 'b', itemName: 'thorntons toffee box' },
  ];
  assert.equal(corroboration({ answerText: 'the toffee one', question: scoped[0], scoped }).corroborated, false,
    'toffee is offered by both, so it identifies neither');
  assert.equal(corroboration({ answerText: 'the thorntons one', question: scoped[1], scoped }).corroborated, true,
    'thorntons is offered by one, so it identifies it');
});

test('it fails towards ASKING - an empty answer, an empty question, or nothing shared, all refuse', () => {
  assert.equal(corroboration({ answerText: '', question: q(1), scoped: OPEN }).corroborated, false);
  assert.equal(corroboration({ answerText: 'eggs', question: {}, scoped: OPEN }).corroborated, false);
  assert.equal(corroboration({}).corroborated, false);
  assert.equal(corroboration({ answerText: 'eggs', question: q(1), scoped: null }).corroborated, true,
    'a missing scope is not a reason to refuse a question the words plainly name');
});
