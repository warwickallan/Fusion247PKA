// Fusion Tower — loop driver REAL-Postgres integration + E2E (BUILD-010 WP1 CAPSTONE).
//
// GATED: every test is `{ skip: !DB }` so the default unit run (no DATABASE_URL) skips
// this file cleanly and never loads `pg`. `pg` is imported DYNAMICALLY in the helpers.
//
// RUN (throwaway local cluster):
//   cd services/fusion-tower
//   DATABASE_URL=postgresql://postgres@127.0.0.1:54344/ftw_dev \
//     node --test --test-concurrency=1 test/loopDriver.integration.test.js
//
// Proves, on a real durable store: the full loop (request_changes → gate → Proceed →
// correction → approve → READY_TO_MERGE), a MID-RUN RESTART recovery (close pool,
// recreate store/dispatcher/driver, resume from durable rows), and the human-gate,
// no-merge, single-terminal-notice, dedup invariants.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { loadConfig } from '../src/config.js';
import { createDispatcher } from '../src/dispatcher.js';
import { createTelegramNotifier } from '../src/adapters/telegramNotifier.js';
import { createClickupReviewPoster } from '../src/adapters/clickupPoster.js';
import { createLoopDriver, LOOP_OUTCOME } from '../src/loopDriver.js';
import { decisionCallbackData } from '../src/core/decisionGate.js';
import { makeSignedResult } from '../src/core/envelope.js';

const DB = process.env.DATABASE_URL;
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const MIGRATIONS_DIR = path.join(__dirname, '..', 'migrations');
const MIGRATIONS = [
  '0001_wp0_control_plane.sql', '0002_wp0_identity_provider_binding.sql',
  '0003_wp0_external_write_outbox.sql', '0004_wp1_notification_outbox.sql',
  '0005_wp1_run_control_state.sql', '0006_wp1_notification_cards.sql',
];
const CONTROL_TASK = '869e5zu97';
const AUTH_ID = '4242';
const ENV = {
  AUTHORISED_TELEGRAM_USER_ID: AUTH_ID,
  TELEGRAM_BOT_TOKEN: '1234567890:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
  TOWER_HMAC_SECRET_LARRY: 'itest-secret-larry-' + 'x'.repeat(24),
  TOWER_HMAC_SECRET_GPT_CODEX: 'itest-secret-codex-' + 'y'.repeat(24),
  TOWER_HMAC_SECRET_TOWER: 'itest-secret-tower-' + 'z'.repeat(24),
};

async function resetAndMigrate() {
  const pgModule = await import('pg');
  const { Pool } = pgModule.default ?? pgModule;
  const pool = new Pool({ connectionString: DB });
  try {
    await pool.query('drop schema if exists ftw cascade');
    for (const file of MIGRATIONS) await pool.query(fs.readFileSync(path.join(MIGRATIONS_DIR, file), 'utf8'));
  } finally { await pool.end(); }
}
async function freshStore() {
  await resetAndMigrate();
  const { createPostgresStore } = await import('../src/store/postgresStore.js');
  return createPostgresStore({ connectionString: DB });
}

const gh = {
  head: 'head1',
  async headSha() { return this.head; },
  async checkEvidenceRef({ headSha }) { return headSha ? `ci:${String(headSha).slice(0, 6)}` : null; },
};

function fakeCodex(config, verdicts) {
  let i = 0; const secret = config.signingSecret('gpt_codex');
  return { principal: 'gpt_codex', async runTurn({ run, turn }) {
    const s = verdicts[Math.min(i, verdicts.length - 1)]; i += 1;
    const payload = { status: 'ok', verdict: s.verdict, summary: s.summary ?? s.verdict, claims_verified: [], findings: s.findings ?? [], proposed_action: { type: 'post_review', target: CONTROL_TASK } };
    const signed = makeSignedResult({ principal: 'gpt_codex', provider: 'openai-codex', runId: run.run_id, ordinal: turn.ordinal, headSha: run.evidence_commit_sha, payload }, secret);
    return { ok: true, blocked: false, signerPrincipal: 'gpt_codex', structuredResult: payload, ...signed, tokensUsed: 10 };
  } };
}
function fakeLarry(config) {
  const secret = config.signingSecret('larry');
  return { principal: 'larry', async runTurn({ run, turn }) {
    const payload = { status: 'ok', summary: 'applied corrections', proposed_action: { type: 'post_comment', target: CONTROL_TASK }, confidence: 0.9 };
    const signed = makeSignedResult({ principal: 'larry', provider: 'anthropic-claude-code', runId: run.run_id, ordinal: turn.ordinal, headSha: run.evidence_commit_sha, payload }, secret);
    return { ok: true, blocked: false, signerPrincipal: 'larry', structuredResult: payload, ...signed, tokensUsed: 20 };
  } };
}
function fakeTg(sink) { return { get ready() { return true; }, async sendMessage(r, t) { const id = `m-${sink.length + 1}`; sink.push({ r, t, id }); return { ok: true, message_id: id, chatId: r }; } }; }
function fakeCu(sink) { return { async createTaskComment(taskId, body) { const id = `c-${sink.length + 1}`; sink.push({ taskId, body, id }); return { id }; } }; }

function buildStack(store, config, verdicts, sinks) {
  const outbox = createTelegramNotifier({ config, telegramClient: fakeTg(sinks.tg) });
  const dispatcher = createDispatcher({ store, config, adapters: { larry: fakeLarry(config), gpt_codex: fakeCodex(config, verdicts) }, outbox });
  const collectors = { github: gh, clickup: { async controlTask({ taskRef }) { return { id: taskRef ?? CONTROL_TASK, ref: taskRef ?? CONTROL_TASK, url: `https://app.clickup.com/t/${taskRef ?? CONTROL_TASK}` }; } } };
  const clickupPoster = createClickupReviewPoster({ client: fakeCu(sinks.cu), store });
  const driver = createLoopDriver({ store, dispatcher, config, outbox, collectors, clickupPoster, controlTaskId: CONTROL_TASK });
  return { outbox, dispatcher, driver };
}

test('E2E: full loop over real Postgres with a MID-RUN RESTART recovery', { skip: !DB }, async () => {
  const config = loadConfig({ ...process.env, ...ENV });
  const sinks = { tg: [], cu: [] };
  const verdicts = [
    { verdict: 'request_changes', summary: 'fix the determinism claim', findings: [{ id: 'F1', severity: 'high', evidence: 'm:1', rationale: 'r', required_correction: 'add a test' }] },
    { verdict: 'approve', summary: 'now proven' },
  ];
  gh.head = 'head1';
  let store = await freshStore();
  let stack = buildStack(store, config, verdicts, sinks);

  // 1. run-start
  const run = await stack.driver.startRun({ title: 'E2E loop', repo: 'Fusion247/Fusion247PKA', branch: 'b', headSha: 'head1', controlTaskRef: CONTROL_TASK, maxRounds: 2 });
  assert.equal(run.status, 'active');

  // 2+3. evidence + review → gate + HALT
  const r1 = await stack.driver.driveToGate(run.run_id);
  assert.equal(r1.review.verdict, 'request_changes');
  assert.equal(r1.review.halted, true);
  assert.equal(sinks.cu.length, 1, 'detailed review posted to ClickUp (durable outbox)');
  assert.equal((await store.getRun(run.run_id)).status, 'awaiting_decision');

  // human gate: Larry blocked while pending
  await assert.rejects(() => stack.dispatcher.dispatchNextTurn(run.run_id, { expectedResponder: 'larry', boundedContext: {} }), /decision gate OPEN/);

  // MID-RUN RESTART — close pool, recreate stack over the same DB, recover from rows
  await store.end();
  store = await (async () => { const { createPostgresStore } = await import('../src/store/postgresStore.js'); return createPostgresStore({ connectionString: DB }); })();
  stack = buildStack(store, config, verdicts.slice(1), sinks); // codex now returns approve next
  const recRun = await store.getRun(run.run_id);
  const recGate = await store.getLatestDecisionGate(run.run_id);
  assert.equal(recRun.status, 'awaiting_decision', 'run recovered as awaiting_decision');
  assert.equal(recGate.status, 'pending', 'gate recovered as pending');

  // stale-head tap rejected on the recovered gate
  const stale = await stack.driver.applyDecisionEvent({ sourceEventId: 'tg-stale', runId: run.run_id, payload: { callback_data: decisionCallbackData(recGate.gate_token, 'proceed'), sender_id: AUTH_ID, run_id: run.run_id, head_sha: 'WRONG' } });
  assert.equal(stale.decision.recorded, false);
  assert.equal(stale.decision.reason, 'stale-head');

  // 4. inject Proceed (Larry's correction will push head2)
  gh.head = 'head2';
  const dec = await stack.driver.applyDecisionEvent({ sourceEventId: 'tg-proceed', runId: run.run_id, payload: { callback_data: decisionCallbackData(recGate.gate_token, 'proceed'), sender_id: AUTH_ID, run_id: run.run_id, head_sha: recGate.review_head_sha } });
  assert.equal(dec.decision.recorded, true);
  assert.equal(dec.decision.dispatchLarry, true);

  // 5+6. Larry correction → new head → re-review approve → READY
  const resume = await stack.driver.resumeAfterProceed(run.run_id, r1.review.review, r1.packet);
  assert.equal(resume.correction.newHead, 'head2');
  assert.equal(resume.nextReview.terminal, LOOP_OUTCOME.READY_TO_MERGE);

  // 7. terminal — one READY notice; run round_count consumed once
  const finalRun = await store.getRun(run.run_id);
  assert.equal(finalRun.round_count, 1);
  const terminal = stack.dispatcher.notices.filter((n) => ['READY', 'BLOCKED', 'TIMED_OUT', 'DECISION_REQUIRED', 'CLOSED'].includes(n.kind));
  assert.equal(terminal.length, 1);
  assert.equal(terminal[0].kind, 'READY');

  // durable dedup: re-enqueue run_created purpose → no new row
  const re = await stack.outbox.enqueue(store, { runId: run.run_id, logicalSource: 'TOWER', purpose: `run_created:${run.run_id}`, body: 're-enqueue' }, { now: Date.now() });
  assert.equal(re.enqueued, false);

  await store.end();
});

test('E2E: maxRounds exhaustion terminalises BLOCKED (no doom-loop) on real Postgres', { skip: !DB }, async () => {
  const config = loadConfig({ ...process.env, ...ENV });
  const sinks = { tg: [], cu: [] };
  const verdicts = [
    { verdict: 'request_changes', findings: [{ id: 'F1', severity: 'high', evidence: 'e', rationale: 'r', required_correction: 'c' }] },
    { verdict: 'request_changes', findings: [{ id: 'F2', severity: 'high', evidence: 'e', rationale: 'r', required_correction: 'c' }] },
  ];
  gh.head = 'head1';
  const store = await freshStore();
  const stack = buildStack(store, config, verdicts, sinks);
  const run = await stack.driver.startRun({ title: 'mr', repo: 'o/r', branch: 'b', headSha: 'head1', controlTaskRef: CONTROL_TASK, maxRounds: 1 });
  const r1 = await stack.driver.driveToGate(run.run_id);
  gh.head = 'head2';
  await stack.driver.applyDecisionEvent({ sourceEventId: 'tg-p', runId: run.run_id, payload: { callback_data: decisionCallbackData(r1.review.gateToken, 'proceed'), sender_id: AUTH_ID, run_id: run.run_id, head_sha: 'head1' } });
  const resume = await stack.driver.resumeAfterProceed(run.run_id, r1.review.review, r1.packet);
  assert.equal(resume.nextReview.terminal, LOOP_OUTCOME.BLOCKED);
  assert.equal((await store.getRun(run.run_id)).status, 'blocked');
  await store.end();
});
