// BUILD-002 WP3 — SYNTHETIC-FIRST proof of the learning Accept/Decline seam. Real candidates untouched.
//   node wp-d-proof/prove-learning-apply.mjs
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'file:///C:/Fusion247PKA/services/control-plane/node_modules/pg/lib/index.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const cfg = JSON.parse(fs.readFileSync(path.join(here, '.runtime-live', 'directus-live.env.json'), 'utf8'));
const SSL = { ca: fs.readFileSync(cfg.ssl_ca_file), rejectUnauthorized: true };
const KEY = 'lsynth-' + Math.floor(Number(process.hrtime.bigint() % 1000000n));

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
function runWorker() { const r = spawnSync(process.execPath, [path.join(here, 'apply-learning-command.mjs'), '--drain', `--key-prefix=${KEY}`], { encoding: 'utf8' }); process.stdout.write(r.stdout.split('\n').filter((l) => l.includes('[learn]')).map((l) => '    ' + l).join('\n') + '\n'); if (r.status !== 0) throw new Error('worker exited ' + r.status); }

async function main() {
  await admin.connect(); await cockpit.connect();
  const cand = (await admin.query(`insert into cockpit.learning_candidate (source_video_id, candidate_ref, recommendation, status) values ($1,'LC-SYNTH','synthetic candidate','pending') returning id`, [`SYNTH-${KEY}`])).rows[0].id;
  console.log(`[setup] synthetic candidate ${cand}\n`);

  console.log('1) cockpit files an accept intent (all it can do):');
  await cockpit.query(`insert into cockpit.learning_command (requested_by, command, candidate_id, idempotency_key) values ('cockpit:warwick','accept',$1,$2)`, [cand, `${KEY}-a`]);
  ok(true, 'intent inserted by cp_directus');

  console.log('2) least-privilege asymmetry:');
  await expectErr(() => cockpit.query(`update cockpit.learning_candidate set status='accepted' where id=$1`, [cand]), '42501', 'cp_directus cannot directly change candidate status');
  await expectErr(() => cockpit.query(`update cockpit.learning_command set status='done' where idempotency_key=$1`, [`${KEY}-a`]), '42501', 'cp_directus cannot execute the intent');

  console.log('3) worker applies accept:');
  runWorker();
  ok((await admin.query(`select status from cockpit.learning_candidate where id=$1`, [cand])).rows[0].status === 'accepted', 'candidate -> accepted');
  const cmd = (await admin.query(`select status, receipt from cockpit.learning_command where idempotency_key=$1`, [`${KEY}-a`])).rows[0];
  ok(cmd.status === 'done' && cmd.receipt?.ok === true && cmd.receipt?.new_status === 'accepted', 'intent -> done, receipt.ok, new_status=accepted');

  console.log('3b) accept created GOVERNED FOLLOW-ON WORK (not a silent edit):');
  const fo = (await admin.query(`select id, origin, source_candidate_id, source_video_id, status, title from cockpit.follow_on_task where source_candidate_id=$1`, [cand])).rows;
  ok(fo.length === 1 && fo[0].origin === 'learning_accept' && fo[0].status === 'open', 'exactly one open follow_on_task from the accept');
  ok(String(fo[0].source_candidate_id) === String(cand) && fo[0].source_video_id === `SYNTH-${KEY}`, 'follow_on_task correlated to candidate + source');
  ok(cmd.receipt?.follow_on_task_id && String(cmd.receipt.follow_on_task_id) === String(fo[0].id), 'receipt references the follow_on_task id');

  console.log('4) decline path:');
  const cand2 = (await admin.query(`insert into cockpit.learning_candidate (source_video_id, candidate_ref, recommendation, status) values ($1,'LC-SYNTH2','synthetic 2','pending') returning id`, [`SYNTH-${KEY}`])).rows[0].id;
  await cockpit.query(`insert into cockpit.learning_command (requested_by, command, candidate_id, note, idempotency_key) values ('cockpit:warwick','decline',$1,'not now',$2)`, [cand2, `${KEY}-d`]);
  runWorker();
  ok((await admin.query(`select status from cockpit.learning_candidate where id=$1`, [cand2])).rows[0].status === 'declined', 'decline -> candidate declined');
  ok((await admin.query(`select count(*)::int n from cockpit.follow_on_task where source_candidate_id=$1`, [cand2])).rows[0].n === 0, 'decline created NO follow_on_task');

  console.log('5) QA2-B correction: ACCEPT then DECLINE drops the stale open task (no contradictory work):');
  const cand3 = (await admin.query(`insert into cockpit.learning_candidate (source_video_id, candidate_ref, recommendation, status) values ($1,'LC-SYNTH3','synthetic 3','pending') returning id`, [`SYNTH-${KEY}`])).rows[0].id;
  await cockpit.query(`insert into cockpit.learning_command (requested_by, command, candidate_id, idempotency_key) values ('cockpit:warwick','accept',$1,$2)`, [cand3, `${KEY}-e1`]);
  runWorker();
  ok((await admin.query(`select status from cockpit.follow_on_task where source_candidate_id=$1`, [cand3])).rows[0]?.status === 'open', 'accept -> open task');
  await cockpit.query(`insert into cockpit.learning_command (requested_by, command, candidate_id, note, idempotency_key) values ('cockpit:warwick','decline',$1,'changed my mind',$2)`, [cand3, `${KEY}-e2`]);
  runWorker();
  const t3 = (await admin.query(`select status from cockpit.follow_on_task where source_candidate_id=$1`, [cand3])).rows[0];
  ok(t3?.status === 'dropped', 'decline-after-accept -> the open task is DROPPED (not left contradictory)');
  const dcmd = (await admin.query(`select receipt from cockpit.learning_command where idempotency_key=$1`, [`${KEY}-e2`])).rows[0];
  ok(dcmd.receipt?.prev_status === 'accepted' && dcmd.receipt?.new_status === 'declined' && dcmd.receipt?.dropped_follow_on_task_id, 'receipt records prev=accepted, new=declined, and the dropped task id');

  console.log('5b) RE-ACCEPT after decline REOPENS the dropped task (full reversal, no orphaned state):');
  await cockpit.query(`insert into cockpit.learning_command (requested_by, command, candidate_id, idempotency_key) values ('cockpit:warwick','accept',$1,$2)`, [cand3, `${KEY}-e3`]);
  runWorker();
  const t3b = (await admin.query(`select status from cockpit.follow_on_task where source_candidate_id=$1`, [cand3])).rows;
  ok(t3b.length === 1 && t3b[0].status === 'open', 're-accept -> the SAME task is REOPENED to open (candidate accepted + an open task exists again)');
  ok((await admin.query(`select status from cockpit.learning_candidate where id=$1`, [cand3])).rows[0].status === 'accepted', 'candidate is accepted again');

  console.log(`\nRESULT: ${fail === 0 ? 'PASS ✓' : 'FAIL ✗'} — ${pass} passed, ${fail} failed`);
}
async function cleanup() {
  try { await admin.query(`delete from cockpit.follow_on_task where source_video_id like $1`, [`SYNTH-${KEY}`]); await admin.query(`delete from cockpit.learning_command where idempotency_key like $1`, [`${KEY}-%`]); await admin.query(`delete from cockpit.learning_candidate where source_video_id like $1`, [`SYNTH-${KEY}`]); console.log('[cleanup] synthetic rows removed.'); } catch (e) { console.log('[cleanup] WARN', e.message); }
}
main().catch((e) => { console.error('[prove-learn] error', e.message); fail++; }).finally(async () => { await cleanup(); await admin.end().catch(()=>{}); await cockpit.end().catch(()=>{}); process.exit(fail === 0 ? 0 : 1); });
