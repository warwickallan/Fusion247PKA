// F-04 — per-sender flood control (token bucket).
//
// Source of truth: wp0-security-gate.md §5 "Rate limiting / flood control":
// inbound handling is bounded so a burst — even from the authorised user, or
// spoof attempts before allowlist rejection — cannot exhaust the worker or the
// write path.
//
// DETERMINISTIC: no wall-clock. `now` (epoch ms) is injected on every check, so
// bursts, throttling, and refill-over-time are all reproducible in unit tests.
//
// Model: a classic token bucket per sender id. Each sender starts with a full
// bucket of `capacity` tokens. Each accepted message spends one token. Tokens
// refill continuously at `refillPerSec`. When the bucket is empty a message is
// throttled and `retryAfterMs` says how long until the next token is available.
// Fail-CLOSED: excess is REJECTED (no durable capture), never silently accepted.

/**
 * @param {object} opts
 * @param {number} opts.capacity      max burst — bucket size in tokens (> 0).
 * @param {number} opts.refillPerSec  steady-state token refill rate (> 0).
 * @returns {{ check(senderId:string, now:number): { allowed:boolean, retryAfterMs:number, remaining:number } }}
 */
export function createRateLimiter({ capacity, refillPerSec } = {}) {
  if (typeof capacity !== 'number' || !Number.isFinite(capacity) || capacity <= 0) {
    throw new Error('createRateLimiter: positive numeric `capacity` required');
  }
  if (typeof refillPerSec !== 'number' || !Number.isFinite(refillPerSec) || refillPerSec <= 0) {
    throw new Error('createRateLimiter: positive numeric `refillPerSec` required');
  }

  const refillPerMs = refillPerSec / 1000;

  // senderId -> { tokens:number, lastMs:number }
  const buckets = new Map();

  function bucketFor(senderId, now) {
    let b = buckets.get(senderId);
    if (!b) {
      b = { tokens: capacity, lastMs: now };
      buckets.set(senderId, b);
      return b;
    }
    // Continuous refill since we last saw this sender, clamped to capacity.
    const elapsed = now - b.lastMs;
    if (elapsed > 0) {
      b.tokens = Math.min(capacity, b.tokens + elapsed * refillPerMs);
      b.lastMs = now;
    }
    return b;
  }

  return {
    /**
     * Charge one token for an inbound message from `senderId` at `now`.
     * Returns `{ allowed, retryAfterMs, remaining }`. When throttled, `allowed`
     * is false and `retryAfterMs` is the wait until one whole token is available.
     */
    check(senderId, now) {
      if (senderId === undefined || senderId === null || senderId === '') {
        throw new Error('rateLimiter.check: senderId required');
      }
      if (typeof now !== 'number' || !Number.isFinite(now)) {
        throw new Error('rateLimiter.check: injected numeric `now` (epoch ms) required');
      }
      const key = String(senderId);
      const b = bucketFor(key, now);

      if (b.tokens >= 1) {
        b.tokens -= 1;
        return { allowed: true, retryAfterMs: 0, remaining: Math.floor(b.tokens) };
      }

      // Throttled: how long until the bucket accrues one full token.
      const deficit = 1 - b.tokens;
      const retryAfterMs = Math.ceil(deficit / refillPerMs);
      return { allowed: false, retryAfterMs, remaining: 0 };
    },
  };
}
