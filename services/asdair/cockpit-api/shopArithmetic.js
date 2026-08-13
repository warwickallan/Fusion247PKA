// =====================================================================
// BUILD-015 AsdAIr - cockpit-api/shopArithmetic.js
//
// THE ONE ARITHMETIC SOURCE (WP-B15-41 AC6).
//
// ⛔ EVERY NUMBER THE COCKPIT PUBLISHES ABOUT THIS WEEK'S SHOP IS DERIVED
//    HERE, ONCE, INTO ONE FROZEN OBJECT. Nothing downstream counts anything
//    for itself.
//
// THE DEFECT THIS CLOSES, STATED AS A RULE:
//
//   "Two endpoints disagreeing about how many things need Warwick is a
//    defect, not a rounding difference."
//
// Before this module the counts were derived in at least four places -
// explainState.countFacts (the sentence and `why.counts`), buildQuestions
// (open_count_display / resolved_count_display), buildPlan (held/resolved/
// excluded) and shopStatus's own lines summary. Four derivations that agreed
// on the fixtures anyone happened to write. Four derivations is four answers
// waiting for the input that separates them.
//
// So this file holds the ONE derivation, and the publication points became
// projections of it. A later editor who wants one block to say something
// different must change the number HERE, which changes it everywhere - which
// is the whole point, and is why the invariant is a shape rather than a
// convention.
//
// ── WHAT "ONE SOURCE" MEANS PRECISELY, BECAUSE IT IS EASY TO OVERCLAIM ─────
//
// It means every count-bearing block of a SINGLE served payload projects this
// object. It does NOT mean two endpoints reading two different moments in time
// must produce equal numbers: /asdair/checklist renders a STORED ARTEFACT
// frozen at handover, and the live shop legitimately moves on afterwards.
// Those two can differ, and pretending otherwise would be a lie of a different
// kind. What this module guarantees is that they use the SAME DEFINITION of
// held / blocking / resolved (see heldPredicate below), so a difference is
// always a real difference in the data and never a difference in the counting.
//
// PURE. No DB, no clock, no network, no randomness.
//
// PURE ASCII only.
// =====================================================================

'use strict';

const { isHumanState } = require('../shop/humanState');

function fail(message) {
  throw new Error('shopArithmetic: ' + message);
}

function arr(value) {
  return Array.isArray(value) ? value : [];
}

function count(list, predicate) {
  return arr(list).filter(predicate).length;
}

function idKey(value) {
  return value === null || value === undefined || value === '' ? null : String(value);
}

// ---------------------------------------------------------------------
// THE SHARED VOCABULARY. Every consumer imports these rather than restating
// the status strings, so "held" cannot come to mean two things.
// ---------------------------------------------------------------------

/** asdair.shopping_list_items.status values that mean "the planner did not
 *  settle this line" - the exception board's population. */
const HELD_ITEM_STATUSES = Object.freeze(['requested', 'needs_decision']);

/** ...that mean "deliberately not bought this week". */
const SKIPPED_ITEM_STATUSES = Object.freeze(['excluded_this_week', 'not_added']);

/** ...that mean the run or Warwick reached a conclusion. */
const RESOLVED_ITEM_STATUSES = Object.freeze(['added', 'not_added', 'excluded_this_week']);

/** asdair.shop_question.status. The DATABASE constrains this column to exactly
 *  these three (migration 006: CHECK (status = ANY (ARRAY['open','answered',
 *  'skipped'])), NOT NULL DEFAULT 'open'), so a value outside this set can only
 *  arrive from a caller that did not read the column. See classifyQuestion. */
const QUESTION_STATUSES = Object.freeze(['open', 'answered', 'skipped']);

/**
 * THE ONE PREDICATE FOR "IS THIS LINE HELD".
 *
 * Exported so the live reader and the stored-artefact reader ask the SAME
 * question of their different data. That is the half of AC6 that survives the
 * two endpoints legitimately reading two different moments.
 */
function isHeldItem(item) {
  return !!item && HELD_ITEM_STATUSES.indexOf(item.status) !== -1;
}

/**
 * THE ONE CLASSIFIER FOR A QUESTION'S STATUS (WP-B15-41 AC4).
 *
 * ── WHAT THIS IS, AND WHAT IT IS NOT. READ THIS BEFORE CHANGING IT. ────────
 *
 * This is HARDENING AGAINST AN INPUT THE SCHEMA CURRENTLY FORBIDS. It is NOT
 * a fix for an observed live defect, and no return, comment or test may imply
 * that it is.
 *
 * Established by execution against the migration set on 2026-08-13:
 *   asdair.shop_question.status is NOT NULL, DEFAULT 'open', with
 *   CHECK (status = ANY (ARRAY['open','answered','skipped'])).
 * So a NULL status CANNOT exist in that table, and readWorkspace's QUESTIONS_SQL
 * always selects the column. The only route to an absent value is a caller that
 * omitted it - a fixture, or a future reader with a narrower SELECT.
 *
 * The real defect this closes is NOT "a NULL reads as needing a human". It is
 * the opposite shape: an unrecognised status matched NEITHER the open filter
 * (`status === undefined || status === 'open'`) NOR the resolved filter
 * (`'answered' || 'skipped'`), so such a question VANISHED FROM BOTH BUCKETS -
 * silently under-reporting open_count AND resolved_count. A question that
 * disappears from the arithmetic is precisely what AC6 exists to prevent, so
 * it belongs here rather than in a follow-up.
 *
 * Note also that `null === undefined` is FALSE in JavaScript, so the previous
 * `status === undefined` test never caught a NULL in the first place.
 *
 * @returns {'open'|'answered'|'skipped'|'unknown'} never undefined, never null
 */
function classifyQuestion(question) {
  const s = question ? question.status : undefined;
  if (s === undefined) {
    // A caller that did not read the column at all. Treated as OPEN, because a
    // question nobody can show is settled is still a question - and because
    // this is the shape every pre-existing fixture uses.
    return 'open';
  }
  if (QUESTION_STATUSES.indexOf(s) !== -1) return s;
  // NULL, '', or anything the CHECK constraint forbids. NOT open - an unknown
  // status is not evidence that Warwick is needed - but NOT silently dropped
  // either: it is counted and reported under its own name.
  return 'unknown';
}

/** The brand string the packet's sort contract uses to push unbranded lines
 *  last. IT IS A SORT KEY, NOT A BRAND, and is never rendered as one - see
 *  presentBrand(). Observed on all 8 held lines of the real 2026-08-13 shop. */
const BRAND_SORT_SENTINEL = 'ZZ (no brand recorded)';
const BRAND_SENTINEL_RE = /^\s*zz\s*\(\s*no\s+brand/i;

/**
 * Is this brand value the sort sentinel rather than a real brand?
 *
 * Matched by PATTERN as well as by exact string, because the producer writes
 * the literal and a reader must not be defeated by a stray space or a case
 * change. A false negative here puts "ZZ (no brand recorded)" on Warwick's
 * shopping list as if it were a manufacturer.
 */
function isBrandSentinel(brand) {
  if (brand === null || brand === undefined) return false;
  const s = String(brand);
  return s === BRAND_SORT_SENTINEL || BRAND_SENTINEL_RE.test(s);
}

/**
 * A brand, split into what it SORTS as and what it READS as.
 *
 * `sort_key` keeps the sentinel so the producer's declared brand_az_then_
 * product_az order is preserved exactly. `display` refuses it, because the
 * sentinel means "no brand was recorded" and that is an unknown, not a name.
 */
function presentBrand(brand) {
  const sentinel = isBrandSentinel(brand);
  const missing = brand === null || brand === undefined || String(brand).trim() === '';
  return {
    known: !sentinel && !missing,
    value: sentinel || missing ? null : String(brand),
    // 'unknown' is present.js's vocabulary for an absent fact, restated here
    // rather than imported so this module stays free of presentation deps.
    display: sentinel || missing ? 'unknown' : String(brand),
    is_sentinel: sentinel,
    // NULL and the sentinel both sort LAST, per the packet's own contract.
    sort_key: sentinel || missing ? '￿' : String(brand).trim().toLowerCase(),
  };
}

// ---------------------------------------------------------------------
// THE ONE DERIVATION.
// ---------------------------------------------------------------------

/**
 * PURE. Derive EVERY number the cockpit reports about one shop, exactly once.
 *
 * Formerly explainState.countFacts, which is now a thin re-export of this so
 * there is one derivation rather than two that agree today.
 *
 * @param {object} input
 * @param {Array}  input.questions   asdair.shop_question rows for this shop
 * @param {Array}  input.lines       asdair.shop_line rows for this shop
 * @param {Array}  input.items       asdair.shopping_list_items rows for the list
 * @param {string} input.stage       asdair.shop.status
 * @param {string} input.human_state the ALREADY-RESOLVED six-value state
 * @param {object} [input.provenance] computeProvenance() output, when available
 * @returns {object} frozen facts - the single source for every published count
 */
function countShop(input) {
  const i = input && typeof input === 'object' ? input : {};

  if (!isHumanState(i.human_state)) {
    fail('human_state "' + String(i.human_state) + '" is not one of the six. This module counts for the ' +
      'canonical state and must never derive one of its own - resolve it with shop/humanState.js first.');
  }

  const questions = arr(i.questions);
  const lines = arr(i.lines);
  const items = arr(i.items);
  const prov = i.provenance && typeof i.provenance === 'object' ? i.provenance : null;

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
  // nothing, on the exact seam this rule exists to close.
  const resolvedLineNos = new Set(
    lines.filter((l) => l && (l.corrected === true || l.status === 'matched'))
      .map((l) => Number(l.line_no))
      .filter((n) => Number.isInteger(n))
  );

  const resolvedItemIds = new Set(
    items.filter((it) => it && RESOLVED_ITEM_STATUSES.indexOf(it.status) !== -1)
      .map((it) => idKey(it.id))
      .filter((id) => id !== null)
  );

  // EVERY question lands in exactly ONE bucket. The four buckets are total, so
  // open + answered + skipped + unknown === questions.length ALWAYS, and no
  // question can fall out of the arithmetic (AC4).
  const byStatus = { open: [], answered: [], skipped: [], unknown: [] };
  questions.forEach((q) => { byStatus[classifyQuestion(q)].push(q); });

  // THE STALE-REFERRAL RULE. An open question whose subject has since been
  // resolved is NOT a decision that needs Warwick. It is dead state, and it is
  // reported separately so its existence is never hidden either.
  const stale = byStatus.open.filter((q) => {
    if (q.list_item_id !== null && q.list_item_id !== undefined &&
        resolvedItemIds.has(idKey(q.list_item_id))) return true;
    const n = Number(q.line_no);
    return Number.isInteger(n) && resolvedLineNos.has(n);
  });
  const staleKeys = new Set(stale.map((q) => q.question_key));
  const live = byStatus.open.filter((q) => !staleKeys.has(q.question_key));

  const heldItems = items.filter(isHeldItem);

  const facts = {
    stage: i.stage,
    human_state: i.human_state,

    // ── THE NUMBER THAT DRIVES THE SENTENCE, THE BADGE AND THE BOARD ───────
    // One number. Every "N need you" anywhere in the payload is this.
    decisions_needing_warwick: live.length,

    // Reported so the stale state is visible rather than merely excluded.
    stale_questions_suppressed: stale.length,

    questions_open: byStatus.open.length,
    questions_answered: byStatus.answered.length,
    questions_skipped: byStatus.skipped.length,
    // AC4. A status the schema forbids. Counted and NAMED rather than dropped:
    // it is normally 0, and a non-zero value is a real signal about the caller.
    questions_unknown_status: byStatus.unknown.length,
    questions_total: questions.length,

    lines_total: lines.length,
    lines_resolved: resolvedLineNos.size,
    lines_unresolved: count(lines, (l) => l && l.corrected !== true && l.status !== 'matched'),

    // GENUINELY UNCERTAIN (AC1) - the planner did not settle these. A different
    // population from `decisions_needing_warwick`: a held line may carry no
    // open question yet, and an open question may sit on a settled line.
    uncertain_lines: heldItems.length,

    products_planned: count(items, (it) => it && it.status !== 'excluded_this_week' && it.status !== 'not_added'),
    products_reconciling: count(items, (it) => it && (it.status === 'requested' || it.status === 'pending')),
    products_skipped: count(items, (it) => it && it.status === 'excluded_this_week'),
  };

  // ── AC1: THE WHOLE-SHOP FIGURES, FROM THE PROVENANCE PASS ────────────────
  // computeProvenance already derives these from the same rows. They are copied
  // in rather than recomputed, so `this_week` and `provenance` cannot disagree.
  // A caller that supplied no provenance gets nulls - never zeros, because
  // "nobody counted" is not "we counted none".
  facts.source_lines = prov ? prov.source_lines : null;
  facts.final_products = prov ? prov.final_products : null;
  facts.final_items = prov ? prov.final_items : null;
  facts.reconciled_products = prov ? prov.reconciled_products : null;
  facts.provenance_counts = prov ? Object.freeze(Object.assign({}, prov.counts)) : null;
  facts.provenance_unattributed = prov ? prov.unattributed : null;

  return Object.freeze(facts);
}

module.exports = {
  countShop: countShop,
  classifyQuestion: classifyQuestion,
  isHeldItem: isHeldItem,
  isBrandSentinel: isBrandSentinel,
  presentBrand: presentBrand,
  BRAND_SORT_SENTINEL: BRAND_SORT_SENTINEL,
  HELD_ITEM_STATUSES: HELD_ITEM_STATUSES,
  SKIPPED_ITEM_STATUSES: SKIPPED_ITEM_STATUSES,
  RESOLVED_ITEM_STATUSES: RESOLVED_ITEM_STATUSES,
  QUESTION_STATUSES: QUESTION_STATUSES,
};
