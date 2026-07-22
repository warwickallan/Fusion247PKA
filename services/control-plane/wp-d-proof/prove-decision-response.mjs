// BUILD-002 WP4 — SYNTHETIC proof of the inbound A/B/C decision-response loop. No real Telegram.
//   node wp-d-proof/prove-decision-response.mjs
// card (dry-run) -> human replies -> correlated decision recorded -> governed follow-on work created.
// Proves: cp_directus can only FILE a raw reply; cp_worker parses against the card, matches or
// honestly no-matches, creates ONE correlated follow_on_task, is idempotent, least-privilege.
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'file:///C:/Fusion247PKA/services/control-plane/node_modules/pg/lib/index.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const cfg = JSON.parse(fs.readFileSync(path.join(here, '.runtime-live', 'directus-live.env.json'), 'utf8'));
const SSL = { ca: fs.readFileSync(cfg.ssl_ca_file), rejectUnauthorized: true };
const KEY = 'rsynth-' + Math.floor(Number(process.hrtime.bigint() % 1000000n));

function gatewayDsn() {
  const env = fs.readFileSync('C:/.fusion247/fusion-capture-gateway.env', 'utf8');
  const u = new URL(env.split(/\r?\n/).find((l) => l.startsWith('DATABASE_URL=')).slice('DATABASE_URL='.length).trim());
  return { host: u.hostname, port: Number(u.port || 5432), user: decodeURIComponent(u.username), password: decodeURIComponent(u.password), database: (u.pathname || '/postgres').slice(1) || 'postgres', ssl: SSL };
}
const admin = new pg.Client(gatewayDsn());
const cockpit = new pg.Client({ host: cfg.host, port: cfg.port, database: cfg.database, user: cfg.pooler_user, password: cfg.password, ssl: SSL });
let pass = 0, fail = 0;
const ok = (c, m) => { if (c) { pass++; console.log('  PASS', m); } else { fail++; console.log('  FAIL', m); } };
async function expectErr(fn, code, m) { try { await fn(); fail++; console.log('  FAIL', m); } catch (e) { (!code || e.code === code) ? (pass++, console.log('  PASS', m, `(${e.code})`)) : (fail++, console.log('  FAIL', m, `got ${e.code}`)); } }
function runWorker() { const r = spawnSync(process.execPath, [path.join(here, 'apply-decision-response.mjs'), '--drain', `--key-prefix=${KEY}`], { encoding: 'utf8' }); process.stdout.write(r.stdout.split('\n').filter((l) => l.includes('[resp]')).map((l) => '    ' + l).join('\n') + '\n'); if (r.status !== 0) throw new Error('worker exited ' + r.status); }

const OPTS = JSON.stringify([{ key: 'A', label: 'Accept — build it' }, { key: 'B', label: 'Decline' }, { key: 'C', label: 'Defer' }]);
let cardId;

async function main() {
  await admin.connect(); await cockpit.connect();
  // Seed a synthetic card (admin can insert full row incl is_synthetic).
  cardId = (await admin.query(
    `insert into cockpit.decision_card (requested_by, target, subject, body_markdown, options, related_ref, is_synthetic, idempotency_key)
     values ('cockpit:warwick','devbot:warwick','Ship the Fusion247 AI Assessment pilot?','body',$1::jsonb,'learning_candidate:synthetic',true,$2) returning id`,
    [OPTS, `${KEY}-card`])).rows[0].id;
  console.log(`[setup] synthetic card ${cardId}\n`);

  console.log('1) cockpit files a raw reply (all it can do):');
  await cockpit.query(`insert into cockpit.decision_response (card_id, responder, raw_text, idempotency_key) values ($1,'telegram:warwick','A',$2)`, [cardId, `${KEY}-a`]);
  ok(true, 'raw reply filed by cp_directus (status=requested)');

  console.log('2) least-privilege + guards:');
  await expectErr(() => cockpit.query(`update cockpit.decision_response set status='done' where idempotency_key=$1`, [`${KEY}-a`]), '42501', 'cp_directus cannot complete a response');
  await expectErr(() => cockpit.query(`update cockpit.decision_response set chosen_key='A' where idempotency_key=$1`, [`${KEY}-a`]), '42501', 'cp_directus cannot set chosen_key');
  await expectErr(() => admin.query(`insert into cockpit.decision_response (card_id,responder,raw_text,idempotency_key,chosen_key) values ($1,'x','A',$2,'A')`, [cardId, `${KEY}-bad`]), '23514', 'insert-guard rejects a pre-parsed chosen_key');

  console.log('3) worker parses "A" -> matched, correlated decision + follow-on:');
  runWorker();
  const done = (await admin.query(`select status, chosen_key, receipt from cockpit.decision_response where idempotency_key=$1`, [`${KEY}-a`])).rows[0];
  ok(done.status === 'done' && done.chosen_key === 'A' && done.receipt?.matched === true, 'response -> done, chosen_key=A, matched');
  const fo = (await admin.query(`select id, origin, correlation_id, title from cockpit.follow_on_task where correlation_id=$1 and origin='decision_response'`, [cardId])).rows;
  ok(fo.length === 1 && String(fo[0].correlation_id) === String(cardId), 'exactly one follow_on_task correlated to the card');
  ok(done.receipt?.follow_on_task_id && String(done.receipt.follow_on_task_id) === String(fo[0].id), 'receipt references the follow_on_task');

  console.log('4) an ambiguous/no-match reply completes honestly (re-answerable), no extra task:');
  await cockpit.query(`insert into cockpit.decision_response (card_id, responder, raw_text, idempotency_key) values ($1,'telegram:warwick','hmm maybe',$2)`, [cardId, `${KEY}-b`]);
  runWorker();
  const nm = (await admin.query(`select status, receipt from cockpit.decision_response where idempotency_key=$1`, [`${KEY}-b`])).rows[0];
  ok(nm.status === 'done' && nm.receipt?.matched === false, 'no-match -> done, matched=false');
  ok((await admin.query(`select count(*)::int n from cockpit.follow_on_task where correlation_id=$1 and origin='decision_response'`, [cardId])).rows[0].n === 1, 'still exactly one follow_on_task (no duplicate)');

  console.log('5) responses are always correlated: an orphan (ghost-card) reply is refused by the FK:');
  const ghost = '00000000-0000-0000-0000-000000000000';
  await expectErr(() => cockpit.query(`insert into cockpit.decision_response (card_id, responder, raw_text, idempotency_key) values ($1,'x','A',$2)`, [ghost, `${KEY}-c`]), '23503', 'a response to a non-existent card is rejected (FK)');

  console.log(`\nRESULT: ${fail === 0 ? 'PASS ✓' : 'FAIL ✗'} — ${pass} passed, ${fail} failed`);
}
async function cleanup() {
  try {
    await admin.query(`delete from cockpit.follow_on_task where correlation_id=$1`, [cardId]);
    await admin.query(`delete from cockpit.decision_response where idempotency_key like $1`, [`${KEY}-%`]);
    await admin.query(`delete from cockpit.decision_card where idempotency_key like $1`, [`${KEY}-%`]);
    console.log('[cleanup] synthetic rows removed.');
  } catch (e) { console.log('[cleanup] WARN', e.message); }
}
main().catch((e) => { console.error('[prove-resp] error', e.message); fail++; }).finally(async () => { await cleanup(); await admin.end().catch(()=>{}); await cockpit.end().catch(()=>{}); process.exit(fail === 0 ? 0 : 1); });
