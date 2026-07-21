// BUILD-014 — prove PRIVATE S21 access to the Directus cockpit over the tailnet HTTPS route.
// Hits the TAILNET URL (not localhost) and validates Warwick's acceptance list:
//   1. unauthenticated access denied
//   2. admin login succeeds
//   3. real AsdAIr Regulars visible (91)
//   4. one constrained write-back succeeds + produces its receipt (synthetic-first)
//   5. the old mypka-cockpit is NOT in the request path (serve proxies straight to Directus)
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'file:///C:/Fusion247PKA/services/control-plane/node_modules/pg/lib/index.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const cfg = JSON.parse(fs.readFileSync(path.join(here, '.runtime-live', 'directus-live.env.json'), 'utf8'));
const rt = JSON.parse(fs.readFileSync(path.join(here, '.runtime-live', 'runtime.json'), 'utf8'));
const ca = fs.readFileSync(cfg.ssl_ca_file); const SSL = { ca, rejectUnauthorized: true };
const BASE = (rt.directus.publicUrl || 'https://warwick-yoga.tailbc1fe3.ts.net').replace(/\/$/, '');
const KEY = 'wpd-ts-' + Math.floor(Number(process.hrtime.bigint() % 1000000n));

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
  console.log('[prove] tailnet URL:', BASE, '\n');

  // 5. Path check first: the route proxies straight to Directus (not mypka-cockpit).
  console.log('Path — the tailnet route reaches Directus, not the old cockpit:');
  const ping = await fetch(`${BASE}/server/ping`); const pingTxt = await ping.text();
  ok(ping.ok && pingTxt.includes('pong'), `GET /server/ping over tailnet -> ${ping.status} "${pingTxt.trim()}" (Directus health endpoint)`);
  const serve = spawnSync('C:/Program Files/Tailscale/tailscale.exe', ['serve', 'status'], { encoding: 'utf8' }).stdout || '';
  ok(/127\.0\.0\.1:8074/.test(serve) && !/cockpit|4317/.test(serve), 'serve config proxies to 127.0.0.1:8074 (Directus) — mypka-cockpit not in the path');

  // 1. Unauthenticated denied.
  console.log('1) unauthenticated access denied:');
  const un = await fetch(`${BASE}/items/regulars`);
  ok(un.status === 401 || un.status === 403, `no-token GET /items/regulars -> HTTP ${un.status} (denied)`);

  // 2. Admin login.
  console.log('2) admin login over the private route:');
  const login = await fetch(`${BASE}/auth/login`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email: rt.directus.adminEmail, password: rt.directus.adminPassword }) });
  ok(login.ok, `POST /auth/login -> HTTP ${login.status}`);
  const token = (await login.json()).data.access_token;
  const H = { authorization: `Bearer ${token}`, 'content-type': 'application/json' };

  // 3. Real regulars visible.
  console.log('3) real AsdAIr Regulars visible:');
  const cnt = Number((await (await fetch(`${BASE}/items/regulars?aggregate[count]=*`, { headers: H })).json())?.data?.[0]?.count);
  ok(cnt === 91, `GET /items/regulars count -> ${cnt} (91 real rows)`);

  // 4. One constrained write-back + receipt (synthetic target so real data is untouched).
  console.log('4) one constrained write-back succeeds + receipt:');
  householdId = (await admin.query(`insert into asdair.households (name, display_name) values ($1,$2) returning id`, [`__wpd_ts__ ${KEY}`, 'WP-D synthetic (tailnet proof)'])).rows[0].id;
  regularId = (await admin.query(`insert into asdair.regulars (household_id, name, source, typical_qty) values ($1,$2,'regular',1) returning id`, [householdId, `SYNTH Tea ${KEY}`])).rows[0].id;
  const post = await fetch(`${BASE}/items/command_request`, { method: 'POST', headers: H, body: JSON.stringify({ requested_by: 'cockpit:warwick', command: 'add_regular_to_next_week', args: { regular_id: regularId, qty: 2 }, idempotency_key: `${KEY}-a` }) });
  ok(post.ok, `POST /items/command_request (the write) -> HTTP ${post.status}`);
  const w = spawnSync(process.execPath, [path.join(here, 'asdair-worker.mjs'), '--drain', `--key-prefix=${KEY}`], { encoding: 'utf8' });
  process.stdout.write((w.stdout || '').split('\n').filter((l) => l.includes('[worker]')).map((l) => '    ' + l).join('\n') + '\n');
  const done = (await admin.query(`select status, receipt from asdair.command_request where idempotency_key=$1`, [`${KEY}-a`])).rows[0];
  ok(done.status === 'done' && done.receipt?.ok === true, `write-back completed with receipt (status=${done.status}, receipt.ok=${done.receipt?.ok})`);
  listId = done.receipt?.list_id;
  const item = (await admin.query(`select requested_qty from asdair.shopping_list_items where list_id=$1`, [listId])).rows;
  ok(item.length === 1 && item[0].requested_qty === 2, 'the effect landed (item added to the synthetic next_week_draft list)');

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
main().catch((e) => { console.error('[prove] error', e.message); fail++; }).finally(async () => { await cleanup(); await admin.end().catch(()=>{}); process.exit(fail === 0 ? 0 : 1); });
