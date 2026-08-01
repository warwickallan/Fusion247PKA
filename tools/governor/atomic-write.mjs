// Windows-safe atomic write (BUILD-018 T-18)
//
// THE DEFECT THIS EXISTS TO FIX (D-5, measured 2026-08-01)
// --------------------------------------------------------
// `health-store.mjs` and `delegation-gate.mjs` each open-coded the same pair:
//
//     writeFileSync(tmpPath, payload)   // unique temp name, per-writer
//     renameSync(tmpPath, filePath)     // <-- no retry
//
// On Windows a rename onto an EXISTING target throws `EPERM` while any other
// process holds that target open. The measured driver is a concurrent READER,
// not writer-vs-writer contention:
//
//   | shape                                  | writer failures | orphaned temps |
//   |----------------------------------------|-----------------|----------------|
//   | 48 concurrent writers, no readers      | 1 / 48  (2.1%)  | 1              |
//   | 24 writers + 24 concurrent readers     | 4 / 24 (16.7%)  | 4              |
//   | 16 writers + 16 concurrent readers     | 7 / 16 (43.8%)  | 7              |
//
// That asymmetry explains why `delegation-gate.mjs` was the flakier of the two
// callers at only 12 concurrent processes: `atomicAppendRecord` READS its own
// target on every call, so it manufactures the very contention that breaks it.
// `writeHealthSample` never reads its target, which is why writers alone barely
// collide — and why a writers-only probe (1/48 before, 0/48 after) is inside the
// noise and proves nothing.
//
// Orphan count tracked failure count 1:1 in every scenario. That is what makes
// the surviving-temp-file count the one witness that does NOT depend on any
// writer's self-report: a swallowed failure still leaves its temp file behind,
// and it cannot remove that file without having actually succeeded.
//
// WHY A PAYLOAD *PRODUCER* AND NOT A PAYLOAD (Larry's ruling on M1)
// -----------------------------------------------------------------
// `atomicAppendRecord` is a read-modify-write: it reads the whole ledger,
// appends its line, and renames the result back over the target. Retrying such
// a write by REPLAYING THE SAME TEMP FILE is a correctness regression, not a
// fix: during the backoff another writer may land its own record, and the later
// successful rename then replaces the file with this writer's stale snapshot —
// converting "lose my one record" into "lose several". That points the wrong way
// against `delegation-gate.mjs`'s own fail-direction doctrine, where a lost
// checkpoint undercounts toward a MISSED deny.
//
// So the payload may be a FUNCTION, re-invoked on every attempt. `delegation-gate`
// passes one that re-runs the whole read-modify-write against the file as it
// stands at that moment; `health-store` passes a constant string, because its
// target is last-write-wins by design and has no prior state to preserve.
//
// WHY THE SLEEP IS SYNCHRONOUS (M3)
// ----------------------------------
// `renameSync` runs inside a PreToolUse hook. An async backoff would return
// control to a caller that has already been told the write is done. `Atomics.wait`
// on a `SharedArrayBuffer` is the zero-dependency synchronous sleep; nothing is
// added to the dependency surface to get it.
//
// The RETRY_BUDGET_MS ceiling is not a performance preference — it is AD-19's
// reasoning applied to this primitive: a gate that gets in the way gets removed,
// and a hook that blocks longer than a quarter-second is in the way.

import { writeFileSync, renameSync, mkdirSync, unlinkSync, existsSync } from 'node:fs';
import { dirname } from 'node:path';
import crypto from 'node:crypto';

// ---------------------------------------------------------------------------
// THE RETRY POLICY — one readable place (AC1), the SIGNAL_KEYS /
// GIT_LIFECYCLE_OPERATIONS precedent. A reviewer settles "what does this retry,
// how often, and for how long" from these four constants and nothing else.
// ---------------------------------------------------------------------------

// Transient Windows sharing failures ONLY. Every other code is rethrown on the
// first attempt (AC2): a genuine ENOENT or ENOSPC must surface immediately and
// truthfully, not be buried under five attempts and reported as a sharing
// problem it never was. This list is also what keeps a caller-injected error
// carrying NO `.code` — the shape `delegation-gate.test.mjs`'s fail-open
// mutation test uses — rethrowing instantly rather than sleeping through the
// whole budget first.
export const RETRYABLE_ERROR_CODES = Object.freeze(['EPERM', 'EBUSY', 'EACCES']);

// Total attempts, including the first. 5 => at most 4 backoff sleeps.
export const MAX_ATTEMPTS = 5;

// The declared ceiling on total blocking time (M2). BACKOFF_MS must sum to at
// most this; `atomic-write.test.mjs` asserts that against a literal held outside
// this file, so the two cannot drift together into agreeing on a wrong answer.
export const RETRY_BUDGET_MS = 250;

// One entry per gap between attempts, so length === MAX_ATTEMPTS - 1.
// Exponential, summing to 150ms.
export const BACKOFF_MS = Object.freeze([10, 20, 40, 80]);

// Each sleep is scaled by a random factor in [1 - JITTER, 1 + JITTER).
//
// MEASURED, not decorative. Without jitter every contending writer backs off on
// the IDENTICAL schedule, so a set of writers that collide once proceeds to
// retry in lockstep and collide again — a thundering herd of this module's own
// making. With 16 concurrent writers against 16 concurrent readers, an
// unjittered backoff still left 2 of 12 runs with a failed writer; jitter
// spreads the retries across the window and closed that gap.
//
// The ceiling is respected in the WORST case, not merely on average:
// sum(BACKOFF_MS) * (1 + JITTER) = 150 * 1.5 = 225ms <= RETRY_BUDGET_MS.
// `atomic-write.test.mjs` asserts that arithmetic against literals.
export const BACKOFF_JITTER = 0.5;

// ---------------------------------------------------------------------------

// Zero-dep synchronous sleep. Atomics.wait blocks the calling thread outright,
// which is the whole point: the caller must not proceed believing the write
// landed while a retry is still pending.
export function sleepSync(ms) {
  if (!(ms > 0)) return;
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
}

export function isRetryableError(err, retryableCodes = RETRYABLE_ERROR_CODES) {
  return Boolean(err) && typeof err.code === 'string' && retryableCodes.includes(err.code);
}

// The jittered delay for the gap AFTER `attempt` (1-based). Exported so the
// worst-case-within-budget property can be asserted directly rather than
// inferred from behaviour.
export function backoffDelayMs(attempt, { backoffMs = BACKOFF_MS, jitter = BACKOFF_JITTER, random = Math.random } = {}) {
  const base = backoffMs[Math.min(attempt - 1, backoffMs.length - 1)];
  return base * (1 - jitter + random() * jitter * 2);
}

/**
 * Write `payload` to `filePath` atomically, retrying a transient Windows
 * sharing failure with bounded backoff, and leaving no temp file behind on ANY
 * path — success, retry-then-success, or permanent failure (AC3).
 *
 * @param {string} filePath   final destination.
 * @param {string|Function} payload  the bytes, or a producer re-invoked per
 *        attempt. Use the producer form whenever the payload is derived from
 *        the CURRENT contents of `filePath` (see the M1 note in the header).
 * @param {object} opts  every fs call is injectable so the mutation proofs can
 *        force a failure without OS-level permission trickery. Options are
 *        forwarded EXPLICITLY by callers, never by spreading a caller's own
 *        opts bag, so a caller option can never be misread as an fs injection.
 * @returns {string} filePath
 */
export function atomicWriteFileSync(filePath, payload, opts = {}) {
  const {
    writeFile = writeFileSync,
    renameFile = renameSync,
    mkdir = mkdirSync,
    unlink = unlinkSync,
    exists = existsSync,
    sleep = sleepSync,
    maxAttempts = MAX_ATTEMPTS,
    backoffMs = BACKOFF_MS,
    jitter = BACKOFF_JITTER,
    random = Math.random,
    retryableCodes = RETRYABLE_ERROR_CODES,
  } = opts;

  mkdir(dirname(filePath), { recursive: true });

  const producePayload = typeof payload === 'function' ? payload : () => payload;

  for (let attempt = 1; ; attempt += 1) {
    // A FRESH temp name per attempt. Reusing the previous attempt's name would
    // re-target a path something may still be holding — the exact condition
    // being retried away from.
    const tmpPath = `${filePath}.tmp-${process.pid}-${crypto.randomBytes(4).toString('hex')}`;
    try {
      writeFile(tmpPath, producePayload());
      renameFile(tmpPath, filePath);
      return filePath;
    } catch (err) {
      if (attempt < maxAttempts && isRetryableError(err, retryableCodes)) {
        sleep(backoffDelayMs(attempt, { backoffMs, jitter, random }));
        continue;
      }
      throw err;
    } finally {
      // Runs on every exit from the try — the successful return, the rethrow,
      // and (before it takes effect) the `continue`. After a successful rename
      // the temp path is already gone, so nothing is removed.
      //
      // A cleanup failure is swallowed DELIBERATELY: it must never replace the
      // real error with a misleading one (AC3). The cost is that a temp file
      // whose own unlink fails survives unreported — which is why the
      // concurrency proof asserts the surviving-temp count directly rather than
      // trusting this block to have worked.
      try {
        if (exists(tmpPath)) unlink(tmpPath);
      } catch {
        /* never mask the original error */
      }
    }
  }
}
