// =====================================================================
// BUILD-015 AsdAIr - agenticVisionPrototype/bandInspection.js
//
// WO-2026-08-12-02 (WP-B15-30), AC6 and AC7: inspect the deterministic bands
// INDIVIDUALLY, then reconcile the results deterministically.
//
// Warwick's architecture, and it is a fan-out rather than a conversation:
//   prepared image -> deterministic region coverage -> Terra region inspection
//   with household context -> constrained candidate ID / UNKNOWN ->
//   deterministic reconciliation -> provenance/sanity checks -> final source
//   truth.
//
// ── AC6: WHY THIS IS NOT THE AGENTIC LOOP ───────────────────────────────
// agenticLoop.js sends the full page PLUS every strip in ONE request and lets
// the model ask for crops mid-conversation. Its own header says so: "TURN 1
// sends the full prepared page PLUS every numbered strip in ONE request."
// That is BUNDLING, and with 8 bands it would be nine images in a single call.
// Warwick: "inspect those regions individually, because the real A/B has
// already shown individual region inspection materially outperforms bundling
// on this exact photograph."
//
// So each band gets ONE call, carrying ONE image, with no tool and no
// `previous_response_id`. That has three consequences worth stating:
//
//   * the model cannot spend its attention on nine images at once;
//   * SOURCE REGION BECOMES A FACT, not a claim. The application knows which
//     band it sent, so it stamps `source_region` itself. Region grounding
//     stops being something the model could get wrong and becomes something
//     it cannot;
//   * calls scale with bands - 7 or 8, not 39. Warwick: "without creating an
//     API-call farm."
//
// ⚠️ THE AGENTIC LOOP IS SUPERSEDED ON THIS PATH, NOT DELETED. agenticLoop.js
// and its tests remain, working and covered. Nothing here imports it. Say that
// plainly rather than implying the live path still exercises it: AC8's
// "region-1 defect fixed" is now a MODULE-LEVEL regression assertion over that
// module, not a property this run demonstrates.
//
// ── AC7: RECONCILIATION IS WHERE OVERLAP PAYS OR COSTS ──────────────────
// Overlap is mandatory so a line near a boundary cannot vanish - which means
// the same handwritten line WILL be returned by two adjacent bands. The same
// line seen twice is ONE line, not a duplicate and not two. Two genuinely
// different lines are never merged.
//
// The rule is deliberately narrow, because a greedy one loses real purchases:
// two reads merge only when they came from ADJACENT bands (or the same band),
// and their readings agree. "2 milk" and "4 milk" never merge - the household
// buys both - and neither do two lines from bands that do not touch, because
// a page can legitimately carry the same item twice in different places.
//
// PURE apart from the injected model call. No credentials, no database, no
// filesystem.
// =====================================================================

'use strict';

import { estimateUsdCost, visionAgenticTurn } from '../../../obsidiwikai/src/core/models.mjs';
import { normalizeResponsesUsage } from './agenticLoop.js';
import { buildLineSchema, buildTextFormat, buildProductIdEnum } from './lineSchema.js';
import { similarity, MATCH_FLOOR } from './sevenWayScore.js';
import { verbatimOf, leadingMarkOf, NEEDS_HUMAN } from './groundLines.js';
import { absolutePosition, POSITION_TOLERANCE_PITCH_FRACTION } from './visualEvidenceGate.js';

/** Normalise a leading mark for comparison: case and inner spacing only. */
function normaliseMark(mark) {
  return String(mark ?? '').trim().toLowerCase().replace(/\s+/g, ' ');
}

/** Add a cause to a line's referral list, keeping `needs_human` its derived truth. */
function addNeedsHumanReason(line, reason) {
  const reasons = Array.isArray(line.needs_human_reasons) ? line.needs_human_reasons : [];
  line.needs_human_reasons = [...new Set([...reasons, reason])];
  line.needs_human = line.needs_human_reasons.length > 0;
}

/**
 * Discharge ONE named cause. WP-B15-33 AC1(a).
 *
 * Narrow on purpose: a stage may only clear the question it actually answered.
 * The bare boolean this replaces could not express that, which is how a
 * resolved collision and an unresolved disputed count became the same flag.
 */
function clearNeedsHumanReason(line, reason) {
  const reasons = Array.isArray(line.needs_human_reasons) ? line.needs_human_reasons : [];
  line.needs_human_reasons = reasons.filter((r) => r !== reason);
  line.needs_human = line.needs_human_reasons.length > 0;
}

/**
 * WP-B15-33 AC2 - two observations of ONE physical line that disagree about
 * the written count.
 *
 * The count is then DISPUTED, and the application must say so rather than
 * believe whichever observation arrived first. Nothing is merged away and no
 * number is changed: the line is referred.
 */
function recordLeadingMarkDisagreement(kept, other) {
  const a = normaliseMark(leadingMarkOf(kept));
  const b = normaliseMark(leadingMarkOf(other));
  // Absence is not disagreement. One crop reading the mark and the other not
  // seeing it at all is the ordinary edge-of-band case, and it is exactly what
  // the overlap exists to survive.
  if (a === '' || b === '') return false;
  if (a === b) return false;
  addNeedsHumanReason(kept, NEEDS_HUMAN.LEADING_MARK_DISAGREEMENT);
  kept.leading_mark_disagreement = [...new Set([...(kept.leading_mark_disagreement ?? []), a, b])];
  return true;
}

/**
 * The instruction for ONE band. Deliberately a different, smaller contract
 * from the loop's: there is no tool, no other region to cite, and no "keep
 * inspecting until the page is covered" - the application already decided
 * coverage, and proved it.
 *
 * The identity, existence and quantity rules are the WORDING already tuned
 * over six rounds in buildAgenticPrompt's constrained prompt, reused rather
 * than re-derived.
 */
export function buildBandPrompt({ candidateBlock, bandNo, bandCount }) {
  return `You are reading ONE horizontal band cut from a photograph of a handwritten household shopping list.

This is band ${bandNo} of ${bandCount}. The application cut it; you did not choose it. Adjacent bands OVERLAP deliberately, so a line at the very top or bottom edge of this band may also appear in a neighbouring one. Report it anyway - the application resolves duplicates, and a line you leave out because you assume someone else saw it is a line nobody sees.

THE HOUSEHOLD'S CANDIDATE PRODUCTS (id: name, with brand/category/aliases/usual quantity). The id is the ONLY product identity you may return:
${candidateBlock}

TASK - two SEPARATE questions per line, in this order. Do not merge them.

1. DOES A LINE EXIST HERE? Locate EVERY handwritten line visible in this band, in page order. Do not drop a line because you are unsure of it, and do not add a line that is not visibly there. A product appearing in THE HOUSEHOLD'S CANDIDATE PRODUCTS is NEVER on its own evidence that it is written on THIS week's page - only a real handwritten mark is. Report a line because you can SEE it, never because it would be a plausible or likely thing for this household to buy. Set visible_line true when you can see writing, false when you cannot. This caution governs ONLY whether a LINE exists - it says nothing about quantity.

2. WRITE DOWN WHAT YOU ACTUALLY SEE. as_written is your best literal reading of the marks, verbatim, including shorthand and spelling as written. This is the ONLY field where you write your own words. Never replace it with a tidied or catalogue-matched product name - it is the record of what the page says, not of what you concluded. If a line is CUT OFF at the edge of this band, still write down what you can see of it.

2a. COPY THE START OF THE LINE INTO leading_mark, AS A SEPARATE FIELD. Almost every line on this household's list begins with something written before the product name. Look at the very start of the line and transcribe exactly what is there - "2", "16", "1", "1 x 6pts", "4 x 4pts", "2 PKTS." - into leading_mark. Copy it even when it is a single "1", even when it seems obvious, and even when you have already included it in as_written. If the line genuinely begins with a word, leading_mark is null. This is TRANSCRIPTION, not judgement: do not decide whether the mark is a purchase count, do not take a number from later in the line, and do not work out what it "ought" to be. The application decides what the mark MEANS; your only job is to say what is WRITTEN.

2b. SAY WHERE THE LINE PHYSICALLY SITS, in band_position_pct. Look at where the ink actually is in THIS crop and give the position of the START of the line as a whole number from 0 to 100, measured along the direction you are reading the lines: 0 is hard against the beginning edge of this crop, 100 is hard against the far edge. This is OBSERVATION, exactly as leading_mark is TRANSCRIPTION. Read it off the image. Do NOT derive it from the order of your answer, do NOT space your values out evenly to look tidy, and do NOT nudge two values apart to make them look distinct. If you genuinely cannot place a line in this crop, return null - that is honest and it costs nothing. This value says nothing about what the line is or how many to buy, and it is never used to accept a line.

3. ONLY THEN, WHICH CANDIDATE IS IT? For a line you have ALREADY established exists, choose the candidate id it most likely refers to. Use the aliases - the household writes shorthand and their own alias list is the strongest signal. Use brand, category and usual quantity as supporting evidence.

4. IF IT MATCHES NO CANDIDATE, say so: product_id UNKNOWN_VISIBLE_ITEM. DO NOT pick the least-bad candidate just to fill the field. A wrong confident match is far worse than an honest "I don't know" - it puts the wrong thing in a real shopping basket. An UNKNOWN_VISIBLE_ITEM is a correct, welcome, fully successful answer.

5. IF THERE IS NO SHOPPING LINE THERE AT ALL - a header, a smudge, a stray mark, a CROSSED-OUT line - set visible_line false and product_id NOT_A_LINE. A crossed-out line is NOT a purchase. Do not silently drop it and do not dress it up as a product.

6. QUANTITY: only record a number that is SEPARATE evidence of how many to buy - a count written before the product name (e.g. "2 Yazoo choc"), or an explicit multiplier like "x3". A number that is part of the product's own printed name or pack size is NEVER the quantity by itself - the "16" in "Richmond 16 Pork Sausages" names a 16-sausage pack, it is not an instruction to buy sixteen packs. If there is no separate count, or it is unreadable, quantity is null. Never guess one.

7. CONFIDENCE: your confidence in the READING, 0 to 1. It only decides whether the band is worth another look. It never makes a line acceptable, so do not inflate it.

Return ONLY the enforced JSON schema. If this band contains no handwriting at all, return an empty lines array - that is a correct answer.`;
}

/** One candidate rendered for the prompt, matching the constrained loop's shape. */
function renderCandidateLine(item) {
  const aliases = Array.isArray(item.aliases) && item.aliases.length > 0 ? ` | aka: ${item.aliases.join(', ')}` : '';
  const brand = item.brand ? ` | brand: ${item.brand}` : '';
  const category = item.category ? ` | ${item.category}` : '';
  const usual = item.typicalQty != null ? ` | usually ${item.typicalQty}` : '';
  return `- ${item.id}: ${item.name}${aliases}${brand}${category}${usual}`;
}

function parseLines(outputText) {
  if (typeof outputText !== 'string' || outputText.trim() === '') return null;
  try {
    const parsed = JSON.parse(outputText);
    return Array.isArray(parsed?.lines) ? parsed.lines : null;
  } catch {
    return null;
  }
}

/**
 * AC6 - inspect every band INDIVIDUALLY. One call per band, one image per call.
 *
 * @param {object} args
 * @param {Array<{region_no:number}>} args.bandRegions - the strip regions only.
 * @param {Record<number,string>} args.bandImageUrls - region_no -> data URL.
 * @param {Array<object>} [args.candidates]
 * @param {Function} [args.callModel] - injectable; defaults to the real gateway.
 * @returns {Promise<{lines:Array<object>, perBand:Array<object>, totalCostUsd:number|null}>}
 */
export async function inspectBandsIndividually({
  bandRegions, bandImageUrls, candidates = [], callModel = visionAgenticTurn,
} = {}) {
  if (!Array.isArray(bandRegions) || bandRegions.length === 0) {
    throw new Error('inspectBandsIndividually: bandRegions is required and must be non-empty');
  }
  const candidateBlock = candidates.length > 0
    ? candidates.map(renderCandidateLine).join('\n')
    : '(no known regulars or favourites recorded for this household yet - every visible line will therefore be UNKNOWN_VISIBLE_ITEM, which is the correct answer, not a failure)';
  const productIdEnum = buildProductIdEnum(candidates);

  const perBand = [];
  const lines = [];
  let lineNo = 0;

  for (const region of bandRegions) {
    const imageUrl = bandImageUrls[region.region_no];
    if (typeof imageUrl !== 'string' || imageUrl === '') {
      // LOUDLY, never a silent skip: a band nobody looked at is a hole in the
      // coverage that was just proved, and the proof would be a lie.
      throw new Error(`inspectBandsIndividually: no rendered crop for band region ${region.region_no}`);
    }
    // The schema's source_region enum holds ONLY this band. The model cannot
    // cite a region it was not shown, and the application overwrites the value
    // anyway - it knows which band it sent.
    const textFormat = buildTextFormat(buildLineSchema({ candidates, regionNos: [region.region_no] }));
    const prompt = buildBandPrompt({
      candidateBlock, bandNo: region.region_no - 1, bandCount: bandRegions.length,
    });

    const startedAt = Date.now();
    const result = await callModel({
      prompt, imageUrls: [imageUrl], tools: [], previousResponseId: null, toolOutputs: [], textFormat,
    });
    const elapsedMs = Date.now() - startedAt;
    const costUsd = estimateUsdCost(normalizeResponsesUsage(result.usage));
    const parsed = parseLines(result.outputText);

    perBand.push({
      region_no: region.region_no,
      responseId: result.responseId ?? null,
      elapsedMs,
      costUsd,
      usage: result.usage ?? null,
      lineCount: parsed === null ? null : parsed.length,
      parseFailed: parsed === null,
    });

    for (const line of parsed ?? []) {
      lineNo += 1;
      lines.push({
        ...line,
        line_no: lineNo,
        // SOURCE REGION IS THE APPLICATION'S FACT, not the model's claim.
        source_region: region.region_no,
      });
    }
  }

  const known = perBand.map((b) => b.costUsd).filter((c) => c !== null);
  return {
    lines,
    perBand,
    productIdEnum,
    totalCostUsd: known.length > 0 ? known.reduce((s, c) => s + c, 0) : null,
    calls: perBand.length,
  };
}

/**
 * AC7 - deterministic reconciliation across OVERLAPPING bands.
 *
 * The same physical line seen in two adjacent bands is ONE line. Two genuinely
 * different lines are never merged.
 *
 * @param {object} args
 * @param {Array<object>} args.lines - accepted lines, each with source_region.
 * @param {number} [args.matchFloor]
 * @returns {{reconciled:Array<object>, merges:Array<object>, mergedAway:number}}
 */
export function reconcileAcrossBands({
  lines, matchFloor = MATCH_FLOOR, regions = [], axis = 'y', linePitch = null,
} = {}) {
  const input = Array.isArray(lines) ? lines : [];
  const reconciled = [];
  const merges = [];

  for (const line of input) {
    const written = verbatimOf(line);
    const region = Number(line.source_region);
    // Only ADJACENT (or identical) bands may hold the same physical line. A
    // page can legitimately carry the same item twice in two different places,
    // and merging those would delete a real purchase.
    const existingIndex = reconciled.findIndex((kept) => {
      const keptRegion = Number(kept.source_region);
      if (Math.abs(keptRegion - region) > 1) return false;
      // ── WP-B15-31: IDENTITY VETOES A MERGE. It does not merely fail to
      //    trigger one, and that difference cost three real purchases ───────
      //
      // Measured in the Arm D artefact, not theorised. Where both lines carry
      // an ESTABLISHED identity and the identities DIFFER, the old code fell
      // through to text similarity - and similar text is exactly what two
      // different variants of the same product have. Three real page lines
      // were destroyed that way in one run:
      //
      //   "Yazoo strawberry milk shake" (59) absorbed "Yazoo chocolate milk
      //     shake" (15)                                     - same band, band 4
      //   "2 PKTS. TWIX ICECREAM BARS" (114) absorbed "1 PKT. TWIX CHOC
      //     BISCUIT BARS" (115)                             - same band, band 7
      //   "x 4pts. ARLA SEMI SKIMMED MILK" (4) absorbed "x 6pts. ASDA SEMI
      //     SKIMMED MILK" (2)                               - same band, band 8
      //
      // Every one of those is two separate things the household actually buys,
      // and every one of them read as "nearly the same words". Only ONE of the
      // three surfaced as an omission in the score - the other two happened to
      // have a second returned instance covering the same page line, so the
      // page-side count masked them. THE MASKING WAS LUCK, NOT CORRECTNESS.
      //
      // So the identity check is now a GATE, taken before similarity is ever
      // consulted: two lines the application has resolved to DIFFERENT
      // catalogue products are two different purchases, however alike they
      // read. Text similarity only decides the case where at most one of the
      // two has an established identity - the genuine fragment case, e.g.
      // "LOCTITE" and "SUPERGLUE" both resolving to 116, which still merges.
      if (kept.identified && line.identified) {
        if (String(kept.product_id) !== String(line.product_id)) return false;
        // ⚠️ SAME PRODUCT, DIFFERENT QUANTITY = TWO REAL LINES. The household
        // genuinely buys "2 milk" and "4 milk" in one shop; collapsing them
        // loses a purchase. This is the design doc's own worked example.
        return (kept.quantity ?? null) === (line.quantity ?? null);
      }
      return similarity(verbatimOf(kept), written) >= matchFloor;
    });

    if (existingIndex === -1) {
      reconciled.push({ ...line, seen_in_regions: [region], merged_from: [] });
      continue;
    }

    const kept = reconciled[existingIndex];
    kept.seen_in_regions = [...new Set([...kept.seen_in_regions, region])].sort((a, b) => a - b);
    kept.merged_from.push({ line_no: line.line_no, as_written: written, source_region: region });
    // The FULLEST reading seen for this physical line, recorded beside the
    // survivor rather than swapped into it. Arm D kept "1 box" and absorbed
    // "1 BOX ASDA FRUIT LOLLY ICE B.", and kept "LENOR O..." over "LENOR
    // OUTDOOR" - the survivor is simply whichever arrived first, which is a
    // real defect in the recorded page truth. It is REPORTED here, not
    // silently repaired: `as_written` is what the quantity was already
    // resolved from earlier in the pipeline, and quietly replacing it after
    // the fact would decouple the recorded text from the resolved number.
    const candidateReadings = [verbatimOf(kept), written, ...kept.merged_from.map((m) => m.as_written)];
    kept.fullest_reading = candidateReadings.reduce((a, b) => (b.length > a.length ? b : a), '');
    kept.survivor_is_fullest = kept.fullest_reading === verbatimOf(kept);
    merges.push({
      kept_line_no: kept.line_no,
      kept_as_written: verbatimOf(kept),
      merged_line_no: line.line_no,
      merged_as_written: written,
      regions: kept.seen_in_regions,
    });

    // ── WP-B15-33 AC2: TWO OBSERVATIONS OF ONE LINE THAT DISAGREE ABOUT THE
    //    COUNT ARE A DISPUTED COUNT, NOT A SETTLED ONE ────────────────────
    //
    // These two readings are, by everything above, the SAME physical line. If
    // their `leading_mark` transcriptions disagree, then the page carries one
    // count and the application has been handed two different answers for it.
    // Believing whichever arrived first is exactly the silently-wrong line
    // Warwick's bar forbids, and it is silent precisely because a merge looks
    // like a resolution.
    //
    // ⛔ THE HONEST LIMIT, and it must travel with this mechanism: it can only
    // fire where there are TWO observations to disagree. A single wrong
    // observation with nothing to contradict it stays undetectable here.
    // Measured on the three variance artefacts, this catches page 16 in runs 1
    // and 3, and does NOT catch page 19 (one observation) or page 11 in runs
    // 2-3. Do not quote it as a fix for the count defect; it is a fix for
    // BELIEVING the count defect.
    recordLeadingMarkDisagreement(kept, line);
  }

  // ── WP-B15-33 AC1(a): DISCHARGE THE REFERRAL THIS STAGE HAS RESOLVED ────
  //
  // `markDuplicates` flagged every cross-region collision for a human BEFORE
  // this stage ran, which was correct at the time: the collision was genuinely
  // unresolved. This stage resolves it. Nothing used to say so, so the four
  // recurring band-boundary sites were collapsed correctly and then went on
  // demanding a human for a question that had been answered.
  //
  // The discharge is deliberately NARROW and evidence-bound. A survivor's
  // duplicate referral clears only when this stage actually absorbed the other
  // observation into it - never merely because reconciliation ran, and never
  // for any OTHER reason the line was referred. A stage that clears a bare
  // boolean clears reasons it knows nothing about.
  for (const line of reconciled) {
    if (line.merged_from.length === 0) continue;
    clearNeedsHumanReason(line, NEEDS_HUMAN.CROSS_REGION_DUPLICATE_UNRESOLVED);
    line.duplicate_collision = false;
    line.duplicate_resolved_by_reconciliation = true;
  }

  // ── WP-B15-33 AC2: THE DISPUTED COUNT THE MERGE RULE DELIBERATELY HIDES ──
  //
  // The quantity check above is CORRECT and is not being changed: "2 milk" and
  // "4 milk" are two real purchases and must never collapse. But that same rule
  // means two observations of ONE physical line whose counts were read
  // DIFFERENTLY also fail to merge - and they then stand as two settled
  // purchases with two different, confidently wrong numbers.
  //
  // Measured on the variance artefacts, this is exactly page 16: band 4 read
  // "2 YAZZO STRAWBERRY MILK SHAKE" and band 5 read "- YAZZO STRAWBERRY MILK
  // SHAKE" - one physical line, counts 2 and 1, page truth 3. Neither
  // observation is right and nothing in the pipeline said the count was in
  // dispute.
  //
  // So: same resolved product, touching bands, DIFFERENT quantity - refer both.
  // Nothing merges, nothing is deleted, no number is rewritten. The application
  // says "I have two readings of this and they disagree", which is precisely
  // Warwick's bar: an uncertain line may go to Cockpit; a silently wrong one
  // may not.
  //
  // Where positions are available they SETTLE it: two observations at the same
  // physical place are one line with a disputed count; two at different places
  // are the genuine two-purchases case and are left alone.
  markDisputedCounts({
    reconciled, regions, axis, linePitch,
  });

  // ── CLOSED ACCOUNTING, ASSERTED. Every accepted line lands in EXACTLY ONE
  //    bucket: it survived, or it was absorbed into a named survivor ───────
  //
  // This exists because the failure it catches ALREADY HAPPENED and was found
  // by reading an artefact rather than by any control. Arm D put 49 accepted
  // lines in and got 38 out, while the score reported 38 detected, 0 invented,
  // 0 duplicates and 0 not-a-line: 38 + 0 + 0 + 0 = 38, against 49. The
  // arithmetic never had to add up, so nobody noticed that eleven lines had
  // gone and that three of them were real purchases.
  //
  // A count that is not required to reconcile is not a count. This throws.
  assertReconciliationCloses({ inputCount: input.length, reconciled, merges });

  return {
    reconciled,
    merges,
    mergedAway: input.length - reconciled.length,
    // The closed accounting, returned so a scorer or a report can PRINT it
    // rather than re-derive it and get it wrong in a second place.
    accounting: {
      accepted: input.length,
      survived: reconciled.length,
      absorbed: merges.length,
      closes: reconciled.length + merges.length === input.length,
    },
    // How often overlap actually did its job: a line the application can see
    // in two bands is a line that could not have silently vanished at a seam.
    confirmedByTwoBands: reconciled.filter((l) => l.seen_in_regions.length > 1).length,
    // Survivors whose recorded text is NOT the fullest reading available for
    // that physical line. Reported, never hidden behind a nicer number.
    survivorsNotFullestReading: reconciled.filter((l) => l.survivor_is_fullest === false).length,
  };
}

/**
 * WP-B15-33 AC2 - refer every pair of observations that resolve to the SAME
 * product across touching bands but disagree about the count.
 *
 * ⛔ REFERS. Never merges, never deletes, never rewrites a number. The whole
 * mechanism can do exactly one thing: add a cause to a referral list.
 *
 * ⛔ ITS HONEST LIMIT, and it belongs beside the mechanism rather than in a
 * report nobody reopens: this can only fire where there are TWO observations
 * to disagree. A single wrong reading with nothing to contradict it is
 * invisible here. Measured on the three variance artefacts it catches page 16
 * in runs 1 and 3; it does NOT catch page 19 (one observation) or page 11 in
 * runs 2-3. It is a fix for BELIEVING a wrong count, not a fix for reading one.
 *
 * @returns {number} how many lines were referred.
 */
export function markDisputedCounts({
  reconciled, regions = [], axis = 'y', linePitch = null,
} = {}) {
  const lines = Array.isArray(reconciled) ? reconciled : [];
  const regionsByNo = new Map(
    (regions || []).filter((r) => r && r.region_kind === 'strip').map((r) => [Number(r.region_no), r]),
  );
  const pitch = Number.isFinite(Number(linePitch)) && Number(linePitch) > 0 ? Number(linePitch) : null;
  const tolerance = pitch === null ? null : pitch * POSITION_TOLERANCE_PITCH_FRACTION;
  const positionOf = (line) => absolutePosition(line, regionsByNo, axis);

  const referred = new Set();
  for (let i = 0; i < lines.length; i += 1) {
    for (let j = i + 1; j < lines.length; j += 1) {
      const a = lines[i];
      const b = lines[j];
      if (!a.identified || !b.identified) continue;
      if (String(a.product_id) !== String(b.product_id)) continue;
      if ((a.quantity ?? null) === (b.quantity ?? null)) continue;
      if (Math.abs(Number(a.source_region) - Number(b.source_region)) > 1) continue;

      // Position, where the application has it, is the decider. Two readings at
      // the same physical place are ONE line; two at different places are the
      // household genuinely buying the same product twice, which is a real and
      // supported case and is left entirely alone.
      const pa = positionOf(a);
      const pb = positionOf(b);
      if (tolerance !== null && pa !== null && pb !== null && Math.abs(pa - pb) > tolerance) continue;

      addNeedsHumanReason(a, NEEDS_HUMAN.LEADING_MARK_DISAGREEMENT);
      addNeedsHumanReason(b, NEEDS_HUMAN.LEADING_MARK_DISAGREEMENT);
      a.disputed_count_with = [...new Set([...(a.disputed_count_with ?? []), b.line_no])];
      b.disputed_count_with = [...new Set([...(b.disputed_count_with ?? []), a.line_no])];
      referred.add(i).add(j);
    }
  }
  return referred.size;
}

/**
 * The reconciliation accounting identity, as an executable assertion.
 *
 * Exported so it can be MUTATION-PROVED directly: a control nobody has watched
 * fail is not evidence that it works.
 *
 * @param {{inputCount:number, reconciled:Array<object>, merges:Array<object>}} args
 * @throws when a line has disappeared, been double-counted, or been absorbed
 *   into a survivor that does not exist.
 */
export function assertReconciliationCloses({ inputCount, reconciled, merges }) {
  const survived = reconciled.length;
  const absorbed = merges.length;
  if (survived + absorbed !== inputCount) {
    throw new Error(
      `reconcileAcrossBands: ACCOUNTING DOES NOT CLOSE - ${inputCount} accepted line(s) in, `
      + `${survived} survived + ${absorbed} absorbed = ${survived + absorbed}. `
      + `${inputCount - survived - absorbed} line(s) disappeared with no disposition.`,
    );
  }
  const survivorNos = new Set(reconciled.map((l) => l.line_no));
  const orphan = merges.find((m) => !survivorNos.has(m.kept_line_no));
  if (orphan) {
    throw new Error(
      `reconcileAcrossBands: line ${orphan.merged_line_no} was absorbed into line `
      + `${orphan.kept_line_no}, which is not among the survivors. The absorbing line `
      + 'was itself removed, so the absorbed line is unreachable.',
    );
  }
  const absorbedNos = merges.map((m) => m.merged_line_no);
  if (new Set(absorbedNos).size !== absorbedNos.length) {
    throw new Error('reconcileAcrossBands: a line was absorbed more than once - buckets are not exclusive.');
  }
  return true;
}
