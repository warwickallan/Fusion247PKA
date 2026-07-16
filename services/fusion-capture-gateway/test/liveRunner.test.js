// LIVE-RUNNER hermetic suite (PREPROVISION-CORRECTION-0001 §3/§4/§6).
//
// NO pg, NO DB, NO network. The runner is driven in live mode via INJECTED
// factories over a shared in-memory store + a scriptable mock adapter (the same
// pattern liveRuntime.test.js uses). Real config is built with loadConfig() so
// the corrected credential model + real describe() masking are exercised.

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { createInMemoryOperationalStore } from '../src/store/operationalStore.js';
import { createMockTelegramAdapter } from '../src/adapters/telegramAdapter.js';
import { createLiveRunner } from '../src/live/liveRunner.js';
import { loadConfig } from '../src/config.js';
import {
  resolveGovernedDestination,
  GOVERNED_BRAIN_DIR,
  GOVERNED_CAPTURE_SUBDIR,
} from '../src/live/runtime.js';
import { STATES } from '../src/core/states.js';

const AUTH_ID = '424242';
const DB_PW = 'sUpErSeCrEtDbPw';
const BOT_TOKEN = '123456:FAKE-not-a-real-token-xyz';

function fixedClock(ms) {
  let t = ms;
  return { now: () => t, set: (v) => { t = v; }, advance: (d) => { t += d; } };
}

function liveEnv(brainDir, overrides = {}) {
  return {
    DATABASE_URL: `postgresql://postgres:${DB_PW}@localhost:5432/db?sslmode=require`,
    TELEGRAM_BOT_TOKEN: BOT_TOKEN,
    AUTHORISED_TELEGRAM_USER_ID: AUTH_ID,
    WORKER_ID: 'worker-live',
    CAPTURE_BRAIN_DIR: brainDir,
    ...overrides,
  };
}

// Build a live-mode runner over an injectable shared store + adapter.
async function makeRunner(brainDir, { store, adapter, clock, logSink } = {}) {
  const config = loadConfig(liveEnv(brainDir));
  assert.equal(config.fixturesMode, false, 'minimal live config is not fixtures mode');
  return createLiveRunner(config, {
    clock,
    logSink,
    leaseMs: 30_000,
    factories: {
      storeFactory: async () => store,
      adapterFactory: async () => adapter,
    },
  });
}

function msg(updateId, text, messageId = updateId + 500) {
  return { update_id: updateId, message: { message_id: messageId, from: { id: AUTH_ID }, text } };
}

function tmpBrain() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'fcg-runner-'));
}

test('governed destination resolves the authority-backed Team Inbox in live mode', () => {
  // Nothing configured → live resolves the repo Team Inbox / captures leaf.
  const live = resolveGovernedDestination({ captureBrainDir: null, captureSandboxDir: null }, 'live');
  assert.equal(live.baseDir, GOVERNED_BRAIN_DIR);
  assert.equal(live.subdir, GOVERNED_CAPTURE_SUBDIR);
  assert.ok(GOVERNED_BRAIN_DIR.endsWith(`${path.sep}Team Inbox`), 'governed dir is repo Team Inbox');
  // Fixtures with nothing set → throwaway default, 'inbox' leaf.
  const fix = resolveGovernedDestination({ captureBrainDir: null, captureSandboxDir: null }, 'fixtures');
  assert.equal(fix.subdir, 'inbox');
  // Explicit override wins in either mode.
  const override = resolveGovernedDestination({ captureBrainDir: '/tmp/x', captureSandboxDir: null }, 'live');
  assert.equal(override.baseDir, '/tmp/x');
});

test('startup + shutdown: live mode assembled, masked start diagnostic, clean shutdown', async () => {
  const brainDir = tmpBrain();
  const logs = [];
  try {
    const store = createInMemoryOperationalStore();
    const adapter = createMockTelegramAdapter({ authorisedUserId: AUTH_ID });
    const runner = await makeRunner(brainDir, { store, adapter, clock: fixedClock(1_000_000), logSink: (l) => logs.push(l) });
    const rt = runner.start();
    assert.equal(rt.mode, 'live');
    assert.ok(logs.some((l) => l.event === 'start'), 'a start diagnostic was emitted');
    await runner.shutdown();
    assert.ok(logs.some((l) => l.event === 'shutdown'));
  } finally {
    fs.rmSync(brainDir, { recursive: true, force: true });
  }
});

test('ordinary message → durable capture → governed note in Team Inbox/captures → completed card', async () => {
  const brainDir = tmpBrain();
  try {
    const store = createInMemoryOperationalStore();
    const adapter = createMockTelegramAdapter({ authorisedUserId: AUTH_ID });
    const clock = fixedClock(2_000_000);
    const runner = await makeRunner(brainDir, { store, adapter, clock });

    adapter.deliver(msg(1, 'phone capture: buy oat milk'));
    const rounds = await runner.runUntilIdle();
    assert.ok(rounds[0].accepted === 1 && rounds[0].processed >= 1);

    const rec = store.list()[0];
    assert.equal(rec.state, STATES.COMPLETED);

    // The governed note landed under the configured brain dir's 'captures' leaf.
    const notePath = rec.destination_ref.path;
    assert.ok(fs.existsSync(notePath), 'governed Markdown note exists');
    assert.ok(notePath.includes(`${path.sep}captures${path.sep}`), 'lands in the captures leaf');
    assert.match(fs.readFileSync(notePath, 'utf8'), /buy oat milk/);

    // Card sent then edited to Completed on the SAME message id.
    const sends = adapter.sentCards.filter((c) => c.op === 'send');
    const edits = adapter.sentCards.filter((c) => c.op === 'edit');
    assert.equal(sends.length, 1);
    assert.equal(edits.length, 1);
    assert.equal(edits[0].messageId, sends[0].messageId, 'completion edits the ORIGINAL card');
    assert.equal(edits[0].cardModel.is_completed, true);

    // Durable card target persisted (§4).
    assert.deepEqual(rec.card_ref, { chat_id: sends[0].chatId, message_id: sends[0].messageId });
    await runner.shutdown();
  } finally {
    fs.rmSync(brainDir, { recursive: true, force: true });
  }
});

test('Save-to-Brain callback_query is routed to its capture and acknowledged', async () => {
  const brainDir = tmpBrain();
  try {
    const store = createInMemoryOperationalStore();
    const adapter = createMockTelegramAdapter({ authorisedUserId: AUTH_ID });
    const clock = fixedClock(3_000_000);
    const runner = await makeRunner(brainDir, { store, adapter, clock });

    adapter.deliver(msg(1, 'capture with a button tap'));
    await runner.runUntilIdle();
    const rec = store.list()[0];
    const { chat_id: chatId, message_id: messageId } = rec.card_ref;

    // The user taps "Save to Brain" on that card.
    adapter.deliver({
      update_id: 2,
      callback_query: {
        id: 'cb-1', from: { id: AUTH_ID }, data: 'SaveToBrain',
        message: { message_id: messageId, chat: { id: chatId } },
      },
    });
    await runner.runUntilIdle();

    assert.equal(adapter.answered.length, 1, 'the callback was acknowledged');
    assert.equal(adapter.answered[0].text, 'Saving to your Brain…');
    assert.ok(runner.offset >= 3, 'offset advanced past the callback');
    await runner.shutdown();
  } finally {
    fs.rmSync(brainDir, { recursive: true, force: true });
  }
});

test('offset advances durably and acknowledged updates are never re-fetched', async () => {
  const brainDir = tmpBrain();
  try {
    const store = createInMemoryOperationalStore();
    const adapter = createMockTelegramAdapter({ authorisedUserId: AUTH_ID });
    const clock = fixedClock(4_000_000);
    const runner = await makeRunner(brainDir, { store, adapter, clock });

    adapter.deliver(msg(5, 'first'));
    await runner.runUntilIdle();
    assert.equal(runner.offset, 6, 'offset advanced to update_id+1');
    assert.equal(await store.getPollOffset('telegram'), 6, 'offset persisted durably in the store');

    // Re-delivering the already-acknowledged update (id 5 < offset 6) is filtered
    // by getUpdates — the transport never hands it back, so it is not reprocessed.
    adapter.deliver(msg(5, 'first'));
    const again = await runner.pollOnce();
    assert.equal(again.fetched, 0, 'an acknowledged update is not re-fetched');
    assert.equal(store.list().length, 1, 'still exactly one capture');
    await runner.shutdown();
  } finally {
    fs.rmSync(brainDir, { recursive: true, force: true });
  }
});

test('redelivery of the same logical message is deduped — no duplicate Markdown, no second row', async () => {
  const brainDir = tmpBrain();
  try {
    const store = createInMemoryOperationalStore();
    const adapter = createMockTelegramAdapter({ authorisedUserId: AUTH_ID });
    const clock = fixedClock(5_000_000);
    const runner = await makeRunner(brainDir, { store, adapter, clock });

    // Two DISTINCT update_ids carrying the SAME message (same message_id + text)
    // ⇒ same idempotency key ⇒ the second is a dedup hit (simulates a Telegram
    // redelivery that slipped past the offset window before ack).
    adapter.deliver(
      { update_id: 1, message: { message_id: 900, from: { id: AUTH_ID }, text: 'idempotent note' } },
      { update_id: 2, message: { message_id: 900, from: { id: AUTH_ID }, text: 'idempotent note' } },
    );
    await runner.runUntilIdle();

    assert.equal(store.list().length, 1, 'exactly one capture despite redelivery');
    const rec = store.list()[0];
    assert.equal(rec.state, STATES.COMPLETED);
    // One initial card only, and exactly one governed note on disk.
    assert.equal(adapter.sentCards.filter((c) => c.op === 'send').length, 1);
    assert.equal(runner.runtime.markdownWriter.writeCount(), 1, 'no duplicate Markdown write');
    await runner.shutdown();
  } finally {
    fs.rmSync(brainDir, { recursive: true, force: true });
  }
});

test('restart recovery: the original card target survives via durable card_ref with a FRESH adapter', async () => {
  const brainDir = tmpBrain();
  try {
    const store = createInMemoryOperationalStore(); // durable state persists across the "restart"
    const clock = fixedClock(6_000_000);

    // Run 1: capture completes, but the FINAL card edit FAILS (adapter dies before
    // it lands). Completion is durably committed; card_ref is persisted.
    const adapter1 = createMockTelegramAdapter({ authorisedUserId: AUTH_ID });
    const runner1 = await makeRunner(brainDir, { store, adapter: adapter1, clock });
    adapter1.deliver(msg(1, 'survives a restart'));
    adapter1.failNextEdit(); // the completion edit throws once (swallowed by the worker)
    await runner1.runUntilIdle();

    const rec = store.list()[0];
    assert.equal(rec.state, STATES.COMPLETED, 'completion committed despite the failed edit');
    assert.equal(adapter1.sentCards.filter((c) => c.op === 'edit').length, 0, 'no successful edit landed in run 1');
    const originalMessageId = rec.card_ref.message_id;
    assert.ok(originalMessageId !== undefined, 'card target persisted in durable state');
    await runner1.shutdown();

    // Run 2 = "restart": a BRAND-NEW adapter with an EMPTY in-memory card map,
    // over the SAME durable store. Re-project the card — it must re-target the
    // ORIGINAL message id, recovered purely from card_ref.
    const adapter2 = createMockTelegramAdapter({ authorisedUserId: AUTH_ID });
    const runner2 = await makeRunner(brainDir, { store, adapter: adapter2, clock });
    assert.equal(adapter2.cardTarget(rec.capture_id), undefined, 'fresh adapter has NO in-memory card target');

    const entry = await runner2.reprojectCard(rec.capture_id);
    assert.equal(entry.messageId, originalMessageId, 'restart re-targets the ORIGINAL card from card_ref');
    assert.equal(entry.cardModel.is_completed, true, 'the recovered card shows Completed');
    await runner2.shutdown();
  } finally {
    fs.rmSync(brainDir, { recursive: true, force: true });
  }
});

test('no false completion: a governed write failure leaves the item FAILED with no note and no completed card', async () => {
  const brainDir = tmpBrain();
  try {
    const store = createInMemoryOperationalStore();
    const adapter = createMockTelegramAdapter({ authorisedUserId: AUTH_ID });
    const clock = fixedClock(7_000_000);
    const runner = await makeRunner(brainDir, { store, adapter, clock });

    runner.runtime.markdownWriter.failNextWrite(1); // the governed write throws once

    adapter.deliver(msg(1, 'this write will fail'));
    await runner.runUntilIdle();

    const rec = store.list()[0];
    assert.equal(rec.state, STATES.FAILED, 'honest failure — NOT completed');
    assert.equal(rec.destination_ref, null, 'no destination pointer on a failed write');
    // No governed note on disk, and the card was never edited to Completed.
    assert.equal(runner.runtime.markdownWriter.writeCount(), 0, 'nothing written to disk');
    assert.ok(!adapter.sentCards.some((c) => c.op === 'edit' && c.cardModel.is_completed), 'card never claims Completed');
    await runner.shutdown();
  } finally {
    fs.rmSync(brainDir, { recursive: true, force: true });
  }
});

test('secrets are absent from ALL diagnostics (start + poll), even on error paths', async () => {
  const brainDir = tmpBrain();
  const logs = [];
  try {
    const store = createInMemoryOperationalStore();
    const adapter = createMockTelegramAdapter({ authorisedUserId: AUTH_ID });
    const clock = fixedClock(8_000_000);
    const runner = await makeRunner(brainDir, { store, adapter, clock, logSink: (l) => logs.push(l) });

    runner.start();
    adapter.deliver(msg(1, 'log hygiene check'));
    await runner.runUntilIdle();
    // Force a diagnostic on an error path too (getUpdates throws once).
    const original = adapter.getUpdates.bind(adapter);
    adapter.getUpdates = async () => { throw new Error(`boom with ${DB_PW} and ${BOT_TOKEN} echoed`); };
    await runner.pollOnce();
    adapter.getUpdates = original;

    const serialised = JSON.stringify(logs);
    assert.ok(!serialised.includes(DB_PW), 'DB password never appears in any diagnostic');
    assert.ok(!serialised.includes(BOT_TOKEN), 'bot token never appears in any diagnostic');
    assert.ok(!serialised.includes('FAKE-not-a-real-token'), 'no token fragment leaks');
    // The error WAS logged (redacted), proving we exercised the redaction path.
    assert.ok(logs.some((l) => l.event === 'get_updates_failed'), 'the error path emitted a redacted diagnostic');
    await runner.shutdown();
  } finally {
    fs.rmSync(brainDir, { recursive: true, force: true });
  }
});
