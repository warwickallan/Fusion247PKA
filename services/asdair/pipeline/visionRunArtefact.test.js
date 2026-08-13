// =====================================================================
// BUILD-015 AsdAIr - pipeline/visionRunArtefact.test.js
//
// WO-2026-08-13-15 (WP-B15-47). PROOFS FOR THE ONE PROCESS BOUNDARY.
//
// What is proven here, offline, with NO gateway, NO credential and NO database:
//   1. The photograph identity assertion refuses a different file.
//   2. The region plan over the COMMITTED photograph is deterministic, and its
//      sha256 is stable across two independent computations.
//   3. A missing artefact field THROWS and is never defaulted (M7) - stated as
//      a rule and then executed field by field over the whole required list.
//   4. The replay serves captured responses in order.
//   5. The replay REFUSES rather than substitutes, on all three divergences:
//      a different region set, a different call kind, and exhaustion.
//   6. Under-consumption is detectable.
//
// (5) is the load-bearing one. Replay is order-dependent because the follow-up
// decision is computed from the model's own first-pass answer. A replay that
// quietly served a nearby response, or fell back to the first pass, would be
// exactly the fixture-bridging AC1 forbids - so each refusal is executed here
// rather than described in a comment.
// =====================================================================

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';

import {
  KNOWN_PHOTO_PATH, KNOWN_PHOTO_SHA256, REQUIRED_FIELDS,
  assertPhotoIdentity, computeRegionPlan, regionPlanSha256,
  validateArtefact, makeReplayVision, sha256,
} from './visionRunArtefact.mjs';

const artefactFixture = (over = {}) => ({
  photo_sha256: KNOWN_PHOTO_SHA256,
  interpreter_model: 'gpt-5.6-terra',
  prompt_version: 'v-test',
  region_plan_sha256: 'deadbeef',
  calls: [
    { seq: 1, kind: 'first_pass', regions: [1, 2, 3], retry: false, response: '{"lines":[]}' },
    { seq: 2, kind: 'follow_up', regions: [2], retry: false, response: '{"lines":[{"raw_reading":"x"}]}' },
  ],
  vision_calls: 2,
  total_cost_usd: 0.0123,
  ...over,
});

// =====================================================================
// 1 + 2 - identity of the photograph and of the region plan
// =====================================================================

test('AC1: the committed photograph has the identity this Work Order is defined over', () => {
  assert.ok(existsSync(KNOWN_PHOTO_PATH), 'the committed photograph must be present in the worktree');
  const actual = assertPhotoIdentity(KNOWN_PHOTO_PATH);
  assert.equal(actual, KNOWN_PHOTO_SHA256);
});

test('AC1: a DIFFERENT file is refused before anything else can run', () => {
  assert.throws(
    () => assertPhotoIdentity(KNOWN_PHOTO_PATH, 'f'.repeat(64)),
    /REFUSING to run/,
    'a wrong photograph must fail immediately rather than produce a plausible result over the wrong page',
  );
});

test('AC1: the region plan over the committed photograph is DETERMINISTIC', async () => {
  const buf = readFileSync(KNOWN_PHOTO_PATH);
  const a = await computeRegionPlan(buf);
  const b = await computeRegionPlan(buf);

  assert.equal(
    regionPlanSha256(a), regionPlanSha256(b),
    'the plan must be reproducible, or the replay cannot assert that this run sees what the model saw',
  );
  assert.ok(a.regions.length > 0, 'a plan with no regions would ground nothing');
  // Pinned to a literal held OUTSIDE the planner, so a silent change to the
  // planner's output over this photograph is caught rather than absorbed.
  assert.equal(a.regions.length, 8);
  assert.equal(a.axis, 'x');
});

// =====================================================================
// 3 - a missing field throws, and is NEVER defaulted
// =====================================================================

test('M7: EVERY required artefact field throws by name when absent - none is defaulted', () => {
  // Executed over the whole list rather than spot-checked: "throws for the one
  // field I remembered to test" is how a defaulting bug survives.
  for (const field of REQUIRED_FIELDS) {
    const broken = artefactFixture();
    delete broken[field];
    assert.throws(
      () => validateArtefact(broken),
      new RegExp(`missing required field "${field}"|artefact\\.calls`),
      `a missing "${field}" must throw rather than be substituted`,
    );
  }
});

test('M7: an artefact that disagrees with itself about the call count is refused', () => {
  assert.throws(() => validateArtefact(artefactFixture({ vision_calls: 9 })), /disagrees with itself/);
});

test('M7: a non-verbatim response (not a string) is refused', () => {
  const broken = artefactFixture();
  broken.calls[0].response = { lines: [] };
  assert.throws(() => validateArtefact(broken), /VERBATIM string/);
});

test('M7: out-of-order call sequence is refused - call order is load-bearing', () => {
  const broken = artefactFixture();
  broken.calls[0].seq = 2;
  broken.calls[1].seq = 1;
  assert.throws(() => validateArtefact(broken), /call order is load-bearing/);
});

// =====================================================================
// 4 + 5 - the replay serves in order, and REFUSES rather than substitutes
// =====================================================================

test('AC1: the replay serves captured responses in captured order', async () => {
  const replay = makeReplayVision(artefactFixture());
  assert.equal(await replay('p', ['u'], { kind: 'first_pass', regions: [1, 2, 3] }), '{"lines":[]}');
  assert.equal(await replay('p', ['u'], { kind: 'follow_up', regions: [2] }), '{"lines":[{"raw_reading":"x"}]}');
  replay.assertFullyConsumed();
});

test('AC1 THE LOAD-BEARING REFUSAL: a DIFFERENT region set THROWS - never a nearby response', async () => {
  const replay = makeReplayVision(artefactFixture());
  await replay('p', ['u'], { kind: 'first_pass', regions: [1, 2, 3] });
  await assert.rejects(
    () => replay('p', ['u'], { kind: 'follow_up', regions: [5] }),
    /REPLAY REGION-SET MISMATCH/,
    'if this run flags a different region than the capture did, the recorded answers no longer '
    + 'correspond to the questions - serving one anyway would be inventing data for a step',
  );
});

test('AC1: a different call KIND throws - the first pass is never reused as a follow-up', async () => {
  const replay = makeReplayVision(artefactFixture());
  await assert.rejects(
    () => replay('p', ['u'], { kind: 'follow_up', regions: [1, 2, 3] }),
    /REPLAY MISALIGNED/,
  );
});

test('AC1: asking for MORE calls than were captured throws rather than repeating one', async () => {
  const replay = makeReplayVision(artefactFixture());
  await replay('p', ['u'], { kind: 'first_pass', regions: [1, 2, 3] });
  await replay('p', ['u'], { kind: 'follow_up', regions: [2] });
  await assert.rejects(() => replay('p', ['u'], { kind: 'follow_up', regions: [2] }), /REPLAY EXHAUSTED/);
});

test('AC1: a replay that consumed only SOME captured calls is detectable, not silent', async () => {
  const replay = makeReplayVision(artefactFixture());
  await replay('p', ['u'], { kind: 'first_pass', regions: [1, 2, 3] });
  assert.equal(replay.remaining(), 1);
  assert.throws(() => replay.assertFullyConsumed(), /REPLAY UNDER-CONSUMED/);
});

test('AC1: region-set comparison is order-insensitive but membership-exact', async () => {
  const replay = makeReplayVision(artefactFixture());
  // Same members, different order - the same question.
  assert.equal(await replay('p', ['u'], { kind: 'first_pass', regions: [3, 1, 2] }), '{"lines":[]}');
  // A subset is NOT the same question.
  await assert.rejects(() => replay('p', ['u'], { kind: 'follow_up', regions: [] }), /REGION-SET MISMATCH/);
});

test('sha256 helper agrees with the committed photograph fingerprint', () => {
  assert.equal(sha256(readFileSync(KNOWN_PHOTO_PATH)), KNOWN_PHOTO_SHA256);
});
