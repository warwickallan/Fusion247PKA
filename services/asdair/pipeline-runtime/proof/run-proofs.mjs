// =====================================================================
// BUILD-015 AsdAIr Stage 1 - proof/run-proofs.mjs
//
// THE PROOFS. Real processes, real kills, real files, real restarts.
//
//   node proof/run-proofs.mjs [--keep]
//
// Everything here is executed, not asserted in prose. Each proof prints the
// evidence it is judging - pids, offsets, row counts, the Telegram server's own
// audit - so the transcript in RUNTIME-PROOF.md can be checked against reality
// rather than taken on trust.
//
// NOTHING IN THIS FILE TOUCHES THE REAL SHOPPERBOT, THE REAL DATABASE, OR ANY
// CREDENTIALS FILE. The runtime proofs run against a scratch state directory and
// a stand-in entry; the pipeline proofs run against a file-durable stand-in for
// Postgres and a file-backed stand-in for Telegram. The real 2026-07-27 list is
// never fetched, never acknowledged, and never consumed.
// =====================================================================

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

import { initServer, auditServer, readServer } from './fake-telegram-server.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const LAUNCHER = path.join(HERE, '..', 'ensure-asdair-runtime.mjs');
const CHILD = path.join(HERE, 'proof-child.mjs');
const RUN = path.join(HERE, '..', '.proof-run');
const KEEP = process.argv.includes('--keep');

const results = [];
let failures = 0;

function heading(n, title) {
  console.log(`\n${'='.repeat(72)}\nPROOF ${n} - ${title}\n${'='.repeat(72)}`);
}
function check(name, ok, evidence) {
  results.push({ name, ok, evidence });
  if (!ok) failures += 1;
  console.log(`  [${ok ? 'PASS' : 'FAIL'}] ${name}`);
  if (evidence !== undefined) console.log(`         ${typeof evidence === 'string' ? evidence : JSON.stringify(evidence)}`);
}
function sleep(ms) { Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms); }

function launcher(args, env = {}) {
  const r = spawnSync(process.execPath, [LAUNCHER, ...args], {
    encoding: 'utf8', windowsHide: true,
    env: { ...process.env, ASDAIR_RUNTIME_STATE_DIR: STATE, ...env },
  });
  return { status: r.status, out: `${r.stdout || ''}${r.stderr || ''}`.trim() };
}

function child(args) {
  const r = spawnSync(process.execPath, [CHILD, ...args], { encoding: 'utf8', windowsHide: true });
  const out = `${r.stdout || ''}${r.stderr || ''}`.trim();
  // 137 is a DELIBERATE crash injection. Anything else non-zero is the proof
  // harness itself being broken, and must be visible rather than swallowed.
  if (r.status !== 0 && r.status !== 137) console.log(`    !! proof child exited ${r.status}:\n${out.split('\n').map((l) => `       ${l}`).join('\n')}`);
  return { status: r.status, out };
}

function readJson(file, fallback = null) {
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch { return fallback; }
}

// ---------------------------------------------------------------------

fs.rmSync(RUN, { recursive: true, force: true });
fs.mkdirSync(RUN, { recursive: true });
const STATE = path.join(RUN, 'state');
fs.mkdirSync(STATE, { recursive: true });

console.log(`AsdAIr runtime proofs - ${new Date().toISOString()}`);
console.log(`host ${os.hostname()}   node ${process.version}   scratch ${RUN}`);

// =====================================================================
heading(1, 'A SECOND POLLER REFUSES TO START');
// getUpdates is single-consumer with no lease. Two pollers race the stream and
// the loser silently swallows the week's list. This is the whole safety
// argument, so it is proved with two real processes, not a unit test.
// =====================================================================
{
  const first = launcher(['--selftest']);
  console.log(first.out.split('\n').map((l) => `    ${l}`).join('\n'));
  const lock1 = readJson(path.join(STATE, 'runtime.pid'));
  check('the first launcher started a runtime and holds the lock',
    first.status === 0 && lock1 && lock1.state === 'running' && lock1.pid > 0,
    { pid: lock1 && lock1.pid, identity_verified: lock1 && lock1.identity_verified });

  const second = launcher(['--selftest']);
  console.log(second.out.split('\n').map((l) => `    ${l}`).join('\n'));
  check('a SECOND launcher refuses rather than starting a second poller',
    second.status === 0 && /REFUSING to start a SECOND poller/.test(second.out),
    second.out.split('\n')[0]);

  const lock2 = readJson(path.join(STATE, 'runtime.pid'));
  check('the refusal did not disturb the incumbent (same pid still holds the lock)',
    lock2 && lock2.pid === lock1.pid, { before: lock1.pid, after: lock2 && lock2.pid });

  // Three at once, from a cold start, is the race the naive read-then-write
  // loses. O_EXCL means exactly one can win.
  launcher(['--stop']);
  const racers = [0, 1, 2].map(() => spawn(process.execPath, [LAUNCHER, '--selftest'], {
    encoding: 'utf8', windowsHide: true,
    env: { ...process.env, ASDAIR_RUNTIME_STATE_DIR: STATE },
    stdio: ['ignore', 'pipe', 'pipe'],
  }));
  const outs = await Promise.all(racers.map((p) => new Promise((res) => {
    let buf = ''; p.stdout.on('data', (d) => { buf += d; }); p.stderr.on('data', (d) => { buf += d; });
    p.on('close', () => res(buf));
  })));
  const started = outs.filter((o) => /ONLINE/.test(o)).length;
  const refused = outs.filter((o) => /REFUSING|did not settle/.test(o)).length;
  check('three launchers racing from cold: exactly ONE runtime exists',
    started === 1, { started, refused, transcript: outs.map((o) => o.trim().split('\n').pop()) });

  const alive = spawnSync('powershell', ['-NoProfile', '-Command',
    `@(Get-CimInstance Win32_Process -Filter "Name='node.exe'" | Where-Object { $_.CommandLine -like '*selftest-entry.mjs*' }).Count`],
    { encoding: 'utf8', windowsHide: true }).stdout.trim();
  check('the operating system agrees: exactly one runtime process is alive', alive === '1',
    `Win32_Process count of selftest-entry.mjs = ${alive}`);
}

// =====================================================================
heading(2, 'STOP AND RESTART CLEANLY');
// =====================================================================
{
  const before = readJson(path.join(STATE, 'runtime.pid'));
  const stop = launcher(['--stop']);
  check('--stop stops the holder and reports which pid', stop.status === 0 && /stopped pid/.test(stop.out), stop.out);
  check('the lock file is removed once the process is provably gone',
    !fs.existsSync(path.join(STATE, 'runtime.pid')), 'runtime.pid absent');
  const gone = spawnSync('powershell', ['-NoProfile', '-Command',
    `@(Get-CimInstance Win32_Process -Filter "ProcessId=${before.pid}").Count`], { encoding: 'utf8', windowsHide: true }).stdout.trim();
  check('the stopped process is really gone', gone === '0', `Win32_Process count for pid ${before.pid} = ${gone}`);

  const idem = launcher(['--stop']);
  check('--stop on an already-stopped runtime is a clean no-op', idem.status === 0 && /not running/.test(idem.out), idem.out);

  const restart = launcher(['--restart', '--selftest']);
  check('--restart brings it back up', restart.status === 0 && /ONLINE/.test(restart.out), restart.out.split('\n').pop());
  const after = readJson(path.join(STATE, 'runtime.pid'));
  check('the restarted runtime is a NEW process, correctly re-identified',
    after && after.pid !== before.pid && after.identity_verified === true,
    { old_pid: before.pid, new_pid: after && after.pid });
}

// =====================================================================
heading(3, 'A STALE LOCK FROM A KILLED PROCESS IS NOT A LIVE POLLER');
// A pid file left behind by a killed process must not wedge the runtime out of
// ever starting again - and, just as importantly, a RECYCLED pid must not be
// mistaken for the runtime, because that turns --stop into "kill a stranger".
// =====================================================================
{
  const held = readJson(path.join(STATE, 'runtime.pid'));
  // Kill it the hard way, behind the launcher's back. The lock file survives.
  spawnSync('taskkill', ['/PID', String(held.pid), '/T', '/F'], { windowsHide: true });
  sleep(1200);
  check('the lock file still claims a pid after the process was hard-killed',
    fs.existsSync(path.join(STATE, 'runtime.pid')), readJson(path.join(STATE, 'runtime.pid')).pid);

  const st = launcher(['--status', '--no-db']);
  const status = JSON.parse(st.out);
  check('status calls the stale lock STALE, not running',
    status.runtime.running === false && status.runtime.lock_state === 'stale',
    status.runtime.reason);

  const start = launcher(['--selftest']);
  check('a start reclaims the stale lock and comes up',
    start.status === 0 && /reclaiming a stale lock/.test(start.out) && /ONLINE/.test(start.out),
    start.out.split('\n').filter((l) => /reclaim|ONLINE/.test(l)));

  // PID REUSE. Forge a lock that names a live process which is NOT the runtime.
  launcher(['--stop']);
  const forged = {
    state: 'running', pid: process.pid, process_created_at: '1999-01-01T00:00:00.0000000Z',
    fingerprint: 'selftest-entry.mjs', mode: 'selftest', identity_verified: true,
  };
  fs.writeFileSync(path.join(STATE, 'runtime.pid'), JSON.stringify(forged));
  const reused = JSON.parse(launcher(['--status', '--no-db']).out);
  check('a RECYCLED pid is not mistaken for the runtime (creation time is bound into the lock)',
    reused.runtime.lock_state === 'stale' && /REUSED/.test(reused.runtime.reason), reused.runtime.reason);

  const stopForged = launcher(['--stop']);
  check('--stop refuses to kill the innocent process holding that recycled pid',
    !/stopped pid/.test(stopForged.out) && /stale/.test(stopForged.out), stopForged.out);
  check('...and this proof runner is still alive to say so', true, `pid ${process.pid} still running`);

  // A truncated / garbage lock must fail SAFE, not crash and not be believed.
  fs.writeFileSync(path.join(STATE, 'runtime.pid'), '{"pid":  ');
  const malformed = JSON.parse(launcher(['--status', '--no-db']).out);
  check('a torn lock file is treated as stale rather than believed or fatal',
    malformed.runtime.lock_state === 'stale', malformed.runtime.reason);
  fs.rmSync(path.join(STATE, 'runtime.pid'), { force: true });
}

// =====================================================================
heading(4, 'THE TELEGRAM OFFSET SURVIVES A RESTART');
// The offset is the one number that must never be wrong: too low and the week
// is reprocessed, too high and the week is GONE. Two separate processes, a
// real offset file, and a Telegram stand-in that really deletes what it acks.
// =====================================================================
const T = {
  db: path.join(RUN, 't4-db.json'),
  tg: path.join(RUN, 't4-telegram.json'),
  offset: path.join(RUN, 't4-offset.json'),
};
{
  initServer(T.tg, [
    textUpdate(101, 900, '3 gourmet cat food\n1 weetabix protein'),
    textUpdate(102, 901, '2 arla 4pt'),
  ]);

  const a = child(['--db', T.db, '--telegram', T.tg, '--offset-file', T.offset,
    '--report', path.join(RUN, 't4-a.json'), '--passes', '1', '--label', 'process-A']);
  const ra = readJson(path.join(RUN, 't4-a.json'));
  check('process A handled both updates and persisted the offset',
    a.status === 0 && ra && ra.offset_after.lastUpdateId === 102,
    { offset_file: fs.readFileSync(T.offset, 'utf8').trim().replace(/\s+/g, ' ') });

  // A brand new process. Nothing in memory. Only the file.
  const b = child(['--db', T.db, '--telegram', T.tg, '--offset-file', T.offset,
    '--report', path.join(RUN, 't4-b.json'), '--passes', '1', '--label', 'process-B']);
  const rb = readJson(path.join(RUN, 't4-b.json'));
  const server = readServer(T.tg);
  const bFetches = server.fetches.filter((f) => f.by === 'process-B');
  check('the RESTARTED process resumed from the persisted offset (asked for 103, not 0)',
    b.status === 0 && bFetches.length === 1 && bFetches[0].offset === 103,
    { fetches: server.fetches.map((f) => `${f.by} asked offset=${f.offset}`) });

  const audit = auditServer(T.tg, rb.handled_update_ids);
  check('no update was delivered twice - nothing was reprocessed',
    Object.values(audit.delivered_counts).every((n) => n === 1), audit.delivered_counts);
  check('no update was acknowledged without being handled - nothing was silently consumed',
    audit.lost.length === 0, { deleted: audit.deleted, handled: rb.handled_update_ids, lost: audit.lost });
  // Two messages on the same day are ONE week's shop by design (shop_ref_uniq),
  // so the correct answer is one shop that both messages resumed - not two.
  check('the restart created no second shop (both messages resumed the same week)',
    ra.counts.shop === 1 && rb.counts.shop === 1, { after_A: ra.counts.shop, after_B: rb.counts.shop });
}

// =====================================================================
heading(5, 'A CRASH BEFORE THE ACK REDELIVERS, AND DOES NOT DUPLICATE');
// The good side of the window: the work is durable, the offset is not, so
// Telegram redelivers. Idempotency has to absorb that without a second shop.
// =====================================================================
const C5 = {
  db: path.join(RUN, 't5-db.json'), tg: path.join(RUN, 't5-telegram.json'), offset: path.join(RUN, 't5-offset.json'),
};
{
  initServer(C5.tg, [textUpdate(201, 950, '3 gourmet cat food')]);
  const a = child(['--db', C5.db, '--telegram', C5.tg, '--offset-file', C5.offset,
    '--report', path.join(RUN, 't5-a.json'), '--passes', '1', '--label', 'crash-A',
    '--crash-before-ack', '201']);
  const crashLog = fs.existsSync(path.join(RUN, 't5-a.json.crash'))
    ? fs.readFileSync(path.join(RUN, 't5-a.json.crash'), 'utf8').trim() : '';
  check('process A died before acknowledging update 201', a.status === 137 && crashLog.includes('crashed_before_acking'), crashLog);
  check('...and the offset file was therefore never written', !fs.existsSync(C5.offset), `${C5.offset} absent`);

  const b = child(['--db', C5.db, '--telegram', C5.tg, '--offset-file', C5.offset,
    '--report', path.join(RUN, 't5-b.json'), '--passes', '1', '--label', 'crash-B']);
  const rb = readJson(path.join(RUN, 't5-b.json'));
  const server = readServer(C5.tg);
  check('the fresh process was redelivered update 201 (nothing was lost)',
    server.deliveries.filter((d) => d.update_id === 201).length === 2,
    server.deliveries.map((d) => `${d.by}:${d.update_id}`));
  check('the redelivery RESUMED the week rather than creating a second shop',
    b.status === 0 && rb.counts.shop === 1, rb.counts);
  const rows = readJson(C5.db);
  const actionKeys = rows.pending_action.map((r) => `${r.household_id}|${r.action_type}|${r.action_key}`);
  check('no duplicate list, item, question, command, order or learning row',
    rb.counts.shopping_lists <= 1
      && new Set(actionKeys).size === actionKeys.length
      && rb.counts.order_confirmation === 0 && rb.counts.order_confirmation_line === 0
      && new Set(rows.shop_question.map((q) => `${q.shop_id}|${q.question_key}`)).size === rows.shop_question.length,
    rb.counts);
}

// =====================================================================
heading('5b', 'FINDING: A CRASH *AFTER* THE ACK LOSES THE LIST SILENTLY');
// This one is expected to demonstrate a DEFECT, not a guarantee.
//
// runIntake advances and PERSISTS the offset inside its own loop (shopperIntake
// .js:662), but the shop row is only written afterwards, by pollIntake calling
// commands.receiveList (runtime.js:125). Between those two points the receiver
// has told Telegram "I have this message" and has written nothing durable. If
// the process dies there - a reboot, a power cut, a kill - Telegram deletes the
// update and there is no shop, no error and no trace.
//
// It is proven here rather than argued, because it is exactly the failure the
// single-poller lock exists to prevent, arriving by a different door.
// =====================================================================
const C5b = {
  db: path.join(RUN, 't5b-db.json'), tg: path.join(RUN, 't5b-telegram.json'), offset: path.join(RUN, 't5b-offset.json'),
};
{
  initServer(C5b.tg, [textUpdate(221, 955, '3 gourmet cat food')]);
  const a = child(['--db', C5b.db, '--telegram', C5b.tg, '--offset-file', C5b.offset,
    '--report', path.join(RUN, 't5b-a.json'), '--passes', '1', '--label', 'lost-A',
    '--crash-after-ack', '221']);
  const crashLog = fs.existsSync(path.join(RUN, 't5b-a.json.crash'))
    ? fs.readFileSync(path.join(RUN, 't5b-a.json.crash'), 'utf8').trim() : '';
  check('process A acknowledged update 221 and then died before writing the shop',
    a.status === 137 && crashLog.includes('crashed_after_acking_before_the_shop_row'), crashLog);
  check('the offset file now claims 221 was handled',
    readJson(C5b.offset) && readJson(C5b.offset).last_update_id === 221, readJson(C5b.offset));

  const b = child(['--db', C5b.db, '--telegram', C5b.tg, '--offset-file', C5b.offset,
    '--report', path.join(RUN, 't5b-b.json'), '--passes', '1', '--label', 'lost-B']);
  const rb = readJson(path.join(RUN, 't5b-b.json'));
  const server = readServer(C5b.tg);
  const audit = auditServer(C5b.tg, rb.handled_update_ids);
  // Documented as a KNOWN, REPRODUCIBLE defect: the check asserts the loss, so
  // it will start failing the day the ordering is fixed. That is deliberate.
  check('DEFECT REPRODUCED: the restart created no shop, and Telegram has deleted the message',
    rb.counts.shop === 0 && server.pending.length === 0 && audit.lost.includes(221),
    { shops_after_restart: rb.counts.shop, still_pending_on_telegram: server.pending.map((u) => u.update_id), lost: audit.lost });
  check('...and nothing anywhere records that a list went missing',
    (rb.events || []).every((e) => e.event !== 'failed_offset_held'),
    'no failure event, no held offset, no error - the loss is silent');
}

// =====================================================================
heading(6, 'PENDING WORK SURVIVES A RESTART AND RESUMES AT THE RIGHT STAGE');
// =====================================================================
const C6 = {
  db: path.join(RUN, 't6-db.json'), tg: path.join(RUN, 't6-telegram.json'), offset: path.join(RUN, 't6-offset.json'),
};
{
  initServer(C6.tg, [textUpdate(301, 970, '3 gourmet cat food\n1 weetabix protein\n3 arla 4pt')]);

  const a = child(['--db', C6.db, '--telegram', C6.tg, '--offset-file', C6.offset,
    '--report', path.join(RUN, 't6-a.json'), '--passes', '1', '--label', 'stage-A']);
  const ra = readJson(path.join(RUN, 't6-a.json'));
  check('process A created the shop and parked it at the human gate',
    a.status === 0 && ra.shops.length === 1 && ra.shops[0].status === 'RECEIVED',
    ra.shops.map((s) => `${s.shop_ref}=${s.status}`));

  // A tap, through the same command surface Telegram and the Cockpit use.
  const b = child(['--db', C6.db, '--telegram', C6.tg, '--offset-file', C6.offset,
    '--report', path.join(RUN, 't6-b.json'), '--passes', '1', '--label', 'stage-B', '--issue', 'buildShop']);
  const rb = readJson(path.join(RUN, 't6-b.json'));
  check('a fresh process read the pending command from durable state and advanced ONE step',
    b.status === 0 && rb.shops[0].status !== 'RECEIVED',
    `${ra.shops[0].status} -> ${rb.shops[0].status}`);

  const c = child(['--db', C6.db, '--telegram', C6.tg, '--offset-file', C6.offset,
    '--report', path.join(RUN, 't6-c.json'), '--passes', '1', '--label', 'stage-C']);
  const rc = readJson(path.join(RUN, 't6-c.json'));
  check('another fresh process resumed at the CORRECT next stage, not from the beginning',
    c.status === 0 && rc.shops[0].status !== rb.shops[0].status,
    `${rb.shops[0].status} -> ${rc.shops[0].status}`);
  check('three restarts produced exactly ONE shop and ONE list',
    rc.counts.shop === 1 && rc.counts.shopping_lists === 1, rc.counts);
  check('the list items were written once, not once per restart',
    rc.counts.shopping_list_items === rb.counts.shopping_list_items || rb.counts.shopping_list_items === 0,
    { after_B: rb.counts.shopping_list_items, after_C: rc.counts.shopping_list_items });
}

// =====================================================================
heading(7, 'A FAILED SHOP RESUMES FROM THE RECORDED FAILURE BOUNDARY');
// Not from the beginning, and not from a stage a caller asserted - from the
// state the durable failure event says it fell over in.
// =====================================================================
const C7 = {
  db: path.join(RUN, 't7-db.json'), tg: path.join(RUN, 't7-telegram.json'), offset: path.join(RUN, 't7-offset.json'),
};
{
  initServer(C7.tg, [textUpdate(401, 980, '3 gourmet cat food')]);
  child(['--db', C7.db, '--telegram', C7.tg, '--offset-file', C7.offset,
    '--report', path.join(RUN, 't7-a.json'), '--passes', '1', '--label', 'fail-A']);
  // Tap "build", then fail the PLAN step specifically.
  const b = child(['--db', C7.db, '--telegram', C7.tg, '--offset-file', C7.offset,
    '--report', path.join(RUN, 't7-b.json'), '--passes', '3', '--label', 'fail-B',
    '--issue', 'buildShop', '--fail-plan']);
  const rb = readJson(path.join(RUN, 't7-b.json'));
  const db = readJson(C7.db);
  const failureEvent = (db.shop_event || []).filter((e) => e.event_type === 'failure').pop();
  check('the shop is FAILED and carries a durable failure event naming where it fell over',
    rb.shops[0].status === 'FAILED' && failureEvent && Boolean(failureEvent.from_status),
    { status: rb.shops[0].status, resume_from: failureEvent && failureEvent.from_status, last_error: rb.shops[0].last_error });

  // A fresh process, with no retry command: it must WAIT, not silently retry.
  const c = child(['--db', C7.db, '--telegram', C7.tg, '--offset-file', C7.offset,
    '--report', path.join(RUN, 't7-c.json'), '--passes', '1', '--label', 'fail-C']);
  const rc = readJson(path.join(RUN, 't7-c.json'));
  check('a restart does NOT auto-retry a failed shop - it waits to be told',
    rc.shops[0].status === 'FAILED' && rc.passes[0].shops[0].step === 'wait:retry',
    rc.passes[0].shops[0]);

  // Now a retry command, from a fresh process again.
  const d = child(['--db', C7.db, '--telegram', C7.tg, '--offset-file', C7.offset,
    '--report', path.join(RUN, 't7-d.json'), '--passes', '1', '--label', 'fail-D', '--issue', 'retryStage']);
  const rd = readJson(path.join(RUN, 't7-d.json'));
  check('the retry resumed to EXACTLY the recorded failure boundary, not to the start',
    rd.shops[0].status === failureEvent.from_status,
    { recorded_from_status: failureEvent.from_status, resumed_to: rd.shops[0].status });
  check('the whole failure/retry cycle still produced exactly one shop and one list',
    rd.counts.shop === 1 && rd.counts.shopping_lists <= 1, rd.counts);
}

// =====================================================================
heading(8, 'NOTHING IS DUPLICATED WHEN THE SAME HISTORY IS REPLAYED WHOLESALE');
// The nightmare: the offset file is lost entirely (disk restore, a wiped state
// directory) and Telegram redelivers everything. The unique indexes have to
// hold - this is the belt to the offset file's braces.
// =====================================================================
const C8 = {
  db: path.join(RUN, 't8-db.json'), tg: path.join(RUN, 't8-telegram.json'), offset: path.join(RUN, 't8-offset.json'),
};
{
  initServer(C8.tg, [textUpdate(501, 990, '3 gourmet cat food\n1 weetabix protein')]);
  child(['--db', C8.db, '--telegram', C8.tg, '--offset-file', C8.offset,
    '--report', path.join(RUN, 't8-a.json'), '--passes', '1', '--label', 'replay-A']);
  const a = readJson(path.join(RUN, 't8-a.json'));

  // Replay: put the update back and delete the offset file, as if the state
  // directory had been restored from an older backup.
  initServer(C8.tg, [textUpdate(501, 990, '3 gourmet cat food\n1 weetabix protein')]);
  fs.rmSync(C8.offset, { force: true });

  const b = child(['--db', C8.db, '--telegram', C8.tg, '--offset-file', C8.offset,
    '--report', path.join(RUN, 't8-b.json'), '--passes', '2', '--label', 'replay-B', '--issue', 'buildShop']);
  const rb = readJson(path.join(RUN, 't8-b.json'));
  check('replaying the whole history created no second shop', rb.counts.shop === 1, { before: a.counts.shop, after: rb.counts.shop });
  check('no duplicate list', rb.counts.shopping_lists <= 1, rb.counts.shopping_lists);
  check('no duplicate command row (the pending_action key index held)',
    new Set(readJson(C8.db).pending_action.map((r) => `${r.household_id}|${r.action_type}|${r.action_key}`)).size
      === readJson(C8.db).pending_action.length,
    readJson(C8.db).pending_action.map((r) => `${r.action_type}/${r.status}`));
  check('no duplicate question, order confirmation or learning row',
    new Set(readJson(C8.db).shop_question.map((q) => `${q.shop_id}|${q.question_key}`)).size === rb.counts.shop_question
      && rb.counts.order_confirmation === 0,
    rb.counts);
}

// =====================================================================
heading(9, 'RUNTIME HEALTH IS VISIBLE');
// =====================================================================
{
  launcher(['--selftest']);
  const s = JSON.parse(launcher(['--status', '--no-db']).out);
  check('status answers: is it running, and which process',
    s.runtime.running === true && Number.isInteger(s.runtime.pid) && s.runtime.identity_verified === true,
    { running: s.runtime.running, pid: s.runtime.pid, uptime_seconds: s.runtime.uptime_seconds, source: s.runtime.source });
  check('status answers: where the Telegram offset has got to',
    Object.prototype.hasOwnProperty.call(s.telegram_offset, 'last_update_id'), s.telegram_offset);
  check('status answers: when it last did anything, and the last error',
    s.activity.exists === true && s.activity.events_parsed > 0
      && Object.prototype.hasOwnProperty.call(s.activity, 'last_error'),
    { last_write_at: s.activity.last_write_at, events_parsed: s.activity.events_parsed, last_pass: s.activity.last_pass, last_error: s.activity.last_error });
  check('status answers: is there work waiting (and says so honestly when it cannot reach Postgres)',
    Object.prototype.hasOwnProperty.call(s.pending_work, 'available'), s.pending_work);
  check('a cached snapshot is written for cheap consumers, labelled as a cache',
    fs.existsSync(path.join(STATE, 'status.json'))
      && String(readJson(path.join(STATE, 'status.json'))._cache).includes('not a source of truth'),
    path.join(STATE, 'status.json'));
  launcher(['--stop']);
}

// ---------------------------------------------------------------------

function textUpdate(updateId, messageId, text) {
  return {
    update_id: updateId,
    message: { message_id: messageId, from: { id: 555 }, chat: { id: 555, type: 'private' }, text },
  };
}

console.log(`\n${'='.repeat(72)}`);
console.log(`${results.length - failures}/${results.length} checks passed`);
if (failures > 0) {
  console.log('FAILURES:');
  for (const r of results.filter((x) => !x.ok)) console.log(`  - ${r.name}: ${JSON.stringify(r.evidence)}`);
}
fs.writeFileSync(path.join(RUN, 'results.json'), `${JSON.stringify({ at: new Date().toISOString(), host: os.hostname(), node: process.version, results }, null, 1)}\n`);
console.log(`evidence: ${path.join(RUN, 'results.json')}`);
if (!KEEP) { /* the scratch dir is gitignored; kept for inspection */ }
process.exit(failures === 0 ? 0 : 1);
