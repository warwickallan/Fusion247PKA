// BUILD-010 WP1 — durable, retry-safe OUTBOUND Telegram notifier tests.
//
// NO LIVE SEND. Every test injects a FAKE telegramClient that records sends in
// memory. The ONE live test at the bottom is capability-gated (skipped unless a
// TELEGRAM_BOT_TOKEN + AUTHORISED_TELEGRAM_USER_ID are present) so CI stays portable.
//
// Proves the four reliability properties over Silas's in-memory notification outbox:
//   · enqueue -> drain sends and records the Telegram message_id (sent-with-proof)
//   · a transient send failure LEAVES the row claimable; a later drainOnce re-sends
//     then marks it sent (retry-safe, NO loss)
//   · dedup — the same run+purpose enqueued twice => exactly ONE send
//   · a token-shaped body is REFUSED at enqueue (never enqueued, never sent)
//   · the wire text carries the correct [TAG]

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { loadConfig } from '../src/config.js';
import { createMemoryStore } from '../src/store/memoryStore.js';
import {
  createTelegramNotifier,
  computeDedupKey,
  wireText,
  scrubToken,
  drainOnce,
} from '../src/adapters/telegramNotifier.js';

const CHAT_ID = '987654321';

// A fake OUTBOUND client. Records every send. `failTimes` makes the FIRST N sends
// throw a transient error, then succeed — to exercise retry without a live API.
function fakeClient({ failTimes = 0, alwaysFail = false } = {}) {
  const sends = [];
  let calls = 0;
  let seq = 1000;
  return {
    ready: true,
    sends,
    get callCount() { return calls; },
    async sendMessage(recipient, text) {
      calls += 1;
      sends.push({ recipient, text });
      if (alwaysFail || calls <= failTimes) {
        throw new Error('telegramClient: sendMessage rejected: bot api 502 (transient)');
      }
      return { ok: true, message_id: String(seq++), chatId: String(recipient) };
    },
  };
}

function wire({ client } = {}) {
  const config = loadConfig({
    AUTHORISED_TELEGRAM_USER_ID: CHAT_ID,
    // NB: no TELEGRAM_BOT_TOKEN — the fake client owns "sending"; the notifier never
    // needs the token in these tests.
  });
  const store = createMemoryStore();
  const notifier = createTelegramNotifier({ config, telegramClient: client ?? fakeClient() });
  return { config, store, notifier };
}

const spec = (over = {}) => ({
  runId: 'run-1', logicalSource: 'TOWER', purpose: 'run_created', body: 'run run-1: created — t', ...over,
});

test('notify: enqueues then drains — the fake client records the send and the row is sent with the message_id', async () => {
  const client = fakeClient();
  const { store, notifier } = wire({ client });

  const r = await notify_(notifier, store, spec());
  assert.equal(r.enqueued, true);
  assert.equal(r.drain.sent, 1);
  assert.equal(client.sends.length, 1);

  const row = await store.getNotification(r.dedupKey);
  assert.equal(row.state, 'sent');
  assert.ok(row.provider_message_id, 'sent row carries a real Telegram message_id (sent-with-proof)');
  // No pending backlog remains.
  assert.equal((await store.claimPendingNotifications(50)).length, 0);
});

test('wire text carries the correct [TAG] (message-identity)', async () => {
  const client = fakeClient();
  const { store, notifier } = wire({ client });
  await notify_(notifier, store, spec({ logicalSource: 'CODEX', body: 'Codex review complete' }));
  assert.equal(client.sends.length, 1);
  assert.equal(client.sends[0].text, '[CODEX] Codex review complete');
  assert.equal(wireText('CI', 'CI GREEN'), '[CI] CI GREEN');
});

test('retry-safe / NO loss: a transient send failure leaves the row claimable; a later drainOnce re-sends then marks sent', async () => {
  const client = fakeClient({ failTimes: 1 }); // first send throws, second succeeds
  const { store, notifier } = wire({ client });

  // notify enqueues + attempts an immediate drain — which FAILS transiently.
  const r = await notify_(notifier, store, spec());
  assert.equal(r.enqueued, true);
  assert.equal(r.drain.sent, 0);
  assert.equal(r.drain.failed, 0, 'a single transient failure is NOT a terminal give-up');
  assert.equal(r.drain.retriable, 1);

  // The row was NOT lost and NOT marked failed — it is still pending & claimable.
  const mid = await store.getNotification(r.dedupKey);
  assert.equal(mid.state, 'pending', 'transient failure keeps the row pending (retriable)');
  assert.equal((await store.claimPendingNotifications(50)).length, 1);

  // A later drainOnce re-sends and now succeeds.
  const d2 = await notifier.drainOnce(store);
  assert.equal(d2.sent, 1);
  const done = await store.getNotification(r.dedupKey);
  assert.equal(done.state, 'sent');
  assert.ok(done.provider_message_id);
  assert.equal(client.callCount, 2, 'exactly two send attempts — one failed, one succeeded');
});

test('dedup: the same run+purpose enqueued twice => exactly ONE row and ONE send', async () => {
  const client = fakeClient();
  const { store, notifier } = wire({ client });

  const a = await notifier.enqueue(store, spec(), { now: 1 });
  const b = await notifier.enqueue(store, spec(), { now: 2 }); // identical run+purpose+recipient+source
  assert.equal(a.enqueued, true);
  assert.equal(b.enqueued, false, 'the duplicate collides on the dedup key — no second row');
  assert.equal(a.dedupKey, b.dedupKey);
  assert.equal((await store.claimPendingNotifications(50)).length, 1);

  const d = await notifier.drainOnce(store);
  assert.equal(d.sent, 1, 'exactly one send for the deduped milestone');
  assert.equal(client.sends.length, 1);
});

test('token-shaped body is REFUSED at enqueue — never enqueued, never sent', async () => {
  const client = fakeClient();
  const { store, notifier } = wire({ client });
  // A token-SHAPED fake, assembled at runtime so no source line matches the repo
  // secret scanner while the runtime value is still bot-token shaped.
  const fakeToken = `${'123456789'}:${'AA'}${'H'.repeat(34)}`;
  const tokenBody = `oops leaking ${fakeToken} in a body`;

  await assert.rejects(
    () => notifier.enqueue(store, spec({ body: tokenBody }), { now: 1 }),
    /secret-shaped/i,
    'a body carrying a bot-token shape must be refused before enqueue',
  );
  assert.equal((await store.claimPendingNotifications(50)).length, 0, 'nothing was enqueued');
  assert.equal(client.sends.length, 0, 'nothing was sent');
});

test('bounded give-up: after maxAttempts consecutive failures the row is durably failed (poison guard)', async () => {
  const client = fakeClient({ alwaysFail: true });
  const { store, notifier } = wire({ client });
  await notifier.enqueue(store, spec(), { now: 1 });

  // maxAttempts=2 → first drain leaves it pending (retriable), second gives up.
  const d1 = await notifier.drainOnce(store, { maxAttempts: 2 });
  assert.equal(d1.retriable, 1);
  assert.equal((await store.claimPendingNotifications(50)).length, 1, 'still claimable after 1 failure');

  const d2 = await notifier.drainOnce(store, { maxAttempts: 2 });
  assert.equal(d2.failed, 1);
  const dk = computeDedupKey({ runId: 'run-1', purpose: 'run_created', recipient: CHAT_ID, logicalSource: 'TOWER' });
  const row = await store.getNotification(dk);
  assert.equal(row.state, 'failed', 'bounded give-up records a durable terminal failure');
  assert.equal((await store.claimPendingNotifications(50)).length, 0, 'a failed row is no longer claimed');
});

test('drainOnce never throws out of the loop — one bad row does not stall the rest', async () => {
  const store = createMemoryStore();
  const config = loadConfig({ AUTHORISED_TELEGRAM_USER_ID: CHAT_ID });
  const recipient = CHAT_ID;
  // Two rows: the first always fails, the second always succeeds.
  await store.enqueueNotification({ dedupKey: 'k1', runId: 'r', recipient, logicalSource: 'TOWER', purpose: 'p1', body: 'a' }, { now: 1 });
  await store.enqueueNotification({ dedupKey: 'k2', runId: 'r', recipient, logicalSource: 'TOWER', purpose: 'p2', body: 'b' }, { now: 2 });
  let n = 0;
  const client = {
    ready: true,
    async sendMessage(_to, _text) { n += 1; if (n === 1) throw new Error('boom'); return { message_id: '42' }; },
  };
  const res = await drainOnce(store, client, { limit: 10, maxAttempts: 5 });
  assert.equal(res.sent, 1, 'the good row still sent despite the bad one failing');
  assert.equal(res.retriable, 1);
  assert.equal((await store.getNotification('k2')).state, 'sent');
  assert.equal((await store.getNotification('k1')).state, 'pending');
});

test('scrubToken masks the bot token everywhere', () => {
  // Runtime-assembled token shape (kept off any single source line for the scanner).
  const token = `${'123456789'}:${'AA'}${'Hsecret'.repeat(5)}`;
  const msg = `failed hitting https://api.telegram.org/bot${token}/sendMessage`;
  const clean = scrubToken(msg, token);
  assert.ok(!clean.includes(token), 'the token must never survive scrubbing');
  assert.match(clean, /masked/);
});

// ── capability-gated LIVE test (skipped unless creds present) ────────────────────
// Sends ONE real message to the authorised chat and asserts ok + a real message_id.
// Portable: with no token this is a clean skip and NO live send happens in CI.
const LIVE = Boolean(process.env.TELEGRAM_BOT_TOKEN && process.env.AUTHORISED_TELEGRAM_USER_ID);
test('LIVE (gated): a single real sendMessage returns ok + a message_id', { skip: !LIVE }, async () => {
  const { createTelegramClient } = await import('../src/adapters/telegramNotifier.js');
  const config = loadConfig(process.env);
  const client = createTelegramClient({ config });
  const res = await client.sendMessage(
    config.authorisedTelegramUserId,
    wireText('TOWER', `BUILD-010 WP1 live notifier check @ ${new Date().toISOString()}`),
  );
  assert.equal(res.ok, true);
  assert.ok(res.message_id, 'a real Telegram message_id came back');
});

// small helper: the notifier.notify signature is notify(store, spec, {now}).
async function notify_(notifier, store, s) { return notifier.notify(store, s, { now: 1 }); }
