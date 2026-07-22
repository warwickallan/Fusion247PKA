// BUILD-002 WP4 — SYNTHETIC proof of the safe Directus command route.
//   node wp-d-proof/prove-command-request.mjs
// Directus action -> validated command_request -> queue -> worker -> result_event + receipt.
// Proves: cp_directus can only file an intent; cp_worker executes ONLY allowlisted commands, emits a
// result event, and FAILS CLOSED (never executes) on an unknown/malformed command. Least-privilege.
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'file:///C:/Fusion247PKA/services/control-plane/node_modules/pg/lib/index.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const cfg = JSON.parse(fs.readFileSync(path.join(here, '.runtime-live', 'directus-live.env.json'), 'utf8'));
const SSL = { ca: fs.readFileSync(cfg.ssl_ca_file), rejectUnauthorized: true };
const KEY = 'csynth-' + Math.floor(Number(process.hrtime.bigint() % 1000000n));

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
function runWorker() { const r = spawnSync(process.execPath, [path.join(here, 'apply-command-request.mjs'), '--drain', `--key-prefix=${KEY}`], { encoding: 'utf8' }); process.stdout.write(r.stdout.split('\n').filter((l) => l.includes('[cmd]')).map((l) => '    ' + l).join('\n') + '\n'); if (r.status !== 0) throw new Error('worker exited ' + r.status); }

let taskId;
async function main() {
  await admin.connect(); await cockpit.connect();
  taskId = (await admin.query(`insert into cockpit.follow_on_task (origin, source_video_id, title, created_by, is_synthetic) values ('learning_accept',$1,'synthetic task','test',true) returning id`, [`CSYNTH-${KEY}`])).rows[0].id;
  console.log(`[setup] synthetic follow_on_task ${taskId}\n`);

  console.log('1) cockpit files command intents (all it can do):');
  await cockpit.query(`insert into cockpit.command_request (requested_by, command, args, idempotency_key) values ('cockpit:warwick','ping','{}'::jsonb,$1)`, [`${KEY}-ping`]);
  await cockpit.query(`insert into cockpit.command_request (requested_by, command, args, idempotency_key) values ('cockpit:warwick','close_follow_on',$1::jsonb,$2)`, [JSON.stringify({ task_id: taskId }), `${KEY}-close`]);
  await cockpit.query(`insert into cockpit.command_request (requested_by, command, args, idempotency_key) values ('cockpit:warwick','rm_rf_everything','{}'::jsonb,$1)`, [`${KEY}-evil`]);
  await cockpit.query(`insert into cockpit.command_request (requested_by, command, args, idempotency_key) values ('cockpit:warwick','close_follow_on','{}'::jsonb,$1)`, [`${KEY}-badargs`]);
  ok(true, '4 intents filed by cp_directus');

  console.log('2) least-privilege + guards:');
  await expectErr(() => cockpit.query(`update cockpit.command_request set status='done' where idempotency_key=$1`, [`${KEY}-ping`]), '42501', 'cp_directus cannot complete a command');
  await expectErr(() => cockpit.query(`update cockpit.command_request set result_event='{}'::jsonb where idempotency_key=$1`, [`${KEY}-ping`]), '42501', 'cp_directus cannot write a result_event');
  await expectErr(() => admin.query(`insert into cockpit.command_request (requested_by,command,args,idempotency_key) values ('a','ping','[]'::jsonb,$1)`, [`${KEY}-bad`]), '23514', 'check rejects non-object args');

  console.log('3) worker executes the allowlisted commands + emits result events:');
  runWorker();
  const ping = (await admin.query(`select status, result_event from cockpit.command_request where idempotency_key=$1`, [`${KEY}-ping`])).rows[0];
  ok(ping.status === 'done' && ping.result_event?.event === 'pong', 'ping -> done, result_event.pong');
  const close = (await admin.query(`select status, result_event from cockpit.command_request where idempotency_key=$1`, [`${KEY}-close`])).rows[0];
  ok(close.status === 'done' && close.result_event?.event === 'follow_on_closed', 'close_follow_on -> done, result_event emitted');
  ok((await admin.query(`select status from cockpit.follow_on_task where id=$1`, [taskId])).rows[0].status === 'done', 'the follow_on_task was actually closed (real effect)');

  console.log('4) FAIL CLOSED — unknown + malformed commands are never executed:');
  const evil = (await admin.query(`select status, receipt from cockpit.command_request where idempotency_key=$1`, [`${KEY}-evil`])).rows[0];
  ok(evil.status === 'failed' && /allowlist/.test(evil.receipt?.error || ''), 'unknown command -> failed (not in allowlist), never executed');
  const bad = (await admin.query(`select status, receipt from cockpit.command_request where idempotency_key=$1`, [`${KEY}-badargs`])).rows[0];
  ok(bad.status === 'failed' && /task_id/.test(bad.receipt?.error || ''), 'malformed args -> failed (validation), never executed');

  console.log(`\nRESULT: ${fail === 0 ? 'PASS ✓' : 'FAIL ✗'} — ${pass} passed, ${fail} failed`);
}
async function cleanup() {
  try {
    await admin.query(`delete from cockpit.command_request where idempotency_key like $1`, [`${KEY}-%`]);
    await admin.query(`delete from cockpit.follow_on_task where source_video_id like $1`, [`CSYNTH-${KEY}`]);
    console.log('[cleanup] synthetic rows removed.');
  } catch (e) { console.log('[cleanup] WARN', e.message); }
}
main().catch((e) => { console.error('[prove-cmd] error', e.message); fail++; }).finally(async () => { await cleanup(); await admin.end().catch(()=>{}); await cockpit.end().catch(()=>{}); process.exit(fail === 0 ? 0 : 1); });
