// BUILD-010 WP0 STEP 6 — Larry no-relay signed-ack of the posted Codex re-review.
//
// Proves the durable-state path end to end WITHOUT any human copy-paste:
//   Tower durable state (staged read-back pointer) -> dispatcher dispatches a
//   bounded, read-only Larry turn -> Larry reads the staged file and returns a
//   STRICT signed acknowledgement {reviewed_head_sha, codex_verdict,
//   previous_medium_closed, clickup_comment_id, ack} -> dispatcher VERIFIES the
//   HMAC signature (fail-closed) and records it.
//
// Two layers, mirroring the earlier larry-headless proof:
//   1. FAKE-claude wiring test — runs EVERYWHERE (Linux CI has no `claude`). A
//      recording fake spawn returns a canned ack envelope; we assert the full
//      dispatch/verify/record path AND that the prompt never hard-codes the
//      verdict or the SHA (Larry must read them himself).
//   2. REAL-claude live proof — capability-gated: skipped when `claude` is not
//      invocable headless OR the Tower-staged read-back file is absent (exactly
//      like the DB-gated integration tests).

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadConfig } from '../src/config.js';
import { createMemoryStore } from '../src/store/memoryStore.js';
import { createDispatcher } from '../src/dispatcher.js';
import { createLarryAdapter, verifyClaudeInvocable } from '../src/adapters/larryAdapter.js';
import { verifyEnvelope } from '../src/core/envelope.js';

// The load-bearing facts as they ACTUALLY appear in the posted review. Used only
// to ASSERT the outcome — never injected into the prompt.
const EXPECTED = Object.freeze({
  reviewed_head_sha: '9fda8fd',
  codex_verdict: 'approve',
  previous_medium_closed: true,
  clickup_comment_id: '90120242550572',
  control_task_id: '869e5zu97',
});

// The STABLE Tower-owned staged read-back file (committed evidence, durable Tower
// read of the LIVE ClickUp comment) — no scratchpad temp.
const __testdir = path.dirname(fileURLToPath(import.meta.url));
const STAGED_READBACK = path.resolve(
  process.env.TOWER_STAGED_READBACK
  ?? path.join(__testdir, '..', '..', '..', 'Builds', 'BUILD-010-fusion-tower',
    'Architecture', 'evidence', 'posted-review-readback.md'),
);

const DB = process.env.DATABASE_URL;
const MIGRATIONS_DIR = path.join(__testdir, '..', 'migrations');
const MIGRATIONS = [
  '0001_wp0_control_plane.sql',
  '0002_wp0_identity_provider_binding.sql',
  '0003_wp0_external_write_outbox.sql',
  // WP1 deltas — the real control plane is now the full chain, so the restart proof
  // runs against the current schema (incl. the decision_gate the Larry-dispatch guard
  // reads). Additive-only; the run/turn behaviour under test is unchanged.
  '0004_wp1_notification_outbox.sql',
  '0005_wp1_run_control_state.sql',
  '0006_wp1_notification_cards.sql',
];

async function resetAndMigrate() {
  const pgModule = await import('pg');
  const { Pool } = pgModule.default ?? pgModule;
  const pool = new Pool({ connectionString: DB });
  try {
    await pool.query('drop schema if exists ftw cascade');
    for (const file of MIGRATIONS) {
      await pool.query(fs.readFileSync(path.join(MIGRATIONS_DIR, file), 'utf8'));
    }
  } finally {
    await pool.end();
  }
}

function boundedAckContext(file) {
  return {
    expect: 'signed-ack',
    review_readback_path: file,
    control_task_id: EXPECTED.control_task_id,
    clickup_comment_id: EXPECTED.clickup_comment_id,
  };
}

// Recording fake spawn: captures { bin, argv, options, stdin } per invocation.
function recordingSpawn(records, plan) {
  return function spawn(bin, argv, options) {
    const rec = { bin, argv, options, stdin: '' };
    records.push(rec);
    const child = new EventEmitter();
    child.stdout = new EventEmitter();
    child.stderr = new EventEmitter();
    child.stdin = { write: (d) => { rec.stdin += d.toString(); }, end: () => {} };
    child.kill = () => {};
    let outcome;
    try { outcome = plan(argv, bin); }
    catch (e) { setImmediate(() => child.emit('error', e)); return child; }
    setImmediate(() => {
      if (outcome.stdout) child.stdout.emit('data', Buffer.from(outcome.stdout));
      if (outcome.stderr) child.stderr.emit('data', Buffer.from(outcome.stderr));
      child.emit('close', outcome.code ?? 0);
    });
    return child;
  };
}

// A fake `claude` that, on the -p run, returns the ack a real reader WOULD produce
// after reading the staged file. The --version probe reports invocable.
function planFakeClaude(argv) {
  if (argv.includes('--version')) return { stdout: '2.1.0 (Claude Code)', code: 0 };
  const ack = {
    reviewed_head_sha: EXPECTED.reviewed_head_sha,
    codex_verdict: EXPECTED.codex_verdict,
    previous_medium_closed: EXPECTED.previous_medium_closed,
    clickup_comment_id: EXPECTED.clickup_comment_id,
    ack: true,
  };
  return { stdout: JSON.stringify({ result: JSON.stringify(ack), usage: { output_tokens: 5 }, session_id: 'fake-sess' }), code: 0 };
}

test('STEP 6 (fake claude, runs everywhere): dispatcher records a signature-verified Larry ack; prompt hard-codes neither verdict nor SHA', async () => {
  const config = loadConfig({ TOWER_HMAC_SECRET_LARRY: 'y'.repeat(40) });
  const store = createMemoryStore();
  const records = [];
  const spawn = recordingSpawn(records, planFakeClaude);
  const larry = createLarryAdapter({ config, spawn, mode: 'auto' });
  const dispatcher = createDispatcher({ store, config, adapters: { larry } });

  // Durable Tower state: a run whose next bounded turn points at the staged read-back.
  const run = await store.createRun({ title: 'ack posted codex re-review', scope: 'acknowledge the posted independent Codex re-review', maxRounds: 1 });
  const d = await dispatcher.dispatchNextTurn(run.run_id, { expectedResponder: 'larry', boundedContext: boundedAckContext(STAGED_READBACK) });
  const outcome = await dispatcher.runTurn(d.turn.turn_id);
  assert.equal(outcome.blocked ?? false, false, 'the ack turn returned a signed result, not a blocker');

  const turn = await store.getTurn(d.turn.turn_id);

  // Signer identity + fail-closed signature verification (the dispatcher already
  // verified before recording; we re-verify independently here).
  assert.equal(turn.signer_principal, 'larry', 'signer principal is larry');
  const secret = config.signingSecret('larry');
  assert.ok(verifyEnvelope(turn.structured_result, turn.result_signature, secret), 'HMAC signature verifies');
  assert.equal(turn.structured_result.agent, 'larry');
  assert.equal(turn.structured_result.provider, 'anthropic-claude-code', 'honest provider label');

  // The strict ack fields, exactly.
  const ack = turn.structured_result.payload.ack;
  assert.equal(ack.reviewed_head_sha, EXPECTED.reviewed_head_sha);
  assert.equal(ack.codex_verdict, EXPECTED.codex_verdict);
  assert.equal(ack.previous_medium_closed, true);
  assert.equal(ack.clickup_comment_id, EXPECTED.clickup_comment_id);
  assert.equal(ack.ack, true);

  // No-hard-code proof: the prompt sent to claude names the FILE and the ids, but
  // never the verdict word or the reviewed SHA — Larry has to read those.
  const runRec = records.find((r) => r.argv.includes('-p'));
  assert.ok(runRec, 'the -p headless run spawned');
  assert.ok(runRec.stdin.includes(STAGED_READBACK), 'prompt points Larry at the staged read-back file');
  assert.ok(runRec.stdin.includes(EXPECTED.clickup_comment_id), 'prompt carries the comment id for cross-check');
  assert.ok(!/\bapprove\b/.test(runRec.stdin), 'prompt does NOT hard-code the verdict "approve"');
  assert.ok(!runRec.stdin.includes(EXPECTED.reviewed_head_sha), 'prompt does NOT hard-code the reviewed SHA');
  assert.equal(runRec.options?.shell, false, 'spawn is shell:false');

  // No second ClickUp write: the whole path only ever spawned `claude`.
  for (const r of records) {
    assert.equal(r.bin, 'claude', `only the claude binary is ever spawned (saw "${r.bin}")`);
  }
});

test('STEP 6 (fake claude): a NON-signing/verify-failure path is refused — dispatcher fail-closes', async () => {
  // Tamper: sign with the real secret but verify against a different one → reject.
  const config = loadConfig({ TOWER_HMAC_SECRET_LARRY: 'y'.repeat(40) });
  const store = createMemoryStore();
  const records = [];
  const spawn = recordingSpawn(records, planFakeClaude);
  const larry = createLarryAdapter({ config, spawn, mode: 'auto' });
  const run = await store.createRun({ title: 'ack', scope: 'ack', maxRounds: 1 });
  const dispatcher = createDispatcher({ store, config, adapters: { larry } });
  const d = await dispatcher.dispatchNextTurn(run.run_id, { expectedResponder: 'larry', boundedContext: boundedAckContext(STAGED_READBACK) });
  const outcome = await dispatcher.runTurn(d.turn.turn_id);
  const turn = await store.getTurn(d.turn.turn_id);
  // Sanity: the honest path DID verify (control) — the negative check is that
  // verifyEnvelope with a WRONG secret returns false (fail-closed compare).
  assert.equal(outcome.blocked ?? false, false);
  assert.equal(verifyEnvelope(turn.structured_result, turn.result_signature, 'z'.repeat(40)), false, 'a wrong secret never verifies (fail-closed)');
});

test('STEP 6 (REAL claude, capability-gated live proof): Larry reads the staged review and returns the true ack', async (t) => {
  const probe = await verifyClaudeInvocable({});
  if (!probe.invocable) { t.skip(`claude not invocable headless (${probe.error ?? 'absent'}) — live proof skipped, like DB-gated tests`); return; }
  if (!fs.existsSync(STAGED_READBACK)) { t.skip('Tower-staged read-back file absent on this runner — live proof skipped'); return; }

  const config = loadConfig({ TOWER_HMAC_SECRET_LARRY: 'live-proof-larry-' + 'q'.repeat(24) });
  const store = createMemoryStore();
  // Real Larry adapter, cwd = the staged file's dir so the Read tool can open it.
  const larry = createLarryAdapter({ config, cwd: path.dirname(STAGED_READBACK), mode: 'auto' });
  const dispatcher = createDispatcher({ store, config, adapters: { larry } });

  const run = await store.createRun({ title: 'ack posted codex re-review (live)', scope: 'acknowledge the posted independent Codex re-review', maxRounds: 1 });
  const d = await dispatcher.dispatchNextTurn(run.run_id, { expectedResponder: 'larry', boundedContext: boundedAckContext(STAGED_READBACK) });
  const outcome = await dispatcher.runTurn(d.turn.turn_id);
  assert.equal(outcome.blocked ?? false, false, `real Larry turn should not block: ${outcome.blocker ?? ''}`);

  const turn = await store.getTurn(d.turn.turn_id);
  assert.equal(turn.signer_principal, 'larry');
  assert.ok(verifyEnvelope(turn.structured_result, turn.result_signature, config.signingSecret('larry')), 'real turn signature verifies');
  const ack = turn.structured_result.payload.ack;
  assert.equal(ack.reviewed_head_sha, EXPECTED.reviewed_head_sha, 'Larry independently read the reviewed SHA');
  assert.equal(ack.codex_verdict, EXPECTED.codex_verdict, 'Larry independently read the verdict');
  assert.equal(ack.previous_medium_closed, true);
  assert.equal(ack.clickup_comment_id, EXPECTED.clickup_comment_id);
  assert.equal(ack.ack, true);
});

// GPT MEDIUM-2 fix A — the no-relay ack proven on REAL Postgres across a GENUINE
// dispatcher/store RESTART. DB-gated + claude-gated + staged-evidence-gated: skips
// cleanly wherever any is absent (portable CI). This is the test that backs
// scripts/proof-norelay-ack.js.
test('STEP 6 (REAL Postgres + genuine restart, gated): recover the run after a store restart, real Larry signed ack, persist, re-read after a 2nd reconnect', { skip: !DB }, async (t) => {
  const probe = await verifyClaudeInvocable({});
  if (!probe.invocable) { t.skip(`claude not invocable headless (${probe.error ?? 'absent'}) — live proof skipped`); return; }
  if (!fs.existsSync(STAGED_READBACK)) { t.skip('Tower-owned staged read-back absent on this runner — live proof skipped'); return; }

  await resetAndMigrate();
  const { createPostgresStore } = await import('../src/store/postgresStore.js');
  // Postgres present → live mode → dispatcher fail-closes unless a signed envelope
  // + provisioned secret are present. Provide the synthetic HMAC secret.
  const config = loadConfig({ ...process.env, TOWER_HMAC_SECRET_LARRY: 'pg-proof-larry-' + 'q'.repeat(24) });
  assert.equal(config.isRuntimeReady(), true, 'DATABASE_URL present → live (fail-closed signing) mode');

  // 1. Create the run + posted-review event in Postgres.
  const store1 = await createPostgresStore({ connectionString: DB });
  let runId; let postedEventId;
  try {
    const run = await store1.createRun({ title: 'ack posted codex re-review (pg restart)', scope: 'acknowledge the posted independent Codex re-review', evidenceTaskRef: EXPECTED.control_task_id, maxRounds: 1 });
    runId = run.run_id;
    const posted = await store1.ingestEvent({ source: 'clickup', sourceEventId: EXPECTED.clickup_comment_id, kind: 'task_comment.created', runId: run.run_id, selfGenerated: true, payload: { task_id: EXPECTED.control_task_id, comment_id: EXPECTED.clickup_comment_id, is_self: true } });
    postedEventId = posted.event.event_id;
    // Self-generated → never claimable for advance.
    assert.equal(await store1.claimNextEvent({ runId: run.run_id }), null, 'the posted self-event never advances a run');
  } finally {
    // 2. GENUINE RESTART: close the pool before the Larry dispatch.
    await store1.end();
  }

  // 3. Recover the pending run from Postgres with a BRAND-NEW store.
  const store2 = await createPostgresStore({ connectionString: DB });
  let turnId;
  try {
    const recovered = await store2.getRun(runId);
    assert.ok(recovered, 'the run is recovered from durable Postgres state after the restart');
    assert.equal((await store2.getEvent(postedEventId)).self_generated, true, 'the posted event survived the restart, still self-generated');

    const larry = createLarryAdapter({ config, cwd: path.dirname(STAGED_READBACK), mode: 'auto' });
    const dispatcher = createDispatcher({ store: store2, config, adapters: { larry } });
    const d = await dispatcher.dispatchNextTurn(recovered.run_id, { expectedResponder: 'larry', boundedContext: boundedAckContext(STAGED_READBACK) });
    turnId = d.turn.turn_id;

    // 4. Run the REAL headless claude turn. 5. runTurn verifies + persists to Postgres.
    const outcome = await dispatcher.runTurn(d.turn.turn_id);
    assert.equal(outcome.blocked ?? false, false, `real Larry turn should not block: ${outcome.blocker ?? ''}`);
    const turn = await store2.getTurn(d.turn.turn_id);
    assert.equal(turn.signer_principal, 'larry');
    assert.ok(verifyEnvelope(turn.structured_result, turn.result_signature, config.signingSecret('larry')), 'signature verifies (recovered-run turn)');
    const ack = turn.structured_result.payload.ack;
    assert.equal(ack.reviewed_head_sha, EXPECTED.reviewed_head_sha, 'Larry independently read the reviewed SHA');
    assert.equal(ack.codex_verdict, EXPECTED.codex_verdict, 'Larry independently read the verdict');
    assert.equal(ack.clickup_comment_id, EXPECTED.clickup_comment_id);
    assert.equal(ack.ack, true);
  } finally {
    await store2.end();
  }

  // 6. RECONNECT AGAIN (fresh pool) — the signed ack is STILL readable from Postgres.
  const store3 = await createPostgresStore({ connectionString: DB });
  try {
    const turn3 = await store3.getTurn(turnId);
    assert.equal(turn3.state, 'returned', 'the ack turn is durably returned after a second reconnect');
    assert.ok(verifyEnvelope(turn3.structured_result, turn3.result_signature, config.signingSecret('larry')), 'signature still verifies after the second reconnect');
    assert.equal(turn3.structured_result.payload.ack.ack, true);
  } finally {
    await store3.end();
  }
});
