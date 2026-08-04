// =====================================================================
// BUILD-015 AsdAIr - the learning loop: buildAnswerLearning.js
//
// THE DEFECT THIS CLOSES (END-TO-END-PROCESS-AUDIT.md blocker 7):
//   asdair.shop_question is UNIQUE on (shop_id, question_key). Next week is a
//   new shop_id, so every question is a FRESH question and Warwick re-answers
//   what he already answered. He answered Nescafe Azera and toothpaste on
//   2026-07-06, Ariel Pods and the Sure rotation on 2026-07-21, and on
//   2026-08-03 the shop asked him about all of them again.
//
//   Every component needed to stop that already existed and was tested.
//   NOTHING JOINED THEM UP. promoteDecision.js had one caller (a hand-run
//   CLI); updateRegulars.js had one automatic caller that could only enrich an
//   ALREADY-KNOWN item. This module is the join.
//
//   buildAnswerLearning(answer) -> { decision, regulars, pending_actions,
//                                    suppression }
//
// PURE: no DB, no network, no fs, no clock, no randomness. It never mutates
// its argument. It returns a WRITE PLAN whose every element is already a valid
// input to a writer that exists:
//   * `decision`        -> promoteDecision(decision)   (rule_qa_log + rules)
//   * `regulars[]`      -> updateRegulars(operation)   (aliases + new items)
//   * `pending_actions[]` -> recordAnswerLearning      (asdair.pending_action)
// Building the plan and performing it are separated for the same reason
// buildOutcome/recordShopOutcome and buildPromotion/promoteDecision are: every
// rule below is testable with no database at all.
//
// ---------------------------------------------------------------------
// WHAT MAKES NEXT WEEK'S QUESTION NOT HAPPEN - and it is NOT the rule
// ---------------------------------------------------------------------
// Read this before changing anything here, because the obvious answer is the
// wrong one.
//
// A promoted STANDING RULE is the audit record of a decision. It is NOT
// reliably the thing that stops the question, because:
//   * planner.js actionableRules() DISCARDS every rule whose directive is
//     'info', and an unproven promotion is inert 'info' BY DESIGN; and
//   * rule matching is exact-string on match_term.
//
// The thing that actually stops the question is the ALIAS. planner.js
// regularHits() resolves a line when normaliseTerm(item_name) appears in the
// regular's `aka` array, which moves the line from 'needs_decision' to 'add' -
// and only a 'needs_decision' line ever becomes a shop_question. So:
//
//   >> THE PHOTOGRAPHED WORDING BECOMING AN ALIAS IS THE HIGHEST-VALUE
//   >> SINGLE WRITE IN THIS ENTIRE LOOP. <<
//
// It is therefore NOT left to the caller to remember. When the answer
// establishes identity, this module adds the photographed wording itself. A
// caller cannot omit it, because a caller that forgets it is exactly how
// 2026-08-03 happened.
//
// The two normalisations must agree or the alias never matches:
// buildRegularsUpdate.normaliseAlias and skill/planner.js normaliseTerm are
// character-for-character the same rule (trim -> lower -> collapse
// whitespace). answerSurvivesTheWeek.test.js pins that equivalence against the
// PLANNER'S OWN function, imported, so a drift in either copy fails a test
// rather than silently re-opening blocker 7.
//
// ---------------------------------------------------------------------
// WHAT IS NEVER INFERRED
// ---------------------------------------------------------------------
// pipeline/deps.js:252-258 refuses to wire promoteDecision because "the
// pipeline does not currently capture 'and this applies going forward' as a
// distinct human act. Guessing it would be exactly the ambiguous-inference
// failure promoteDecision's own provenance guard exists to stop."
//
// That reasoning is CORRECT and is preserved here rather than worked around.
// This module does not guess either:
//   * `applies_going_forward` must be a STRICT boolean supplied by the caller.
//     Absent is an ERROR, never a default. A standing rule changes every future
//     basket forever; it is a human act or it does not happen.
//   * `resolution.kind` must be stated. "The answer probably meant this
//     product" is not a thing this module computes.
//   * `source_document_id` is passed through untouched. Only the DATABASE, via
//     promoteDecision's applySourceVerdict(), can turn a requested actionable
//     directive into a real one. Nothing here can, and no flag is offered.
//   * `asked_on` is required. This module has no clock: when a question was
//     asked is a fact of the question, not something to invent.
//
// A SKIPPED question establishes NOTHING. "Leave it this week" is transient
// (rule 10): no alias, no new regular, no promotion. It still writes its
// rule_qa_log row, because the fact that it was asked and declined is itself
// durable learning.
//
// PURE ASCII only.
// =====================================================================

'use strict';

const { normaliseAlias } = require('./buildRegularsUpdate');

// What the answer established. Stated by the caller, never computed here.
//   known_product : the answer identified an EXISTING asdair.regulars row.
//   new_product   : the answer approved a genuinely NEW product.
//   none          : the answer resolved no identity (a skip, or a pure policy
//                   answer such as "only if it is on offer").
const RESOLUTION_KINDS = ['known_product', 'new_product', 'none'];

// asdair.shop_question.status vocabulary (db/006_shop_control_surface.sql:104).
// 'open' is not answerable learning - it has no answer yet.
const ANSWER_STATUSES = ['answered', 'skipped'];

// asdair.shop_question.answer_source vocabulary.
const ANSWER_SOURCES = ['button', 'typed'];

// CANONICAL-WEEKLY-SHOP-PROCESS.md section E: "source view: Regulars or
// Favourites - tells Sonnet where to look".
const SOURCE_VIEWS = ['regulars', 'favourites'];

// The ONE place the source-view vocabulary is translated into the
// asdair.regulars.source column value.
//
// VERIFIED AGAINST LIVE DATA 2026-08-04, and the result is worth stating
// exactly, because half of this constant describes nothing that exists:
//
//   select distinct source from asdair.regulars
//     -> 'regular'  x103        (after migration 014)
//
// There is NO 'favourite' row, and there never has been. So:
//
//   * 'regular'   DESCRIBES live data.
//   * 'favourite' is a FORWARD CONTRACT. It is what this build will write when
//     a Favourites item is first learned; it is not a description of anything
//     currently in the table. CANONICAL-WEEKLY-SHOP-PROCESS.md carries
//     "Favourites represented as a distinct source view" as NOT VERIFIED, and
//     the reason is now established rather than suspected: the distinction is
//     not merely unproven end-to-end, it is UNREPRESENTED in the data.
//
// Do not read the presence of this key as evidence that Favourites are modelled
// live. Anything asserting that must cite a row, not this constant.
//
// WHY THE COLUMN'S CONTENT MATTERS AT ALL. `source` is part of the
// UNIQUE (household_id, source, name) identity, so a value that varies for one
// product defeats that constraint entirely. Six rows once carried
// source = 'learned-2026-08-03' - a DATE in a column meaning "which ASDA view
// to look in" - which migration 014 corrected to 'regular'. A hand-written
// INSERT repeating that pattern with a new date WOULD have created a second
// active row for one product, and two active regulars answering one term is
// what planner.js reports as AMBIGUOUS -> needs_decision: the exact question
// this module exists to prevent.
//
// This module's own path was already defended against that: updateRegulars'
// dedupe guard matches on (household_id, NORMALISED name) and is deliberately
// NOT scoped to `source` (updateRegulars.js:94-105), so it ADOPTS such a row
// rather than creating a twin. The exposure was always the HAND-WRITTEN path,
// which has only the UNIQUE constraint behind it. Recorded so nobody
// "hardens" the guard against a failure it already handles, or relaxes it
// believing the constraint alone is enough.
//
// It is a single exported constant precisely so that correcting it is a
// one-line change with one test to update, and so the contract is visible
// rather than scattered through the code. A caller may also pass an explicit
// `regulars_source` to bypass the mapping entirely.
const SOURCE_VIEW_TO_REGULARS_SOURCE = {
  regulars: 'regular',
  favourites: 'favourite'
};

// asdair.pending_action.action_type for "the ASDA Favourite control was not
// clicked". db/006_shop_control_surface.sql names this exact case in its own
// comment: "browser-only maintenance that could not be completed (e.g. 'add
// Wall's to ASDA Favourites'). Surfaced in status, never forgotten."
const ADD_FAVOURITE_ACTION = 'add_favourite';

// The answer text recorded for a skipped question. A skip carries no words
// from Warwick, and promoteDecision requires a non-empty answer, so the log
// would otherwise be unwritable. This is a RENDERING of a known act, not an
// invented decision: the status is carried in the same row and the text is a
// fixed constant, never a paraphrase of anything.
const SKIP_ANSWER_TEXT = 'skipped: leave it this week';

// How a term is prevented from becoming a question again. Reported per term so
// the caller (and the acceptance test) can tell a load-bearing mechanism from
// an audit record - see the header.
const SUPPRESSION_MECHANISMS = ['alias', 'new_regular', 'standing_rule'];

function fail(message) {
  throw new Error('buildAnswerLearning: ' + message);
}

function requireText(value, name) {
  if (value === null || value === undefined) fail(name + ' is required');
  const s = String(value).trim();
  if (s === '') fail(name + ' must be a non-empty string');
  return s;
}

function optionalText(value) {
  if (value === null || value === undefined) return null;
  const s = String(value).trim();
  return s === '' ? null : s;
}

function requireOneOf(value, allowed, name) {
  const s = requireText(value, name);
  if (allowed.indexOf(s) === -1) {
    fail(name + ' "' + s + '" is not one of: ' + allowed.join(', '));
  }
  return s;
}

function strictBoolean(value, name) {
  if (value !== true && value !== false) {
    fail(name + ' must be exactly true or false (a human decision is not a truthy value)');
  }
  return value;
}

function optionalId(value, name) {
  if (value === null || value === undefined || value === '') return null;
  const s = String(value).trim();
  if (!/^\d+$/.test(s) || s === '0') {
    fail(name + ' must be a positive integer id when given (got "' + s + '")');
  }
  const n = Number(s);
  return Number.isSafeInteger(n) ? n : s;
}

function requireId(value, name) {
  const id = optionalId(value, name);
  if (id === null) fail(name + ' is required');
  return id;
}

// Collect alias candidates, normalised and de-duplicated, dropping empties.
// Order is preserved so the generated plan is deterministic and diffable.
function collectAliases(candidates) {
  const out = [];
  const seen = Object.create(null);
  (Array.isArray(candidates) ? candidates : []).forEach(function (raw) {
    const s = normaliseAlias(raw);
    if (s === '') return;
    if (seen[s] === true) return;
    seen[s] = true;
    out.push(s);
  });
  return out;
}

// ---------------------------------------------------------------------
// buildAnswerLearning(answer) -> plan
//
// answer:
// {
//   // ---- the question, straight off asdair.shop_question ----
//   shop_id               : required. Present so the plan records WHICH shop
//                           taught us this; it is never a promotion input.
//   question_key          : required. The (shop_id, question_key) key that is
//                           unique per shop and is why answers died weekly.
//   question_text         : required. Written verbatim to rule_qa_log.
//   asked_on              : required, 'YYYY-MM-DD' or Date. No clock here.
//   status                : required, 'answered' | 'skipped'
//   answer_text           : required when status is 'answered'
//   answer_source         : optional, 'button' | 'typed'
//   household_id          : optional (null = applies to all)
//
//   // ---- the wording that CAUSED the question ----
//   photographed_wording  : required. What was actually written on the
//                           photograph. This becomes the alias, which is what
//                           actually prevents next week's question.
//
//   // ---- what the answer ESTABLISHED. Stated, never inferred ----
//   resolution: {
//     kind                : required, see RESOLUTION_KINDS
//     regular_id          : required when kind is 'known_product'
//     aliases             : optional extra wordings the answer establishes
//     approved_search_term: Warwick's approved wording (new products)
//     product             : required when kind is 'new_product':
//       { name, brand?, asda_product_id?, asda_url?, category?,
//         high_level_category?, typical_qty?, substitutes_allowed?,
//         source_view?, regulars_source?, favourite_action_completed? }
//   }
//
//   // ---- the standing-rule intent: an explicit human act ----
//   applies_going_forward : required STRICT boolean
//   one_week_only         : optional; true => never promoted (rule 10)
//   rule                  : required when applies_going_forward is true
//   source_document_id    : the provenance promoteDecision verifies against
// }
//
// Returns:
// {
//   decision        : the promoteDecision input (ALWAYS present)
//   regulars        : updateRegulars operations, in order
//   pending_actions : asdair.pending_action rows to insert
//   suppression     : { terms: [{ term, mechanism, regular_id? }],
//                       prevents_repeat: boolean }
//   context         : { shop_id, question_key, status }
// }
// ---------------------------------------------------------------------
function buildAnswerLearning(answer) {
  const a = answer || {};

  const shopId = requireId(a.shop_id, 'shop_id');
  const questionKey = requireText(a.question_key, 'question_key');
  const questionText = requireText(a.question_text, 'question_text');
  const status = requireOneOf(a.status, ANSWER_STATUSES, 'status');
  const householdId = optionalId(a.household_id, 'household_id');
  const sourceDocumentId = optionalId(a.source_document_id, 'source_document_id');

  // The wording that produced the question. Required even on a skip: it is the
  // evidence of WHAT was asked about, and losing it is how a re-ask becomes
  // untraceable.
  const photographed = requireText(a.photographed_wording, 'photographed_wording');

  if (a.answer_source !== null && a.answer_source !== undefined) {
    requireOneOf(a.answer_source, ANSWER_SOURCES, 'answer_source');
  }

  const skipped = status === 'skipped';

  if (skipped && optionalText(a.answer_text) !== null) {
    fail('status is "skipped" but answer_text was supplied. A skip is "leave it this week" and carries ' +
         'no answer; recording words against it would put language in the decision log that Warwick ' +
         'never said.');
  }
  const answerText = skipped ? SKIP_ANSWER_TEXT : requireText(a.answer_text, 'answer_text');

  const applies = strictBoolean(a.applies_going_forward, 'applies_going_forward');

  if (skipped && applies) {
    fail('status is "skipped" but applies_going_forward is true. A skipped question is transient by ' +
         'definition (rule 10) and can never become a standing rule.');
  }

  // Rule 10, refused HERE so the plan is never built at all rather than being
  // built and rejected later by promoteDecision. Same rule, earlier failure.
  if (applies && a.one_week_only === true) {
    fail('applies_going_forward is true and one_week_only is true. A this-week-only decision is never ' +
         'promoted into a standing rule (rule 10) - record it with applies_going_forward false.');
  }

  const resolution = buildResolution(a.resolution, skipped);

  // ---- the decision: ALWAYS recorded ------------------------------------
  // Every answer produces a rule_qa_log row, exactly as the existing 5 rows
  // do. Whether it ALSO becomes a rule is the applies_going_forward question,
  // and whether that rule is actionable is the database's question, not ours.
  const decision = {
    asked_on: a.asked_on,           // validated by promoteDecision (requireDate)
    question: questionText,
    answer: answerText,
    applies_going_forward: applies,
    household_id: householdId,
    source_document_id: sourceDocumentId
  };
  if (a.one_week_only === true) decision.one_week_only = true;
  if (applies) {
    if (!a.rule || typeof a.rule !== 'object') {
      fail('applies_going_forward is true, so `rule` is required (the structured rule to promote). ' +
           'planner.js acts only on the structured directive columns; it never parses rule_text.');
    }
    decision.rule = a.rule;
  } else if (a.rule !== null && a.rule !== undefined) {
    fail('applies_going_forward is false, so no rule may be promoted -- remove the `rule` payload or ' +
         'set applies_going_forward true.');
  }

  // ---- the regulars operations: the part that stops the question ---------
  const regulars = [];
  const suppressionTerms = [];

  if (resolution.kind === 'known_product') {
    // The answer said "that wording means THIS product we already have". The
    // photographed wording plus anything else the answer established become
    // aliases, so next week planner.js regularHits() resolves the line and it
    // never reaches the question queue.
    const aliases = collectAliases([photographed].concat(resolution.aliases, [resolution.approved_search_term]));
    if (aliases.length > 0) {
      regulars.push({
        op: 'enrichRegular',
        id: resolution.regular_id,
        add_aka: aliases
      });
      aliases.forEach(function (term) {
        suppressionTerms.push({ term: term, mechanism: 'alias', regular_id: resolution.regular_id });
      });
    }
  } else if (resolution.kind === 'new_product') {
    const p = resolution.product;
    // Aliases carried ON THE NEW ROW at creation: there is nothing to clobber
    // on an insert, and doing it in one operation means a crash between two
    // writes cannot leave a regular that exists but does not answer to the
    // wording that created it.
    const aliases = collectAliases(
      [photographed].concat(resolution.aliases, [resolution.approved_search_term])
    ).filter(function (term) {
      // An item is not an alias of itself; mergeAka would drop it anyway, and
      // filtering here keeps `suppression` honest about what really resolves.
      return term !== normaliseAlias(p.name);
    });

    regulars.push({
      op: 'upsertRegular',
      regular: {
        household_id: p.household_id === null ? householdId : p.household_id,
        name: p.name,
        brand: p.brand,
        asda_product_id: p.asda_product_id,
        asda_url: p.asda_url,
        category: p.category,
        high_level_category: p.high_level_category,
        typical_qty: p.typical_qty,
        source: p.regulars_source,
        active: true,
        aka: aliases,
        substitutes_allowed: p.substitutes_allowed
      }
    });

    // The canonical name resolves by itself (regularAliases includes the
    // name), so it is a suppression term even though it is not an alias.
    suppressionTerms.push({ term: normaliseAlias(p.name), mechanism: 'new_regular', regular_id: null });
    aliases.forEach(function (term) {
      suppressionTerms.push({ term: term, mechanism: 'new_regular', regular_id: null });
    });
  }

  // ---- a promoted rule is an AUDIT record, and is reported as such --------
  // It is listed in `suppression` only when it names a match_term, and its
  // mechanism is 'standing_rule' so nobody mistakes it for the alias that does
  // the work. An 'info' directive - which is what an unproven promotion
  // becomes - is discarded by planner.js actionableRules() and suppresses
  // nothing at all.
  if (applies && a.rule && optionalText(a.rule.match_term) !== null) {
    suppressionTerms.push({
      term: normaliseAlias(a.rule.match_term),
      mechanism: 'standing_rule',
      regular_id: null
    });
  }

  // ---- never forget the ASDA Favourite click -----------------------------
  const pendingActions = [];
  if (resolution.kind === 'new_product' && resolution.product.needs_favourite_action === true) {
    pendingActions.push({
      household_id: resolution.product.household_id === null ? householdId : resolution.product.household_id,
      shop_id: shopId,
      action_type: ADD_FAVOURITE_ACTION,
      action_key: normaliseAlias(resolution.product.name),
      payload: {
        product_name: resolution.product.name,
        asda_product_id: resolution.product.asda_product_id,
        source_view: resolution.product.source_view
      },
      note: 'The ASDA Favourite control was not confirmed clicked for this newly approved product. ' +
            'Until it is, the item is not in the Favourites view Sonnet reads from.'
    });
  }

  // `prevents_repeat` is deliberately NOT "we wrote something". It is true
  // only when a mechanism that planner.js actually consults now answers to the
  // wording that caused the question. A promoted rule alone does not qualify.
  const loadBearing = suppressionTerms.filter(function (s) {
    return s.mechanism === 'alias' || s.mechanism === 'new_regular';
  });
  const prevents = loadBearing.some(function (s) {
    return s.term === normaliseAlias(photographed);
  });

  return {
    context: { shop_id: shopId, question_key: questionKey, status: status },
    decision: decision,
    regulars: regulars,
    pending_actions: pendingActions,
    suppression: {
      photographed_term: normaliseAlias(photographed),
      terms: suppressionTerms,
      prevents_repeat: prevents
    }
  };
}

// ---------------------------------------------------------------------
// The resolution half, validated on its own so the rules are readable.
// ---------------------------------------------------------------------
function buildResolution(raw, skipped) {
  const r = raw || {};
  const kindGiven = optionalText(r.kind);

  if (skipped) {
    // A skip establishes nothing. Accepting a resolution here would let a
    // declined item quietly enter the catalogue.
    if (kindGiven !== null && kindGiven !== 'none') {
      fail('status is "skipped" but resolution.kind is "' + kindGiven + '". A skipped question resolves ' +
           'no identity: "leave it this week" is not approval to learn the product.');
    }
    return { kind: 'none', aliases: [], approved_search_term: null };
  }

  const kind = requireOneOf(r.kind, RESOLUTION_KINDS, 'resolution.kind');
  const aliases = r.aliases === null || r.aliases === undefined ? [] : r.aliases;
  if (!Array.isArray(aliases)) fail('resolution.aliases must be an array of strings when given');
  const approvedSearchTerm = optionalText(r.approved_search_term);

  if (kind === 'none') {
    return { kind: 'none', aliases: aliases, approved_search_term: approvedSearchTerm };
  }

  if (kind === 'known_product') {
    return {
      kind: kind,
      regular_id: requireId(r.regular_id, 'resolution.regular_id'),
      aliases: aliases,
      approved_search_term: approvedSearchTerm
    };
  }

  // ---- new_product -------------------------------------------------------
  const p = r.product;
  if (!p || typeof p !== 'object') {
    fail('resolution.kind is "new_product", so resolution.product is required (the row to create in ' +
         'asdair.regulars, so it is next week\'s interpretation catalogue input).');
  }

  const sourceView = p.source_view === null || p.source_view === undefined
    ? null
    : requireOneOf(p.source_view, SOURCE_VIEWS, 'resolution.product.source_view');

  // An explicit regulars_source always wins; otherwise the source view is
  // translated through the single mapping constant. Neither is guessed from
  // anything else.
  let regularsSource = optionalText(p.regulars_source);
  if (regularsSource === null && sourceView !== null) {
    regularsSource = SOURCE_VIEW_TO_REGULARS_SOURCE[sourceView];
  }

  // "Confirm the ASDA Favourite action completed" (CANONICAL section H). A
  // Favourites item whose Favourite click was NOT confirmed leaves a durable
  // pending_action; an item whose view was never stated cannot generate one,
  // because we would be asserting something nobody told us.
  const favouriteFlag = p.favourite_action_completed;
  if (favouriteFlag !== null && favouriteFlag !== undefined &&
      favouriteFlag !== true && favouriteFlag !== false) {
    fail('resolution.product.favourite_action_completed must be exactly true or false when given ' +
         '(it records whether a browser action really happened).');
  }
  const needsFavouriteAction = sourceView === 'favourites' && favouriteFlag === false;

  return {
    kind: kind,
    aliases: aliases,
    approved_search_term: approvedSearchTerm,
    product: {
      household_id: optionalId(p.household_id, 'resolution.product.household_id'),
      name: requireText(p.name, 'resolution.product.name'),
      brand: optionalText(p.brand),
      asda_product_id: optionalText(p.asda_product_id),
      asda_url: optionalText(p.asda_url),
      category: optionalText(p.category),
      high_level_category: optionalText(p.high_level_category),
      typical_qty: p.typical_qty === undefined ? null : p.typical_qty,
      substitutes_allowed: p.substitutes_allowed === true,
      source_view: sourceView,
      regulars_source: regularsSource,
      needs_favourite_action: needsFavouriteAction
    }
  };
}

module.exports = {
  buildAnswerLearning: buildAnswerLearning,
  RESOLUTION_KINDS: RESOLUTION_KINDS,
  ANSWER_STATUSES: ANSWER_STATUSES,
  ANSWER_SOURCES: ANSWER_SOURCES,
  SOURCE_VIEWS: SOURCE_VIEWS,
  SOURCE_VIEW_TO_REGULARS_SOURCE: SOURCE_VIEW_TO_REGULARS_SOURCE,
  SUPPRESSION_MECHANISMS: SUPPRESSION_MECHANISMS,
  ADD_FAVOURITE_ACTION: ADD_FAVOURITE_ACTION,
  SKIP_ANSWER_TEXT: SKIP_ANSWER_TEXT,
  _internal: {
    buildResolution: buildResolution,
    collectAliases: collectAliases
  }
};
