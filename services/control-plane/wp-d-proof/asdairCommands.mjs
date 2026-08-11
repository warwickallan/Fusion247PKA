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
//                  note?, household?, list_date?, shop_id?}      (BUILD-002 WP5 — the Shopper write)
//                  shop_id (WP-B15-16) names the OWNING SHOP: with it the item lands on that shop's
//                  own list; without it, on the date-keyed unowned lane, exactly as before.

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

// WP-B15-16: THE SHOP OWNS THE LIST, NOT THE DATE.
//
// When `shopId` is given the list is resolved by OWNER (asdair.shopping_lists.shop_id, added by
// migration 019) and never by date. That is the whole fix: two shops on one date each get their own
// list row, so neither can read, clobber or inherit the other's items. Postgres enforces one list per
// shop via `uq_lists_shop` -- a second list for the same shop is a 23505, not an application check.
//
// When `shopId` is ABSENT the behaviour is unchanged, deliberately and to the byte. The cockpit and
// Shopper routes have no shop behind them and stay in the "unowned lane", which 019 preserves as
// `unique (household_id, list_date) where shop_id is null` -- exactly the guarantee the original
// constraint gave. The two three-column statements below are therefore left EXACTLY as they were:
// services/asdair/pipeline/test/fakePg.js matches this insert POSITIONALLY on
// `(household_id, status, list_date)` and runs this real handler against that double, so editing the
// statement would break the offline pipeline suite. The four-column form is only ever issued on the
// shop-owned path, which the double never reaches.
//
// If listDate is given, resolve/create the draft list for THAT date exactly (so an item is never added
// to a different week's list around a boundary); otherwise fall back to the latest next_week_draft or
// create one dated next week. listDate must be an ISO YYYY-MM-DD when provided.
//
// WP-B15-22 (Gate Zero integration) -- RECLAIM, NEVER ORPHAN, A PRE-EXISTING UNOWNED LIST.
//
// Found by BUILD-015 Keel while integrating WP-B15-21: the shop-owned branch below, on finding no list
// of its own, used to go STRAIGHT to minting a brand new row -- never once looking at whether an
// unowned list for the SAME household+date already existed. A real Warwick journey hits this exactly:
// he taps "add to next week" from the cockpit BEFORE this week's photo shop exists (add_regular_to_next_
// week's own resolveCockpitTargetList finds no live shop yet and correctly falls back to the unowned
// lane), then his photo shop starts, stepInterpret supplies its OWN shop_id, and this function minted a
// SECOND, SEPARATE list -- stranding his cockpit addition on a row no shop will ever look at again. A
// shopping list item silently vanishing is a genuine data-loss defect, not a theoretical one.
//
// THE FIX RECLAIMS RATHER THAN MOVES, mirroring exactly what migration 019's own backfill already does
// for historical data: the unowned list's `shop_id` is set (an UPDATE), and every shopping_list_items
// row already on it STAYS on it -- list_id never changes for a single item. That is deliberate and
// load-bearing: `list_item_id` links already minted elsewhere (shop_line.list_item_id, a question's
// list_item_id) point at the ITEM row, not at the list, so moving items to a fresh list_id would orphan
// those links instead of the list. Reclaiming the LIST (not moving the items) is the only shape that
// cannot break something else.
//
// THE UPDATE RE-CHECKS `shop_id is null` AT WRITE TIME, the same compare-and-set discipline this
// codebase already uses everywhere a row's state might have moved between a read and a write
// (shopStore.js's `status = <expected>` transition guard, answerQuestion's `status='open'` guard). If
// another writer claimed the same unowned list between this function's SELECT and its UPDATE, the
// predicate matches 0 rows and this function falls through to minting a fresh list for THIS shop
// rather than fighting over one row. Proven here by SEQUENTIAL exclusion only (add-list-item.dbtest.mjs
// #16h: a list already claimed before this call runs is correctly skipped) -- genuine concurrent
// interleaving (two live connections racing the SAME SELECT-then-UPDATE window) is NOT exercised by
// that test and would need two coordinated connections to prove; not built here as disproportionate to
// this narrow, already-conventional guard. The safety net if it were ever wrong is structural, not this
// test: `uq_lists_household_date_unowned` and `uq_lists_shop` make a double-claim a 23505, never a
// silent data corruption, whatever this function does.
async function reclaimUnownedList(client, householdId, listDate, shopId) {
  const unowned = listDate
    ? await client.query(
      `select id from asdair.shopping_lists where household_id=$1 and status='next_week_draft' and list_date=$2 and shop_id is null order by id desc limit 1`,
      [householdId, listDate])
    : await client.query(
      `select id from asdair.shopping_lists where household_id=$1 and status='next_week_draft' and shop_id is null order by id desc limit 1`,
      [householdId]);
  if (!unowned.rowCount) return null;
  const claimed = await client.query(
    `update asdair.shopping_lists set shop_id=$2 where id=$1 and shop_id is null returning id`,
    [unowned.rows[0].id, shopId]);
  return claimed.rowCount ? claimed.rows[0].id : null;
}

async function findOrCreateDraftList(client, householdId, listDate = null, shopId = null) {
  if (shopId !== null && shopId !== undefined) {
    if (listDate && !/^\d{4}-\d{2}-\d{2}$/.test(listDate)) throw new Error(`invalid list_date "${listDate}" (want YYYY-MM-DD)`);
    const byShop = await client.query('select id from asdair.shopping_lists where shop_id=$1', [shopId]);
    if (byShop.rowCount) return byShop.rows[0].id;

    // RECLAIM before CREATE. A pre-existing unowned same-date list is adopted
    // into this shop's ownership rather than left stranded behind a fresh row.
    const reclaimed = await reclaimUnownedList(client, householdId, listDate, shopId);
    if (reclaimed) return reclaimed;

    // No list of its own, and nothing unowned to reclaim. list_date stays
    // MEANINGFUL -- it is the week the list is for, and the read path still
    // renders it; it simply is no longer the identity.
    const insShop = listDate
      ? await client.query(
        `insert into asdair.shopping_lists (household_id, status, list_date, shop_id) values ($1,'next_week_draft',$2,$3) returning id`, [householdId, listDate, shopId])
      : await client.query(
        `insert into asdair.shopping_lists (household_id, status, list_date, shop_id) values ($1,'next_week_draft',(current_date+7),$2) returning id`, [householdId, shopId]);
    return insShop.rows[0].id;
  }
  if (listDate) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(listDate)) throw new Error(`invalid list_date "${listDate}" (want YYYY-MM-DD)`);
    const byDate = await client.query(
      `select id from asdair.shopping_lists where household_id=$1 and status='next_week_draft' and list_date=$2 order by id desc limit 1`, [householdId, listDate]);
    if (byDate.rowCount) return byDate.rows[0].id;
    const insDate = await client.query(
      `insert into asdair.shopping_lists (household_id, status, list_date) values ($1,'next_week_draft',$2) returning id`, [householdId, listDate]);
    return insDate.rows[0].id;
  }
  const list = await client.query(
    `select id from asdair.shopping_lists where household_id=$1 and status='next_week_draft' order by id desc limit 1`, [householdId]);
  if (list.rowCount) return list.rows[0].id;
  const ins = await client.query(
    `insert into asdair.shopping_lists (household_id, status, list_date) values ($1,'next_week_draft',(current_date+7)) returning id`, [householdId]);
  return ins.rows[0].id;
}

// WP-B15-16 / AC6: which list a COCKPIT tap should land on.
//
// `add_regular_to_next_week` carries no shop context, so before 019 it always resolved the unowned
// lane -- which, once a shop owns its own list, is a DIFFERENT list from the one Warwick is actually
// shopping. That is not what he means when he taps "add to next week" mid-shop.
//
// The safe default (Silas's recommendation, an ordinary technical choice): if the household has a
// live (non-terminal) shop that ALREADY has a list, use that list. Otherwise fall back to the unowned
// lane exactly as before. Terminal is ('RECONCILED','CANCELLED'), mirroring
// services/asdair/shop/shopState.js TERMINAL_STATUSES -- 'FAILED' is deliberately NOT terminal,
// because a failed shop can still be resumed and must not have its list forked underneath it.
//
// Two links are consulted, and the order matters. `shopping_lists.shop_id` is the new owner key.
// `shop.list_id` is the link that has existed since 006 and is what production still populates today,
// because the pipeline does not yet emit shop_id (that is a follow-on outside this change). Reading
// both means the cockpit tap lands correctly NOW, not only after the pipeline half ships.
//
// This never CREATES a shop-owned list: a cockpit tap must not claim ownership of a list its shop has
// not made yet. No live shop with a list -> unowned lane, unchanged.
// It must also work on a database where 019 has NOT been applied yet. This code ships before the
// migration is run against the live store, so probing for the column rather than assuming it is a
// correctness requirement, not test convenience: assuming `shop_id` here would break every cockpit
// tap in the window between this landing and 019 being applied.
async function resolveCockpitTargetList(client, householdId) {
  const shape = await client.query(
    `select to_regclass('asdair.shop') is not null as has_shop,
            exists (select 1 from information_schema.columns
                     where table_schema='asdair' and table_name='shopping_lists'
                       and column_name='shop_id') as has_owner_column`);
  const { has_shop: hasShop, has_owner_column: hasOwner } = shape.rows[0];
  if (!hasShop) return null;
  const ownedSelect = hasOwner
    ? '(select sl.id from asdair.shopping_lists sl where sl.shop_id = s.id)'
    : 'null::bigint';
  const live = await client.query(
    `select s.list_id, ${ownedSelect} as owned_list_id
       from asdair.shop s
      where s.household_id = $1
        and s.status not in ('RECONCILED','CANCELLED')
      order by s.id desc
      limit 1`, [householdId]);
  if (!live.rowCount) return null;
  return live.rows[0].owned_list_id ?? live.rows[0].list_id ?? null;
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
    // WP-B15-16: land on the live shop's list when there is one, else the unowned lane (see
    // resolveCockpitTargetList). Before 019 this was always the unowned lane.
    const listId = (await resolveCockpitTargetList(client, householdId)) ?? await findOrCreateDraftList(client, householdId);
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

    const listDate = args?.list_date ?? null;
    // WP-B15-16: the OWNING SHOP, when the caller knows it. Optional and additive -- args are
    // free-form on the command_request payload and assertAllowedIntents allowlists commands, not arg
    // keys. Validated as a positive integer and failing closed on garbage, like every other arg here:
    // a malformed shop_id must never silently fall back to the date-keyed lane, because that is the
    // exact behaviour this change exists to remove.
    let shopId = args?.shop_id;
    if (shopId === undefined || shopId === null || shopId === '') shopId = null;
    else {
      shopId = Number(shopId);
      if (!Number.isInteger(shopId) || shopId <= 0) return { ok: false, command, error: 'shop_id must be a positive integer when provided', worker: 'cp_worker', executed_at: at };
    }
    const householdId = await resolveHousehold(client, args?.household);
    if (!householdId) return { ok: false, command, error: 'household could not be resolved (missing selector or ambiguous)', worker: 'cp_worker', executed_at: at };
    await client.query('select pg_advisory_xact_lock($1)', [householdId]);
    const listId = await findOrCreateDraftList(client, householdId, listDate, shopId);

    const existing = await client.query(`select id, requested_qty, status, note from asdair.shopping_list_items where list_id=$1 and lower(item_name)=lower($2) limit 1 for update`, [listId, itemName]);
    let itemId, action, corrected = false;
    if (existing.rowCount) {
      itemId = existing.rows[0].id;
      // A note change is also a correction — the receipt must not under-report a real data change.
      const noteChanges = note !== null && note !== existing.rows[0].note;
      corrected = existing.rows[0].requested_qty !== storedQty || existing.rows[0].status !== status || noteChanges;
      await client.query(`update asdair.shopping_list_items set requested_qty=$2, status=$3, note=coalesce($4,note) where id=$1`, [itemId, storedQty, status, note]);
      action = corrected ? 'corrected' : 'unchanged';
    } else {
      const ins = await client.query(`insert into asdair.shopping_list_items (list_id,item_name,requested_qty,status,note) values ($1,$2,$3,$4,$5) returning id`, [listId, itemName, storedQty, status, note ?? 'added via Shopper route']);
      itemId = ins.rows[0].id; action = 'inserted';
    }
    return { ok: true, command, item_name: itemName, household_id: householdId, list_id: listId, shop_id: shopId, item_id: itemId, qty: storedQty, qty_known: qty !== null, status, action, corrected, worker: 'cp_worker', executed_at: at };
  }

  return { ok: false, command, error: 'unhandled command', worker: 'cp_worker', executed_at: at };
}
