// =====================================================================
// WO-2026-08-17-B15-BASKET - THE FROZEN MANIFEST, TURNED INTO A STEP PLAN.
//
// The manifest is IMMUTABLE INPUT. Nothing here regenerates it, re-derives it
// from the database, or repairs it: it carries deliberate corrections that the
// durable rows do not have (line 16 qty 5, line 31 the CONDITIONER not the
// shampoo, line 18 qty 1 on Warwick's direct instruction), so a "smarter"
// reading of the source data would silently undo them.
//
// TWO ROUTES, DECIDED BY ONE FACT - does the line carry an ASDA id?
//
//   id present  ->  add_known_product(ref), then set_quantity(ref, qty)
//   id absent   ->  search(term), a JUDGEMENT over the live candidates, then
//                   select_search_result(term, ref), then set_quantity(ref, qty)
//
// set_quantity ALWAYS runs, including for qty 1. SOP-021 fact 10 is the most
// expensive recorded lesson in this build: ASDA's saved per-product quantity
// survives a full reload and silently overrides the list. An add that lands on
// a saved quantity of 3 is wrong at qty 1, and nothing on the page says so.
// =====================================================================
'use strict';

const { COMMANDS, normaliseTerm, normaliseQty, normaliseProductRef } = require('../browser-runner/commands.cjs');

const STEP_ID = /^[A-Za-z0-9_.:-]{1,64}$/;

/**
 * A search term ASDA's URL allowlist and commands.cjs will both accept.
 *
 * normaliseTerm REJECTS (never sanitises) anything outside
 * [A-Za-z0-9 &'.\-%+], and real manifest lines contain characters it refuses -
 * "Gourmet Mon Petit Intense Cod, Sardine, Salmon Wet Cat Food 6x50g" has
 * commas. Refusing the line would lose the product; rewriting the manifest is
 * forbidden. So the QUERY is sanitised and the manifest text is left untouched
 * and carried forward for the identity judgement.
 */
function sanitiseTerm(text) {
  const s = String(text == null ? '' : text)
    .replace(/[^A-Za-z0-9 &'.\-%+]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 80)
    .trim();
  return s;
}

/** Tokens that describe a size or pack rather than the product's identity. */
const SIZE_TOKEN = /^(\d+(\.\d+)?\s*(g|kg|ml|l|litre|litres|pk|pack|x)|\d+x\d+|x\d+|\d+(\.\d+)?(g|kg|ml|l)|\d+)$/i;

/**
 * Ordered search queries for one line: the full sanitised name first, then a
 * shorter identity-only query as a fallback.
 *
 * The fallback exists because ASDA's search returns nothing for an over-long
 * query carrying a size the catalogue words differently ("680 ml" vs "680ml").
 * A zero-result search is indistinguishable from an out-of-stock product unless
 * something tries a second, looser query - and reporting "not found" for a
 * product that is on the shelf is the failure this avoids.
 */
function searchTerms(productText) {
  const full = sanitiseTerm(productText);
  const out = [];
  if (full) out.push(full);

  const words = full.split(' ').filter(Boolean);
  const identity = words.filter((w) => !SIZE_TOKEN.test(w)).slice(0, 5).join(' ');
  if (identity && identity !== full && identity.length >= 3) out.push(identity);

  return out.filter((t) => {
    try { normaliseTerm(t); return true; } catch { return false; }
  });
}

/**
 * Does this line's note authorise choosing a MULTIPACK and adjusting quantity
 * accordingly? Data-driven off the note text, never off a line number: the
 * manifest is the authority and a hard-coded `n === 16` would silently stop
 * matching the day the manifest changes.
 *
 * Line 16 is the worked case - "Prefer a 5 x 200g multipack; if none exists add
 * FIVE single tins" - and the branch that actually fires is REPORTED either way.
 */
function packBranchAllowed(line) {
  return /multipack/i.test(String(line.note || ''));
}

/** One line of the frozen manifest -> its ordered steps. */
function stepsForLine(line) {
  const n = Number(line.n);
  const tag = `L${String(n).padStart(2, '0')}`;
  const qty = normaliseQty(line.qty);
  const hasId = line.asda_product_id != null && String(line.asda_product_id).trim() !== '';

  const common = {
    line: n,
    product: line.product,
    note: line.note || null,
    qty,
    pack_branch_allowed: packBranchAllowed(line),
  };

  if (hasId) {
    const ref = normaliseProductRef(line.asda_product_id);
    return [
      { step_id: `${tag}-add`, command: 'add_known_product', product_ref: ref, origin: 'regular', ...common },
      { step_id: `${tag}-qty`, command: 'set_quantity', product_ref: ref, origin: 'regular', ...common },
    ];
  }

  const terms = searchTerms(line.product);
  if (terms.length === 0) {
    return [{ step_id: `${tag}-hold`, command: 'report_unavailable', product_ref: null, origin: 'searched', unresolvable: true, ...common }];
  }
  return [
    { step_id: `${tag}-find`, command: 'search', terms, origin: 'searched', product_ref: null, ...common },
    { step_id: `${tag}-qty`, command: 'set_quantity', product_ref: null, origin: 'searched', ...common },
  ];
}

/**
 * The whole manifest -> the whole plan. Every command is checked against the
 * browser-runner allowlist, so this module cannot introduce an action the
 * closed command surface does not already permit.
 */
function buildPlan(manifest) {
  if (!manifest || !Array.isArray(manifest.lines)) throw new Error('manifest has no lines[]');

  const steps = [];
  const seen = new Set();
  for (const line of manifest.lines) {
    for (const step of stepsForLine(line)) {
      if (!STEP_ID.test(step.step_id)) throw new Error(`unsafe step_id: ${JSON.stringify(step.step_id)}`);
      if (seen.has(step.step_id)) throw new Error(`duplicate step_id ${step.step_id}`);
      if (!Object.prototype.hasOwnProperty.call(COMMANDS, step.command)) {
        throw new Error(`command not on the browser-runner allowlist: ${step.command}`);
      }
      seen.add(step.step_id);
      steps.push(step);
    }
  }
  return steps;
}

/** Lines grouped for the report: which arrived with an id, which must be found. */
function planSummary(manifest) {
  const withId = manifest.lines.filter((l) => l.asda_product_id != null && String(l.asda_product_id).trim() !== '');
  return {
    line_count: manifest.lines.length,
    with_stored_id: withId.length,
    needing_search: manifest.lines.length - withId.length,
  };
}

module.exports = { buildPlan, stepsForLine, searchTerms, sanitiseTerm, packBranchAllowed, planSummary, STEP_ID };
