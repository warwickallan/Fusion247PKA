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
// THE PROVENANCE GUARD -- WHY AN ACTIONABLE DIRECTIVE NEEDS PROOF:
//   `directive` decides whether a promoted rule CHANGES BEHAVIOUR:
//     * 'info'                              -> the planner ignores it: INERT.
//     * 'exclude'/'needs_decision'/'map'     -> ACTIONABLE: it changes the
//                                               basket, for every future shop,
//                                               forever, until someone notices.
//   Before this guard, `directive` was taken straight from the caller. So a
//   single runtime's AMBIGUOUS INFERENCE ("they probably meant never buy it")
//   could become permanent doctrine inherited by every later runtime. That is
//   the risk this closes.
//
//   THE TRUST BOUNDARY IS SOURCE EVIDENCE, NOT A CALLER ASSERTION.
//   There is deliberately NO `explicit` / `trusted` / `force` parameter: any
//   such flag would just move the ambiguous inference one function call
//   upstream and defeat the entire point. The ONLY thing that can authorise an
//   actionable directive is the doc_type of the decision's own durable
//   provenance -- asdair.source_documents.doc_type, READ FROM THE DATABASE,
//   reached via the decision's source_document_id.
//     AUTHORITATIVE : 'agent_spec', 'decisions_log'  (a written-down instruction)
//     EVERYTHING ELSE is not: 'order_history', 'shopping_list', 'readme', an
//     unknown doc_type, an id that resolves to no row, a null id, or a lookup
//     that could not be completed at all.
//
//   DEFAULT-DENY, THEN UPGRADE ON PROOF. buildPromotion (pure) never emits an
//   actionable directive. It emits 'info' plus a `verification` record saying
//   what was REQUESTED, and the impure layer raises it to the requested
//   directive only after the database confirms an authoritative doc_type. Any
//   path that skips or fails verification therefore yields an INERT rule --
//   the failure mode is a rule that does nothing, never a rule that silently
//   changes the shopping.
//
//   A NON-AUTHORITATIVE SOURCE IS A DOWNGRADE, NOT A REFUSAL. The learning is
//   still worth keeping, so the rule is written with directive='info',
//   preserving rule_text / category / household_id / match_term /
//   match_category exactly as supplied, and WHY it was downgraded is appended
//   to the rule's `note` column (surfaced to humans) so the downgrade is
//   auditable rather than silent. The rule_qa_log row and its promoted_rule_id
//   back-link are written exactly as before.
//
//   ORDER OF OPERATIONS: the lookup runs BEFORE BEGIN, deliberately. A denied
//   or failing SELECT inside the transaction would abort it (25P02) and take
//   the whole decision down with it; outside, it degrades to "unproven" and
//   the decision is still recorded.
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

// The ONE directive that cannot change a basket. Every unproven promotion
// lands here.
const INERT_DIRECTIVE = 'info';

// The ONLY asdair.source_documents.doc_type values that may authorise an
// ACTIONABLE directive: a written-down instruction, not an observation.
// 'order_history' / 'shopping_list' / 'readme' are RECORDS OF WHAT HAPPENED,
// never statements of standing intent, so they can never promote behaviour.
// (Vocabulary per db/001_asdair_schema.sql, asdair.source_documents.doc_type.)
const AUTHORITATIVE_DOC_TYPES = ['agent_spec', 'decisions_log'];

// Read-only provenance lookup. asdair_rw holds SELECT (and deliberately NOT
// write) on this table, so a promotion can verify its source but never forge
// one.
const SOURCE_DOC_SQL = 'SELECT doc_type FROM asdair.source_documents WHERE id = $1';

// The columns written to each table. Fixed identifiers, never external input.
// source_document_id: the provenance the guard verifies against. The column
// always existed on rule_qa_log and was designed for exactly this, but nothing
// ever wrote it -- so the evidence that authorised a directive was not itself
// durable, and no later runtime could re-check it. It is written now.
const LOG_COLUMNS = ['asked_on', 'question', 'answer', 'applies_going_forward', 'household_id', 'source_document_id'];
// `source_document_id` is carried onto the RULE as well as the decision log
// (TQA-PR73-002). Without it a promoted rule held no provenance pointer of its
// own, so auditing "which document was cited to authorise this actionable
// directive?" meant walking back through rule_qa_log by the promoted_rule_id
// back-link -- and an actionable rule created from a MISCITED document left no
// trace on the rule itself. The pointer does not prove the instruction came
// from that document (see the LIMITATION note on verifySourceAuthority), but it
// makes the claim permanently auditable at the artefact it authorised.
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
  'household_id',
  'source_document_id'
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
// buildPromotion(decision) -> { log, rule, verification }
//
// PURE: no DB, no network, no clock, no randomness. Returns the exact rows
// promoteDecision will write. `rule` is null when the decision does not
// apply going forward. Exported so every promotion rule below is testable
// with no database at all.
//
// `verification` is null when nothing needs proving, and otherwise:
//   { required: true, requested_directive: <actionable>, source_document_id }
// In that case `rule.directive` is ALREADY the inert 'info'. The requested
// directive is a REQUEST, not a decision -- only applySourceVerdict(), fed by
// a real database read, may grant it. No caller input can.
//
// decision:
//   {
//     asked_on              : required, Date | 'YYYY-MM-DD'
//     question              : required, non-empty
//     answer                : required, non-empty
//     applies_going_forward : required, STRICT boolean
//     household_id          : optional (null = applies to all)
//     source_document_id    : optional; the provenance an ACTIONABLE directive
//                             is verified against. Absent = unprovable = inert.
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
  const sourceDocumentId = optionalId(d.source_document_id, 'source_document_id');

  const log = {
    asked_on: requireDate(d.asked_on, 'asked_on'),
    question: requireText(d.question, 'question'),
    answer: requireText(d.answer, 'answer'),
    applies_going_forward: applies,
    household_id: householdId,
    // NOTE: this is the id as SUPPLIED. It is a foreign key, so promoteDecision
    // nulls it if the lookup shows it resolves to no row -- otherwise an
    // unresolvable id would raise a 23503 and REFUSE the whole decision, when
    // the contract is to downgrade and keep the learning.
    source_document_id: sourceDocumentId
  };

  if (!applies) {
    // Nothing is promoted. A rule payload here is a caller bug -- silently
    // dropping it would hide an intended-but-lost rule, so say so.
    if (d.rule !== null && d.rule !== undefined) {
      fail('applies_going_forward is false, so no rule may be promoted -- remove the rule payload ' +
           'or set applies_going_forward true');
    }
    return { log: log, rule: null, verification: null };
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

  // ---- the provenance guard: default-deny -------------------------------
  // `directive` above is what the caller REQUESTED. An actionable request is
  // NOT granted here: the rule is built inert and the request is recorded for
  // the impure layer to verify against the database. buildPromotion is
  // therefore structurally incapable of emitting an actionable directive, so
  // no caller input -- boolean, flag, or otherwise -- can produce one.
  const needsProof = directive !== INERT_DIRECTIVE;

  const rule = {
    category: requireText(r.category, 'rule.category'),
    rule_text: requireText(r.rule_text, 'rule.rule_text'),
    scope: scope,
    directive: needsProof ? INERT_DIRECTIVE : directive,
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
    household_id: r.household_id === undefined ? householdId : optionalId(r.household_id, 'rule.household_id'),
    // The rule carries the SAME cited document as its decision -- never a
    // separately-supplied one, or a caller could cite an authoritative document
    // to pass the guard and then stamp a different one onto the artefact.
    source_document_id: sourceDocumentId
  };

  return {
    log: log,
    rule: rule,
    verification: needsProof
      ? { required: true, requested_directive: directive, source_document_id: sourceDocumentId }
      : null
  };
}

// ---------------------------------------------------------------------
// applySourceVerdict(rule, verification, verdict) -> rule
//
// PURE. The ONLY place an actionable directive can ever be granted, and it is
// granted solely on `verdict.doc_type` -- a value that comes from the database,
// never from the caller. Returns a NEW rule object; never mutates.
//
// verdict (from lookupSourceDocument):
//   { supplied, resolved, doc_type, failed }
// ---------------------------------------------------------------------
function applySourceVerdict(rule, verification, verdict) {
  if (!rule || !verification || verification.required !== true) return rule;

  const v = verdict || {};
  const docType = v.resolved === true ? optionalText(v.doc_type) : null;

  if (docType !== null && AUTHORITATIVE_DOC_TYPES.indexOf(docType) !== -1) {
    // PROVEN: the instruction is written down in an authoritative document, so
    // the requested directive is granted exactly as asked.
    return Object.assign({}, rule, { directive: verification.requested_directive });
  }

  // UNPROVEN -> stays inert, and says so where a human will see it.
  return Object.assign({}, rule, {
    directive: INERT_DIRECTIVE,
    note: appendNote(rule.note, downgradeReason(verification, v, docType))
  });
}

// Why an actionable directive was not granted. Deliberately names the doc_type
// and the id so the downgrade can be audited and, if wrong, corrected at source.
function downgradeReason(verification, verdict, docType) {
  const head = "[auto-downgraded to 'info'] the requested directive '" +
    verification.requested_directive + "' was NOT applied because ";
  const tail = ' Recorded as informational only, so it does not change any basket. ' +
    'Authoritative doc_types: ' + AUTHORITATIVE_DOC_TYPES.join(', ') + '.';

  let why;
  if (verdict.supplied !== true) {
    why = 'the decision carries no source_document_id, so there is no durable ' +
      'provenance showing the instruction was explicit.';
  } else if (verdict.failed === true) {
    // No error text: it can carry connection detail, and this string is durable.
    why = 'the asdair.source_documents lookup for id ' + verification.source_document_id +
      ' could not be completed, so the source could not be proven authoritative.';
  } else if (verdict.resolved !== true) {
    why = 'source_document_id ' + verification.source_document_id +
      ' resolves to no asdair.source_documents row.';
  } else {
    why = 'source document ' + verification.source_document_id + " has doc_type '" +
      (docType === null ? 'unknown' : docType) + "', which is not authoritative.";
  }
  return head + why + tail;
}

function appendNote(existing, addition) {
  const base = optionalText(existing);
  return base === null ? addition : base + ' | ' + addition;
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
// lookupSourceDocument(client, id) -> verdict
//
// The one impure half of the guard: reads doc_type straight from the database.
//
// It NEVER throws. Every failure -- no id, no row, no permission, no table --
// collapses to "not proven", which downgrades the rule to inert and keeps the
// decision. Failing loudly here would instead throw away the human's answer
// over a read that is only ever used to GRANT extra power, never to withhold
// the record. A genuinely dead database still surfaces: the very next
// statement is BEGIN, and that is not swallowed.
// ---------------------------------------------------------------------
async function lookupSourceDocument(client, id) {
  if (id === null || id === undefined) {
    return { supplied: false, resolved: false, doc_type: null, failed: false };
  }
  try {
    const res = await client.query(SOURCE_DOC_SQL, [id]);
    const rows = (res && res.rows) || [];
    if (rows.length === 0) {
      return { supplied: true, resolved: false, doc_type: null, failed: false };
    }
    return { supplied: true, resolved: true, doc_type: rows[0].doc_type, failed: false };
  } catch (ignore) {
    return { supplied: true, resolved: false, doc_type: null, failed: true };
  }
}

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
    // ---- provenance verification, BEFORE the transaction ------------------
    // Outside BEGIN on purpose: a denied or failing SELECT here must not abort
    // the write transaction (25P02) and take the whole decision with it.
    const verdict = await lookupSourceDocument(client, built.log.source_document_id);

    // FK safety: source_document_id REFERENCES asdair.source_documents(id), so
    // only a PROVEN-resolvable id may be written. An unresolvable one is
    // recorded as null (and explained in the rule's note) rather than raising a
    // 23503 that would refuse the decision outright.
    const log = verdict.resolved === true
      ? built.log
      : Object.assign({}, built.log, { source_document_id: null });

    // The single gate. An actionable directive exists past this line only if
    // the database said so.
    const rule = applySourceVerdict(built.rule, built.verification, verdict);

    await client.query('BEGIN');

    const logInsert = buildInsert('asdair.rule_qa_log', LOG_COLUMNS, log);
    const logRes = await client.query(logInsert.sql, logInsert.params);
    const logId = logRes.rows[0].id;

    let ruleId = null;
    if (rule) {
      const ruleInsert = buildInsert('asdair.rules', RULE_COLUMNS, rule);
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
  applySourceVerdict: applySourceVerdict,
  close: close,
  _internal: {
    buildInsert: buildInsert,
    lookupSourceDocument: lookupSourceDocument,
    BACKLINK_SQL: BACKLINK_SQL,
    SOURCE_DOC_SQL: SOURCE_DOC_SQL,
    LOG_COLUMNS: LOG_COLUMNS,
    RULE_COLUMNS: RULE_COLUMNS,
    DIRECTIVES: DIRECTIVES,
    SCOPES: SCOPES,
    AUTHORITATIVE_DOC_TYPES: AUTHORITATIVE_DOC_TYPES,
    INERT_DIRECTIVE: INERT_DIRECTIVE
  }
};
