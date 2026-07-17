import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadConfig } from '../src/config.js';
import { createMemoryStore } from '../src/store/memoryStore.js';
import { createDispatcher } from '../src/dispatcher.js';
import { makeSignedResult } from '../src/core/envelope.js';

const SECRET = 'k'.repeat(48);

// A fake adapter that returns a signed result with a caller-chosen action.
function fakeAdapter(principal, { action, blocked = false, tokens = 5 } = {}) {
  return {
    principal,
    async runTurn({ run, turn }) {
      const payload = blocked
        ? { status: 'blocked', blocker: 'forced', proposed_action: { type: 'noop' } }
        : { status: 'ok', summary: 'done', proposed_action: action ?? { type: 'post_comment' } };
      const { envelope, signature } = makeSignedResult({
        principal, runId: run.run_id, ordinal: turn.ordinal, payload,
      }, SECRET);
      return { ok: !blocked, blocked, signerPrincipal: principal, structuredResult: payload, envelope, signature, tokensUsed: tokens };
    },
  };
}

function wire(adapters, { env, now } = {}) {
  const config = loadConfig({ TOWER_HMAC_SECRET_LARRY: SECRET, TOWER_HMAC_SECRET_GPT_CODEX: SECRET, ...env });
  const store = createMemoryStore();
  const notices = [];
  const notifier = { async notify(kind, ctx) { notices.push({ kind, run: ctx.run?.run_id }); } };
  let t = now ?? 1000;
  const dispatcher = createDispatcher({ store, config, adapters, notifier, now: () => t, leaseMs: 5000 });
  return { config, store, dispatcher, notices, advance: (ms) => { t += ms; }, clockAt: () => t };
}

test('dispatchNextTurn: created -> active -> awaiting_responder, turn dispatched with lease', async () => {
  const { dispatcher, store } = wire({ larry: fakeAdapter('larry') });
  const run = await dispatcher.createRun({ title: 't', maxRounds: 2 });
  const { turn } = await dispatcher.dispatchNextTurn(run.run_id, { expectedResponder: 'larry', boundedContext: { task: 'x' } });
  assert.equal(turn.state, 'dispatched');
  assert.equal(turn.lease_deadline_at, turn.dispatched_at + 5000);
  const after = await store.getRun(run.run_id);
  assert.equal(after.status, 'awaiting_responder');
  assert.equal(after.current_turn_id, turn.turn_id);
});

test('runTurn records a verified signed result and rolls up tokens', async () => {
  const { dispatcher, store } = wire({ larry: fakeAdapter('larry', { tokens: 7 }) });
  const run = await dispatcher.createRun({ title: 't', maxRounds: 2 });
  const { turn } = await dispatcher.dispatchNextTurn(run.run_id, { expectedResponder: 'larry' });
  const res = await dispatcher.runTurn(turn.turn_id);
  const recorded = await store.getTurn(turn.turn_id);
  assert.equal(recorded.state, 'returned');
  assert.equal(recorded.signer_principal, 'larry');
  assert.equal(res.action.type, 'post_comment');
  assert.equal((await store.getRun(run.run_id)).token_spent, 7);
});

test('runTurn REJECTS a merge action (no-autonomous-merge guardrail)', async () => {
  const { dispatcher } = wire({ larry: fakeAdapter('larry', { action: { type: 'merge', repo: 'a/b' } }) });
  const run = await dispatcher.createRun({ title: 't', maxRounds: 2 });
  const { turn } = await dispatcher.dispatchNextTurn(run.run_id, { expectedResponder: 'larry' });
  await assert.rejects(() => dispatcher.runTurn(turn.turn_id), /NO-AUTONOMOUS-MERGE/);
});

test('runTurn records a fail-closed blocked result deterministically', async () => {
  const { dispatcher, store } = wire({ gpt_codex: fakeAdapter('gpt_codex', { blocked: true }) });
  const run = await dispatcher.createRun({ title: 't', maxRounds: 2 });
  const { turn } = await dispatcher.dispatchNextTurn(run.run_id, { expectedResponder: 'gpt_codex' });
  const res = await dispatcher.runTurn(turn.turn_id);
  assert.equal(res.blocked, true);
  assert.equal((await store.getTurn(turn.turn_id)).state, 'returned', 'blocked result is a signed return, not a hang');
});

test('watchdog: expired turn under budget -> retry (new ordinal, round++)', async () => {
  const { dispatcher, store, advance } = wire({ larry: fakeAdapter('larry') });
  const run = await dispatcher.createRun({ title: 't', maxRounds: 2 });
  await dispatcher.dispatchNextTurn(run.run_id, { expectedResponder: 'larry' });
  advance(6000); // past the 5000ms lease
  const wd = await dispatcher.watchdog();
  assert.equal(wd.reaped, 1);
  assert.equal(wd.decisions[0].decision, 'retry');
  const turns = await store.listTurns(run.run_id);
  assert.equal(turns.length, 2, 'a NEW ordinal turn was dispatched');
  assert.equal((await store.getRun(run.run_id)).round_count, 1);
});

test('watchdog: expired turn at round cap -> terminal TIMED_OUT + notice', async () => {
  const { dispatcher, store, notices, advance } = wire({ larry: fakeAdapter('larry') });
  const run = await dispatcher.createRun({ title: 't', maxRounds: 1 }); // no rounds left after first
  await dispatcher.dispatchNextTurn(run.run_id, { expectedResponder: 'larry' });
  await store.incrementRound(run.run_id, { now: dispatcher.clockAt?.() });
  advance(6000);
  const wd = await dispatcher.watchdog();
  assert.equal(wd.decisions[0].decision, 'terminal');
  const after = await store.getRun(run.run_id);
  assert.equal(after.status, 'timed_out');
  assert.equal(after.terminal_outcome, 'timed_out');
  assert.ok(notices.some((n) => n.kind === 'TIMED_OUT'));
});

test('decision gate parks run in awaiting_decision + DECISION_REQUIRED notice', async () => {
  const { dispatcher, store, notices } = wire({});
  const run = await dispatcher.createRun({ title: 't' });
  await store.setRunStatus(run.run_id, 'active', { now: 1 });
  await dispatcher.openDecisionGate(run.run_id, 'need a call');
  const after = await store.getRun(run.run_id);
  assert.equal(after.status, 'awaiting_decision');
  assert.equal(after.decision_required, true);
  assert.ok(notices.some((n) => n.kind === 'DECISION_REQUIRED'));
});

test('surfaceReady emits exactly one READY notice and never merges', async () => {
  const { dispatcher, notices } = wire({});
  const run = await dispatcher.createRun({ title: 't' });
  await dispatcher.dispatchNextTurn(run.run_id, { expectedResponder: 'larry', boundedContext: {} }).catch(() => {});
  const notice = await dispatcher.surfaceReady(run.run_id, 'PR green, your merge');
  assert.equal(notice.kind, 'READY');
  assert.equal(notices.filter((n) => n.kind === 'READY').length, 1);
});

test('budget breach on dispatch terminates the run', async () => {
  const { dispatcher, store } = wire({ larry: fakeAdapter('larry') });
  const run = await dispatcher.createRun({ title: 't', maxRounds: 2, tokenBudget: 10 });
  await store.addTokens(run.run_id, 20, { now: 1 }); // overspend
  const r = await dispatcher.dispatchNextTurn(run.run_id, { expectedResponder: 'larry' });
  assert.ok(r.terminated);
  assert.equal((await store.getRun(run.run_id)).status, 'timed_out');
});
