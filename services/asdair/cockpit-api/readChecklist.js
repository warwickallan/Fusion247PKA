// =====================================================================
// AsdAIr cockpit-api/readChecklist.js - THE PAGE WARWICK ACTUALLY SHOPS FROM.
//
// WHY THIS EXISTS. `handoff/renderChecklist.js` renders the browser handoff as
// a phone-readable Markdown checklist carrying the lines, the method and the
// prohibitions. It was complete, tested, and had ZERO production callers - so
// the checklist a human would work from was never rendered anywhere, by
// anything. Warwick was told his shop was ready and handed a packet fingerprint
// and some counts.
//
// That is the same defect class this build has now paid for four times
// (sendQuestionCard, verifyBasket, the prose rulebook, and this): a correct,
// tested producer that nothing calls. This module is the call site.
//
// ── IT RENDERS WHAT WAS STORED. IT NEVER REBUILDS. ─────────────────────────
// The artefact is written once, at handover, by `handoff/claim.js openHandoff`,
// bound to the packet fingerprint the request carries. This module reads that
// row and renders it. It does NOT recompute the plan, and must not: since
// WP-B15-3 every recomputation consults a model, so a rebuild here could
// legitimately produce a different basket from the one the handover recorded -
// and Warwick would shop from a list that no longer matches the fingerprint he
// is asked to quote back. It would also put a model call on a page view.
//
// ── NO SECOND RENDERER ──────────────────────────────────────────────────────
// The Markdown is produced by `handoff/renderChecklist.js` and by nothing else.
// A competing renderer in this folder would be free to drift from the artefact,
// which is exactly the failure the single-renderer rule exists to prevent. This
// module reads a row, decides which state it is in, and delegates.
//
// ── FIRST-CLASS STATES, because "no checklist" has several honest meanings ──
//   not_handed_over  - no browser build request for this shop. The shop has not
//                      reached the browser step, which is normal, not an error.
//   artefact_absent  - a request exists but carries no renderable artefact.
//                      This is the pre-2026-08-10 receipt-only shape: those rows
//                      were opened before the artefact was stored. Said plainly,
//                      never rendered as an empty shopping list.
//   ready            - the checklist, rendered.
// A shop that has not been handed over and a shop whose artefact is missing are
// DIFFERENT facts, and collapsing them would tell Warwick "nothing to shop"
// when the truth is "something went wrong at handover".
//
// SAME CONSTRUCTION RULES AS ITS SIBLINGS: connection from ASDAIR_DB_URL (the
// SELECT-only asdair_ro role), one `BEGIN TRANSACTION READ ONLY`, every
// statement begins with SELECT, and ALL_SQL is exported so that is TESTABLE
// rather than merely asserted in this comment.
//
// PURE ASCII.
// =====================================================================

'use strict';

const { renderChecklist } = require('../handoff/renderChecklist');

// ---------------------------------------------------------------------
// SQL. All SELECT. All parameterised.
// ---------------------------------------------------------------------

// The most recent request for the shop, whatever its status. Deliberately NOT
// restricted to live statuses: a checklist stays readable while the shop is
// being shopped and after it completes, which is when someone is most likely to
// go back and check what they were asked to buy.
//
// `shop` is an asdair.shop.id OR a shop_ref, exactly as readWorkspace accepts -
// so the link on Warwick's phone can carry "SHOP-2026-08-09", which is the only
// identifier he has ever seen. Compared as text on both sides so a ref can never
// be coerced to an integer and fail the whole statement.
const REQUEST_SQL =
  'SELECT r.id, r.shop_id, r.status, r.claimed_by, r.progress, ' +
  'r.requested_at, r.claimed_at, r.finished_at ' +
  'FROM asdair.browser_build_request r ' +
  'JOIN asdair.shop s ON s.id = r.shop_id ' +
  'WHERE s.shop_ref = $1::text OR s.id::text = $1::text ' +
  'ORDER BY r.id DESC LIMIT 1';

const ALL_SQL = Object.freeze([REQUEST_SQL]);

/**
 * Is this stored block a renderable artefact, or the old receipt-only shape?
 *
 * renderChecklist reads lines, method, prohibited_actions, completion_contract
 * and reconciliation_contract. A block carrying only a fingerprint and counts
 * would throw inside the renderer on a property access, which would surface to
 * Warwick as a 500 rather than as the honest "this request predates the stored
 * artefact". So the shape is established BEFORE the renderer is called.
 */
function isRenderable(handoff) {
  return !!handoff
    && typeof handoff === 'object'
    && Array.isArray(handoff.lines)
    && Array.isArray(handoff.method)
    && Array.isArray(handoff.prohibited_actions);
}

function present(row) {
  if (!row) {
    return {
      state: 'not_handed_over',
      markdown: null,
      message: 'This shop has not been handed over to the browser step yet, so there is no checklist to shop from.',
      shop_ref: null,
      packet_fingerprint: null,
      request_status: null,
    };
  }

  const handoff = (row.progress && row.progress.handoff) || null;
  if (!isRenderable(handoff)) {
    return {
      state: 'artefact_absent',
      markdown: null,
      // Named precisely, because the recovery differs: this is not "nothing to
      // do", it is "the handover recorded no artefact and the shop needs to be
      // handed over again".
      message: 'A browser build request exists for this shop but carries no checklist artefact. '
        + 'Requests opened before 2026-08-10 stored only a receipt. Re-open the handover to get a checklist.',
      shop_ref: handoff && handoff.shop_ref ? String(handoff.shop_ref) : null,
      packet_fingerprint: handoff && handoff.packet_fingerprint ? String(handoff.packet_fingerprint) : null,
      request_status: row.status === undefined || row.status === null ? null : String(row.status),
    };
  }

  return {
    state: 'ready',
    // THE ONE RENDERER. Not a copy of it, not a variant of it.
    markdown: renderChecklist(handoff),
    message: null,
    shop_ref: handoff.shop_ref ? String(handoff.shop_ref) : null,
    packet_fingerprint: handoff.packet_fingerprint ? String(handoff.packet_fingerprint) : null,
    request_status: row.status === undefined || row.status === null ? null : String(row.status),
    // Counts a caller can show beside the link without parsing the Markdown.
    lines_count: handoff.lines.length,
    held_count: Array.isArray(handoff.held) ? handoff.held.length : 0,
  };
}

let getPool = null;

async function gather(client, shopId) {
  const res = await client.query(REQUEST_SQL, [shopId]);
  return present((res && res.rows && res.rows[0]) || null);
}

/**
 * @param {{shop?: string|number, client?: object}} [options]
 */
async function readChecklist(options) {
  const opts = options || {};
  const shopId = opts.shop === undefined || opts.shop === null ? null : opts.shop;
  if (shopId === null || String(shopId).trim() === '') {
    return { ok: false, error: 'no_shop', message: 'A shop must be named to read its checklist.' };
  }

  const injected = opts.client || null;
  let client = injected;
  let pool = null;
  if (!client) {
    // Same lazy handle as readWorkspace and readPacket: the driver and the env
    // var are only required when a real read happens, so tests need neither.
    if (!getPool) getPool = require('./readWorkspace')._internal.getPool;
    pool = getPool();
    client = await pool.connect();
  }
  try {
    // An injected client is used AS-IS - the caller owns its transaction.
    if (!injected) await client.query('BEGIN TRANSACTION READ ONLY');
    const body = await gather(client, shopId);
    if (!injected) await client.query('COMMIT');
    return Object.assign({ ok: true, generated_from: 'durable state only' }, body);
  } catch (err) {
    if (!injected) { try { await client.query('ROLLBACK'); } catch (ignore) { /* the read is over */ } }
    throw err;
  } finally {
    if (!injected && client && client.release) client.release();
  }
}

module.exports = {
  readChecklist: readChecklist,
  ALL_SQL: ALL_SQL,
  _internal: {
    present: present,
    isRenderable: isRenderable,
    gather: gather,
    REQUEST_SQL: REQUEST_SQL,
  },
};
