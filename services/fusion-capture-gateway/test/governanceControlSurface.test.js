// BUILD-002 WP2 — Telegram governance control surface (hermetic, NO pg / DB / net).
//
// Proves the SOLE Telegram poller (the capture worker's getUpdates) recognises
// governance COMMANDS and Warwick's decision-card TAPS and routes them to the
// Tower as durable ftw.run_event rows — WITHOUT a second poller, and WITHOUT
// disturbing normal capture. Driven in live mode over an injected in-memory
// operational store + mock adapter (the liveRunner.test.js pattern); the ftw
// writer resolves to the in-memory backend, whose recorded events we assert.

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { createInMemoryOperationalStore } from '../src/store/operationalStore.js';
import { createMockTelegramAdapter } from '../src/adapters/telegramAdapter.js';
import { createLiveRunner } from '../src/live/liveRunner.js';
import { loadConfig } from '../src/config.js';
import { STATES } from '../src/core/states.js';
import { parseGovernanceCommand, parseDecisionCallback } from '../src/governance/commandGrammar.js';
import { classifyUpdate } from '../src/governance/detect.js';
import { createInMemoryFtwCommandIntake } from '../src/store/ftwCommandIntake.js';

const AUTH_ID = '424242';
const STRANGER_ID = '999999';
const DB_PW = 'sUpErSeCrEtDbPw';
const BOT_TOKEN = '123456:FAKE-not-a-real-token-xyz';

function fixedClock(ms) { let t = ms; return { now: () => t, advance: (d) => { t += d; } }; }

function liveEnv(brainDir) {
  return {
    DATABASE_URL: `postgresql://postgres:${DB_PW}@localhost:5432/db?sslmode=require`,
    TELEGRAM_BOT_TOKEN: BOT_TOKEN,
    AUTHORISED_TELEGRAM_USER_ID: AUTH_ID,
    WORKER_ID: 'worker-live',
    CAPTURE_BRAIN_DIR: brainDir,
  };
}

async function makeRunner(brainDir, { store, adapter, clock } = {}) {
  const config = loadConfig(liveEnv(brainDir));
  assert.equal(config.fixturesMode, false);
  return createLiveRunner(config, {
    clock,
    leaseMs: 30_000,
    factories: { storeFactory: async () => store, adapterFactory: async () => adapter },
  });
}

// An authorised private-chat text message.
function msg(updateId, text, { fromId = AUTH_ID, chatId = AUTH_ID, chatType = 'private', messageId = updateId + 500 } = {}) {
  return { update_id: updateId, message: { message_id: messageId, from: { id: fromId }, chat: { id: chatId, type: chatType }, text } };
}

// An inline-keyboard tap. `data` is the callback_data (e.g. 'dec:<token>:proceed').
function callback(updateId, data, { fromId = AUTH_ID, chatId = AUTH_ID, chatType = 'private', messageId = updateId + 900, cbId = `cb-${updateId}` } = {}) {
  return { update_id: updateId, callback_query: { id: cbId, from: { id: fromId }, data, message: { message_id: messageId, chat: { id: chatId, type: chatType } } } };
}

function tmpBrain() { return fs.mkdtempSync(path.join(os.tmpdir(), 'fcg-wp2-')); }

// ── grammar unit tests ───────────────────────────────────────────────────────

test('grammar: recognises every governance command + run-start prefix, rejects non-commands', () => {
  assert.deepEqual(parseGovernanceCommand('/status'), { command: 'status', args: [], runStart: false });
  assert.deepEqual(parseGovernanceCommand('/trace'), { command: 'trace', args: [], runStart: false });
  assert.deepEqual(parseGovernanceCommand('/watch milestones'), { command: 'watch', args: ['milestones'], runStart: false });
  assert.deepEqual(parseGovernanceCommand('/pause'), { command: 'pause', args: [], runStart: false });
  assert.deepEqual(parseGovernanceCommand('/resume'), { command: 'resume', args: [], runStart: false });
  assert.deepEqual(parseGovernanceCommand('/stop'), { command: 'stop', args: [], runStart: false });
  assert.deepEqual(parseGovernanceCommand('/approve'), { command: 'approve', args: [], runStart: false });
  // run-start prefixes are recognised (so they are NOT captured) but flagged.
  assert.deepEqual(parseGovernanceCommand('/gov ship it'), { command: 'gov', args: ['ship', 'it'], runStart: true });
  assert.deepEqual(parseGovernanceCommand('/run x'), { command: 'run', args: ['x'], runStart: true });
  // @botname suffix + case are normalised.
  assert.deepEqual(parseGovernanceCommand('/Status@FusionBot'), { command: 'status', args: [], runStart: false });
  // non-commands → null (→ ordinary capture).
  assert.equal(parseGovernanceCommand('buy oat milk'), null);
  assert.equal(parseGovernanceCommand('/unknown'), null);
  assert.equal(parseGovernanceCommand(''), null);
  assert.equal(parseGovernanceCommand(undefined), null);
});

test('grammar: decision callback_data parse (dec: prefix, token may contain colons)', () => {
  assert.deepEqual(parseDecisionCallback('dec:tok123:proceed'), { callbackData: 'dec:tok123:proceed', decision: 'proceed', gateToken: 'tok123' });
  assert.deepEqual(parseDecisionCallback('dec:a:b:c:reject'), { callbackData: 'dec:a:b:c:reject', decision: 'reject', gateToken: 'a:b:c' });
  assert.deepEqual(parseDecisionCallback('dec:onlytoken'), { callbackData: 'dec:onlytoken', decision: '', gateToken: 'onlytoken' });
  // ordinary action buttons are NOT decision cards.
  assert.equal(parseDecisionCallback('SaveToBrain'), null);
  assert.equal(parseDecisionCallback('KeepRaw'), null);
  assert.equal(parseDecisionCallback(undefined), null);
});

// ── detector unit tests (auth composition) ───────────────────────────────────

test('detector: authorised /status → gov_command; normal note → capture; dec: tap → gov_decision', () => {
  const cmd = classifyUpdate({ update: msg(1, '/status'), authorisedUserId: AUTH_ID });
  assert.equal(cmd.kind, 'gov_command');
  assert.equal(cmd.command, 'status');
  assert.equal(cmd.updateId, 1);

  const note = classifyUpdate({ update: msg(2, 'a normal thought'), authorisedUserId: AUTH_ID });
  assert.equal(note.kind, 'capture');

  const dec = classifyUpdate({ update: callback(3, 'dec:tok:proceed'), authorisedUserId: AUTH_ID });
  assert.equal(dec.kind, 'gov_decision');
  assert.equal(dec.decision, 'proceed');
  assert.equal(dec.gateToken, 'tok');
});

test('detector: an UNAUTHORISED /status and a GROUP /status are NOT gov-routed (return capture, no oracle)', () => {
  // Stranger issuing a command → NOT a governance signal (falls to capture path,
  // which default-denies quietly). No command parse leaks a governance response.
  const stranger = classifyUpdate({ update: msg(1, '/status', { fromId: STRANGER_ID, chatId: STRANGER_ID }), authorisedUserId: AUTH_ID });
  assert.equal(stranger.kind, 'capture');
  // Authorised user but in a GROUP → private-chat gate refuses gov routing.
  const group = classifyUpdate({ update: msg(2, '/status', { chatId: -100123, chatType: 'group' }), authorisedUserId: AUTH_ID });
  assert.equal(group.kind, 'capture');
});

test('in-memory ftw writer dedups on (source, source_event_id)', async () => {
  const w = createInMemoryFtwCommandIntake();
  const a = await w.recordCommandEvent({ command: 'status', args: [], chatId: AUTH_ID, senderId: AUTH_ID, updateId: 77, now: 1000 });
  const b = await w.recordCommandEvent({ command: 'status', args: [], chatId: AUTH_ID, senderId: AUTH_ID, updateId: 77, now: 2000 });
  assert.equal(a.isNew, true);
  assert.equal(b.isNew, false);
  assert.equal(w.list().length, 1);
  assert.equal(w.list()[0].kind, 'command:status');
  assert.equal(w.list()[0].source_event_id, '77');
  assert.equal(w.list()[0].self_generated, false);
});

// ── runner-level integration (the whole seam over the sole poller) ───────────

test('authorised /status → ONE ftw.run_event kind=command:status, NOT captured, NO card', async () => {
  const brainDir = tmpBrain();
  try {
    const store = createInMemoryOperationalStore();
    const adapter = createMockTelegramAdapter({ authorisedUserId: AUTH_ID });
    const runner = await makeRunner(brainDir, { store, adapter, clock: fixedClock(1_000_000) });

    adapter.deliver(msg(10, '/status'));
    const rounds = await runner.runUntilIdle();

    // Routed as governance, NOT captured.
    assert.equal(rounds[0].gov, 1, 'one governance signal routed');
    assert.equal(rounds[0].accepted, 0, 'a command is NOT an accepted capture');
    assert.equal(store.list().length, 0, 'no capture row for a command');
    assert.equal(adapter.sentCards.length, 0, 'no action card for a command');
    assert.equal(runner.runtime.markdownWriter.writeCount(), 0, 'no governed note');

    // Exactly one durable ftw.run_event, correctly shaped.
    const events = runner.runtime.ftwCommandIntake.list();
    assert.equal(events.length, 1);
    assert.equal(events[0].source, 'telegram');
    assert.equal(events[0].kind, 'command:status');
    assert.equal(events[0].source_event_id, '10');
    assert.equal(events[0].self_generated, false);
    assert.equal(events[0].payload.command, 'status');
    assert.equal(events[0].payload.sender_id, AUTH_ID);
    assert.equal(events[0].payload.chat_id, AUTH_ID);
    await runner.shutdown();
  } finally { fs.rmSync(brainDir, { recursive: true, force: true }); }
});

test('a normal text note still captures EXACTLY as before, and writes NO gov event', async () => {
  const brainDir = tmpBrain();
  try {
    const store = createInMemoryOperationalStore();
    const adapter = createMockTelegramAdapter({ authorisedUserId: AUTH_ID });
    const runner = await makeRunner(brainDir, { store, adapter, clock: fixedClock(2_000_000) });

    adapter.deliver(msg(20, 'buy oat milk'));
    const rounds = await runner.runUntilIdle();

    assert.equal(rounds[0].accepted, 1, 'the note is captured');
    assert.equal(rounds[0].gov, 0, 'no governance routing for a note');
    assert.equal(store.list().length, 1);
    assert.equal(store.list()[0].state, STATES.ACCEPTED, 'tap-gated: holds pending, unchanged behaviour');
    assert.equal(adapter.sentCards.filter((c) => c.op === 'send').length, 1, 'the pending card is still sent');
    assert.equal(runner.runtime.ftwCommandIntake.list().length, 0, 'NO gov event for a note');
    await runner.shutdown();
  } finally { fs.rmSync(brainDir, { recursive: true, force: true }); }
});

test('decision tap dec:<token>:proceed → command:decision event + answerCallbackQuery, NOT captured', async () => {
  const brainDir = tmpBrain();
  try {
    const store = createInMemoryOperationalStore();
    const adapter = createMockTelegramAdapter({ authorisedUserId: AUTH_ID });
    const runner = await makeRunner(brainDir, { store, adapter, clock: fixedClock(3_000_000) });

    adapter.deliver(callback(30, 'dec:gate-abc:proceed', { messageId: 5150, cbId: 'cbq-1' }));
    const rounds = await runner.runUntilIdle();

    assert.equal(rounds[0].gov, 1);
    assert.equal(rounds[0].callbacks, 0, 'a decision tap is NOT an ordinary action-button callback');
    assert.equal(store.list().length, 0, 'a decision tap creates NO capture row');
    assert.equal(runner.runtime.markdownWriter.writeCount(), 0);

    const events = runner.runtime.ftwCommandIntake.list();
    assert.equal(events.length, 1);
    assert.equal(events[0].kind, 'command:decision');
    assert.equal(events[0].source_event_id, 'cb:cbq-1');
    assert.equal(events[0].payload.callback_data, 'dec:gate-abc:proceed');
    assert.equal(events[0].payload.decision, 'proceed');
    assert.equal(events[0].payload.gate_token, 'gate-abc');
    assert.equal(events[0].payload.message_id, '5150');
    assert.equal(events[0].self_generated, false);

    // The callback was answered so Telegram stops the spinner (OUTBOUND only).
    assert.equal(adapter.answered.length, 1, 'answerCallbackQuery was called exactly once');
    assert.equal(adapter.answered[0].callbackQueryId, 'cbq-1');
    await runner.shutdown();
  } finally { fs.rmSync(brainDir, { recursive: true, force: true }); }
});

test('redelivered command update (same update_id, same batch) → ONE ftw event (dedup)', async () => {
  const brainDir = tmpBrain();
  try {
    const store = createInMemoryOperationalStore();
    const adapter = createMockTelegramAdapter({ authorisedUserId: AUTH_ID });
    const runner = await makeRunner(brainDir, { store, adapter, clock: fixedClock(4_000_000) });

    // Two deliveries of the SAME update_id (a redelivery that slips into one batch
    // before the offset acks it) → deduped on source_event_id='40'.
    adapter.deliver(msg(40, '/pause'), msg(40, '/pause'));
    const rounds = await runner.runUntilIdle();

    assert.equal(rounds[0].gov, 2, 'both updates were routed through the gov path');
    const events = runner.runtime.ftwCommandIntake.list();
    assert.equal(events.length, 1, 'but only ONE durable ftw event exists (dedup)');
    assert.equal(events[0].kind, 'command:pause');
    assert.equal(events[0].source_event_id, '40');
    assert.equal(store.list().length, 0, 'still no capture');
    await runner.shutdown();
  } finally { fs.rmSync(brainDir, { recursive: true, force: true }); }
});

test('UNAUTHORISED sender issuing /status → neither captured NOR gov-routed, ZERO response', async () => {
  const brainDir = tmpBrain();
  try {
    const store = createInMemoryOperationalStore();
    const adapter = createMockTelegramAdapter({ authorisedUserId: AUTH_ID });
    const runner = await makeRunner(brainDir, { store, adapter, clock: fixedClock(5_000_000) });

    adapter.deliver(msg(50, '/status', { fromId: STRANGER_ID, chatId: STRANGER_ID }));
    const rounds = await runner.runUntilIdle();

    assert.equal(rounds[0].gov, 0, 'no governance routing for a stranger');
    assert.equal(rounds[0].accepted, 0, 'no capture for a stranger');
    assert.equal(runner.runtime.ftwCommandIntake.list().length, 0, 'NO gov event — no disclosure to a stranger');
    assert.equal(store.list().length, 0, 'no durable capture row');
    assert.equal(adapter.sentCards.length, 0);
    assert.equal(adapter.sentMessages.length, 0, 'no reply of any kind to a stranger');
    assert.equal(adapter.answered.length, 0);
    await runner.shutdown();
  } finally { fs.rmSync(brainDir, { recursive: true, force: true }); }
});

test('/status in a GROUP → refused by the private-chat gate: no gov event, no capture, no leak', async () => {
  const brainDir = tmpBrain();
  try {
    const store = createInMemoryOperationalStore();
    const adapter = createMockTelegramAdapter({ authorisedUserId: AUTH_ID });
    const runner = await makeRunner(brainDir, { store, adapter, clock: fixedClock(6_000_000) });

    // Authorised user, but in a group (negative chat id, type 'group').
    adapter.deliver(msg(60, '/status', { chatId: -1000600, chatType: 'group' }));
    const rounds = await runner.runUntilIdle();

    assert.equal(rounds[0].gov, 0, 'the private-chat gate blocks gov routing in a group');
    assert.equal(runner.runtime.ftwCommandIntake.list().length, 0, 'NO gov event from a group command');
    assert.equal(store.list().length, 0, 'no capture either');
    assert.equal(adapter.sentMessages.length, 0, 'no reply leaks into the group');
    assert.equal(adapter.sentCards.length, 0);
    await runner.shutdown();
  } finally { fs.rmSync(brainDir, { recursive: true, force: true }); }
});

test('the sole poller is unchanged: gov detection adds NO extra getUpdates call', async () => {
  const brainDir = tmpBrain();
  try {
    const store = createInMemoryOperationalStore();
    const adapter = createMockTelegramAdapter({ authorisedUserId: AUTH_ID });
    let getUpdatesCalls = 0;
    const realGetUpdates = adapter.getUpdates.bind(adapter);
    adapter.getUpdates = async (opts) => { getUpdatesCalls += 1; return realGetUpdates(opts); };
    const runner = await makeRunner(brainDir, { store, adapter, clock: fixedClock(7_000_000) });

    // One batch carrying a note, a command, and a decision tap.
    adapter.deliver(msg(70, 'a note'), msg(71, '/status'), callback(72, 'dec:t:proceed'));
    await runner.pollOnce(); // exactly one poll cycle
    // pollOnce calls getUpdates exactly once; the gov handlers NEVER poll.
    assert.equal(getUpdatesCalls, 1, 'exactly one getUpdates per cycle — no second poller');
    assert.equal(store.list().length, 1, 'only the note captured');
    assert.equal(runner.runtime.ftwCommandIntake.list().length, 2, 'the command + the decision routed');
    await runner.shutdown();
  } finally { fs.rmSync(brainDir, { recursive: true, force: true }); }
});
