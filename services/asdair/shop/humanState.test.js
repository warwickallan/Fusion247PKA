// =====================================================================
// BUILD-015 AsdAIr - shop/humanState.test.js
//
// Runs under: node --test
//
// Proves the ONE six-value derivation (WP-B15-35 AC1/AC2):
//   1. the vocabulary matches migration 020's CHECK constraint, parsed off
//      disk rather than hand-copied (schemaCompat.test.js's strategy);
//   2. every one of the 12 pipeline statuses is mapped exactly once, asserted
//      against shopState.SHOP_STATUSES itself, so a new stage cannot silently
//      fall through;
//   3. the fallback reports WHICH path answered, which is what makes the
//      missing migration visible instead of silently derived.
//
// NO live database, no network, no pg connection.
//
// PURE ASCII only.
// =====================================================================

'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const { SHOP_STATUSES } = require('./shopState');
const {
  HUMAN_STATES, STATUS_TO_HUMAN_STATE, isHumanState, humanStateFor, resolveHumanState,
} = require('./humanState');

const MIGRATION_PATH = path.join(__dirname, '..', 'db', '020_shop_line_provenance_and_human_state.sql');
const PRESENT = fs.existsSync(MIGRATION_PATH);
const SQL = PRESENT ? fs.readFileSync(MIGRATION_PATH, 'utf8') : '';

const SKIP = PRESENT
  ? false
  : { skip: 'db/020_shop_line_provenance_and_human_state.sql is not on this branch. This check ' +
      'activates the moment the migration lands beside this module.' };

// ---------------------------------------------------------------------
// 1. The vocabulary is the migration's, not a copy of it.
// ---------------------------------------------------------------------
test('the six values match migration 020 shop_human_state_known CHECK', SKIP || {}, () => {
  const m = SQL.match(/constraint\s+shop_human_state_known\s+check\s*\(([\s\S]*?)\)\s*;/i);
  assert.ok(m, 'shop_human_state_known CHECK not found in migration 020 - the parse, not the code, ' +
    'is what broke. Fix the parse before trusting this file.');

  const fromSql = (m[1].match(/'([A-Z_]+)'/g) || []).map((s) => s.replace(/'/g, ''));
  assert.ok(fromSql.length > 0, 'parsed zero values out of the CHECK - a check that can pass on ' +
    'nothing is not a check');

  assert.deepEqual(fromSql.slice().sort(), HUMAN_STATES.slice().sort(),
    'the code vocabulary and the database CHECK have drifted');
});

// ---------------------------------------------------------------------
// 2. Total coverage of the 12 statuses - no default, no fall-through.
// ---------------------------------------------------------------------
test('every pipeline status maps exactly once, and only to one of the six', () => {
  assert.equal(SHOP_STATUSES.length, 12, 'the pipeline vocabulary changed size - re-read the mapping');

  const mapped = Object.keys(STATUS_TO_HUMAN_STATE);
  assert.deepEqual(mapped.slice().sort(), SHOP_STATUSES.slice().sort(),
    'the mapping and SHOP_STATUSES disagree - a stage is unmapped or invented');

  for (const status of SHOP_STATUSES) {
    assert.ok(isHumanState(STATUS_TO_HUMAN_STATE[status]),
      status + ' maps to something outside the six-value set');
  }
});

test('an unknown status throws rather than defaulting', () => {
  assert.throws(() => humanStateFor('NOT_A_STAGE'), /unknown or missing status/);
  assert.throws(() => humanStateFor(undefined), /unknown or missing status/);
  assert.throws(() => humanStateFor(null), /unknown or missing status/);
});

// ---------------------------------------------------------------------
// 3. needs_review escalates a LIVE stage and is powerless over a terminal one.
// ---------------------------------------------------------------------
test('needs_review escalates a live stage to NEEDS_WARWICK', () => {
  assert.equal(humanStateFor('PROCESSING', {}), 'ASDAIR_WORKING');
  assert.equal(humanStateFor('PROCESSING', { needs_review: true }), 'NEEDS_WARWICK');
  assert.equal(humanStateFor('SHOPPING', { needs_review: true }), 'NEEDS_WARWICK');
});

test('needs_review CANNOT drag a terminal shop back onto Warwick', () => {
  // The regression this guards: a stale needs_review flag on a finished or
  // abandoned shop putting it back on the "needs you" pile forever.
  assert.equal(humanStateFor('RECONCILED', { needs_review: true }), 'COMPLETE');
  assert.equal(humanStateFor('CANCELLED', { needs_review: true }), 'FAILED');
  assert.equal(humanStateFor('FAILED', { needs_review: true }), 'FAILED');
});

// ---------------------------------------------------------------------
// 4. The two product decisions, pinned so a silent revert is a test failure.
// ---------------------------------------------------------------------
test('BASKET_READY is READY_FOR_WARWICK (confirmed) and CANCELLED is FAILED (override)', () => {
  assert.equal(humanStateFor('BASKET_READY', {}), 'READY_FOR_WARWICK');

  // Larry, 2026-08-13, overruling migration 020's proposed COMPLETE: telling
  // Warwick a cancelled shop is "complete" implies groceries are coming when
  // nothing was ordered. Imprecise, but imprecise in the safe direction. The
  // nuance is carried by AC3's sentence, not by this value.
  assert.equal(humanStateFor('CANCELLED', {}), 'FAILED');
  assert.notEqual(humanStateFor('CANCELLED', {}), 'COMPLETE');
});

// ---------------------------------------------------------------------
// 5. resolveHumanState - the column/derived seam, and it REPORTS which.
// ---------------------------------------------------------------------
test('a durable column value is used as-is and reported as source "column"', () => {
  const r = resolveHumanState({ status: 'PROCESSING', human_state: 'NEEDS_WARWICK' });
  assert.deepEqual(r, { human_state: 'NEEDS_WARWICK', source: 'column' });
});

test('an ABSENT column derives, and says so - the missing migration stays visible', () => {
  // This is the live condition as of 2026-08-13: migration 020 is committed to
  // the repository and NOT applied to the database. Silence here would be the
  // defect; the reported source is what makes it observable.
  const r = resolveHumanState({ status: 'NEEDS_DECISION' });
  assert.deepEqual(r, { human_state: 'NEEDS_WARWICK', source: 'derived' });
});

test('a column carrying a value outside the six is NOT trusted - it derives instead', () => {
  const r = resolveHumanState({ status: 'PROCESSING', human_state: 'BANANA' });
  assert.equal(r.source, 'derived');
  assert.equal(r.human_state, 'ASDAIR_WORKING');
});

test('the derived value equals the value the writer would have written', () => {
  // THE SEAM ASSERTION. Whatever the writer puts in the column for a status is
  // exactly what the reader derives when the column is absent, because both
  // call humanStateFor(). A future refactor that gives the writer its own copy
  // of the mapping fails here.
  for (const status of SHOP_STATUSES) {
    for (const needsReview of [true, false]) {
      const written = humanStateFor(status, { needs_review: needsReview });
      const readBack = resolveHumanState({ status, human_state: written, needs_review: needsReview });
      assert.equal(readBack.human_state, written, status + ' round trip disagreed');
      assert.equal(readBack.source, 'column');

      const derived = resolveHumanState({ status, needs_review: needsReview });
      assert.equal(derived.human_state, written,
        status + ' derived path disagreed with the write path - the two mappings have forked');
    }
  }
});
