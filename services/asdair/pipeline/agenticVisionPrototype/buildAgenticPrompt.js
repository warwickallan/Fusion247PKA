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
 * @param {object} args
 * @param {Array<{name:string, aliases?:string[], source?:string}>} [args.catalogueItems]
 *   The household's known Regulars/Favourites, with any recorded aliases. May
 *   be empty (a household with no catalogue yet is still buildable).
 * @param {number[]} args.regionNos - every region_no the model may cite,
 *   1 = full_page, 2..N+1 = strips, from imagePrep.js's planRegions().
 * @returns {string} the prompt text for the FIRST /v1/responses turn.
 */
export function buildAgenticPrompt({ catalogueItems = [], regionNos }) {
  if (!Array.isArray(regionNos) || regionNos.length === 0) {
    throw new Error('buildAgenticPrompt: regionNos is required and must be non-empty');
  }
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
