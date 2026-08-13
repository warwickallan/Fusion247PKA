// =====================================================================
// BUILD-015 AsdAIr - agenticVisionPrototype/visualEvidenceGate.js
//
// WO-2026-08-12-06 (WP-B15-33), AC3: THE VISUAL-EVIDENCE GATE.
//
// Warwick's invariant, and it is the whole of this module:
//
//   "A PHOTO-derived item may become durable PHOTO truth ONLY if it has
//    supporting visual evidence from an actual application-owned source
//    region."
//
//   "Household catalogue / Regulars / Favourites / aliases MAY answer 'which
//    known product does this visible handwritten line mean?'. They may NOT
//    answer 'what additional products probably belong on this photograph?'"
//
// ── WHY A PROMPT LINE COULD NEVER HAVE DISCHARGED THIS ──────────────────
// Warwick: "This is NOT a prompt politeness rule. Enforce it structurally in
// the acceptance/reconciliation path." The band prompt has asked for exactly
// this behaviour since WP-B15-30 - "A product appearing in THE HOUSEHOLD'S
// CANDIDATE PRODUCTS is NEVER on its own evidence that it is written on THIS
// week's page" - and the phantoms arrived anyway: "1 box MILKY WAY",
// "1 TRESemme conditioner", "1 WALLS SAUSAGE ROLLS", across three frozen runs.
//
// ── THE PROBLEM THIS MODULE HAD TO SOLVE FIRST ──────────────────────────
// Measured on those three artefacts, each phantom carries a VALID
// application-supplied `source_region`, a non-empty `as_written`, and an
// in-enum `product_id`. It passes every gate the application had. At runtime
// there is no ground truth - the fixture is the scorer, not the pipeline - so
// "is this line really on the page?" cannot be answered by comparison.
//
// It CAN be answered by geometry, and geometry is the one thing here the
// application owns outright: it cut the bands, it knows their pixel spans, and
// `imagePrep` measured the page's line pitch. What was missing was a per-line
// position to test against that geometry. `band_position_pct` (WP-B15-33 C6,
// authorised by Larry) supplies it, on the same transcription-only footing as
// `leading_mark`.
//
// ⛔ THE BOUND THAT MAKES THIS SAFE, AND IT IS ABSOLUTE (C5, confirmed by
//    Larry, Amendment 1):
//
//        THIS GATE MAY ONLY EVER WITHHOLD PHOTO PROVENANCE.
//        IT MAY NEVER DELETE, DROP OR HIDE A DETECTED LINE.
//
// A withheld line is still detected, still counted, still reported, still in
// front of Warwick in the Cockpit - it simply may not be recorded as PHOTO
// truth. That is the only reading under which Warwick's "cannot enter PHOTO
// provenance" and his "0 omissions" both hold at once, and it is why nothing
// in this file removes an element from an array.
//
// It also means the positional field can only ever cost confidence, never
// manufacture it: a null position withholds, and no value of it accepts
// anything. A model that lies about position can lose a real line its PHOTO
// status; it cannot gain a phantom one.
//
// ── WHAT THIS GATE DOES *NOT* DO, said plainly rather than discovered ────
// A phantom that claims a position no real line occupies passes G2 and G3.
// The gate is a geometric consistency test, not an oracle, and there is no
// oracle available at runtime. `unconfirmedInOverlap` and `bandsOverBudget`
// are therefore REPORTED beside the verdict rather than enforced: both are
// real signals, and both would withhold genuine lines at a rate this build has
// not measured. Reporting a signal you have not proved is honest; enforcing
// one is how 39/39 detection quietly becomes 34/39 without anyone deciding it.
//
// PURE. No I/O, no gateway call, no credentials, no database.
// =====================================================================

'use strict';

import { bandPositionOf, NEEDS_HUMAN } from './groundLines.js';

/** Provenance a line is eligible for once this gate has spoken. */
export const PROVENANCE = Object.freeze({
  /** Located visual evidence in an application-owned region supports this line. */
  PHOTO: 'PHOTO',
  /** No such evidence. NOT deleted - withheld, visible, and referred. */
  WITHHELD: 'WITHHELD',
  /**
   * This gate did not run on this line's run, because the contract that
   * produced it never asked for a position. NOT a pass, and never to be
   * rendered as one.
   */
  NOT_ASSESSED: 'NOT_ASSESSED',
});

/**
 * Two observations are at "the same physical place" when they fall within half
 * a measured line pitch of each other.
 *
 * Half a pitch is the largest tolerance that cannot swallow a genuine
 * neighbouring line: real lines on this page sit one full pitch apart, so a
 * tolerance of pitch/2 leaves a full pitch between the outer edges of two
 * adjacent tolerance windows. A larger window starts merging real neighbours;
 * a much smaller one stops recognising the same line read twice from two
 * crops that disagree slightly about where it starts.
 */
export const POSITION_TOLERANCE_PITCH_FRACTION = 0.5;

// =====================================================================
// WP-B15-34 AC2 - CALIBRATED FROM MEASURED PER-BAND PRECISION, NEVER FROM
// THE SCORE.
//
// WP-B15-33 shipped an OUTAGE, not a gate: 33, 30 and 29 lines of ~43
// withheld across three runs, overwhelmingly REAL ones, every one of them
// for `POSITION_COLLISION`. Warwick: "Withholding 33 of 43 real lines is an
// outage, not a gate."
//
// ── WHAT THE MEASUREMENT ACTUALLY SAID ──────────────────────────────────
// Measured over the 21 band-runs in the three `*-wp1533.json` artefacts, the
// model's positional answers are NOT uniformly precise - they are precise in
// some bands and degenerate in others, AND WHICH BANDS VARIES BY RUN:
//
//   region 6, run 1 .. [3,4,5,4,4,4,5,4,3,2]   10 lines inside 3% of crop
//   region 6, run 3 .. [0,6,14,21,28,71,...]   the same band, well spread
//   region 3, run 3 .. [3,3,3,3]                four lines, one value
//   region 2, run 1 .. [8,27,48,67,83,94]       six lines, cleanly separated
//
// A band that answers [3,3,3,3] has told you its own precision. Testing those
// four lines against each other at pitch/2 does not detect a contradiction -
// it detects that the band could not place anything, and then withholds four
// real lines for it. THAT is the outage, and its cause is applying a
// positional test to positions that carry no positional information.
//
// ── THE CALIBRATION, AND IT HAS NO FREE PARAMETER ───────────────────────
// Everything below is measured or already-owned geometry:
//   * `linePitch`      - imagePrep's measured page line pitch.
//   * band extent      - the rectangle the planner committed to the artefact.
//   * the tolerance    - the gate's OWN existing pitch/2, not a new number.
//   * `capacity`       - how many lines one pitch apart physically fit in the
//                        band: floor(extent/pitch) + 1.
//
// A band's positions RESOLVE when the number of distinct position clusters is
// at least the number of lines the band could physically have distinguished,
// `min(reported, capacity)`. Fewer clusters than that means the model failed
// to separate lines its own geometry could have separated.
//
// ⛔ NO THRESHOLD WAS FITTED TO THE THREE RUNS. Deriving a tolerance that
//    made those artefacts score well is exactly the fitting AC2 forbids. The
//    predicate is a physical-consistency test; the artefacts were used to
//    CHECK it, never to tune it.
//
// ── AND THE FINDING THAT MATTERS MORE THAN THE CALIBRATION ───────────────
// The same measurement asked the decisive question - do good positions mark
// out REAL lines? - and the answer is NO. Joining each line's verdict to its
// band's measured resolution across the three artefacts:
//
//   band resolution   REAL   INVENTED   invention rate
//   high (>=0.75)      33        2          5.7%
//   mid  (0.5-0.75)    27        2          6.9%
//   low  (<0.5)        65        1          1.5%
//
// Both "TRESemme conditioner" phantoms sat in region 2 at resolution 1.00 -
// the best-resolved band in the whole dataset - and the gate granted them
// PHOTO. Positional precision does not separate phantoms from real lines, and
// if anything points the wrong way.
//
// So the gate is calibrated to STOP WITHHOLDING where positions are
// degenerate, and its PHOTO verdict is published with `positiveAuthority:
// false` beside it. AC2 anticipated exactly this outcome and named it a
// successful discharge: "If calibration cannot separate the phantoms from
// real lines, say so and set not-assessed rather than ship an outage."
// =====================================================================

/**
 * The fewest POSITIONED lines from which "this band cannot place anything" is
 * a statement about the band rather than about one pair.
 *
 * ⛔ THIS IS A SAMPLE-SIZE FLOOR, NOT A TOLERANCE, and it is the only integer
 * in this calibration that is not read off the geometry. It is 3 because a
 * band with 2 positioned lines yields exactly ONE gap: if that gap is small,
 * the two readings are either a genuine positional contradiction - which is
 * precisely what G3 exists to catch - or a placement failure, and NOTHING in
 * the data can tell those apart from a single pair. Treating one collision as
 * proof of degeneracy would switch the gate off at the first contradiction it
 * ever found, which is the opposite of the job.
 *
 * From 3 positioned lines there are 2 gaps and a repeated failure to separate
 * becomes visible as a pattern. It is NOT tuned against the artefacts: the
 * degenerate bands measured there carry 4 to 10 positioned lines, so no value
 * of 2, 3 or 4 changes a single one of their verdicts.
 */
export const MIN_POSITIONED_FOR_DEGENERACY = 3;

/**
 * How many lines one pitch apart physically fit inside a band.
 *
 * @returns {number|null} null when the band has no usable geometry.
 */
export function bandCapacity(extent, pitch) {
  if (!Number.isFinite(extent) || !Number.isFinite(pitch) || extent <= 0 || pitch <= 0) return null;
  return Math.floor(extent / pitch) + 1;
}

/**
 * Measure ONE band's positional precision from its OWN answers.
 *
 * Single-linkage clustering at the gate's existing tolerance: two positions
 * closer than the tolerance are not distinguishable BY THIS GATE, so counting
 * them as one is not an approximation - it is the gate's own resolution.
 *
 * @param {number[]} positions - absolute px positions; nulls already removed.
 * @param {number} tolerance
 * @returns {number} count of distinct clusters.
 */
export function positionClusters(positions, tolerance) {
  const v = positions.filter((p) => Number.isFinite(p)).slice().sort((a, b) => a - b);
  if (v.length === 0) return 0;
  let clusters = 1;
  for (let i = 1; i < v.length; i += 1) if (v[i] - v[i - 1] > tolerance) clusters += 1;
  return clusters;
}

/**
 * AC2 - the per-band precision measurement the tolerance is derived FROM.
 *
 * Published in the gate's counts so the calibration is auditable against the
 * data rather than taken on trust, which is the whole of AC2's instruction.
 *
 * @returns {Map<number, object>} region_no -> precision record.
 */
export function measureBandPrecision({ lines, regionsByNo, axis, tolerance, pitch }) {
  const byBand = new Map();
  for (let i = 0; i < lines.length; i += 1) {
    const r = Number(lines[i]?.source_region);
    if (!Number.isFinite(r)) continue;
    if (!byBand.has(r)) byBand.set(r, []);
    byBand.get(r).push(i);
  }

  const out = new Map();
  for (const [regionNo, indices] of byBand) {
    const region = regionsByNo.get(regionNo);
    const extent = region ? regionExtent(region, axis) : null;
    const positions = indices
      .map((i) => absolutePosition(lines[i], regionsByNo, axis))
      .filter((p) => p !== null);
    const capacity = extent && pitch ? bandCapacity(extent.extent, pitch) : null;
    const clusters = tolerance === null ? null : positionClusters(positions, tolerance);
    const reported = indices.length;

    // ⛔ MEASURED OVER THE POSITIONED LINES ONLY. A line the model declined to
    //    place (`band_position_pct: null`) says nothing about whether the band
    //    CAN place - it says the model would not. That case already has its
    //    own verdict, NO_LOCATED_VISUAL_EVIDENCE, and counting it here would
    //    let one honest null drag a perfectly precise band into "degenerate"
    //    and switch the gate off for every other line in it.
    const distinguishable = capacity === null ? null : Math.min(positions.length, capacity);

    // ── DEGENERACY IS WHOLESALE COLLAPSE, NOT A SINGLE COLLISION ──────────
    //
    // How many of this band's positioned lines failed to separate from a
    // neighbour, and how many succeeded.
    const unresolved = clusters === null ? null : positions.length - clusters;

    // ⛔ THE PREDICATE, AND THE VERSION IT REPLACES IS WHY IT IS WORDED THIS
    //    WAY. The first attempt was `clusters < distinguishable` - "the band
    //    failed to separate ANY pair it could have". Its own mutation proof
    //    (AC2 PROOF 2) killed it: a band of five lines with ONE genuine
    //    collision fails that test, so every real contradiction in any band
    //    carrying three or more lines would have been reclassified as
    //    degeneracy and the gate's withhold would have been dead on arrival
    //    while appearing to work.
    //
    //    A collision is a CONTRADICTION - the thing G3 exists to report.
    //    Degeneracy is COLLAPSE - the band could not place anything. The line
    //    between them is a majority: the positions carry no evidential weight
    //    when MORE of them collapsed than separated.
    //
    //    Warwick's bound decides which way the doubt runs: the gate may never
    //    be positive authority, and withholding a real line is the expensive
    //    error. So a band that is merely SOMEWHAT imprecise keeps speaking,
    //    and only wholesale collapse silences it.
    //
    // ⛔ DEGENERATE means "these positions carry no evidential weight",
    //    NEVER "these lines are wrong". The fallback is NOT_ASSESSED, and a
    //    degenerate band can therefore never cost a line its detection.
    //
    //    Unmeasurable geometry is treated as degenerate too: a band whose
    //    extent or pitch is unknown cannot support a positional argument
    //    either, and failing closed here means failing towards saying LESS.
    const measurable = clusters !== null && distinguishable !== null;
    const degenerate = !measurable
      ? true
      : positions.length >= MIN_POSITIONED_FOR_DEGENERACY && unresolved > clusters;

    out.set(regionNo, {
      region_no: regionNo,
      reported,
      positioned: positions.length,
      clusters,
      unresolved,
      capacity,
      distinguishable,
      resolution: positions.length > 0 && clusters !== null ? clusters / positions.length : null,
      degenerate,
    });
  }
  return out;
}

/**
 * Map a region to its extent along the reading axis.
 *
 * The axis is `imagePrep`'s own detected stacking axis and is NOT re-derived
 * here - AC5 territory. This function only reads the rectangle the planner
 * already committed to the artefact.
 *
 * @param {object} region
 * @param {'x'|'y'} axis
 * @returns {{start:number, extent:number}|null}
 */
export function regionExtent(region, axis) {
  const start = axis === 'x' ? region?.pixel_left : region?.pixel_top;
  const end = axis === 'x' ? region?.pixel_right : region?.pixel_bottom;
  if (!Number.isFinite(Number(start)) || !Number.isFinite(Number(end))) return null;
  const extent = Number(end) - Number(start);
  if (!(extent > 0)) return null;
  return { start: Number(start), extent };
}

/**
 * Where a line physically sits in the WHOLE image, in pixels along the reading
 * axis.
 *
 * This is the join between the model's observation and the application's own
 * geometry, and it is the only place the two meet. `band_position_pct` is a
 * fraction of a crop the application cut; the crop's absolute span is a fact
 * the application recorded. Neither alone locates anything.
 *
 * @returns {number|null} null when the line carries no usable position, or the
 *   region it cites has no recorded geometry. Null is HONEST, and downstream
 *   it withholds rather than accepts.
 */
export function absolutePosition(line, regionsByNo, axis) {
  const pct = bandPositionOf(line);
  if (pct === null) return null;
  const region = regionsByNo.get(Number(line?.source_region));
  if (!region) return null;
  const extent = regionExtent(region, axis);
  if (!extent) return null;
  return extent.start + (pct / 100) * extent.extent;
}

/**
 * Is this pair the SAME physical line, as far as the application can tell?
 *
 * Used only to decide whether a positional collision is a contradiction or an
 * expected double-read. Two observations of one line agree on identity; two
 * different lines at one place are a contradiction whichever of them is wrong.
 *
 * ⛔ Deliberately NOT a text-similarity test. AC1 forbids reconciling on fuzzy
 * name similarity, and this function feeds a decision about what is real.
 */
function sameResolvedLine(a, b) {
  if (a.identified && b.identified) return String(a.product_id) === String(b.product_id);
  return false;
}

/**
 * Apply the visual-evidence gate.
 *
 * @param {object} args
 * @param {Array<object>} args.lines - reconciled lines. NEVER mutated in place.
 * @param {Array<object>} args.regions - the application's own band rectangles.
 * @param {'x'|'y'} args.axis - imagePrep's detected reading axis.
 * @param {number|null} args.linePitch - measured page line pitch, in pixels.
 * @returns {{lines:Array<object>, counts:object}}
 */
export function applyVisualEvidenceGate({
  lines, regions = [], axis = 'y', linePitch = null,
} = {}) {
  const input = Array.isArray(lines) ? lines : [];
  const regionsByNo = new Map(
    (regions || []).filter((r) => r && r.region_kind === 'strip').map((r) => [Number(r.region_no), r]),
  );
  const pitch = Number.isFinite(Number(linePitch)) && Number(linePitch) > 0 ? Number(linePitch) : null;
  const tolerance = pitch === null ? null : pitch * POSITION_TOLERANCE_PITCH_FRACTION;

  // ── AN ABSENT FIELD MEANS "THIS CONTRACT DID NOT ASK", NEVER "THE MODEL
  //    COULD NOT PLACE IT" ───────────────────────────────────────────────
  //
  // The same convention `leadingMarkOf` already runs on, and here it is
  // load-bearing rather than tidy. Every artefact banked before WP-B15-33 was
  // produced by a schema with no `band_position_pct` at all. Run naively, this
  // gate withholds EVERY line of those runs for want of a field nobody was
  // ever asked for - and then `silentlyWrong` reads 0, because a line that has
  // been referred cannot be silent. That is a instrument lying by omission, in
  // the exact style AC4 exists to end, and it would have been introduced by
  // the fix for AC3.
  //
  // So: if NO observation in the run carries the KEY, the contract did not ask
  // and the gate is NOT APPLICABLE - it withholds nothing and says so.
  //
  // ⚠️ A run where the key IS present and every value is null is a different
  // thing entirely: the model was asked and declined to place anything. That
  // withholds, and it should.
  const contractAskedForPosition = input.some(
    (l) => l !== null && typeof l === 'object' && Object.prototype.hasOwnProperty.call(l, 'band_position_pct'),
  );
  const positions = contractAskedForPosition
    ? input.map((l) => absolutePosition(l, regionsByNo, axis))
    : input.map(() => null);

  // ── WP-B15-34 AC2: MEASURE EACH BAND'S PRECISION BEFORE TRUSTING IT ─────
  const precision = contractAskedForPosition
    ? measureBandPrecision({
      lines: input, regionsByNo, axis, tolerance, pitch,
    })
    : new Map();

  /**
   * A line whose own band could not place anything has no positional
   * evidence for OR against it. It is NOT_ASSESSED - never withheld.
   */
  const inDegenerateBand = (i) => {
    const p = precision.get(Number(input[i]?.source_region));
    return p ? p.degenerate : true;
  };

  // ── G3: TWO LINES CANNOT OCCUPY ONE PLACE ───────────────────────────────
  // Whichever of the pair is wrong, the application does not know which - so
  // it withholds BOTH and refers them. Electing a winner here would be the
  // same defect `markDuplicates` already refuses to commit: quietly picking one
  // is how a real line disappears.
  //
  // ⛔ AC2: A COLLISION IS ONLY A CONTRADICTION IF BOTH POSITIONS MEAN
  //    SOMETHING. A collision involving a line from a degenerate band is an
  //    artefact of the band's inability to place lines, not evidence that two
  //    real lines occupy one place - and treating it as the latter is what
  //    withheld 33 of 43 lines.
  const collidesWith = new Map();
  if (tolerance !== null && contractAskedForPosition) {
    for (let i = 0; i < input.length; i += 1) {
      if (positions[i] === null) continue;
      if (inDegenerateBand(i)) continue;
      for (let j = i + 1; j < input.length; j += 1) {
        if (positions[j] === null) continue;
        if (inDegenerateBand(j)) continue;
        if (Math.abs(positions[i] - positions[j]) > tolerance) continue;
        if (sameResolvedLine(input[i], input[j])) continue;
        if (!collidesWith.has(i)) collidesWith.set(i, []);
        if (!collidesWith.has(j)) collidesWith.set(j, []);
        collidesWith.get(i).push(input[j].line_no);
        collidesWith.get(j).push(input[i].line_no);
      }
    }
  }

  const counts = {
    // Whether this gate could say anything at all about this run. A gate that
    // did not run must never be read as a gate that found nothing.
    applicable: contractAskedForPosition,
    applicabilityNote: contractAskedForPosition
      ? null
      : 'GATE NOT APPLICABLE: no observation in this run carries a `band_position_pct` key, so the contract '
        + 'that produced it never asked for a position. Nothing is withheld and NOTHING IS CLEARED - this run '
        + 'simply cannot be graded on located visual evidence. Any invention or silently-wrong figure from this '
        + 'run is measured WITHOUT the AC3 gate and must be quoted that way.',
    total: input.length,
    photo: 0,
    /**
     * ⛔ PHOTO FROM THIS GATE IS NOT EVIDENCE THAT A LINE IS REAL, and this
     * flag exists so nothing downstream can wire it up as though it were.
     *
     * Measured over the three WP-B15-33 artefacts: invention rate 5.7% in the
     * best-resolved bands versus 1.5% in the worst, and BOTH "TRESemme
     * conditioner" phantoms were granted PHOTO from region 2 at resolution
     * 1.00. Warwick's bound - the gate "may NEVER be used as positive
     * authority to accept a line merely because the position looks plausible"
     * - is therefore not merely a rule here, it is the measurement.
     */
    positiveAuthority: false,
    /** Neither passed nor withheld: this gate never ran on this run. */
    notAssessed: 0,
    /** AC2: not assessed because THIS line's band could not place anything. */
    notAssessedDegenerateBand: 0,
    withheld: 0,
    withheldNoPosition: 0,
    withheldPositionCollision: 0,
    positionAvailable: positions.filter((p) => p !== null).length,
    positionMissing: positions.filter((p) => p === null).length,
    // REPORTED, NEVER ENFORCED - see the header. A band that claims more lines
    // than its own pixel span can physically hold is over-reporting, and that
    // is worth seeing; it does not say WHICH of its lines is the phantom.
    bandsOverBudget: 0,
  };

  const out = input.map((line, i) => {
    // AC2: a degenerate band is NOT_ASSESSED - it can neither support a line
    // nor withhold one. This branch comes FIRST so that no reason can be
    // attached to a line whose band had nothing to say.
    const degenerateBand = contractAskedForPosition && inDegenerateBand(i);

    const reasons = [];
    if (contractAskedForPosition && !degenerateBand && positions[i] === null) {
      reasons.push(NEEDS_HUMAN.NO_LOCATED_VISUAL_EVIDENCE);
    }
    if (collidesWith.has(i)) reasons.push(NEEDS_HUMAN.POSITION_COLLISION);

    const supported = reasons.length === 0;
    if (!contractAskedForPosition) counts.notAssessed += 1;
    else if (degenerateBand) {
      counts.notAssessed += 1;
      counts.notAssessedDegenerateBand += 1;
    } else if (supported) counts.photo += 1;
    else {
      counts.withheld += 1;
      if (reasons.includes(NEEDS_HUMAN.NO_LOCATED_VISUAL_EVIDENCE)) counts.withheldNoPosition += 1;
      if (reasons.includes(NEEDS_HUMAN.POSITION_COLLISION)) counts.withheldPositionCollision += 1;
    }

    const existingReasons = Array.isArray(line.needs_human_reasons) ? line.needs_human_reasons : [];
    const mergedReasons = [...new Set([...existingReasons, ...reasons])];

    return {
      ...line,
      absolute_position_px: positions[i],
      // The application's verdict on whether this line may be PHOTO truth.
      // WITHHELD is not a deletion and must never be rendered as one.
      // ⛔ NOT_ASSESSED is NOT a pass. A line from a contract that never asked
      // for a position has not satisfied this gate; the gate simply had nothing
      // to test. Collapsing it into PHOTO would let every pre-WP-B15-33 artefact
      // claim it had cleared a gate that did not exist when it ran.
      provenance_eligible: (!contractAskedForPosition || degenerateBand)
        ? PROVENANCE.NOT_ASSESSED
        : (supported ? PROVENANCE.PHOTO : PROVENANCE.WITHHELD),
      // AC2: published per line so a reviewer can see WHY this line was or
      // was not assessed, without re-deriving the band measurement.
      band_positional_precision: contractAskedForPosition
        ? (precision.get(Number(line?.source_region)) ?? null)
        : null,
      photo_evidence: {
        supported,
        reasons,
        collides_with: collidesWith.get(i) ?? [],
      },
      needs_human_reasons: mergedReasons,
      needs_human: mergedReasons.length > 0,
    };
  });

  // The per-band budget, reported only.
  if (pitch !== null) {
    const perBand = new Map();
    for (const line of input) {
      const r = Number(line.source_region);
      perBand.set(r, (perBand.get(r) ?? 0) + 1);
    }
    for (const [regionNo, n] of perBand) {
      const region = regionsByNo.get(regionNo);
      const extent = region ? regionExtent(region, axis) : null;
      if (!extent) continue;
      if (n > Math.ceil(extent.extent / pitch)) counts.bandsOverBudget += 1;
    }
  }

  // ── THE INVARIANT THIS MODULE EXISTS UNDER, ASSERTED RATHER THAN PROMISED ─
  // Every line in must be a line out. A gate that can shorten its own input is
  // one refactor away from being a deleter, and the comment saying it must not
  // be would still read correctly on the day it became one.
  if (out.length !== input.length) {
    throw new Error(
      `applyVisualEvidenceGate: THE GATE DELETED A LINE - ${input.length} in, ${out.length} out. `
      + 'This gate may only ever WITHHOLD provenance (C5). Deleting a detected line is prohibited.',
    );
  }

  // AC2: the measurement the calibration was derived FROM, published beside
  // the verdict rather than summarised into it. A reviewer can recompute the
  // degeneracy decision for every band from these numbers alone.
  counts.perBandPrecision = [...precision.values()].sort((a, b) => a.region_no - b.region_no);
  counts.degenerateBands = counts.perBandPrecision.filter((p) => p.degenerate).length;
  counts.assessedBands = counts.perBandPrecision.length - counts.degenerateBands;

  return { lines: out, counts };
}
