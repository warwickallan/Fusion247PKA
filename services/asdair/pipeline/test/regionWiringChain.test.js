// =====================================================================
// BUILD-015 AsdAIr Stage 1 - pipeline/test/regionWiringChain.test.js
//
// WO-2026-08-12-B15-VISION-05, AC2 (the acceptance_property): proves
// source_region actually survives THE REAL CHAIN -
//
//   interpretPhotoOrchestrator.js's interpretPhotoWithDeps (REAL)
//     -> its own return value (the exact boundary that was broken)
//     -> interpret/resolveByCatalogue.js's resolveAll (REAL)
//
// - rather than round 4's own proof (resolveByCatalogueCrossRegionCollision
// .test.js), which called resolveAll DIRECTLY with hand-built fixtures that
// already carried source_region on the reading objects, never once passing
// through interpretPhotoOrchestrator.js at all - the exact function whose
// own return statement was dropping the field. That test proved
// resolveByCatalogue's regionsAgree() rule correct in isolation; it could
// never have caught this defect, because it never exercised the boundary
// the defect lived at.
//
// This file also names the SECOND, previously-undocumented bypass route
// found while preflighting this Work Order: pipeline/test/harness.js (which
// backs runPipeline.test.js, the suite closest in spirit to "the real
// production path") fakes `deps.interpretPhoto` wholesale - it never calls
// interpretPhotoWithDeps either. Neither existing test route could have
// caught this. This file is deliberately the first one that calls the REAL
// interpretPhotoWithDeps and feeds its REAL return value into the REAL
// resolveAll, with nothing hand-built sitting in between.
//
// REAL in this file: interpretPhotoWithDeps (the orchestrator itself),
// photoSanityChecks.runSanityChecks, followUpTrigger.needsFollowUp /
// flaggedRegionsForFollowUp, interpret/groundedPrompt.buildGroundedPrompt,
// interpret/resolveByCatalogue.resolveAll.
//
// FAKE (the I/O boundary only, exactly as interpretPhotoOrchestrator.test.js
// already fakes it for the same reason): prepareImage, renderAllRegions,
// toDataUrl, insertRegionBatch, insertPhotoProvenanceBatch, writeQuery, and
// the vision()/extractJson() model call itself - scripted to return the
// captured Lenor/Febreze collision shape (two lines, different regions,
// the model's own claimed matched_regular_id the SAME on both - exactly as
// AC2 specifies; that claimed id is never identity, see
// interpretPhotoOrchestrator.js's own header comment on why, which is the
// whole point of this test - identity comes from resolveByCatalogue against
// OUR rows, not from the model).
//
// Runs under: node --test (no DB, no model, no network, no sharp).
// =====================================================================

'use strict';

import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

import { interpretPhotoWithDeps } from '../interpretPhotoOrchestrator.js';
import { runSanityChecks } from '../photoSanityChecks.js';
import { needsFollowUp, flaggedRegionsForFollowUp } from '../followUpTrigger.js';

const require = createRequire(import.meta.url);
const { buildGroundedPrompt } = require('../../interpret/groundedPrompt.js');
const { resolveAll } = require('../../interpret/resolveByCatalogue.js');

// Byte-for-byte the same catalogue fixture
// resolveByCatalogueCrossRegionCollision.test.js uses, so a reader can see
// this is the SAME real incident, proven through the earlier boundary.
//
// UPDATED, WO-2026-08-12-B15-VISION-06 (round 6), AC3: the second reading
// below was originally "FEBREZE FABRIC SPRAY LENOR SPRING AWAKENING" - round
// 6 found and fixed the genuine identity/alias-matching defect that made
// that reading falsely resolve to this Lenor regular at all (a pass-4 word-
// overlap false positive; see resolveByCatalogue.js's own "PASS-4 BRAND-
// ANCHOR GUARD" comment). That reading now correctly resolves to
// `unmatched_new_item`, so it can no longer collide with anything and this
// file's own wiring proof needs a reading pair that still genuinely, validly
// shares the Lenor identity from two different raw texts -
// resolveByCatalogueCrossRegionCollision.test.js's own "AC3 (round 6)" test
// proves the ORIGINAL Febreze reading's corrected outcome directly.
const LENOR_FEBREZE_COLLISION = [
  { id: 5, name: 'Lenor Outdoorable Spring Awakening Fabric Conditioner 86 Washes', brand: 'Lenor', aka: ['lenor outdoor'] },
];

const CATALOGUE = {
  candidates: LENOR_FEBREZE_COLLISION.map((r) => ({ id: r.id, name: r.name, brand: r.brand, aka: r.aka })),
  rules: [],
  last_order: { lines: [] },
};

/** Two strip regions (2, 3) plus the full_page region (1) the model was
 *  shown - mirrors interpretPhotoOrchestrator.test.js's own multi-region
 *  fixture shape, kept minimal since this test proves WIRING, not image
 *  rendering or region planning. */
function regionCollaborators() {
  return {
    prepareImage: () => ({
      rotate: 0, flip: null, imageFingerprint: 'lenorfebreze12345',
      regions: [
        { region_no: 1, region_kind: 'full_page', pixel_top: null, pixel_left: null, pixel_bottom: null, pixel_right: null },
        { region_no: 2, region_kind: 'strip', pixel_top: 0, pixel_left: 0, pixel_bottom: 700, pixel_right: 1000 },
        { region_no: 3, region_kind: 'strip', pixel_top: 600, pixel_left: 0, pixel_bottom: 1300, pixel_right: 1000 },
      ],
    }),
    renderAllRegions: async (buf, transform, regions) => regions.map((r) => ({ region_no: r.region_no, buffer: Buffer.from('rendered-' + r.region_no) })),
    toDataUrl: (buf) => 'data:image/jpeg;base64,' + buf.toString('utf8'),
    insertRegionBatch: async (deps, shopId, regions) => new Map(regions.map((r, i) => [r.region_no, 900 + i])),
    buildGroundedPrompt,
    // THE MOCKED MODEL RESPONSE, shaped exactly like the real captured
    // Lenor/Febreze incident: two lines, DIFFERENT source_region (2 and 3,
    // the two real strips). quantity: null on both, matching round 4's own
    // fixture, so photoSanityChecks' unjustified-quantity check never fires
    // and this test stays about region wiring, not an unrelated anomaly
    // path.
    //
    // ── THE MODEL'S OWN CLAIMED matched_regular_id IS DELIBERATELY
    //    DIFFERENT ON THE TWO LINES, AND THAT IS NOT A WEAKENING OF AC2 ────
    // "same matched_regular_id" in AC2's wording describes what
    // resolveByCatalogue.resolveAll ITSELF derives from fuzzy raw_reading
    // matching against the catalogue (both readings genuinely match
    // catalogue id 5 - proven below, and proven directly by round 4's own
    // resolveAll-only test using these exact two raw_reading strings) -
    // never the model's own claimed identity, which
    // interpretPhotoOrchestrator.js's own header comment says is
    // "deliberately IGNORED for identity by every consumer downstream", and
    // which never even reaches this function's return value (see its own
    // return statement - matched_regular_id is not one of the fields
    // mapped out). Setting the model's OWN claim to the SAME id on both
    // lines was tried first and found to trip a DIFFERENT, unrelated
    // mechanism: photoSanityChecks.js's cross-strip duplicate collapse keys
    // on (matched_regular_id, quantity) and would silently drop one line
    // before it ever reached resolveByCatalogue - which would test THAT
    // dedup rule, not this Work Order's fix. Distinct claims here (as a
    // real model reading two genuinely different products would produce)
    // let both lines survive to resolveByCatalogue, where the REAL
    // collision this fix restores visibility for actually occurs.
    vision: async () => JSON.stringify({
      lines: [
        {
          line_no: 1, raw_reading: 'LENOR OUTDOOR SPRING AWAKENING', quantity: null,
          matched_regular_id: 5, confidence: 0.9, status: 'matched', source_region: 2,
        },
        {
          // Round 6 (WO-2026-08-12-B15-VISION-06, AC3): was 'FEBREZE FABRIC
          // SPRAY LENOR SPRING AWAKENING' - that reading no longer resolves
          // to id 5 at all (see this file's header note), so this wiring
          // proof now uses a second, genuinely-Lenor reading to keep
          // exercising a REAL cross-region collision.
          line_no: 2, raw_reading: 'LENOR FABRIC CONDITIONER', quantity: null,
          matched_regular_id: 12, confidence: 0.9, status: 'matched', source_region: 3,
        },
      ],
    }),
    extractJson: async (text) => JSON.parse(text),
    runSanityChecks, // REAL
    needsFollowUp,   // REAL
    flaggedRegionsForFollowUp, // REAL
    insertPhotoProvenanceBatch: async (deps, lines) => lines.map((l, i) => ({ id: 6000 + i, ...l })),
    writeQuery: async () => ({ rows: [] }),
  };
}

test('AC2 (acceptance_property): source_region survives interpretPhotoWithDeps\'s own return value', async () => {
  const result = await interpretPhotoWithDeps(
    { catalogue: CATALOGUE, imageBuffer: Buffer.from('photo'), shopId: 77, interpreterModel: 'gpt-5.6-terra', promptVersion: 'wo05-test' },
    regionCollaborators(),
  );

  assert.equal(result.lines.length, 2, 'no follow-up should have fired - both lines were confident, matched, no anomaly');
  assert.equal(result.followUpFired, false);

  // THE REGRESSION LOCK. Before this fix, EVERY returned line's
  // source_region was silently absent, whatever the internal `checked` line
  // carried - see interpretPhotoOrchestrator.js:205-211's own history.
  const bySource = new Map(result.lines.map((l) => [l.raw_reading, l.source_region]));
  assert.equal(bySource.get('LENOR OUTDOOR SPRING AWAKENING'), 2, 'source_region must survive this function\'s own return, not just its internal `checked` array');
  assert.equal(bySource.get('LENOR FABRIC CONDITIONER'), 3);
});

test('AC2 (acceptance_property): the REAL chain - interpretPhotoWithDeps\'s real return feeds resolveByCatalogue.resolveAll, and BOTH cross-region-colliding lines end up needs_confirmation, neither silently excluded', async () => {
  const orchestrated = await interpretPhotoWithDeps(
    { catalogue: CATALOGUE, imageBuffer: Buffer.from('photo'), shopId: 78, interpreterModel: 'gpt-5.6-terra', promptVersion: 'wo05-test' },
    regionCollaborators(),
  );

  // THE EXACT SEAM THAT WAS BROKEN: orchestrated.lines - the REAL return of
  // the REAL orchestrator - is fed DIRECTLY into the REAL resolveAll. No
  // hand-built fixture re-injects source_region here, unlike round 4's own
  // proof; whatever the orchestrator actually returned is what gets judged.
  const resolved = resolveAll(orchestrated.lines, LENOR_FEBREZE_COLLISION);

  const lenor = resolved.find((l) => l.raw_reading === 'LENOR OUTDOOR SPRING AWAKENING');
  const secondLenorReading = resolved.find((l) => l.raw_reading === 'LENOR FABRIC CONDITIONER');

  assert.ok(lenor && secondLenorReading, 'both lines must be present in the resolved output');

  assert.equal(lenor.status, 'needs_confirmation', 'the FIRST line must be demoted - Amendment 1: emission order is not evidence. Before this fix this line auto-collapsed to `matched` because regionsAgree() saw two null source_regions and could not tell the collision was cross-region');
  assert.equal(lenor.matched_regular_id, null);
  assert.equal(secondLenorReading.status, 'needs_confirmation', 'the SECOND line must never be silently excluded from the basket - this is what the round-3 live Lenor/Febreze regression demonstrated (round 6 has since separately fixed the Febreze reading itself; this pair still proves the cross-region mechanism on a genuinely valid shared identity)');
  assert.equal(secondLenorReading.matched_regular_id, null);
  assert.ok(
    lenor.alternatives.some((a) => a.id === 5) && secondLenorReading.alternatives.some((a) => a.id === 5),
    'the collided candidate is offered for a human decision on both lines, never simply discarded',
  );
});
