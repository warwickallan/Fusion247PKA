// =====================================================================
// AsdAIr cockpit-api/readRules.js - THE DURABLE RULEBOOK, READ-ONLY.
//
// WHY THIS EXISTS. readWorkspace.js answers "what is happening to THIS shop".
// It reads asdair.rules only through ROTATION_RULES_SQL - one directive, for
// one shop's planning. Warwick's question is a different one: "what has this
// thing actually learned, and is any of it wrong?" That is a question about the
// rulebook itself, not about a shop, so it gets its own read rather than being
// bolted onto a shop-shaped payload.
//
// SAME CONSTRUCTION RULES AS readWorkspace.js, deliberately - this is a sibling,
// not a new pattern:
//   * connection from ASDAIR_DB_URL, the SELECT-only asdair_ro role;
//   * everything inside ONE `BEGIN TRANSACTION READ ONLY`, so the rules, the
//     decision log and the catalogue are one consistent snapshot - a rulebook
//     showing a rule from one instant and its promoting answer from another
//     would be lying quietly;
//   * every statement begins with SELECT, and ALL_SQL is exported so that is
//     testable rather than merely asserted in this comment.
//
// PRESENTATION IS SERVER-SIDE, via present.js, for the same reason the
// workspace does it: the browser must have nothing left to fabricate from.
//
// THE NULL-NOTE DEFECT (D-2026-08-03-16) IS SURFACED, NOT HIDDEN. Many rows
// carry note = null. This module reports `has_note: false` and leaves
// note_display at "unknown" rather than dropping the row or inventing prose.
// A rule the household cannot explain is exactly what Warwick needs to SEE.
//
// PURE ASCII.
// =====================================================================

'use strict';

const P = require('./present');

// ---------------------------------------------------------------------
// SQL. All SELECT. All parameterised.
// ---------------------------------------------------------------------

// household_id IS NULL means "global rule" - it applies to every household, so
// it belongs in the answer, not outside it. Ordered so the ACTIONABLE
// directives lead and 'info' trails: a reader scanning for what actually
// changes a basket should not have to wade through commentary first.
const RULES_SQL =
  'SELECT id, category, rule_text, scope, directive, match_term, match_category, matched_product, ' +
  'reason, note, active, household_id, superseded_by, created_at ' +
  'FROM asdair.rules WHERE household_id IS NULL OR household_id = $1 ' +
  'ORDER BY active DESC, ' +
  "array_position(array['map','exclude','needs_decision','rotate','info'], directive), " +
  'id ASC';

const RULE_QA_SQL =
  'SELECT id, asked_on, question, answer, applies_going_forward, promoted_rule_id, created_at ' +
  'FROM asdair.rule_qa_log WHERE household_id IS NULL OR household_id = $1 ' +
  'ORDER BY asked_on DESC, id DESC LIMIT 300';

// Same column list readWorkspace.CATALOGUE_SQL uses, so the two cannot disagree
// about what a regular IS. Ordered for BROWSING (active first, then name),
// where the workspace orders by id for stable joining.
const REGULARS_SQL =
  'SELECT id, name, brand, category, high_level_category, asda_product_id, asda_url, typical_qty, ' +
  'aka, substitutes_allowed, active FROM asdair.regulars ' +
  'WHERE household_id = $1 ORDER BY active DESC, lower(name) ASC, id ASC';

const ALL_SQL = Object.freeze([RULES_SQL, RULE_QA_SQL, REGULARS_SQL]);

// The five directives migration 001 + 007 permit. Frozen here so the UI can
// group by a known set instead of discovering groups from the data - a
// directive that ever appears outside this list is reported as itself under
// 'other', never silently folded into one of the five.
const DIRECTIVES = Object.freeze(['map', 'exclude', 'needs_decision', 'rotate', 'info']);

// What each directive DOES, in Warwick's terms. This is the load-bearing half
// of the Rules view: a directive name without its consequence is just a label.
const DIRECTIVE_MEANING = Object.freeze({
  map: 'Always buy this exact product when the list says the matched term.',
  exclude: 'Never add this - leave it off the basket even if the list asks for it.',
  needs_decision: 'Stop and ask a human before acting on this.',
  rotate: 'Vary the variant week to week rather than buying the same one every time.',
  info: 'Background the planner does NOT act on. It changes no basket.'
});

let pool = null;

function getPool() {
  if (pool) return pool;
  const url = process.env.ASDAIR_DB_URL;
  if (!url || String(url).trim() === '') {
    throw new Error('ASDAIR_DB_URL is not set. Export the asdair READ connection string as ASDAIR_DB_URL ' +
      'before reading the rulebook.');
  }
  const { Pool } = require('pg');
  pool = new Pool({ connectionString: url });
  return pool;
}

function rows(res) {
  return (res && res.rows) || [];
}

function arr(v) {
  return Array.isArray(v) ? v : [];
}

/**
 * PURE. A DATE-ONLY column, presented as a date only.
 *
 * TWO REASONS THIS IS NOT P.when():
 *   1. asdair.rule_qa_log.asked_on is `date`. P.when() renders it as a full
 *      ISO instant, which prints "2026-07-20T00:00:00.000Z" - a midnight that
 *      was never recorded. Showing a precision the column does not have is the
 *      same class of error as showing unknown as 0.
 *   2. node-postgres parses `date` into a Date at LOCAL midnight. Calling
 *      toISOString() on that in any timezone ahead of UTC shifts the calendar
 *      day BACKWARDS - 2026-07-20 in UTC+2 prints as 2026-07-19. So the parts
 *      are read locally, which is the same day the database holds.
 */
function dateOnly(value) {
  if (P._internal.isMissing(value)) return P.UNKNOWN;
  if (typeof value === 'string') {
    const m = /^(\d{4}-\d{2}-\d{2})/.exec(value.trim());
    if (m) return m[1];
  }
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return P.UNKNOWN;
  const pad = function (n) { return (n < 10 ? '0' : '') + String(n); };
  return String(d.getFullYear()) + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
}

/**
 * PURE. One asdair.rules row -> the display shape.
 *
 * A rule with no target is reported as having no target. The schema's
 * rules_directive_target_check already refuses that for an actionable
 * directive, so seeing one here would mean the constraint is gone - which is
 * something to show, not to paper over.
 */
/**
 * WP-B15-35 AC8. ONE RULE, IN WARWICK'S OWN TERMS.
 *
 * Warwick's examples are the specification:
 *   "Never automatically substitute products - applies to every shop"
 *   "Cravendale Semi-Skimmed - usually buy 4 x 2L"
 *
 * So: the rule's own sentence, then WHO IT APPLIES TO, in words. No category
 * key, no directive token, no scope enum, no id - those all stay available on
 * the row beside this for anyone who wants them, and none of them is what a
 * human reads.
 *
 * A rule whose text is missing gets no invented sentence: it returns null and
 * is shown as the unexplained rule it is (D-2026-08-03-16 already counts
 * those, and hiding them here would undo that).
 */
function plainRule(r) {
  if (P._internal.isMissing(r.rule_text)) return null;
  const text = String(r.rule_text).trim().replace(/\s*[.;]+\s*$/, '');

  // WHO it applies to, most specific first. A product beats a search term,
  // and a term beats a category - saying all three would be noise.
  let applies = null;
  if (!P._internal.isMissing(r.matched_product)) applies = 'applies to ' + String(r.matched_product).trim();
  else if (!P._internal.isMissing(r.match_term)) applies = 'applies when you ask for ' + String(r.match_term).trim();
  else if (!P._internal.isMissing(r.match_category)) applies = 'applies to ' + String(r.match_category).trim();
  else if (String(r.scope || '').trim().toLowerCase() === 'global') applies = 'applies to every shop';

  // ⛔ NEVER SAY THE SAME THING TWICE. Live rulebook, 2026-08-13:
  //   "Tomato sauce means Heinz Tomato Ketchup 910g - applies to Heinz Tomato
  //    Ketchup 910g"
  // The rule's own sentence very often already names the product it is about,
  // and appending the target then reads like a machine talking to itself -
  // which is exactly the "database view" this Work Order exists to get away
  // from. Where the text already contains the target, the clause is dropped.
  if (applies !== null) {
    const target = applies.replace(/^applies (to|when you ask for) /, '').trim().toLowerCase();
    if (target !== '' && text.toLowerCase().indexOf(target) !== -1) return text;
  }

  return applies === null ? text : text + ' - ' + applies;
}

function presentRule(r) {
  const directive = r.directive === null || r.directive === undefined ? null : String(r.directive);
  const hasTarget = !P._internal.isMissing(r.match_term) || !P._internal.isMissing(r.match_category);
  return {
    id: r.id === undefined ? null : r.id,
    id_display: P.count(r.id),
    directive: directive,
    directive_display: P.text(directive),
    directive_known: DIRECTIVES.indexOf(directive) !== -1,
    directive_meaning: DIRECTIVES.indexOf(directive) === -1 ? P.UNKNOWN : DIRECTIVE_MEANING[directive],
    category_display: P.text(r.category),
    rule_text_display: P.text(r.rule_text),
    // AC8: the same rule as one human sentence. This is the field the Cockpit
    // shows; everything else on this row is the detail behind it.
    plain_display: P.text(plainRule(r)),
    scope_display: P.text(r.scope),
    match_term_display: P.text(r.match_term),
    match_category_display: P.text(r.match_category),
    has_target: hasTarget,
    matched_product_display: P.text(r.matched_product),
    has_matched_product: !P._internal.isMissing(r.matched_product),
    reason_display: P.text(r.reason),
    has_reason: !P._internal.isMissing(r.reason),
    // D-2026-08-03-16: many rows have no note. Reported, never hidden.
    note_display: P.text(r.note),
    has_note: !P._internal.isMissing(r.note),
    active: r.active === null || r.active === undefined ? null : !!r.active,
    active_display: P.bool(r.active),
    scope_is_global: r.household_id === null || r.household_id === undefined,
    superseded_by_display: P.count(r.superseded_by),
    is_superseded: !P._internal.isMissing(r.superseded_by),
    created_at_display: P.when(r.created_at)
  };
}

/** PURE. One asdair.rule_qa_log row -> the display shape. */
function presentQa(q) {
  return {
    id_display: P.count(q.id),
    asked_on_display: dateOnly(q.asked_on),
    question_display: P.text(q.question),
    answer_display: P.text(q.answer),
    // The field that decides whether an answer was a ONE-OFF or became policy.
    applies_going_forward: q.applies_going_forward === null || q.applies_going_forward === undefined
      ? null : !!q.applies_going_forward,
    applies_going_forward_display: P.bool(q.applies_going_forward),
    promoted_rule_id_display: P.count(q.promoted_rule_id),
    // A standing answer that never became a rule is a GAP - the planner acts on
    // rules, not on the Q&A log, so this pairing is what makes the gap visible.
    was_promoted: !P._internal.isMissing(q.promoted_rule_id),
    created_at_display: P.when(q.created_at)
  };
}

/** PURE. One asdair.regulars row -> the display shape. Aliases are the point. */
function presentRegular(r) {
  const aka = arr(r.aka).map(function (a) { return String(a); }).filter(function (a) { return a.trim() !== ''; });
  return {
    id_display: P.count(r.id),
    name_display: P.text(r.name),
    brand_display: P.text(r.brand),
    category_display: P.text(r.category),
    high_level_category_display: P.text(r.high_level_category),
    asda_product_id_display: P.text(r.asda_product_id),
    has_product_id: !P._internal.isMissing(r.asda_product_id),
    typical_qty_display: P.count(r.typical_qty),
    // The aliases are HOW "choc yazoo" resolves. An empty array is a MEASURED
    // zero (the row exists and lists none), so it prints as 0, not "unknown".
    aka: aka,
    aka_count_display: P.count(aka.length),
    has_aliases: aka.length > 0,
    substitutes_allowed_display: P.bool(r.substitutes_allowed),
    active: r.active === null || r.active === undefined ? null : !!r.active,
    active_display: P.bool(r.active)
  };
}

/**
 * PURE. Durable rows -> the rulebook payload. Separated from the reader for
 * the same reason assembleWorkspace.js is: it can be tested without a database.
 */
function assembleRules(src) {
  const ruleRows = arr(src && src.rules).map(presentRule);
  const qaRows = arr(src && src.rule_qa).map(presentQa);
  const regularRows = arr(src && src.regulars).map(presentRegular);

  const groups = DIRECTIVES.map(function (d) {
    const items = ruleRows.filter(function (r) { return r.directive === d; });
    return {
      directive: d,
      directive_display: d,
      meaning: DIRECTIVE_MEANING[d],
      count_display: P.count(items.length),
      active_count_display: P.count(items.filter(function (r) { return r.active === true; }).length),
      items: items
    };
  });
  // Anything outside the known five is shown as itself rather than dropped.
  const other = ruleRows.filter(function (r) { return !r.directive_known; });
  if (other.length) {
    groups.push({
      directive: 'other',
      directive_display: 'other',
      meaning: 'A directive this cockpit does not recognise. Shown so it cannot hide.',
      count_display: P.count(other.length),
      active_count_display: P.count(other.filter(function (r) { return r.active === true; }).length),
      items: other
    });
  }

  const activeRegulars = regularRows.filter(function (r) { return r.active === true; });

  return {
    ok: true,
    generated_from: 'durable state only',
    unknown_means_unknown: true,
    rules: {
      total_display: P.count(ruleRows.length),
      active_display: P.count(ruleRows.filter(function (r) { return r.active === true; }).length),
      // The honest headline for D-2026-08-03-16: how much of the rulebook
      // cannot explain itself. A count, measured, never estimated.
      without_note_display: P.count(ruleRows.filter(function (r) { return !r.has_note; }).length),
      groups: groups,

      // ── AC8: WHAT THIS SURFACE CAN AND CANNOT DO, SAID PLAINLY ─────────
      //
      // "Do NOT pretend broad rule CRUD exists if it does not." It does not.
      // There is no rule command anywhere on the AsdAIr command surface -
      // pipeline/commandNames.js is an allowlist and carries none - so every
      // sentence below is checkable against that list rather than being a
      // description of intent. The UI renders these words; it must never
      // offer an action this block does not claim.
      management: {
        can_read: true,
        can_create: false,
        can_edit: false,
        can_delete: false,
        can_deactivate: false,
        can_reorder: false,
        how_rules_are_made:
          'Rules are LEARNED, not typed. When you answer a question and the answer is meant to hold ' +
          'in future, that decision is promoted into the rulebook. An answer you mark as this-week-only ' +
          'is never promoted.',
        what_this_screen_cannot_do:
          'This screen shows the rulebook. It cannot add, edit, delete, switch off or reorder a rule, ' +
          'and no such command exists anywhere in AsdAIr today - not on the Cockpit and not on Telegram. ' +
          'Changing a rule means answering the relevant question differently next time, or changing it ' +
          'directly in the database.',
      },

      items: ruleRows
    },
    decisions: {
      total_display: P.count(qaRows.length),
      standing_display: P.count(qaRows.filter(function (q) { return q.applies_going_forward === true; }).length),
      promoted_display: P.count(qaRows.filter(function (q) { return q.was_promoted; }).length),
      // A standing answer with no promoted rule: policy the planner cannot act on.
      unpromoted_standing_display: P.count(qaRows.filter(function (q) {
        return q.applies_going_forward === true && !q.was_promoted;
      }).length),
      items: qaRows
    },
    regulars: {
      total_display: P.count(regularRows.length),
      active_display: P.count(activeRegulars.length),
      with_aliases_display: P.count(regularRows.filter(function (r) { return r.has_aliases; }).length),
      alias_total_display: P.count(regularRows.reduce(function (n, r) { return n + r.aka.length; }, 0)),
      without_product_id_display: P.count(activeRegulars.filter(function (r) { return !r.has_product_id; }).length),
      items: regularRows
    }
  };
}

/**
 * Read the durable rulebook inside ONE read-only snapshot.
 *
 * @param {object} [options] { household_id, client }
 */
async function readRules(options) {
  const opts = options || {};
  const injected = opts.client || null;
  const client = injected || await getPool().connect();
  const householdId = opts.household_id === undefined || opts.household_id === null
    ? 1 : Number(opts.household_id);

  try {
    if (!injected) await client.query('BEGIN TRANSACTION READ ONLY');
    const payload = assembleRules({
      rules: rows(await client.query(RULES_SQL, [householdId])),
      rule_qa: rows(await client.query(RULE_QA_SQL, [householdId])),
      regulars: rows(await client.query(REGULARS_SQL, [householdId]))
    });
    if (!injected) await client.query('COMMIT');
    payload.household_id_display = P.count(householdId);
    return payload;
  } catch (err) {
    if (!injected) {
      try { await client.query('ROLLBACK'); } catch (ignore) { /* no-op */ }
    }
    throw err;
  } finally {
    if (!injected) client.release();
  }
}

async function close() {
  if (pool) {
    await pool.end();
    pool = null;
  }
}

module.exports = {
  readRules: readRules,
  assembleRules: assembleRules,
  close: close,
  ALL_SQL: ALL_SQL,
  DIRECTIVES: DIRECTIVES,
  DIRECTIVE_MEANING: DIRECTIVE_MEANING,
  _internal: {
    dateOnly: dateOnly,
    presentRule: presentRule,
    presentQa: presentQa,
    presentRegular: presentRegular,
    RULES_SQL: RULES_SQL,
    RULE_QA_SQL: RULE_QA_SQL,
    REGULARS_SQL: REGULARS_SQL
  }
};
