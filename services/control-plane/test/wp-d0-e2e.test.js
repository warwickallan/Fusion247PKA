// BUILD-014 WP-D0 — end-to-end proofs against REAL Postgres for the AUTHORITATIVE CURRENT-HEAD
// hardening: the two coupled head-binding gaps WP-C's e2e HID.
//
// DB-GATED but NOT silently self-skipping (mirrors WP-A/WP-B/WP-C): DATABASE_URL unset -> the
// suite skips with a LOUD pointer at the runner (test/run-wpd0-tests.mjs), which provisions a
// throwaway Postgres and executes these proofs; the runner FAILS on 0 executed subtests.
//
// THE ACCEPTANCE PROOFS (the WP-D0 required fixes + robust-pattern requirements):
//   1. Happy path: ingress ADVANCES ops.build_head to the ingested checkpoint; the policy gate for
//      the CURRENT head reaches 'mergeable'; the authoritative head matches the checkpoint.
//   2. (a) STALE WINDOW CLOSED AT THE EDGE: read the live gate IMMEDIATELY after a moved-head
//      ingress (no evaluate re-run) — the old gate is already superseded and NOTHING reads
//      'mergeable' for the moved head.
//   3. (b) REVIVE REFUSED: an out-of-order evaluatePolicyGate for an OLD head after a newer head is
//      current is REFUSED fail-closed — it does NOT revive the old head nor supersede the current gate.
//   4. (c1) MULTI-CONNECTION: a stale evaluate genuinely BLOCKS on the build-scoped head-authority
//      advisory lock held by another connection, then REFUSES once released (two connections).
//   5. (c2) MULTI-CONNECTION race: a concurrent head-advance (ingress) vs a stale evaluate — no
//      deadlock (no 40P01), the stale evaluate is refused, the head advances, the old head is not revived.
//   6. (d) REDELIVERY / CONVERGENCE: redeliveries + re-ingests of an old/current head are no-ops for
//      the head authority (single build_head row, no backward move, no double-supersede, gate stable).
//   7. STRUCTURAL: build_id PRIMARY KEY => at most ONE authoritative current head per build.
//   8. STRUCTURAL: advance refuses a non-recorded (build, checkpoint, head) fail-closed; the head is
//      canonicalised at the boundary (an UPPER-CASE head is stored full-lower-40-hex).
//   9. REGRESSION FENCE: every ops plpgsql/sql function (incl. the WP-D0 additions) pins search_path.

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { ingestWebhook, githubSignatureHeader } from '../ingress/githubIngress.mjs';
import { createReviewHandler } from '../review/reviewHandler.mjs';
import { evaluatePolicyGate, readLiveGate } from '../gate/policyGate.mjs';
import { makeSignedVerdict } from '../review/envelope.mjs';
import { HandlerRegistry } from '../worker/handlers.mjs';
import { Worker } from '../worker/worker.mjs';
import { createLogger } from '../worker/util.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const MIGRATIONS_DIR = path.join(__dirname, '..', 'db', 'migrations');
const MIGRATIONS = ['001_control_plane_min_schema.sql', '002_current_head_authority.sql']
  .map((f) => path.join(MIGRATIONS_DIR, f));
const DB = process.env.DATABASE_URL;
const SILENT = createLogger({ level: 'silent' });

const TEST_HMAC_KEY = 'wp-d0-test-hmac-key-not-a-real-credential'; // test-only HMAC key, assembled locally
const HEAD_A = 'a'.repeat(40);
const HEAD_B = 'b'.repeat(40);
const HEAD_C = 'c'.repeat(40);
const GH_CLEAN = (head) => ({ mechState: 'clean', headSha: head, reviewDecision: 'APPROVED' });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

let Pool = null;
let pgLoadError = null;
try { ({ Pool } = (await import('pg')).default ?? (await import('pg'))); }
catch (e) { pgLoadError = e; }

if (DB && !Pool) {
  throw new Error(
    `DATABASE_URL is set but the 'pg' driver failed to load — cannot run the WP-D0 proofs. ` +
    `Install pg or use run-wpd0-tests.mjs. Underlying error: ${pgLoadError?.message}`);
}
const skipReason = !DB
  ? 'SKIPPED (no DATABASE_URL). Run: node services/control-plane/test/run-wpd0-tests.mjs — it provisions a throwaway Postgres and executes these proofs. A skip is NOT a pass.'
  : false;
const gated = (name, fn) => test(name, { skip: skipReason }, fn);

async function freshPool() {
  const pool = new Pool({ connectionString: DB, max: 16 });
  await pool.query('drop schema if exists ops cascade');
  for (const m of MIGRATIONS) await pool.query(fs.readFileSync(m, 'utf8'));
  return pool;
}

// ---- webhook builders (mirror wp-c-e2e) --------------------------------------------------
function checkpointEventBody({ buildRef, checkpointRef, headSha, branch = 'main', repo = 'warwick/f247' }) {
  return JSON.stringify({
    repository: { full_name: repo },
    checkpoint: { build_ref: buildRef, checkpoint_ref: checkpointRef, head_sha: headSha, branch, summary: 'wp-d0 test checkpoint' },
  });
}
function headers({ deliveryId, event, body, secret = TEST_HMAC_KEY, signature }) {
  return {
    'x-github-delivery': deliveryId,
    'x-github-event': event,
    'x-hub-signature-256': signature ?? githubSignatureHeader(body, secret),
  };
}
async function postCheckpoint(pool, { buildRef, checkpointRef, headSha, deliveryId, branch = 'main' }) {
  const body = checkpointEventBody({ buildRef, checkpointRef, headSha, branch });
  return ingestWebhook(pool, { headers: headers({ deliveryId, event: 'checkpoint', body }), rawBody: body, secret: TEST_HMAC_KEY });
}

// ---- fake reviewers (the injectable adapter seam) ----------------------------------------
function fakeReviewer({ principal, provider, verdict, reviewedHead = null }) {
  return {
    principal,
    async runTurn({ packet }) {
      const head = reviewedHead ?? packet.head_sha;
      const payload = { status: 'ok', verdict, summary: 'fake review', claims_verified: [], findings: [], proposed_action: { type: 'noop', target: '' } };
      const { envelope, signature } = makeSignedVerdict({ principal, provider, modelId: 'fake', reviewedHead: head, promptFingerprint: null, payload }, null);
      return { ok: true, blocked: false, signerPrincipal: principal, structuredResult: payload, envelope, signature };
    },
  };
}
const codexApprove = () => fakeReviewer({ principal: 'gpt_codex', provider: 'openai-codex', verdict: 'approve' });
const fableApprove = () => fakeReviewer({ principal: 'claude_fable', provider: 'anthropic', verdict: 'approve' });

async function runReviewOnce(pool, workerId = 'wp-d0-w') {
  const reg = new HandlerRegistry().register('review', createReviewHandler({ pool, reviewers: [codexApprove(), fableApprove()], log: SILENT }));
  const worker = new Worker(pool, reg, { workerId, leaseSeconds: 30, logger: SILENT });
  return worker.processOnce('review');
}

/** Ingest a checkpoint, run its review, and make its gate mergeable. Returns the ingress result. */
async function ingestReviewAndApprove(pool, { buildRef, checkpointRef, headSha, deliveryId }) {
  const ing = await postCheckpoint(pool, { buildRef, checkpointRef, headSha, deliveryId });
  await runReviewOnce(pool);
  const g = await evaluatePolicyGate(pool, {
    buildId: ing.buildId, checkpointId: ing.checkpointId, headSha, github: GH_CLEAN(headSha) });
  assert.equal(g.overallActionState, 'mergeable', `gate for ${headSha} should be mergeable in setup`);
  return ing;
}

async function buildHeadRow(pool, buildId) {
  const { rows } = await pool.query(
    `select build_id, current_checkpoint_id, current_head_sha from ops.build_head where build_id = $1`, [buildId]);
  return rows[0] ?? null;
}
async function liveGateAtCheckpoint(pool, checkpointId) {
  const { rows } = await pool.query(
    `select overall_action_state, superseded_at from ops.merge_gate where checkpoint_id = $1`, [checkpointId]);
  return rows[0] ?? null;
}

// ==========================================================================================
gated('1. ingress advances ops.build_head; the gate for the CURRENT head reaches mergeable', async () => {
  const pool = await freshPool();
  try {
    const a = await ingestReviewAndApprove(pool, { buildRef: 'BUILD-D1', checkpointRef: 'cp1', headSha: HEAD_A, deliveryId: 'd1' });
    const bh = await buildHeadRow(pool, a.buildId);
    assert.ok(bh, 'ingress created the authoritative head row');
    assert.equal(bh.current_head_sha, HEAD_A);
    assert.equal(bh.current_checkpoint_id, a.checkpointId, 'authoritative head bound to the ingested checkpoint');
    const live = await readLiveGate(pool, a.buildId);
    assert.equal(live.expected_head_sha, HEAD_A);
    assert.equal(live.overall_action_state, 'mergeable');
  } finally { await pool.end(); }
});

gated('2. (a) stale window CLOSED AT THE EDGE: read live gate immediately after a moved-head ingress', async () => {
  const pool = await freshPool();
  try {
    const a = await ingestReviewAndApprove(pool, { buildRef: 'BUILD-D2', checkpointRef: 'cp1', headSha: HEAD_A, deliveryId: 'd2a' });
    // Sanity: A is mergeable and live.
    assert.equal((await readLiveGate(pool, a.buildId)).overall_action_state, 'mergeable');

    // The head MOVES via ingress ONLY — NO evaluate, NO review. The stale window must already be closed.
    const b = await postCheckpoint(pool, { buildRef: 'BUILD-D2', checkpointRef: 'cp1', headSha: HEAD_B, deliveryId: 'd2b' });
    assert.notEqual(b.checkpointId, a.checkpointId, 'a moved head is a NEW checkpoint');

    // Read the LIVE gate IMMEDIATELY — nothing may read 'mergeable' for the moved head.
    const live = await readLiveGate(pool, a.buildId);
    assert.equal(live, null, 'the old head-A gate was superseded at the ingress edge; no live gate reads mergeable');
    const aGate = await liveGateAtCheckpoint(pool, a.checkpointId);
    assert.ok(aGate.superseded_at != null, 'the head-A gate is superseded');
    assert.equal(aGate.overall_action_state, 'superseded');
    // And the authority already points at B.
    assert.equal((await buildHeadRow(pool, a.buildId)).current_head_sha, HEAD_B);
  } finally { await pool.end(); }
});

gated('3. (b) REVIVE REFUSED: out-of-order evaluate for an OLD head after a newer head is current', async () => {
  const pool = await freshPool();
  try {
    const a = await ingestReviewAndApprove(pool, { buildRef: 'BUILD-D3', checkpointRef: 'cp1', headSha: HEAD_A, deliveryId: 'd3a' });
    const b = await ingestReviewAndApprove(pool, { buildRef: 'BUILD-D3', checkpointRef: 'cp1', headSha: HEAD_B, deliveryId: 'd3b' });
    // Now B is the live, current, mergeable gate; A was superseded when the head advanced.
    assert.equal((await readLiveGate(pool, a.buildId)).expected_head_sha, HEAD_B);

    // OUT-OF-ORDER: a reclaimed/slow stale review-job for head A completes and evaluates head A.
    const stale = await evaluatePolicyGate(pool, {
      buildId: a.buildId, checkpointId: a.checkpointId, headSha: HEAD_A, github: GH_CLEAN(HEAD_A) });
    assert.equal(stale.refused, true, 'evaluating a non-current head is refused fail-closed');
    assert.equal(stale.action, 'refused_non_current_head');
    assert.equal(stale.authoritativeHead, HEAD_B);

    // The stale call revived NOTHING and superseded NOTHING: B is still the single live mergeable gate.
    const live = await readLiveGate(pool, a.buildId);
    assert.equal(live.expected_head_sha, HEAD_B, 'the current gate was NOT superseded by the stale call');
    assert.equal(live.overall_action_state, 'mergeable');
    assert.equal(live.checkpoint_id, b.checkpointId);
    // No live gate at head A exists.
    const liveAtA = await pool.query(
      `select count(*)::int c from ops.merge_gate where checkpoint_id = $1 and superseded_at is null`, [a.checkpointId]);
    assert.equal(liveAtA.rows[0].c, 0, 'head A was NOT revived as a live gate');
  } finally { await pool.end(); }
});

gated('4. (c1) MULTI-CONNECTION: a stale evaluate blocks on the head-authority lock, then refuses', async () => {
  const pool = await freshPool();
  try {
    const a = await ingestReviewAndApprove(pool, { buildRef: 'BUILD-D4', checkpointRef: 'cp1', headSha: HEAD_A, deliveryId: 'd4a' });
    const b = await ingestReviewAndApprove(pool, { buildRef: 'BUILD-D4', checkpointRef: 'cp1', headSha: HEAD_B, deliveryId: 'd4b' });

    // Hold the build-scoped head-authority advisory lock on a SECOND connection.
    const cLock = await pool.connect();
    let staleErr = null;
    try {
      await cLock.query('begin');
      await cLock.query('select pg_advisory_xact_lock(ops.build_head_lock_key($1))', [a.buildId]);

      // A stale evaluate for head A must BLOCK acquiring that same lock (it takes it FIRST).
      let done = false;
      const p = evaluatePolicyGate(pool, {
        buildId: a.buildId, checkpointId: a.checkpointId, headSha: HEAD_A, github: GH_CLEAN(HEAD_A) })
        .then((r) => { done = true; return r; })
        .catch((e) => { staleErr = e; done = true; return null; });
      await sleep(400);
      assert.equal(done, false, 'the stale evaluate blocks behind the head-authority advisory lock (two connections)');

      await cLock.query('commit'); // release the lock
      const r = await p;
      assert.ok(!staleErr, `no deadlock/error: ${staleErr?.code ?? ''}`);
      assert.equal(r.refused, true, 'once it proceeds, the stale head is refused');
    } finally { cLock.release(); }

    // Current gate untouched by the whole race.
    const live = await readLiveGate(pool, a.buildId);
    assert.equal(live.expected_head_sha, HEAD_B);
    assert.equal(live.checkpoint_id, b.checkpointId);
    assert.equal(live.overall_action_state, 'mergeable');
  } finally { await pool.end(); }
});

gated('5. (c2) MULTI-CONNECTION race: concurrent head-advance vs stale evaluate — no deadlock, no revival', async () => {
  const pool = await freshPool();
  try {
    const a = await ingestReviewAndApprove(pool, { buildRef: 'BUILD-D5', checkpointRef: 'cp1', headSha: HEAD_A, deliveryId: 'd5a' });
    await ingestReviewAndApprove(pool, { buildRef: 'BUILD-D5', checkpointRef: 'cp1', headSha: HEAD_B, deliveryId: 'd5b' });

    // Concurrently: (P1) ingress advances the head to C; (P2) a stale evaluate for the OLD head A.
    // They contend on the build-scoped advisory lock and must SERIALISE — never deadlock.
    const [p1, p2] = await Promise.allSettled([
      postCheckpoint(pool, { buildRef: 'BUILD-D5', checkpointRef: 'cp1', headSha: HEAD_C, deliveryId: 'd5c' }),
      evaluatePolicyGate(pool, { buildId: a.buildId, checkpointId: a.checkpointId, headSha: HEAD_A, github: GH_CLEAN(HEAD_A) }),
    ]);
    assert.equal(p1.status, 'fulfilled', `advance must not deadlock (${p1.reason?.code ?? ''})`);
    assert.equal(p2.status, 'fulfilled', `stale evaluate must not deadlock (${p2.reason?.code ?? ''})`);
    assert.notEqual(p1.reason?.code, '40P01');
    assert.notEqual(p2.reason?.code, '40P01');
    // A is never the current head in this window (B -> C), so the stale evaluate is refused regardless of order.
    assert.equal(p2.value.refused, true, 'the stale head A is refused whatever the interleaving');

    // The authority advanced to C; head A was never revived as a live gate.
    assert.equal((await buildHeadRow(pool, a.buildId)).current_head_sha, HEAD_C);
    const liveAtA = await pool.query(
      `select count(*)::int c from ops.merge_gate where checkpoint_id = $1 and superseded_at is null`, [a.checkpointId]);
    assert.equal(liveAtA.rows[0].c, 0, 'head A not revived');
    // At most one live gate for the build (the WP-A partial unique index holds).
    const liveN = await pool.query(
      `select count(*)::int c from ops.merge_gate where build_id = $1 and superseded_at is null`, [a.buildId]);
    assert.ok(liveN.rows[0].c <= 1, 'at most one live gate per build');
  } finally { await pool.end(); }
});

gated('6. (d) REDELIVERY / CONVERGENCE: redeliveries of old/current heads are no-ops for the authority', async () => {
  const pool = await freshPool();
  try {
    const a = await ingestReviewAndApprove(pool, { buildRef: 'BUILD-D6', checkpointRef: 'cp1', headSha: HEAD_A, deliveryId: 'd6a' });
    const b = await ingestReviewAndApprove(pool, { buildRef: 'BUILD-D6', checkpointRef: 'cp1', headSha: HEAD_B, deliveryId: 'd6b' });
    // Live state: gate B mergeable (current); gate A superseded; head authority = B.

    // Redeliver the OLD head A under a NEW delivery id — checkpoint dedups, the head must NOT move back.
    const reA = await postCheckpoint(pool, { buildRef: 'BUILD-D6', checkpointRef: 'cp1', headSha: HEAD_A, deliveryId: 'd6a-again' });
    assert.equal(reA.checkpointId, a.checkpointId, 'same head+ref is the same checkpoint (dedup)');
    assert.equal((await buildHeadRow(pool, a.buildId)).current_head_sha, HEAD_B, 'a redelivered OLD head can NOT move the authority backward');

    // Redeliver the CURRENT head B (same delivery id -> deduped; and a fresh delivery id -> no-op).
    const dupB = await postCheckpoint(pool, { buildRef: 'BUILD-D6', checkpointRef: 'cp1', headSha: HEAD_B, deliveryId: 'd6b' });
    assert.equal(dupB.deduped, true);
    await postCheckpoint(pool, { buildRef: 'BUILD-D6', checkpointRef: 'cp1', headSha: HEAD_B, deliveryId: 'd6b-again' });

    // Convergence: exactly ONE build_head row, still current at B; gate B still live & mergeable
    // (no double-supersede churn); gate A still superseded.
    const bhCount = await pool.query(`select count(*)::int c from ops.build_head where build_id = $1`, [a.buildId]);
    assert.equal(bhCount.rows[0].c, 1, 'exactly one authoritative head row per build');
    const live = await readLiveGate(pool, a.buildId);
    assert.equal(live.checkpoint_id, b.checkpointId);
    assert.equal(live.overall_action_state, 'mergeable', 'the current gate is stable across redeliveries');
    assert.ok((await liveGateAtCheckpoint(pool, a.checkpointId)).superseded_at != null, 'gate A stays superseded');
    // Re-evaluating the CURRENT head is idempotent (no new/churned gate).
    const reEval = await evaluatePolicyGate(pool, {
      buildId: b.buildId, checkpointId: b.checkpointId, headSha: HEAD_B, github: GH_CLEAN(HEAD_B) });
    assert.equal(reEval.overallActionState, 'mergeable');
    const gateCount = await pool.query(`select count(*)::int c from ops.merge_gate where build_id = $1`, [a.buildId]);
    assert.equal(gateCount.rows[0].c, 2, 'exactly two gate rows ever (A superseded, B live) — no churn');
  } finally { await pool.end(); }
});

gated('7. STRUCTURAL: build_id PRIMARY KEY => at most one authoritative current head per build', async () => {
  const pool = await freshPool();
  try {
    const a = await postCheckpoint(pool, { buildRef: 'BUILD-D7', checkpointRef: 'cp1', headSha: HEAD_A, deliveryId: 'd7' });
    // A second head-authority row for the same build is structurally impossible (PK collision).
    let err = null;
    try {
      await pool.query(
        `insert into ops.build_head (build_id, current_checkpoint_id, current_head_sha) values ($1, $2, $3)`,
        [a.buildId, a.checkpointId, HEAD_A]);
    } catch (e) { err = e; }
    assert.ok(err, 'a second build_head row for the same build must be rejected');
    assert.equal(err.code, '23505', 'primary-key uniqueness on build_id (at most one authoritative head)');
  } finally { await pool.end(); }
});

gated('8. STRUCTURAL: advance refuses a non-recorded head fail-closed; head canonicalised at the boundary', async () => {
  const pool = await freshPool();
  try {
    // Boundary canonicalisation: an UPPER-CASE ingress head is stored full-lower-40-hex in build_head.
    const up = await postCheckpoint(pool, { buildRef: 'BUILD-D8', checkpointRef: 'cp1', headSha: 'A'.repeat(40), deliveryId: 'd8' });
    assert.equal((await buildHeadRow(pool, up.buildId)).current_head_sha, 'a'.repeat(40));

    // Fail-closed: making a NON-recorded (build, checkpoint, head) authoritative is refused.
    let err = null;
    try {
      await pool.query(`select ops.advance_build_head($1, gen_random_uuid(), $2)`, [up.buildId, HEAD_B]);
    } catch (e) { err = e; }
    assert.ok(err, 'advancing to a checkpoint that does not exist must raise');
    assert.equal(err.code, '23514', 'refused: not a recorded checkpoint for this build');

    // Fail-closed: a short/non-canonical head is refused at the boundary canonicaliser.
    let err2 = null;
    try { await pool.query(`select ops.advance_build_head($1, $2, $3)`, [up.buildId, up.checkpointId, 'abc123']); }
    catch (e) { err2 = e; }
    assert.ok(err2, 'a non-canonical head is refused at the boundary');
  } finally { await pool.end(); }
});

gated('9. REGRESSION FENCE: every ops plpgsql/sql function (incl. WP-D0) pins search_path', async () => {
  const pool = await freshPool();
  try {
    const { rows } = await pool.query(`
      select p.proname
        from pg_proc p
        join pg_namespace n on n.oid = p.pronamespace
        join pg_language  l on l.oid = p.prolang
       where n.nspname = 'ops'
         and l.lanname in ('plpgsql','sql')
         and not exists (
           select 1 from unnest(coalesce(p.proconfig, array[]::text[])) cfg
            where cfg like 'search_path=%')
       order by p.proname`);
    assert.deepEqual(rows.map((r) => r.proname), [],
      `ops functions missing a pinned search_path: ${rows.map((r) => r.proname).join(', ') || '(none)'}`);
  } finally { await pool.end(); }
});
