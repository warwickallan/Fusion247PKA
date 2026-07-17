// Fusion Tower — SYNTHETIC end-to-end GOVERNANCE-LOOP proof (BUILD-010 WP1 CAPSTONE).
//
// Drives the WHOLE autonomous governance loop end-to-end against a REAL PostgresStore
// (durability + restart recovery) with FAKES for every live surface:
//   · Codex review  — a scripted signed verdict (round 1 request_changes, round 2 approve)
//   · Larry         — a scripted signed correction result (a checkpoint push → new head)
//   · Telegram      — an outbound-only fake client that captures sends (NO live send)
//   · GitHub        — a controllable head-SHA collector (NO live poll)
//   · ClickUp       — a fake write client that captures the detailed review (NO live post)
//
// PROVES, across the whole run:
//   run-start → evidence → Codex review (request_changes) → [CODEX] card + gate opens +
//   loop HALTS (assert NO Larry dispatch while pending) → inject Proceed decision →
//   Larry correction → new head → Codex re-review (approve) → terminal READY_TO_MERGE →
//   ONE terminal notification. PLUS a MID-RUN RESTART (close the pool, recreate the
//   store/dispatcher/driver, recover the run from durable state) proving it resumes.
//
// INVARIANTS asserted: no autonomous merge; no live writes (fakes); the human gate was
// honoured (Larry never dispatched before Proceed); notifications deduped; the run +
// gate + decision are all durable. A masked transcript is written to
// Builds/BUILD-010-fusion-tower/Architecture/governance-loop-synthetic-proof.md.
//
// GATED ON A DB: without DATABASE_URL the proof cannot exercise real durability /
// restart recovery, so it exits 0 with a clear "skipped (no DB)" — CI without a DB
// never fails on it. No secret is ever printed.

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
import { assertNoAutonomousMerge } from '../src/core/guardrails.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DB = process.env.DATABASE_URL;
const CONTROL_TASK = '869e5zu97';
const AUTH_ID = '4242';

// Proof-only synthetic secrets (NOT real, NOT committed anywhere).
const SYNTH_ENV = {
  AUTHORISED_TELEGRAM_USER_ID: AUTH_ID,
  TELEGRAM_BOT_TOKEN: '1234567890:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
  TOWER_HMAC_SECRET_LARRY: 'proof-secret-larry-' + 'x'.repeat(24),
  TOWER_HMAC_SECRET_GPT_CODEX: 'proof-secret-codex-' + 'y'.repeat(24),
  TOWER_HMAC_SECRET_TOWER: 'proof-secret-tower-' + 'z'.repeat(24),
  DATABASE_URL: DB,
};

const MIGRATIONS_DIR = path.join(__dirname, '..', 'migrations');
const MIGRATIONS = [
  '0001_wp0_control_plane.sql', '0002_wp0_identity_provider_binding.sql',
  '0003_wp0_external_write_outbox.sql', '0004_wp1_notification_outbox.sql',
  '0005_wp1_run_control_state.sql', '0006_wp1_notification_cards.sql',
];

const trail = [];
function step(title, detail) { trail.push({ n: trail.length + 1, title, detail }); }

async function resetAndMigrate() {
  const pgModule = await import('pg');
  const { Pool } = pgModule.default ?? pgModule;
  const pool = new Pool({ connectionString: DB });
  try {
    await pool.query('drop schema if exists ftw cascade');
    for (const file of MIGRATIONS) {
      await pool.query(fs.readFileSync(path.join(MIGRATIONS_DIR, file), 'utf8'));
    }
  } finally { await pool.end(); }
}

// ── controllable fakes (proof-level, non-durable — the honest external substrate) ──

// GitHub is the source of truth for the branch head. The loop RE-READS it (never trusts
// a self-reported SHA), so this survives a restart trivially: it's an external read.
const gh = {
  currentHead: 'head1aaaaaaa',
  async headSha() { return this.currentHead; },
  async checkEvidenceRef({ headSha }) { return headSha ? `ci-evidence:${String(headSha).slice(0, 6)}` : null; },
};

// A fake Codex adapter returning a scripted signed verdict per turn.
function fakeCodex(config, verdicts) {
  let i = 0;
  const secret = config.signingSecret('gpt_codex');
  return {
    principal: 'gpt_codex',
    async runTurn({ run, turn }) {
      const spec = verdicts[Math.min(i, verdicts.length - 1)]; i += 1;
      const payload = {
        status: 'ok', verdict: spec.verdict, summary: spec.summary,
        claims_verified: [{ claim: 'migration chains 0001→0006', status: 'confirmed', evidence: 'migrations/*.sql' }],
        findings: spec.findings ?? [], proposed_action: { type: 'post_review', target: CONTROL_TASK },
      };
      const signed = makeSignedResult({ principal: 'gpt_codex', provider: 'openai-codex', modelId: 'fake-codex', runId: run.run_id, ordinal: turn.ordinal, headSha: run.evidence_commit_sha, payload }, secret);
      return { ok: true, blocked: false, signerPrincipal: 'gpt_codex', structuredResult: payload, ...signed, tokensUsed: 42 };
    },
  };
}

// A fake Larry adapter: a signed correction result (a checkpoint push in real life).
function fakeLarry(config) {
  const secret = config.signingSecret('larry');
  return {
    principal: 'larry',
    async runTurn({ run, turn }) {
      const payload = { status: 'ok', summary: 'applied the named corrections and pushed a checkpoint', proposed_action: { type: 'post_comment', target: CONTROL_TASK }, confidence: 0.95 };
      const signed = makeSignedResult({ principal: 'larry', provider: 'anthropic-claude-code', modelId: 'fake-larry', runId: run.run_id, ordinal: turn.ordinal, headSha: run.evidence_commit_sha, payload }, secret);
      return { ok: true, blocked: false, signerPrincipal: 'larry', structuredResult: payload, ...signed, tokensUsed: 64 };
    },
  };
}

// Outbound-only fake Telegram client (captures sends; NO live send).
function fakeTelegram(sink) {
  return { get ready() { return true; }, async sendMessage(recipient, text) { const id = `msg-${sink.length + 1}`; sink.push({ recipient, text, id }); return { ok: true, message_id: id, chatId: recipient }; } };
}

// Fake ClickUp write client (captures the review comment; NO live post).
function fakeClickup(sink) {
  return { async createTaskComment(taskId, body) { const id = `cu-comment-${sink.length + 1}`; sink.push({ taskId, body, id, performed: false, note: 'SYNTHETIC — captured, not posted live' }); return { id }; } };
}

// Build the full wired stack over a given (durable) store. Re-callable after a restart.
function buildStack(store, config, sinks, verdicts) {
  const gpt_codex = fakeCodex(config, verdicts);
  const larry = fakeLarry(config);
  const outbox = createTelegramNotifier({ config, telegramClient: fakeTelegram(sinks.telegram) });
  const dispatcher = createDispatcher({ store, config, adapters: { larry, gpt_codex }, outbox });
  const collectors = {
    github: gh,
    clickup: { async controlTask({ taskRef }) { return { id: taskRef ?? CONTROL_TASK, ref: taskRef ?? CONTROL_TASK, url: `https://app.clickup.com/t/${taskRef ?? CONTROL_TASK}` }; } },
  };
  const clickupPoster = createClickupReviewPoster({ client: fakeClickup(sinks.clickup), store });
  const driver = createLoopDriver({ store, dispatcher, config, outbox, collectors, clickupPoster, controlTaskId: CONTROL_TASK });
  return { dispatcher, outbox, driver, collectors };
}

async function main() {
  if (!DB) {
    process.stdout.write(JSON.stringify({ proof: 'wp1-governance-loop-e2e', skipped: true, reason: 'no DATABASE_URL — durability/restart proof requires a real Postgres; skipped cleanly' }) + '\n');
    process.exit(0);
  }

  const config = loadConfig({ ...process.env, ...SYNTH_ENV });
  await resetAndMigrate();
  step('DB reset + migrate 0001→0006 (real PostgresStore)', { migrations: MIGRATIONS.length });

  const { createPostgresStore } = await import('../src/store/postgresStore.js');
  const sinks = { telegram: [], clickup: [] };
  const verdicts = [
    { verdict: 'request_changes', summary: 'the migration determinism claim is unverified', findings: [{ id: 'F1', severity: 'high', evidence: 'migrations/0006:12', rationale: 'idempotency not asserted', required_correction: 'add a determinism test' }] },
    { verdict: 'approve', summary: 'determinism now proven; claims confirmed' },
  ];

  let store = await createPostgresStore({ connectionString: config.databaseUrl, caFile: config.databaseSslCaFile });
  let stack = buildStack(store, config, sinks, verdicts);

  const invariants = { no_autonomous_merge: false, human_gate_honoured: false, no_live_writes: false, notifications_deduped: false, durable_after_restart: false, single_terminal_notice: false };

  // ── 1. run-start ──────────────────────────────────────────────────────────
  gh.currentHead = 'head1aaaaaaa';
  const run = await stack.driver.startRun({
    title: 'BUILD-010 WP1 — reliable autonomous governance loop',
    scope: 'services/fusion-tower loop driver', repo: 'Fusion247/Fusion247PKA',
    branch: 'build-010/wp1-reliable-autonomous-governance-loop', headSha: 'head1aaaaaaa',
    controlTaskRef: CONTROL_TASK, maxRounds: 2, budget: { tokens: 500000 },
  });
  step('run-start → durable active run + [TOWER] run created', { run_id: run.run_id, status: run.status, max_rounds: run.max_rounds, scope_lock: run.scope_lock });

  // ── 2+3. evidence + Codex review (request_changes) → gate opens + HALT ──────
  const r1 = await stack.driver.driveToGate(run.run_id);
  step('evidence staged + Codex review (round 1)', { head: r1.packet.head_sha, verdict: r1.review.verdict, findings: r1.review.findings.length, halted: r1.review.halted, gate_token_len: r1.review.gateToken?.length, clickup_posted: sinks.clickup.length });
  assert(r1.review.verdict === 'request_changes', 'round 1 verdict is request_changes');
  assert(r1.review.halted === true, 'the loop HALTED at the human gate');
  assert(sinks.clickup.length === 1, 'the detailed review was posted to ClickUp via the durable outbox (fake)');

  // ── HUMAN GATE: Larry must NOT be dispatchable while the gate is pending ─────
  let larryBlockedWhilePending = false;
  try {
    await stack.dispatcher.dispatchNextTurn(run.run_id, { expectedResponder: 'larry', boundedContext: {} });
  } catch (err) { larryBlockedWhilePending = /decision gate OPEN/.test(String(err.message)); }
  invariants.human_gate_honoured = larryBlockedWhilePending;
  step('HUMAN GATE — Larry dispatch refused while gate pending (structural)', { larry_dispatch_rejected: larryBlockedWhilePending });
  assert(larryBlockedWhilePending, 'Larry cannot be dispatched before a Proceed');

  // ── MID-RUN RESTART — close the pool, recreate everything, recover from durable state ──
  await store.end();
  store = await createPostgresStore({ connectionString: config.databaseUrl, caFile: config.databaseSslCaFile });
  stack = buildStack(store, config, sinks, verdicts.slice(1)); // codex now returns 'approve' next
  const recoveredRun = await store.getRun(run.run_id);
  const recoveredGate = await store.getLatestDecisionGate(run.run_id);
  invariants.durable_after_restart = Boolean(recoveredRun && recoveredGate && recoveredGate.status === 'pending' && recoveredRun.status === 'awaiting_decision');
  step('MID-RUN RESTART — pool closed, store/dispatcher/driver recreated, run recovered from DB', {
    recovered_run_status: recoveredRun.status, recovered_gate_status: recoveredGate?.status,
    recovered_gate_head: recoveredGate?.review_head_sha, evidence_head: recoveredRun.evidence_commit_sha,
  });
  assert(invariants.durable_after_restart, 'run + gate durable and recovered after restart');

  // A stale-head tap on the RECOVERED gate is rejected (belt for the stale-tap guard).
  const staleDec = await stack.driver.applyDecisionEvent({ sourceEventId: 'tg-stale', runId: run.run_id, payload: { callback_data: decisionCallbackData(recoveredGate.gate_token, 'proceed'), sender_id: AUTH_ID, run_id: run.run_id, head_sha: 'WRONGHEADxxx' } });
  step('stale-head decision tap REJECTED after restart', { recorded: staleDec.decision.recorded, reason: staleDec.decision.reason });
  assert(staleDec.decision.recorded === false && staleDec.decision.reason === 'stale-head', 'stale-head tap rejected');

  // ── 4. inject the Proceed decision (Warwick's tap) ──────────────────────────
  gh.currentHead = 'head2bbbbbbb'; // Larry's correction will push this new head
  const dec = await stack.driver.applyDecisionEvent({ sourceEventId: 'tg-proceed-1', runId: run.run_id, payload: { callback_data: decisionCallbackData(recoveredGate.gate_token, 'proceed'), sender_id: AUTH_ID, run_id: run.run_id, head_sha: recoveredGate.review_head_sha } });
  step('inject Proceed decision (durable command:decision drained)', { recorded: dec.decision.recorded, effect: dec.decision.effect, dispatchLarry: dec.decision.dispatchLarry });
  assert(dec.decision.recorded === true && dec.decision.dispatchLarry === true, 'Proceed recorded → Larry cleared');

  // ── 5+6. Larry correction (new head) → Codex re-review (approve) → terminal ──
  const resume = await stack.driver.resumeAfterProceed(run.run_id, r1.review.review, r1.packet);
  step('Larry correction → new head → Codex re-review (round 2)', {
    correction_progressed: resume.correction.progressed, prior_head: resume.correction.priorHead, new_head: resume.correction.newHead,
    rereview_verdict: resume.nextReview.verdict, terminal: resume.nextReview.terminal,
  });
  assert(resume.correction.progressed === true && resume.correction.newHead === 'head2bbbbbbb', 'a new head was detected');
  assert(resume.nextReview.terminal === LOOP_OUTCOME.READY_TO_MERGE, 'round 2 approve → READY_TO_MERGE');

  // ── 7. terminal — exactly ONE terminal notice; READY (never a merge) ─────────
  const finalRun = await store.getRun(run.run_id);
  const terminalNotices = stack.dispatcher.notices.filter((n) => ['READY', 'BLOCKED', 'TIMED_OUT', 'DECISION_REQUIRED', 'CLOSED'].includes(n.kind));
  invariants.single_terminal_notice = terminalNotices.length === 1 && terminalNotices[0].kind === 'READY';
  step('terminal — READY_TO_MERGE (single terminal notice; merge stays Warwick-only)', { run_status: finalRun.status, terminal_outcome: finalRun.terminal_outcome, terminal_notices: terminalNotices.length, kind: terminalNotices[0]?.kind });

  // ── invariants ──────────────────────────────────────────────────────────────
  // no autonomous merge — the guardrail rejects a merge action outright.
  try { assertNoAutonomousMerge({ type: 'merge', repo: 'Fusion247/Fusion247PKA' }); }
  catch (err) { invariants.no_autonomous_merge = /NO-AUTONOMOUS-MERGE/.test(String(err.message)); }
  // no live writes — every captured ClickUp/Telegram write is a fake capture.
  invariants.no_live_writes = sinks.clickup.every((c) => c.performed === false);
  // notifications deduped — re-enqueue the run_created purpose → no new row.
  const before = (await store.claimPendingNotifications(50)).length + (stack.dispatcher.notices.length);
  const reEnq = await stack.outbox.enqueue(store, { runId: run.run_id, logicalSource: 'TOWER', purpose: `run_created:${run.run_id}`, body: 're-enqueue attempt' }, { now: Date.now() });
  invariants.notifications_deduped = reEnq.enqueued === false;
  step('invariants', { ...invariants, _before_notify_count: before });

  // Durable drain proof: send the pending backlog once (outbound-only fake).
  const drain = await stack.outbox.drainOnce(store, { limit: 50 });
  step('durable notification drain (outbound-only fake send)', { drain, telegram_sends: sinks.telegram.length });

  await store.end();

  const verdict = {
    proof: 'wp1-governance-loop-e2e',
    stages: { run_start: true, evidence: true, codex_review_request_changes: r1.review.verdict === 'request_changes', gate_opened_and_halted: r1.review.halted, mid_run_restart_recovered: invariants.durable_after_restart, proceed_injected: dec.decision.recorded, larry_correction_new_head: resume.correction.newHead, codex_rereview_approve: resume.nextReview.verdict === 'approve', terminal: resume.nextReview.terminal },
    invariants,
    passed: Object.values(invariants).every(Boolean)
      && r1.review.halted && dec.decision.recorded
      && resume.nextReview.terminal === LOOP_OUTCOME.READY_TO_MERGE,
  };
  writeTranscript({ config, trail, verdict, sinks, notices: stack.dispatcher.notices });
  process.stdout.write(JSON.stringify(verdict, null, 2) + '\n');
  process.exit(verdict.passed ? 0 : 2);
}

function assert(cond, msg) { if (!cond) throw new Error(`proof assertion failed: ${msg}`); }

function writeTranscript({ config, trail, verdict, sinks, notices }) {
  const out = path.join(__dirname, '..', '..', '..', 'Builds', 'BUILD-010-fusion-tower', 'Architecture', 'governance-loop-synthetic-proof.md');
  const lines = [];
  lines.push('---', 'build: BUILD-010', 'component: Fusion Tower / Governance Loop Driver', 'wp: WP1', 'artifact: governance-loop-synthetic-proof', 'status: generated', 'author: mack', `generated: ${new Date().toISOString()}`, '---', '');
  lines.push('# Fusion Tower — WP1 Governance-Loop Synthetic End-to-End Proof (masked transcript)', '');
  lines.push('Parent build: [[BUILD-010-fusion-tower]] · Loop driver: `services/fusion-tower/src/loopDriver.js`', '');
  lines.push('Generated by `services/fusion-tower/scripts/proof-governance-loop.js`. Drives the whole');
  lines.push('governance loop against a REAL PostgresStore (durability + a MID-RUN RESTART recovery)');
  lines.push('with FAKES for every live surface (Codex, Larry, Telegram, GitHub, ClickUp). No live');
  lines.push('external write, no autonomous merge, no secret printed. The human gate is honoured:');
  lines.push('Larry is never dispatched before a durable Proceed.', '');
  lines.push('## Verdict', '', '```json', JSON.stringify(verdict, null, 2), '```', '');
  lines.push('## Masked config snapshot (proof of secret masking)', '', '```json', JSON.stringify(config.describe(), null, 2), '```', '');
  lines.push('## Step-by-step transcript', '');
  for (const s of trail) { lines.push(`### ${s.n}. ${s.title}`, '', '```json', JSON.stringify(s.detail, null, 2), '```', ''); }
  lines.push('## Synthetic ClickUp writes (detailed review — NONE performed live)', '', '```json', JSON.stringify(sinks.clickup.map((c) => ({ taskId: c.taskId, id: c.id, performed: c.performed, note: c.note, body_first_line: String(c.body).split('\n')[1] ?? '' })), null, 2), '```', '');
  lines.push('## Terminal + milestone notices surfaced to Warwick', '', '```json', JSON.stringify(notices, null, 2), '```', '');
  fs.writeFileSync(out, lines.join('\n'));
}

main().catch((err) => {
  process.stderr.write(JSON.stringify({ proof: 'wp1-governance-loop-e2e', event: 'error', error: String(err?.message ?? err), stack: err?.stack }) + '\n');
  process.exit(1);
});
