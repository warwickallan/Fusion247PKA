// BUILD-015 WP-B15-41 - cockpit-api/shopArithmetic.test.js
//
// THE ONE ARITHMETIC SOURCE, AND THE PROOF THAT IT IS ONE (AC4, AC5, AC6).
//
// The important test in this file is the MUTATION PROOF at the bottom. Every
// other assertion here says "the invariant holds"; that one says "and the
// check can actually fail", which is the only thing that makes the rest of
// them evidence rather than decoration.
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const A = require('./shopArithmetic');
const { assembleWorkspace } = require('./assembleWorkspace');

// ---------------------------------------------------------------------
// AC4 - EVERY QUESTION LANDS IN EXACTLY ONE BUCKET.
//
// ⚠️ HARDENING, NOT A LIVE-DEFECT FIX. asdair.shop_question.status is
// NOT NULL DEFAULT 'open' with CHECK (status IN ('open','answered','skipped'))
// - verified against the migration set on 2026-08-13 - so the database CANNOT
// produce the inputs below. They can only come from a caller that did not read
// the column. These prove the read layer is robust either way; they prove
// nothing about a stale signal existing upstream, and must not be cited as if
// they did.
// ---------------------------------------------------------------------
test('AC4: classifyQuestion is TOTAL - every input lands in exactly one of four buckets', () => {
  assert.equal(A.classifyQuestion({ status: 'open' }), 'open');
  assert.equal(A.classifyQuestion({ status: 'answered' }), 'answered');
  assert.equal(A.classifyQuestion({ status: 'skipped' }), 'skipped');

  // A caller that never read the column. Treated as open - a question nobody
  // can show is settled is still a question.
  assert.equal(A.classifyQuestion({}), 'open');
  assert.equal(A.classifyQuestion({ status: undefined }), 'open');

  // NULL and friends: NOT open, and NOT silently dropped.
  assert.equal(A.classifyQuestion({ status: null }), 'unknown');
  assert.equal(A.classifyQuestion({ status: '' }), 'unknown');
  assert.equal(A.classifyQuestion({ status: 'pending' }), 'unknown');
  assert.equal(A.classifyQuestion(null), 'open');
});

test('AC4: a NULL status is NOT counted as needing a human', () => {
  const facts = A.countShop({
    stage: 'PROCESSING',
    human_state: 'ASDAIR_WORKING',
    questions: [{ id: 1, question_key: 'q1', status: null }],
    lines: [],
    items: [],
  });
  assert.equal(facts.decisions_needing_warwick, 0, 'a NULL status must never read as still-needing-you');
  assert.equal(facts.questions_open, 0);
});

test('AC4: THE REAL DEFECT - a question with an unrecognised status never vanishes from the arithmetic', () => {
  const questions = [
    { id: 1, question_key: 'q1', status: 'open' },
    { id: 2, question_key: 'q2', status: 'answered' },
    { id: 3, question_key: 'q3', status: 'skipped' },
    { id: 4, question_key: 'q4', status: null },
    { id: 5, question_key: 'q5', status: 'nonsense' },
  ];
  const facts = A.countShop({
    stage: 'PROCESSING', human_state: 'ASDAIR_WORKING', questions: questions, lines: [], items: [],
  });

  // THE ASSERTION THAT MATTERS. The old filters were not total, so q4 and q5
  // were counted in NEITHER bucket and both published counts under-reported.
  const bucketed = facts.questions_open + facts.questions_answered
    + facts.questions_skipped + facts.questions_unknown_status;
  assert.equal(bucketed, questions.length,
    'every question must be in exactly one bucket - one falling out is a silently wrong count');
  assert.equal(facts.questions_unknown_status, 2, 'the two odd statuses are counted and named, not dropped');
  assert.equal(facts.questions_total, 5);
});

test('AC4: the unknown-status questions are LISTED in the payload, not merely counted', () => {
  const p = assembleWorkspace(workspaceInput({
    questions: [{ id: 9, question_key: 'q-odd', question_text: 'which one?', status: null }],
  }));
  assert.equal(p.questions.unknown_status_count_display, '1');
  assert.equal(p.questions.unknown_status.length, 1);
  assert.equal(p.questions.unknown_status[0].question_key, 'q-odd');
  // It is in neither of the two normal buckets.
  assert.equal(p.questions.items.length, 0);
  assert.equal(p.questions.resolved.length, 0);
});

// ---------------------------------------------------------------------
// AC5 - THE BRAND SENTINEL IS A SORT KEY, NEVER A BRAND.
// ---------------------------------------------------------------------
test('AC5: "ZZ (no brand recorded)" is recognised as the sort sentinel, not a brand', () => {
  assert.equal(A.isBrandSentinel('ZZ (no brand recorded)'), true);
  // Whitespace and case must not defeat it. A false negative here PRINTS the
  // sentinel on the list Warwick shops from, as a manufacturer.
  assert.equal(A.isBrandSentinel('  zz (no brand recorded)  '), true);
  assert.equal(A.isBrandSentinel('ZZ  ( no brand recorded )'), true);
  // And it must not swallow a real brand that merely starts with those letters.
  assert.equal(A.isBrandSentinel('Zzzquil'), false);
  assert.equal(A.isBrandSentinel('Arla'), false);
  assert.equal(A.isBrandSentinel(null), false);
});

test('AC5: presentBrand refuses to DISPLAY the sentinel while still SORTING by it', () => {
  const s = A.presentBrand(A.BRAND_SORT_SENTINEL);
  assert.equal(s.display, 'unknown', 'the sentinel must never be rendered as a brand name');
  assert.equal(s.known, false);
  assert.equal(s.value, null);
  assert.equal(s.is_sentinel, true);

  const real = A.presentBrand('Arla');
  assert.equal(real.display, 'Arla');
  assert.equal(real.known, true);

  // Sorting is preserved: an unbranded line still sorts LAST.
  assert.ok(s.sort_key > real.sort_key, 'unbranded lines must still sort after branded ones');
});

test('AC5: the final list is brand-sorted, and no served brand is ever the sentinel', () => {
  const p = assembleWorkspace(workspaceInput({
    status: statusWith({ list_id: 55 }),
    list_items: [
      { id: 1, line_no: 1, item_name: 'sausage rolls', matched_regular_id: 13, requested_qty: 1, status: 'added' },
      { id: 2, line_no: 2, item_name: 'milk', matched_regular_id: 11, requested_qty: 3, status: 'added' },
      { id: 3, line_no: 3, item_name: 'weetabix', matched_regular_id: 12, requested_qty: 2, status: 'added' },
      // No catalogue match at all -> no brand -> must sort last and read unknown.
      { id: 4, line_no: 4, item_name: 'mystery item', matched_regular_id: null, requested_qty: 1, status: 'added' },
    ],
  }));

  const brands = p.final_list.lines.map((l) => l.brand_display);
  assert.deepEqual(brands, ['Arla', 'Walls', 'Weetabix', 'unknown'],
    'brand A-Z with unbranded last');

  p.final_list.lines.forEach((l) => {
    assert.notEqual(l.brand_display, A.BRAND_SORT_SENTINEL,
      'the sort sentinel must never reach a display field');
    assert.ok(!/no brand recorded/i.test(l.brand_display),
      'no served brand may contain the sentinel wording');
  });

  assert.equal(p.final_list.sort_contract, 'brand_az_then_product_az');
  assert.equal(p.final_list.lines_count_display, '4');
  assert.equal(p.final_list.units_count_display, '7');
});

test('AC5: exceptions are a SEPARATE collection and never appear in the final list', () => {
  const p = assembleWorkspace(workspaceInput({
    status: statusWith({ list_id: 55 }),
    list_items: [
      { id: 1, line_no: 1, item_name: 'milk', matched_regular_id: 11, requested_qty: 1, status: 'added' },
      { id: 2, line_no: 2, item_name: 'that sauce', matched_regular_id: null, requested_qty: 1, status: 'needs_decision' },
    ],
  }));
  assert.equal(p.final_list.lines.length, 1, 'a held line is not something to put in a trolley');
  assert.equal(p.final_list.lines[0].as_written_display, 'milk');
  assert.equal(p.exceptions.count_display, '1');
  assert.equal(p.exceptions.items[0].as_written_display, 'that sauce');
});

// ---------------------------------------------------------------------
// AC2 - THE EXCEPTION BOARD AND ITS JOIN KEY.
// ---------------------------------------------------------------------
test('AC2: every held line publishes the question_key a board joins on', () => {
  const p = assembleWorkspace(workspaceInput({
    status: statusWith({ list_id: 55 }),
    list_items: [
      { id: 2, line_no: 2, item_name: 'that sauce', matched_regular_id: null, requested_qty: 1, status: 'needs_decision' },
    ],
    questions: [
      { id: 91, question_key: 'q1111427e', list_item_id: 2, question_text: 'which sauce?', status: 'open',
        candidates: [{ id: 11 }, { id: 12 }] },
    ],
  }));
  const item = p.exceptions.items[0];
  assert.equal(item.question_key, 'q1111427e', 'THE join key Lane D needs');
  assert.equal(item.question_id, 91);
  assert.equal(item.can_answer_now, true);
  assert.equal(item.alternatives.length, 2, 'the candidates are reachable from the held line');
  assert.equal(item.alternatives[0].label_display, 'Arla semi skimmed 4pt');
  assert.equal(item.why_uncertain_display, 'AsdAIr could not settle which product you meant.');
});

test('AC2: a held line with no question yet carries a NULL key, never an invented one', () => {
  const p = assembleWorkspace(workspaceInput({
    status: statusWith({ list_id: 55 }),
    list_items: [
      { id: 3, line_no: 3, item_name: 'unreadable thing', matched_regular_id: null, requested_qty: 1, status: 'requested' },
    ],
  }));
  const item = p.exceptions.items[0];
  assert.equal(item.question_key, null);
  assert.equal(item.question_key_display, 'unknown');
  assert.equal(item.can_answer_now, false);
  assert.deepEqual(item.allowed_replies, [], 'no reply may be offered with no question behind it');
});

test('AC2 / FINDING F: the image region is structurally present and EMPTY, and says which producer owes it', () => {
  const p = assembleWorkspace(workspaceInput({
    status: statusWith({ list_id: 55 }),
    list_items: [
      { id: 2, line_no: 2, item_name: 'that sauce', matched_regular_id: null, requested_qty: 1, status: 'needs_decision' },
    ],
  }));
  const region = p.exceptions.items[0].image_region;
  assert.equal(region.known, false);
  assert.equal(region.region_id_display, 'unknown', 'never a fabricated region id');
  assert.match(region.pending, /Lane AB/, 'the payload names who owes this, so a gap is actionable');
});

// ---------------------------------------------------------------------
// AC7 - CORROBORATED, NEVER VERIFIED.
// ---------------------------------------------------------------------
test('AC7: corroboration output NEVER uses the word "verified", on any branch', () => {
  const { corroborationFor } = require('./assembleWorkspace')._internal;
  const cases = [
    undefined, null, {},
    { support: 3, support_of: 3, support_class: 'unanimous' },
    { support: 2, support_of: 3, support_class: 'majority' },
    { support: 1, support_of: 3, support_class: 'single' },
    { support: 'x', support_of: 0, support_class: 'nonsense' },
  ];
  cases.forEach((c) => {
    const out = corroborationFor(c);

    // Every field EXCEPT the caveat must be free of the word. The caveat is the
    // one place it legitimately appears, because there it DENIES verification -
    // and an earlier version of this test swept the whole object and therefore
    // failed on its own disclaimer, which would have been a genuinely silly
    // reason to delete the most honest sentence in the payload.
    const withoutCaveat = Object.assign({}, out);
    delete withoutCaveat.caveat;
    assert.ok(!/verif/i.test(JSON.stringify(withoutCaveat)),
      'corroboration output must never claim verification: ' + JSON.stringify(out));

    // And the denial must actually be there, on every branch.
    assert.match(out.caveat, /corroboration, not verification/);
    assert.ok(!/\bis verified\b|\bverified by\b/i.test(out.caveat),
      'the caveat must DENY verification, never assert it');
  });
});

test('AC7: 2-of-3 agreement reads as corroboration with its numbers intact', () => {
  const { corroborationFor } = require('./assembleWorkspace')._internal;
  const out = corroborationFor({ support: 2, support_of: 3, support_class: 'majority' });
  assert.equal(out.known, true);
  assert.equal(out.label, 'corroborated by 2 of 3 readings');
  assert.equal(out.support_class_meaning, 'most readings agreed');
});

test('AC7: absent agreement data reads as unknown, never as agreement', () => {
  const { corroborationFor } = require('./assembleWorkspace')._internal;
  const out = corroborationFor(null);
  assert.equal(out.known, false);
  assert.equal(out.label, 'corroboration unknown');
  assert.equal(out.support_display, 'unknown');
});

// ---------------------------------------------------------------------
// AC1 - THIS WEEK'S SHOP, ONE PAYLOAD, VERDICT READ NOT DERIVED.
// ---------------------------------------------------------------------
test('AC1: the verdict is the STORED human_state and reports that it was read, not derived', () => {
  const p = assembleWorkspace(workspaceInput({
    status: statusWith({ human_state: 'NEEDS_WARWICK', human_state_source: 'column' }),
  }));
  assert.equal(p.this_week.verdict, 'NEEDS_WARWICK');
  assert.equal(p.this_week.verdict_is_stored_value, true);
  assert.equal(p.this_week.verdict_source_display, 'column');
  assert.match(p.this_week.verdict_note, /never re-derives/);
});

test('AC1: a stored verdict OVERRIDES what the row counts would have suggested', () => {
  // Zero open questions. A count-led derivation would say "nothing needs you";
  // the durable column says otherwise, and the column is the answer. This is
  // the whole point of migration 020.
  const p = assembleWorkspace(workspaceInput({
    status: statusWith({ stage: 'WAITING_FOR_BROWSER', human_state: 'NEEDS_WARWICK', human_state_source: 'column' }),
    questions: [],
  }));
  assert.equal(p.this_week.verdict, 'NEEDS_WARWICK');
  assert.equal(p.this_week.blocking_decisions_display, '0');
  assert.equal(p.shop.canonical_state, 'NEEDS_WARWICK');
});

// ---------------------------------------------------------------------
// AC1 + LANE F's FINDING - human_state HAS NO TRIGGER AND CAN DRIFT.
//
// Migration 020 backfills the column once and installs no trigger, so any
// writer that updates `status` without updating `human_state` in the same
// transaction leaves them disagreeing. Lane F proved it: a row inserted with
// status READY_TO_SHOP came back human_state ASDAIR_WORKING - which is exactly
// the pair below.
//
// The read layer's job is to SEE it, not to fix it. The fix is a trigger or a
// write-path change, which is Silas's schema decision and outside this surface.
// ---------------------------------------------------------------------
test('LANE F: a stored verdict that contradicts status is DETECTED and reported', () => {
  const p = assembleWorkspace(workspaceInput({
    status: statusWith({ stage: 'READY_TO_SHOP', human_state: 'ASDAIR_WORKING', human_state_source: 'column' }),
  }));

  // THE VERDICT IS STILL THE STORED VALUE. The reader does not second-guess it.
  assert.equal(p.this_week.verdict, 'ASDAIR_WORKING');
  assert.equal(p.shop.canonical_state, 'ASDAIR_WORKING');

  // ...and the disagreement is visible rather than papered over.
  assert.equal(p.this_week.verdict_drift_checked, true);
  assert.equal(p.this_week.verdict_agrees_with_status, false);
  assert.equal(p.this_week.verdict_expected_from_status_display, 'READY_FOR_WARWICK');
  assert.match(p.this_week.verdict_contradiction, /NO trigger/);
  assert.match(p.this_week.verdict_contradiction, /Neither has been preferred here/);
});

test('LANE F: an agreeing pair reports agreement without noise', () => {
  const p = assembleWorkspace(workspaceInput({
    status: statusWith({ stage: 'READY_TO_SHOP', human_state: 'READY_FOR_WARWICK', human_state_source: 'column' }),
  }));
  assert.equal(p.this_week.verdict_drift_checked, true);
  assert.equal(p.this_week.verdict_agrees_with_status, true);
  assert.equal(p.this_week.verdict_contradiction, null);
});

test('LANE F: a DERIVED verdict cannot drift, and is reported as unchecked rather than as agreement', () => {
  // One source means nothing to disagree with. `null` here says "not checked",
  // which is a different claim from "checked and agreed" - and conflating the
  // two is how a hazard stops being visible.
  const p = assembleWorkspace(workspaceInput({
    status: statusWith({ stage: 'READY_TO_SHOP', human_state: 'READY_FOR_WARWICK', human_state_source: 'derived' }),
  }));
  assert.equal(p.this_week.verdict_drift_checked, false);
  assert.equal(p.this_week.verdict_agrees_with_status, null);
});

test('LANE F: needs_review escalation is compared like-for-like, not as a false disagreement', () => {
  // needs_review escalates any live stage to NEEDS_WARWICK in the shared
  // mapping. Comparing without it would report drift on every flagged shop -
  // a detector that cries wolf is one people switch off.
  const p = assembleWorkspace(workspaceInput({
    status: statusWith({ stage: 'PROCESSING', needs_review: true, human_state: 'NEEDS_WARWICK', human_state_source: 'column' }),
  }));
  assert.equal(p.this_week.verdict_agrees_with_status, true, 'the escalation is part of the mapping, not drift');
});

test('AC1: one payload carries source lines, products, units, provenance, skipped, uncertain and blocking', () => {
  const p = assembleWorkspace(workspaceInput({
    status: statusWith({ list_id: 55 }),
    list_items: [
      { id: 1, line_no: 1, item_name: 'milk', matched_regular_id: 11, requested_qty: 2, status: 'added' },
      { id: 2, line_no: 2, item_name: 'that sauce', matched_regular_id: null, requested_qty: 1, status: 'needs_decision' },
      { id: 3, line_no: 3, item_name: 'crisps', matched_regular_id: null, requested_qty: 1, status: 'excluded_this_week' },
    ],
    shop_lines: [
      { line_no: 1, list_item_id: 1, status: 'matched' },
      { line_no: 2, list_item_id: 2, status: 'needs_confirmation' },
      { line_no: 3, list_item_id: 3, status: 'matched' },
    ],
  }));
  const w = p.this_week;
  assert.equal(w.source_lines_display, '3');
  assert.equal(w.final_products_display, '2', 'the skipped line is not a product being bought');
  assert.equal(w.skipped_display, '1');
  assert.equal(w.uncertain_lines_display, '1');
  assert.equal(w.by_provenance.photo_display, '2');
  assert.equal(w.arithmetic_source, 'cockpit-api/shopArithmetic.js countShop()');
});

test('AC9: the RULE gap text is driven by the probe and never asserts an unapplied migration', () => {
  const applied = assembleWorkspace(workspaceInput({ provenance_ledger_available: true }));
  const ruleGapApplied = applied.provenance.gaps.find((g) => g.startsWith('RULE:'));
  assert.match(ruleGapApplied, /exists on this database/);
  assert.ok(!/has not been applied/.test(ruleGapApplied));
  assert.equal(applied.provenance.ledger_available, true);

  const absent = assembleWorkspace(workspaceInput({ provenance_ledger_available: false }));
  assert.match(absent.provenance.gaps.find((g) => g.startsWith('RULE:')), /has not been applied here/);

  // AND THE THIRD CASE, which is the one the old text got wrong: nobody asked.
  const unknown = assembleWorkspace(workspaceInput({}));
  assert.match(unknown.provenance.gaps.find((g) => g.startsWith('RULE:')), /was not established/);
  assert.equal(unknown.provenance.ledger_available, null);
});

// =====================================================================
// AC6 - THE SINGLE ARITHMETIC SOURCE, AND THE MUTATION PROOF.
// =====================================================================

/**
 * THE INVARIANT, as a callable so it can be run against a TAMPERED payload.
 *
 * A control that has never been made to fail is not evidence. Expressing the
 * assertion as a function is what lets the proof below break it on purpose and
 * show it goes red - rather than asserting the happy path twice and calling it
 * a guarantee.
 */
function assertOneArithmeticSource(payload) {
  const needingYou = payload.shop.why.counts.decisions_needing_warwick;

  assert.equal(payload.this_week.blocking_decisions_display, String(needingYou),
    'this_week and why.counts disagree about how many things need Warwick');
  assert.equal(payload.questions.needing_you_count_display, String(needingYou),
    'the questions block and why.counts disagree about how many things need Warwick');
  assert.equal(payload.count_agreement.canonical_needing_you_display, String(needingYou),
    'the published canonical count disagrees with why.counts');

  const held = payload.shop.why.counts.uncertain_lines;
  assert.equal(payload.this_week.uncertain_lines_display, String(held),
    'this_week and why.counts disagree about how many lines are unsettled');
  assert.equal(payload.exceptions.count_display, String(held),
    'the exception board is a different length from the count of unsettled lines');
  assert.equal(payload.plan.counts.held_display, String(held),
    'the plan block and the arithmetic disagree about how many lines are held');
}

function busyInput() {
  return workspaceInput({
    status: statusWith({ list_id: 55 }),
    list_items: [
      { id: 1, line_no: 1, item_name: 'milk', matched_regular_id: 11, requested_qty: 2, status: 'added' },
      { id: 2, line_no: 2, item_name: 'that sauce', matched_regular_id: null, requested_qty: 1, status: 'needs_decision' },
      { id: 3, line_no: 3, item_name: 'the other thing', matched_regular_id: null, requested_qty: 1, status: 'requested' },
    ],
    questions: [
      { id: 91, question_key: 'qa', list_item_id: 2, question_text: 'which sauce?', status: 'open', candidates: [{ id: 11 }] },
      { id: 92, question_key: 'qb', list_item_id: 3, question_text: 'which thing?', status: 'open', candidates: [] },
      { id: 93, question_key: 'qc', list_item_id: 1, question_text: 'settled already', status: 'answered', answer_text: 'yes' },
    ],
  });
}

test('AC6: every count-bearing block of one payload projects the same arithmetic', () => {
  const p = assembleWorkspace(busyInput());
  assert.equal(p.shop.why.counts.decisions_needing_warwick, 2);
  assert.equal(p.shop.why.counts.uncertain_lines, 2);
  assertOneArithmeticSource(p);
});

test('AC6: a stale referral is suppressed EVERYWHERE at once, never in one block only', () => {
  // qc is open but its line is already resolved, so it does not need Warwick.
  const p = assembleWorkspace(workspaceInput({
    status: statusWith({ list_id: 55 }),
    list_items: [{ id: 1, line_no: 1, item_name: 'milk', matched_regular_id: 11, requested_qty: 1, status: 'added' }],
    questions: [{ id: 93, question_key: 'qc', list_item_id: 1, question_text: 'stale', status: 'open', candidates: [] }],
  }));
  assert.equal(p.questions.open_count_display, '1', 'it IS an open question');
  assert.equal(p.questions.needing_you_count_display, '0', 'and it does NOT need Warwick');
  assert.equal(p.this_week.blocking_decisions_display, '0');
  assert.equal(p.this_week.stale_suppressed_display, '1', 'suppressed, and visibly so');
  assertOneArithmeticSource(p);
});

test('AC6 MUTATION PROOF (1): breaking a publication point turns the invariant RED', () => {
  const p = assembleWorkspace(busyInput());

  // The control is green on the real payload...
  assert.doesNotThrow(() => assertOneArithmeticSource(p),
    'precondition: the invariant must hold before it is broken, or the proof says nothing');

  // ...and RED the moment one block is desynchronised from the source. This is
  // the assertion that makes every other AC6 test above evidence rather than
  // decoration: it establishes that the check can fail.
  const tampered = JSON.parse(JSON.stringify(p));
  tampered.this_week.blocking_decisions_display = '99';
  assert.throws(() => assertOneArithmeticSource(tampered), /disagree about how many things need Warwick/,
    'MUTATION SURVIVED: the single-source invariant does not actually detect drift');

  // A second, different mutation, so the check is not merely sensitive to one
  // field it happens to look at first.
  const tampered2 = JSON.parse(JSON.stringify(p));
  tampered2.exceptions.count_display = '0';
  assert.throws(() => assertOneArithmeticSource(tampered2), /different length from the count/,
    'MUTATION SURVIVED: the board length is not actually tied to the arithmetic');
});

test('AC6 MUTATION PROOF (2): changing the SOURCE moves every publication point together', () => {
  // The complement of proof (1). That one shows the check detects drift; this
  // one shows the blocks are genuinely PROJECTIONS - change the one derivation
  // and all four numbers move, which is what "one source" has to mean.
  const before = assembleWorkspace(busyInput());
  assert.equal(before.this_week.blocking_decisions_display, '2');

  // Answer one of the two open questions AT SOURCE (in the durable rows).
  const input = busyInput();
  input.questions = input.questions.map((q) => (
    q.question_key === 'qa' ? Object.assign({}, q, { status: 'answered', answer_text: 'the red one' }) : q
  ));
  const after = assembleWorkspace(input);

  assert.equal(after.shop.why.counts.decisions_needing_warwick, 1);
  assert.equal(after.this_week.blocking_decisions_display, '1');
  assert.equal(after.questions.needing_you_count_display, '1');
  assert.equal(after.count_agreement.canonical_needing_you_display, '1');
  assertOneArithmeticSource(after);
});

test('AC6: a disagreement with shopStatus rollup is REPORTED, not silently resolved', () => {
  const p = assembleWorkspace(workspaceInput({
    // The projection claims 9 lines; the reader was handed 2 rows.
    status: statusWith({ list_id: 55, lines: { total: 9, resolved: 0, open: 9 } }),
    shop_lines: [
      { line_no: 1, list_item_id: 1, status: 'matched' },
      { line_no: 2, list_item_id: 2, status: 'needs_confirmation' },
    ],
    list_items: [{ id: 1, line_no: 1, item_name: 'milk', matched_regular_id: 11, requested_qty: 1, status: 'added' }],
  }));
  assert.equal(p.count_agreement.line_counts_agree, false);
  assert.match(p.count_agreement.disagreement, /neither has been preferred here/);
  // And the two numbers are BOTH still visible. Picking a winner silently is
  // the failure this block exists to prevent.
  assert.equal(p.count_agreement.line_rollup_total_display, '9');
  assert.equal(p.count_agreement.line_rows_total_display, '2');
});

test('AC6: "no line rollup" is reported as not-comparable, never as agreement', () => {
  const p = assembleWorkspace(workspaceInput({}));
  assert.equal(p.count_agreement.line_rollup_comparable, false);
  assert.equal(p.count_agreement.line_counts_agree, null, 'null means nobody could compare, not "they agree"');
  assert.equal(p.count_agreement.disagreement, null);
});

test('AC6: the shop_line rows reach the arithmetic - the key really is shop_lines', () => {
  // The bug this pins: assembleWorkspace read `src.lines`, which readWorkspace
  // never sets, so every line count in why.counts was 0 on every real request
  // while provenance.source_lines reported the truth from the same rows.
  const p = assembleWorkspace(workspaceInput({
    status: statusWith({ list_id: 55 }),
    shop_lines: [
      { line_no: 1, list_item_id: 1, status: 'matched' },
      { line_no: 2, list_item_id: 2, status: 'needs_confirmation' },
    ],
    list_items: [{ id: 1, line_no: 1, item_name: 'milk', matched_regular_id: 11, requested_qty: 1, status: 'added' }],
  }));
  assert.equal(p.shop.why.counts.lines_total, 2, 'the shop_line rows must reach the arithmetic');
  assert.equal(p.this_week.source_lines_display, '2');
  assert.equal(p.count_agreement.line_rows_total_display, '2');
});

// ---------------------------------------------------------------------
// Fixtures. Synthetic. Generic product names only.
// ---------------------------------------------------------------------
const CATALOGUE = [
  { id: 11, name: 'Arla semi skimmed 4pt', brand: 'Arla', category: 'dairy', asda_product_id: 'A-1001', active: true },
  { id: 12, name: 'Weetabix Protein', brand: 'Weetabix', category: 'cereal', asda_product_id: null, active: true },
  { id: 13, name: 'Walls sausage rolls', brand: 'Walls', category: 'chilled', asda_product_id: 'A-1003', active: true },
];

function statusWith(over) {
  return Object.assign({
    shop_id: 7,
    shop_ref: 'SHOP-2026-08-13',
    household_id: 1,
    source_kind: 'photo',
    created_at: '2026-08-13T09:00:00Z',
    updated_at: '2026-08-13T11:00:00Z',
    stage: 'PROCESSING',
    stage_label: 'working through the list',
    is_terminal: false,
    needs_review: false,
    transcript_confidence: 0.91,
    list_id: 55,
    lines: null,
    questions: { total: 0, open: 0, answered: 0, skipped: 0, held: [] },
    regulars_added: null,
    searched_items_added: null,
    substitutions: { auto_substitute: false, policy: 'never auto-substitute' },
    basket_product_count: null,
    basket_product_count_source: null,
    total: null,
    browser: null,
    outstanding_actions: [],
    failure: null,
    last_event: null,
    unknown_means_unknown: true,
  }, over || {});
}

function workspaceInput(over) {
  const o = over || {};
  return Object.assign({
    status: statusWith(),
    shop: { id: 7, list_id: 55, source_kind: 'photo', raw_text: null, raw_media_path: null,
      transcript: null, transcript_provider: null, transcript_model: null, created_at: '2026-08-13T09:00:00Z' },
    events: [],
    list_items: [],
    alternatives: [],
    questions: [],
    decisions: [],
    shop_lines: [],
    source_images: [],
    catalogue: CATALOGUE,
    confirmation: null,
    confirmation_lines: [],
    previous_order: null,
    previous_order_items: [],
    rotation_rules: [],
    all_stages: ['RECEIVED', 'PROCESSING'],
  }, o);
}

// =====================================================================
// WO-2026-08-19-03 AC2 - A SUPERSEDED QUESTION IS NOT OPEN.
//
// THE DEFECT, STATED AS THE TWO SURFACES DISAGREEING: the Telegram board
// retires a round a later round replaced (runtime.boardStateOf, since
// WO-2026-08-18-07). This module counted `status` on its own and did not, so
// the same shop said "1 still needs you" in the Cockpit about a card the phone
// had already taken down.
// =====================================================================

// Round 1 was asked and answered; the model then decided the binding was wrong
// and opened round 2 against the SAME line. Round 1 is history. In the failing
// case round 1 is still 'open' - the row was never answered, it was REPLACED.
function supersededFixture() {
  return [
    { id: 10, question_key: 'shop:1:line:3:r1', status: 'open', question_round: 1, parent_question_id: null },
    { id: 11, question_key: 'shop:1:line:3:r2', status: 'open', question_round: 2, parent_question_id: 10 },
    { id: 12, question_key: 'shop:1:line:7:r1', status: 'open', question_round: 1, parent_question_id: null },
  ];
}

test('AC2: a superseded round is not counted as open, and the successor still is', () => {
  const facts = A.countShop({
    stage: 'PROCESSING', human_state: 'ASDAIR_WORKING',
    questions: supersededFixture(), lines: [], items: [],
  });

  // THE ASSERTION THIS WORK ORDER EXISTS FOR. Three rows say status='open';
  // only two of them are questions Warwick still has.
  assert.equal(facts.questions_open_live, 2,
    'the replaced round must not read as still open - the board retired it');
  assert.equal(facts.decisions_needing_warwick, 2);

  // EXCLUDED, THEREFORE SAID. A number that quietly went down is its own defect.
  assert.equal(facts.superseded_questions_suppressed, 1);
  assert.deepEqual([...facts.superseded_question_keys], ['shop:1:line:3:r1']);

  // AND THE TOTALITY INVARIANT SURVIVES (AC4). The raw bucket is a fact about
  // the status column and still sums; the suppression lives beside it, never
  // inside it.
  assert.equal(facts.questions_open, 3);
  const bucketed = facts.questions_open + facts.questions_answered
    + facts.questions_skipped + facts.questions_unknown_status;
  assert.equal(bucketed, facts.questions_total,
    'subtracting the supersession from the raw bucket would make a question fall out of the '
    + 'arithmetic, which is exactly what the four buckets exist to prevent');
});

test('AC2: with no supersession anywhere, nothing moves', () => {
  const facts = A.countShop({
    stage: 'PROCESSING', human_state: 'ASDAIR_WORKING',
    questions: [
      { id: 1, question_key: 'a', status: 'open' },
      { id: 2, question_key: 'b', status: 'open' },
    ],
    lines: [], items: [],
  });
  assert.equal(facts.questions_open, 2);
  assert.equal(facts.questions_open_live, 2);
  assert.equal(facts.superseded_questions_suppressed, 0);
  assert.deepEqual([...facts.superseded_question_keys], []);
});

test('AC2: SUPERSEDED and STALE are counted separately - neither hides inside the other', () => {
  // q10 is replaced by q11 (superseded). q12 is a real open question whose line
  // has since been settled elsewhere (stale). Two different facts about the
  // shop, and collapsing them would lose one.
  const facts = A.countShop({
    stage: 'PROCESSING', human_state: 'ASDAIR_WORKING',
    questions: [
      { id: 10, question_key: 'k10', status: 'open', parent_question_id: null, list_item_id: 300 },
      { id: 11, question_key: 'k11', status: 'open', parent_question_id: 10, list_item_id: 300 },
      { id: 12, question_key: 'k12', status: 'open', parent_question_id: null, list_item_id: 900 },
    ],
    lines: [],
    items: [{ id: 900, status: 'added' }],
  });
  assert.equal(facts.superseded_questions_suppressed, 1);
  assert.equal(facts.stale_questions_suppressed, 1);
  assert.equal(facts.questions_open, 3, 'the raw bucket still counts all three');
  assert.equal(facts.questions_open_live, 2, 'the superseded one leaves the board');
  assert.equal(facts.decisions_needing_warwick, 1, 'and the stale one does not need him');
});

test('AC2: ids are compared as STRINGS - a bigint from one driver is a number from another', () => {
  // decisionSpine.test.js pins this on applyDecisions.js source for the same
  // reason: an `===` between two ids passes every offline suite and silently
  // finds nothing live. Proven here THROUGH this module, with mismatched types.
  const facts = A.countShop({
    stage: 'PROCESSING', human_state: 'ASDAIR_WORKING',
    questions: [
      { id: '10', question_key: 'k10', status: 'open', parent_question_id: null },
      { id: 11, question_key: 'k11', status: 'open', parent_question_id: '10' },
    ],
    lines: [], items: [],
  });
  assert.equal(facts.superseded_questions_suppressed, 1,
    'a string id and a numeric parent_question_id must still match');
  assert.equal(facts.questions_open_live, 1);
});

test('AC2: a database WITHOUT migration 017 loses the refinement and nothing else', () => {
  // No question_round, no parent_question_id - readWorkspace probes for them
  // and omits them when absent. Every count must still be produced.
  const facts = A.countShop({
    stage: 'PROCESSING', human_state: 'ASDAIR_WORKING',
    questions: [
      { id: 1, question_key: 'a', status: 'open' },
      { id: 2, question_key: 'b', status: 'answered' },
    ],
    lines: [], items: [],
  });
  assert.equal(facts.superseded_questions_suppressed, 0);
  assert.equal(facts.questions_open_live, 1);
  assert.equal(facts.questions_open, 1);
});

test('AC2: the supersession rule is the PIPELINE\'s, and this import must keep resolving', () => {
  // ⛔ THE SILENT FAILURE THIS EXISTS TO MAKE LOUD.
  //
  // shopArithmetic.js is CommonJS and require()s an ESM module. That works on
  // Node >= 20.17/22.12 ONLY while pipeline/applyDecisions.js has no TOP-LEVEL
  // `await`. The day one is added, the require throws ERR_REQUIRE_ASYNC_MODULE
  // - and it would NOT surface as a red test in the pipeline's own suite. It
  // would surface as Warwick's workspace failing to load.
  //
  // So the estate finds out here instead.
  const mod = require('../pipeline/applyDecisions.js');
  assert.equal(typeof mod.supersededQuestionIds, 'function',
    'pipeline/applyDecisions.js must keep exporting supersededQuestionIds AND must stay '
    + 'require()-able from CommonJS - the cockpit consumes it rather than re-deriving the rule');
  // And it is the same rule, not a copy that happens to agree today.
  assert.deepEqual([...mod.supersededQuestionIds(supersededFixture())], ['10']);
});
