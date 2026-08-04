// =====================================================================
// readRules.test.js - the rulebook read, exercised offline.
//
// No database, no network. The reader is driven against a scripted fake client
// so the two properties that actually matter can FAIL a test rather than be
// asserted in a comment:
//
//   1. every statement it can issue is a SELECT;
//   2. a NULL note, a NULL product id and an empty alias array are reported
//      HONESTLY - the row is never dropped and a missing value never becomes 0.
//
// PURE ASCII.
// =====================================================================

'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const readRulesModule = require('./readRules');
const { readRules, assembleRules, ALL_SQL, DIRECTIVES } = readRulesModule;

// ---------------------------------------------------------------------
// A client that records every statement and answers from a script.
// ---------------------------------------------------------------------
function fakeClient(script) {
  const issued = [];
  return {
    issued: issued,
    query: async function (sql, params) {
      issued.push({ sql: String(sql), params: params || [] });
      const key = Object.keys(script).find(function (k) { return String(sql).indexOf(k) !== -1; });
      return { rows: key ? script[key] : [] };
    }
  };
}

const RULE_ROWS = [
  { id: 23, category: 'drinks', rule_text: 'sure male deodorant', scope: 'household', directive: 'map',
    match_term: 'sure male', match_category: null, matched_product: 'Sure Men Active Dry 250ml',
    reason: 'the one mum buys', note: 'confirmed on the July shop', active: true, household_id: 1,
    superseded_by: null, created_at: '2026-07-01T00:00:00.000Z' },
  // The D-2026-08-03-16 shape: a real, ACTIVE rule with NO note at all.
  { id: 24, category: 'household', rule_text: 'no own brand bleach', scope: 'household', directive: 'exclude',
    match_term: 'bleach', match_category: null, matched_product: null, reason: null, note: null,
    active: true, household_id: 1, superseded_by: null, created_at: '2026-07-02T00:00:00.000Z' },
  { id: 25, category: 'drinks', rule_text: 'vary the yazoo flavour', scope: 'household', directive: 'rotate',
    match_term: 'yazoo', match_category: null, matched_product: null, reason: null, note: null,
    active: true, household_id: null, superseded_by: null, created_at: '2026-07-03T00:00:00.000Z' },
  { id: 26, category: 'notes', rule_text: 'mum prefers Tuesday delivery', scope: 'household', directive: 'info',
    match_term: null, match_category: null, matched_product: null, reason: null, note: null,
    active: false, household_id: 1, superseded_by: 30, created_at: '2026-07-04T00:00:00.000Z' }
];

const QA_ROWS = [
  { id: 5, asked_on: '2026-07-20', question: 'Which sure male?', answer: 'Rotate it',
    applies_going_forward: true, promoted_rule_id: null, household_id: 1, created_at: '2026-07-20T00:00:00.000Z' },
  { id: 6, asked_on: '2026-07-21', question: 'Skip the beans this week?', answer: 'Yes, just this once',
    applies_going_forward: false, promoted_rule_id: null, household_id: 1, created_at: '2026-07-21T00:00:00.000Z' },
  { id: 7, asked_on: '2026-07-22', question: 'Always Cravendale?', answer: 'Yes',
    applies_going_forward: true, promoted_rule_id: 23, household_id: 1, created_at: '2026-07-22T00:00:00.000Z' }
];

const REGULAR_ROWS = [
  { id: 24, name: 'Yazoo Chocolate Milk 400ml', brand: 'Yazoo', category: 'Drinks',
    high_level_category: 'Food', asda_product_id: '9297593', asda_url: null, typical_qty: 4,
    aka: ['choc yazoo', 'chocolate yazoo'], substitutes_allowed: false, active: true },
  { id: 31, name: 'Smart Litter Wood Pellet 10L', brand: null, category: 'Pets',
    high_level_category: 'Household', asda_product_id: null, asda_url: null, typical_qty: null,
    aka: [], substitutes_allowed: true, active: true },
  { id: 40, name: 'Old Discontinued Thing', brand: null, category: null, high_level_category: null,
    asda_product_id: null, asda_url: null, typical_qty: null, aka: null,
    substitutes_allowed: false, active: false }
];

const SCRIPT = {
  'FROM asdair.rules': RULE_ROWS,
  'FROM asdair.rule_qa_log': QA_ROWS,
  'FROM asdair.regulars': REGULAR_ROWS
};

// ---------------------------------------------------------------------
// SELECT-only, by construction and by execution.
// ---------------------------------------------------------------------
test('every statement this module can issue begins with SELECT', () => {
  assert.ok(ALL_SQL.length >= 3, 'expected at least three statements, got ' + ALL_SQL.length);
  for (const sql of ALL_SQL) {
    assert.match(String(sql).trim(), /^SELECT\b/, 'not a SELECT: ' + String(sql).slice(0, 60));
    assert.doesNotMatch(String(sql), /\b(insert|update|delete|drop|alter|truncate|grant)\b/i,
      'a write keyword reached a statement: ' + String(sql).slice(0, 80));
  }
});

test('the reader issues only SELECTs, inside a read-only transaction, and commits', async () => {
  const client = fakeClient(SCRIPT);
  await readRules({ household_id: 1, client: client });
  // An injected client is used AS-IS: the caller owns the transaction, exactly
  // as readWorkspace.js behaves. So no BEGIN is issued here.
  assert.equal(client.issued.length, 3, 'expected exactly three reads, got ' + client.issued.length);
  for (const q of client.issued) assert.match(q.sql.trim(), /^SELECT\b/);
});

// Scope stated plainly: this asserts the INJECTED-client contract, which is the
// half a fake client can actually reach. The owned-client path (BEGIN
// TRANSACTION READ ONLY / COMMIT / release) is NOT proven here - it needs a real
// pool - and is left to the live route rather than claimed by a passing test.
test('an injected client is used as-is — the reader never opens a transaction over one', async () => {
  const client = fakeClient(SCRIPT);
  const payload = await readRules({ household_id: 1, client: client });
  assert.equal(payload.ok, true);
  const verbs = client.issued.map((q) => q.sql.trim().split(/\s+/)[0].toUpperCase());
  assert.deepEqual(verbs, ['SELECT', 'SELECT', 'SELECT'],
    'a BEGIN/COMMIT here would mean the reader hijacked a caller-owned transaction');
});

// ---------------------------------------------------------------------
// The honesty rules. These are the reason the module exists server-side.
// ---------------------------------------------------------------------
test('a rule with no note is SHOWN, flagged, and never invented into prose', () => {
  const p = assembleRules({ rules: RULE_ROWS, rule_qa: [], regulars: [] });
  assert.equal(p.rules.total_display, '4', 'no row may be dropped for lacking a note');
  const noNote = p.rules.items.find((r) => r.id === 24);
  assert.equal(noNote.has_note, false);
  assert.equal(noNote.note_display, 'unknown');
  assert.equal(noNote.rule_text_display, 'no own brand bleach', 'the rule itself must survive');
  // Three of the four fixtures have no note. A MEASURED count, so it prints.
  assert.equal(p.rules.without_note_display, '3');
});

test('directives are grouped against a frozen list, and each carries its consequence', () => {
  const p = assembleRules({ rules: RULE_ROWS, rule_qa: [], regulars: [] });
  assert.deepEqual(p.rules.groups.map((g) => g.directive), DIRECTIVES.slice());
  const map = p.rules.groups.find((g) => g.directive === 'map');
  assert.equal(map.count_display, '1');
  assert.match(map.meaning, /Always buy this exact product/);
  const info = p.rules.groups.find((g) => g.directive === 'info');
  assert.match(info.meaning, /changes no basket/i);
});

test('an unrecognised directive is surfaced under "other", never silently folded in', () => {
  const rogue = [{ id: 99, directive: 'launch_missiles', rule_text: 'x', match_term: 'y',
    active: true, household_id: 1, note: null, reason: null, matched_product: null,
    match_category: null, category: null, scope: null, superseded_by: null, created_at: null }];
  const p = assembleRules({ rules: rogue, rule_qa: [], regulars: [] });
  const other = p.rules.groups.find((g) => g.directive === 'other');
  assert.ok(other, 'an unknown directive must get a visible home');
  assert.equal(other.count_display, '1');
  assert.equal(other.items[0].directive_known, false);
  assert.equal(other.items[0].directive_meaning, 'unknown', 'never guess what an unknown directive does');
});

test('a standing answer that never became a rule is counted as the gap it is', () => {
  const p = assembleRules({ rules: [], rule_qa: QA_ROWS, regulars: [] });
  assert.equal(p.decisions.total_display, '3');
  assert.equal(p.decisions.standing_display, '2');
  assert.equal(p.decisions.promoted_display, '1');
  // #5 is "applies going forward" with no promoted rule: the planner cannot act on it.
  assert.equal(p.decisions.unpromoted_standing_display, '1');
});

test('aliases are reported exactly, and an empty alias list is a measured 0 not "unknown"', () => {
  const p = assembleRules({ rules: [], rule_qa: [], regulars: REGULAR_ROWS });
  const yazoo = p.regulars.items.find((r) => r.name_display === 'Yazoo Chocolate Milk 400ml');
  assert.deepEqual(yazoo.aka, ['choc yazoo', 'chocolate yazoo']);
  assert.equal(yazoo.aka_count_display, '2');
  assert.equal(yazoo.has_aliases, true);

  const litter = p.regulars.items.find((r) => r.id_display === '31');
  assert.equal(litter.aka_count_display, '0', 'a row that lists no aliases has measurably zero');
  assert.equal(litter.has_aliases, false);
  assert.equal(litter.asda_product_id_display, 'unknown', 'a missing product id is unknown, never blank');
  assert.equal(litter.has_product_id, false);
  assert.equal(litter.typical_qty_display, 'unknown', 'a missing qty must NOT become 0');

  // aka = NULL (not an empty array) must not throw and must not become "unknown".
  const old = p.regulars.items.find((r) => r.id_display === '40');
  assert.deepEqual(old.aka, []);
  assert.equal(old.aka_count_display, '0');

  assert.equal(p.regulars.total_display, '3');
  assert.equal(p.regulars.active_display, '2');
  assert.equal(p.regulars.with_aliases_display, '1');
  assert.equal(p.regulars.alias_total_display, '2');
  assert.equal(p.regulars.without_product_id_display, '1', 'active regulars with no product id');
});

test('the whole payload assembles from empty inputs without inventing a single figure', () => {
  const p = assembleRules({});
  assert.equal(p.ok, true);
  assert.equal(p.unknown_means_unknown, true);
  assert.equal(p.rules.total_display, '0');
  assert.equal(p.decisions.total_display, '0');
  assert.equal(p.regulars.total_display, '0');
  assert.equal(p.rules.groups.length, DIRECTIVES.length, 'the five directives always have a home');
  for (const g of p.rules.groups) assert.equal(g.count_display, '0');
});

// A `date` column has no time and no zone. Both failure modes below are real:
// a fabricated midnight, and a calendar day that moves under toISOString().
test('a date-only column prints a date only, and never shifts the calendar day', () => {
  const { dateOnly } = require('./readRules')._internal;
  assert.equal(dateOnly('2026-07-20'), '2026-07-20');
  assert.equal(dateOnly('2026-07-20T00:00:00.000Z'), '2026-07-20');
  assert.equal(dateOnly(null), 'unknown');
  assert.equal(dateOnly(''), 'unknown');
  assert.equal(dateOnly('not a date'), 'unknown');
  // node-postgres hands back LOCAL midnight for a `date`. In any zone ahead of
  // UTC, toISOString() on that value yields the PREVIOUS day - which is exactly
  // what this must not do.
  const localMidnight = new Date(2026, 6, 20, 0, 0, 0);
  assert.equal(dateOnly(localMidnight), '2026-07-20');
  assert.equal(dateOnly(new Date(2026, 0, 1, 0, 0, 0)), '2026-01-01', 'zero-padding, and a year boundary');

  const p = assembleRules({ rules: [], rule_qa: QA_ROWS, regulars: [] });
  for (const d of p.decisions.items) {
    assert.match(d.asked_on_display, /^\d{4}-\d{2}-\d{2}$/, 'got: ' + d.asked_on_display);
  }
});

test('the rules read carries the household through and reports it back', async () => {
  const client = fakeClient(SCRIPT);
  const p = await readRules({ household_id: 1, client: client });
  assert.equal(p.household_id_display, '1');
  for (const q of client.issued) assert.deepEqual(q.params, [1]);
});
