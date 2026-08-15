// BUILD-006 Phase 4 — build a REAL seed -> pack -> package chain in-process, for the proofs.
//
// Every step below is the real Phase 1, 2 and 3 code path: the real intake with its real
// transaction, the real compiler with its real budget and selection rule, and the real Scribe
// draft with its real refusal layer and its real schema writes. Nothing here inserts a row by
// hand, and there is no fixture package anywhere in this phase.
//
// The route is Route 3 (supplied) because it takes a privacy state and a rights posture as INPUT,
// which is exactly what the privacy and rights plants need to vary. Route 1 is used in the
// made-to-fail proof, through its own command-line surface, where the point is a real repository
// window rather than a controlled classification.

import { PACK_MAX_BYTES, PACK_MAX_ENTRIES } from '../../src/config.mjs';
import { compileEvidencePack } from '../../src/compiler.mjs';
import { intake } from '../../src/intake.mjs';
import { suppliedBundle } from '../../src/routes/supplied.mjs';
import { draftStoryPackage } from '../../src/scribe/store.mjs';
import { stubModelClient } from '../../src/scribe/stub.mjs';
import { testConfig } from './harness.mjs';

/**
 * One supplied seed, compiled and drafted.
 *
 * `privacyState` and `text` are the levers the privacy proofs pull; `modelClient` is the lever the
 * planted-defect proofs pull. Everything else is the ordinary path.
 */
export async function suppliedPackage({
  pool,
  angle,
  text,
  privacyState = 'internal',
  sourceRef = 'supplied:1',
  modelClient = stubModelClient(),
}) {
  const config = testConfig();
  const bundle = suppliedBundle({ config, angle, text, privacyState, sourceRef });

  const seeded = await intake({
    pool,
    route: 'supplied',
    selector: bundle.selector,
    angle: bundle.angle,
    privacyState,
    members: bundle.members,
  });

  const packed = await compileEvidencePack({
    pool,
    seedId: seeded.seedId,
    // The real module constants, read from config.mjs rather than from the test harness — a
    // budget a proof could widen would not be the budget the product runs under.
    maxEntries: PACK_MAX_ENTRIES,
    maxBytes: PACK_MAX_BYTES,
  });

  const drafted = await draftStoryPackage({
    pool, packId: packed.packId, modelClient,
  });

  return {
    seedId: seeded.seedId,
    packId: packed.packId,
    packageId: drafted.packageId,
    sourceRef,
    modelBinding: drafted.modelBinding,
  };
}

/**
 * Enough real prose for a pack entry to carry beats, quotations and a chronology.
 *
 * Deliberately ORDINARY WORKING TEXT with no personal detail in it: these packages are stored,
 * rendered into a demonstration document and committed to a PUBLIC repository, so a fixture
 * carrying anything real would be the exact failure the privacy dimension exists to prevent.
 */
export function workingText(label) {
  return [
    `# ${label}`,
    '',
    'The evidence pack is compiled from frozen snapshots and never from the original file, so a',
    'source edited after the fact cannot rewrite what a package already said about it.',
    '',
    'On 2026-08-13 the compiler admitted 12 artefacts from 185 candidates and recorded the other',
    '173 as omitted, each with its reason, because a bounded pack that cannot be told apart from a',
    'complete one is worse than a smaller one that discloses what it cost.',
    '',
    'The identity of a pack is a pure function of its content. Two unrelated processes handed the',
    'same seed on two different days arrive at the same 64 hex characters, which is what makes',
    'deduplication a property of the design rather than of luck.',
    '',
    'Verification stands after drafting and before anything downstream. It reads the words and the',
    'evidence rather than a rendering of them, and it is able to stop a package that fails.',
  ].join('\n');
}
