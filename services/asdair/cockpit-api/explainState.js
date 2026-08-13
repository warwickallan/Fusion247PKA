// =====================================================================
// BUILD-015 AsdAIr - cockpit-api/explainState.js
//
// "WHY ISN'T MY BASKET READY?" - ONE TRUTHFUL SENTENCE (WP-B15-35 AC3).
//
// Warwick's own examples are the specification:
//   "2 decisions still need you."
//   "Nothing needs you. AsdAIr is reconciling 3 products."
//   "Everything is resolved. Ready to build the ASDA basket."
//   "Basket build failed. Nothing was ordered."
// And the prohibition that shapes the whole module:
//   "Never require Warwick to infer this from several counters."
//
// THE STRUCTURAL GUARANTEE, WHICH IS THE POINT OF THIS FILE
//
// A counter and the sentence CANNOT disagree, because they are not two
// computations that happen to agree - they are ONE computation, returned
// twice. `countFacts()` derives every number exactly once into a frozen facts
// object; `sentenceFor()` is then a PURE FUNCTION OF THAT OBJECT and has no
// access to the raw inputs at all. There is no path by which a sentence can be
// built from a different reading of the data than the counts the UI renders,
// because the raw data is out of scope by the time the sentence is written.
//
// That is deliberately a shape, not a convention. A later editor who wants the
// sentence to say something the counts do not must first change the counts.
//
// THE ONE PLACE THE COUNTS ARE DECIDED. Two rules matter and both come from
// real defects this Work Package was sent to fix:
//
//   * A QUESTION ABOUT AN ALREADY-RESOLVED LINE DOES NOT COUNT (AC5). "A
//     successfully reconciled line must NOT remain on the board through stale
//     needs-human state." If it does not count, it is not on the board and it
//     is not in the sentence - one decision, applied once, in one place.
//   * THE SIX-VALUE STATE IS NOT RECOMPUTED HERE. It arrives already resolved
//     from shop/humanState.js. This module explains it; it never re-derives
//     it, or there would be two answers to "what state is this shop in".
//
// PURE. No DB, no clock, no network, no randomness.
//
// PURE ASCII only.
// =====================================================================

'use strict';

const { isHumanState } = require('../shop/humanState');

function fail(message) {
  throw new Error('explainState: ' + message);
}

function count(list, predicate) {
  return (Array.isArray(list) ? list : []).filter(predicate).length;
}

/** Plural-safe "N thing" / "N things". English only; no locale machinery. */
function plural(n, singular, pluralWord) {
  return String(n) + ' ' + (n === 1 ? singular : (pluralWord || singular + 's'));
}

/**
 * PURE. Derive EVERY number this module will ever report, exactly once.
 *
 * @param {object} input
 * @param {Array}  input.questions   asdair.shop_question rows for this shop
 * @param {Array}  input.lines       asdair.shop_line rows for this shop
 * @param {Array}  input.items       asdair.shopping_list_items rows for the list
 * @param {string} input.stage       asdair.shop.status
 * @param {string} input.human_state the ALREADY-RESOLVED six-value state
 * @returns {object} frozen facts - the single source for both counts and prose
 */
function countFacts(input) {
  const i = input && typeof input === 'object' ? input : {};

  if (!isHumanState(i.human_state)) {
    fail('human_state "' + String(i.human_state) + '" is not one of the six. This module EXPLAINS the ' +
      'canonical state and must never derive one of its own - resolve it with shop/humanState.js first.');
  }

  const questions = Array.isArray(i.questions) ? i.questions : [];
  const lines = Array.isArray(i.lines) ? i.lines : [];
  const items = Array.isArray(i.items) ? i.items : [];

  // WHAT COUNTS AS RESOLVED, AND HOW A QUESTION IS JOINED TO IT.
  //
  // TWO JOIN KEYS, BOTH REAL, AND THE CHOICE IS NOT COSMETIC:
  //   * asdair.shop_question carries `list_item_id` - NOT a line number. That
  //     is the key production actually has (cockpit-api/readWorkspace.js's
  //     QUESTIONS_SQL selects it), so it is the primary join.
  //   * asdair.shop_line carries `line_no`, and a caller that has interpreted
  //     lines to hand may supply them; a question may then be matched by
  //     `line_no` where it genuinely carries one.
  //
  // Supporting only `line_no` would have made this whole rule a no-op on real
  // data while passing every fixture that invented one - a green proving
  // nothing, on the exact seam this Work Package exists to close.
  //
  // A line/item is RESOLVED once a human confirmed or corrected it, or the run
  // reached its own conclusion. `corrected` is the durable human confirmation
  // flag (shopLines.markCorrected writes it); `matched`, `added`, `not_added`
  // and `excluded_this_week` are conclusions the run or Warwick already
  // reached.
  const RESOLVED_ITEM_STATUSES = ['added', 'not_added', 'excluded_this_week'];

  const resolvedLineNos = new Set(
    lines.filter((l) => l && (l.corrected === true || l.status === 'matched'))
      .map((l) => Number(l.line_no))
      .filter((n) => Number.isInteger(n))
  );

  const resolvedItemIds = new Set(
    items.filter((it) => it && RESOLVED_ITEM_STATUSES.indexOf(it.status) !== -1)
      .map((it) => String(it.id))
      .filter((id) => id !== 'undefined' && id !== 'null')
  );

  // THE STALE-REFERRAL RULE (AC5). An open question whose subject has since
  // been resolved is NOT a decision that needs Warwick. It is dead state, and
  // it is reported separately so its existence is never hidden either.
  const openQuestions = questions.filter((q) => q && q.status === 'open');
  const stale = openQuestions.filter((q) => {
    if (q.list_item_id !== null && q.list_item_id !== undefined &&
        resolvedItemIds.has(String(q.list_item_id))) return true;
    const n = Number(q.line_no);
    return Number.isInteger(n) && resolvedLineNos.has(n);
  });
  const staleKeys = new Set(stale.map((q) => q.question_key));
  const live = openQuestions.filter((q) => !staleKeys.has(q.question_key));

  return Object.freeze({
    stage: i.stage,
    human_state: i.human_state,

    // THE NUMBER THAT DRIVES THE SENTENCE AND THE BADGE. One number.
    decisions_needing_warwick: live.length,

    // Reported so the stale state is visible rather than merely excluded.
    stale_questions_suppressed: stale.length,

    questions_answered: count(questions, (q) => q && q.status === 'answered'),
    questions_total: questions.length,

    lines_total: lines.length,
    lines_resolved: resolvedLineNos.size,
    lines_unresolved: count(lines, (l) => l && l.corrected !== true && l.status !== 'matched'),

    products_planned: count(items, (it) => it && it.status !== 'excluded_this_week' && it.status !== 'not_added'),
    products_reconciling: count(items, (it) => it && (it.status === 'requested' || it.status === 'pending')),
    products_skipped: count(items, (it) => it && it.status === 'excluded_this_week'),
  });
}

/**
 * PURE, AND FUNCTION OF THE FACTS ALONE. It cannot see the raw rows, so it
 * cannot count anything for itself - which is exactly why it cannot contradict
 * the counters.
 *
 * @param {object} facts the frozen object countFacts() returned
 * @returns {string} one sentence a human can act on
 */
function sentenceFor(facts) {
  const f = facts;

  // Terminal and failure states first: nothing about counts can make these
  // untrue, and a count-led sentence here would be actively misleading.
  if (f.stage === 'CANCELLED') {
    // The six-value set maps CANCELLED to FAILED (safe direction), which is
    // imprecise on its own. THIS is where the precision is restored.
    return 'This shop was cancelled. Nothing was ordered.';
  }
  if (f.stage === 'FAILED') {
    return 'Basket build failed. Nothing was ordered.';
  }
  if (f.stage === 'RECONCILED') {
    return 'This shop is finished and reconciled.';
  }

  if (f.decisions_needing_warwick > 0) {
    return plural(f.decisions_needing_warwick, 'decision') + ' still ' +
      (f.decisions_needing_warwick === 1 ? 'needs' : 'need') + ' you.';
  }

  // ── THE CONTRADICTION AC9 CAUGHT AGAINST REAL DATA (2026-08-13) ──────────
  //
  // Live shop SHOP-2026-08-11-M93: stage WAITING_FOR_BROWSER, needs_review
  // TRUE, and ZERO open questions. The six-value state was NEEDS_WARWICK (the
  // durable flag escalates it, correctly), while the sentence fell through to
  // "Nothing needs you. AsdAIr is reconciling 33 products."
  //
  // That is EXACTLY the contradiction this module exists to make impossible -
  // the badge saying Warwick is needed and the sentence saying he is not - and
  // no fixture had produced it, because every fixture that set NEEDS_WARWICK
  // also gave it a question to count. Found only by starting the service
  // against the real database, which is why AC9 is an acceptance criterion.
  //
  // The honest sentence names the real situation: the shop is flagged for
  // review with no specific question raised (stages.js's AWAIT_LINE_RESOLUTION
  // fail-safe is the path that produces it).
  if (f.human_state === 'NEEDS_WARWICK') {
    return 'This shop is flagged for your review, but no question has been opened yet.';
  }

  if (f.human_state === 'BROWSER_WORKING') {
    return 'Nothing needs you. The browser is building the ASDA basket.';
  }

  if (f.human_state === 'READY_FOR_WARWICK') {
    if (f.stage === 'BASKET_READY') return 'Everything is resolved. The basket is built and ready for you to check.';
    return 'Everything is resolved. Ready to build the ASDA basket.';
  }

  if (f.products_reconciling > 0) {
    return 'Nothing needs you. AsdAIr is reconciling ' + plural(f.products_reconciling, 'product') + '.';
  }

  if (f.lines_unresolved > 0) {
    return 'Nothing needs you. AsdAIr is working through ' + plural(f.lines_unresolved, 'line') + '.';
  }

  return 'Nothing needs you. AsdAIr is working.';
}

/**
 * The whole answer, in one call. Returns the counts AND the sentence built
 * from those same counts.
 *
 * `sentence` is what Warwick reads. `counts` is what the UI renders beside it.
 * They are the same arithmetic.
 */
function explainState(input) {
  const facts = countFacts(input);
  return {
    human_state: facts.human_state,
    sentence: sentenceFor(facts),
    counts: facts,
  };
}

module.exports = {
  explainState: explainState,
  countFacts: countFacts,
  sentenceFor: sentenceFor,
};
