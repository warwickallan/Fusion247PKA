// BUILD-014 WP-C — GitHub webhook INGRESS receiver (logic only; no Edge-Function deploy,
// no live webhook registration — those are separate live gates).
//
// RESPONSIBILITY: turn one inbound GitHub webhook (raw body bytes + headers) into durable
// control-plane state, safely and idempotently:
//   1. VERIFY the HMAC-SHA256 signature (X-Hub-Signature-256) over the RAW body, FAIL-CLOSED.
//      No secret, missing/malformed header, length mismatch, or digest mismatch => rejected
//      with NO DB write. GitHub signs the raw bytes, so we must verify the exact bytes.
//   2. REQUIRE a delivery id (X-GitHub-Delivery) — it is the idempotency pivot; without it we
//      cannot dedup, so we reject fail-closed.
//   3. Write an IMMUTABLE agent_event envelope keyed by the delivery id (ON CONFLICT DO NOTHING
//      => a redelivery is ingested at most once). The payload stored is POINTERS + a hash of the
//      raw body only — never the whole GitHub payload (audit-integrity without hoarding content).
//   4. For a CHECKPOINT-BEARING event: upsert the build + checkpoint (head canonicalised to a
//      full lower-case SHA at the boundary), ADVANCE the authoritative current head for the build
//      (WP-D0: ops.advance_build_head — monotonic, and it supersedes any live merge_gate bound to
//      a DIFFERENT head, closing the stale window at the edge), and ENQUEUE a `review` job on the
//      WP-B queue (reuse enqueue(); do NOT build another queue). The review-job idempotency key is
//      derived from (checkpointId, headSha) so a redelivery never enqueues a duplicate review.
//
// Every step is INDEPENDENTLY IDEMPOTENT and CONVERGENT, so re-processing a redelivery — even
// after a crash that left a prior attempt partial — heals to the same state (default-safe for a
// first-party, non-adversarial personal control plane). SHAs are canonicalised at THIS boundary
// (RCA: canonicalise at the edge) and again by the ops.git_sha domain in the DB.

import crypto from 'node:crypto';
import { enqueue as defaultEnqueue } from '../worker/enqueue.mjs';
import { appendEvent, hashPayload } from '../worker/events.mjs';
import { canonicalizeShaOrNull } from '../review/reviewHandler.mjs';

const SIG_PREFIX = 'sha256=';

/** Case-insensitive header read (GitHub headers arrive lower-cased; be tolerant). */
function header(headers, name) {
  if (!headers) return undefined;
  const want = name.toLowerCase();
  for (const k of Object.keys(headers)) {
    if (k.toLowerCase() === want) return headers[k];
  }
  return undefined;
}

/**
 * Verify the GitHub HMAC-SHA256 signature over the RAW body. FAIL-CLOSED and constant-time.
 * Returns { ok: boolean, reason?: string }. NEVER throws.
 */
export function verifyGithubSignature({ rawBody, signatureHeader, secret }) {
  if (typeof secret !== 'string' || secret.length === 0) return { ok: false, reason: 'no webhook secret configured' };
  if (typeof signatureHeader !== 'string' || !signatureHeader.startsWith(SIG_PREFIX)) {
    return { ok: false, reason: 'missing or malformed X-Hub-Signature-256' };
  }
  const provided = signatureHeader.slice(SIG_PREFIX.length);
  // rawBody must be the exact bytes GitHub signed. Accept a Buffer or a string.
  const bodyBuf = Buffer.isBuffer(rawBody) ? rawBody : Buffer.from(String(rawBody ?? ''), 'utf8');
  let expected;
  try { expected = crypto.createHmac('sha256', secret).update(bodyBuf).digest('hex'); }
  catch { return { ok: false, reason: 'signature computation failed' }; }
  let a, b;
  try { a = Buffer.from(provided, 'hex'); b = Buffer.from(expected, 'hex'); }
  catch { return { ok: false, reason: 'signature not valid hex' }; }
  if (a.length !== b.length || a.length === 0) return { ok: false, reason: 'signature length mismatch' };
  if (!crypto.timingSafeEqual(a, b)) return { ok: false, reason: 'signature mismatch' };
  return { ok: true };
}

/**
 * Extract a checkpoint descriptor from a GitHub event, or null for a non-checkpoint event.
 * NEVER throws. Recognised checkpoint-bearing shapes (first-party contract):
 *   · a synthetic `checkpoint` event carrying payload.checkpoint = { build_ref, checkpoint_ref,
 *     head_sha, branch?, brief_ref?, summary? }; OR
 *   · a `check_run` completed event -> head from check_run.head_sha, checkpoint_ref from the
 *     check_run id/name, build_ref from the repo full_name.
 * The head is canonicalised here; a non-canonical/absent head yields null (fail-closed — a
 * checkpoint we cannot bind to an exact head is NOT a checkpoint).
 */
export function extractCheckpoint(eventType, payload) {
  if (!payload || typeof payload !== 'object') return null;

  if (eventType === 'checkpoint' && payload.checkpoint && typeof payload.checkpoint === 'object') {
    const c = payload.checkpoint;
    const headSha = canonicalizeShaOrNull(c.head_sha);
    const buildRef = typeof c.build_ref === 'string' ? c.build_ref : null;
    const checkpointRef = typeof c.checkpoint_ref === 'string' ? c.checkpoint_ref : null;
    if (!headSha || !buildRef || !checkpointRef) return null;
    return {
      buildRef, checkpointRef, headSha,
      repo: typeof payload.repository?.full_name === 'string' ? payload.repository.full_name : (c.repo ?? null),
      branch: typeof c.branch === 'string' ? c.branch : null,
      briefRef: typeof c.brief_ref === 'string' ? c.brief_ref : null,
      summary: typeof c.summary === 'string' ? c.summary : null,
    };
  }

  if (eventType === 'check_run' && payload.check_run && typeof payload.check_run === 'object') {
    if (payload.action && payload.action !== 'completed') return null;
    const cr = payload.check_run;
    const headSha = canonicalizeShaOrNull(cr.head_sha);
    const buildRef = typeof payload.repository?.full_name === 'string' ? payload.repository.full_name : null;
    if (!headSha || !buildRef) return null;
    const checkpointRef = `check_run:${cr.id ?? cr.name ?? headSha}`;
    return {
      buildRef, checkpointRef, headSha,
      repo: buildRef,
      branch: typeof cr.check_suite?.head_branch === 'string' ? cr.check_suite.head_branch : null,
      briefRef: null,
      summary: typeof cr.name === 'string' ? cr.name : null,
    };
  }

  return null;
}

/** Upsert a build by build_ref, returning its id. Idempotent. */
async function upsertBuild(client, { buildRef, repo }) {
  await client.query(
    `insert into ops.build (build_ref, repo) values ($1, $2)
     on conflict (build_ref) do nothing`, [buildRef, repo ?? null]);
  const { rows } = await client.query(`select id from ops.build where build_ref = $1`, [buildRef]);
  return rows[0].id;
}

/**
 * Upsert a checkpoint by its per-build natural key (build_id, checkpoint_ref, head_sha).
 * A checkpoint_ref reused at a NEW head is a NEW checkpoint row (WP-A F11) — exactly the
 * moved-head semantics. Idempotent. Returns the checkpoint id.
 */
async function upsertCheckpoint(client, { buildId, checkpointRef, headSha, branch, briefRef }) {
  await client.query(
    `insert into ops.checkpoint (build_id, checkpoint_ref, head_sha, branch, brief_ref)
     values ($1, $2, ops.canonicalize_sha($3), $4, $5)
     on conflict (build_id, checkpoint_ref, head_sha) do nothing`,
    [buildId, checkpointRef, headSha, branch ?? null, briefRef ?? null]);
  const { rows } = await client.query(
    `select id from ops.checkpoint where build_id = $1 and checkpoint_ref = $2 and head_sha = ops.canonicalize_sha($3)`,
    [buildId, checkpointRef, headSha]);
  return rows[0].id;
}

/**
 * WP-D0: ADVANCE the authoritative current head for this build to (checkpointId, headSha), IN THE
 * SAME transaction as the checkpoint upsert. ops.advance_build_head is MONOTONIC (a redelivery of
 * an old head can never move the head backward) and, on an actual advance, supersedes any live
 * merge_gate bound to a different head — closing the stale window at the edge. Idempotent/convergent:
 * a redelivery is a no-op for the head authority. Runs on the pinned client (same txn).
 */
async function advanceBuildHead(client, { buildId, checkpointId, headSha }) {
  await client.query(
    `select ops.advance_build_head($1, $2, $3)`, [buildId, checkpointId, headSha]);
}

/**
 * ingestWebhook(pool, { headers, rawBody, secret }, { enqueue?, log? }) -> a result envelope.
 *
 * Result shapes:
 *   { accepted: false, status: 401|400, reason }                 — rejected fail-closed (no writes)
 *   { accepted: true, deduped, eventId, checkpoint: null }       — accepted, non-checkpoint event
 *   { accepted: true, deduped, eventId, checkpointId, buildId, headSha, job, jobDeduped } — checkpoint event
 *
 * `deduped` is true when the delivery id was already ingested (redelivery). The steps still run
 * (they are idempotent) so a partial prior attempt self-heals.
 */
export async function ingestWebhook(pool, { headers = {}, rawBody, secret } = {}, opts = {}) {
  const enqueue = opts.enqueue ?? defaultEnqueue;
  const log = opts.log;

  // (1) signature — fail closed BEFORE any parse or write.
  const sig = verifyGithubSignature({ rawBody, signatureHeader: header(headers, 'x-hub-signature-256'), secret });
  if (!sig.ok) { log?.warn?.('ingress.signature_rejected', { reason: sig.reason }); return { accepted: false, status: 401, reason: sig.reason }; }

  // (2) delivery id — the idempotency pivot; required.
  const deliveryId = header(headers, 'x-github-delivery');
  if (typeof deliveryId !== 'string' || deliveryId.length === 0) {
    return { accepted: false, status: 400, reason: 'missing X-GitHub-Delivery' };
  }
  const eventType = header(headers, 'x-github-event') ?? 'unknown';

  // Parse the (already-signature-verified) body. A malformed body is a 400, not a throw.
  let payload;
  try { payload = JSON.parse(Buffer.isBuffer(rawBody) ? rawBody.toString('utf8') : String(rawBody ?? '')); }
  catch { return { accepted: false, status: 400, reason: 'body is not valid JSON' }; }

  const rawHash = hashPayload(Buffer.isBuffer(rawBody) ? rawBody.toString('utf8') : String(rawBody ?? ''));
  const checkpoint = extractCheckpoint(eventType, payload);

  // Non-checkpoint event: record the immutable envelope only (idempotent), then return.
  if (!checkpoint) {
    const inserted = await appendEvent(pool, {
      buildId: null,
      deliveryKey: deliveryId,
      eventKind: `github.${eventType}`,
      actor: null,
      payloadHash: rawHash,
      payload: { deliveryId, eventType, repo: payload?.repository?.full_name ?? null },
      classification: 'internal',
    });
    return { accepted: true, deduped: !inserted, eventId: deliveryId, checkpoint: null };
  }

  // Checkpoint-bearing event: build + checkpoint + envelope atomically on a pinned client, then
  // enqueue the review job (its own atomic txn). Both halves are idempotent; a crash between
  // them heals on redelivery.
  let buildId, checkpointId, eventDeduped;
  const client = await pool.connect();
  try {
    await client.query('begin');
    buildId = await upsertBuild(client, { buildRef: checkpoint.buildRef, repo: checkpoint.repo });
    checkpointId = await upsertCheckpoint(client, {
      buildId, checkpointRef: checkpoint.checkpointRef, headSha: checkpoint.headSha,
      branch: checkpoint.branch, briefRef: checkpoint.briefRef,
    });
    // WP-D0: advance the authoritative current head + supersede any stale live gate, atomically
    // with the checkpoint upsert (monotonic, redelivery-safe — see ops.advance_build_head).
    await advanceBuildHead(client, { buildId, checkpointId, headSha: checkpoint.headSha });
    eventDeduped = !(await appendEvent(client, {
      buildId,
      deliveryKey: deliveryId,
      eventKind: `github.${eventType}`,
      actor: null,
      payloadHash: rawHash,
      payload: {
        deliveryId, eventType, repo: checkpoint.repo,
        buildRef: checkpoint.buildRef, checkpointRef: checkpoint.checkpointRef, headSha: checkpoint.headSha,
      },
      classification: 'internal',
    }));
    await client.query('commit');
  } catch (err) {
    await client.query('rollback').catch(() => {});
    throw err;
  } finally {
    client.release();
  }

  // (4) enqueue the review job — idempotent on (checkpointId, headSha).
  const { job, deduped: jobDeduped } = await enqueue(pool, {
    jobType: 'review',
    idempotencyKey: `review:${checkpointId}:${checkpoint.headSha}`,
    buildId,
    payload: {
      checkpointId, buildId, headSha: checkpoint.headSha,
      checkpointRef: checkpoint.checkpointRef, buildRef: checkpoint.buildRef,
      summary: checkpoint.summary ?? null,
    },
  });

  return {
    accepted: true, deduped: eventDeduped, eventId: deliveryId,
    checkpointId, buildId, headSha: checkpoint.headSha,
    job: { id: String(job.id), status: job.status }, jobDeduped,
  };
}

/** Convenience: compute the header a client/test would send for a body + secret. */
export function githubSignatureHeader(rawBody, secret) {
  const bodyBuf = Buffer.isBuffer(rawBody) ? rawBody : Buffer.from(String(rawBody ?? ''), 'utf8');
  return SIG_PREFIX + crypto.createHmac('sha256', secret).update(bodyBuf).digest('hex');
}
