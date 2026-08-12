// =====================================================================
// BUILD-015 AsdAIr - agenticVisionPrototype/groundLines.js
//
// WO-2026-08-12-01-v2 (WP-B15-29), AC3-AC8: the APPLICATION half of the
// grounding contract. lineSchema.js closes what the model may SAY; this
// module decides what the application will BELIEVE.
//
// The division of labour matters and is the whole design:
//
//   lineSchema.js  - the model cannot emit an identity nobody supplied.
//   groundLines.js - the application does not trust that it didn't.
//
// ── AC4: THE CONSTRAINT IS VERIFIED, NEVER TRUSTED ─────────────────────
// Schema enforcement is a property of TODAY'S deployment. A LiteLLM upgrade,
// a model-group change or a proxy swap could remove it without any error
// being raised anywhere - the request would still return HTTP 200, and the
// pipeline would quietly start believing free-text identities again. The
// enum check below costs microseconds and converts that silent regression
// into a loud one. It is NOT a second grounding mechanism and must never be
// described as one: it is a tripwire on the first.
//
// ── AC5: REGION GROUNDING IS ENFORCED, NOT ASSERTED ────────────────────
// A line whose `source_region` is not one the application supplied cannot
// become PHOTO truth. REJECTED, not downgraded - because a downgraded line
// is still a line, and a citation to a region that was never sent is not
// weak evidence, it is evidence of nothing.
//
// NOTE, since v1 of this order got it wrong and the correction is worth
// keeping: `photoSanityChecks.checkMissingSourceRegion` only asserts that
// `source_region` is not null. That is a NULL check, not a MEMBERSHIP check,
// and it passes happily on a region number the application never sent. The
// membership property is implemented here, in-surface.
//
// Honest limitation, recorded rather than solved: region attribution is
// near-degenerate on this photograph in practice (32/42 and 29/40 lines cited
// region 2 and ZERO cited region 1 across two prior runs). This check will
// therefore pass easily while carrying little discriminating information. It
// is a floor, not proof, and it should not be quoted as though it were.
//
// ── AC6: CONFIDENCE TRIGGERS, NEVER ACCEPTS ────────────────────────────
// Confidence decides ONE thing: whether a region is worth looking at again.
// It never makes a line acceptable and never makes one unacceptable -
// "Terra can be confidently wrong", and a gate keyed on the model's own
// self-assessment fails in exactly the case it exists to catch.
// `applyVisionConfidenceGate` is deliberately NOT ported: it makes confidence
// an acceptance authority, and it carries a live hazard (on the photo path
// its key is always set, so a missing confidence becomes `Number(null) === 0`
// and demotes EVERY matched line).
//
// ── AC7: THE QUANTITY INVARIANT IS DIRECT-IMPORTED ─────────────────────
// `leadingQuantityEvidence`, `checkUnjustifiedQuantity` and
// `checkImplausibleQuantity` are pure functions over `{raw_reading, quantity}`
// and are imported, not reimplemented - six rounds of tuning live in them.
// They are fed `raw_reading: as_written` because the verbatim reading is the
// only text that carries genuine leading-count evidence; a catalogue product
// NAME would smuggle its own pack size in, which is the precise failure the
// invariant exists to stop.
//
// ── AC8: DUPLICATES SURFACE, THEY NEVER SILENTLY VANISH ────────────────
// `resolveCrossStripDuplicates` is NOT direct-imported, for two reasons that
// are both about correctness rather than taste: it always elects a survivor
// (this AC requires that a CROSS-REGION collision have none), and it elects
// that survivor BY CONFIDENCE (which AC6 forbids as an acceptance authority).
// Its RULE is reused exactly - group on (product identity, quantity) when
// identified and on normalised verbatim text when not, so that two genuine
// milk lines at different quantities are never collapsed into one - and its
// private `duplicateKey`/`normaliseText` helpers are re-expressed here
// because they are module-private and cannot be imported.
//
// PURE. No I/O, no gateway call, no credentials, no database.
// =====================================================================

'use strict';

import {
  leadingQuantityEvidence,
  checkUnjustifiedQuantity,
  checkImplausibleQuantity,
} from '../photoSanityChecks.js';
import { UNKNOWN_VISIBLE_ITEM, NOT_A_LINE } from './lineSchema.js';
import { resolveQuantity, composeQuantityProbe, QUANTITY_BASIS } from './quantityRule.js';

/** Below this, the application may decide to LOOK AGAIN. It accepts nothing. */
export const DEFAULT_LOOK_AGAIN_BELOW = 0.6;

/**
 * Why a line was referred to a human. WP-B15-33 AC1(a).
 *
 * Every referral names its cause so that a later stage can discharge the ONE
 * cause it actually resolved. A stage that clears a bare boolean clears every
 * reason at once, including reasons it knows nothing about.
 */
export const NEEDS_HUMAN = Object.freeze({
  /** Two observations collided across regions and NOTHING has resolved it yet. */
  CROSS_REGION_DUPLICATE_UNRESOLVED: 'cross_region_duplicate_unresolved',
  /** Two observations of ONE physical line disagree about the written count. */
  LEADING_MARK_DISAGREEMENT: 'leading_mark_disagreement',
  /** No located visual evidence supports this line - AC3. PHOTO is withheld. */
  NO_LOCATED_VISUAL_EVIDENCE: 'no_located_visual_evidence',
  /** Two lines claim the same physical place. AC3. */
  POSITION_COLLISION: 'position_collision',
});

const CROSS_REGION_DUPLICATE_UNRESOLVED = NEEDS_HUMAN.CROSS_REGION_DUPLICATE_UNRESOLVED;

/** Verbatim text of a line, whichever contract produced it (Arm A vs Arm B). */
export function verbatimOf(line) {
  const written = line.as_written ?? line.raw_reading;
  return typeof written === 'string' ? written : '';
}

/**
 * The line's `leading_mark` transcription, or null (WP-B15-31 AC1).
 *
 * Null-safe on purpose: the older Arm A / Arm B contracts never carried this
 * field, and an absent field means "this contract did not ask", never "the
 * page had no count". The quantity rule falls back to `as_written` in that
 * case, which is exactly the pre-WP-B15-31 behaviour.
 */
export function leadingMarkOf(line) {
  const mark = line?.leading_mark;
  return typeof mark === 'string' && mark.trim() !== '' ? mark.trim() : null;
}

/**
 * The line's `band_position_pct` observation, or null (WP-B15-33 C6).
 *
 * Null-safe for the same reason `leadingMarkOf` is: every contract before this
 * one never asked, and an absent field means "this contract did not ask", never
 * "the model could not place it". An out-of-range value is treated as ABSENT
 * rather than clamped - a clamp would invent a position the model never gave.
 * That is safe in one direction only, and it is the direction this field is
 * bound to: the position may WITHHOLD a line and may never accept one, so an
 * honest null costs nothing while a fabricated 0 or 100 would be evidence.
 */
export function bandPositionOf(line) {
  const pct = line?.band_position_pct;
  if (pct === null || pct === undefined) return null;
  const n = Number(pct);
  if (!Number.isFinite(n) || n < 0 || n > 100) return null;
  return n;
}

/** Normalise for duplicate comparison: trim, lowercase, collapse whitespace. */
function normaliseText(text) {
  return String(text || '').trim().toLowerCase().replace(/\s+/g, ' ');
}

/**
 * AC4 - the tripwire. Throws LOUDLY on any `product_id` outside the enum the
 * application actually sent.
 *
 * Deliberately a throw and not a filter: a filtered line is a silent
 * regression with extra steps, and the whole point is that a deployment which
 * has stopped enforcing the schema must not be able to look healthy.
 *
 * @param {Array<object>} lines
 * @param {string[]} productIdEnum - the enum actually sent this turn.
 */
export function assertProductIdsInEnum(lines, productIdEnum) {
  // `null` means NO enum was sent this turn - the unconstrained arm. There is
  // no constraint to verify, and inventing a check here would report on ground
  // that was never covered. The caller records `enumVerified: false` instead.
  if (productIdEnum === null || productIdEnum === undefined) return false;
  if (!Array.isArray(productIdEnum) || productIdEnum.length === 0) {
    throw new Error('assertProductIdsInEnum: the enum actually sent is required');
  }
  const allowed = new Set(productIdEnum.map(String));
  const escapes = [];
  (Array.isArray(lines) ? lines : []).forEach((line, i) => {
    const id = line?.product_id;
    if (id === undefined || id === null || !allowed.has(String(id))) {
      escapes.push(`line index ${i} (line_no ${line?.line_no ?? '?'}): ${JSON.stringify(id)}`);
    }
  });
  if (escapes.length > 0) {
    throw new Error(
      'SCHEMA ENFORCEMENT FAILURE: the gateway returned product_id value(s) outside the enum this '
      + `application sent. The output space is NOT closed on this deployment. Offending: ${escapes.join('; ')}`,
    );
  }
  return true;
}

/**
 * AC5 - membership, not nullness.
 * @returns {string|null} a rejection reason, or null when the region is valid.
 */
export function checkSourceRegionMembership(line, suppliedRegionNos) {
  const supplied = new Set((suppliedRegionNos || []).map(Number));
  // null/undefined FIRST, before any Number() coercion: `Number(null)` is 0,
  // which is finite, so a coercion-first check would report a missing region
  // as "region 0 was not supplied". Same coercion hazard as the confidence
  // gate's `Number(null) === 0`, in a different function.
  if (line?.source_region === null || line?.source_region === undefined) return 'missing_source_region';
  const region = Number(line.source_region);
  if (!Number.isFinite(region)) return 'missing_source_region';
  if (!supplied.has(region)) return 'source_region_not_supplied';
  return null;
}

/** The AC8 grouping key - same rule as photoSanityChecks.duplicateKey. */
function duplicateKey(line) {
  const id = line.product_id;
  const identified = id !== undefined && id !== null && id !== UNKNOWN_VISIBLE_ITEM && id !== NOT_A_LINE;
  if (identified) return `p:${String(id)}|${String(line.quantity ?? 'null')}`;
  return `t:${normaliseText(verbatimOf(line))}`;
}

/**
 * AC8 - detect duplicates and REPORT them. Nothing is deleted here.
 *
 * Same region -> one survivor. The survivor is the LOWEST `line_no`, i.e. the
 * model's own first report of it - explicitly NOT the highest confidence,
 * because AC6 forbids confidence deciding what survives.
 *
 * Different regions -> NO survivor. Every member is surfaced for a human with
 * the collided candidate preserved: the application genuinely does not know
 * whether the page holds one item read twice or two items, and quietly
 * picking one is how a real line disappears.
 *
 * @param {Array<object>} lines
 * @returns {{lines: Array<object>, duplicateGroups: Array<object>}}
 */
export function markDuplicates(lines) {
  const groups = new Map();
  lines.forEach((line, index) => {
    const key = duplicateKey(line);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(index);
  });

  // ── WP-B15-33 AC1(a): A REFERRAL NOW CARRIES ITS CAUSE ──────────────────
  // `needs_human` was a bare boolean set here, BEFORE reconciliation runs, and
  // nothing downstream ever revisited it. So the four recurring band-boundary
  // sites were correctly collapsed into one line each by
  // `reconcileAcrossBands` and then still demanded a human, forever, for a
  // collision that had already been resolved. That is what "duplicates" in the
  // reporting actually meant.
  //
  // The fix is not to stop flagging - the flag is right at the moment it is
  // set, because at THIS point in the pipeline the collision genuinely is
  // unresolved. The fix is that a referral must say WHY, so a later stage can
  // clear the one cause it has actually discharged without silently clearing
  // the others. `needs_human` stays, and stays the derived truth of the list.
  const out = lines.map((l) => ({
    ...l, duplicate_of: null, duplicate_collision: false, needs_human: false, needs_human_reasons: [],
  }));
  const duplicateGroups = [];

  for (const [key, indices] of groups) {
    if (indices.length < 2) continue;
    const regions = new Set(indices.map((i) => Number(lines[i].source_region)));
    const members = indices.map((i) => ({
      index: i,
      line_no: lines[i].line_no,
      as_written: verbatimOf(lines[i]),
      product_id: lines[i].product_id,
      source_region: lines[i].source_region,
    }));

    if (regions.size === 1) {
      // One survivor: the first-reported member. Confidence plays no part.
      let survivor = indices[0];
      for (const i of indices) {
        const a = Number(lines[i].line_no);
        const b = Number(lines[survivor].line_no);
        if (Number.isFinite(a) && (!Number.isFinite(b) || a < b)) survivor = i;
      }
      for (const i of indices) if (i !== survivor) out[i].duplicate_of = survivor;
      duplicateGroups.push({
        key, kind: 'same_region', region: [...regions][0], survivorIndex: survivor, members,
      });
    } else {
      // No survivor. Every member stays visible and is flagged for a human.
      for (const i of indices) {
        out[i].duplicate_collision = true;
        out[i].needs_human = true;
        out[i].needs_human_reasons = [...new Set([...out[i].needs_human_reasons, CROSS_REGION_DUPLICATE_UNRESOLVED])];
      }
      duplicateGroups.push({
        key, kind: 'cross_region', regions: [...regions], survivorIndex: null, members,
      });
    }
  }

  return { lines: out, duplicateGroups };
}

/**
 * The whole application-side contract, in one pass.
 *
 * @param {object} args
 * @param {Array<object>} args.lines - the model's returned lines.
 * @param {string[]} args.productIdEnum - the enum actually sent (AC4).
 * @param {number[]} args.regionNos - the regions actually supplied (AC5).
 * @param {number} [args.lookAgainBelow]
 * @returns {{accepted:Array<object>, rejected:Array<object>, duplicateGroups:Array<object>,
 *            lookAgainRegions:number[], counts:object}}
 */
export function groundLines({ lines, productIdEnum, regionNos, lookAgainBelow = DEFAULT_LOOK_AGAIN_BELOW } = {}) {
  const input = Array.isArray(lines) ? lines : [];

  // AC4 first: if the output space is not closed, nothing below is meaningful.
  const enumVerified = assertProductIdsInEnum(input, productIdEnum);

  const accepted = [];
  const rejected = [];

  input.forEach((line, index) => {
    const reasons = [];
    const flags = [];
    const written = verbatimOf(line);

    // AC3 - the existence question, answered on its own terms.
    // `visible_line` is optional in the unconstrained arm; absent means the
    // contract did not ask, which is not evidence of absence.
    const visible = line.visible_line === undefined ? null : line.visible_line === true;
    if (visible === false || line.product_id === NOT_A_LINE) {
      rejected.push({ index, line, reasons: ['not_a_line'], as_written: written });
      return;
    }

    // AC5 - membership.
    const regionReason = checkSourceRegionMembership(line, regionNos);
    if (regionReason) reasons.push(regionReason);

    if (written.trim() === '') reasons.push('no_verbatim_reading');

    if (reasons.length > 0) {
      rejected.push({ index, line, reasons, as_written: written });
      return;
    }

    // ── QUANTITY: the model's number is EVIDENCE ABOUT THE MODEL; the
    //    APPLICATION decides the number (WP-B15-29 AC7 + WP-B15-30 AC1) ──────
    //
    // Both sanity checks still run and still record their flags - they are how
    // "the model inferred a pack size as a purchase count" stays VISIBLE, and
    // AC8 pins that class with a test. What WP-B15-30 AC1 changed is only what
    // happens afterwards: an absent quantity is no longer carried onward as
    // `null`. Warwick ruled the household default is ONE retail unit, so
    // quantityRule.js resolves the value from the VERBATIM page text alone.
    //
    // The rule reads the PAGE, never the model, so a quantity the checks just
    // rejected cannot leak back in through the default.
    // WP-B15-31 AC1: the sanity checks and the rule now see the page's own
    // leading mark, restored from its dedicated transcription field, instead
    // of only whatever survived into the free-text reading. The checks and the
    // rule are UNCHANGED - only the evidence handed to them is no longer
    // damaged. `leadingMarkOf` returns null for the older contracts, so their
    // behaviour is bit-for-bit what it was.
    const leadingMark = leadingMarkOf(line);
    const probeText = composeQuantityProbe(written, leadingMark).text;
    const quantityProbe = { raw_reading: probeText, quantity: line.quantity ?? null };
    const unjustified = checkUnjustifiedQuantity(quantityProbe);
    if (unjustified) flags.push(unjustified);
    const implausible = checkImplausibleQuantity(quantityProbe);
    if (implausible) flags.push(implausible);
    const resolvedQuantity = resolveQuantity({
      asWritten: written,
      leadingMark,
      reportedQuantity: line.quantity ?? null,
      isPurchaseLine: true,
    });
    const quantity = resolvedQuantity.quantity;

    // AC6 - confidence records, and may trigger another look. Nothing else.
    const confidence = Number.isFinite(Number(line.confidence)) ? Number(line.confidence) : null;
    const lookAgain = confidence !== null && confidence < lookAgainBelow;

    accepted.push({
      line_no: line.line_no ?? index + 1,
      as_written: written,
      visible_line: visible,
      // NEVER fabricate an escape value the model did not send. The
      // unconstrained arm emits no product_id at all, and defaulting that to
      // UNKNOWN_VISIBLE_ITEM would put an EXPLICIT declaration of uncertainty
      // into the model's mouth - which scored every one of Arm A's 42 lines
      // as an honest unknown and its `correct` count as zero. An absent
      // identity claim is null; only the model may declare an unknown.
      product_id: line.product_id ?? null,
      identified: line.product_id !== undefined
        && line.product_id !== null
        && line.product_id !== UNKNOWN_VISIBLE_ITEM
        && line.product_id !== NOT_A_LINE,
      source_region: Number(line.source_region),
      quantity,
      // AC1 - a 1 the household default supplied is never indistinguishable
      // from a 1 the page actually wrote. Both the basis and the model's own
      // discarded claim travel with the line.
      quantity_basis: resolvedQuantity.basis,
      quantity_evidence: leadingQuantityEvidence(probeText),
      // WP-B15-31 AC1: WHERE the evidence came from travels with the line, so
      // "the page said 2 and the dedicated field carried it" is distinguishable
      // from "the reading happened to still start with a digit".
      leading_mark: leadingMark,
      // WP-B15-33 C6. Carried, never acted on here: this module decides what
      // the application BELIEVES about a line, and a position may only ever
      // withhold PHOTO provenance downstream. It never makes a line acceptable,
      // so it is deliberately not consulted by any check above.
      //
      // ⚠️ THE KEY IS PROPAGATED ONLY WHEN THE MODEL WAS ACTUALLY ASKED FOR IT.
      // Writing `band_position_pct: null` unconditionally would make every
      // pre-WP-B15-33 artefact look like a run whose model declined to place
      // its lines, when in truth no such field was ever requested. Downstream,
      // `applyVisualEvidenceGate` distinguishes those two states by the presence
      // of this key, and it withholds on one and not the other - so
      // manufacturing the key here would silently convert "not asked" into
      // "asked and refused" for every artefact on the record.
      ...(Object.prototype.hasOwnProperty.call(line, 'band_position_pct')
        ? { band_position_pct: bandPositionOf(line) }
        : {}),
      quantity_evidence_source: resolvedQuantity.evidenceSource ?? null,
      quantity_probe_text: resolvedQuantity.probeText ?? written,
      model_quantity: resolvedQuantity.modelQuantity,
      model_quantity_disagreed: resolvedQuantity.modelDisagreed,
      confidence,
      look_again: lookAgain,
      flags,
    });
  });

  const { lines: marked, duplicateGroups } = markDuplicates(accepted);

  const lookAgainRegions = [...new Set(
    marked.filter((l) => l.look_again).map((l) => l.source_region),
  )].sort((a, b) => a - b);

  const counts = {
    returned: input.length,
    accepted: marked.length,
    rejected: rejected.length,
    identified: marked.filter((l) => l.identified).length,
    unknownVisible: marked.filter((l) => l.product_id === UNKNOWN_VISIBLE_ITEM).length,
    noIdentityClaim: marked.filter((l) => l.product_id === null).length,
    notALine: rejected.filter((r) => r.reasons.includes('not_a_line')).length,
    regionRejected: rejected.filter((r) => r.reasons.includes('source_region_not_supplied')).length,
    quantityNulled: marked.filter((l) => l.flags.length > 0).length,
    // AC1 - how many lines took Warwick's household default rather than a
    // count actually written on the page, and how many model-claimed numbers
    // were discarded on the way. Both are reported; neither is silent.
    quantityDefaulted: marked.filter((l) => l.quantity_basis === QUANTITY_BASIS.HOUSEHOLD_DEFAULT).length,
    quantityFromPage: marked.filter((l) => l.quantity_basis === QUANTITY_BASIS.EXPLICIT).length,
    modelQuantityDiscarded: marked.filter((l) => l.model_quantity_disagreed).length,
    duplicateGroups: duplicateGroups.length,
    crossRegionCollisions: duplicateGroups.filter((g) => g.kind === 'cross_region').length,
  };

  return {
    accepted: marked, rejected, duplicateGroups, lookAgainRegions, counts, enumVerified,
  };
}
