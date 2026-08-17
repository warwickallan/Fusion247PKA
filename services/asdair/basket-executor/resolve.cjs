// =====================================================================
// WO-2026-08-18-B15-RUNTIME - GAPS 1 AND 6. THE RESOLUTION LADDER.
//
// THE ORDER IS WARWICK'S, SETTLED, AND NOT TO BE RE-DERIVED:
//
//   stored id if present
//     -> otherwise Favourites/Regulars identity by canonical ASDA description
//     -> otherwise live ASDA search on that description
//     -> model evaluates the real candidates
//     -> choose when clear
//     -> abstain only on genuine ambiguity
//     -> harvest the id afterwards AS AN OPTIMISATION ONLY
//
// What the 2026-08-17 executor did instead was rung 1, then jump straight to
// rung 3 - one free search per line, ~40s each, for products that were on the
// Favourites grid the whole time. All four abstentions came from that jump.
// Warwick's screenshots showed two of them sitting in Favourites with
// unambiguous identity.
//
// -------------------------------------------------------------------------
// GAP 6: UNAVAILABLE IS NOT AMBIGUOUS. TWO STATES, TWO HANDLINGS.
// -------------------------------------------------------------------------
//   UNAVAILABLE  ASDA cannot supply it. Record it, leave it OUT, report it.
//                Nobody is asked anything - there is nothing to decide.
//   AMBIGUOUS    Several products could genuinely be the one wanted. The line
//                stops and a question goes out.
//
// Last night an out-of-stock Sweetex was reported as a pack-size ambiguity,
// which put a question in front of Warwick that no answer of his could have
// resolved. The cause is visible in the old code: `judgeLine` maps
// "no-search-results" onto an abstention, so a product that ASDA simply does
// not have came back looking like a decision. Zero candidates is not a choice
// between candidates. It is an absence, and it is reported as one here.
//
// PURE-ISH: the only I/O is through the injected `session` and `judge`, so the
// whole ladder is provable with fakes and no browser and no gateway.
// =====================================================================
'use strict';

const { matchFavourite, queriesForLine } = require('./favourites.cjs');

/** Outcome kinds. `unavailable` and `ambiguous` are deliberately not one type. */
const UNRESOLVED = Object.freeze({
  UNAVAILABLE: 'unavailable',
  AMBIGUOUS: 'ambiguous',
  NO_SEARCH_TERM: 'no-usable-search-term',
});

function unresolved(kind, reason, extra = {}) {
  return { resolved: false, kind, reason, candidates: [], ...extra };
}

/**
 * Identify ONE manifest line as ONE live ASDA product.
 *
 * `policy` comes from method.cjs and is read, not assumed: with
 * `favouritesFirst` false - which is what happens if
 * `regulars_favourites_first` is removed from the pinned BROWSER_METHOD - the
 * Favourites rung is SKIPPED. That is gap 10's behavioural proof and it lives
 * on this line rather than in a document.
 */
async function resolveLine(line, ctx) {
  const {
    session, policy, favourites = [], catalogue = null,
    judge, log = () => {},
  } = ctx;

  const lineNo = line.line != null ? line.line : line.n;
  const text = line.product;

  // ---- rung 1: the stored id, if the manifest carries one ------------------
  if (line.product_ref) {
    return { resolved: true, product_ref: String(line.product_ref), name: null, via: 'stored-id', why: 'the manifest carried an ASDA reference' };
  }

  const { row, queries } = queriesForLine(text, catalogue);
  if (queries.length === 0) {
    return unresolved(UNRESOLVED.NO_SEARCH_TERM, 'no usable description could be derived from the manifest text');
  }
  if (row) log(`line ${lineNo}: household catalogue identifies this as "${row.name}"`);

  // ---- rung 1b: an id the household catalogue already knows ----------------
  // Still the fast path, still an OPTIMISATION - the line was already buyable
  // without it via the rungs below, which is the point Warwick has had to make
  // repeatedly. It is used because it is free, never because it is required.
  if (row && row.asda_product_id) {
    return {
      resolved: true,
      product_ref: String(row.asda_product_id),
      name: row.name || null,
      via: 'catalogue-id',
      why: `the household catalogue carries an ASDA reference for "${row.name}"`,
    };
  }

  // ---- rung 2: the Favourites / Regulars grid ------------------------------
  let favouriteName = null;
  if (policy.favouritesFirst) {
    const hit = matchFavourite(queries, favourites);
    if (hit.resolved) {
      log(`line ${lineNo}: FAVOURITES ${hit.why}`);
      if (hit.product_ref) {
        return { resolved: true, product_ref: hit.product_ref, name: hit.name, via: 'favourites', why: hit.why };
      }
      // Identity established on the grid, reference not exposed by it. That is
      // NOT a failure and NOT an ambiguity: we now know the exact canonical
      // description, so retrieval below runs against the best query we will
      // ever have. Ruling 2 - identity and retrieval are separate concerns.
      favouriteName = hit.name;
      log(`line ${lineNo}: the Favourites grid gave the identity but no reference - retrieving "${hit.name}"`);
    } else if (hit.reason === 'ambiguous-in-favourites') {
      log(`line ${lineNo}: ${hit.contenders.length} Favourites entries match - deferring to the live candidates`);
    }
  } else {
    log(`line ${lineNo}: the pinned browser method does not carry regulars_favourites_first - the Favourites rung is OFF`);
  }

  // ---- rung 3: live search on the canonical description --------------------
  const searchQueries = favouriteName ? [favouriteName, ...queries] : queries;
  let candidates = [];
  let usedTerm = null;
  for (const q of searchQueries) {
    let found;
    try {
      found = await session.search(q);
    } catch (e) {
      // A term the URL allowlist refuses is not a shopping outcome. Try the
      // next description rather than reporting the product unbuyable.
      log(`line ${lineNo}: search "${q}" refused (${e.message}) - trying the next description`);
      continue;
    }
    usedTerm = found.term || q;
    candidates = found.results || [];
    log(`line ${lineNo}: search "${usedTerm}" -> ${candidates.length} candidate(s)`);
    if (candidates.length > 0) break;
  }

  // ---- GAP 6. Zero candidates is an ABSENCE, never a decision --------------
  if (candidates.length === 0) {
    return unresolved(
      UNRESOLVED.UNAVAILABLE,
      'ASDA returned no products for any description of this line',
      { searched: searchQueries, search_term: usedTerm, why: 'nothing to choose between - this is an absence, not an ambiguity, and no question is raised for it' },
    );
  }

  // ---- rung 4: the model, over real candidates -----------------------------
  const verdict = await judge({ ...line, product: favouriteName || text }, candidates);
  if (verdict.resolved) {
    log(`line ${lineNo}: resolved to ${verdict.product_ref} (${verdict.name}) - ${verdict.why}`);
    return {
      resolved: true,
      product_ref: verdict.product_ref,
      name: verdict.name,
      via: 'searched',
      why: verdict.why,
      search_term: usedTerm,
      harvest: true,
    };
  }

  // A gateway failure is NOT a shopping ambiguity either - nobody can answer
  // "the model could not be reached". It stops the line and says why.
  if (verdict.reason === 'gateway-failed' || verdict.reason === 'unparsable-answer') {
    return unresolved(UNRESOLVED.AMBIGUOUS, verdict.reason, {
      why: verdict.why,
      search_term: usedTerm,
      candidates: (verdict.candidates || []).map((c) => ({ product_ref: c.product_ref, name: c.name })),
      answerable_by_warwick: false,
    });
  }

  return unresolved(UNRESOLVED.AMBIGUOUS, verdict.reason, {
    why: verdict.why,
    search_term: usedTerm,
    candidates: (verdict.candidates || []).map((c) => ({ product_ref: c.product_ref, name: c.name })),
    answerable_by_warwick: true,
  });
}

module.exports = { resolveLine, UNRESOLVED };
