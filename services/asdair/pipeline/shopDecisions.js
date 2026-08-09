// =====================================================================
// BUILD-015 AsdAIr WP-B15-2 - pipeline/shopDecisions.js
//
// THE DURABLE HOME OF WHAT AN ANSWER MEANT FOR THIS WEEK (migration 017,
// asdair.shop_decision).
//
// Until this module, an answer changed `shop_question.answer_text` and nothing
// else that the current shop's plan could read. The one write it did produce
// went to `asdair.rule_qa_log` with `applies_going_forward: false` - the exact
// field `planner.js` filters on - so the answer was written, read back, and
// discarded. This module is the other half: the STRUCTURED meaning of that
// answer, in the current shop's own durable state.
//
// ── INSERT-ONLY, AND THAT IS A GRANT, NOT A CONVENTION ──────────────────────
// Migration 017 grants asdair_rw SELECT and INSERT on this table and grants
// UPDATE and DELETE to NOBODY. So this module emits exactly ONE mutating
// statement shape - INSERT ... ON CONFLICT (question_id) DO NOTHING - and
// there is deliberately no update path to write, because the database would
// refuse one. A decision, once recorded, is what was decided.
//
// ── ONE DECISION PER QUESTION, EVER ─────────────────────────────────────────
// `shop_decision_question_uniq` is the structural idempotency: a re-run of
// interpretation resolves to the SAME row rather than producing a second,
// possibly different, reading of the same answer. The database decides the
// duplicate, not a read-then-write here. Same shape shopStore.openQuestion
// uses, and for the same reason.
//
// ── EVERY DATABASE CHECK IS CHECKED HERE FIRST ──────────────────────────────
// `buildDecision` mirrors all fifteen CHECK constraints from 017 so a
// violation is a readable English sentence rather than a Postgres 23514 from
// inside a pipeline step. The database remains the enforcer - this is a better
// error message, never a substitute. That matters more than usual here: these
// rows are written from a model's structured return, and the constraint the
// database enforces is the only guard that does not depend on the interpreting
// code being correct.
//
// ── A MISSING ROW IS NOT "NO DECISION" ──────────────────────────────────────
// There is no backfill for the three shops that predate this table. A missing
// decision means "decided before this table existed" or "not yet decided", and
// NEVER "no decision was made". Every projection here honours that.
// =====================================================================

/** The decision vocabulary, mirroring 017's shop_decision_kind_known. */
export const DECISION_KINDS = Object.freeze([
  'existing_regular', 'quantity_change', 'variant_choice',
  'new_item', 'skip_this_week', 'clarification_required',
]);

/** Kinds that must name a real catalogue product. */
const KINDS_REQUIRING_REGULAR = Object.freeze([
  'existing_regular', 'quantity_change', 'variant_choice',
]);

/**
 * ORTHOGONAL to decision_kind, and deliberately so: "one packet, and yes get
 * it every week" is simultaneously a quantity decision AND a forward signal,
 * and a single enum could record only one of the two facts.
 *
 * STORED, ROUTED NOWHERE. Consuming it is Lane B and is parked by Warwick.
 * NULL and 'unclear' differ: NULL means no forward signal was expressed;
 * 'unclear' means one was and it could not be read.
 */
export const FORWARD_INTENTS = Object.freeze(['yes', 'no', 'unclear']);

/** Mirrors shop_decision_interpreter_known. */
export const INTERPRETERS = Object.freeze(['terra', 'human', 'rule']);

const INSERT_COLUMNS = Object.freeze([
  'shop_id', 'question_id', 'decision_kind', 'decided_regular_id', 'decided_quantity',
  'decided_item_name', 'clarification_reason', 'forward_intent', 'interpreted_by',
  'interpreted_model', 'decision_evidence', 'grounding_fingerprint', 'evidence_shop_line_id',
]);

const SELECT_LIST =
  'id, shop_id, question_id, decision_kind, decided_regular_id, decided_quantity, ' +
  'decided_item_name, clarification_reason, forward_intent, interpreted_by, ' +
  'interpreted_model, interpreted_at, decision_evidence, grounding_fingerprint, ' +
  'evidence_shop_line_id, created_at';

// THE ONLY MUTATING STATEMENT THIS MODULE EMITS. No UPDATE, no DELETE - not
// because none is written, but because migration 017 grants neither to anybody.
const INSERT_SQL =
  `INSERT INTO asdair.shop_decision (${INSERT_COLUMNS.join(', ')}) ` +
  'VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11::jsonb, $12, $13) ' +
  'ON CONFLICT (question_id) DO NOTHING ' +
  `RETURNING ${SELECT_LIST}`;

const SELECT_BY_QUESTION_SQL =
  `SELECT ${SELECT_LIST} FROM asdair.shop_decision WHERE question_id = $1`;

// THE JOIN THAT MAKES A DECISION APPLICABLE. A plan is recomputed, never
// stored, so the only durable link between a plan line and a decision row is
// the QUESTION KEY the line's question was opened under. Carrying it here means
// applyDecisions never has to reach back into the database, and stays pure.
const SELECT_BY_SHOP_SQL =
  `SELECT ${SELECT_LIST.split(', ').map((c) => `d.${c}`).join(', ')}, ` +
  'q.question_key, q.question_round, q.parent_question_id, q.status AS question_status ' +
  'FROM asdair.shop_decision d ' +
  'JOIN asdair.shop_question q ON q.id = d.question_id AND q.shop_id = d.shop_id ' +
  'WHERE d.shop_id = $1 ORDER BY d.id ASC';

function fail(message) { throw new Error(`shopDecisions: ${message}`); }

function optionalInt(value, label, { min, max }) {
  if (value === null || value === undefined || value === '') return null;
  const n = Number(value);
  if (!Number.isInteger(n) || n < min || n > max) {
    fail(`${label} must be an integer ${min}..${max} or null, got ${String(value)}`);
  }
  return n;
}

function optionalText(value) {
  if (value === null || value === undefined) return null;
  const s = String(value).trim();
  return s === '' ? null : s;
}

/**
 * PURE. Validate and shape one structured decision into the row migration 017
 * will accept.
 *
 * Mirrors every CHECK in 017, in the order they appear there. A caller that
 * gets this right cannot then be refused by the database; a caller that gets
 * it wrong is told which rule it broke and why, instead of a constraint name.
 */
export function buildDecision(spec) {
  const s = spec || {};

  const shopId = optionalInt(s.shop_id, 'shop_id', { min: 1, max: Number.MAX_SAFE_INTEGER });
  if (shopId === null) fail('shop_id is required');
  const questionId = optionalInt(s.question_id, 'question_id', { min: 1, max: Number.MAX_SAFE_INTEGER });
  if (questionId === null) fail('question_id is required - a decision with no question is not a decision about anything');

  const kind = String(s.decision_kind ?? '').trim();
  if (!DECISION_KINDS.includes(kind)) {
    fail(`decision_kind "${kind}" is not one of: ${DECISION_KINDS.join(', ')}`);
  }

  const regularId = optionalInt(s.decided_regular_id, 'decided_regular_id', { min: 1, max: Number.MAX_SAFE_INTEGER });
  const quantity = optionalInt(s.decided_quantity, 'decided_quantity', { min: 1, max: 999 });
  const itemName = optionalText(s.decided_item_name);
  const reason = optionalText(s.clarification_reason);

  // shop_decision_regular_required - nothing records a confident decision about
  // nothing. The FK makes the id real; this makes its ABSENCE impossible.
  if (KINDS_REQUIRING_REGULAR.includes(kind) && regularId === null) {
    fail(`decision_kind "${kind}" names a stocked product, so decided_regular_id is required. `
      + 'A confident decision naming no product is exactly the fabrication catalogue grounding exists to prevent.');
  }

  // shop_decision_new_item_shape + shop_decision_name_only_for_new. A new item
  // is by definition absent from the catalogue: it carries the approved NAME
  // and never a regulars id. Everywhere else the canonical name is looked up
  // from asdair.regulars by id, so model prose can never masquerade as a
  // product we stock.
  if (kind === 'new_item') {
    if (itemName === null) fail('decision_kind "new_item" requires decided_item_name');
    if (regularId !== null) {
      fail('decision_kind "new_item" must not carry decided_regular_id - an item that is in the catalogue is not a new item');
    }
  } else if (itemName !== null) {
    fail(`decided_item_name is only permitted on "new_item", not on "${kind}" - `
      + 'the canonical name is looked up from asdair.regulars by id');
  }

  // shop_decision_name_shaped
  if (itemName !== null && itemName.length > 200) {
    fail(`decided_item_name must be 200 characters or fewer, got ${itemName.length}`);
  }

  // shop_decision_qty_required / shop_decision_skip_shape
  if (kind === 'quantity_change' && quantity === null) {
    fail('decision_kind "quantity_change" requires decided_quantity');
  }
  if (kind === 'skip_this_week' && quantity !== null) {
    fail('decision_kind "skip_this_week" decides nothing about how much - decided_quantity must be null');
  }

  // shop_decision_clarification_shape - a reason exists IFF a clarification is
  // required. Both directions, because either alone is an incoherent row.
  if (kind === 'clarification_required') {
    if (reason === null) fail('decision_kind "clarification_required" requires clarification_reason');
    // shop_decision_clarification_decides_nothing
    if (regularId !== null || quantity !== null) {
      fail('decision_kind "clarification_required" decides nothing - decided_regular_id and decided_quantity must both be null. '
        + 'Unknown means ask again; it never means take the least-bad match.');
    }
  } else if (reason !== null) {
    fail(`clarification_reason is only permitted on "clarification_required", not on "${kind}"`);
  }

  // shop_decision_forward_intent_known
  const forwardIntent = optionalText(s.forward_intent);
  if (forwardIntent !== null && !FORWARD_INTENTS.includes(forwardIntent)) {
    fail(`forward_intent "${forwardIntent}" is not one of: ${FORWARD_INTENTS.join(', ')} (or null for no signal)`);
  }

  // shop_decision_interpreter_known
  const interpretedBy = String(s.interpreted_by ?? '').trim();
  if (!INTERPRETERS.includes(interpretedBy)) {
    fail(`interpreted_by "${interpretedBy}" is not one of: ${INTERPRETERS.join(', ')}`);
  }

  // shop_decision_evidence_is_object
  const evidence = s.decision_evidence === null || s.decision_evidence === undefined
    ? {} : s.decision_evidence;
  if (typeof evidence !== 'object' || Array.isArray(evidence)) {
    fail('decision_evidence must be a JSON object');
  }

  // shop_decision_terra_shows_its_work - a model-derived decision cannot exist
  // without the evidence of what it was given. Asserting that the catalogue was
  // loaded is not evidence.
  if (interpretedBy === 'terra' && Object.keys(evidence).length === 0) {
    fail('interpreted_by "terra" requires non-empty decision_evidence - '
      + 'a model-derived decision cannot exist without the evidence of what it was given');
  }

  // shop_decision_grounding_fingerprint_shaped
  const fingerprint = optionalText(s.grounding_fingerprint);
  if (fingerprint !== null && !/^[0-9a-f]{16,128}$/.test(fingerprint)) {
    fail(`grounding_fingerprint must be 16-128 lowercase hex characters or null, got "${fingerprint}"`);
  }

  return {
    shop_id: shopId,
    question_id: questionId,
    decision_kind: kind,
    decided_regular_id: regularId,
    decided_quantity: quantity,
    decided_item_name: itemName,
    clarification_reason: reason,
    forward_intent: forwardIntent,
    interpreted_by: interpretedBy,
    interpreted_model: optionalText(s.interpreted_model),
    decision_evidence: evidence,
    grounding_fingerprint: fingerprint,
    evidence_shop_line_id: optionalInt(s.evidence_shop_line_id, 'evidence_shop_line_id',
      { min: 1, max: Number.MAX_SAFE_INTEGER }),
  };
}

/**
 * Persist one structured decision. Idempotent on question_id.
 *
 * @returns {{decision:object, created:boolean, already:boolean}} `already` is
 *          true when this question was already decided - reported, never
 *          silent, and the STORED decision is handed back rather than the one
 *          that was refused. A second reading of the same answer never
 *          overwrites the first.
 */
export async function recordDecision(deps, spec) {
  const row = buildDecision(spec);
  const params = [
    row.shop_id, row.question_id, row.decision_kind, row.decided_regular_id, row.decided_quantity,
    row.decided_item_name, row.clarification_reason, row.forward_intent, row.interpreted_by,
    row.interpreted_model, JSON.stringify(row.decision_evidence), row.grounding_fingerprint,
    row.evidence_shop_line_id,
  ];
  const res = await deps.writeQuery(INSERT_SQL, params);
  const written = ((res && res.rows) || [])[0] || null;
  if (written) return { decision: written, created: true, already: false };

  // Zero rows means ON CONFLICT refused it: this question is already decided.
  // Hand back what is actually stored, never what we tried to write.
  const existing = ((await deps.readQuery(SELECT_BY_QUESTION_SQL, [row.question_id])).rows || [])[0] || null;
  if (!existing) {
    fail(`the insert wrote nothing for question ${row.question_id} and no decision exists for it. Nothing was written.`);
  }
  return { decision: existing, created: false, already: true };
}

/**
 * PURE. Can this answer be resolved WITHOUT a model call?
 *
 * AC2: a tap naming an exact candidate must not spend a model call. It already
 * carries the whole answer - the human picked from a list we rendered, and the
 * candidate we rendered carries a trustworthy `regular_id` (planCandidates
 * emits one ONLY for resolveByCatalogue alternatives, which are the only
 * population whose ids are genuine asdair.regulars ids). There is nothing left
 * to interpret, and asking a model to interpret it would be both a waste and a
 * chance to be wrong about something already certain.
 *
 * `answer_text` for a tap is the CANDIDATE LABEL, not prose (resolveTap.js:507
 * - `answerText: candidateLabel || candidateId`), which is exactly what makes
 * this exact match sound. For a tap, the tap IS the answer.
 *
 * Returns null when the answer cannot be settled deterministically - which is
 * the honest outcome for free text, and never a least-bad match.
 *
 * @returns {{decided:object}|null}
 */
export function resolveExactCandidate(question) {
  const q = question || {};
  if (q.status === 'skipped') {
    return { decided: { decision_kind: 'skip_this_week', interpreted_by: 'human' } };
  }
  const answer = q.answer_text === null || q.answer_text === undefined ? '' : String(q.answer_text).trim();
  if (answer === '') return null;

  // The rendered list is the authority on what was OFFERED. Prefer it over
  // `candidates`, because it is what the human actually saw and tapped.
  const offered = [
    ...(Array.isArray(q.rendered_candidates) ? q.rendered_candidates : []),
    ...(Array.isArray(q.candidates) ? q.candidates : []),
  ];

  for (const c of offered) {
    if (!c || typeof c !== 'object') continue;
    const id = c.regular_id ?? null;
    // NO ID, NO DETERMINISTIC RESOLUTION. A planner suggestion carries a name
    // and no id on purpose; treating its label as an identity is the exact
    // fabrication planCandidates' three-population comment exists to prevent.
    if (id === null || id === undefined) continue;
    const label = c.label === null || c.label === undefined ? '' : String(c.label).trim();
    if (label !== '' && label === answer) {
      return {
        decided: {
          decision_kind: 'existing_regular',
          decided_regular_id: Number(id),
          // NOT 'terra'. No model was asked, and recording one would put a
          // model's name on a decision it never made.
          interpreted_by: 'human',
        },
      };
    }
  }
  return null;
}

/** Every decision recorded for a shop, in the order they were made. */
export async function listDecisions(deps, shopId) {
  const res = await deps.readQuery(SELECT_BY_SHOP_SQL, [shopId]);
  return (res && res.rows) || [];
}

/** The decision for one question, or null when it has not been decided. */
export async function findDecisionForQuestion(deps, questionId) {
  const res = await deps.readQuery(SELECT_BY_QUESTION_SQL, [questionId]);
  return ((res && res.rows) || [])[0] || null;
}

export const _internal = { INSERT_SQL, SELECT_BY_QUESTION_SQL, SELECT_BY_SHOP_SQL, INSERT_COLUMNS };
