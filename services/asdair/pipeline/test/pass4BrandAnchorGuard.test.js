// =====================================================================
// BUILD-015 AsdAIr Stage 1 - pipeline/test/pass4BrandAnchorGuard.test.js
//
// WO-2026-08-12-B15-VISION-06 (round 6), AC3 proof, isolated at the
// resolveReading layer. This file lives here, inside pipeline/test/, rather
// than beside resolveByCatalogue.js itself: the Work Order's declared
// file_surface grants exactly two files under services/asdair/interpret/
// (groundedPrompt.js, resolveByCatalogue.js), not a new sibling test file
// there - the same constraint resolveByCatalogueCrossRegionCollision.test.js
// documents and resolves in its own header comment, and this file follows
// the identical, already-established pattern: reaching across the package
// boundary via createRequire, never writing outside the declared surface.
//
// THE BUG THIS PROVES CLOSED, reproduced with the REAL product names and the
// REAL captured raw_reading text from round 5's live re-test: with the
// Febreze co-branded product not (yet) a recorded regular, "FEBREZE FABRIC
// SPRAY LENOR" matched the UNRELATED Lenor Outdoorable conditioner via pass
// 4's own generic word-overlap ("lenor" and "fabric" - 2 shared words,
// clearing the >= 2 threshold) even though neither shared word is the
// reading's own real identity: "febreze" - the reading's actual brand - is
// absent from the Lenor regular's own name and every alias. See
// resolveByCatalogue.js's own "PASS-4 BRAND-ANCHOR GUARD" header comment for
// the full mechanism this file proves.
//
// Runs under: node --test (no DB, no model, no network) - resolveReading is
// PURE.
// =====================================================================

import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { resolveReading, BASIS } = require('../../interpret/resolveByCatalogue.js');

const LENOR_ONLY = [
  { id: 5, name: 'Lenor Outdoorable Spring Awakening Fabric Conditioner 86 Washes', brand: 'Lenor', aka: ['lenor outdoor'] },
];

// ── THE EXACT REPORTED DEFECT, NEGATIVE CASE ────────────────────────────────

test('AC3: the exact round-5 live reading no longer resolves to the unrelated Lenor regular', () => {
  const r = resolveReading('FEBREZE FABRIC SPRAY LENOR', LENOR_ONLY);
  assert.notEqual(r.matched_regular_id, 5, 'a reading whose real brand ("febreze") is absent from this candidate\'s own identity must never confidently claim it');
  assert.equal(r.status, 'unmatched_new_item', 'honest "new item, needs a human" beats a confidently wrong catalogue match');
});

test('AC3: the longer captured variant of the same reading is also refused', () => {
  const r = resolveReading('FEBREZE FABRIC SPRAY LENOR SPRING AWAKENING', LENOR_ONLY);
  assert.notEqual(r.matched_regular_id, 5);
  assert.equal(r.status, 'unmatched_new_item');
});

// ── THE GUARD MUST NOT DISABLE PASS 4 FOR A GENUINE BRAND MATCH ────────────

test('REGRESSION: pass 4 still resolves a genuine brand+variant match when the reading\'s own lead word IS the candidate\'s own brand', () => {
  const r = resolveReading('LENOR FABRIC CONDITIONER', LENOR_ONLY);
  assert.equal(r.status, 'matched', 'the reading\'s own lead word "lenor" is genuinely part of this candidate\'s own name - pass 4 must still fire');
  assert.equal(r.matched_regular_id, 5);
  assert.equal(r.match_basis, BASIS.BRAND_VARIANT);
});

// ── THE GUARD MUST NOT ALTER EARLIER, STRONGER PASSES ──────────────────────

test('REGRESSION: an exact alias match is completely unaffected by the pass-4 guard', () => {
  const r = resolveReading('LENOR OUTDOOR', LENOR_ONLY);
  assert.equal(r.status, 'matched');
  assert.equal(r.matched_regular_id, 5);
  assert.equal(r.match_basis, BASIS.EXACT_ALIAS);
});

test('REGRESSION: a short/absent reading lead word gets no guard at all (absence of a claim is not a claim it disagrees)', () => {
  // "86 washes" - every token is either a digit-leading size token or <= 3
  // chars once split, so readingLeadWord is null and the guard cannot fire;
  // this must resolve or refuse exactly as pass 4's own overlap math says,
  // never be silently excluded by a guard with nothing to check.
  const shortLead = [
    { id: 60, name: 'ASDA Own Brand Fabric Softener 750ml', brand: 'ASDA', aka: [] },
  ];
  const r = resolveReading('86 washes', shortLead);
  assert.equal(r.status, 'unmatched_new_item', 'no genuine overlap exists either way - this pins the guard is inert here, not that it forced a match');
});

// ── THE GUARD IS SCOPED TO PASS 4 ONLY - PASSES 1-3 KEEP THEIR OWN EVIDENCE ─

test('REGRESSION: a tolerant KEY_SUBSET alias match (pass 3) is unaffected by the pass-4 guard', () => {
  const catalogue = [
    { id: 70, name: 'Dreamies Cat Treat Biscuits With Cheese Flavour 200g', brand: 'Dreamies', aka: ['dreamies cheese'] },
  ];
  const r = resolveReading('1 dreamies cheese large', catalogue);
  assert.equal(r.status, 'matched');
  assert.equal(r.matched_regular_id, 70);
});
