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
  // WP-B15-53: FOUR now, not three. The extra one is the optional-column probe
  // that decides whether `display_name` may be selected - itself a SELECT
  // against information_schema, asserted as such rather than merely counted.
  assert.equal(client.issued.length, 4, 'expected exactly four reads, got ' + client.issued.length);
  for (const q of client.issued) assert.match(q.sql.trim(), /^SELECT\b/);
  assert.match(client.issued[0].sql, /FROM information_schema\.columns/,
    'the probe must run FIRST - the regulars SELECT is chosen from its answer');
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
  // WP-B15-53 added the optional-column probe, so four - and every one still a
  // SELECT, which is the property this test is actually about.
  assert.deepEqual(verbs, ['SELECT', 'SELECT', 'SELECT', 'SELECT'],
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

// =====================================================================
// WP-B15-53 - display_name reaches the payload Mum's page actually reads
//
// THE DEFECT. `display_name` was populated for 109 of 109 active regulars on
// live and reached exactly ONE payload - check-item's `matched_name`. This
// module's REGULARS_SQL did not select it and presentRegular() did not project
// it, so the column Warwick edits was invisible to the surface that renders his
// catalogue.
//
// ⛔ AND THE TRAP IN FIXING IT. Every string on this row goes through P.text(),
// which turns a missing value into the LITERAL STRING "unknown". Projected that
// way, a regular Warwick has not named yet arrives at the page as a TRUTHY
// "unknown", passes every falsy guard, and renders as the product's name on
// Mum's tile. So this one is RAW and NULLABLE, like `aka` beside it.
// =====================================================================

const REGULARS_WITH_DISPLAY = [
  { id: 51, name: 'ASDA 6 Bananas', brand: null, category: 'Fruit', high_level_category: 'Food',
    asda_product_id: '1000', asda_url: null, typical_qty: 1, aka: [], substitutes_allowed: false,
    active: true, display_name: 'Bananas' },
  // Warwick has not named this one. The column is NULL.
  { id: 52, name: 'Sure Nonstop Protection Sport Cool Anti-Perspirant Aerosol 250 ml', brand: 'Sure',
    category: 'Toiletries', high_level_category: 'Household', asda_product_id: '1001', asda_url: null,
    typical_qty: 1, aka: [], substitutes_allowed: false, active: true, display_name: null },
  // Whitespace-only is "not set" everywhere else; it must be here too.
  { id: 53, name: 'Hovis soft white medium', brand: 'Hovis', category: 'Bakery',
    high_level_category: 'Food', asda_product_id: '1002', asda_url: null, typical_qty: 1,
    aka: ['bread'], substitutes_allowed: false, active: true, display_name: '   ' }
];

test('WP-B15-53: display_name is projected RAW and NULLABLE, and never as the string "unknown"', () => {
  const p = assembleRules({ rules: [], rule_qa: [], regulars: REGULARS_WITH_DISPLAY });

  const bananas = p.regulars.items.find((r) => r.id_display === '51');
  assert.equal(bananas.display_name, 'Bananas');
  assert.equal(bananas.has_display_name, true);
  // ALONGSIDE, never instead - the official listing must still be available.
  assert.equal(bananas.name_display, 'ASDA 6 Bananas');

  // ⛔ THE WHOLE POINT. null, not "unknown". A truthy "unknown" here renders as
  // the product's name on an 84-year-old's tile.
  const sure = p.regulars.items.find((r) => r.id_display === '52');
  assert.equal(sure.display_name, null);
  assert.equal(sure.has_display_name, false);
  assert.notEqual(sure.display_name, 'unknown');
  assert.equal(Boolean(sure.display_name), false, 'an unset display name must be FALSY');
  assert.match(sure.name_display, /^Sure Nonstop/, 'the catalogue string must still be there to fall back to');

  const hovis = p.regulars.items.find((r) => r.id_display === '53');
  assert.equal(hovis.display_name, null, 'whitespace-only is "not set", not a blank name on her screen');
  assert.equal(hovis.has_display_name, false);
});

test('WP-B15-53: the display SELECT differs from the base one by exactly display_name, and is SELECT-only', () => {
  const base = readRulesModule._internal.REGULARS_BASE_SQL;
  const withDisplay = readRulesModule._internal.REGULARS_DISPLAY_SQL;
  assert.match(withDisplay, /^SELECT /);
  assert.doesNotMatch(withDisplay, /\b(insert|update|delete|drop|alter|truncate|grant)\b/i);
  assert.equal(withDisplay, base.replace(' FROM asdair.regulars', ', display_name FROM asdair.regulars'));
  assert.doesNotMatch(base, /display_name/, 'the base statement must stay safe on a schema without 021');
});

test('WP-B15-53: display_name is selected ONLY when the database reports the column', async () => {
  // THE LIVE WINDOW THIS EXISTS FOR: migration 021 reaches live BY HAND after
  // this merges, so between those two moments the schema genuinely has no
  // display_name. A blind column list would take the whole rulebook read down.
  const withoutColumn = fakeClient(SCRIPT);
  await readRules({ household_id: 1, client: withoutColumn });
  const chosenWithout = withoutColumn.issued.find((q) => /FROM asdair\.regulars/.test(q.sql));
  assert.doesNotMatch(chosenWithout.sql, /display_name/,
    'a schema with no display_name must not be asked for it');

  const withColumn = fakeClient(Object.assign({}, SCRIPT, {
    'information_schema.columns': [{ column_name: 'id' }, { column_name: 'display_name' }]
  }));
  await readRules({ household_id: 1, client: withColumn });
  const chosenWith = withColumn.issued.find((q) => /FROM asdair\.regulars/.test(q.sql));
  assert.match(chosenWith.sql, /, display_name FROM asdair\.regulars/,
    'a schema that HAS the column must be asked for it, or Felix gets nothing');
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
  // WP-B15-53: every read of an asdair table still carries the household, which
  // is the property this test is about. The optional-column probe reads
  // information_schema and is parameterised by TABLE NAME, so it is asserted
  // separately rather than folded into the household claim.
  const durable = client.issued.filter((q) => /FROM asdair\./.test(q.sql));
  assert.equal(durable.length, 3, 'expected three household-scoped reads, got ' + durable.length);
  for (const q of durable) assert.deepEqual(q.params, [1]);
  const probe = client.issued.filter((q) => /FROM information_schema\.columns/.test(q.sql));
  assert.equal(probe.length, 1);
  assert.deepEqual(probe[0].params, ['regulars']);
});

// =====================================================================
// WP-B15-35 AC8 - rules in human terms, and an honest statement of limits.
// =====================================================================

test('AC8: a rule reads as one human sentence naming who it applies to', () => {
  const p = assembleRules({
    rules: [
      { id: 1, category: 'substitution', scope: 'global', directive: 'info', active: true,
        rule_text: 'Never automatically substitute products.' },
      { id: 2, category: 'quantity', scope: 'product', directive: 'info', active: true,
        rule_text: 'Usually buy 4 x 2L', matched_product: 'Cravendale Semi-Skimmed' },
    ],
    rule_qa_log: [],
  });

  const plain = p.rules.items.map((r) => r.plain_display);
  assert.equal(plain[0], 'Never automatically substitute products - applies to every shop');
  assert.equal(plain[1], 'Usually buy 4 x 2L - applies to Cravendale Semi-Skimmed');
});

test('AC8: no SQL, no enum key and no id leaks into the human sentence', () => {
  const p = assembleRules({
    rules: [{ id: 77, category: 'substitution', scope: 'global', directive: 'prefer', active: true,
      rule_text: 'Prefer the larger pack', match_category: 'dairy' }],
    rule_qa_log: [],
  });
  const s = p.rules.items[0].plain_display;
  assert.equal(/select|where|null|directive|scope=|category=/i.test(s), false,
    'the human sentence must not expose data mechanics: ' + s);
  assert.equal(/\b77\b/.test(s), false, 'a row id is not something Warwick reads');
});

test('AC8: a rule with no text gets NO invented sentence', () => {
  const p = assembleRules({
    rules: [{ id: 3, category: 'quantity', scope: 'global', directive: 'info', active: true, rule_text: null }],
    rule_qa_log: [],
  });
  assert.equal(p.rules.items[0].plain_display, 'unknown',
    'an unexplained rule must stay visibly unexplained - D-2026-08-03-16 counts these');
});

test('AC8: the surface states plainly that rule CRUD does NOT exist', () => {
  const p = assembleRules({ rules: [], rule_qa_log: [] });
  const m = p.rules.management;

  assert.equal(m.can_read, true);
  for (const k of ['can_create', 'can_edit', 'can_delete', 'can_deactivate', 'can_reorder']) {
    assert.equal(m[k], false, k + ' must be false - no such command exists on the AsdAIr surface');
  }
  assert.match(m.what_this_screen_cannot_do, /cannot add, edit, delete, switch off or reorder/);
  assert.match(m.how_rules_are_made, /LEARNED, not typed/);
});

test('AC8: the claim "no rule command exists" is checked against the real allowlist', async () => {
  // Not a description of intent. pipeline/commandNames.js IS the allowlist, so
  // if a rule command is ever added this test fails and the words above must
  // be corrected in the same change.
  const { COMMAND_NAMES } = await import('../pipeline/commandNames.js');
  const ruleCommands = COMMAND_NAMES.filter((n) => /rule/i.test(n));
  assert.deepEqual(ruleCommands, [],
    'a rule command now exists - readRules.js\'s management block is claiming otherwise');
});

test('AC8: the target clause is dropped when the rule text already names it', () => {
  // Live rulebook, 2026-08-13: "Tomato sauce means Heinz Tomato Ketchup 910g -
  // applies to Heinz Tomato Ketchup 910g". Saying it twice reads like a
  // machine talking to itself, which is the database-view feel this Work Order
  // exists to remove. Found by running the service against real data.
  const p = assembleRules({
    rules: [
      { id: 1, category: 'mapping', scope: 'product', directive: 'info', active: true,
        rule_text: 'Tomato sauce means Heinz Tomato Ketchup 910g',
        matched_product: 'Heinz Tomato Ketchup 910g' },
      { id: 2, category: 'quantity', scope: 'product', directive: 'info', active: true,
        rule_text: 'Usually buy 4 x 2L', matched_product: 'Cravendale Semi-Skimmed' },
    ],
    rule_qa_log: [],
  });

  assert.equal(p.rules.items[0].plain_display, 'Tomato sauce means Heinz Tomato Ketchup 910g',
    'the product must not be repeated back at Warwick');
  assert.equal(p.rules.items[1].plain_display, 'Usually buy 4 x 2L - applies to Cravendale Semi-Skimmed',
    'but it MUST still be named when the text does not say it');
});
