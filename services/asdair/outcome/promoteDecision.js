// =====================================================================
// IDEA-012 AsdAIr - outcome recorder: promoteDecision.js
//
// The LEARNING half of the loop the schema always designed but never wired:
// asdair.rule_qa_log had zero writers, so `applies_going_forward` and its
// `promoted_rule_id` back-link into asdair.rules were dead code. Every human
// answer was forgotten and nothing was ever learned from a shop.
//
//   promoteDecision(decision) -> { logId, ruleId }
//
// This restores exactly what was specified; it invents no new learning
// behaviour. A decision is recorded ALWAYS. It becomes a standing rule ONLY
// when the human said it applies going forward.
//
// ONE TRANSACTION:
//   1. INSERT the answer into asdair.rule_qa_log.
//   2. IF AND ONLY IF applies_going_forward is true: INSERT a STRUCTURED
//      asdair.rules row, then UPDATE the log row's promoted_rule_id to the
//      new rule's id (the back-link).
//   3. If false: no rule is created and promoted_rule_id stays null.
//   Any failure ROLLBACKs, so the log row and the rule it points at are
//   never left inconsistent (a log claiming a rule that does not exist, or a
//   rule with no decision behind it).
//
// RULE 10 -- A ONE-WEEK-ONLY EXCLUSION IS NEVER PROMOTED:
//   "Do not buy X this week" is transient. Promoting it would silently
//   exclude X from EVERY future shop -- a wrong-but-confident basket for as
//   long as nobody noticed. So a decision marked one_week_only (or scoped
//   'one_time') is REFUSED for promotion, loudly. Recording it in the log
//   with applies_going_forward false is always allowed.
//
// STRUCTURED, NOT PROSE:
//   planner.js only acts on the STRUCTURED directive columns; it never
//   parses rule_text. A promoted rule therefore MUST carry a real directive
//   and, unless it is purely informational, a real target -- otherwise it
//   would be a silent no-op sitting in the rulebook looking like a rule.
//   These are the same conditions as the asdair.rules CHECK constraint, but
//   checked HERE first so the failure is a clear message, not a 23514.
//
// SECRETS:
//   * The connection string comes ONLY from process.env.ASDAIR_WRITE_DB_URL, the
//     same convention as skill/data.js. Never hardcoded, never logged.
//
// PURE ASCII only.
// =====================================================================

'use strict';

// asdair.rules CHECK vocabularies (see db/001_asdair_schema.sql).
const DIRECTIVES = ['info', 'exclude', 'needs_decision', 'map'];
const SCOPES = ['global', 'household', 'category', 'product', 'one_time'];

// The columns written to each table. Fixed identifiers, never external input.
const LOG_COLUMNS = ['asked_on', 'question', 'answer', 'applies_going_forward', 'household_id'];
const RULE_COLUMNS = [
  'category',
  'rule_text',
  'scope',
  'directive',
  'match_term',
  'match_category',
  'matched_product',
  'reason',
  'note',
  'active',
  'household_id'
];

let pool = null;

function getPool() {
  if (pool) return pool;
  const url = process.env.ASDAIR_WRITE_DB_URL;
  if (!url || String(url).trim() === '') {
    throw new Error('ASDAIR_WRITE_DB_URL is not set. Export the asdair Postgres connection string as ASDAIR_WRITE_DB_URL before recording a decision.');
  }
  const { Pool } = require('pg');
  pool = new Pool({ connectionString: url });
  return pool;
}

// ---------------------------------------------------------------------
// Pure helpers
// ---------------------------------------------------------------------

function fail(message) {
  throw new Error('promoteDecision: ' + message);
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

function optionalId(value, name) {
  if (value === null || value === undefined || value === '') return null;
  const s = String(value).trim();
  if (!/^\d+$/.test(s) || s === '0') fail(name + ' must be a positive integer id when given (got "' + s + '")');
  const n = Number(s);
  return Number.isSafeInteger(n) ? n : s;
}

// asked_on is a DATE column. Accepts a Date or a YYYY-MM-DD string; anything
// else is rejected rather than guessed at. No clock is read here -- an absent
// asked_on is an error, because "when was this asked" is a fact of the
// decision, not something this module may invent.
function requireDate(value, name) {
  if (value === null || value === undefined || value === '') fail(name + ' is required (YYYY-MM-DD)');
  if (value instanceof Date) {
    if (!Number.isFinite(value.getTime())) fail(name + ' is an invalid Date');
    return value.toISOString().slice(0, 10);
  }
  const s = String(value).trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) fail(name + ' must be a YYYY-MM-DD date string or a Date (got "' + s + '")');
  if (!Number.isFinite(Date.parse(s))) fail(name + ' is not a real calendar date');
  return s;
}

// ---------------------------------------------------------------------
// buildPromotion(decision) -> { log, rule }
//
// PURE: no DB, no network, no clock, no randomness. Returns the exact rows
// promoteDecision will write. `rule` is null when the decision does not
// apply going forward. Exported so every promotion rule below is testable
// with no database at all.
//
// decision:
//   {
//     asked_on              : required, Date | 'YYYY-MM-DD'
//     question              : required, non-empty
//     answer                : required, non-empty
//     applies_going_forward : required, STRICT boolean
//     household_id          : optional (null = applies to all)
//     one_week_only         : optional; true means THIS WEEK ONLY (rule 10)
//     rule                  : required when applies_going_forward is true:
//       { category, rule_text, directive, scope?, match_term?,
//         match_category?, matched_product?, reason?, note?, household_id? }
//   }
// ---------------------------------------------------------------------
function buildPromotion(decision) {
  const d = decision || {};

  const applies = d.applies_going_forward;
  if (applies !== true && applies !== false) {
    fail('applies_going_forward must be exactly true or false (a human decision is not a truthy value)');
  }

  const householdId = optionalId(d.household_id, 'household_id');

  const log = {
    asked_on: requireDate(d.asked_on, 'asked_on'),
    question: requireText(d.question, 'question'),
    answer: requireText(d.answer, 'answer'),
    applies_going_forward: applies,
    household_id: householdId
  };

  if (!applies) {
    // Nothing is promoted. A rule payload here is a caller bug -- silently
    // dropping it would hide an intended-but-lost rule, so say so.
    if (d.rule !== null && d.rule !== undefined) {
      fail('applies_going_forward is false, so no rule may be promoted -- remove the rule payload ' +
           'or set applies_going_forward true');
    }
    return { log: log, rule: null };
  }

  // ---- rule 10: a this-week-only decision is NEVER promoted -------------
  if (d.one_week_only === true) {
    fail('refusing to promote a one-week-only decision into a standing rule (rule 10). ' +
         'Record it with applies_going_forward false instead.');
  }

  const r = d.rule;
  if (!r || typeof r !== 'object') {
    fail('applies_going_forward is true, so decision.rule is required (the structured rule to promote)');
  }

  if (r.scope !== null && r.scope !== undefined && String(r.scope).trim() === 'one_time') {
    fail("refusing to promote a rule with scope 'one_time' into the standing rulebook (rule 10): " +
         'a one-time decision is by definition not a standing rule.');
  }

  const directive = requireText(r.directive, 'rule.directive');
  if (DIRECTIVES.indexOf(directive) === -1) {
    fail('rule.directive "' + directive + '" is not one of: ' + DIRECTIVES.join(', '));
  }

  const scope = r.scope === null || r.scope === undefined || String(r.scope).trim() === ''
    ? 'global'                       // the asdair.rules column default
    : String(r.scope).trim();
  if (SCOPES.indexOf(scope) === -1) {
    fail('rule.scope "' + scope + '" is not one of: ' + SCOPES.join(', '));
  }

  const matchTerm = optionalText(r.match_term);
  const matchCategory = optionalText(r.match_category);
  const matchedProduct = optionalText(r.matched_product);

  // Mirrors the asdair.rules CHECK: an ACTIONABLE directive must name a
  // target, or the planner can never apply it (a silent no-op rule).
  if (directive !== 'info' && matchTerm === null && matchCategory === null) {
    fail("an actionable directive ('" + directive + "') must name a match_term or a match_category, " +
         'otherwise the promoted rule is a silent no-op the planner can never apply');
  }

  // A 'map' with nothing to map TO is the same silent no-op in the other
  // direction: planner.js only rewrites matched_product when the rule
  // carries one.
  if (directive === 'map' && matchedProduct === null) {
    fail("a 'map' directive must carry a matched_product to map to");
  }

  const rule = {
    category: requireText(r.category, 'rule.category'),
    rule_text: requireText(r.rule_text, 'rule.rule_text'),
    scope: scope,
    directive: directive,
    match_term: matchTerm,
    match_category: matchCategory,
    matched_product: matchedProduct,
    reason: optionalText(r.reason),
    note: optionalText(r.note),
    // A promoted rule is live by definition. Never taken from input: an
    // inactive "standing rule" would be a rule that silently does nothing.
    active: true,
    // Defaults to the decision's own household, so a household's answer
    // becomes that household's rule rather than leaking to everyone.
    household_id: r.household_id === undefined ? householdId : optionalId(r.household_id, 'rule.household_id')
  };

  return { log: log, rule: rule };
}

// Build a parameterised INSERT from a fixed column list and a row object.
function buildInsert(table, columns, row) {
  const params = columns.map(function (col) {
    const v = row[col];
    return v === undefined ? null : v;
  });
  const placeholders = columns.map(function (_, i) { return '$' + (i + 1); });
  const sql = 'INSERT INTO ' + table + ' (' + columns.join(', ') + ') VALUES (' +
    placeholders.join(', ') + ') RETURNING id';
  return { sql: sql, params: params };
}

const BACKLINK_SQL = 'UPDATE asdair.rule_qa_log SET promoted_rule_id = $1 WHERE id = $2';

// ---------------------------------------------------------------------
// Main entry point.
//
// options.client (optional): an already-connected pg client to run on (see
// recordShopOutcome.js for the rationale). No connection string is ever
// hardcoded.
// ---------------------------------------------------------------------
async function promoteDecision(decision, options) {
  // PURE validation first: a refused promotion (rule 10, a target-less
  // directive) fails BEFORE any connection is opened.
  const built = buildPromotion(decision);

  const opts = options || {};
  const injected = opts.client || null;
  const client = injected || await getPool().connect();

  try {
    await client.query('BEGIN');

    const logInsert = buildInsert('asdair.rule_qa_log', LOG_COLUMNS, built.log);
    const logRes = await client.query(logInsert.sql, logInsert.params);
    const logId = logRes.rows[0].id;

    let ruleId = null;
    if (built.rule) {
      const ruleInsert = buildInsert('asdair.rules', RULE_COLUMNS, built.rule);
      const ruleRes = await client.query(ruleInsert.sql, ruleInsert.params);
      ruleId = ruleRes.rows[0].id;
      // The back-link the schema designed: the log row points at the rule it
      // became. Without this the promotion is unauditable.
      await client.query(BACKLINK_SQL, [ruleId, logId]);
    }

    await client.query('COMMIT');
    return { logId: logId, ruleId: ruleId };
  } catch (err) {
    try { await client.query('ROLLBACK'); } catch (ignore) { /* no-op */ }
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
  promoteDecision: promoteDecision,
  buildPromotion: buildPromotion,
  close: close,
  _internal: {
    buildInsert: buildInsert,
    BACKLINK_SQL: BACKLINK_SQL,
    LOG_COLUMNS: LOG_COLUMNS,
    RULE_COLUMNS: RULE_COLUMNS,
    DIRECTIVES: DIRECTIVES,
    SCOPES: SCOPES
  }
};
