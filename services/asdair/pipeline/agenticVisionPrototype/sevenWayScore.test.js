// =====================================================================
// BUILD-015 AsdAIr - agenticVisionPrototype/sevenWayScore.test.js
//
// WO-2026-08-12-01-v2 (WP-B15-29), AC9: proofs for the in-surface scorer.
// PURE - no network, no gateway, no database.
//
// The fixtures here are invented test products, deliberately NOT the real
// photograph's contents: this file proves the SCORING RULE, and using the
// real list would make the test pass or fail on the ground truth's own
// wording rather than on the rule under test.
// =====================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  scoreSevenWay, loadGroundTruth, fuzzyMatches, normalise, SCORER_LIMITS,
  quantityAgreesUnderDefaultOne,
} from './sevenWayScore.js';
import { UNKNOWN_VISIBLE_ITEM } from './lineSchema.js';

const TRUTH = [
  { product: 'Weetabix Original 24 pack', qty: 1 },
  { product: 'Marmite 250g', qty: 2 },
  { product: 'Yazoo Chocolate Milkshake', qty: 3 },
];

const CATALOGUE = new Map([
  ['7', { id: '7', name: 'Weetabix Original', aliases: ['wheat biscuits'] }],
  ['42', { id: '42', name: 'Marmite', aliases: [] }],
  ['99', { id: '99', name: 'Yazoo Chocolate', aliases: ['choc yazoo'] }],
  ['13', { id: '13', name: 'Nivea Soft Moisturiser', aliases: [] }],
]);

function accepted(over = {}) {
  return {
    line_no: 1, as_written: 'weetabix', product_id: '7', identified: true, quantity: 1, source_region: 2, confidence: 0.9, flags: [], ...over,
  };
}

test('AC9: a correctly read, correctly named, correctly counted line scores CORRECT', () => {
  const s = scoreSevenWay({ accepted: [accepted()], groundTruth: TRUTH, catalogueById: CATALOGUE });
  assert.equal(s.correct, 1);
  assert.equal(s.invented, 0);
  assert.equal(s.omitted, 2);
  assert.equal(s.denominator, 3);
});

test('AC9: a line nothing on the page supports scores INVENTED - the failure Warwick weights heaviest', () => {
  const s = scoreSevenWay({
    accepted: [accepted({ as_written: 'nivea soft', product_id: '13' })], groundTruth: TRUTH, catalogueById: CATALOGUE,
  });
  assert.equal(s.invented, 1);
  assert.equal(s.correct, 0);
});

test('AC9: read one real product, named another, scores WRONG_IDENTITY - not correct, not invented', () => {
  const s = scoreSevenWay({
    accepted: [accepted({ as_written: 'marmite', product_id: '7' })], groundTruth: TRUTH, catalogueById: CATALOGUE,
  });
  assert.equal(s.wrongIdentity, 1);
  assert.equal(s.correct, 0);
  assert.equal(s.invented, 0);
});

test('AC9: right product, wrong number scores WRONG_QUANTITY', () => {
  const s = scoreSevenWay({
    accepted: [accepted({ as_written: 'marmite', product_id: '42', quantity: 9 })], groundTruth: TRUTH, catalogueById: CATALOGUE,
  });
  assert.equal(s.wrongQuantity, 1);
  assert.equal(s.correct, 0);
});

test('AC9: an explicit UNKNOWN is its OWN category and can NEVER be scored as an invention', () => {
  const s = scoreSevenWay({
    accepted: [accepted({ as_written: 'marmite', product_id: UNKNOWN_VISIBLE_ITEM, identified: false })],
    groundTruth: TRUTH,
    catalogueById: CATALOGUE,
  });
  assert.equal(s.explicitUnknown, 1);
  assert.equal(s.invented, 0, 'an honest UNKNOWN claims no identity, so it cannot have invented one');
  assert.equal(s.omitted, 2, 'and the line it read still counts as SEEN, not omitted');
});

test('AC9: an explicit UNKNOWN is NOT the same measure as a low-confidence guess', () => {
  const s = scoreSevenWay({
    accepted: [
      accepted({ line_no: 1, as_written: 'marmite', product_id: UNKNOWN_VISIBLE_ITEM, identified: false }),
      accepted({ line_no: 2, as_written: 'choc yazoo', product_id: '99', quantity: 3, confidence: 0.11 }),
    ],
    groundTruth: TRUTH,
    catalogueById: CATALOGUE,
  });
  assert.equal(s.explicitUnknown, 1);
  assert.equal(s.correct, 1, 'a low-confidence guess that is right is still a guess, and is NOT counted as an unknown');
});

test('AC9: omissions are ground-truth lines nothing covered - the number a post-hoc check cannot see', () => {
  const s = scoreSevenWay({ accepted: [], groundTruth: TRUTH, catalogueById: CATALOGUE });
  assert.equal(s.omitted, 3);
  assert.deepEqual(s.omittedProducts.length, 3);
});

test('AC9: duplicates are counted from the collision groups, both kinds', () => {
  const s = scoreSevenWay({
    accepted: [accepted()],
    groundTruth: TRUTH,
    catalogueById: CATALOGUE,
    duplicateGroups: [
      { kind: 'same_region', members: [{}, {}] },
      { kind: 'cross_region', members: [{}, {}] },
    ],
  });
  assert.equal(s.duplicates, 3, 'one superseded same-region member plus both unresolved cross-region members');
});

test('AC9: rejected lines are reported by reason, never folded into the seven categories', () => {
  const s = scoreSevenWay({
    accepted: [],
    rejected: [{ reasons: ['source_region_not_supplied'] }, { reasons: ['not_a_line'] }],
    groundTruth: TRUTH,
  });
  assert.deepEqual(s.rejectedByReason, { source_region_not_supplied: 1, not_a_line: 1 });
});

test('AC9 / F10: identityMode verbatim reports wrongIdentity as NOT MEASURABLE, never as 0', () => {
  const s = scoreSevenWay({
    accepted: [accepted({ as_written: 'weetabix', identified: false, product_id: undefined })],
    groundTruth: TRUTH,
    identityMode: 'verbatim',
  });
  assert.equal(s.wrongIdentity, null, 'a 0 would read as "no wrong identities happened", which the unconstrained arm cannot know');
  assert.equal(s.correct, 1, 'in the unconstrained arm the verbatim reading IS the identity claim');
});

test('AC9: every score carries its limits, so the number cannot be quoted alone', () => {
  const s = scoreSevenWay({ accepted: [], groundTruth: TRUTH });
  assert.equal(s.limits, SCORER_LIMITS);
  assert.ok(s.limits.some((l) => /text-similarity join/.test(l)));
  assert.ok(s.limits.some((l) => /provenance is unrecorded/.test(l)));
});

test('fuzzyMatches: containment and a distinguishing token match; a short fragment does not', () => {
  assert.equal(fuzzyMatches('Weetabix Original 24 pack', 'weetabix'), true);
  assert.equal(fuzzyMatches('Yazoo Chocolate Milkshake', 'choc yazoo'), true);
  assert.equal(fuzzyMatches('Marmite 250g', 'Nivea Soft'), false);
  assert.equal(fuzzyMatches('', 'anything'), false);
});

test('fuzzyMatches: a bare shared NUMBER never makes a match - that would inflate `correct`', () => {
  assert.equal(fuzzyMatches('Weetabix 24 pack', 'Andrex 24 rolls'), false);
});

test('normalise: case, punctuation and whitespace do not change a verdict', () => {
  assert.equal(normalise('  Yazoo - CHOC!!  '), 'yazoo choc');
});

test('loadGroundTruth: reads a real JSON array from disk', () => {
  const tmp = path.join(os.tmpdir(), `gt-${Date.now()}.json`);
  fs.writeFileSync(tmp, JSON.stringify(TRUTH));
  try {
    assert.equal(loadGroundTruth(tmp).length, 3);
  } finally { fs.unlinkSync(tmp); }
});

test('loadGroundTruth: a missing file is a loud error, never an empty denominator', () => {
  // A silently-empty ground truth would make every run score 0 omissions out
  // of 0 lines - a perfect-looking result measured against nothing.
  assert.throws(() => loadGroundTruth(path.join(os.tmpdir(), 'definitely-not-here.json')), /not found/);
  assert.throws(() => loadGroundTruth(''), /required/);
});

test('loadGroundTruth: a malformed entry is refused rather than scored around', () => {
  const tmp = path.join(os.tmpdir(), `gt-bad-${Date.now()}.json`);
  fs.writeFileSync(tmp, JSON.stringify([{ qty: 1 }]));
  try {
    assert.throws(() => loadGroundTruth(tmp), /string `product`/);
  } finally { fs.unlinkSync(tmp); }
});

// ── AC2 (WP-B15-30): THE SCORER STOPS MARKING CORRECT BEHAVIOUR WRONG ──────
// Warwick: six of nine `wrongQuantity` verdicts in WP-B15-29 penalised the
// model for returning null on a line the page carries no count for - the
// behaviour every other layer required of it.

test('AC2: a null quantity against an expected 1 is CORRECT, not a wrong quantity', () => {
  assert.equal(quantityAgreesUnderDefaultOne(1, null), true);
});

test('AC2: the tolerance runs BOTH ways - an explicit 1 against an absent expectation also agrees', () => {
  assert.equal(quantityAgreesUnderDefaultOne(null, 1), true);
});

test('AC2 MUTATION GUARD: the tolerance must not have made the check permissive', () => {
  // If any of these start passing, AC2 has been implemented as "quantity no
  // longer graded", which is not the correction that was asked for.
  assert.equal(quantityAgreesUnderDefaultOne(4, null), false, 'null against an expected 4 is still WRONG');
  assert.equal(quantityAgreesUnderDefaultOne(null, 3), false, 'a claimed 3 against no expectation is still WRONG');
  assert.equal(quantityAgreesUnderDefaultOne(2, 3), false, 'a wrong number is still wrong');
  assert.equal(quantityAgreesUnderDefaultOne(1, 2), false, 'default-one does not excuse a claimed 2');
});

test('AC2: unchanged cases still behave exactly as before', () => {
  assert.equal(quantityAgreesUnderDefaultOne(3, 3), true);
  assert.equal(quantityAgreesUnderDefaultOne(null, null), true);
});
