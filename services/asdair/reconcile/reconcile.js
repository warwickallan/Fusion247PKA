// =====================================================================
// BUILD-015 AsdAIr - order reconciliation: reconcile.js
//
// The PURE comparison. It takes the parsed ASDA order confirmation and the
// STORED PLAN for the same shop, and says - line by line - what actually
// happened. That is the input the next shop learns from.
//
// PURE and DETERMINISTIC, exactly like skill/planner.js:
//   * No DB, no network, no fs, no clock, no randomness.
//   * It never mutates its arguments; every returned line is a NEW object.
//   * Identical inputs always produce an identical result, including the
//     order of the lines and which plan line each confirmation line claimed.
//
// -------------------------------------------------------------------------
// NORMALISATION
// -------------------------------------------------------------------------
// Product matching uses the PLANNER'S OWN `normaliseTerm`, imported from
// services/asdair/skill/planner.js rather than reimplemented here. If the
// reconciler normalised differently from the planner, a line the planner
// matched could fail to reconcile (and be reported as omitted) purely because
// two copies of one rule had drifted. There is one copy, and it is the
// planner's. skill/ is READ-ONLY BY CONTRACT and is only READ here, never
// written to and never modified.
//
// -------------------------------------------------------------------------
// THE SEVEN OUTCOMES - every line gets EXACTLY ONE
// -------------------------------------------------------------------------
//   as_planned            matched a planned line; same product, same quantity
//                         (or the quantity was not shown, in which case nothing
//                         contradicts the plan).
//   qty_changed           matched a planned line; BOTH quantities are known and
//                         they differ.
//   variant_changed       matched a planned line, but a materially different
//                         product arrived than the one planned.
//   added_after_planning  on the confirmation, NOT in the planned basket, but
//                         recognisable to this household (a regular, or a list
//                         item that was excluded / held for a decision).
//   unmatched             on the confirmation and recognisable as nothing at
//                         all. Deliberately NOT called an addition: we do not
//                         know whether it was bought off-plan or mis-parsed.
//   omitted               PLANNED and NOT on the confirmation. Derived ONLY by
//                         comparing against the stored plan (see below).
//   price_missing         matched and otherwise as planned, but ASDA showed no
//                         price for it.
//
// PRECEDENCE (why exactly one, and which one wins):
//   unmatched > added_after_planning > variant_changed > qty_changed >
//   price_missing > as_planned
// Match-quality findings outrank the price finding because a line that is the
// wrong product is a bigger fact than a line whose price was not printed. No
// information is lost: `price_basis`, `price_missing` and `note` are carried on
// every line regardless of which outcome won, and the summary counts unpriced
// lines separately.
//
// -------------------------------------------------------------------------
// WHY `omitted` COMES FROM THE PLAN AND NOWHERE ELSE
// -------------------------------------------------------------------------
// A thing absent from a receipt is only "omitted" if it was actually PLANNED.
// An `omitted` line is therefore generated ONLY by walking the stored plan and
// finding planned lines no confirmation line claimed. It can never be inferred
// from the confirmation, because the confirmation cannot mention what is not on
// it. "Planned" means the plan line's status is 'add' - a line the planner held
// for a decision, or excluded, was never going to be bought, so its absence is
// correct behaviour and is NOT an omission.
//
// An omitted line is emitted with `price_basis: 'unknown'` and
// `line_price: null` - it has no price because it does not exist on any
// receipt. Its `note` records that it is plan-derived, not ASDA-derived.
//
// PURE ASCII SOURCE ONLY.
// =====================================================================

'use strict';

// ONE definition of normalisation, the planner's. A hard require: silently
// falling back to a local copy is exactly the drift this import exists to
// prevent, so a missing export is a loud failure.
const planner = require('../skill/planner');
if (!planner || !planner._internal || typeof planner._internal.normaliseTerm !== 'function') {
  throw new Error('reconcile: services/asdair/skill/planner.js must export _internal.normaliseTerm. ' +
    'Product matching MUST normalise identically to the planner; a local copy is not acceptable.');
}
const normaliseTerm = planner._internal.normaliseTerm;

const OUTCOMES = [
  'as_planned',
  'added_after_planning',
  'omitted',
  'qty_changed',
  'variant_changed',
  'price_missing',
  'unmatched'
];

// Highest number wins when a line qualifies for more than one.
const OUTCOME_PRECEDENCE = {
  as_planned: 0,
  price_missing: 1,
  qty_changed: 2,
  variant_changed: 3,
  added_after_planning: 4,
  unmatched: 5,
  omitted: 6      // only ever produced by the plan walk; never competes
};

// Words shorter than this carry no matching signal ("of", "the", "2").
const SIGNIFICANT_WORD_MIN = 3;

function fail(message) {
  throw new Error('reconcile: ' + message);
}

function appendNote(existing, addition) {
  const a = (existing === null || existing === undefined || String(existing).trim() === '') ? '' : String(existing).trim();
  return a === '' ? addition : a + ' | ' + addition;
}

function significantWords(term) {
  return normaliseTerm(term).split(' ').filter(function (w) { return w.length >= SIGNIFICANT_WORD_MIN; });
}

function sameId(a, b) {
  if (a === null || a === undefined || a === '') return false;
  if (b === null || b === undefined || b === '') return false;
  return String(a).trim() === String(b).trim();
}

// ---------------------------------------------------------------------
// The regulars index. Aliases are built exactly as the planner builds them
// (name + every `aka`), through the planner's own helper where available.
// ---------------------------------------------------------------------
function buildRegularsIndex(regulars, householdId) {
  const byAlias = new Map();
  const byProductId = new Map();
  const list = Array.isArray(regulars) ? regulars : [];

  list.forEach(function (r) {
    if (!r || r.active === false) return;
    // Household scope, the same boundary the planner enforces: a global row
    // (no household_id) or this household's, never another household's.
    if (r.household_id !== null && r.household_id !== undefined && householdId !== null &&
        householdId !== undefined && String(r.household_id) !== String(householdId)) {
      return;
    }
    const aliases = typeof planner._internal.regularAliases === 'function'
      ? planner._internal.regularAliases(r)
      : [normaliseTerm(r.name)].concat((Array.isArray(r.aka) ? r.aka : []).map(normaliseTerm));

    aliases.forEach(function (a) {
      if (a === '') return;
      if (!byAlias.has(a)) byAlias.set(a, []);
      byAlias.get(a).push(r);
    });
    if (r.asda_product_id !== null && r.asda_product_id !== undefined && String(r.asda_product_id).trim() !== '') {
      const key = String(r.asda_product_id).trim();
      if (!byProductId.has(key)) byProductId.set(key, []);
      byProductId.get(key).push(r);
    }
  });

  return {
    byAlias: byAlias,
    byProductId: byProductId,
    // Resolve a name (and optionally an explicit ASDA product id) to a single
    // regular. Two candidates is AMBIGUOUS and resolves to nothing - the
    // planner's rule 6 discipline: never pick one when the data does not.
    resolve: function (name, asdaProductId) {
      if (asdaProductId !== null && asdaProductId !== undefined && String(asdaProductId).trim() !== '') {
        const hits = byProductId.get(String(asdaProductId).trim());
        if (hits && hits.length === 1) return { regular: hits[0], via: 'asda_product_id' };
        if (hits && hits.length > 1) return { regular: null, via: 'ambiguous_asda_product_id' };
      }
      const term = normaliseTerm(name);
      if (term === '') return { regular: null, via: null };
      const hits = byAlias.get(term);
      if (hits && hits.length === 1) return { regular: hits[0], via: 'alias' };
      if (hits && hits.length > 1) return { regular: null, via: 'ambiguous_alias' };
      return { regular: null, via: null };
    }
  };
}

// ---------------------------------------------------------------------
// The stored plan, normalised into comparable entries.
//
// Accepts the planBasket result ({ items, summary }), a bare array of plan
// items, or { items: [...] }. A plan item is the planner's public shape:
//   { item_name, matched_product, requested_qty, planned_qty, status, ... }
// plus, optionally, the identity fields a caller may have resolved:
//   { asda_product_id, regular_id }
// ---------------------------------------------------------------------
function buildPlanEntries(plan, regIndex) {
  let items;
  if (Array.isArray(plan)) items = plan;
  else if (plan && Array.isArray(plan.items)) items = plan.items;
  else if (plan === null || plan === undefined) items = null;
  else items = null;

  if (!Array.isArray(items)) {
    fail('plan is required and must be the planBasket result ({ items, summary }) or an array of plan items. ' +
      'Without the stored plan, "omitted" cannot be derived and must not be guessed.');
  }

  return items.map(function (it, idx) {
    if (!it || typeof it !== 'object') fail('plan.items[' + idx + '] must be an object');
    const itemName = it.item_name === null || it.item_name === undefined ? '' : String(it.item_name);
    const matchedProduct = it.matched_product === null || it.matched_product === undefined ? '' : String(it.matched_product);
    if (normaliseTerm(itemName) === '' && normaliseTerm(matchedProduct) === '') {
      fail('plan.items[' + idx + '] has neither item_name nor matched_product');
    }
    const status = it.status === null || it.status === undefined ? '' : String(it.status).trim();

    let qty = null;
    [it.planned_qty, it.requested_qty, it.quantity, it.qty].some(function (v) {
      if (v === null || v === undefined || v === '') return false;
      const n = Number(v);
      if (Number.isInteger(n) && n >= 1) { qty = n; return true; }
      return false;
    });

    const viaProduct = regIndex.resolve(matchedProduct, it.asda_product_id);
    const viaItem = regIndex.resolve(itemName, null);
    const regular = viaProduct.regular || viaItem.regular || null;

    return {
      index: idx,
      item_name: itemName,
      matched_product: matchedProduct,
      status: status,
      // "Planned" means the planner decided to ADD it. Nothing else can be
      // omitted, because nothing else was ever going to be bought.
      planned: status === 'add',
      quantity: qty,
      asda_product_id: it.asda_product_id === null || it.asda_product_id === undefined ? null : String(it.asda_product_id).trim(),
      regular_id: it.regular_id !== null && it.regular_id !== undefined ? it.regular_id : (regular ? regular.id : null),
      regular: regular,
      keys: uniqueNonEmpty([normaliseTerm(matchedProduct), normaliseTerm(itemName)]),
      words: significantWords(matchedProduct !== '' ? matchedProduct : itemName),
      consumed_by: null
    };
  });
}

function uniqueNonEmpty(arr) {
  const out = [];
  arr.forEach(function (v) { if (v !== '' && out.indexOf(v) === -1) out.push(v); });
  return out;
}

// ---------------------------------------------------------------------
// The original list (asdair.shopping_list_items). Used ONLY to tell
// `added_after_planning` from `unmatched`: a line that is not in the plan but
// IS on the household's list (or is one of their regulars) is a recognisable
// purchase made outside the plan; a line that is neither is simply unmatched.
// ---------------------------------------------------------------------
function buildListIndex(listItems) {
  const set = new Set();
  (Array.isArray(listItems) ? listItems : []).forEach(function (li) {
    if (!li) return;
    const name = typeof li === 'string' ? li : li.item_name;
    const t = normaliseTerm(name);
    if (t !== '') set.add(t);
  });
  return set;
}

// ---------------------------------------------------------------------
// reconcile({ confirmation, plan, list_items, regulars, household_id })
//   -> { lines, summary }
//
// `confirmation` is a parseConfirmation result (or anything with the same
// { lines, stated_total, ... } shape).
// ---------------------------------------------------------------------
function reconcileConfirmation(input) {
  const args = input || {};
  const confirmation = args.confirmation;
  if (!confirmation || typeof confirmation !== 'object' || !Array.isArray(confirmation.lines)) {
    fail('confirmation is required (a parseConfirmation result)');
  }

  const householdId = args.household_id === undefined ? null : args.household_id;
  const regIndex = buildRegularsIndex(args.regulars, householdId);
  const planEntries = buildPlanEntries(args.plan, regIndex);
  const listIndex = buildListIndex(args.list_items);

  // Working copies of the confirmation lines. The parsed lines are frozen;
  // nothing here writes to them.
  const confLines = confirmation.lines.map(function (l, idx) {
    if (!l || typeof l !== 'object') fail('confirmation.lines[' + idx + '] must be an object');
    const resolved = regIndex.resolve(l.product_name, l.asda_product_id);
    return {
      source: l,
      term: normaliseTerm(l.product_name),
      words: significantWords(l.product_name),
      asda_product_id: l.asda_product_id === null || l.asda_product_id === undefined ? null : String(l.asda_product_id).trim(),
      regular: resolved.regular,
      regular_via: resolved.via,
      plan_entry: null,
      match_pass: null
    };
  });

  // ---- the matching passes -------------------------------------------
  // Each pass is exact-before-loose and consumes at most once, so the result
  // is deterministic and no plan line is claimed twice.

  function pass(name, predicate) {
    confLines.forEach(function (cl) {
      if (cl.plan_entry) return;
      const hits = planEntries.filter(function (pe) { return pe.consumed_by === null && predicate(cl, pe); });
      if (hits.length !== 1) return;      // 0 = no match; >1 = ambiguous, never guess
      cl.plan_entry = hits[0];
      cl.match_pass = name;
      hits[0].consumed_by = cl;
    });
  }

  // P1 - the strongest identity there is: the same ASDA product id.
  pass('asda_product_id', function (cl, pe) {
    return sameId(cl.asda_product_id, pe.asda_product_id);
  });

  // P2 - the confirmation name is exactly the planned product name.
  pass('product_name', function (cl, pe) {
    return cl.term !== '' && cl.term === normaliseTerm(pe.matched_product);
  });

  // P3 - the confirmation name is exactly the household's own list term.
  pass('list_term', function (cl, pe) {
    return cl.term !== '' && cl.term === normaliseTerm(pe.item_name);
  });

  // P4 - both sides resolve to the SAME regular (via its name, an `aka` alias,
  // or its asda_product_id). This is how "4pt milk" on a list and
  // "Arla British Semi Skimmed Milk 2.27L" on a receipt become one thing.
  pass('regular', function (cl, pe) {
    return cl.regular !== null && pe.regular !== null &&
      cl.regular.id !== undefined && sameId(cl.regular.id, pe.regular.id);
  });

  // P5 - bounded containment: one name wholly contains the other. Applied only
  // where the pairing is MUTUALLY unique, so an ambiguous containment never
  // silently picks a side.
  passMutual('containment', function (cl, pe) {
    const p = normaliseTerm(pe.matched_product) || normaliseTerm(pe.item_name);
    if (cl.term === '' || p === '') return false;
    return cl.term.indexOf(p) !== -1 || p.indexOf(cl.term) !== -1;
  });

  // P6 - the deliberately LOOSE last pass, and the one that surfaces genuine
  // substitutions: enough significant words in common to be the same intent
  // ("Arla 4pt Semi Skimmed Milk" vs "ASDA Organic Semi Skimmed Milk 2.27L"),
  // restricted to PLANNED entries and to mutually-unique pairings. Every match
  // it makes records its evidence in the line's note so a human can overrule it.
  passMutual('word_overlap', function (cl, pe) {
    if (!pe.planned) return false;
    if (cl.words.length === 0 || pe.words.length === 0) return false;
    const shared = cl.words.filter(function (w) { return pe.words.indexOf(w) !== -1; });
    if (shared.length < 2) return false;
    const shorter = Math.min(cl.words.length, pe.words.length);
    return shared.length / shorter >= 0.5;
  });

  // A mutually-unique pass: a pairing is only made when this confirmation line
  // is the ONLY candidate for that plan entry AND that plan entry is the ONLY
  // candidate for this confirmation line.
  function passMutual(name, predicate) {
    const open = confLines.filter(function (cl) { return !cl.plan_entry; });
    const candidates = new Map();
    open.forEach(function (cl) {
      candidates.set(cl, planEntries.filter(function (pe) { return pe.consumed_by === null && predicate(cl, pe); }));
    });
    open.forEach(function (cl) {
      if (cl.plan_entry) return;
      const mine = (candidates.get(cl) || []).filter(function (pe) { return pe.consumed_by === null; });
      if (mine.length !== 1) return;
      const pe = mine[0];
      const rivals = open.filter(function (other) {
        if (other === cl || other.plan_entry) return false;
        return (candidates.get(other) || []).indexOf(pe) !== -1;
      });
      if (rivals.length !== 0) return;
      cl.plan_entry = pe;
      cl.match_pass = name;
      pe.consumed_by = cl;
    });
  }

  // ---- classification --------------------------------------------------
  const lines = [];

  confLines.forEach(function (cl) {
    const src = cl.source;
    const basis = src.price_basis;
    if (['stated', 'derived', 'unknown'].indexOf(basis) === -1) {
      fail('confirmation line ' + String(src.line_no) + ' has price_basis "' + String(basis) +
        '". Every line MUST carry a price_basis; it is a required field, not an optional flag.');
    }
    const priceMissing = basis === 'unknown';

    // Every finding this line qualifies for is collected, then the SINGLE
    // outcome is the highest-precedence one. The ladder is data
    // (OUTCOME_PRECEDENCE), not a chain of ifs, so "exactly one outcome" and
    // "which one wins" are the same statement and cannot drift apart.
    const candidateOutcomes = [];
    let note = null;
    const pe = cl.plan_entry;

    if (pe === null) {
      // Nothing in the plan claimed it. Is it recognisable at all?
      const known = cl.regular !== null || listIndex.has(cl.term);
      if (known) {
        candidateOutcomes.push('added_after_planning');
        note = appendNote(note, cl.regular
          ? 'not in the planned basket; recognised as the household regular "' + String(cl.regular.name) + '"'
          : 'not in the planned basket; recognised as a line on the original list');
      } else {
        candidateOutcomes.push('unmatched');
        note = appendNote(note, 'could not be matched to the plan, the original list or any regular; ' +
          'not recorded as an addition because that would be a guess');
      }
    } else if (!pe.planned) {
      // It matched a line the planner did NOT plan to add (held for a decision,
      // or excluded). Buying it is an addition relative to the plan.
      candidateOutcomes.push('added_after_planning');
      note = appendNote(note, 'matched list line "' + (pe.item_name || pe.matched_product) +
        '", whose planned status was "' + (pe.status || 'unknown') + '" (not planned for adding)');
    } else {
      // Matched a PLANNED line. Same product? Same quantity?
      candidateOutcomes.push('as_planned');

      if (isVariantChange(cl, pe, regIndex)) {
        candidateOutcomes.push('variant_changed');
        note = appendNote(note, 'planned "' + (pe.matched_product || pe.item_name) + '", received "' +
          String(src.product_name) + '" (matched via ' + cl.match_pass + ')');
      }
      if (pe.quantity !== null && src.quantity !== null && pe.quantity !== src.quantity) {
        candidateOutcomes.push('qty_changed');
        note = appendNote(note, 'planned quantity ' + pe.quantity + ', received quantity ' + src.quantity);
      }
      if (pe.quantity !== null && src.quantity === null) {
        note = appendNote(note, 'ASDA did not show a quantity for this line, so no quantity change is claimed');
      }
      if (cl.match_pass === 'word_overlap' || cl.match_pass === 'containment') {
        note = appendNote(note, 'matched by the loose "' + cl.match_pass + '" pass - worth a human glance');
      }
    }

    // The price finding is always collected. Its low precedence means it can
    // only ever displace `as_planned`; it never hides a stronger finding, and
    // price_basis / price_missing carry the fact on the line either way.
    if (priceMissing) {
      candidateOutcomes.push('price_missing');
      note = appendNote(note, 'ASDA showed no price for this line; line_price stays null and price_basis stays ' +
        '"unknown" - no price was inferred');
    }
    if (basis === 'derived') {
      note = appendNote(note, 'line_price is DERIVED, not quoted by ASDA');
    }

    const outcome = candidateOutcomes.reduce(function (best, c) {
      if (OUTCOME_PRECEDENCE[c] === undefined) fail('unknown outcome "' + String(c) + '"');
      return OUTCOME_PRECEDENCE[c] > OUTCOME_PRECEDENCE[best] ? c : best;
    });
    if (OUTCOMES.indexOf(outcome) === -1) fail('produced an outcome outside the vocabulary: ' + String(outcome));

    lines.push({
      line_no: src.line_no,
      product_name: src.product_name,
      quantity: src.quantity === undefined ? null : src.quantity,
      pack_size: src.pack_size === undefined ? null : src.pack_size,
      promotion: src.promotion === undefined ? null : src.promotion,
      line_price: src.line_price === undefined ? null : src.line_price,
      price_basis: basis,
      matched_regular_id: cl.regular && cl.regular.id !== undefined && cl.regular.id !== null ? cl.regular.id : null,
      outcome: outcome,
      note: appendNote(src.note, note),
      // Audit-only fields. The writer stores the DB columns above; these travel
      // in the parsed jsonb blob so a reconciliation can be explained later.
      source: 'confirmation',
      price_missing: priceMissing,
      matched_plan_index: pe ? pe.index : null,
      match_pass: cl.match_pass
    });
  });

  // ---- omitted: DERIVED FROM THE STORED PLAN, never from the receipt ----
  let nextLineNo = lines.reduce(function (max, l) { return Math.max(max, Number(l.line_no) || 0); }, 0);
  planEntries.forEach(function (pe) {
    if (!pe.planned || pe.consumed_by !== null) return;
    nextLineNo += 1;
    lines.push({
      line_no: nextLineNo,
      product_name: pe.matched_product !== '' ? pe.matched_product : pe.item_name,
      // It is not on any receipt, so there is nothing to know about it.
      quantity: pe.quantity,
      pack_size: null,
      promotion: null,
      line_price: null,
      price_basis: 'unknown',
      matched_regular_id: pe.regular && pe.regular.id !== undefined && pe.regular.id !== null ? pe.regular.id : null,
      outcome: 'omitted',
      note: 'PLAN-DERIVED, not from the confirmation: this line was planned (status "add") for "' +
        (pe.item_name || pe.matched_product) + '" and no confirmation line matched it. ' +
        'It has no price because it is not on the receipt.',
      source: 'plan',
      price_missing: true,
      matched_plan_index: pe.index,
      match_pass: null
    });
  });

  // ---- summary ---------------------------------------------------------
  const counts = {};
  OUTCOMES.forEach(function (o) { counts[o] = 0; });
  lines.forEach(function (l) { counts[l.outcome] += 1; });

  const summary = {
    counts: counts,
    confirmation_line_count: confLines.length,
    plan_line_count: planEntries.length,
    planned_add_count: planEntries.filter(function (pe) { return pe.planned; }).length,
    matched_plan_count: planEntries.filter(function (pe) { return pe.consumed_by !== null; }).length,
    lines_without_price: lines.filter(function (l) { return l.price_basis === 'unknown'; }).length,
    derived_price_line_count: lines.filter(function (l) { return l.price_basis === 'derived'; }).length,
    stated_price_line_count: lines.filter(function (l) { return l.price_basis === 'stated'; }).length,
    stated_line_price_sum: round2(lines.reduce(function (sum, l) {
      return l.price_basis === 'stated' && l.line_price !== null ? sum + l.line_price : sum;
    }, 0)),
    stated_total: confirmation.stated_total === undefined ? null : confirmation.stated_total,
    stated_total_basis: confirmation.stated_total_basis === undefined ? 'unknown' : confirmation.stated_total_basis,
    currency: 'GBP'
  };

  return {
    lines: Object.freeze(lines.map(function (l) { return Object.freeze(l); })),
    summary: Object.freeze(summary)
  };
}

function round2(n) {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

// A DIFFERENT product arrived than the one planned. Deliberately conservative:
// the household's own shorthand, an `aka` alias, and a matching ASDA product id
// are all the SAME thing wearing a different name, and none of them is a
// variant change.
function isVariantChange(cl, pe, regIndex) {
  const planned = normaliseTerm(pe.matched_product);
  if (planned === '') return false;                                  // nothing to compare
  if (cl.term === planned) return false;                             // identical product name
  if (cl.term === normaliseTerm(pe.item_name)) return false;         // the receipt echoed the list term
  if (sameId(cl.asda_product_id, pe.asda_product_id)) return false;  // same ASDA product id
  // Both names are aliases of the same regular -> the same thing, named twice.
  const a = regIndex.resolve(cl.source.product_name, cl.asda_product_id).regular;
  const b = regIndex.resolve(pe.matched_product, pe.asda_product_id).regular;
  if (a && b && sameId(a.id, b.id) && a.id !== undefined) return false;
  return true;
}

module.exports = {
  reconcile: reconcileConfirmation,
  OUTCOMES: OUTCOMES,
  OUTCOME_PRECEDENCE: OUTCOME_PRECEDENCE,
  _internal: {
    normaliseTerm: normaliseTerm,
    buildRegularsIndex: buildRegularsIndex,
    buildPlanEntries: buildPlanEntries,
    buildListIndex: buildListIndex,
    isVariantChange: isVariantChange,
    significantWords: significantWords
  }
};
