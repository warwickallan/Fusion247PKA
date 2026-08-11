// =====================================================================
// BUILD-015 AsdAIr Stage 1 - pipeline/followUpTrigger.js
//
// WO-2026-08-11-B15-VISION-01, AC5: decides whether the SINGLE, at-most-one
// batched follow-up vision call fires - and which regions it covers.
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
 * @param {Array<object>} lines - annotated by photoSanityChecks.runSanityChecks.
 * @returns {{needsFollowUp:boolean, reasons:{lowConfidence:boolean, deterministicAnomaly:boolean}}}
 */
export function needsFollowUp(lines) {
  const live = lines.filter(isLive);
  const lowConfidence = live.some(isLowConfidence);
  const deterministicAnomaly = live.some((l) => l.hasAnomaly === true);
  return {
    needsFollowUp: lowConfidence || deterministicAnomaly,
    reasons: { lowConfidence, deterministicAnomaly },
  };
}

/**
 * The distinct, sorted set of source_region numbers the ONE batched
 * follow-up call must cover - every live line whose confidence is low OR
 * which carries a deterministic anomaly, deduplicated to its region (AC5:
 * "covering every flagged region in a single request", never one call per
 * line).
 *
 * @param {Array<object>} lines
 * @returns {number[]}
 */
export function flaggedRegionsForFollowUp(lines) {
  const regions = new Set();
  lines.filter(isLive).forEach((l) => {
    if (l.source_region === null || l.source_region === undefined) return;
    if (isLowConfidence(l) || l.hasAnomaly === true) regions.add(l.source_region);
  });
  return Array.from(regions).sort((a, b) => a - b);
}
