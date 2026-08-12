// BUILD-015 AsdAIr Stage 1 - groundedPrompt.js
//
// PURE. Builds the one-shot vision request that asks the model to SELECT from
// the household's real catalogue rather than invent product names.
//
// The design rule that makes this work: the model returns a candidate **id**,
// never a product name it composed. Names it writes are only ever
// `raw_reading` - what it believes is physically on the paper. Anything
// canonical comes from OUR catalogue, looked up by id. A model cannot
// hallucinate a product that does not exist if it is never asked to name one.
//
// ── REGION-CITATION CONTRACT, ADDED WO-2026-08-11-B15-VISION-01 (AC1/AC2/AC3) ──
// `buildGroundedPrompt(catalogue, options)` now takes an OPTIONAL second
// argument. `options.regions` - an array of {region_no, region_kind} from
// pipeline/imagePrep.js's planRegions(), matching the rows already persisted
// to asdair.shop_image_region (migration 020) - is the ONLY new behaviour:
//
//   * ABSENT (or an empty array): the prompt and its JSON-output contract are
//     BYTE-IDENTICAL to before this change. Every existing caller
//     (interpret/interpret-list.js, its tests, pipeline/test/harness.js) is
//     therefore unaffected and untouched by this edit - see
//     groundedPrompt.test.js's regression test, which pins that claim rather
//     than asserting it in prose.
//   * PRESENT: the prompt gains an "AVAILABLE IMAGE REGIONS" section listing
//     every region_no the model may cite, and the JSON-output contract gains
//     a REQUIRED per-line `source_region` field. The model is told explicitly
//     it may ONLY name a region_no from that list - it can never assert its
//     own coordinates. This is the prompt half of the anti-hallucination
//     design; migration 020's composite foreign key
//     (shop_line_provenance_region_fk) is the half that makes it a database
//     fact rather than a prompt request (see that migration's own header).
//
// This module still asks nothing of a model gateway and calls nothing - it
// remains PURE string-building, exactly as before.
'use strict';

// Bumped whenever this template's WORDING or JSON-output contract changes in
// a way that could change what the model returns - the region-citation
// contract above is what earned v2; the quantity-evidence rewording below
// (WO-2026-08-12-B15-VISION-02, AC1) earned v3; the no-prior-hallucination
// guard below (WO-2026-08-12-B15-VISION-03, AC2) earned v4; the quantity-
// assertion recalibration below (WO-2026-08-12-B15-VISION-04, AC3) earns v5.
// Recorded on every PHOTO provenance row (shop_line_provenance.prompt_version,
// migration 020) specifically so a future accuracy regression is debuggable
// ("did the model change or did the prompt change" - migration 020's own
// reasoning for carrying this at all).
//
// ── AC3 (WO-2026-08-12-B15-VISION-04) - THE QUANTITY-ASSERTION COLLAPSE, AND
//    WHY IT WAS THE v4 GUARD, NOT THE v3 QUANTITY RULE ─────────────────────
//
// THE MEASURED REGRESSION: quantity assertion collapsed from 87.1%/69.4%
// (round 2's own two diagnostic runs, scratchpad round2/run-a.json,
// run-b.json) to 26.3%/25.0% (round 3's, round3/run-a.json, run-b.json) -
// masked by a "0 wrong quantities" metric that only improved because the
// model mostly stopped answering.
//
// THE ROOT CAUSE, established by comparison rather than guessed: `git diff`
// between the round-2 commit (4f03d4d) and the round-3 commit (e075440)
// shows rule 6 below - the quantity-evidence wording itself - BYTE-IDENTICAL
// across both. The ONLY prompt changes round 3 made were the "WHAT THEY
// BOUGHT LAST TIME" re-wording and rule 1 gaining the no-prior-hallucination
// guard ("A product being one of THE HOUSEHOLD'S KNOWN PRODUCTS or appearing
// in WHAT THEY BOUGHT LAST TIME is NEVER on its own evidence... Report a
// line because you can see it, never because it would be a plausible or
// likely thing"). Since the quantity rule did not change and the quantity
// rate still collapsed, the cause cannot be rule 6 (round 2) - it is round
// 3's own guard. The most likely mechanism: a broad "never assert on a
// plausible inference, only on what you can directly verify" instruction,
// aimed at LINE EXISTENCE, generalised in the model's response past its
// literal scope onto every other uncertain-feeling field - including
// quantity, which rule 6 already told it to be cautious about. Two cautions
// compounding is not the same as either one alone.
//
// THE FIX is scoping, not weakening: the anti-hallucination guard in rule 1
// closed a real, separately-important defect (TRESemme/Lucozade invented
// wholesale - WO-2026-08-12-B15-VISION-03, AC2) and must not be relaxed by
// this Work Order. Instead rule 1 gains one clarifying sentence naming
// EXACTLY what it does and does not govern, so the model cannot read it as
// license to also suppress a quantity that genuinely IS written.
const PROMPT_VERSION = 'grounded-v5-quantity-recalibration';

const STATUSES = Object.freeze([
  'matched',
  'needs_confirmation',
  'unmatched_new_item',
  'unreadable',
  'possible_duplicate',
]);

const MATCH_BASES = Object.freeze([
  'exact alias',
  'approximate alias',
  'known brand + variant',
  'regular product',
  'previous-order match',
  'category-constrained match',
  'human-confirmed historical mapping',
]);

function renderCandidates(candidates) {
  return candidates
    .map((c) => {
      const bits = [`${c.id}: ${c.name}`];
      if (c.brand) bits.push(`brand=${c.brand}`);
      if (c.category) bits.push(`cat=${c.category}`);
      if (c.aka && c.aka.length) bits.push(`aka=${c.aka.join('|')}`);
      if (c.typical_qty != null) bits.push(`usual_qty=${c.typical_qty}`);
      return '  ' + bits.join('  ');
    })
    .join('\n');
}

function renderRules(rules) {
  if (!rules || !rules.length) return '  (none)';
  return rules
    .map((r) => `  [${r.directive}] ${r.match_term ? r.match_term + ' -> ' : ''}${r.matched_product || r.text}`)
    .join('\n');
}

function renderLastOrder(lastOrder) {
  if (!lastOrder || !lastOrder.lines.length) return '  (no previous completed order)';
  return lastOrder.lines.map((l) => `  ${l.qty ?? '?'} x ${l.item_name}`).join('\n');
}

// Human-readable label for a region, used only in the listing shown to the
// model - `region_no` (the number the model must actually cite) is the only
// part of this that reaches the JSON contract.
function renderRegions(regions) {
  return regions
    .map((r) => `  region ${r.region_no}: ${r.region_kind === 'full_page' ? 'the full page' : 'a strip of the page'}`)
    .join('\n');
}

/**
 * @param {object} catalogue - from loadCatalogue()
 * @param {object} [options]
 * @param {Array<{region_no:number, region_kind:string}>} [options.regions] -
 *   OPTIONAL. See the module header's "REGION-CITATION CONTRACT". Absent or
 *   empty leaves the prompt and JSON contract byte-identical to before.
 * @returns {string} the grounded prompt
 */
function buildGroundedPrompt(catalogue, options) {
  const regions = (options && Array.isArray(options.regions)) ? options.regions : [];
  const regionNos = regions.map((r) => r.region_no);
  const citesRegions = regions.length > 0;

  const regionsSection = citesRegions
    ? `

AVAILABLE IMAGE REGIONS (this is EVERY region you may cite - you may NEVER assert your own coordinates
or a region number not listed here):
${renderRegions(regions)}`
    : '';

  const sourceRegionTask = citesRegions
    ? `\n8. For each line, set source_region to the region number (from the list above) where you actually saw that
   line. You may ONLY use a number from the AVAILABLE IMAGE REGIONS list - never invent one, never describe a
   location in words. If a line is visible in more than one overlapping strip, cite the ONE strip that gives
   the clearest, most complete view of it.`
    : '';

  const sourceRegionField = citesRegions
    ? `,\n           "source_region":${regionNos[0] ?? 1}`
    : '';

  const sourceRegionNote = citesRegions
    ? ` source_region is REQUIRED on every line and MUST be one of: ${regionNos.join(', ')}.`
    : '';

  return `You are helping interpret a photograph of a handwritten weekly shopping list for ONE household.

You are NOT transcribing arbitrary handwriting. This household buys the same things most weeks. Your job is to
work out WHICH OF THEIR KNOWN PRODUCTS each handwritten line most likely refers to.

THE HOUSEHOLD'S KNOWN PRODUCTS (id: name, with brand/category/aliases/usual quantity):
${renderCandidates(catalogue.candidates)}

STANDING RULES THAT AFFECT INTERPRETATION:
${renderRules(catalogue.rules)}

WHAT THEY BOUGHT LAST TIME (a prior for DISAMBIGUATING a mark you can already see on the page - they repeat
most weeks - but NEVER on its own a reason to report a line. If nothing on the page corresponds to something
they usually buy, it is not on this week's list, however likely that seems):
${renderLastOrder(catalogue.last_order)}${regionsSection}

TASK
1. Locate EVERY handwritten line on the page, in page order. Do not drop a line because you are unsure of it,
   and do not add a line that is not visibly there. A product being one of THE HOUSEHOLD'S KNOWN PRODUCTS or
   appearing in WHAT THEY BOUGHT LAST TIME is NEVER on its own evidence that it is written on THIS week's
   page - only a real handwritten mark is. Report a line because you can see it, never because it would be a
   plausible or likely thing for this household to buy. This caution governs ONLY whether a LINE exists on
   the page - it says nothing about quantity. Once you report a line, follow rule 6 below exactly as written:
   state a quantity whenever the line's OWN text gives genuine count evidence. Do not let this caution make
   you leave quantity blank on a line that DOES show one.
2. For each line, record raw_reading: your best literal reading of the marks. This is the ONLY field where you
   write your own words.
3. Then choose the candidate id from the list above that the line most likely refers to.
   - Use the aliases. The household writes shorthand: their own alias list is the strongest signal.
   - Use brand, category and usual quantity as supporting evidence.
   - Use what they bought last time - a line that matches a previous purchase is very likely that product.
4. If a line genuinely matches NO candidate, set matched_regular_id to null and status "unmatched_new_item".
   DO NOT pick the least-bad candidate just to fill the field. A wrong confident match is far worse than an
   honest "I don't know" - it puts the wrong thing in a real shopping basket.
5. If two candidates are both plausible, set status "needs_confirmation" and list BOTH in alternatives.
6. Quantity: only record a number that is SEPARATE evidence of how many to buy - a count written before the
   product name (e.g. "2 Yazoo choc"), or an explicit multiplier like "x3" or "buy 2". A number that is part
   of the product's own printed name or pack size is NEVER the quantity by itself - for example the "16" in
   "Richmond 16 Pork Sausages" names a 16-sausage pack, it is not an instruction to buy sixteen packs, so
   quantity there is null (or 1 only if a separate count says so) even though "16" is visibly written. If
   there is no separate count and the only number present belongs to the product's own name, leave quantity
   null. If the quantity is unreadable or ambiguous, also set quantity to null and status "unreadable".
   Never guess a quantity, and never infer one from a number embedded in a product descriptor.
7. If the same product appears twice, mark the later one "possible_duplicate".${sourceRegionTask}

Return ONLY strict JSON, no prose and no code fences:

{"lines":[{"line_no":1,
           "raw_reading":"what you believe is written",
           "quantity":null,
           "matched_regular_id":null,
           "match_basis":"one of: ${MATCH_BASES.join(' | ')}",
           "confidence":0.0,
           "alternatives":[],
           "status":"one of: ${STATUSES.join(' | ')}"${sourceRegionField}}]}

alternatives is a list of candidate ids. confidence is 0.0-1.0. matched_regular_id MUST be an id from the list
above, or null. Never write a product name into matched_regular_id.${sourceRegionNote}`;
}

module.exports = { buildGroundedPrompt, STATUSES, MATCH_BASES, renderCandidates, renderRegions, PROMPT_VERSION };
