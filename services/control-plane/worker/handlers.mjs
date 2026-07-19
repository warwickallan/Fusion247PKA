// BUILD-014 WP-B — pluggable handler registry.
//
// A handler is `async (ctx) => result | throws`. One handler per jobType (== queue).
// The runtime (worker.mjs) supplies ctx with:
//   ctx.job        the claimed ops.job row
//   ctx.workerId   the leasing worker's id
//   ctx.attempt    this lease's attempt number (from job.attempts)
//   ctx.effectKey(name)   the runtime-derived, INJECTIVE delivery_key for an idempotent
//                         effect, scoped to the unit of work (idempotency_key) so it is
//                         identical across retries -> the effect lands EXACTLY ONCE. The key
//                         is a hash of a versioned (idempotency_key, name) tuple, so any ':'
//                         in either component can no longer collide two distinct effects.
//                         NOTE: this key governs EXTERNAL-effect idempotency ONLY (dedup of the
//                         ledger row that represents the side effect). It is NOT a lease token
//                         and does NOT fence completion — stale-lease protection is enforced
//                         separately by ops.complete_job's owner guard (see LEASE-FENCING below).
//   ctx.emit(eventKind, opts)   buffer an ops.agent_event written ATOMICALLY with
//                         ops.complete_job (effect + completion commit together, or roll back
//                         together if this worker's lease is stale). Choose ONE of:
//                           { effect: '<name>' }  -> idempotent effect (exactly-once across
//                                                    retries); the delivery key is derived,
//                                                    never hand-crafted. PREFERRED.
//                           { deliveryKey: '<k>' } -> a caller-scoped custom key. It is
//                                                    REJECTED if it lands in a reserved
//                                                    namespace ('job:' lifecycle / 'effect:'),
//                                                    else namespaced under this job's own
//                                                    'custom:' segment (no cross-job collision).
//                           (neither)             -> a fresh per-attempt event keyed
//                                                    job:<id>:attempt:<n>:evt:<eventKind>:<seq>.
//                                                    The 'evt:' segment sits BEFORE the caller
//                                                    kind so it can never occupy a reserved
//                                                    lifecycle slot, and <seq> (a per-emit
//                                                    counter) keeps repeated same-kind emits in
//                                                    one attempt distinct. eventKind MUST NOT
//                                                    contain ':' (rejected loudly).
//                         opts also takes { payload?, actor?, classification?, buildId? }.
//
// RESULT CONTRACT (fix 2): a handler MUST return an explicit { status } of exactly
// 'succeeded' or 'failed'. Any other value — undefined, a typo'd or unknown status — is
// NOT treated as success: it routes through the crash-equivalent failure/retry path, so
// ambiguous work is never silently lost.
//   - { status: 'succeeded' }  -> terminal success.
//   - { status: 'failed' }     -> graceful, handler-decided failure -> back to 'pending'
//                                 for retry (or 'dead_letter' once the budget is exhausted).
//   - THROW                    -> crash-equivalent: the job is NOT completed; its lease
//                                 expires and the reclaim ticker returns it for retry (or
//                                 dead-letters it once the attempt budget is exhausted).
//
// ERROR-TEXT CONSTRAINT (fix 2): a thrown error's message is NEVER persisted to the ledger
// or logs — NOT even a message-derived summary. Only a sanitised, NON-MESSAGE-DERIVED shape
// is recorded: { errorClass (from a known set; unknown -> 'Error'), errorCode (validated to a
// known SQLSTATE / Node-errno shape, else null), correlationId, messageLength }. Do NOT rely
// on full error text surviving; put any diagnostic detail you need in explicit, correctly
// classification-tagged ctx.emit payload fields.
//
// LEASE-FENCING CONSTRAINT (DEFERRED — see README): completion is fenced by lease OWNER
// NAME only (ops.complete_job requires status='leased' AND lease_owner=workerId). There is
// no per-lease token yet (that needs a WP-A schema change). Therefore every worker instance
// MUST use a UNIQUE workerId — two live workers sharing an id could each pass the ownership
// guard for the other's lease. True token-based fencing is tracked as a follow-up.

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
