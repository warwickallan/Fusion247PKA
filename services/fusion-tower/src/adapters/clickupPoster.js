// Fusion Tower — ClickUp post-review path (the ONE bounded governance write).
//
// This is the guarded surface through which a completed review is posted as a
// SINGLE ClickUp comment on the control task. Every hard control the Tower's write
// posture requires is enforced HERE, once, fail-closed:
//
//   1. TARGET VALIDATION — the ONLY allowed target is control task `869e5zu97`.
//      Any other task id is REJECTED. Target substitution is impossible by
//      construction; a caller cannot redirect the Tower's write elsewhere.
//   2. ONE-WRITE GUARD — at most ONE comment write per review. The path is
//      idempotent/guarded on an idempotency key (default: the target task id); a
//      second call for the same key performs NO live call and returns the prior
//      result. Webhooks/retries cannot double-post.
//   3. SELF-MARKER — the posted body MUST embed the Tower self-marker
//      (`TOWER_SELF_MARKER`, the same token event-intake filters on), so when the
//      Tower's own comment redelivers as a ClickUp event it is recognised as
//      self_generated and NEVER advances a run (self-loop prevention).
//   4. REDACTION — the body MUST NOT contain a credential/token. A secret-shaped
//      string fails the write closed; no secret is ever posted to ClickUp.
//
// The poster performs NO merge and NO destructive action — it posts a comment and
// nothing else. It NEVER logs the ClickUp token (the client owns the credential;
// this module only hands it a task id + a redacted body).

import { TOWER_SELF_MARKER } from './eventIntake.js';

// The single control task the Tower is authorised to write to (BUILD-010 WP0).
// Any other target is refused — see assertAuthorisedTarget().
export const ALLOWED_CLICKUP_TASK_ID = '869e5zu97';

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

/**
 * Create the guarded ClickUp review poster.
 *
 * @param {object} args
 * @param {object} args.client         a ClickUp client: createTaskComment(taskId, body) => { id }
 * @param {string} [args.allowedTaskId]  override the authorised target (tests only)
 */
export function createClickupReviewPoster({ client, allowedTaskId = ALLOWED_CLICKUP_TASK_ID } = {}) {
  if (!client || typeof client.createTaskComment !== 'function') {
    throw new Error('createClickupReviewPoster: client with createTaskComment(taskId, body) is required');
  }
  // One-write guard: idempotency key -> the result of the single write.
  const written = new Map();

  return {
    allowedTaskId,

    /**
     * Post the review as the ONE bounded comment. All four controls enforced.
     * `idempotencyKey` (default: the task id) makes the write at-most-once per
     * review — a second call is a guarded no-op returning the prior result.
     *
     * @returns {Promise<{ posted:boolean, taskId:string, commentId:string|null, reason?:string }>}
     */
    async postReview({ taskId, body, idempotencyKey } = {}) {
      // 1. Target validation — refuse any target substitution BEFORE any side effect.
      assertAuthorisedTarget(taskId, allowedTaskId);
      // 3. Self-marker — the body that gets posted must carry it.
      assertSelfMarker(body);
      // 4. Redaction — never post a secret.
      assertNoSecret(body);

      // 2. One-write guard — at most one live write per review key.
      const key = idempotencyKey ?? taskId;
      if (written.has(key)) {
        const prior = written.get(key);
        return { posted: false, reason: 'already-written (one-write guard)', taskId, commentId: prior.commentId };
      }

      const res = await client.createTaskComment(taskId, body);
      const commentId = res?.id ?? res?.comment_id ?? null;
      const result = { posted: true, taskId, commentId };
      written.set(key, result);
      return result;
    },

    /** Diagnostic: has a write already happened for this key? (no side effects) */
    hasWritten(idempotencyKey) {
      return written.has(idempotencyKey ?? allowedTaskId);
    },
  };
}
