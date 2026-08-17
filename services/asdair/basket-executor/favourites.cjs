// =====================================================================
// WO-2026-08-18-B15-RUNTIME - GAP 1. IDENTITY BY CANONICAL ASDA DESCRIPTION.
//
// WARWICK, REPEATEDLY, AND IT IS THE WHOLE MODULE:
//   "not all items have visible IDs - I keep telling you this - and we should
//    be working off the ASDA item name. I don't give a fuck about product id,
//    each ASDA description is unique."
//
// So the identity of a line is its ASDA DESCRIPTION. A stored `asda_product_id`
// is a shortcut that makes a known item faster to add; it is never what makes
// the item buyable, and its absence is never a reason a line cannot be shopped.
// 45 of the 109 catalogue rows carry no id and every one of them is an ordinary
// weekly product.
//
// -------------------------------------------------------------------------
// TWO SOURCES OF A CANONICAL DESCRIPTION, AND THEY ARE DIFFERENT THINGS
// -------------------------------------------------------------------------
//   THE HOUSEHOLD CATALOGUE  what WE call it, and what we know it is called on
//                            ASDA. `name` is the canonical ASDA description,
//                            `display_name` and `aka` are Mum's wordings. This
//                            is the bridge from "2 sliced roast beef" to
//                            "ASDA Sliced Topside of Beef 90g".
//   THE LIVE FAVOURITES GRID what ASDA is showing us RIGHT NOW, with the real
//                            reference attached. This is retrieval.
//
// Warwick's Ruling 2 (2026-08-09) is why they stay separate: "Known household
// identity and ASDA retrieval method are SEPARATE concerns. Search is
// RETRIEVAL; it does not redefine the item as new."
//
// -------------------------------------------------------------------------
// IT NEVER GUESSES, AND THAT IS LOAD-BEARING
// -------------------------------------------------------------------------
// A match is returned ONLY when exactly one favourite survives. Two survivors
// is not "pick the better one" - it falls through to the rung below (live
// search, then the model over real candidates), which is the layer that is
// allowed to reason. Zero survivors likewise falls through. This module can
// resolve a line or decline to; it can never choose between contenders.
//
// PURE. No I/O, no network, no clock.
// =====================================================================
'use strict';

/** Words that carry no identity and would let anything match anything. */
const STOPWORDS = new Set([
  'the', 'a', 'an', 'of', 'and', 'with', 'for', 'in', 'to', 'by', 'or',
  'pack', 'packs', 'pk', 'x', 'each', 'ea', 'size', 'value', 'new',
]);

/** A token that describes size or pack rather than identity. */
const SIZE_TOKEN = /^(\d+(\.\d+)?(g|kg|ml|l|cl|mg|litre|litres|pk|pack|s)?|\d+x\d+(\.\d+)?(g|kg|ml|l|cl|mg)?|x\d+)$/i;

/**
 * One comparable form for a product description.
 *
 * `6 x 50g`, `6x50g` and `6X50G` are the same pack and must not be three
 * different tokens - that difference alone is enough to make a correct match
 * look like a miss, which is how a product on the Favourites page gets
 * free-searched instead.
 */
function normalise(text) {
  return String(text == null ? '' : text)
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9.%]+/g, ' ')
    .replace(/(\d)\s+x\s+(\d)/g, '$1x$2')
    .replace(/(\d)\s+(g|kg|ml|l|cl|mg)\b/g, '$1$2')
    .replace(/\s+/g, ' ')
    .trim();
}

function tokens(text) {
  return normalise(text).split(' ').filter(Boolean);
}

/** The tokens that say WHAT the product is, with size and noise removed. */
function identityTokens(text) {
  return tokens(text).filter((t) => !STOPWORDS.has(t) && !SIZE_TOKEN.test(t) && t.length > 1);
}

/** The tokens that say HOW MUCH of it, which a different size must not satisfy. */
function sizeTokens(text) {
  return tokens(text).filter((t) => SIZE_TOKEN.test(t) && /\d/.test(t));
}

/**
 * Does `candidate` satisfy the identity `wanted` describes?
 *
 * Returns a score object rather than a boolean, because the CALLER needs to
 * know how strong the survivors were in order to decide whether to fall
 * through - and because a bare boolean would hide a one-token match behind the
 * same word as a full one.
 */
function score(wanted, candidate) {
  const want = identityTokens(wanted);
  const have = new Set(tokens(candidate));
  if (want.length === 0) return { matched: 0, wanted: 0, ratio: 0, sizeOk: false, strong: false };

  const matched = want.filter((t) => have.has(t)).length;
  const ratio = matched / want.length;

  // A size the line NAMES must be present. A size it does not name constrains
  // nothing - "beans" legitimately matches a 415g tin.
  const wantSizes = sizeTokens(wanted);
  const sizeOk = wantSizes.length === 0 || wantSizes.every((s) => have.has(s));

  return { matched, wanted: want.length, ratio, sizeOk, strong: ratio >= 0.75 && sizeOk };
}

/**
 * The household catalogue row for a manifest line, or null.
 *
 * Matched against the canonical ASDA `name`, the household `display_name` and
 * every `aka` - all three, because Mum writes "gourmet cat food" and ASDA calls
 * it "Gourmet GOURMET Mon Petit Intense Cod, Sardine, Salmon Wet Cat Food
 * 6x50g", and the catalogue exists precisely to carry that.
 *
 * Ambiguity declines rather than picks, same as everywhere else here.
 */
function catalogueRow(lineText, catalogue) {
  const rows = Array.isArray(catalogue) ? catalogue : ((catalogue && catalogue.rows) || []);
  const active = rows.filter((r) => r && r.active !== false);
  if (active.length === 0) return null;

  const scored = [];
  for (const row of active) {
    const forms = [row.name, row.display_name, ...(Array.isArray(row.aka) ? row.aka : [])]
      .filter((f) => typeof f === 'string' && f.trim() !== '');
    let best = null;
    for (const form of forms) {
      // Scored BOTH WAYS. "gourmet cat food" is a subset of the ASDA
      // description, so scoring only line-against-row misses it, and scoring
      // only row-against-line lets a two-word household name swallow half the
      // catalogue. The weaker of the two directions is not used; the STRONGER
      // one is, and the strength threshold is what stops a loose match.
      const a = score(lineText, form);
      const b = score(form, lineText);
      const take = a.ratio >= b.ratio ? a : b;
      if (!best || take.ratio > best.ratio) best = { ...take, form };
    }
    if (best && best.strong) scored.push({ row, ...best });
  }
  if (scored.length === 0) return null;

  scored.sort((x, y) => y.ratio - x.ratio || y.matched - x.matched);
  // A clear winner only. A tie between two catalogue rows is a household data
  // question, not something to settle silently in an executor.
  if (scored.length > 1 && scored[1].ratio === scored[0].ratio) return null;
  return scored[0].row;
}

/**
 * Find ONE favourite that is the product this line names.
 *
 * `queries` are the descriptions worth trying, best first: the canonical ASDA
 * description from the catalogue if we have one, then the manifest's own
 * wording. The first query with exactly one strong survivor wins.
 */
function matchFavourite(queries, favourites) {
  const list = (favourites || []).filter((f) => f && f.name);
  const tried = [];
  if (list.length === 0) return { resolved: false, reason: 'no-favourites-read', tried, contenders: [] };

  for (const q of queries.filter((x) => typeof x === 'string' && x.trim() !== '')) {
    const survivors = list
      .map((f) => ({ favourite: f, ...score(q, f.name) }))
      .filter((s) => s.strong)
      .sort((a, b) => b.ratio - a.ratio || b.matched - a.matched);

    tried.push({ query: q, survivors: survivors.length });

    if (survivors.length === 1) {
      const hit = survivors[0];
      return {
        resolved: true,
        product_ref: hit.favourite.product_ref || null,
        name: hit.favourite.name,
        query: q,
        why: `matched the Favourites entry "${hit.favourite.name}" on ${hit.matched}/${hit.wanted} identity tokens`,
        tried,
      };
    }

    if (survivors.length > 1) {
      // Two products on the grid both satisfy the description. That is a real
      // shopping question and it is NOT this module's to answer - the rung
      // below sees the same contenders and may reason about them.
      const top = survivors.filter((s) => s.ratio === survivors[0].ratio);
      if (top.length === 1) {
        return {
          resolved: true,
          product_ref: top[0].favourite.product_ref || null,
          name: top[0].favourite.name,
          query: q,
          why: `matched the Favourites entry "${top[0].favourite.name}" outright on ${top[0].matched}/${top[0].wanted} identity tokens, ahead of ${survivors.length - 1} weaker candidate(s)`,
          tried,
        };
      }
      return {
        resolved: false,
        reason: 'ambiguous-in-favourites',
        query: q,
        contenders: top.map((s) => ({ product_ref: s.favourite.product_ref || null, name: s.favourite.name })),
        tried,
      };
    }
  }

  return { resolved: false, reason: 'not-in-favourites', tried, contenders: [] };
}

/**
 * Every description worth searching for this line, best first.
 *
 * The canonical ASDA description leads when the catalogue knows one, because
 * that is the identity. The manifest's own text follows, because the catalogue
 * is allowed to be wrong or absent and the line as written is still Warwick's
 * approved wording (`new_item_search_exact_wording`).
 */
function queriesForLine(lineText, catalogue) {
  const row = catalogueRow(lineText, catalogue);
  const out = [];
  if (row && typeof row.name === 'string' && row.name.trim()) out.push(row.name.trim());
  if (typeof lineText === 'string' && lineText.trim()) out.push(lineText.trim());
  const seen = new Set();
  return {
    row,
    queries: out.filter((q) => { const k = normalise(q); if (seen.has(k)) return false; seen.add(k); return true; }),
  };
}

module.exports = {
  normalise, tokens, identityTokens, sizeTokens, score,
  catalogueRow, matchFavourite, queriesForLine, STOPWORDS,
};
