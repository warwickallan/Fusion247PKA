// Fusion Tower — dispatcher event-intake wiring for governance commands (BUILD-010
// WP1). Proves drainCommandEvents routes ONLY command:* events to the router, marks
// them processed advance-once, leaves the normal advance path's events untouched, and
// never sends inline (replies land ENQUEUED on the durable outbox). NO DB, NO live send.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadConfig } from '../src/config.js';
import { createMemoryStore } from '../src/store/memoryStore.js';
import { createDispatcher } from '../src/dispatcher.js';
import { createTelegramNotifier } from '../src/adapters/telegramNotifier.js';

const CHAT = '123456789';

function wire({ now = 1000 } = {}) {
  const config = loadConfig({ AUTHORISED_TELEGRAM_USER_ID: CHAT });
  const store = createMemoryStore();
  const outbox = createTelegramNotifier({ config }); // recipient bound to CHAT; never drained
  const dispatcher = createDispatcher({ store, config, adapters: {}, outbox, now: () => now });
  return { config, store, outbox, dispatcher };
}

async function writeCommand(store, name, { updateId, args = [], sender = CHAT, runId = null } = {}) {
  const { event } = await store.ingestEvent({
    source: 'telegram',
    sourceEventId: String(updateId),
    kind: `command:${name}`,
    runId,
    payload: { command: `/${name}`, args, chat_id: CHAT, sender_id: sender, ts: 1 },
  }, { now: 1 });
  return event;
}

test('drainCommandEvents — routes a /pause command event, mutates state, enqueues one reply, marks processed', async () => {
  const { store, dispatcher } = wire();
  const run = await store.createRun({ title: 'wp1' }, { now: 100 });
  const ev = await writeCommand(store, 'pause', { updateId: 'c1' });

  const out = await dispatcher.drainCommandEvents({});
  assert.equal(out.processed, 1);
  assert.equal(out.results[0].mutation, 'setRunPaused(true)');
  assert.equal((await store.getRun(run.run_id)).paused, true);
  // Advance-once: the event is processed and never re-routed.
  assert.equal((await store.getEvent(ev.event_id)).processed, true);
  const again = await dispatcher.drainCommandEvents({});
  assert.equal(again.processed, 0, 'a processed command is not re-routed');
  // One durable pending reply (never sent inline).
  assert.equal((await store.claimPendingNotifications(50)).length, 1);
});

test('drainCommandEvents — uses the config allowlist by default; a foreign sender is silently denied', async () => {
  const { store, dispatcher } = wire();
  const run = await store.createRun({ title: 'wp1' }, { now: 100 });
  await writeCommand(store, 'pause', { updateId: 'c2', sender: '999' });

  const out = await dispatcher.drainCommandEvents({}); // default allowlist = [CHAT]
  assert.equal(out.processed, 1);
  assert.equal(out.results[0].authorised, false);
  assert.equal(out.results[0].reason, 'unauthorised');
  assert.equal((await store.getRun(run.run_id)).paused, false, 'no mutation for a denied sender');
  assert.equal((await store.claimPendingNotifications(50)).length, 0, 'no reply for a denied sender');
});

test('drainCommandEvents — leaves NON-command (advance-path) events untouched', async () => {
  const { store, dispatcher } = wire();
  const run = await store.createRun({ title: 'wp1' }, { now: 100 });
  const { event: gh } = await store.ingestEvent(
    { source: 'github', sourceEventId: 'gh1', kind: 'pull_request.opened', runId: run.run_id }, { now: 2 },
  );
  await writeCommand(store, 'status', { updateId: 'c3' });

  const out = await dispatcher.drainCommandEvents({});
  assert.equal(out.processed, 1, 'only the command event was routed');
  assert.equal(out.results[0].command, 'status');
  // The github event is NOT consumed by the command path — still claimable for advance.
  assert.equal((await store.getEvent(gh.event_id)).processed, false);
  assert.equal((await store.claimNextEvent()).event_id, gh.event_id);
});

test('drainCommandEvents — a redelivered command update acts once (dedup at intake)', async () => {
  const { store, dispatcher } = wire();
  await store.createRun({ title: 'wp1' }, { now: 100 });
  await writeCommand(store, 'stop', { updateId: 'dup-9' });
  // A redelivery of the SAME update id dedups at ingest — no second row is created.
  await writeCommand(store, 'stop', { updateId: 'dup-9' });
  assert.equal((await store.listEvents()).filter((e) => e.kind === 'command:stop').length, 1);

  const out = await dispatcher.drainCommandEvents({});
  assert.equal(out.processed, 1);
  assert.equal((await store.claimPendingNotifications(50)).length, 1, 'exactly one reply');
});
