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

    const quantityOk = quantityAgreesUnderDefaultOne(exp.expected_quantity, line.quantity ?? null);
    if (!quantityOk) A.quantityErrors += 1;

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
    `    explicit quantity errors .. ${a.quantityErrors}`,
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
