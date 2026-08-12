// =====================================================================
// BUILD-015 AsdAIr - agenticVisionPrototype/bandPlan.js
//
// ⛔ THIS MODULE NO LONGER CARRIES AN IMPLEMENTATION. It re-exports the
// canonical one from `../imagePrep.js`.
//
// WP-B15-31 AC2 moved the orientation-aware region plan into the PRODUCTION
// seam, which is where Warwick ruled it must live: "That is acceptance-critical
// and must NOT remain outside the final integrated path."
//
// This file stays, as a re-export, for one reason and it is not sentiment: the
// prototype and its suite were where the behaviour was PROVEN, and every one of
// those tests still exercises the real implementation through this name. If the
// production geometry regresses, the prototype's own coverage proof and band
// tests fail too. Deleting this file would have quietly removed that second
// pair of eyes from the very geometry it was written to check.
//
// ⚠️ DO NOT reintroduce an implementation here. Two copies of a geometry this
// subtle WILL drift, and the drift would be invisible: both copies would pass
// their own tests while the live path used only one of them. The prototype's
// earlier header said the production planner's orientation-awareness was "a
// REPORTED finding, not a change made here" - that report has now been actioned,
// and this is the result.
//
// The one genuine rename: `planOrientationAwareBands` is
// `planOrientationAwareRegions` in production, because it emits REGIONS in
// migration 020's shape rather than bare bands. The old name is kept as an
// alias so the prototype's proven call sites and tests are untouched.
// =====================================================================

'use strict';

export {
  INK_THRESHOLD,
  DEFAULT_BAND_COUNT,
  DEFAULT_BAND_OVERLAP_FRACTION,
  paperBox,
  inkProfiles,
  alternation,
  detectStackingAxis,
  inkExtent,
  estimateLinePitch,
  planBands,
  proveCoverage,
  planOrientationAwareRegions,
  planOrientationAwareRegions as planOrientationAwareBands,
} from '../imagePrep.js';
