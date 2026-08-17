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
   ONE LINE ON THE PAPER IS ONE LINE IN YOUR ANSWER. Two lines that look alike are still TWO lines and must
   both appear, even where they share a brand, a size or nearly the same words. Never merge two lines, and
   never leave one out because you have already written something similar. On 17 August "1 x 6pk Heinz baked
   beans" and "1 x 5pk Heinz sausage & beans" were returned as one line, so the sausage and beans were never
   bought and nobody noticed until the food arrived.
2. For each line, record raw_reading: your best literal reading of the marks. This is the ONLY field where you
   write your own words, and it must be what is PHYSICALLY WRITTEN.
   - KEEP THE BRAND. "ASDA", "Heinz", "Warburtons" written on the page belong in the reading.
   - KEEP THE PACK. "4pk", "6pk", "5pk", "4pt", "6 pint" belong in the reading.
   - Never replace what is written with something that merely sounds like it. On 17 August "2 sliced roast
     beef" came back as "2 skinny cow bars" - a branded-sounding product that is not on the paper and has
     never been in this household's list. Read the marks; do not reach for a plausible product.
3. Then choose the candidate id from the list above that the line most likely refers to.
   - Use the aliases. The household writes shorthand: their own alias list is the strongest signal.
   - Use brand, category and usual quantity as supporting evidence.
   - Use what they bought last time - a line that matches a previous purchase is very likely that product.
   - Your id is EVIDENCE, not the decision. The household's own catalogue settles identity afterwards, so an
     honest null costs nothing and a confident wrong id costs the wrong food.
4. If a line genuinely matches NO candidate, set matched_regular_id to null and status "unmatched_new_item".
   DO NOT pick the least-bad candidate just to fill the field. A wrong confident match is far worse than an
   honest "I don't know" - it puts the wrong thing in a real shopping basket.
5. If two candidates are both plausible, set status "needs_confirmation" and list BOTH in alternatives.
6. NUMBERS. A line often carries TWO different numbers and they mean different things:
       "2 x 4pk orange sport Lucozade"  ->  quantity 2 (how many she wants), pack_size 4 (what is in a pack)
       "1 x 6pk Heinz baked beans"      ->  quantity 1, pack_size 6
       "6 ASDA large free range eggs"   ->  quantity null, pack_size 6 (one box OF six)
   Record quantity ONLY when you can see how many she is asking for, and pack_size ONLY when the pack is
   written. If either is unreadable or ambiguous, set it to null - and if the QUANTITY is the unreadable one,
   set status "unreadable". Never guess a number. On 17 August "2 x 4pk orange sport Lucozade" was recorded
   as one pack, so half the drinks were missing.
7. The same product may legitimately appear twice on one list. Report both lines exactly as written and let
   the household's own records decide - do NOT drop, merge or silently rewrite the second one.

Return ONLY strict JSON, no prose and no code fences:

{"lines":[{"line_no":1,
           "raw_reading":"what you believe is written",
           "quantity":null,
           "pack_size":null,
           "matched_regular_id":null,
           "match_basis":"one of: ${MATCH_BASES.join(' | ')}",
           "confidence":0.0,
           "alternatives":[],
           "status":"one of: ${STATUSES.join(' | ')}"}]}

alternatives is a list of candidate ids. confidence is 0.0-1.0. matched_regular_id MUST be an id from the list
above, or null. Never write a product name into matched_regular_id.`;
}

module.exports = { buildGroundedPrompt, STATUSES, MATCH_BASES, renderCandidates };
