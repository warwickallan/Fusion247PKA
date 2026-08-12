// =====================================================================
// BUILD-015 AsdAIr Stage 1 - pipeline/test/groundedPromptRegionContract.test.js
//
// WO-2026-08-11-B15-VISION-01, AC1/AC2/AC3 proof for the region-citation
// contract added to interpret/groundedPrompt.js (a file granted to Keel by
// Amendment 1 of the Work Order, not by the original file_surface). This
// test lives here, inside pipeline/test/, rather than beside
// groundedPrompt.js itself: the Amendment granted exactly one file
// (groundedPrompt.js), not a new sibling test file under services/asdair/
// interpret/, so the proof reaches across the package boundary the same way
// deps.js already does (createRequire), rather than writing outside the
// declared surface.
//
// TWO CLAIMS, both executed rather than asserted in prose:
//   1. REGRESSION: buildGroundedPrompt(catalogue) with NO options argument
//      is BYTE-IDENTICAL to the prompt this module produced before this
//      Work Order - every existing caller (interpret-list.js, its own
//      tests, pipeline/test/harness.js) is provably unaffected.
//   2. THE NEW CONTRACT: passing {regions} adds a required, region-list-
//      bounded `source_region` field to both the prompt text and the JSON
//      schema it asks for - proven against the ACTUAL exported prompt
//      string, not a paraphrase of it.
//
// Runs under: node --test (no DB, no model, no network).
// =====================================================================

import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { buildGroundedPrompt, STATUSES, MATCH_BASES, PROMPT_VERSION } = require('../../interpret/groundedPrompt.js');

const CATALOGUE = {
  candidates: [
    { id: 101, name: 'Cravendale Semi-Skimmed Milk 2L', brand: 'Cravendale', category: 'dairy', aka: ['milk'], typical_qty: 2 },
    { id: 102, name: 'Warburtons Toastie White 800g', brand: 'Warburtons', category: 'bakery' },
  ],
  rules: [{ directive: 'never_auto_substitute', match_term: 'Vanish', matched_product: 'Vanish Gold' }],
  last_order: { lines: [{ qty: 2, item_name: 'Cravendale Semi-Skimmed Milk 2L' }] },
};

// The EXACT prompt template this module currently produces (as of
// WO-2026-08-12-B15-VISION-02 AC1's quantity-evidence rewording of step 6 -
// originally reconstructed for WO-2026-08-11-B15-VISION-01 at governance
// head 095503af..., kept in sync with every intentional wording change since)
// - reconstructed literally, not regenerated, so a silent, UNINTENTIONAL
// change to the no-options path is caught by string equality rather than by
// a test that could drift alongside an accidental behaviour change. An
// INTENTIONAL wording change (like AC1's) updates this reconstruction in the
// SAME commit, never leaves it to silently diverge.
function originalPrompt(catalogue) {
  const renderCandidates = (candidates) => candidates
    .map((c) => {
      const bits = [`${c.id}: ${c.name}`];
      if (c.brand) bits.push(`brand=${c.brand}`);
      if (c.category) bits.push(`cat=${c.category}`);
      if (c.aka && c.aka.length) bits.push(`aka=${c.aka.join('|')}`);
      if (c.typical_qty != null) bits.push(`usual_qty=${c.typical_qty}`);
      return '  ' + bits.join('  ');
    })
    .join('\n');
  const renderRules = (rules) => (!rules || !rules.length ? '  (none)' : rules
    .map((r) => `  [${r.directive}] ${r.match_term ? r.match_term + ' -> ' : ''}${r.matched_product || r.text}`)
    .join('\n'));
  const renderLastOrder = (lastOrder) => (!lastOrder || !lastOrder.lines.length ? '  (no previous completed order)'
    : lastOrder.lines.map((l) => `  ${l.qty ?? '?'} x ${l.item_name}`).join('\n'));

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
6. Quantity: only record a number that is SEPARATE evidence of how many to buy - a count written before the
   product name (e.g. "2 Yazoo choc"), or an explicit multiplier like "x3" or "buy 2". A number that is part
   of the product's own printed name or pack size is NEVER the quantity by itself - for example the "16" in
   "Richmond 16 Pork Sausages" names a 16-sausage pack, it is not an instruction to buy sixteen packs, so
   quantity there is null (or 1 only if a separate count says so) even though "16" is visibly written. If
   there is no separate count and the only number present belongs to the product's own name, leave quantity
   null. If the quantity is unreadable or ambiguous, also set quantity to null and status "unreadable".
   Never guess a quantity, and never infer one from a number embedded in a product descriptor.
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

test('REGRESSION: buildGroundedPrompt(catalogue) with no options is byte-identical to the pre-WP prompt', () => {
  assert.equal(buildGroundedPrompt(CATALOGUE), originalPrompt(CATALOGUE));
});

test('REGRESSION: buildGroundedPrompt(catalogue, {}) (empty options) is also byte-identical', () => {
  assert.equal(buildGroundedPrompt(CATALOGUE, {}), originalPrompt(CATALOGUE));
});

test('REGRESSION: buildGroundedPrompt(catalogue, {regions: []}) (empty regions) is also byte-identical', () => {
  assert.equal(buildGroundedPrompt(CATALOGUE, { regions: [] }), originalPrompt(CATALOGUE));
});

const REGIONS = [
  { region_no: 1, region_kind: 'full_page' },
  { region_no: 2, region_kind: 'strip' },
  { region_no: 3, region_kind: 'strip' },
];

test('region contract: lists every region_no the model may cite, and no others', () => {
  const prompt = buildGroundedPrompt(CATALOGUE, { regions: REGIONS });
  assert.match(prompt, /AVAILABLE IMAGE REGIONS/);
  assert.match(prompt, /region 1: the full page/);
  assert.match(prompt, /region 2: a strip of the page/);
  assert.match(prompt, /region 3: a strip of the page/);
});

test('region contract: the JSON schema requires source_region and states its bounded values', () => {
  const prompt = buildGroundedPrompt(CATALOGUE, { regions: REGIONS });
  assert.match(prompt, /"source_region":\d+/, 'the JSON example must include the new field');
  assert.match(prompt, /source_region is REQUIRED on every line and MUST be one of: 1, 2, 3/);
});

test('region contract: explicitly forbids the model asserting its own coordinates', () => {
  const prompt = buildGroundedPrompt(CATALOGUE, { regions: REGIONS });
  assert.match(prompt, /you may NEVER assert your own coordinates/);
});

test('region contract: does not corrupt the existing catalogue/rules/last-order sections', () => {
  const prompt = buildGroundedPrompt(CATALOGUE, { regions: REGIONS });
  assert.match(prompt, /101: Cravendale Semi-Skimmed Milk 2L/);
  assert.match(prompt, /\[never_auto_substitute\] Vanish -> Vanish Gold/);
  assert.match(prompt, /2 x Cravendale Semi-Skimmed Milk 2L/);
});

test('a single-region plan (no strips) still produces a valid, bounded contract', () => {
  const prompt = buildGroundedPrompt(CATALOGUE, { regions: [{ region_no: 1, region_kind: 'full_page' }] });
  assert.match(prompt, /source_region is REQUIRED on every line and MUST be one of: 1\./);
});

test('PROMPT_VERSION is exported and non-empty - the value shop_line_provenance.prompt_version records on every PHOTO row', () => {
  assert.equal(typeof PROMPT_VERSION, 'string');
  assert.ok(PROMPT_VERSION.length > 0 && PROMPT_VERSION.length <= 100, 'must also satisfy migration 020\'s prompt_version length CHECK');
});
