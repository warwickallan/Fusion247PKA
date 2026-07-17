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

// A "Save to Brain" (or other action) button tap on the card at cardRef.
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

test('TAP-GATED: message → pending action card (no write) → tap → governed note → completed card', async () => {
  const brainDir = tmpBrain();
  try {
    const store = createInMemoryOperationalStore();
    const adapter = createMockTelegramAdapter({ authorisedUserId: AUTH_ID });
    const clock = fixedClock(2_000_000);
    const runner = await makeRunner(brainDir, { store, adapter, clock });

    // 1. Message arrives → durable pending capture, card with buttons, NO write.
    adapter.deliver(msg(1, 'phone capture: buy oat milk'));
    const rounds = await runner.runUntilIdle();
    assert.equal(rounds[0].accepted, 1);
    assert.equal(rounds[0].processed, 0, 'nothing is claimable before the tap');

    let rec = store.list()[0];
    assert.equal(rec.state, STATES.ACCEPTED, 'capture HOLDS pending until the tap');
    assert.equal(runner.runtime.markdownWriter.writeCount(), 0, 'no write before the tap');
    const sends = adapter.sentCards.filter((c) => c.op === 'send');
    assert.equal(sends.length, 1);
    assert.equal(sends[0].cardModel.is_completed, false);
    assert.match(sends[0].cardModel.status_line, /Tap "Save to Brain"/);

    // Durable card target persisted (§4) — this is what makes the tap
    // resolvable after a restart.
    assert.deepEqual(rec.card_ref, { chat_id: sends[0].chatId, message_id: sends[0].messageId });

    // 2. The user taps "Save to Brain" → the saga runs → completed.
    adapter.deliver(tap(2, rec.card_ref));
    await runner.runUntilIdle();

    rec = store.list()[0];
    assert.equal(rec.state, STATES.COMPLETED);
    assert.equal(adapter.answered[0].text, 'Saving to your Brain…');
    assert.equal(adapter.answered[0].showAlert, false, 'SaveToBrain ack stays a subtle toast — the card edit is the feedback');

    // The governed note landed under the configured brain dir's 'captures' leaf.
    const notePath = rec.destination_ref.path;
    assert.ok(fs.existsSync(notePath), 'governed Markdown note exists');
    assert.ok(notePath.includes(`${path.sep}captures${path.sep}`), 'lands in the captures leaf');
    assert.match(fs.readFileSync(notePath, 'utf8'), /buy oat milk/);

    // Card edited to Completed on the SAME message id, with the destination
    // path in a Markdown code span (no Telegram auto-link of the filename).
    const edits = adapter.sentCards.filter((c) => c.op === 'edit');
    assert.equal(edits.length, 1);
    assert.equal(edits[0].messageId, sends[0].messageId, 'completion edits the ORIGINAL card');
    assert.equal(edits[0].cardModel.is_completed, true);
    assert.match(edits[0].cardModel.status_line, /\(`[^`]+\.md`\)/, 'destination path is backtick-wrapped');
    assert.equal(edits[0].cardModel.parse_mode, 'Markdown');
    await runner.shutdown();
  } finally {
    fs.rmSync(brainDir, { recursive: true, force: true });
  }
});

test('double-tap and tap-after-completion are idempotent no-ops (one write, honest toasts)', async () => {
  const brainDir = tmpBrain();
  try {
    const store = createInMemoryOperationalStore();
    const adapter = createMockTelegramAdapter({ authorisedUserId: AUTH_ID });
    const clock = fixedClock(3_000_000);
    const runner = await makeRunner(brainDir, { store, adapter, clock });

    adapter.deliver(msg(1, 'capture with a button tap'));
    await runner.runUntilIdle();
    const cardRef = store.list()[0].card_ref;

    // TWO taps land in the SAME batch (double-tap before the worker drains):
    // the first enqueues, the second is a state-inspected no-op.
    adapter.deliver(tap(2, cardRef), tap(3, cardRef, { cbId: 'cb-double' }));
    await runner.runUntilIdle();

    assert.equal(store.list()[0].state, STATES.COMPLETED);
    assert.equal(runner.runtime.markdownWriter.writeCount(), 1, 'exactly ONE governed write');
    assert.equal(adapter.answered.length, 2, 'both taps acknowledged');
    assert.equal(adapter.answered[0].text, 'Saving to your Brain…');
    assert.equal(adapter.answered[1].text, 'Already in progress — nothing to do.');

    // A LATE tap after completion: idempotent no-op with an honest toast.
    adapter.deliver(tap(4, cardRef, { cbId: 'cb-late' }));
    await runner.runUntilIdle();
    assert.equal(runner.runtime.markdownWriter.writeCount(), 1, 'still one write after a late tap');
    assert.equal(adapter.answered[2].text, 'Already saved to your Brain.');
    assert.equal(store.list().length, 1, 'still exactly one capture');
    await runner.shutdown();
  } finally {
    fs.rmSync(brainDir, { recursive: true, force: true });
  }
});

test('KeepRaw / AskLarry are WP0-minimal: honest "not available" toast, capture stays pending', async () => {
  const brainDir = tmpBrain();
  try {
    const store = createInMemoryOperationalStore();
    const adapter = createMockTelegramAdapter({ authorisedUserId: AUTH_ID });
    const clock = fixedClock(3_500_000);
    const runner = await makeRunner(brainDir, { store, adapter, clock });

    adapter.deliver(msg(1, 'not saved yet'));
    await runner.runUntilIdle();
    const cardRef = store.list()[0].card_ref;

    adapter.deliver(
      tap(2, cardRef, { action: 'KeepRaw', cbId: 'cb-keep' }),
      tap(3, cardRef, { action: 'AskLarry', cbId: 'cb-ask' }),
    );
    await runner.runUntilIdle();

    assert.equal(adapter.answered.length, 2);
    assert.match(adapter.answered[0].text, /Not available in WP0/);
    assert.match(adapter.answered[1].text, /Not available in WP0/);
    // Live phone finding 2026-07-17: the plain toast is invisible in practice —
    // these MUST-SEE answers go out as a dismissable pop-up (show_alert: true).
    assert.equal(adapter.answered[0].showAlert, true, 'KeepRaw answer is a pop-up, not a toast');
    assert.equal(adapter.answered[1].showAlert, true, 'AskLarry answer is a pop-up, not a toast');
    assert.equal(store.list()[0].state, STATES.ACCEPTED, 'capture stays pending');
    assert.equal(runner.runtime.markdownWriter.writeCount(), 0, 'no write happened');
    await runner.shutdown();
  } finally {
    fs.rmSync(brainDir, { recursive: true, force: true });
  }
});

test('NON-TEXT rejection: an authorised photo produces NO capture rows, NO write — only an honest notice', async () => {
  const brainDir = tmpBrain();
  try {
    const store = createInMemoryOperationalStore();
    const adapter = createMockTelegramAdapter({ authorisedUserId: AUTH_ID });
    const clock = fixedClock(3_800_000);
    const runner = await makeRunner(brainDir, { store, adapter, clock });

    // A photo update: message present, from the AUTHORISED user, but NO text
    // (exactly the live defect shape of 2026-07-16).
    adapter.deliver({
      update_id: 1,
      message: {
        message_id: 777,
        from: { id: AUTH_ID },
        chat: { id: AUTH_ID },
        photo: [{ file_id: 'AgACAgQAAxk', width: 90, height: 90 }],
      },
    });
    const rounds = await runner.runUntilIdle();

    // NO envelope, NO queue row, NO card, NO markdown, NO completion — ever.
    assert.equal(store.list().length, 0, 'no capture row for a non-text update');
    assert.equal(adapter.sentCards.length, 0, 'no card for a non-text update');
    assert.equal(runner.runtime.markdownWriter.writeCount(), 0, 'no governed write');
    assert.equal(rounds[0].accepted, 0);

    // The honest plain notice was sent to the authorised chat (no buttons).
    assert.equal(adapter.sentMessages.length, 1);
    assert.equal(String(adapter.sentMessages[0].chatId), AUTH_ID);
    assert.match(adapter.sentMessages[0].text, /Text only in WP0/);

    // Offset advanced past the rejected update — no redelivery loop.
    assert.equal(runner.offset, 2);
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
    // One initial card only; still pending (tap-gated).
    assert.equal(adapter.sentCards.filter((c) => c.op === 'send').length, 1);
    assert.equal(store.list()[0].state, STATES.ACCEPTED);

    // One tap → one write, completed.
    adapter.deliver(tap(3, store.list()[0].card_ref));
    await runner.runUntilIdle();
    assert.equal(store.list()[0].state, STATES.COMPLETED);
    assert.equal(runner.runtime.markdownWriter.writeCount(), 1, 'no duplicate Markdown write');
    await runner.shutdown();
  } finally {
    fs.rmSync(brainDir, { recursive: true, force: true });
  }
});

test('RESTART between card-send and tap: a pending capture still accepts the tap and completes on the ORIGINAL card', async () => {
  const brainDir = tmpBrain();
  try {
    const store = createInMemoryOperationalStore(); // durable state persists across the "restart"
    const clock = fixedClock(5_500_000);

    // Run 1: message arrives → pending capture + card. WORKER STOPS before any tap.
    const adapter1 = createMockTelegramAdapter({ authorisedUserId: AUTH_ID });
    const runner1 = await makeRunner(brainDir, { store, adapter: adapter1, clock });
    adapter1.deliver(msg(1, 'tapped only after the restart'));
    await runner1.runUntilIdle();

    const pending = store.list()[0];
    assert.equal(pending.state, STATES.ACCEPTED, 'pending at shutdown');
    assert.ok(pending.card_ref && pending.card_ref.message_id !== undefined, 'card_ref durable before the restart');
    const originalMessageId = pending.card_ref.message_id;
    await runner1.shutdown();

    // Run 2 = "restart": BRAND-NEW adapter (EMPTY in-memory card map) over the
    // SAME durable store. The tap arrives only now.
    const adapter2 = createMockTelegramAdapter({ authorisedUserId: AUTH_ID });
    const runner2 = await makeRunner(brainDir, { store, adapter: adapter2, clock });
    assert.equal(adapter2.cardTarget(pending.capture_id), undefined, 'fresh adapter has NO in-memory card target');

    adapter2.deliver(tap(2, pending.card_ref));
    await runner2.runUntilIdle();

    // The tap resolved the capture via the durable card_ref reverse lookup,
    // the saga completed, and the Completed edit re-targeted the ORIGINAL card.
    const rec = store.list()[0];
    assert.equal(rec.state, STATES.COMPLETED, 'post-restart tap completes the pending capture');
    assert.ok(fs.existsSync(rec.destination_ref.path), 'governed note exists');
    assert.equal(adapter2.answered[0].text, 'Saving to your Brain…');
    const edits = adapter2.sentCards.filter((c) => c.op === 'edit');
    assert.equal(edits.length, 1);
    assert.equal(edits[0].messageId, originalMessageId, 'edit targets the ORIGINAL card from durable card_ref');
    assert.equal(edits[0].cardModel.is_completed, true);
    await runner2.shutdown();
  } finally {
    fs.rmSync(brainDir, { recursive: true, force: true });
  }
});

test('restart recovery: the original card target survives via durable card_ref with a FRESH adapter', async () => {
  const brainDir = tmpBrain();
  try {
    const store = createInMemoryOperationalStore(); // durable state persists across the "restart"
    const clock = fixedClock(6_000_000);

    // Run 1: capture is tapped and completes, but the FINAL card edit FAILS
    // (adapter dies before it lands). Completion is durably committed; card_ref
    // is persisted.
    const adapter1 = createMockTelegramAdapter({ authorisedUserId: AUTH_ID });
    const runner1 = await makeRunner(brainDir, { store, adapter: adapter1, clock });
    adapter1.deliver(msg(1, 'survives a restart'));
    await runner1.runUntilIdle();
    adapter1.failNextEdit(); // the completion edit throws once (swallowed by the worker)
    adapter1.deliver(tap(2, store.list()[0].card_ref));
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

test('no false completion: a governed write failure after the tap leaves the item FAILED with no note and no completed card', async () => {
  const brainDir = tmpBrain();
  try {
    const store = createInMemoryOperationalStore();
    const adapter = createMockTelegramAdapter({ authorisedUserId: AUTH_ID });
    const clock = fixedClock(7_000_000);
    const runner = await makeRunner(brainDir, { store, adapter, clock });

    runner.runtime.markdownWriter.failNextWrite(1); // the governed write throws once

    adapter.deliver(msg(1, 'this write will fail'));
    await runner.runUntilIdle();
    adapter.deliver(tap(2, store.list()[0].card_ref)); // the user taps Save to Brain
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
