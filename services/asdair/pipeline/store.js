// =====================================================================
// BUILD-015 AsdAIr Stage 1 - pipeline/store.js
//
// THE DURABLE-STATE SEAM. Every fact the pipeline acts on is read here, from
// Postgres, in one place - and every write goes through the component that
// already owns the table (services/asdair/shop/shopStore.js above all).
//
// ── THE MACHINE LEDGER IS NOT THE HUMAN'S TO-DO LIST ────────────────────────
// Until migration 009 this module kept the pipeline's command, resume and
// outbox bookkeeping in `asdair.pending_action`, namespaced `cmd:` / `msg:`.
// That table is what the Cockpit and the Telegram status card surface as
// OUTSTANDING ACTIONS - so machine plumbing appeared as things WARWICK had to
// do. Filtering it in the UI was explicitly rejected: it hides the symptom and
// leaves the confusion in the data. Migration 009 gives the two concepts two
// homes and this module now honours that split:
//
//     asdair.pipeline_command   the MACHINE ledger. Commands, resume state and
//                               the outbox. Written here, read here, shown to
//                               nobody as a to-do.
//     asdair.pending_action     GENUINE HUMAN ACTIONS ONLY ("add Wall's to ASDA
//                               Favourites"). This module READS it in exactly
//                               one place (listHouseholdActions) and WRITES it
//                               NOWHERE. There is no code path left that can.
//
// ── WHERE THE IDEMPOTENCY NOW LIVES ─────────────────────────────────────────
//     pipeline_command_idem_uniq  UNIQUE (idempotency_key)
//
// "Record this command; if the same command is already outstanding, adopt it
// instead of stacking a duplicate" is still one INSERT ... ON CONFLICT DO
// NOTHING decided by the DATABASE. What changed is the shape of the index:
// migration 006's was PARTIAL (unique only WHILE PENDING), migration 009's is
// TOTAL. `recordLedgerEntry` below restores the half that difference would
// otherwise have destroyed - see the argument there, it is the single most
// important comment in this file.
//
// ── READ/WRITE SPLIT ────────────────────────────────────────────────────────
// Reads go through the injected `readQuery` (the SELECT-only asdair_ro role,
// ASDAIR_DB_URL). Writes go through the injected `shopStore` (asdair_rw) or,
// for the ledger table shopStore does not own, the injected `writeQuery` -
// exactly as shopLines.js already does for asdair.shop_line (migration 008).
// Migration 009 grants asdair_rw SELECT/INSERT/UPDATE on pipeline_command and
// asdair_ro SELECT; there is no DELETE anywhere in this file. Neither
// connection string appears here, is logged, or is read from any credentials
// file - env var NAMES only, and the naming lives in deps.js.
// =====================================================================

import {
  LEDGER_KINDS,
  LEDGER_TERMINAL_STATUSES,
  isPipelineActionType,
  ledgerFamilyKey,
  ledgerIdempotencyKey,
} from './keys.js';
import { COMMAND_NAMES, COMMAND_SPECS, CONSUMPTION } from './commandNames.js';

/** The command names a runner is expected to CONSUME. Derived from the command
 *  specs so the two can never drift. */
export const CONSUMABLE_COMMANDS = Object.freeze(
  COMMAND_NAMES
    .filter((n) => COMMAND_SPECS[n].durable && COMMAND_SPECS[n].consumption === CONSUMPTION.CONSUME),
);

const LIVE_BROWSER_STATUSES = ['queued', 'claimed', 'running'];

const SHOP_COLUMNS =
  'id, household_id, shop_ref, status, source_kind, telegram_chat_id, telegram_message_id, ' +
  'telegram_update_id, raw_text, raw_media_path, transcript, needs_review, list_id, last_error, ' +
  'created_at, updated_at';

/** Every column of asdair.pipeline_command this module reads back. Named
 *  explicitly (never `*`) so a column added by a later migration cannot change
 *  the shape of a record without somebody deciding it should. */
export const LEDGER_COLUMNS =
  'id, shop_id, kind, command, args, idempotency_key, status, attempts, last_error, result, ' +
  'created_at, updated_at';

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
 *      the runner never visits - and it sits "pending" in the machine ledger
 *      forever, one more for every tap, quietly holding that generation of the
 *      command open so the next legitimate issue of it can never be minted. The
 *      runner retires it with a reason (runPipeline.abandonOutstanding) and the
 *      shop then drops out of this query for good.
 *
 * LATCH commands are deliberately NOT in the second clause. They are permanent
 * facts about the week ("this is where it came from", "a human approved this")
 * and stay pending by design, so including them would make every finished shop
 * reappear on every pass, forever.
 */
export async function listActiveShops(deps, consumableCommands = []) {
  const res = await deps.readQuery(
    `SELECT ${SHOP_COLUMNS} FROM asdair.shop
      WHERE status NOT IN ('RECONCILED','CANCELLED')
         OR id IN (SELECT shop_id FROM asdair.pipeline_command
                    WHERE status = 'pending' AND kind = 'command' AND shop_id IS NOT NULL
                      AND command = ANY($1))
      ORDER BY id ASC`, [consumableCommands],
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

/**
 * Every question on a shop, in the order it was asked.
 *
 * ── WHY THE FOUR RENDER-CONTRACT COLUMNS ARE SELECTED ───────────────────────
 * Migration 009 added rendered_candidates / render_fingerprint / render_version
 * / callback_index to asdair.shop_question. This function did not select them,
 * so every pipeline-side consumer of the render contract silently received
 * `undefined` - not an error, not an empty value, just a shape that quietly
 * disagreed with the table. A Telegram button carries a candidate INDEX, and an
 * index is only meaningful against the exact list that was DISPLAYED; reading
 * that list as `undefined` is how a stale tap stops being detectable. Selecting
 * them is not an enhancement, it is the column list catching up with the table.
 *
 * ── WHY THE TWO JOINS ───────────────────────────────────────────────────────
 * `asdair.shop_question` has no column for the item a question is ABOUT, and
 * `question_text` is a whole sentence ("Which product is \"dreamies cheese\"?").
 * Consumers were rendering that sentence into the card's `Item:` field, which is
 * why the card read `Item: Which product is "dreamies cheese"?`. Parsing the
 * name back out of the sentence is brittle and would break the moment the
 * wording changed, so the name TRAVELS instead:
 *
 *   shop_question.list_item_id -> shopping_list_items.item_name   `item_name`
 *                              -> shop_line.raw_reading           `photographed_wording`
 *
 * Both are LEFT joins: a question opened before this carrier existed, or one
 * whose list item has since gone, still returns its row with these two fields
 * null rather than vanishing from the list. A missing name must degrade the
 * card, never lose the question.
 *
 * `photographed_wording` is what was actually written on the page. It is the
 * highest-value single field in the learning loop - it becomes the alias that
 * stops next week's question - and it is a fact of the interpretation, so it is
 * read from asdair.shop_line rather than reconstructed by anybody downstream.
 *
 * `question_round`, `parent_question_id` and `answered_at` (WO-2026-08-18-04)
 * are migration 017 columns this projection did not carry. The correction path
 * needs the round to derive the successor's, the parent to build the chain, and
 * `answered_at` because AC2's audit trail is "the ORIGINAL text AND when it was
 * given" - a trail that cannot say WHEN is not an audit trail.
 */
export async function listQuestions(deps, shopId) {
  const res = await deps.readQuery(
    `SELECT q.id, q.list_item_id, q.question_key, q.question_text, q.candidates, q.status,
            q.answer_text, q.answer_source, q.card_chat_id, q.card_message_id,
            q.rendered_candidates, q.render_fingerprint, q.render_version, q.callback_index,
            q.question_round, q.parent_question_id, q.answered_at,
            li.item_name AS item_name,
            sl.raw_reading AS photographed_wording
       FROM asdair.shop_question q
       LEFT JOIN asdair.shopping_list_items li ON li.id = q.list_item_id
       LEFT JOIN asdair.shop_line sl ON sl.list_item_id = q.list_item_id AND sl.shop_id = q.shop_id
      WHERE q.shop_id = $1 ORDER BY q.id ASC`, [shopId],
  );
  return rowsOf(res).map((q) => ({
    ...q,
    candidates: Array.isArray(q.candidates) ? q.candidates : asArray(q.candidates),
    rendered_candidates: Array.isArray(q.rendered_candidates)
      ? q.rendered_candidates : asArray(q.rendered_candidates),
  }));
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

// =====================================================================
// THE MACHINE LEDGER - asdair.pipeline_command
//
// One table, two populations (`kind`): the COMMAND ledger and the OUTBOX. They
// share a table because they share every mechanic - a deterministic key, an
// idempotent insert, a guarded resolution, durable survival of a restart - and
// splitting them would mean two copies of the argument below.
//
// NOTHING HERE TOUCHES asdair.pending_action. That is the whole point.
// =====================================================================

/** The statuses from which a ledger row can still be acted on. `running` is
 *  reserved by migration 009's CHECK for a future claiming runner; no code
 *  writes it today, and it is treated as LIVE wherever it could appear so that
 *  introducing it later cannot silently duplicate work. */
const LEDGER_LIVE_STATUSES = ['pending', 'running'];

/**
 * How a resolution reaching this module maps onto migration 009's status CHECK.
 *
 * `abandoned` was migration 006's vocabulary and is still what runPipeline and
 * runtime say when they give up on a row. It means RETIRED here - the same
 * fact, the spelling the live CHECK constraint accepts.
 */
const RESOLUTION_STATUS = Object.freeze({
  done: 'done',
  abandoned: 'retired',
  retired: 'retired',
  failed: 'failed',
});

const INSERT_LEDGER_SQL =
  `INSERT INTO asdair.pipeline_command (shop_id, kind, command, args, idempotency_key, status)
   VALUES ($1, $2, $3, $4::jsonb, $5, 'pending')
   ON CONFLICT (idempotency_key) DO NOTHING
   RETURNING ${LEDGER_COLUMNS}`;

const SELECT_LEDGER_BY_IDEMPOTENCY_KEY_SQL =
  `SELECT ${LEDGER_COLUMNS} FROM asdair.pipeline_command WHERE idempotency_key = $1`;

/** How many generations of this family are SPENT. See recordLedgerEntry. */
const COUNT_SPENT_GENERATIONS_SQL =
  `SELECT count(*)::int AS n FROM asdair.pipeline_command
    WHERE args->>'ledger_key' = $1 AND status = ANY($2)`;

/**
 * The number of times recordLedgerEntry will re-derive a generation before
 * giving up.
 *
 * It only ever loops when the generation it computed was resolved by another
 * process between the count and the insert - i.e. once per interleaved
 * resolution. A handful is far more than a single-runner deployment can
 * produce, and a bound is what stops a pathological loop becoming a hang.
 */
const MAX_GENERATION_PROBES = 8;

function toLedgerRow(row) {
  const args = asObject(row.args);
  return {
    id: row.id,
    shop_id: row.shop_id,
    kind: row.kind,
    command: row.command,
    // The ACTION key, unchanged from what migration 006 called `action_key`.
    // NOT the family key: `stepApplyCorrections` derives an `add_list_item`
    // idempotency key from this (`<key>:correction`), so changing what it means
    // would change an idempotency key downstream of this table, in a component
    // this work package does not own.
    key: args.ledger_action_key ?? null,
    args,
    idempotency_key: row.idempotency_key,
    status: row.status,
    attempts: row.attempts,
    last_error: row.last_error,
    result: asObject(row.result),
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

/** The shape stages.js reads. `payload` is kept as the field name so the pure
 *  stage table, which never knew which table it came from, is unchanged. */
function toCommandRecord(row) {
  const r = toLedgerRow(row);
  return {
    id: r.id,
    command: r.command,
    key: r.key,
    status: r.status,
    payload: r.args,
    shop_id: r.shop_id,
    household_id: r.args.household_id ?? null,
    created_at: r.created_at,
    idempotency_key: r.idempotency_key,
  };
}

/**
 * Record ONE unit of machine bookkeeping durably. IDEMPOTENT BY CONSTRUCTION.
 *
 * ── THE ARGUMENT, IN FULL, BECAUSE THE GUARANTEE DEPENDS ON IT ──────────────
 * Migration 006's index was PARTIAL: unique on (household_id, action_type,
 * action_key) WHERE status = 'pending'. Two behaviours fell out of that shape,
 * and BOTH are load-bearing:
 *
 *   A. A repeat WHILE THE COMMAND IS OUTSTANDING adopts the existing row. That
 *      is what makes a double-tapped Telegram button a no-op.
 *   B. A repeat AFTER the command has been consumed starts a NEW one. That is
 *      the CONSUME contract in commandNames.js - "ask for the basket again
 *      after a pause", "retry a shop that failed twice", "correct the same line
 *      a second time". Without it those requests would be silently swallowed.
 *
 * Migration 009's index is TOTAL - UNIQUE (idempotency_key), no predicate. A
 * naive port that reused the old key would keep (A) and DESTROY (B): the second
 * request would collide with the finished row and be adopted as a duplicate.
 * That is not a cosmetic difference; it is a shopper tapping "Build ASDA
 * basket" after a pause and nothing ever happening.
 *
 * So the key carries a GENERATION, and the generation is DERIVED FROM DURABLE
 * STATE - the number of rows in this family that are already terminal - never
 * from a counter, a clock or a random value:
 *
 *   * While the current generation is live, every repeat computes the SAME
 *     spent-count, therefore the SAME key, and the UNIQUE INDEX refuses the
 *     second insert. The DATABASE decides the duplicate, exactly as before -
 *     this code does not check first and insert second.
 *   * Once that generation is resolved, the spent-count has moved on, so the
 *     next request mints the next generation and is a genuinely new unit of
 *     work.
 *
 * The one remaining window is a generation being created AND resolved between
 * our count and our insert, which would leave us adopting a finished row. It is
 * closed rather than documented away: if the row we adopt is terminal, the
 * generation we picked is stale, so we re-derive and try again (bounded by
 * MAX_GENERATION_PROBES). The function therefore NEVER returns a terminal row
 * as if it were a live one.
 *
 * @returns {{id:*, created:boolean, resumed:boolean, row:object}}
 */
export async function recordLedgerEntry(deps, { kind, householdId, shopId, name, key, payload }) {
  const family = ledgerFamilyKey({ kind, householdId, name, key });
  // `ledger_key` is written onto the row, not merely encoded in the idempotency
  // key, so "which family is this row in" is a column read rather than a string
  // parse - and so the generation count is one exact equality. The three
  // reserved names are namespaced `ledger_*` so a command payload cannot
  // collide with them.
  const args = {
    ...(payload || {}),
    ledger_key: family,
    ledger_action_key: String(key),
    household_id: householdId,
  };

  for (let probe = 0; probe < MAX_GENERATION_PROBES; probe += 1) {
    const spent = await spentLedgerGenerations(deps, family);
    const idempotencyKey = ledgerIdempotencyKey(family, spent);

    const inserted = rowsOf(await deps.writeQuery(INSERT_LEDGER_SQL, [
      shopId ?? null, kind, name, JSON.stringify(args), idempotencyKey,
    ]))[0];
    if (inserted) {
      const row = toLedgerRow(inserted);
      return { id: row.id, created: true, resumed: false, row };
    }

    // The UNIQUE index refused us. Somebody else owns this generation.
    const existing = rowsOf(await deps.readQuery(SELECT_LEDGER_BY_IDEMPOTENCY_KEY_SQL, [idempotencyKey]))[0];
    if (!existing) {
      throw new Error(`store: the ledger insert wrote nothing and no row carries idempotency_key "${idempotencyKey}". Nothing was written.`);
    }
    if (!LEDGER_TERMINAL_STATUSES.includes(existing.status)) {
      const row = toLedgerRow(existing);
      return { id: row.id, created: false, resumed: true, row };
    }
    // Stale generation: it was resolved between the count and the insert. Never
    // hand a caller a finished row as though its request had been adopted.
  }

  throw new Error(`store: could not settle a ledger generation for "${family}" after ${MAX_GENERATION_PROBES} attempts. Nothing was written.`);
}

/**
 * How many generations of one ledger family are SPENT - i.e. can never be acted
 * on again. THE definition of "which generation comes next", exported so
 * migrate-command-ledger.js derives it from the same place the runtime does. If
 * the two ever disagreed, the backfill would write keys the runtime could not
 * recognise, and a carried-over pending command would be silently duplicated
 * the next time Warwick tapped the button.
 */
export async function spentLedgerGenerations(deps, family) {
  const res = await deps.readQuery(COUNT_SPENT_GENERATIONS_SQL, [family, [...LEDGER_TERMINAL_STATUSES]]);
  return Number(rowsOf(res)[0]?.n) || 0;
}

/**
 * ONE EXACT GENERATION of a ledger family, whatever its status. (WP-B15-09)
 *
 * ── WHY THIS IS A READ AND NOT A NEW TABLE ──────────────────────────────────
 * The board card is rewritten IN PLACE every time Warwick answers something, so
 * the next pass has to know where the last one landed. That is one durable fact
 * per shop - a chat id and a message id - and there was a real temptation to add
 * a column for it. There is no need: `recordLedgerEntry` already derives a
 * deterministic idempotency key from (family, generation), and `result` is
 * already a jsonb column on the row. So the PREVIOUS generation is addressable
 * by arithmetic, and what happened to it is already recorded on it.
 *
 * NO MIGRATION, and deliberately so - this reuses SELECT_LEDGER_BY_IDEMPOTENCY_KEY_SQL
 * verbatim rather than introducing a second statement that reads the same row a
 * slightly different way.
 *
 * `generation` below 0 returns null rather than throwing: "there is no previous
 * board" is the ordinary state of the first one, not an error.
 */
export async function findLedgerGeneration(deps, family, generation) {
  if (!Number.isInteger(generation) || generation < 0) return null;
  const res = await deps.readQuery(
    SELECT_LEDGER_BY_IDEMPOTENCY_KEY_SQL, [ledgerIdempotencyKey(family, generation)],
  );
  const row = rowsOf(res)[0];
  return row ? toLedgerRow(row) : null;
}

/** Every OUTSTANDING command for a shop, oldest first. */
export async function listPendingCommands(deps, shopId) {
  const res = await deps.readQuery(
    `SELECT ${LEDGER_COLUMNS} FROM asdair.pipeline_command
      WHERE shop_id = $1 AND kind = 'command' AND status = 'pending'
      ORDER BY id ASC`, [shopId],
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
    `SELECT DISTINCT command FROM asdair.pipeline_command
      WHERE shop_id = $1 AND kind = 'command'`, [shopId],
  );
  return rowsOf(res).map((r) => r.command).filter(Boolean);
}

/**
 * Record a command durably. A repeated tap of the same button while the command
 * is still outstanding ADOPTS the existing row - it does not stack a second one,
 * and the caller is told which happened (`created` / `resumed`).
 */
export async function recordCommand(deps, { householdId, shopId, command, key, payload }) {
  return recordLedgerEntry(deps, {
    kind: LEDGER_KINDS.COMMAND, householdId, shopId, name: command, key, payload,
  });
}

/**
 * Mark a ledger row done (or abandoned/failed). Only a LIVE row can be
 * resolved, so the record of how it ended is written exactly once - the same
 * guarantee migration 006's resolver gave, carried over verbatim in the
 * `AND status = ANY(<live>)` clause below.
 *
 * The reason is kept in `result.note` rather than overwriting `last_error`:
 * "consumed by act:interpret" is a receipt, not an error, and conflating the
 * two would make a healthy row look like a failed one in the ledger.
 */
export async function resolveCommand(deps, ledgerId, status = 'done', note = null, extra = null) {
  const mapped = RESOLUTION_STATUS[status];
  if (!mapped) {
    throw new Error(`store: resolveCommand status must be one of ${Object.keys(RESOLUTION_STATUS).join(', ')}, got "${String(status)}"`);
  }
  // `extra` is MERGED ALONGSIDE the note, never over it (WP-B15-09). The one
  // caller today is drainOutbox recording WHERE a card landed - the chat and
  // message id Telegram allocated - so a later pass can rewrite that exact
  // message instead of sending a second one. It rides on the existing jsonb
  // merge and needs no column: `result` is already selected by LEDGER_COLUMNS
  // and already parsed by toLedgerRow, so there is no migration behind this.
  //
  // Additive by construction: every existing caller passes four arguments or
  // fewer and gets byte-identical `result` shape.
  const result = JSON.stringify({
    ...(extra && typeof extra === 'object' && !Array.isArray(extra) ? extra : {}),
    note: note === undefined ? null : note,
    resolution: status,
  });
  const res = await deps.writeQuery(
    `UPDATE asdair.pipeline_command
        SET status = $1,
            result = coalesce(result, '{}'::jsonb) || $2::jsonb,
            last_error = CASE WHEN $1 = 'failed' THEN $3 ELSE last_error END,
            attempts = attempts + 1,
            updated_at = now()
      WHERE id = $4 AND status = ANY($5)
      RETURNING ${LEDGER_COLUMNS}`,
    [mapped, result, note === undefined ? null : note, ledgerId, [...LEDGER_LIVE_STATUSES]],
  );
  const row = rowsOf(res)[0];
  if (!row) {
    throw new Error(`store: pipeline_command ${String(ledgerId)} is not live (already resolved, or no such row). Nothing was written.`);
  }
  return { action: toLedgerRow(row), changed: true };
}

// ---------------------------------------------------------------------
// ONE-SHOT DURABLE MARKERS
//
// Both functions below want the SAME guarantee, and it is the opposite of the
// one recordLedgerEntry gives. recordLedgerEntry deliberately mints a NEW
// generation once the previous one is spent, because "ask for the basket again"
// must be a genuinely new unit of work. These two must fire ONCE, EVER:
//
//   * an interpretation happened at a moment - a second record of the same
//     model call would be a second claim that the model was asked, and this
//     evidence exists precisely so such a claim cannot be made falsely;
//   * promoteDecision writes a rule_qa_log row with NO idempotency key of its
//     own (recordAnswerLearning.js says so in terms), so learning the same
//     answer twice appends a duplicate decision to the audit log.
//
// So they insert against the TOTAL unique index directly, with a deterministic
// key and no generation. The DATABASE decides the duplicate - this code does not
// read first and write second. `created:false` means somebody already did it.
// ---------------------------------------------------------------------

/** A one-shot ledger row. Returns the row plus who won the race. */
async function insertOneShot(deps, { shopId, name, idempotencyKey, payload }) {
  const args = { ...(payload || {}), ledger_action_key: idempotencyKey };
  const inserted = rowsOf(await deps.writeQuery(INSERT_LEDGER_SQL, [
    shopId ?? null, LEDGER_KINDS.COMMAND, name, JSON.stringify(args), idempotencyKey,
  ]))[0];
  if (inserted) {
    const row = toLedgerRow(inserted);
    return { id: row.id, created: true, row, already: false };
  }
  const existing = rowsOf(await deps.readQuery(SELECT_LEDGER_BY_IDEMPOTENCY_KEY_SQL, [idempotencyKey]))[0];
  if (!existing) {
    throw new Error(`store: the one-shot insert for "${idempotencyKey}" wrote nothing and no row carries that key. Nothing was written.`);
  }
  const row = toLedgerRow(existing);
  return { id: row.id, created: false, row, already: LEDGER_TERMINAL_STATUSES.includes(existing.status) };
}

/** The command name every grounding-evidence row carries. */
export const GROUNDING_EVIDENCE = 'groundingEvidence';

/**
 * Record, per interpretation, WHAT GROUNDING WAS ACTUALLY SUPPLIED to the model.
 *
 * ── WHY THIS EXISTS (D-2026-08-03-04, and it cost a live shop) ──────────────
 * On 2026-08-03 a `--dry-run` that skipped the model call ENTIRELY was mistaken
 * for proof that the model path worked. The reason it could be mistaken is that
 * nothing downstream could tell the difference: a run that interpreted nothing
 * and a run that interpreted ten lines left the same trace.
 *
 * So the record is written FROM THE MODEL CALL'S OWN RETURN, after it returns.
 * Asserting that `loadCatalogue()` was called proves only that we prepared to
 * ask; `readings_returned` is a number that only exists if something answered.
 * A skipped call cannot produce this row, which is the whole point.
 *
 * ── SANITIZED: COUNTS AND IDS ONLY ─────────────────────────────────────────
 * NEVER a product name, never list content, never a raw reading, never the
 * photograph, never the prompt text. The prompt is measured in CHARACTERS, not
 * quoted. What is stored is the SHAPE of the grounding, which is what makes the
 * claim checkable, and none of the household's data, which is what keeps an
 * audit record from becoming a second copy of the shopping list.
 */
export async function recordGroundingEvidence(deps, {
  shopId, householdId, sourceKind, catalogueCandidates, promptChars, readingsReturned,
  lineNos = [], matchedRegularIds = [], imagePreparation = null,
}) {
  const num = (v) => (Number.isFinite(Number(v)) ? Number(v) : null);
  // ── THE PIXELS, ALONGSIDE THE GROUNDING (2026-08-17) ──────────────────────
  // The catalogue was supplied correctly on 17 August and the read was still
  // wrong, because the IMAGE carried about 34 pixels per handwritten line and
  // nothing recorded that. Dimensions and a scale factor only - it stays inside
  // the sanitisation rule above, since an image size is not household data.
  const prep = imagePreparation && typeof imagePreparation === 'object' ? {
    source_width: num(imagePreparation.source_width),
    source_height: num(imagePreparation.source_height),
    scale: num(imagePreparation.scale),
    width: num(imagePreparation.width),
    height: num(imagePreparation.height),
    prepared: imagePreparation.prepared === true,
    floor: num(imagePreparation.floor),
  } : null;
  return insertOneShot(deps, {
    shopId,
    name: GROUNDING_EVIDENCE,
    idempotencyKey: `grounding:${shopId}`,
    payload: {
      household_id: num(householdId),
      source_kind: String(sourceKind),
      // The grounding that was SUPPLIED.
      catalogue_candidates: num(catalogueCandidates),
      prompt_chars: num(promptChars),
      image_preparation: prep,
      // What came BACK. A skipped call cannot produce these.
      readings_returned: num(readingsReturned),
      line_nos: lineNos.map(num).filter((n) => n !== null),
      matched_regular_ids: matchedRegularIds.map(num).filter((n) => n !== null),
    },
  });
}

/** The command name every answer-learning marker carries. */
export const ANSWER_LEARNING = 'answerLearning';

/**
 * Claim the right to persist the learning for ONE answered question.
 *
 * `{ created: true }` - this caller owns it; do the learning, then resolve the
 * row. `{ already: true }` - a previous pass finished it; skip, and skip
 * silently, because a re-run of a resumable pipeline is normal and not an error.
 * `{ created: false, already: false }` - a previous pass claimed it and DIED
 * before resolving it. That is a resumable row, so this caller re-runs the
 * learning: recordAnswerLearning's own steps are re-runnable and its receipt
 * names which one failed, whereas leaving it unclaimed forever would silently
 * lose the answer - which is the defect this whole path exists to end.
 */
export async function claimAnswerLearning(deps, { shopId, householdId, questionKey }) {
  return insertOneShot(deps, {
    shopId,
    name: ANSWER_LEARNING,
    idempotencyKey: `learn:${shopId}:${questionKey}`,
    payload: { household_id: householdId ?? null, question_key: String(questionKey) },
  });
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
 *
 * A queued card is machine bookkeeping, not a household to-do, which is exactly
 * why it no longer lands in the list Warwick is shown.
 */
export async function enqueueMessage(deps, { householdId, shopId, kind, key, payload }) {
  return recordLedgerEntry(deps, {
    kind: LEDGER_KINDS.OUTBOX, householdId, shopId, name: kind, key, payload,
  });
}

/**
 * True when a message of this KIND has EVER been queued for a shop - pending
 * or already resolved, from this pass, a pass before it, or a pass that ran
 * before this very check existed.
 *
 * This is deliberately NOT "is one currently pending": a once-per-shop card
 * (the receipt) must never be asked twice, whether the earlier queue was sent
 * minutes ago, days ago, or predates the code that queues it - so the read
 * covers the FULL history of the outbox family, exactly the way
 * listIssuedCommandNames does for a LATCH command's "ever issued" gate above.
 */
export async function outboxEverQueued(deps, shopId, kind) {
  const res = await deps.readQuery(
    `SELECT 1 FROM asdair.pipeline_command
      WHERE shop_id = $1 AND kind = 'outbox' AND command = $2
      LIMIT 1`,
    [shopId, kind],
  );
  return rowsOf(res).length > 0;
}

/** Every unsent message, oldest first. */
export async function listOutbox(deps, { shopId = null } = {}) {
  const sql = shopId === null
    ? `SELECT ${LEDGER_COLUMNS} FROM asdair.pipeline_command
        WHERE status = 'pending' AND kind = 'outbox' ORDER BY id ASC`
    : `SELECT ${LEDGER_COLUMNS} FROM asdair.pipeline_command
        WHERE status = 'pending' AND kind = 'outbox' AND shop_id = $1 ORDER BY id ASC`;
  const res = await deps.readQuery(sql, shopId === null ? [] : [shopId]);
  return rowsOf(res).map((row) => {
    const r = toLedgerRow(row);
    return {
      id: r.id,
      kind: r.command,
      key: r.key,
      payload: r.args,
      shop_id: r.shop_id,
      household_id: r.args.household_id ?? null,
    };
  });
}

// ---------------------------------------------------------------------
// The exact-source image binding - asdair.shop_source_image (migration 016)
//
// WP-B15-1 invariant C. One row per shop, binding it to the immutable CONTENT
// of the photograph it was read from. Written once, at receive time, inside the
// same durability-before-ack boundary as the shop itself; read by the
// confirmation card so the human can see WHICH photograph produced the reading.
// The table grants no UPDATE and no DELETE to any role, so first-write-wins is
// structural, not a convention this module remembers.
// ---------------------------------------------------------------------

const SOURCE_IMAGE_COLUMNS = 'shop_id, fingerprint, algo, byte_length, captured_at';

/**
 * Bind one shop to its source image, once. IDEMPOTENT ON THE SHOP: the PRIMARY
 * KEY refuses a second row, so a Telegram redelivery (which RESUMES the shop)
 * adopts the original binding rather than overwriting it. `created:false` means
 * the binding already existed - normal on a redelivery, never an error.
 *
 * `capturedAt` is the receiver's own stamp carried through intake; the database
 * clock is only the fallback when no stamp travelled.
 */
export async function recordSourceImage(deps, { shopId, fingerprint, algo = 'sha256', byteLength = null, capturedAt = null }) {
  const res = await deps.writeQuery(
    `INSERT INTO asdair.shop_source_image (shop_id, fingerprint, algo, byte_length, captured_at)
     VALUES ($1, $2, $3, $4, coalesce($5::timestamptz, now()))
     ON CONFLICT (shop_id) DO NOTHING
     RETURNING ${SOURCE_IMAGE_COLUMNS}`,
    [shopId, fingerprint, algo, byteLength, capturedAt],
  );
  const row = rowsOf(res)[0] || null;
  return { created: !!row, row };
}

/** The stored image binding for one shop, or null. Null is an HONEST answer -
 *  a shop received before fingerprinting existed has no row, and the card says
 *  so rather than fabricating a value. */
export async function findSourceImage(deps, shopId) {
  const res = await deps.readQuery(
    `SELECT ${SOURCE_IMAGE_COLUMNS} FROM asdair.shop_source_image WHERE shop_id = $1`,
    [shopId],
  );
  return rowsOf(res)[0] || null;
}

/**
 * The household's most recent EARLIER photo shop, with its image binding where
 * one exists - what the confirmation card's human-readable prior-photograph
 * comparison is built from. LEFT JOIN: an old photo shop with no fingerprint
 * still anchors the comparison by its received time.
 *
 * Ordered by shop id, not by date: ids are assigned at receive time, so "the
 * previous photo shop" is well-defined even when two arrive on one day.
 */
export async function findPriorPhotoShop(deps, householdId, shopId) {
  const res = await deps.readQuery(
    `SELECT s.id, s.shop_ref, s.created_at, i.fingerprint, i.captured_at
       FROM asdair.shop s
       LEFT JOIN asdair.shop_source_image i ON i.shop_id = s.id
      WHERE s.household_id = $1 AND s.source_kind = 'photo' AND s.id < $2
      ORDER BY s.id DESC LIMIT 1`,
    [householdId, shopId],
  );
  return rowsOf(res)[0] || null;
}

// ---------------------------------------------------------------------
// The human's list - READ ONLY, and the only mention of pending_action left
// ---------------------------------------------------------------------

/**
 * The household's GENUINE outstanding actions.
 *
 * THE ONLY STATEMENT IN THIS MODULE THAT NAMES asdair.pending_action, and it is
 * a SELECT. Since migration 009 the pipeline writes its own bookkeeping to
 * asdair.pipeline_command, so everything this returns is a real thing a human
 * must do ("add Wall's to ASDA Favourites").
 *
 * The legacy `cmd:`/`msg:` filter is KEPT anyway, and deliberately: between
 * deploying this code and running migrate-command-ledger.js against live there
 * are still historical plumbing rows in the table, and showing Warwick a
 * `cmd:buildShop` from three weeks ago as an outstanding action is the exact
 * defect this work package exists to remove. After the backfill the filter
 * matches nothing - it is a belt, not the braces.
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
// The one write to a shopStore-owned table that its public API cannot express
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
export async function advanceWithList(deps, {
  shopId, fromStatus, toStatus, listId, description,
  transcriptProvider, transcriptModel, transcriptConfidence,
}) {
  const shopStore = deps.shopStore;
  const { inTransaction, applyTransition } = shopStore._internal;
  return inTransaction({}, async (client) => {
    const set = { status: toStatus };
    if (listId !== null && listId !== undefined) set.list_id = listId;
    // WP-B15-22 (Gate Zero) - provenance for a photo interpretation, in the
    // SAME transaction and the SAME row update as the TRANSCRIBING ->
    // PROCESSING transition it belongs to. Optional and additive: a text
    // shop (or any other caller of advanceWithList) that supplies none of
    // these three leaves the columns exactly as untouched as before.
    if (transcriptProvider !== null && transcriptProvider !== undefined) set.transcript_provider = transcriptProvider;
    if (transcriptModel !== null && transcriptModel !== undefined) set.transcript_model = transcriptModel;
    if (transcriptConfidence !== null && transcriptConfidence !== undefined) set.transcript_confidence = transcriptConfidence;
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
