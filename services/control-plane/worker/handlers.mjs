// BUILD-014 WP-B — pluggable handler registry.
//
// A handler is `async (ctx) => result | throws`. One handler per jobType (== queue).
// The runtime (worker.mjs) supplies ctx with:
//   ctx.job        the claimed ops.job row
//   ctx.workerId   the leasing worker's id
//   ctx.attempt    this lease's attempt number (from job.attempts)
//   ctx.effectKey(name)   a STABLE delivery_key for an idempotent effect event, scoped
//                         to the unit of work (idempotency_key) so it is identical across
//                         retries -> the effect lands EXACTLY ONCE (at-least-once delivery,
//                         exactly-once effect).
//   ctx.emit(eventKind, { payload?, deliveryKey?, actor?, classification?, buildId? })
//                         buffer an ops.agent_event to be written ATOMICALLY with
//                         ops.complete_job (so effect + completion commit together, or
//                         roll back together if this worker's lease is stale).
//
// Return { status: 'succeeded' } (default) or { status: 'failed' } for a graceful,
// handler-decided failure. THROW to signal a crash-equivalent failure: the job is NOT
// completed, its lease simply expires and the reclaim ticker returns it for retry (or
// dead-letters it once the attempt budget is exhausted).

export class HandlerRegistry {
  #handlers = new Map();

  register(jobType, fn) {
    if (!jobType) throw new Error('register: jobType is required');
    if (typeof fn !== 'function') throw new Error(`register: handler for ${jobType} must be a function`);
    this.#handlers.set(jobType, fn);
    return this;
  }

  get(jobType) {
    return this.#handlers.get(jobType);
  }

  has(jobType) {
    return this.#handlers.has(jobType);
  }

  jobTypes() {
    return [...this.#handlers.keys()];
  }
}
