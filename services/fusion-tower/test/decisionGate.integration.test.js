// REAL Postgres integration suite for the HUMAN DECISION GATE (BUILD-010 WP1, OI §4a).
//
// GATED: every test is `{ skip: !DB }` so the default unit run (node --test with NO
// DATABASE_URL) skips this file cleanly and never loads `pg`. Proves the durable card
// column + decision_gate table over the real store (chain 0001 -> 0006): a card rides
// on the outbox row, a gate opens/records exactly once, a stale/duplicate tap is
// rejected, the gate SURVIVES A STORE RESTART and can still be tapped, RLS is
// deny-by-default, and the DB CHECK refuses a non-vocabulary (merge) decision.
//
// RUN (throwaway local cluster):
//   cd services/fusion-tower
//   DATABASE_URL=postgresql://postgres@127.0.0.1:54342/ftw_dev \
//     node --test --test-concurrency=1 test/decisionGate.integration.test.js

import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { loadConfig } from '../src/config.js';
import { createPostgresStore } from '../src/store/postgresStore.js';
import { createTelegramNotifier } from '../src/adapters/telegramNotifier.js';
import { postCodexReviewGate, handleDecisionEvent } from '../src/core/decisionGate.js';
import { RUN_STATUS, GATE_STATUS, DECISION } from '../src/core/states.js';

const DB = process.env.DATABASE_URL;
const CHAT = '123456789';
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const MIGRATIONS_DIR = path.join(__dirname, '..', 'migrations');
const MIGRATIONS = [
  '0001_wp0_control_plane.sql',
  '0002_wp0_identity_provider_binding.sql',
  '0003_wp0_external_write_outbox.sql',
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

async function freshStore() {
  await resetAndMigrate();
  return createPostgresStore({ connectionString: DB });
}

async function seedActiveRun(store) {
  const run = await store.createRun({ title: 'gate', maxRounds: 3 }, { now: 1000 });
  await store.setRunStatus(run.run_id, RUN_STATUS.ACTIVE, { now: 1000 });
  return run;
}

function notifier() {
  const config = loadConfig({ AUTHORISED_TELEGRAM_USER_ID: CHAT });
  const client = { ready: true, async sendMessage() { throw new Error('no live send in this test'); } };
  return createTelegramNotifier({ config, telegramClient: client });
}

test('G1. chain 0001->0006 applies cleanly from empty, twice (determinism)', { skip: !DB }, async () => {
  await resetAndMigrate();
  await resetAndMigrate();
});

test('G2. reply_markup persists on notification_outbox (durable card definition)', { skip: !DB }, async () => {
  const store = await freshStore();
  try {
    const card = { inline_keyboard: [[{ text: '✅ Proceed', callback_data: 'dec:abc123def4:proceed' }]] };
    const r = await store.enqueueNotification({
      dedupKey: 'k-card', runId: null, recipient: CHAT, logicalSource: 'CODEX',
      purpose: 'codex_review_gate:abc123de', body: 'Codex review — decide below', replyMarkup: card,
    }, { now: 1 });
    assert.equal(r.enqueued, true);
    const row = await store.getNotification('k-card');
    assert.deepEqual(row.reply_markup, card, 'the inline_keyboard is stored + read back verbatim');
    // A plain notification carries NULL reply_markup.
    await store.enqueueNotification({
      dedupKey: 'k-plain', runId: null, recipient: CHAT, logicalSource: 'TOWER',
      purpose: 'run_created', body: 'plain',
    }, { now: 2 });
    assert.equal((await store.getNotification('k-plain')).reply_markup, null);
  } finally { await store.end(); }
});

test('G3. openDecisionGate: one pending gate per run; a new head SUPERSEDES; same head is idempotent', { skip: !DB }, async () => {
  const store = await freshStore();
  try {
    const run = await seedActiveRun(store);
    const a = await store.openDecisionGate({ runId: run.run_id, reviewHeadSha: 'H1', gateToken: 'tok0000001', allowedDecisions: ['proceed', 'hold', 'stop'] }, { now: 1 });
    assert.equal(a.opened, true);
    // Same head => idempotent re-open returns the existing gate (same token), opened:false.
    const a2 = await store.openDecisionGate({ runId: run.run_id, reviewHeadSha: 'H1', gateToken: 'tok0000002' }, { now: 2 });
    assert.equal(a2.opened, false);
    assert.equal(a2.gate.gate_token, 'tok0000001');
    // New head => supersede the old pending gate, open a fresh one.
    const b = await store.openDecisionGate({ runId: run.run_id, reviewHeadSha: 'H2', gateToken: 'tok0000003' }, { now: 3 });
    assert.equal(b.opened, true);
    assert.equal((await store.getDecisionGateByToken('tok0000001')).status, GATE_STATUS.SUPERSEDED);
    assert.equal((await store.getPendingDecisionGate(run.run_id)).gate_token, 'tok0000003');
    // Exactly one pending gate for the run (the partial unique index guarantee).
    const gate = await store.getPendingDecisionGate(run.run_id);
    assert.equal(gate.status, GATE_STATUS.PENDING);
  } finally { await store.end(); }
});

test('G4. recordDecisionGate is atomic + idempotent: proceed once, duplicate rejected, superseded rejected', { skip: !DB }, async () => {
  const store = await freshStore();
  try {
    const run = await seedActiveRun(store);
    await store.openDecisionGate({ runId: run.run_id, reviewHeadSha: 'H1', gateToken: 'tokAAAA0001' }, { now: 1 });
    const first = await store.recordDecisionGate({ gateToken: 'tokAAAA0001', decision: 'proceed', decidedBy: CHAT, reviewHeadSha: 'H1' }, { now: 2 });
    assert.equal(first.recorded, true);
    assert.equal(first.gate.decision, DECISION.PROCEED);
    // Duplicate tap on the decided gate — rejected idempotently, no second effect.
    const dup = await store.recordDecisionGate({ gateToken: 'tokAAAA0001', decision: 'proceed', decidedBy: CHAT, reviewHeadSha: 'H1' }, { now: 3 });
    assert.equal(dup.recorded, false);
    assert.equal(dup.reason, 'already-decided');
    // Wrong head SHA on a fresh gate — rejected as stale.
    await store.openDecisionGate({ runId: run.run_id, reviewHeadSha: 'H2', gateToken: 'tokBBBB0002' }, { now: 4 });
    const stale = await store.recordDecisionGate({ gateToken: 'tokBBBB0002', decision: 'proceed', decidedBy: CHAT, reviewHeadSha: 'WRONGHEAD' }, { now: 5 });
    assert.equal(stale.recorded, false);
    assert.equal(stale.reason, 'stale-head');
    assert.equal((await store.getDecisionGateByToken('tokBBBB0002')).status, GATE_STATUS.PENDING, 'a stale tap leaves the gate pending');
  } finally { await store.end(); }
});

test('G5. DURABLE GATE + RESTART: a pending gate survives a store restart and can still be tapped', { skip: !DB }, async () => {
  await resetAndMigrate();
  // First store instance: open the gate + enqueue the card, then CLOSE the store.
  let runId;
  let token;
  {
    const store = await createPostgresStore({ connectionString: DB });
    const run = await seedActiveRun(store);
    runId = run.run_id;
    const res = await postCodexReviewGate(store, notifier(), {
      runId, verdict: 'request_changes', headSha: 'deadbeefcafe',
      findings: [{ severity: 'high' }], fullReviewRef: 'https://app.clickup.com/t/869e5zu97',
    }, { now: 2000 });
    token = res.gate.gate_token;
    assert.equal(res.halted, true);
    assert.equal((await store.getRun(runId)).status, RUN_STATUS.AWAITING_DECISION);
    await store.end(); // simulate a process restart (pool closed)
  }
  // Second store instance on the SAME DB: the gate + card are still there.
  {
    const store = await createPostgresStore({ connectionString: DB });
    try {
      const gate = await store.getPendingDecisionGate(runId);
      assert.equal(gate.gate_token, token, 'the pending gate survived the restart');
      assert.equal(gate.status, GATE_STATUS.PENDING);
      // Tap Proceed after the restart — the gate records + clears.
      const ev = {
        source: 'telegram', source_event_id: 'restart-tap', kind: 'command:decision', run_id: runId,
        payload: { run_id: runId, decision: 'proceed', tapper_id: CHAT, callback_data: `dec:${token}:proceed`, message_id: '9' },
      };
      const out = await handleDecisionEvent(store, notifier(), ev, { now: 3000, allowlist: [CHAT] });
      assert.equal(out.recorded, true);
      assert.equal(out.dispatchLarry, true);
      assert.equal(out.merge, false);
      assert.equal((await store.getLatestDecisionGate(runId)).status, GATE_STATUS.DECIDED);
      assert.equal((await store.getRun(runId)).status, RUN_STATUS.ACTIVE);
    } finally { await store.end(); }
  }
});

test('G6. postCodexReviewGate end-to-end on real PG: gate + carded [CODEX] notification + awaiting_decision; proceed clears; NO merge', { skip: !DB }, async () => {
  const store = await freshStore();
  try {
    const run = await seedActiveRun(store);
    const res = await postCodexReviewGate(store, notifier(), {
      runId: run.run_id, verdict: 'approve', headSha: 'feedface0001',
      findings: [{ severity: 'low' }, { severity: 'info' }], fullReviewRef: 'https://app.clickup.com/t/869e5zu97',
    }, { now: 100 });
    assert.equal(res.halted, true);
    assert.equal(res.dispatchedLarry, false);
    assert.equal(res.merge, false);

    const notif = await store.getNotification(res.notification.dedupKey);
    assert.equal(notif.logical_source, 'CODEX');
    assert.equal(notif.reply_markup.inline_keyboard[0].length, 3, 'Proceed/Hold/Stop cards persisted');
    const gate = await store.getPendingDecisionGate(run.run_id);
    assert.deepEqual(gate.allowed_decisions, ['proceed', 'hold', 'stop']);

    const ev = {
      source: 'telegram', source_event_id: 'e2e-tap', kind: 'command:decision', run_id: run.run_id,
      payload: { run_id: run.run_id, decision: 'proceed', tapper_id: CHAT, callback_data: `dec:${gate.gate_token}:proceed`, message_id: '1' },
    };
    const out = await handleDecisionEvent(store, notifier(), ev, { now: 200, allowlist: [CHAT] });
    assert.equal(out.recorded, true);
    assert.equal(out.merge, false);
    assert.equal((await store.getRun(run.run_id)).status, RUN_STATUS.ACTIVE);
    assert.equal((await store.getRun(run.run_id)).decision_required, false);
  } finally { await store.end(); }
});

test('G7. RLS deny-by-default on decision_gate: anon denied, service_role permitted', { skip: !DB }, async () => {
  const store = await freshStore();
  try {
    const run = await seedActiveRun(store);
    await store.openDecisionGate({ runId: run.run_id, reviewHeadSha: 'H1', gateToken: 'tokRLS00001' }, { now: 1 });
    const pgModule = await import('pg');
    const { Pool } = pgModule.default ?? pgModule;
    const pool = new Pool({ connectionString: DB });
    try {
      const rls = await pool.query(
        `select c.relrowsecurity from pg_class c
           join pg_namespace n on n.oid = c.relnamespace
          where n.nspname = 'ftw' and c.relname = 'decision_gate'`,
      );
      assert.equal(rls.rows[0].relrowsecurity, true, 'RLS must be enabled on decision_gate');
      const client = await pool.connect();
      try {
        await client.query('set role anon');
        await assert.rejects(
          () => client.query('select count(*) from ftw.decision_gate'),
          /permission denied/,
          'anon must be denied on ftw.decision_gate',
        );
        await client.query('reset role');
        await client.query('set role service_role');
        const res = await client.query('select count(*)::int as n from ftw.decision_gate');
        assert.ok(res.rows[0].n >= 1, 'service_role sees rows');
        await client.query('reset role');
      } finally { client.release(); }
    } finally { await pool.end(); }
  } finally { await store.end(); }
});

test('G8. the DB CHECK refuses a non-vocabulary decision (a card is NEVER a merge)', { skip: !DB }, async () => {
  const store = await freshStore();
  try {
    const run = await seedActiveRun(store);
    await store.openDecisionGate({ runId: run.run_id, reviewHeadSha: 'H1', gateToken: 'tokCHK00001' }, { now: 1 });
    const pgModule = await import('pg');
    const { Pool } = pgModule.default ?? pgModule;
    const pool = new Pool({ connectionString: DB });
    try {
      await assert.rejects(
        () => pool.query("update ftw.decision_gate set decision = 'merge' where gate_token = 'tokCHK00001'"),
        /decision_gate_decision_vocab_chk|check constraint/i,
        "the DB must reject decision='merge' — the gate vocabulary is proceed/hold/stop only",
      );
    } finally { await pool.end(); }
  } finally { await store.end(); }
});
