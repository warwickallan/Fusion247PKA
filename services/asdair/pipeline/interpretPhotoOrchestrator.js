// =====================================================================
// BUILD-015 AsdAIr Stage 1 - pipeline/interpretPhotoOrchestrator.js
//
// WO-2026-08-11-B15-VISION-01, Amendment 3: the real, complete
// "ONE household-aware vision call" pipeline stage - deterministic prep,
// real region rendering, the region-grounded call, deterministic sanity
// checks, at most one batched follow-up, and durable PHOTO provenance
// persisted BEFORE this function returns (AC6: enrichment is a LATER,
// separate stage in stepInterpret/beyond - this function never runs it).
//
// FULLY INJECTABLE, DELIBERATELY - matching deps.js's own stated
// philosophy ("Nothing... imports a component directly... the whole test
// suite binds fakes and runs FULLY OFFLINE"), applied one level down: this
// file has NO top-level imports of vision(), sharp, or any DB driver. Every
// collaborator arrives as an explicit argument, so this ORCHESTRATION -
// the ORDER things happen in and what gets persisted when - is proven by
// interpretPhotoOrchestrator.test.js with zero network, zero DB, zero
// sharp. deps.js's realInterpretPhoto (the ONLY caller) supplies the REAL
// collaborators; nothing here decides real vs. fake.
// =====================================================================

'use strict';

/** Reshape one raw model line into this pipeline's internal working shape. Mirrors the pre-existing rename deps.js's realInterpretPhoto already performed (status -> model_status), extended with source_region and the model's own claimed matched_regular_id (used ONLY for deterministic sanity checks here - identity is still authoritatively decided later by resolveByCatalogue.js against OUR rows, exactly as before). */
function normaliseModelLine(l, i) {
  return {
    line_no: l.line_no ?? i + 1,
    raw_reading: String(l.raw_reading ?? '').trim(),
    quantity: Number.isInteger(l.quantity) && l.quantity > 0 ? l.quantity : null,
    matched_regular_id: Number.isInteger(l.matched_regular_id) ? l.matched_regular_id : null,
    confidence: Number.isFinite(Number(l.confidence)) ? Number(l.confidence) : null,
    model_status: typeof l.status === 'string' && l.status.trim() !== '' ? l.status.trim() : null,
    source_region: Number.isInteger(l.source_region) ? l.source_region : null,
  };
}

/**
 * Merge a follow-up read back into the original pass: every original line
 * whose source_region was NOT re-read is kept unchanged; every original
 * line whose source_region WAS re-read is DROPPED (the follow-up's reading
 * of that region supersedes it); every follow-up line is appended.
 */
function mergeFollowUp(original, followUpLines, flaggedRegionNos) {
  const kept = original.filter((l) => !flaggedRegionNos.includes(l.source_region));
  return [...kept, ...followUpLines];
}

/**
 * @param {object} args - {catalogue, imageBuffer, shopId, interpreterModel, promptVersion}
 * @param {object} collaborators - every dependency, real or fake:
 *   {prepareImage, renderAllRegions, toDataUrl, insertRegionBatch,
 *    buildGroundedPrompt, vision, extractJson, runSanityChecks,
 *    needsFollowUp, flaggedRegionsForFollowUp, insertPhotoProvenanceBatch,
 *    writeQuery}
 * @returns {Promise<{lines: Array<object>, promptChars: number, followUpFired: boolean}>}
 *   `lines` matches the EXTERNAL shape deps.js's realInterpretPhoto has
 *   always returned: {line_no, raw_reading, quantity, confidence,
 *   model_status} - unchanged, so runPipeline.js's stepInterpret and every
 *   offline test that fakes deps.interpretPhoto wholesale need no change.
 */
export async function interpretPhotoWithDeps(
  { catalogue, imageBuffer, shopId, interpreterModel, promptVersion },
  collaborators,
) {
  const {
    prepareImage, renderAllRegions, toDataUrl, insertRegionBatch,
    buildGroundedPrompt, vision, extractJson,
    runSanityChecks, needsFollowUp, flaggedRegionsForFollowUp,
    insertPhotoProvenanceBatch, writeQuery,
  } = collaborators;

  // 1. DETERMINISTIC PREP (AC1) - dimensions, EXIF orientation, region plan.
  const prepared = prepareImage(imageBuffer);

  // 2. REAL RENDERING (Amendment 3) - one prepared page, N region crops.
  const rendered = await renderAllRegions(imageBuffer, { rotate: prepared.rotate, flip: prepared.flip }, prepared.regions);
  const renderedByRegionNo = new Map(rendered.map((r) => [r.region_no, r.buffer]));

  // 3. PERSIST THE REGION LIST FIRST (AC3) - the model may only ever cite a
  // region that is ALREADY a real database row, never one it is about to
  // invent alongside its own answer.
  const regionIdByNumber = await insertRegionBatch({ writeQuery }, shopId, prepared.regions, prepared.imageFingerprint);

  // 4. THE ONE HOUSEHOLD-AWARE VISION CALL (AC2) - page + every strip,
  // region-cited, in ONE request. A single strict-JSON retry, exactly as
  // the pre-Amendment realInterpretPhoto already allowed - a formatting
  // repair, never a second opinion.
  const prompt = buildGroundedPrompt(catalogue, { regions: prepared.regions });
  const imageUrls = prepared.regions.map((r) => toDataUrl(renderedByRegionNo.get(r.region_no)));
  let parsed = await extractJson(await vision(prompt, imageUrls));
  if (!parsed || !Array.isArray(parsed.lines)) {
    parsed = await extractJson(await vision(`${prompt}\n\nReturn ONLY valid JSON. No prose, no markdown, no code fences.`, imageUrls));
  }
  if (!parsed || !Array.isArray(parsed.lines)) {
    throw new Error('pipeline: the grounded vision request did not return usable JSON');
  }
  let lines = parsed.lines.map(normaliseModelLine);

  // 5. DETERMINISTIC SANITY CHECKS (AC4) - no LLM. Flags implausible qty,
  // unmatched lines, missing source_region; resolves cross-strip duplicates.
  let { lines: checked } = runSanityChecks(lines);

  // 6. THE FOLLOW-UP DECISION (AC5) - low confidence OR a deterministic
  // anomaly, either alone sufficient, covering every flagged region in ONE
  // additional request (never more than one).
  const { needsFollowUp: shouldFollowUp } = needsFollowUp(checked);
  let followUpFired = false;

  if (shouldFollowUp) {
    followUpFired = true;
    const flaggedRegionNos = flaggedRegionsForFollowUp(checked);
    const flaggedRegions = prepared.regions.filter((r) => flaggedRegionNos.includes(r.region_no));
    const flaggedUrls = flaggedRegions.map((r) => toDataUrl(renderedByRegionNo.get(r.region_no)));
    const followUpPrompt = buildGroundedPrompt(catalogue, { regions: flaggedRegions });

    let followUpParsed = await extractJson(await vision(followUpPrompt, flaggedUrls));
    if (!followUpParsed || !Array.isArray(followUpParsed.lines)) {
      followUpParsed = await extractJson(await vision(`${followUpPrompt}\n\nReturn ONLY valid JSON. No prose, no markdown, no code fences.`, flaggedUrls));
    }
    if (followUpParsed && Array.isArray(followUpParsed.lines)) {
      const followUpLines = followUpParsed.lines.map(normaliseModelLine);
      const merged = mergeFollowUp(checked, followUpLines, flaggedRegionNos);
      // Re-run sanity checks on the MERGED set: a follow-up read of one
      // strip can newly duplicate a line from an adjacent strip that was
      // never re-read, and that is only detectable once both are together.
      checked = runSanityChecks(merged).lines;
    }
    // A follow-up that STILL returns nothing usable is not fatal: the
    // original pass's readings stand, flagged as they already were -
    // never silently discarded for having failed to improve.
  }

  // 7. PERSIST PHOTO PROVENANCE (AC6) - BEFORE this function returns, i.e.
  // strictly before stepInterpret (runPipeline.js) proceeds to resolveAll,
  // shop_line, list materialisation and any later enrichment stage. This
  // is the call-order proof AC6 asks for: nothing after this point in this
  // function's body writes shop_line_provenance, and everything after this
  // function returns is stepInterpret's, which runs strictly later.
  const provenanceLines = checked.map((l) => ({
    line_no: l.line_no, raw_reading: l.raw_reading, quantity: l.quantity,
    matched_regular_id: l.matched_regular_id, confidence: l.confidence,
    source_region: l.source_region, supersededByIndex: l.supersededByIndex ?? null,
  }));
  await insertPhotoProvenanceBatch({ writeQuery }, provenanceLines, {
    shopId, regionIdByNumber, interpreterModel, promptVersion,
  });

  return {
    lines: checked
      .filter((l) => l.supersededByIndex === null || l.supersededByIndex === undefined)
      .map((l) => ({
        line_no: l.line_no, raw_reading: l.raw_reading, quantity: l.quantity,
        confidence: l.confidence, model_status: l.model_status,
      })),
    promptChars: prompt.length,
    followUpFired,
  };
}
