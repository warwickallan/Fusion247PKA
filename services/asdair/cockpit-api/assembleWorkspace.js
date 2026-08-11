// =====================================================================
// BUILD-015 AsdAIr Stage 1 - cockpit-api/assembleWorkspace.js
//
// PURE. Durable rows in, one workspace payload out. No DB, no clock, no
// network, no randomness - readWorkspace.js does the reading, this does the
// shaping, and `node --test` can therefore prove every rule below offline.
//
// WHAT THIS MODULE IS RESPONSIBLE FOR (and nothing else):
//
//   * THE CATALOGUE-GROUNDING INVARIANT, ENFORCED AT THE BOUNDARY.
//     A line is only ever shown as `matched` when it carries a real
//     asdair.regulars.id, and the product name shown is looked up FROM OUR OWN
//     CATALOGUE BY THAT ID. Whatever prose arrived with the line is preserved
//     verbatim as `raw_reading` and is never promoted to a product name. A
//     stored line claiming `matched` with no id is DOWNGRADED to
//     `needs_confirmation` - fail-safe, and flagged, rather than displayed as a
//     confident match nobody can trace to a product.
//
//   * UNKNOWN STAYS UNKNOWN. Every scalar is emitted with a `display` string
//     produced by present.js. Null becomes "unknown", never 0, never a guess.
//
//   * MONEY CARRIES ITS BASIS. A `derived` price is labelled as inferred and
//     can never be read as an ASDA-quoted figure.
//
// WHAT THIS MODULE MUST NEVER DO: decide what a line means. Identity is
// resolveByCatalogue.js's job and a human's; planning is the planner's. This
// file reports what the durable tables already say.
//
// PURE ASCII.
// =====================================================================

'use strict';

const P = require('./present');
const { COMMAND_NAMES } = require('./commandSurface');

// The interpretation vocabulary (services/asdair/interpret/resolveByCatalogue.js).
const INTERPRETATION_STATUSES = Object.freeze([
  'matched',
  'needs_confirmation',
  'unmatched_new_item',
  'unreadable',
  'possible_duplicate'
]);
const INTERPRETATION_SET = new Set(INTERPRETATION_STATUSES);

const INTERPRETATION_LABELS = Object.freeze({
  matched: 'matched to a product we know',
  needs_confirmation: 'needs your confirmation',
  unmatched_new_item: 'new item - not in the catalogue',
  unreadable: 'could not be read',
  possible_duplicate: 'possible duplicate of a line above'
});

// asdair.shopping_list_items.status -> the three plan buckets.
const PLAN_BUCKETS = Object.freeze({
  added: 'resolved',
  requested: 'held',
  needs_decision: 'held',
  not_added: 'excluded',
  excluded_this_week: 'excluded'
});

// asdair.shop_decision.decision_kind (migration 017) -> a plain-English
// sentence fragment. Never the raw enum on a primary reading path - see
// resolutionSentence() below, where these are assembled into a full sentence
// alongside the decided product/quantity/name looked up from OUR OWN
// catalogue, never from model prose.
const DECISION_KIND_LABELS = Object.freeze({
  existing_regular: 'matched to a product already in the catalogue',
  quantity_change: 'the quantity was changed',
  variant_choice: 'a variant was chosen',
  new_item: 'added as a new item',
  skip_this_week: 'skipped this week',
  clarification_required: 'needs a follow-up question'
});

const OUTCOME_LABELS = Object.freeze({
  as_planned: 'as planned',
  added_after_planning: 'added after planning',
  omitted: 'omitted from the order',
  qty_changed: 'quantity changed',
  variant_changed: 'different variant arrived',
  price_missing: 'price missing',
  unmatched: 'could not be matched to the plan'
});

function arr(value) {
  return Array.isArray(value) ? value : [];
}

function idKey(value) {
  return value === null || value === undefined ? null : String(value);
}

// ---------------------------------------------------------------------
// The catalogue index. IDENTITY LIVES HERE: a canonical product name is only
// ever read out of one of our own rows, by id.
// ---------------------------------------------------------------------
function indexCatalogue(catalogue) {
  const byId = new Map();
  arr(catalogue).forEach(function (r) {
    const k = idKey(r && r.id);
    if (k !== null) byId.set(k, r);
  });
  return {
    size: byId.size,
    get: function (id) {
      const k = idKey(id);
      return k === null ? null : (byId.get(k) || null);
    }
  };
}

// ---------------------------------------------------------------------
// ONE interpretation line.
// ---------------------------------------------------------------------
function buildLine(item, index, cat, alternativesByItem, questionsByItem, seenRegulars) {
  const rawReading = item.raw_reading !== undefined ? item.raw_reading : item.item_name;
  const regularId = item.matched_regular_id === undefined ? null : item.matched_regular_id;
  const regular = cat.get(regularId);

  // Stored status if it is one we know; otherwise derived from the evidence.
  let status = INTERPRETATION_SET.has(item.interpretation_status) ? item.interpretation_status : null;
  const integrity = [];

  if (status === null) {
    if (P._internal.isMissing(rawReading)) status = 'unreadable';
    else if (regular) status = 'matched';
    else status = 'unmatched_new_item';
  }

  // THE INVARIANT. "matched" is a claim about IDENTITY, and identity is a row
  // in our catalogue. No id (or an id that names no row) is not a match.
  if (status === 'matched' || status === 'possible_duplicate') {
    if (regularId === null || regularId === undefined) {
      status = 'needs_confirmation';
      integrity.push('stored as "' + item.interpretation_status + '" but carries no regular id - shown as needing confirmation.');
    } else if (!regular) {
      status = 'needs_confirmation';
      integrity.push('regular id ' + String(regularId) + ' is not in the loaded catalogue - shown as needing confirmation.');
    }
  }

  // A repeat of a regular already resolved on this list is flagged rather than
  // silently ordered twice. Only ever a DOWNGRADE of a match, never an upgrade.
  const key = idKey(regularId);
  if (status === 'matched' && key !== null) {
    if (seenRegulars.has(key)) status = 'possible_duplicate';
    seenRegulars.add(key);
  }

  const isMatch = status === 'matched' || status === 'possible_duplicate';

  // Alternatives come from two places and they are NOT the same shape:
  //
  //   * asdair.product_alternatives - a free-text shop-floor alternative. Its
  //     `id` is the alternative row's OWN primary key and is emphatically NOT a
  //     regulars id. Reading it as one would put a number on screen that points
  //     at a different product entirely, which is the exact class of mistake
  //     this whole module exists to prevent.
  //   * shop_question.candidates - candidates the resolver produced, which DO
  //     carry a regulars id.
  //
  // So the source decides where an id may come from, and a name is only shown
  // as canonical when it was looked up from the catalogue by that id.
  const alts = [];
  const pushAlt = function (a, source) {
    if (!a) return;
    const rawId = source === 'catalogue_candidate'
      ? (a.id !== undefined && a.id !== null ? a.id : (a.regular_id === undefined ? null : a.regular_id))
      : (a.regular_id === undefined ? null : a.regular_id);
    const altRegular = cat.get(rawId);
    const fallbackName = a.name !== undefined ? a.name : (a.label !== undefined ? a.label : a.alternative_name);
    alts.push({
      source: source,
      regular_id: altRegular ? altRegular.id : null,
      regular_id_display: P.count(altRegular ? altRegular.id : null),
      name: altRegular ? altRegular.name : (fallbackName === undefined ? null : fallbackName),
      name_display: P.text(altRegular ? altRegular.name : fallbackName),
      from_catalogue: !!altRegular,
      chosen: a.chosen === true
    });
  };
  arr(alternativesByItem.get(idKey(item.id))).forEach(function (a) { pushAlt(a, 'product_alternative'); });
  arr(questionsByItem.get(idKey(item.id))).forEach(function (q) {
    arr(q.candidates).forEach(function (c) { pushAlt(c, 'catalogue_candidate'); });
  });

  return {
    line_no: item.line_no === undefined || item.line_no === null ? index + 1 : item.line_no,
    list_item_id: item.id === undefined ? null : item.id,

    // The evidence, verbatim. Never edited, never replaced by a product name.
    raw_reading: rawReading === undefined ? null : rawReading,
    raw_reading_display: P.text(rawReading),

    // IDENTITY. Both fields are null unless the line genuinely resolves.
    matched_regular_id: isMatch ? regularId : null,
    matched_regular_id_display: P.count(isMatch ? regularId : null),
    canonical_product_name: isMatch && regular ? regular.name : null,
    canonical_product_name_display: P.text(isMatch && regular ? regular.name : null),
    asda_product_id: isMatch && regular ? (regular.asda_product_id || null) : null,
    asda_product_id_display: P.text(isMatch && regular ? regular.asda_product_id : null),

    quantity: item.requested_qty === undefined ? null : item.requested_qty,
    quantity_display: P.count(item.requested_qty),
    added_quantity_display: P.count(item.added_qty),

    confidence_display: P.confidence(item.match_confidence),
    match_basis: item.match_basis === undefined ? null : item.match_basis,
    match_basis_display: P.text(item.match_basis),

    alternatives: alts,
    status: status,
    status_label: INTERPRETATION_LABELS[status] || status,
    plan_status: item.status === undefined ? null : item.status,
    plan_status_display: P.text(item.status),
    note_display: P.text(item.note),
    integrity_warnings: integrity
  };
}

function buildInterpretation(input, cat) {
  const alternativesByItem = new Map();
  arr(input.alternatives).forEach(function (a) {
    const k = idKey(a.list_item_id);
    if (k === null) return;
    if (!alternativesByItem.has(k)) alternativesByItem.set(k, []);
    alternativesByItem.get(k).push(a);
  });

  const questionsByItem = new Map();
  arr(input.questions).forEach(function (q) {
    const k = idKey(q.list_item_id);
    if (k === null) return;
    if (!questionsByItem.has(k)) questionsByItem.set(k, []);
    questionsByItem.get(k).push(q);
  });

  const seen = new Set();
  const lines = arr(input.list_items).map(function (item, i) {
    return buildLine(item, i, cat, alternativesByItem, questionsByItem, seen);
  });

  const tally = { matched: 0, needs_confirmation: 0, unmatched_new_item: 0, unreadable: 0, possible_duplicate: 0 };
  lines.forEach(function (l) { if (tally[l.status] !== undefined) tally[l.status] += 1; });

  // No list yet is NOT "0 lines". Say so.
  const haveList = input.shop && input.shop.list_id !== null && input.shop.list_id !== undefined;

  return {
    list_id: haveList ? input.shop.list_id : null,
    list_id_display: P.count(haveList ? input.shop.list_id : null),
    catalogue_size: cat.size,
    catalogue_size_display: P.count(cat.size),
    total_lines_display: haveList ? P.count(lines.length) : P.UNKNOWN,
    tally: tally,
    lines: lines,
    // Every match on screen can be traced to a row in our catalogue.
    grounded: lines.every(function (l) {
      return l.status !== 'matched' && l.status !== 'possible_duplicate' ? true : l.matched_regular_id !== null;
    })
  };
}

// ---------------------------------------------------------------------
// PLAN - resolved / held / excluded, with the rule note the planner recorded.
// ---------------------------------------------------------------------
function buildPlan(input, cat) {
  const priorNames = new Set();
  const priorIds = new Set();
  arr(input.previous_order_items).forEach(function (r) {
    if (r.item_name) priorNames.add(String(r.item_name).toLowerCase().trim());
    const k = idKey(r.matched_regular_id);
    if (k !== null) priorIds.add(k);
  });

  const buckets = { resolved: [], held: [], excluded: [], unknown_bucket: [] };

  arr(input.list_items).forEach(function (item, i) {
    const bucket = PLAN_BUCKETS[item.status] || 'unknown_bucket';
    const regular = cat.get(item.matched_regular_id);
    const nameForPrior = regular ? String(regular.name).toLowerCase().trim()
      : String(item.item_name === undefined ? '' : item.item_name).toLowerCase().trim();
    const inPrior = (regular && priorIds.has(idKey(regular.id))) || (nameForPrior !== '' && priorNames.has(nameForPrior));

    buckets[bucket].push({
      line_no: item.line_no === undefined || item.line_no === null ? i + 1 : item.line_no,
      list_item_id: item.id === undefined ? null : item.id,
      raw_reading_display: P.text(item.raw_reading !== undefined ? item.raw_reading : item.item_name),
      canonical_product_name_display: P.text(regular ? regular.name : null),
      matched_regular_id_display: P.count(regular ? regular.id : null),
      requested_qty_display: P.count(item.requested_qty),
      added_qty_display: P.count(item.added_qty),
      plan_status_display: P.text(item.status),
      // "Which rule applied" is whatever the planner durably recorded. This
      // module never re-derives it - a re-derived rule would be a second
      // planner, disagreeing with the first at the worst possible moment.
      applied_rule_id_display: P.count(item.applied_rule_id),
      applied_rule_display: P.text(item.applied_rule || item.note),
      prior_order_context: inPrior ? 'bought last time' : 'not on the last order',
      in_prior_order: !!inPrior
    });
  });

  return {
    resolved: buckets.resolved,
    held: buckets.held,
    excluded: buckets.excluded,
    unclassified: buckets.unknown_bucket,
    counts: {
      resolved_display: P.count(buckets.resolved.length),
      held_display: P.count(buckets.held.length),
      excluded_display: P.count(buckets.excluded.length)
    },
    prior_order_known: !!(input.previous_order),
    prior_order_ref_display: P.count(input.previous_order ? input.previous_order.id : null)
  };
}

// ---------------------------------------------------------------------
// QUESTIONS - what AsdAIr is still waiting on, and what has already been
// settled. OPEN questions carry candidates plus the three replies the
// control surface allows: choose a candidate, type a correction, "Search
// ASDA", "Skip this week" - all four go through answerQuestion. RESOLVED
// questions (answered or skipped) carry Warwick's own words verbatim
// (answer_text - never edited, never summarised away) plus, when a durable
// asdair.shop_decision row exists for that question (migration 017), a
// plain-language sentence for what it was interpreted to mean. A MISSING
// decision row is never treated as "nothing happened" - it means "decided
// before this table existed" or "not yet decided", so the fallback is the
// raw answer, not silence.
// ---------------------------------------------------------------------
function decisionSummary(d, cat) {
  if (!d) return null;
  const regular = cat.get(d.decided_regular_id);
  return {
    kind: d.decision_kind || null,
    kind_display: DECISION_KIND_LABELS[d.decision_kind] || P.text(d.decision_kind),
    decided_product_name_display: P.text(regular ? regular.name : null),
    decided_quantity_display: P.count(d.decided_quantity),
    decided_item_name_display: P.text(d.decided_item_name),
    clarification_reason_display: P.text(d.clarification_reason),
    forward_intent_display: P.text(d.forward_intent),
    interpreted_by_display: P.text(d.interpreted_by),
    interpreted_at_display: P.when(d.interpreted_at)
  };
}

// ONE sentence, in Warwick's language, for what a settled question now means.
// Never invents a fact the decision row does not carry - an unrecognised or
// absent decision_kind falls through to null, and the caller shows the raw
// answer_text on its own rather than a guessed sentence.
function resolutionSentence(status, decision) {
  if (!decision) return status === 'skipped' ? 'Skipped — not bought this week.' : null;
  switch (decision.kind) {
    case 'existing_regular':
    case 'variant_choice':
      return decision.decided_product_name_display !== P.UNKNOWN
        ? 'Resolved to ' + decision.decided_product_name_display + '.'
        : 'Resolved to a product already in the catalogue.';
    case 'quantity_change':
      return 'Quantity set to ' + decision.decided_quantity_display
        + (decision.decided_product_name_display !== P.UNKNOWN ? ' for ' + decision.decided_product_name_display : '') + '.';
    case 'new_item':
      return 'Added as a new item: ' + decision.decided_item_name_display + '.';
    case 'skip_this_week':
      return 'Skipped — not bought this week.';
    case 'clarification_required':
      return 'Needs a follow-up: ' + decision.clarification_reason_display + '.';
    default:
      return null;
  }
}

function buildQuestions(input, cat) {
  const all = arr(input.questions);
  const open = all.filter(function (q) {
    return q.status === undefined || q.status === 'open';
  });
  const resolved = all.filter(function (q) {
    return q.status === 'answered' || q.status === 'skipped';
  });

  const decisionsByQuestion = new Map();
  arr(input.decisions).forEach(function (d) {
    const k = idKey(d.question_id);
    if (k !== null && !decisionsByQuestion.has(k)) decisionsByQuestion.set(k, d);
  });

  return {
    open_count_display: P.count(open.length),
    resolved_count_display: P.count(resolved.length),
    items: open.map(function (q) {
      return {
        id: q.id === undefined ? null : q.id,
        question_key: q.question_key,
        question_text_display: P.text(q.question_text),
        list_item_id: q.list_item_id === undefined ? null : q.list_item_id,
        candidates: arr(q.candidates).map(function (c, i) {
          const regular = cat.get(c && (c.id !== undefined ? c.id : c.regular_id));
          const label = regular ? regular.name : (c && (c.name || c.label || c.text));
          return {
            index: i,
            regular_id_display: P.count(regular ? regular.id : (c && c.id)),
            label_display: P.text(label),
            from_catalogue: !!regular
          };
        }),
        // Named so the UI cannot invent an action that has no command behind it.
        allowed_replies: [
          { key: 'choose', label: 'Choose this one', command: 'answerQuestion' },
          { key: 'typed', label: 'Type a correction', command: 'answerQuestion' },
          { key: 'search', label: 'Search ASDA', command: 'answerQuestion' },
          { key: 'skip', label: 'Skip this week', command: 'answerQuestion' }
        ]
      };
    }),
    // RESOLVED — what Warwick has already settled. Newest first, so the most
    // recently answered question is the one nearest the top when he reopens
    // the app after answering in Telegram.
    resolved: resolved.slice().reverse().map(function (q) {
      const decision = decisionSummary(decisionsByQuestion.get(idKey(q.id)), cat);
      return {
        id: q.id === undefined ? null : q.id,
        question_key: q.question_key,
        question_text_display: P.text(q.question_text),
        list_item_id: q.list_item_id === undefined ? null : q.list_item_id,
        status: q.status,
        status_display: q.status === 'skipped' ? 'skipped' : 'answered',
        // Warwick's own words, verbatim - never edited, never replaced by the
        // interpreted resolution below.
        answer_text_display: P.text(q.answer_text),
        answer_source_display: P.text(q.answer_source),
        answered_at_display: P.when(q.answered_at),
        // The plain-language "what this meant" line. null when no durable
        // decision is on record — the UI shows the raw answer on its own
        // rather than a sentence this module has no grounds for.
        resolution_display: resolutionSentence(q.status, decision),
        decision: decision
      };
    })
  };
}

// ---------------------------------------------------------------------
// BROWSER BUILD. The request is reported AS A REQUEST. Its existence is never
// evidence that shopping is happening - shopStatus.js is explicit about this
// and the payload keeps the two apart.
// ---------------------------------------------------------------------
function buildBrowser(status) {
  const b = status && status.browser ? status.browser : null;
  const progress = b && b.progress ? b.progress : null;

  return {
    requested: !!b,
    request_id_display: P.count(b ? b.request_id : null),
    status_display: P.text(b ? b.status : null),
    is_paused: !!(b && (b.status === 'cancelled' || (progress && progress.paused === true))),
    claimed_by_display: P.text(b ? b.claimed_by : null),
    requested_at_display: P.when(b ? b.requested_at : null),
    claimed_at_display: P.when(b ? b.claimed_at : null),
    finished_at_display: P.when(b ? b.finished_at : null),
    last_error_display: P.text(b ? b.last_error : null),

    // Only ever what the supervised runner durably reported. Never counted
    // from the fact that a build was asked for.
    regulars_added_display: P.count(status ? status.regulars_added : null),
    searched_items_added_display: P.count(status ? status.searched_items_added : null),
    basket_lines_display: P.count(status ? status.basket_product_count : null),
    basket_lines_source_display: P.text(status ? status.basket_product_count_source : null),
    estimated_total: P.money(status ? status.total : null),

    held_items: arr(progress && progress.held_items).map(function (h) {
      return {
        label_display: P.text(typeof h === 'string' ? h : (h && (h.name || h.item))),
        reason_display: P.text(typeof h === 'string' ? null : (h && h.reason))
      };
    }),

    // Browser-only maintenance nobody may forget, e.g. "add Wall's to Favourites".
    pending_actions: arr(status && status.outstanding_actions).map(function (a) {
      return {
        id: a.id,
        action_type_display: P.text(a.action_type),
        action_key_display: P.text(a.action_key),
        note_display: P.text(a.note),
        created_at_display: P.when(a.created_at)
      };
    }),

    // Said out loud in the payload so the UI has no room to imply otherwise.
    boundary: 'Requesting a build only writes a durable request. Nothing here drives a browser, ' +
      'books a slot, checks out or pays.'
  };
}

// ---------------------------------------------------------------------
// ORDER. price_basis is the whole point of this panel.
// ---------------------------------------------------------------------
function buildOrder(input, cat) {
  const conf = input.confirmation || null;
  const lines = arr(input.confirmation_lines).map(function (l) {
    const regular = cat.get(l.matched_regular_id);
    return {
      line_no: l.line_no,
      product_name_display: P.text(l.product_name),
      canonical_product_name_display: P.text(regular ? regular.name : null),
      matched_regular_id_display: P.count(regular ? regular.id : null),
      quantity_display: P.count(l.quantity),
      pack_size_display: P.text(l.pack_size),
      promotion_display: P.text(l.promotion),
      // Amount and basis travel together, always.
      price: P.lineMoney(l.line_price, l.price_basis),
      outcome: l.outcome === undefined ? null : l.outcome,
      outcome_display: P.text(l.outcome ? (OUTCOME_LABELS[l.outcome] || l.outcome) : null),
      note_display: P.text(l.note)
    };
  });

  const byOutcome = {};
  lines.forEach(function (l) {
    const k = l.outcome || 'unrecorded';
    byOutcome[k] = (byOutcome[k] || 0) + 1;
  });

  const derivedCount = lines.filter(function (l) { return l.price.basis === 'derived'; }).length;
  const unknownBasisCount = lines.filter(function (l) { return l.price.known && l.price.basis === 'unknown'; }).length;

  return {
    received: !!conf,
    confirmation_id_display: P.count(conf ? conf.id : null),
    source_kind_display: P.text(conf ? conf.source_kind : null),
    received_at_display: P.when(conf ? conf.received_at : null),
    reconciled_at_display: P.when(conf ? conf.reconciled_at : null),
    // Raw evidence is retained ALWAYS. Shown, not summarised away.
    raw_text_display: P.text(conf ? conf.raw_text : null),
    raw_media_path_display: P.text(conf ? conf.raw_media_path : null),
    parse_provider_display: P.text(conf ? conf.parse_provider : null),

    // The confirmation's OWN stated total, when ASDA showed one.
    stated_total: P.money(conf && conf.stated_total !== null && conf.stated_total !== undefined
      ? { amount: conf.stated_total, currency: 'GBP', basis: 'stated', source: 'order_confirmation' }
      : null),
    // The projection's total already carries its basis; pass it through as-is.
    reported_total: P.money(input.status ? input.status.total : null),

    lines: lines,
    lines_count_display: conf ? P.count(lines.length) : P.UNKNOWN,
    derived_price_count_display: conf ? P.count(derivedCount) : P.UNKNOWN,
    unknown_basis_count_display: conf ? P.count(unknownBasisCount) : P.UNKNOWN,
    price_basis_note: 'A price marked "inferred" was worked out by us. It is NOT a figure ASDA quoted.',

    summary: {
      as_planned_display: conf ? P.count(byOutcome.as_planned || 0) : P.UNKNOWN,
      added_after_planning_display: conf ? P.count(byOutcome.added_after_planning || 0) : P.UNKNOWN,
      omitted_display: conf ? P.count(byOutcome.omitted || 0) : P.UNKNOWN,
      qty_changed_display: conf ? P.count(byOutcome.qty_changed || 0) : P.UNKNOWN,
      variant_changed_display: conf ? P.count(byOutcome.variant_changed || 0) : P.UNKNOWN,
      unmatched_display: conf ? P.count(byOutcome.unmatched || 0) : P.UNKNOWN,
      unrecorded_display: conf ? P.count(byOutcome.unrecorded || 0) : P.UNKNOWN
    }
  };
}

// ---------------------------------------------------------------------
// HISTORY - what the household actually learned. The write-back arc of the
// cycle in interpret/README.md, made visible so a shop that taught nothing is
// obvious rather than invisible.
// ---------------------------------------------------------------------
function buildHistory(input, cat) {
  const since = input.shop && input.shop.created_at ? new Date(input.shop.created_at).getTime() : null;
  const after = function (ts) {
    if (since === null || ts === null || ts === undefined) return false;
    const t = new Date(ts).getTime();
    return Number.isFinite(t) && t >= since;
  };

  const catalogue = arr(input.catalogue);
  const newRegulars = catalogue.filter(function (r) { return after(r.created_at); });
  const touched = catalogue.filter(function (r) { return !after(r.created_at) && after(r.updated_at); });

  return {
    previous_order: {
      known: !!input.previous_order,
      order_id_display: P.count(input.previous_order ? input.previous_order.id : null),
      run_at_display: P.when(input.previous_order ? input.previous_order.run_at : null),
      total_requested_display: P.count(input.previous_order ? input.previous_order.total_requested : null),
      total_added_display: P.count(input.previous_order ? input.previous_order.total_added : null),
      basket_total: P.money(input.previous_order && input.previous_order.basket_total !== null &&
        input.previous_order.basket_total !== undefined
        ? { amount: input.previous_order.basket_total, currency: 'GBP', basis: 'derived', source: 'orders.basket_total' }
        : null),
      checked_out_display: P.bool(input.previous_order ? input.previous_order.checked_out : null),
      lines: arr(input.previous_order_items).map(function (r) {
        return {
          item_name_display: P.text(r.item_name),
          requested_qty_display: P.count(r.requested_qty),
          added_qty_display: P.count(r.added_qty),
          status_display: P.text(r.status)
        };
      })
    },

    // The rotate directive (migration 007). Reported, never resolved here: a
    // fixed-variant rule clashing with a rotate rule is a question for Warwick.
    rotation: arr(input.rotation_rules).map(function (r) {
      return {
        rule_id_display: P.count(r.id),
        match_term_display: P.text(r.match_term || r.match_category),
        matched_product_display: P.text(r.matched_product),
        directive_display: P.text(r.directive),
        reason_display: P.text(r.reason || r.note),
        active: r.active !== false
      };
    }),

    aliases_learned: touched.map(function (r) {
      return {
        regular_id_display: P.count(r.id),
        name_display: P.text(r.name),
        aliases: Array.isArray(r.aka) ? r.aka : [],
        aliases_display: Array.isArray(r.aka) && r.aka.length ? r.aka.join(', ') : P.UNKNOWN,
        updated_at_display: P.when(r.updated_at)
      };
    }),
    aliases_learned_basis: 'regulars whose row was updated after this shop started',

    new_regulars: newRegulars.map(function (r) {
      return {
        regular_id_display: P.count(r.id),
        name_display: P.text(r.name),
        category_display: P.text(r.category),
        created_at_display: P.when(r.created_at)
      };
    }),

    product_ids_captured: catalogue
      .filter(function (r) { return r.asda_product_id && (after(r.created_at) || after(r.updated_at)); })
      .map(function (r) {
        return {
          regular_id_display: P.count(r.id),
          name_display: P.text(r.name),
          asda_product_id_display: P.text(r.asda_product_id)
        };
      }),

    catalogue_size_display: P.count(cat.size)
  };
}

// ---------------------------------------------------------------------
// THE PAYLOAD.
// ---------------------------------------------------------------------
function assembleWorkspace(input) {
  const src = input || {};
  const status = src.status || null;
  const shop = src.shop || (status ? {} : null);
  const cat = indexCatalogue(src.catalogue);

  if (!status) {
    return {
      ok: false,
      reason: 'no_shop',
      message: 'No shop found. Nothing durable to show yet.',
      command_names: COMMAND_NAMES
    };
  }

  return {
    ok: true,
    generated_from: 'durable state only',

    shop: {
      shop_id: status.shop_id,
      shop_id_display: P.count(status.shop_id),
      shop_ref_display: P.text(status.shop_ref),
      household_id_display: P.count(status.household_id),
      stage: status.stage,
      stage_display: P.text(status.stage),
      stage_label_display: P.text(status.stage_label),
      // The 12 states, so the UI can show where this shop sits in the whole
      // lifecycle rather than only its current label. Supplied by the reader
      // from shopStatus.SHOP_STATUSES - never hand-typed into the UI.
      all_stages: Array.isArray(src.all_stages) ? src.all_stages : null,
      is_terminal: !!status.is_terminal,
      created_at_display: P.when(status.created_at),
      updated_at_display: P.when(status.updated_at),
      needs_review_display: P.bool(status.needs_review),
      last_event_display: status.last_event
        ? P.text(status.last_event.description)
        : P.UNKNOWN,
      failure: status.failure ? {
        description_display: P.text(status.failure.description),
        occurred_at_display: P.when(status.failure.occurred_at),
        failed_from_display: P.text(status.failure.failed_from),
        failure_count_display: P.count(status.failure.failure_count),
        resumable: !!status.failure.resumable,
        resume_to_display: P.text(status.failure.resume_to)
      } : null,
      lines_summary: {
        total_display: P.count(status.lines ? status.lines.total : null),
        resolved_display: P.count(status.lines ? status.lines.resolved : null),
        open_display: P.count(status.lines ? status.lines.open : null)
      },
      substitution_policy_display: P.text(status.substitutions ? status.substitutions.policy : null)
    },

    timeline: arr(src.events).map(function (e) {
      return {
        event_type_display: P.text(e.event_type),
        from_display: P.text(e.from_status),
        to_display: P.text(e.to_status),
        description_display: P.text(e.description),
        occurred_at_display: P.when(e.occurred_at),
        is_failure: e.event_type === 'failure'
      };
    }),

    // Raw evidence. ALWAYS retained, always shown.
    evidence: {
      source_kind_display: P.text(shop ? shop.source_kind : status.source_kind),
      raw_text_display: P.text(shop ? shop.raw_text : null),
      raw_media_path_display: P.text(shop ? shop.raw_media_path : null),
      has_media: !!(shop && shop.raw_media_path),
      // Served by GET /asdair/media?shop=<id>, which resolves the path from
      // the DATABASE ROW only - never from anything the browser sends.
      media_url: shop && shop.raw_media_path ? '/asdair/media?shop=' + String(status.shop_id) : null,
      transcript_display: P.text(shop ? shop.transcript : null),
      transcript_provider_display: P.text(shop ? shop.transcript_provider : null),
      transcript_model_display: P.text(shop ? shop.transcript_model : null),
      transcript_confidence_display: P.confidence(status.transcript_confidence),
      needs_review_display: P.bool(status.needs_review)
    },

    interpretation: buildInterpretation({ shop: shop, list_items: src.list_items, alternatives: src.alternatives, questions: src.questions }, cat),
    plan: buildPlan(src, cat),
    questions: buildQuestions(src, cat),
    browser: buildBrowser(status),
    order: buildOrder({ confirmation: src.confirmation, confirmation_lines: src.confirmation_lines, status: status }, cat),
    history: buildHistory(src, cat),

    // The UI may only offer an action that has a command behind it.
    command_names: COMMAND_NAMES,

    // Restated in the payload so a reader of the JSON knows the rule too.
    unknown_means_unknown: true
  };
}

module.exports = {
  assembleWorkspace: assembleWorkspace,
  INTERPRETATION_STATUSES: INTERPRETATION_STATUSES,
  INTERPRETATION_LABELS: INTERPRETATION_LABELS,
  PLAN_BUCKETS: PLAN_BUCKETS,
  OUTCOME_LABELS: OUTCOME_LABELS,
  DECISION_KIND_LABELS: DECISION_KIND_LABELS,
  _internal: {
    indexCatalogue: indexCatalogue,
    buildLine: buildLine,
    buildInterpretation: buildInterpretation,
    buildPlan: buildPlan,
    buildQuestions: buildQuestions,
    decisionSummary: decisionSummary,
    resolutionSentence: resolutionSentence,
    buildBrowser: buildBrowser,
    buildOrder: buildOrder,
    buildHistory: buildHistory
  }
};
