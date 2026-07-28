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
'use strict';

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

/**
 * @param {object} catalogue - from loadCatalogue()
 * @returns {string} the grounded prompt
 */
function buildGroundedPrompt(catalogue) {
  return `You are helping interpret a photograph of a handwritten weekly shopping list for ONE household.

You are NOT transcribing arbitrary handwriting. This household buys the same things most weeks. Your job is to
work out WHICH OF THEIR KNOWN PRODUCTS each handwritten line most likely refers to.

THE HOUSEHOLD'S KNOWN PRODUCTS (id: name, with brand/category/aliases/usual quantity):
${renderCandidates(catalogue.candidates)}

STANDING RULES THAT AFFECT INTERPRETATION:
${renderRules(catalogue.rules)}

WHAT THEY BOUGHT LAST TIME (useful prior - they repeat most weeks):
${renderLastOrder(catalogue.last_order)}

TASK
1. Locate EVERY handwritten line on the page, in page order. Do not drop a line because you are unsure of it,
   and do not add a line that is not visibly there.
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
6. Quantity: only record a number you can actually SEE. If the quantity is unreadable or ambiguous, set
   quantity to null and status "unreadable". Never guess a quantity.
7. If the same product appears twice, mark the later one "possible_duplicate".

Return ONLY strict JSON, no prose and no code fences:

{"lines":[{"line_no":1,
           "raw_reading":"what you believe is written",
           "quantity":null,
           "matched_regular_id":null,
           "match_basis":"one of: ${MATCH_BASES.join(' | ')}",
           "confidence":0.0,
           "alternatives":[],
           "status":"one of: ${STATUSES.join(' | ')}"}]}

alternatives is a list of candidate ids. confidence is 0.0-1.0. matched_regular_id MUST be an id from the list
above, or null. Never write a product name into matched_regular_id.`;
}

module.exports = { buildGroundedPrompt, STATUSES, MATCH_BASES, renderCandidates };
