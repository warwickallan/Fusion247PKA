// =====================================================================
// BUILD-015 AsdAIr - agenticVisionPrototype/buildAgenticPrompt.js
//
// WO-2026-08-12-B15-VISION-PROTOTYPE-01 v2, AC2: builds the ONE instruction
// text sent on the FIRST turn of the agentic loop - household context +
// available regions + the request_crop tool's existence + the instruction to
// keep inspecting until the whole page is covered, not just the first pass.
//
// PURE. No I/O, no gateway call, no DB read - matches this package's
// established convention for prompt/plan builders (imagePrep.js,
// services/asdair/interpret/groundedPrompt.js).
//
// DELIBERATELY NOT REUSING services/asdair/interpret/groundedPrompt.js: that
// module builds the EXISTING single-pass pipeline's prompt and JSON-output
// contract (source_region citation, matched_regular_id/status/confidence,
// tuned across six rounds of hallucination-guard fixes) - a different,
// incompatible contract for a call that expects an IMMEDIATE final answer,
// not a conversational tool-calling loop. Reusing it here would either
// silently change that module's own behaviour risk profile or require
// reaching across a CJS/ESM boundary into a module this WP is explicitly
// forbidden to modify. This prototype writes its OWN, smaller prompt/output
// contract instead - genuinely standalone, per the Work Order's own
// instruction ("NOT wired into... any production call site").
//
// HOUSEHOLD CONTEXT SHAPE: `catalogueItems` is a flat array of
// `{name: string, aliases?: string[], source?: string}` - matching
// asdair.regulars' real columns (`name`, `aka` text[], `source` distinguishing
// 'regular' from 'favourite' rows in that SAME table; see
// services/asdair/db/004_asdair_regulars.sql). This module never fetches that
// data itself (no DB access, no credentials, `network: none`) - the caller
// (services/asdair/pipeline/agenticVisionPrototype/runAgenticVisionPrototype.js,
// run by Asdair with real credentials) supplies it already loaded.
//
// REGIONS: `regionNos` is the list of numbered regions the caller may cite,
// exactly as imagePrep.js's planRegions() numbers them (1 = full_page,
// 2..N+1 = strips, top to bottom) - the SAME numbering the committed probe's
// own test used ("Region 3 is blurry").
// =====================================================================

'use strict';

/** Render one catalogue item as one line: "Weetabix (aka: Weetabix Original, wheat biscuits)". */
function renderCatalogueLine(item) {
  const aliases = Array.isArray(item.aliases) && item.aliases.length > 0
    ? ` (aka: ${item.aliases.join(', ')})`
    : '';
  return `- ${item.name}${aliases}`;
}

/**
 * The CONSTRAINED rendering: every candidate carries the id the closed enum
 * will accept, because a model asked to return an id it was never shown can
 * only guess at one.
 */
function renderCandidateLine(item) {
  const aliases = Array.isArray(item.aliases) && item.aliases.length > 0
    ? ` | aka: ${item.aliases.join(', ')}`
    : '';
  const brand = item.brand ? ` | brand: ${item.brand}` : '';
  const category = item.category ? ` | ${item.category}` : '';
  const usual = item.typicalQty != null ? ` | usually ${item.typicalQty}` : '';
  return `- ${item.id}: ${item.name}${aliases}${brand}${category}${usual}`;
}

/**
 * @param {object} args
 * @param {Array<{name:string, aliases?:string[], source?:string}>} [args.catalogueItems]
 *   The household's known Regulars/Favourites, with any recorded aliases. May
 *   be empty (a household with no catalogue yet is still buildable).
 * @param {number[]} args.regionNos - every region_no the model may cite,
 *   1 = full_page, 2..N+1 = strips, from imagePrep.js's planRegions().
 * @returns {string} the prompt text for the FIRST /v1/responses turn.
 */
export function buildAgenticPrompt({ catalogueItems = [], regionNos, constrained = false }) {
  if (!Array.isArray(regionNos) || regionNos.length === 0) {
    throw new Error('buildAgenticPrompt: regionNos is required and must be non-empty');
  }
  if (constrained) return buildConstrainedPrompt({ catalogueItems, regionNos });
  const catalogueBlock = catalogueItems.length > 0
    ? catalogueItems.map(renderCatalogueLine).join('\n')
    : '(no known regulars or favourites recorded for this household yet)';

  return `You are reading a photograph of a handwritten household shopping list.

THE HOUSEHOLD'S KNOWN PRODUCTS (their regulars and favourites, with any alternative names they use):
${catalogueBlock}

AVAILABLE IMAGE REGIONS you may request a closer look at: ${regionNos.join(', ')} (region 1 is the whole page; the rest are overlapping strips top to bottom).

You are shown the whole page first. You have a request_crop tool: call it with a region number whenever you are not confident you have correctly and completely read everything written in that part of the page. Do not guess at content you cannot read clearly - request a crop instead. Keep inspecting, region by region, until you are genuinely confident you have covered the WHOLE page - not just your first pass over it. Only once you are confident nothing has been missed, stop requesting crops and give your final answer.

When you are ready to give your final answer (and only then, never alongside a tool call), respond with ONLY strict JSON, no prose and no code fences, in this exact shape:

{"lines":[{"line_no":1,"raw_reading":"what you believe is written, verbatim","quantity":null,"source_region":1}]}

- raw_reading: exactly what is written for this item - never a product name you invented or corrected against the household's known products above. The known-products list is context to help you READ unclear handwriting, never evidence that a line exists.
- quantity: only a number that is SEPARATE evidence of how many to buy (a count written before the item, or an explicit multiplier). A number that is part of the item's own name or pack size is never the quantity. If there is no separate count, quantity is null - never guess it.
- source_region: the region_no (from the list above) where you actually read this line. Never invent a region_no outside that list.
- List EVERY line you found, across every region you inspected, not only the first page you saw.`;
}

/**
 * ── WO-2026-08-12-01-v2 (WP-B15-29), AC2/AC3/AC7: the CONSTRAINED prompt ──
 *
 * Paired with lineSchema.js's strict schema. The schema makes an out-of-enum
 * identity IMPOSSIBLE; this text is what makes an honest UNKNOWN ATTRACTIVE,
 * and the two only work together. Enforcement alone changed the observed
 * failure mode from invention to confident mis-identification (5/5) and
 * silent omission (2/5) - so a prompt that does not actively welcome the
 * escape values converts one detectable failure into two harder ones.
 *
 * Rules 1, 3, 4 and 6 below are the six-rounds-tuned wording from
 * services/asdair/interpret/groundedPrompt.js, reused as instructed rather
 * than re-derived - including its own hard-won caution that the existence
 * rule governs LINE EXISTENCE ONLY and must never be read as a licence to
 * suppress a quantity that genuinely is written (a measured regression when
 * that caution was absent).
 */
function buildConstrainedPrompt({ catalogueItems, regionNos }) {
  const candidateBlock = catalogueItems.length > 0
    ? catalogueItems.map(renderCandidateLine).join('\n')
    : '(no known regulars or favourites recorded for this household yet - every visible line will therefore be UNKNOWN_VISIBLE_ITEM, which is the correct answer, not a failure)';

  return `You are reading a photograph of a handwritten household shopping list.

THE HOUSEHOLD'S CANDIDATE PRODUCTS (id: name, with brand/category/aliases/usual quantity). The id is the ONLY product identity you may return:
${candidateBlock}

AVAILABLE IMAGE REGIONS you may cite or request: ${regionNos.join(', ')} (region 1 is the whole page; the rest are overlapping strips top to bottom).

You are shown the whole page first. You have a request_crop tool: call it with a region number whenever you are not confident you have correctly and completely read everything written in that part of the page. Do not guess at content you cannot read clearly - request a crop instead. Keep inspecting, region by region, until you are genuinely confident you have covered the WHOLE page - not just your first pass over it. Only once you are confident nothing has been missed, stop requesting crops and give your final answer.

TASK - two SEPARATE questions per line, in this order. Do not merge them.

1. DOES A LINE EXIST HERE? Locate EVERY handwritten line on the page, in page order. Do not drop a line because you are unsure of it, and do not add a line that is not visibly there. A product appearing in THE HOUSEHOLD'S CANDIDATE PRODUCTS is NEVER on its own evidence that it is written on THIS week's page - only a real handwritten mark is. Report a line because you can SEE it, never because it would be a plausible or likely thing for this household to buy. Set visible_line true when you can see writing, false when you cannot. This caution governs ONLY whether a LINE exists on the page - it says nothing about quantity. Do not let it make you leave quantity blank on a line that DOES show one.

2. WRITE DOWN WHAT YOU ACTUALLY SEE. as_written is your best literal reading of the marks, verbatim, including shorthand and spelling as written. This is the ONLY field where you write your own words. Never replace it with a tidied or catalogue-matched product name - it is the record of what the page says, not of what you concluded.

3. ONLY THEN, WHICH CANDIDATE IS IT? For a line you have ALREADY established exists, choose the candidate id that it most likely refers to.
   - Use the aliases. The household writes shorthand: their own alias list is the strongest signal.
   - Use brand, category and usual quantity as supporting evidence.

4. IF IT MATCHES NO CANDIDATE, say so: product_id UNKNOWN_VISIBLE_ITEM. DO NOT pick the least-bad candidate just to fill the field. A wrong confident match is far worse than an honest "I don't know" - it puts the wrong thing in a real shopping basket. An UNKNOWN_VISIBLE_ITEM is a correct, welcome, fully successful answer and costs this household almost nothing; a confident wrong id costs them a wrong delivery.

5. IF THERE IS NO SHOPPING LINE THERE AT ALL - a header, a smudge, a stray mark, a crossing-out - set visible_line false and product_id NOT_A_LINE. Do not silently drop it and do not dress it up as a product.

6. QUANTITY: only record a number that is SEPARATE evidence of how many to buy - a count written before the product name (e.g. "2 Yazoo choc"), or an explicit multiplier like "x3" or "buy 2". A number that is part of the product's own printed name or pack size is NEVER the quantity by itself - for example the "16" in "Richmond 16 Pork Sausages" names a 16-sausage pack, it is not an instruction to buy sixteen packs, so quantity there is null even though "16" is visibly written. If there is no separate count, or the quantity is unreadable or ambiguous, quantity is null. Never guess a quantity, and never infer one from a number embedded in a product descriptor.

7. SOURCE_REGION: the region number where you actually read this line. Only a number from AVAILABLE IMAGE REGIONS is valid - never invent one.

8. CONFIDENCE: your confidence in the READING, 0 to 1. It only decides whether the page is worth another look. It never makes a line acceptable, so do not inflate it.

9. If the same physical line appears in two regions, report it in both and cite each region honestly. The application resolves duplicates; you do not need to hide one.

Your final answer is returned in the enforced JSON schema. List EVERY line you found, across every region you inspected, not only the first page you saw.`;
}
