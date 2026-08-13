// BUILD-015 WP-B15-51 - cockpit-api/displayName.test.js
//
// THE THIRD FIELD. What Warwick types, what Mum reads, and the one property the
// whole design rests on: THE MATCHER NEVER READS IT.
//
// ── AC5 IS THE REASON THIS FILE EXISTS ────────────────────────────────────
//
// Larry's first plan was to let Warwick edit `aka`. `aka` is the MATCHER'S
// input, so that would have silently changed what written lines resolve to -
// renaming the BOB milk to "milk" makes every written "milk" ambiguous against
// the Cravendale. Warwick separated the concerns himself, and the safety
// property of his design is negative: setting a display_name changes NOTHING
// about resolution, however hostile the value.
//
// A negative property is exactly the kind that decays into a comment, so it is
// proven here by EXECUTION against the real resolver. The proof injects
// `display_name` DIRECTLY into the regular objects the resolver is handed -
// deliberately the most hostile shape, and stronger than proving the loader
// does not select the column, because it keeps holding if a future loader
// starts to.
//
// 'use strict' and require(), matching every sibling in this folder.
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const displayName = require('./displayName');
const resolver = require('../interpret/resolveByCatalogue.js');

// A faithful slice of the real catalogue. The Cravendale and the BOB milk are
// the pair that makes the hazard real: they are two different products that a
// careless display name could confuse.
const REGULARS = [
  { id: 4, name: 'Cravendale Arla  Filtered Fresh Semi Skimmed Milk 2L Fresher for Longer', aka: ['arla 4pt milk', 'arla semi', 'milk'] },
  { id: 2, name: 'ASDA British Milk Semi Skimmed 6 Pints', aka: ['6pt milk', 'franks 6 pint'] },
  { id: 12, name: 'Dreamies DREAMIES Cat Treat Biscuits With Cheese Flavour 200g', aka: ['dreamies cheese', 'dreamies'] },
];

// ── 1. AC5. THE MATCHER NEVER READS display_name ───────────────────────────

test('AC5: a display_name that names a DIFFERENT product changes no resolution', () => {
  const terms = ['milk', 'arla semi', '6pt milk', 'dreamies cheese', 'dreamies', 'franks 6 pint'];

  const before = terms.map((t) => resolver.resolveReading(t, REGULARS));

  // THE HOSTILE CASE, and it is the exact one the Work Order named: give the
  // Cravendale a display_name that reads as the OTHER milk, and give every
  // other row a display_name that reads as something else again.
  const poisoned = REGULARS.map((r) => Object.assign({}, r, {
    display_name: r.id === 4 ? 'ASDA British Milk Semi Skimmed 6 Pints' : 'dreamies cheese',
  }));

  const after = terms.map((t) => resolver.resolveReading(t, poisoned));

  terms.forEach((t, i) => {
    assert.deepEqual(after[i], before[i], 'resolution of "' + t + '" moved when a display_name was set');
  });

  // And the hazard was real rather than vacuous: these terms DO resolve to
  // something, so "nothing changed" is not "nothing happened".
  assert.equal(before[0].matched_regular_id, 4, 'the fixture must actually resolve, or this proves nothing');
  assert.equal(before[2].matched_regular_id, 2);
});

test('AC5: the resolver reads name and aka, and a display_name cannot substitute for either', () => {
  // A row whose ONLY route to the term is its display_name must NOT match.
  const onlyDisplay = [{ id: 99, name: 'Something Else Entirely 500g', aka: [], display_name: 'chocolate biscuits' }];
  const r = resolver.resolveReading('chocolate biscuits', onlyDisplay);
  assert.equal(r.matched_regular_id, null, 'a display_name became a matching term - the boundary is broken');
  assert.equal(r.status, 'unmatched_new_item');
});

// ── 2. THE READ RULE: what Mum is shown ────────────────────────────────────

test('displayNameFor prefers the display name when Warwick has set one', () => {
  assert.equal(
    displayName.displayNameFor({ display_name: 'Milk', name: 'Cravendale Arla Filtered Fresh...' }, 'Cravendale Arla Filtered Fresh...'),
    'Milk'
  );
});

test('displayNameFor falls back when it is null, empty, whitespace, absent or the row is missing', () => {
  const fallback = 'ASDA British Milk Semi Skimmed 6 Pints';
  assert.equal(displayName.displayNameFor({ display_name: null }, fallback), fallback);
  assert.equal(displayName.displayNameFor({ display_name: '' }, fallback), fallback);
  assert.equal(displayName.displayNameFor({ display_name: '   ' }, fallback), fallback);
  assert.equal(displayName.displayNameFor({}, fallback), fallback);
  assert.equal(displayName.displayNameFor(null, fallback), fallback);
  assert.equal(displayName.displayNameFor(undefined, fallback), fallback);
  // A non-string value is not a name.
  assert.equal(displayName.displayNameFor({ display_name: 42 }, fallback), fallback);
  // No fallback offered is null, never undefined.
  assert.equal(displayName.displayNameFor({ display_name: null }), null);
});

// ── 3. WHAT HE TYPED, AS IT WILL BE STORED ─────────────────────────────────

test('his words are his: trimmed at the ends and otherwise untouched', () => {
  assert.equal(displayName.normaliseDisplayName('  Cat food  '), 'Cat food');
  // Internal spacing, case and punctuation survive exactly.
  assert.equal(displayName.normaliseDisplayName("Frank's  BIG tin of beans"), "Frank's  BIG tin of beans");
});

test('null, empty and whitespace all CLEAR it - he can undo a bad name', () => {
  assert.equal(displayName.normaliseDisplayName(null), null);
  assert.equal(displayName.normaliseDisplayName(undefined), null);
  assert.equal(displayName.normaliseDisplayName(''), null);
  assert.equal(displayName.normaliseDisplayName('    '), null);
});

test('an over-long name is REFUSED, never truncated', () => {
  const long = 'x'.repeat(displayName.MAX_DISPLAY_NAME + 1);
  assert.throws(() => displayName.normaliseDisplayName(long), (e) => {
    assert.equal(e.code, 'display_name_too_long');
    assert.equal(e.expose, true);
    // The refusal names both numbers, so he can see how much to cut.
    assert.match(e.message, new RegExp(String(displayName.MAX_DISPLAY_NAME)));
    return true;
  });
  // The boundary itself is allowed.
  assert.equal(displayName.normaliseDisplayName('x'.repeat(displayName.MAX_DISPLAY_NAME)).length,
    displayName.MAX_DISPLAY_NAME);
});

test('a non-string display name is refused rather than coerced', () => {
  [42, true, {}, []].forEach((v) => {
    assert.throws(() => displayName.normaliseDisplayName(v), (e) => e.code === 'display_name_invalid');
  });
});

test('the catalogue id must be a whole positive number, in any of the shapes JSON carries', () => {
  assert.equal(displayName.normaliseId(7), 7);
  assert.equal(displayName.normaliseId('7'), 7);      // bigint arrives as a string
  assert.equal(displayName.normaliseId(' 7 '), 7);
  [null, undefined, '', 'abc', 0, -1, 1.5, true].forEach((v) => {
    assert.throws(() => displayName.normaliseId(v), (e) => e.code === 'id_invalid', 'accepted ' + JSON.stringify(v));
  });
});

// ── 4. THE WRITE: one row, one column ──────────────────────────────────────

/** A stub write connection that records exactly what it was asked to run. */
function recordingWrite(rows) {
  const seen = [];
  const writeQuery = async (sql, params) => {
    seen.push({ sql, params });
    return { rows: rows === undefined ? [{ id: 4, display_name: 'Milk' }] : rows };
  };
  return { writeQuery, seen };
}

test('the write sets display_name and updated_at, and names no other column', async () => {
  const w = recordingWrite();
  const out = await displayName.setDisplayName({ id: '4', display_name: '  Milk  ' }, w);

  assert.deepEqual(out, { id: 4, display_name: 'Milk' });
  assert.equal(w.seen.length, 1, 'exactly one statement');

  const sql = w.seen[0].sql;
  assert.equal(sql, displayName.UPDATE_SQL);
  assert.match(sql, /SET display_name = \$1, updated_at = now\(\)/);
  assert.match(sql, /WHERE id = \$2/);
  // The trimmed value and the numeric id, in that order, and nothing else.
  assert.deepEqual(w.seen[0].params, ['Milk', 4]);
});

test('AC4: name and aka in the body do not reach the statement', async () => {
  const w = recordingWrite();
  await displayName.setDisplayName(
    // The route only ever passes these two keys; this asserts the module would
    // ignore the rest even if it were handed them.
    Object.assign({ id: 4, display_name: 'Milk' }, { name: 'HACKED', aka: ['hacked'], display_name_extra: 'x' }),
    w
  );
  const { sql, params } = w.seen[0];
  assert.ok(!/\bname\s*=/.test(sql.replace(/display_name\s*=/g, '')), 'the statement assigns `name`');
  assert.ok(!/\baka\s*=/.test(sql), 'the statement assigns `aka`');
  assert.deepEqual(params, ['Milk', 4], 'a body key reached the parameters');
});

test('clearing sends a real NULL, not the string "null"', async () => {
  const w = recordingWrite([{ id: 4, display_name: null }]);
  const out = await displayName.setDisplayName({ id: 4, display_name: '' }, w);
  assert.equal(w.seen[0].params[0], null);
  assert.equal(out.display_name, null);
});

test('a write that matched no row is an error, never a quiet success', async () => {
  const w = recordingWrite([]);
  await assert.rejects(
    () => displayName.setDisplayName({ id: 999999, display_name: 'Milk' }, w),
    (e) => e.code === 'regular_not_found' && e.expose === true
  );
});

test('validation happens BEFORE the database is touched', async () => {
  const w = recordingWrite();
  await assert.rejects(() => displayName.setDisplayName({ id: 'nope', display_name: 'Milk' }, w),
    (e) => e.code === 'id_invalid');
  await assert.rejects(() => displayName.setDisplayName({ id: 4, display_name: 'x'.repeat(200) }, w),
    (e) => e.code === 'display_name_too_long');
  assert.equal(w.seen.length, 0, 'a statement was issued for input that should never have reached one');
});

test('no write connection is a configuration failure, not a bad request', async () => {
  await assert.rejects(() => displayName.setDisplayName({ id: 4, display_name: 'Milk' }, {}),
    (e) => e.code === 'ASDAIR_CONFIG_MISSING' && e.expose !== true);
});

// ── 5. IMPORT PURITY, the construction rule every module here follows ──────

test('the module imports with no pg and no environment', () => {
  // It is already required at the top of this file; if it had reached for `pg`
  // or an env var at import time, that would have thrown before any test ran.
  assert.equal(typeof displayName.setDisplayName, 'function');
  assert.equal(typeof displayName.displayNameFor, 'function');
});
