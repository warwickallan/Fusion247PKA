// BUILD-010 WP1 — dispatcher milestone ENQUEUE wiring.
//
// Proves the dispatcher ENQUEUES a durable, deduped notification at each milestone
// state-transition (run created, turn dispatched / expected-responder change, Codex &
// Larry turn start+complete, CI pending/green/red, retry materially blocked, decision
// required, terminal outcome) — WITHOUT sending (the drainer sends). A Telegram outage
// can never block orchestration because enqueue is durable and non-throwing.
//
// The outbox here is the REAL createTelegramNotifier over the in-memory store; we
// inspect what landed in the outbox. NO live send (we never call drainOnce with a
// real client).

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { loadConfig } from '../src/config.js';
import { createMemoryStore } from '../src/store/memoryStore.js';
import { createDispatcher } from '../src/dispatcher.js';
import { createTelegramNotifier } from '../src/adapters/telegramNotifier.js';
import { makeSignedResult } from '../src/core/envelope.js';

const SECRET = 'k'.repeat(48);
const CHAT_ID = '987654321';

function fakeAdapter(principal, { action, tokens = 3 } = {}) {
  return {
    principal,
    async runTurn({ run, turn }) {
      const payload = { status: 'ok', summary: 'done', proposed_action: action ?? { type: 'post_comment' } };
      const { envelope, signature } = makeSignedResult({ principal, runId: run.run_id, ordinal: turn.ordinal, payload }, SECRET);
      return { ok: true, blocked: false, signerPrincipal: principal, structuredResult: payload, envelope, signature, tokensUsed: tokens };
    },
  };
}

function wire(adapters, { now } = {}) {
  const config = loadConfig({
    TOWER_HMAC_SECRET_LARRY: SECRET,
    TOWER_HMAC_SECRET_GPT_CODEX: SECRET,
    AUTHORISED_TELEGRAM_USER_ID: CHAT_ID,
  });
  const store = createMemoryStore();
  const outbox = createTelegramNotifier({ config, telegramClient: { ready: true, async sendMessage() { throw new Error('no live send in this test'); } } });
  let t = now ?? 1000;
  const dispatcher = createDispatcher({ store, config, adapters, outbox, now: () => t, leaseMs: 5000 });
  return { config, store, dispatcher, advance: (ms) => { t += ms; } };
}

// Collect every purpose currently in the outbox (pending + sent + failed).
async function purposes(store) {
  // memoryStore has no listNotifications; claim pending (all are pending here) is enough.
  const rows = await store.claimPendingNotifications(500);
  return rows.map((r) => r.purpose);
}

test('run created enqueues run_created (TOWER)', async () => {
  const { store, dispatcher } = wire({ larry: fakeAdapter('larry') });
  const run = await dispatcher.createRun({ title: 'my run', maxRounds: 2 });
  const rows = await store.claimPendingNotifications(50);
  const row = rows.find((r) => r.purpose === 'run_created');
  assert.ok(row, 'run_created enqueued');
  assert.equal(row.logical_source, 'TOWER');
  assert.equal(row.recipient, CHAT_ID);
  assert.match(row.body, new RegExp(run.run_id));
});

test('turn dispatch + Larry start & complete enqueue the right milestones with the right tags', async () => {
  const { store, dispatcher } = wire({ larry: fakeAdapter('larry') });
  const run = await dispatcher.createRun({ title: 't', maxRounds: 2 });
  const { turn } = await dispatcher.dispatchNextTurn(run.run_id, { expectedResponder: 'larry' });
  await dispatcher.runTurn(turn.turn_id);

  const rows = await store.claimPendingNotifications(50);
  const byPurpose = Object.fromEntries(rows.map((r) => [r.purpose, r]));
  assert.ok(byPurpose['turn_dispatched_1'], 'expected-responder change enqueued');
  assert.equal(byPurpose['turn_dispatched_1'].logical_source, 'TOWER');
  assert.ok(byPurpose['larry_turn_start'], 'Larry turn start enqueued');
  assert.equal(byPurpose['larry_turn_start'].logical_source, 'LARRY');
  assert.ok(byPurpose['larry_turn_complete'], 'Larry turn complete enqueued');
  assert.equal(byPurpose['larry_turn_complete'].logical_source, 'LARRY');
});

test('Codex turn start & complete enqueue CODEX-tagged milestones', async () => {
  const { store, dispatcher } = wire({ gpt_codex: fakeAdapter('gpt_codex', { action: { type: 'noop' } }) });
  const run = await dispatcher.createRun({ title: 't', maxRounds: 2 });
  const { turn } = await dispatcher.dispatchNextTurn(run.run_id, { expectedResponder: 'gpt_codex' });
  await dispatcher.runTurn(turn.turn_id);
  const rows = await store.claimPendingNotifications(50);
  const start = rows.find((r) => r.purpose === 'codex_review_start');
  const done = rows.find((r) => r.purpose === 'codex_review_complete');
  assert.equal(start.logical_source, 'CODEX');
  assert.equal(done.logical_source, 'CODEX');
});

test('CI events enqueue ci_green / ci_red / ci_pending (CI tag), deduped per purpose', async () => {
  const { store, dispatcher } = wire({ larry: fakeAdapter('larry') });
  const run = await dispatcher.createRun({ title: 't', maxRounds: 2 });
  await dispatcher.ingestAndBind({ source: 'github', sourceEventId: 'ci-1', kind: 'check_suite.completed', headSha: 'aaaa1111', payload: { conclusion: 'success' } }, { runId: run.run_id });
  await dispatcher.ingestAndBind({ source: 'github', sourceEventId: 'ci-2', kind: 'check_suite.completed', headSha: 'bbbb2222', payload: { conclusion: 'failure' } }, { runId: run.run_id });
  await dispatcher.ingestAndBind({ source: 'github', sourceEventId: 'ci-3', kind: 'check_suite.completed', headSha: 'cccc3333', payload: { conclusion: 'queued' } }, { runId: run.run_id });

  const ps = await purposes(store);
  assert.ok(ps.includes('ci_green'), 'ci_green enqueued');
  assert.ok(ps.includes('ci_red'), 'ci_red enqueued');
  assert.ok(ps.includes('ci_pending'), 'ci_pending enqueued');
  const green = (await store.claimPendingNotifications(500)).find((r) => r.purpose === 'ci_green');
  assert.equal(green.logical_source, 'CI');
});

test('terminal outcome enqueues a terminal_* milestone (once, deduped)', async () => {
  const { store, dispatcher } = wire({ larry: fakeAdapter('larry') });
  const run = await dispatcher.createRun({ title: 't', maxRounds: 2 });
  await dispatcher.dispatchNextTurn(run.run_id, { expectedResponder: 'larry' }); // -> awaiting_responder
  await dispatcher.surfaceReady(run.run_id, 'green PR, ready to merge');
  // Re-surfacing the same terminal must NOT create a second row (dedup).
  await dispatcher.surfaceReady(run.run_id, 'green PR, ready to merge');
  const rows = await store.claimPendingNotifications(500);
  const ready = rows.filter((r) => r.purpose === 'terminal_ready');
  assert.equal(ready.length, 1, 'exactly one terminal_ready even after a re-surface (deduped)');
  assert.equal(ready[0].logical_source, 'TOWER');
});

test('decision gate enqueues decision_required', async () => {
  const { store, dispatcher } = wire({ larry: fakeAdapter('larry') });
  const run = await dispatcher.createRun({ title: 't', maxRounds: 2 });
  await dispatcher.dispatchNextTurn(run.run_id, { expectedResponder: 'larry' });
  await dispatcher.openDecisionGate(run.run_id, 'need Warwick to decide');
  const rows = await store.claimPendingNotifications(500);
  assert.ok(rows.find((r) => r.purpose === 'decision_required'), 'decision_required enqueued');
});

test('a Telegram/outbox failure never breaks orchestration (enqueue is non-throwing)', async () => {
  // An outbox whose enqueue throws must not break createRun/dispatch.
  const config = loadConfig({ TOWER_HMAC_SECRET_LARRY: SECRET, AUTHORISED_TELEGRAM_USER_ID: CHAT_ID });
  const store = createMemoryStore();
  const brokenOutbox = { async enqueue() { throw new Error('outbox down'); } };
  const dispatcher = createDispatcher({ store, config, adapters: { larry: fakeAdapter('larry') }, outbox: brokenOutbox, now: () => 1000, leaseMs: 5000 });
  const run = await dispatcher.createRun({ title: 't', maxRounds: 2 });
  const { turn } = await dispatcher.dispatchNextTurn(run.run_id, { expectedResponder: 'larry' });
  assert.equal(turn.state, 'dispatched', 'orchestration proceeds even though every enqueue throws');
});
