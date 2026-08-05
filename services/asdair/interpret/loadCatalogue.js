// BUILD-015 AsdAIr Stage 1 - loadCatalogue.js
//
// THE CORRECTION THIS MODULE EXISTS FOR (Warwick, 2026-07-28).
//
// The first vision experiment tested the WRONG product behaviour: it asked a
// model to read arbitrary handwriting and invent a product name. That is not
// what AsdAIr is for, and unsurprisingly it produced "gourmet coffee" for
// "Gourmet cat food".
//
// AsdAIr's actual job has always been:
//
//     "Given THIS household's known products and aliases, identify which of
//      them each handwritten mark most likely refers to."
//
// So the regulars, aliases, product IDs, brands, categories, typical
// quantities, rules and the previous order are not merely outputs to update
// after a shop. They are REQUIRED INPUTS to understanding the next list.
//
// This module loads that canonical household context and shapes it into a
// COMPACT candidate catalogue suitable for grounding one vision request.
// Supabase is the current operational authority; nothing here reads the old
// Google Doc, and no second catalogue is created for transcription.
//
// READ-ONLY. Uses ASDAIR_DB_URL (the SELECT-only role). It must never write.
'use strict';

// Keep the grounded prompt small: dumping database prose at a model is how you
// get an expensive request that answers worse. One line per candidate.
function compactRegular(r) {
  const out = {
    id: r.id,
    name: r.name,
  };
  if (r.brand) out.brand = r.brand;
  if (r.category) out.category = r.category;
  if (Array.isArray(r.aka) && r.aka.length) out.aka = r.aka;
  if (r.typical_qty != null) out.typical_qty = r.typical_qty;
  return out;
}

// Rules that actually change interpretation of a LINE (exclusions and
// mappings). `info` prose is deliberately left out - the planner applies it
// deterministically later, and it would only dilute the prompt.
function compactRule(rule) {
  return {
    directive: rule.directive,
    match_term: rule.match_term,
    matched_product: rule.matched_product,
    text: rule.rule_text,
  };
}

/**
 * Load the household's canonical shopping context.
 *
 * @param {{query: Function}} client - a connected, READ-ONLY pg client
 * @param {number} householdId
 * @returns {Promise<object>} the catalogue used to ground interpretation
 */
async function loadCatalogue(client, householdId) {
  if (!Number.isInteger(householdId)) {
    throw new Error('loadCatalogue: householdId must be an integer');
  }

  const regulars = await client.query(
    `select id, name, brand, category, high_level_category, aka, typical_qty,
            asda_product_id, asda_url, substitutes_allowed
       from asdair.regulars
      where household_id = $1 and active = true
      order by id`,
    [householdId],
  );

  const rules = await client.query(
    `select directive, match_term, match_category, matched_product, rule_text
       from asdair.rules
      where active = true
        and (household_id = $1 or household_id is null)
        and directive in ('exclude','map','rotate','needs_decision')
      order by id`,
    [householdId],
  );

  // The previous completed order, for "they buy this most weeks" weighting and
  // for rotation. Absent on a first-ever shop, which must not be an error.
  const lastOrder = await client.query(
    `select o.id, o.run_at, i.item_name, i.added_qty, i.matched_product_id
       from asdair.orders o
       join asdair.shopping_list_items i on i.list_id = o.list_id
      where o.household_id = $1
        and o.total_added is not null
        and (i.added_qty > 0 or i.status = 'added')
      order by coalesce(o.run_at, o.created_at) desc, o.id desc, i.id`,
    [householdId],
  );

  const lastOrderId = lastOrder.rows.length ? lastOrder.rows[0].id : null;
  const lastOrderLines = lastOrder.rows
    .filter((r) => r.id === lastOrderId)
    .map((r) => ({ item_name: r.item_name, qty: r.added_qty }));

  return {
    household_id: householdId,
    candidates: regulars.rows.map(compactRegular),
    // Full rows kept separately: the resolver needs product ids/urls that the
    // prompt does not need to see.
    //
    // KEYED BY Number(r.id), NOT r.id VERBATIM. asdair.regulars.id is `bigint`
    // (001_asdair_schema.sql), and node-postgres returns a bigint column as a
    // STRING by default (no pg.types.setTypeParser override exists anywhere in
    // this codebase). Every known consumer of this Map - shopLines.withCanonicalNames
    // (pipeline/shopLines.js), interpret-list.js's own resolve() - looks a row up
    // by Number(matched_regular_id). A Map keyed by the raw string id therefore
    // silently missed EVERY lookup in the real deployment: canonical_name came
    // back null for every matched line, and runPipeline's buildGroundedIntents
    // threw its "neither a catalogue match nor a readable raw_reading" error for
    // a line that WAS matched. This is what actually failed SHOP-2026-08-03, and
    // it was invisible to the offline suite because the pipeline test harness
    // stubs this whole module out with a hand-built (already-numeric) catalogue -
    // see loadCatalogue.test.js, which exercises this module for real with
    // STRING ids, the way Postgres actually returns them.
    regularsById: new Map(regulars.rows.map((r) => [Number(r.id), r])),
    rules: rules.rows.map(compactRule),
    last_order: lastOrderId ? { order_id: lastOrderId, lines: lastOrderLines } : null,
  };
}

module.exports = { loadCatalogue, compactRegular, compactRule };
