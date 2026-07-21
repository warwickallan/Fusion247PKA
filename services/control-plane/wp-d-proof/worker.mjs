// BUILD-014 WP-D increment 2 — the TRUSTED EXECUTOR (command-queue worker).
//
//   node wp-d-proof/worker.mjs [--drain] [--watch] [--once]
//     --drain (default): claim + execute every currently-queued request, then exit.
//     --watch          : keep polling every 1s (Ctrl-C to stop).
//     --once           : claim + execute at most ONE request, then exit.
//
// This is the SEPARATE process that makes Directus safe as a control surface. The
// cockpit can only INSERT an INTENT row (status=requested, no receipt). This worker
// — connecting as the least-privilege cp_worker role, NOT superuser, NOT via Directus —
// atomically claims a row with `FOR UPDATE SKIP LOCKED` (so concurrent workers never
// double-execute), runs ONE genuinely-SAFE synthetic command, and writes a VISIBLE
// RECEIPT back (status=done + receipt jsonb). Directus never executes anything.
//
// It runs entirely against Postgres, so it KEEPS DRAINING THE QUEUE EVEN WHEN
// DIRECTUS IS DOWN — proving Directus is a view/control surface, not the runtime.
//
// SAFE COMMANDS (synthetic, harmless, idempotent):
//   recount_items       -> count public.list_items, write cockpit_metric['list_items_total']
//   recount_checked     -> count checked items,     write cockpit_metric['list_items_checked']
//   echo {message}      -> no-op that timestamps args.message into the receipt
// Anything else -> status=failed with an explanatory receipt (never executed).

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rt = JSON.parse(fs.readFileSync(path.join(__dirname, '.runtime', 'runtime.json'), 'utf8'));
if (!rt.dbRoles?.workerUser) { console.error('[worker] run configure-db-roles.mjs first (no cp_worker role)'); process.exit(1); }

const args = new Set(process.argv.slice(2));
const MODE = args.has('--watch') ? 'watch' : args.has('--once') ? 'once' : 'drain';

const { default: pg } = await import('pg');
// The worker connects as the LEAST-PRIVILEGE cp_worker role — never superuser, never Directus.
const CONN = `postgres://${rt.dbRoles.workerUser}:${rt.dbRoles.workerPassword}@${rt.host}:${rt.port}/${rt.database}`;

// Execute ONE genuinely-safe synthetic command. Returns a receipt object.
async function execute(client, cmd, cmdArgs) {
  const at = new Date().toISOString();
  if (cmd === 'recount_items') {
    const { rows } = await client.query('select count(*)::bigint as n from public.list_items');
    const n = Number(rows[0].n);
    await client.query(
      `insert into public.cockpit_metric (key, value, computed_by, computed_at)
       values ('list_items_total', $1, 'cp_worker', now())
       on conflict (key) do update set value = excluded.value, computed_by = excluded.computed_by, computed_at = excluded.computed_at`,
      [n]);
    return { ok: true, command: cmd, metric: 'list_items_total', value: n, worker: 'cp_worker', executed_at: at };
  }
  if (cmd === 'recount_checked') {
    const { rows } = await client.query('select count(*)::bigint as n from public.list_items where is_checked');
    const n = Number(rows[0].n);
    await client.query(
      `insert into public.cockpit_metric (key, value, computed_by, computed_at)
       values ('list_items_checked', $1, 'cp_worker', now())
       on conflict (key) do update set value = excluded.value, computed_by = excluded.computed_by, computed_at = excluded.computed_at`,
      [n]);
    return { ok: true, command: cmd, metric: 'list_items_checked', value: n, worker: 'cp_worker', executed_at: at };
  }
  if (cmd === 'echo') {
    return { ok: true, command: cmd, echoed: cmdArgs?.message ?? null, worker: 'cp_worker', executed_at: at };
  }
  return { ok: false, command: cmd, error: 'unknown command (not executed)', worker: 'cp_worker', executed_at: at };
}

// Atomically claim + execute + receipt ONE request. Returns the row id or null if queue empty.
async function drainOne(client) {
  await client.query('begin');
  try {
    const claim = await client.query(
      `select id, command, args from public.command_request
        where status = 'requested'
        order by requested_at
        for update skip locked
        limit 1`);
    if (claim.rowCount === 0) { await client.query('commit'); return null; }
    const row = claim.rows[0];
    await client.query(`update public.command_request set status='claimed', claimed_at=now() where id=$1`, [row.id]);

    let receipt, finalStatus;
    try {
      receipt = await execute(client, row.command, row.args);
      finalStatus = receipt.ok ? 'done' : 'failed';
    } catch (e) {
      receipt = { ok: false, command: row.command, error: String(e.message || e), worker: 'cp_worker' };
      finalStatus = 'failed';
    }
    await client.query(
      `update public.command_request set status=$2, receipt=$3::jsonb, completed_at=now() where id=$1`,
      [row.id, finalStatus, JSON.stringify(receipt)]);
    await client.query('commit');
    console.log(`[worker] ${finalStatus.toUpperCase()} ${row.command} (${row.id}) -> ${JSON.stringify(receipt)}`);
    return row.id;
  } catch (e) {
    await client.query('rollback').catch(() => {});
    throw e;
  }
}

const client = new pg.Client({ connectionString: CONN });
await client.connect();
console.log(`[worker] connected as ${rt.dbRoles.workerUser} (least-privilege) — mode=${MODE}`);
try {
  if (MODE === 'once') {
    const id = await drainOne(client);
    console.log(id ? '[worker] drained 1 request.' : '[worker] queue empty.');
  } else if (MODE === 'drain') {
    let count = 0; while (await drainOne(client)) count++;
    console.log(`[worker] drained ${count} request(s); queue empty.`);
  } else { // watch
    console.log('[worker] watching queue (poll 1s). Ctrl-C to stop.');
    // eslint-disable-next-line no-constant-condition
    while (true) { while (await drainOne(client)) { /* drain burst */ } await new Promise((r) => setTimeout(r, 1000)); }
  }
} finally {
  await client.end();
}
