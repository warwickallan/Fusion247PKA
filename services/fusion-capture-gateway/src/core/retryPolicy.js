// Deterministic bounded-retry backoff policy (WP0 §6 — Sonnet review fix).
//
// FIXTURES ONLY: pure logic, no I/O, no wall-clock. Callers always inject `now`.
//
// WHY THIS EXISTS: WP0 claims retry / retry-exhaustion / dead-letter behaviour
// (contract pack, status-line copy "will be retried", BUILD records). Before
// this module, nothing in `src/` actually scheduled a retry — only a TEST-ONLY
// helper simulated it. This is the real backoff calculation the store and
// worker use to make that claim true: a failed item becomes claimable again no
// earlier than `now + backoff(attemptCount)`, capped, so a hot-looping worker
// cannot hammer a permanently-broken destination.

export const BASE_BACKOFF_MS = 1_000; // 1s
export const MAX_BACKOFF_MS = 60_000; // capped at 1 minute for WP0 fixtures

/**
 * Compute the epoch-ms a failed/partial item becomes claimable again.
 *
 * @param {number} attemptCount  attempt_count AFTER the failure just recorded
 *   (i.e. the Nth attempt that just failed; N >= 1). Exponential: 1s, 2s, 4s,
 *   8s, ... capped at MAX_BACKOFF_MS.
 * @param {number} nowMs  injected current time (epoch ms) — the failure moment.
 * @returns {number} next_attempt_at_ms
 */
export function computeNextAttemptAtMs(attemptCount, nowMs) {
  if (!Number.isInteger(attemptCount) || attemptCount < 1) {
    throw new Error('computeNextAttemptAtMs: attemptCount must be a positive integer');
  }
  if (typeof nowMs !== 'number' || !Number.isFinite(nowMs)) {
    throw new Error('computeNextAttemptAtMs: nowMs must be a finite number (injected epoch ms)');
  }
  const backoff = Math.min(BASE_BACKOFF_MS * (2 ** (attemptCount - 1)), MAX_BACKOFF_MS);
  return nowMs + backoff;
}
