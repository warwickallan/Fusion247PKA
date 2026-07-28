// =====================================================================
// BUILD-015 AsdAIr Stage 1 - pipeline/store.js
//
// THE DURABLE-STATE SEAM. Every fact the pipeline acts on is read here, from
// Postgres, in one place - and every write goes through the components that
// already own it (services/asdair/shop/shopStore.js above all).
//
// THIS MODULE ADDS NO NEW WRITE PATH. It issues SELECTs, and it calls
// shopStore. It contains no INSERT, no DELETE and exactly ONE UPDATE-bearing
// call - shopStore's own exported `applyTransition`, used for the single case
// the public `transition()` cannot express (see advanceWithList below).
//
// ── WHY THE COMMAND LEDGER LIVES IN asdair.pending_action ───────────────────
// Migration 006 already provides a durable, household-scoped record whose
// unique index is EXACTLY the idempotency a command surface needs:
//
//     pending_action_key_uniq (household_id, action_type, action_key)
//                             WHERE status = 'pending'
//
// So "record this command; if the same command is already outstanding, adopt it
// instead of stacking a duplicate" is one INSERT ... ON CONFLICT DO NOTHING,
// decided by the DATABASE rather than by a check-then-insert in this file. A
// dedicated table would mean owning a migration inside a component folder this
// work package must not modify.
//
// The cost, stated plainly: shopStatus.outstanding_actions surfaces
// pending_action rows to a human. Pipeline rows are namespaced `cmd:` and
// `msg:` (see keys.js) so any surface can filter them out, and
// `listHouseholdActions` does exactly that.
//
// ── READ/WRITE SPLIT ────────────────────────────────────────────────────────
// Reads go through the injected `readQuery` (the SELECT-only asdair_ro role,
// ASDAIR_DB_URL). Writes go through the injected `shopStore` (asdair_rw,
// ASDAIR_WRITE_DB_URL). Neither connection string appears in this file, is
// logged, or is read from any credentials file - env var NAMES only, and the
// naming lives in deps.js.
// =====================================================================

import {
  COMMAND_PREFIX,
  OUTBOX_PREFIX,
  commandActionType,
  outboxActionType,
  isPipelineActionType,
} from './keys.js';
import { COMMAND_NAMES, COMMAND_SPECS, CONSUMPTION } from './commandNames.js';

/** The `cmd:` action_types that a runner is expected to CONSUME. Derived from
 *  the command specs so the two can never drift. */
export const CONSUMABLE_COMMAND_TYPES = Object.freeze(
  COMMAND_NAMES
    .filter((n) => COMMAND_SPECS[n].durable && COMMAND_SPECS[n].consumption === CONSUMPTION.CONSUME)
    .map(commandActionType),
);

const LIVE_BROWSER_STATUSES = ['queued', 'claimed', 'running'];

const SHOP_COLUMNS =
  'id, household_id, shop_ref, status, source_kind, telegram_chat_id, telegram_message_id, ' +
  'telegram_update_id, raw_text, raw_media_path, transcript, needs_review, list_id, last_error, ' +
  'created_at, updated_at';

/** PURE. Strip the `cmd:` prefix back off an action_type. */
function commandNameOf(actionType) {
  const t = String(actionType ?? '');
  return t.startsWith(COMMAND_PREFIX) ? t.slice(COMMAND_PREFIX.length) : null;
}

function asObject(value) {
  if (value === null || value === undefined) return {};
  if (typeof value === 'string') {
    try { return JSON.parse(value); } catch { return {}; }
  }
  return typeof value === 'object' && !Array.isArray(value) ? value : {};
}

function rowsOf(result) {
  return (result && result.rows) || [];
}

// ---------------------------------------------------------------------
// Reads
// ---------------------------------------------------------------------

/** One shop by its numeric id. Null when there is none - never a throw, so a
 *  caller can distinguish "gone" from "broken". */
export async function findShopById(deps, shopId) {
  const res = await deps.readQuery(
    `SELECT ${SHOP_COLUMNS} FROM asdair.shop WHERE id = $1`, [shopId],
  );
  return rowsOf(res)[0] || null;
}

/**
 * One shop by its human ref.
 *
 * shop_ref is unique PER HOUSEHOLD (migration 006's shop_ref_uniq), so a bare
 * ref matching more than one household is AMBIGUOUS and is refused by name -
 * the same posture shopStatus.resolveShop takes. Answering about the wrong
 * household would be worse than answering nothing.
 */
export async function findShopByRef(deps, shopRef, householdId = null) {
  const res = await deps.readQuery(
    `SELECT ${SHOP_COLUMNS} FROM asdair.shop WHERE shop_ref = $1 ORDER BY id ASC`, [shopRef],
  );
  const rows = rowsOf(res);
  if (rows.length === 0) return null;
  if (householdId !== null && householdId !== undefined) {
    return rows.find((r) => String(r.household_id) === String(householdId)) || null;
  }
  if (rows.length > 1) {
    throw new Error(`store: shop_ref ${shopRef} exists for more than one household - pass householdId to disambiguate`);
  }
  return rows[0];
}

/** Resolve either handle to exactly one shop row, or throw with a readable reason. */
export async function requireShop(deps, { shopId = null, shopRef = null, householdId = null } = {}) {
  const shop = shopId !== null && shopId !== undefined
    ? await findShopById(deps, shopId)
    : await findShopByRef(deps, shopRef, householdId);
  if (!shop) {
    throw new Error(`store: no shop matches ${shopId !== null && shopId !== undefined ? `id ${shopId}` : `ref ${shopRef}`}`);
  }
  return shop;
}

/**
 * Every shop the runner must look at this pass, oldest first.
 *
 * TWO populations, and the second one is easy to miss:
 *
 *   1. Shops that are still MOVING. Terminal shops are excluded by the query
 *      rather than filtered afterwards, so a finished week can never be
 *      re-advanced by a bug in the loop.
 *
 *   2. Terminal shops that still carry an OUTSTANDING, CONSUMABLE command.
 *      Without this, a button tapped after the week finished records a command
 *      the runner never visits - and it sits "pending" in the household's
 *      outstanding-actions list forever, one more for every tap. The runner
 *      retires it with a reason (runPipeline.abandonOutstanding) and the shop
 *      then drops out of this query for good.
 *
 * LATCH commands are deliberately NOT in the second clause. They are permanent
 * facts about the week ("this is where it came from", "a human approved this")
 * and stay pending by design, so including them would make every finished shop
 * reappear on every pass, forever.
 */
export async function listActiveShops(deps, consumableCommandTypes = []) {
  const res = await deps.readQuery(
    `SELECT ${SHOP_COLUMNS} FROM asdair.shop
      WHERE status NOT IN ('RECONCILED','CANCELLED')
         OR id IN (SELECT shop_id FROM asdair.pending_action
                    WHERE status = 'pending' AND shop_id IS NOT NULL
                      AND action_type = ANY($1))
      ORDER BY id ASC`, [consumableCommandTypes],
  );
  return rowsOf(res);
}

/** The open-question count for one shop. */
export async function countOpenQuestions(deps, shopId) {
  const res = await deps.readQuery(
    `SELECT count(*)::int AS n FROM asdair.shop_question WHERE shop_id = $1 AND status = 'open'`,
    [shopId],
  );
  return Number(rowsOf(res)[0]?.n) || 0;
}

/** Every question on a shop, in the order it was asked. */
export async function listQuestions(deps, shopId) {
  const res = await deps.readQuery(
    `SELECT id, question_key, question_text, candidates, status, answer_text, answer_source,
            card_chat_id, card_message_id
       FROM asdair.shop_question WHERE shop_id = $1 ORDER BY id ASC`, [shopId],
  );
  return rowsOf(res).map((q) => ({ ...q, candidates: Array.isArray(q.candidates) ? q.candidates : asArray(q.candidates) }));
}

function asArray(value) {
  if (Array.isArray(value)) return value;
  if (typeof value === 'string') {
    try { const p = JSON.parse(value); return Array.isArray(p) ? p : []; } catch { return []; }
  }
  return [];
}

/** The most recent browser build request for a shop, live or finished. */
export async function findBrowserRequest(deps, shopId) {
  const res = await deps.readQuery(
    `SELECT id, shop_id, status, claimed_by, progress, last_error, requested_at, claimed_at, finished_at
       FROM asdair.browser_build_request WHERE shop_id = $1 ORDER BY id DESC LIMIT 1`, [shopId],
  );
  return rowsOf(res)[0] || null;
}

/**
 * The state a FAILED shop must resume to.
 *
 * Read from the durable failure event, never asserted by a caller and never
 * inferred - shopState refuses FAILED -> anything without it, precisely so a
 * caller cannot smuggle a shop back into a stage it never reached.
 */
export async function findResumeFrom(deps, shopId) {
  const res = await deps.readQuery(
    `SELECT from_status FROM asdair.shop_event
      WHERE shop_id = $1 AND event_type = 'failure' ORDER BY id DESC LIMIT 1`, [shopId],
  );
  return rowsOf(res)[0]?.from_status || null;
}

/** The list rows behind a shop, in the shape planner.js reads. */
export async function listListItems(deps, listId) {
  if (listId === null || listId === undefined) return [];
  const res = await deps.readQuery(
    `SELECT id, item_name, matched_product_id, requested_qty, status, price, note, one_week_only
       FROM asdair.shopping_list_items WHERE list_id = $1 ORDER BY id`, [listId],
  );
  return rowsOf(res).map((r) => ({ ...r, alternatives: [] }));
}

// ---------------------------------------------------------------------
// The command ledger
// ---------------------------------------------------------------------

function toCommandRecord(row) {
  return {
    id: row.id,
    command: commandNameOf(row.action_type),
    key: row.action_key,
    status: row.status,
    payload: asObject(row.payload),
    shop_id: row.shop_id,
    household_id: row.household_id,
    created_at: row.created_at,
  };
}

/** Every OUTSTANDING command for a shop, oldest first. */
export async function listPendingCommands(deps, shopId) {
  const res = await deps.readQuery(
    `SELECT id, household_id, shop_id, action_type, action_key, payload, status, note, created_at
       FROM asdair.pending_action
      WHERE shop_id = $1 AND status = 'pending' AND action_type LIKE $2
      ORDER BY id ASC`, [shopId, `${COMMAND_PREFIX}%`],
  );
  return rowsOf(res).map(toCommandRecord);
}

/**
 * The names of every command EVER issued for a shop, pending or resolved.
 *
 * This is what a LATCH gate reads (see stages.everIssued): "a human approved
 * this interpretation" must stay true after the runner consumes the command.
 */
export async function listIssuedCommandNames(deps, shopId) {
  const res = await deps.readQuery(
    `SELECT DISTINCT action_type FROM asdair.pending_action
      WHERE shop_id = $1 AND action_type LIKE $2`, [shopId, `${COMMAND_PREFIX}%`],
  );
  return rowsOf(res).map((r) => commandNameOf(r.action_type)).filter(Boolean);
}

/**
 * Record a command durably. IDEMPOTENT BY CONSTRUCTION.
 *
 * shopStore.addPendingAction is INSERT ... ON CONFLICT DO NOTHING plus a
 * re-select, so a repeated tap of the same button while the command is still
 * outstanding ADOPTS the existing row - it does not stack a second one, and the
 * caller is told which happened (`created` / `resumed`).
 */
export async function recordCommand(deps, { householdId, shopId, command, key, payload }) {
  const res = await deps.shopStore.addPendingAction({
    household_id: householdId,
    shop_id: shopId,
    action_type: commandActionType(command),
    action_key: key,
    payload: payload || {},
  });
  return { id: res.action.id, created: res.created, resumed: res.resumed, row: res.action };
}

/** Mark a command done (or abandoned). Only a PENDING row can be resolved, so
 *  the record of how it ended is written exactly once. */
export async function resolveCommand(deps, actionId, status = 'done', note = null) {
  return deps.shopStore.resolvePendingAction(actionId, { status, note });
}

// ---------------------------------------------------------------------
// The outbox
// ---------------------------------------------------------------------

/**
 * Queue one outbound Telegram message durably.
 *
 * WHY AN OUTBOX AT ALL: a message that is sent inside the step that computed it
 * is lost if the process dies between the two, and sent TWICE if the step is
 * retried. Queuing it under a key derived from the MILESTONE (not the moment)
 * makes both impossible: the same milestone can only ever have one unsent row,
 * and the row survives a restart.
 */
export async function enqueueMessage(deps, { householdId, shopId, kind, key, payload }) {
  const res = await deps.shopStore.addPendingAction({
    household_id: householdId,
    shop_id: shopId,
    action_type: outboxActionType(kind),
    action_key: key,
    payload: payload || {},
  });
  return { id: res.action.id, created: res.created, resumed: res.resumed, row: res.action };
}

/** Every unsent message, oldest first. */
export async function listOutbox(deps, { shopId = null } = {}) {
  const sql = shopId === null
    ? `SELECT id, household_id, shop_id, action_type, action_key, payload, status, created_at
         FROM asdair.pending_action WHERE status = 'pending' AND action_type LIKE $1 ORDER BY id ASC`
    : `SELECT id, household_id, shop_id, action_type, action_key, payload, status, created_at
         FROM asdair.pending_action WHERE status = 'pending' AND action_type LIKE $1 AND shop_id = $2 ORDER BY id ASC`;
  const params = shopId === null ? [`${OUTBOX_PREFIX}%`] : [`${OUTBOX_PREFIX}%`, shopId];
  const res = await deps.readQuery(sql, params);
  return rowsOf(res).map((row) => ({
    id: row.id,
    kind: String(row.action_type).slice(OUTBOX_PREFIX.length),
    key: row.action_key,
    payload: asObject(row.payload),
    shop_id: row.shop_id,
    household_id: row.household_id,
  }));
}

/**
 * The household's GENUINE outstanding actions - pipeline plumbing filtered out.
 *
 * Exposed so the cockpit and the status card can show Warwick the things that
 * really must not be forgotten ("add Wall's to ASDA Favourites") without
 * drowning them in the pipeline's own command and outbox rows.
 */
export async function listHouseholdActions(deps, householdId) {
  const res = await deps.readQuery(
    `SELECT id, household_id, shop_id, action_type, action_key, payload, note, created_at
       FROM asdair.pending_action WHERE household_id = $1 AND status = 'pending' ORDER BY id ASC`,
    [householdId],
  );
  return rowsOf(res).filter((r) => !isPipelineActionType(r.action_type));
}

// ---------------------------------------------------------------------
// The snapshot
// ---------------------------------------------------------------------

/**
 * Everything stages.decideNextStep needs, read from durable state.
 *
 * ONE snapshot per advance. The step is chosen from what the database said,
 * never from what this process remembers - which is the whole resumability
 * contract in one sentence.
 */
export async function readSnapshot(deps, handle) {
  const shop = await requireShop(deps, handle);
  const [openQuestions, pending, issued, browser] = await Promise.all([
    countOpenQuestions(deps, shop.id),
    listPendingCommands(deps, shop.id),
    listIssuedCommandNames(deps, shop.id),
    findBrowserRequest(deps, shop.id),
  ]);
  const resumeFrom = shop.status === 'FAILED' ? await findResumeFrom(deps, shop.id) : null;
  return {
    shop,
    openQuestions,
    pendingCommands: pending,
    issuedCommands: issued,
    browser: browser ? { id: browser.id, status: browser.status, progress: browser.progress } : null,
    browserIsLive: !!browser && LIVE_BROWSER_STATUSES.includes(browser.status),
    resumeFrom,
  };
}

// ---------------------------------------------------------------------
// The one write this module performs that shopStore's public API cannot
// ---------------------------------------------------------------------

/**
 * Advance a shop AND bind its list_id, in one transaction, with the audit event.
 *
 * ── COMPONENT GAP, STATED OUT LOUD ─────────────────────────────────────────
 * shopStore's public `transition(shopId, toStatus, description)` sets `status`
 * and nothing else, and there is no other exported writer for
 * `asdair.shop.list_id`. But the moment a shop's list rows exist is exactly the
 * moment it leaves interpretation - and a shop with no list_id makes
 * shopStatus report NULL line counts, i.e. "unknown", forever.
 *
 * Rather than emit an UPDATE of our own (which would break the module's stated
 * guarantee that applyTransition is the ONLY writer of asdair.shop.status), this
 * uses shopStore's own exported `_internal.applyTransition` inside its own
 * exported `_internal.inTransaction`. That keeps every guarantee intact:
 *   * the status change and its shop_event are still written together;
 *   * the SET clause is still built from shopStore's column allowlist, so
 *     household_id, shop_ref, source_kind and the raw_* evidence remain
 *     unreachable;
 *   * the UPDATE still carries `AND status = <expected>`, so a concurrent
 *     advance loses the race and rolls back instead of overwriting.
 *
 * The right long-term fix is a `list_id` parameter on the public `transition`,
 * which belongs to the shop work package, not to this one.
 */
export async function advanceWithList(deps, { shopId, fromStatus, toStatus, listId, description }) {
  const shopStore = deps.shopStore;
  const { inTransaction, applyTransition } = shopStore._internal;
  return inTransaction({}, async (client) => {
    const set = { status: toStatus };
    if (listId !== null && listId !== undefined) set.list_id = listId;
    const applied = await applyTransition(client, {
      shop_id: shopId,
      from_status: fromStatus,
      to_status: toStatus,
      set,
      event: {
        event_type: 'transition',
        from_status: fromStatus,
        to_status: toStatus,
        description: description || `${fromStatus} -> ${toStatus}`,
      },
    });
    return { shop: applied.shop, changed: true, event: applied.event };
  });
}
