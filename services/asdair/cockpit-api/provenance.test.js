// =====================================================================
// BUILD-015 AsdAIr - cockpit-api/provenance.test.js
//
// Runs under: node --test
//
// WP-B15-35 AC4/AC7. The load-bearing cases are the two ways this module could
// lie: COLLAPSING two origins into one, and reporting an unknown as a ZERO.
//
// SYNTHETIC FIXTURES ONLY. No database, no network.
//
// PURE ASCII only.
// =====================================================================

'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const { ORIGINS, attributeItems, computeProvenance } = require('./provenance');

function item(id, over) { return Object.assign({ id, status: 'requested', requested_qty: 1 }, over || {}); }
function line(listItemId, over) { return Object.assign({ line_no: listItemId, list_item_id: listItemId, corrected: false }, over || {}); }

// ---------------------------------------------------------------------
// THE FOUR ORIGINS STAY DISTINCT.
// ---------------------------------------------------------------------
test('the five buckets are separate keys and there is NO combined total', () => {
  assert.deepEqual(ORIGINS, ['PHOTO', 'REGULARS', 'RULE', 'WARWICK', 'SKIPPED']);

  const r = computeProvenance({
    shop_lines: [line(1), line(2)],
    list_items: [item(1), item(2), item(3)],
    decisions: [],
    source_images: [],
    status: { regulars_added: 1 },
  });

  // PHOTO is not REGULARS; REGULARS is not RULE.
  assert.equal(r.counts.PHOTO, 2);
  assert.equal(r.counts.REGULARS, 1);
  assert.equal(r.counts.RULE, null);
  assert.notEqual(r.counts.PHOTO, r.counts.REGULARS);

  // No key anywhere sums them.
  const keys = Object.keys(r.counts);
  assert.deepEqual(keys.slice().sort(), ORIGINS.slice().sort());
  assert.equal(Object.prototype.hasOwnProperty.call(r, 'added_by_asdair'), false,
    'a combined "added by AsdAIr" bucket destroys exactly the information Warwick asked for');
});

// ---------------------------------------------------------------------
// AN UNKNOWN IS NEVER A ZERO. This is the rule the whole module turns on.
// ---------------------------------------------------------------------
test('RULE is UNKNOWN, never 0 - nothing durable records that a rule fired', () => {
  const r = computeProvenance({
    shop_lines: [line(1)], list_items: [item(1)], decisions: [], source_images: [], status: {},
  });

  assert.equal(r.counts.RULE, null, '"0 from household rules" is a claim that no rule fired');
  assert.notEqual(r.counts.RULE, 0);
  assert.ok(r.gaps.some((g) => /^RULE:/.test(g)), 'an unknown must carry a named gap saying why');
  assert.ok(r.gaps.some((g) => /shop_line_provenance/.test(g)),
    'the gap must name the mechanism that would close it, or it cannot be acted on');
});

test('NOT SUPPLIED is not zero - a caller that never read shop_line gets UNKNOWN', () => {
  // The trap: a reader that skips asdair.shop_line would otherwise report
  // "0 from the photograph", which reads as "the photo yielded nothing".
  const r = computeProvenance({
    list_items: [item(1), item(2)], decisions: [], source_images: [], status: {},
  });

  assert.equal(r.counts.PHOTO, null);
  assert.equal(r.counts.WARWICK, null);
  assert.ok(r.gaps.some((g) => /asdair\.shop_line was not read/.test(g)));
  assert.equal(r.summary, null, 'an equation must not be claimed from terms nobody measured');
});

test('an EMPTY shop_line array IS a measured zero - a typed list has no photo lines', () => {
  const r = computeProvenance({
    shop_lines: [], list_items: [item(1)], decisions: [], source_images: [],
    status: { source_kind: 'text', regulars_added: 0 },
  });

  assert.equal(r.counts.PHOTO, 0, 'asked and answered: genuinely nothing came from a photograph');
  assert.equal(r.counts.REGULARS, 0, 'a run that reported zero regulars added really did report zero');
  assert.equal(r.gaps.some((g) => /was not read/.test(g)), false);
});

// ---------------------------------------------------------------------
// ATTRIBUTION PRECEDENCE.
// ---------------------------------------------------------------------
test('a line Warwick corrected is HIS, not the photograph\'s', () => {
  const m = attributeItems({
    shop_lines: [line(1), line(2, { corrected: true })],
    list_items: [item(1), item(2)],
    decisions: [],
  });
  assert.equal(m.get('1'), 'PHOTO');
  assert.equal(m.get('2'), 'WARWICK');
});

test('a human decision attributes the item to WARWICK', () => {
  const m = attributeItems({
    shop_lines: [line(1)],
    list_items: [item(1)],
    decisions: [{ list_item_id: 1, interpreted_by: 'human' }],
  });
  assert.equal(m.get('1'), 'WARWICK');
});

test('a MODEL decision does NOT attribute the item to Warwick', () => {
  // Live data carries interpreted_by='terra' on 16 of 22 decisions. Counting
  // those as Warwick's own would tell him he decided things he never saw.
  const m = attributeItems({
    shop_lines: [line(1)],
    list_items: [item(1)],
    decisions: [{ list_item_id: 1, interpreted_by: 'terra' }],
  });
  assert.equal(m.get('1'), 'PHOTO');
});

test('SKIPPED wins over its origin - it is not in the basket whatever put it there', () => {
  const m = attributeItems({
    shop_lines: [line(1)],
    list_items: [item(1, { status: 'excluded_this_week' })],
    decisions: [],
  });
  assert.equal(m.get('1'), 'SKIPPED');
});

test('an item nothing speaks for is UNATTRIBUTED, never guessed into a bucket', () => {
  const r = computeProvenance({
    shop_lines: [line(1)],
    list_items: [item(1), item(2), item(3)],
    decisions: [], source_images: [], status: {},
  });

  assert.equal(r.counts.PHOTO, 1);
  assert.equal(r.unattributed, 2);
  assert.ok(r.gaps.some((g) => /^UNATTRIBUTED: 2 item/.test(g)));
  assert.equal(r.counts.REGULARS, null,
    'the two unattributed items must NOT be quietly moved into Regulars to make the total balance');
});

// ---------------------------------------------------------------------
// WARWICK'S EQUATION - claimed only from measured terms.
// ---------------------------------------------------------------------
test('the summary equation reproduces Warwick\'s shape when every term is known', () => {
  const lines = [];
  const items = [];
  for (let n = 1; n <= 39; n++) { lines.push(line(n)); items.push(item(n)); }
  items.push(item(40));                                    // a Regular
  items.push(item(41, { status: 'excluded_this_week' }));  // skipped

  const r = computeProvenance({
    shop_lines: lines, list_items: items, decisions: [], source_images: [{ id: 1 }],
    status: { regulars_added: 2 },
  });

  assert.equal(r.counts.PHOTO, 39);
  assert.equal(r.counts.SKIPPED, 1);
  assert.equal(r.final_products, 40);
  assert.match(r.summary, /^39 from the photograph \+ 2 from Regulars - 1 skipped = 40 products \/ \d+ items$/);
});

test('the equation is NOT claimed when a term is unknown', () => {
  const r = computeProvenance({
    shop_lines: [line(1)], list_items: [item(1)], decisions: [], source_images: [], status: {},
  });
  assert.equal(r.summary, null,
    'a tidy total built from a guess is worse than a visible gap');
});

test('source read status is reported from real evidence, not assumed', () => {
  const withPhoto = computeProvenance({
    shop_lines: [line(1), line(2)], list_items: [], decisions: [],
    source_images: [{ id: 1 }], status: {},
  });
  assert.match(withPhoto.source_read_status, /^read - 2 line\(s\) interpreted/);

  const unread = computeProvenance({
    shop_lines: [], list_items: [], decisions: [], source_images: [{ id: 1 }], status: {},
  });
  assert.equal(unread.source_read_status, 'received, not yet read');

  const nothing = computeProvenance({
    shop_lines: [], list_items: [], decisions: [], source_images: [], status: {},
  });
  assert.equal(nothing.source_read_status, null, 'no evidence means no claim, not "not read"');
});
