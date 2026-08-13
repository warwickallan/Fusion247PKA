// BUILD-015 - cockpit-api/assembleWorkspace.test.js
//
// The payload assembler. PURE - no DB, no network, no model. Everything below
// is a rule the household actually depends on, not a shape check for its own
// sake.
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const { assembleWorkspace, INTERPRETATION_STATUSES } = require('./assembleWorkspace');
const { COMMAND_NAMES } = require('./commandSurface');
const { computeCanonicalState } = require('./canonicalState');

// ---------------------------------------------------------------------
// Fixtures. Synthetic. No household data, no real product names beyond the
// generic ones already public in interpret/README.md.
// ---------------------------------------------------------------------
const CATALOGUE = [
  { id: 11, name: 'Arla semi skimmed 4pt', brand: 'Arla', category: 'dairy', asda_product_id: 'A-1001', aka: ['arla 4pt'], created_at: '2026-01-01T00:00:00Z', updated_at: '2026-01-01T00:00:00Z', active: true },
  { id: 12, name: 'Weetabix Protein', brand: 'Weetabix', category: 'cereal', asda_product_id: null, aka: ['weetabix protein'], created_at: '2026-01-01T00:00:00Z', updated_at: '2026-07-28T10:00:00Z', active: true },
  { id: 13, name: 'Walls sausage rolls', brand: 'Walls', category: 'chilled', asda_product_id: 'A-1003', aka: [], created_at: '2026-07-28T09:30:00Z', updated_at: '2026-07-28T09:30:00Z', active: true }
];

function baseStatus(over) {
  return Object.assign({
    shop_id: 7,
    shop_ref: 'SHOP-2026-07-28',
    household_id: 1,
    source_kind: 'photo',
    created_at: '2026-07-28T09:00:00Z',
    updated_at: '2026-07-28T11:00:00Z',
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
    substitutions: { auto_substitute: false, policy: 'never auto-substitute; alternatives wait for a human choice' },
    basket_product_count: null,
    basket_product_count_source: null,
    total: null,
    browser: null,
    outstanding_actions: [],
    failure: null,
    last_event: null,
    unknown_means_unknown: true
  }, over || {});
}

function input(over) {
  return Object.assign({
    status: baseStatus(),
    shop: { id: 7, list_id: 55, source_kind: 'photo', raw_text: null, raw_media_path: 'lists/2026-07-28.jpg', transcript: '3 arla 4pt', transcript_provider: 'gateway', transcript_model: 'vision', created_at: '2026-07-28T09:00:00Z' },
    events: [],
    list_items: [],
    alternatives: [],
    questions: [],
    catalogue: CATALOGUE,
    confirmation: null,
    confirmation_lines: [],
    previous_order: null,
    previous_order_items: [],
    rotation_rules: [],
    all_stages: ['RECEIVED', 'PROCESSING']
  }, over || {});
}

// ---------------------------------------------------------------------
// SHAPE
// ---------------------------------------------------------------------
test('the payload carries every panel the workspace renders', () => {
  const p = assembleWorkspace(input());
  assert.equal(p.ok, true);
  ['shop', 'timeline', 'evidence', 'interpretation', 'plan', 'questions', 'browser', 'order', 'history']
    .forEach((k) => assert.ok(p[k], 'missing panel: ' + k));
  assert.deepEqual(p.command_names, COMMAND_NAMES);
  assert.equal(p.unknown_means_unknown, true);
});

test('no shop at all is reported as no_shop, not as an empty shop', () => {
  const p = assembleWorkspace({ status: null });
  assert.equal(p.ok, false);
  assert.equal(p.reason, 'no_shop');
});

test('the 12 stages travel with the payload so the UI never hand-types them', () => {
  const p = assembleWorkspace(input({ all_stages: ['RECEIVED', 'RECONCILED'] }));
  assert.deepEqual(p.shop.all_stages, ['RECEIVED', 'RECONCILED']);
});

// ---------------------------------------------------------------------
// CANONICAL STATE (AC1, WO-2026-08-11-B15-COCKPIT-BE-01) - computed by
// canonicalState.js and exposed exactly here, nowhere else in this payload.
// The mapping rules themselves are canonicalState.test.js's job; this only
// proves the payload actually carries what that one function returns.
// ---------------------------------------------------------------------
test('shop.canonical_state is exactly what computeCanonicalState returns for the same status', () => {
  const status = baseStatus({ stage: 'NEEDS_DECISION', needs_review: true });
  const p = assembleWorkspace(input({ status }));
  assert.equal(p.shop.canonical_state, computeCanonicalState(status));
  assert.equal(p.shop.canonical_state, 'NEEDS_WARWICK');
});

test('shop.canonical_state tracks the stage across the lifecycle - one function, not reimplemented here', () => {
  [
    ['RECEIVED', 'ASDAIR_WORKING'],
    ['READY_TO_SHOP', 'READY_FOR_WARWICK'],
    ['WAITING_FOR_BROWSER', 'BROWSER_WORKING'],
    ['RECONCILED', 'COMPLETE'],
    ['FAILED', 'FAILED'],
  ].forEach(([stage, expected]) => {
    const p = assembleWorkspace(input({ status: baseStatus({ stage, needs_review: false }) }));
    assert.equal(p.shop.canonical_state, expected, `stage ${stage}`);
  });
});

// ---------------------------------------------------------------------
// UNKNOWN IS UNKNOWN
// ---------------------------------------------------------------------
test('null durable facts render as "unknown" and never as 0', () => {
  const p = assembleWorkspace(input());
  assert.equal(p.shop.lines_summary.total_display, 'unknown');
  assert.equal(p.browser.basket_lines_display, 'unknown');
  assert.equal(p.browser.regulars_added_display, 'unknown');
  assert.equal(p.browser.searched_items_added_display, 'unknown');
  assert.equal(p.browser.estimated_total.display, 'unknown');
  assert.equal(p.order.lines_count_display, 'unknown');
  assert.equal(p.order.summary.omitted_display, 'unknown');
  assert.equal(p.history.previous_order.order_id_display, 'unknown');
});

test('a measured zero is still shown as 0', () => {
  const p = assembleWorkspace(input({
    status: baseStatus({ lines: { total: 0, resolved: 0, open: 0 }, regulars_added: 0 })
  }));
  assert.equal(p.shop.lines_summary.total_display, '0');
  assert.equal(p.browser.regulars_added_display, '0');
});

test('no list yet means the line count is unknown, not zero', () => {
  const p = assembleWorkspace(input({
    status: baseStatus({ list_id: null }),
    shop: { id: 7, list_id: null, created_at: '2026-07-28T09:00:00Z' },
    list_items: []
  }));
  assert.equal(p.interpretation.list_id_display, 'unknown');
  assert.equal(p.interpretation.total_lines_display, 'unknown');
});

// ---------------------------------------------------------------------
// THE CATALOGUE-GROUNDING INVARIANT
// ---------------------------------------------------------------------
test('every MATCHED line shows a regular id and a canonical name from our catalogue', () => {
  const p = assembleWorkspace(input({
    list_items: [
      { id: 101, item_name: '3 arla 4pt', requested_qty: 3, status: 'requested', matched_regular_id: 11, interpretation_status: 'matched', match_basis: 'exact alias', match_confidence: 0.97 },
      { id: 102, item_name: 'beefs protein', requested_qty: 1, status: 'requested', matched_regular_id: 12, interpretation_status: 'matched', match_basis: 'known brand + variant' }
    ]
  }));

  assert.equal(p.interpretation.grounded, true);
  p.interpretation.lines.forEach((l) => {
    if (l.status === 'matched' || l.status === 'possible_duplicate') {
      assert.notEqual(l.matched_regular_id, null, 'a matched line MUST carry a regular id');
      assert.notEqual(l.matched_regular_id_display, 'unknown');
      assert.notEqual(l.canonical_product_name_display, 'unknown');
    }
  });
  assert.equal(p.interpretation.lines[0].matched_regular_id_display, '11');
  assert.equal(p.interpretation.lines[0].canonical_product_name_display, 'Arla semi skimmed 4pt');
  assert.equal(p.interpretation.lines[0].confidence_display, '97%');
});

test('the canonical name comes from the catalogue BY ID - model prose is never promoted', () => {
  const p = assembleWorkspace(input({
    list_items: [{
      id: 101,
      item_name: 'beefs protein',
      // A model-supplied name arriving on the row is deliberately ignored.
      matched_product_name: 'Beefs Protein Cereal',
      matched_regular_id: 12,
      interpretation_status: 'matched',
      requested_qty: 1,
      status: 'requested'
    }]
  }));
  const line = p.interpretation.lines[0];
  assert.equal(line.canonical_product_name_display, 'Weetabix Protein');
  // The raw reading is preserved verbatim as EVIDENCE, next to the real name.
  assert.equal(line.raw_reading_display, 'beefs protein');
});

test('a line stored as "matched" with NO regular id is downgraded, never shown as matched', () => {
  const p = assembleWorkspace(input({
    list_items: [{ id: 101, item_name: 'stardrops', requested_qty: 1, status: 'requested', matched_regular_id: null, interpretation_status: 'matched' }]
  }));
  const line = p.interpretation.lines[0];
  assert.equal(line.status, 'needs_confirmation');
  assert.equal(line.matched_regular_id, null);
  assert.equal(line.canonical_product_name_display, 'unknown');
  assert.ok(line.integrity_warnings.length > 0);
  assert.equal(p.interpretation.grounded, true, 'grounded stays true because nothing is SHOWN as an ungrounded match');
});

test('a regular id that names no catalogue row is also downgraded', () => {
  const p = assembleWorkspace(input({
    list_items: [{ id: 101, item_name: 'mystery', requested_qty: 1, status: 'requested', matched_regular_id: 9999, interpretation_status: 'matched' }]
  }));
  assert.equal(p.interpretation.lines[0].status, 'needs_confirmation');
  assert.equal(p.interpretation.lines[0].matched_regular_id_display, 'unknown');
});

test('nothing that fits means unmatched_new_item / unreadable - never the least-bad guess', () => {
  const p = assembleWorkspace(input({
    list_items: [
      { id: 101, item_name: 'fruit splits', requested_qty: 1, status: 'needs_decision' },
      { id: 102, item_name: '   ', requested_qty: 1, status: 'needs_decision' }
    ]
  }));
  assert.equal(p.interpretation.lines[0].status, 'unmatched_new_item');
  assert.equal(p.interpretation.lines[0].canonical_product_name_display, 'unknown');
  assert.equal(p.interpretation.lines[1].status, 'unreadable');
});

test('a repeat of an already-resolved regular is flagged as a possible duplicate', () => {
  const p = assembleWorkspace(input({
    list_items: [
      { id: 101, item_name: 'arla 4pt', requested_qty: 3, status: 'requested', matched_regular_id: 11, interpretation_status: 'matched' },
      { id: 102, item_name: 'milk arla', requested_qty: 1, status: 'requested', matched_regular_id: 11, interpretation_status: 'matched' }
    ]
  }));
  assert.equal(p.interpretation.lines[0].status, 'matched');
  assert.equal(p.interpretation.lines[1].status, 'possible_duplicate');
  // Still grounded: a duplicate is a real match, so it keeps its id.
  assert.equal(p.interpretation.lines[1].matched_regular_id_display, '11');
});

test('every emitted line status is in the documented vocabulary', () => {
  const p = assembleWorkspace(input({
    list_items: [
      { id: 101, item_name: 'arla 4pt', matched_regular_id: 11, interpretation_status: 'matched', status: 'added' },
      { id: 102, item_name: 'fruit splits', status: 'needs_decision' },
      { id: 103, item_name: '', status: 'requested' },
      { id: 104, item_name: 'arla 4pt', matched_regular_id: 11, interpretation_status: 'matched', status: 'requested' },
      { id: 105, item_name: 'something', matched_regular_id: null, interpretation_status: 'matched', status: 'requested' }
    ]
  }));
  p.interpretation.lines.forEach((l) => {
    assert.ok(INTERPRETATION_STATUSES.includes(l.status), 'unexpected status: ' + l.status);
  });
});

test('alternatives resolved from the catalogue keep their id; free-text ones do not pretend to have one', () => {
  const p = assembleWorkspace(input({
    list_items: [{ id: 101, item_name: 'cheese', status: 'needs_decision' }],
    alternatives: [{ id: 1, list_item_id: 101, alternative_name: 'a shop-floor substitute', chosen: false }],
    questions: [{ id: 5, list_item_id: 101, question_key: 'q1', question_text: 'Which one?', status: 'open', candidates: [{ id: 12 }, { id: 13 }] }]
  }));
  const alts = p.interpretation.lines[0].alternatives;
  assert.equal(alts.length, 3);
  // REGRESSION: product_alternatives.id is the alternative row's OWN key. It
  // happens to be 1 here, which is also a plausible regulars id - reading it as
  // one would put a number on screen pointing at a different product.
  assert.equal(alts[0].source, 'product_alternative');
  assert.equal(alts[0].from_catalogue, false);
  assert.equal(alts[0].regular_id_display, 'unknown');
  assert.equal(alts[0].name_display, 'a shop-floor substitute');
  assert.equal(alts[1].source, 'catalogue_candidate');
  assert.equal(alts[1].from_catalogue, true);
  assert.equal(alts[1].regular_id_display, '12');
  assert.equal(alts[1].name_display, 'Weetabix Protein');
});

// ---------------------------------------------------------------------
// EVIDENCE
// ---------------------------------------------------------------------
test('the original image path and the raw text are always carried through', () => {
  const p = assembleWorkspace(input());
  assert.equal(p.evidence.raw_media_path_display, 'lists/2026-07-28.jpg');
  assert.equal(p.evidence.has_media, true);
  assert.equal(p.evidence.media_url, '/asdair/media?shop=7');
  assert.equal(p.evidence.transcript_display, '3 arla 4pt');
  assert.equal(p.evidence.transcript_confidence_display, '91%');
});

// ---------------------------------------------------------------------
// PLAN
// ---------------------------------------------------------------------
test('plan splits into resolved / held / excluded with prior-order context', () => {
  const p = assembleWorkspace(input({
    list_items: [
      { id: 101, item_name: 'arla 4pt', matched_regular_id: 11, requested_qty: 3, added_qty: 3, status: 'added', note: 'rule 12: always buy 3' },
      { id: 102, item_name: 'fruit splits', requested_qty: 1, status: 'needs_decision' },
      { id: 103, item_name: 'stardrops', requested_qty: 1, status: 'excluded_this_week', note: 'not stocked' }
    ],
    previous_order: { id: 90, list_id: 40, run_at: '2026-07-21T10:00:00Z', total_requested: 30, total_added: 28, basket_total: 141.2, checked_out: true },
    previous_order_items: [{ id: 900, item_name: 'Arla semi skimmed 4pt', requested_qty: 3, added_qty: 3, status: 'added' }]
  }));
  assert.equal(p.plan.resolved.length, 1);
  assert.equal(p.plan.held.length, 1);
  assert.equal(p.plan.excluded.length, 1);
  assert.equal(p.plan.resolved[0].in_prior_order, true);
  assert.equal(p.plan.resolved[0].applied_rule_display, 'rule 12: always buy 3');
  assert.equal(p.plan.held[0].in_prior_order, false);
  assert.equal(p.plan.counts.held_display, '1');
});

// ---------------------------------------------------------------------
// BROWSER BUILD
// ---------------------------------------------------------------------
test('a build REQUEST is reported as a request, and says out loud what it does not do', () => {
  const p = assembleWorkspace(input({
    status: baseStatus({
      browser: { request_id: 3, status: 'queued', claimed_by: null, requested_at: '2026-07-28T11:05:00Z', claimed_at: null, finished_at: null, last_error: null, progress: null }
    })
  }));
  assert.equal(p.browser.requested, true);
  assert.equal(p.browser.status_display, 'queued');
  // Requested is NOT evidence that a basket exists.
  assert.equal(p.browser.basket_lines_display, 'unknown');
  assert.match(p.browser.boundary, /never|Nothing here drives a browser/i);
});

test('pending favourite actions are surfaced, not forgotten', () => {
  const p = assembleWorkspace(input({
    status: baseStatus({
      outstanding_actions: [{ id: 4, action_type: 'add_favourite', action_key: 'walls-sausage-rolls', note: 'browser-only', created_at: '2026-07-28T11:10:00Z' }]
    })
  }));
  assert.equal(p.browser.pending_actions.length, 1);
  assert.equal(p.browser.pending_actions[0].action_type_display, 'add_favourite');
});

test('a runner-reported total is DERIVED and never reads as an ASDA price', () => {
  const p = assembleWorkspace(input({
    status: baseStatus({ total: { amount: 138.4, currency: 'GBP', basis: 'derived', source: 'browser_progress' } })
  }));
  assert.equal(p.browser.estimated_total.is_asda_quoted, false);
  assert.match(p.browser.estimated_total.display, /inferred/i);
});

// ---------------------------------------------------------------------
// ORDER
// ---------------------------------------------------------------------
test('confirmation lines show stated / derived / unknown price basis EXPLICITLY', () => {
  const p = assembleWorkspace(input({
    confirmation: { id: 2, source_kind: 'text', raw_text: 'ASDA order', stated_total: 141.2, received_at: '2026-07-28T18:00:00Z', reconciled_at: null },
    confirmation_lines: [
      { id: 1, line_no: 1, product_name: 'Arla 4pt', quantity: 3, line_price: 4.5, price_basis: 'stated', matched_regular_id: 11, outcome: 'as_planned' },
      { id: 2, line_no: 2, product_name: 'Weetabix Protein', quantity: 1, line_price: 3.25, price_basis: 'derived', matched_regular_id: 12, outcome: 'qty_changed' },
      { id: 3, line_no: 3, product_name: 'Mystery item', quantity: 1, line_price: null, price_basis: 'unknown', matched_regular_id: null, outcome: 'unmatched' }
    ]
  }));

  const [a, b, c] = p.order.lines;
  assert.equal(a.price.is_asda_quoted, true);
  assert.equal(a.price.display, '4.50 GBP');

  assert.equal(b.price.is_asda_quoted, false);
  assert.match(b.price.display, /inferred/i);
  assert.match(b.price.basis_label, /NOT an ASDA-quoted price/);

  assert.equal(c.price.display, 'unknown');
  assert.equal(c.price.is_asda_quoted, false);

  assert.equal(p.order.derived_price_count_display, '1');
  assert.equal(p.order.stated_total.is_asda_quoted, true);
  assert.match(p.order.price_basis_note, /NOT a figure ASDA quoted/);
});

test('NO confirmation line anywhere may be presented as ASDA-quoted unless its basis is stated', () => {
  const p = assembleWorkspace(input({
    confirmation: { id: 2, source_kind: 'text', stated_total: null, received_at: '2026-07-28T18:00:00Z' },
    confirmation_lines: [
      { id: 1, line_no: 1, product_name: 'x', line_price: 1.11, price_basis: 'derived' },
      { id: 2, line_no: 2, product_name: 'y', line_price: 2.22, price_basis: 'unknown' },
      { id: 3, line_no: 3, product_name: 'z', line_price: 3.33, price_basis: 'nonsense' }
    ]
  }));
  p.order.lines.forEach((l) => {
    assert.equal(l.price.is_asda_quoted, false);
    assert.doesNotMatch(l.price.display, /^\d+\.\d\d GBP$/, 'a non-stated price must carry a basis suffix');
  });
  // No stated total shown at all when ASDA did not state one.
  assert.equal(p.order.stated_total.display, 'unknown');
});

test('planned vs actual outcomes are counted from stored outcomes only', () => {
  const p = assembleWorkspace(input({
    confirmation: { id: 2, source_kind: 'text', received_at: '2026-07-28T18:00:00Z' },
    confirmation_lines: [
      { id: 1, line_no: 1, product_name: 'a', price_basis: 'stated', outcome: 'as_planned' },
      { id: 2, line_no: 2, product_name: 'b', price_basis: 'stated', outcome: 'omitted' },
      { id: 3, line_no: 3, product_name: 'c', price_basis: 'stated', outcome: 'added_after_planning' },
      { id: 4, line_no: 4, product_name: 'd', price_basis: 'stated', outcome: 'variant_changed' },
      { id: 5, line_no: 5, product_name: 'e', price_basis: 'stated', outcome: null }
    ]
  }));
  assert.equal(p.order.summary.as_planned_display, '1');
  assert.equal(p.order.summary.omitted_display, '1');
  assert.equal(p.order.summary.added_after_planning_display, '1');
  assert.equal(p.order.summary.variant_changed_display, '1');
  assert.equal(p.order.summary.unrecorded_display, '1');
});

// ---------------------------------------------------------------------
// QUESTIONS
// ---------------------------------------------------------------------
test('open questions only offer replies that have a real command behind them', () => {
  const p = assembleWorkspace(input({
    questions: [
      { id: 5, list_item_id: 101, question_key: 'q1', question_text: 'Which cheese?', status: 'open', candidates: [{ id: 12 }] },
      { id: 6, list_item_id: 102, question_key: 'q2', question_text: 'answered one', status: 'answered', candidates: [] }
    ]
  }));
  assert.equal(p.questions.items.length, 1);
  assert.equal(p.questions.open_count_display, '1');
  p.questions.items[0].allowed_replies.forEach((r) => {
    assert.ok(COMMAND_NAMES.includes(r.command), 'reply "' + r.key + '" names a command that does not exist');
  });
  assert.deepEqual(p.questions.items[0].allowed_replies.map((r) => r.key), ['choose', 'typed', 'search', 'skip']);
});

test('a resolved question shows Warwick\'s own answer verbatim, even with no decision row on record', () => {
  const p = assembleWorkspace(input({
    questions: [
      { id: 6, list_item_id: 102, question_key: 'q2', question_text: 'Which sausages?', status: 'answered', answer_text: 'Richmond 12 Skinless Pork Sausages 319g', answer_source: 'typed', answered_at: '2026-07-28T10:05:00Z', candidates: [] }
    ]
    // No `decisions` supplied at all — pre-migration-017 answer, or the read
    // failed over gracefully. The raw answer must still be shown.
  }));
  assert.equal(p.questions.open_count_display, '0');
  assert.equal(p.questions.resolved_count_display, '1');
  const r = p.questions.resolved[0];
  assert.equal(r.status_display, 'answered');
  assert.equal(r.answer_text_display, 'Richmond 12 Skinless Pork Sausages 319g');
  assert.equal(r.decision, null);
  // No decision row and not skipped => no invented resolution sentence.
  assert.equal(r.resolution_display, null);
});

// REGRESSION — Vera, CONDITIONAL PASS, 2026-08-11. answered_at_display rendered as a raw
// toISOString() instant (P.when()'s output) right beside "You said: ..." / "-> Resolved to ..." —
// primary content in the exact section this Work Order exists to make human-readable. Scoped fix:
// a local humanWhen() for this field and decisionSummary()'s interpreted_at_display only; every
// OTHER P.when() call site on the page (History, evidence, browser, order...) is unchanged.
test('a resolved question\'s answered_at is human-readable, never a raw ISO instant', () => {
  const p = assembleWorkspace(input({
    questions: [
      { id: 6, list_item_id: 102, question_key: 'q2', question_text: 'Which sausages?', status: 'answered', answer_text: 'Richmond 12 Skinless Pork Sausages 319g', answer_source: 'typed', answered_at: '2026-07-28T10:05:00Z', candidates: [] }
    ]
  }));
  const display = p.questions.resolved[0].answered_at_display;
  assert.ok(!/^\d{4}-\d{2}-\d{2}T/.test(display), 'answered_at_display looks like a raw ISO instant: ' + display);
  assert.equal(display, new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }).format(new Date('2026-07-28T10:05:00Z')));
});

test('a skipped question with no decision row still reads as skipped, in plain English', () => {
  const p = assembleWorkspace(input({
    questions: [
      { id: 7, list_item_id: 103, question_key: 'q3', question_text: 'Which gloves?', status: 'skipped', answer_text: null, answered_at: '2026-07-28T10:06:00Z', candidates: [] }
    ]
  }));
  assert.equal(p.questions.resolved[0].status_display, 'skipped');
  assert.equal(p.questions.resolved[0].resolution_display, 'Skipped — not bought this week.');
});

test('a decision row translates into a plain-language resolution, grounded in the catalogue by id', () => {
  const p = assembleWorkspace(input({
    questions: [
      { id: 8, list_item_id: 104, question_key: 'q4', question_text: 'Which milk?', status: 'answered', answer_text: 'the usual', answer_source: 'button', answered_at: '2026-07-28T10:07:00Z', candidates: [] }
    ],
    decisions: [
      { id: 900, question_id: 8, decision_kind: 'existing_regular', decided_regular_id: 11, interpreted_by: 'terra', interpreted_at: '2026-07-28T10:07:05Z' }
    ]
  }));
  const r = p.questions.resolved[0];
  assert.equal(r.answer_text_display, 'the usual');
  assert.equal(r.decision.kind, 'existing_regular');
  assert.equal(r.decision.decided_product_name_display, 'Arla semi skimmed 4pt');
  assert.equal(r.resolution_display, 'Resolved to Arla semi skimmed 4pt.');
  // Same regression, the decision's own timestamp: also primary content beside the resolution
  // sentence, also must never be a raw ISO instant.
  assert.ok(!/^\d{4}-\d{2}-\d{2}T/.test(r.decision.interpreted_at_display),
    'decision.interpreted_at_display looks like a raw ISO instant: ' + r.decision.interpreted_at_display);
});

test('resolved questions come back newest-first', () => {
  const p = assembleWorkspace(input({
    questions: [
      { id: 1, list_item_id: 101, question_key: 'qa', question_text: 'first', status: 'answered', answer_text: 'a', answered_at: '2026-07-28T10:00:00Z' },
      { id: 2, list_item_id: 102, question_key: 'qb', question_text: 'second', status: 'answered', answer_text: 'b', answered_at: '2026-07-28T10:01:00Z' }
    ]
  }));
  assert.deepEqual(p.questions.resolved.map((r) => r.id), [2, 1]);
});

// ---------------------------------------------------------------------
// HISTORY
// ---------------------------------------------------------------------
test('history reports what the shop taught the household', () => {
  const p = assembleWorkspace(input({
    previous_order: { id: 90, list_id: 40, run_at: '2026-07-21T10:00:00Z', total_requested: 30, total_added: 28, basket_total: 141.2, checked_out: true },
    previous_order_items: [{ id: 900, item_name: 'Arla semi skimmed 4pt', requested_qty: 3, added_qty: 3, status: 'added' }],
    rotation_rules: [{ id: 24, directive: 'rotate', match_term: 'sure male', matched_product: null, reason: 'rotate the variant weekly', active: true }]
  }));

  assert.equal(p.history.previous_order.known, true);
  assert.equal(p.history.previous_order.total_added_display, '28');
  // orders.basket_total is a running figure, not an ASDA quote.
  assert.equal(p.history.previous_order.basket_total.is_asda_quoted, false);

  assert.equal(p.history.rotation.length, 1);
  assert.equal(p.history.rotation[0].match_term_display, 'sure male');

  // 13 was created after the shop started; 12 was only updated.
  assert.deepEqual(p.history.new_regulars.map((r) => r.regular_id_display), ['13']);
  assert.deepEqual(p.history.aliases_learned.map((r) => r.regular_id_display), ['12']);
  assert.deepEqual(p.history.product_ids_captured.map((r) => r.asda_product_id_display), ['A-1003']);
});

// =====================================================================
// WP-B15-35 - the canonical state seam and the one truthful sentence, as the
// UI actually receives them. These assert the PAYLOAD shape the parallel
// Cockpit UI work package is building against.
// =====================================================================

test('WP-B15-35: the payload carries canonical_state, its SOURCE, and why', () => {
  const w = assembleWorkspace({
    status: {
      shop_id: 1, shop_ref: 'SHOP-2026-08-13', household_id: 1,
      stage: 'NEEDS_DECISION', stage_label: 'waiting on your answers',
      human_state: 'NEEDS_WARWICK', human_state_source: 'column',
      needs_review: true, is_terminal: false,
    },
    questions: [{ question_key: 'q:1', status: 'open', line_no: 1 }],
    lines: [{ line_no: 1, status: 'needs_confirmation', corrected: false }],
    items: [],
  });

  assert.equal(w.ok, true);
  assert.equal(w.shop.canonical_state, 'NEEDS_WARWICK');
  assert.equal(w.shop.canonical_state_source, 'column');
  assert.equal(w.shop.why.sentence, '1 decision still needs you.');
  assert.equal(w.shop.why.counts.decisions_needing_warwick, 1);
});

test('WP-B15-35: canonical_state_source reports "derived" when the column is absent', () => {
  // The live condition on 2026-08-13. The UI must be able to show that the
  // value is not durable rather than being told a comfortable lie.
  const w = assembleWorkspace({
    status: {
      shop_id: 1, shop_ref: 'SHOP-2026-08-13', household_id: 1,
      stage: 'PROCESSING', stage_label: 'working through the list',
      human_state: 'ASDAIR_WORKING', human_state_source: 'derived',
      needs_review: false, is_terminal: false,
    },
    questions: [], lines: [], items: [{ status: 'requested' }, { status: 'pending' }],
  });

  assert.equal(w.shop.canonical_state_source, 'derived');
  assert.equal(w.shop.why.sentence, 'Nothing needs you. AsdAIr is reconciling 2 products.');
});

test('WP-B15-35: the sentence and the counter in the payload cannot disagree', () => {
  // Same construction as explainState.test.js's contradiction case, asserted
  // here at the API boundary - because that is where the UI reads them, and a
  // disagreement there is what Warwick would actually see.
  const w = assembleWorkspace({
    status: {
      shop_id: 1, shop_ref: 'SHOP-2026-08-13', household_id: 1,
      stage: 'NEEDS_DECISION', stage_label: 'waiting on your answers',
      human_state: 'NEEDS_WARWICK', human_state_source: 'column',
      needs_review: true, is_terminal: false,
    },
    questions: [
      { question_key: 'q:1', status: 'open', line_no: 1 },
      { question_key: 'q:2', status: 'open', line_no: 2 },
      { question_key: 'q:3', status: 'open', line_no: 3 },
    ],
    lines: [
      { line_no: 1, status: 'matched', corrected: false },
      { line_no: 2, status: 'needs_confirmation', corrected: true },
      { line_no: 3, status: 'needs_confirmation', corrected: false },
    ],
    items: [],
  });

  const n = w.shop.why.counts.decisions_needing_warwick;
  assert.equal(n, 1, 'two of the three open questions are about resolved lines');
  assert.match(w.shop.why.sentence, new RegExp('^' + n + ' decision'),
    'the sentence must quote the same number the badge renders');
  assert.equal(w.shop.why.counts.stale_questions_suppressed, 2);
});

// =====================================================================
// WP-B15-35 AC4/AC7/AC8 - the payload the parallel Cockpit UI reads.
// These pin the CONTRACT, not the internals: the UI's asdairProvenance()
// reads exactly these `*_display` keys and maps the literal 'unknown' to an
// honest gap, so a rename here breaks a screen.
// =====================================================================

function wsWith(over) {
  return assembleWorkspace(Object.assign({
    status: {
      shop_id: 26, shop_ref: 'SHOP-2026-08-13', household_id: 1,
      stage: 'NEEDS_DECISION', stage_label: 'waiting on your answers',
      human_state: 'NEEDS_WARWICK', human_state_source: 'derived',
      needs_review: true, is_terminal: false, list_id: 7,
    },
    shop: { list_id: 7 },
    questions: [], decisions: [], list_items: [], shop_lines: [], source_images: [],
  }, over || {}));
}

test('AC4: the provenance block carries the exact *_display keys the UI reads', () => {
  const w = wsWith({
    shop_lines: [{ line_no: 1, list_item_id: 1, corrected: false }],
    list_items: [{ id: 1, status: 'requested', requested_qty: 1 }],
    status: {
      shop_id: 26, shop_ref: 'SHOP-2026-08-13', household_id: 1, stage: 'PROCESSING',
      stage_label: 'working', human_state: 'ASDAIR_WORKING', human_state_source: 'derived',
      needs_review: false, is_terminal: false, list_id: 7, regulars_added: 2,
    },
  });

  for (const k of ['photo_display', 'regulars_display', 'rules_display', 'warwick_display',
    'skipped_display', 'source_lines_display', 'source_read_status_display',
    'reconciled_products_display', 'final_products_display', 'final_items_display',
    'summary_display']) {
    assert.ok(Object.prototype.hasOwnProperty.call(w.provenance, k), 'missing UI contract key: ' + k);
  }

  assert.equal(w.provenance.photo_display, '1');
  assert.equal(w.provenance.regulars_display, '2');
});

test('AC4: an unevidenced origin reaches the UI as the literal "unknown", never "0"', () => {
  const w = wsWith({
    shop_lines: [{ line_no: 1, list_item_id: 1, corrected: false }],
    list_items: [{ id: 1, status: 'requested', requested_qty: 1 }],
  });

  // The UI's asdairCount() maps 'unknown' -> null -> an honest gap on screen.
  // '0' would render as a confident, false claim that no rule fired.
  assert.equal(w.provenance.rules_display, 'unknown');
  assert.notEqual(w.provenance.rules_display, '0');
  assert.ok(Array.isArray(w.provenance.gaps) && w.provenance.gaps.length > 0,
    'an unknown must arrive with the words that explain it');
});

test('AC7: every interpretation line carries its own provenance for the exception view', () => {
  const w = wsWith({
    shop_lines: [
      { line_no: 1, list_item_id: 1, corrected: false },
      { line_no: 2, list_item_id: 2, corrected: true },
    ],
    list_items: [
      { id: 1, status: 'requested', requested_qty: 1, item_name: 'milk' },
      { id: 2, status: 'requested', requested_qty: 1, item_name: 'bread' },
      { id: 3, status: 'excluded_this_week', requested_qty: 1, item_name: 'olive oil' },
    ],
  });

  const byId = new Map(w.interpretation.lines.map((l) => [String(l.list_item_id), l]));
  assert.equal(byId.get('1').provenance, 'PHOTO');
  assert.equal(byId.get('2').provenance, 'WARWICK', 'a corrected line is Warwick\'s');
  assert.equal(byId.get('3').provenance, 'SKIPPED');
});

test('AC7: a line nothing speaks for carries NULL provenance, not a guess', () => {
  const w = wsWith({
    shop_lines: [],
    list_items: [{ id: 9, status: 'requested', requested_qty: 1, item_name: 'mystery' }],
  });
  assert.equal(w.interpretation.lines[0].provenance, null,
    'the UI counts an unlabelled line as unattributed - it must not be labelled on a hunch');
});

test('AC7: the exception-first buckets the UI filters on are all present per line', () => {
  // The UI splits on `status` (needs_confirmation / possible_duplicate /
  // unreadable) and on `provenance !== PHOTO`. Both fields must exist on every
  // line or the default view silently shows everything - the 39-line
  // proofreading job Warwick refused.
  const w = wsWith({
    shop_lines: [{ line_no: 1, list_item_id: 1, corrected: false }],
    list_items: [{ id: 1, status: 'requested', requested_qty: 1, item_name: 'milk' }],
  });
  const l = w.interpretation.lines[0];
  assert.ok(Object.prototype.hasOwnProperty.call(l, 'status'));
  assert.ok(Object.prototype.hasOwnProperty.call(l, 'provenance'));
});
