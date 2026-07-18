// =====================================================================
// IDEA-012 AsdAIr - WP1 skill: planner.js
//
// The "brain" half of the household-shopping agent.
//
// planBasket({ listItems, rules, products, budget }) -> { items, summary }
//
// PURE and DETERMINISTIC:
//   * No DB, no network, no fs, no Date.now(), no randomness.
//   * Given identical inputs it always returns an identical result.
//   * No side effects; it only reads its arguments and returns a value.
//
// HARD GUARANTEES baked into this function:
//   * It NEVER auto-substitutes a product (out-of-stock / ambiguous items
//     become needs_decision; any alternatives are surfaced for a human,
//     never applied to matched_product).
//   * It NEVER emits a checkout / pay / place-order action. The goal is a
//     checkout-ready plan; committing it is out of scope by construction.
//   * It only ever plans items that are explicitly on the list (rule 5).
//
// PURE ASCII only. Currency is written as "GBP", never a symbol.
// =====================================================================

'use strict';

// ---------------------------------------------------------------------
// Small pure helpers
// ---------------------------------------------------------------------

// Normalise a term for matching: lower-case, trim, collapse whitespace.
function normaliseTerm(value) {
  if (value === null || value === undefined) return '';
  return String(value).trim().toLowerCase().replace(/\s+/g, ' ');
}

// Rule 1 + 2: quantities are ITEM COUNTS (not pack sizes) and a missing
// quantity defaults to 1. Anything that is not a positive integer -> 1.
function normaliseQty(value) {
  if (value === null || value === undefined || value === '') return 1;
  const n = Number(value);
  if (!Number.isFinite(n)) return 1;
  const i = Math.trunc(n);
  return i >= 1 ? i : 1;
}

// Compare two household identifiers loosely (id number or name string).
function sameHousehold(a, b) {
  if (a === null || a === undefined || b === null || b === undefined) return false;
  return String(a) === String(b);
}

// Append a flag once (keeps the flags array free of duplicates).
function pushFlag(flags, flag) {
  if (flag && flags.indexOf(flag) === -1) flags.push(flag);
}

// Round a money amount to 2 decimal places (pure arithmetic).
function round2(n) {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

// ---------------------------------------------------------------------
// Product matching (rule 9): match item_name / matched_product_id against
// products.list_term, honouring household scope. Household-scoped rows win
// over global (household_id null) rows. More than one candidate at the
// winning scope means the match is AMBIGUOUS -> caller sends it to a human.
// ---------------------------------------------------------------------
function matchProduct(item, products, household) {
  const list = Array.isArray(products) ? products : [];

  // Explicit foreign key on the list line takes priority.
  if (item.matched_product_id !== null && item.matched_product_id !== undefined) {
    const byId = list.find(function (p) { return sameHousehold(p.id, item.matched_product_id); });
    if (byId) return { product: byId, ambiguous: false };
  }

  const term = normaliseTerm(item.item_name);
  if (term === '') return { product: null, ambiguous: false };

  const sameTerm = list.filter(function (p) { return normaliseTerm(p.list_term) === term; });

  const scoped = sameTerm.filter(function (p) {
    return p.household_id !== null && p.household_id !== undefined && sameHousehold(p.household_id, household);
  });
  if (scoped.length === 1) return { product: scoped[0], ambiguous: false };
  if (scoped.length > 1) return { product: scoped[0], ambiguous: true };

  const global = sameTerm.filter(function (p) {
    return p.household_id === null || p.household_id === undefined;
  });
  if (global.length === 1) return { product: global[0], ambiguous: false };
  if (global.length > 1) return { product: global[0], ambiguous: true };

  return { product: null, ambiguous: false };
}

// ---------------------------------------------------------------------
// Rule directives (data-driven planning).
//
// The migrated asdair.rules rows carry only free-text rule_text, which the
// pure planner treats as INFORMATIONAL (it does not parse prose). A rule
// only changes a plan when it carries STRUCTURED directive fields:
//   directive : 'exclude' | 'needs_decision' | 'map' | 'info' (default 'info')
//   match_term / match_category : what the rule targets
//   matched_product : replacement product for a 'map' directive
//   active (default true), scope, household_id : applicability
// Free-text-only rows (no directive) are ignored by the planner logic.
// ---------------------------------------------------------------------
function ruleAppliesToItem(rule, item, product, household) {
  if (rule.household_id !== null && rule.household_id !== undefined) {
    if (!sameHousehold(rule.household_id, household)) return false;
  }
  const term = normaliseTerm(item.item_name);
  switch (rule.scope) {
    case 'global':
    case 'household':
      return rule.match_term ? normaliseTerm(rule.match_term) === term : true;
    case 'product':
    case 'one_time':
      return rule.match_term ? normaliseTerm(rule.match_term) === term : false;
    case 'category': {
      const cat = product && product.category ? normaliseTerm(product.category) : normaliseTerm(item.category);
      return rule.match_category ? normaliseTerm(rule.match_category) === cat : false;
    }
    default:
      return false;
  }
}

function actionableRules(rules) {
  return (Array.isArray(rules) ? rules : []).filter(function (r) {
    return r && r.active !== false && r.directive && r.directive !== 'info';
  });
}

// ---------------------------------------------------------------------
// Rule 3: dedupe duplicate lines for the same item, summing counts.
// Boolean signals are OR-ed; the most restrictive explicit status wins.
// ---------------------------------------------------------------------
function dedupeList(listItems) {
  const order = [];
  const byKey = Object.create(null);

  (Array.isArray(listItems) ? listItems : []).forEach(function (raw) {
    const key = normaliseTerm(raw.item_name);
    if (key === '') return; // rule 5: a blank line is not an item
    if (!byKey[key]) {
      byKey[key] = {
        item_name: raw.item_name,
        requested_qty: normaliseQty(raw.requested_qty),
        matched_product_id: (raw.matched_product_id !== undefined ? raw.matched_product_id : null),
        price: (raw.price !== undefined ? raw.price : null),
        note: (raw.note ? String(raw.note) : ''),
        category: (raw.category !== undefined ? raw.category : null),
        one_week_only: raw.one_week_only === true,
        excluded_this_week: (raw.status === 'excluded_this_week' || raw.excluded_this_week === true),
        out_of_stock: (raw.out_of_stock === true || raw.in_stock === false),
        flagged_on_list: (raw.status === 'needs_decision'),
        alternatives: (Array.isArray(raw.alternatives) ? raw.alternatives.slice() : [])
      };
      order.push(key);
    } else {
      const acc = byKey[key];
      acc.requested_qty += normaliseQty(raw.requested_qty);
      if (acc.matched_product_id === null && raw.matched_product_id !== undefined && raw.matched_product_id !== null) {
        acc.matched_product_id = raw.matched_product_id;
      }
      if (acc.price === null && raw.price !== undefined && raw.price !== null) acc.price = raw.price;
      if (raw.note) acc.note = acc.note ? (acc.note + '; ' + String(raw.note)) : String(raw.note);
      acc.one_week_only = acc.one_week_only || raw.one_week_only === true;
      acc.excluded_this_week = acc.excluded_this_week || raw.status === 'excluded_this_week' || raw.excluded_this_week === true;
      acc.out_of_stock = acc.out_of_stock || raw.out_of_stock === true || raw.in_stock === false;
      acc.flagged_on_list = acc.flagged_on_list || raw.status === 'needs_decision';
      if (Array.isArray(raw.alternatives)) acc.alternatives = acc.alternatives.concat(raw.alternatives);
    }
  });

  return order.map(function (k) { return byKey[k]; });
}

// ---------------------------------------------------------------------
// Main entry point.
// ---------------------------------------------------------------------
function planBasket(input) {
  const args = input || {};
  const listItems = args.listItems;
  const rules = args.rules;
  const products = args.products;
  const budget = args.budget || null;

  // Active household: explicit override, else derived from the budget row.
  const household = (args.household !== undefined && args.household !== null)
    ? args.household
    : (budget && budget.household_id !== undefined ? budget.household_id : null);

  const directives = actionableRules(rules);
  const merged = dedupeList(listItems);

  const items = merged.map(function (line) {
    const flags = [];
    let note = line.note || '';
    const qty = line.requested_qty;

    // Product match (rule 9).
    const match = matchProduct(line, products, household);
    let matchedProduct = match.product ? match.product.matched_product : null;
    const ambiguous = match.ambiguous;

    // Applicable structured directives for this line.
    const applicable = directives.filter(function (r) {
      return ruleAppliesToItem(r, line, match.product, household);
    });

    // 'map' directive can set / override the matched product (rule 9).
    applicable.forEach(function (r) {
      if (r.directive === 'map' && r.matched_product) {
        matchedProduct = r.matched_product;
        pushFlag(flags, 'product mapped by rule');
        if (r.note) note = note ? (note + '; ' + r.note) : r.note;
      }
    });

    // ---- status resolution -----------------------------------------------
    // Precedence: standing exclude > one-week exclude > needs_decision > add.
    //
    // Two DISTINCT kinds of exclusion are deliberately kept apart here:
    //   * STANDING exclude - driven by an 'exclude' DIRECTIVE rule. This is a
    //     learned, PERMANENT "never buy this again" hard rule. It gets its own
    //     status ('excluded') and flag ('excluded by standing rule').
    //   * ONE-WEEK exclude - item-level only ('one_week_only' true OR the list
    //     line's own status 'excluded_this_week'). This is transient, for THIS
    //     list only (rule 10), and keeps status 'excluded_this_week'.
    // A permanent rule must NEVER be mislabelled as transient, so the standing
    // path is checked FIRST and wins even when the same line is also marked
    // one-week on this list. planned_qty stays 0 for BOTH; neither is ever
    // added, and the never-substitute / never-checkout guarantees are unchanged.
    let status = 'add';

    const standingExcludes = applicable.filter(function (r) { return r.directive === 'exclude'; });

    if (standingExcludes.length > 0) {
      status = 'excluded';
      pushFlag(flags, 'excluded by standing rule');
      // Optionally surface the rule's reason, if it carries one.
      const reason = standingExcludes.reduce(function (acc, r) {
        return acc || (r.reason ? String(r.reason) : '');
      }, '');
      if (reason) note = note ? (note + '; ' + reason) : reason;
    } else if (line.excluded_this_week) {
      // Rule 10: excluded THIS WEEK only (never promoted to a standing rule).
      status = 'excluded_this_week';
      pushFlag(flags, 'excluded this week only');
    } else if (line.out_of_stock) {
      // Rule 6: out of stock -> human decision, NEVER auto-substitute.
      status = 'needs_decision';
      pushFlag(flags, 'out of stock');
      pushFlag(flags, 'never auto-substitute');
    } else if (line.flagged_on_list) {
      status = 'needs_decision';
      pushFlag(flags, 'flagged on list');
      pushFlag(flags, 'never auto-substitute');
    } else if (applicable.some(function (r) { return r.directive === 'needs_decision'; })) {
      status = 'needs_decision';
      pushFlag(flags, 'flagged by rule');
      pushFlag(flags, 'never auto-substitute');
    } else if (ambiguous) {
      // Rule 6: cannot be confidently matched -> human decision.
      status = 'needs_decision';
      pushFlag(flags, 'ambiguous match');
      pushFlag(flags, 'never auto-substitute');
    } else if (!matchedProduct) {
      // Unmatched but explicitly on the list: still plan to add. It would be
      // found in the Favourites / Regulars pages at run time (rule 4).
      status = 'add';
      pushFlag(flags, 'no explicit product mapping');
    }

    // Rule 10 book-keeping flag (informational; never becomes a rule).
    if (line.one_week_only) pushFlag(flags, 'one week only');

    // Rule 6: surface alternatives for a human decision, NEVER apply them.
    if (status === 'needs_decision' && line.alternatives.length > 0) {
      pushFlag(flags, 'alternatives available');
      const names = line.alternatives.map(function (a) {
        return a && a.alternative_name ? String(a.alternative_name) : '';
      }).filter(function (s) { return s !== ''; });
      if (names.length > 0) {
        const altText = 'alternatives: ' + names.join(', ');
        note = note ? (note + '; ' + altText) : altText;
      }
    }

    // planned_qty: only 'add' lines put units in the basket.
    const plannedQty = status === 'add' ? qty : 0;

    // Unit price only carried through for lines we actually add.
    const unitPrice = (line.price !== null && line.price !== undefined && Number.isFinite(Number(line.price)))
      ? Number(line.price)
      : null;

    return {
      item_name: line.item_name,
      matched_product: matchedProduct,          // never a substitute; original or rule-mapped only
      requested_qty: qty,
      planned_qty: plannedQty,
      status: status,                            // add | needs_decision | excluded_this_week | excluded
      flags: flags,
      note: note,
      _unit_price: unitPrice                     // internal; stripped before return
    };
  });

  // ---- budget estimate (rule 7: FLAG only, never block) ----
  const addItems = items.filter(function (it) { return it.status === 'add'; });
  const pricedAll = addItems.length > 0 && addItems.every(function (it) { return it._unit_price !== null; });

  let estimatedTotal = null;
  if (pricedAll) {
    estimatedTotal = round2(addItems.reduce(function (sum, it) {
      return sum + it._unit_price * it.planned_qty;
    }, 0));
  }

  let budgetFlag = 'unknown';
  if (estimatedTotal !== null && budget && budget.min_normal !== undefined && budget.max_normal !== undefined) {
    const min = Number(budget.min_normal);
    const max = Number(budget.max_normal);
    if (estimatedTotal < min) budgetFlag = 'below';
    else if (estimatedTotal > max) budgetFlag = 'above';
    else budgetFlag = 'within';
  }

  // Attach the basket-level budget flag to every add line for traceability.
  if (budgetFlag !== 'within' && budgetFlag !== 'unknown') {
    addItems.forEach(function (it) { pushFlag(it.flags, 'basket ' + budgetFlag + ' budget band'); });
  }

  // Strip internal fields from the public output.
  const publicItems = items.map(function (it) {
    return {
      item_name: it.item_name,
      matched_product: it.matched_product,
      requested_qty: it.requested_qty,
      planned_qty: it.planned_qty,
      status: it.status,
      flags: it.flags,
      note: it.note
    };
  });

  // Exclusions are counted per kind, then rolled up. `excluded` remains the
  // TOTAL of both kinds so existing totals still reconcile; the two additive
  // breakdown keys tell them apart without breaking any existing summary key.
  const excludedStanding = publicItems.filter(function (it) { return it.status === 'excluded'; }).length;
  const excludedThisWeek = publicItems.filter(function (it) { return it.status === 'excluded_this_week'; }).length;

  const summary = {
    total_requested: publicItems.length,
    planned_add: publicItems.filter(function (it) { return it.status === 'add'; }).length,
    needs_decision: publicItems.filter(function (it) { return it.status === 'needs_decision'; }).length,
    excluded: excludedStanding + excludedThisWeek,   // total of BOTH exclusion kinds
    excluded_standing: excludedStanding,             // additive: permanent 'exclude' directive
    excluded_this_week: excludedThisWeek,            // additive: transient one-week exclusion
    estimated_total: estimatedTotal,
    currency: budget && budget.currency ? String(budget.currency) : 'GBP',
    budget_flag: budgetFlag
  };

  return { items: publicItems, summary: summary };
}

module.exports = {
  planBasket: planBasket,
  // exported for unit tests of the pure helpers
  _internal: {
    normaliseTerm: normaliseTerm,
    normaliseQty: normaliseQty,
    matchProduct: matchProduct,
    dedupeList: dedupeList
  }
};
