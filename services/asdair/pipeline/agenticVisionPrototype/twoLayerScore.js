// =====================================================================
// BUILD-015 AsdAIr - agenticVisionPrototype/twoLayerScore.js
//
// WO-2026-08-12-02 (WP-B15-30), AC4: TWO SEPARATE SCORE LAYERS. Never one
// collapsed "correct %".
//
// Warwick: "Do not collapse everything into one 'correct %'... That prevents
// an OCR/coverage failure from being confused with a catalogue-matching
// failure."
//
//   LAYER A - PHOTO / SOURCE-TRUTH QUALITY. Did we see what is on the page?
//   LAYER B - IDENTITY RESOLUTION QUALITY. Of what we saw, did we name it?
//
// Layer B's denominator is DETECTED LINES, not 39. A run that reads 20 of 39
// lines and names all 20 correctly scores 100% on B and 51% on A, and those
// are two different problems with two different fixes. Collapsing them is what
// made the WP-B15-29 result undiagnosable.
//
// ── WHY THIS REPLACES sevenWayScore's JOIN, AND WHAT IT KEEPS ───────────
// sevenWayScore joins the model's READING to a CATALOGUE PRODUCT NAME, so
// every identity verdict ended in a text-similarity join between two things
// that are not the same kind of object. It could not reconcile "2 chips with
// skins on" to "ASDA Crispy Skin-On Fries 750g" and reported that line as an
// INVENTION - one of the three of five "inventions" Warwick identified as
// measurement noise rather than model failure.
//
// Here the join is READING against READING: the model's `as_written` against
// the fixture's `source_text`, which are the same kind of object (both are
// somebody's reading of the same handwriting). Identity is then decided by
// comparing PRODUCT IDS, not text. That removes the fuzzy join from the
// identity verdict entirely.
//
// KEPT, because it was right and it is load-bearing:
//   * THE READING ANCHORS THE TRUTH. A line is detected because of what it
//     READ, never because of what it NAMED. A line whose reading matches
//     nothing but whose named candidate is real is an INVENTION - a supplied
//     candidate that became a PHOTO line on no image evidence.
//   * ONE-TO-ONE ASSIGNMENT, strongest pair first, not first-match-wins.
//   * An explicit UNKNOWN is never an invention.
//
// ── THE LIMIT THAT TRAVELS WITH EVERY NUMBER THIS PRODUCES ──────────────
// The fixture's `source_text` column is NON-INDEPENDENT: a model transcribed
// it. So layer A's VISIBLE-TEXT sub-metric compares one model's reading with
// another model's reading and is reported as NOT INDEPENDENTLY GRADED. It is
// not silently folded into the headline, and `limits` carries it out of this
// module with the score.
//
// Detection, omission, invention, duplicates and identity are NOT affected by
// that limit: they rest on the human-anchored catalogue/quantity columns and
// on the count of lines, not on the transcription being right.
//
// PURE. No I/O except an explicit fixture file read.
// =====================================================================

'use strict';

import fs from 'node:fs';
import { UNKNOWN_VISIBLE_ITEM, NOT_A_LINE } from './lineSchema.js';
import { verbatimOf } from './groundLines.js';
import { similarity, MATCH_FLOOR, quantityAgreesUnderDefaultOne } from './sevenWayScore.js';
import { QUANTITY_BASIS } from './quantityRule.js';
import { PROVENANCE } from './visualEvidenceGate.js';

// =====================================================================
// WP-B15-33 AC4 - THE FIVE METRIC FAMILIES. Warwick: "The current metrics
// have repeatedly lied by omission."
//
// This section SUPERSEDES the headline role of `layerA`/`layerB` below, which
// are RETAINED unchanged so every number already on the record stays
// reproducible from the same artefact. Nothing is deleted; what changes is
// which block is quoted as the measurement.
//
// ── THE THREE OMISSIONS THIS FIXES, each one measured, not theorised ─────
//
// 1. `leadingCountPreserved` MEASURED AVAILABILITY AND WAS READ AS
//    CORRECTNESS. It asks "did a count survive to the application?", which is
//    a real question and was the right question for WP-B15-31. It is blind by
//    construction to the pages 11 / 16 / 19 class, where the count arrives
//    perfectly and is simply the WRONG DIGIT. Across the three variance runs
//    it read 34/39, 37/39, 37/39 while three counts were wrong in EVERY run.
//    Preserved and correct are now separate numbers and neither can be quoted
//    as the other.
//
// 2. RATES WERE PUBLISHED WITHOUT DENOMINATORS. Every rate here carries the
//    denominator it was computed over, in the same object, so a figure cannot
//    be lifted out of its population.
//
// 3. "DUPLICATES" CONFLATED SITES WITH SURVIVORS - and that conflation cost a
//    whole Work Order. The order that commissioned this work read
//    "sites 5/5/6, survivors 5/3/2" as four uncollapsed duplicates; the four
//    named sites were in fact being collapsed correctly in 3/3 runs, and the
//    survivors were a different set entirely. The family below reports the
//    three quantities Warwick asked for as three separate numbers: raw
//    overlapping observations, correctly reconciled same-line duplicates, and
//    INCORRECT CROSS-LINE MERGES - the last being the one that destroys a real
//    purchase and the one nothing had ever measured.
//
// ── AND THE MEASUREMENT WARWICK'S BAR ACTUALLY NEEDS ────────────────────
// "A genuine uncertain line may go to Cockpit. A silently wrong line may not."
// That makes SILENCE part of the defect, so a wrong number that was referred
// to a human is a different outcome from a wrong number the application
// believed. `quantitySilentlyWrong` is the figure that answers Warwick's bar;
// `quantityWrongButReferred` is the one that is a success.
// =====================================================================

/** A rate that cannot be separated from the population it was computed over. */
function rate(n, d) {
  return {
    n, d, pct: d > 0 ? Number(((n / d) * 100).toFixed(1)) : null,
  };
}

/** Does this page line carry a written count at the start? */
function pageCarriesCount(exp) {
  return /^\s*\d/.test(String(exp?.source_text || ''));
}

/**
 * Join readings to page lines: strongest pair first, one-to-one.
 *
 * Extracted from `scoreTwoLayer` unchanged so the families below grade on
 * EXACTLY the same correspondence the two-layer score used. Two joins would
 * drift, and a metric that disagrees with the metric beside it is worse than
 * either alone.
 */
function joinReadings(answers, expected) {
  const readingPairs = [];
  const identityPairs = [];
  answers.forEach((line, ai) => {
    const written = verbatimOf(line);
    expected.forEach((exp, ei) => {
      const byReading = similarity(exp.source_text, written);
      if (byReading >= MATCH_FLOOR) readingPairs.push({ ai, ei, byReading });
      if (line.identified && exp.expected_product_id
        && String(line.product_id) === String(exp.expected_product_id)) {
        identityPairs.push({ ai, ei });
      }
    });
  });
  readingPairs.sort((p, q) => q.byReading - p.byReading || p.ai - q.ai || p.ei - q.ei);
  const fixtureForAnswer = new Map();
  const claimed = new Set();
  for (const p of readingPairs) {
    if (fixtureForAnswer.has(p.ai) || claimed.has(p.ei)) continue;
    fixtureForAnswer.set(p.ai, p.ei);
    claimed.add(p.ei);
  }
  const anyReadingForAnswer = new Map();
  for (const p of readingPairs) if (!anyReadingForAnswer.has(p.ai)) anyReadingForAnswer.set(p.ai, p.ei);
  const identityOnlyForAnswer = new Map();
  for (const p of identityPairs) if (!identityOnlyForAnswer.has(p.ai)) identityOnlyForAnswer.set(p.ai, p.ei);
  return {
    fixtureForAnswer, anyReadingForAnswer, identityOnlyForAnswer, claimed,
  };
}

/** Best page line for one free-text reading, or null. Used to grade MERGES. */
function bestPageLineFor(text, expected) {
  let best = null;
  let bestScore = 0;
  expected.forEach((exp, ei) => {
    const s = similarity(exp.source_text, text);
    if (s >= MATCH_FLOOR && s > bestScore) {
      bestScore = s;
      best = ei;
    }
  });
  return best;
}

/**
 * WP-B15-33 AC4 - score one run in Warwick's five families.
 *
 * @param {object} args
 * @param {Array<object>} args.accepted - the FINAL lines, after reconciliation
 *   and after the AC3 visual-evidence gate. Grading anything earlier measures
 *   a state the application never acts on.
 * @param {Array<object>} [args.merges] - reconciliation's own merge record.
 *   Without it, incorrect cross-line merges CANNOT be measured, and the family
 *   says so rather than reporting a comfortable zero.
 * @param {Array<object>} [args.duplicateGroups]
 * @param {number|null} [args.rawObservationCount] - lines returned before
 *   reconciliation.
 * @param {object} args.fixture
 * @param {object} [args.gateCounts] - `applyVisualEvidenceGate`'s counts.
 * @param {boolean} [args.enumClosed] - was a closed candidate enum enforced.
 */
export function scoreMetricFamilies({
  accepted, merges = null, duplicateGroups = [], rawObservationCount = null,
  fixture, gateCounts = null, enumClosed = true,
} = {}) {
  if (!fixture?.lines?.length) throw new Error('scoreMetricFamilies: fixture is required');
  const expected = fixture.lines;
  const answers = Array.isArray(accepted) ? accepted : [];
  const { fixtureForAnswer, anyReadingForAnswer, identityOnlyForAnswer, claimed } = joinReadings(answers, expected);

  // ── FAMILY 1: PHOTO COVERAGE ────────────────────────────────────────────
  const detected = fixtureForAnswer.size;
  const coverage = {
    expectedPageLines: expected.length,
    detected: rate(detected, expected.length),
    omitted: rate(expected.length - detected, expected.length),
    omittedPageLines: expected
      .map((e, ei) => ({ e, ei }))
      .filter(({ ei }) => !claimed.has(ei))
      .map(({ e }) => ({ page_order: e.page_order, source_text: e.source_text })),
  };

  // ── FAMILY 2: PHOTO INVENTION ───────────────────────────────────────────
  // Warwick asked for two numbers because they are two different failures.
  const invention = {
    catalogueValidButUnsupported: 0,
    catalogueValidButUnsupportedDetail: [],
    arbitraryOutOfSet: 0,
    // The AC3 gate's effect on the class, which is the only thing that says
    // whether the gate did its job.
    unsupportedStillHoldingPhoto: 0,
    unsupportedWithheldByGate: 0,
    /** The AC3 gate did not run on this artefact - NOT the same as passing it. */
    unsupportedGateNotRun: 0,
    arbitraryOutOfSetNote: enumClosed
      ? 'STRUCTURALLY IMPOSSIBLE on this run, not merely absent: a closed product_id enum was enforced and '
        + 'assertProductIdsInEnum THROWS on any value outside it. This number can only ever be 0 here, and quoting '
        + 'it as evidence of model restraint would be false.'
      : 'No closed enum was enforced on this run, so an out-of-set identity was possible and this count is meaningful.',
  };

  // ── FAMILY 4: QUANTITY ──────────────────────────────────────────────────
  const quantity = {
    pageLinesCarryingWrittenCount: expected.filter(pageCarriesCount).length,
    detectedWherePageCarriesCount: 0,
    countPreserved: 0,
    countCorrect: 0,
    countWrong: 0,
    countWrongDetail: [],
    silentlyWrong: 0,
    wrongButReferred: 0,
    contestedExcluded: 0,
    defaultOneLines: answers.filter((l) => l.quantity_basis === QUANTITY_BASIS.HOUSEHOLD_DEFAULT).length,
    packDigitsIgnoredAsQuantity: answers.filter(
      (l) => l.model_quantity_disagreed && l.quantity_basis === QUANTITY_BASIS.HOUSEHOLD_DEFAULT,
    ).length,
    // The 12-line subset: the ONLY lines on which a LOST count is
    // distinguishable from a correctly-read one, because everywhere else the
    // household default supplies the same answer. It is the right denominator
    // for LOSS and the wrong one for CORRECTNESS - which is the confusion that
    // let page 19 (true count 1, read 2, in 3/3 runs) sit outside the measured
    // set while being one of the three defects the work was commissioned for.
    lossSubsetTotal: 0,
    lossSubsetCorrect: 0,
  };

  // ── FAMILY 5: IDENTITY ──────────────────────────────────────────────────
  const identity = {
    gradable: 0, correct: 0, wrong: 0, unresolvedUnknown: 0, noClaim: 0, notGradable: 0,
  };

  answers.forEach((line, ai) => {
    const ei = fixtureForAnswer.get(ai);
    const isUnknown = line.product_id === UNKNOWN_VISIBLE_ITEM;
    const isNotALine = line.product_id === NOT_A_LINE;
    if (isNotALine) return;

    if (ei === undefined) {
      // Read something no page line corresponds to. A second observation of an
      // already-claimed line is a DUPLICATE and belongs to family 3, not here.
      if (anyReadingForAnswer.has(ai)) return;
      invention.catalogueValidButUnsupported += 1;
      if (line.provenance_eligible === PROVENANCE.WITHHELD) invention.unsupportedWithheldByGate += 1;
      else if (line.provenance_eligible === PROVENANCE.NOT_ASSESSED) invention.unsupportedGateNotRun += 1;
      else invention.unsupportedStillHoldingPhoto += 1;
      invention.catalogueValidButUnsupportedDetail.push({
        as_written: verbatimOf(line),
        named_product_id: line.product_id ?? null,
        named_via_identity_only: identityOnlyForAnswer.has(ai),
        provenance_eligible: line.provenance_eligible ?? null,
        withheld_because: line.photo_evidence?.reasons ?? [],
      });
      return;
    }

    const exp = expected[ei];

    // QUANTITY, graded on the page's own written count.
    if (pageCarriesCount(exp)) {
      quantity.detectedWherePageCarriesCount += 1;
      const markPreserved = typeof line.leading_mark === 'string' && line.leading_mark.trim() !== '';
      if (markPreserved || /^\s*\d/.test(verbatimOf(line))) quantity.countPreserved += 1;
    }
    const isLossSubset = exp.expected_quantity !== 1;
    if (isLossSubset) quantity.lossSubsetTotal += 1;

    const ok = quantityAgreesUnderDefaultOne(exp.expected_quantity, line.quantity ?? null);
    if (exp.contested) {
      quantity.contestedExcluded += 1;
    } else if (ok) {
      quantity.countCorrect += 1;
      if (isLossSubset) quantity.lossSubsetCorrect += 1;
    } else {
      quantity.countWrong += 1;
      const referred = line.needs_human === true;
      if (referred) quantity.wrongButReferred += 1;
      else quantity.silentlyWrong += 1;
      quantity.countWrongDetail.push({
        page_line: exp.page_order,
        source_text: exp.source_text,
        as_written: verbatimOf(line),
        leading_mark: line.leading_mark ?? null,
        expected_quantity: exp.expected_quantity,
        got_quantity: line.quantity ?? null,
        in_loss_subset: isLossSubset,
        referred_to_human: referred,
        referral_reasons: line.needs_human_reasons ?? [],
      });
    }

    // IDENTITY.
    if (!exp.identity_established) identity.notGradable += 1;
    else {
      identity.gradable += 1;
      if (isUnknown) identity.unresolvedUnknown += 1;
      else if (!line.identified) identity.noClaim += 1;
      else if (String(line.product_id) === String(exp.expected_product_id)) identity.correct += 1;
      else identity.wrong += 1;
    }
  });

  // ── FAMILY 3: DUPLICATES - three numbers, never one ─────────────────────
  const residualDuplicates = answers.filter(
    (l, ai) => l.product_id !== NOT_A_LINE
      && !fixtureForAnswer.has(ai) && anyReadingForAnswer.has(ai),
  ).length;

  const duplicates = {
    rawObservations: rawObservationCount,
    // A merge is CORRECT when both readings are the same page line, and
    // INCORRECT when they are two different ones. The second is the failure
    // that silently destroys a purchase Warwick asked for - Yazoo strawberry
    // into Yazoo chocolate, Twix ice cream into Twix biscuits, Arla into ASDA -
    // and until now nothing measured it at all.
    reconciledSameLine: 0,
    incorrectCrossLineMerges: 0,
    incorrectCrossLineMergeDetail: [],
    /**
     * WP-B15-34 AC5 - a merge the application made on AGREEING IDENTITY whose
     * merged reading text-matches a different page line. A MISREADING worth
     * reporting; NOT a destroyed purchase. Published separately rather than
     * folded into either bucket, because collapsing it into
     * `reconciledSameLine` would hide a real reading error and leaving it in
     * `incorrectCrossLineMerges` overstates a purchase-destroying failure that
     * did not happen.
     */
    mergesTextAmbiguous: 0,
    mergesTextAmbiguousDetail: [],
    mergesUngradable: 0,
    residualUnreconciledDuplicates: residualDuplicates,
    crossRegionCollisionGroups: (duplicateGroups || []).filter((g) => g.kind === 'cross_region').length,
    sameRegionCollisionGroups: (duplicateGroups || []).filter((g) => g.kind === 'same_region').length,
    measurable: Array.isArray(merges),
    note: Array.isArray(merges)
      ? null
      : 'NOT MEASURED: reconciliation merges were not supplied to the scorer, so correct-versus-incorrect '
        + 'merges could not be graded. This is an absent measurement, NEVER a zero.',
  };

  if (Array.isArray(merges)) {
    for (const m of merges) {
      const a = bestPageLineFor(String(m.kept_as_written ?? ''), expected);
      const b = bestPageLineFor(String(m.merged_as_written ?? ''), expected);

      // ── WP-B15-34 AC5: THE FALSE POSITIVE THIS METRIC SHIPPED WITH ──────
      //
      // `bestPageLineFor` is FUZZY TEXT MATCHING against the fixture, and a
      // MISREADING can resemble a different page line more than it resembles
      // the line it actually came from. Measured on all three WP-B15-33
      // artefacts, the same record was reported every time:
      //
      //   kept   "1 SULTANA&CHERRY CAKE"  -> page 33 "1 SULTARA + CHERRY CAKE"
      //   merged "STRAWBERRY CAKE"        -> page 16 "3 YAZZO STRAWBERRY MiLK SHAKE"
      //
      // "STRAWBERRY CAKE" is a misreading of the cake line. It is not a
      // reading of the milkshake line, and the merge did not destroy a
      // purchase. The scorer was grading a decision the application never
      // made, using evidence the application never used.
      //
      // ⛔ THE GUARD IS IDENTITY, AND IT IS THE APPLICATION'S OWN. Reconciliation
      //    merges only observations whose `product_id` AGREES - the identity
      //    veto, proved by AC7 PROOF 2. So when both sides carry the same
      //    resolved identity, the application had positive evidence they were
      //    one line, and a text disagreement is a MISREADING to report, not a
      //    destroyed purchase to alarm about.
      //
      // ⛔ THIS NARROWS THE METRIC; IT DOES NOT SWITCH IT OFF. A merge whose
      //    two sides resolved to DIFFERENT identities, or where either side
      //    resolved to none, is still graded by text exactly as before - and
      //    that is the shape a genuine purchase-destroying merge has.
      const keptId = m.kept_product_id ?? null;
      const mergedId = m.merged_product_id ?? null;
      const sameResolvedIdentity = keptId !== null && mergedId !== null && keptId === mergedId;

      if (a === null || b === null) {
        duplicates.mergesUngradable += 1;
      } else if (a === b) {
        duplicates.reconciledSameLine += 1;
      } else if (sameResolvedIdentity) {
        duplicates.mergesTextAmbiguous += 1;
        duplicates.mergesTextAmbiguousDetail.push({
          kept_as_written: m.kept_as_written,
          kept_page_line: expected[a].page_order,
          merged_as_written: m.merged_as_written,
          text_matched_page_line: expected[b].page_order,
          product_id: keptId,
          regions: m.regions ?? null,
          note: 'Both observations resolved to the SAME product identity, which is what the application '
            + 'merged on. The merged reading text-matches a different page line, which makes it a MISREADING '
            + 'to report - NOT a merge that destroyed a purchase.',
        });
      } else {
        duplicates.incorrectCrossLineMerges += 1;
        duplicates.incorrectCrossLineMergeDetail.push({
          kept_as_written: m.kept_as_written,
          kept_page_line: expected[a].page_order,
          merged_as_written: m.merged_as_written,
          merged_page_line: expected[b].page_order,
          kept_product_id: keptId,
          merged_product_id: mergedId,
          regions: m.regions ?? null,
        });
      }
    }
  }

  return {
    families: {
      photoCoverage: coverage,
      photoInvention: invention,
      duplicates,
      quantity: {
        ...quantity,
        // ⛔ SILENCE IS ONLY MEASURABLE ONCE EVERY REFERRAL MECHANISM HAS RUN.
        // On an artefact banked before the AC3 gate existed, no line can be
        // withheld and no line can be referred by it - so a "0 silently wrong"
        // read off that run would be measuring the absence of a mechanism, not
        // the presence of correctness. The number is still computed and still
        // published; what travels with it is what it was computed WITHOUT.
        silentlyWrongMeasuredWithGate: gateCounts ? gateCounts.applicable === true : false,
        silentlyWrongNote: (gateCounts && gateCounts.applicable === true)
          ? null
          : 'MEASURED WITHOUT THE AC3 GATE - this run predates `band_position_pct`, so the gate could not '
            + 'refer anything and this figure reflects the AC1/AC2 referral causes only. It is a real number '
            + 'about this run; it is NOT evidence about the gate.',
        preserved: rate(quantity.countPreserved, quantity.detectedWherePageCarriesCount),
        correct: rate(quantity.countCorrect, quantity.countCorrect + quantity.countWrong),
        // ── WP-B15-34 AC5: THE DENOMINATOR THAT COVERS ALL 39 ──────────────
        // Warwick: "Do not use a denominator that can pass while an over-count
        // such as '1 x 6pts' -> 7 survives."
        //
        // WP-B15-33 already moved CORRECTNESS off the 12-line subset, which
        // closed the over-count hole. It left a SECOND one, of the same shape:
        // `correct` is graded over DETECTED lines, so a line the run never
        // detected is in no denominator at all - and a run that read 20 of 39
        // could report 100% quantity correctness while losing nineteen
        // purchases. An omission is not a neutral event; the household does
        // not get the item.
        //
        // `correctOfAllExpected` therefore grades over EVERY page line: an
        // omitted line counts as not-correct, because that is what it is.
        // Both figures are published. Neither replaces the other - `correct`
        // answers "when it read a line, did it get the count right?", this one
        // answers "did Warwick end up with the right shopping list?".
        correctOfAllExpected: rate(quantity.countCorrect, expected.length),
        expectedPageLines: expected.length,
        lossSubset: rate(quantity.lossSubsetCorrect, quantity.lossSubsetTotal),
        preservedVsCorrectNote:
          'PRESERVED is AVAILABILITY - a count reached the application. CORRECT is whether it was the RIGHT '
          + 'count. They are different questions and the first is blind to a misread digit. Never quote one as '
          + 'the other.',
        denominatorNote:
          'CORRECTNESS is graded over all detected count-bearing page lines (39 of 39 carry a written count). '
          + 'The 12-line loss subset is the ONLY population where a LOST count is distinguishable from a read '
          + 'one, and it is the right denominator for LOSS ONLY. Quoting the 12 as the correctness denominator '
          + 'excludes the over-counting class entirely - page 19 (1 read as 2) and page 2 (1 read as 7) both '
          + 'sit outside it, and both spend real money. '
          + 'CORRECT-OF-ALL-EXPECTED grades over every page line, so an OMITTED line counts as not-correct '
          + 'and no run can reach a high correctness figure by detecting less.',
      },
      identity: {
        ...identity,
        correctRate: rate(identity.correct, identity.gradable),
        denominatorNote: 'DETECTED lines with an ESTABLISHED catalogue identity - never 39',
      },
      visualEvidenceGate: gateCounts ?? { note: 'NOT RUN on this scoring pass.' },
    },
    familiesLimits: [
      'These five families grade the FINAL lines - after reconciliation and after the AC3 visual-evidence '
      + 'gate. They do not describe any earlier state of the pipeline.',
      'The reading-to-page-line join is a text similarity between two READINGS of the same handwriting. It '
      + 'mis-assigns when more observations exist than page lines: in variance run 1 a strawberry reading was '
      + 'assigned to the chocolate page line because the strawberry line was already claimed, producing a '
      + 'quantity error that is a JOIN ARTEFACT and not a product defect.',
      'Identity is graded only where the fixture established a catalogue identity (36 of 39).',
      'The fixture inherits the committed 39-line list, whose own provenance is unrecorded, and page 8 '
      + '(Richmond) is CONTESTED on both quantity and identity - excluded from correctness and counted separately.',
      'SILENTLY WRONG is the figure Warwick\'s bar asks for. A wrong count that was referred to a human is '
      + 'NOT silently wrong, and is a success by that bar - but it is still a wrong reading, and this scorer '
      + 'never presents a referral as a correct answer.',
    ],
  };
}

/** The five families, printed with every denominator attached. */
export function formatFamilies(score, label) {
  const f = score.families;
  const r = (x) => (x.pct === null ? `${x.n}/${x.d}` : `${x.n}/${x.d} (${x.pct}%)`);
  return [
    `  ${label} - THE FIVE METRIC FAMILIES (WP-B15-33 AC4)`,
    '  1. PHOTO COVERAGE',
    `       expected page lines .... ${f.photoCoverage.expectedPageLines}`,
    `       detected .............. ${r(f.photoCoverage.detected)}`,
    `       omitted ............... ${r(f.photoCoverage.omitted)}`,
    '  2. PHOTO INVENTION',
    `       catalogue-valid but UNSUPPORTED ... ${f.photoInvention.catalogueValidButUnsupported}`,
    `         of which still holding PHOTO .... ${f.photoInvention.unsupportedStillHoldingPhoto}`,
    `         of which withheld by the gate ... ${f.photoInvention.unsupportedWithheldByGate}`,
    `       arbitrary out-of-set invention .... ${f.photoInvention.arbitraryOutOfSet}  [${f.photoInvention.arbitraryOutOfSetNote}]`,
    '  3. DUPLICATES',
    `       raw observations before reconciliation ... ${f.duplicates.rawObservations ?? 'not supplied'}`,
    `       correctly reconciled same-line .......... ${f.duplicates.reconciledSameLine}`,
    `       INCORRECT CROSS-LINE MERGES ............. ${f.duplicates.incorrectCrossLineMerges}${f.duplicates.measurable ? '' : '  [' + f.duplicates.note + ']'}`,
    `       merges on agreeing identity, text ambiguous  ${f.duplicates.mergesTextAmbiguous}  [a MISREADING to report, NOT a destroyed purchase]`,
    `       merges ungradable against the fixture ... ${f.duplicates.mergesUngradable}`,
    `       residual unreconciled duplicates ........ ${f.duplicates.residualUnreconciledDuplicates}`,
    '  4. QUANTITY',
    `       page lines carrying a written count ..... ${f.quantity.pageLinesCarryingWrittenCount}/${f.photoCoverage.expectedPageLines}`,
    `       explicit counts PRESERVED (availability)  ${r(f.quantity.preserved)}`,
    `       explicit counts CORRECT .................. ${r(f.quantity.correct)}`,
    `       wrong: SILENTLY wrong .................... ${f.quantity.silentlyWrong}   <- Warwick's bar. Target 0.`,
    `       wrong: referred to a human ............... ${f.quantity.wrongButReferred}   (a SUCCESS by that bar)`,
    `       correct over ALL ${String(f.quantity.expectedPageLines).padStart(2)} page lines ......... ${r(f.quantity.correctOfAllExpected)}   (an OMITTED line counts as not-correct)`,
    `       12-line LOSS subset correct .............. ${r(f.quantity.lossSubset)}   (loss only - NOT the correctness denominator)`,
    `       household default-one lines .............. ${f.quantity.defaultOneLines}`,
    `       pack digits ignored as quantity .......... ${f.quantity.packDigitsIgnoredAsQuantity}`,
    `       contested page lines excluded ............ ${f.quantity.contestedExcluded}`,
    '  5. IDENTITY',
    `       correct ............... ${r(f.identity.correctRate)}  (${f.identity.denominatorNote})`,
    `       wrong ................. ${f.identity.wrong}`,
    `       unresolved / UNKNOWN .. ${f.identity.unresolvedUnknown}`,
    `       no identity claim ..... ${f.identity.noClaim}`,
    `       not gradable .......... ${f.identity.notGradable}`,
    '  AC3 VISUAL-EVIDENCE GATE',
    f.visualEvidenceGate.applicable === false
      ? `       NOT APPLICABLE TO THIS RUN - ${f.visualEvidenceGate.applicabilityNote}`
      : `       PHOTO ${f.visualEvidenceGate.photo ?? '-'} | WITHHELD ${f.visualEvidenceGate.withheld ?? '-'} `
        + `(no position ${f.visualEvidenceGate.withheldNoPosition ?? '-'}, position collision ${f.visualEvidenceGate.withheldPositionCollision ?? '-'})`,
    `       position available ${f.visualEvidenceGate.positionAvailable ?? '-'}/${f.visualEvidenceGate.total ?? '-'} | bands over geometric budget ${f.visualEvidenceGate.bandsOverBudget ?? '-'} (REPORTED, not enforced)`,
    ...(f.quantity.silentlyWrongNote ? [`  ⚠ ${f.quantity.silentlyWrongNote}`] : []),
  ].join('\n');
}

export const TWO_LAYER_LIMITS = Object.freeze([
  'LAYER A visible-text/interpretation accuracy is NOT INDEPENDENTLY GRADED. The fixture\'s source_text '
  + 'column was transcribed from the photograph by a model, so that sub-metric compares one model reading '
  + 'with another. Detection, omission, invention, duplicate and identity counts do NOT depend on it.',
  'LAYER B grades only the lines whose intended catalogue identity was ESTABLISHED (36 of 39). The other '
  + 'three name products the 109-item household catalogue does not carry, so no answer can be graded right '
  + 'or wrong there; they are reported separately and excluded from B\'s denominator.',
  'The fixture inherits the committed 39-line list, whose own provenance is unrecorded. One line (page 8, '
  + 'Richmond) is CONTESTED on both quantity and identity and is reported rather than resolved.',
  'The join between a model reading and a page line is still a text similarity - but between two readings '
  + 'of the same handwriting, not between a reading and a catalogue name. A shorthand sharing no token '
  + 'with the transcription still scores as a miss.',
]);

/**
 * Read the AC3 fixture.
 * @param {string} fixturePath
 */
export function loadFixture(fixturePath) {
  if (!fixturePath) throw new Error('loadFixture: a fixture path is required');
  if (!fs.existsSync(fixturePath)) throw new Error(`loadFixture: fixture not found at ${fixturePath}`);
  const parsed = JSON.parse(fs.readFileSync(fixturePath, 'utf8'));
  if (!Array.isArray(parsed?.lines) || parsed.lines.length === 0) {
    throw new Error('loadFixture: the fixture must carry a non-empty `lines` array');
  }
  return parsed;
}

/**
 * Score one run's grounded output in TWO layers against the AC3 fixture.
 *
 * @param {object} args
 * @param {Array<object>} args.accepted - groundLines()' accepted lines.
 * @param {Array<object>} [args.rejected]
 * @param {Array<object>} [args.duplicateGroups]
 * @param {object} args.fixture - loadFixture()'s result.
 * @returns {object} `{ layerA, layerB, details, limits }`
 */
export function scoreTwoLayer({
  accepted, rejected = [], duplicateGroups = [], fixture,
} = {}) {
  if (!fixture?.lines?.length) throw new Error('scoreTwoLayer: fixture is required');
  const expected = fixture.lines;
  const answers = Array.isArray(accepted) ? accepted : [];

  // ── THE JOIN: reading against reading, strongest pair first, one-to-one ──
  const readingPairs = [];
  const identityPairs = [];
  answers.forEach((line, ai) => {
    const written = verbatimOf(line);
    expected.forEach((exp, ei) => {
      const byReading = similarity(exp.source_text, written);
      if (byReading >= MATCH_FLOOR) readingPairs.push({ ai, ei, byReading });
      // An identity-only correspondence is NOT a detection. It is recorded so
      // that "a supplied candidate became a PHOTO line with no image evidence"
      // stays distinguishable from free invention.
      if (line.identified && exp.expected_product_id
        && String(line.product_id) === String(exp.expected_product_id)) {
        identityPairs.push({ ai, ei });
      }
    });
  });
  readingPairs.sort((p, q) => q.byReading - p.byReading || p.ai - q.ai || p.ei - q.ei);

  const fixtureForAnswer = new Map();
  const claimed = new Set();
  for (const p of readingPairs) {
    if (fixtureForAnswer.has(p.ai) || claimed.has(p.ei)) continue;
    fixtureForAnswer.set(p.ai, p.ei);
    claimed.add(p.ei);
  }
  // An answer whose entry was already claimed still read something real: that
  // is a DUPLICATE, not an invention.
  const anyReadingForAnswer = new Map();
  for (const p of readingPairs) if (!anyReadingForAnswer.has(p.ai)) anyReadingForAnswer.set(p.ai, p.ei);
  const identityOnlyForAnswer = new Map();
  for (const p of identityPairs) if (!identityOnlyForAnswer.has(p.ai)) identityOnlyForAnswer.set(p.ai, p.ei);

  const details = [];
  const A = {
    expected: expected.length,
    detected: 0,
    omitted: 0,
    invented: 0,
    inventedFromSuppliedCandidate: 0,
    inventedFreeGeneration: 0,
    duplicates: 0,
    quantityErrors: 0,
    // ── AC3(b): a CONTESTED page line is excluded from quantityErrors and
    //    the exclusion is PRINTED BESIDE the number, never folded into it ──
    // Fixture line 8 reads "16 Richmond SKiNLESS PORK SAUSAGES" while its
    // expected_quantity is 1 per Warwick's pack-size ruling. A PERFECT reading
    // therefore yields 16 against an expected 1 - a permanent graded error no
    // amount of AC1 work can remove. Counting it forever would train everyone
    // to discount the metric; hiding it would be dishonest. So it is excluded
    // AND named.
    quantityErrorsContestedExcluded: 0,
    // ── AC1: THE METRIC THAT MEASURES THE FAULT ITSELF ──────────────────
    // `quantityErrors` measures only the OVERLAP between a lost leading count
    // and a true count that is not 1: where the true count IS 1, the household
    // default supplies the same answer and the loss is invisible. Measured on
    // Arm D, that hid roughly two thirds of the fault - 39 of 39 page lines
    // carry a written count, and only 38.8% of readings preserved one.
    // This pair is the direct measurement, and it belongs in the instrument
    // rather than in one report nobody will find again.
    detectedWherePageCarriesCount: 0,
    leadingCountPreserved: 0,
    explicitUnknownOnRealLine: 0,
    notALineDeclared: 0,
    visibleTextExact: 0,
    visibleTextDivergent: 0,
  };
  const B = {
    gradableDetected: 0,
    correctIdentity: 0,
    wrongIdentity: 0,
    unresolvedUnknown: 0,
    noIdentityClaim: 0,
    notGradable: 0,
  };

  answers.forEach((line, ai) => {
    const written = verbatimOf(line);
    const ei = fixtureForAnswer.get(ai);
    const exp = ei === undefined ? null : expected[ei];
    const isUnknown = line.product_id === UNKNOWN_VISIBLE_ITEM;
    const isNotALine = line.product_id === NOT_A_LINE;

    if (isNotALine) {
      A.notALineDeclared += 1;
      details.push({ as_written: written, verdict: 'DECLARED_NOT_A_LINE' });
      return;
    }

    if (!exp) {
      if (anyReadingForAnswer.has(ai)) {
        A.duplicates += 1;
        details.push({
          as_written: written,
          verdict: 'DUPLICATE',
          page_line: expected[anyReadingForAnswer.get(ai)].page_order,
        });
        return;
      }
      // An explicit UNKNOWN claims no identity, so it can never be an
      // invention - but it read something nothing on the page corresponds to.
      if (isUnknown) {
        A.invented += 1;
        A.inventedFreeGeneration += 1;
        details.push({ as_written: written, verdict: 'INVENTED', mechanism: 'unmatched-reading-declared-unknown' });
        return;
      }
      A.invented += 1;
      if (identityOnlyForAnswer.has(ai)) {
        A.inventedFromSuppliedCandidate += 1;
        details.push({
          as_written: written,
          verdict: 'INVENTED',
          mechanism: 'supplied-candidate-no-image-evidence',
          named: expected[identityOnlyForAnswer.get(ai)].catalogue_product,
        });
      } else {
        A.inventedFreeGeneration += 1;
        details.push({ as_written: written, verdict: 'INVENTED', mechanism: 'free-generation', named: line.product_id });
      }
      return;
    }

    // ── DETECTED ────────────────────────────────────────────────────────
    A.detected += 1;
    const exact = similarity(exp.source_text, written) >= 0.95;
    if (exact) A.visibleTextExact += 1; else A.visibleTextDivergent += 1;

    // AC1 - was the count the page actually carries still available to the
    // application? Evidence is the dedicated `leading_mark` field, or a
    // reading that still begins with a digit (the pre-WP-B15-31 route).
    if (/^\s*\d/.test(String(exp.source_text || ''))) {
      A.detectedWherePageCarriesCount += 1;
      const markPreserved = typeof line.leading_mark === 'string' && line.leading_mark.trim() !== '';
      if (markPreserved || /^\s*\d/.test(written)) A.leadingCountPreserved += 1;
    }

    const quantityOk = quantityAgreesUnderDefaultOne(exp.expected_quantity, line.quantity ?? null);
    // AC3(b): contested lines are excluded from the headline and counted
    // separately. Warwick's ruling and the page text genuinely disagree here;
    // that is a product question, not a defect in this run.
    if (!quantityOk) {
      if (exp.contested) A.quantityErrorsContestedExcluded += 1;
      else A.quantityErrors += 1;
    }

    let identityVerdict;
    if (!exp.identity_established) {
      B.notGradable += 1;
      identityVerdict = 'NOT_GRADABLE';
    } else if (isUnknown) {
      B.gradableDetected += 1;
      B.unresolvedUnknown += 1;
      A.explicitUnknownOnRealLine += 1;
      identityVerdict = 'UNRESOLVED_UNKNOWN';
    } else if (!line.identified) {
      B.gradableDetected += 1;
      B.noIdentityClaim += 1;
      identityVerdict = 'NO_IDENTITY_CLAIM';
    } else if (String(line.product_id) === String(exp.expected_product_id)) {
      B.gradableDetected += 1;
      B.correctIdentity += 1;
      identityVerdict = 'CORRECT_IDENTITY';
    } else {
      B.gradableDetected += 1;
      B.wrongIdentity += 1;
      identityVerdict = 'WRONG_IDENTITY';
    }

    details.push({
      as_written: written,
      page_line: exp.page_order,
      source_text: exp.source_text,
      verdict: 'DETECTED',
      identity: identityVerdict,
      expected_product: exp.catalogue_product,
      named_product_id: line.product_id ?? null,
      expected_quantity: exp.expected_quantity,
      got_quantity: line.quantity ?? null,
      quantity_ok: quantityOk,
      ...(exp.contested ? { contested: true } : {}),
    });
  });

  A.omitted = A.expected - A.detected;
  const omittedLines = expected.filter((_, ei) => !claimed.has(ei));

  const rejectedByReason = {};
  for (const r of rejected) for (const reason of r.reasons) rejectedByReason[reason] = (rejectedByReason[reason] || 0) + 1;

  const pct = (n, d) => (d > 0 ? Number(((n / d) * 100).toFixed(1)) : null);

  return {
    layerA: {
      ...A,
      detectedPct: pct(A.detected, A.expected),
      omittedPct: pct(A.omitted, A.expected),
      // AC1 - the direct measurement of the leading-count fault. Quote this
      // BESIDE quantityErrors, never instead of it: the error count is the
      // subset that happened to be visible, this is the fault itself.
      sourceLinesWithWrittenCount: expected.filter((e) => /^\s*\d/.test(String(e.source_text || ''))).length,
      leadingCountPreservationPct: pct(A.leadingCountPreserved, A.detectedWherePageCarriesCount),
      quantityErrorsNote: A.quantityErrorsContestedExcluded > 0
        ? `${A.quantityErrors} quantity error(s); ${A.quantityErrorsContestedExcluded} CONTESTED page line(s) excluded (page text and the pack-size ruling genuinely disagree - see fixture contested_lines)`
        : `${A.quantityErrors} quantity error(s); 0 contested lines excluded`,
      // Reported, and explicitly labelled, so it can never be quoted bare.
      visibleTextAccuracyPct: pct(A.visibleTextExact, A.detected),
      visibleTextGrading: 'NOT INDEPENDENTLY GRADED - the fixture transcription is non-independent',
    },
    layerB: {
      ...B,
      correctIdentityPct: pct(B.correctIdentity, B.gradableDetected),
      denominatorNote: 'DETECTED lines with an ESTABLISHED catalogue identity - never 39',
    },
    omittedPageLines: omittedLines.map((e) => ({ page_order: e.page_order, source_text: e.source_text })),
    duplicateGroups,
    rejectedByReason,
    details,
    limits: TWO_LAYER_LIMITS,
  };
}

/** Two clearly separated blocks. There is deliberately no combined figure. */
export function formatTwoLayer(score, label) {
  const a = score.layerA;
  const b = score.layerB;
  return [
    `  ${label}`,
    '  LAYER A - PHOTO / SOURCE-TRUTH QUALITY (did we see what is on the page?)',
    `    expected page lines ....... ${a.expected}`,
    `    detected .................. ${a.detected} (${a.detectedPct}%)`,
    `    omitted ................... ${a.omitted} (${a.omittedPct}%)`,
    `    invented PHOTO lines ...... ${a.invented}  (supplied-candidate ${a.inventedFromSuppliedCandidate}, free ${a.inventedFreeGeneration})`,
    `    duplicates ................ ${a.duplicates}`,
    `    explicit quantity errors .. ${a.quantityErrors}   [${a.quantityErrorsNote}]`,
    `    leading count preserved ... ${a.leadingCountPreserved}/${a.detectedWherePageCarriesCount} (${a.leadingCountPreservationPct}%) of detected lines whose page text carries a count`,
    `      ^ THE FAULT ITSELF. The error count above is only the subset where the true count was NOT 1;`,
    `        where it IS 1 the household default hides the loss. ${a.sourceLinesWithWrittenCount}/${a.expected} page lines carry a written count.`,
    `    UNKNOWN on a real line .... ${a.explicitUnknownOnRealLine}  (a correct, cheap outcome)`,
    `    declared NOT_A_LINE ....... ${a.notALineDeclared}`,
    `    visible-text exact ........ ${a.visibleTextExact}/${a.detected} (${a.visibleTextAccuracyPct}%) - ${a.visibleTextGrading}`,
    '  LAYER B - IDENTITY RESOLUTION QUALITY (of what we saw, did we name it?)',
    `    gradable detected lines ... ${b.gradableDetected}  (${b.denominatorNote})`,
    `    correct identity .......... ${b.correctIdentity} (${b.correctIdentityPct}%)`,
    `    wrong identity ............ ${b.wrongIdentity}`,
    `    unresolved / UNKNOWN ...... ${b.unresolvedUnknown}`,
    `    no identity claim ......... ${b.noIdentityClaim}`,
    `    not gradable (no catalogue identity established) ... ${b.notGradable}`,
  ].join('\n');
}
