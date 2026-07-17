// Fusion Tower — ClickUp post-review path (the ONE bounded governance write),
// wired onto the DURABLE external-write outbox (migration 0003 / GPT MEDIUM-1).
//
// This is the guarded surface through which a completed review is posted as a
// SINGLE ClickUp comment on the control task. Every hard control the Tower's write
// posture requires is enforced HERE, once, fail-closed:
//
//   1. TARGET VALIDATION — the ONLY allowed target is control task `869e5zu97`.
//      Any other task id is REJECTED. Target substitution is impossible by
//      construction; a caller cannot redirect the Tower's write elsewhere.
//   2. DURABLE, RESTART-SAFE IDEMPOTENCY — the write is CLAIMED in the durable
//      outbox (ftw.external_write) BEFORE any remote post, keyed on a per-MUTATION
//      key (NOT the task id). A restart/redelivery/retry collides on the unique
//      mutation_key and reads back the existing row + its state, so:
//        · a webhook/retry after `applied_verified` re-posts NOTHING (returns the
//          existing comment id — idempotent success);
//        · a DISTINCT later review (different mutation_key) to the SAME task is NOT
//          blocked;
//        · a response WITHOUT a comment id never reaches `applied_verified`;
//        · an ambiguous timeout is reconciled by searching the target for the
//          embedded `mutation_id` — a lost-response write resolves WITHOUT a
//          duplicate.
//   3. SELF-MARKER + EMBEDDED MUTATION ID — the posted body embeds the Tower
//      self-marker (`TOWER_SELF_MARKER`) so the Tower's own comment is recognised
//      as self_generated and never advances a run, PLUS a stable `ftw:mut:<id>`
//      marker the reconciler searches for.
//   4. REDACTION — the body MUST NOT contain a credential/token. A secret-shaped
//      string fails the write closed; no secret is ever posted to ClickUp.
//
// The poster performs NO merge and NO destructive action — it posts a comment and
// nothing else. It NEVER logs the ClickUp token (the client owns the credential;
// this module only hands it a task id + a redacted body).

import crypto from 'node:crypto';
import { TOWER_SELF_MARKER } from './eventIntake.js';

// The single control task the Tower is authorised to write to (BUILD-010 WP0).
// Any other target is refused — see assertAuthorisedTarget().
export const ALLOWED_CLICKUP_TASK_ID = '869e5zu97';

// The default target kind recorded in the outbox row.
export const DEFAULT_TARGET_KIND = 'clickup_task';

// Secret-shaped patterns the body must never contain. Fail-closed redaction guard:
// a match refuses the write. These are deliberately broad (a false positive costs a
// blocked post, which is the safe direction).
const SECRET_PATTERNS = Object.freeze([
  { name: 'openai-key', re: /\bsk-[A-Za-z0-9_-]{16,}\b/ },
  { name: 'clickup-personal-token', re: /\bpk_\d{3,}_[A-Za-z0-9]{16,}\b/ },
  { name: 'github-token', re: /\bgh[pousr]_[A-Za-z0-9]{20,}\b/ },
  { name: 'slack-token', re: /\bxox[baprs]-[A-Za-z0-9-]{10,}\b/ },
  { name: 'bearer-token', re: /\bBearer\s+[A-Za-z0-9._-]{16,}/i },
  { name: 'jwt', re: /\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{6,}\b/ },
  { name: 'db-url-password', re: /\b(?:postgres(?:ql)?|mysql):\/\/[^:\s]+:[^@\s]+@/i },
  { name: 'telegram-bot-token', re: /\b\d{8,10}:[A-Za-z0-9_-]{30,}\b/ },
]);

/**
 * Scan a body for secret-shaped strings. Returns { clean, hits[] }. Names only —
 * never echoes the matched value, so the guard itself cannot leak a secret.
 */
export function scanForSecrets(body) {
  const text = String(body ?? '');
  const hits = [];
  for (const p of SECRET_PATTERNS) {
    if (p.re.test(text)) hits.push(p.name);
  }
  return { clean: hits.length === 0, hits };
}

/** Throw (fail-closed) if the body carries any secret-shaped string. */
export function assertNoSecret(body) {
  const { clean, hits } = scanForSecrets(body);
  if (!clean) {
    throw new Error(`clickupPoster: refusing to post — body contains secret-shaped content [${hits.join(', ')}] (redaction guard)`);
  }
  return true;
}

/** Throw unless `taskId` is the single authorised control task. */
export function assertAuthorisedTarget(taskId, allowedTaskId = ALLOWED_CLICKUP_TASK_ID) {
  if (taskId !== allowedTaskId) {
    throw new Error(
      `clickupPoster: TARGET REJECTED — "${taskId}" is not the authorised control task `
      + `"${allowedTaskId}". Target substitution is refused.`,
    );
  }
  return true;
}

/** Throw unless the body embeds the Tower self-marker (self-loop prevention). */
export function assertSelfMarker(body) {
  if (!String(body ?? '').includes(TOWER_SELF_MARKER)) {
    throw new Error(
      `clickupPoster: refusing to post — body is missing the Tower self-marker `
      + `("${TOWER_SELF_MARKER}"); without it the Tower's own comment could self-loop a run.`,
    );
  }
  return true;
}

// ── mutation identity ─────────────────────────────────────────────────────────

function sha256hex(s) {
  return crypto.createHash('sha256').update(String(s), 'utf8').digest('hex');
}

/** The public per-mutation marker embedded in the posted comment for reconciliation. */
export const MUTATION_MARKER_PREFIX = '<!-- ftw:mut:';
export function mutationMarker(mutationId) {
  return `${MUTATION_MARKER_PREFIX}${mutationId} -->`;
}

/**
 * Embed the mutation marker into the body IMMEDIATELY AFTER the self-marker, i.e.
 * `<!-- ftw:self --><!-- ftw:mut:<id> -->`. Idempotent (a body already carrying the
 * marker is returned unchanged). The self-marker is asserted present by the caller.
 */
function embedMutationId(body, mutationId) {
  const marker = mutationMarker(mutationId);
  if (String(body).includes(marker)) return body;
  const idx = String(body).indexOf(TOWER_SELF_MARKER);
  if (idx >= 0) {
    const at = idx + TOWER_SELF_MARKER.length;
    return body.slice(0, at) + marker + body.slice(at);
  }
  // Unreachable in practice (assertSelfMarker runs first), but stay safe.
  return `${body}\n${marker}`;
}

/**
 * Derive the stable mutation identity for a review write.
 *
 * mutationKey  = sha256(runId | turnId | targetKind:targetId | payloadChecksum)
 * payloadChecksum = 'sha256:' + sha256(<the review body as composed by the caller>)
 * mutationId   = first 16 hex of mutationKey (embedded in the posted comment)
 *
 * The checksum is taken over the caller's body (which carries the self-marker but
 * NOT yet the mutation marker) so it is a stable fingerprint of the review CONTENT
 * and does not depend on the id it is about to derive. `finalBody` is the body that
 * actually gets posted, with the mutation marker embedded.
 *
 * @returns {{ payloadChecksum, mutationKey, mutationId, finalBody, targetKind, targetId }}
 */
export function computeMutationIdentity({ runId, turnId, targetKind = DEFAULT_TARGET_KIND, targetId, body }) {
  const payloadChecksum = `sha256:${sha256hex(body)}`;
  const keyMaterial = `${runId ?? ''}|${turnId ?? ''}|${targetKind}:${targetId}|${payloadChecksum}`;
  const mutationKey = sha256hex(keyMaterial);
  const mutationId = mutationKey.slice(0, 16);
  const finalBody = embedMutationId(body, mutationId);
  return { payloadChecksum, mutationKey, mutationId, finalBody, targetKind, targetId };
}

// ── the poster ──────────────────────────────────────────────────────────────

function extractCommentId(res) {
  return res?.id ?? res?.comment_id ?? null;
}

function commentText(c) {
  return String(c?.comment_text ?? c?.text ?? c?.body ?? '');
}

/**
 * Create the guarded ClickUp review poster, backed by the DURABLE outbox store.
 *
 * @param {object} args
 * @param {object} args.client        ClickUp write client: createTaskComment(taskId, body) => { id }
 * @param {object} args.store         durable outbox store (memoryStore | postgresStore):
 *                                       claimWrite, markWriteApplied,
 *                                       markWriteOutcomeUnknown, markWriteRetryPending,
 *                                       markWriteFailed, getWrite
 * @param {object} [args.readClient]  ClickUp read client for ambiguous-timeout reconcile:
 *                                       getTaskComments(taskId) => [{ id, comment_text }]
 * @param {string} [args.allowedTaskId]  override the authorised target (tests only)
 */
export function createClickupReviewPoster({ client, store, readClient = null, allowedTaskId = ALLOWED_CLICKUP_TASK_ID } = {}) {
  if (!client || typeof client.createTaskComment !== 'function') {
    throw new Error('createClickupReviewPoster: client with createTaskComment(taskId, body) is required');
  }
  if (!store || typeof store.claimWrite !== 'function' || typeof store.markWriteApplied !== 'function') {
    throw new Error('createClickupReviewPoster: a durable outbox store (claimWrite/markWriteApplied/...) is required');
  }

  // Search the authorised target's comments for the embedded mutation marker.
  // Returns the matching comment id, or null when absent / no read client.
  async function findByMutationId(taskId, mutationId) {
    if (!readClient || typeof readClient.getTaskComments !== 'function') return null;
    const marker = mutationMarker(mutationId);
    let comments;
    try {
      comments = await readClient.getTaskComments(taskId);
    } catch {
      return null; // a failed read cannot confirm — treat as not-found (safe: leaves state for a later reconcile)
    }
    for (const c of comments ?? []) {
      if (commentText(c).includes(marker)) return extractCommentId(c) ?? c?.id ?? null;
    }
    return null;
  }

  // Reconcile an ambiguous write (post threw a timeout/network error, OR returned no
  // comment id, OR a prior attempt left the row outcome_unknown/retry_pending):
  //   1. SEARCH the target for the embedded mutation_id — if found the write already
  //      succeeded remotely → markWriteApplied(foundId), NO duplicate.
  //   2. If not found → markWriteRetryPending, then a SINGLE bounded retry post. A
  //      retry that yields a real comment id → applied_verified; otherwise the row
  //      is left outcome_unknown for the periodic reconciler (never a false success).
  async function reconcile({ mutationKey, mutationId, taskId, finalBody, reason }) {
    const found = await findByMutationId(taskId, mutationId);
    if (found) {
      const w = await store.markWriteApplied(mutationKey, found);
      return {
        posted: false, taskId, commentId: found, mutationKey, mutationId,
        state: w.state, reason: `reconciled — write already applied remotely (found by mutation_id); NO duplicate [${reason}]`,
      };
    }
    await store.markWriteRetryPending(mutationKey, new Error(`reconcile: mutation_id not found on target; single bounded retry (${reason})`));
    let res;
    let retryErr;
    try {
      res = await client.createTaskComment(taskId, finalBody);
    } catch (e) {
      retryErr = e;
    }
    if (!retryErr) {
      const commentId = extractCommentId(res);
      if (commentId) {
        const w = await store.markWriteApplied(mutationKey, commentId);
        return { posted: true, taskId, commentId, mutationKey, mutationId, state: w.state, retried: true, reason: `retry succeeded [${reason}]` };
      }
      const w = await store.markWriteOutcomeUnknown(mutationKey, new Error('retry response carried no comment id'));
      return { posted: false, taskId, commentId: null, mutationKey, mutationId, state: w.state, retried: true, reason: 'retry produced no comment id; left outcome_unknown for the reconciler' };
    }
    const w = await store.markWriteOutcomeUnknown(mutationKey, retryErr);
    return { posted: false, taskId, commentId: null, mutationKey, mutationId, state: w.state, retried: true, reason: 'retry threw; left outcome_unknown for the reconciler' };
  }

  return {
    allowedTaskId,

    /**
     * Post the review as the ONE bounded comment. All controls enforced, durable and
     * restart-safe.
     *
     * @param {object} args
     * @param {string} args.taskId    MUST equal the authorised control task.
     * @param {string} args.body      the review body (carries the self-marker).
     * @param {string} [args.runId]   provenance for the mutation key + outbox row.
     * @param {string} [args.turnId]
     * @param {string} [args.targetKind]
     * @returns {Promise<{ posted, taskId, commentId, mutationKey, mutationId, state, reason? }>}
     */
    async postReview({ taskId, body, runId = null, turnId = null, targetKind = DEFAULT_TARGET_KIND } = {}) {
      // 1. Target validation — refuse any substitution BEFORE any side effect.
      assertAuthorisedTarget(taskId, allowedTaskId);
      // 3a. Self-marker — the body that gets posted must carry it.
      assertSelfMarker(body);

      // Derive the stable per-mutation identity + the final (marker-embedded) body.
      const { payloadChecksum, mutationKey, mutationId, finalBody, targetId } =
        computeMutationIdentity({ runId, turnId, targetKind, targetId: taskId, body });

      // 4. Redaction — never post a secret (scan the body that actually gets posted).
      assertNoSecret(finalBody);

      // 2. Durable claim BEFORE posting.
      const claim = await store.claimWrite({
        mutationKey, runId, turnId, targetKind, targetId, payloadChecksum, mutationId,
      });

      if (!claim.claimed) {
        const existing = claim.write;
        // Already verified → idempotent success, DO NOT re-post.
        if (existing.state === 'applied_verified') {
          return {
            posted: false, taskId, commentId: existing.response_id, mutationKey, mutationId,
            state: existing.state, reason: 'already applied_verified (durable idempotent) — not re-posting',
          };
        }
        // Terminal failure — do not re-post; surface for a human/reconciler.
        if (existing.state === 'failed') {
          return {
            posted: false, taskId, commentId: existing.response_id ?? null, mutationKey, mutationId,
            state: existing.state, reason: 'prior attempt failed terminally — not re-posting',
          };
        }
        // In-flight (another attempt holds the claim right now, or a crash left it
        // reserved). Concurrency-safe: DO NOT re-post; the periodic reconciler
        // resolves a stale `applying` row.
        if (existing.state === 'applying') {
          return {
            posted: false, taskId, commentId: null, mutationKey, mutationId,
            state: existing.state, reason: 'in-flight — another attempt holds the claim (state=applying); not re-posting',
          };
        }
        // outcome_unknown / retry_pending → a prior attempt ended ambiguously (e.g. a
        // restart). Reconcile: search for the mutation_id, else a single bounded retry.
        return reconcile({ mutationKey, mutationId, taskId, finalBody, reason: `resume:${existing.state}` });
      }

      // Freshly claimed (state 'applying') → perform the single remote post.
      let res;
      let postErr;
      try {
        res = await client.createTaskComment(taskId, finalBody);
      } catch (e) {
        postErr = e;
      }

      if (!postErr) {
        const commentId = extractCommentId(res);
        if (commentId) {
          const w = await store.markWriteApplied(mutationKey, commentId);
          return { posted: true, taskId, commentId, mutationKey, mutationId, state: w.state };
        }
        // A response WITHOUT a comment id must NEVER reach applied_verified.
        await store.markWriteOutcomeUnknown(mutationKey, new Error('clickup response carried no comment id'));
        return reconcile({ mutationKey, mutationId, taskId, finalBody, reason: 'no-comment-id' });
      }

      // Ambiguous timeout/network error AFTER possibly committing remotely.
      await store.markWriteOutcomeUnknown(mutationKey, postErr);
      return reconcile({ mutationKey, mutationId, taskId, finalBody, reason: 'post-threw' });
    },

    /** Diagnostic: the durable state of a mutation (no side effects). */
    async writeState(mutationKey) {
      const w = await store.getWrite(mutationKey);
      return w ? w.state : null;
    },
  };
}
