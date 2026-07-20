// BUILD-014 — the `review` job handler on the durable baton.
//
// This is the multi-model review loop running OFF THE CONTROL PLANE, not a ClickUp thread. It is a
// WP-B job handler (async (ctx) => { status }) registered for the `review` queue — we run ON the
// WP-B worker/queue, we do NOT build another queue.
//
// PR-2b REFACTOR (packet-driven runtime): when a `packetBuilder` (+ `productQaPrompt`) is injected,
// the handler consumes a first-class, hashed, immutable review_packet (the resolved evidence
// snapshot) instead of the ad-hoc job payload, computes checkpoint_assurance from the actual diff
// surface (risk-routing), dispatches the required ROLES to authorised reviewers via the registry,
// stages the versioned product-QA prompt, and writes a review_run per reviewer — all fail-closed.
// See towerReview.mjs. When NO packetBuilder is injected the handler runs the ORIGINAL WP-C path
// (byte-for-byte) so the WP-C / WP-D0 e2e suites are unchanged.
//
// FAIL-CLOSED, applied to ALL analogous sites (RCA):
//   · A `blocked` adapter result is recorded as verdict='blocked', which is NEVER an approve.
//   · HEAD-ATTESTATION CROSS-CHECK: even an `ok` result is DOWNGRADED to 'blocked' if its signed
//     envelope.reviewed_head != the checkpoint's DB head.
//   · An unknown signer principal is refused (blocked), never mapped to a reviewer slot.
//   · A thrown adapter / missing structuredResult / non-string verdict all route to 'blocked'.

import { appendEvent } from '../worker/events.mjs';
import {
  SIGNER_ROLE, OK_VERDICTS, canonicalizeShaOrNull, verdictFromAdapterResult, recordVerdict,
} from './reviewCore.mjs';
import { runTowerReview } from './towerReview.mjs';

// Re-exported for back-compat: ingress/githubIngress.mjs + gate/policyGate.mjs import
// canonicalizeShaOrNull from here; the WP-C/WP-D0 suites import createReviewHandler from here.
export { SIGNER_ROLE, OK_VERDICTS, canonicalizeShaOrNull, verdictFromAdapterResult, recordVerdict };

/**
 * createReviewHandler({ pool, reviewers, skillText?, log?,
 *   packetBuilder?, productQaPrompt?, evidenceSources?, riskInput?, findingLinker? }) -> async (ctx) => { status }
 *
 * `reviewers` is an ARRAY of adapters, each exposing runTurn({ checkpoint, packet, skillText,
 * promptFingerprint }) -> a signed result. Injecting the array is the CI/test seam.
 *
 * PACKET-DRIVEN PATH (PR-2b): pass `packetBuilder` + `productQaPrompt` and the handler consumes the
 * review_packet, computes assurance, dispatches by role, and writes review_runs (towerReview.mjs).
 * LEGACY PATH (WP-C): omit `packetBuilder` and the handler runs the original ad-hoc-payload flow.
 */
export function createReviewHandler({
  pool, reviewers = [], skillText = '', log,
  packetBuilder = null, productQaPrompt = null, evidenceSources = {}, riskInput = {}, findingLinker = null,
} = {}) {
  if (!pool) throw new Error('createReviewHandler: pool is required');
  if (!Array.isArray(reviewers) || reviewers.length === 0) {
    throw new Error('createReviewHandler: at least one reviewer adapter is required');
  }

  return async function reviewHandler(ctx) {
    const payload = ctx.job?.payload ?? {};
    const checkpointId = payload.checkpointId ?? payload.checkpoint_id ?? null;
    if (!checkpointId) return { status: 'failed' };

    // ---- PR-2b packet-driven path -----------------------------------------------------------
    if (packetBuilder) {
      const res = await runTowerReview({
        pool, checkpointId, reviewers, packetBuilder, productQaPrompt,
        evidenceSources, riskInput: { ...riskInput, ...(payload.riskInput ?? {}) }, findingLinker, log,
      });
      // A BLOCKED review evidence / unavailable reviewer is a SUCCESSFUL, fail-closed job outcome
      // (the block is durably recorded); only an internal write failure is a retryable 'failed'.
      return { status: res.status === 'failed' ? 'failed' : 'succeeded', review: res };
    }

    // ---- LEGACY WP-C path (unchanged) -------------------------------------------------------
    const cp = await pool.query(
      `select c.id, c.build_id, c.checkpoint_ref, c.head_sha, c.branch, c.brief_ref, b.build_ref, b.repo
         from ops.checkpoint c join ops.build b on b.id = c.build_id
        where c.id = $1`, [checkpointId]);
    if (cp.rowCount !== 1) return { status: 'failed' };
    const checkpoint = cp.rows[0];
    const headSha = checkpoint.head_sha;

    const packet = {
      checkpoint_id: checkpoint.checkpoint_ref,
      build_id: checkpoint.build_ref,
      repo: checkpoint.repo ?? '(local working tree)',
      branch: checkpoint.branch ?? '(unknown)',
      head_sha: headSha,
      brief_ref: checkpoint.brief_ref ?? null,
      diff_text: payload.diff_text ?? null,
      diff_range: payload.diff_range ?? null,
      summary: payload.summary ?? null,
      ...(payload.packet ?? {}),
    };
    const checkpointArg = { checkpoint_id: checkpoint.checkpoint_ref, head_sha: headSha };

    const decisions = [];
    for (const adapter of reviewers) {
      let result;
      try {
        result = await adapter.runTurn({
          checkpoint: checkpointArg, packet, skillText,
          promptFingerprint: payload.promptFingerprint ?? null,
        });
      } catch (err) {
        result = { ok: false, blocked: true, signerPrincipal: adapter?.principal ?? null,
          error: 'adapter runTurn threw', structuredResult: { status: 'blocked', kind: 'adapter_threw' } };
      }
      const decision = verdictFromAdapterResult(result, headSha);
      if (decision.refused) {
        log?.warn?.('review.reviewer_refused', { checkpointId, reason: decision.reason });
        return { status: 'failed' };
      }
      decisions.push(decision);
    }

    const client = await pool.connect();
    try {
      await client.query('begin');
      for (const d of decisions) {
        await recordVerdict(client, {
          checkpointId, headSha,
          reviewer: d.reviewer, verdictType: d.verdictType,
          verdict: d.verdict, promptFingerprint: d.promptFingerprint,
        });
      }
      await appendEvent(client, {
        buildId: checkpoint.build_id,
        deliveryKey: `review:${checkpointId}:${headSha}:recorded`,
        eventKind: 'review.verdicts_recorded',
        actor: 'tower',
        payload: {
          checkpointId, headSha,
          verdicts: decisions.map((d) => ({ reviewer: d.reviewer, verdict: d.verdict })),
        },
      });
      await client.query('commit');
    } catch (err) {
      await client.query('rollback').catch(() => {});
      log?.warn?.('review.write_failed', { checkpointId });
      return { status: 'failed' };
    } finally {
      client.release();
    }

    return { status: 'succeeded' };
  };
}
