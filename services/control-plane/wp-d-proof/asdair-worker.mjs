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
import { execute } from './asdairCommands.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const cfg = JSON.parse(fs.readFileSync(path.join(here, '.runtime-live', 'directus-live.env.json'), 'utf8'));
if (!cfg.worker_password) { console.error('[worker] run provision-writeback-live.mjs first (no cp_worker)'); process.exit(1); }
const ca = fs.readFileSync(cfg.ssl_ca_file);

const rawArgs = process.argv.slice(2);
const argv = new Set(rawArgs);
const MODE = argv.has('--watch') ? 'watch' : argv.has('--once') ? 'once' : 'drain';
// --key-prefix=<pfx>: claim ONLY intents whose idempotency_key starts with <pfx>. The
// synthetic-first proofs pass their own throwaway prefix so a proof can NEVER drain a real
// pending request (fixes review finding: an unscoped --drain would execute real queued rows).
const keyPrefixArg = rawArgs.find((a) => a.startsWith('--key-prefix='));
const KEY_PREFIX = keyPrefixArg ? keyPrefixArg.slice('--key-prefix='.length) : null;

// ALLOWLIST + execute() now live in asdairCommands.mjs (importable + testable against a throwaway
// Postgres). The worker's behaviour is unchanged — it just sources the handlers from there.

async function drainOne(client) {
  await client.query('begin');
  try {
    const claim = await client.query(
      `select id, command, args from asdair.command_request
        where status = 'requested' and ($1::text is null or idempotency_key like $1 || '%')
        order by requested_at for update skip locked limit 1`, [KEY_PREFIX]);
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
