// BUILD-015 AsdAIr Stage 1 - resolveByCatalogue.js
//
// THE AUTHORITY BOUNDARY, IN CODE:
//
//   the model      READS and RANKS   (raw_reading, candidate suggestions)
//   the catalogue  DETERMINES IDENTITY  <- this file
//   the human      RESOLVES genuine ambiguity
//   confirmed outcomes ENRICH ALIASES for next week
//
// The model never names a product. It supplies a raw reading; THIS module maps
// that reading onto a real `asdair.regulars.id`. Canonical names are looked up
// from our own catalogue by id, so a product that does not exist cannot appear
// in a basket no matter what a model says.
//
// PURE. No DB, no network, no clock, no randomness - the catalogue is passed in.
'use strict';

// WO-Y: normalisation and tolerant matching now come from ONE module, shared
// with skill/planner.js. They used to be written twice with DIFFERENT rules -
// the read path and the plan path disagreed about what "the same product"
// means, which is how a stored alias could satisfy one and not the other. The
// module is pure and zero-dependency, so requiring it keeps this file pure.
const termMatch = require('../skill/termMatch.js');

const normaliseTerm = termMatch.normaliseMatchText;
const stripLeadingQuantity = termMatch.stripLeadingQuantity;

const BASIS = Object.freeze({
  EXACT_ALIAS: 'exact alias',
  REGULAR: 'regular product',
  APPROX_ALIAS: 'approximate alias',
  BRAND_VARIANT: 'known brand + variant',
  PREVIOUS_ORDER: 'previous-order match',
});

function aliasesOf(reg) {
  return Array.isArray(reg.aka) ? reg.aka.filter(Boolean) : [];
}

// Does `haystack` contain every WHOLE WORD of `needle`? Word-boundary aware,
// unlike the raw substring test this replaces - see pass 3 below for why.
function tokensContain(haystack, needle) {
  const hay = termMatch.tokensOf(haystack);
  const need = termMatch.tokensOf(needle);
  if (need.length === 0) return false;
  return need.every((t) => hay.indexOf(t) !== -1);
}

/**
 * Resolve ONE raw reading against the household catalogue.
 *
 * Ordered strongest-evidence-first. Each pass must be UNAMBIGUOUS: if two
 * regulars answer equally well the line is handed to the human rather than
 * guessed, because two active regulars answering one term is precisely the
 * case that silently breaks a shop every week.
 *
 * @param {string} rawReading
 * @param {Array<object>} regulars - active regulars for the household
 * @param {{lastOrderNames?: string[]}} [opts]
 * @returns {{matched_regular_id: number|null, matched_product_name: string|null,
 *            match_basis: string|null, alternatives: Array<{id:number,name:string}>,
 *            status: string}}
 */
function resolveReading(rawReading, regulars, opts = {}) {
  const term = stripLeadingQuantity(rawReading);
  const none = { matched_regular_id: null, matched_product_name: null, match_basis: null, alternatives: [], status: 'unmatched_new_item' };
  if (!term) return { ...none, status: 'unreadable' };

  const hit = (regs, basis) => {
    if (regs.length === 1) {
      const r = regs[0];
      return { matched_regular_id: r.id, matched_product_name: r.name, match_basis: basis, alternatives: [], status: 'matched' };
    }
    if (regs.length > 1) {
      return {
        matched_regular_id: null,
        matched_product_name: null,
        match_basis: basis,
        alternatives: regs.map((r) => ({ id: r.id, name: r.name })),
        status: 'needs_confirmation',
      };
    }
    return null;
  };

  // 1. Exact alias - the household's own shorthand. Strongest signal there is.
  let out = hit(regulars.filter((r) => aliasesOf(r).some((a) => normaliseTerm(a) === term)), BASIS.EXACT_ALIAS);
  if (out) return out;

  // 2. Exact canonical name.
  out = hit(regulars.filter((r) => normaliseTerm(r.name) === term), BASIS.REGULAR);
  if (out) return out;

  // 2b. TOLERANT alias match (WO-Y). Word order and one-letter spelling only,
  //     via the shared matcher, and CONFIDENT tiers only. This is what makes
  //     "2 yazoo choc" reach the stored alias "choc yazoo", and
  //     "Double Glouester cheese" reach "double gloucester" - both real
  //     2026-08-03 failures against real stored aliases.
  out = hit(
    regulars.filter((r) => termMatch.bestMatch(rawReading, [r.name].concat(aliasesOf(r))).confident),
    BASIS.APPROX_ALIAS,
  );
  if (out) return out;

  // 3. Alias contained in the line, or the line inside an alias
  //    ("1 dreamies cheese large" vs alias "dreamies cheese").
  //
  //    WO-Y CORRECTION - REPORTED, and fixed because it is the same defect
  //    class this Work Order exists to close. This pass used raw SUBSTRING
  //    containment (`term.includes(na) || na.includes(term)`), which matches
  //    ACROSS WORD BOUNDARIES: a line reading "bread" resolved against an
  //    alias "shortbread", and "cream" against "ice cream". That is the
  //    silently-buys-the-wrong-product failure, and adding tolerance elsewhere
  //    while leaving it would have been indefensible. Containment is now
  //    TOKEN-WISE: every word of one side must appear as a whole word in the
  //    other. "dreamies cheese" still matches "1 dreamies cheese large";
  //    "bread" no longer matches "shortbread".
  out = hit(
    regulars.filter((r) => aliasesOf(r).some((a) => {
      const na = normaliseTerm(a);
      return na.length >= 4 && (tokensContain(term, na) || tokensContain(na, term));
    })),
    BASIS.APPROX_ALIAS,
  );
  if (out) return out;

  // 4. Strong word overlap with the canonical name (brand + variant).
  //    Requires >= 2 shared significant words, and a single clear winner.
  const words = new Set(term.split(' ').filter((w) => w.length > 3));
  const scored = regulars
    .map((r) => {
      const nw = normaliseTerm(r.name).split(' ').filter((w) => w.length > 3);
      const overlap = nw.filter((w) => words.has(w)).length;
      return { r, overlap, score: overlap / Math.max(1, Math.min(words.size, nw.length)) };
    })
    .filter((s) => s.overlap >= 2)
    .sort((a, b) => b.score - a.score || b.overlap - a.overlap);

  if (scored.length === 1 || (scored.length > 1 && scored[0].score > scored[1].score)) {
    const r = scored[0].r;
    return { matched_regular_id: r.id, matched_product_name: r.name, match_basis: BASIS.BRAND_VARIANT, alternatives: [], status: 'matched' };
  }
  if (scored.length > 1) {
    return {
      matched_regular_id: null, matched_product_name: null, match_basis: BASIS.BRAND_VARIANT,
      alternatives: scored.slice(0, 4).map((s) => ({ id: s.r.id, name: s.r.name })),
      status: 'needs_confirmation',
    };
  }

  // Nothing genuinely fits. Say so - never return the least-bad catalogue item
  // just because the output schema has a field for one.
  return none;
}

/**
 * Resolve a whole interpreted list. Marks a repeat of an already-resolved
 * regular as possible_duplicate rather than silently ordering it twice.
 */
function resolveAll(lines, regulars, opts = {}) {
  const seen = new Set();
  return lines.map((l, i) => {
    const r = resolveReading(l.raw_reading, regulars, opts);
    if (r.matched_regular_id != null) {
      if (seen.has(r.matched_regular_id)) r.status = 'possible_duplicate';
      seen.add(r.matched_regular_id);
    }
    return { line_no: l.line_no ?? i + 1, raw_reading: l.raw_reading, quantity: l.quantity ?? null, ...r };
  });
}

module.exports = { resolveReading, resolveAll, normaliseTerm, stripLeadingQuantity, BASIS };
