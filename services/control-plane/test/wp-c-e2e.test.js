// BUILD-014 WP-C — end-to-end proofs against REAL Postgres: GitHub ingress -> review handler
// on the baton -> Fusion policy gate. The multi-model review loop runs OFF the control plane.
//
// DB-GATED but NOT silently self-skipping (mirrors WP-A/WP-B): DATABASE_URL unset -> the suite
// skips with a LOUD pointer at the runner (test/run-wpc-tests.mjs), which provisions a throwaway
// Postgres and executes these proofs; the runner FAILS on 0 executed subtests. DATABASE_URL set
// but `pg` missing -> the suite FAILS (throws), never green-by-omission.
//
// THE ACCEPTANCE PROOFS:
//   1.  HMAC verify: a good signature is accepted; a BAD signature is rejected fail-closed (no writes).
//   2.  Missing X-GitHub-Delivery is rejected fail-closed (no idempotency pivot -> no ingest).
//   3.  An UPPER-CASE head is canonicalised at the ingress boundary (stored full-lower-40-hex).
//   4.  Duplicate delivery id -> exactly one event, one checkpoint, one review job (idempotent).
//   5.  A non-checkpoint event -> an immutable envelope, but NO checkpoint and NO review job.
//   6.  Review handler on the baton: both reviewers approve -> two verdicts bound to the EXACT
//       head, ROLE-CORRECT (gpt_codex=correction_loop, fable=cold_final).
//   7.  HEAD-ATTESTATION fail-closed: an adapter that signs a DIFFERENT reviewed_head is recorded
//       as 'blocked', never an approve (no merge-readiness for a head the reviewer never saw).
//   8.  Review handler retry is idempotent: re-running the job -> still one active verdict per role.
//   9.  Policy gate reaches 'mergeable' ONLY with both head-bound approvals AND cached GitHub clean.
//   10. Without both reviewers -> fusion_not_approved (never mergeable).
//   11. Fusion approved but cached GitHub head moved / mech blocked -> head_moved / github_blocked.
//   12. OUTCOME-C moved head: mergeable at head A; a new checkpoint at head B supersedes the A gate
//       (A can never report mergeable again) and the B gate is not approved -> not mergeable.
//   13. D1: a supporting verdict superseded auto-supersedes the approved gate -> not mergeable.
//   14. FULL PIPELINE: event -> ingress -> worker.processOnce('review') -> policy gate -> mergeable;
//       a duplicate delivery is a no-op; a moved-head event leaves the old head not-mergeable.

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
const MIGRATION = path.join(__dirname, '..', 'db', 'migrations', '001_control_plane_min_schema.sql');
const DB = process.env.DATABASE_URL;
const SILENT = createLogger({ level: 'silent' });

const TEST_HMAC_KEY = 'wp-c-test-hmac-key-not-a-real-credential'; // test-only HMAC key, assembled locally
const HEAD_A = 'a'.repeat(40);
const HEAD_B = 'b'.repeat(40);
const HEAD_C = 'c'.repeat(40);

let Pool = null;
let pgLoadError = null;
try { ({ Pool } = (await import('pg')).default ?? (await import('pg'))); }
catch (e) { pgLoadError = e; }

if (DB && !Pool) {
  throw new Error(
    `DATABASE_URL is set but the 'pg' driver failed to load — cannot run the WP-C proofs. ` +
    `Install pg or use run-wpc-tests.mjs. Underlying error: ${pgLoadError?.message}`);
}
const skipReason = !DB
  ? 'SKIPPED (no DATABASE_URL). Run: node services/control-plane/test/run-wpc-tests.mjs — it provisions a throwaway Postgres and executes these proofs. A skip is NOT a pass.'
  : false;
const gated = (name, fn) => test(name, { skip: skipReason }, fn);

async function freshPool() {
  const pool = new Pool({ connectionString: DB, max: 12 });
  await pool.query('drop schema if exists ops cascade');
  await pool.query(fs.readFileSync(MIGRATION, 'utf8'));
  return pool;
}

// ---- webhook builders --------------------------------------------------------------------
function checkpointEventBody({ buildRef, checkpointRef, headSha, branch = 'main', repo = 'warwick/f247' }) {
  return JSON.stringify({
    repository: { full_name: repo },
    checkpoint: { build_ref: buildRef, checkpoint_ref: checkpointRef, head_sha: headSha, branch, summary: 'wp-c test checkpoint' },
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
// Return the SAME signed-result shape the ported codex/fable adapters produce, built through
// the ported envelope so honest-label attestation is exercised. reviewedHead defaults to the
// packet head (a truthful reviewer); pass a fixed head to simulate a head-blind reviewer.
function fakeReviewer({ principal, provider, verdict, reviewedHead = null, blocked = false, promptFingerprint = null }) {
  return {
    principal,
    async runTurn({ packet }) {
      const head = reviewedHead ?? packet.head_sha;
      const payload = blocked
        ? { status: 'blocked', kind: 'forced', proposed_action: { type: 'noop', target: '' } }
        : { status: 'ok', verdict, summary: 'fake review', claims_verified: [], findings: [], proposed_action: { type: 'noop', target: '' } };
      const { envelope, signature } = makeSignedVerdict(
        { principal, provider, modelId: 'fake', reviewedHead: head, promptFingerprint, payload }, null);
      if (blocked) return { ok: false, blocked: true, signerPrincipal: principal, structuredResult: payload, envelope, signature, error: 'forced blocked' };
      return { ok: true, blocked: false, signerPrincipal: principal, structuredResult: payload, envelope, signature };
    },
  };
}
const codexApprove = (head) => fakeReviewer({ principal: 'gpt_codex', provider: 'openai-codex', verdict: 'approve', reviewedHead: head });
const fableApprove = (head) => fakeReviewer({ principal: 'claude_fable', provider: 'anthropic', verdict: 'approve', reviewedHead: head });

async function runReviewOnce(pool, reviewers, workerId = 'wp-c-w') {
  const reg = new HandlerRegistry().register('review', createReviewHandler({ pool, reviewers, log: SILENT }));
  const worker = new Worker(pool, reg, { workerId, leaseSeconds: 30, logger: SILENT });
  return worker.processOnce('review');
}

async function activeVerdicts(pool, checkpointId) {
  const { rows } = await pool.query(
    `select reviewer, verdict_type, verdict, reviewed_commit_sha from ops.verdict
      where checkpoint_id = $1 and state = 'active' order by reviewer`, [checkpointId]);
  return rows;
}

// ==========================================================================================
gated('1. HMAC verify: good signature accepted (writes), bad signature rejected (no writes)', async () => {
  const pool = await freshPool();
  try {
    const body = checkpointEventBody({ buildRef: 'BUILD-T1', checkpointRef: 'cp1', headSha: HEAD_A });
    // Bad signature: no write at all.
    const bad = await ingestWebhook(pool, { headers: headers({ deliveryId: 'd-bad', event: 'checkpoint', body, signature: 'sha256=deadbeef' }), rawBody: body, secret: TEST_HMAC_KEY });
    assert.equal(bad.accepted, false);
    assert.equal(bad.status, 401);
    const noEvents = await pool.query(`select count(*)::int c from ops.agent_event`);
    assert.equal(noEvents.rows[0].c, 0, 'a rejected webhook must write NOTHING');

    // Good signature: accepted, event + checkpoint + job all present.
    const ok = await ingestWebhook(pool, { headers: headers({ deliveryId: 'd-ok', event: 'checkpoint', body }), rawBody: body, secret: TEST_HMAC_KEY });
    assert.equal(ok.accepted, true);
    assert.ok(ok.checkpointId);
    assert.equal(ok.headSha, HEAD_A);
    const ev = await pool.query(`select count(*)::int c from ops.agent_event where delivery_key = 'd-ok'`);
    assert.equal(ev.rows[0].c, 1);
    const job = await pool.query(`select count(*)::int c from ops.job where queue = 'review'`);
    assert.equal(job.rows[0].c, 1);
  } finally { await pool.end(); }
});

gated('2. missing X-GitHub-Delivery is rejected fail-closed', async () => {
  const pool = await freshPool();
  try {
    const body = checkpointEventBody({ buildRef: 'BUILD-T2', checkpointRef: 'cp1', headSha: HEAD_A });
    const res = await ingestWebhook(pool, {
      headers: { 'x-github-event': 'checkpoint', 'x-hub-signature-256': githubSignatureHeader(body, TEST_HMAC_KEY) },
      rawBody: body, secret: TEST_HMAC_KEY });
    assert.equal(res.accepted, false);
    assert.equal(res.status, 400);
    const c = await pool.query(`select count(*)::int c from ops.agent_event`);
    assert.equal(c.rows[0].c, 0);
  } finally { await pool.end(); }
});

gated('3. an UPPER-CASE head is canonicalised at the ingress boundary', async () => {
  const pool = await freshPool();
  try {
    const UPPER = 'A'.repeat(40);
    const res = await postCheckpoint(pool, { buildRef: 'BUILD-T3', checkpointRef: 'cp1', headSha: UPPER, deliveryId: 'd3' });
    assert.equal(res.accepted, true);
    assert.equal(res.headSha, 'a'.repeat(40), 'ingress canonicalises to lower-case');
    const cp = await pool.query(`select head_sha from ops.checkpoint where id = $1`, [res.checkpointId]);
    assert.equal(cp.rows[0].head_sha, 'a'.repeat(40));
  } finally { await pool.end(); }
});

gated('4. duplicate delivery id -> one event, one checkpoint, one review job', async () => {
  const pool = await freshPool();
  try {
    const first = await postCheckpoint(pool, { buildRef: 'BUILD-T4', checkpointRef: 'cp1', headSha: HEAD_A, deliveryId: 'dup' });
    const second = await postCheckpoint(pool, { buildRef: 'BUILD-T4', checkpointRef: 'cp1', headSha: HEAD_A, deliveryId: 'dup' });
    assert.equal(first.deduped, false);
    assert.equal(second.deduped, true, 'a redelivery is flagged deduped');
    assert.equal(second.jobDeduped, true, 'the review job is not re-enqueued');
    const ev = await pool.query(`select count(*)::int c from ops.agent_event where delivery_key = 'dup'`);
    assert.equal(ev.rows[0].c, 1);
    const cp = await pool.query(`select count(*)::int c from ops.checkpoint`);
    assert.equal(cp.rows[0].c, 1);
    const job = await pool.query(`select count(*)::int c from ops.job where queue = 'review'`);
    assert.equal(job.rows[0].c, 1);
  } finally { await pool.end(); }
});

gated('5. a non-checkpoint event -> envelope only, no checkpoint, no review job', async () => {
  const pool = await freshPool();
  try {
    const body = JSON.stringify({ repository: { full_name: 'warwick/f247' }, ref: 'refs/heads/main' });
    const res = await ingestWebhook(pool, { headers: headers({ deliveryId: 'd-push', event: 'push', body }), rawBody: body, secret: TEST_HMAC_KEY });
    assert.equal(res.accepted, true);
    assert.equal(res.checkpoint, null);
    const ev = await pool.query(`select event_kind from ops.agent_event where delivery_key = 'd-push'`);
    assert.equal(ev.rows[0].event_kind, 'github.push');
    const cp = await pool.query(`select count(*)::int c from ops.checkpoint`);
    assert.equal(cp.rows[0].c, 0);
    const job = await pool.query(`select count(*)::int c from ops.job`);
    assert.equal(job.rows[0].c, 0);
  } finally { await pool.end(); }
});

gated('6. review handler: both approve -> two head-bound, ROLE-CORRECT verdicts', async () => {
  const pool = await freshPool();
  try {
    const ing = await postCheckpoint(pool, { buildRef: 'BUILD-T6', checkpointRef: 'cp1', headSha: HEAD_A, deliveryId: 'd6' });
    const out = await runReviewOnce(pool, [codexApprove(), fableApprove()]);
    assert.equal(out.outcome, 'succeeded');
    const vs = await activeVerdicts(pool, ing.checkpointId);
    assert.equal(vs.length, 2);
    const byReviewer = Object.fromEntries(vs.map((v) => [v.reviewer, v]));
    assert.equal(byReviewer.gpt_codex.verdict_type, 'correction_loop');
    assert.equal(byReviewer.gpt_codex.verdict, 'approve');
    assert.equal(byReviewer.gpt_codex.reviewed_commit_sha, HEAD_A);
    assert.equal(byReviewer.fable.verdict_type, 'cold_final');
    assert.equal(byReviewer.fable.verdict, 'approve');
    assert.equal(byReviewer.fable.reviewed_commit_sha, HEAD_A);
  } finally { await pool.end(); }
});

gated('7. HEAD-ATTESTATION fail-closed: a reviewer that signed a DIFFERENT head is recorded blocked', async () => {
  const pool = await freshPool();
  try {
    const ing = await postCheckpoint(pool, { buildRef: 'BUILD-T7', checkpointRef: 'cp1', headSha: HEAD_A, deliveryId: 'd7' });
    // codex truthfully reviews HEAD_A; fable claims 'approve' but signed HEAD_C (a different head).
    const fableWrongHead = fakeReviewer({ principal: 'claude_fable', provider: 'anthropic', verdict: 'approve', reviewedHead: HEAD_C });
    await runReviewOnce(pool, [codexApprove(), fableWrongHead]);
    const vs = await activeVerdicts(pool, ing.checkpointId);
    const byReviewer = Object.fromEntries(vs.map((v) => [v.reviewer, v]));
    assert.equal(byReviewer.gpt_codex.verdict, 'approve');
    assert.equal(byReviewer.fable.verdict, 'blocked', 'a head-blind approve is downgraded to blocked');
    // And therefore the checkpoint is NOT merge-ready.
    const rr = await pool.query(`select both_reviewers_approved_this_head b from ops.checkpoint_merge_readiness where checkpoint_id = $1`, [ing.checkpointId]);
    assert.equal(rr.rows[0].b, false);
  } finally { await pool.end(); }
});

gated('8. review handler retry is idempotent: re-run -> one active verdict per role', async () => {
  const pool = await freshPool();
  try {
    const ing = await postCheckpoint(pool, { buildRef: 'BUILD-T8', checkpointRef: 'cp1', headSha: HEAD_A, deliveryId: 'd8' });
    await runReviewOnce(pool, [codexApprove(), fableApprove()]);
    // Re-enqueue the same review job (simulate a redelivery) and run it again.
    await postCheckpoint(pool, { buildRef: 'BUILD-T8', checkpointRef: 'cp1', headSha: HEAD_A, deliveryId: 'd8' });
    // The dedup means no new pending job; force a direct second handler run to prove idempotency.
    const handler = createReviewHandler({ pool, reviewers: [codexApprove(), fableApprove()], log: SILENT });
    const r = await handler({ job: { id: 1n, payload: { checkpointId: ing.checkpointId } } });
    assert.equal(r.status, 'succeeded');
    const total = await pool.query(`select count(*)::int c from ops.verdict where checkpoint_id = $1 and state = 'active'`, [ing.checkpointId]);
    assert.equal(total.rows[0].c, 2, 'still exactly two active verdicts (no churn on identical re-review)');
    const all = await pool.query(`select count(*)::int c from ops.verdict where checkpoint_id = $1`, [ing.checkpointId]);
    assert.equal(all.rows[0].c, 2, 'no superseded rows created by an identical re-review');
  } finally { await pool.end(); }
});

gated('9. policy gate reaches mergeable ONLY with both head-bound approvals + cached GitHub clean', async () => {
  const pool = await freshPool();
  try {
    const ing = await postCheckpoint(pool, { buildRef: 'BUILD-T9', checkpointRef: 'cp1', headSha: HEAD_A, deliveryId: 'd9' });
    await runReviewOnce(pool, [codexApprove(), fableApprove()]);
    const g = await evaluatePolicyGate(pool, {
      buildId: ing.buildId, checkpointId: ing.checkpointId, headSha: HEAD_A,
      github: { mechState: 'clean', headSha: HEAD_A, reviewDecision: 'APPROVED' },
    });
    assert.equal(g.fusionDecision, 'approved');
    assert.equal(g.bothApproved, true);
    assert.equal(g.overallActionState, 'mergeable');
  } finally { await pool.end(); }
});

gated('10. without BOTH reviewers -> fusion_not_approved (never mergeable)', async () => {
  const pool = await freshPool();
  try {
    const ing = await postCheckpoint(pool, { buildRef: 'BUILD-T10', checkpointRef: 'cp1', headSha: HEAD_A, deliveryId: 'd10' });
    // Only codex approves; fable is forced-blocked.
    const fableBlocked = fakeReviewer({ principal: 'claude_fable', provider: 'anthropic', blocked: true });
    await runReviewOnce(pool, [codexApprove(), fableBlocked]);
    const g = await evaluatePolicyGate(pool, {
      buildId: ing.buildId, checkpointId: ing.checkpointId, headSha: HEAD_A,
      github: { mechState: 'clean', headSha: HEAD_A, reviewDecision: 'APPROVED' },
    });
    assert.equal(g.bothApproved, false);
    assert.notEqual(g.fusionDecision, 'approved');
    assert.equal(g.overallActionState, 'fusion_not_approved');
  } finally { await pool.end(); }
});

gated('11. fusion approved but cached GitHub head moved / mech blocked -> head_moved / github_blocked', async () => {
  const pool = await freshPool();
  try {
    const ing = await postCheckpoint(pool, { buildRef: 'BUILD-T11', checkpointRef: 'cp1', headSha: HEAD_A, deliveryId: 'd11' });
    await runReviewOnce(pool, [codexApprove(), fableApprove()]);
    // Cached GitHub reports a DIFFERENT observed head -> heads_agree false -> head_moved.
    const g1 = await evaluatePolicyGate(pool, {
      buildId: ing.buildId, checkpointId: ing.checkpointId, headSha: HEAD_A,
      github: { mechState: 'clean', headSha: HEAD_C, reviewDecision: 'APPROVED' },
    });
    assert.equal(g1.fusionDecision, 'approved');
    assert.equal(g1.overallActionState, 'head_moved');
    // Refresh the projection: same head but mechanically blocked -> github_blocked.
    const g2 = await evaluatePolicyGate(pool, {
      buildId: ing.buildId, checkpointId: ing.checkpointId, headSha: HEAD_A,
      github: { mechState: 'blocked', headSha: HEAD_A, reviewDecision: 'APPROVED' },
    });
    assert.equal(g2.overallActionState, 'github_blocked');
  } finally { await pool.end(); }
});

gated('12. OUTCOME-C moved head: A becomes mergeable, then a new checkpoint at B supersedes A', async () => {
  const pool = await freshPool();
  try {
    // Checkpoint at head A -> both approve -> mergeable.
    const a = await postCheckpoint(pool, { buildRef: 'BUILD-T12', checkpointRef: 'cp1', headSha: HEAD_A, deliveryId: 'd12a' });
    await runReviewOnce(pool, [codexApprove(), fableApprove()]);
    const gA = await evaluatePolicyGate(pool, {
      buildId: a.buildId, checkpointId: a.checkpointId, headSha: HEAD_A,
      github: { mechState: 'clean', headSha: HEAD_A, reviewDecision: 'APPROVED' } });
    assert.equal(gA.overallActionState, 'mergeable');

    // The head MOVES: a new checkpoint (same ref) at head B arrives.
    const b = await postCheckpoint(pool, { buildRef: 'BUILD-T12', checkpointRef: 'cp1', headSha: HEAD_B, deliveryId: 'd12b' });
    assert.notEqual(b.checkpointId, a.checkpointId, 'a moved head is a NEW checkpoint row');
    // Evaluate for the NEW head (no reviews yet at B) -> the A gate is superseded, B not approved.
    const gB = await evaluatePolicyGate(pool, {
      buildId: b.buildId, checkpointId: b.checkpointId, headSha: HEAD_B,
      github: { mechState: 'clean', headSha: HEAD_B, reviewDecision: 'REVIEW_REQUIRED' } });
    assert.notEqual(gB.overallActionState, 'mergeable');

    // Outcome-C: the system can no longer report mergeable for head A — its gate is superseded.
    const aGate = await pool.query(
      `select overall_action_state, superseded_at from ops.merge_gate where checkpoint_id = $1`, [a.checkpointId]);
    assert.ok(aGate.rows[0].superseded_at != null, 'the head-A gate is superseded');
    assert.equal(aGate.rows[0].overall_action_state, 'superseded');
    // And the single live gate for the build is the B gate, which is not mergeable.
    const liveNow = await readLiveGate(pool, b.buildId);
    assert.equal(liveNow.expected_head_sha, HEAD_B);
    assert.notEqual(liveNow.overall_action_state, 'mergeable');
  } finally { await pool.end(); }
});

gated('13. D1: a supporting verdict superseded auto-supersedes the approved gate -> not mergeable', async () => {
  const pool = await freshPool();
  try {
    const ing = await postCheckpoint(pool, { buildRef: 'BUILD-T13', checkpointRef: 'cp1', headSha: HEAD_A, deliveryId: 'd13' });
    await runReviewOnce(pool, [codexApprove(), fableApprove()]);
    const g = await evaluatePolicyGate(pool, {
      buildId: ing.buildId, checkpointId: ing.checkpointId, headSha: HEAD_A,
      github: { mechState: 'clean', headSha: HEAD_A, reviewDecision: 'APPROVED' } });
    assert.equal(g.overallActionState, 'mergeable');
    // Supersede the codex verdict (as a re-review would) -> D1 trigger supersedes the gate.
    await pool.query(
      `update ops.verdict set state = 'superseded'
        where checkpoint_id = $1 and reviewer = 'gpt_codex' and state = 'active'`, [ing.checkpointId]);
    const live = await readLiveGate(pool, ing.buildId);
    assert.equal(live, null, 'the approved gate was auto-superseded when its supporting verdict was superseded');
  } finally { await pool.end(); }
});

gated('14. FULL PIPELINE: event -> ingress -> worker -> policy gate -> mergeable; dup no-op; moved head not mergeable', async () => {
  const pool = await freshPool();
  try {
    // (a) checkpoint event -> ingress -> a pending review job.
    const ing = await postCheckpoint(pool, { buildRef: 'BUILD-T14', checkpointRef: 'cp1', headSha: HEAD_A, deliveryId: 'd14' });
    assert.ok(ing.job && ing.job.status === 'pending');

    // (b) the durable worker claims + runs the review handler with the (faked) adapters.
    const out = await runReviewOnce(pool, [codexApprove(), fableApprove()]);
    assert.equal(out.outcome, 'succeeded');

    // (c) the policy gate reaches mergeable ONLY now, with both head-bound approvals + GH clean.
    const g = await evaluatePolicyGate(pool, {
      buildId: ing.buildId, checkpointId: ing.checkpointId, headSha: HEAD_A,
      github: { mechState: 'clean', headSha: HEAD_A, reviewDecision: 'APPROVED' } });
    assert.equal(g.overallActionState, 'mergeable');

    // (d) a DUPLICATE delivery is a no-op: no new event, no new job.
    const dup = await postCheckpoint(pool, { buildRef: 'BUILD-T14', checkpointRef: 'cp1', headSha: HEAD_A, deliveryId: 'd14' });
    assert.equal(dup.deduped, true);
    const jobs = await pool.query(`select count(*)::int c from ops.job where queue = 'review'`);
    assert.equal(jobs.rows[0].c, 1);

    // (e) the head MOVES via a new event; the old head can never report mergeable again.
    const moved = await postCheckpoint(pool, { buildRef: 'BUILD-T14', checkpointRef: 'cp1', headSha: HEAD_B, deliveryId: 'd14b' });
    await evaluatePolicyGate(pool, {
      buildId: moved.buildId, checkpointId: moved.checkpointId, headSha: HEAD_B, github: null });
    const oldGate = await pool.query(`select overall_action_state from ops.merge_gate where checkpoint_id = $1`, [ing.checkpointId]);
    assert.equal(oldGate.rows[0].overall_action_state, 'superseded');
    const live = await readLiveGate(pool, moved.buildId);
    assert.equal(live.expected_head_sha, HEAD_B);
    assert.notEqual(live.overall_action_state, 'mergeable');
  } finally { await pool.end(); }
});
