// =====================================================================
// BUILD-015 AsdAIr - agenticVisionPrototype/sevenWayScore.js
//
// WO-2026-08-12-01-v2 (WP-B15-29), AC9: the seven-category scorer, built
// HERE rather than by extending `services/asdair/pipeline/abAcceptanceHarness.js`.
//
// WHY NOT THAT FILE (recorded so nobody "tidies" this into a duplicate):
// it sits outside this Work Order's surface, it is a legacy A/B instrument
// for the pre-agentic bundled/individual strategies, it parses its ground
// truth out of MARKDOWN while the truth is now JSON, and its fuzzy name
// matching cannot express identity against a closed ID enum. It also still
// hardcodes the forbidden 41-line trolley denominator at its `:69`
// `GROUND_TRUTH_PATH` - REPORTED, deliberately not fixed here; Larry owns
// that follow-up.
//
// ── THE SEVEN CATEGORIES ────────────────────────────────────────────────
//   correct           - a real line, right identity, right quantity
//   omitted           - a ground-truth line nothing in the answer covers
//   invented          - an identity asserted with nothing on the page behind it
//   wrongIdentity     - a real line read, then named as a DIFFERENT real product
//   wrongQuantity     - right product, wrong number
//   explicitUnknown   - an honest UNKNOWN_VISIBLE_ITEM (Warwick's cheap failure)
//   duplicates        - the same physical line reported more than once
//
// `explicitUnknown` is deliberately NOT the same measure as "low confidence".
// Warwick's bar counts them differently and so does this file: an explicit
// declared unknown is a SUCCESSFUL outcome of the existence/resolution split,
// while a low-confidence guess is still a guess. They are reported separately
// and never summed.
//
// ── THE LIMIT THAT MUST BE PRINTED BESIDE THE NUMBER ────────────────────
// The 39-line ground truth carries `{product, qty}` and NO product IDs. So
// "wrong identity" cannot be decided by comparing IDs to IDs. It is decided
// by resolving the chosen `product_id` to its catalogue name and aliases and
// then TEXT-MATCHING that against the ground-truth product string - i.e. the
// last step of every identity judgement in this table is a text-similarity
// join, not an identity comparison. A near-miss in that join can move a line
// between `correct`, `wrongIdentity` and `invented`.
//
// This is not a defect to fix by tightening the matcher until the number
// improves; it is a property of grading against a list that has no IDs. Every
// report this module produces carries `limits` for that reason, and the
// scorer must never be quoted as though the table were ID-level truth.
//
// PURE. No I/O except an explicit ground-truth file read.
// =====================================================================

'use strict';

import fs from 'node:fs';
import { UNKNOWN_VISIBLE_ITEM, NOT_A_LINE } from './lineSchema.js';
import { verbatimOf } from './groundLines.js';

export const SCORER_LIMITS = Object.freeze([
  'The 39-line ground truth carries {product, qty} and no product IDs, so every identity verdict '
  + 'ends in a text-similarity join between the chosen candidate\'s catalogue name/aliases and the '
  + 'ground-truth product string. This table is NOT ID-level truth.',
  'The ground-truth list\'s own provenance is unrecorded (see the committed ground-truth document). '
  + 'It grades RELATIVE MOVEMENT between runs; it cannot by itself declare an absolute pass.',
  'Matching is token-overlap plus containment. Handwritten shorthand that shares no token with the '
  + 'catalogue name (an alias nobody recorded) scores as a miss even when a human would call it right.',
]);

/** Lowercase, strip punctuation, collapse whitespace. */
export function normalise(text) {
  return String(text || '').toLowerCase().replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim();
}

const STOP_TOKENS = new Set(['the', 'a', 'of', 'and', 'x', 'pk', 'pack', 'packs', 'ml', 'l', 'g', 'kg']);

function contentTokens(text) {
  return normalise(text).split(' ').filter((t) => t !== '' && !STOP_TOKENS.has(t) && !/^\d+$/.test(t));
}

/** True when two product strings agree at or above the match floor. */
export function fuzzyMatches(a, b) {
  return similarity(a, b) >= MATCH_FLOOR;
}

/**
 * How strongly two product strings agree, 0..1.
 *
 * ── WHY THIS IS NOT A BARE `includes` OR A SINGLE SHARED TOKEN ──────────
 * Corrected ONCE, after Arm A's first scoring pass, because the simpler rule
 * was measurably WRONG rather than merely coarse. A single shared four-letter
 * token made "1 pkt ASDA meatballs", "2 pkts ASDA hayfever tabs" and "2 pkts
 * ASDA paracetamol" all match the SAME first ground-truth entry containing
 * "asda". First-match-wins then let one line claim an entry that belonged to
 * another, so the same defect inflated `omitted` AND `wrongQuantity`
 * simultaneously - three real, correctly-read lines scored as omissions.
 *
 * A brand token is the weakest possible evidence of identity in a household
 * catalogue where one brand covers dozens of products, so overlap is measured
 * as a PROPORTION of the smaller token set rather than as any single hit.
 */
/** Levenshtein distance. Small strings only - this is token-sized work. */
export function editDistance(a, b) {
  if (a === b) return 0;
  const m = a.length;
  const n = b.length;
  if (m === 0) return n;
  if (n === 0) return m;
  let prev = Array.from({ length: n + 1 }, (_, j) => j);
  for (let i = 1; i <= m; i += 1) {
    const cur = [i];
    for (let j = 1; j <= n; j += 1) {
      cur[j] = Math.min(
        prev[j] + 1,
        cur[j - 1] + 1,
        prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1),
      );
    }
    prev = cur;
  }
  return prev[n];
}

/**
 * ── WP-B15-30: TWO TOKENS THAT ARE THE SAME WORD, SPELLED DIFFERENTLY ────
 *
 * Measured, not theorised. In the Arm D run the model read "SUPERGLUE" where
 * the page transcription says "SUPERGLU", and "FEBREEZE ... SPRAY" where it
 * says "FERBREEZE ... SPAY". Exact token equality scored both as sharing NO
 * token at all, so each counted as an OMISSION and an INVENTION
 * simultaneously - the same double-charging Warwick identified in WP-B15-29,
 * in a different place.
 *
 * The bound is deliberately TIGHT and length-relative: one edit for a short
 * token, two for a long one. It absorbs a transcription variant of the same
 * word; it does not make different products match. A mutation guard in the
 * test file asserts that - loosen this and that test fails.
 */
export function tokensEquivalent(a, b) {
  if (a === b) return true;
  const shorter = Math.min(a.length, b.length);
  if (shorter < 4) return false; // too short to tell a typo from a different word
  const allowed = shorter >= 7 ? 2 : 1;
  return editDistance(a, b) <= allowed;
}

export function similarity(a, b) {
  const na = normalise(a);
  const nb = normalise(b);
  if (na === '' || nb === '') return 0;
  if (na === nb) return 1;
  if (na.includes(nb) || nb.includes(na)) return 0.95;
  const ta = contentTokens(a);
  const tb = contentTokens(b);
  if (ta.length === 0 || tb.length === 0) return 0;
  // Each token of `tb` may claim at most ONE token of `ta`, so a repeated word
  // cannot inflate the overlap.
  const remaining = [...ta];
  let shared = 0;
  for (const t of tb) {
    const at = remaining.findIndex((r) => tokensEquivalent(r, t));
    if (at !== -1) { shared += 1; remaining.splice(at, 1); }
  }
  if (shared === 0) return 0;
  return shared / Math.min(ta.length, tb.length);
}

/** Below this proportion of shared distinguishing tokens, it is not a match. */
export const MATCH_FLOOR = 0.5;

/**
 * ── WO-2026-08-12-02 (WP-B15-30), AC2: STOP MARKING CORRECT BEHAVIOUR WRONG ─
 *
 * Warwick, on the WP-B15-29 result: the scorer was "materially noisy", and
 * SIX of its NINE `wrongQuantity` verdicts penalised the model for returning
 * `null` on a line the page carries no count for - which is exactly what the
 * prompt contract, the sanity checks and the Work Order all REQUIRED it to do.
 * A measurement that punishes compliance is worse than no measurement: it
 * pushes the next round to "fix" behaviour that was already right.
 *
 * The rule: where the household default-one rule supplies the answer, an
 * absent quantity and an explicit 1 are THE SAME ANSWER. Everywhere else the
 * comparison is unchanged and just as strict as before - a wrong number is
 * still wrong, and `null` against an expected 4 is still wrong.
 *
 * This is belt-and-braces, not the primary mechanism. quantityRule.js now
 * resolves an absent quantity to 1 BEFORE scoring, so a freshly grounded line
 * should never reach here with `null`. This tolerance is what lets an artefact
 * banked BEFORE that rule existed - the WP-B15-29 Arm A and Arm B runs - be
 * re-scored like for like on the corrected instrument.
 *
 * @param {number|null} expected - the fixture's quantity for the line.
 * @param {number|null} got - the quantity the application believes.
 * @returns {boolean}
 */
export function quantityAgreesUnderDefaultOne(expected, got) {
  if (expected === null && got === null) return true;
  // AC2, both directions: the default-one rule makes these the same answer.
  if (got === null && Number(expected) === 1) return true;
  if (expected === null && Number(got) === 1) return true;
  if (expected === null || got === null) return false;
  return Number(expected) === Number(got);
}

/**
 * Read the committed 39-line ground truth: a JSON array of `{product, qty}`.
 * @param {string} groundTruthPath
 * @returns {Array<{product:string, qty:number|null}>}
 */
export function loadGroundTruth(groundTruthPath) {
  if (!groundTruthPath) throw new Error('loadGroundTruth: a ground-truth path is required');
  if (!fs.existsSync(groundTruthPath)) {
    throw new Error(`loadGroundTruth: ground-truth file not found at ${groundTruthPath}`);
  }
  const parsed = JSON.parse(fs.readFileSync(groundTruthPath, 'utf8'));
  if (!Array.isArray(parsed) || parsed.length === 0) {
    throw new Error('loadGroundTruth: expected a non-empty JSON array of {product, qty}');
  }
  for (const entry of parsed) {
    if (!entry || typeof entry.product !== 'string') {
      throw new Error('loadGroundTruth: every entry needs a string `product`');
    }
  }
  return parsed;
}

/**
 * The searchable text for a chosen candidate: its catalogue name plus every
 * recorded alias. Falls back to the raw id when the catalogue has no entry,
 * which is itself reportable rather than silently treated as a match.
 */
function candidateText(productId, catalogueById) {
  if (!catalogueById) return null;
  const entry = catalogueById.get(String(productId));
  if (!entry) return null;
  const aliases = Array.isArray(entry.aliases) ? entry.aliases : [];
  return [entry.name, ...aliases].filter(Boolean).join(' | ');
}

/**
 * Score one arm's grounded output against the ground truth.
 *
 * @param {object} args
 * @param {Array<object>} args.accepted - groundLines()' accepted lines.
 * @param {Array<object>} [args.rejected] - groundLines()' rejected lines.
 * @param {Array<object>} [args.duplicateGroups]
 * @param {Array<{product:string, qty:number|null}>} args.groundTruth
 * @param {Map<string, {name:string, aliases?:string[]}>} [args.catalogueById]
 * @returns {object} the seven categories, per-line detail, and the limits.
 */
export function scoreSevenWay({
  accepted, rejected = [], duplicateGroups = [], groundTruth, catalogueById = null, identityMode = 'enum',
} = {}) {
  if (!Array.isArray(groundTruth) || groundTruth.length === 0) {
    throw new Error('scoreSevenWay: groundTruth is required');
  }
  const lines = Array.isArray(accepted) ? accepted : [];
  const covered = new Set();
  const details = [];

  // ── ONE-TO-ONE ASSIGNMENT, not first-match-wins ────────────────────────
  // A ground-truth entry can be claimed by ONE line. Pairs are scored, sorted
  // by strength, and assigned greedily, so a weak brand-token pair can never
  // steal an entry from the line that actually reads it. Order-independent by
  // construction: the same set of lines produces the same assignment however
  // the model happened to order them.
  const identityTextOf = (line) => {
    const written = verbatimOf(line);
    if (identityMode === 'verbatim') return written;
    const idText = line.identified ? candidateText(line.product_id, catalogueById) : null;
    return idText ?? (line.identified ? String(line.product_id) : null);
  };

  // THE READING ANCHORS THE TRUTH; the identity claim is graded AGAINST it,
  // never the other way round. Assigning by whichever signal scored higher let
  // a strong identity match silently override a weaker reading - so "read
  // Marmite, named Weetabix" scored CORRECT against Weetabix, which is exactly
  // the confusion `wrongIdentity` exists to expose.
  const textPairs = [];
  const idPairs = [];
  lines.forEach((line, li) => {
    const written = verbatimOf(line);
    const identity = identityTextOf(line);
    groundTruth.forEach((g, gi) => {
      const byText = similarity(g.product, written);
      const byId = identity ? similarity(g.product, identity) : 0;
      if (byText >= MATCH_FLOOR) textPairs.push({ li, gi, byText, byId });
      if (byId >= MATCH_FLOOR) idPairs.push({ li, gi, byText, byId });
    });
  });
  const byStrength = (key) => (p, q) => q[key] - p[key] || p.li - q.li || p.gi - q.gi;
  textPairs.sort(byStrength('byText'));
  idPairs.sort(byStrength('byId'));

  const truthForLine = new Map();
  const claimedTruth = new Set();
  const assignedVia = new Map();
  for (const p of textPairs) {
    if (truthForLine.has(p.li) || claimedTruth.has(p.gi)) continue;
    truthForLine.set(p.li, p);
    claimedTruth.add(p.gi);
    assignedVia.set(p.li, 'reading');
  }
  // SECOND PASS - a line whose READING matched nothing, but whose NAMED
  // candidate matches a real product. That is not a correct read: it is the
  // signature of AC11 mechanism (a), a supplied candidate becoming a PHOTO
  // line with no image evidence behind it.
  for (const p of idPairs) {
    if (truthForLine.has(p.li) || claimedTruth.has(p.gi)) continue;
    truthForLine.set(p.li, p);
    claimedTruth.add(p.gi);
    assignedVia.set(p.li, 'identity-only');
  }
  // A line whose entry was already claimed still needs to know whether it read
  // something real - otherwise a genuine duplicate would score as an invention.
  const bestTextForLine = new Map();
  for (const p of textPairs) if (!bestTextForLine.has(p.li)) bestTextForLine.set(p.li, p);

  let correct = 0;
  let invented = 0;
  let wrongIdentity = 0;
  let wrongQuantity = 0;
  let explicitUnknown = 0;
  let inventedFromCandidate = 0;   // AC11 (a) - a supplied candidate with no image evidence
  let inventedFreeGeneration = 0;  // AC11 (b) - a name generated from nothing

  // IDENTITY MODE - the two arms make identity claims in different ways and
  // grading them the same way would be a measurement error, not strictness.
  //
  //   'enum'     (Arm B) the claim is a catalogue id, resolved to its name
  //              and aliases. A claim SEPARATE from the reading exists, so
  //              "read X, named Y" is detectable and is `wrongIdentity`.
  //   'verbatim' (Arm A) the loop emits no id at all: its only identity claim
  //              IS the verbatim text. There is no second signal to disagree
  //              with the first, so `wrongIdentity` is structurally
  //              UNMEASURABLE in this arm - reported as such, never as 0,
  //              because a zero would read as "no wrong identities happened".
  lines.forEach((line, li) => {
    const written = verbatimOf(line);
    const identityText = identityTextOf(line);
    const assigned = truthForLine.get(li) ?? null;
    const anyMatch = bestTextForLine.get(li) ?? null;
    const truth = assigned ? groundTruth[assigned.gi] : null;
    const via = assignedVia.get(li) ?? null;
    const readSomethingReal = anyMatch !== null;

    if (truth && via === 'reading') covered.add(truth.product);

    // An explicit UNKNOWN claims no identity. It can never be an invention.
    if (line.product_id === UNKNOWN_VISIBLE_ITEM || line.product_id === NOT_A_LINE) {
      explicitUnknown += 1;
      details.push({ line_no: line.line_no, as_written: written, verdict: 'EXPLICIT_UNKNOWN', truth: truth?.product ?? null });
      return;
    }

    if (!truth) {
      if (readSomethingReal) {
        // The verbatim reading corresponds to a real line, but the entry it
        // belongs to was already claimed by another line: a duplicate read,
        // reported by the duplicate machinery rather than as an invention.
        details.push({
          line_no: line.line_no, as_written: written, verdict: 'DUPLICATE_READ', truth: groundTruth[anyMatch.gi].product,
        });
        return;
      }
      invented += 1;
      inventedFreeGeneration += 1;
      details.push({
        line_no: line.line_no, as_written: written, verdict: 'INVENTED', mechanism: 'free-generation', identity: identityText,
      });
      return;
    }

    // AC11 mechanism (a) - the named candidate corresponds to a real product,
    // but nothing that was READ does. A supplied candidate has become a PHOTO
    // line on no image evidence.
    if (via === 'identity-only') {
      invented += 1;
      inventedFromCandidate += 1;
      details.push({
        line_no: line.line_no, as_written: written, verdict: 'INVENTED', mechanism: 'supplied-candidate-no-image-evidence', named: truth.product,
      });
      return;
    }

    // Read one real product and named a DIFFERENT one: only detectable where
    // the identity claim is separate from the reading (Arm B).
    if (identityMode === 'enum' && line.identified) {
      const idAgrees = similarity(truth.product, identityText ?? '') >= MATCH_FLOOR;
      if (!idAgrees) {
        wrongIdentity += 1;
        details.push({
          line_no: line.line_no, as_written: written, verdict: 'WRONG_IDENTITY', read: truth.product, named: identityText,
        });
        return;
      }
    }

    const expected = truth.qty ?? null;
    const got = line.quantity ?? null;
    const quantityAgrees = quantityAgreesUnderDefaultOne(expected, got);
    if (!quantityAgrees) {
      wrongQuantity += 1;
      details.push({
        line_no: line.line_no, as_written: written, verdict: 'WRONG_QUANTITY', truth: truth.product, expected, got,
      });
      return;
    }

    correct += 1;
    details.push({ line_no: line.line_no, as_written: written, verdict: 'CORRECT', truth: truth.product });
  });

  const omittedEntries = groundTruth.filter((g) => !covered.has(g.product));

  // A rejected line still proves the model SAW something there, so a rejection
  // is reported in its own right rather than folded into any of the seven.
  const rejectedByReason = {};
  for (const r of rejected) {
    for (const reason of r.reasons) rejectedByReason[reason] = (rejectedByReason[reason] || 0) + 1;
  }

  const duplicates = duplicateGroups.reduce((n, g) => n + Math.max(0, g.members.length - (g.kind === 'same_region' ? 1 : 0)), 0);

  return {
    denominator: groundTruth.length,
    identityMode,
    correct,
    omitted: omittedEntries.length,
    invented,
    inventedByMechanism: {
      suppliedCandidateNoImageEvidence: inventedFromCandidate,
      freeGeneration: identityMode === 'verbatim' ? null : inventedFreeGeneration,
    },
    wrongIdentity: identityMode === 'verbatim' ? null : wrongIdentity,
    wrongQuantity,
    explicitUnknown,
    duplicates,
    duplicateGroups,
    omittedProducts: omittedEntries.map((g) => g.product),
    rejectedByReason,
    details,
    limits: SCORER_LIMITS,
  };
}

/** One-line-per-category text block for a run report. */
export function formatSevenWay(score, label) {
  const pct = (n) => `${((n / score.denominator) * 100).toFixed(1)}%`;
  return [
    `  ${label} (denominator ${score.denominator} ground-truth lines)`,
    `    correct .............. ${score.correct} (${pct(score.correct)})`,
    `    omitted .............. ${score.omitted} (${pct(score.omitted)})`,
    `    invented ............. ${score.invented}`,
    `    wrong identity ....... ${score.wrongIdentity === null ? 'NOT MEASURABLE in this arm (no identity claim separate from the reading)' : score.wrongIdentity}`,
    `    wrong quantity ....... ${score.wrongQuantity}`,
    `    explicit UNKNOWN ..... ${score.explicitUnknown}`,
    `    duplicates ........... ${score.duplicates}`,
  ].join('\n');
}
