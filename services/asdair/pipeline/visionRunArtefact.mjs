// =====================================================================
// BUILD-015 AsdAIr - pipeline/visionRunArtefact.mjs
//
// WO-2026-08-13-15 (WP-B15-47). THE CONTRACT FOR A CAPTURED VISION RUN -
// written once and consumed by BOTH sides of the one lawful process boundary
// in this journey.
//
// ── WHAT THIS IS, AND THE WORD IT IS NOT ─────────────────────────────────
// The gateway credential for this estate lives at the ROOT of C:/.fusion247/,
// which GL-012 never permits as a worker grant. So the model call - and ONLY
// the model call - is executed in a separate, credentialed process, and its
// verbatim answers are committed. Everything else in the vision link (EXIF
// orientation, page render, greyscale decode, region planning, region
// rendering and upscaling, the deterministic sanity checks, the follow-up
// decision, the merge, region-row persistence and PHOTO provenance) runs in
// the consuming process, for real, from the committed photograph.
//
// ⛔ THIS IS NOT A FIXTURE. A fixture is data invented to stand in for a step
// that never ran. Every byte in `calls[].response` is the real model's real
// answer to the real photograph, produced by the real orchestrator's own
// prompts, in the order the orchestrator asked for them.
//
// ⛔ AND IT IS NOT "END-TO-END" WITHOUT ITS QUALIFIER. The correct sentence is:
// the chain is continuous and crosses ONE process boundary, at the credential
// line, because no other crossing is lawful.
//
// ── THE THREE ASSERTIONS THAT MAKE THE REPLAY A CHAIN AND NOT A BRIDGE ───
//   1. PHOTOGRAPH IDENTITY. The consuming run hashes the image it is about to
//      read and refuses to continue unless it is the photograph the artefact
//      was captured from. A wrong file must fail immediately rather than
//      produce a plausible artefact.
//   2. REGION PLAN IDENTITY. The consuming run recomputes the region plan with
//      the real production code and refuses unless it matches the plan the
//      model was actually shown. The plan is deterministic (proven by
//      execution over the committed photograph), so a mismatch means the
//      pixels or the planner changed underneath the capture.
//   3. CALL ALIGNMENT. Replay is ORDER-DEPENDENT. If the consuming run's
//      follow-up decision asks for a region set the capture never asked for,
//      the replay THROWS. It never returns a nearby response and never falls
//      back to the first pass. That refusal is precisely what proves the chain
//      is continuous - a replay that quietly substituted would be the
//      fixture-bridging this Work Order forbids.
//
// PURE except for reading the image bytes it is asked to hash. No network, no
// database, no credentials file, and no gateway call from this module ever.
// =====================================================================

'use strict';

import { createHash } from 'node:crypto';
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));

/** The one photograph this Work Order runs over, and its committed identity. */
export const KNOWN_PHOTO_PATH = join(HERE, 'testdata', 'known-list', 'mum-list-2026-08-11.jpg');
export const KNOWN_PHOTO_SHA256 = '89f33073296b4808f544b1f6111f10c723e532106f339d94cdae90633de80a16';

/** Where captured artefacts live, beside the photograph they were captured from. */
export const ARTEFACT_DIR = join(HERE, 'testdata', 'known-list');

/**
 * THE MODEL THIS BUILD'S EVIDENCE WAS MADE ON - the only model an artefact may
 * have been captured with.
 *
 * ── A DEFECT THE FIRST CREDENTIALED RUN ACTUALLY FOUND ────────────────────
 * The first capture recorded `interpreter_model: gpt-5-mini`, because production
 * was configured for mini - while EVERY measurement this build rests on (the
 * 39/39 coverage, the 2-of-3 reconciliation, the phantom mechanism) was made on
 * Terra. The configured fallback alias `fusion.vision` is not registered on the
 * gateway at all. Corrected at source; the mini artefact is kept beside the real
 * one, prefixed SUPERSEDED-, as the evidence that found it.
 *
 * A reading taken by a different model is not a cheaper reading - it is a
 * reading from a DIFFERENT EXPERIMENT, and every figure downstream would be
 * silently incomparable with what this build already banked. So it is checked
 * mechanically, before anything runs, exactly like the photograph's hash. The
 * cost of the check is one string comparison; the cost of missing it was nearly
 * a whole set of numbers nobody could trust.
 */
export const EXPECTED_INTERPRETER_MODEL = 'gpt-5.6-terra';

/** Every field the artefact MUST carry. Absent -> throw, never substitute (M7). */
export const REQUIRED_FIELDS = Object.freeze([
  'photo_sha256',
  'interpreter_model',
  'prompt_version',
  'region_plan_sha256',
  'calls',
  'vision_calls',
  'total_cost_usd',
]);

export const sha256 = (buf) => createHash('sha256').update(buf).digest('hex');

/**
 * Hash the photograph and refuse anything that is not the committed one.
 * Runs BEFORE anything else in both the harness and the runner.
 */
export function assertPhotoIdentity(imagePath, expected = KNOWN_PHOTO_SHA256) {
  const actual = sha256(readFileSync(imagePath));
  if (actual !== expected) {
    throw new Error(
      `visionRunArtefact: REFUSING to run - ${imagePath} has sha256 ${actual}, expected ${expected}. `
      + 'This is not the photograph this run is defined over. A wrong file must fail here rather than '
      + 'produce a plausible-looking result over the wrong page.',
    );
  }
  return actual;
}

/**
 * THE REGION PLAN, computed with the REAL production modules - the same three
 * calls `deps.js`'s realInterpretPhoto makes, in the same order. Deterministic:
 * proven by executing it twice over the committed photograph and comparing the
 * serialised result.
 *
 * Imported lazily for exactly the reason deps.js states for its own lazy
 * imports: `imageRender.js` pulls in `sharp`, and this module must stay
 * loadable (and its pure helpers usable) on a box where the pipeline's own
 * dependencies were never installed.
 */
export async function computeRegionPlan(imageBuffer) {
  const { prepareImage, planOrientationAwareRegions } = await import('./imagePrep.js');
  const { renderPreparedPage, decodeGreyscaleRaster } = await import('./imageRender.js');
  const exifPrepared = prepareImage(imageBuffer);
  const preparedPage = await renderPreparedPage(imageBuffer, { rotate: exifPrepared.rotate, flip: exifPrepared.flip });
  return planOrientationAwareRegions(await decodeGreyscaleRaster(preparedPage));
}

/**
 * The plan's identity. Deliberately hashes the WHOLE serialised plan rather
 * than a chosen subset: a change to any geometry the model was shown must
 * invalidate a replay, and picking fields to hash is how that guarantee gets
 * quietly narrowed later.
 */
export function regionPlanSha256(plan) {
  return sha256(Buffer.from(JSON.stringify(plan), 'utf8'));
}

/** Validate a parsed artefact. Throws naming the first missing/invalid field. */
export function validateArtefact(artefact) {
  if (!artefact || typeof artefact !== 'object' || Array.isArray(artefact)) {
    throw new Error('visionRunArtefact: artefact must be a JSON object');
  }
  for (const field of REQUIRED_FIELDS) {
    if (artefact[field] === undefined || artefact[field] === null) {
      throw new Error(
        `visionRunArtefact: artefact is missing required field "${field}". `
        + 'Throwing rather than substituting a default: interpreter_model and prompt_version are written '
        + 'onto every PHOTO provenance row, and a defaulted value would put a FALSE claim about which '
        + 'model read the page into the database.',
      );
    }
  }
  if (!Array.isArray(artefact.calls) || artefact.calls.length === 0) {
    throw new Error('visionRunArtefact: artefact.calls must be a non-empty array - a capture with no calls captured nothing');
  }
  artefact.calls.forEach((call, i) => {
    for (const key of ['seq', 'kind', 'regions', 'response']) {
      if (call[key] === undefined || call[key] === null) {
        throw new Error(`visionRunArtefact: artefact.calls[${i}] is missing "${key}"`);
      }
    }
    if (!Array.isArray(call.regions)) {
      throw new Error(`visionRunArtefact: artefact.calls[${i}].regions must be an array`);
    }
    if (typeof call.response !== 'string') {
      throw new Error(`visionRunArtefact: artefact.calls[${i}].response must be the model's VERBATIM string`);
    }
    if (call.seq !== i + 1) {
      throw new Error(`visionRunArtefact: artefact.calls[${i}].seq is ${call.seq}, expected ${i + 1} - call order is load-bearing for replay`);
    }
  });
  if (artefact.interpreter_model !== EXPECTED_INTERPRETER_MODEL) {
    throw new Error(
      `visionRunArtefact: REFUSING artefact captured with interpreter_model "${artefact.interpreter_model}" - `
      + `this build's evidence was all made on "${EXPECTED_INTERPRETER_MODEL}". A reading by another model is a `
      + 'reading from a different experiment, and every figure derived from it would be silently incomparable '
      + 'with what this build already banked. Recapture on the expected model rather than relaxing this check.',
    );
  }
  if (artefact.vision_calls !== artefact.calls.length) {
    throw new Error(
      `visionRunArtefact: vision_calls says ${artefact.vision_calls} but ${artefact.calls.length} calls were recorded - `
      + 'the artefact disagrees with itself and must not be replayed',
    );
  }
  return artefact;
}

/** Read + validate an artefact from disk. */
export function loadArtefact(path) {
  return validateArtefact(JSON.parse(readFileSync(path, 'utf8')));
}

/**
 * The artefact a run should consume, chosen by NAME PREFIX rather than by
 * "newest file wins".
 *
 * `vision-run-*.json` is the eligible set. `SUPERSEDED-*` is excluded here AND
 * refused by `validateArtefact` if it is ever passed explicitly - two
 * independent barriers, because the superseded mini capture is deliberately
 * kept on disk beside the real one and a selector that merely sorted filenames
 * could pick it up. Belt and braces is warranted: consuming it would silently
 * produce a full set of numbers from the wrong experiment.
 */
export function latestArtefactPath(dir = ARTEFACT_DIR) {
  const eligible = readdirSync(dir)
    .filter((f) => f.startsWith('vision-run-') && f.endsWith('.json'))
    .sort();
  if (eligible.length === 0) {
    throw new Error(`visionRunArtefact: no vision-run-*.json artefact in ${dir} - the capture has not been committed yet`);
  }
  return join(dir, eligible[eligible.length - 1]);
}

const sameRegions = (a, b) => Array.isArray(a) && Array.isArray(b)
  && a.length === b.length
  && [...a].sort((x, y) => x - y).every((v, i) => v === [...b].sort((x, y) => x - y)[i]);

/**
 * THE REPLAY COLLABORATOR. Returns a `vision(prompt, imageUrls, meta)` with the
 * exact signature the orchestrator calls, serving the captured responses in the
 * order they were captured.
 *
 * ⛔ IT THROWS RATHER THAN SUBSTITUTES. Three refusals, and none of them has a
 * fallback path:
 *   * more calls requested than were captured;
 *   * a call whose `kind` differs from the captured call at that position;
 *   * a call whose region set differs from the captured one.
 *
 * The third is the one that matters. The follow-up decision is computed from
 * the model's own first-pass answer, so if the replayed answer leads this run
 * to flag a different region set than the capture did, the recorded responses
 * no longer correspond to the questions being asked - and answering anyway
 * would be inventing data for a step, which is the one thing AC1 forbids.
 */
export function makeReplayVision(artefact) {
  validateArtefact(artefact);
  const calls = artefact.calls;
  let cursor = 0;
  const served = [];

  const replay = async (_prompt, _imageUrls, meta = {}) => {
    if (cursor >= calls.length) {
      throw new Error(
        `visionRunArtefact: REPLAY EXHAUSTED - this run asked for vision call ${cursor + 1} but the capture `
        + `recorded only ${calls.length}. The chain has diverged from the captured run; refusing to invent an answer.`,
      );
    }
    const call = calls[cursor];
    const wantKind = meta.kind ?? null;
    const wantRegions = meta.regions ?? null;

    if (wantKind !== null && call.kind !== wantKind) {
      throw new Error(
        `visionRunArtefact: REPLAY MISALIGNED at call ${call.seq} - this run asked for a "${wantKind}" call, `
        + `the capture recorded a "${call.kind}" call. Refusing to serve a response to a different question.`,
      );
    }
    if (wantRegions !== null && !sameRegions(call.regions, wantRegions)) {
      throw new Error(
        `visionRunArtefact: REPLAY REGION-SET MISMATCH at call ${call.seq} - this run asked about regions `
        + `[${wantRegions.join(', ')}], the capture asked about [${call.regions.join(', ')}]. `
        + 'The follow-up decision has diverged from the captured run. Refusing to serve a nearby response and '
        + 'refusing to fall back to the first pass: either would be a fixture standing in for a step that never ran.',
      );
    }

    cursor += 1;
    served.push(call.seq);
    return call.response;
  };

  replay.served = served;
  replay.remaining = () => calls.length - cursor;
  /** Every captured call must be consumed; a short replay means the chain diverged silently. */
  replay.assertFullyConsumed = () => {
    if (cursor !== calls.length) {
      throw new Error(
        `visionRunArtefact: REPLAY UNDER-CONSUMED - ${cursor} of ${calls.length} captured calls were used. `
        + 'The capture asked questions this run never asked, so the two runs are not the same journey.',
      );
    }
  };
  return replay;
}
