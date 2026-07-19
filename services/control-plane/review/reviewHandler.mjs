// BUILD-014 WP-C — the `review` job handler on the durable baton.
//
// This is the multi-model review loop running OFF THE CONTROL PLANE, not a ClickUp thread.
// It is a WP-B job handler (async (ctx) => { status }) registered for the `review` queue —
// we run ON the WP-B worker/queue, we do NOT build another queue.
//
// WHAT IT DOES, per claimed review job:
//   1. Load the checkpoint row from the DB by ctx.job.payload.checkpointId. The EXACT head
//      the verdict binds to is the checkpoint's OWN recorded head_sha (ops.git_sha, canonical)
//      — never a value the job payload could drift from. If the checkpoint is gone, fail closed.
//   2. Run the two INDEPENDENT reviewers (ported codex correction-loop + fable cold-final).
//      The adapter INVOCATION is injectable (see `reviewers`): in CI/tests a fake returns a
//      canned signed verdict; in production these are createCodexAdapter()/createFableAdapter().
//      The point proven here is the baton -> adapter -> verdict WIRING + head-binding +
//      fail-closed, not calling live CLIs in CI.
//   3. Write one `verdict` row per reviewer, bound to the EXACT head, ROLE-CORRECT
//      (gpt_codex => correction_loop, fable => cold_final — the composite reviewer<->type
//      CHECK in WP-A rejects any other pairing). Writes are supersede-then-insert in ONE
//      transaction so a retry is idempotent (same verdict+fingerprint => no-op) and the two
//      verdicts land together or not at all.
//
// FAIL-CLOSED, applied to ALL analogous sites (RCA):
//   · A `blocked` adapter result (no binary / no credential / timeout / malformed / model
//     unverified — the adapter's own fail-closed kinds) is recorded as verdict='blocked',
//     which is NEVER an approve, so it can never contribute to merge-readiness.
//   · HEAD-ATTESTATION CROSS-CHECK: even an `ok` adapter result is DOWNGRADED to 'blocked'
//     if its signed envelope.reviewed_head does not equal the checkpoint's DB head. We never
//     record an APPROVE for a head the reviewer did not actually review — the Tower head-blind
//     bug class, killed a second time in app code (the DB composite FK is the structural kill).
//   · An unknown signer principal is refused (blocked), never mapped to a reviewer slot.
//   · Total on hostile-but-first-party-accidental adapter output: a thrown adapter, a missing
//     structuredResult, a non-string verdict all route to 'blocked', never an unhandled escape.

import { appendEvent } from '../worker/events.mjs';

// Honest signer-principal -> (DB reviewer principal, verdict_type) mapping. The adapters sign
// under 'gpt_codex' / 'claude_fable' (envelope.mjs HONEST_PROVIDER); the WP-A `principal` enum
// uses 'gpt_codex' / 'fable'. This is the ONLY place the two vocabularies meet — anything not
// in this table is refused, so a mislabelled reviewer can never occupy a role slot.
const SIGNER_ROLE = Object.freeze({
  gpt_codex:   { reviewer: 'gpt_codex', verdictType: 'correction_loop' },
  claude_fable:{ reviewer: 'fable',     verdictType: 'cold_final' },
});

// The adapter verdict vocabulary ({approve|request_changes|comment}) maps 1:1 onto the DB
// verdict_value enum; a blocked/absent/hostile outcome collapses to 'blocked' (default-deny).
const OK_VERDICTS = new Set(['approve', 'request_changes', 'comment']);

/** JS-side SHA canonicaliser mirroring ops.canonicalize_sha — lower/trim, full-40-hex or null. */
export function canonicalizeShaOrNull(raw) {
  if (typeof raw !== 'string') return null;
  const v = raw.trim().toLowerCase();
  return /^[0-9a-f]{40}$/.test(v) ? v : null;
}

/**
 * Decide the DB verdict value + role from ONE adapter runTurn result, cross-checking the
 * reviewed head. NEVER throws. Returns { reviewer, verdictType, verdict, promptFingerprint,
 * blockedReason? } — or { refused, reason } when the signer is unmappable.
 */
export function verdictFromAdapterResult(result, checkpointHead) {
  const principal = result?.signerPrincipal ?? result?.envelope?.agent ?? null;
  const role = principal && SIGNER_ROLE[principal];
  if (!role) return { refused: true, reason: `unmappable signer principal: ${String(principal)}` };

  const promptFingerprint =
    typeof result?.envelope?.prompt_fingerprint === 'string' ? result.envelope.prompt_fingerprint : null;

  // Fail-closed: a blocked adapter result is a 'blocked' verdict (never an approve).
  if (!result || result.blocked === true || result.ok !== true) {
    return { ...role, verdict: 'blocked', promptFingerprint,
      blockedReason: String(result?.error ?? result?.structuredResult?.kind ?? 'adapter blocked') };
  }

  // HEAD-ATTESTATION CROSS-CHECK: an ok result whose signed reviewed_head is not THIS head is
  // downgraded to blocked — we refuse to record an approve for a head the reviewer never saw.
  const reviewedHead = canonicalizeShaOrNull(result?.envelope?.reviewed_head);
  if (reviewedHead !== checkpointHead) {
    return { ...role, verdict: 'blocked', promptFingerprint,
      blockedReason: `head attestation mismatch: reviewer signed ${String(result?.envelope?.reviewed_head)}, checkpoint head is ${checkpointHead}` };
  }

  const raw = result?.structuredResult?.verdict;
  const verdict = OK_VERDICTS.has(raw) ? raw : 'blocked';
  return { ...role, verdict, promptFingerprint,
    blockedReason: verdict === 'blocked' ? `non-conforming verdict value: ${String(raw)}` : undefined };
}

/**
 * Record ONE verdict, supersede-then-insert, idempotent. MUST run on a pinned client already
 * inside a transaction. Binds reviewed_commit_sha to the checkpoint's EXACT head (the composite
 * FK checkpoint(id, head_sha) refuses any other). Returns { action: 'inserted'|'unchanged' }.
 */
export async function recordVerdict(client, {
  checkpointId, headSha, reviewer, verdictType, verdict, promptFingerprint = null,
}) {
  const existing = await client.query(
    `select id, verdict, prompt_fingerprint
       from ops.verdict
      where checkpoint_id = $1 and reviewer = $2::ops.principal and verdict_type = $3::ops.verdict_type
        and state = 'active'
      for update`,
    [checkpointId, reviewer, verdictType]);

  if (existing.rowCount === 1) {
    const cur = existing.rows[0];
    // Idempotent retry: an identical active verdict (same value + fingerprint) is left as-is,
    // so re-running the review job never churns the evidence chain.
    if (cur.verdict === verdict && (cur.prompt_fingerprint ?? null) === (promptFingerprint ?? null)) {
      return { action: 'unchanged' };
    }
    // A genuinely new outcome: supersede the prior active verdict IN THIS TXN (the WP-A
    // active-uniqueness index requires exactly this before a fresh active row can exist).
    await client.query(`update ops.verdict set state = 'superseded' where id = $1`, [cur.id]);
  }

  await client.query(
    `insert into ops.verdict (checkpoint_id, reviewed_commit_sha, reviewer, verdict_type, verdict, prompt_fingerprint)
     values ($1, ops.canonicalize_sha($2), $3::ops.principal, $4::ops.verdict_type, $5::ops.verdict_value, $6)`,
    [checkpointId, headSha, reviewer, verdictType, verdict, promptFingerprint]);
  return { action: 'inserted' };
}

/**
 * createReviewHandler({ pool, reviewers, skillText?, log? }) -> async (ctx) => { status }
 *
 * `reviewers` is an ARRAY of adapters, each exposing runTurn({ checkpoint, packet, skillText,
 * promptFingerprint }) -> a signed result (the ported codex/fable adapter shape). Injecting the
 * array is the CI/test seam: pass fakes that return canned signed verdicts; pass the real
 * createCodexAdapter()/createFableAdapter() in production. The handler is agnostic to which.
 */
export function createReviewHandler({ pool, reviewers = [], skillText = '', log } = {}) {
  if (!pool) throw new Error('createReviewHandler: pool is required');
  if (!Array.isArray(reviewers) || reviewers.length === 0) {
    throw new Error('createReviewHandler: at least one reviewer adapter is required');
  }

  return async function reviewHandler(ctx) {
    const payload = ctx.job?.payload ?? {};
    const checkpointId = payload.checkpointId ?? payload.checkpoint_id ?? null;
    if (!checkpointId) {
      // A review job with no checkpoint pointer is unworkable — fail (retry/dead-letter), never
      // silently succeed. (A durable ledger event records the reason via the WP-B failure path.)
      return { status: 'failed' };
    }

    // (1) The EXACT head is the checkpoint's OWN recorded head — read it from the DB, never trust
    // the payload's copy. checkpoint identity is immutable in WP-A, so this head is stable.
    const cp = await pool.query(
      `select c.id, c.build_id, c.checkpoint_ref, c.head_sha, c.branch, c.brief_ref, b.build_ref, b.repo
         from ops.checkpoint c join ops.build b on b.id = c.build_id
        where c.id = $1`, [checkpointId]);
    if (cp.rowCount !== 1) return { status: 'failed' }; // checkpoint vanished — fail closed
    const checkpoint = cp.rows[0];
    const headSha = checkpoint.head_sha; // canonical by the ops.git_sha domain

    // The bounded review packet (POINTERS + the exact head). The staged diff would be attached
    // here in production (collected read-only via Tower's allowlisted git); tests drive fakes.
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

    // (2) run every injected reviewer. A THROWN adapter is caught and treated as a blocked
    // verdict for that reviewer's role (default-deny), so one flaky reviewer cannot crash the
    // job or block the other's verdict from landing.
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
        // Unmappable signer — record nothing for it, but fail the job so it is retried rather
        // than silently proceeding with a half review.
        log?.warn?.('review.reviewer_refused', { checkpointId, reason: decision.reason });
        return { status: 'failed' };
      }
      decisions.push(decision);
    }

    // (3) write all verdicts in ONE transaction on a pinned client — atomic, head-bound, role-
    // correct, idempotent. Either both reviewers' verdicts land or neither does.
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
      // Append-only audit marker (idempotent on the head): the review pass ran at this head.
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
      return { status: 'failed' }; // retry — the verdict write is idempotent
    } finally {
      client.release();
    }

    return { status: 'succeeded' };
  };
}
