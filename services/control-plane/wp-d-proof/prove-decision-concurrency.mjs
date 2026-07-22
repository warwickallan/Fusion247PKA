// BUILD-002 QA2 finding A — GENUINE two-connection concurrency proof for decision follow-on creation.
//   node wp-d-proof/prove-decision-concurrency.mjs
// Two DISTINCT cp_worker connections both try to create the decision follow_on_task for the SAME card
// AT THE SAME TIME. The partial unique index (correlation_id, origin) + INSERT ... ON CONFLICT DO
// NOTHING must guarantee EXACTLY ONE task — no duplicate under true concurrency.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'file:///C:/Fusion247PKA/services/control-plane/node_modules/pg/lib/index.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const cfg = JSON.parse(fs.readFileSync(path.join(here, '.runtime-live', 'directus-live.env.json'), 'utf8'));
const SSL = { ca: fs.readFileSync(cfg.ssl_ca_file), rejectUnauthorized: true };
const KEY = 'dconc-' + Math.floor(Number(process.hrtime.bigint() % 1000000n));
function gatewayDsn() {
  const env = fs.readFileSync('C:/.fusion247/fusion-capture-gateway.env', 'utf8');
  const u = new URL(env.split(/\r?\n/).find((l) => l.startsWith('DATABASE_URL=')).slice('DATABASE_URL='.length).trim());
  return { host: u.hostname, port: Number(u.port || 5432), user: decodeURIComponent(u.username), password: decodeURIComponent(u.password), database: (u.pathname || '/postgres').slice(1) || 'postgres', ssl: SSL };
}
const admin = new pg.Client(gatewayDsn());
const w1 = new pg.Client({ host: cfg.host, port: cfg.port, database: cfg.database, user: cfg.worker_pooler_user, password: cfg.worker_password, ssl: SSL });
const w2 = new pg.Client({ host: cfg.host, port: cfg.port, database: cfg.database, user: cfg.worker_pooler_user, password: cfg.worker_password, ssl: SSL });
let pass = 0, fail = 0;
const ok = (c, m) => { if (c) { pass++; console.log('  PASS', m); } else { fail++; console.log('  FAIL', m); } };
const OPTS = JSON.stringify([{ key: 'A', label: 'Accept' }, { key: 'B', label: 'Decline' }]);
let cardId;

// One worker connection's guarded insert of the decision follow_on_task (mirrors the worker's txn).
async function tryCreate(cx, tag) {
  await cx.query('begin');
  try {
    const r = await cx.query(
      `insert into cockpit.follow_on_task (origin, correlation_id, title, detail, created_by)
       values ('decision_response',$1,$2,$3,$4)
       on conflict (correlation_id, origin) where origin='decision_response' and correlation_id is not null do nothing
       returning id`,
      [cardId, `Decision ${tag}`, 'detail', 'test']);
    await cx.query('commit');
    return r.rows[0]?.id ?? null;
  } catch (e) { await cx.query('rollback').catch(() => {}); return { error: e.message }; }
}

async function main() {
  await admin.connect(); await w1.connect(); await w2.connect();
  cardId = (await admin.query(
    `insert into cockpit.decision_card (requested_by,target,subject,body_markdown,options,is_synthetic,idempotency_key)
     values ('cockpit:warwick','devbot:warwick','Concurrency test','b',$1::jsonb,true,$2) returning id`, [OPTS, `${KEY}-card`])).rows[0].id;

  console.log('two DISTINCT connections create the decision task for the same card CONCURRENTLY:');
  const [r1, r2] = await Promise.all([tryCreate(w1, 'w1'), tryCreate(w2, 'w2')]);
  ok(!r1?.error && !r2?.error, `no error on either connection (r1=${JSON.stringify(r1)}, r2=${JSON.stringify(r2)})`);
  const created = [r1, r2].filter((x) => typeof x === 'string');
  ok(created.length === 1, 'EXACTLY ONE connection created the task; the other got DO NOTHING');
  const count = (await admin.query(`select count(*)::int n from cockpit.follow_on_task where correlation_id=$1 and origin='decision_response'`, [cardId])).rows[0].n;
  ok(count === 1, 'exactly one follow_on_task row exists for the card (no duplicate under concurrency)');

  console.log(`\nRESULT: ${fail === 0 ? 'PASS ✓' : 'FAIL ✗'} — ${pass} passed, ${fail} failed`);
}
async function cleanup() {
  try { await admin.query(`delete from cockpit.follow_on_task where correlation_id=$1`, [cardId]); await admin.query(`delete from cockpit.decision_card where idempotency_key like $1`, [`${KEY}-%`]); console.log('[cleanup] done.'); } catch (e) { console.log('[cleanup] WARN', e.message); }
}
main().catch((e) => { console.error('[conc] error', e.message); fail++; }).finally(async () => { await cleanup(); await admin.end().catch(()=>{}); await w1.end().catch(()=>{}); await w2.end().catch(()=>{}); process.exit(fail === 0 ? 0 : 1); });
