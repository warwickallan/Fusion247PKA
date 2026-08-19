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
const { computeCanonicalState, detectStateDrift } = require('./canonicalState');
const { explainState } = require('./explainState');
const { computeProvenance } = require('./provenance');
const {
  countShop,
  classifyQuestion,
  isHeldItem,
  presentBrand,
  HELD_ITEM_STATUSES,
  SKIPPED_ITEM_STATUSES,
} = require('./shopArithmetic');

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
function buildLine(item, index, cat, alternativesByItem, questionsByItem, seenRegulars, itemOrigins) {
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

    // AC4/AC7: WHERE THIS LINE CAME FROM. One of PHOTO / REGULARS / RULE /
    // WARWICK / SKIPPED, or null where nothing durable speaks for it - and
    // null is left as null, never guessed into the likeliest bucket. The UI
    // reads `provenance` and counts an unlabelled line as unattributed.
    provenance: (itemOrigins && itemOrigins.get
      ? (itemOrigins.get(item.id === undefined || item.id === null ? null : String(item.id)) || null)
      : null),

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
    return buildLine(item, i, cat, alternativesByItem, questionsByItem, seen, input.item_origins);
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
// A small, LOCAL human-date formatter for the two fields this Work Order introduces
// (resolved-question answered_at_display, decision interpreted_at_display) — NOT a change to
// present.js's when(), which returns a raw ISO instant and is already used elsewhere on this page
// (History, evidence, browser, order...). Retrofitting that formatter estate-wide is a separate,
// larger decision for Iris; this fixes only the two call sites the "Resolved" section actually
// renders, where a raw machine timestamp would sit right beside "You said: ..." / "-> Resolved to
// ..." — the exact primary-content-must-be-human-readable rule this section exists to uphold.
// (Vera, CONDITIONAL PASS, HIGH finding on 2026-08-11.)
function humanWhen(value) {
  if (value === null || value === undefined || value === '') return P.UNKNOWN;
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return P.UNKNOWN;
  return new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }).format(d);
}

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
    interpreted_at_display: humanWhen(d.interpreted_at)
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

/**
 * WOULD ANSWERING THIS TEACH THE HOUSEHOLD SOMETHING DURABLE? (WP-B15-41 AC2)
 *
 * Warwick's question is "is this worth answering carefully, or is it just this
 * week?". The honest answer is derivable for two shapes and NOT derivable for
 * the rest, so the third value is `null` and it is displayed as unknown rather
 * than defaulted to the reassuring branch.
 *
 * PRODUCT IDENTITY generalises: asdair.remembered_choice (migration 018) is the
 * durable home for "when the list says X, he means product Y". QUANTITY does
 * not: a number for this week's shop is a fact about this week.
 */
function durableLearningFor(q) {
  const hasCandidates = arr(q && q.candidates).length > 0;
  const text = String((q && (q.question_text || q.question_key)) || '').toLowerCase();
  const looksQuantity = /\bqty\b|\bquantity\b|how many|how much/.test(text);

  if (hasCandidates && !looksQuantity) {
    return {
      value: true,
      display: 'yes',
      reason: 'This is a product-identity choice. What you pick is remembered, so the same wording on '
        + 'next week\'s list resolves itself.'
    };
  }
  if (looksQuantity) {
    return {
      value: false,
      display: 'no',
      reason: 'This settles a quantity for this week only. It teaches AsdAIr nothing about future shops.'
    };
  }
  return {
    value: null,
    display: P.UNKNOWN,
    // Never "probably not". An unestablished fact is unknown, and saying so is
    // the whole presentation contract of this service.
    reason: 'Nothing durable says whether answering this generalises beyond this week.'
  };
}

/**
 * @param {object} input
 * @param {object} cat    the catalogue index
 * @param {object} [facts] the ONE frozen arithmetic object (AC6). When supplied
 *        - which is always, on the production path - the published counts are
 *        READ from it rather than recounted here. When absent (a direct unit
 *        test of this function), the local bucketing still uses the SAME
 *        `classifyQuestion` the arithmetic uses, so the DEFINITION is
 *        single-source either way and the two cannot mean different things.
 */
function buildQuestions(input, cat, facts) {
  const all = arr(input.questions);

  // ── AC4: EVERY QUESTION LANDS IN EXACTLY ONE BUCKET ──────────────────────
  //
  // The previous filters were `status === undefined || status === 'open'` and
  // `status === 'answered' || status === 'skipped'`. Those two are NOT total:
  // any other value - NULL above all - matched NEITHER, so the question
  // vanished from `items` AND from `resolved`, silently under-reporting both
  // counts. A question that disappears from the arithmetic is exactly what AC6
  // exists to prevent.
  //
  // ⚠️ THIS IS HARDENING, NOT A LIVE-DEFECT FIX, and must never be reported as
  // one. asdair.shop_question.status is NOT NULL DEFAULT 'open' with a CHECK
  // constraining it to open|answered|skipped (migration 006), so the database
  // cannot produce the input this guards against. The only route in is a caller
  // that did not read the column. Verified by execution 2026-08-13.
  //
  // (For the record, the original comment's premise was also inverted: NULL was
  // never treated as open, because `null === undefined` is false in JavaScript.)
  const bucketed = { open: [], answered: [], skipped: [], unknown: [] };
  all.forEach(function (q) { bucketed[classifyQuestion(q)].push(q); });
  const open = bucketed.open;
  const resolved = bucketed.answered.concat(bucketed.skipped);
  const unknownStatus = bucketed.unknown;

  const decisionsByQuestion = new Map();
  arr(input.decisions).forEach(function (d) {
    const k = idKey(d.question_id);
    if (k !== null && !decisionsByQuestion.has(k)) decisionsByQuestion.set(k, d);
  });

  // ── WO-2026-08-19-03 AC2. THE ROUND CHAIN, READ ONCE ─────────────────────
  //
  // `parent_question_id` is the ONLY thing that makes a supersession legible,
  // and it is deliberately the thing consulted rather than the shape of a
  // question_key: parsing the round out of a key would be this view inventing
  // the meaning of a correction, which is precisely what "a second view, not a
  // second brain" forbids. A database without migration 017 supplies neither
  // column, and every field below then reads null - never a fabricated round 1.
  const byId = new Map();
  all.forEach(function (q) {
    const k = idKey(q.id);
    if (k !== null) byId.set(k, q);
  });
  // parent question_key -> the key of the round that REPLACED it.
  const replacedBy = new Map();
  all.forEach(function (q) {
    const parentKey = idKey(q.parent_question_id);
    if (parentKey === null) return;
    const parent = byId.get(parentKey);
    if (parent && parent.question_key !== undefined && parent.question_key !== null) {
      replacedBy.set(String(parent.question_key), q.question_key);
    }
  });
  function supersedesKeyOf(q) {
    const parentKey = idKey(q.parent_question_id);
    if (parentKey === null) return null;
    const parent = byId.get(parentKey);
    return parent && parent.question_key !== undefined ? parent.question_key : null;
  }
  function supersededByKeyOf(q) {
    const k = q.question_key === undefined || q.question_key === null ? null : String(q.question_key);
    return k === null ? null : (replacedBy.get(k) || null);
  }

  // AC2. A superseded round is HISTORY and must not be listed as outstanding -
  // the Telegram board has retired it, and a card sitting here beside its own
  // successor is the same condemned artefact the board stopped showing.
  //
  // Projected from the ONE arithmetic object on the production path. Derived
  // locally only when a direct unit test calls this function without facts, and
  // then from the SAME parent-link data, so the definition is single-source
  // either way - exactly the discipline classifyQuestion already follows above.
  const supersededKeys = new Set(facts && Array.isArray(facts.superseded_question_keys)
    ? facts.superseded_question_keys
    : open.filter(function (q) { return supersededByKeyOf(q) !== null; })
      .map(function (q) { return q.question_key; }));
  const openLive = open.filter(function (q) { return !supersededKeys.has(q.question_key); });

  return {
    // AC6. Projected from the one arithmetic object on the production path.
    //
    // WO-2026-08-19-03 AC2: `questions_open_live`, NOT `questions_open`. The
    // raw bucket keeps the four-bucket totality invariant intact; this is the
    // number a human reads as "still open", and a superseded round is not.
    open_count_display: P.count(facts ? facts.questions_open_live : openLive.length),
    // Said rather than silently deducted - a non-zero value is AsdAIr having
    // re-asked something, which Warwick is entitled to see.
    superseded_count_display: P.count(facts ? facts.superseded_questions_suppressed
      : open.length - openLive.length),
    resolved_count_display: P.count(facts
      ? facts.questions_answered + facts.questions_skipped
      : resolved.length),
    // The count that drives the badge. NOT the same number as open_count:
    // stale referrals (an open question about a line that has since been
    // settled) are open but do not need Warwick, and collapsing the two is how
    // a resolved line stays on the board.
    needing_you_count_display: P.count(facts ? facts.decisions_needing_warwick : null),
    // AC4. Normally 0. A non-zero value means a reader handed us a status the
    // schema forbids - reported rather than swallowed, and the questions
    // themselves are listed below so none is lost.
    unknown_status_count_display: P.count(facts ? facts.questions_unknown_status : unknownStatus.length),
    unknown_status: unknownStatus.map(function (q) {
      return {
        id: q.id === undefined ? null : q.id,
        question_key: q.question_key,
        question_text_display: P.text(q.question_text),
        raw_status_display: P.text(q.status),
        note: 'This question carries a status outside open/answered/skipped. It is neither counted as '
          + 'needing you nor as settled, and it is listed here so it is not lost.'
      };
    }),
    items: openLive.map(function (q) {
      return {
        id: q.id === undefined ? null : q.id,
        // ── THE JOIN KEY (WP-B15-41 AC2) ─────────────────────────────────
        // This is the key a board joins a held line to its candidates by, and
        // it is the one that EXISTS today. The packet contract's
        // `routed_question` names the same value, but nothing writes
        // asdair.execution_packet - no migration creates it and no producer
        // exists in this estate - so `question_key` here is the reachable one.
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
        answer_becomes_durable: durableLearningFor(q),
        // AC2. Which round this is, and what it replaced. An open question that
        // supersedes an earlier one is AsdAIr ASKING AGAIN, and saying so is the
        // difference between a confusing repeat and a legible correction.
        question_round: q.question_round === undefined ? null : q.question_round,
        supersedes_question_key: supersedesKeyOf(q),
        superseded_by_question_key: supersededByKeyOf(q),
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
        // humanWhen(), not P.when() - see the comment on humanWhen() above. This is primary content
        // sitting right beside "You said: ..." / "-> Resolved to ...", not a technical drawer.
        answered_at_display: humanWhen(q.answered_at),
        // The plain-language "what this meant" line. null when no durable
        // decision is on record — the UI shows the raw answer on its own
        // rather than a sentence this module has no grounds for.
        resolution_display: resolutionSentence(q.status, decision),
        decision: decision,

        // ── WO-2026-08-19-03. THE CORRECTION CHAIN, READABLE AFTER A RELOAD ──
        //
        // THE DEFECT THIS CLOSES IS NOT AC2's. AC2 stops a superseded question
        // being counted as OPEN. This is the other half: once a correction has
        // landed, BOTH rounds are resolved, so the payload carried them as two
        // independent settled entries about the same line, with contradicting
        // answers and no stated relationship between them. Warwick reloads and
        // sees himself apparently having said two different things.
        //
        // The link is published as DATA, from `parent_question_id`, so the view
        // never has to pair rounds by parsing a question_key - inventing the
        // meaning of a correction in the client is the same "second brain"
        // failure from the other end.
        //
        // null everywhere when migration 017 is not applied: unknown, not
        // fabricated.
        question_round: q.question_round === undefined ? null : q.question_round,
        supersedes_question_key: supersedesKeyOf(q),
        superseded_by_question_key: supersededByKeyOf(q),

        // THE HONEST MECHANISM, not a client-invented action - the same shape
        // the open items above use, so one rule covers both lists.
        //
        // ⚠️ THE COMMAND IS `correctAnswer`, AND THAT IS THE WHOLE POINT.
        // `answerQuestion` is a compare-and-set on status='open' and is
        // first-answer-wins: aimed at a SETTLED row it silently changes nothing
        // while the surface reports success. A control offering to change a
        // settled answer must name the command that can actually do it.
        allowed_replies: [
          { key: 'correct', label: 'Change this answer', command: 'correctAnswer' }
        ]
      };
    })
  };
}

// =====================================================================
// AC7 - CORROBORATED, NEVER VERIFIED.
//
// Warwick's ruling on 2-of-3 agreement: when several independent readings of
// the same photograph agree, that is CORROBORATION. It is evidence that the
// reading is probably right. It is NOT verification, because nothing checked
// the reading against the world - three runs can agree and all be wrong, and a
// word that implies otherwise invites Warwick to stop looking.
//
// ⛔ SCOPE, STATED SO A LATER SWEEP CANNOT WIDEN IT. This governs CORROBORATION
//    OUTPUT ONLY - the presentation of multi-run agreement about what a line
//    said. It does NOT reach `reconcile/verifyBasket.js`, whose basket-versus-
//    plan check is a genuinely different and legitimate concept: that one
//    compares two observed states and "verify" is the correct word for it.
//    Renaming it would damage correct code to satisfy a rule about something
//    else. It is out of this Work Order's surface and it stays as it is.
//
// THE DATA IS NOT HERE YET, AND THAT IS SAID RATHER THAN PAPERED OVER. The
// support/support_of/support_class fields exist in the finalise artefact
// (services/asdair/pipeline/finalise, Lane AB). asdair.shop_line_provenance has
// no support columns, so a workspace assembled from durable rows alone cannot
// report agreement. This function is the ONE place that vocabulary is minted,
// so when the producer lands there is nowhere else for a "verified" to appear.
// =====================================================================
const CORROBORATION_CLASSES = Object.freeze({
  unanimous: 'every reading agreed',
  majority: 'most readings agreed',
  minority: 'only a minority of readings saw this',
  single: 'seen in one reading only'
});

function corroborationFor(source) {
  const s = source && typeof source === 'object' ? source : {};
  const support = Number(s.support);
  const of = Number(s.support_of);
  const known = Number.isFinite(support) && Number.isFinite(of) && of > 0;
  const cls = typeof s.support_class === 'string' ? s.support_class : null;

  return {
    known: known,
    // The literal word, every time, on the primary reading path. There is no
    // branch of this function that can emit "verified".
    label: known
      ? 'corroborated by ' + support + ' of ' + of + ' readings'
      : 'corroboration unknown',
    support_display: P.count(known ? support : null),
    support_of_display: P.count(known ? of : null),
    support_class_display: P.text(cls),
    support_class_meaning: cls && CORROBORATION_CLASSES[cls] ? CORROBORATION_CLASSES[cls] : P.UNKNOWN,
    // The caveat travels WITH the number, so a UI cannot render the reassuring
    // half and drop the honest half.
    caveat: 'Agreement between readings is corroboration, not verification. Nothing has checked this '
      + 'against the shelf.'
  };
}

// =====================================================================
// AC2 - THE EXCEPTION BOARD, SERVED AS DATA.
//
// One entry per line the planner could not settle. Everything a person needs to
// decide, without opening another screen: what AsdAIr read, what it proposes,
// what the sensible alternatives are, why it is uncertain, whether answering
// teaches the household something durable - and the JOIN KEY.
//
// ── THE JOIN KEY, AND WHY IT IS `question_key` ────────────────────────────
// A board is useless if it cannot get from a held line to that line's
// candidates and its answer route. `question_key` is that key, it is on
// asdair.shop_question, and readWorkspace already selects it.
//
// The packet contract names the same value `routed_question` on its held lines,
// and readPacket.js now passes it through (see presentHeld there). But NOTHING
// WRITES asdair.execution_packet: no migration creates the table and no producer
// exists anywhere in this estate, verified 2026-08-13. So `routed_question` is
// structurally correct and returns unknown on every request today, while THIS
// key is the one a board can actually join on. Both are published; only one is
// reachable, and a consumer must not be left guessing which.
// =====================================================================
const HELD_REASON_PLAIN = Object.freeze({
  needs_decision: 'AsdAIr could not settle which product you meant.',
  requested: 'AsdAIr has asked about this and is waiting for your answer.'
});

function buildExceptions(input, cat) {
  const items = arr(input.list_items);
  const questions = arr(input.questions);
  const alternatives = arr(input.alternatives);

  // Open questions indexed by the list item they are about, so a held line can
  // reach its own question rather than the first one on the shop.
  const openByItem = new Map();
  questions.forEach(function (q) {
    if (classifyQuestion(q) !== 'open') return;
    const k = idKey(q.list_item_id);
    if (k === null) return;
    if (!openByItem.has(k)) openByItem.set(k, q);
  });

  const altsByItem = new Map();
  alternatives.forEach(function (a) {
    const k = idKey(a.list_item_id);
    if (k === null) return;
    if (!altsByItem.has(k)) altsByItem.set(k, []);
    altsByItem.get(k).push(a);
  });

  const held = items.filter(isHeldItem);

  return {
    // Projected from the ONE arithmetic source by the caller; this count is the
    // length of what is actually served, so the board and its badge are the
    // same list by construction.
    count_display: P.count(held.length),
    items: held.map(function (item, i) {
      const k = idKey(item.id);
      const q = k === null ? null : (openByItem.get(k) || null);
      const regular = cat.get(item.matched_regular_id);

      // Candidates from the question (which carry catalogue ids) plus shop-floor
      // alternatives (which do NOT - their id is the alternative row's own key,
      // and reading it as a regulars id would point at a different product).
      const candidates = [];
      arr(q && q.candidates).forEach(function (c, idx) {
        const r = cat.get(c && (c.id !== undefined ? c.id : c.regular_id));
        candidates.push({
          index: idx,
          source: 'catalogue_candidate',
          regular_id_display: P.count(r ? r.id : (c && c.id)),
          label_display: P.text(r ? r.name : (c && (c.name || c.label || c.text))),
          brand: presentBrand(r ? r.brand : null),
          from_catalogue: !!r
        });
      });
      arr(altsByItem.get(k)).forEach(function (a, idx) {
        candidates.push({
          index: candidates.length + idx,
          source: 'product_alternative',
          regular_id_display: P.UNKNOWN,
          label_display: P.text(a.alternative_name),
          brand: presentBrand(null),
          from_catalogue: false
        });
      });

      return {
        line_no: item.line_no === undefined || item.line_no === null ? i + 1 : item.line_no,
        list_item_id: item.id === undefined ? null : item.id,

        // ⭐ THE JOIN KEY. Null when the held line has no open question yet -
        // which is a real state (the planner held it before anything was asked)
        // and is left null rather than invented.
        question_key: q ? q.question_key : null,
        question_key_display: P.text(q ? q.question_key : null),
        question_id: q && q.id !== undefined ? q.id : null,
        question_text_display: P.text(q ? q.question_text : null),

        // WHAT ASDAIR READ, verbatim. Never edited, never replaced by a product
        // name - this is the evidence, and it is the thing Warwick recognises.
        as_written_display: P.text(item.raw_reading !== undefined ? item.raw_reading : item.item_name),

        // WHAT IT PROPOSES. Only ever a name looked up from our own catalogue by
        // id, exactly as buildLine does. Model prose is never promoted here.
        proposed_product_display: P.text(regular ? regular.name : null),
        proposed_regular_id_display: P.count(regular ? regular.id : null),
        proposed_brand: presentBrand(regular ? regular.brand : null),

        alternatives: candidates,
        alternatives_count_display: P.count(candidates.length),

        why_uncertain_display: P.text(HELD_REASON_PLAIN[item.status] || item.note || null),
        plan_status_display: P.text(item.status),

        answer_becomes_durable: q ? durableLearningFor(q) : durableLearningFor({ candidates: [] }),

        // AC7. Structurally present, honest when the producer has not landed.
        corroboration: corroborationFor(item.provenance_detail),

        // ── AC2 / FINDING F: THE REGION REFERENCE, PRESENT AND EMPTY ────────
        // Migration 020 creates asdair.shop_image_region and DELIBERATELY does
        // not backfill it; the writer is Lane AB's pipeline. Confirmed empty on
        // the target (0 rows) on 2026-08-13. The field is served so a consumer
        // can bind to it now; NOTHING IS FABRICATED FOR IT, and `pending` says
        // plainly which producer owes it.
        image_region: {
          known: false,
          region_id_display: P.UNKNOWN,
          pending: 'asdair.shop_image_region is empty. Migration 020 creates it and deliberately does '
            + 'not backfill it; the vision pipeline (Lane AB) is what writes it.'
        },

        // The reply set is the question's, so a board never offers an action
        // with no command behind it. A held line with no question yet can only
        // be answered once one is opened.
        can_answer_now: !!q,
        allowed_replies: q
          ? [
            { key: 'choose', label: 'Choose this one', command: 'answerQuestion' },
            { key: 'typed', label: 'Type a correction', command: 'answerQuestion' },
            { key: 'search', label: 'Search ASDA', command: 'answerQuestion' },
            { key: 'skip', label: 'Skip this week', command: 'answerQuestion' }
          ]
          : []
      };
    })
  };
}

// =====================================================================
// AC5 - THE FINAL LIST, BRAND-SORTED.
//
// The order Warwick shops in, not the order the database happens to return.
// BRAND, then product name - the same brand_az_then_product_az contract the
// packet declares, because the ordering IS the speed in a physical shop.
//
// ⛔ THE SENTINEL IS A SORT KEY, NOT A BRAND. The producer writes
//    "ZZ (no brand recorded)" to push unbranded lines last - it appears on all
//    8 held lines of the real 2026-08-13 shop. Rendering it as a brand would
//    print a fake manufacturer on the list Warwick shops from. shopArithmetic's
//    presentBrand() splits the value into what it SORTS as and what it READS
//    as, and only the sort key ever sees the sentinel.
//
// EXCEPTIONS ARE A SEPARATE COLLECTION AND ARE NEVER MIXED IN. A line nobody
// has settled is not something to put in a trolley, and interleaving the two
// is how an unresolved item gets bought by accident.
// =====================================================================
function buildFinalList(input, cat) {
  const items = arr(input.list_items);
  const origins = input.item_origins && input.item_origins.get ? input.item_origins : null;

  const shoppable = items.filter(function (it) {
    return it && !isHeldItem(it) && SKIPPED_ITEM_STATUSES.indexOf(it.status) === -1;
  });

  const lines = shoppable.map(function (item, i) {
    const regular = cat.get(item.matched_regular_id);
    const brand = presentBrand(regular ? regular.brand : null);
    const productName = regular ? regular.name : null;

    // PURCHASE QUANTITY: what will actually be bought. `added_qty` once the run
    // has concluded, otherwise what was requested. Never defaulted to 1 - an
    // unknown quantity reads as unknown.
    const purchaseQty = Number.isFinite(Number(item.added_qty)) && Number(item.added_qty) > 0
      ? Number(item.added_qty)
      : (Number.isFinite(Number(item.requested_qty)) ? Number(item.requested_qty) : null);

    const origin = origins
      ? (origins.get(item.id === undefined || item.id === null ? null : String(item.id)) || null)
      : null;

    return {
      line_no: item.line_no === undefined || item.line_no === null ? i + 1 : item.line_no,
      list_item_id: item.id === undefined ? null : item.id,

      // THE THREE FIELDS THE PAGE SHOWS.
      brand_display: brand.display,
      product_display: P.text(productName),
      purchase_quantity_display: P.count(purchaseQty),

      // Kept so a consumer can prove the order rather than trust it, and so the
      // sentinel is inspectable without ever being printed as a brand.
      has_brand: brand.known,
      brand_is_sort_sentinel: brand.is_sentinel,

      // ON EXPANSION: where this line came from, in plain English.
      provenance: origin,
      provenance_display: P.text(origin),
      provenance_meaning: origin ? (PROVENANCE_PLAIN[origin] || P.UNKNOWN) : P.UNKNOWN,
      asda_product_id_display: P.text(regular ? regular.asda_product_id : null),
      as_written_display: P.text(item.raw_reading !== undefined ? item.raw_reading : item.item_name),
      corroboration: corroborationFor(item.provenance_detail),

      _sort: { brand: brand.sort_key, product: String(productName || '').trim().toLowerCase() }
    };
  });

  lines.sort(function (a, b) {
    if (a._sort.brand < b._sort.brand) return -1;
    if (a._sort.brand > b._sort.brand) return 1;
    if (a._sort.product < b._sort.product) return -1;
    if (a._sort.product > b._sort.product) return 1;
    return 0;
  });
  lines.forEach(function (l) { delete l._sort; });

  const units = lines.reduce(function (n, l) {
    const q = Number(l.purchase_quantity_display);
    return n + (Number.isFinite(q) ? q : 0);
  }, 0);

  return {
    sort_contract: 'brand_az_then_product_az',
    // Asserted rather than claimed: this module DID the sort, so the contract is
    // true by construction here - and the test proves it on data that would
    // break a naive comparison.
    sort_applied: true,
    lines: lines,
    lines_count_display: P.count(lines.length),
    units_count_display: P.count(units),
    unbranded_count_display: P.count(lines.filter(function (l) { return !l.has_brand; }).length),
    exceptions_are_separate: true,
    exceptions_note: 'Lines nobody has settled are NOT in this list. They are in `exceptions`, and '
      + 'mixing the two is how an unresolved item ends up in the trolley.'
  };
}

const PROVENANCE_PLAIN = Object.freeze({
  PHOTO: 'read from the photograph of your list',
  REGULARS: 'added from your Regulars',
  RULE: 'added by a standing household rule',
  WARWICK: 'you decided this',
  SKIPPED: 'deliberately not bought this week'
});

// =====================================================================
// AC1 - THIS WEEK'S SHOP, IN ONE PAYLOAD.
//
// Every figure here is READ FROM the one frozen arithmetic object. Nothing in
// this function counts anything (AC6): it is a projection, and the only way to
// change a number on this block is to change it in shopArithmetic.countShop,
// which changes it everywhere at once.
//
// THE VERDICT READS THE STORED COLUMN. `canonical_state` is
// asdair.shop.human_state, resolved by shopStatus/humanState and never
// re-derived from row counts here. That single stored value is the entire point
// of migration 020, and a recomputation on this block would put a second
// opinion about the shop's state one line away from the first.
// =====================================================================
/**
 * AC6 - THE INVARIANT, PUBLISHED RATHER THAN ASSUMED.
 *
 * Every count that appears in more than one block of this payload is a
 * projection of the ONE frozen arithmetic object, so those cannot drift by
 * construction. This block covers the case that construction cannot reach: a
 * number that comes from a genuinely DIFFERENT source and merely ought to
 * agree - shopStatus's own rollup of the durable projection.
 *
 * WHERE THEY DISAGREE, THE PAYLOAD SAYS SO. It does not pick a winner and it
 * does not average them. A silent choice between two numbers is how a reader
 * ends up confidently wrong; a loud disagreement is something someone can fix.
 */
function buildCountAgreement(facts, status) {
  const rollupTotal = status && status.lines && status.lines.total !== null
    && status.lines.total !== undefined ? Number(status.lines.total) : null;
  const comparable = rollupTotal !== null && Number.isFinite(rollupTotal);
  const agrees = comparable ? rollupTotal === facts.lines_total : null;

  return {
    // The number every "needs you" in this payload projects. Named once so a
    // consumer can assert against it rather than against a block it happened
    // to read first.
    canonical_needing_you_display: P.count(facts.decisions_needing_warwick),
    canonical_held_lines_display: P.count(facts.uncertain_lines),
    published_by: [
      'shop.why.counts.decisions_needing_warwick',
      'this_week.blocking_decisions_display',
      'questions.needing_you_count_display'
    ],
    // NOT comparable is its own answer. `null` here means the projection had
    // nothing to say about lines, which is not the same as agreement.
    line_rollup_comparable: comparable,
    line_rollup_total_display: P.count(rollupTotal),
    line_rows_total_display: P.count(facts.lines_total),
    line_counts_agree: agrees,
    disagreement: agrees === false
      ? 'shopStatus reports ' + rollupTotal + ' line(s) for this shop while ' + facts.lines_total
        + ' asdair.shop_line row(s) were read. One of the two is stale; neither has been preferred here.'
      : null
  };
}

function buildThisWeek(facts, status) {
  const prov = facts.provenance_counts;
  const drift = detectStateDrift(status);
  return {
    // ── THE VERDICT ────────────────────────────────────────────────────────
    verdict: facts.human_state,
    verdict_display: P.text(facts.human_state),
    verdict_source_display: P.text(status.human_state_source || 'derived'),
    verdict_is_stored_value: (status.human_state_source || 'derived') === 'column',
    verdict_note: 'Read from asdair.shop.human_state. This service never re-derives the working/'
      + 'needs-you verdict from row counts.',

    // ── THE STANDING HAZARD, SURFACED RATHER THAN PAPERED OVER ────────────
    // Migration 020 installs NO trigger on human_state, so any writer that
    // updates `status` without updating `human_state` in the same transaction
    // leaves the two disagreeing - and this service would otherwise display the
    // stale one with complete confidence. `verdict` above is STILL the stored
    // value; this block only says whether the shop's own status agrees with it.
    // Reported, never resolved by preferring a field. The fix is at the write
    // side and is a schema decision, not this reader's to make.
    verdict_agrees_with_status: drift.agrees,
    verdict_drift_checked: drift.checked,
    verdict_expected_from_status_display: P.text(drift.expected_from_status),
    verdict_contradiction: drift.contradiction,

    // ── THE SHAPE OF THE SHOP ──────────────────────────────────────────────
    source_lines_display: P.count(facts.source_lines),
    final_products_display: P.count(facts.final_products),
    total_items_display: P.count(facts.final_items),
    reconciled_products_display: P.count(facts.reconciled_products),

    // ── WHERE IT CAME FROM. Four origins, never collapsed into one total. ──
    by_provenance: {
      photo_display: P.count(prov ? prov.PHOTO : null),
      regulars_display: P.count(prov ? prov.REGULARS : null),
      rule_display: P.count(prov ? prov.RULE : null),
      warwick_display: P.count(prov ? prov.WARWICK : null),
      unattributed_display: P.count(facts.provenance_unattributed)
    },
    skipped_display: P.count(prov ? prov.SKIPPED : null),

    // ── WHAT IS NOT SETTLED. Two different populations, kept apart. ────────
    // `uncertain` is lines the planner could not settle. `blocking` is open
    // questions genuinely waiting on Warwick, stale referrals already removed.
    // A held line may carry no question yet, and a question may sit on a line
    // that has since been settled, so one number could never carry both.
    uncertain_lines_display: P.count(facts.uncertain_lines),
    blocking_decisions_display: P.count(facts.decisions_needing_warwick),
    stale_suppressed_display: P.count(facts.stale_questions_suppressed),

    arithmetic_source: 'cockpit-api/shopArithmetic.js countShop()'
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

  // WHERE EVERY LINE CAME FROM (AC4). Computed once, here, and consumed both
  // by the summary block and by the per-line labels - so the board and the
  // breakdown can never attribute the same item to two different origins.
  const prov = computeProvenance({
    shop_lines: arr(src.shop_lines),
    list_items: arr(src.list_items),
    decisions: arr(src.decisions),
    source_images: arr(src.source_images),
    status: status,
    // WP-B15-41 AC9. The reader's PROBED answer, never this module's guess.
    provenance_ledger_available: src.provenance_ledger_available,
  });

  // ── AC6: THE ONE DERIVATION, AND EVERYTHING BELOW IS A PROJECTION OF IT ──
  //
  // Derived exactly once, here, before any block is built. `why.counts`,
  // `this_week`, `questions`' counts and `lines_summary` all READ this object;
  // none of them counts anything for itself. That is what makes "two endpoints
  // can never report different counts of what needs Warwick" a property of the
  // shape rather than a thing four functions currently happen to agree on.
  const facts = countShop({
    stage: status.stage,
    human_state: computeCanonicalState(status),
    questions: arr(src.questions),
    // ⚠️ THE REAL KEY, AND IT WAS WRONG. readWorkspace.js supplies the
    // asdair.shop_line rows as `shop_lines`; this call read `src.lines`, which
    // that reader never sets. So every line-derived count in `why.counts` has
    // been 0 on every real request while `provenance.source_lines` reported the
    // true figure from the same rows - two blocks of ONE payload disagreeing
    // about the same fact, which is precisely what AC6 exists to end. Every
    // fixture passed because the fixtures set `lines` directly.
    //
    // Same defect class, and the same fix, as the `list_items` / `items` line
    // below - which carries a comment saying so, one argument away.
    lines: arr(src.shop_lines).length > 0 ? arr(src.shop_lines) : arr(src.lines),
    // THE REAL KEY THIS READER SUPPLIES. readWorkspace.js passes the list rows
    // as `list_items`; reading `src.items` would have silently explained an
    // empty list on every real request while every fixture passed.
    items: arr(src.list_items).length > 0 ? arr(src.list_items) : arr(src.items),
    provenance: prov,
  });

  // The sentence is built from those same facts - explainState re-derives
  // nothing when handed them, so the prose and the counters remain one
  // computation returned twice.
  const explain = explainState({ facts: facts });

  const listItemsForView = arr(src.list_items).length > 0 ? arr(src.list_items) : arr(src.items);
  const exceptionsInput = {
    list_items: listItemsForView,
    questions: arr(src.questions),
    alternatives: arr(src.alternatives),
  };
  const finalListInput = {
    list_items: listItemsForView,
    item_origins: prov.item_origins,
  };

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
      // THE ONE canonical six-value state (WP-B15-35 AC1/AC2). No longer a
      // placeholder: it is now asdair.shop.human_state, read from the durable
      // column where migration 020 has been applied and derived by the SAME
      // shared mapping (shop/humanState.js) where it has not. canonicalState.js
      // delegates and derives nothing of its own, so no second surface can
      // reach a different answer.
      canonical_state: computeCanonicalState(status),
      // WHICH PATH ANSWERED: 'column' (durable) or 'derived' (migration 020 not
      // applied here). Exposed rather than hidden so a missing migration is
      // visible in the payload instead of being silently papered over.
      canonical_state_source: status.human_state_source || 'derived',

      // "WHY ISN'T MY BASKET READY?" - ONE TRUTHFUL SENTENCE (AC3).
      //
      // `why.sentence` is what Warwick reads; `why.counts` is what the UI
      // renders beside it. They are the SAME arithmetic, computed once in
      // explainState.js - the sentence is a pure function of the counts and
      // cannot see the raw rows at all, so a counter and the sentence cannot
      // contradict each other. That is the whole point: Warwick must never be
      // asked to reconcile two numbers himself.
      why: explain,
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
      // ── AC6, AND THE CORRECTION THAT MADE IT HONEST ─────────────────────
      //
      // This block reads shopStatus's OWN rollup, and it keeps doing so. An
      // earlier pass of this Work Order projected it from the frozen facts
      // instead, on the reasoning that two derivations over the same rows is
      // exactly what AC6 forbids. That was wrong, and the existing proof
      // "null durable facts render as unknown and never as 0" caught it
      // immediately: `status.lines` is NULL when the projection has nothing to
      // say, while a count over an absent array is 0 - so the change quietly
      // turned "we do not know" into "there are none", which is the single
      // rule this whole service is built on.
      //
      // The two are also not the same question. `status.lines` is shopStatus's
      // rollup of the durable projection; `facts.lines_*` counts the shop_line
      // rows this reader was handed. They SHOULD agree, and where they do not
      // that is a real signal - so they are reconciled explicitly in
      // `count_agreement` below rather than one being silently overwritten by
      // the other. Forcing two different questions to return one number is not
      // single-sourcing; it is hiding a disagreement.
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

    // ── AC4: THE PROVENANCE BREAKDOWN ────────────────────────────────────
    // `*_display` string fields, because that is the contract the parallel
    // Cockpit UI built against: it reads each value through its own
    // asdairCount(), which maps the literal 'unknown' to null and renders an
    // HONEST GAP rather than a number. P.count() emits exactly that - so an
    // origin we cannot evidence arrives as 'unknown' and is DISPLAYED as a
    // gap, never as a fabricated zero.
    //
    // The four origins stay separate keys. There is deliberately no combined
    // 'added by AsdAIr' total anywhere in this block.
    provenance: {
      photo_display: P.count(prov.counts.PHOTO),
      regulars_display: P.count(prov.counts.REGULARS),
      rules_display: P.count(prov.counts.RULE),
      warwick_display: P.count(prov.counts.WARWICK),
      skipped_display: P.count(prov.counts.SKIPPED),
      unattributed_display: P.count(prov.unattributed),

      source_lines_display: P.count(prov.source_lines),
      source_read_status_display: P.text(prov.source_read_status),
      reconciled_products_display: P.count(prov.reconciled_products),
      final_products_display: P.count(prov.final_products),
      final_items_display: P.count(prov.final_items),
      summary_display: P.text(prov.summary),

      // WHAT WE CANNOT EVIDENCE, IN WORDS. Each entry names the missing
      // mechanism, so a gap on screen can be acted on rather than merely
      // noticed. Empty means every bucket above is evidenced.
      gaps: prov.gaps,

      // WP-B15-41 AC9. true / false / null-for-nobody-asked. Lets a reader tell
      // "the ledger is empty" from "the ledger is absent" from "not probed" -
      // three situations this service previously collapsed into one false claim
      // that migration 020 was unapplied.
      ledger_available: prov.provenance_ledger_available,
    },

    // ── AC1: THIS WEEK'S SHOP, ONE PAYLOAD ─────────────────────────────────
    this_week: buildThisWeek(facts, status),

    // ── AC6: THE SINGLE-SOURCE INVARIANT, VISIBLE IN THE PAYLOAD ───────────
    count_agreement: buildCountAgreement(facts, status),

    // ── AC2: THE EXCEPTION BOARD, SERVED AS DATA ───────────────────────────
    exceptions: buildExceptions(exceptionsInput, cat),

    // ── AC5: THE FINAL LIST, BRAND-SORTED ──────────────────────────────────
    final_list: buildFinalList(finalListInput, cat),

    interpretation: buildInterpretation({ shop: shop, list_items: src.list_items, alternatives: src.alternatives, questions: src.questions, item_origins: prov.item_origins }, cat),
    plan: buildPlan(src, cat),
    questions: buildQuestions(src, cat, facts),
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
    humanWhen: humanWhen,
    decisionSummary: decisionSummary,
    resolutionSentence: resolutionSentence,
    buildBrowser: buildBrowser,
    buildOrder: buildOrder,
    buildHistory: buildHistory,
    buildExceptions: buildExceptions,
    buildFinalList: buildFinalList,
    buildThisWeek: buildThisWeek,
    buildCountAgreement: buildCountAgreement,
    corroborationFor: corroborationFor,
    durableLearningFor: durableLearningFor,
    PROVENANCE_PLAIN: PROVENANCE_PLAIN,
    CORROBORATION_CLASSES: CORROBORATION_CLASSES
  }
};
