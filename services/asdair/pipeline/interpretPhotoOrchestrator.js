// =====================================================================
// BUILD-015 AsdAIr Stage 1 - pipeline/interpretPhotoOrchestrator.js
//
// WO-2026-08-11-B15-VISION-01, Amendment 3: the real, complete
// "ONE household-aware vision call" pipeline stage - deterministic prep,
// real region rendering, the region-grounded call, deterministic sanity
// checks, ADAPTIVE per-region re-inspection of only the regions actually
// flagged, and durable PHOTO provenance persisted BEFORE this function
// returns (AC6: enrichment is a LATER, separate stage in stepInterpret/
// beyond - this function never runs it).
//
// ── AC2 UPDATED, WO-2026-08-12-B15-VISION-02 (Amendment 4, point 6) ────────
// The follow-up step used to bundle every flagged region into ONE additional
// request. The A/B test proved individual-region inspection materially more
// accurate (35/41 named vs. 24/41 bundled) - but that is a lesson about
// PER-REGION FIDELITY, never a licence to call every region by default. The
// follow-up now issues ONE INDIVIDUAL vision() call PER FLAGGED REGION -
// never bundled, never blanket, and never fired at all when nothing was
// flagged (a clean pass still costs exactly one vision call).
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
 *    needsFollowUp, flaggedRegionsForFollowUp, silentRegions,
 *    insertPhotoProvenanceBatch, writeQuery}
 *   `silentRegions` (AC1, WO-2026-08-12-B15-VISION-03) is OPTIONAL - a
 *   collaborator container that omits it (every pre-existing test fixture)
 *   simply gets no AC6 observability field populated below; nothing else
 *   about the wiring or the follow-up decision depends on its presence,
 *   since `needsFollowUp`/`flaggedRegionsForFollowUp` compute the same
 *   signal internally once given `stripRegionNos`.
 * @returns {Promise<{lines: Array<object>, promptChars: number, followUpFired: boolean,
 *   initialSilentRegions: number[], droppedLines: Array<object>}>}
 *   `lines` matches the EXTERNAL shape deps.js's realInterpretPhoto has
 *   always returned: {line_no, raw_reading, quantity, confidence,
 *   model_status} - unchanged, so runPipeline.js's stepInterpret and every
 *   offline test that fakes deps.interpretPhoto wholesale need no change.
 *   `initialSilentRegions` and `droppedLines` are ADDITIVE (AC6,
 *   WO-2026-08-12-B15-VISION-03) - see their own inline comments below for
 *   what each observes and why a future live re-test needs it.
 */
export async function interpretPhotoWithDeps(
  { catalogue, imageBuffer, shopId, interpreterModel, promptVersion },
  collaborators,
) {
  const {
    prepareImage, renderAllRegions, toDataUrl, insertRegionBatch,
    buildGroundedPrompt, vision, extractJson,
    runSanityChecks, needsFollowUp, flaggedRegionsForFollowUp,
    silentRegions: silentRegionsFn,
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

  // AC1 (WO-2026-08-12-B15-VISION-03) - the STRIP regions the model was
  // actually shown (never the full_page region, which is whole-page context
  // rather than a specific physical area a follow-up crop can usefully
  // re-inspect - see followUpTrigger.js's silentRegions for what this feeds).
  const stripRegionNos = prepared.regions
    .filter((r) => r.region_kind === 'strip')
    .map((r) => r.region_no);

  // 6. THE FOLLOW-UP DECISION (AC5/AC2, widened by AC1/WO-2026-08-12-B15-
  // VISION-03 with a THIRD, independent trigger: a strip region producing
  // ZERO live lines at all - "silence isn't currently treated as an
  // anomaly" is exactly the gap this closes). Low confidence, a
  // deterministic anomaly, or a silent region - any one alone sufficient.
  // Each flagged region is re-inspected as its OWN individual vision() call
  // (WO-2026-08-12-B15-VISION-02, AC2) - never bundled into one request,
  // and never fired for a region nothing flagged. A clean list (0 suspect
  // regions) costs exactly the one call from step 4, unchanged.
  const { needsFollowUp: shouldFollowUp } = needsFollowUp(checked, stripRegionNos);
  // AC6 (WO-2026-08-12-B15-VISION-03) - captured from the ORIGINAL pass
  // only, before any follow-up round runs, so a future live re-test's
  // harness can see exactly which regions were silent on first read
  // regardless of whether a follow-up later recovered them. `silentRegions`
  // is an OPTIONAL collaborator (see this function's own doc comment) -
  // absent, this is simply `[]`, never a thrown error.
  const initialSilentRegions = typeof silentRegionsFn === 'function'
    ? silentRegionsFn(checked, stripRegionNos)
    : [];
  let followUpFired = false;

  if (shouldFollowUp) {
    followUpFired = true;
    const flaggedRegionNos = flaggedRegionsForFollowUp(checked, stripRegionNos);
    const flaggedRegions = prepared.regions.filter((r) => flaggedRegionNos.includes(r.region_no));

    // ONE INDIVIDUAL CALL PER FLAGGED REGION - the A/B-proven shape. A
    // single region's follow-up failing to return usable JSON is not fatal
    // to the others: that region's original-pass reading stands, flagged as
    // it already was, while every OTHER flagged region still gets its own
    // individual re-inspection.
    const followUpLines = [];
    for (const region of flaggedRegions) {
      const url = toDataUrl(renderedByRegionNo.get(region.region_no));
      const followUpPrompt = buildGroundedPrompt(catalogue, { regions: [region] });

      let regionParsed = await extractJson(await vision(followUpPrompt, [url]));
      if (!regionParsed || !Array.isArray(regionParsed.lines)) {
        regionParsed = await extractJson(await vision(`${followUpPrompt}\n\nReturn ONLY valid JSON. No prose, no markdown, no code fences.`, [url]));
      }
      if (regionParsed && Array.isArray(regionParsed.lines)) {
        followUpLines.push(...regionParsed.lines.map(normaliseModelLine));
      }
    }

    if (followUpLines.length > 0) {
      const merged = mergeFollowUp(checked, followUpLines, flaggedRegionNos);
      // Re-run sanity checks on the MERGED set: a follow-up read of one
      // region can newly duplicate a line from an adjacent region that was
      // never re-read, and that is only detectable once both are together.
      checked = runSanityChecks(merged).lines;
    }
    // A follow-up round that recovered NOTHING usable across every flagged
    // region is not fatal: the original pass's readings stand, flagged as
    // they already were - never silently discarded for having failed to
    // improve.
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
    // AC6 (WO-2026-08-12-B15-VISION-03) - ADDITIVE observability, never
    // consumed by any pre-existing caller (runPipeline.js's stepInterpret
    // reads only `.lines`/`.followUpFired`/`.promptChars`, unchanged) and
    // never persisted by this function - both fields exist to let a future
    // live re-test's HARNESS (abAcceptanceHarness.js) tell apart the three
    // omission shapes AC1 named:
    //   * "never generated by any region"  - a region_no in
    //     initialSilentRegions with NO corresponding entry in droppedLines
    //     for it either: nothing was ever read there, on the FIRST pass.
    //   * "generated then filtered/dropped" - present in droppedLines: the
    //     model DID produce this raw_reading, and photoSanityChecks.js's
    //     cross-strip/same-region dedup superseded it (see
    //     resolveCrossStripDuplicates) - a real pipeline decision, not
    //     silence.
    //   * "genuinely never seen by the model" - a strip that is NEITHER
    //     silent NOR the source of a dropped line, yet a human-verified
    //     ground-truth item is known to belong there: this pair alone
    //     cannot prove that shape (it needs the ground-truth item's real
    //     photo position, which this pipeline does not have), but ruling
    //     out the first two narrows it down for a human reviewer instead
    //     of leaving all three indistinguishable, which is the gap AC6
    //     names.
    initialSilentRegions,
    droppedLines: checked
      .filter((l) => l.supersededByIndex !== null && l.supersededByIndex !== undefined)
      .map((l) => ({
        line_no: l.line_no, raw_reading: l.raw_reading, source_region: l.source_region,
        supersededByIndex: l.supersededByIndex,
      })),
  };
}
