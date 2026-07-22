// BUILD-002 QA2 point 2 — crash/restart lease-reclaim proof (representative: decision_response).
//   node wp-d-proof/prove-crash-reclaim.mjs
// Proves the shared claim/reclaim primitive: a row left 'claimed' by a crashed worker is reclaimed once
// its lease expires and applied to completion; a freshly-claimed row (live lease) is NOT stolen; no row
// is left permanently claimed; and re-processing produces no duplicate durable effect.
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'file:///C:/Fusion247PKA/services/control-plane/node_modules/pg/lib/index.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const cfg = JSON.parse(fs.readFileSync(path.join(here, '.runtime-live', 'directus-live.env.json'), 'utf8'));
const SSL = { ca: fs.readFileSync(cfg.ssl_ca_file), rejectUnauthorized: true };
const KEY = 'crash-' + Math.floor(Number(process.hrtime.bigint() % 1000000n));
function gatewayDsn() {
  const env = fs.readFileSync('C:/.fusion247/fusion-capture-gateway.env', 'utf8');
  const u = new URL(env.split(/\r?\n/).find((l) => l.startsWith('DATABASE_URL=')).slice('DATABASE_URL='.length).trim());
  return { host: u.hostname, port: Number(u.port || 5432), user: decodeURIComponent(u.username), password: decodeURIComponent(u.password), database: (u.pathname || '/postgres').slice(1) || 'postgres', ssl: SSL };
}
const admin = new pg.Client(gatewayDsn());
const cockpit = new pg.Client({ host: cfg.host, port: cfg.port, database: cfg.database, user: cfg.pooler_user, password: cfg.password, ssl: SSL });
let pass = 0, fail = 0;
const ok = (c, m) => { if (c) { pass++; console.log('  PASS', m); } else { fail++; console.log('  FAIL', m); } };
function runWorker() { const r = spawnSync(process.execPath, [path.join(here, 'apply-decision-response.mjs'), '--drain', `--key-prefix=${KEY}`], { encoding: 'utf8' }); if (r.status !== 0) throw new Error('worker exited ' + r.status); }
const OPTS = JSON.stringify([{ key: 'A', label: 'Accept' }, { key: 'B', label: 'Decline' }]);
let cardId;

async function main() {
  await admin.connect(); await cockpit.connect();
  cardId = (await admin.query(`insert into cockpit.decision_card (requested_by,target,subject,body_markdown,options,is_synthetic,idempotency_key) values ('x','t','Crash test','b',$1::jsonb,true,$2) returning id`, [OPTS, `${KEY}-card`])).rows[0].id;

  console.log('1) a STALE claimed row (crashed worker) is reclaimed + completed:');
  await cockpit.query(`insert into cockpit.decision_response (card_id, responder, raw_text, idempotency_key) values ($1,'x','A',$2)`, [cardId, `${KEY}-stale`]);
  // Simulate crash-after-claim: mark claimed with an EXPIRED lease (claimed 10 min ago), never applied.
  await admin.query(`update cockpit.decision_response set status='claimed', claimed_at=now() - interval '10 minutes' where idempotency_key=$1`, [`${KEY}-stale`]);
  ok((await admin.query(`select status from cockpit.decision_response where idempotency_key=$1`, [`${KEY}-stale`])).rows[0].status === 'claimed', 'row is stuck claimed (simulated crash after claim)');
  runWorker();
  const rec = (await admin.query(`select status, receipt from cockpit.decision_response where idempotency_key=$1`, [`${KEY}-stale`])).rows[0];
  ok(rec.status === 'done' && rec.receipt?.matched === true, 'the stale claim was RECLAIMED and applied to done');
  ok((await admin.query(`select count(*)::int n from cockpit.follow_on_task where correlation_id=$1 and origin='decision_response'`, [cardId])).rows[0].n === 1, 'exactly one durable follow_on_task (no duplicate effect)');
  ok((await admin.query(`select count(*)::int n from cockpit.decision_response where status='claimed' and idempotency_key like $1`, [`${KEY}%`])).rows[0].n === 0, 'no row left permanently claimed');

  console.log('2) a FRESHLY claimed row (live lease) is NOT stolen:');
  await cockpit.query(`insert into cockpit.decision_response (card_id, responder, raw_text, idempotency_key) values ($1,'x','B',$2)`, [cardId, `${KEY}-fresh`]);
  await admin.query(`update cockpit.decision_response set status='claimed', claimed_at=now() where idempotency_key=$1`, [`${KEY}-fresh`]); // live lease
  runWorker();
  ok((await admin.query(`select status from cockpit.decision_response where idempotency_key=$1`, [`${KEY}-fresh`])).rows[0].status === 'claimed', 'the live-lease row was left alone (lease not expired) — not double-processed');

  console.log('3) re-running the worker does not re-process the done row (idempotent drain):');
  runWorker();
  ok((await admin.query(`select count(*)::int n from cockpit.follow_on_task where correlation_id=$1 and origin='decision_response'`, [cardId])).rows[0].n === 1, 'still exactly one follow_on_task after a second drain');

  console.log(`\nRESULT: ${fail === 0 ? 'PASS ✓' : 'FAIL ✗'} — ${pass} passed, ${fail} failed`);
}
async function cleanup() {
  try { await admin.query(`delete from cockpit.follow_on_task where correlation_id=$1`, [cardId]); await admin.query(`delete from cockpit.decision_response where idempotency_key like $1`, [`${KEY}%`]); await admin.query(`delete from cockpit.decision_card where idempotency_key like $1`, [`${KEY}%`]); console.log('[cleanup] done.'); } catch (e) { console.log('[cleanup] WARN', e.message); }
}
main().catch((e) => { console.error('[crash] error', e.message); fail++; }).finally(async () => { await cleanup(); await admin.end().catch(()=>{}); await cockpit.end().catch(()=>{}); process.exit(fail === 0 ? 0 : 1); });
