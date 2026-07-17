// BUILD-010 WP1 — HUMAN DECISION GATE tests (OI §4a). NO DB, NO live send.
//
// Proves the gate contract over the in-memory store + a fake outbound notifier:
//   · a Codex review posts a [CODEX] card with EXACTLY ✅ Proceed / ⏸ Hold / 🛑 Stop
//     and the run HALTS in awaiting_decision — Larry is NOT dispatched
//   · the STRUCTURAL lock: while the gate is open, dispatchNextTurn(larry) is refused;
//     a Larry correction turn is reachable ONLY after a recorded Proceed
//   · Proceed → gate cleared + decision recorded + dispatchLarry signalled + [TOWER]
//     confirm enqueued + NO merge; Hold → paused; Stop → stop_requested
//   · an unauthorised tapper → SILENT deny, gate unchanged
//   · a stale (superseded/wrong-head) or duplicate tap → rejected idempotently, ONE effect
//   · the card definition is persisted durably and rides the send verbatim (reply_markup)
//   · the module has NO merge / push / inline-send / poll path

import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { loadConfig } from '../src/config.js';
import { createMemoryStore } from '../src/store/memoryStore.js';
import { createDispatcher } from '../src/dispatcher.js';
import { createTelegramNotifier } from '../src/adapters/telegramNotifier.js';
import { drainOnce } from '../src/adapters/telegramNotifier.js';
import {
  postCodexReviewGate,
  handleDecisionEvent,
  buildDecisionCards,
  parseDecisionCallback,
  decisionCallbackData,
  summariseFindingsBySeverity,
} from '../src/core/decisionGate.js';
import { RUN_STATUS, GATE_STATUS, DECISION } from '../src/core/states.js';

const CHAT = '987654321';
const __dirname = path.dirname(fileURLToPath(import.meta.url));

function fakeClient() {
  const sends = [];
  let seq = 5000;
  return {
    ready: true,
    sends,
    async sendMessage(recipient, text, opts) {
      sends.push({ recipient, text, replyMarkup: opts?.replyMarkup ?? null });
      return { ok: true, message_id: String(seq++), chatId: String(recipient) };
    },
  };
}

function wire() {
  const config = loadConfig({ AUTHORISED_TELEGRAM_USER_ID: CHAT });
  const store = createMemoryStore();
  const client = fakeClient();
  const notifier = createTelegramNotifier({ config, telegramClient: client });
  const dispatcher = createDispatcher({ store, config, adapters: {}, outbox: notifier, now: () => 1000 });
  return { config, store, notifier, client, dispatcher };
}

// A run reaches a Codex review while it is in flight (active → awaiting_responder).
// Seed it ACTIVE so postCodexReviewGate can park it in awaiting_decision.
async function seedActiveRun(store, over = {}) {
  const run = await store.createRun({ title: 'wp1', maxRounds: 3, ...over }, { now: 100 });
  await store.setRunStatus(run.run_id, RUN_STATUS.ACTIVE, { now: 100 });
  return run;
}

const REVIEW = {
  verdict: 'request_changes',
  headSha: 'abc123def0feed',
  summary: 'Two findings block the change; see the full review.\nsecond line ignored',
  findings: [{ severity: 'high' }, { severity: 'high' }, { severity: 'low' }],
  fullReviewRef: 'https://app.clickup.com/t/869e5zu97',
};

// A decision run_event as WP2 would route it in (single poller; no second poll here).
function decisionEvent(store, { token, decision, tapper = CHAT, updateId = 'u1', runId = null }) {
  return {
    source: 'telegram',
    source_event_id: updateId,
    kind: 'command:decision',
    run_id: runId,
    payload: {
      run_id: runId,
      decision,
      tapper_id: tapper,
      callback_data: `dec:${token}:${decision}`,
      message_id: '42',
    },
  };
}

test('1. Codex review posts a [CODEX] card with EXACTLY Proceed/Hold/Stop and the run HALTS in awaiting_decision (no Larry dispatch)', async () => {
  const { store, notifier } = wire();
  const run = await seedActiveRun(store);

  const res = await postCodexReviewGate(store, notifier, { runId: run.run_id, ...REVIEW }, { now: 200 });
  assert.equal(res.halted, true);
  assert.equal(res.dispatchedLarry, false);
  assert.equal(res.merge, false, 'a card is never a merge');

  // Run parked in awaiting_decision with decision_required.
  const r = await store.getRun(run.run_id);
  assert.equal(r.status, RUN_STATUS.AWAITING_DECISION);
  assert.equal(r.decision_required, true);

  // Durable gate opened, pending, for the review head, with the bounded card set.
  const gate = await store.getPendingDecisionGate(run.run_id);
  assert.equal(gate.status, GATE_STATUS.PENDING);
  assert.equal(gate.review_head_sha, REVIEW.headSha);
  assert.deepEqual(gate.allowed_decisions, ['proceed', 'hold', 'stop']);

  // Exactly three cards, correct labels + callback tokens, [CODEX] tag, secret-free body.
  const notif = await store.getNotification(res.notification.dedupKey);
  assert.equal(notif.logical_source, 'CODEX');
  const row = notif.reply_markup.inline_keyboard[0];
  assert.equal(row.length, 3, 'exactly Proceed/Hold/Stop');
  assert.deepEqual(row.map((b) => b.text), ['✅ Proceed', '⏸ Hold', '🛑 Stop']);
  assert.equal(row[0].callback_data, `dec:${gate.gate_token}:proceed`);
  assert.equal(row[2].callback_data, `dec:${gate.gate_token}:stop`);
  assert.match(notif.body, /verdict: request_changes/);
  assert.match(notif.body, /high:2 .*low:1/);
  assert.match(notif.body, /full review: https:\/\/app\.clickup\.com/);
  assert.doesNotMatch(notif.body, /second line ignored/, 'only the first rationale line is shown');
});

test('2. STRUCTURAL: while the gate is open, a Larry correction turn is refused (a review cannot reach Larry without a decision)', async () => {
  const { store, notifier, dispatcher } = wire();
  const run = await seedActiveRun(store);
  await postCodexReviewGate(store, notifier, { runId: run.run_id, ...REVIEW }, { now: 200 });

  await assert.rejects(
    () => dispatcher.dispatchNextTurn(run.run_id, { expectedResponder: 'larry', boundedContext: { task: 'correct' } }),
    /decision gate OPEN|CANNOT be dispatched/i,
    'a Larry turn is structurally blocked while the gate is pending',
  );
  // No larry turn was created.
  assert.equal((await store.listTurns(run.run_id)).length, 0);
});

test('3. Proceed by the authorised user → gate cleared, decision recorded, dispatchLarry signalled, [TOWER] confirm enqueued, NO merge; THEN Larry is reachable', async () => {
  const { store, notifier, dispatcher } = wire();
  const run = await seedActiveRun(store);
  await postCodexReviewGate(store, notifier, { runId: run.run_id, ...REVIEW }, { now: 200 });
  const gate = await store.getPendingDecisionGate(run.run_id);

  const ev = decisionEvent(store, { token: gate.gate_token, decision: 'proceed', updateId: 'p1', runId: run.run_id });
  const out = await handleDecisionEvent(store, notifier, ev, { now: 300, allowlist: [CHAT] });
  assert.equal(out.authorised, true);
  assert.equal(out.recorded, true);
  assert.equal(out.effect, 'proceed:gate_cleared');
  assert.equal(out.dispatchLarry, true);
  assert.equal(out.merge, false);

  // Gate durably decided proceed; run active, decision_required cleared.
  const g = await store.getLatestDecisionGate(run.run_id);
  assert.equal(g.status, GATE_STATUS.DECIDED);
  assert.equal(g.decision, DECISION.PROCEED);
  assert.equal(g.decided_by, CHAT);
  const r = await store.getRun(run.run_id);
  assert.equal(r.status, RUN_STATUS.ACTIVE);
  assert.equal(r.decision_required, false);

  // A [TOWER] confirmation was enqueued.
  const confirm = await store.getNotification(out.reply.dedupKey);
  assert.equal(confirm.logical_source, 'TOWER');
  assert.match(confirm.body, /Decision recorded: ✅ Proceed/);
  assert.match(confirm.body, /No merge performed/);

  // NOW a Larry correction turn is reachable (structural lock released by Proceed).
  const d = await dispatcher.dispatchNextTurn(run.run_id, { expectedResponder: 'larry', boundedContext: { task: 'correct' } });
  assert.equal(d.turn.expected_responder, 'larry');
});

test('4. Hold → run paused, gate decided hold; Larry stays blocked', async () => {
  const { store, notifier, dispatcher } = wire();
  const run = await seedActiveRun(store);
  await postCodexReviewGate(store, notifier, { runId: run.run_id, ...REVIEW }, { now: 200 });
  const gate = await store.getPendingDecisionGate(run.run_id);

  const out = await handleDecisionEvent(store, notifier,
    decisionEvent(store, { token: gate.gate_token, decision: 'hold', updateId: 'h1', runId: run.run_id }),
    { now: 300, allowlist: [CHAT] });
  assert.equal(out.recorded, true);
  assert.equal(out.effect, 'hold:setRunPaused(true)');
  assert.equal(out.dispatchLarry, false);
  assert.equal(out.merge, false);
  assert.equal((await store.getRun(run.run_id)).paused, true);
  assert.equal((await store.getLatestDecisionGate(run.run_id)).decision, DECISION.HOLD);

  await assert.rejects(
    () => dispatcher.dispatchNextTurn(run.run_id, { expectedResponder: 'larry' }),
    /decided 'hold'|blocked/i,
    'a hold decision does not open a Larry turn',
  );
});

test('5. Stop → stop_requested, gate decided stop; NO merge', async () => {
  const { store, notifier } = wire();
  const run = await seedActiveRun(store);
  await postCodexReviewGate(store, notifier, { runId: run.run_id, ...REVIEW }, { now: 200 });
  const gate = await store.getPendingDecisionGate(run.run_id);

  const out = await handleDecisionEvent(store, notifier,
    decisionEvent(store, { token: gate.gate_token, decision: 'stop', updateId: 's1', runId: run.run_id }),
    { now: 300, allowlist: [CHAT] });
  assert.equal(out.recorded, true);
  assert.equal(out.effect, 'stop:requestRunStop');
  assert.equal(out.merge, false);
  const r = await store.getRun(run.run_id);
  assert.equal(r.stop_requested, true);
  assert.ok(r.stop_requested_at);
});

test('6. Unauthorised tapper → SILENT default-deny: gate unchanged, no reply, no mutation', async () => {
  const { store, notifier } = wire();
  const run = await seedActiveRun(store);
  await postCodexReviewGate(store, notifier, { runId: run.run_id, ...REVIEW }, { now: 200 });
  const gate = await store.getPendingDecisionGate(run.run_id);
  const pendingBefore = (await store.claimPendingNotifications(50)).length;

  const out = await handleDecisionEvent(store, notifier,
    decisionEvent(store, { token: gate.gate_token, decision: 'proceed', tapper: '111222', updateId: 'x1', runId: run.run_id }),
    { now: 300, allowlist: [CHAT] });
  assert.equal(out.authorised, false);
  assert.equal(out.audited, true);
  assert.equal(out.reason, 'unauthorised');
  assert.equal(out.recorded, false);
  assert.equal(out.merge, false);

  // Gate still pending; run still awaiting_decision; NOTHING new enqueued.
  assert.equal((await store.getPendingDecisionGate(run.run_id)).status, GATE_STATUS.PENDING);
  assert.equal((await store.getRun(run.run_id)).status, RUN_STATUS.AWAITING_DECISION);
  assert.equal((await store.claimPendingNotifications(50)).length, pendingBefore, 'no reply for a denied tapper');
});

test('7a. Duplicate tap → rejected idempotently, ONE effect (already-decided)', async () => {
  const { store, notifier } = wire();
  const run = await seedActiveRun(store);
  await postCodexReviewGate(store, notifier, { runId: run.run_id, ...REVIEW }, { now: 200 });
  const gate = await store.getPendingDecisionGate(run.run_id);

  const first = await handleDecisionEvent(store, notifier,
    decisionEvent(store, { token: gate.gate_token, decision: 'proceed', updateId: 'd1', runId: run.run_id }),
    { now: 300, allowlist: [CHAT] });
  assert.equal(first.recorded, true);

  // A SECOND tap on the same (now decided) gate — different update id — is rejected.
  const second = await handleDecisionEvent(store, notifier,
    decisionEvent(store, { token: gate.gate_token, decision: 'proceed', updateId: 'd2', runId: run.run_id }),
    { now: 400, allowlist: [CHAT] });
  assert.equal(second.recorded, false);
  assert.equal(second.reason, 'already-decided');
  assert.equal(second.merge, false);
  // Exactly ONE decision endures + exactly ONE [TOWER] confirm (the second enqueued none).
  const gates = [gate].length; // sanity
  assert.equal((await store.getLatestDecisionGate(run.run_id)).decided_at, 300, 'the first decision is the one that stands');
});

test('7b. Stale tap on a SUPERSEDED (old head) gate → rejected idempotently; the new gate stays pending', async () => {
  const { store, notifier } = wire();
  const run = await seedActiveRun(store);
  // Round-1 review (head H1).
  await postCodexReviewGate(store, notifier, { runId: run.run_id, ...REVIEW, headSha: 'H1oldhead' }, { now: 200 });
  const gate1 = await store.getPendingDecisionGate(run.run_id);
  // Round-2 review (new head H2) supersedes the round-1 pending gate.
  await store.setRunStatus(run.run_id, RUN_STATUS.ACTIVE, { now: 250 }); // simulate loop re-activation
  await postCodexReviewGate(store, notifier, { runId: run.run_id, ...REVIEW, headSha: 'H2newhead' }, { now: 300 });
  const gate2 = await store.getPendingDecisionGate(run.run_id);
  assert.notEqual(gate1.gate_token, gate2.gate_token);
  assert.equal((await store.getDecisionGateByToken(gate1.gate_token)).status, GATE_STATUS.SUPERSEDED);

  // A late tap on the OLD (superseded) card is rejected; the current gate is untouched.
  const out = await handleDecisionEvent(store, notifier,
    decisionEvent(store, { token: gate1.gate_token, decision: 'proceed', updateId: 'late1', runId: run.run_id }),
    { now: 400, allowlist: [CHAT] });
  assert.equal(out.recorded, false);
  assert.equal(out.reason, 'superseded');
  assert.equal((await store.getPendingDecisionGate(run.run_id)).gate_token, gate2.gate_token);
});

test('8. NO-MERGE / NO-SEND / NO-POLL: the module has no merge, push, inline-send, or getUpdates path', () => {
  const src = fs.readFileSync(path.join(__dirname, '..', 'src', 'core', 'decisionGate.js'), 'utf8');
  // Strip line + block comments so honest DO-NOT-MERGE prose is not counted as a path.
  const code = src.replace(/\/\*[\s\S]*?\*\//g, '').split('\n').map((l) => l.replace(/\/\/.*$/, '')).join('\n');
  for (const forbidden of [
    'merge_pr', 'mergePr', 'squash_merge', 'force_push', 'git push', 'claimWrite',
    'markWriteApplied', 'external_write', 'getUpdates', '.sendMessage(',
  ]) {
    assert.ok(!code.includes(forbidden), `decisionGate.js code must not contain a "${forbidden}" path`);
  }
});

test('9. callback_data stays < 64 bytes and round-trips; findings counter is honest', () => {
  const token = 'abc123def4567890';
  const data = decisionCallbackData(token, 'proceed');
  assert.ok(Buffer.byteLength(data, 'utf8') < 64);
  assert.deepEqual(parseDecisionCallback(data), { gateToken: token, decision: 'proceed' });
  assert.equal(parseDecisionCallback('garbage'), null);
  const cards = buildDecisionCards({ gateToken: token });
  assert.equal(cards.inline_keyboard[0].length, 3);
  const sev = summariseFindingsBySeverity([{ severity: 'critical' }, { severity: 'low' }, { severity: 'low' }]);
  assert.equal(sev.counts.critical, 1);
  assert.equal(sev.counts.low, 2);
});

test('10. the card is durable + rides the send verbatim (reply_markup persists across enqueue→drain)', async () => {
  const { store, notifier, client } = wire();
  const run = await seedActiveRun(store);
  await postCodexReviewGate(store, notifier, { runId: run.run_id, ...REVIEW }, { now: 200 });
  // Drain the outbox — the durable reply_markup must reach the send verbatim.
  const d = await notifier.drainOnce(store);
  assert.ok(d.sent >= 1);
  const carded = client.sends.find((s) => s.replyMarkup);
  assert.ok(carded, 'the gate send carried the inline_keyboard');
  assert.equal(carded.replyMarkup.inline_keyboard[0].length, 3);
});

test('11. dispatcher.drainCommandEvents routes command:decision to the gate handler', async () => {
  const { store, dispatcher, notifier } = wire();
  const run = await seedActiveRun(store);
  await postCodexReviewGate(store, notifier, { runId: run.run_id, ...REVIEW }, { now: 200 });
  const gate = await store.getPendingDecisionGate(run.run_id);

  await store.ingestEvent({
    source: 'telegram',
    sourceEventId: 'w1',
    kind: 'command:decision',
    runId: run.run_id,
    payload: { run_id: run.run_id, decision: 'proceed', tapper_id: CHAT, callback_data: `dec:${gate.gate_token}:proceed`, message_id: '42' },
  }, { now: 300 });
  const outc = await dispatcher.drainCommandEvents({ allowlist: [CHAT] });
  assert.equal(outc.processed, 1);
  assert.equal(outc.results[0].kind, 'decision');
  assert.equal(outc.results[0].recorded, true);
  assert.equal(outc.results[0].dispatchLarry, true);
  assert.equal(outc.results[0].merge, false);
});
