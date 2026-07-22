// BUILD-002 WP4 — SYNTHETIC end-to-end proof of the full decision loop with correlation throughout.
//   node wp-d-proof/prove-full-loop.mjs
// outbound decision_card  ->  inbound Telegram tap (mapped)  ->  decision_response filed
//   ->  worker matches + creates correlated follow_on_task  ->  resume consumer SEES it (Larry awake)
//   ->  continue via command_request close_follow_on  ->  result_event + receipt.
// Every hop is correlated by id; every hop leaves a receipt. No real Telegram send.
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'file:///C:/Fusion247PKA/services/control-plane/node_modules/pg/lib/index.js';
import { decisionCallbackData } from '../../hub/decision/telegramInbound.mjs';
import { fileInboundDecision } from './file-inbound-decision.mjs';
import { listOpenFollowOns } from './resume-followups.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const cfg = JSON.parse(fs.readFileSync(path.join(here, '.runtime-live', 'directus-live.env.json'), 'utf8'));
const SSL = { ca: fs.readFileSync(cfg.ssl_ca_file), rejectUnauthorized: true };
const KEY = 'floop-' + Math.floor(Number(process.hrtime.bigint() % 1000000n));

function gatewayDsn() {
  const env = fs.readFileSync('C:/.fusion247/fusion-capture-gateway.env', 'utf8');
  const u = new URL(env.split(/\r?\n/).find((l) => l.startsWith('DATABASE_URL=')).slice('DATABASE_URL='.length).trim());
  return { host: u.hostname, port: Number(u.port || 5432), user: decodeURIComponent(u.username), password: decodeURIComponent(u.password), database: (u.pathname || '/postgres').slice(1) || 'postgres', ssl: SSL };
}
const admin = new pg.Client(gatewayDsn());
const cockpit = new pg.Client({ host: cfg.host, port: cfg.port, database: cfg.database, user: cfg.pooler_user, password: cfg.password, ssl: SSL });
let pass = 0, fail = 0;
const ok = (c, m) => { if (c) { pass++; console.log('  PASS', m); } else { fail++; console.log('  FAIL', m); } };
function worker(script, extra = []) { const r = spawnSync(process.execPath, [path.join(here, script), '--drain', `--key-prefix=${KEY}`, ...extra], { encoding: 'utf8' }); process.stdout.write(r.stdout.split('\n').filter((l) => /\[(resp|cmd)\]/.test(l)).map((l) => '    ' + l).join('\n') + '\n'); if (r.status !== 0) throw new Error(`${script} exited ${r.status}`); }

const OPTS = JSON.stringify([{ key: 'A', label: 'Accept — build it' }, { key: 'B', label: 'Decline' }]);
let cardId, taskId;

async function main() {
  await admin.connect(); await cockpit.connect();

  console.log('1) OUTBOUND — a decision card is filed (dry-run, nothing sent):');
  cardId = (await admin.query(
    `insert into cockpit.decision_card (requested_by,target,subject,body_markdown,options,related_ref,is_synthetic,idempotency_key)
     values ('cockpit:warwick','devbot:warwick','Ship the AI Assessment pilot?','body',$1::jsonb,'learning_candidate:synthetic',true,$2) returning id`,
    [OPTS, `${KEY}-card`])).rows[0].id;
  ok(true, `card ${String(cardId).slice(0, 8)} filed`);

  console.log('2) INBOUND — an ACTUAL Telegram button tap flows through the inbound handler:');
  // The exact callback_query Telegram delivers when Warwick taps the "A" button on the sent card. Its
  // callback_data is what apply-decision-card put on the button (decision:<card_id>:A) — self-correlating.
  const update = { callback_query: { id: `${KEY}-cb`, data: decisionCallbackData(cardId, 'A'), from: { id: 777 } } };
  const filed = await fileInboundDecision(cockpit, update, { keyPrefix: `${KEY}-` });
  ok(filed.filed && String(filed.card_id) === String(cardId) && filed.raw_text === 'A', 'the tap is mapped to this card and a decision_response intent is filed by cp_directus');
  // Idempotent: a re-delivered identical update does not double-file.
  const dupe = await fileInboundDecision(cockpit, update, { keyPrefix: `${KEY}-` });
  ok(dupe.filed === false, 'a re-delivered identical tap does NOT double-file (idempotent inbound)');

  console.log('3) worker parses the answer + creates correlated follow-on work:');
  worker('apply-decision-response.mjs');
  const resp = (await admin.query(`select status, chosen_key, receipt from cockpit.decision_response where idempotency_key=$1`, [filed.idempotency_key])).rows[0];
  ok(resp.status === 'done' && resp.chosen_key === 'A' && resp.receipt?.matched === true, 'answer -> done, matched A');
  taskId = resp.receipt?.follow_on_task_id;
  ok(taskId, 'a follow_on_task was created');
  const fo = (await admin.query(`select correlation_id, status, origin from cockpit.follow_on_task where id=$1`, [taskId])).rows[0];
  ok(String(fo.correlation_id) === String(cardId) && fo.origin === 'decision_response' && fo.status === 'open', 'follow_on_task correlated to the ORIGINAL card, open');

  console.log('4) RESUME — Larry (awake) sees the open task via the resumption consumer:');
  const open = await listOpenFollowOns(admin);
  const mine = open.find((t) => String(t.id) === String(taskId));
  ok(Boolean(mine), 'the task appears in the open-work queue Larry resumes from');
  ok(mine && mine.card_subject === 'Ship the AI Assessment pilot?', 'the consumer shows the correlated card subject (full provenance)');

  console.log('5) CONTINUE — Larry closes the task via the command route (receipted):');
  await cockpit.query(`insert into cockpit.command_request (requested_by, command, args, idempotency_key) values ('cockpit:larry','close_follow_on',$1::jsonb,$2)`,
    [JSON.stringify({ task_id: taskId }), `${KEY}-close`]);
  worker('apply-command-request.mjs');
  const cmd = (await admin.query(`select status, result_event, receipt from cockpit.command_request where idempotency_key=$1`, [`${KEY}-close`])).rows[0];
  ok(cmd.status === 'done' && cmd.result_event?.event === 'follow_on_closed' && String(cmd.result_event?.task_id) === String(taskId), 'close command -> done, result_event references the task');
  ok((await admin.query(`select status from cockpit.follow_on_task where id=$1`, [taskId])).rows[0].status === 'done', 'the follow_on_task is now closed');

  console.log('6) CORRELATION CHAIN intact end-to-end:');
  ok(String(resp.receipt.card_id) === String(cardId) && String(fo.correlation_id) === String(cardId) && String(cmd.result_event.task_id) === String(taskId),
    'card_id → response → follow_on → command all reference the same originating card/task');

  console.log(`\nRESULT: ${fail === 0 ? 'PASS ✓' : 'FAIL ✗'} — ${pass} passed, ${fail} failed`);
}
async function cleanup() {
  try {
    if (taskId) await admin.query(`delete from cockpit.follow_on_task where id=$1`, [taskId]);
    await admin.query(`delete from cockpit.command_request where idempotency_key like $1`, [`${KEY}-%`]);
    await admin.query(`delete from cockpit.decision_response where idempotency_key like $1`, [`${KEY}-%`]);
    await admin.query(`delete from cockpit.decision_card where idempotency_key like $1`, [`${KEY}-%`]);
    console.log('[cleanup] synthetic rows removed.');
  } catch (e) { console.log('[cleanup] WARN', e.message); }
}
main().catch((e) => { console.error('[full-loop] error', e.message); fail++; }).finally(async () => { await cleanup(); await admin.end().catch(()=>{}); await cockpit.end().catch(()=>{}); process.exit(fail === 0 ? 0 : 1); });
