// =====================================================================
// BUILD-015 AsdAIr - cockpit-api/explainState.test.js
//
// Runs under: node --test
//
// WP-B15-35 AC3. The load-bearing case is "the contradiction that cannot
// happen" - a state constructed so that a NAIVE implementation (sentence from
// one reading of the data, counters from another) would visibly disagree, and
// asserted not to.
//
// SYNTHETIC FIXTURES ONLY. No database, no network.
//
// PURE ASCII only.
// =====================================================================

'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const { explainState, countFacts, sentenceFor } = require('./explainState');

function line(no, over) {
  return Object.assign({ line_no: no, status: 'needs_confirmation', corrected: false }, over || {});
}
function question(key, over) {
  return Object.assign({ question_key: key, status: 'open', line_no: null }, over || {});
}

// ---------------------------------------------------------------------
// THE CONTRADICTION TEST (AC3's named requirement).
// ---------------------------------------------------------------------
test('A COUNTER AND THE SENTENCE CANNOT DISAGREE - the stale-question case', () => {
  // The state a naive implementation gets wrong:
  //   * three questions are still marked `open` in the database;
  //   * TWO of them are about lines that have since been resolved - one
  //     matched outright, one corrected by Warwick.
  // A naive build counts three open questions for the badge ("3 decisions
  // need you") while the board, having filtered the resolved lines, shows one.
  // Warwick is then asked to reconcile two numbers himself, which is the exact
  // thing this Work Order forbids.
  const input = {
    stage: 'NEEDS_DECISION',
    human_state: 'NEEDS_WARWICK',
    lines: [
      line(1, { status: 'matched' }),                          // resolved by the run
      line(2, { status: 'needs_confirmation', corrected: true }), // resolved by Warwick
      line(3),                                                  // genuinely open
    ],
    questions: [
      question('q:1', { line_no: 1 }),   // STALE - its line is resolved
      question('q:2', { line_no: 2 }),   // STALE - its line is corrected
      question('q:3', { line_no: 3 }),   // genuinely needs Warwick
    ],
    items: [],
  };

  const r = explainState(input);

  assert.equal(r.counts.decisions_needing_warwick, 1,
    'two of the three open questions are about resolved lines and must not count');
  assert.equal(r.counts.stale_questions_suppressed, 2,
    'suppressed is not the same as hidden - the number must still be reportable');

  // THE ASSERTION THAT MATTERS: the sentence carries the SAME number the
  // counter carries. Not a similar number, the same one.
  assert.equal(r.sentence, '1 decision still needs you.');
  assert.match(r.sentence, new RegExp('\\b' + r.counts.decisions_needing_warwick + '\\b'));

  // And the naive number is nowhere in the sentence.
  assert.equal(/\b3 decisions\b/.test(r.sentence), false,
    'the sentence quoted the raw open-question count instead of the reconciled one');
});

test('the sentence is a function of the FACTS ONLY - it cannot reach the raw rows', () => {
  // Structural proof of the guarantee. sentenceFor() takes the facts object and
  // nothing else, so feeding it facts derived from DIFFERENT raw data than the
  // caller rendered is impossible by shape: there is one derivation.
  const facts = countFacts({
    stage: 'NEEDS_DECISION', human_state: 'NEEDS_WARWICK',
    lines: [line(1)], questions: [question('q:1', { line_no: 1 })], items: [],
  });

  assert.equal(sentenceFor(facts), '1 decision still needs you.');
  assert.equal(facts.decisions_needing_warwick, 1);
  assert.ok(Object.isFrozen(facts), 'the facts must be frozen - a caller must not be able to make the ' +
    'counts and the sentence disagree by editing one after the fact');
});

// ---------------------------------------------------------------------
// Warwick's four worked examples, verbatim as the specification.
// ---------------------------------------------------------------------
test('"2 decisions still need you."', () => {
  const r = explainState({
    stage: 'NEEDS_DECISION', human_state: 'NEEDS_WARWICK',
    lines: [line(1), line(2)],
    questions: [question('a', { line_no: 1 }), question('b', { line_no: 2 })],
    items: [],
  });
  assert.equal(r.sentence, '2 decisions still need you.');
});

test('"Nothing needs you. AsdAIr is reconciling 3 products."', () => {
  const r = explainState({
    stage: 'PROCESSING', human_state: 'ASDAIR_WORKING',
    lines: [], questions: [],
    items: [{ status: 'requested' }, { status: 'requested' }, { status: 'pending' }],
  });
  assert.equal(r.sentence, 'Nothing needs you. AsdAIr is reconciling 3 products.');
});

test('"Everything is resolved. Ready to build the ASDA basket."', () => {
  const r = explainState({
    stage: 'READY_TO_SHOP', human_state: 'READY_FOR_WARWICK',
    lines: [line(1, { status: 'matched' })], questions: [], items: [{ status: 'added' }],
  });
  assert.equal(r.sentence, 'Everything is resolved. Ready to build the ASDA basket.');
});

test('"Basket build failed. Nothing was ordered."', () => {
  const r = explainState({
    stage: 'FAILED', human_state: 'FAILED', lines: [], questions: [], items: [],
  });
  assert.equal(r.sentence, 'Basket build failed. Nothing was ordered.');
});

// ---------------------------------------------------------------------
// The nuance the closed six-value set cannot carry.
// ---------------------------------------------------------------------
test('a CANCELLED shop says it was cancelled, not that it failed', () => {
  // CANCELLED maps to the FAILED bucket (Larry's override, safe direction),
  // which on its own would tell Warwick something broke. The sentence is where
  // the precision is restored, and this test is what keeps the two in step.
  const r = explainState({
    stage: 'CANCELLED', human_state: 'FAILED', lines: [], questions: [], items: [],
  });
  assert.equal(r.human_state, 'FAILED', 'the six-value bucket is unchanged');
  assert.equal(r.sentence, 'This shop was cancelled. Nothing was ordered.');
  assert.equal(/build failed/.test(r.sentence), false,
    'a deliberate cancellation must never be described to Warwick as a breakage');
});

test('a terminal shop is never dragged back by a stale open question', () => {
  const r = explainState({
    stage: 'CANCELLED', human_state: 'FAILED',
    lines: [], questions: [question('a'), question('b')], items: [],
  });
  assert.equal(r.sentence, 'This shop was cancelled. Nothing was ordered.',
    'nothing needs Warwick on a shop that will never move again');
});

// ---------------------------------------------------------------------
// Refusals - it explains the canonical state, it never invents one.
// ---------------------------------------------------------------------
test('it REFUSES to run without an already-resolved six-value state', () => {
  assert.throws(() => explainState({ stage: 'PROCESSING', human_state: 'WORKING' }),
    /is not one of the six/);
  assert.throws(() => explainState({ stage: 'PROCESSING' }), /is not one of the six/);
});

test('one decision is singular, two are plural - Warwick reads these', () => {
  const one = explainState({
    stage: 'NEEDS_DECISION', human_state: 'NEEDS_WARWICK',
    lines: [line(1)], questions: [question('a', { line_no: 1 })], items: [],
  });
  assert.equal(one.sentence, '1 decision still needs you.');
});

test('BROWSER_WORKING says the browser is working, not that AsdAIr is', () => {
  const r = explainState({
    stage: 'SHOPPING', human_state: 'BROWSER_WORKING', lines: [], questions: [], items: [],
  });
  assert.equal(r.sentence, 'Nothing needs you. The browser is building the ASDA basket.');
});

// ---------------------------------------------------------------------
// THE PRODUCTION JOIN KEY. asdair.shop_question carries `list_item_id`, not a
// line number - so a rule written only against `line_no` would be a no-op on
// every real request while passing any fixture that invented one.
// ---------------------------------------------------------------------
test('a stale question is suppressed by list_item_id, which is what production carries', () => {
  const r = explainState({
    stage: 'NEEDS_DECISION',
    human_state: 'NEEDS_WARWICK',
    lines: [],
    items: [
      { id: 501, status: 'added' },              // resolved
      { id: 502, status: 'excluded_this_week' }, // resolved (dropped this week)
      { id: 503, status: 'needs_decision' },     // genuinely open
    ],
    questions: [
      { question_key: 'q:a', status: 'open', list_item_id: 501 },
      { question_key: 'q:b', status: 'open', list_item_id: 502 },
      { question_key: 'q:c', status: 'open', list_item_id: 503 },
    ],
  });

  assert.equal(r.counts.decisions_needing_warwick, 1,
    'only the question about the unresolved item counts');
  assert.equal(r.counts.stale_questions_suppressed, 2);
  assert.equal(r.sentence, '1 decision still needs you.');
});

test('a bigint list_item_id arriving as a STRING still matches', () => {
  // `pg` returns bigint as a string. Comparing 501 === '501' would silently
  // fail to suppress anything, and the whole rule would quietly do nothing.
  const r = explainState({
    stage: 'NEEDS_DECISION', human_state: 'NEEDS_WARWICK', lines: [],
    items: [{ id: '501', status: 'added' }],
    questions: [{ question_key: 'q:a', status: 'open', list_item_id: 501 }],
  });
  assert.equal(r.counts.stale_questions_suppressed, 1);
  assert.equal(r.counts.decisions_needing_warwick, 0);
});

// ---------------------------------------------------------------------
// THE INVARIANT THAT WOULD HAVE CAUGHT IT SOONER.
//
// The badge and the sentence must never disagree about the ONE question
// Warwick actually asks: does this need me? Asserted across the whole state
// space rather than on the examples somebody thought to write.
// ---------------------------------------------------------------------
test('the six-value state and the sentence NEVER disagree about "does this need me?"', () => {
  const STATES = ['NEEDS_WARWICK', 'ASDAIR_WORKING', 'READY_FOR_WARWICK', 'BROWSER_WORKING', 'COMPLETE', 'FAILED'];
  const STAGES = ['RECEIVED', 'TRANSCRIBING', 'PROCESSING', 'NEEDS_DECISION', 'READY_TO_SHOP',
    'WAITING_FOR_BROWSER', 'SHOPPING', 'BASKET_READY', 'ORDER_CONFIRMATION_RECEIVED',
    'RECONCILED', 'FAILED', 'CANCELLED'];

  let checked = 0;
  for (const human_state of STATES) {
    for (const stage of STAGES) {
      for (const openQuestions of [0, 1]) {
        const questions = openQuestions === 1 ? [question('q', { line_no: 9 })] : [];
        const r = explainState({ stage, human_state, questions, lines: [], items: [] });
        checked++;

        const saysNothingNeeded = /^Nothing needs you\b/.test(r.sentence);

        if (human_state === 'NEEDS_WARWICK' && !['CANCELLED', 'FAILED', 'RECONCILED'].includes(stage)) {
          assert.equal(saysNothingNeeded, false,
            `${human_state}/${stage}/${openQuestions}q: the badge says Warwick is needed and the ` +
            `sentence says he is not - "${r.sentence}"`);
        }
      }
    }
  }

  // A loop that ran zero times would pass silently.
  assert.equal(checked, 6 * 12 * 2, 'the sweep did not cover the state space it claims to');
});
