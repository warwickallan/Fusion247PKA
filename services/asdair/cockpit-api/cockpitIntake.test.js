// =====================================================================
// BUILD-015 AsdAIr WP-B15-48 - cockpit-api/cockpitIntake.test.js
//
// AC2. THE ADAPTER IS AN ADAPTER.
//
// Two halves, deliberately:
//
//   1. PURE - the translation itself. Offline, no imports beyond the module.
//   2. THE JOIN - the spec this adapter produces is handed to the REAL
//      `receiveList` over the REAL `shopStore`, on the pipeline's own fully
//      offline harness (a fake `pg` carrying the real unique indexes). This is
//      the half that matters: it proves the adapter JOINED the existing intake
//      path rather than growing a second one beside it. A test that only
//      asserts the shape of an object would pass just as happily against a
//      spec no command could consume.
//
// The live HTTP-and-Postgres proof is AC5 and lives in the return, not here.
// Nothing in this file opens a socket, a pool or a credentials file.
// =====================================================================

'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

const intake = require('./cockpitIntake');

const STAMP = '2026-08-13T09:15:00.000Z';
const LIST = [
  { id: '13', name: 'Arla semi-skimmed 4pt', qty: 2 },
  { id: '12', name: 'Weetabix Protein', qty: 1 },
];

function build(overrides, opts) {
  return intake.buildReceiveListSpec(
    Object.assign({ household: 1, items: LIST }, overrides || {}),
    Object.assign({ receivedAt: STAMP }, opts || {})
  );
}

// ---------------------------------------------------------------------
// 1. THE TRANSLATION
// ---------------------------------------------------------------------

test('AC2: the spec is the Telegram translator\'s shape, with the three telegram fields UNSET', () => {
  const { spec } = build();
  assert.equal(spec.householdId, 1);
  assert.equal(spec.sourceKind, 'text');
  assert.equal(spec.actor, 'cockpit:mum');
  assert.equal(spec.listDate, '2026-08-13');
  assert.equal(spec.needsReview, false);
  assert.equal(spec.rawMediaPath, null);
  // The three that have no meaning on this channel. Inventing any of them would
  // make the inbound unique index match rows it has no business matching.
  assert.equal(spec.telegramChatId, null);
  assert.equal(spec.telegramMessageId, null);
  assert.equal(spec.telegramUpdateId, null);
});

test('AC2: the clock is INJECTED - the week comes from the receiver\'s stamp, never from this machine', () => {
  const past = build({}, { receivedAt: '2019-01-02T23:59:59.000Z' });
  assert.equal(past.spec.listDate, '2019-01-02');
  // A Date object is accepted and normalised the same way.
  const asDate = build({}, { receivedAt: new Date('2030-06-07T00:00:01.000Z') });
  assert.equal(asDate.spec.listDate, '2030-06-07');
  // And a missing stamp is a caller bug, refused rather than defaulted to now:
  // defaulting would make the shop_ref depend on when the test happened to run.
  assert.throws(() => intake.buildReceiveListSpec({ household: 1, items: LIST }, {}),
    (err) => { assert.equal(err.code, 'intake_clock_invalid'); return true; });
});

test('AC2: rawText is a deterministic plain-words rendering, one line per item, quantity included', () => {
  const { rawText } = build();
  assert.equal(rawText, '2 x Arla semi-skimmed 4pt\n1 x Weetabix Protein');
  // HER order, not a tidied one.
  const reversed = build({ items: [LIST[1], LIST[0]] });
  assert.equal(reversed.rawText, '1 x Weetabix Protein\n2 x Arla semi-skimmed 4pt');
  // The catalogue id is NOT in the evidence text: this line is the name she was shown.
  assert.doesNotMatch(rawText, /\b13\b/);
});

test('AC2: a hyphen survives - the sanitiser removes control characters, not punctuation', () => {
  const { rawText } = build({ items: [{ name: 'semi-skimmed milk', qty: 1 }] });
  assert.equal(rawText, '1 x semi-skimmed milk');
});

test('AC2: a smuggled newline cannot forge a second item in the evidence', () => {
  const { rawText, items } = build({ items: [{ name: 'milk\n99 x whisky', qty: 1 }] });
  assert.equal(items.length, 1);
  assert.equal(rawText.split('\n').length, 1);
  assert.equal(rawText, '1 x milk 99 x whisky');
});

test('AC2: an absent quantity means one, because that is what a tap means', () => {
  assert.equal(build({ items: [{ name: 'bread' }] }).items[0].qty, 1);
  assert.equal(build({ items: [{ name: 'bread', qty: null }] }).items[0].qty, 1);
});

// ---------------------------------------------------------------------
// 2. THE FINGERPRINT (ruling A1)
//
// PINNED TO A LITERAL. The expected digest is written out here, in the test,
// rather than recomputed from the module: a derivation that checks itself
// cannot notice when it changes. If this literal has to move, that is a
// deliberate act with a reason, exactly like the route and command counts.
// ---------------------------------------------------------------------

const PINNED_SOURCE_ID = 'cockpit:mum:list:36c46f6a78207ba6';

test('A1: the sourceId is derived from the CONTENT and is pinned to a literal', () => {
  assert.equal(build().spec.sourceId, PINNED_SOURCE_ID);
  // Deterministic across calls and across object identity.
  assert.equal(build().spec.sourceId, build().spec.sourceId);
  assert.match(build().spec.sourceId, /^cockpit:mum:list:[0-9a-f]{16}$/);
});

test('A1: an IDENTICAL re-send produces the SAME sourceId - it must stay one row', () => {
  const first = build();
  const second = build({ items: LIST.map((i) => Object.assign({}, i)) });
  assert.equal(second.spec.sourceId, first.spec.sourceId);
});

test('A1: every kind of CHANGE moves the sourceId - a corrected re-send is never invisible', () => {
  const base = build().spec.sourceId;
  const cases = {
    'one more item': build({ items: LIST.concat([{ id: '14', name: 'Hovis wholemeal', qty: 1 }]) }),
    'a changed quantity': build({ items: [Object.assign({}, LIST[0], { qty: 3 }), LIST[1]] }),
    'a changed name': build({ items: [Object.assign({}, LIST[0], { name: 'Arla whole 4pt' }), LIST[1]] }),
    'a different catalogue id behind the same words': build({ items: [Object.assign({}, LIST[0], { id: '99' }), LIST[1]] }),
    'a different order': build({ items: [LIST[1], LIST[0]] }),
    'a different household': build({ household: 2 }),
  };
  Object.keys(cases).forEach((why) => {
    assert.notEqual(cases[why].spec.sourceId, base, why + ' must change the fingerprint');
  });
});

// ---------------------------------------------------------------------
// 3. REFUSALS - coded, and safe to show her
// ---------------------------------------------------------------------

test('AC2: every refusal carries a machine code and is safe to show the caller', () => {
  const cases = [
    [{ household: 1, items: [] }, 'list_empty'],
    [{ household: 1, items: 'milk' }, 'list_empty'],
    [{ household: 1, items: new Array(201).fill({ name: 'x' }) }, 'list_too_long'],
    [{ household: 1, items: [{ name: '' }] }, 'list_item_invalid'],
    [{ household: 1, items: [{ name: 42 }] }, 'list_item_invalid'],
    [{ household: 1, items: [{ name: 'x'.repeat(121) }] }, 'list_item_invalid'],
    [{ household: 1, items: [{ name: 'milk', qty: 0 }] }, 'list_qty_invalid'],
    [{ household: 1, items: [{ name: 'milk', qty: 21 }] }, 'list_qty_invalid'],
    [{ household: 1, items: [{ name: 'milk', qty: 1.5 }] }, 'list_qty_invalid'],
    [{ items: LIST }, 'household_missing'],
    [{ household: 0, items: LIST }, 'household_invalid'],
    [{ household: 'kitchen', items: LIST }, 'household_invalid'],
  ];
  cases.forEach(function (pair) {
    assert.throws(
      () => intake.buildReceiveListSpec(pair[0], { receivedAt: STAMP }),
      (err) => {
        assert.equal(err.code, pair[1], JSON.stringify(pair[0]) + ' should be ' + pair[1]);
        assert.equal(err.expose, true);
        assert.ok(err.message.length > 0);
        return true;
      }
    );
  });
});

test('AC2: the refusal names WHICH item, because "invalid list" is not actionable', () => {
  assert.throws(
    () => intake.buildReceiveListSpec({ household: 1, items: [{ name: 'milk' }, { name: 'bread', qty: 99 }] },
      { receivedAt: STAMP }),
    /item 2/
  );
});

// ---------------------------------------------------------------------
// 4. IT IS AN ADAPTER - the anti-pattern check, on the source itself
// ---------------------------------------------------------------------

test('AC2: this module implements NO shopping logic and opens nothing', () => {
  const src = fs.readFileSync(require.resolve('./cockpitIntake.js'), 'utf8');
  assert.doesNotMatch(src, /require\(['"]pg['"]\)/);
  assert.doesNotMatch(src, /INSERT|UPDATE\s+asdair|SELECT\s/i);
  assert.doesNotMatch(src, /process\.env/);
  assert.doesNotMatch(src, /loadCatalogue|resolveByCatalogue|planBasket|rulebook/);
  // Only one core module, and it is the hash.
  const requires = (src.match(/require\('([^']+)'\)/g) || []).sort();
  assert.deepEqual(requires, ["require('crypto')"]);
});

// ---------------------------------------------------------------------
// 5. THE JOIN - the spec really is consumable by the REAL receiveList
//
// The pipeline's own harness: REAL shopStore, REAL shopState, REAL commands,
// fake `pg` carrying the real unique indexes. No database, no network.
// ---------------------------------------------------------------------

async function realHarness() {
  const { makeHarness } = await import('../pipeline/test/harness.js');
  const commands = await import('../pipeline/commands.js');
  const h = makeHarness();
  return { commands: commands, deps: h.deps, db: h.db };
}

/** The receiveList rows the harness actually holds, newest last. */
function receiveRows(db) {
  return db.pipeline_command.filter((r) => r.command === 'receiveList');
}

function argsOf(row) {
  return typeof row.args === 'string' ? JSON.parse(row.args) : row.args;
}

test('AC2 JOIN: the adapter\'s spec drives the REAL receiveList to a real shop row', async () => {
  const { commands, deps, db } = await realHarness();
  const { spec } = build();

  const receipt = await commands.receiveList(spec, deps);

  assert.equal(receipt.ok, true);
  assert.equal(receipt.command, 'receiveList');
  assert.equal(receipt.created, true);
  assert.equal(receipt.matched_by, 'insert');
  assert.equal(receipt.shop_ref, 'SHOP-2026-08-13');
  assert.equal(receipt.source_id, PINNED_SOURCE_ID);

  assert.equal(db.shop.length, 1);
  const shop = db.shop[0];
  assert.equal(shop.source_kind, 'text');
  assert.equal(String(shop.household_id), '1');
  assert.equal(shop.needs_review, false);
  assert.equal(shop.telegram_chat_id, null);
  assert.equal(shop.telegram_message_id, null);
  // The raw evidence really is retained, and it is what she was shown.
  assert.equal(shop.raw_text, '2 x Arla semi-skimmed 4pt\n1 x Weetabix Protein');
});

test('AC4 OFFLINE: an IDENTICAL re-send creates NO second shop and NO second command row', async () => {
  const { commands, deps, db } = await realHarness();

  const first = await commands.receiveList(build().spec, deps);
  const again = await commands.receiveList(build().spec, deps);

  assert.equal(first.created, true);
  assert.equal(again.created, false);
  assert.equal(again.resumed, true);
  assert.equal(again.matched_by, 'shop_ref');
  assert.equal(again.shop_id, first.shop_id);
  assert.equal(again.duplicate, true, 'the command row was already there, and the caller is told so');

  assert.equal(db.shop.length, 1, 'a second identical send must never create a second week');
  assert.equal(receiveRows(db).length, 1, 'an identical re-send is one durable intent, not two');
});

test('AC4 OFFLINE: a CHANGED re-send still writes no new shop, but IS durably recorded (ruling A1)', async () => {
  const { commands, deps, db } = await realHarness();

  await commands.receiveList(build().spec, deps);
  const corrected = build({ items: LIST.concat([{ id: '20', name: 'Hovis soft white medium', qty: 1 }]) });
  const second = await commands.receiveList(corrected.spec, deps);

  assert.equal(second.created, false, 'the day already has its shop - this is the honest answer');
  assert.equal(second.matched_by, 'shop_ref');
  assert.equal(db.shop.length, 1);

  // THE LIMIT, ASSERTED RATHER THAN GLOSSED: her correction does NOT become the
  // shop's evidence. raw_* is deliberately outside shopStore's UPDATE allowlist.
  assert.equal(db.shop[0].raw_text, '2 x Arla semi-skimmed 4pt\n1 x Weetabix Protein');

  // What ruling A1 buys: the second send is not invisible.
  const rows = receiveRows(db);
  assert.equal(rows.length, 2, 'a CHANGED re-send leaves one honest durable row saying what she sent');
  assert.notEqual(rows[0].idempotency_key, rows[1].idempotency_key);
  assert.deepEqual(
    rows.map((r) => argsOf(r).source_id).sort(),
    [PINNED_SOURCE_ID, corrected.spec.sourceId].sort()
  );
});

test('AC2 JOIN: the actor recorded on the command row says the COCKPIT submitted it', async () => {
  const { commands, deps, db } = await realHarness();
  await commands.receiveList(build().spec, deps);
  const rows = receiveRows(db);
  assert.equal(rows.length, 1);
  const args = argsOf(rows[0]);
  assert.equal(args.actor, 'cockpit:mum');
  assert.equal(args.source_kind, 'text');
  assert.equal(args.source_id, PINNED_SOURCE_ID);
});
