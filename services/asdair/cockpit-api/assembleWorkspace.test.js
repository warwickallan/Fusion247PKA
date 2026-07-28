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
