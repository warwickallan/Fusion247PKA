// =====================================================================
// BUILD-015 AsdAIr Stage 1 - pipeline/test/resolveByCatalogueCrossRegionCollision.test.js
//
// WO-2026-08-12-B15-VISION-04, AC1/AC4/AMENDMENT 1 proof for the cross-region
// dedup guard added to interpret/resolveByCatalogue.js. This test lives here,
// inside pipeline/test/, rather than beside resolveByCatalogue.js itself: the
// Work Order's declared file_surface grants exactly two files under
// services/asdair/interpret/ (groundedPrompt.js, resolveByCatalogue.js), not
// a new sibling test file there - the SAME constraint
// groundedPromptRegionContract.test.js documents and resolves in its own
// header comment, and this file follows the identical, already-established
// pattern: reaching across the package boundary via createRequire (the same
// mechanism deps.js and harness.js already use), never writing outside the
// declared surface.
//
// Runs under: node --test (no DB, no model, no network) - resolveAll is PURE.
// =====================================================================

import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { resolveAll, regionsAgree } = require('../../interpret/resolveByCatalogue.js');

// ── AC1 (AMENDMENT 1) - CROSS-REGION COLLISIONS ARE NOT AUTHORITATIVE ──────
//
// The round-3 live re-test's real, captured incident: "LENOR OUTDOOR SPRING
// AWAKENING" (line 4) and "FEBREZE FABRIC SPRAY LENOR SPRING AWAKENING"
// (line 8) - two genuinely DIFFERENT real products (a Lenor fabric
// conditioner and a Febreze fabric spray) - both resolved to the same
// regular id 5, and the old authoritative collapse silently EXCLUDED the
// real Febreze line, deleting it from the basket. The literal source_region
// values for lines 4/8 were not recoverable from the diagnostic capture
// (resolveAll's own output never carried source_region before this Work
// Order - see resolveByCatalogue.js's own header comment on that gap), so
// this reproduces the SAME raw_reading/matched_regular_id collision shape
// with representative distinct regions, which is what "different source
// regions" means for this rule.
//
// ── UPDATED, WO-2026-08-12-B15-VISION-06 (round 6), AC3 ────────────────────
// Round 5's live re-test found that "FEBREZE FABRIC SPRAY LENOR SPRING
// AWAKENING" resolving to Lenor id 5 was ITSELF a genuine identity/alias-
// matching defect (a pass-4 word-overlap false positive on the shared,
// non-distinctive words "lenor"/"fabric", with the reading's own real
// distinguishing word - "febreze" - absent from the Lenor regular's own
// name/aliases entirely), separate from this file's cross-region mechanism.
// Round 6 fixed that defect in resolveByCatalogue.js's pass 4 (see its own
// "PASS-4 BRAND-ANCHOR GUARD" header comment), so that EXACT reading no
// longer resolves to id 5 at all - it now correctly surfaces as
// `unmatched_new_item`, and this file's own tests below would otherwise stop
// exercising a real cross-region COLLISION at all (a lone unmatched line
// never enters resolveAll's duplicate-key grouping). The fixture below is
// therefore swapped for a reading pair that still genuinely, validly
// resolves to the SAME real regular from two DIFFERENT raw texts (proving
// this file's own cross-region rule on a collision that is actually correct
// identity, not a matching bug) - "LENOR OUTDOOR SPRING AWAKENING" (pass 3,
// approximate alias) and "LENOR FABRIC CONDITIONER" (pass 4, brand+variant,
// still eligible under the new guard because "lenor" - its own lead word -
// genuinely is part of the Lenor regular's own name). The ORIGINAL Febreze
// reading and its now-corrected outcome are proven directly below (this
// file's own "AC3 (round 6)" test) and in isolation, at the resolveReading
// layer, in this directory's new pass4BrandAnchorGuard.test.js.
const LENOR_COLLISION_CATALOGUE = [
  { id: 5, name: 'Lenor Outdoorable Spring Awakening Fabric Conditioner 86 Washes', brand: 'Lenor', aka: ['lenor outdoor'] },
];

test('AC1/AMENDMENT 1: a cross-region collision demotes BOTH lines to needs_confirmation - neither excluded, neither kept authoritative', () => {
  const out = resolveAll(
    [
      { raw_reading: 'LENOR OUTDOOR SPRING AWAKENING', quantity: null, source_region: 2 },
      { raw_reading: 'LENOR FABRIC CONDITIONER', quantity: null, source_region: 3 },
    ],
    LENOR_COLLISION_CATALOGUE,
  );
  assert.equal(out[0].status, 'needs_confirmation', 'the FIRST line must also be demoted - Amendment 1: emission order is not evidence');
  assert.equal(out[0].matched_regular_id, null, 'a needs_confirmation line must not still carry a matched identity');
  assert.equal(out[1].status, 'needs_confirmation', 'the SECOND line must never be silently excluded - that is the exact regression this closes');
  assert.equal(out[1].matched_regular_id, null);
  assert.ok(
    out[0].alternatives.some((a) => a.id === 5) && out[1].alternatives.some((a) => a.id === 5),
    'the collided candidate is offered for a human decision, never simply discarded',
  );
});

test('AC1: a cross-region collision generalises to 3+ colliding lines - ANY disagreement removes the whole group\'s survivor', () => {
  const out = resolveAll(
    [
      { raw_reading: 'LENOR OUTDOOR SPRING AWAKENING', quantity: null, source_region: 1 },
      { raw_reading: 'LENOR OUTDOOR SPRING AWAKENING', quantity: null, source_region: 1 },
      { raw_reading: 'LENOR FABRIC CONDITIONER', quantity: null, source_region: 4 },
    ],
    LENOR_COLLISION_CATALOGUE,
  );
  assert.equal(out[0].status, 'needs_confirmation', 'the two same-region members are NOT exempt once a third, different-region member is in the group');
  assert.equal(out[1].status, 'needs_confirmation');
  assert.equal(out[2].status, 'needs_confirmation');
});

// ── AC3 (WO-2026-08-12-B15-VISION-06, round 6) - THE ORIGINAL FEBREZE
//    READING NO LONGER FALSELY COLLIDES AT ALL ─────────────────────────────
test('AC3 (round 6): the ORIGINAL Febreze reading that used to falsely collide with Lenor now resolves to NEITHER - an honest unmatched_new_item, never a silent misattribution', () => {
  const out = resolveAll(
    [
      { raw_reading: 'LENOR OUTDOOR SPRING AWAKENING', quantity: null, source_region: 2 },
      { raw_reading: 'FEBREZE FABRIC SPRAY LENOR SPRING AWAKENING', quantity: null, source_region: 3 },
    ],
    LENOR_COLLISION_CATALOGUE,
  );
  assert.equal(out[0].status, 'matched', 'the genuinely unambiguous Lenor reading must resolve cleanly - it was never actually ambiguous');
  assert.equal(out[0].matched_regular_id, 5);
  assert.equal(out[1].status, 'unmatched_new_item', 'the Febreze reading must never again borrow the Lenor identity');
  assert.equal(out[1].matched_regular_id, null);
});

// ── AC4 - THE ORIGINAL SAME-REGION/NO-REGION CASE STILL AUTO-COLLAPSES -
//    ONLY THE CROSS-REGION CASE CHANGES ────────────────────────────────────
test('AC4: two readings from the SAME source_region still auto-collapse to one survivor (the Vanish shape, region-confirmed)', () => {
  const out = resolveAll(
    [
      { raw_reading: '1 febreze fabric spray', quantity: 1, source_region: 2 },
      { raw_reading: '1 febreze air spray', quantity: 1, source_region: 2 },
    ],
    [{ id: 30, name: 'Febreze Fabric Freshener Spray Lenor Spring Awakening 385ML', brand: 'Febreze', aka: ['febreze fabric spray', 'febreze air spray'] }],
  );
  assert.equal(out[0].status, 'matched');
  assert.equal(out[1].status, 'excluded', 'the SAME source_region is real supporting evidence - one-survivor collapse must be unchanged');
  assert.equal(out[1].matched_regular_id, 30, 'identity stays on record on an excluded row, never dropped');
});

test('AC4: no source_region evidence at all (a typed line, or the pre-Amendment-1 diagnostic shape) still auto-collapses exactly as before', () => {
  // Byte-for-byte the same fixture as interpret/catalogueGrounding.test.js's
  // pre-existing "AC3: the Febreze-shape defect" test, asserting the SAME
  // outcome, so a future reader can see this is the AC4 regression proof for
  // the no-region case rather than a new scenario.
  const FEBREZE = [
    { id: 30, name: 'Febreze Fabric Freshener Spray Lenor Spring Awakening 385ML', brand: 'Febreze', aka: ['febreze fabric spray', 'febreze air spray'] },
  ];
  const out = resolveAll(
    [{ raw_reading: '1 febreze fabric spray', quantity: 1 }, { raw_reading: '1 febreze air spray', quantity: 1 }],
    FEBREZE,
  );
  assert.equal(out[0].status, 'matched');
  assert.equal(out[1].status, 'excluded', 'absence of region evidence is not evidence of disagreement - AC4 must not regress this');
});

// ── regionsAgree - the pure decision helper, tested directly ───────────────
test('regionsAgree: fewer than two KNOWN regions is no evidence of disagreement', () => {
  assert.equal(regionsAgree([]), true);
  assert.equal(regionsAgree([null]), true);
  assert.equal(regionsAgree([undefined, null]), true);
  assert.equal(regionsAgree([3]), true);
  assert.equal(regionsAgree([3, null]), true);
});

test('regionsAgree: two or more KNOWN regions must all agree', () => {
  assert.equal(regionsAgree([2, 2]), true);
  assert.equal(regionsAgree([2, 2, 2]), true);
  assert.equal(regionsAgree([2, 3]), false);
  assert.equal(regionsAgree([2, 2, 3]), false, 'one disagreement anywhere in the group is enough');
});
