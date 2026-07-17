// Fusion Tower — BUILD-010 WP0: ClickUp post-review WRITE-PATH controls, now on the
// DURABLE external-write outbox (GPT MEDIUM-1).
//
// Proves the hard controls on the Tower's single bounded ClickUp write against a
// FAKE ClickUp client + a durable store — NO live call, NO token, ever:
//   1. TARGET VALIDATION — only task 869e5zu97 is writable; any other id refused.
//   2. DURABLE IDEMPOTENCY — claim-before-post keyed on the per-MUTATION key:
//      (a) same mutation twice        → exactly ONE remote write
//      (b) NEW poster/process instance → no duplicate (durable applied_verified seen)
//      (c) distinct later review       → allowed (a second write happens)
//      (d) timeout AFTER remote commit → reconciler finds the mutation_id, NO dup
//      (e) missing comment id          → NEVER applied_verified (stays unknown/retry)
//      (f) concurrent duplicate posts  → exactly one claim wins, one write
//   3. SELF-MARKER + SELF-LOOP PREVENTION — the posted body embeds TOWER_SELF_MARKER
//      (plus the ftw:mut marker); ingesting it does NOT advance a run.
//   4. REDACTION — a secret-shaped body is refused; nothing is posted.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  createClickupReviewPoster,
  computeMutationIdentity,
  mutationMarker,
  assertAuthorisedTarget,
  assertNoSecret,
  scanForSecrets,
  ALLOWED_CLICKUP_TASK_ID,
} from '../src/adapters/clickupPoster.js';
import { TOWER_SELF_MARKER, normalizeClickupEvent } from '../src/adapters/eventIntake.js';
import { createMemoryStore } from '../src/store/memoryStore.js';
import { createDispatcher } from '../src/dispatcher.js';
import { loadConfig } from '../src/config.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DB = process.env.DATABASE_URL;
const MIGRATIONS_DIR = path.join(__dirname, '..', 'migrations');
const MIGRATIONS = [
  '0001_wp0_control_plane.sql',
  '0002_wp0_identity_provider_binding.sql',
  '0003_wp0_external_write_outbox.sql',
];

// A fake ClickUp client + read client. createTaskComment records each call and (by
// default) "commits" the comment to an in-memory `remote` list keyed by a real id;
// getTaskComments returns that list so the reconciler can search it. `onCreate`
// overrides the create behaviour per test (timeout-after-commit, missing id, ...).
function fakeClickup({ onCreate } = {}) {
  const calls = [];
  const remote = [];
  let seq = 0;
  const next = () => `cmt_${++seq}`;
  return {
    calls,
    remote,
    async createTaskComment(taskId, body) {
      calls.push({ taskId, body });
      if (onCreate) return onCreate({ taskId, body, calls, remote, next });
      const id = next();
      remote.push({ id, comment_text: body });
      return { id };
    },
    async getTaskComments() {
      return remote.map((c) => ({ ...c }));
    },
  };
}

const GOOD_BODY = [
  '# Fusion Tower — Codex re-review (round 2)',
  'Reviewed head 9fda8fd. Verdict: approve. Previous MEDIUM closed. New findings: 0.',
  TOWER_SELF_MARKER,
].join('\n');

const CTX = { runId: 'run-1', turnId: 'turn-1' };

// ── 1. TARGET VALIDATION ──────────────────────────────────────────────────────

test('target validation — the authorised target is exactly 869e5zu97', () => {
  assert.equal(ALLOWED_CLICKUP_TASK_ID, '869e5zu97');
  assert.doesNotThrow(() => assertAuthorisedTarget('869e5zu97'));
});

test('target validation — ANY other target id is REJECTED (substitution refused)', async () => {
  const client = fakeClickup();
  const store = createMemoryStore();
  const poster = createClickupReviewPoster({ client, store });
  for (const bad of ['999zzz00', '869e5zu98', '', null, undefined, '  869e5zu97 ']) {
    await assert.rejects(
      () => poster.postReview({ taskId: bad, body: GOOD_BODY, ...CTX }),
      /TARGET REJECTED|not the authorised control task/,
      `target "${bad}" must be refused`,
    );
  }
  assert.equal(client.calls.length, 0, 'no live comment call for a rejected target');
});

// ── mutation identity (the key formula) ───────────────────────────────────────

test('mutation key identifies the MUTATION (run+turn+target+payload checksum), not the task', () => {
  const a = computeMutationIdentity({ runId: 'r', turnId: 't', targetId: '869e5zu97', body: GOOD_BODY });
  const b = computeMutationIdentity({ runId: 'r', turnId: 't', targetId: '869e5zu97', body: GOOD_BODY });
  const c = computeMutationIdentity({ runId: 'r', turnId: 't', targetId: '869e5zu97', body: GOOD_BODY + '\nextra' });
  const d = computeMutationIdentity({ runId: 'r', turnId: 'OTHER', targetId: '869e5zu97', body: GOOD_BODY });
  assert.equal(a.mutationKey, b.mutationKey, 'same inputs → same key (deterministic, stable)');
  assert.notEqual(a.mutationKey, c.mutationKey, 'a different payload → a different mutation');
  assert.notEqual(a.mutationKey, d.mutationKey, 'a different turn → a different mutation');
  assert.equal(a.payloadChecksum.startsWith('sha256:'), true);
  assert.equal(a.mutationId, a.mutationKey.slice(0, 16), 'mutation id is the first 16 hex of the key');
  assert.ok(a.finalBody.includes(TOWER_SELF_MARKER), 'final body keeps the self-marker');
  assert.ok(a.finalBody.includes(mutationMarker(a.mutationId)), 'final body embeds the ftw:mut marker next to the self-marker');
  assert.ok(a.finalBody.includes(`${TOWER_SELF_MARKER}${mutationMarker(a.mutationId)}`), 'mut marker sits immediately after the self-marker');
});

// ── 2. DURABLE IDEMPOTENCY (the six required outcomes) ────────────────────────

test('(a) same-mutation — posting the SAME mutation twice performs exactly ONE remote write', async () => {
  const client = fakeClickup();
  const store = createMemoryStore();
  const poster = createClickupReviewPoster({ client, store, readClient: client });

  const first = await poster.postReview({ taskId: ALLOWED_CLICKUP_TASK_ID, body: GOOD_BODY, ...CTX });
  assert.equal(first.posted, true);
  assert.equal(first.state, 'applied_verified');
  assert.ok(first.commentId, 'first post returns a real comment id');

  const second = await poster.postReview({ taskId: ALLOWED_CLICKUP_TASK_ID, body: GOOD_BODY, ...CTX });
  assert.equal(second.posted, false, 'second attempt is a durable no-op');
  assert.equal(second.state, 'applied_verified');
  assert.equal(second.commentId, first.commentId, 'returns the prior comment id, not a new one');
  assert.match(second.reason, /already applied_verified/);

  assert.equal(client.calls.length, 1, 'exactly ONE live createTaskComment across two postReview calls');
});

test('(b) new-process — a FRESH poster over the SAME durable store does NOT duplicate', async () => {
  const store = createMemoryStore(); // the durable substrate that survives a "restart"
  const client1 = fakeClickup();
  const poster1 = createClickupReviewPoster({ client: client1, store, readClient: client1 });
  const first = await poster1.postReview({ taskId: ALLOWED_CLICKUP_TASK_ID, body: GOOD_BODY, ...CTX });
  assert.equal(first.posted, true);

  // Simulate a process restart: a brand-new poster object + a brand-new client,
  // but the SAME durable store (the outbox row persists).
  const client2 = fakeClickup();
  const poster2 = createClickupReviewPoster({ client: client2, store, readClient: client2 });
  const second = await poster2.postReview({ taskId: ALLOWED_CLICKUP_TASK_ID, body: GOOD_BODY, ...CTX });

  assert.equal(second.posted, false, 'the durable applied_verified row is seen by the new process');
  assert.equal(second.commentId, first.commentId);
  assert.equal(client2.calls.length, 0, 'the new process performs NO remote write (no duplicate)');
});

test('(c) distinct-review — a DIFFERENT review (distinct mutation key) to the SAME task is allowed', async () => {
  const client = fakeClickup();
  const store = createMemoryStore();
  const poster = createClickupReviewPoster({ client, store, readClient: client });

  const reviewA = GOOD_BODY;
  const reviewB = [
    '# Fusion Tower — Codex re-review (round 3)',
    'Reviewed head deadbee. Verdict: approve. New findings: 0.',
    TOWER_SELF_MARKER,
  ].join('\n');

  const a = await poster.postReview({ taskId: ALLOWED_CLICKUP_TASK_ID, body: reviewA, ...CTX });
  const b = await poster.postReview({ taskId: ALLOWED_CLICKUP_TASK_ID, body: reviewB, ...CTX });

  assert.equal(a.posted, true);
  assert.equal(b.posted, true, 'a genuinely distinct later review is NOT blocked');
  assert.notEqual(a.mutationKey, b.mutationKey, 'distinct reviews → distinct mutation keys');
  assert.notEqual(a.commentId, b.commentId);
  assert.equal(client.calls.length, 2, 'two distinct reviews → two writes');
});

test('(d) timeout-reconcile — a timeout AFTER the remote commit is reconciled by mutation_id (NO duplicate)', async () => {
  // The create "commits" the comment remotely, then throws a network timeout — the
  // classic lost-response case. The reconciler must find the embedded mutation_id
  // and mark the write applied WITHOUT re-posting.
  const client = fakeClickup({
    onCreate: ({ body, remote, next }) => {
      const id = next();
      remote.push({ id, comment_text: body }); // it DID commit remotely
      throw Object.assign(new Error('socket hang up (ETIMEDOUT)'), { code: 'ETIMEDOUT' });
    },
  });
  const store = createMemoryStore();
  const poster = createClickupReviewPoster({ client, store, readClient: client });

  const res = await poster.postReview({ taskId: ALLOWED_CLICKUP_TASK_ID, body: GOOD_BODY, ...CTX });
  assert.equal(res.posted, false, 'not counted as a fresh post — it was reconciled');
  assert.equal(res.state, 'applied_verified', 'reconciled to applied_verified (the comment does exist)');
  assert.ok(res.commentId, 'the reconciler recovered the real comment id from the target');
  assert.match(res.reason, /reconciled|NO duplicate/);
  assert.equal(client.calls.length, 1, 'exactly ONE createTaskComment — the reconciler did NOT re-post');
  assert.equal((await store.getWrite(res.mutationKey)).response_id, res.commentId);
});

test('(e) missing-id — a response WITHOUT a comment id NEVER reaches applied_verified', async () => {
  // The create returns no id and commits nothing findable. It must not be recorded
  // as a success; the row stays outcome_unknown/retry_pending for the reconciler.
  const client = fakeClickup({ onCreate: () => ({}) }); // no id, nothing committed
  const store = createMemoryStore();
  const poster = createClickupReviewPoster({ client, store, readClient: client });

  const res = await poster.postReview({ taskId: ALLOWED_CLICKUP_TASK_ID, body: GOOD_BODY, ...CTX });
  assert.equal(res.posted, false, 'a no-comment-id response is not a success');
  assert.notEqual(res.state, 'applied_verified', 'MUST NOT reach applied_verified without a comment id');
  assert.ok(['outcome_unknown', 'retry_pending'].includes(res.state), `stays outcome_unknown/retry (got ${res.state})`);
  const w = await store.getWrite(res.mutationKey);
  assert.equal(w.response_id, null, 'no response id is ever recorded');
  // The store-level guard also refuses to verify without a comment id.
  await assert.rejects(() => store.markWriteApplied(res.mutationKey, ''), /REQUIRED/);
});

test('(f) concurrent — two duplicate attempts race: exactly ONE claim wins, ONE write', async () => {
  const client = fakeClickup();
  const store = createMemoryStore();
  const poster = createClickupReviewPoster({ client, store, readClient: client });

  const [r1, r2] = await Promise.all([
    poster.postReview({ taskId: ALLOWED_CLICKUP_TASK_ID, body: GOOD_BODY, ...CTX }),
    poster.postReview({ taskId: ALLOWED_CLICKUP_TASK_ID, body: GOOD_BODY, ...CTX }),
  ]);

  const posted = [r1, r2].filter((r) => r.posted === true);
  const noops = [r1, r2].filter((r) => r.posted === false);
  assert.equal(posted.length, 1, 'exactly one attempt performed the write');
  assert.equal(noops.length, 1, 'the losing attempt is a guarded no-op');
  assert.equal(client.calls.length, 1, 'exactly ONE live createTaskComment under the race');
});

// ── 3. SELF-MARKER + SELF-LOOP PREVENTION ────────────────────────────────────

test('self-marker — the posted body embeds TOWER_SELF_MARKER (and the ftw:mut marker)', async () => {
  const client = fakeClickup();
  const store = createMemoryStore();
  const poster = createClickupReviewPoster({ client, store, readClient: client });
  const res = await poster.postReview({ taskId: ALLOWED_CLICKUP_TASK_ID, body: GOOD_BODY, ...CTX });
  assert.ok(client.calls[0].body.includes(TOWER_SELF_MARKER), 'posted body carries the self-marker');
  assert.ok(client.calls[0].body.includes(mutationMarker(res.mutationId)), 'posted body carries the ftw:mut marker');
});

test('self-marker — a body WITHOUT the marker is refused (would risk a self-loop)', async () => {
  const client = fakeClickup();
  const store = createMemoryStore();
  const poster = createClickupReviewPoster({ client, store });
  await assert.rejects(
    () => poster.postReview({ taskId: ALLOWED_CLICKUP_TASK_ID, body: 'no marker here', ...CTX }),
    /missing the Tower self-marker/,
  );
  assert.equal(client.calls.length, 0);
});

test('self-loop prevention — ingesting the Tower\'s OWN posted comment does NOT advance a run', async () => {
  const client = fakeClickup();
  const store = createMemoryStore();
  const poster = createClickupReviewPoster({ client, store, readClient: client });
  const posted = await poster.postReview({ taskId: ALLOWED_CLICKUP_TASK_ID, body: GOOD_BODY, ...CTX });
  assert.equal(posted.posted, true);
  const selfBody = client.calls[0].body;

  const runStore = createMemoryStore();
  const config = loadConfig({});
  const dispatcher = createDispatcher({ store: runStore, config, adapters: {} });
  const run = await dispatcher.createRun({ title: 'x', scope: 'x', maxRounds: 2 });

  const selfEvent = normalizeClickupEvent({
    webhook_id: 'wh1', event_id: 'ev-self',
    task_id: ALLOWED_CLICKUP_TASK_ID,
    event: 'taskCommentPosted',
    comment: { text: selfBody },
    task: { status: { status: 'in review' } },
  });
  assert.equal(selfEvent.selfGenerated, true, 'self-marker → event flagged self_generated');
  await dispatcher.ingestAndBind(selfEvent, { runId: run.run_id });
  const claimedSelf = await dispatcher.consumeNextEvent(run.run_id);
  assert.equal(claimedSelf, null, 'the Tower\'s own comment must not advance the run');

  const humanEvent = normalizeClickupEvent({
    webhook_id: 'wh1', event_id: 'ev-human',
    task_id: ALLOWED_CLICKUP_TASK_ID,
    event: 'taskCommentPosted',
    comment: { text: 'Larry: looks good, please proceed.' },
    task: { status: { status: 'in review' } },
  });
  assert.equal(humanEvent.selfGenerated, false);
  await dispatcher.ingestAndBind(humanEvent, { runId: run.run_id });
  const claimedHuman = await dispatcher.consumeNextEvent(run.run_id);
  assert.ok(claimedHuman, 'a genuine external comment still advances the run');
  assert.equal(claimedHuman.payload.task_id, ALLOWED_CLICKUP_TASK_ID);
});

// ── 4. REDACTION ──────────────────────────────────────────────────────────────

test('redaction — scanForSecrets flags secret-shaped strings by NAME only', () => {
  assert.equal(scanForSecrets('clean body ' + TOWER_SELF_MARKER).clean, true);
  assert.equal(scanForSecrets('token sk-ABCDEFGHIJKLMNOPQRSTUV').clean, false);
  assert.deepEqual(scanForSecrets('ghp_ABCDEFGHIJKLMNOPQRSTUVWXYZ012345').hits, ['github-token']);
  assert.equal(scanForSecrets('pk_12345678_ABCDEFGHIJKLMNOPQRSTUVWX').clean, false);
  assert.equal(scanForSecrets('postgres://user:hunter2@host:5432/db').clean, false);
});

test('redaction — a body carrying a secret is REFUSED (nothing posted, nothing claimed)', async () => {
  const client = fakeClickup();
  const store = createMemoryStore();
  const poster = createClickupReviewPoster({ client, store });
  const leaky = GOOD_BODY + '\nDATABASE_URL=postgres://u:supersecretpw@db.example:5432/ftw';
  await assert.rejects(
    () => poster.postReview({ taskId: ALLOWED_CLICKUP_TASK_ID, body: leaky, ...CTX }),
    /redaction guard|secret-shaped/,
  );
  assert.equal(client.calls.length, 0, 'a leaky body never reaches the client');
  const id = computeMutationIdentity({ ...CTX, targetId: ALLOWED_CLICKUP_TASK_ID, body: leaky });
  assert.equal(await store.getWrite(id.mutationKey), null, 'a leaky body is never even claimed durably');
  assert.doesNotThrow(() => assertNoSecret(GOOD_BODY));
});

// ── REAL-POSTGRES coverage (DB-gated) — the durability-critical outcomes ───────
// Runs only with DATABASE_URL set (throwaway cluster, chain 0001→0002→0003).

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

test('PG (a) same-mutation — durable store performs exactly ONE remote write', { skip: !DB }, async () => {
  await resetAndMigrate();
  const { createPostgresStore } = await import('../src/store/postgresStore.js');
  const store = await createPostgresStore({ connectionString: DB });
  try {
    // run_id on the outbox row is a real UUID FK → create a genuine run.
    const run = await store.createRun({ title: 'poster (a)', scope: 's', maxRounds: 1 });
    const ctx = { runId: run.run_id, turnId: null };
    const client = fakeClickup();
    const poster = createClickupReviewPoster({ client, store, readClient: client });
    const first = await poster.postReview({ taskId: ALLOWED_CLICKUP_TASK_ID, body: GOOD_BODY, ...ctx });
    const second = await poster.postReview({ taskId: ALLOWED_CLICKUP_TASK_ID, body: GOOD_BODY, ...ctx });
    assert.equal(first.posted, true);
    assert.equal(first.state, 'applied_verified');
    assert.equal(second.posted, false);
    assert.equal(second.commentId, first.commentId);
    assert.equal(client.calls.length, 1, 'durable Postgres claim → exactly one write');
  } finally { await store.end(); }
});

test('PG (b) restart — a NEW store instance over the SAME Postgres row does NOT duplicate', { skip: !DB }, async () => {
  await resetAndMigrate();
  const { createPostgresStore } = await import('../src/store/postgresStore.js');
  const store1 = await createPostgresStore({ connectionString: DB });
  let firstCommentId;
  let runId;
  try {
    const run = await store1.createRun({ title: 'poster (b)', scope: 's', maxRounds: 1 });
    runId = run.run_id;
    const client1 = fakeClickup();
    const poster1 = createClickupReviewPoster({ client: client1, store: store1, readClient: client1 });
    const first = await poster1.postReview({ taskId: ALLOWED_CLICKUP_TASK_ID, body: GOOD_BODY, runId, turnId: null });
    firstCommentId = first.commentId;
    assert.equal(first.posted, true);
  } finally { await store1.end(); }

  // Genuine restart: a brand-new pool/store over the same durable rows.
  const store2 = await createPostgresStore({ connectionString: DB });
  try {
    const client2 = fakeClickup();
    const poster2 = createClickupReviewPoster({ client: client2, store: store2, readClient: client2 });
    const second = await poster2.postReview({ taskId: ALLOWED_CLICKUP_TASK_ID, body: GOOD_BODY, runId, turnId: null });
    assert.equal(second.posted, false, 'the durable applied_verified row survives the restart');
    assert.equal(second.commentId, firstCommentId);
    assert.equal(client2.calls.length, 0, 'the restarted process performs NO duplicate write');
  } finally { await store2.end(); }
});

test('PG (d) timeout-reconcile — durable outcome_unknown reconciled by mutation_id, NO duplicate', { skip: !DB }, async () => {
  await resetAndMigrate();
  const { createPostgresStore } = await import('../src/store/postgresStore.js');
  const store = await createPostgresStore({ connectionString: DB });
  try {
    const run = await store.createRun({ title: 'poster (d)', scope: 's', maxRounds: 1 });
    const ctx = { runId: run.run_id, turnId: null };
    const client = fakeClickup({
      onCreate: ({ body, remote, next }) => {
        const id = next();
        remote.push({ id, comment_text: body });
        throw Object.assign(new Error('ETIMEDOUT'), { code: 'ETIMEDOUT' });
      },
    });
    const poster = createClickupReviewPoster({ client, store, readClient: client });
    const res = await poster.postReview({ taskId: ALLOWED_CLICKUP_TASK_ID, body: GOOD_BODY, ...ctx });
    assert.equal(res.state, 'applied_verified', 'reconciled to applied_verified on the real DB');
    assert.ok(res.commentId);
    assert.equal(client.calls.length, 1, 'the reconciler did not re-post');
    const w = await store.getWrite(res.mutationKey);
    assert.equal(w.response_id, res.commentId);
  } finally { await store.end(); }
});
