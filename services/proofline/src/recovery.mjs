// Proofline — the recovery predicate.
//
// This is the whole of D-6, and it is deliberately a tiny exported PURE
// function that the worker receives by injection (D-6c). Two reasons, and
// neither is style:
//
//   1. The mutation tests T-6a and T-6b need a seam. Rewriting source text
//      mid-run is fragile and can leave the tree dirty; injecting a predicate
//      cannot.
//   2. The epoch comparison IS the worker's only protection against
//      re-queueing its own in-flight job. There is no second, in-memory
//      "busy" flag guarding that — deliberately. An in-memory guard would
//      mask this predicate and the epoch would stop being load-bearing, which
//      is exactly the condition D-6b exists to prevent.
//
// The epoch is a journal-persisted, monotonically increasing integer allocated
// at startup and fsynced before any lease. So:
//
//   - at STARTUP, any `processing` job carries a PREVIOUS epoch ⇒ orphaned;
//   - while LIVE, this process's own in-flight job carries the CURRENT epoch
//     ⇒ not orphaned, and the periodic scan leaves it alone.
//
// At startup alone the epoch is not load-bearing — with one process, "epoch
// mismatch" and "any processing job at startup" are the same set. It earns its
// place in the live scan.

/** Maximum number of leases a job may take before it is abandoned (map §5.3). */
export const MAX_ATTEMPTS = 3;

/**
 * Is this job stranded by a process that is no longer running?
 *
 * @param {object|null} job
 * @param {number} currentEpoch
 * @returns {boolean}
 */
export function isOrphaned(job, currentEpoch) {
  if (!job) return false;
  if (job.state !== 'processing') return false;
  return job.epoch !== currentEpoch;
}
