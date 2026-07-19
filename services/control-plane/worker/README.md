# BUILD-014 WP-B — Durable Worker Runtime & Append-only Event Ledger

The runtime layer over the WP-A `ops` schema
(`services/control-plane/db/migrations/001_control_plane_min_schema.sql`). It turns the
durable queue (`ops.job`) and the append-only ledger (`ops.agent_event`) into a working
at-least-once worker whose **effects are exactly-once**.

> **DEV-only design artifact.** Point `DATABASE_URL` at an **isolated dev Postgres** only.
> This runtime is never aimed at any live/prod project, and it never touches the `asdair`
> schema or any personal/entrusted data. The WP-A migration is applied only into throwaway
> dev databases by the test runner.

## What it is

| File | Responsibility |
|---|---|
| `db.mjs` | pg `Pool` factory + **fail-fast** `DATABASE_URL` validation. |
| `events.mjs` | `appendEvent()` — idempotent insert into `ops.agent_event` (ON CONFLICT on the unique `delivery_key`); `hashPayload()`. |
| `enqueue.mjs` | `enqueue()` — insert `ops.job`; a duplicate `idempotency_key` does **not** create a second job. |
| `handlers.mjs` | `HandlerRegistry` — pluggable `async (ctx) => result` handler per job type. |
| `worker.mjs` | `Worker` (claim → handle → append events → complete) and `Reclaimer` (lease-expiry recovery ticker). |
| `index.mjs` | Public exports + an **opt-in** manual entrypoint. Never auto-launches on import. |
| `test/` | DB-gated runtime proofs + the hermetic `run-worker-tests.mjs` runner. |

The queue itself is **not** re-implemented in application code: claim/complete/reclaim are
the WP-A transactional functions `ops.claim_job`, `ops.complete_job`,
`ops.reclaim_expired_leases` (`FOR UPDATE SKIP LOCKED`, lease-guarded completion).

## The correctness model (at-least-once delivery → exactly-once effect)

1. **Claim.** `ops.claim_job(queue, worker, leaseSeconds)` atomically leases one eligible
   job with `FOR UPDATE SKIP LOCKED` and increments `attempts`. N concurrent workers get
   **distinct** jobs — no double-claim.
2. **Claim evidence.** A per-attempt `job.claimed` event is appended immediately, so the
   attempt is on record even if the worker then dies.
3. **Handle.** The pluggable handler runs. It buffers effect events via `ctx.emit(...)` and
   chooses a **stable** `ctx.effectKey(name)` for its idempotent effect — the key is scoped
   to the unit of work (`idempotency_key`), so it is identical across retries.
4. **Complete atomically.** In **one transaction on a pinned client**: the buffered effect
   events + a terminal event are inserted (`ON CONFLICT (delivery_key) DO NOTHING`), then
   `ops.complete_job(id, worker, status)` runs. `complete_job` is guarded by
   `status='leased' AND lease_owner=worker` — a worker whose lease already
   expired-and-was-reclaimed matches **no row** and raises `restrict_violation` (23001), so
   the whole transaction (including its buffered effect) **rolls back**. The live
   leaseholder is never clobbered; a stale worker can never double-apply the effect.
5. **Crash / throw = retry.** A handler that **throws** is treated exactly like a crashed
   worker: the job is **not** completed. Its lease expires, the reclaim ticker returns it to
   `pending` (or parks it in `dead_letter` once `attempts` reaches `max_attempts`), and it is
   retried. The stable effect key means the retry's effect collides with any prior one →
   exactly-once effect.

**Exactly-once effect** therefore rests on two schema invariants working together: the
unique `delivery_key` on `ops.agent_event` (dedup) and the lease-guarded `complete_job`
(no stale double-commit). The effect and its completion commit **together or not at all**.

### Graceful failure vs crash

- **Throw** → crash-equivalent → lease-expiry retry path (spec default).
- **Return `{ status: 'failed' }`** → a handler-decided graceful failure → `complete_job(…,
  'failed')` returns the job to `pending` (or `dead_letter` when exhausted) immediately.
- **Return anything else** (undefined, a typo'd/unknown status) → **NOT success**. The result
  status is allow-listed to exactly `succeeded | failed`; any other value routes through the
  crash-equivalent failure/retry path, so ambiguous work is never silently completed.

### Effect keys are injective

`ctx.effectKey(name)` (and the sanctioned `ctx.emit(eventKind, { effect: name })` form) derive
the effect's `delivery_key` as `effect:v1:<sha256 of JSON.stringify(['v1', idempotency_key,
name])>`. Hashing an unambiguously-encoded tuple means a `:` in either the idempotency key or
the effect name can no longer flatten two **distinct** effects onto the same key (the old
`effect:${key}:${name}` template could). A hand-crafted `deliveryKey` that lands in a reserved
runtime namespace (`job:` lifecycle or `effect:`) is **rejected**, never read as an
already-delivered success; an allowed caller key is namespaced under the job's own
`job:<id>:custom:` segment so it cannot collide across jobs.

### Error text is sanitised

A thrown handler error is reduced to non-sensitive metadata before it reaches the logs or the
append-only `ops.agent_event` ledger: `{ errorClass, errorCode, correlationId, messageLength,
summary }`, where `summary` is allow-list-filtered and length-capped. The raw message is
**never** persisted — it can carry payload/secret fragments. Handlers MUST NOT rely on full
error text surviving; put diagnostic detail in explicit, classification-tagged `ctx.emit`
payload fields.

### Ledger fidelity — reclaim & dead-letter are on the ledger

`Reclaimer.tick` emits an idempotent `job.lease_reclaimed` (leased→pending) or
`job.dead_lettered` (leased→dead_letter) event per reclaimed row, keyed per attempt; a
graceful-failed completion that exhausts the retry budget also emits `job.dead_lettered`
inside its completion transaction. The full lifecycle is therefore reconstructable from
`ops.agent_event` alone. Non-succeeded terminal events are keyed **per attempt**
(`job:<id>:attempt:<n>:terminal:failed`) so a second graceful failure does not dedup against
the first; `terminal:succeeded` stays a per-job singleton.

### ⚠️ Lease fencing is by OWNER NAME only — workerId MUST be unique per instance (DEFERRED)

Completion is fenced by lease **owner name**: `ops.complete_job` requires
`status='leased' AND lease_owner=workerId`. There is **no per-lease fencing token** yet — that
needs a WP-A schema change (a token returned by `claim_job` and required by `complete_job`),
which is out of scope for this work package and **deferred**. Consequently:

> **Every worker instance MUST use a UNIQUE `workerId`.** Two live workers sharing an id could
> each satisfy the ownership guard for the other's lease, so name-collision defeats the
> stale-lease protection. Do not derive `workerId` from something non-unique (host name alone,
> a fixed constant, etc.). True token-based fencing is tracked as a follow-up on WP-A.

## NOTIFY / Realtime is optional and unused

Correctness rests **entirely on polling + `claim_job`**. There is no `LISTEN`/`NOTIFY`
anywhere in this runtime. A wake-hint could be layered later purely as a latency
optimisation, but nothing here depends on it — proof #6 runs the whole flow with no
notification mechanism at all.

## Event ledger ordering

`appendEvent` stamps `occurred_at` with `clock_timestamp()` (not `now()`). `now()` is fixed
at transaction start, so several events emitted inside one completion transaction would tie;
`clock_timestamp()` advances between the sequential inserts, giving the ledger a
deterministic emission order that reconstructs the lifecycle faithfully:
`job.enqueued → job.claimed → <handler events> → job.<terminal>`.

## Running the proofs

The proofs run against **real Postgres** and are DB-gated but never silently self-skipping
(a skip is not a pass — the runner fails on 0 executed subtests).

```bash
# hermetic: provisions a throwaway Postgres cluster, runs, tears down
#   needs initdb/pg_ctl/postgres on PATH, or set POSTGRES_BIN
node worker/test/run-worker-tests.mjs

# or the whole control-plane suite (WP-A schema proofs + WP-B runtime proofs)
npm test

# against your own isolated dev DB
DATABASE_URL=postgres://…/scratch node --test worker/test/worker-runtime.test.js
```

The proofs: (1) one job + N concurrent workers → exactly one claim (multi-connection);
(2) crash mid-lease → reclaim → another worker completes exactly once (real interleaving —
the stale completion is rejected and rolled back); (3) duplicate enqueue → one job, one
effect; (4) `attempts` increment on retry, `dead_letter` after `max_attempts`; (5)
append-only ledger reconstructs the full lifecycle and stays immutable; (6) polling-only
correctness with NOTIFY disabled. **Round-2 review fixes:** (7) effect-key injectivity with
`:` in the idempotency key/name; (8) a malformed handler return is not success; (9) enqueue
atomicity — neither the job nor the enqueued event commits alone; (10) a caller `deliveryKey`
in the reserved lifecycle namespace is rejected; (11) reclaimer emits idempotent
lease_reclaimed / dead_lettered ledger events; (12) graceful-failed → pending → retried →
effect exactly once, with per-attempt terminals; (13) graceful-failed at `max_attempts` →
`dead_letter`; (14) cross-queue idempotency-key reuse is refused; (15) concurrent same-key
enqueues → one job + one enqueued event.

## Manual run (never auto-launched)

`index.mjs` exposes a demo runtime that starts **only** when the file is the process
entrypoint. The former `WORKER_MAIN=1` ambient trigger has been **removed** — no environment
variable can make `import`ing this module start timers or DB work. Importing the module is
inert. To run it yourself:

```bash
DATABASE_URL=postgres://…/scratch QUEUES=demo node worker/index.mjs
# SIGINT/SIGTERM triggers graceful shutdown (stop loop + reclaimer, drain, close pool)
```

CI: `.github/workflows/control-plane-tests.yml` runs both suites against a `postgres:16`
service container (`REUSE_DATABASE_URL=1`), 0-executed-subtest guard intact.
