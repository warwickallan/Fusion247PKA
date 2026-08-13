// =====================================================================
// BUILD-015 AsdAIr - pipeline/finalise/agreementIsNotCertainty.test.js
//
// WO-2026-08-13-10 (WP-B15-40), AC5. TWO CLAIMS, AND BOTH ARE ABOUT THE SAME
// ONE THING: three readings by one model of one photograph are CORROBORATED,
// NEVER VERIFIED.
//
//   CLAIM 1. No emitted line-level output anywhere describes photo evidence as
//            "verified". The vocabulary is a CLOSED set about AGREEMENT, and no
//            member of it means truth.
//   CLAIM 2. A line every reading agreed on STILL REACHES A HUMAN when other
//            evidence conflicts - and, in the same breath, a line whose only
//            conflict is one a deterministic rule settles does NOT, because
//            routing that one would undo Warwick's pack-identity ruling.
//
// `corroborate.js`'s header already stated claim 1 in prose. NOTHING MADE IT
// FAIL. That is what this file is for: a rule nothing enforces is a comment.
//
// Runs under: node --test. No DB, no model, no network.
// =====================================================================

'use strict';

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { SUPPORT } from './corroborate.js';
import { routeToHuman, unresolvedHumanReasons, DETERMINISTICALLY_SETTLED } from './humanRouting.js';
import { modelLinesFrom } from './produceFinalList.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const OUT = join(HERE, 'out');

/**
 * Any word a reader would take as "graded against the page and found true".
 *
 * WORD-BOUNDED, and that is load-bearing rather than tidiness: the unbounded
 * form of this pattern matched `provenance` (which contains "proven") on every
 * one of the 39 lines, and the `Provenance` column header in the rendering.
 * A control that fires on the field naming WHERE A LINE CAME FROM would have
 * been switched off within the day, and this file would then have been proving
 * nothing at all.
 */
const CERTAINTY_WORDS = /\bverified\b|\bverify\b|\bverification\b|\bcertainty\b|\bcertain\b|\bproven\b|\bproof\b|\bground[_ -]?truth\b/i;

// ---------------------------------------------------------------------
// CLAIM 1 - the vocabulary never promotes agreement to truth
// ---------------------------------------------------------------------

test('AC5: the support vocabulary is a CLOSED set about agreement, and no member of it means verified', () => {
  const values = Object.values(SUPPORT);
  assert.deepEqual(
    [...values].sort(),
    ['corroborated', 'unanimous', 'uncorroborated'],
    'SUPPORT is the closed agreement vocabulary; adding a member is a product decision, not a refactor',
  );
  for (const v of values) {
    assert.ok(
      !CERTAINTY_WORDS.test(String(v)),
      `SUPPORT.${v} reads as a claim about TRUTH. Agreement between three correlated readings of one `
      + 'photograph is not truth, and no support class may say it is.',
    );
  }
});

test('AC5: no line-level field in the emitted artefact describes photo evidence as verified', (t) => {
  const path = join(OUT, 'final-shopping-list.json');
  if (!existsSync(path)) {
    t.skip('final-shopping-list.json not built - run `node finalise/produceFinalList.mjs` first');
    return;
  }
  const list = JSON.parse(readFileSync(path, 'utf8'));

  // Deliberately scoped to the LINE-LEVEL collections. `packet_sort_contract_verified`
  // at the top level is a DIFFERENT claim - the browser packet builder verifying
  // its own sort contract - and banning the string estate-wide would assert
  // something false about that field.
  for (const collection of ['lines', 'additions', 'skipped']) {
    const rows = list[collection] || [];
    assert.ok(rows.length >= 0);
    for (const row of rows) {
      const serialised = JSON.stringify(row);
      const hit = serialised.match(CERTAINTY_WORDS);
      assert.equal(
        hit, null,
        `${collection} row describes photo evidence with the certainty word "${hit && hit[0]}". `
        + `Row: ${serialised.slice(0, 200)}`,
      );
    }
  }

  // Every line's support class must be a member of the closed vocabulary.
  const allowed = new Set(Object.values(SUPPORT));
  for (const l of list.lines || []) {
    const sc = l.provenance_detail && l.provenance_detail.support_class;
    if (sc === null || sc === undefined) continue;
    assert.ok(allowed.has(sc), `support_class "${sc}" is outside the closed agreement vocabulary`);
  }
});

test('AC5: the human-readable rendering never tells Warwick a photo line was verified', (t) => {
  const path = join(OUT, 'final-shopping-list.md');
  if (!existsSync(path)) {
    t.skip('final-shopping-list.md not built - run `node finalise/produceFinalList.mjs` first');
    return;
  }
  const md = readFileSync(path, 'utf8');
  const hit = md.match(CERTAINTY_WORDS);
  assert.equal(hit, null, `the rendered list contains the certainty word "${hit && hit[0]}"`);
});

// ---------------------------------------------------------------------
// CLAIM 2 - unanimity does not settle it, and a ruled convention still does
// ---------------------------------------------------------------------

/**
 * A 3-of-3 UNANIMOUS observation - maximal agreement - carrying `reasons`.
 *
 * The three quantity readings AGREE, deliberately: this fixture must isolate
 * the referral as the ONLY thing that could route the line. An earlier version
 * omitted them, `settleQuantity` returned `no run read a quantity for this
 * line`, and the line routed for a reason that had nothing to do with AC5 -
 * which would have made the pack-identity half of this proof vacuous.
 */
function unanimousObservation(reasons) {
  const readings = ['00-19-40', '00-22-40', '00-25-29'].map((run) => ({
    run, as_written: '4 pints of milk', quantity: 4, basis: 'explicit-on-page',
  }));
  return {
    as_written: '4 pints of milk',
    quantity: 4,
    quantity_basis: 'explicit-on-page',
    quantity_readings: readings,
    support: 3,
    support_of: 3,
    support_class: SUPPORT.UNANIMOUS,
    identity_disagreement: false,
    source_region: 4,
    confidence: 0.95,
    product_id: 4,
    vision_needs_human: reasons.length > 0,
    vision_needs_human_reasons: reasons,
  };
}

const SETTLED_QTY = { settled: true, quantity: 4, basis: 'explicit-on-page', candidates: [4] };

test('AC5: a UNANIMOUS 3-of-3 line with an UNDISCHARGED conflicting referral STILL reaches a human', () => {
  const obs = unanimousObservation(['cross_region_duplicate_unresolved']);
  const route = routeToHuman(obs, SETTLED_QTY);

  assert.equal(route.human, true,
    'three correlated readings agreeing is exactly the case where agreement proves nothing. '
    + 'An unresolved cross-region duplicate must reach Warwick however unanimous the readings were.');
  assert.deepEqual(route.causes, ['vision_referral']);
  assert.deepEqual(route.unresolvedReasons, ['cross_region_duplicate_unresolved']);

  // And it must survive the PRODUCTION wiring, not merely the helper: the
  // confidence handed to resolveByCatalogue must be 0 so its own gate holds the
  // line as needs_confirmation and the planner opens a question.
  const [line] = modelLinesFrom([obs], new Map());
  assert.equal(line.confidence, 0,
    'the production path must hand this line over with confidence 0, or the referral changes nothing');
  assert.equal(line._uncertain, true);
});

test('AC5: a UNANIMOUS line whose ONLY conflict is settled by Warwick\'s pack-identity rule does NOT reach a human', () => {
  const obs = unanimousObservation(['leading_mark_disagreement']);
  const route = routeToHuman(obs, SETTLED_QTY);

  assert.equal(route.human, false,
    'pack size is IDENTITY, never purchase quantity - "16 Richmond" is one pack whether a run read '
    + '"16" or "1 6". Routing this to a human would be the system forgetting a ruling it already holds.');
  assert.deepEqual(route.unresolvedReasons, []);

  const [line] = modelLinesFrom([obs], new Map());
  assert.deepEqual(line._route.causes, [],
    'no cause may fire on a line whose only conflict a deterministic rule settles');
  assert.notEqual(line.confidence, 0,
    'the production path must NOT hand this line over as uncertain - doing so would route a '
    + 'question to Warwick that his own pack-identity ruling already answered');
});

test('AC5: the discharge allowlist is CLOSED - an unknown referral cause routes to a human by default', () => {
  assert.deepEqual(DETERMINISTICALLY_SETTLED, ['leading_mark_disagreement'],
    'adding a member asserts that a deterministic rule in this codebase settles that cause');

  const invented = unanimousObservation(['a_cause_invented_after_this_test_was_written']);
  assert.deepEqual(unresolvedHumanReasons(invented), ['a_cause_invented_after_this_test_was_written']);
  assert.equal(routeToHuman(invented, SETTLED_QTY).human, true,
    'a referral cause nobody has proved a rule for must FAIL SAFE to a human, never be swallowed');
});

test('AC5: a settled pack-identity referral does not rescue a line whose quantity was REFUSED', () => {
  const obs = unanimousObservation(['leading_mark_disagreement']);
  const route = routeToHuman(obs, { settled: false, quantity: null });
  assert.equal(route.human, true);
  assert.deepEqual(route.causes, ['quantity_unsettled'],
    'settleQuantity refusing to pick a number is its own sufficient cause, independent of the referral');
});

// ---------------------------------------------------------------------
// The same two claims, against the REAL frozen reading
// ---------------------------------------------------------------------

test('AC5 on real data: the unresolved cross-region duplicate reaches a human despite 3-of-3 agreement', (t) => {
  const path = join(OUT, 'final-shopping-list.json');
  if (!existsSync(path)) {
    t.skip('final-shopping-list.json not built - run `node finalise/produceFinalList.mjs` first');
    return;
  }
  const list = JSON.parse(readFileSync(path, 'utf8'));

  const routedByReferral = (list.lines || []).filter(
    (l) => (l.provenance_detail.human_route_causes || []).includes('vision_referral'),
  );

  assert.equal(routedByReferral.length, 1,
    'exactly one line on the frozen reading carries an undischarged vision referral');
  assert.match(routedByReferral[0].provenance_detail.raw_reading, /ARLA SEMI SKIMMED MILK/i);
  assert.equal(routedByReferral[0].provenance_detail.support, 3,
    'and it was seen by ALL THREE readings - which is the entire point');
  assert.equal(routedByReferral[0].provenance_detail.support_class, SUPPORT.UNANIMOUS);
  assert.equal(routedByReferral[0].shoppable, false,
    'a line routed to a human must not also be shoppable');

  // Warwick's pack-identity ruling is NOT undone: lines whose only referral is a
  // leading-mark disagreement stay in the shop.
  const packRuleLines = (list.lines || []).filter(
    (l) => (l.provenance_detail.vision_referral_reasons || []).includes('leading_mark_disagreement')
      && !(l.provenance_detail.human_route_causes || []).includes('vision_referral'),
  );
  assert.ok(packRuleLines.length >= 1,
    'the pack-identity ruling must still discharge leading-mark disagreements');
});
