// =====================================================================
// BUILD-015 AsdAIr - order reconciliation: recordConfirmation.test.js
//
// Runs under: node --test
//
// SYNTHETIC FIXTURES ONLY. ZERO real household data. This file runs in CI on
// the PUBLIC repo.
//
// NO DATABASE. The writer's transaction shape, its SQL, its idempotency and
// its refusals are proven against a FAKE pg client that records the statements
// it is given and keeps a tiny in-memory table. No connection of any kind is
// opened, no credentials file is read, and ASDAIR_WRITE_DB_URL is never set by
// this file.
//
// PURE ASCII SOURCE ONLY.
// =====================================================================

'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const { parseConfirmation } = require('./parseConfirmation');
const { reconcile } = require('./reconcile');
const {
  recordConfirmation,
  confirmationFingerprint,
  CONFIRMATION_COLUMNS,
  LINE_COLUMNS,
  _internal
} = require('./recordConfirmation');
const { buildPayload } = require('./record-confirmation');

const F = require('./fixtures');
const P = F.P;

// ---------------------------------------------------------------------
// A fake pg "database": one table of confirmations keyed the way the writer
// keys them, plus a log of every statement. Nothing is connected.
// ---------------------------------------------------------------------
function fakeDb(options) {
  const opts = options || {};
  const confirmations = [];
  const lines = [];
  const calls = [];
  let nextId = opts.startId || 500;

  const client = {
    query: async function (sql, params) {
      const text = String(sql);
      const args = params || [];
      calls.push({ sql: text, params: args });

      if (opts.failOn && opts.failOn.test(text)) {
        throw new Error('synthetic failure on: ' + text.slice(0, 48));
      }
      if (/FROM asdair\.shop WHERE id = \$1 FOR UPDATE/.test(text)) {
        return { rows: opts.missingShop ? [] : [{ id: args[0] }] };
      }
      if (/FROM asdair\.order_confirmation /.test(text) && /content_fingerprint/.test(text)) {
        const hit = confirmations.filter(function (c) {
          return String(c.shop_id) === String(args[0]) && c.fingerprint === args[1];
        });
        return { rows: hit.length ? [{ id: hit[0].id }] : [] };
      }
      if (/INSERT INTO asdair\.order_confirmation \(/.test(text)) {
        const id = nextId++;
        let fingerprint = null;
        args.forEach(function (v) {
          if (typeof v === 'string' && v.charAt(0) === '{') {
            try { fingerprint = JSON.parse(v).content_fingerprint || fingerprint; } catch (e) { /* not json */ }
          }
        });
        confirmations.push({ id: id, shop_id: args[0], fingerprint: fingerprint, params: args, sql: text });
        return { rows: [{ id: id }] };
      }
      if (/INSERT INTO asdair\.order_confirmation_line \(/.test(text)) {
        lines.push(args);
        return { rows: [] };
      }
      return { rows: [] };
    }
  };

  return { client: client, confirmations: confirmations, lines: lines, calls: calls };
}

function sqlOf(db) {
  return db.calls.map(function (c) { return c.sql.split(/\s+/).slice(0, 4).join(' '); });
}

// Split the VALUES (...) list of an INSERT at TOP-LEVEL commas, so a nested
// COALESCE(...) counts as one entry. Returns the entries in column order.
function valuesOf(sql) {
  const start = sql.indexOf('VALUES (') + 'VALUES ('.length;
  let depth = 1;
  let i = start;
  for (; i < sql.length && depth > 0; i++) {
    if (sql[i] === '(') depth += 1;
    else if (sql[i] === ')') depth -= 1;
  }
  const body = sql.slice(start, i - 1);
  const out = [];
  let current = '';
  let d = 0;
  body.split('').forEach(function (ch) {
    if (ch === '(') d += 1;
    if (ch === ')') d -= 1;
    if (ch === ',' && d === 0) { out.push(current.trim()); current = ''; return; }
    current += ch;
  });
  if (current.trim() !== '') out.push(current.trim());
  return out;
}

// The payload the CLI would build, from the seven-outcome fixture.
function buildFixturePayload(overrides) {
  const o = overrides || {};
  return buildPayload(Object.assign({
    shop_id: 12,
    order_id: 34,
    household_id: 1,
    source_kind: 'text',
    raw_text: F.SEVEN_OUTCOME_CONFIRMATION_TEXT,
    plan: F.PLAN,
    list_items: F.LIST_ITEMS,
    regulars: F.REGULARS
  }, o));
}

// ---------------------------------------------------------------------
// The transaction
// ---------------------------------------------------------------------

test('ONE transaction: BEGIN -> lock the shop -> look for an existing row -> insert -> lines -> COMMIT', async function () {
  const built = buildFixturePayload();
  const db = fakeDb({ startId: 777 });

  const result = await recordConfirmation(built.confirmation, { client: db.client });

  assert.equal(result.created, true);
  assert.equal(result.confirmation_id, 777);
  assert.equal(result.lines_written, built.confirmation.lines.length);

  const shape = sqlOf(db);
  assert.equal(shape[0], 'BEGIN');
  assert.match(db.calls[1].sql, /FROM asdair\.shop WHERE id = \$1 FOR UPDATE/);
  assert.match(db.calls[2].sql, /content_fingerprint/);
  assert.match(db.calls[3].sql, /^INSERT INTO asdair\.order_confirmation \(/);
  assert.equal(db.calls[db.calls.length - 1].sql, 'COMMIT');

  const lineInserts = db.calls.filter(function (c) { return /INSERT INTO asdair\.order_confirmation_line/.test(c.sql); });
  assert.equal(lineInserts.length, built.confirmation.lines.length);
  assert.ok(db.calls.every(function (c) { return c.sql !== 'ROLLBACK'; }));
});

test('a failure part-way through ROLLBACKs, so a confirmation is never half-recorded', async function () {
  const built = buildFixturePayload();
  const db = fakeDb({ failOn: /INSERT INTO asdair\.order_confirmation_line/ });

  await assert.rejects(function () { return recordConfirmation(built.confirmation, { client: db.client }); },
    /synthetic failure/);

  const shape = sqlOf(db);
  assert.equal(shape[0], 'BEGIN');
  assert.equal(shape[shape.length - 1], 'ROLLBACK');
  assert.ok(shape.indexOf('COMMIT') === -1);
});

test('a confirmation for a shop that does not exist is refused, and rolls back', async function () {
  const built = buildFixturePayload();
  const db = fakeDb({ missingShop: true });
  await assert.rejects(function () { return recordConfirmation(built.confirmation, { client: db.client }); },
    /does not exist/);
  assert.equal(sqlOf(db).pop(), 'ROLLBACK');
});

test('the INSERT names exactly the shared column lists, parameterised, with no interpolated values', function () {
  const built = buildFixturePayload();
  const insert = _internal.buildConfirmationInsert(built.confirmation, 'deadbeef');

  assert.match(insert.sql, new RegExp('INSERT INTO asdair\\.order_confirmation \\(' +
    CONFIRMATION_COLUMNS.join(', ').replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\)'));
  assert.match(_internal.LINE_INSERT_SQL, new RegExp('\\(' +
    LINE_COLUMNS.join(', ').replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\)'));

  // Every value is a bound parameter or a hard SQL literal - never a value
  // spliced into the statement text.
  const values = valuesOf(insert.sql);
  values.forEach(function (v) {
    assert.ok(/^\$\d+(::jsonb)?$/.test(v) || /^COALESCE\(\$\d+::timestamptz, now\(\)\)$/.test(v) || v === 'null',
      'unexpected VALUES entry: ' + v);
  });
});

// ---------------------------------------------------------------------
// IDEMPOTENCY - natural key (shop_id, content_fingerprint)
// ---------------------------------------------------------------------

test('re-submitting the SAME confirmation for the same shop writes nothing and returns the first row', async function () {
  const built = buildFixturePayload();
  const db = fakeDb({ startId: 900 });

  const first = await recordConfirmation(built.confirmation, { client: db.client });
  const linesAfterFirst = db.lines.length;
  const second = await recordConfirmation(buildFixturePayload().confirmation, { client: db.client });

  assert.equal(first.created, true);
  assert.equal(second.created, false);
  assert.equal(second.confirmation_id, first.confirmation_id);
  assert.equal(second.lines_written, 0);
  assert.equal(db.confirmations.length, 1, 'no second header row');
  assert.equal(db.lines.length, linesAfterFirst, 'no second set of lines');
  assert.match(second.note, /already recorded/);
});

test('the natural key survives cosmetic re-paste noise: CRLF, trailing spaces and stray blank lines', function () {
  const base = F.SEVEN_OUTCOME_CONFIRMATION_TEXT;
  const noisy = '\n\n' + base.split('\n').map(function (l) { return l + '   '; }).join('\r\n') + '\n\n';

  const a = confirmationFingerprint({ shop_id: 12, source_kind: 'text', raw_text: base });
  const b = confirmationFingerprint({ shop_id: 12, source_kind: 'text', raw_text: noisy });
  assert.equal(a, b, 'a re-paste of the same confirmation is the same confirmation');
});

test('a genuinely DIFFERENT confirmation gets a different key and is recorded as new evidence', async function () {
  const db = fakeDb({ startId: 950 });
  const first = buildFixturePayload();
  const amended = buildFixturePayload({
    raw_text: F.SEVEN_OUTCOME_CONFIRMATION_TEXT + '\n1 x Generic Late Addition 200g ' + P + '1.99'
  });

  const a = await recordConfirmation(first.confirmation, { client: db.client });
  const b = await recordConfirmation(amended.confirmation, { client: db.client });

  assert.equal(a.created, true);
  assert.equal(b.created, true);
  assert.notEqual(a.confirmation_id, b.confirmation_id);
  assert.equal(db.confirmations.length, 2, 'an amendment must never be silently swallowed');
});

test('the same text arriving as a photo transcript is not conflated with the pasted one', function () {
  const asText = confirmationFingerprint({ source_kind: 'text', raw_text: 'x' });
  const asPhoto = confirmationFingerprint({ source_kind: 'photo', raw_text: 'x' });
  assert.notEqual(asText, asPhoto);
});

test('the key is stored where the lookup reads it, so the two can never disagree', function () {
  const built = buildFixturePayload();
  const fingerprint = confirmationFingerprint(built.confirmation);
  const insert = _internal.buildConfirmationInsert(built.confirmation, fingerprint);

  const parsedParam = insert.params.filter(function (v) { return typeof v === 'string' && v.charAt(0) === '{'; })[0];
  assert.equal(JSON.parse(parsedParam).content_fingerprint, fingerprint);
  assert.match(_internal.FIND_EXISTING_SQL, /parsed->>'content_fingerprint' = \$2/);
});

test('a confirmation with no evidence at all has no natural key and is refused', function () {
  assert.throws(function () { confirmationFingerprint({ shop_id: 1, source_kind: 'text' }); },
    /raw_text or raw_media_path/);
});

// ---------------------------------------------------------------------
// THE PRICE CONTRACT, at the write boundary
// ---------------------------------------------------------------------

function withLine(overrides) {
  const built = buildFixturePayload();
  const c = JSON.parse(JSON.stringify(built.confirmation));
  c.lines = [Object.assign({
    line_no: 1,
    product_name: 'Generic Widget A 500g',
    quantity: 1,
    pack_size: null,
    promotion: null,
    line_price: 2.00,
    price_basis: 'stated',
    matched_regular_id: null,
    outcome: 'as_planned',
    note: null
  }, overrides)];
  return c;
}

test('price_basis "unknown" carrying a price is refused - unknown means null', function () {
  assert.throws(function () { _internal.assertRecordable(withLine({ price_basis: 'unknown', line_price: 2.00 })); },
    /Unknown means null/);
});

test('price_basis "stated" or "derived" without a price is refused', function () {
  assert.throws(function () { _internal.assertRecordable(withLine({ price_basis: 'stated', line_price: null })); },
    /but no price/);
  assert.throws(function () { _internal.assertRecordable(withLine({ price_basis: 'derived', line_price: null })); },
    /but no price/);
});

test('a missing or out-of-vocabulary price_basis is refused - it is required, not an optional flag', function () {
  const noBasis = withLine({});
  delete noBasis.lines[0].price_basis;
  assert.throws(function () { _internal.assertRecordable(noBasis); }, /REQUIRED field on every line/);
  assert.throws(function () { _internal.assertRecordable(withLine({ price_basis: 'estimated' })); },
    /is not one of: stated, derived, unknown/);
});

test('a DERIVED price with no ASDA-stated order total behind it is refused as a fabrication', function () {
  const c = withLine({ price_basis: 'derived', line_price: 3.50 });
  c.stated_total = null;
  c.stated_total_basis = 'unknown';
  assert.throws(function () { _internal.assertRecordable(c); }, /derive it from is a fabrication/);

  c.stated_total = 8.50;
  c.stated_total_basis = 'stated';
  assert.doesNotThrow(function () { _internal.assertRecordable(c); });
});

test('a DERIVED total can never be written into stated_total: the column is a SQL literal null unless ASDA stated it', function () {
  const c = withLine({ price_basis: 'stated', line_price: 2.00 });
  c.stated_total = null;
  c.stated_total_basis = 'unknown';

  const insert = _internal.buildConfirmationInsert(c, 'deadbeef');
  const idx = CONFIRMATION_COLUMNS.indexOf('stated_total');
  const values = valuesOf(insert.sql);
  assert.equal(values[idx], 'null', 'stated_total is not even a parameter unless ASDA stated the total');

  // And a caller that tries to smuggle one in is refused outright.
  const smuggled = withLine({});
  smuggled.stated_total = 999.99;
  smuggled.stated_total_basis = 'unknown';
  assert.throws(function () { _internal.assertRecordable(smuggled); }, /must never be recorded there/);

  ['derived', 'inferred', 'estimated', 'computed', 'assumed', 'true', 'yes', 'force'].forEach(function (bogus) {
    const spray = withLine({});
    spray.stated_total = 123.45;
    spray.stated_total_basis = bogus;
    assert.throws(function () { _internal.assertRecordable(spray); },
      /stated_total_basis must be "stated" or "unknown"|must never be recorded there/,
      'basis "' + bogus + '" must not unlock stated_total');
  });
});

test('an omitted line carrying price information is refused - it appears on no receipt', function () {
  assert.throws(function () {
    _internal.assertRecordable(withLine({ outcome: 'omitted', price_basis: 'stated', line_price: 2.00 }));
  }, /appears on no receipt/);
  assert.doesNotThrow(function () {
    _internal.assertRecordable(withLine({ outcome: 'omitted', price_basis: 'unknown', line_price: null }));
  });
});

test('an out-of-vocabulary outcome is refused', function () {
  assert.throws(function () { _internal.assertRecordable(withLine({ outcome: 'probably_fine' })); },
    /is not one of/);
});

test('the reconciled rows the pipeline actually produces all pass the write boundary', function () {
  const built = buildFixturePayload();
  assert.doesNotThrow(function () { _internal.assertRecordable(built.confirmation); });
  built.confirmation.lines.forEach(function (l) {
    if (l.price_basis === 'unknown') assert.equal(l.line_price, null);
  });
});

// ---------------------------------------------------------------------
// Other required-field guards
// ---------------------------------------------------------------------

test('shop_id, source_kind, evidence, line_no, product_name and quantity are all guarded', function () {
  const base = buildFixturePayload().confirmation;

  const noShop = Object.assign({}, base, { shop_id: null });
  assert.throws(function () { _internal.assertRecordable(noShop); }, /shop_id is required/);

  const badKind = Object.assign({}, base, { source_kind: 'voicemail' });
  assert.throws(function () { _internal.assertRecordable(badKind); }, /is not one of/);

  const noEvidence = Object.assign({}, base, { raw_text: null, raw_media_path: null });
  assert.throws(function () { _internal.assertRecordable(noEvidence); }, /raw evidence is ALWAYS/);

  assert.throws(function () { _internal.assertRecordable(withLine({ line_no: 0 })); }, /line_no must be a positive/);
  assert.throws(function () { _internal.assertRecordable(withLine({ product_name: '  ' })); }, /product_name is required/);
  assert.throws(function () { _internal.assertRecordable(withLine({ quantity: 0 })); }, /never assumed to be 1/);
  assert.throws(function () { _internal.assertRecordable(withLine({ quantity: 1.5 })); }, /never assumed to be 1/);
  assert.doesNotThrow(function () { _internal.assertRecordable(withLine({ quantity: null })); });
});

test('a duplicated line_no is refused', function () {
  const c = buildFixturePayload().confirmation;
  const dup = Object.assign({}, c, {
    lines: [c.lines[0], Object.assign({}, c.lines[1], { line_no: c.lines[0].line_no })]
  });
  assert.throws(function () { _internal.assertRecordable(dup); }, /is duplicated/);
});

test('reconciled_at is only set when every line actually carries an outcome', function () {
  const c = buildFixturePayload().confirmation;
  const withOutcomes = _internal.buildConfirmationInsert(c, 'x');
  assert.equal(withOutcomes.reconciled, true);

  const stripped = Object.assign({}, c, {
    lines: c.lines.map(function (l) { return Object.assign({}, l, { outcome: null }); })
  });
  const noOutcomes = _internal.buildConfirmationInsert(stripped, 'x');
  assert.equal(noOutcomes.reconciled, false);
  const idx = CONFIRMATION_COLUMNS.indexOf('reconciled_at');
  const values = valuesOf(noOutcomes.sql);
  assert.equal(values[idx], 'null');
});

test('the line parameters line up with LINE_COLUMNS, position for position', function () {
  const c = buildFixturePayload().confirmation;
  const params = _internal.lineParams(42, c.lines[0]);
  assert.equal(params.length, LINE_COLUMNS.length);
  assert.equal(params[LINE_COLUMNS.indexOf('confirmation_id')], 42);
  assert.equal(params[LINE_COLUMNS.indexOf('line_no')], c.lines[0].line_no);
  assert.equal(params[LINE_COLUMNS.indexOf('product_name')], c.lines[0].product_name);
  assert.equal(params[LINE_COLUMNS.indexOf('price_basis')], c.lines[0].price_basis);
});

// ---------------------------------------------------------------------
// Credentials and the runtime caller
// ---------------------------------------------------------------------

test('validation and SQL building need no environment at all - nothing is read, nothing is echoed', function () {
  const saved = { w: process.env.ASDAIR_WRITE_DB_URL, r: process.env.ASDAIR_DB_URL };
  delete process.env.ASDAIR_WRITE_DB_URL;
  delete process.env.ASDAIR_DB_URL;
  try {
    const built = buildFixturePayload();
    assert.doesNotThrow(function () { _internal.assertRecordable(built.confirmation); });
    assert.doesNotThrow(function () { _internal.buildConfirmationInsert(built.confirmation, 'abc'); });
    assert.equal(typeof confirmationFingerprint(built.confirmation), 'string');
  } finally {
    if (saved.w !== undefined) process.env.ASDAIR_WRITE_DB_URL = saved.w;
    if (saved.r !== undefined) process.env.ASDAIR_DB_URL = saved.r;
  }
});

test('--dry-run validates the whole pipeline, opens NO connection and needs NO credentials', function () {
  const payload = {
    shop_id: 12,
    order_id: 34,
    household_id: 1,
    source_kind: 'text',
    raw_text: F.MESSY_CONFIRMATION_TEXT,
    plan: F.PLAN,
    list_items: F.LIST_ITEMS,
    regulars: F.REGULARS
  };
  const file = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'asdair-reconcile-')), 'payload.json');
  fs.writeFileSync(file, JSON.stringify(payload), 'utf8');

  const env = Object.assign({}, process.env);
  delete env.ASDAIR_WRITE_DB_URL;
  delete env.ASDAIR_DB_URL;

  const out = execFileSync(process.execPath, [path.join(__dirname, 'record-confirmation.js'), '--file', file, '--dry-run'],
    { env: env, encoding: 'utf8' });
  const report = JSON.parse(out);

  assert.equal(report.dry_run, true);
  assert.match(report.note, /no connection was opened/);
  assert.equal(report.would_write.shop_id, 12);
  assert.equal(report.would_write.natural_key, 'shop_id + content_fingerprint');
  assert.equal(typeof report.would_write.content_fingerprint, 'string');

  // Prices are only ever rendered through formatLinePrice.
  const unpriced = report.would_write.lines.filter(function (l) { return l.price_basis === 'unknown'; });
  assert.ok(unpriced.length >= 1);
  unpriced.forEach(function (l) { assert.equal(l.price, 'price not shown by ASDA'); });
  report.would_write.lines.forEach(function (l) {
    if (l.price_basis === 'derived') assert.match(l.price, /DERIVED/);
    if (l.price_basis === 'stated') assert.match(l.price, /as shown by ASDA/);
  });

  fs.rmSync(path.dirname(file), { recursive: true, force: true });
});

test('the end-to-end pipeline records the 32-line confirmation in one transaction', async function () {
  const parsed = parseConfirmation({ text: F.MESSY_CONFIRMATION_TEXT });
  const plan = {
    items: F.EXPECTED_LINES.map(function (row) {
      return { item_name: row[0], matched_product: row[0], planned_qty: row[1], status: 'add' };
    })
  };
  const reconciled = reconcile({ confirmation: parsed, plan: plan, list_items: [], regulars: [], household_id: 1 });

  const confirmation = {
    shop_id: 12,
    source_kind: 'text',
    raw_text: F.MESSY_CONFIRMATION_TEXT,
    stated_total: parsed.stated_total,
    stated_total_basis: parsed.stated_total_basis,
    parser_version: parsed.parser_version,
    parse_summary: parsed.summary,
    reconcile_summary: reconciled.summary,
    lines: reconciled.lines
  };

  const db = fakeDb({ startId: 1000 });
  const result = await recordConfirmation(confirmation, { client: db.client });

  assert.equal(result.created, true);
  assert.equal(result.lines_written, 32);
  assert.equal(db.lines.length, 32);

  // The unpriced line reached the database as null + 'unknown'.
  const basisIdx = LINE_COLUMNS.indexOf('price_basis');
  const priceIdx = LINE_COLUMNS.indexOf('line_price');
  const nameIdx = LINE_COLUMNS.indexOf('product_name');
  const unknown = db.lines.filter(function (p) { return p[basisIdx] === 'unknown'; });
  assert.equal(unknown.length, 1);
  assert.equal(unknown[0][nameIdx], F.UNPRICED_PRODUCT);
  assert.equal(unknown[0][priceIdx], null);

  // stated_total was never shown, so the column is a SQL literal null.
  const values = valuesOf(db.confirmations[0].sql);
  assert.equal(values[CONFIRMATION_COLUMNS.indexOf('stated_total')], 'null');
});
