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

// ---------------------------------------------------------------------------
// F-MED-DB-CODEX-PROVIDER-CHECK-NOT-PER-PRINCIPAL — the 0002 honest per-principal
// binding CHECK (agent_identity_provider_binding_chk), proven on a real DB with
// 0001 THEN 0002 applied. A raw owner Pool is used so we exercise the CHECK
// directly (CHECK constraints apply to the table owner too).
// ---------------------------------------------------------------------------

async function rawPool() {
  await resetAndMigrate();
  const pgModule = await import('pg');
  const { Pool } = pgModule.default ?? pgModule;
  return new Pool({ connectionString: DB });
}

const VALID_PAIRS = [
  ['larry', 'anthropic-claude-code'],
  ['gpt_codex', 'openai-codex'],
  ['warwick', 'human'],
  ['tower', 'fusion-tower'],
];

test('15. binding — every VALID per-principal pair inserts successfully', { skip: !DB }, async () => {
  const pool = await rawPool();
  try {
    // Clear the seed (which already holds the four honest pairs) then re-insert
    // each valid pair one at a time, proving each passes the binding CHECK.
    await pool.query('delete from ftw.agent_identity');
    for (const [principal, provider] of VALID_PAIRS) {
      await pool.query(
        'insert into ftw.agent_identity (principal, display_label, provider) values ($1, $2, $3)',
        [principal, `${principal} label`, provider],
      );
    }
    const { rows } = await pool.query('select count(*)::int as n from ftw.agent_identity');
    assert.equal(rows[0].n, 4, 'all four honest pairs inserted');
  } finally { await pool.end(); }
});

test('16. binding — every CROSS pair is REJECTED (no principal may hold another\'s provider)', { skip: !DB }, async () => {
  const pool = await rawPool();
  try {
    const CROSS = [
      ['gpt_codex', 'anthropic-claude-code'], // codex wearing larry's provider
      ['larry', 'openai-codex'],              // larry wearing codex's provider
      ['tower', 'human'],                     // tower wearing warwick's provider
      ['warwick', 'fusion-tower'],            // warwick wearing tower's provider
      ['larry', 'human'],
      ['gpt_codex', 'fusion-tower'],
    ];
    for (const [principal, provider] of CROSS) {
      await pool.query('delete from ftw.agent_identity where principal = $1', [principal]);
      await assert.rejects(
        () => pool.query(
          'insert into ftw.agent_identity (principal, display_label, provider) values ($1, $2, $3)',
          [principal, 'x', provider],
        ),
        /agent_identity_provider_binding_chk|check constraint/i,
        `cross pair ${principal}/${provider} must be rejected`,
      );
    }
  } finally { await pool.end(); }
});

test('17. binding — an INVALID provider value is rejected', { skip: !DB }, async () => {
  const pool = await rawPool();
  try {
    for (const bad of ['xai-grok', 'nonsense']) {
      await pool.query('delete from ftw.agent_identity where principal = $1', ['larry']);
      await assert.rejects(
        () => pool.query(
          'insert into ftw.agent_identity (principal, display_label, provider) values ($1, $2, $3)',
          ['larry', 'x', bad],
        ),
        /agent_identity_provider_binding_chk|check constraint/i,
        `invalid provider ${bad} must be rejected`,
      );
    }
  } finally { await pool.end(); }
});

test('18. binding — an UPDATE that drifts an identity to a dishonest provider is rejected', { skip: !DB }, async () => {
  const pool = await rawPool();
  try {
    // Seed rows already exist and are honest. Try to drift larry off its honest
    // provider onto codex's (and onto human) — both must be refused by the CHECK.
    for (const bad of ['openai-codex', 'human', 'xai-grok']) {
      await assert.rejects(
        () => pool.query('update ftw.agent_identity set provider = $1 where principal = $2', [bad, 'larry']),
        /agent_identity_provider_binding_chk|check constraint/i,
        `drift of larry -> ${bad} must be rejected`,
      );
    }
    // The honest value is still there and unchanged.
    const { rows } = await pool.query("select provider from ftw.agent_identity where principal = 'larry'");
    assert.equal(rows[0].provider, 'anthropic-claude-code', 'larry stays honestly bound');
  } finally { await pool.end(); }
});

test('19. RLS regression — after 0002, RLS still enabled on all four tables; anon denied, service_role permitted', { skip: !DB }, async () => {
  const pool = await rawPool();
  try {
    // RLS flag is still set on every ftw table (0002 did not touch it).
    const rls = await pool.query(
      `select c.relname, c.relrowsecurity
         from pg_class c join pg_namespace n on n.oid = c.relnamespace
        where n.nspname = 'ftw'
          and c.relname in ('agent_identity','governance_run','run_turn','run_event')
        order by c.relname`,
    );
    assert.equal(rls.rows.length, 4);
    for (const r of rls.rows) {
      assert.equal(r.relrowsecurity, true, `RLS must stay enabled on ftw.${r.relname}`);
    }
    // Default-deny still holds: anon refused, service_role permitted, per table.
    const client = await pool.connect();
    try {
      for (const t of ['agent_identity', 'governance_run', 'run_turn', 'run_event']) {
        await client.query('set role anon');
        await assert.rejects(
          () => client.query(`select count(*) from ftw.${t}`),
          /permission denied/,
          `anon must stay denied on ftw.${t}`,
        );
        await client.query('reset role');
        await client.query('set role service_role');
        await client.query(`select count(*) from ftw.${t}`); // permitted
        await client.query('reset role');
      }
    } finally { client.release(); }
  } finally { await pool.end(); }
});

// ---------------------------------------------------------------------------
// GPT MEDIUM-1 — the durable external-write outbox (0003), proven on a real DB
// with 0001 THEN 0002 THEN 0003 applied on a clean cluster.
// ---------------------------------------------------------------------------

function claimArgs(over = {}) {
  return {
    mutationKey: 'mk-1',
    targetKind: 'clickup_task',
    targetId: '869e5zu97',
    payloadChecksum: 'sha256:abc',
    mutationId: 'mid-1',
    ...over,
  };
}

test('20. outbox (a) — claimWrite twice with the SAME mutation key: first claims, second returns the existing row', { skip: !DB }, async () => {
  const store = await freshStore();
  try {
    const first = await store.claimWrite(claimArgs(), { now: 1 });
    assert.equal(first.claimed, true);
    assert.equal(first.write.state, 'applying');
    const second = await store.claimWrite(claimArgs(), { now: 2 });
    assert.equal(second.claimed, false, 'second claim on same mutation_key does not re-reserve');
    assert.equal(second.write.write_id, first.write.write_id, 'returns the durable existing row');
  } finally { await store.end(); }
});

test('20. outbox (b) — markWriteApplied REQUIRES response_id; DB CHECK blocks applied_verified without one', { skip: !DB }, async () => {
  const store = await freshStore();
  try {
    await store.claimWrite(claimArgs(), { now: 1 });
    // Store-level guard: empty/missing response id is rejected before any SQL.
    await assert.rejects(() => store.markWriteApplied('mk-1', '', { now: 2 }), /REQUIRED/);
    // A valid response id verifies.
    const ok = await store.markWriteApplied('mk-1', 'clickup-comment-123', { now: 3 });
    assert.equal(ok.state, 'applied_verified');
    assert.equal(ok.response_id, 'clickup-comment-123');

    // DB CHECK is the SECOND, independent gate: a raw UPDATE forcing
    // applied_verified with a NULL response_id must be refused by the constraint.
    const pgModule = await import('pg');
    const { Pool } = pgModule.default ?? pgModule;
    const pool = new Pool({ connectionString: DB });
    try {
      await store.claimWrite(claimArgs({ mutationKey: 'mk-raw', mutationId: 'mid-raw' }), { now: 4 });
      await assert.rejects(
        () => pool.query(
          "update ftw.external_write set state = 'applied_verified' where mutation_key = 'mk-raw'",
        ),
        /external_write_applied_requires_response_chk|check constraint/i,
        'DB CHECK must block applied_verified without a response_id',
      );
    } finally { await pool.end(); }
  } finally { await store.end(); }
});

test('20. outbox (c) — a DISTINCT mutation key to the SAME target_id succeeds (legitimate later review not blocked)', { skip: !DB }, async () => {
  const store = await freshStore();
  try {
    const a = await store.claimWrite(claimArgs(), { now: 1 });
    const b = await store.claimWrite(
      claimArgs({ mutationKey: 'mk-2', mutationId: 'mid-2' }), { now: 2 },
    );
    assert.equal(a.claimed, true);
    assert.equal(b.claimed, true, 'keying on the mutation (not the task) unblocks a later review');
    assert.equal(b.write.target_id, '869e5zu97');
    const rows = await store.getWrite('mk-2');
    assert.equal(rows.target_id, '869e5zu97');
  } finally { await store.end(); }
});

test('20. outbox (d) — RLS deny-by-default on external_write: anon denied, service_role permitted', { skip: !DB }, async () => {
  const store = await freshStore();
  try {
    await store.claimWrite(claimArgs(), { now: 1 }); // owner insert (bypasses RLS)
    const pgModule = await import('pg');
    const { Pool } = pgModule.default ?? pgModule;
    const pool = new Pool({ connectionString: DB });
    try {
      // RLS flag is set on the new table.
      const rls = await pool.query(
        `select c.relrowsecurity from pg_class c
           join pg_namespace n on n.oid = c.relnamespace
          where n.nspname = 'ftw' and c.relname = 'external_write'`,
      );
      assert.equal(rls.rows[0].relrowsecurity, true, 'RLS must be enabled on external_write');
      const client = await pool.connect();
      try {
        await client.query('set role anon');
        await assert.rejects(
          () => client.query('select count(*) from ftw.external_write'),
          /permission denied/,
          'anon must be denied on ftw.external_write',
        );
        await client.query('reset role');
        await client.query('set role service_role');
        const res = await client.query('select count(*)::int as n from ftw.external_write');
        assert.ok(res.rows[0].n >= 1, 'service_role sees rows');
        await client.query('reset role');
      } finally { client.release(); }
    } finally { await pool.end(); }
  } finally { await store.end(); }
});

// ---------------------------------------------------------------------------
// BUILD-010 WP1 — the durable Telegram notification outbox (0004), proven on a
// real DB with 0001 -> 0002 -> 0003 -> 0004 applied on a clean cluster.
// ---------------------------------------------------------------------------

function notifArgs(over = {}) {
  return {
    dedupKey: 'run-1|decision_required|123456789|await-warwick',
    runId: null,
    recipient: '123456789',            // authorised chat id — a pointer, never a token
    logicalSource: 'TOWER',
    purpose: 'decision_required',
    body: 'Decision required on run-1: approve the merge?',
    ...over,
  };
}

test('21. outbox (a) — enqueueNotification twice with the SAME dedup key: first enqueues, second returns existing (no double-send)', { skip: !DB }, async () => {
  const store = await freshStore();
  try {
    const first = await store.enqueueNotification(notifArgs(), { now: 1 });
    assert.equal(first.enqueued, true);
    assert.equal(first.notification.state, 'pending');
    const second = await store.enqueueNotification(notifArgs(), { now: 2 });
    assert.equal(second.enqueued, false, 'duplicate run+event+recipient+purpose does NOT re-enqueue');
    assert.equal(second.notification.notification_id, first.notification.notification_id,
      'returns the durable existing row');
    // Exactly one physical row for the logical event.
    const rows = await store.claimPendingNotifications(50);
    assert.equal(rows.length, 1);
  } finally { await store.end(); }
});

test('22. outbox (b) — markNotificationSent REQUIRES provider_message_id; DB CHECK blocks sent without one', { skip: !DB }, async () => {
  const store = await freshStore();
  try {
    await store.enqueueNotification(notifArgs(), { now: 1 });
    // Store-level guard: empty/missing provider_message_id is rejected before any SQL.
    await assert.rejects(() => store.markNotificationSent(notifArgs().dedupKey, '', { now: 2 }), /REQUIRED/);
    // A valid Telegram message_id marks it sent.
    const ok = await store.markNotificationSent(notifArgs().dedupKey, 'tg-msg-4711', { now: 3 });
    assert.equal(ok.state, 'sent');
    assert.equal(ok.provider_message_id, 'tg-msg-4711');
    assert.ok(ok.sent_at);

    // DB CHECK is the SECOND, independent gate: a raw UPDATE forcing 'sent' with a
    // NULL provider_message_id must be refused by the constraint.
    const pgModule = await import('pg');
    const { Pool } = pgModule.default ?? pgModule;
    const pool = new Pool({ connectionString: DB });
    try {
      await store.enqueueNotification(
        notifArgs({ dedupKey: 'raw-key', purpose: 'ci_red' }), { now: 4 },
      );
      await assert.rejects(
        () => pool.query(
          "update ftw.notification_outbox set state = 'sent' where dedup_key = 'raw-key'",
        ),
        /notification_outbox_sent_requires_provider_chk|check constraint/i,
        'DB CHECK must block sent without a provider_message_id',
      );
    } finally { await pool.end(); }
  } finally { await store.end(); }
});

test('23. outbox (c) — claimPendingNotifications returns ONLY pending (sent/failed/superseded excluded)', { skip: !DB }, async () => {
  const store = await freshStore();
  try {
    await store.enqueueNotification(notifArgs({ dedupKey: 'k-pending', purpose: 'run_created' }), { now: 1 });
    await store.enqueueNotification(notifArgs({ dedupKey: 'k-sent', purpose: 'terminal_ready' }), { now: 2 });
    await store.enqueueNotification(notifArgs({ dedupKey: 'k-failed', purpose: 'ci_red' }), { now: 3 });
    await store.enqueueNotification(notifArgs({ dedupKey: 'k-superseded', purpose: 'decision_required' }), { now: 4 });
    await store.markNotificationSent('k-sent', 'tg-1', { now: 5 });
    await store.markNotificationFailed('k-failed', new Error('bot 502'), { now: 6 });
    await store.markNotificationSuperseded('k-superseded', { now: 7 });

    const pending = await store.claimPendingNotifications(50);
    assert.equal(pending.length, 1, 'only the one pending row is claimable');
    assert.equal(pending[0].dedup_key, 'k-pending');
    // The failed row carries the bumped attempt_count + last_error.
    const failed = await store.getNotification('k-failed');
    assert.equal(failed.state, 'failed');
    assert.equal(failed.attempt_count, 1);
    assert.equal(failed.last_error, 'bot 502');
    const superseded = await store.getNotification('k-superseded');
    assert.equal(superseded.state, 'superseded');
  } finally { await store.end(); }
});

test('24. outbox (d) — RLS deny-by-default on notification_outbox: anon denied, service_role permitted', { skip: !DB }, async () => {
  const store = await freshStore();
  try {
    await store.enqueueNotification(notifArgs(), { now: 1 }); // owner insert (bypasses RLS)
    const pgModule = await import('pg');
    const { Pool } = pgModule.default ?? pgModule;
    const pool = new Pool({ connectionString: DB });
    try {
      // RLS flag is set on the new table.
      const rls = await pool.query(
        `select c.relrowsecurity from pg_class c
           join pg_namespace n on n.oid = c.relnamespace
          where n.nspname = 'ftw' and c.relname = 'notification_outbox'`,
      );
      assert.equal(rls.rows[0].relrowsecurity, true, 'RLS must be enabled on notification_outbox');
      const client = await pool.connect();
      try {
        await client.query('set role anon');
        await assert.rejects(
          () => client.query('select count(*) from ftw.notification_outbox'),
          /permission denied/,
          'anon must be denied on ftw.notification_outbox',
        );
        await client.query('reset role');
        await client.query('set role service_role');
        const res = await client.query('select count(*)::int as n from ftw.notification_outbox');
        assert.ok(res.rows[0].n >= 1, 'service_role sees rows');
        await client.query('reset role');
      } finally { client.release(); }
    } finally { await pool.end(); }
  } finally { await store.end(); }
});

// ---------------------------------------------------------------------------
// BUILD-010 WP1 — durable run control state (0005), proven on a real DB with
// 0001 -> 0002 -> 0003 -> 0004 -> 0005 applied on a clean cluster. These prove the
// /pause /resume /watch /stop state and the /status /trace reads round-trip.
// ---------------------------------------------------------------------------

test('25. control — a fresh run defaults to not paused / milestones / no stop (0005 column defaults)', { skip: !DB }, async () => {
  const store = await freshStore();
  try {
    const run = await seedRun(store);
    assert.equal(run.paused, false);
    assert.equal(run.watch_level, 'milestones');
    assert.equal(run.paused_at, null);
    assert.equal(run.stop_requested, false);
    assert.equal(run.stop_requested_at, null);
  } finally { await store.end(); }
});

test('26. control — setRunPaused / setRunWatchLevel / requestRunStop persist and round-trip', { skip: !DB }, async () => {
  const store = await freshStore();
  try {
    const run = await seedRun(store);
    const paused = await store.setRunPaused(run.run_id, true, { now: 2000 });
    assert.equal(paused.paused, true);
    assert.equal(new Date(paused.paused_at).getTime(), 2000);

    const watched = await store.setRunWatchLevel(run.run_id, 'all', { now: 2100 });
    assert.equal(watched.watch_level, 'all');
    await assert.rejects(() => store.setRunWatchLevel(run.run_id, 'bogus', { now: 2150 }), /invalid watch_level/);

    const stopped = await store.requestRunStop(run.run_id, { now: 2200 });
    assert.equal(stopped.stop_requested, true);
    assert.equal(new Date(stopped.stop_requested_at).getTime(), 2200);
    // Repeated /stop is idempotent on the timestamp.
    const again = await store.requestRunStop(run.run_id, { now: 9999 });
    assert.equal(new Date(again.stop_requested_at).getTime(), 2200);

    // Durable round-trip via a brand-new store (restart-safety of the control state).
    const store2 = await createPostgresStore({ connectionString: DB });
    try {
      const r = await store2.getRun(run.run_id);
      assert.equal(r.paused, true);
      assert.equal(r.watch_level, 'all');
      assert.equal(r.stop_requested, true);
    } finally { await store2.end(); }

    // Resume clears paused_at.
    const resumed = await store.setRunPaused(run.run_id, false, { now: 2300 });
    assert.equal(resumed.paused, false);
    assert.equal(resumed.paused_at, null);
  } finally { await store.end(); }
});

test('27. status — getRunStatus returns the composed shape (run + turn + rounds + evidence + control + last event + last notification)', { skip: !DB }, async () => {
  const store = await freshStore();
  try {
    const run = await seedRun(store, {
      evidencePrRef: 'owner/repo#7', evidenceCommitSha: 'deadbeef', evidenceTaskRef: 'CU-123',
    });
    const turn = await store.appendTurn(run.run_id, { expectedResponder: 'gpt_codex', ordinal: 1 }, { now: 1 });
    await store.setCurrentTurn(run.run_id, turn.turn_id, { now: 2 });
    await store.setRunPaused(run.run_id, true, { now: 3 });
    await store.setRunWatchLevel(run.run_id, 'terminal', { now: 4 });
    await store.ingestEvent(
      { source: 'telegram', sourceEventId: 'u-1', kind: 'command:status', runId: run.run_id }, { now: 10 },
    );
    const dk = `${run.run_id}|run_created|c|x`;
    await store.enqueueNotification({
      dedupKey: dk, runId: run.run_id, recipient: 'c',
      logicalSource: 'TOWER', purpose: 'run_created', body: 'created',
    }, { now: 11 });
    await store.markNotificationSent(dk, 'tg-1', { now: 12 });

    const s = await store.getRunStatus(run.run_id);
    assert.equal(s.run.run_id, run.run_id);
    assert.equal(s.current_turn.expected_responder, 'gpt_codex');
    assert.equal(s.current_turn.state, 'pending');
    assert.deepEqual(s.rounds, { round_count: 0, max_rounds: 2 });
    assert.deepEqual(s.evidence, { pr_ref: 'owner/repo#7', commit_sha: 'deadbeef', task_ref: 'CU-123' });
    assert.equal(s.control.paused, true);
    assert.equal(s.control.watch_level, 'terminal');
    assert.equal(s.control.stop_requested, false);
    assert.equal(s.last_event.kind, 'command:status');
    assert.equal(new Date(s.last_event.received_at).getTime(), 10);
    assert.equal(s.last_notification.state, 'sent');
    assert.ok(s.last_notification.sent_at);

    // Unknown run -> null.
    assert.equal(await store.getRunStatus('00000000-0000-0000-0000-000000000000'), null);
  } finally { await store.end(); }
});

test('28. trace — recentRunEvents returns the latest N for the run, newest first, bounded', { skip: !DB }, async () => {
  const store = await freshStore();
  try {
    const run = await seedRun(store);
    for (let i = 1; i <= 5; i += 1) {
      // eslint-disable-next-line no-await-in-loop
      await store.ingestEvent(
        { source: 'telegram', sourceEventId: `u-${i}`, kind: `command:c${i}`, runId: run.run_id },
        { now: i * 10 },
      );
    }
    const recent = await store.recentRunEvents(run.run_id, 3);
    assert.equal(recent.length, 3, 'bounded to the requested limit');
    assert.deepEqual(recent.map((e) => e.kind), ['command:c5', 'command:c4', 'command:c3'],
      'newest first');
    assert.ok(recent.every((e) => e.run_id === run.run_id), 'only this run\'s events');
    const all = await store.recentRunEvents(run.run_id);
    assert.equal(all.length, 5, 'default limit 10 returns all five');
  } finally { await store.end(); }
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
