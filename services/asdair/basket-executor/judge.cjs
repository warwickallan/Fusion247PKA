// =====================================================================
// WO-2026-08-17-B15-BASKET - THE JUDGEMENT LAYER.
//
// The hands can already search: browser.cjs `search(term)` navigates a search
// URL - no keyboard, because Input.* is a forbidden CDP domain - and returns up
// to 40 live candidates as {product_ref, href, name}. And `select_search_result`
// already refuses any reference that is not in that live result set.
//
// So discovery is NOT rebuilt here and the invention guard is NOT
// re-implemented. The model has exactly one job:
//
//     WHICH of these candidates is the product the manifest names?
//     Brand, variant, size, pack. Abstain when several remain plausible.
//
// THREE THINGS THIS MODULE WILL NOT DO, and each is enforced in code below
// rather than asked for in the prompt:
//
//   1. It never returns a reference the live search did not return. The model's
//      answer is looked up in the candidate set; a miss is an abstention, not a
//      correction. (browser.cjs enforces this a second time at the click.)
//   2. It never resolves a line by "closest match". Low confidence, an unparsable
//      answer, a refusal, or a gateway failure all land on the SAME outcome -
//      ambiguous, reported with its candidates, line skipped.
//   3. It never sees or handles a credential. The gateway client owns that; this
//      module calls answer(prompt) and reads a string back.
// =====================================================================
'use strict';

/** The gateway's ANSWER role, loaded lazily so the proofs need no gateway. */
async function defaultAnswerFn(prompt) {
  const { answer } = await import('../../obsidiwikai/src/core/models.mjs');
  return answer(prompt);
}

function candidateBlock(candidates) {
  return candidates
    .map((c, i) => `${i + 1}. product_ref=${c.product_ref} | ${String(c.name || '').replace(/\s+/g, ' ').trim()}`)
    .join('\n');
}

function buildPrompt(line, candidates) {
  return [
    'You are matching ONE line of a household shopping list to ONE product from a live ASDA search result set.',
    '',
    'THE LINE THE HOUSEHOLD ASKED FOR:',
    `  product: ${line.product}`,
    `  quantity wanted: ${line.qty}`,
    line.note ? `  note (this note OVERRIDES any looser reading of the product name): ${line.note}` : '  note: none',
    '',
    'THE LIVE CANDIDATES (these are the only products you may choose from):',
    candidateBlock(candidates),
    '',
    'HOW TO DECIDE:',
    '- Match on BRAND, VARIANT, SIZE and PACK. All four matter.',
    '- A different size or pack count is a DIFFERENT product, not a near miss.',
    '- A note naming an exact size, an exact variant, or a product to avoid is binding.',
    '- If two or more candidates remain materially plausible, ABSTAIN. Do not pick the closest.',
    '- If nothing in the list is the product asked for, ABSTAIN.',
    '- Never answer with a product_ref that is not in the list above.',
    '',
    'ANSWER WITH STRICT JSON AND NOTHING ELSE, in one of exactly these two shapes:',
    '  {"product_ref": "<one product_ref copied exactly from the list>", "why": "<short reason>"}',
    '  {"ambiguous": true, "why": "<short reason>"}',
  ].join('\n');
}

/** Pull the first JSON object out of a model reply, tolerating code fences and prose. */
function parseReply(raw) {
  const text = String(raw == null ? '' : raw).trim();
  if (!text) return null;
  const fenced = text.replace(/^```(?:json)?/i, '').replace(/```$/, '').trim();
  const start = fenced.indexOf('{');
  const end = fenced.lastIndexOf('}');
  if (start === -1 || end === -1 || end <= start) return null;
  try { return JSON.parse(fenced.slice(start, end + 1)); } catch { return null; }
}

/**
 * Decide one line against one live candidate set.
 *
 * Resolves to:
 *   { resolved: true,  product_ref, name, why, model_raw }
 *   { resolved: false, reason, why, candidates, model_raw }
 *
 * It NEVER rejects and never throws for an unhelpful model - an abstention is a
 * legitimate, reportable outcome and the line is simply skipped.
 */
async function judgeLine(line, candidates, { answerFn = defaultAnswerFn, maxCandidates = 25, log = () => {} } = {}) {
  const list = (candidates || []).filter((c) => c && c.product_ref).slice(0, maxCandidates);

  if (list.length === 0) {
    return { resolved: false, reason: 'no-search-results', why: 'the live search returned no products for this line', candidates: [], model_raw: null };
  }

  const byRef = new Map(list.map((c) => [String(c.product_ref), c]));
  const prompt = buildPrompt(line, list);

  let raw;
  try {
    raw = await answerFn(prompt);
  } catch (e) {
    return { resolved: false, reason: 'gateway-failed', why: e && e.message ? e.message.slice(0, 200) : 'gateway call failed', candidates: list.slice(0, 10), model_raw: null };
  }

  const parsed = parseReply(raw);
  if (!parsed) {
    return { resolved: false, reason: 'unparsable-answer', why: 'the model did not return usable JSON', candidates: list.slice(0, 10), model_raw: String(raw || '').slice(0, 400) };
  }
  if (parsed.ambiguous === true || parsed.product_ref == null) {
    return { resolved: false, reason: 'model-abstained', why: String(parsed.why || 'the model abstained').slice(0, 300), candidates: list.slice(0, 10), model_raw: String(raw || '').slice(0, 400) };
  }

  const ref = String(parsed.product_ref).trim();
  const hit = byRef.get(ref);
  if (!hit) {
    // The model named something the live search did not return. This is the
    // invention case and it is treated as an abstention - never as a hint to go
    // and look the reference up.
    log(`line ${line.line}: model named product_ref ${ref}, which is not in the live result set - treating as ambiguous`);
    return { resolved: false, reason: 'answer-not-in-candidates', why: `the model named ${ref}, which the live search did not return`, candidates: list.slice(0, 10), model_raw: String(raw || '').slice(0, 400) };
  }

  return { resolved: true, product_ref: hit.product_ref, name: hit.name || null, why: String(parsed.why || '').slice(0, 300), model_raw: String(raw || '').slice(0, 400) };
}

module.exports = { judgeLine, buildPrompt, parseReply, defaultAnswerFn };
