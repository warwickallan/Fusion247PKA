// IDEA-016 — SHOPPING projector. Reads the authoritative AsdAIr shopping state (asdair.*) and
// idempotently projects the genuine human slice into the two universal contracts:
//   attention_item (kind=decision) — alternatives awaiting Warwick's choice + items needing a decision
//   output_item (items_added)      — "N items added to your list" (aggregated per list, NOT per item)
// READ-ONLY: it surfaces + drills; it does NOT mutate household data. The choose/approve ACTIONS
// (which mutate live shopping) go through the governed asdair command seam and are wired separately.
// Runs as the trusted service role (DATABASE_URL, cross-schema). Directus only reads the projections.
//   node --env-file=C:/.fusion247/fusion-capture-gateway.env services/control-plane/cockpit/project-shopping.mjs
import pg from 'file:///C:/Fusion247PKA/services/control-plane/node_modules/pg/lib/index.js';

const c = new pg.Client({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
await c.connect();

async function upsertAttention(r) {
  await c.query(
    `insert into cockpit.attention_item
       (source_module, source_type, source_key, title, reason, priority, kind, notify_policy, status, actions, provenance_ref, detail_route)
     values ('shopping',$1,$2,$3,$4,$5,$6,$7,'open','[]',$8,$9)
     on conflict (source_module, source_key) do update set
       source_type=excluded.source_type, title=excluded.title, reason=excluded.reason, priority=excluded.priority,
       kind=excluded.kind, notify_policy=excluded.notify_policy, provenance_ref=excluded.provenance_ref,
       detail_route=excluded.detail_route, status='open', updated_at=now()`,
    [r.source_type, r.source_key, r.title, r.reason, r.priority || 'medium', r.kind || 'decision', r.notify_policy || 'selective', r.provenance_ref, r.detail_route || null],
  );
}
async function upsertOutput(r) {
  await c.query(
    `insert into cockpit.output_item
       (source_module, source_type, source_key, title, value, produced_at, provenance_ref, detail_route, notify_policy)
     values ('shopping',$1,$2,$3,$4,$5,$6,$7,$8)
     on conflict (source_module, source_key) do update set
       source_type=excluded.source_type, title=excluded.title, value=excluded.value, produced_at=excluded.produced_at,
       provenance_ref=excluded.provenance_ref, detail_route=excluded.detail_route, updated_at=now()`,
    [r.source_type, r.source_key, r.title, r.value, r.produced_at, r.provenance_ref, r.detail_route || null, r.notify_policy || 'selective'],
  );
}

const attnKeys = [];

// ONE decisive card per item that needs Warwick — an item lands here if it is flagged needs_decision
// OR it has an unchosen alternative. The suggested swap is FOLDED INTO the same card (no second
// "choose an alternative" card for the same item). Keyed by item id, so it can never duplicate.
const items = (await c.query(
  `select li.id, li.item_name, li.status, li.note,
          (select json_agg(json_build_object('name', pa.alternative_name, 'price', pa.price) order by pa.price nulls last)
           from asdair.product_alternatives pa
           where pa.list_item_id = li.id and coalesce(pa.chosen,false) = false) as alts
   from asdair.shopping_list_items li
   where li.status = 'needs_decision'
      or exists (select 1 from asdair.product_alternatives pa
                 where pa.list_item_id = li.id and coalesce(pa.chosen,false) = false)`,
)).rows;
for (const it of items) {
  const key = 'item:' + it.id; attnKeys.push(key);
  const alt = (it.alts && it.alts[0]) || null;
  const rec = alt ? `Suggested swap: ${alt.name}${alt.price ? ` (£${alt.price})` : ''}.` : null;
  const why = it.note || (it.status === 'needs_decision' ? "The usual pick isn't available." : 'Waiting on your call before it goes in the basket.');
  await upsertAttention({
    source_type: 'shopping_decision', source_key: key,
    title: `Sort "${it.item_name}"`,
    reason: rec ? `${why} ${rec} — or keep looking.` : why,
    provenance_ref: 'asdair:list_item:' + it.id, detail_route: '/shopping/item/' + it.id,
  });
}

// 3) Items added → ONE aggregate output per list (not per item)
const added = (await c.query(
  `select li.list_id, count(*)::int n, sl.list_date, sl.created_at
   from asdair.shopping_list_items li join asdair.shopping_lists sl on sl.id = li.list_id
   where coalesce(li.added_qty,0) > 0
   group by li.list_id, sl.list_date, sl.created_at order by sl.created_at desc limit 10`,
)).rows;
let outN = 0;
for (const g of added) {
  outN++;
  await upsertOutput({
    source_type: 'items_added', source_key: 'list:' + g.list_id,
    title: `${g.n} item${g.n > 1 ? 's' : ''} added to your shopping list`,
    value: `Your ${g.list_date ? new Date(g.list_date).toLocaleDateString('en-GB') : 'weekly'} list is ready to review.`,
    produced_at: g.created_at || new Date().toISOString(),
    provenance_ref: 'asdair:shopping_list:' + g.list_id, detail_route: '/outputs/shopping/' + g.list_id,
  });
}

await c.query(
  `update cockpit.attention_item set status='resolved', updated_at=now()
   where source_module='shopping' and status='open' and not (source_key = any($1))`,
  [attnKeys],
);

console.log(JSON.stringify({ ok: true, attention: { decisions: items.length, total_open: attnKeys.length }, output: { lists_with_items_added: outN } }, null, 2));
await c.end();
