// =====================================================================
// BUILD-015 AsdAIr Stage 1 - pipeline/test/stepInterpretRegionWiring.test.js
//
// WO-2026-08-12-B15-VISION-05, AC2 (acceptance_property) - THE SECOND LEG:
// confirms the fix through the FULL production wiring named in the
// acceptance_property - interpretPhotoWithDeps -> deps.js's realInterpretPhoto
// shape -> runPipeline.js's stepInterpret -> resolveByCatalogue.js - not just
// the two-function seam regionWiringChain.test.js proves directly.
//
// Runs runPipeline.js's REAL stepInterpret (via runPipeline()), against
// pipeline/test/harness.js's fully-wired fake-Postgres shopStore/shopLines
// (real unique indexes and constraints, the same "DB-backed" tier
// runPipeline.test.js's own GATE ZERO END TO END tests already run in), with
// ONE deliberate override: deps.interpretPhoto is wired to call the REAL
// interpretPhotoWithDeps orchestrator (region-level I/O faked, exactly as
// regionWiringChain.test.js does) rather than harness.js's own shortcut
// fake, which - as found while preflighting this Work Order - bypasses
// interpretPhotoWithDeps entirely and could never have caught this defect
// either. This is deliberately the SAME shape realInterpretPhoto itself is
// (deps.js: `return lines;`, the orchestrator's own return value, unmodified)
// so this test proves the real deps.js contract, not a shortcut for it.
//
// Runs under: node --test (no real Postgres; harness.js's fake carries real
// unique indexes/constraints; no network, no model, no sharp).
// =====================================================================

'use strict';

import test from 'node:test';
import assert from 'node:assert/strict';

import { makeHarness, HOUSEHOLD_ID } from './harness.js';
import * as commands from '../commands.js';
import { runPipeline } from '../runPipeline.js';
import { STEPS } from '../stages.js';
import { interpretPhotoWithDeps } from '../interpretPhotoOrchestrator.js';
import { runSanityChecks } from '../photoSanityChecks.js';
import { needsFollowUp, flaggedRegionsForFollowUp } from '../followUpTrigger.js';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { buildGroundedPrompt } = require('../../interpret/groundedPrompt.js');

const REF = 'SHOP-2026-08-03';
const ACTOR = 'telegram:555';
const HANDLE = { shopRef: REF };

// Byte-for-byte the same real incident fixture regionWiringChain.test.js and
// resolveByCatalogueCrossRegionCollision.test.js use.
//
// UPDATED, WO-2026-08-12-B15-VISION-06 (round 6), AC3: the second raw
// reading below was originally 'FEBREZE FABRIC SPRAY LENOR SPRING
// AWAKENING' - round 6 fixed the genuine identity/alias-matching defect
// that made that reading falsely resolve to this Lenor regular in the first
// place (see resolveByCatalogue.js's own "PASS-4 BRAND-ANCHOR GUARD"
// comment). It now correctly resolves to `unmatched_new_item` and so can no
// longer collide with anything; this file's own production-wiring proof now
// uses a second, genuinely-Lenor reading to keep exercising a REAL
// cross-region collision end to end. resolveByCatalogueCrossRegionCollision
// .test.js's own "AC3 (round 6)" test proves the corrected Febreze outcome
// directly, at the pure resolveAll layer.
const LENOR_REGULAR = { id: 5, name: 'Lenor Outdoorable Spring Awakening Fabric Conditioner 86 Washes', brand: 'Lenor', aka: ['lenor outdoor'] };
const CATALOGUE = {
  household_id: HOUSEHOLD_ID,
  candidates: [{ id: LENOR_REGULAR.id, name: LENOR_REGULAR.name, brand: LENOR_REGULAR.brand, aka: LENOR_REGULAR.aka }],
  regularsById: new Map([[LENOR_REGULAR.id, LENOR_REGULAR]]),
  rules: [],
  last_order: null,
};

/** The region-level I/O fakes, identical in shape to regionWiringChain.test.js's
 *  regionCollaborators() - only the collaborator CONTAINER differs (this one
 *  is what a real deps.js-shaped interpretPhoto supplies to the orchestrator
 *  internally); the model response is the same captured collision shape. */
function realInterpretPhotoViaOrchestrator() {
  return async ({ catalogue, shopId }) => {
    const result = await interpretPhotoWithDeps(
      { catalogue, imageBuffer: Buffer.from('fake-photo'), shopId, interpreterModel: 'gpt-5.6-terra', promptVersion: 'wo05-step-interpret-test' },
      {
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
        insertRegionBatch: async (deps, id, regions) => new Map(regions.map((r, i) => [r.region_no, 900 + i])),
        buildGroundedPrompt,
        // See regionWiringChain.test.js for why the model's OWN claimed
        // matched_regular_id is deliberately DIFFERENT on the two lines
        // (avoids photoSanityChecks.js's unrelated cross-strip dedup, which
        // keys on the model's claim, not on catalogue identity).
        vision: async () => JSON.stringify({
          lines: [
            { line_no: 1, raw_reading: 'LENOR OUTDOOR SPRING AWAKENING', quantity: null, matched_regular_id: 5, confidence: 0.9, status: 'matched', source_region: 2 },
            { line_no: 2, raw_reading: 'LENOR FABRIC CONDITIONER', quantity: null, matched_regular_id: 12, confidence: 0.9, status: 'matched', source_region: 3 },
          ],
        }),
        extractJson: async (text) => JSON.parse(text),
        runSanityChecks,
        needsFollowUp,
        flaggedRegionsForFollowUp,
        insertPhotoProvenanceBatch: async (deps, lines) => lines.map((l, i) => ({ id: 7000 + i, ...l })),
        writeQuery: async () => ({ rows: [] }),
      },
    );
    // THE REAL deps.js CONTRACT: realInterpretPhoto returns `lines` and
    // nothing else (deps.js: `return lines;`) - this wrapper does exactly
    // that, so runPipeline.js's stepInterpret receives precisely what
    // production wiring would hand it.
    return result.lines;
  };
}

async function receivePhoto(h) {
  return commands.receiveList({
    householdId: HOUSEHOLD_ID, listDate: '2026-08-03', sourceKind: 'photo',
    rawMediaPath: 'C:/.fusion247/asdair/shopper-media/fake.jpg', needsReview: true,
    actor: ACTOR, telegramChatId: '555', telegramMessageId: '900',
  }, h.deps);
}

test('AC2 (acceptance_property), full production wiring: runPipeline.js\'s REAL stepInterpret, fed by the REAL interpretPhotoWithDeps orchestrator (deps.js shape), durably records BOTH cross-region-colliding lines as needs_confirmation - neither silently excluded', async () => {
  const h = makeHarness({
    catalogue: CATALOGUE,
    depsOverride: { interpretPhoto: realInterpretPhotoViaOrchestrator() },
  });

  await receivePhoto(h);
  await commands.buildShop({ shopRef: REF, actor: ACTOR }, h.deps);

  const transcribe = await runPipeline(HANDLE, h.deps);
  assert.equal(transcribe.step, STEPS.TRANSCRIBE);
  assert.equal(transcribe.to, 'TRANSCRIBING');

  const interpret = await runPipeline(HANDLE, h.deps);
  assert.equal(interpret.step, STEPS.INTERPRET);
  assert.equal(interpret.lines, 2, 'both lines must reach the list - neither silently dropped at materialisation');

  // THE DURABLE PROOF (migration 008): asdair.shop_line, written by
  // runPipeline.js's stepInterpret from resolveByCatalogue.resolveAll's
  // REAL output, fed by the REAL orchestrator's REAL return value - the
  // exact chain the acceptance_property names.
  assert.equal(h.db.shop_line.length, 2);
  const lenor = h.db.shop_line.find((l) => l.raw_reading === 'LENOR OUTDOOR SPRING AWAKENING');
  const secondLenorReading = h.db.shop_line.find((l) => l.raw_reading === 'LENOR FABRIC CONDITIONER');
  assert.ok(lenor && secondLenorReading, 'both durable rows must exist');

  assert.equal(lenor.status, 'needs_confirmation', 'the FIRST line must be demoted, not auto-collapsed to matched - the round-3 live Lenor/Febreze regression demonstrated this mechanism, now closed through the FULL production chain (round 6 has since separately fixed the Febreze reading itself; this pair still proves the cross-region mechanism on a genuinely valid shared identity)');
  assert.equal(lenor.matched_regular_id, null);
  assert.equal(secondLenorReading.status, 'needs_confirmation', 'the SECOND line must never be silently excluded from the durable interpretation or the basket');
  assert.equal(secondLenorReading.matched_regular_id, null);

  // AC3 (round 3's own guard, unaffected): an excluded/demoted line is still
  // durably PERSISTED, never dropped from the interpretation record.
  for (const l of h.db.shop_line) assert.ok(l.list_item_id, `line ${l.raw_reading} was never bound to its list item`);

  // Both lines must reach a human as real open questions - neither one
  // silently resolved nor silently dropped from the plan.
  const plan = await runPipeline(HANDLE, h.deps);
  assert.equal(plan.step, STEPS.PLAN);
  assert.equal(plan.to, 'NEEDS_DECISION');
  assert.equal(h.db.shop_question.length, 2, 'both colliding lines must open a real question for Warwick, not silently resolve to one guessed survivor');
});
