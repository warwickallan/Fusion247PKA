// Proofs for the sanctioned ad-hoc milestone entrypoint (bin/notify-milestone.js).
//
// NO LIVE TELEGRAM. Every test drives either the injected notifier seam or a child
// process whose global fetch has been replaced by a stub — no network, no token, no
// DB, per README "Test" and the CI job's own promise.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { runNotify, parseArgs, CLI_PURPOSES, MACHINE_ONLY_PURPOSES, REQUIRED_FOR_NOTIFY } from '../bin/notify-milestone.js';
import { MILESTONES } from '../src/telegramNotifier.js';

const SERVICE_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const CLI = path.join(SERVICE_DIR, 'bin', 'notify-milestone.js');

// A fake bot token shaped like the real thing but obviously not one. Never a real value.
//
// KEEP IT SHORT. `scripts/secret-scan.sh` classes `telegram-bot-token`
// (`[0-9]{6,}:AA[A-Za-z0-9_-]{30,}`) and `telegram-token-bare`
// (`[0-9]{8,}:[A-Za-z0-9_-]{30,}`) both fire at 30+ characters after the colon, and a
// --surface scan then FAILS on this fixture. A longer canary proves nothing extra: its
// only job is to be a distinctive value that must never appear in output.
const CANARY = '123456789:AA-notify-cli-canary';

// ---------------------------------------------------------------- in-process seams

function capture() {
  const out = [];
  const err = [];
  return {
    stdout: { write(s) { out.push(s); return true; } },
    stderr: { write(s) { err.push(s); return true; } },
    get outText() { return out.join(''); },
    get errText() { return err.join(''); },
  };
}

function fakeLoader({ ok = true, error = null } = {}) {
  const rec = { calls: 0, args: null };
  const impl = (args) => {
    rec.calls += 1;
    rec.args = args;
    return { ok, config: ok ? { authorisedTelegramUserId: '42', telegramBotToken: CANARY } : null, missing: [], malformed: [], error };
  };
  return { rec, impl };
}

function fakeNotifier(result = { sent: true, messageId: '999' }) {
  const rec = { factoryCalls: 0, factoryArgs: null, notifyCalls: 0, notifyArgs: null };
  const factory = (args) => {
    rec.factoryCalls += 1;
    rec.factoryArgs = args;
    return {
      async notifyMilestone(m) { rec.notifyCalls += 1; rec.notifyArgs = m; return result; },
    };
  };
  return { rec, factory };
}

async function run(argv, { loader = fakeLoader(), notifier = fakeNotifier() } = {}) {
  const io = capture();
  const code = await runNotify({ argv, env: {}, stdout: io.stdout, stderr: io.stderr, loadConfigImpl: loader.impl, notifierFactory: notifier.factory });
  return { code, io, loader, notifier };
}

// ---------------------------------------------------------------- vocabulary

test('the entrypoint vocabulary is a STRICT SUBSET of the closed milestone vocabulary', () => {
  assert.equal(CLI_PURPOSES.length, 4);
  for (const p of CLI_PURPOSES) assert.equal(MILESTONES.includes(p), true, `${p} must be a real milestone`);
  assert.equal(CLI_PURPOSES.length < MILESTONES.length, true, 'the human entrypoint must be narrower than the machine one');
  assert.deepEqual([...MACHINE_ONLY_PURPOSES].sort(), ['clickup_token_missing', 'watcher_online', 'watcher_recovered']);
});

test('a valid purpose is ACCEPTED and sent', async () => {
  const { code, io, notifier } = await run(['--purpose', 'escalation', '--body', 'a real escalation', '--source', 'LARRY']);
  assert.equal(code, 0);
  assert.equal(notifier.rec.notifyCalls, 1);
  assert.equal(notifier.rec.notifyArgs.purpose, 'escalation');
  assert.equal(notifier.rec.notifyArgs.logicalSource, 'LARRY');
  assert.equal(notifier.rec.notifyArgs.body, 'a real escalation');
  assert.deepEqual(JSON.parse(io.outText), { sent: true, messageId: '999', purpose: 'escalation', source: 'LARRY' });
  assert.equal(io.errText, '');
});

test('every entrypoint purpose is accepted (no half-open vocabulary)', async () => {
  for (const p of CLI_PURPOSES) {
    const { code } = await run(['--purpose', p, '--body', 'x']);
    assert.equal(code, 0, `${p} must be accepted`);
  }
});

test('an INVALID purpose is REJECTED with the valid list, and nothing is loaded or sent', async () => {
  const loader = fakeLoader();
  const notifier = fakeNotifier();
  const { code, io } = await run(['--purpose', 'file_written', '--body', 'routine progress'], { loader, notifier });
  assert.equal(code, 2);
  assert.match(io.errText, /not a milestone/);
  assert.match(io.errText, /MILESTONES, NOT A CONSOLE/);
  for (const p of CLI_PURPOSES) assert.match(io.errText, new RegExp(p));
  assert.equal(io.outText, '', 'nothing on stdout that could read as success');
  assert.equal(loader.rec.calls, 0, 'no secret load on a rejected purpose');
  assert.equal(notifier.rec.notifyCalls, 0);
});

test('a MACHINE-ONLY milestone is REJECTED as a DIFFERENT fact from "not a milestone"', async () => {
  const notifier = fakeNotifier();
  const { code, io } = await run(['--purpose', 'watcher_online', '--body', 'pretending the watcher started'], { notifier });
  assert.equal(code, 2);
  assert.match(io.errText, /not available to this entrypoint/);
  assert.match(io.errText, /watcher lifecycle/);
  assert.equal(/not a milestone:/.test(io.errText), false, 'must NOT be blurred with the not-a-milestone case');
  assert.equal(notifier.rec.notifyCalls, 0);
  assert.equal(io.outText, '');
});

test('all three machine-only milestones are refused to a human caller', async () => {
  for (const p of MACHINE_ONLY_PURPOSES) {
    const { code, io } = await run(['--purpose', p, '--body', 'x']);
    assert.equal(code, 2, `${p} must be refused`);
    assert.match(io.errText, /not available to this entrypoint/);
  }
});

// ---------------------------------------------------------------- usage validation

test('--purpose has NO default — omitting it is a usage error', async () => {
  const { code, io, notifier } = await run(['--body', 'x']);
  assert.equal(code, 2);
  assert.match(io.errText, /--purpose is required and has NO default/);
  assert.equal(notifier.rec.notifyCalls, 0);
  assert.equal(io.outText, '');
});

test('an empty or whitespace body is REJECTED', async () => {
  for (const body of ['', '   ', '\t\n']) {
    const { code, io, notifier } = await run(['--purpose', 'blocked', '--body', body]);
    assert.equal(code, 2, `body ${JSON.stringify(body)} must be rejected`);
    assert.match(io.errText, /--body is required and must not be empty or whitespace/);
    assert.equal(notifier.rec.notifyCalls, 0);
  }
  const missing = await run(['--purpose', 'blocked']);
  assert.equal(missing.code, 2);
});

test('an unknown --source is REJECTED', async () => {
  const { code, io } = await run(['--purpose', 'blocked', '--body', 'x', '--source', 'WARWICK']);
  assert.equal(code, 2);
  assert.match(io.errText, /is not a logical source/);
  assert.equal(io.outText, '');
});

test('parseArgs defaults source to TOWER and checkpointId to empty', () => {
  const p = parseArgs(['--purpose', 'blocked', '--body', 'x']);
  assert.equal(p.error, undefined);
  assert.equal(p.source, 'TOWER');
  assert.equal(p.checkpointId, '');
  assert.equal(parseArgs(['--purpose', 'blocked', '--body', 'x', '--checkpoint-id', 'cp-9']).checkpointId, 'cp-9');
});

// ---------------------------------------------------------------- the silent-failure trap

test('THE TRAP — a notifier that DROPS the message must NOT exit 0 (row 17 regression guard)', async () => {
  // `notifyMilestone` never throws; a dropped milestone comes back as a quiet
  // { sent:false, skipped:'not-a-milestone' }. A naive CLI exits 0 on this, and a
  // send that never happened then reads exactly like a channel with nothing to say.
  const notifier = fakeNotifier({ sent: false, skipped: 'not-a-milestone' });
  const { code, io } = await run(['--purpose', 'escalation', '--body', 'x'], { notifier });
  assert.equal(notifier.rec.notifyCalls, 1, 'the notifier was actually called');
  assert.notEqual(code, 0, 'a message that was NOT sent must never exit 0');
  assert.equal(code, 1);
  assert.equal(io.outText, '', 'NOTHING on stdout that a human could read as success');
  assert.match(io.errText, /NOT SENT/);
  assert.match(io.errText, /dropped it: not-a-milestone/);
});

test('a not-ready notifier fails loudly (exit 1, nothing on stdout)', async () => {
  const notifier = fakeNotifier({ sent: false, skipped: 'not-ready' });
  const { code, io } = await run(['--purpose', 'blocked', '--body', 'x'], { notifier });
  assert.equal(code, 1);
  assert.equal(io.outText, '');
  assert.match(io.errText, /NOT SENT — the notifier dropped it: not-ready/);
});

test('a deduped message fails loudly rather than looking sent', async () => {
  const notifier = fakeNotifier({ sent: false, deduped: true });
  const { code, io } = await run(['--purpose', 'blocked', '--body', 'x'], { notifier });
  assert.equal(code, 1);
  assert.equal(io.outText, '');
  assert.match(io.errText, /deduped/);
});

test('a failed send exits non-zero and reports the reason', async () => {
  const notifier = fakeNotifier({ sent: false, error: 'telegramClient: sendMessage rejected: unauthorized' });
  const { code, io } = await run(['--purpose', 'tower_unavailable', '--body', 'x'], { notifier });
  assert.equal(code, 1);
  assert.equal(io.outText, '');
  assert.match(io.errText, /NOT SENT — the send failed: .*unauthorized/);
});

test('config fail-closed exits 1 before any send is attempted', async () => {
  const loader = fakeLoader({ ok: false, error: 'fail-closed: missing required secret(s) by NAME: TELEGRAM_BOT_TOKEN' });
  const notifier = fakeNotifier();
  const { code, io } = await run(['--purpose', 'escalation', '--body', 'x'], { loader, notifier });
  assert.equal(code, 1);
  assert.equal(notifier.rec.notifyCalls, 0);
  assert.equal(io.outText, '');
  assert.match(io.errText, /NOT SENT — fail-closed: missing required secret\(s\) by NAME: TELEGRAM_BOT_TOKEN/);
});

// ---------------------------------------------------------------- boundaries

test('NO ClickUp credential is required (no Postgres, no ClickUp)', async () => {
  const loader = fakeLoader();
  await run(['--purpose', 'escalation', '--body', 'x'], { loader });
  assert.deepEqual(loader.rec.args.required, ['TELEGRAM_BOT_TOKEN', 'AUTHORISED_TELEGRAM_USER_ID']);
  assert.equal(loader.rec.args.required.includes('CLICKUP_TOKEN'), false);
  assert.deepEqual([...REQUIRED_FOR_NOTIFY], ['TELEGRAM_BOT_TOKEN', 'AUTHORISED_TELEGRAM_USER_ID']);
});

test('NO dedup state is passed — the entrypoint never writes the watcher state file', async () => {
  // openState() defaults to C:\.fusion247\tower-baton-state.json (inside the secrets
  // store) and shares the WATCHER's dedup namespace. Passing it would risk an ad-hoc
  // escalation silently suppressing a real one. Re-running therefore RESENDS.
  const notifier = fakeNotifier();
  await run(['--purpose', 'escalation', '--body', 'x'], { notifier });
  assert.equal(notifier.rec.factoryCalls, 1);
  assert.equal('state' in notifier.rec.factoryArgs, false, 'no state key may be handed to the notifier factory');
  assert.equal(notifier.rec.factoryArgs.state, undefined);
});

test('no credential value reaches stdout OR stderr — the loaded config is never echoed', async () => {
  // The fake loader hands back a config carrying the canary token, exactly as the real
  // one would. Neither stream may ever contain it.
  for (const argv of [
    ['--purpose', 'escalation', '--body', 'x'],           // success path
    ['--purpose', 'nope', '--body', 'x'],                 // rejected purpose
    ['--purpose', 'blocked', '--body', '  '],             // rejected body
  ]) {
    const { io } = await run(argv, { loader: fakeLoader() });
    assert.equal(io.outText.includes(CANARY), false, `no token value on stdout for ${argv.join(' ')}`);
    assert.equal(io.errText.includes(CANARY), false, `no token value on stderr for ${argv.join(' ')}`);
    assert.equal(io.outText.includes('123456789:AA'), false);
    assert.equal(io.errText.includes('123456789:AA'), false);
  }

  // The fail-closed path reports MISSING NAMES, never values.
  const failed = await run(['--purpose', 'escalation', '--body', 'x'], {
    loader: fakeLoader({ ok: false, error: 'fail-closed: missing required secret(s) by NAME: TELEGRAM_BOT_TOKEN' }),
  });
  assert.equal(failed.io.errText.includes(CANARY), false);

  // Documented boundary, not a gap the CLI opens: a notifier error is relayed verbatim,
  // and scrubbing it is src/telegramNotifier.js's job (scrubToken, proven in
  // notifier.test.js). This asserts the CLI adds NO NEW leak of its own — it does not
  // claim to re-scrub what the library already scrubbed.
  const relayed = await run(['--purpose', 'escalation', '--body', 'x'], {
    notifier: fakeNotifier({ sent: false, error: 'telegramClient: sendMessage rejected: unauthorized' }),
  });
  assert.equal(relayed.io.errText.includes(CANARY), false);
  assert.equal(relayed.io.outText, '');
});

// ---------------------------------------------------------------- spawn-level proofs

function seedHome({ telegram = true, clickup = false } = {}) {
  const home = path.join(os.tmpdir(), `fusion-home-${randomUUID()}`);
  fs.mkdirSync(home, { recursive: true });
  const lines = [];
  if (telegram) lines.push(`TELEGRAM_BOT_TOKEN=${CANARY}`);
  if (clickup) lines.push(`CLICKUP_TOKEN=${CANARY}`);
  lines.push('AUTHORISED_TELEGRAM_USER_ID=42');
  fs.writeFileSync(path.join(home, 'fusion-capture-gateway.env'), `${lines.join('\n')}\n`);
  return home;
}

function cleanEnv(home, extra = {}) {
  const env = { FUSION247_HOME: home, PATH: process.env.PATH, ...extra };
  if (process.env.SystemRoot) env.SystemRoot = process.env.SystemRoot;
  if (process.env.PATHEXT) env.PATHEXT = process.env.PATHEXT;
  return env;
}

/** A stub that replaces global fetch in the CHILD — no network reaches Telegram. */
function writeFetchStub(home, probePath) {
  const stub = path.join(home, 'fetch-stub.mjs');
  fs.writeFileSync(stub, [
    "import fs from 'node:fs';",
    'globalThis.fetch = async (url) => {',
    '  const u = String(url);',
    '  const canary = process.env.NOTIFY_TEST_CANARY ?? "";',
    // NOTE: the URL carries the token, so the probe records a BOOLEAN, never the URL.
    `  fs.writeFileSync(${JSON.stringify(probePath)}, JSON.stringify({ called: true, sawTokenInUrl: canary ? u.includes(canary) : false, host: u.split('/')[2] ?? '' }), 'utf8');`,
    '  return { ok: true, status: 200, json: async () => ({ ok: true, result: { message_id: 4242 } }) };',
    '};',
    '',
  ].join('\n'), 'utf8');
  return stub;
}

// spawnSync, NOT execFileSync: execFileSync only RETURNS stdout on success, so a leak
// written to stderr by a passing run would be invisible to these assertions. Found by
// mutation M4 (a debug line echoing the resolved token survived an execFileSync-based
// version of this helper).
function runCli(args, env) {
  const r = spawnSync(process.execPath, [CLI, ...args], { env, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
  if (r.error) throw r.error;
  return { code: r.status, stdout: String(r.stdout ?? ''), stderr: String(r.stderr ?? '') };
}

test('SPAWN — the real CLI sends through the real loader+notifier, and leaks NO credential', () => {
  const home = seedHome();
  const probe = path.join(home, 'probe.json');
  const stub = writeFetchStub(home, probe);
  const env = cleanEnv(home, { NODE_OPTIONS: `--import=${pathToFileURL(stub).href}`, NOTIFY_TEST_CANARY: CANARY });

  const r = runCli(['--purpose', 'escalation', '--body', 'spawn-level proof', '--source', 'LARRY'], env);
  assert.equal(r.code, 0, `expected exit 0, got ${r.code}: ${r.stderr}`);
  const parsed = JSON.parse(r.stdout.trim());
  assert.equal(parsed.sent, true);
  assert.equal(parsed.messageId, '4242');

  // The credential travelled to the transport and NOWHERE else.
  const seen = JSON.parse(fs.readFileSync(probe, 'utf8'));
  assert.equal(seen.called, true, 'the CLI actually reached the transport');
  assert.equal(seen.sawTokenInUrl, true, 'the token travels ONLY in the request URL');
  assert.equal(seen.host, 'api.telegram.org');
  assert.equal(r.stdout.includes(CANARY), false, 'no token value on stdout');
  assert.equal(r.stderr.includes(CANARY), false, 'no token value on stderr');
  assert.equal(r.stdout.includes('123456789:AA'), false);
  assert.equal(r.stderr.includes('123456789:AA'), false);
});

test('SPAWN — fail-closed when TELEGRAM_BOT_TOKEN is absent: exit 1, honest stderr, no leak', () => {
  // The store HOLDS the canary (as CLICKUP_TOKEN) but the required telegram name is
  // absent — so the CLI must fail closed by NAME and print no value.
  const home = seedHome({ telegram: false, clickup: true });
  const r = runCli(['--purpose', 'escalation', '--body', 'should never send'], cleanEnv(home));
  assert.equal(r.code, 1);
  assert.equal(r.stdout.trim(), '', 'nothing on stdout that could read as success');
  assert.match(r.stderr, /NOT SENT/);
  assert.match(r.stderr, /TELEGRAM_BOT_TOKEN/);
  assert.equal(r.stderr.includes(CANARY), false, 'no token value on stderr');
});

test('SPAWN — a rejected purpose exits 2 and never reaches the transport', () => {
  const home = seedHome();
  const probe = path.join(home, 'probe.json');
  const stub = writeFetchStub(home, probe);
  const env = cleanEnv(home, { NODE_OPTIONS: `--import=${pathToFileURL(stub).href}`, NOTIFY_TEST_CANARY: CANARY });

  const r = runCli(['--purpose', 'watcher_recovered', '--body', 'faking a lifecycle event'], env);
  assert.equal(r.code, 2);
  assert.equal(r.stdout.trim(), '');
  assert.match(r.stderr, /not available to this entrypoint/);
  assert.equal(fs.existsSync(probe), false, 'the transport was never called');
});
