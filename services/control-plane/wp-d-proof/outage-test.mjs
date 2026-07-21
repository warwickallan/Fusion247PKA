// BUILD-014 WP-D increment 2 — OUTAGE-INDEPENDENCE + full seam trace.
//
//   node wp-d-proof/outage-test.mjs   (provision + setup + db-roles + start must have run)
//
// Proves the core claim of the write-back seam: DIRECTUS IS A VIEW/CONTROL SURFACE,
// NOT THE RUNTIME. The trusted worker + Postgres keep the system live even when
// Directus is down.
//
// Transcript:
//   Phase 0 (Directus UP)   — cockpit REQUESTS a command via the Directus API; the
//                             trusted worker CLAIMS + EXECUTES + writes a RECEIPT.
//   Phase 1 (Directus DOWN) — queue a second request via Directus, STOP Directus, then
//                             show the worker STILL drains it to done (data+runtime
//                             survive Directus being down).
//   Phase 2 (Directus BACK) — restart Directus; the completed row + receipt are intact.
//
// Exits non-zero if any phase assertion fails.

import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const RUNTIME = path.join(__dirname, '.runtime');
const rt = JSON.parse(fs.readFileSync(path.join(RUNTIME, 'runtime.json'), 'utf8'));
const base = rt.directus.url;

let fails = 0;
const ok = (name, cond, detail) => {
  if (cond) console.log(`  PASS  ${name}${detail ? ' — ' + detail : ''}`);
  else { fails++; console.log(`  FAIL  ${name}${detail ? ' — ' + detail : ''}`); }
};

async function req(method, url, token, body) {
  const r = await fetch(base + url, {
    method,
    headers: { 'content-type': 'application/json', ...(token ? { authorization: 'Bearer ' + token } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  let d = null; try { d = await r.json(); } catch { /* none */ }
  return { status: r.status, d };
}
async function directusUp() {
  try { const r = await fetch(base + '/server/ping'); return r.ok; } catch { return false; }
}
async function waitUp(ms = 30000) {
  const t0 = Date.now();
  while (Date.now() - t0 < ms) { if (await directusUp()) return true; await new Promise((r) => setTimeout(r, 500)); }
  return false;
}
async function waitDown(ms = 15000) {
  const t0 = Date.now();
  while (Date.now() - t0 < ms) { if (!(await directusUp())) return true; await new Promise((r) => setTimeout(r, 250)); }
  return false;
}
function runWorker() {
  const r = spawnSync(process.execPath, [path.join(__dirname, 'worker.mjs'), '--drain'], { encoding: 'utf8' });
  process.stdout.write(r.stdout || '');
  if (r.status !== 0) process.stderr.write(r.stderr || '');
  return r.stdout || '';
}
function stopDirectusOnly() {
  // Kill ONLY the Directus process (keep Postgres + .runtime intact — not stop.mjs).
  const pidFile = path.join(RUNTIME, 'directus.pid');
  if (!fs.existsSync(pidFile)) return;
  const pid = fs.readFileSync(pidFile, 'utf8').trim();
  const k = process.platform === 'win32'
    ? spawnSync('taskkill', ['/PID', pid, '/T', '/F'], { encoding: 'utf8' })
    : spawnSync('kill', ['-9', pid], { encoding: 'utf8' });
  console.log(`  [outage] killed Directus pid ${pid}: ${k.status === 0 ? 'ok' : (k.stderr || 'not running').trim()}`);
}
function startDirectus() {
  const r = spawnSync(process.execPath, [path.join(__dirname, 'start-directus.mjs')], { encoding: 'utf8' });
  process.stdout.write(r.stdout || '');
  if (r.status !== 0) process.stderr.write(r.stderr || '');
}

// Direct-DB helper (superuser, read-only assertions on completed state).
const { default: pg } = await import('pg');
async function dbQuery(sql, params) {
  const c = new pg.Client({ connectionString: `postgres://${rt.superuser}:${rt.password}@${rt.host}:${rt.port}/${rt.database}` });
  await c.connect();
  try { return (await c.query(sql, params)).rows; } finally { await c.end(); }
}

const viewerTok = (await req('POST', '/auth/login', null, { email: rt.directus.viewerEmail, password: rt.directus.viewerPassword })).d?.data?.access_token;
const adminTok  = (await req('POST', '/auth/login', null, { email: rt.directus.adminEmail,  password: rt.directus.adminPassword  })).d?.data?.access_token;

console.log('\n========================================================================');
console.log(' WP-D increment 2 — OUTAGE-INDEPENDENCE + write-back seam trace');
console.log('========================================================================');

// ---- PHASE 0: Directus UP — request via cockpit, worker executes, receipt back ----
console.log('\n--- PHASE 0: Directus UP — cockpit REQUESTS, worker EXECUTES ---');
ok('Directus is UP', await directusUp());
const idemA = 'outage-A-' + Date.now();
const reqA = await req('POST', '/items/command_request', viewerTok, {
  requested_by: 'viewer@wpd.example.com', command: 'recount_items', args: {}, idempotency_key: idemA });
const idA = reqA.d?.data?.id;
ok('cockpit inserted an INTENT row via Directus (status=requested)',
  reqA.status === 200 && reqA.d?.data?.status === 'requested' && reqA.d?.data?.receipt == null,
  `id=${idA}, status=${reqA.d?.data?.status}`);
console.log('  [seam] worker draining while Directus UP:');
runWorker();
const doneA = (await dbQuery(`select status, receipt from public.command_request where id = $1`, [idA]))[0];
ok('worker completed the request (status=done + receipt written)',
  doneA?.status === 'done' && doneA?.receipt?.ok === true,
  `status=${doneA?.status}, receipt=${JSON.stringify(doneA?.receipt)}`);
const metricA = (await dbQuery(`select key, value, computed_by from public.cockpit_metric where key = 'list_items_total'`))[0];
ok('safe command produced a visible side-effect (cockpit_metric)',
  !!metricA, `${metricA?.key}=${metricA?.value} by ${metricA?.computed_by}`);

// ---- PHASE 1: Directus DOWN — worker still drains a queued request to done ----
console.log('\n--- PHASE 1: Directus DOWN — worker drains the queue anyway ---');
const idemB = 'outage-B-' + Date.now();
const reqB = await req('POST', '/items/command_request', viewerTok, {
  requested_by: 'viewer@wpd.example.com', command: 'recount_checked', args: {}, idempotency_key: idemB });
const idB = reqB.d?.data?.id;
ok('queued a 2nd request via Directus (still UP at queue time)', reqB.status === 200 && !!idB, `id=${idB}`);
stopDirectusOnly();
ok('Directus is now DOWN (control surface offline)', await waitDown(), 'ping no longer answers');
const stillQueued = (await dbQuery(`select status from public.command_request where id = $1`, [idB]))[0];
ok('the queued request survives in Postgres while Directus is down', stillQueued?.status === 'requested', `status=${stillQueued?.status}`);
console.log('  [seam] worker draining while Directus is DOWN:');
runWorker();
const doneB = (await dbQuery(`select status, receipt, completed_at from public.command_request where id = $1`, [idB]))[0];
ok('worker STILL executed it to done WHILE DIRECTUS WAS DOWN (Postgres is the runtime)',
  doneB?.status === 'done' && doneB?.receipt?.ok === true,
  `status=${doneB?.status}, receipt=${JSON.stringify(doneB?.receipt)}`);

// ---- PHASE 2: Directus BACK — completed state is intact ----
console.log('\n--- PHASE 2: Directus RESTARTED — completed state intact ---');
startDirectus();
ok('Directus came back UP', await waitUp(), 'ping answers again');
const adminTok2 = (await req('POST', '/auth/login', null, { email: rt.directus.adminEmail, password: rt.directus.adminPassword })).d?.data?.access_token;
const viaApi = await req('GET', `/items/command_request/${idB}?fields=status,receipt`, adminTok2 || adminTok);
ok('the done request + receipt are visible again through the restarted cockpit',
  viaApi.status === 200 && viaApi.d?.data?.status === 'done' && viaApi.d?.data?.receipt?.ok === true,
  `status=${viaApi.d?.data?.status}`);

console.log('\n========================================================================');
console.log(fails === 0
  ? ' OUTAGE-INDEPENDENCE PROVEN: Directus is a view/control surface, not the runtime.'
  : ` OUTAGE TEST FAILED: ${fails} assertion(s) failed.`);
console.log('========================================================================');
process.exit(fails === 0 ? 0 : 1);
