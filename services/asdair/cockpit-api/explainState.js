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
// access to the raw inputs at all.
//
// ⚠️ SINCE WP-B15-41 THAT DERIVATION LIVES IN shopArithmetic.js, because the
// same facts are published by four blocks of the payload and four derivations
// is four answers (AC6). `countFacts` here is a re-export of it, not a copy.
// There is no path by which a sentence can be
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

const { countShop } = require('./shopArithmetic');

/** Plural-safe "N thing" / "N things". English only; no locale machinery. */
function plural(n, singular, pluralWord) {
  return String(n) + ' ' + (n === 1 ? singular : (pluralWord || singular + 's'));
}

/**
 * PURE. Derive EVERY number this module will ever report, exactly once.
 *
 * ⚠️ THE DERIVATION MOVED (WP-B15-41 AC6). It now lives in shopArithmetic.js,
 * and this is a re-export rather than a second implementation.
 *
 * WHY IT MOVED, because "we refactored it" is not a reason worth a comment.
 * This function was the single source for the SENTENCE and for `why.counts`,
 * and it did that job correctly. But the payload publishes the same facts in
 * three other blocks - buildQuestions' open/resolved counts, buildPlan's
 * held/resolved/excluded, and the new AC1 `this_week` summary - and each of
 * those was deriving its own. Four derivations that agree on the fixtures
 * somebody wrote are four answers waiting for the input that separates them,
 * and AC6 exists because two of them separating is a defect rather than a
 * rounding difference.
 *
 * So the derivation is now one function that every publication point projects,
 * and the structural guarantee below is unchanged and unweakened: sentenceFor()
 * still cannot see the raw rows, so it still cannot count anything for itself.
 *
 * Signature and every field name are unchanged, deliberately - this is a move,
 * not a redesign, and no existing caller or proof needed editing to accept it.
 */
const countFacts = countShop;

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
  // AC6. A caller that has ALREADY derived the facts passes them in rather than
  // paying for a second derivation - and, more to the point, rather than
  // creating one. assembleWorkspace does exactly this: it derives once and every
  // block of the payload, this sentence included, projects that one object.
  const facts = (input && input.facts) ? input.facts : countFacts(input);
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
