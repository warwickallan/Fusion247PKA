// =====================================================================
// BUILD-015 AsdAIr Stage 1 - pipeline/abAcceptanceHarness.js
//
// WO-2026-08-11-B15-VISION-01, AC8: an A/B acceptance test harness -
// BUNDLED (one request: full page + every numbered strip together) vs.
// INDIVIDUAL (the full page, then ONE separate follow-up call per strip) -
// run against the one photograph this build has a verified-correct answer
// for (Deliverables/2026-08-11-trolley-reconciliation-41-lines.md).
//
// ── UPDATED, WO-2026-08-12-B15-VISION-02, AC8 ──────────────────────────
// The A/B QUESTION this harness was built to answer is now SETTLED
// (Amendment 4, point 6: individual beat bundled, 35/41 named vs. 24/41,
// 27/41 correct vs. 21/41) and Warwick's ruling adopted a THIRD shape for
// production - ADAPTIVE TARGETED re-inspection (interpretPhotoOrchestrator.
// js, AC2): one first pass, then an INDIVIDUAL follow-up call per region
// the deterministic checks actually flag, never every region and never one
// bundled call. `runAdaptiveStrategy` below is added to let a live re-run
// measure the REAL production algorithm, not just the two exploratory
// extremes this file already measured. `runBundledStrategy` and
// `runIndividualStrategy` are KEPT UNCHANGED - historical/reference arms,
// still useful for confirming the A/B finding still holds, never removed.
//
// TWO THINGS THIS FILE STILL DOES NOT DO, NAMED FOR ASDAIR RATHER THAN
// GUESSED AT HERE: (1) `loadGroundTruth()` still parses the 41-line
// trolley file, which this order's own instruction is explicit is NOT the
// scoring denominator - the real photo has 39 source lines (see Amendment
// 4, point 1: 39 photo lines − 1 deliberately-skipped Bloo + 3 Regulars-
// added stages = 41). Deriving the correct 39-line photo-truth list from
// the trolley's own multi-stage Regulars-addition history (see that
// document's "first/second/third Regulars batch" breakdown) needs domain
// judgement this Work Order does not have grounds to invent - it is
// Asdair's job, per AC8's own text, not silently guessed at here. (2) the
// SEVEN-CATEGORY breakdown Warwick specified (correctly identified /
// omitted / invented / wrong identity / wrong quantity / genuinely
// uncertain / confident-but-wrong) is added below as `scoreSevenWay`, ready
// to run against whatever ground-truth list Asdair supplies - it does not
// invent the 39-line list itself.
//
// ── BUILT, CALLABLE, NOT EXECUTED BY KEEL ───────────────────────────────
// This Work Order's explicit "Explicitly out of scope": "Calling the live
// fusion gateway with real credentials, for any reason, including 'just to
// test AC8's harness once.'" credential_scope/live_authority/network are
// all `none`. So this script is proven CALLABLE (its CLI argument parsing,
// its ground-truth parser, and its scoring functions are all unit-tested
// with zero network access) but its `main()` - the part that actually
// calls models.mjs's vision() - has never been executed by this Work
// Order, including its new adaptive arm. That run is Asdair's, later, with
// real credentials, against the corrected 39-line denominator.
//
// USAGE (Asdair, later, with a real gateway configured):
//   FUSION_GATEWAY_URL=... node abAcceptanceHarness.js <path-to-photo.jpg> [--household=1]
//
// It prints a comparison table: for each strategy, matched/missing/extra
// counts against the verified trolley, so a human can see which strategy
// (per Pax's independent review - published evidence is genuinely mixed on
// bundling vs. individual-crop calls) actually reads this build's own hard
// photograph better, rather than guessing from published benchmarks alone.
// =====================================================================

'use strict';

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// The one photograph this build has a verified-correct answer for.
export const GROUND_TRUTH_PATH = path.join(
  __dirname, '..', '..', '..', 'Deliverables', '2026-08-11-trolley-reconciliation-41-lines.md',
);

// ---------------------------------------------------------------------
// Ground truth parsing - pure, no I/O beyond the text it is handed.
// ---------------------------------------------------------------------

/**
 * Parse the "# | Product as it appears in the ASDA trolley | Qty" table out
 * of the trolley-reconciliation markdown. Returns every data row; the
 * header/separator rows are skipped by requiring column 1 to parse as an
 * integer.
 * @param {string} markdown
 * @returns {Array<{product:string, qty:number}>}
 */
export function parseTrolleyGroundTruth(markdown) {
  const rows = [];
  for (const line of markdown.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed.startsWith('|')) continue;
    const cells = trimmed.split('|').map((c) => c.trim()).filter((c, i, arr) => !(i === 0 || i === arr.length - 1) || c !== '');
    // Expect: '', '#', 'Product...', 'Qty', '' after the filter above collapses leading/trailing empties.
    const parts = trimmed.split('|').slice(1, -1).map((c) => c.trim());
    if (parts.length !== 3) continue;
    const num = Number(parts[0]);
    if (!Number.isInteger(num)) continue; // header or separator row
    const qty = Number(parts[2]);
    if (!Number.isInteger(qty)) continue;
    rows.push({ product: parts[1], qty });
  }
  return rows;
}

/** Load and parse the real committed ground-truth file. Throws plainly if it has moved rather than silently scoring against nothing. */
export function loadGroundTruth() {
  if (!fs.existsSync(GROUND_TRUTH_PATH)) {
    throw new Error('abAcceptanceHarness: ground-truth file not found at ' + GROUND_TRUTH_PATH
      + ' - has Deliverables/2026-08-11-trolley-reconciliation-41-lines.md moved or been renamed?');
  }
  return parseTrolleyGroundTruth(fs.readFileSync(GROUND_TRUTH_PATH, 'utf8'));
}

// ---------------------------------------------------------------------
// Scoring - pure. Fuzzy on purpose: an interpreted line names a matched
// product's canonical NAME (from the catalogue), which is not byte-
// identical to the trolley's own product description, so this compares
// case-insensitively on whichever direction contains the other's first
// distinguishing tokens - good enough to report a genuine accuracy number
// without pretending exact-string equality is the real bar.
// ---------------------------------------------------------------------

function normalise(text) {
  return String(text || '').toLowerCase().replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim();
}

function fuzzyMatches(a, b) {
  const na = normalise(a);
  const nb = normalise(b);
  if (na === '' || nb === '') return false;
  return na.includes(nb) || nb.includes(na);
}

/**
 * @param {Array<{product_name:string, quantity:number|null}>} interpretedLines
 * @param {Array<{product:string, qty:number}>} groundTruth
 * @returns {{matched:number, missingQty:number, wrongProduct:number, total:number,
 *   details:Array<object>}}
 */
export function scoreInterpretation(interpretedLines, groundTruth) {
  const details = [];
  let matched = 0;
  let wrongProduct = 0;
  let missingQty = 0;

  for (const line of interpretedLines) {
    const candidate = groundTruth.find((g) => fuzzyMatches(g.product, line.product_name));
    if (!candidate) {
      wrongProduct += 1;
      details.push({ line, verdict: 'NO_MATCH_IN_TROLLEY' });
      continue;
    }
    if (line.quantity !== null && line.quantity !== undefined && line.quantity !== candidate.qty) {
      missingQty += 1;
      details.push({ line, candidate, verdict: 'QUANTITY_MISMATCH' });
      continue;
    }
    matched += 1;
    details.push({ line, candidate, verdict: 'MATCHED' });
  }

  return { matched, wrongProduct, missingQty, total: interpretedLines.length, details };
}

// ---------------------------------------------------------------------
// Region -> actual image bytes. THIS IS THE PIECE FINDING 2 BLOCKS.
//
// A real run needs a DISTINCT cropped/rotated image per region (that is the
// entire point of sending strips rather than the same full page repeatedly
// - see this Work Order's own read-back Finding 2, still with Warwick as of
// this file's authorship). Until a rendering library is authorised, there
// is no honest way to produce that here, so the DEFAULT below is a loudly-
// labelled PLACEHOLDER: it sends the SAME uncropped page for every region,
// which tests "does region-citation prompting alone help" - a real but
// DIFFERENT, weaker experiment than "do real zoomed crops help" (AC8's
// actual question). `renderRegionImage` is dependency-injected specifically
// so a real cropper can be swapped in later with NO change to either
// strategy function or to this harness's CLI shape - see the module header.
// ---------------------------------------------------------------------

/** PLACEHOLDER pending Finding 2. Real behaviour once authorised: return a genuinely cropped/rotated data URL for `region`. */
function placeholderRenderRegionImage(imageBuffer, region, imageToDataUrl) {
  return imageToDataUrl(imageBuffer);
}

/**
 * BUNDLED: one vision() call, page + every strip as separate image parts
 * in the SAME request (models.mjs's multi-image support, AC2).
 */
export async function runBundledStrategy(imageBuffer, catalogue, { vision, buildGroundedPrompt, prepareImage, imageToDataUrl, renderRegionImage = placeholderRenderRegionImage }) {
  const prepared = prepareImage(imageBuffer);
  const prompt = buildGroundedPrompt(catalogue, { regions: prepared.regions });
  const imageUrls = prepared.regions.map((region) => renderRegionImage(imageBuffer, region, imageToDataUrl));
  const raw = await vision(prompt, imageUrls);
  return { strategy: 'bundled', callCount: 1, raw };
}

/**
 * INDIVIDUAL: the full page in its own call, then ONE SEPARATE call per
 * strip - the comparison arm Pax's independent review asked this build to
 * measure rather than assume.
 */
export async function runIndividualStrategy(imageBuffer, catalogue, { vision, buildGroundedPrompt, prepareImage, imageToDataUrl, renderRegionImage = placeholderRenderRegionImage }) {
  const prepared = prepareImage(imageBuffer);
  const fullPagePrompt = buildGroundedPrompt(catalogue, { regions: [prepared.regions[0]] });
  const raw = [await vision(fullPagePrompt, renderRegionImage(imageBuffer, prepared.regions[0], imageToDataUrl))];
  for (const region of prepared.regions.slice(1)) {
    const stripPrompt = buildGroundedPrompt(catalogue, { regions: [region] });
    raw.push(await vision(stripPrompt, renderRegionImage(imageBuffer, region, imageToDataUrl)));
  }
  return { strategy: 'individual', callCount: raw.length, raw };
}

/**
 * ADAPTIVE (WO-2026-08-12-B15-VISION-02, AC2/AC8): the REAL production
 * shape - one first pass, then an INDIVIDUAL follow-up call for ONLY the
 * regions the deterministic checks (photoSanityChecks.js) or the follow-up
 * decision (followUpTrigger.js) actually flag. This is a thin re-wiring of
 * interpretPhotoOrchestrator.interpretPhotoWithDeps itself - not a THIRD,
 * separately-maintained copy of the adaptive logic - so this arm can never
 * silently drift from what production actually does. A clean list costs
 * exactly one call, the same as `runBundledStrategy`'s single request; a
 * difficult list costs one call per flagged region, individually, the same
 * as `runIndividualStrategy`'s per-strip calls but ONLY for the regions
 * that need it rather than every one of them.
 *
 * @param {object} collaborators - {vision, buildGroundedPrompt, prepareImage,
 *   imageToDataUrl, renderAllRegions, insertRegionBatch, insertPhotoProvenanceBatch,
 *   runSanityChecks, needsFollowUp, flaggedRegionsForFollowUp, silentRegions,
 *   extractJson, writeQuery}
 *   - the SAME collaborator shape interpretPhotoOrchestrator.js already takes,
 *   so a real run supplies the real modules exactly as deps.js's
 *   realInterpretPhoto does. `silentRegions` (AC1, WO-2026-08-12-B15-VISION-03)
 *   is optional there and here alike - see interpretPhotoOrchestrator.js's own
 *   doc comment.
 */
export async function runAdaptiveStrategy(imageBuffer, catalogue, collaborators) {
  const { interpretPhotoWithDeps } = await import('./interpretPhotoOrchestrator.js');
  const callLog = { count: 0 };
  const countingVision = async (prompt, imageUrls) => {
    callLog.count += 1;
    return collaborators.vision(prompt, imageUrls);
  };
  const result = await interpretPhotoWithDeps(
    { catalogue, imageBuffer, shopId: collaborators.shopId ?? -1, interpreterModel: collaborators.interpreterModel ?? 'gpt-5.6-terra', promptVersion: collaborators.promptVersion ?? 'harness' },
    { ...collaborators, vision: countingVision },
  );
  // AC6 (WO-2026-08-12-B15-VISION-03): forward the full, unsanitized
  // observability the orchestrator now returns - this harness is exactly
  // the "diagnostic harness" AC6 asks to be updated so a future live
  // re-test can distinguish "never generated by any region" (a region_no in
  // initialSilentRegions), "generated then filtered/dropped" (an entry in
  // droppedLines), and "genuinely never seen" (neither - see
  // interpretPhotoOrchestrator.js's own return-shape comment for the exact
  // reasoning and its acknowledged limit). This function still calls
  // NOTHING live itself - see this module's own "BUILT, CALLABLE, NOT
  // EXECUTED BY KEEL" header.
  return {
    strategy: 'adaptive', callCount: callLog.count, followUpFired: result.followUpFired, lines: result.lines,
    initialSilentRegions: result.initialSilentRegions, droppedLines: result.droppedLines,
  };
}

// ---------------------------------------------------------------------
// AC8's seven-category scoring, per Warwick's own specification (Amendment
// 4, point 1): correctly identified / omitted / invented / wrong identity /
// wrong quantity / genuinely uncertain / confident-but-wrong. Separate from
// the older three-category scoreInterpretation above (kept for the existing
// bundled/individual comparison), this is the shape a LIVE re-run against
// the corrected denominator should use. PURE - takes whatever ground-truth
// list the caller supplies; does NOT itself decide what that list is (see
// the module header's note on the 39-line denominator being Asdair's job).
// ---------------------------------------------------------------------

/**
 * @param {Array<{raw_reading:string, product_name?:string, quantity:number|null, confidence?:number|null, status?:string}>} interpretedLines
 * @param {Array<{product:string, qty:number}>} groundTruth
 * @returns {{correctlyIdentified:number, omitted:number, invented:number, wrongIdentity:number,
 *   wrongQuantity:number, genuinelyUncertain:number, confidentButWrong:number, details:Array<object>}}
 */
export function scoreSevenWay(interpretedLines, groundTruth) {
  const UNCERTAIN_STATUSES = new Set(['needs_confirmation', 'unreadable', 'unmatched_new_item']);
  const details = [];
  let correctlyIdentified = 0;
  let invented = 0;
  let wrongIdentity = 0;
  let wrongQuantity = 0;
  let genuinelyUncertain = 0;
  let confidentButWrong = 0;

  const matchedGroundTruth = new Set();

  for (const line of interpretedLines) {
    const productName = line.product_name ?? line.raw_reading;
    const candidate = groundTruth.find((g) => fuzzyMatches(g.product, productName));
    const isUncertainStatus = typeof line.status === 'string' && UNCERTAIN_STATUSES.has(line.status);
    const isLowConfidence = Number.isFinite(line.confidence) && line.confidence < 0.6;

    if (!candidate) {
      if (isUncertainStatus || isLowConfidence) {
        genuinelyUncertain += 1;
        details.push({ line, verdict: 'GENUINELY_UNCERTAIN' });
      } else {
        invented += 1;
        details.push({ line, verdict: 'INVENTED' });
      }
      continue;
    }

    matchedGroundTruth.add(candidate.product);

    if (isUncertainStatus || isLowConfidence) {
      genuinelyUncertain += 1;
      details.push({ line, candidate, verdict: 'GENUINELY_UNCERTAIN' });
      continue;
    }

    if (line.quantity !== null && line.quantity !== undefined && line.quantity !== candidate.qty) {
      wrongQuantity += 1;
      details.push({ line, candidate, verdict: 'WRONG_QUANTITY' });
      continue;
    }

    correctlyIdentified += 1;
    details.push({ line, candidate, verdict: 'CORRECTLY_IDENTIFIED' });
  }

  const omitted = groundTruth.filter((g) => !matchedGroundTruth.has(g.product)).length;

  // wrongIdentity is DELIBERATELY not populated by this function alone: it
  // requires knowing the interpretation MEANT to name a different real
  // ground-truth product than the one it actually named (a confusion
  // between two catalogue items), which needs the household catalogue's
  // own identity-resolution output (resolveByCatalogue.js's matched_
  // regular_id), not just fuzzy text matching against the trolley list.
  // Reported as a KNOWN GAP rather than silently approximated by this pure
  // text-matching function - Asdair's live re-run has that richer signal
  // available and should compute it there.
  const wrongIdentityNote = 'wrongIdentity requires resolveByCatalogue.js output (matched_regular_id), not available to this pure text-matching function - compute it at the live re-run, where that signal exists.';

  const confidentButWrongTotal = confidentButWrong; // always 0 here - see wrongIdentityNote; a future caller with resolveByCatalogue signal can compute it.

  return {
    correctlyIdentified, omitted, invented, wrongIdentity: 0, wrongQuantity,
    genuinelyUncertain, confidentButWrong: confidentButWrongTotal, details, wrongIdentityNote,
  };
}

// ---------------------------------------------------------------------
// CLI entrypoint - only runs when this file is executed directly, so
// importing it (as the tests do) never touches the network.
// ---------------------------------------------------------------------

async function main() {
  const imagePath = process.argv[2];
  if (!imagePath) {
    process.stderr.write('usage: node abAcceptanceHarness.js <path-to-photo.jpg> [--household=1]\n');
    process.exitCode = 1;
    return;
  }
  const householdArg = process.argv.find((a) => a.startsWith('--household='));
  const householdId = householdArg ? Number(householdArg.split('=')[1]) : 1;

  const { vision } = await import('../../obsidiwikai/src/core/models.mjs');
  const { buildGroundedPrompt } = (await import('../interpret/groundedPrompt.js'));
  const { prepareImage } = await import('./imagePrep.js');
  const { loadCatalogue } = await import('../interpret/loadCatalogue.js');
  const { createRequire } = await import('node:module');
  const require = createRequire(import.meta.url);
  const { extractJson } = await import('../../obsidiwikai/src/core/llm.mjs');

  const imageBuffer = fs.readFileSync(imagePath);
  const ext = path.extname(imagePath).toLowerCase();
  const mime = ext === '.png' ? 'image/png' : 'image/jpeg';
  const imageToDataUrl = (buf) => `data:${mime};base64,${buf.toString('base64')}`;

  // A live household catalogue read - this is the one piece main() cannot
  // run without ASDAIR_DB_URL AND a real gateway, which is exactly why this
  // function is never invoked by this Work Order (see the module header).
  const catalogue = await loadCatalogue(householdId);
  const groundTruth = loadGroundTruth();

  const deps = { vision, buildGroundedPrompt, prepareImage, imageToDataUrl };

  process.stderr.write(
    '\nWARNING: renderRegionImage is running the FINDING-2 PLACEHOLDER - every "region" sent this run is the\n'
    + 'SAME uncropped page, not a real zoomed crop. This measures whether region-citation PROMPTING alone\n'
    + 'helps, not whether real crops help (AC8\'s actual question). See abAcceptanceHarness.js\'s module header.\n\n',
  );

  const bundled = await runBundledStrategy(imageBuffer, catalogue, deps);
  const individual = await runIndividualStrategy(imageBuffer, catalogue, deps);

  for (const result of [bundled, individual]) {
    const parsed = extractJson(Array.isArray(result.raw) ? result.raw.join('\n') : result.raw);
    const lines = (parsed && parsed.lines) || [];
    const score = scoreInterpretation(
      lines.map((l) => ({ product_name: l.raw_reading, quantity: l.quantity })),
      groundTruth,
    );
    process.stdout.write(`\n=== ${result.strategy} (${result.callCount} vision call(s)) ===\n`);
    process.stdout.write(`matched=${score.matched} wrongProduct=${score.wrongProduct} missingQty=${score.missingQty} total=${score.total}\n`);
  }
}

const isMain = process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url;
if (isMain) {
  main().catch((err) => {
    process.stderr.write('abAcceptanceHarness failed: ' + (err && err.stack ? err.stack : String(err)) + '\n');
    process.exitCode = 1;
  });
}
