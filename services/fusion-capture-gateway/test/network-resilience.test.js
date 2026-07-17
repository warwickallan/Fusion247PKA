// TRANSIENT-NETWORK RESILIENCE + CARD-SEND RECOVERY (live finding 2026-07-17,
// Warwick's home network): a consumer router/NAT silently kills TCP connections
// held open ≥~45s; the poisoned undici keep-alive socket then fails the NEXT
// Bot API call with 'fetch failed'. Fixes under test:
//   1. the live adapter retries ONCE on a transient network rejection (fresh
//      socket from the pool) — never on an HTTP-level (parsed ok:false) error;
//   2. the runner's per-cycle recovery sweep re-offers the card for an
//      `accepted` capture whose initial card send failed (card_ref null).
// Hermetic: NO pg, NO network — injected fetchImpl / in-memory store / mock
// adapter, same patterns as telegramLiveAdapter.test.js and liveRunner.test.js.

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import {
  createLiveTelegramAdapter,
  isTransientNetworkError,
} from '../src/adapters/telegramLiveAdapter.js';
import { createInMemoryOperationalStore } from '../src/store/operationalStore.js';
import { createMockTelegramAdapter } from '../src/adapters/telegramAdapter.js';
import { createLiveRunner } from '../src/live/liveRunner.js';
import { loadConfig } from '../src/config.js';
import { STATES } from '../src/core/states.js';

const AUTH_ID = '424242';
// Obviously-fake token: 3-digit prefix does NOT match the scanner's Telegram
// VALUE pattern (needs 6+ digits) — safe to keep as a literal inside a test.
const FAKE_TOKEN = '123:AA-FAKE-not-a-real-token';
const API_BASE = 'https://api.telegram.example';

// ── the adapter's one-shot transient retry ──────────────────────────────────

// A fetch double that rejects with scripted errors for the first N calls, then
// answers with a Telegram-shaped ok response.
function flakyFetch(failures, payload = { ok: true, result: { message_id: 555 } }) {
  const fn = async () => {
    fn.calls += 1;
    if (fn.calls <= failures.length) throw failures[fn.calls - 1];
    return { status: 200, ok: true, json: async () => payload };
  };
  fn.calls = 0;
  return fn;
}

function undiciStyleFetchFailed() {
  // Global fetch wraps the socket error: TypeError('fetch failed').cause = ...
  const cause = Object.assign(new Error('read ECONNRESET'), { code: 'ECONNRESET' });
  const err = new TypeError('fetch failed');
  err.cause = cause;
  return err;
}

function liveAdapter(fetchImpl) {
  return createLiveTelegramAdapter({
    botToken: FAKE_TOKEN,
    authorisedUserId: AUTH_ID,
    fetchImpl,
    apiBase: API_BASE,
    retryDelayMs: 0, // keep the suite fast; production default is 250ms
  });
}

test('isTransientNetworkError classifies socket-level failures, not arbitrary errors', () => {
  assert.equal(isTransientNetworkError(undiciStyleFetchFailed()), true, 'fetch failed + ECONNRESET cause');
  assert.equal(isTransientNetworkError(Object.assign(new Error('boom'), { code: 'ECONNRESET' })), true);
  assert.equal(isTransientNetworkError(new Error('socket hang up')), true);
  assert.equal(isTransientNetworkError(new Error('certificate has expired')), false, 'TLS trust failure is NOT transient');
  assert.equal(isTransientNetworkError(new Error('anything else')), false);
});

test('a transient network failure is retried ONCE and the call succeeds on the fresh socket', async () => {
  const fetchImpl = flakyFetch([undiciStyleFetchFailed()]);
  const a = liveAdapter(fetchImpl);
  const parsed = await a.sendMessage(AUTH_ID, 'hello after retry');
  assert.equal(fetchImpl.calls, 2, 'exactly one retry');
  assert.equal(parsed.result.message_id, 555, 'the retried call returns the parsed result');
});

test('getUpdates recovers from a poisoned keep-alive socket via the same one-shot retry', async () => {
  const fetchImpl = flakyFetch(
    [undiciStyleFetchFailed()],
    { ok: true, result: [{ update_id: 9, message: { message_id: 1, from: { id: AUTH_ID }, text: 'x' } }] },
  );
  const a = liveAdapter(fetchImpl);
  const updates = await a.getUpdates({ offset: 0 });
  assert.equal(fetchImpl.calls, 2);
  assert.equal(updates.length, 1);
  assert.equal(updates[0].update_id, 9);
});

test('a SECOND consecutive network failure propagates (masked) — exactly one retry, never a loop', async () => {
  const fetchImpl = flakyFetch([undiciStyleFetchFailed(), undiciStyleFetchFailed()]);
  const a = liveAdapter(fetchImpl);
  await assert.rejects(
    () => a.sendMessage(AUTH_ID, 'still down'),
    (err) => {
      assert.match(err.message, /request failed after retry/);
      assert.ok(!err.message.includes(FAKE_TOKEN), 'token never leaks in the thrown error');
      return true;
    },
  );
  assert.equal(fetchImpl.calls, 2, 'one attempt + one retry, no more');
});

test('an HTTP-level Bot API error (parsed ok:false) is NEVER retried', async () => {
  let calls = 0;
  const fetchImpl = async () => {
    calls += 1;
    return { status: 400, ok: true, json: async () => ({ ok: false, description: 'Bad Request: message is not modified' }) };
  };
  const a = liveAdapter(fetchImpl);
  await assert.rejects(() => a.sendMessage(AUTH_ID, 'nope'), /rejected/);
  assert.equal(calls, 1, 'HTTP 4xx/5xx responses are not the transient-retry path');
});

test('a NON-transient rejection (e.g. TLS trust failure) is NOT retried', async () => {
  const fetchImpl = flakyFetch([new Error('certificate has expired')]);
  const a = liveAdapter(fetchImpl);
  await assert.rejects(() => a.sendMessage(AUTH_ID, 'nope'), /request failed:/);
  assert.equal(fetchImpl.calls, 1, 'no retry on a non-transient failure');
});

// ── the runner's card-send recovery sweep ───────────────────────────────────

function fixedClock(ms) {
  let t = ms;
  return { now: () => t, advance: (d) => { t += d; } };
}

function liveEnv(brainDir) {
  return {
    DATABASE_URL: 'postgresql://postgres:sUpErSeCrEtDbPw@localhost:5432/db?sslmode=require',
    TELEGRAM_BOT_TOKEN: FAKE_TOKEN,
    AUTHORISED_TELEGRAM_USER_ID: AUTH_ID,
    WORKER_ID: 'worker-live',
    CAPTURE_BRAIN_DIR: brainDir,
  };
}

async function makeRunner(brainDir, { store, adapter, clock, logSink } = {}) {
  const config = loadConfig(liveEnv(brainDir));
  assert.equal(config.fixturesMode, false);
  return createLiveRunner(config, {
    clock,
    logSink,
    leaseMs: 30_000,
    factories: { storeFactory: async () => store, adapterFactory: async () => adapter },
  });
}

function msg(updateId, text, messageId = updateId + 500) {
  return { update_id: updateId, message: { message_id: messageId, from: { id: AUTH_ID }, text } };
}

function tap(updateId, cardRef, { action = 'SaveToBrain', cbId = `cb-${updateId}` } = {}) {
  return {
    update_id: updateId,
    callback_query: {
      id: cbId, from: { id: AUTH_ID }, data: action,
      message: { message_id: cardRef.message_id, chat: { id: cardRef.chat_id } },
    },
  };
}

function tmpBrain() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'fcg-netres-'));
}

// A mock adapter whose sendCard fails N times (the live "sendMessage died on a
// NAT-killed socket AFTER intake durably committed" shape of update 9724165).
function failingSendAdapter(failures) {
  const adapter = createMockTelegramAdapter({ authorisedUserId: AUTH_ID });
  const realSend = adapter.sendCard.bind(adapter);
  let remaining = failures;
  adapter.sendCard = (captureId, cardModel) => {
    if (remaining > 0) {
      remaining -= 1;
      throw new Error('fetch failed (simulated NAT-killed keep-alive socket)');
    }
    return realSend(captureId, cardModel);
  };
  return adapter;
}

test('RECOVERY SWEEP: a durably-accepted capture whose initial card send failed gets its card on the next cycle, and the tap completes it', async () => {
  const brainDir = tmpBrain();
  const logs = [];
  try {
    const store = createInMemoryOperationalStore();
    const adapter = failingSendAdapter(1); // initial card send dies once
    const clock = fixedClock(9_000_000);
    const runner = await makeRunner(brainDir, { store, adapter, clock, logSink: (l) => logs.push(l) });

    // Cycle 1: the message is durably captured (intake commit point) but the
    // card send dies — EXACTLY the live "Test new" incident: accepted row,
    // card_ref null, Warwick staring at a chat with no card.
    adapter.deliver(msg(1, 'Test new'));
    const rounds = await runner.runUntilIdle();
    assert.ok(logs.some((l) => l.event === 'handle_update_failed'), 'the failed send surfaced honestly');
    let rec = store.list()[0];
    assert.equal(rec.state, STATES.ACCEPTED, 'capture is durable despite the failed card send');

    // The NEXT cycle's sweep recovered the card automatically (no operator
    // action) and persisted the durable card_ref.
    rec = store.list()[0];
    assert.ok(rec.card_ref && rec.card_ref.message_id !== undefined, 'card_ref persisted by the recovery sweep');
    assert.equal(adapter.sentCards.filter((c) => c.op === 'send').length, 1, 'exactly one card landed');
    assert.ok(rounds.some((r) => r.cards_recovered === 1), 'a round reported the recovery');
    assert.ok(logs.some((l) => l.event === 'card_send_recovered'), 'recovery diagnostic emitted');

    // The recovered card is fully functional: tap → saga → completed.
    adapter.deliver(tap(2, rec.card_ref));
    await runner.runUntilIdle();
    rec = store.list()[0];
    assert.equal(rec.state, STATES.COMPLETED, 'tap on the RECOVERED card completes the capture');
    assert.ok(fs.existsSync(rec.destination_ref.path), 'governed note exists');
    await runner.shutdown();
  } finally {
    fs.rmSync(brainDir, { recursive: true, force: true });
  }
});

test('RECOVERY SWEEP across a RESTART: a waiting cardless capture is picked up by a fresh worker automatically', async () => {
  const brainDir = tmpBrain();
  try {
    const store = createInMemoryOperationalStore(); // durable state survives the "restart"
    const clock = fixedClock(9_500_000);

    // Run 1: capture accepted, card send fails, worker STOPS (the live crash
    // window) — an accepted row with card_ref null is left behind.
    const adapter1 = failingSendAdapter(Infinity);
    const runner1 = await makeRunner(brainDir, { store, adapter: adapter1, clock });
    adapter1.deliver(msg(1, 'waiting for a card'));
    await runner1.pollOnce();
    assert.equal(store.list()[0].state, STATES.ACCEPTED);
    assert.equal(store.list()[0].card_ref, null, 'no card_ref at shutdown');
    await runner1.shutdown();

    // Run 2 = restart: a FRESH adapter/worker. The very first poll cycle's
    // sweep re-offers the card with NO new inbound update required.
    const adapter2 = createMockTelegramAdapter({ authorisedUserId: AUTH_ID });
    const runner2 = await makeRunner(brainDir, { store, adapter: adapter2, clock });
    const round = await runner2.pollOnce();
    assert.equal(round.cards_recovered, 1, 'restart recovers the waiting capture');
    const rec = store.list()[0];
    assert.ok(rec.card_ref && rec.card_ref.message_id !== undefined, 'durable card_ref persisted post-restart');
    assert.equal(rec.state, STATES.ACCEPTED, 'still tap-gated pending — recovery never writes');

    // And the tap now resolves through the recovered card_ref.
    adapter2.deliver(tap(2, rec.card_ref));
    await runner2.runUntilIdle();
    assert.equal(store.list()[0].state, STATES.COMPLETED);
    await runner2.shutdown();
  } finally {
    fs.rmSync(brainDir, { recursive: true, force: true });
  }
});

test('RECOVERY SWEEP is bounded and idempotent: at most 3 most-recent per cycle, carded/non-accepted rows untouched', async () => {
  const brainDir = tmpBrain();
  try {
    const store = createInMemoryOperationalStore();
    const adapter = createMockTelegramAdapter({ authorisedUserId: AUTH_ID });
    const clock = fixedClock(10_000_000);
    const runner = await makeRunner(brainDir, { store, adapter, clock });

    // Five cardless accepted rows at distinct times (oldest → newest)…
    for (let i = 1; i <= 5; i += 1) {
      store.recordIntake(
        { idempotency_key: `k-${i}`, capture_id: `cap_${i}`, source_channel: 'telegram', sender_identity_ref: `telegram:user:${AUTH_ID}`, text_preview: `n${i}` },
        { now: 10_000_000 + i },
      );
    }
    // …plus one that ALREADY has a card — the sweep must skip it.
    store.recordIntake(
      { idempotency_key: 'k-carded', capture_id: 'cap_carded', source_channel: 'telegram', sender_identity_ref: `telegram:user:${AUTH_ID}`, text_preview: 'carded' },
      { now: 10_000_010 },
    );
    store.recordCardRef('cap_carded', { chat_id: AUTH_ID, message_id: 42 }, { now: 10_000_011 });

    const round1 = await runner.pollOnce();
    assert.equal(round1.cards_recovered, 3, 'bounded: at most CARD_RECOVERY_LIMIT per cycle');
    const recoveredIds1 = adapter.sentCards.filter((c) => c.op === 'send').map((c) => c.captureId);
    assert.deepEqual(recoveredIds1.sort(), ['cap_3', 'cap_4', 'cap_5'], 'MOST RECENT cardless captures first, carded row skipped');

    // The next cycle picks up the remainder; the one after that finds nothing —
    // recovery is idempotent (card_ref persisted ⇒ never re-sent).
    const round2 = await runner.pollOnce();
    assert.equal(round2.cards_recovered, 2);
    const round3 = await runner.pollOnce();
    assert.equal(round3.cards_recovered, 0, 'nothing left to recover — no duplicate cards');
    assert.equal(adapter.sentCards.filter((c) => c.op === 'send').length, 5);
    await runner.shutdown();
  } finally {
    fs.rmSync(brainDir, { recursive: true, force: true });
  }
});
