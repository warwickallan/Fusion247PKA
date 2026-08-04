// =====================================================================
// BUILD-015 AsdAIr - the learning loop: recordAnswerLearning.js
//
// THE RUNTIME JOIN. buildAnswerLearning.js turns one settled Warwick answer
// into a write plan; this performs it, against writers that already existed
// and were already proven:
//
//   recordAnswerLearning(answer, options) -> receipt
//
//     1. promoteDecision(plan.decision)   -> asdair.rule_qa_log (+ asdair.rules
//                                            when the human said it applies AND
//                                            the database proves the provenance)
//     2. updateRegulars(op) for each      -> aliases on a known regular, or a
//                                            new regular carrying the
//                                            photographed wording as an alias
//     3. INSERT asdair.pending_action     -> the un-clicked ASDA Favourite,
//                                            never forgotten
//
// It adds NO new learning behaviour and it weakens NO existing guard. In
// particular it does NOT touch promoteDecision's provenance gate: an actionable
// directive is still granted only by applySourceVerdict() reading
// asdair.source_documents.doc_type from the database. This module cannot grant
// one and offers no flag that would.
//
// ---------------------------------------------------------------------
// ORDER OF OPERATIONS, AND WHY THE DECISION GOES FIRST
// ---------------------------------------------------------------------
// The decision log is written BEFORE the catalogue changes. If the catalogue
// write then fails, the estate holds an honest record of what Warwick answered
// and a loud failure saying the learning did not land. The reverse order would
// change what the planner does next week with no durable record of why - a
// silently-mutated catalogue is far worse than a recorded answer that must be
// re-applied.
//
// EVERY STEP IS RE-RUNNABLE. promoteDecision would write a second rule_qa_log
// row on a re-run (the table has no idempotency key), so a caller retrying
// after a partial failure should re-run the FAILED steps, which is why the
// receipt names exactly which step failed and what had already landed.
// updateRegulars is idempotent by construction: upsertRegular adopts an
// existing row rather than creating a near-twin, and the alias merge is a
// union computed from what it reads in the same transaction.
//
// ---------------------------------------------------------------------
// FAILURES ARE LOUD. THIS IS DELIBERATE AND IT DIFFERS FROM deps.js.
// ---------------------------------------------------------------------
// pipeline/deps.js realRecordLearning() swallows learning errors so that
// "learning NEVER fails a shop that otherwise reconciled correctly". That is
// right for enriching aliases as a side effect of a confirmed order.
//
// It is WRONG here. This is the path whose entire purpose is that an answer
// survives the week; a swallowed failure here is indistinguishable from the
// defect being fixed, and would be discovered next Sunday when Warwick is
// asked the same question again. So a failure THROWS, and the error carries
// `.receipt` (what did land) and `.step` (what did not), so nothing is lost by
// failing loudly.
//
// SECRETS: the connection string comes ONLY from process.env.
// ASDAIR_WRITE_DB_URL, via the pools the two writers already own. Nothing is
// hardcoded, nothing is logged.
//
// PURE ASCII only.
// =====================================================================

'use strict';

const { buildAnswerLearning } = require('./buildAnswerLearning');
const { promoteDecision } = require('./promoteDecision');
const { updateRegulars } = require('./updateRegulars');

// asdair.pending_action has a partial UNIQUE (household_id, action_type,
// action_key) WHERE status = 'pending' (db/006_shop_control_surface.sql:148).
// ON CONFLICT DO NOTHING against that index makes re-recording the same
// outstanding action a no-op instead of a 23505, so a retry is safe.
const PENDING_ACTION_SQL =
  'INSERT INTO asdair.pending_action ' +
  '(household_id, shop_id, action_type, action_key, payload, note) ' +
  'VALUES ($1, $2, $3, $4, $5::jsonb, $6) ' +
  'ON CONFLICT (household_id, action_type, action_key) WHERE status = \'pending\' ' +
  'DO NOTHING ' +
  'RETURNING id';

function fail(message) {
  throw new Error('recordAnswerLearning: ' + message);
}

// Wrap a step failure so the caller learns WHICH step failed and what had
// already been written, rather than an opaque driver error.
function stepFailure(step, receipt, err) {
  const message = err && err.message ? err.message : String(err);
  const wrapped = new Error('recordAnswerLearning: step "' + step + '" failed: ' + message);
  wrapped.step = step;
  wrapped.receipt = receipt;
  wrapped.cause = err;
  return wrapped;
}

async function insertPendingAction(client, action) {
  if (action.household_id === null || action.household_id === undefined) {
    fail('a pending_action needs a household_id (NOT NULL in asdair.pending_action), but neither the ' +
         'answer nor the product carried one. Supply household_id on the answer.');
  }
  const res = await client.query(PENDING_ACTION_SQL, [
    action.household_id,
    action.shop_id === undefined ? null : action.shop_id,
    action.action_type,
    action.action_key,
    JSON.stringify(action.payload === undefined ? {} : action.payload),
    action.note === undefined ? null : action.note
  ]);
  const rows = (res && res.rows) || [];
  // Zero rows means the ON CONFLICT fired: the action was already outstanding.
  return rows.length > 0
    ? { id: rows[0].id, created: true, action_type: action.action_type, action_key: action.action_key }
    : { id: null, created: false, action_type: action.action_type, action_key: action.action_key };
}

// ---------------------------------------------------------------------
// Main entry point.
//
// options.client (optional): an already-connected pg client, the same
// convention as recordShopOutcome / promoteDecision / updateRegulars. Each
// underlying writer still owns its own BEGIN/COMMIT; this module never opens a
// transaction of its own and never nests one, so the existing atomicity
// guarantees are untouched.
//
// When no client is given, each writer takes one from its own pool - which is
// why a caller composing several answers should pass one client.
// ---------------------------------------------------------------------
async function recordAnswerLearning(answer, options) {
  // PURE first: a malformed answer, a skip carrying a resolution, or a
  // one-week-only promotion fails BEFORE any connection is opened.
  const plan = buildAnswerLearning(answer);

  const opts = options || {};
  const client = opts.client || null;
  const writerOptions = client ? { client: client } : undefined;

  const receipt = {
    shop_id: plan.context.shop_id,
    question_key: plan.context.question_key,
    status: plan.context.status,
    log_id: null,
    rule_id: null,
    regulars: [],
    pending_actions: [],
    suppression: plan.suppression
  };

  // ---- 1. the decision: always, and first --------------------------------
  try {
    const promoted = await promoteDecision(plan.decision, writerOptions);
    receipt.log_id = promoted.logId;
    receipt.rule_id = promoted.ruleId;
  } catch (err) {
    throw stepFailure('promoteDecision', receipt, err);
  }

  // ---- 2. the catalogue: the part that stops next week's question ---------
  for (let i = 0; i < plan.regulars.length; i++) {
    const operation = plan.regulars[i];
    try {
      const result = await updateRegulars(operation, writerOptions);
      receipt.regulars.push(result);
    } catch (err) {
      throw stepFailure('updateRegulars[' + i + '] (' + operation.op + ')', receipt, err);
    }
  }

  // Now that a new regular has a real id, the suppression record can name it,
  // so a caller can verify the exact row that will answer next week's line.
  const created = receipt.regulars.filter(function (r) { return r.op === 'upsertRegular'; });
  if (created.length === 1) {
    receipt.suppression = Object.assign({}, plan.suppression, {
      terms: plan.suppression.terms.map(function (t) {
        return t.mechanism === 'new_regular' && t.regular_id === null
          ? Object.assign({}, t, { regular_id: created[0].id })
          : t;
      })
    });
  }

  // ---- 3. the outstanding browser action ---------------------------------
  if (plan.pending_actions.length > 0) {
    if (!client) {
      fail('recording a pending_action needs a client: pass options.client. asdair.pending_action has ' +
           'no writer of its own, so this module has no pool to take one from.');
    }
    for (let i = 0; i < plan.pending_actions.length; i++) {
      try {
        receipt.pending_actions.push(await insertPendingAction(client, plan.pending_actions[i]));
      } catch (err) {
        throw stepFailure('pendingAction[' + i + ']', receipt, err);
      }
    }
  }

  return receipt;
}

module.exports = {
  recordAnswerLearning: recordAnswerLearning,
  _internal: {
    insertPendingAction: insertPendingAction,
    stepFailure: stepFailure,
    PENDING_ACTION_SQL: PENDING_ACTION_SQL
  }
};
