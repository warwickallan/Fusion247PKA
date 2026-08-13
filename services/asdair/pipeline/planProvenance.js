// =====================================================================
// BUILD-015 AsdAIr Stage 1 - pipeline/planProvenance.js
//
// WO-2026-08-13-13 (WP-B15-46), AC1 + AC3. THE PRODUCTION CALLER FOR THE THREE
// NON-PHOTO PROVENANCE KINDS.
//
// ── WHAT THIS CLOSES, AND WHY IT IS A SEPARATE MODULE ─────────────────────
// Veritas graded WO-2026-08-13-10 AC1 HOLD (receipt
// Builds/BUILD-015-.../Assurance/veritas-wp-b15-40-gate1-58c86ef.md, F1):
// `pipeline/deps.js:46` imported exactly ONE provenance writer -
// `insertPhotoProvenanceBatch` - so REGULARS, RULE and WARWICK rows existed
// only where `test/lineProvenance.dbtest.js` called the writer DIRECTLY. By
// the contract's definition those three kinds were NOT ON THE JOURNEY.
//
// Warwick's standing clause for this phase is the bar:
//   "Required provenance survives through the actual production path rather
//    than merely existing in schemas or tests."
//
// So this module is the caller. It sits beside `lineProvenance.js` (which owns
// the row shapes and the writes) rather than inside it, for the same reason
// that file states in its own header: THE WRITER IS NOT THE ORCHESTRATOR.
// `lineProvenance.js` knows how a row is built and persisted; this module knows
// WHEN the shopping journey has produced one.
//
// ── THE THREE ORIGINS, AND WHERE EACH IS OBSERVED ────────────────────────
// All three are observed at `runPipeline.js planWithDecisions`, which is the
// ONE place the three plan stages run:
//
//   planBasket            -> REGULARS  a basket line the photograph never
//                                      carried: a shopping_list_items row with
//                                      no shop_line behind it, resolved by the
//                                      planner to a household regular.
//   applyRulebook         -> RULE      audit.applied - a line a household rule
//                                      set, re-quantified, or added as a
//                                      companion.
//   applyDecisionsToPlan  -> WARWICK   applied - a line a decision HE recorded
//                                      settled this week.
//
// ⛔ NOTHING HERE MAY EVER EMIT `PHOTO`. That kind means "read off the
// photograph, citing a region of THIS shop's own image", and only
// `insertPhotoProvenanceBatch` - which holds the resolved region ids - can
// honestly build one. AC2's converse is enforced three times over: this module
// never names the kind, `assertRowSatisfiesChecks` refuses a PHOTO row with no
// `source_region_id`, and migration 020's `shop_line_provenance_region_iff_
// photo` is a BICONDITIONAL check that the database itself applies. See
// `planProvenance.test.js` for the mutation proofs of the first two.
//
// ── IDEMPOTENCE IS A REQUIREMENT, NOT A NICETY ───────────────────────────
// `planWithDecisions` is deliberately called at EVERY recomputation - three
// production call sites today (stepPlan, buildBrowserHandoff,
// stepRecordConfirmation) and a journey reaches several of them. The ledger is
// INSERT-ONLY with no unique index, so an unguarded write here would multiply
// rows on every pass and turn the audit trail into noise. `persistPlanProvenance`
// therefore reads what this shop already carries and writes only what is new.
//
// This is a read-then-insert, not a database constraint, and that is stated
// rather than implied: it is safe because a shop is advanced by one pipeline at
// a time, and it is the honest shape available without a schema change (which
// this Work Order's surface excludes). A genuine concurrent double-advance of
// the SAME shop could still duplicate a row; it would duplicate an audit
// record, never corrupt one, because nothing here updates or deletes.
// =====================================================================

'use strict';

import {
  buildRegularsProvenanceRow, buildRuleProvenanceRow, buildWarwickProvenanceRow,
  insertProvenanceRow,
} from './lineProvenance.js';

/** The three kinds this module is permitted to produce. PHOTO is NOT among
 *  them, and the export exists so a test can assert that rather than read it. */
export const NON_PHOTO_KINDS = Object.freeze(['REGULARS', 'RULE', 'WARWICK']);

const SELECT_EXISTING_SQL =
  'SELECT provenance, line_no, matched_regular_id, quantity, raw_text '
  + 'FROM asdair.shop_line_provenance WHERE shop_id = $1';

function textOrNull(v) {
  if (v === null || v === undefined) return null;
  const t = String(v).trim();
  return t === '' ? null : t;
}

function intOrNull(v) {
  if (v === null || v === undefined) return null;
  const n = Number(v);
  return Number.isInteger(n) && n > 0 && n <= 999 ? n : null;
}

/**
 * The identity of an already-recorded origin. Two rows with the same signature
 * describe the same fact about the same shop, so the second is a recomputation
 * rather than a new event. `quantity` IS part of the identity: a rule that
 * genuinely moves a quantity has said something new and earns its own row.
 */
export function provenanceSignature(row) {
  return [
    row.provenance,
    row.line_no === null || row.line_no === undefined ? '' : String(row.line_no),
    row.matched_regular_id === null || row.matched_regular_id === undefined ? '' : String(row.matched_regular_id),
    row.quantity === null || row.quantity === undefined ? '' : String(row.quantity),
    textOrNull(row.raw_text) === null ? '' : textOrNull(row.raw_text),
  ].join('\u0000');
}

/**
 * PURE. Work out which non-photo origins this plan produced.
 *
 * Returns already-validated rows (each builder runs `assertRowSatisfiesChecks`),
 * plus `declined` - origins that were observed but CANNOT be recorded honestly,
 * each with its reason. Declining is visible on purpose: migration 020 requires
 * a REGULARS row to name a real `matched_regular_id`, and inventing one to make
 * a row insertable would be precisely the fabrication this ledger exists to
 * make impossible.
 *
 * @param {object} args
 * @param {number} args.shopId
 * @param {Array<object>} args.listItems     shopping_list_items rows as read
 * @param {Array<object>} args.shopLines     the durable photo interpretation
 * @param {object} args.plan                 the plan AFTER all three stages
 * @param {object|null} args.rulebookAudit   applyRulebook's audit
 * @param {Array<object>} args.decisionsApplied  applyDecisionsToPlan's `applied`
 * @param {Map} args.regularsById
 * @returns {{rows: Array<object>, declined: Array<object>}}
 */
export function derivePlanProvenance({
  shopId, listItems, shopLines, plan, rulebookAudit, decisionsApplied, regularsById,
}) {
  const rows = [];
  const declined = [];

  const items = Array.isArray(plan && plan.items) ? plan.items : [];
  const planByName = new Map(items.filter((i) => i && i.item_name).map((i) => [String(i.item_name), i]));

  // ── REGULARS ────────────────────────────────────────────────────────────
  // A list line the photograph never carried. `shop_line.list_item_id` is the
  // join the interpretation writes, so a list item no shop_line points at is by
  // construction not a photo line. This is the same distinction
  // `finalise/finalList.js` draws for the durable artefact ("added by the
  // planner from the household Regulars, not read off the photograph"); it is
  // derived here from the DURABLE ROWS rather than from that artefact, because
  // the artefact is an output and this is the journey.
  const photoBackedItemIds = new Set(
    (Array.isArray(shopLines) ? shopLines : [])
      .map((l) => (l && l.list_item_id !== null && l.list_item_id !== undefined ? String(l.list_item_id) : null))
      .filter((v) => v !== null),
  );

  for (const item of (Array.isArray(listItems) ? listItems : [])) {
    if (!item || item.id === null || item.id === undefined) continue;
    if (photoBackedItemIds.has(String(item.id))) continue;

    const planned = planByName.get(String(item.item_name)) || null;
    const regularId = resolveRegularId(planned, item, regularsById);
    if (regularId === null) {
      declined.push({
        kind: 'REGULARS',
        item_name: item.item_name,
        reason: 'no household regular could be resolved for this line, and migration 020 requires a '
          + 'REGULARS row to name one - recording it would mean inventing an identity',
      });
      continue;
    }
    rows.push(buildRegularsProvenanceRow({
      shopId,
      lineNo: null,
      matchedRegularId: regularId,
      quantity: intOrNull(planned ? planned.requested_qty : item.requested_qty),
    }));
  }

  // ── RULE ────────────────────────────────────────────────────────────────
  // Every entry the rulebook RECORDED as applied. The audit is the rulebook's
  // own account of what it changed, so this cannot drift from what actually
  // happened to the basket.
  for (const entry of (Array.isArray(rulebookAudit && rulebookAudit.applied) ? rulebookAudit.applied : [])) {
    if (!entry) continue;
    const planned = entry.item_name ? planByName.get(String(entry.item_name)) || null : null;
    rows.push(buildRuleProvenanceRow({
      shopId,
      lineNo: intOrNull(entry.line_no),
      matchedRegularId: resolveRegularId(planned, null, regularsById),
      rawText: ruleText(entry),
      quantity: intOrNull(entry.kind === 'set_quantity' ? entry.to : entry.quantity),
    }));
  }

  // ── WARWICK ─────────────────────────────────────────────────────────────
  // A line a decision HE recorded settled. `regular_id` is present only on the
  // kinds that name a product; the others carry their meaning as text, which is
  // exactly what `shop_line_provenance_rule_warwick_names_something` permits.
  for (const entry of (Array.isArray(decisionsApplied) ? decisionsApplied : [])) {
    if (!entry) continue;
    const named = entry.regular_id === null || entry.regular_id === undefined
      ? null : Number(entry.regular_id);
    const planned = entry.item_name ? planByName.get(String(entry.item_name)) || null : null;
    rows.push(buildWarwickProvenanceRow({
      shopId,
      lineNo: null,
      matchedRegularId: named !== null && Number.isFinite(named)
        ? named : resolveRegularId(planned, null, regularsById),
      rawText: warwickText(entry),
      quantity: intOrNull(planned ? planned.requested_qty : null),
    }));
  }

  return { rows, declined };
}

/**
 * The regulars id behind a planned line, or null.
 *
 * `planBasket` returns `matched_product` as a NAME, never an id (see its
 * publicItems projection), so identity is recovered from the same catalogue the
 * planner was given - the identical recovery `runPipeline.js` already performs
 * for the execution packet, and for the same reason: a name that no longer
 * resolves is a real defect and must NOT be papered over with a guess.
 */
function resolveRegularId(planned, listItem, regularsById) {
  const direct = listItem && listItem.matched_regular_id !== null && listItem.matched_regular_id !== undefined
    ? Number(listItem.matched_regular_id) : null;
  if (direct !== null && Number.isFinite(direct)) return direct;

  const name = planned && planned.matched_product ? String(planned.matched_product) : null;
  if (name === null || !(regularsById instanceof Map)) return null;
  for (const [id, regular] of regularsById) {
    if (regular && String(regular.name) === name) return Number(id);
  }
  return null;
}

/** What the rule did, in the ledger's own words. Never empty - a RULE row must
 *  name a product or carry text, and this is the text. */
function ruleText(entry) {
  const parts = [`rule ${entry.rule_id === null || entry.rule_id === undefined ? '?' : entry.rule_id}`];
  if (entry.kind) parts.push(String(entry.kind));
  if (entry.item_name) parts.push(`on "${String(entry.item_name)}"`);
  if (entry.to !== null && entry.to !== undefined && String(entry.to) !== '') parts.push(`-> ${String(entry.to)}`);
  return parts.join(' ').slice(0, 1000);
}

/** What Warwick's decision did. Same contract as ruleText. */
function warwickText(entry) {
  const parts = ['decision'];
  if (entry.kind) parts.push(String(entry.kind));
  if (entry.item_name) parts.push(`on "${String(entry.item_name)}"`);
  if (entry.question_key) parts.push(`(${String(entry.question_key)})`);
  return parts.join(' ').slice(0, 1000);
}

/**
 * Persist the derived rows, skipping anything this shop already carries.
 *
 * FAILURES PROPAGATE. This is the `recordAnswerLearning` judgement, not the
 * `realRecordLearning` one, and the difference is deliberate: enriching an
 * alias must never fail a shop that otherwise reconciled, but a swallowed
 * failure on the path whose entire purpose is that provenance SURVIVES is
 * indistinguishable from the defect this module exists to close. That is the
 * exact shape Veritas caught, and hiding it behind a catch would rebuild it.
 *
 * @param {object} deps - {readQuery, writeQuery}
 * @param {object} args - the derivePlanProvenance arguments
 * @returns {Promise<{written: Array<object>, skipped: number, declined: Array<object>}>}
 */
export async function persistPlanProvenance(deps, args) {
  const { rows, declined } = derivePlanProvenance(args);
  if (rows.length === 0) return { written: [], skipped: 0, declined };

  const existing = await deps.readQuery(SELECT_EXISTING_SQL, [args.shopId]);
  const seen = new Set(((existing && existing.rows) || []).map(provenanceSignature));

  const written = [];
  let skipped = 0;
  for (const row of rows) {
    const sig = provenanceSignature(row);
    if (seen.has(sig)) { skipped += 1; continue; }
    seen.add(sig);
    written.push(await insertProvenanceRow(deps, row));
  }
  return { written, skipped, declined };
}

export default persistPlanProvenance;
