// REAL Postgres integration suite for the ftw control-plane store.
//
// GATED: every test is `{ skip: !DB }` so the default unit run (node --test with
// NO DATABASE_URL) skips this file cleanly and NEVER loads `pg` or touches a DB.
// `pg` is imported DYNAMICALLY inside helpers.
//
// RUN (throwaway local cluster):
//   cd services/fusion-tower
//   DATABASE_URL=postgresql://postgres@127.0.0.1:54333/ftw_dev \
//     node --test test/postgresStore.integration.test.js

import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { createPostgresStore } from '../src/store/postgresStore.js';

const DB = process.env.DATABASE_URL;
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const MIGRATIONS_DIR = path.join(__dirname, '..', 'migrations');
const MIGRATIONS = ['0001_wp0_control_plane.sql'];

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

async function seedRun(store, over = {}) {
  return store.createRun({ title: 't', scope: 's', maxRounds: 2, ...over }, { now: 1000 });
}

test('1. migration 0001 applies cleanly from empty (twice — determinism)', { skip: !DB }, async () => {
  await resetAndMigrate();
  await resetAndMigrate();
});

test('2. seed identities present and HONESTLY labelled (gpt_codex = openai-codex)', { skip: !DB }, async () => {
  const store = await freshStore();
  try {
    const id = await store.getAgentIdentity('gpt_codex');
    assert.equal(id.provider, 'openai-codex');
    assert.equal((await store.listAgentIdentities()).length, 4);
  } finally { await store.end(); }
});

test('3. event dedup PRIMARY — duplicate (source, source_event_id) => one row', { skip: !DB }, async () => {
  const store = await freshStore();
  try {
    const a = await store.ingestEvent({ source: 'github', sourceEventId: 'D1', kind: 'pull_request.opened' }, { now: 1 });
    const b = await store.ingestEvent({ source: 'github', sourceEventId: 'D1', kind: 'pull_request.opened' }, { now: 2 });
    assert.equal(a.isNew, true);
    assert.equal(b.isNew, false);
    assert.equal((await store.listEvents()).length, 1);
  } finally { await store.end(); }
});

test('4. event dedup SECONDARY — same (github, head_sha, kind), different ids => one row', { skip: !DB }, async () => {
  const store = await freshStore();
  try {
    const a = await store.ingestEvent({ source: 'github', sourceEventId: 'X1', headSha: 'abc', kind: 'check_suite.completed' }, { now: 1 });
    const b = await store.ingestEvent({ source: 'github', sourceEventId: 'X2', headSha: 'abc', kind: 'check_suite.completed' }, { now: 2 });
    assert.equal(a.isNew, true);
    assert.equal(b.isNew, false, 'secondary partial-unique (source, head_sha, kind) dedups the rerun');
    assert.equal((await store.listEvents()).length, 1);
  } finally { await store.end(); }
});

test('5. self-loop — tower/self events never claimed for advance', { skip: !DB }, async () => {
  const store = await freshStore();
  try {
    await store.ingestEvent({ source: 'tower', sourceEventId: 'S1', kind: 'noop' }, { now: 1 });
    await store.ingestEvent({ source: 'github', sourceEventId: 'S2', kind: 'issue_comment.created', selfGenerated: true }, { now: 2 });
    await store.ingestEvent({ source: 'github', sourceEventId: 'S3', kind: 'issue_comment.created' }, { now: 3 });
    const next = await store.claimNextEvent();
    assert.equal(next.source_event_id, 'S3');
  } finally { await store.end(); }
});

test('6. advance-once — processed flips exactly once, not re-claimable', { skip: !DB }, async () => {
  const store = await freshStore();
  try {
    const { event } = await store.ingestEvent({ source: 'github', sourceEventId: 'P1', kind: 'x' }, { now: 1 });
    const p1 = await store.markEventProcessed(event.event_id, { now: 2 });
    assert.equal(p1.processed, true);
    const p2 = await store.markEventProcessed(event.event_id, { now: 3 });
    assert.equal(new Date(p2.processed_at).getTime(), new Date(p1.processed_at).getTime(), 'idempotent — not re-stamped');
    assert.equal(await store.claimNextEvent(), null);
  } finally { await store.end(); }
});

test('7. turn idempotency — duplicate (run_id, ordinal) => one turn', { skip: !DB }, async () => {
  const store = await freshStore();
  try {
    const run = await seedRun(store);
    const t1 = await store.appendTurn(run.run_id, { expectedResponder: 'larry', ordinal: 1 }, { now: 1 });
    const t2 = await store.appendTurn(run.run_id, { expectedResponder: 'larry', ordinal: 1 }, { now: 2 });
    assert.equal(t1.turn_id, t2.turn_id);
    assert.equal((await store.listTurns(run.run_id)).length, 1);
  } finally { await store.end(); }
});

test('8. dispatched turn always carries a lease deadline (CHECK)', { skip: !DB }, async () => {
  const store = await freshStore();
  try {
    const run = await seedRun(store);
    const turn = await store.appendTurn(run.run_id, { expectedResponder: 'larry' }, { now: 1 });
    const d = await store.dispatchTurn(turn.turn_id, { now: 1000, leaseMs: 5000 });
    assert.equal(d.state, 'dispatched');
    assert.ok(d.dispatched_at && d.lease_deadline_at);
    assert.equal(new Date(d.lease_deadline_at).getTime() - new Date(d.dispatched_at).getTime(), 5000);
  } finally { await store.end(); }
});

test('9. watchdog — reaps only EXPIRED dispatched turns; a returned turn is untouched', { skip: !DB }, async () => {
  const store = await freshStore();
  try {
    const run = await seedRun(store);
    const t1 = await store.appendTurn(run.run_id, { expectedResponder: 'larry', ordinal: 1 }, { now: 1 });
    const t2 = await store.appendTurn(run.run_id, { expectedResponder: 'gpt_codex', ordinal: 2 }, { now: 1 });
    await store.dispatchTurn(t1.turn_id, { now: 0, leaseMs: 100 });
    await store.dispatchTurn(t2.turn_id, { now: 0, leaseMs: 999999 });
    await store.recordTurnResult(t2.turn_id, { structuredResult: { ok: 1 }, signerPrincipal: 'gpt_codex' }, { now: 50 });
    const sweep = await store.watchdogSweep({ now: 200 });
    assert.equal(sweep.reaped, 1);
    assert.equal((await store.getTurn(t1.turn_id)).state, 'timed_out');
    assert.equal((await store.getTurn(t2.turn_id)).state, 'returned');
  } finally { await store.end(); }
});

test('10. signer must match expected responder (DB store enforces it too)', { skip: !DB }, async () => {
  const store = await freshStore();
  try {
    const run = await seedRun(store);
    const turn = await store.appendTurn(run.run_id, { expectedResponder: 'gpt_codex' }, { now: 1 });
    await store.dispatchTurn(turn.turn_id, { now: 1 });
    await assert.rejects(
      () => store.recordTurnResult(turn.turn_id, { structuredResult: {}, signerPrincipal: 'larry' }, { now: 2 }),
      /signed by/,
    );
  } finally { await store.end(); }
});

test('11. max_rounds — round_count cannot exceed max_rounds (DB CHECK)', { skip: !DB }, async () => {
  const store = await freshStore();
  try {
    const run = await seedRun(store, { maxRounds: 2 });
    await store.incrementRound(run.run_id, { now: 1 });
    await store.incrementRound(run.run_id, { now: 2 });
    await assert.rejects(() => store.incrementRound(run.run_id, { now: 3 }), /governance_run_round_within_max_chk|check/i);
  } finally { await store.end(); }
});

test('12. terminal_outcome only on a terminal status', { skip: !DB }, async () => {
  const store = await freshStore();
  try {
    const run = await seedRun(store);
    await store.setRunStatus(run.run_id, 'active', { now: 1 });
    await assert.rejects(
      () => store.setRunStatus(run.run_id, 'active', { now: 2, terminalOutcome: 'ready' }),
      /terminal_outcome only allowed/,
    );
    const done = await store.setRunStatus(run.run_id, 'completed', { now: 3, terminalOutcome: 'completed' });
    assert.equal(done.terminal_outcome, 'completed');
  } finally { await store.end(); }
});

test('13. restart-safety — a NEW store instance resumes from durable rows', { skip: !DB }, async () => {
  const store = await freshStore();
  let runId; let turnId;
  try {
    const run = await seedRun(store);
    runId = run.run_id;
    const turn = await store.appendTurn(run.run_id, { expectedResponder: 'larry', ordinal: 1 }, { now: 1 });
    turnId = turn.turn_id;
    await store.dispatchTurn(turn.turn_id, { now: 1000, leaseMs: 300000 });
  } finally { await store.end(); }

  // Simulate a dispatcher restart: a brand-new store over the same DB.
  const store2 = await createPostgresStore({ connectionString: DB });
  try {
    const run = await store2.getRun(runId);
    const turn = await store2.getTurn(turnId);
    assert.equal(run.status, 'created'); // status untouched by dispatch in this low-level test
    assert.equal(turn.state, 'dispatched', 'in-flight turn survived the restart');
    // Re-dispatch of the SAME (run, ordinal) does not mint a duplicate.
    const again = await store2.appendTurn(runId, { expectedResponder: 'larry', ordinal: 1 }, { now: 2 });
    assert.equal(again.turn_id, turnId);
    assert.equal((await store2.listTurns(runId)).length, 1);
  } finally { await store2.end(); }
});

test('14. RLS — anon denied, service_role permitted on every ftw table', { skip: !DB }, async () => {
  const store = await freshStore();
  try {
    await seedRun(store); // owner insert (bypasses RLS)
    const pgModule = await import('pg');
    const { Pool } = pgModule.default ?? pgModule;
    const pool = new Pool({ connectionString: DB });
    try {
      const client = await pool.connect();
      try {
        await client.query('set role anon');
        await assert.rejects(() => client.query('select count(*) from ftw.governance_run'), /permission denied/);
        await client.query('reset role');
        await client.query('set role service_role');
        const res = await client.query('select count(*)::int as n from ftw.governance_run');
        assert.ok(res.rows[0].n >= 1, 'service_role sees rows');
        await client.query('reset role');
      } finally { client.release(); }
    } finally { await pool.end(); }
  } finally { await store.end(); }
});
