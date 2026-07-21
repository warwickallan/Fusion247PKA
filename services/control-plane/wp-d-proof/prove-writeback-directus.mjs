// BUILD-014 — prove the AsdAIr write-back END-TO-END THROUGH DIRECTUS (no SQL/terminal):
// a POST to the Directus API creates the INTENT (Directus writes as cp_directus), the trusted
// worker executes it, the receipt lands. Synthetic-first: a throwaway household only.
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'file:///C:/Fusion247PKA/services/control-plane/node_modules/pg/lib/index.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const cfg = JSON.parse(fs.readFileSync(path.join(here, '.runtime-live', 'directus-live.env.json'), 'utf8'));
const rt = JSON.parse(fs.readFileSync(path.join(here, '.runtime-live', 'runtime.json'), 'utf8'));
const ca = fs.readFileSync(cfg.ssl_ca_file); const SSL = { ca, rejectUnauthorized: true };
const base = rt.directus.url;
const KEY = 'wpd-dxs-' + Math.floor(Number(process.hrtime.bigint() % 1000000n));

function gatewayDsn() {
  const env = fs.readFileSync('C:/.fusion247/fusion-capture-gateway.env', 'utf8');
  const u = new URL(env.split(/\r?\n/).find((l) => l.startsWith('DATABASE_URL=')).slice(13).trim());
  return { host: u.hostname, port: 5432, user: decodeURIComponent(u.username), password: decodeURIComponent(u.password), database: 'postgres', ssl: SSL };
}
const admin = new pg.Client(gatewayDsn());
let pass = 0, fail = 0; const ok = (c, m) => { c ? (pass++, console.log('  PASS', m)) : (fail++, console.log('  FAIL', m)); };

let householdId, regularId, listId;
async function main() {
  await admin.connect();
  for (let i = 0; i < 40; i++) { try { if ((await (await fetch(`${base}/server/ping`)).text()).includes('pong')) break; } catch {} await new Promise((r) => setTimeout(r, 1000)); }

  householdId = (await admin.query(`insert into asdair.households (name, display_name) values ($1,$2) returning id`, [`__wpd_dxs__ ${KEY}`, 'WP-D synthetic (Directus loop)'])).rows[0].id;
  regularId = (await admin.query(`insert into asdair.regulars (household_id, name, source, typical_qty) values ($1,$2,'regular',1) returning id`, [householdId, `SYNTH Bananas ${KEY}`])).rows[0].id;

  const token = (await (await fetch(`${base}/auth/login`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email: rt.directus.adminEmail, password: rt.directus.adminPassword }) })).json()).data.access_token;
  const H = { authorization: `Bearer ${token}`, 'content-type': 'application/json' };

  console.log('1) POST the intent through the Directus API (this is the no-terminal write):');
  const post = await fetch(`${base}/items/command_request`, { method: 'POST', headers: H,
    body: JSON.stringify({ requested_by: 'cockpit:warwick', command: 'add_regular_to_next_week', args: { regular_id: regularId, qty: 3 }, idempotency_key: `${KEY}-a` }) });
  ok(post.ok, `Directus API accepted the intent (HTTP ${post.status})`);
  const landed = (await admin.query(`select status, receipt from asdair.command_request where idempotency_key=$1`, [`${KEY}-a`])).rows[0];
  ok(landed && landed.status === 'requested' && landed.receipt === null, 'intent landed status=requested (Directus requested, did not execute)');

  console.log('2) worker executes it:');
  const w = spawnSync(process.execPath, [path.join(here, 'asdair-worker.mjs'), '--drain'], { encoding: 'utf8' });
  process.stdout.write(w.stdout.split('\n').filter((l) => l.includes('[worker]')).map((l) => '    ' + l).join('\n') + '\n');
  const done = (await admin.query(`select status, receipt from asdair.command_request where idempotency_key=$1`, [`${KEY}-a`])).rows[0];
  ok(done.status === 'done' && done.receipt?.ok === true, 'worker completed it, receipt.ok');
  listId = done.receipt?.list_id;
  const item = (await admin.query(`select requested_qty from asdair.shopping_list_items where list_id=$1`, [listId])).rows;
  ok(item.length === 1 && item[0].requested_qty === 3, 'real effect: item added to the synthetic next_week_draft via a Directus-originated request');

  console.log(`\nRESULT: ${fail === 0 ? 'PASS ✓' : 'FAIL ✗'} — ${pass} passed, ${fail} failed`);
}
async function cleanup() {
  try {
    if (listId) await admin.query(`delete from asdair.shopping_list_items where list_id=$1`, [listId]);
    if (householdId) {
      await admin.query(`delete from asdair.shopping_lists where household_id=$1`, [householdId]);
      await admin.query(`delete from asdair.regulars where household_id=$1`, [householdId]);
      await admin.query(`delete from asdair.command_request where idempotency_key like $1`, [`${KEY}-%`]);
      await admin.query(`delete from asdair.households where id=$1`, [householdId]);
    }
    console.log('[cleanup] synthetic rows removed (real data untouched).');
  } catch (e) { console.log('[cleanup] WARNING', e.message, 'marker', KEY); }
}
main().catch((e) => { console.error('[dxs] error', e.message); fail++; }).finally(async () => { await cleanup(); await admin.end().catch(()=>{}); process.exit(fail === 0 ? 0 : 1); });
