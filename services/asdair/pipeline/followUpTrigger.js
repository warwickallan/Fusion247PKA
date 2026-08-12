// =====================================================================
// BUILD-015 AsdAIr Stage 1 - pipeline/followUpTrigger.js
//
// WO-2026-08-11-B15-VISION-01, AC5: decides whether a follow-up vision call
// fires - and which regions it covers. This module is the DECISION only;
// interpretPhotoOrchestrator.js decides HOW the follow-up is shaped, and
// since WO-2026-08-12-B15-VISION-02 (AC2) that shape is one INDIVIDUAL call
// per region returned below, never one call bundling all of them. Nothing in
// THIS file changed for that Work Order - it already returned "every
// flagged region", which is exactly the input the new per-region loop needs.
//
// PURE. Takes the lines already annotated by photoSanityChecks.runSanityChecks
// (confidence, hasAnomaly, supersededByIndex, source_region) and decides.
// Makes no model call itself - this module is the DECISION, never the call.
//
// THE RULE (Part 1 design doc, step 4; this build's own Gate Zero history):
// a re-read triggers on EITHER low model-reported confidence OR a
// deterministic anomaly from AC4 - NEITHER is sufficient alone to be
// trusted as the only signal (this build already has a live, on-record
// failure of trusting self-reported confidence in isolation - see the
// design doc's own account of the Gate Zero defect and of tonight's
// "confidently wrong" production run), and the deterministic checks are a
// REAL, independent trigger, never a formality sitting after a confidence
// gate that already did the real work. Proven here as two SEPARATE cases,
// each showing the OTHER signal absent, so neither can be quietly doing all
// the work behind a shared fixture.
//
// A line already SUPERSEDED by cross-strip dedup is excluded from both
// checks: it is not the canonical reading of its physical line, and its
// survivor already carries whatever confidence/anomaly signal matters - re-
// reading a strip only because its already-resolved echo was unsure would
// waste the ONE follow-up call this design deliberately rations.
//
// ── SILENCE AS ITS OWN ANOMALY, ADDED WO-2026-08-12-B15-VISION-03 (AC1) ────
//
// THE GAP THIS CLOSES: both checks above only ever look at lines that EXIST.
// A region the model produced ZERO lines for - because it never fully
// enumerated a dense strip, or genuinely saw nothing there worth citing -
// could not trigger ANYTHING, because there was no line to carry a low
// confidence or an anomaly flag. The round-3 live diagnostic's own data
// (Asdair's captured run-a/run-b JSONs) shows the omitted GT lines
// overwhelmingly carry NO raw_reading trace anywhere in the resolved output
// at all - not merely a filtered-after-being-read shape - which is exactly
// what a silently under-reporting region looks like from here.
//
// `silentRegions` is a THIRD, independent trigger: a region this build
// EXPECTED a line from (a strip the model was actually shown and asked to
// cite) that no LIVE line names as its source_region is added to the
// follow-up set on that fact alone, regardless of what any individual line's
// confidence or anomaly flags say - because there may be no line at all to
// carry them. This does not prove WHY the region was silent (a model
// attention limit, a generation cutoff, or a genuine empty strip are all
// still possible - see AC6's observability additions in
// interpretPhotoOrchestrator.js for what is exposed to distinguish them
// later); it only ensures silence gets the same one extra look a low-
// confidence or flagged line already gets, which a purely per-line check
// structurally cannot provide.
//
// `expectedRegionNos` is OPTIONAL and defaults to `[]` (no silent-region
// check at all) so every pre-existing call site and test in this file keeps
// its exact prior behaviour unless a caller deliberately opts in by passing
// the real region list - see interpretPhotoOrchestrator.js, the only
// production caller, which now does.
// =====================================================================

'use strict';

// Below this, the model's own confidence is treated as "not sure enough to
// skip a second look". 0.6 sits below "needs_confirmation"-worthy doubt and
// above "essentially guessing" - a documented choice, not a magic number:
// tightening it trades follow-up-call cost for recall, and this Work Order
// does not ask for it to be tuned against live data (that is Asdair's later,
// evidence-driven job per AC8's harness).
export const LOW_CONFIDENCE_THRESHOLD = 0.6;

function isLive(line) {
  return line.supersededByIndex === null || line.supersededByIndex === undefined;
}

function isLowConfidence(line) {
  return Number.isFinite(line.confidence) && line.confidence < LOW_CONFIDENCE_THRESHOLD;
}

/**
 * AC1 (WO-2026-08-12-B15-VISION-03): every region in `expectedRegionNos` that
 * NO live line cites as its `source_region` - a region the model was shown
 * and asked to cite from, but which contributed nothing to the live set.
 * PURE. `expectedRegionNos` defaults to `[]`, which always yields `[]` here -
 * the honest "nothing to compare against" case, never a silent guess.
 *
 * @param {Array<object>} lines
 * @param {number[]} expectedRegionNos
 * @returns {number[]} sorted, distinct
 */
export function silentRegions(lines, expectedRegionNos = []) {
  if (!Array.isArray(expectedRegionNos) || expectedRegionNos.length === 0) return [];
  const covered = new Set(
    lines.filter(isLive)
      .map((l) => l.source_region)
      .filter((r) => r !== null && r !== undefined),
  );
  return expectedRegionNos.filter((r) => !covered.has(r)).sort((a, b) => a - b);
}

/**
 * @param {Array<object>} lines - annotated by photoSanityChecks.runSanityChecks.
 * @param {number[]} [expectedRegionNos] - AC1: the strip region_nos the model
 *   was actually shown, so a region producing ZERO live lines can be
 *   detected as its own anomaly. Optional; omitted (or empty) preserves
 *   every prior caller's exact behaviour - see this module's header.
 * @returns {{needsFollowUp:boolean, reasons:{lowConfidence:boolean, deterministicAnomaly:boolean, silentRegion:boolean}}}
 */
export function needsFollowUp(lines, expectedRegionNos = []) {
  const live = lines.filter(isLive);
  const lowConfidence = live.some(isLowConfidence);
  const deterministicAnomaly = live.some((l) => l.hasAnomaly === true);
  const silentRegion = silentRegions(lines, expectedRegionNos).length > 0;
  return {
    needsFollowUp: lowConfidence || deterministicAnomaly || silentRegion,
    reasons: { lowConfidence, deterministicAnomaly, silentRegion },
  };
}

/**
 * The distinct, sorted set of source_region numbers that need re-inspection
 * - every live line whose confidence is low OR which carries a
 * deterministic anomaly, deduplicated to its region, PLUS (AC1,
 * WO-2026-08-12-B15-VISION-03) every region in `expectedRegionNos` that
 * produced no live line at all. Each region in this list gets its OWN
 * individual follow-up vision() call (interpretPhotoOrchestrator.js, AC2,
 * WO-2026-08-12-B15-VISION-02) - never bundled into one request, and never
 * one call per LINE (a region can carry several flagged lines, or be
 * entirely silent, and is still re-inspected only once).
 *
 * @param {Array<object>} lines
 * @param {number[]} [expectedRegionNos]
 * @returns {number[]}
 */
export function flaggedRegionsForFollowUp(lines, expectedRegionNos = []) {
  const regions = new Set();
  lines.filter(isLive).forEach((l) => {
    if (l.source_region === null || l.source_region === undefined) return;
    if (isLowConfidence(l) || l.hasAnomaly === true) regions.add(l.source_region);
  });
  silentRegions(lines, expectedRegionNos).forEach((r) => regions.add(r));
  return Array.from(regions).sort((a, b) => a - b);
}
