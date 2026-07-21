// BUILD-014 — AsdAIr write-back TRUSTED EXECUTOR (command-queue worker).
//
//   node wp-d-proof/asdair-worker.mjs [--drain|--watch|--once]
//
// The cockpit (Directus / cp_directus) can only INSERT an INTENT row into
// asdair.command_request (status=requested, no receipt). This worker — connecting as the
// least-privilege cp_worker role, NOT via Directus — atomically claims a row with
// FOR UPDATE SKIP LOCKED (concurrent workers never double-execute), runs ONE ALLOWLISTED
// command, and writes a VISIBLE RECEIPT (status=done + receipt). Directus never executes.
//
// ALLOWLISTED COMMANDS (anything else -> status=failed, never executed):
//   add_regular_to_next_week {regular_id:int, qty:int(1..99)}
//     -> upsert a shopping_list_item into the referenced regular's household
//        `next_week_draft` shopping_list (created on first use). Effect-level idempotent
//        by (list_id, lower(item_name)) so replays never duplicate.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'file:///C:/Fusion247PKA/services/control-plane/node_modules/pg/lib/index.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const cfg = JSON.parse(fs.readFileSync(path.join(here, '.runtime-live', 'directus-live.env.json'), 'utf8'));
if (!cfg.worker_password) { console.error('[worker] run provision-writeback-live.mjs first (no cp_worker)'); process.exit(1); }
const ca = fs.readFileSync(cfg.ssl_ca_file);

const argv = new Set(process.argv.slice(2));
const MODE = argv.has('--watch') ? 'watch' : argv.has('--once') ? 'once' : 'drain';

const ALLOWLIST = new Set(['add_regular_to_next_week']);

async function execute(client, command, args) {
  const at = new Date().toISOString();
  if (!ALLOWLIST.has(command)) {
    return { ok: false, command, error: 'command not in allowlist (not executed)', worker: 'cp_worker', executed_at: at };
  }
  if (command === 'add_regular_to_next_week') {
    const regularId = Number(args?.regular_id);
    const qty = Number(args?.qty);
    if (!Number.isInteger(regularId) || regularId <= 0) return { ok: false, command, error: 'bad regular_id', worker: 'cp_worker', executed_at: at };
    if (!Number.isInteger(qty) || qty < 1 || qty > 99) return { ok: false, command, error: 'qty must be an integer 1..99', worker: 'cp_worker', executed_at: at };

    const reg = await client.query('select id, household_id, name from asdair.regulars where id = $1', [regularId]);
    if (reg.rowCount === 0) return { ok: false, command, error: `regular ${regularId} not found`, worker: 'cp_worker', executed_at: at };
    const { household_id: householdId, name } = reg.rows[0];

    // Find or create the household's next_week_draft list.
    let list = await client.query(
      `select id from asdair.shopping_lists where household_id = $1 and status = 'next_week_draft' order by id desc limit 1`,
      [householdId]);
    let listId;
    if (list.rowCount === 0) {
      const ins = await client.query(
        `insert into asdair.shopping_lists (household_id, status, list_date)
         values ($1, 'next_week_draft', (current_date + 7)) returning id`, [householdId]);
      listId = ins.rows[0].id;
    } else { listId = list.rows[0].id; }

    // Effect-level idempotency: upsert by (list_id, lower(item_name)).
    const existing = await client.query(
      `select id from asdair.shopping_list_items where list_id = $1 and lower(item_name) = lower($2) limit 1 for update`,
      [listId, name]);
    let itemId, action;
    if (existing.rowCount > 0) {
      itemId = existing.rows[0].id;
      await client.query(`update asdair.shopping_list_items set requested_qty = $2 where id = $1`, [itemId, qty]);
      action = 'updated';
    } else {
      const ins = await client.query(
        `insert into asdair.shopping_list_items (list_id, item_name, requested_qty, status, note)
         values ($1, $2, $3, 'requested', 'added via cockpit') returning id`, [listId, name, qty]);
      itemId = ins.rows[0].id;
      action = 'inserted';
    }
    return { ok: true, command, regular_id: regularId, regular_name: name, household_id: householdId,
      list_id: listId, item_id: itemId, qty, action, worker: 'cp_worker', executed_at: at };
  }
  return { ok: false, command, error: 'unhandled command', worker: 'cp_worker', executed_at: at };
}

async function drainOne(client) {
  await client.query('begin');
  try {
    const claim = await client.query(
      `select id, command, args from asdair.command_request
        where status = 'requested' order by requested_at for update skip locked limit 1`);
    if (claim.rowCount === 0) { await client.query('commit'); return null; }
    const row = claim.rows[0];
    await client.query(`update asdair.command_request set status='claimed', claimed_at=now() where id=$1`, [row.id]);
    let receipt, finalStatus;
    // Savepoint so a command that errors mid-execute rolls back its partial effect and still
    // records a clean failed receipt (a raised error would otherwise poison the whole txn).
    await client.query('savepoint exec');
    try { receipt = await execute(client, row.command, row.args); finalStatus = receipt.ok ? 'done' : 'failed'; }
    catch (e) {
      await client.query('rollback to savepoint exec');
      receipt = { ok: false, command: row.command, error: String(e.message || e), worker: 'cp_worker' }; finalStatus = 'failed';
    }
    await client.query(`update asdair.command_request set status=$2, receipt=$3::jsonb, completed_at=now() where id=$1`,
      [row.id, finalStatus, JSON.stringify(receipt)]);
    await client.query('commit');
    console.log(`[worker] ${finalStatus.toUpperCase()} ${row.command} (${row.id}) -> ${JSON.stringify(receipt)}`);
    return row.id;
  } catch (e) { await client.query('rollback').catch(() => {}); throw e; }
}

const client = new pg.Client({
  host: cfg.host, port: cfg.port, database: cfg.database,
  user: cfg.worker_pooler_user, password: cfg.worker_password, ssl: { ca, rejectUnauthorized: true },
});
await client.connect();
console.log(`[worker] connected as ${cfg.worker_role} (least-privilege) — mode=${MODE}`);
try {
  if (MODE === 'once') { const id = await drainOne(client); console.log(id ? '[worker] drained 1.' : '[worker] queue empty.'); }
  else if (MODE === 'drain') { let n = 0; while (await drainOne(client)) n++; console.log(`[worker] drained ${n}; queue empty.`); }
  else { console.log('[worker] watching (poll 1s). Ctrl-C to stop.'); while (true) { while (await drainOne(client)) {} await new Promise((r) => setTimeout(r, 1000)); } }
} finally { await client.end(); }
