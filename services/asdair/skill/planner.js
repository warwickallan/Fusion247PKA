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

// Append a product id once, comparing loosely (ids may be numbers or strings).
// Used so every DISTINCT id seen for a merged line is retained and a
// conflicting (possibly foreign) id can never be silently dropped.
function pushId(ids, id) {
  if (id === null || id === undefined) return;
  for (let i = 0; i < ids.length; i++) {
    if (String(ids[i]) === String(id)) return;
  }
  ids.push(id);
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

  // Explicit foreign key on the list line takes priority - but it MUST honour
  // household scope. An explicit matched_product_id may only resolve to a
  // GLOBAL product (household_id null/undefined) OR a product owned by the
  // ACTIVE household. If the id resolves to a product owned by ANOTHER
  // household, that is a cross-household scope leak: DO NOT accept it. Signal
  // a scope mismatch so the caller sends the line to a human and never
  // auto-substitutes the foreign product.
  // Gather EVERY explicit product id on the line. A single list line carries
  // its one id in matched_product_id; a merged (deduped) line additionally
  // carries every id seen for it in matched_product_ids, so a conflicting or
  // foreign id from a later duplicate is never silently dropped by dedupe's
  // first-wins pick. Distinct ids only (dedupeList already normalises, but a
  // raw caller may pass both fields).
  const explicitIds = [];
  pushId(explicitIds, item.matched_product_id);
  if (Array.isArray(item.matched_product_ids)) {
    item.matched_product_ids.forEach(function (id) { pushId(explicitIds, id); });
  }

  if (explicitIds.length > 0) {
    const inScope = [];
    let sawForeign = false;
    explicitIds.forEach(function (id) {
      const byId = list.find(function (p) { return sameHousehold(p.id, id); });
      if (!byId) return; // unresolved id: ignore; may fall through to term match
      const isGlobal = byId.household_id === null || byId.household_id === undefined;
      const isActiveHousehold = sameHousehold(byId.household_id, household);
      if (isGlobal || isActiveHousehold) {
        if (inScope.indexOf(byId) === -1) inScope.push(byId);
      } else {
        sawForeign = true; // resolved to ANOTHER household -> cross-household leak
      }
    });

    // A foreign id ANYWHERE on the line dominates: it is a data-integrity leak
    // and must be surfaced even when a valid sibling id is also present. Never
    // accept the foreign product; signal scopeMismatch so the caller sends the
    // line to a human and never auto-substitutes.
    if (sawForeign) {
      return { product: null, ambiguous: false, scopeMismatch: true };
    }
    // Two or more DISTINCT in-scope products claimed by explicit id -> the line
    // is id-conflicted and cannot be resolved confidently -> human decision.
    if (inScope.length > 1) {
      return { product: inScope[0], ambiguous: true, scopeMismatch: false };
    }
    if (inScope.length === 1) {
      return { product: inScope[0], ambiguous: false, scopeMismatch: false };
    }
    // No id resolved to any product at all -> fall through to term matching
    // (unchanged behaviour).
  }

  const term = normaliseTerm(item.item_name);
  if (term === '') return { product: null, ambiguous: false, scopeMismatch: false };

  const sameTerm = list.filter(function (p) { return normaliseTerm(p.list_term) === term; });

  const scoped = sameTerm.filter(function (p) {
    return p.household_id !== null && p.household_id !== undefined && sameHousehold(p.household_id, household);
  });
  if (scoped.length === 1) return { product: scoped[0], ambiguous: false, scopeMismatch: false };
  if (scoped.length > 1) return { product: scoped[0], ambiguous: true, scopeMismatch: false };

  const global = sameTerm.filter(function (p) {
    return p.household_id === null || p.household_id === undefined;
  });
  if (global.length === 1) return { product: global[0], ambiguous: false, scopeMismatch: false };
  if (global.length > 1) return { product: global[0], ambiguous: true, scopeMismatch: false };

  return { product: null, ambiguous: false, scopeMismatch: false };
}

// ---------------------------------------------------------------------
// Household scope test (rule 9): a product is IN SCOPE for the active
// household when it is GLOBAL (household_id null/undefined) OR owned by the
// ACTIVE household. A product owned by ANOTHER household is out of scope and
// must never be surfaced -- the same cross-household boundary matchProduct
// enforces. Kept as one helper so the ranker and the matcher agree exactly.
// ---------------------------------------------------------------------
function inHouseholdScope(product, household) {
  if (!product) return false;
  const isGlobal = product.household_id === null || product.household_id === undefined;
  return isGlobal || sameHousehold(product.household_id, household);
}

// Compare two product ids for a DETERMINISTIC tie-break: numeric when both
// parse as finite numbers (so 2 sorts before 10), else a stable string compare.
function compareProductIds(a, b) {
  const na = Number(a);
  const nb = Number(b);
  if (Number.isFinite(na) && Number.isFinite(nb) && na !== nb) return na - nb;
  const sa = String(a);
  const sb = String(b);
  if (sa < sb) return -1;
  if (sa > sb) return 1;
  return 0;
}

// Coerce a raw price to a POSITIVE finite number, or null when it is absent or
// unusable. A non-positive value (0 or negative) is never a real shelf price, so
// it is treated as "no price known" -> null (price proximity stays neutral).
function priceOf(value) {
  if (value === null || value === undefined || value === '') return null;
  const n = Number(value);
  if (!Number.isFinite(n)) return null;
  return n > 0 ? n : null;
}

// ---------------------------------------------------------------------
// Alternative / substitution SUGGESTION ranker (rule 6, suggestion-only).
//
// rankAlternatives(line, products, household) -> [{ name, price, reason, score }]
//
// For a line that resolves to needs_decision (out of stock / ambiguous), this
// proposes RANKED candidate products drawn from the products set. It is PURE
// and DETERMINISTIC (no DB, no network, no clock, no randomness) and it is
// SUGGESTION-ONLY: it returns a ranked list for a human to choose from and
// NEVER sets or writes matched_product. The planner attaches the returned array
// to the line additively; nothing here mutates the line or a product.
//
// Candidate rule (all four must hold):
//   1. SAME CATEGORY as the line, resolved by a strict FALLBACK CHAIN (not a
//      union across sources):
//        (a) the categories of the line's own same-term, in-scope products, if
//            that set is non-empty. A term that maps to products spanning MORE
//            THAN ONE category legitimately unions those categories -- but the
//            union is confined to THIS tier (the ambiguous-mapping case);
//        (b) ELSE the resolved self product's category;
//        (c) ELSE the line's own free-text category hint.
//      Because tier (c) is reached ONLY when no product mapping yielded a
//      category, a stale or conflicting hint on a line that DOES map to a
//      product is ignored -- it can never drag in a wrong-category candidate.
//      With no determinable category we cannot say "same category" -> [].
//   2. IN HOUSEHOLD SCOPE (global or the active household). A product owned by
//      ANOTHER household is NEVER surfaced (no cross-household leak).
//   3. NOT the line's own currently matched product (that is the item that is
//      out of stock / the resolved ambiguous pick; suggesting it back is noise).
//      Excluded by id when the self product has one, else by normalised name.
//   4. USABLE IDENTITY: the candidate must carry a non-empty matched_product
//      name (a nameless row is noise a human cannot act on).
//
// The ranked list is capped at the top TOP_N (5) suggestions after sorting, so
// the payload stays bounded regardless of how many products share the category.
// Sorting is on the UNROUNDED raw score; round2 is applied only to the returned
// display `score`, so two genuinely distinct raw scores never collapse to an
// id-order tie.
//
// Ranking (higher score = better; deterministic tie-break by product id asc):
//   * PRICE PROXIMITY (primary, weight 0.7): closeness of the candidate price to
//     the line's price. Only contributes when BOTH prices are known and the
//     target price is positive; otherwise it is NEUTRAL (0.5) so a missing price
//     neither helps nor hurts. (The base products schema carries no price
//     column, so in the live path proximity is neutral and ordering falls back
//     to scope then id -- see the shape note in the README/handback.)
//   * HOUSEHOLD PREFERENCE (secondary, weight 0.3): a candidate owned by the
//     active household outranks an equally-priced global one.
// ---------------------------------------------------------------------
// Maximum number of ranked suggestions returned for one line. Keeps the payload
// bounded (a 500-product category would otherwise yield 500 alternatives).
const TOP_N = 5;

function rankAlternatives(line, products, household) {
  const list = Array.isArray(products) ? products : [];
  if (!line) return [];

  // The line's own product match: used BOTH to derive the target category and
  // to exclude the item's own (out-of-stock / resolved-ambiguous) product from
  // the suggestions. Reuses matchProduct so the ranker and matcher never drift.
  const selfMatch = matchProduct(line, list, household);
  const selfProduct = selfMatch.product || null;

  // Target category set, resolved by a strict FALLBACK CHAIN (see the contract
  // comment above). Each tier is consulted ONLY when the tiers above it produced
  // no category, so a line that maps to a product is never contaminated by a
  // stale/conflicting free-text category hint.
  const term = normaliseTerm(line.item_name);
  const targetCategories = Object.create(null);

  // Tier (a): categories of the line's own same-term, in-scope products. A term
  // mapping to products in >1 category unions them HERE (the ambiguous case);
  // the union never spills across tiers.
  list.forEach(function (p) {
    if (!inHouseholdScope(p, household)) return;
    if (term === '' || normaliseTerm(p.list_term) !== term) return;
    const c = normaliseTerm(p.category);
    if (c !== '') targetCategories[c] = true;
  });

  // Tier (b): only when tier (a) was empty, fall back to the resolved self
  // product's category.
  if (Object.keys(targetCategories).length === 0 && selfProduct) {
    const sc = normaliseTerm(selfProduct.category);
    if (sc !== '') targetCategories[sc] = true;
  }

  // Tier (c): only when neither tier above yielded a category, fall back to the
  // line's own free-text category hint.
  if (Object.keys(targetCategories).length === 0) {
    const lineCat = normaliseTerm(line.category);
    if (lineCat !== '') targetCategories[lineCat] = true;
  }

  if (Object.keys(targetCategories).length === 0) return [];

  const targetPrice = priceOf(line.price);

  // The self product's identity, used to exclude it from its own suggestions
  // (rule 3). Prefer id; fall back to normalised name when the self product
  // carries no id (an id-less self product would otherwise be re-suggested).
  const selfHasId = selfProduct
    && selfProduct.id !== null && selfProduct.id !== undefined;
  const selfName = selfProduct ? normaliseTerm(selfProduct.matched_product) : '';

  // Build the candidate set.
  const candidates = list.filter(function (p) {
    if (!inHouseholdScope(p, household)) return false;                    // rule 2
    const cat = normaliseTerm(p.category);
    if (cat === '' || !targetCategories[cat]) return false;               // rule 1
    // rule 4: a candidate must carry a usable identity (a non-empty name).
    const candName = normaliseTerm(p.matched_product);
    if (candName === '') return false;
    // rule 3: never suggest the line's own product back. By id when BOTH the
    // self product and this candidate carry one, else by normalised name.
    if (selfProduct) {
      const candHasId = p.id !== null && p.id !== undefined;
      if (selfHasId && candHasId) {
        if (sameHousehold(p.id, selfProduct.id)) return false;
      } else if (selfName !== '' && candName === selfName) {
        return false;
      }
    }
    return true;
  });

  const scored = candidates.map(function (p) {
    const candPrice = priceOf(p.price);
    let priceScore = 0.5; // neutral when a price is unknown
    if (targetPrice !== null && targetPrice > 0 && candPrice !== null) {
      const rel = Math.abs(candPrice - targetPrice) / targetPrice;
      priceScore = rel >= 1 ? 0 : (1 - rel);
    }
    const isHousehold = p.household_id !== null && p.household_id !== undefined
      && sameHousehold(p.household_id, household);
    const scopeScore = isHousehold ? 1 : 0;
    // Keep the UNROUNDED score for sorting; round only for the display value so
    // two distinct raw scores never collapse into an id-order tie.
    const rawScore = 0.7 * priceScore + 0.3 * scopeScore;

    const parts = ['same category (' + normaliseTerm(p.category) + ')'];
    parts.push(isHousehold ? 'household preference' : 'global option');
    if (candPrice !== null) {
      parts.push(targetPrice !== null
        ? 'price GBP ' + candPrice.toFixed(2) + ' vs GBP ' + targetPrice.toFixed(2)
        : 'price GBP ' + candPrice.toFixed(2));
    } else {
      parts.push('price unknown');
    }

    return {
      _id: p.id,
      _raw: rawScore,
      name: p.matched_product,
      price: candPrice,
      reason: parts.join('; '),
      score: round2(rawScore)
    };
  });

  scored.sort(function (a, b) {
    if (b._raw !== a._raw) return b._raw - a._raw;       // best RAW score first
    return compareProductIds(a._id, b._id);              // deterministic tie-break
  });

  // Cap the payload at the top TOP_N suggestions (bounded output regardless of
  // how many products share the category), then strip the internal sort keys;
  // the public shape is { name, price, reason, score }.
  return scored.slice(0, TOP_N).map(function (a) {
    return { name: a.name, price: a.price, reason: a.reason, score: a.score };
  });
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
// An ACTIONABLE directive ('map' | 'exclude' | 'needs_decision') MUST name a
// target: a match_term or a match_category. A target-less actionable rule would
// otherwise blanket-apply to EVERY line (Finding 6): a target-less 'map' would
// silently rewrite every item's matched_product and a target-less 'exclude'
// would empty the whole basket -- a wrong-but-confident plan. So a rule whose
// match_term AND match_category are both null/empty carries NO target and is
// treated as NON-APPLICABLE (ignored, exactly like an 'info' row; it never
// matches any line). (Silas adds a DB CHECK enforcing the same server-side,
// belt-and-braces.)
function hasTarget(rule) {
  return normaliseTerm(rule.match_term) !== '' || normaliseTerm(rule.match_category) !== '';
}

function ruleAppliesToItem(rule, item, product, household) {
  if (rule.household_id !== null && rule.household_id !== undefined) {
    if (!sameHousehold(rule.household_id, household)) return false;
  }
  const term = normaliseTerm(item.item_name);
  const cat = product && product.category ? normaliseTerm(product.category) : normaliseTerm(item.category);
  switch (rule.scope) {
    case 'global':
    case 'household':
      // A target is REQUIRED even at broad scope (Finding 6): match by term
      // when one is given, else by category, else NON-APPLICABLE. A target-less
      // rule at this scope must never blanket-match every line.
      if (rule.match_term) return normaliseTerm(rule.match_term) === term;
      if (rule.match_category) return normaliseTerm(rule.match_category) === cat;
      return false;
    case 'product':
    case 'one_time':
      return rule.match_term ? normaliseTerm(rule.match_term) === term : false;
    case 'category':
      return rule.match_category ? normaliseTerm(rule.match_category) === cat : false;
    default:
      return false;
  }
}

function actionableRules(rules) {
  return (Array.isArray(rules) ? rules : []).filter(function (r) {
    // An actionable directive with NO target is ignored (Finding 6): hasTarget()
    // gates it out here so it can never reach ruleAppliesToItem and rewrite or
    // exclude every line.
    return r && r.active !== false && r.directive && r.directive !== 'info' && hasTarget(r);
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
      const firstId = (raw.matched_product_id !== undefined ? raw.matched_product_id : null);
      const ids = [];
      pushId(ids, firstId);
      byKey[key] = {
        item_name: raw.item_name,
        requested_qty: normaliseQty(raw.requested_qty),
        matched_product_id: firstId,
        // Every DISTINCT explicit id seen for this merged line. matched_product_id
        // stays first-wins for backward compatibility, but matchProduct scope-
        // checks EVERY id here so a later duplicate carrying a different (foreign)
        // id is never silently dropped. See Finding 2.
        matched_product_ids: ids,
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
      // Retain EVERY non-null id (not just the first) so a conflicting or
      // foreign id from a later duplicate line reaches the scope check instead
      // of being masked by the first-wins pick above.
      pushId(acc.matched_product_ids, raw.matched_product_id);
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
    const scopeMismatch = match.scopeMismatch === true;

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
    } else if (scopeMismatch) {
      // Security / data integrity (Finding 1): an explicit matched_product_id
      // resolved to a product owned by ANOTHER household. This is raised ABOVE
      // out_of_stock / flagged_on_list / rule needs_decision / ambiguous so a
      // foreign id can never be masked by one of those and lose its flag; it
      // always fails safe as needs_decision. (The two exclusion statuses above
      // still win, because an excluded line is never bought at all -- but the
      // mismatch is STILL recorded unconditionally after this chain so it is
      // never silently dropped.) The foreign product is never placed in
      // matched_product (matchProduct returns product null on a scope leak).
      status = 'needs_decision';
      // Flags for this cause are pushed in the unconditional block below.
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

    // Finding 1 (data integrity, ALWAYS): a foreign-household matched_product_id
    // must be surfaced no matter which status won above -- including a standing
    // or one-week exclusion that legitimately took the status. This guarantees
    // the 'product id household scope mismatch' flag is never silently dropped.
    // The foreign product itself is never in matched_product (it was refused in
    // matchProduct), so nothing foreign can be auto-substituted or bought.
    if (scopeMismatch) {
      pushFlag(flags, 'product id household scope mismatch');
      pushFlag(flags, 'never auto-substitute');
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

    // Rule 6: surface RANKED alternative SUGGESTIONS for a human decision.
    // This is SUGGESTION-ONLY and additive: it NEVER writes matched_product
    // (matchedProduct above is left exactly as resolved -- original or rule-
    // mapped, or null). Only needs_decision lines get ranked candidates; every
    // other status carries an empty array so the output shape stays consistent.
    const rankedAlternatives = status === 'needs_decision'
      ? rankAlternatives(line, products, household)
      : [];

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
      alternatives: rankedAlternatives,          // suggestion-only; never sets matched_product
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
      note: it.note,
      alternatives: it.alternatives
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
  rankAlternatives: rankAlternatives,   // suggestion-only alternative ranker (rule 6)
  // exported for unit tests of the pure helpers
  _internal: {
    normaliseTerm: normaliseTerm,
    normaliseQty: normaliseQty,
    matchProduct: matchProduct,
    dedupeList: dedupeList,
    rankAlternatives: rankAlternatives,
    inHouseholdScope: inHouseholdScope
  }
};
