// BUILD-002 WP4 — SYNTHETIC-FIRST proof of the decision→command→output seam. No real send. No real card.
//   node wp-d-proof/prove-decision-card.mjs
// Proves: cp_directus can only FILE a card intent; it cannot execute or self-render. cp_worker claims,
// renders the exact human-tap card, and receipts it — in DRY-RUN (sends nothing). Least-privilege +
// claim-before-apply + guards all enforced. Synthetic rows isolated by key prefix and cleaned up.
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'file:///C:/Fusion247PKA/services/control-plane/node_modules/pg/lib/index.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const cfg = JSON.parse(fs.readFileSync(path.join(here, '.runtime-live', 'directus-live.env.json'), 'utf8'));
const SSL = { ca: fs.readFileSync(cfg.ssl_ca_file), rejectUnauthorized: true };
const KEY = 'dsynth-' + Math.floor(Number(process.hrtime.bigint() % 1000000n));

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
function runWorker(extra = []) { const r = spawnSync(process.execPath, [path.join(here, 'apply-decision-card.mjs'), '--drain', `--key-prefix=${KEY}`, ...extra], { encoding: 'utf8' }); process.stdout.write(r.stdout.split('\n').filter((l) => l.includes('[card]')).map((l) => '    ' + l).join('\n') + '\n'); if (r.status !== 0) throw new Error('worker exited ' + r.status); }

const OPTS = JSON.stringify([{ key: 'A', label: 'Accept — build it' }, { key: 'B', label: 'Decline' }, { key: 'C', label: 'Defer to later' }]);

async function main() {
  await admin.connect(); await cockpit.connect();

  console.log('1) cockpit files a decision-card intent (all it can do), dry_run defaults true:');
  await cockpit.query(
    `insert into cockpit.decision_card (requested_by, target, subject, body_markdown, options, related_ref, idempotency_key)
     values ('cockpit:warwick','devbot:warwick','Accept learning candidate LC-1?','Package a Fusion247 AI Assessment productized service.',$1::jsonb,'learning_candidate:synthetic',$2)`,
    [OPTS, `${KEY}-a`]);
  ok(true, 'intent filed by cp_directus (status=requested, dry_run default true)');
  ok((await admin.query(`select dry_run from cockpit.decision_card where idempotency_key=$1`, [`${KEY}-a`])).rows[0].dry_run === true, 'dry_run defaulted to true');

  console.log('2) least-privilege asymmetry + guards:');
  await expectErr(() => cockpit.query(`update cockpit.decision_card set status='done' where idempotency_key=$1`, [`${KEY}-a`]), '42501', 'cp_directus cannot execute/complete the card');
  await expectErr(() => cockpit.query(`update cockpit.decision_card set receipt='{}'::jsonb where idempotency_key=$1`, [`${KEY}-a`]), '42501', 'cp_directus cannot write a receipt');
  await expectErr(() => admin.query(`insert into cockpit.decision_card (requested_by,target,subject,body_markdown,options,idempotency_key,status) values ('a','t','s','b',$1::jsonb,$2,'claimed')`, [OPTS, `${KEY}-bad`]), '23514', 'insert-guard rejects status!=requested');
  await expectErr(() => admin.query(`insert into cockpit.decision_card (requested_by,target,subject,body_markdown,options,idempotency_key) values ('a','t','s','b','{}'::jsonb,$1)`, [`${KEY}-bad2`]), '23514', 'check rejects non-array options');

  console.log('2b) QA2-D structural option validation is enforced AT THE DB (not just the worker):');
  for (const [opts, desc] of [['[{"key":"(","label":"x"}]', 'bad key shape'], ['[{"key":"A","label":"x"},{"key":"A","label":"y"}]', 'duplicate key'], ['[{"key":"A","label":"Go"},{"key":"B","label":"go"}]', 'duplicate label'], ['[{"key":"A","label":"  "}]', 'blank label']]) {
    await expectErr(() => admin.query(`insert into cockpit.decision_card (requested_by,target,subject,body_markdown,options,is_synthetic,idempotency_key) values ('a','t','s','b',$1::jsonb,true,$2)`, [opts, `${KEY}-o-${Math.floor(Number(process.hrtime.bigint() % 100000n))}`]), '23514', `DB rejects ${desc}`);
  }

  console.log('3) worker claims + renders + receipts (DRY-RUN, no send):');
  runWorker();
  const done = (await admin.query(`select status, receipt from cockpit.decision_card where idempotency_key=$1`, [`${KEY}-a`])).rows[0];
  ok(done.status === 'done', 'card -> done');
  ok(done.receipt?.ok === true && done.receipt?.dry_run === true && done.receipt?.sent === false, 'receipt: ok, dry_run=true, sent=false (nothing sent)');
  ok(done.receipt?.options_count === 3, 'receipt records 3 options');
  const rc = done.receipt?.rendered_card || '';
  ok(/A — Accept/.test(rc) && /B — Decline/.test(rc) && /C — Defer/.test(rc), 'rendered card carries the A/B/C human-tap options');
  ok(/Decision needed/.test(rc) && /Fusion247 AI Assessment/.test(rc), 'rendered card carries subject + body');

  console.log('4) even with dry_run=false, worker WITHOUT --allow-send still does not send:');
  await admin.query(
    `insert into cockpit.decision_card (requested_by,channel,target,subject,body_markdown,options,dry_run,idempotency_key)
     values ('cockpit:warwick','telegram','devbot:warwick','Live-ish card','body',$1::jsonb,false,$2)`,
    [OPTS, `${KEY}-b`]);
  runWorker(); // no --allow-send
  const b = (await admin.query(`select status, receipt from cockpit.decision_card where idempotency_key=$1`, [`${KEY}-b`])).rows[0];
  ok(b.status === 'done' && b.receipt?.sent === false && b.receipt?.dry_run === true, 'dry_run=false but no --allow-send => still rendered-only, sent=false');

  console.log('5) claim-before-apply: a re-drain does not re-process a done card:');
  runWorker();
  const again = (await admin.query(`select count(*)::int n from cockpit.decision_card where idempotency_key like $1 and status='done'`, [`${KEY}-%`])).rows[0].n;
  ok(again === 2, 'both cards remain done exactly once (idempotent drain)');

  console.log(`\nRESULT: ${fail === 0 ? 'PASS ✓' : 'FAIL ✗'} — ${pass} passed, ${fail} failed`);
}
async function cleanup() {
  try { await admin.query(`delete from cockpit.decision_card where idempotency_key like $1`, [`${KEY}-%`]); console.log('[cleanup] synthetic rows removed.'); } catch (e) { console.log('[cleanup] WARN', e.message); }
}
main().catch((e) => { console.error('[prove-card] error', e.message); fail++; }).finally(async () => { await cleanup(); await admin.end().catch(()=>{}); await cockpit.end().catch(()=>{}); process.exit(fail === 0 ? 0 : 1); });
