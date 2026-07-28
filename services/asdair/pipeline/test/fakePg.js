// =====================================================================
// BUILD-015 AsdAIr Stage 1 - pipeline/test/fakePg.js
//
// AN IN-MEMORY STAND-IN FOR `pg`, GOOD ENOUGH TO RUN THE REAL COMPONENTS.
//
// WHY THIS AND NOT A SCRIPTED FAKE: services/asdair/shop/fakeClient.js is a
// SCRIPT - it proves statement ORDER and SHAPE, which is exactly right for
// unit-testing a writer. It cannot prove IDEMPOTENCY or RESUMABILITY, because
// those are properties of STATE: "the second insert wrote nothing" is only
// meaningful if the first one is still there.
//
// So this file implements the handful of tables migration 006 defines, WITH
// THEIR UNIQUE INDEXES, and answers the exact statements the real
// shopStore.js and pipeline/store.js emit. The tests then run the REAL
// shopStore code - not a re-implementation of it - and a duplicate is refused
// by the same mechanism that refuses it in Postgres.
//
// The indexes modelled, because they ARE the idempotency:
//   shop_ref_uniq              (household_id, shop_ref)
//   shop_inbound_uniq          (telegram_chat_id, telegram_message_id) partial
//   shop_question_key_uniq     (shop_id, question_key)
//   bbr_one_live_per_shop      (shop_id) where status in queued|claimed|running
//   pending_action_key_uniq    (household_id, action_type, action_key) where pending
//
// NOT a Postgres emulator and not trying to be. An unrecognised statement is an
// ERROR, so a test cannot pass by silently running a query nobody modelled.
//
// Test support only. Synthetic fixtures; never real household data.
// =====================================================================

const SHOP_COLUMNS = [
  'id', 'household_id', 'shop_ref', 'status', 'source_kind',
  'telegram_chat_id', 'telegram_message_id', 'telegram_update_id',
  'raw_text', 'raw_media_path', 'transcript', 'transcript_provider',
  'transcript_model', 'transcript_confidence', 'needs_review', 'list_id',
  'last_error', 'created_at', 'updated_at',
];

function nowIso() { return '2026-08-03T09:00:00.000Z'; }

function clone(row) { return row === null || row === undefined ? row : { ...row }; }
function rows(list) { return { rows: list.map(clone), rowCount: list.length }; }
function none() { return { rows: [], rowCount: 0 }; }

/** Parse the column list out of an INSERT so the fake stores the same shape the
 *  real statement carries, rather than a shape this file invented. */
function insertColumns(sql, table) {
  const re = new RegExp(`INSERT INTO ${table.replace('.', '\\.')}\\s*\\(([^)]*)\\)`, 'i');
  const m = re.exec(sql);
  if (!m) throw new Error(`fakePg: could not read the column list from: ${sql}`);
  return m[1].split(',').map((c) => c.trim());
}

/** Map positional params onto the insert's columns, honouring ::jsonb casts. */
function insertRow(sql, table, params) {
  const cols = insertColumns(sql, table);
  const row = {};
  cols.forEach((col, i) => {
    let v = params[i];
    if (typeof v === 'string' && /^[[{"]/.test(v.trim())) {
      // The real writer stringifies jsonb parameters and casts them; store the
      // parsed value so a reader sees what Postgres would return.
      try { v = JSON.parse(v); } catch { /* keep the string */ }
    }
    row[col] = v === undefined ? null : v;
  });
  return row;
}

export function createFakeDatabase(seed = {}) {
  const db = {
    shop: [],
    shop_event: [],
    shop_question: [],
    shop_line: [],
    browser_build_request: [],
    pending_action: [],
    households: [{ id: 1, name: 'test-household', display_name: 'Test Household' }],
    shopping_lists: [],
    shopping_list_items: [],
    order_confirmation: [],
    order_confirmation_line: [],
    ...seed,
  };
  const nextId = {};
  const id = (table) => {
    const existing = (db[table] || []).reduce((m, r) => Math.max(m, Number(r.id) || 0), 0);
    nextId[table] = Math.max(nextId[table] || 0, existing) + 1;
    return nextId[table];
  };
  return { db, id };
}

/**
 * A `pg`-shaped client over an in-memory database.
 *
 * `log` records every statement in order, so a test can still assert on ORDER
 * (that the status UPDATE and its audit INSERT are adjacent, say) as well as on
 * the resulting state.
 */
export function createFakeClient(store, options = {}) {
  const { db, id } = store;
  const log = [];
  let failNext = options.failNext || null;

  const handlers = [
    // ── transaction markers ────────────────────────────────────────────────
    [/^(BEGIN|COMMIT|ROLLBACK)/i, () => none()],
    [/^BEGIN TRANSACTION READ ONLY/i, () => none()],
    [/^SELECT pg_advisory_xact_lock/i, () => none()],

    // ── asdair.shop ────────────────────────────────────────────────────────
    [/^INSERT INTO asdair\.shop \(/i, (sql, params) => {
      const row = insertRow(sql, 'asdair.shop', params);
      // shop_ref_uniq
      if (db.shop.some((s) => String(s.household_id) === String(row.household_id) && s.shop_ref === row.shop_ref)) return none();
      // shop_inbound_uniq (PARTIAL - only rows carrying BOTH)
      if (row.telegram_chat_id !== null && row.telegram_message_id !== null
        && db.shop.some((s) => s.telegram_chat_id === row.telegram_chat_id && s.telegram_message_id === row.telegram_message_id)) return none();
      const created = {
        ...Object.fromEntries(SHOP_COLUMNS.map((c) => [c, null])),
        ...row,
        id: id('shop'),
        status: row.status || 'RECEIVED',
        needs_review: row.needs_review === true,
        created_at: nowIso(),
        updated_at: nowIso(),
      };
      db.shop.push(created);
      return rows([created]);
    }],
    [/^UPDATE asdair\.shop SET /i, (sql, params) => {
      // The real statement is built dynamically: SET <cols> WHERE id = $n AND status = $m
      const assignments = /SET (.*?) WHERE id = \$(\d+) AND status = \$(\d+)/is.exec(sql);
      if (!assignments) throw new Error(`fakePg: unrecognised shop UPDATE: ${sql}`);
      const shopId = params[Number(assignments[2]) - 1];
      const expected = params[Number(assignments[3]) - 1];
      const target = db.shop.find((s) => String(s.id) === String(shopId) && s.status === expected);
      if (!target) return none();
      for (const part of assignments[1].split(',').map((p) => p.trim())) {
        const [col, expr] = part.split('=').map((x) => x.trim());
        if (expr === 'now()') { target[col] = nowIso(); continue; }
        const pIdx = /^\$(\d+)$/.exec(expr);
        if (!pIdx) throw new Error(`fakePg: unrecognised SET expression "${part}"`);
        target[col] = params[Number(pIdx[1]) - 1];
      }
      return rows([target]);
    }],
    [/FROM asdair\.shop WHERE telegram_chat_id = \$1 AND telegram_message_id = \$2/i, (sql, p) =>
      rows(db.shop.filter((s) => s.telegram_chat_id === p[0] && s.telegram_message_id === p[1]))],
    [/FROM asdair\.shop WHERE household_id = \$1 AND shop_ref = \$2/i, (sql, p) =>
      rows(db.shop.filter((s) => String(s.household_id) === String(p[0]) && s.shop_ref === p[1]))],
    [/FROM asdair\.shop WHERE id = \$1/i, (sql, p) =>
      rows(db.shop.filter((s) => String(s.id) === String(p[0])))],
    [/FROM asdair\.shop WHERE shop_ref = \$1/i, (sql, p) =>
      rows(db.shop.filter((s) => s.shop_ref === p[0]).sort((a, b) => a.id - b.id))],
    [/FROM asdair\.shop\s+WHERE status NOT IN/i, (sql, p) => {
      const consumable = Array.isArray(p[0]) ? p[0] : [];
      const withWork = new Set(db.pending_action
        .filter((a) => a.status === 'pending' && a.shop_id !== null && consumable.includes(a.action_type))
        .map((a) => String(a.shop_id)));
      return rows(db.shop
        .filter((s) => !['RECONCILED', 'CANCELLED'].includes(s.status) || withWork.has(String(s.id)))
        .sort((a, b) => a.id - b.id));
    }],

    // ── asdair.shop_event ──────────────────────────────────────────────────
    [/^INSERT INTO asdair\.shop_event \(/i, (sql, p) => {
      const row = {
        id: id('shop_event'), shop_id: p[0], event_type: p[1], from_status: p[2],
        to_status: p[3], description: p[4], occurred_at: nowIso(),
      };
      db.shop_event.push(row);
      return rows([{ id: row.id, occurred_at: row.occurred_at }]);
    }],
    [/FROM asdair\.shop_event\s+WHERE shop_id = \$1 AND event_type = 'failure'/i, (sql, p) => {
      const hits = db.shop_event.filter((e) => String(e.shop_id) === String(p[0]) && e.event_type === 'failure')
        .sort((a, b) => b.id - a.id);
      return rows(hits.slice(0, 1));
    }],
    [/FROM asdair\.shop_event WHERE shop_id = \$1 ORDER BY id DESC LIMIT 1/i, (sql, p) => {
      const hits = db.shop_event.filter((e) => String(e.shop_id) === String(p[0])).sort((a, b) => b.id - a.id);
      return rows(hits.slice(0, 1));
    }],

    // ── asdair.shop_question ───────────────────────────────────────────────
    [/^INSERT INTO asdair\.shop_question \(/i, (sql, params) => {
      const row = insertRow(sql, 'asdair.shop_question', params);
      // shop_question_key_uniq - THE reason a question is never asked twice.
      if (db.shop_question.some((q) => String(q.shop_id) === String(row.shop_id) && q.question_key === row.question_key)) return none();
      const created = {
        id: id('shop_question'), status: 'open', answer_text: null, answer_source: null,
        asked_at: nowIso(), answered_at: null, ...row,
      };
      db.shop_question.push(created);
      return rows([created]);
    }],
    [/^UPDATE asdair\.shop_question SET status = \$1/i, (sql, p) => {
      const target = db.shop_question.find((q) => String(q.id) === String(p[3]) && q.status === 'open');
      if (!target) return none();
      target.status = p[0];
      target.answer_text = p[1];
      target.answer_source = p[2];
      target.answered_at = nowIso();
      return rows([target]);
    }],
    [/FROM asdair\.shop_question WHERE shop_id = \$1 AND question_key = \$2/i, (sql, p) =>
      rows(db.shop_question.filter((q) => String(q.shop_id) === String(p[0]) && q.question_key === p[1]))],
    [/FROM asdair\.shop_question WHERE id = \$1/i, (sql, p) =>
      rows(db.shop_question.filter((q) => String(q.id) === String(p[0])))],
    [/count\(\*\)::int AS n FROM asdair\.shop_question WHERE shop_id = \$1 AND status = 'open'/i, (sql, p) =>
      rows([{ n: db.shop_question.filter((q) => String(q.shop_id) === String(p[0]) && q.status === 'open').length }])],
    [/FROM asdair\.shop_question WHERE shop_id = \$1 ORDER BY id ASC/i, (sql, p) =>
      rows(db.shop_question.filter((q) => String(q.shop_id) === String(p[0])).sort((a, b) => a.id - b.id))],

    // ── asdair.browser_build_request ───────────────────────────────────────
    [/^INSERT INTO asdair\.browser_build_request \(/i, (sql, p) => {
      const shopId = p[0];
      // bbr_one_live_per_shop
      if (db.browser_build_request.some((b) => String(b.shop_id) === String(shopId)
        && ['queued', 'claimed', 'running'].includes(b.status))) return none();
      const row = {
        id: id('browser_build_request'), shop_id: shopId, status: p[1] || 'queued',
        claimed_by: null, progress: {}, last_error: null,
        requested_at: nowIso(), claimed_at: null, finished_at: null,
      };
      db.browser_build_request.push(row);
      return rows([row]);
    }],
    [/^UPDATE asdair\.browser_build_request SET status = 'claimed'/i, (sql, p) => {
      const target = db.browser_build_request.find((b) => String(b.shop_id) === String(p[0]) && b.status === 'queued');
      if (!target) return none();
      target.status = 'claimed'; target.claimed_by = p[1]; target.claimed_at = nowIso();
      return rows([target]);
    }],
    [/^UPDATE asdair\.browser_build_request SET progress/i, (sql, p) => {
      const target = db.browser_build_request.find((b) => String(b.id) === String(p[1])
        && ['claimed', 'running'].includes(b.status));
      if (!target) return none();
      try { target.progress = JSON.parse(p[0]); } catch { target.progress = {}; }
      target.status = 'running';
      return rows([target]);
    }],
    [/^UPDATE asdair\.browser_build_request SET status = \$1, last_error = \$2/i, (sql, p) => {
      const target = db.browser_build_request.find((b) => String(b.id) === String(p[2])
        && ['queued', 'claimed', 'running'].includes(b.status));
      if (!target) return none();
      target.status = p[0]; target.last_error = p[1]; target.finished_at = nowIso();
      return rows([target]);
    }],
    [/FROM asdair\.browser_build_request\s+WHERE shop_id = \$1 AND status IN/i, (sql, p) => {
      const hits = db.browser_build_request.filter((b) => String(b.shop_id) === String(p[0])
        && ['queued', 'claimed', 'running'].includes(b.status)).sort((a, b) => b.id - a.id);
      return rows(hits.slice(0, 1));
    }],
    [/FROM asdair\.browser_build_request WHERE shop_id = \$1 ORDER BY id DESC LIMIT 1/i, (sql, p) => {
      const hits = db.browser_build_request.filter((b) => String(b.shop_id) === String(p[0])).sort((a, b) => b.id - a.id);
      return rows(hits.slice(0, 1));
    }],
    [/FROM asdair\.browser_build_request WHERE id = \$1/i, (sql, p) =>
      rows(db.browser_build_request.filter((b) => String(b.id) === String(p[0])))],

    // ── asdair.pending_action (the command ledger + the outbox) ────────────
    [/^INSERT INTO asdair\.pending_action \(/i, (sql, params) => {
      const row = insertRow(sql, 'asdair.pending_action', params);
      // pending_action_key_uniq - PARTIAL: only while pending.
      if (db.pending_action.some((a) => a.status === 'pending'
        && String(a.household_id) === String(row.household_id)
        && a.action_type === row.action_type
        && a.action_key === row.action_key)) return none();
      const created = {
        id: id('pending_action'), status: 'pending', note: null,
        created_at: nowIso(), resolved_at: null, payload: {}, shop_id: null, ...row,
      };
      db.pending_action.push(created);
      return rows([created]);
    }],
    [/^UPDATE asdair\.pending_action SET status = \$1/i, (sql, p) => {
      const target = db.pending_action.find((a) => String(a.id) === String(p[2]) && a.status === 'pending');
      if (!target) return none();
      target.status = p[0]; target.note = p[1]; target.resolved_at = nowIso();
      return rows([target]);
    }],
    [/FROM asdair\.pending_action\s+WHERE household_id = \$1 AND action_type = \$2 AND action_key = \$3 AND status = 'pending'/i, (sql, p) =>
      rows(db.pending_action.filter((a) => String(a.household_id) === String(p[0])
        && a.action_type === p[1] && a.action_key === p[2] && a.status === 'pending'))],
    [/FROM asdair\.pending_action\s+WHERE shop_id = \$1 AND status = 'pending' AND action_type LIKE \$2/i, (sql, p) =>
      rows(db.pending_action.filter((a) => String(a.shop_id) === String(p[0]) && a.status === 'pending'
        && a.action_type.startsWith(String(p[1]).replace('%', ''))).sort((a, b) => a.id - b.id))],
    [/SELECT DISTINCT action_type FROM asdair\.pending_action\s+WHERE shop_id = \$1 AND action_type LIKE \$2/i, (sql, p) => {
      const prefix = String(p[1]).replace('%', '');
      const seen = new Set(db.pending_action.filter((a) => String(a.shop_id) === String(p[0])
        && a.action_type.startsWith(prefix)).map((a) => a.action_type));
      return rows([...seen].map((t) => ({ action_type: t })));
    }],
    [/FROM asdair\.pending_action WHERE status = 'pending' AND action_type LIKE \$1 AND shop_id = \$2/i, (sql, p) =>
      rows(db.pending_action.filter((a) => a.status === 'pending'
        && a.action_type.startsWith(String(p[0]).replace('%', ''))
        && String(a.shop_id) === String(p[1])).sort((a, b) => a.id - b.id))],
    [/FROM asdair\.pending_action WHERE status = 'pending' AND action_type LIKE \$1/i, (sql, p) =>
      rows(db.pending_action.filter((a) => a.status === 'pending'
        && a.action_type.startsWith(String(p[0]).replace('%', ''))).sort((a, b) => a.id - b.id))],
    [/FROM asdair\.pending_action WHERE household_id = \$1 AND status = 'pending'/i, (sql, p) =>
      rows(db.pending_action.filter((a) => String(a.household_id) === String(p[0]) && a.status === 'pending')
        .sort((a, b) => a.id - b.id))],

    // ── asdair.shop_line (migration 008 - the durable interpretation) ──────
    // UNIQUE (shop_id, line_no), plus the two CHECKs that matter: a `matched`
    // line must carry a matched_regular_id, and a quantity is 1..999 or NULL.
    [/^INSERT INTO asdair\.shop_line \(/i, (sql, params) => {
      const row = insertRow(sql, 'asdair.shop_line', params);
      if (row.status === 'matched' && (row.matched_regular_id === null || row.matched_regular_id === undefined)) {
        throw new Error('fakePg: CHECK shop_line_matched_needs_regular violated');
      }
      if (row.quantity !== null && row.quantity !== undefined
        && (!Number.isInteger(Number(row.quantity)) || Number(row.quantity) < 1 || Number(row.quantity) > 999)) {
        throw new Error('fakePg: CHECK shop_line_quantity_sane violated');
      }
      const existing = db.shop_line.find((l) => String(l.shop_id) === String(row.shop_id)
        && Number(l.line_no) === Number(row.line_no));
      if (existing) {
        // ON CONFLICT DO UPDATE ... WHERE shop_line.confirmed_by IS NULL.
        // A line a human confirmed refuses the re-read, and returns no row.
        if (existing.confirmed_by !== null && existing.confirmed_by !== undefined) return none();
        Object.assign(existing, row, { updated_at: nowIso() });
        return rows([existing]);
      }
      const created = {
        id: id('shop_line'), confirmed_by: null, confirmed_at: null, corrected: false,
        list_item_id: null, match_confidence: null, alternatives: [],
        created_at: nowIso(), updated_at: nowIso(), ...row,
      };
      db.shop_line.push(created);
      return rows([created]);
    }],
    [/^UPDATE asdair\.shop_line SET list_item_id = \$3/i, (sql, p) => {
      const target = db.shop_line.find((l) => String(l.shop_id) === String(p[0]) && Number(l.line_no) === Number(p[1]));
      if (!target) return none();
      target.list_item_id = p[2]; target.updated_at = nowIso();
      return rows([target]);
    }],
    [/^UPDATE asdair\.shop_line SET corrected = true/i, (sql, p) => {
      const target = db.shop_line.find((l) => String(l.shop_id) === String(p[0]) && Number(l.line_no) === Number(p[1]));
      if (!target) return none();
      target.corrected = true; target.confirmed_by = p[2]; target.confirmed_at = nowIso(); target.updated_at = nowIso();
      return rows([target]);
    }],
    [/FROM asdair\.shop_line WHERE shop_id = \$1 AND line_no = \$2/i, (sql, p) =>
      rows(db.shop_line.filter((l) => String(l.shop_id) === String(p[0]) && Number(l.line_no) === Number(p[1])))],
    [/FROM asdair\.shop_line WHERE shop_id = \$1 ORDER BY line_no ASC/i, (sql, p) =>
      rows(db.shop_line.filter((l) => String(l.shop_id) === String(p[0])).sort((a, b) => a.line_no - b.line_no))],

    // ── asdair.households / shopping_lists / shopping_list_items ───────────
    // Modelled so the REAL services/control-plane/wp-d-proof/asdairCommands.mjs
    // runs against this fake. Its add_list_item UPSERT on
    // (list_id, lower(item_name)) is what makes re-interpreting a list safe, so
    // the tests must exercise the real statement, not a stand-in for it.
    [/^select id from asdair\.households where id=\$1/i, (sql, p) =>
      rows((db.households || []).filter((h) => String(h.id) === String(p[0])))],
    [/^select id from asdair\.households where name=\$1 or display_name=\$1/i, (sql, p) =>
      rows((db.households || []).filter((h) => h.name === p[0] || h.display_name === p[0]))],
    [/^select id from asdair\.households order by id/i, () =>
      rows((db.households || []).map((h) => ({ id: h.id })).sort((a, b) => a.id - b.id))],
    [/^select id from asdair\.shopping_lists where household_id=\$1 and status='next_week_draft' and list_date=\$2/i, (sql, p) => {
      const hits = db.shopping_lists.filter((l) => String(l.household_id) === String(p[0])
        && l.status === 'next_week_draft' && l.list_date === p[1]).sort((a, b) => b.id - a.id);
      return rows(hits.slice(0, 1).map((l) => ({ id: l.id })));
    }],
    [/^select id from asdair\.shopping_lists where household_id=\$1 and status='next_week_draft'/i, (sql, p) => {
      const hits = db.shopping_lists.filter((l) => String(l.household_id) === String(p[0])
        && l.status === 'next_week_draft').sort((a, b) => b.id - a.id);
      return rows(hits.slice(0, 1).map((l) => ({ id: l.id })));
    }],
    [/^insert into asdair\.shopping_lists \(household_id, status, list_date\)/i, (sql, p) => {
      const row = { id: id('shopping_lists'), household_id: p[0], status: 'next_week_draft', list_date: p[1] ?? null };
      db.shopping_lists.push(row);
      return rows([{ id: row.id }]);
    }],
    [/^select id, requested_qty, status, note from asdair\.shopping_list_items where list_id=\$1 and lower\(item_name\)=lower\(\$2\)/i, (sql, p) => {
      const hit = db.shopping_list_items.find((i) => String(i.list_id) === String(p[0])
        && String(i.item_name).toLowerCase() === String(p[1]).toLowerCase());
      return hit ? rows([{ id: hit.id, requested_qty: hit.requested_qty, status: hit.status, note: hit.note }]) : none();
    }],
    [/^select id from asdair\.shopping_list_items where list_id=\$1 and lower\(item_name\)=lower\(\$2\)/i, (sql, p) => {
      const hit = db.shopping_list_items.find((i) => String(i.list_id) === String(p[0])
        && String(i.item_name).toLowerCase() === String(p[1]).toLowerCase());
      return hit ? rows([{ id: hit.id }]) : none();
    }],
    [/^insert into asdair\.shopping_list_items \(list_id,item_name,requested_qty,status,note\)/i, (sql, p) => {
      const row = {
        id: id('shopping_list_items'), list_id: p[0], item_name: p[1], requested_qty: p[2],
        status: p[3] ?? 'requested', note: p[4] ?? null, matched_product_id: null, price: null, one_week_only: false,
      };
      db.shopping_list_items.push(row);
      return rows([{ id: row.id }]);
    }],
    [/^update asdair\.shopping_list_items set requested_qty=\$2, status=\$3, note=coalesce\(\$4,note\)/i, (sql, p) => {
      const target = db.shopping_list_items.find((i) => String(i.id) === String(p[0]));
      if (!target) return none();
      target.requested_qty = p[1]; target.status = p[2];
      if (p[3] !== null && p[3] !== undefined) target.note = p[3];
      return rows([target]);
    }],
    [/^update asdair\.shopping_list_items set requested_qty=\$2 where id=\$1/i, (sql, p) => {
      const target = db.shopping_list_items.find((i) => String(i.id) === String(p[0]));
      if (!target) return none();
      target.requested_qty = p[1];
      return rows([target]);
    }],

    // ── asdair.shopping_list_items (the pipeline's own read) ───────────────
    [/FROM asdair\.shopping_list_items WHERE list_id = \$1/i, (sql, p) =>
      rows(db.shopping_list_items.filter((i) => String(i.list_id) === String(p[0])).sort((a, b) => a.id - b.id))],

    // ── asdair.order_confirmation_line (the learning read) ─────────────────
    [/FROM asdair\.order_confirmation_line/i, (sql, p) => {
      const conf = db.order_confirmation.filter((c) => String(c.shop_id) === String(p[0])).sort((a, b) => b.id - a.id)[0];
      if (!conf) return none();
      return rows(db.order_confirmation_line.filter((l) => String(l.confirmation_id) === String(conf.id)
        && l.matched_regular_id !== null && l.matched_regular_id !== undefined));
    }],
  ];

  return {
    log,
    db,
    released: false,
    /** Make the NEXT statement matching `needle` throw - how the tests simulate
     *  a process dying, or a transient database failure, mid-step. */
    breakOn(needle) { failNext = needle; },
    async query(sql, params = []) {
      const text = String(sql).replace(/\s+/g, ' ').trim();
      log.push({ sql: text, params });
      if (failNext && text.includes(failNext)) {
        failNext = null;
        throw new Error(`fakePg: injected failure on "${failNext}"`);
      }
      for (const [re, handler] of handlers) {
        if (re.test(text)) return handler(text, params);
      }
      throw new Error(`fakePg: no handler for statement:\n${text}`);
    },
    release() { this.released = true; },
  };
}

/** Every statement the client saw, in order. */
export function statements(client) {
  return client.log.map((e) => e.sql);
}

/** Index of the first statement containing `needle` (-1 when absent). */
export function indexOf(client, needle) {
  return statements(client).findIndex((s) => (needle instanceof RegExp ? needle.test(s) : s.includes(needle)));
}

export function countMatching(client, needle) {
  return statements(client).filter((s) => (needle instanceof RegExp ? needle.test(s) : s.includes(needle))).length;
}
