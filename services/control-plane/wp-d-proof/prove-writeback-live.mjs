// BUILD-014 — SYNTHETIC-FIRST proof of the AsdAIr write-back trust seam.
//
//   node wp-d-proof/prove-writeback-live.mjs
//
// Exercises the FULL seam against a THROWAWAY synthetic household only — the real household
// (id 1) is never touched. Proves: allowlisted execution, least-privilege asymmetry,
// idempotency (command + effect), receipt logging, and the guard triggers. Cleans up after.
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'file:///C:/Fusion247PKA/services/control-plane/node_modules/pg/lib/index.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const cfg = JSON.parse(fs.readFileSync(path.join(here, '.runtime-live', 'directus-live.env.json'), 'utf8'));
const ca = fs.readFileSync(cfg.ssl_ca_file);
const SSL = { ca, rejectUnauthorized: true };
const KEYPFX = 'wpd-synth-' + Math.floor(Number(process.hrtime.bigint() % 1000000n));

function gatewayDsn() {
  const env = fs.readFileSync('C:/.fusion247/fusion-capture-gateway.env', 'utf8');
  const u = new URL(env.split(/\r?\n/).find((l) => l.startsWith('DATABASE_URL=')).slice('DATABASE_URL='.length).trim());
  return { host: u.hostname, port: Number(u.port || 5432), user: decodeURIComponent(u.username),
    password: decodeURIComponent(u.password), database: (u.pathname || '/postgres').slice(1) || 'postgres', ssl: SSL };
}
const admin  = new pg.Client(gatewayDsn());
const cockpit = new pg.Client({ host: cfg.host, port: cfg.port, database: cfg.database, user: cfg.pooler_user, password: cfg.password, ssl: SSL });
const worker = new pg.Client({ host: cfg.host, port: cfg.port, database: cfg.database, user: cfg.worker_pooler_user, password: cfg.worker_password, ssl: SSL });

let pass = 0, fail = 0;
const ok = (cond, msg) => { if (cond) { pass++; console.log('  PASS', msg); } else { fail++; console.log('  FAIL', msg); } };
async function expectErr(fn, code, msg) {
  try { await fn(); fail++; console.log('  FAIL', msg, '(expected error, got success)'); }
  catch (e) { const good = !code || e.code === code; if (good) { pass++; console.log('  PASS', msg, `(${e.code})`); } else { fail++; console.log('  FAIL', msg, `(got ${e.code}, wanted ${code})`); } }
}
function drainWorker() {
  const r = spawnSync(process.execPath, [path.join(here, 'asdair-worker.mjs'), '--drain'], { encoding: 'utf8' });
  process.stdout.write(r.stdout.split('\n').filter((l) => l.includes('[worker]')).map((l) => '    ' + l).join('\n') + '\n');
  if (r.status !== 0) throw new Error('worker exited ' + r.status + ' ' + r.stderr);
}

let householdId, regularId, listId = null;
async function main() {
  await admin.connect(); await cockpit.connect(); await worker.connect();

  // ---- Setup: a synthetic household + a synthetic regular under it. ----
  householdId = (await admin.query(
    `insert into asdair.households (name, display_name, notes) values ($1,$2,$3) returning id`,
    [`__wpd_synthetic__ ${KEYPFX}`, 'WP-D synthetic (not a real household)', 'throwaway; write-back proof'])).rows[0].id;
  regularId = (await admin.query(
    `insert into asdair.regulars (household_id, name, category, source, typical_qty) values ($1,$2,$3,'regular',1) returning id`,
    [householdId, `SYNTH Oat Milk ${KEYPFX}`, 'Milk'])).rows[0].id;
  console.log(`[setup] synthetic household ${householdId}, synthetic regular ${regularId}\n`);

  // ---- 1. POSITIVE: the cockpit role inserts an INTENT (all it can do) ----
  console.log('1) cockpit inserts an intent (add_regular_to_next_week qty=2):');
  await cockpit.query(
    `insert into asdair.command_request (requested_by, command, args, idempotency_key)
     values ('cockpit:warwick', 'add_regular_to_next_week', $1::jsonb, $2)`,
    [JSON.stringify({ regular_id: regularId, qty: 2 }), `${KEYPFX}-a`]);
  const q1 = await admin.query(`select status, receipt from asdair.command_request where idempotency_key=$1`, [`${KEYPFX}-a`]);
  ok(q1.rows[0].status === 'requested' && q1.rows[0].receipt === null, 'intent lands status=requested, no receipt');

  // ---- 2. NEGATIVE: cockpit CANNOT execute or write the effect directly ----
  console.log('2) least-privilege asymmetry (cockpit cannot execute):');
  await expectErr(() => cockpit.query(`update asdair.command_request set status='done' where idempotency_key=$1`, [`${KEYPFX}-a`]), '42501', 'cockpit UPDATE command_request denied');
  await expectErr(() => cockpit.query(`insert into asdair.shopping_list_items (list_id, item_name, requested_qty) values (999999,'x',1)`), '42501', 'cockpit INSERT shopping_list_items denied');

  // ---- 3. Worker executes -> effect + receipt ----
  console.log('3) worker drains the queue:');
  drainWorker();
  const done = (await admin.query(`select status, receipt from asdair.command_request where idempotency_key=$1`, [`${KEYPFX}-a`])).rows[0];
  ok(done.status === 'done' && done.receipt?.ok === true && done.receipt?.action === 'inserted', 'intent -> done, receipt.ok, action=inserted');
  listId = done.receipt?.list_id;
  const item = (await admin.query(`select item_name, requested_qty from asdair.shopping_list_items where list_id=$1`, [listId])).rows;
  ok(item.length === 1 && item[0].requested_qty === 2, 'exactly one item added to the synthetic next_week_draft list, qty=2');

  // ---- 4. IDEMPOTENCY (command): same idempotency_key -> unique violation ----
  console.log('4) idempotency:');
  await expectErr(() => cockpit.query(
    `insert into asdair.command_request (requested_by, command, args, idempotency_key)
     values ('cockpit:warwick','add_regular_to_next_week', $1::jsonb, $2)`,
    [JSON.stringify({ regular_id: regularId, qty: 9 }), `${KEYPFX}-a`]), '23505', 'duplicate idempotency_key rejected');

  //     IDEMPOTENCY (effect): a NEW intent for the same regular updates, never duplicates.
  await cockpit.query(
    `insert into asdair.command_request (requested_by, command, args, idempotency_key)
     values ('cockpit:warwick','add_regular_to_next_week', $1::jsonb, $2)`,
    [JSON.stringify({ regular_id: regularId, qty: 5 }), `${KEYPFX}-b`]);
  drainWorker();
  const items2 = (await admin.query(`select requested_qty from asdair.shopping_list_items where list_id=$1`, [listId])).rows;
  ok(items2.length === 1 && items2[0].requested_qty === 5, 'replay updates the SAME item to qty=5 (no duplicate row)');

  // ---- 5. ALLOWLIST: a non-allowlisted command fails, no effect ----
  console.log('5) allowlist enforcement:');
  await cockpit.query(
    `insert into asdair.command_request (requested_by, command, args, idempotency_key)
     values ('cockpit:warwick','drop_all_the_things', '{}'::jsonb, $1)`, [`${KEYPFX}-evil`]);
  drainWorker();
  const evil = (await admin.query(`select status, receipt from asdair.command_request where idempotency_key=$1`, [`${KEYPFX}-evil`])).rows[0];
  ok(evil.status === 'failed' && evil.receipt?.ok === false && /allowlist/.test(evil.receipt?.error || ''), 'non-allowlisted command -> failed, not executed');

  // ---- 6. Worker asymmetry: cp_worker cannot fabricate intents; guard blocks bad insert ----
  console.log('6) worker cannot request; insert-guard belt-and-braces:');
  await expectErr(() => worker.query(
    `insert into asdair.command_request (requested_by, command, args, idempotency_key)
     values ('w','x','{}'::jsonb,$1)`, [`${KEYPFX}-w`]), '42501', 'cp_worker INSERT command_request denied');
  await expectErr(() => admin.query(
    `insert into asdair.command_request (requested_by, command, args, idempotency_key, status)
     values ('a','x','{}'::jsonb,$1,'claimed')`, [`${KEYPFX}-g`]), '23514', 'insert-guard rejects status!=requested (even for a privileged conn)');

  console.log(`\nRESULT: ${fail === 0 ? 'PASS ✓' : 'FAIL ✗'} — ${pass} passed, ${fail} failed`);
}

async function cleanup() {
  try {
    if (listId) await admin.query(`delete from asdair.shopping_list_items where list_id=$1`, [listId]);
    if (householdId) {
      await admin.query(`delete from asdair.shopping_lists where household_id=$1`, [householdId]);
      await admin.query(`delete from asdair.regulars where household_id=$1`, [householdId]);
      await admin.query(`delete from asdair.command_request where idempotency_key like $1`, [`${KEYPFX}-%`]);
      await admin.query(`delete from asdair.households where id=$1`, [householdId]);
    }
    console.log('[cleanup] synthetic household + all its rows removed (real data untouched).');
  } catch (e) { console.log('[cleanup] WARNING:', e.message, '- synthetic marker:', KEYPFX); }
}

main()
  .catch((e) => { console.error('[prove-wb] error', e.message); fail++; })
  .finally(async () => { await cleanup(); await admin.end().catch(()=>{}); await cockpit.end().catch(()=>{}); await worker.end().catch(()=>{}); process.exit(fail === 0 ? 0 : 1); });
