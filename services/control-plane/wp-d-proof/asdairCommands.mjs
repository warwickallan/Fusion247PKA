// BUILD-002 WP5 / BUILD-014 — AsdAIr command handlers (testable, DB-agnostic).
//
// Extracted from asdair-worker.mjs so the handler logic can be proven against a THROWAWAY Postgres
// with the real asdair schema (services/asdair/db/001_asdair_schema.sql) WITHOUT touching Warwick's
// live household data. The worker imports ALLOWLIST + execute() from here; the only Warwick-gated
// thing is pointing the worker at the LIVE database — the logic itself is fully built + tested.
//
// ALLOWLISTED COMMANDS (anything else -> not executed):
//   add_regular_to_next_week {regular_id:int, qty:int 1..99}   (BUILD-014)
//   add_list_item {item_name, requested_qty?:int 1..99|null, status:'requested'|'needs_decision',
//                  note?, household?}                           (BUILD-002 WP5 — the Shopper write)

export const ALLOWLIST = new Set(['add_regular_to_next_week', 'add_list_item']);

// Resolve the target household: explicit id, explicit name, or — for the bounded single-household
// case — the sole household. Ambiguous multi-household with no selector is refused (never guessed).
async function resolveHousehold(client, household) {
  if (household !== undefined && household !== null && household !== '') {
    if (Number.isInteger(Number(household)) && String(Number(household)) === String(household)) {
      const r = await client.query('select id from asdair.households where id=$1', [Number(household)]);
      return r.rowCount ? r.rows[0].id : null;
    }
    const r = await client.query('select id from asdair.households where name=$1 or display_name=$1', [String(household)]);
    return r.rowCount ? r.rows[0].id : null;
  }
  const all = await client.query('select id from asdair.households order by id');
  if (all.rowCount === 1) return all.rows[0].id;
  return null; // 0 or >1 with no selector -> caller fails closed
}

async function findOrCreateDraftList(client, householdId) {
  const list = await client.query(
    `select id from asdair.shopping_lists where household_id=$1 and status='next_week_draft' order by id desc limit 1`, [householdId]);
  if (list.rowCount) return list.rows[0].id;
  const ins = await client.query(
    `insert into asdair.shopping_lists (household_id, status, list_date) values ($1,'next_week_draft',(current_date+7)) returning id`, [householdId]);
  return ins.rows[0].id;
}

export async function execute(client, command, args) {
  const at = new Date().toISOString();
  if (!ALLOWLIST.has(command)) return { ok: false, command, error: 'command not in allowlist (not executed)', worker: 'cp_worker', executed_at: at };

  if (command === 'add_regular_to_next_week') {
    const regularId = Number(args?.regular_id);
    const qty = Number(args?.qty);
    if (!Number.isInteger(regularId) || regularId <= 0) return { ok: false, command, error: 'bad regular_id', worker: 'cp_worker', executed_at: at };
    if (!Number.isInteger(qty) || qty < 1 || qty > 99) return { ok: false, command, error: 'qty must be an integer 1..99', worker: 'cp_worker', executed_at: at };
    const reg = await client.query('select id, household_id, name from asdair.regulars where id=$1', [regularId]);
    if (reg.rowCount === 0) return { ok: false, command, error: `regular ${regularId} not found`, worker: 'cp_worker', executed_at: at };
    const { household_id: householdId, name } = reg.rows[0];
    await client.query('select pg_advisory_xact_lock($1)', [householdId]);
    const listId = await findOrCreateDraftList(client, householdId);
    const existing = await client.query(`select id from asdair.shopping_list_items where list_id=$1 and lower(item_name)=lower($2) limit 1 for update`, [listId, name]);
    let itemId, action;
    if (existing.rowCount) { itemId = existing.rows[0].id; await client.query(`update asdair.shopping_list_items set requested_qty=$2 where id=$1`, [itemId, qty]); action = 'updated'; }
    else { const ins = await client.query(`insert into asdair.shopping_list_items (list_id,item_name,requested_qty,status,note) values ($1,$2,$3,'requested','added via cockpit') returning id`, [listId, name, qty]); itemId = ins.rows[0].id; action = 'inserted'; }
    return { ok: true, command, regular_id: regularId, regular_name: name, household_id: householdId, list_id: listId, item_id: itemId, qty, action, worker: 'cp_worker', executed_at: at };
  }

  if (command === 'add_list_item') {
    // WP5: add an arbitrary Shopper item to the household's next_week_draft list. NO checkout/payment/
    // substitution — this only adds/updates a draft-list item. Correction = a repeat with a new qty/
    // status updates the SAME item (idempotent effect); an ambiguous item is stored status=needs_decision.
    const itemName = typeof args?.item_name === 'string' ? args.item_name.trim() : '';
    if (!itemName) return { ok: false, command, error: 'item_name required', worker: 'cp_worker', executed_at: at };
    const status = args?.status === 'needs_decision' ? 'needs_decision' : (args?.status === 'requested' || args?.status === undefined ? 'requested' : null);
    if (status === null) return { ok: false, command, error: `status must be 'requested' or 'needs_decision'`, worker: 'cp_worker', executed_at: at };
    let qty = args?.requested_qty;
    if (qty === undefined || qty === null) qty = null;
    else { qty = Number(qty); if (!Number.isInteger(qty) || qty < 1 || qty > 99) return { ok: false, command, error: 'requested_qty must be null or an integer 1..99', worker: 'cp_worker', executed_at: at }; }
    // shopping_list_items.requested_qty is NOT NULL default 1. An unknown qty on a needs_decision item
    // stores the schema default (1); the "qty/existence is unresolved" signal is carried by
    // status=needs_decision + the note, NOT by a null qty.
    const storedQty = qty ?? 1;
    const note = typeof args?.note === 'string' ? args.note : null;

    const householdId = await resolveHousehold(client, args?.household);
    if (!householdId) return { ok: false, command, error: 'household could not be resolved (missing selector or ambiguous)', worker: 'cp_worker', executed_at: at };
    await client.query('select pg_advisory_xact_lock($1)', [householdId]);
    const listId = await findOrCreateDraftList(client, householdId);

    const existing = await client.query(`select id, requested_qty, status from asdair.shopping_list_items where list_id=$1 and lower(item_name)=lower($2) limit 1 for update`, [listId, itemName]);
    let itemId, action, corrected = false;
    if (existing.rowCount) {
      itemId = existing.rows[0].id;
      corrected = existing.rows[0].requested_qty !== storedQty || existing.rows[0].status !== status;
      await client.query(`update asdair.shopping_list_items set requested_qty=$2, status=$3, note=coalesce($4,note) where id=$1`, [itemId, storedQty, status, note]);
      action = corrected ? 'corrected' : 'unchanged';
    } else {
      const ins = await client.query(`insert into asdair.shopping_list_items (list_id,item_name,requested_qty,status,note) values ($1,$2,$3,$4,$5) returning id`, [listId, itemName, storedQty, status, note ?? 'added via Shopper route']);
      itemId = ins.rows[0].id; action = 'inserted';
    }
    return { ok: true, command, item_name: itemName, household_id: householdId, list_id: listId, item_id: itemId, qty: storedQty, qty_known: qty !== null, status, action, corrected, worker: 'cp_worker', executed_at: at };
  }

  return { ok: false, command, error: 'unhandled command', worker: 'cp_worker', executed_at: at };
}
