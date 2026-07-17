// Fusion Tower — loop driver unit tests (BUILD-010 WP1 CAPSTONE).
//
// No DB: every test runs against the in-memory store (the same OperationalStore
// surface the postgres store satisfies) with FAKE adapters/collectors/clickup/outbox.
// Proves each loop stage, the maxRounds/terminal logic, the human-gate halt (Larry is
// never dispatched before a durable Proceed), the Hold/Stop halt paths, and stale-head
// rejection. The DB-gated E2E (incl. mid-run restart recovery) lives in
// loopDriver.integration.test.js.

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { loadConfig } from '../src/config.js';
import { createMemoryStore } from '../src/store/memoryStore.js';
import { createDispatcher } from '../src/dispatcher.js';
import { createTelegramNotifier } from '../src/adapters/telegramNotifier.js';
import { createClickupReviewPoster } from '../src/adapters/clickupPoster.js';
import {
  createLoopDriver, startGovernanceRun, assembleRunPacket, createStubCollectors, LOOP_OUTCOME,
} from '../src/loopDriver.js';
import { decisionCallbackData } from '../src/core/decisionGate.js';
import { makeSignedResult, buildEnvelope } from '../src/core/envelope.js';
import { GATE_STATUS, DECISION } from '../src/core/states.js';

// ── synthetic environment (proof-only secrets; never real, never committed) ────
const AUTH_ID = '4242';
const ENV = {
  AUTHORISED_TELEGRAM_USER_ID: AUTH_ID,
  TELEGRAM_BOT_TOKEN: '1234567890:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
  TOWER_HMAC_SECRET_LARRY: 'unit-secret-larry-' + 'x'.repeat(24),
  TOWER_HMAC_SECRET_GPT_CODEX: 'unit-secret-codex-' + 'y'.repeat(24),
  TOWER_HMAC_SECRET_TOWER: 'unit-secret-tower-' + 'z'.repeat(24),
};
const CONTROL_TASK = '869e5zu97';

// A fake Codex adapter: returns a scripted signed verdict per call (round 1, 2, …).
function fakeCodexAdapter({ config, verdicts }) {
  let i = 0;
  const secret = config.signingSecret('gpt_codex');
  return {
    principal: 'gpt_codex',
    async runTurn({ run, turn }) {
      const spec = verdicts[Math.min(i, verdicts.length - 1)];
      i += 1;
      if (spec.blocked) {
        const payload = { status: 'blocked', kind: 'no_credential', blocker: spec.blocker ?? 'blocked', proposed_action: { type: 'noop' } };
        const { envelope, signature } = makeSignedResult({ principal: 'gpt_codex', provider: 'openai-codex', runId: run.run_id, ordinal: turn.ordinal, headSha: run.evidence_commit_sha, payload }, secret);
        return { ok: false, blocked: true, signerPrincipal: 'gpt_codex', structuredResult: payload, envelope, signature, error: spec.blocker };
      }
      const payload = {
        status: 'ok', verdict: spec.verdict, summary: spec.summary ?? `review ${spec.verdict}`,
        claims_verified: [], findings: spec.findings ?? [], proposed_action: { type: 'post_review', target: CONTROL_TASK },
      };
      const { envelope, signature } = makeSignedResult({ principal: 'gpt_codex', provider: 'openai-codex', runId: run.run_id, ordinal: turn.ordinal, headSha: run.evidence_commit_sha, payload }, secret);
      return { ok: true, blocked: false, signerPrincipal: 'gpt_codex', structuredResult: payload, envelope, signature, tokensUsed: 10 };
    },
  };
}

// A fake Larry adapter: returns a signed OK result (a checkpoint push in real life).
function fakeLarryAdapter({ config }) {
  const secret = config.signingSecret('larry');
  return {
    principal: 'larry',
    async runTurn({ run, turn }) {
      const payload = { status: 'ok', summary: 'applied corrections', proposed_action: { type: 'post_comment', target: CONTROL_TASK }, confidence: 0.9 };
      const { envelope, signature } = makeSignedResult({ principal: 'larry', provider: 'anthropic-claude-code', runId: run.run_id, ordinal: turn.ordinal, headSha: run.evidence_commit_sha, payload }, secret);
      return { ok: true, blocked: false, signerPrincipal: 'larry', structuredResult: payload, envelope, signature, tokensUsed: 20 };
    },
  };
}

// A stateful GitHub collector whose head advances after each Larry correction.
function fakeGithubCollector(heads) {
  let i = 0;
  return {
    async headSha() { return heads[Math.min(i, heads.length - 1)]; },
    async checkEvidenceRef({ headSha }) { return headSha ? `ci:${headSha.slice(0, 6)}` : null; },
    advance() { i += 1; },
  };
}

// A fake ClickUp write client (captures the intended comment; never live).
function fakeClickupClient() {
  const posts = [];
  return {
    posts,
    async createTaskComment(taskId, body) { const id = `comment-${posts.length + 1}`; posts.push({ taskId, body, id }); return { id }; },
  };
}

// A fake Telegram client capturing outbound sends (drainOnce delivery).
function fakeTelegramClient() {
  const sends = [];
  return { sends, get ready() { return true; }, async sendMessage(recipient, text) { const id = `msg-${sends.length + 1}`; sends.push({ recipient, text, id }); return { ok: true, message_id: id, chatId: recipient }; } };
}

function buildRig({ verdicts, heads }) {
  const config = loadConfig({ ...process.env, ...ENV });
  const store = createMemoryStore();
  const gpt_codex = fakeCodexAdapter({ config, verdicts });
  const larry = fakeLarryAdapter({ config });
  const outbox = createTelegramNotifier({ config, telegramClient: fakeTelegramClient() });
  const dispatcher = createDispatcher({ store, config, adapters: { larry, gpt_codex }, outbox });
  const github = fakeGithubCollector(heads);
  const collectors = { github, clickup: createStubCollectors({ controlTaskRef: CONTROL_TASK }).clickup };
  const clickupClient = fakeClickupClient();
  const clickupPoster = createClickupReviewPoster({ client: clickupClient, store });
  const driver = createLoopDriver({ store, dispatcher, config, outbox, collectors, clickupPoster, controlTaskId: CONTROL_TASK });
  return { config, store, dispatcher, outbox, github, collectors, clickupClient, driver };
}

// Build a durable Proceed/Hold/Stop decision event for a gate token.
function decisionEvent({ gateToken, decision, runId, headSha, sender = AUTH_ID, updateId = 'u1' }) {
  return {
    sourceEventId: `tg-${updateId}`,
    runId,
    payload: { callback_data: decisionCallbackData(gateToken, decision), sender_id: sender, run_id: runId, head_sha: headSha },
  };
}

// ── startGovernanceRun ─────────────────────────────────────────────────────────

test('startGovernanceRun creates an active run with scope-lock + round budget and emits run_created', async () => {
  const config = loadConfig({ ...process.env, ...ENV });
  const store = createMemoryStore();
  const outbox = createTelegramNotifier({ config, telegramClient: fakeTelegramClient() });
  const run = await startGovernanceRun(store, {
    title: 'BUILD-010 WP1 loop', repo: 'Fusion247/Fusion247PKA', branch: 'build-010/wp1',
    headSha: 'head1aaaa', controlTaskRef: CONTROL_TASK, maxRounds: 2, budget: { tokens: 100000 },
  }, { now: () => 1000, outbox });

  assert.equal(run.status, 'active');
  assert.equal(run.max_rounds, 2);
  assert.deepEqual(run.scope_lock.repos, ['Fusion247/Fusion247PKA']);
  assert.equal(run.scope_lock.branch, 'build-010/wp1');
  assert.equal(run.evidence_commit_sha, 'head1aaaa');
  assert.equal(run.token_budget, 100000);
  // The run_created milestone is durably enqueued.
  const notif = await store.claimPendingNotifications(10);
  assert.ok(notif.some((n) => n.purpose.startsWith('run_created')), 'run_created enqueued');
});

test('startGovernanceRun requires a repo (scope-lock needs one)', async () => {
  const store = createMemoryStore();
  await assert.rejects(() => startGovernanceRun(store, { title: 'x' }, {}), /repo is required/);
});

// ── evidence stage ─────────────────────────────────────────────────────────────

test('assembleRunPacket binds pointers to the exact head SHA (collector head wins)', async () => {
  const config = loadConfig({ ...process.env, ...ENV });
  const store = createMemoryStore();
  const run = await startGovernanceRun(store, { title: 't', repo: 'o/r', branch: 'b', headSha: 'oldsha', controlTaskRef: CONTROL_TASK }, { now: () => 1 });
  const collectors = { github: fakeGithubCollector(['livesha1']), clickup: createStubCollectors({ controlTaskRef: CONTROL_TASK }).clickup };
  const packet = await assembleRunPacket({ run, collectors, checkpointRef: 'chk-1' }, { now: () => 2 });
  assert.equal(packet.head_sha, 'livesha1', 'the live branch head is bound (a new head invalidates a prior review)');
  assert.equal(packet.control_task_ref, CONTROL_TASK);
  assert.equal(packet.checkpoint_ref, 'chk-1');
  assert.ok(packet.ci_evidence_ref);
});

// ── the happy path: request_changes → gate → Proceed → correction → approve → READY ──

test('full loop: request_changes → HUMAN GATE → Proceed → Larry correction → re-review approve → READY_TO_MERGE', async () => {
  const rig = buildRig({
    verdicts: [
      { verdict: 'request_changes', summary: 'fix the migration', findings: [{ id: 'F1', severity: 'high', evidence: 'x:1', rationale: 'r', required_correction: 'do y' }] },
      { verdict: 'approve', summary: 'looks good now' },
    ],
    heads: ['head1', 'head2'],
  });
  const { driver, store, dispatcher } = rig;

  const run = await driver.startRun({ title: 'loop', repo: 'o/r', branch: 'b', headSha: 'head1', controlTaskRef: CONTROL_TASK, maxRounds: 2 });

  // Round 1 review → HALT at the gate.
  const r1 = await driver.driveToGate(run.run_id);
  assert.equal(r1.review.verdict, 'request_changes');
  assert.equal(r1.review.halted, true);
  assert.equal(r1.review.terminal, LOOP_OUTCOME.DECISION_REQUIRED);
  assert.ok(r1.review.gateToken, 'a gate token was issued');
  // The detailed review was posted to ClickUp via the durable outbox.
  assert.equal(rig.clickupClient.posts.length, 1);
  // The run is parked awaiting_decision.
  assert.equal((await store.getRun(run.run_id)).status, 'awaiting_decision');

  // HUMAN GATE: Larry must NOT be dispatchable while pending (structural).
  await assert.rejects(
    () => dispatcher.dispatchNextTurn(run.run_id, { expectedResponder: 'larry', boundedContext: {} }),
    /decision gate OPEN/,
    'Larry cannot be dispatched before a Proceed',
  );

  // Warwick taps Proceed (durable command:decision event).
  rig.github.advance(); // Larry's correction will push head2
  const dec = await driver.applyDecisionEvent(decisionEvent({ gateToken: r1.review.gateToken, decision: 'proceed', runId: run.run_id, headSha: 'head1' }));
  assert.equal(dec.decision.recorded, true);
  assert.equal(dec.decision.dispatchLarry, true);
  assert.equal((await driver.latestGate(run.run_id)).status, GATE_STATUS.DECIDED);
  assert.equal((await driver.latestGate(run.run_id)).decision, DECISION.PROCEED);

  // Resume: Larry correction (new head) → re-review approve → READY_TO_MERGE.
  const resume = await driver.resumeAfterProceed(run.run_id, r1.review.review, r1.packet);
  assert.equal(resume.correction.progressed, true);
  assert.equal(resume.correction.newHead, 'head2');
  assert.equal(resume.nextReview.verdict, 'approve');
  assert.equal(resume.nextReview.terminal, LOOP_OUTCOME.READY_TO_MERGE);

  // Round budget consumed exactly once (one correction).
  assert.equal((await store.getRun(run.run_id)).round_count, 1);

  // Exactly ONE terminal notice, and it is READY (never a merge).
  const terminal = dispatcher.notices.filter((n) => ['READY', 'BLOCKED', 'TIMED_OUT', 'DECISION_REQUIRED', 'CLOSED'].includes(n.kind));
  assert.equal(terminal.length, 1);
  assert.equal(terminal[0].kind, 'READY');
});

// ── approve on the first review → READY_TO_MERGE, no gate, no Larry ──────────────

test('first-review approve resolves READY_TO_MERGE with no gate and no Larry dispatch', async () => {
  const rig = buildRig({ verdicts: [{ verdict: 'approve', summary: 'clean' }], heads: ['head1'] });
  const { driver, store, dispatcher } = rig;
  const run = await driver.startRun({ title: 'a', repo: 'o/r', branch: 'b', headSha: 'head1', controlTaskRef: CONTROL_TASK, maxRounds: 2 });
  const r = await driver.driveToGate(run.run_id);
  assert.equal(r.review.verdict, 'approve');
  assert.equal(r.review.terminal, LOOP_OUTCOME.READY_TO_MERGE);
  assert.equal(r.review.halted, false);
  // No decision gate was opened.
  assert.equal(await driver.latestGate(run.run_id), null);
  assert.equal((await store.getRun(run.run_id)).round_count, 0);
  const terminal = dispatcher.notices.filter((n) => n.kind === 'READY');
  assert.equal(terminal.length, 1);
});

// ── Hold and Stop halt paths ─────────────────────────────────────────────────────

test('Hold decision pauses the run and Larry stays blocked (no dispatch)', async () => {
  const rig = buildRig({ verdicts: [{ verdict: 'request_changes', findings: [{ id: 'F1', severity: 'low', evidence: 'e', rationale: 'r', required_correction: 'c' }] }], heads: ['head1'] });
  const { driver, store, dispatcher } = rig;
  const run = await driver.startRun({ title: 'h', repo: 'o/r', branch: 'b', headSha: 'head1', controlTaskRef: CONTROL_TASK });
  const r1 = await driver.driveToGate(run.run_id);
  const dec = await driver.applyDecisionEvent(decisionEvent({ gateToken: r1.review.gateToken, decision: 'hold', runId: run.run_id, headSha: 'head1' }));
  assert.equal(dec.decision.recorded, true);
  assert.equal(dec.decision.dispatchLarry, false);
  assert.equal(dec.decision.effect, 'hold:setRunPaused(true)');
  assert.equal((await store.getRun(run.run_id)).paused, true);
  // Larry is still blocked (gate decided hold, not proceed).
  await assert.rejects(
    () => dispatcher.dispatchNextTurn(run.run_id, { expectedResponder: 'larry', boundedContext: {} }),
    /was decided 'hold'/,
  );
});

test('Stop decision requests a safe stop and Larry stays blocked', async () => {
  const rig = buildRig({ verdicts: [{ verdict: 'request_changes', findings: [{ id: 'F1', severity: 'medium', evidence: 'e', rationale: 'r', required_correction: 'c' }] }], heads: ['head1'] });
  const { driver, store, dispatcher } = rig;
  const run = await driver.startRun({ title: 's', repo: 'o/r', branch: 'b', headSha: 'head1', controlTaskRef: CONTROL_TASK });
  const r1 = await driver.driveToGate(run.run_id);
  const dec = await driver.applyDecisionEvent(decisionEvent({ gateToken: r1.review.gateToken, decision: 'stop', runId: run.run_id, headSha: 'head1' }));
  assert.equal(dec.decision.effect, 'stop:requestRunStop');
  assert.equal((await store.getRun(run.run_id)).stop_requested, true);
  await assert.rejects(
    () => dispatcher.dispatchNextTurn(run.run_id, { expectedResponder: 'larry', boundedContext: {} }),
    /was decided 'stop'/,
  );
  // The driver resolves STOPPED as a terminal (safe cancel; never a merge).
  const terminal = await driver.resolveTerminal(run.run_id, LOOP_OUTCOME.STOPPED, 'stopped');
  assert.equal((await store.getRun(run.run_id)).status, 'cancelled');
});

// ── stale-head rejection ─────────────────────────────────────────────────────────

test('a decision tap on a STALE head is rejected (no effect, Larry stays blocked)', async () => {
  const rig = buildRig({ verdicts: [{ verdict: 'request_changes', findings: [{ id: 'F1', severity: 'high', evidence: 'e', rationale: 'r', required_correction: 'c' }] }], heads: ['head1'] });
  const { driver, store, dispatcher } = rig;
  const run = await driver.startRun({ title: 'stale', repo: 'o/r', branch: 'b', headSha: 'head1', controlTaskRef: CONTROL_TASK });
  const r1 = await driver.driveToGate(run.run_id);
  // The tap claims a DIFFERENT head than the gate's review head → rejected.
  const dec = await driver.applyDecisionEvent(decisionEvent({ gateToken: r1.review.gateToken, decision: 'proceed', runId: run.run_id, headSha: 'WRONGHEAD' }));
  assert.equal(dec.decision.recorded, false);
  assert.equal(dec.decision.reason, 'stale-head');
  // Gate is still pending; Larry still blocked.
  assert.equal((await driver.latestGate(run.run_id)).status, GATE_STATUS.PENDING);
  await assert.rejects(() => dispatcher.dispatchNextTurn(run.run_id, { expectedResponder: 'larry', boundedContext: {} }), /decision gate OPEN/);
});

// ── maxRounds terminal ───────────────────────────────────────────────────────────

test('maxRounds=1: a second correction round is refused → BLOCKED terminal (no doom-loop)', async () => {
  // Both reviews request changes; with maxRounds=1 the loop may correct once, then the
  // next review dispatch trips the round gate and terminalises BLOCKED.
  const rig = buildRig({
    verdicts: [
      { verdict: 'request_changes', findings: [{ id: 'F1', severity: 'high', evidence: 'e', rationale: 'r', required_correction: 'c' }] },
      { verdict: 'request_changes', findings: [{ id: 'F2', severity: 'high', evidence: 'e', rationale: 'r', required_correction: 'c' }] },
    ],
    heads: ['head1', 'head2'],
  });
  const { driver, store, dispatcher } = rig;
  const run = await driver.startRun({ title: 'mr', repo: 'o/r', branch: 'b', headSha: 'head1', controlTaskRef: CONTROL_TASK, maxRounds: 1 });
  const r1 = await driver.driveToGate(run.run_id);
  rig.github.advance();
  await driver.applyDecisionEvent(decisionEvent({ gateToken: r1.review.gateToken, decision: 'proceed', runId: run.run_id, headSha: 'head1' }));
  const resume = await driver.resumeAfterProceed(run.run_id, r1.review.review, r1.packet);
  // The correction pushed head2 and consumed the single round; the re-review dispatch
  // trips roundBudgetOk (1/1) and terminalises BLOCKED — not another gate.
  assert.equal(resume.correction.progressed, true);
  assert.equal(resume.nextReview.terminal, LOOP_OUTCOME.BLOCKED);
  assert.equal((await store.getRun(run.run_id)).status, 'blocked');
  const terminal = dispatcher.notices.filter((n) => ['READY', 'BLOCKED', 'TIMED_OUT', 'DECISION_REQUIRED', 'CLOSED'].includes(n.kind));
  assert.equal(terminal.length, 1);
  assert.equal(terminal[0].kind, 'BLOCKED');
});

// ── fail-closed review turn → BLOCKED ────────────────────────────────────────────

test('a fail-closed (blocked) Codex turn resolves BLOCKED deterministically', async () => {
  const rig = buildRig({ verdicts: [{ blocked: true, blocker: 'no codex credential' }], heads: ['head1'] });
  const { driver, store } = rig;
  const run = await driver.startRun({ title: 'fc', repo: 'o/r', branch: 'b', headSha: 'head1', controlTaskRef: CONTROL_TASK });
  const r = await driver.driveToGate(run.run_id);
  assert.equal(r.review.blocked, true);
  assert.equal(r.review.terminal, LOOP_OUTCOME.BLOCKED);
  assert.equal((await store.getRun(run.run_id)).status, 'blocked');
});

// ── no autonomous merge: the guardrail set never contains merge ──────────────────

test('no-autonomous-merge: a review proposing merge is rejected before recording', async () => {
  const config = loadConfig({ ...process.env, ...ENV });
  const store = createMemoryStore();
  const secret = config.signingSecret('gpt_codex');
  const gpt_codex = {
    principal: 'gpt_codex',
    async runTurn({ run, turn }) {
      const payload = { status: 'ok', verdict: 'approve', summary: 's', claims_verified: [], findings: [], proposed_action: { type: 'merge', target: 'o/r' } };
      const { envelope, signature } = makeSignedResult({ principal: 'gpt_codex', provider: 'openai-codex', runId: run.run_id, ordinal: turn.ordinal, payload }, secret);
      return { ok: true, blocked: false, signerPrincipal: 'gpt_codex', structuredResult: payload, envelope, signature };
    },
  };
  const larry = fakeLarryAdapter({ config });
  const outbox = createTelegramNotifier({ config, telegramClient: fakeTelegramClient() });
  const dispatcher = createDispatcher({ store, config, adapters: { larry, gpt_codex }, outbox });
  const driver = createLoopDriver({ store, dispatcher, config, outbox, collectors: { github: fakeGithubCollector(['head1']), clickup: createStubCollectors({ controlTaskRef: CONTROL_TASK }).clickup }, controlTaskId: CONTROL_TASK });
  const run = await driver.startRun({ title: 'm', repo: 'o/r', branch: 'b', headSha: 'head1', controlTaskRef: CONTROL_TASK });
  // runTurn asserts no-autonomous-merge BEFORE recording → the review throws inside
  // runCodexReview's dispatch; the loop surfaces it rather than acting on a merge.
  await assert.rejects(() => driver.driveToGate(run.run_id), /NO-AUTONOMOUS-MERGE/);
});

// ── unsigned/honest fixture path: startGovernanceRun works without an outbox ──────

test('startGovernanceRun tolerates a missing outbox (creates the run, skips the notice)', async () => {
  const store = createMemoryStore();
  const run = await startGovernanceRun(store, { title: 'no-outbox', repo: 'o/r', headSha: 'h1' }, { now: () => 1 });
  assert.equal(run.status, 'active');
  assert.equal((await store.claimPendingNotifications(10)).length, 0);
  // buildEnvelope import is exercised elsewhere; keep the honest-label path referenced.
  assert.ok(buildEnvelope);
});
