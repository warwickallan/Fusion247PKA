---
build: BUILD-002
wp: WP1
artifact: wp1-drain-contract
status: design-of-record — implemented and test-enforced
author: silas
implemented_by: mack
created: 2026-07-17
implemented: 2026-07-17
enforcement:
  - I1/I2: services/fusion-capture-gateway/test/webhookRpc.integration.test.js (P5, P9) + test/tap-gate-invariant.test.js + static 0006 guards in test/migrations.test.js
  - I3/I4: webhookRpc P6/P7 + webhookE2E E2E-2/E2E-5
  - I5: webhookE2E E2E-3 (restart) + existing WP0 worker suites
  - I6: webhookE2E E2E-4 (card-send kill → redelivery reconciliation); wake-time recoverMissingCards backstop unchanged (WP0 suites)
  - I7: store complete() gate (WP0 suites) exercised on cloud-origin rows in E2E-1..5
  - I8: test/tlsTransportGuards.test.js (static — no intake_transport read in worker/store/claim paths)
  - I9: webhookRpc P2/P12
  - I10: webhookRpc P5 + webhookE2E E2E-6
note: >
  §4.1 confirmed in build — ZERO changes to the claim/drain/retry/lease/complete
  path were needed; the optional §4.3 wake-time transport-count log line was NOT
  added (observability nice-to-have, deferred to keep the worker diff empty).
---

# WP1 Drain Contract — Cloud Intake ↔ Local Yoga Worker

The durable contract between the always-on cloud intake (edge → RPC → fcg rows)
and the local worker that performs the governed Markdown write. Design goal:
**the worker changes as close to zero as possible** — cloud intake produces rows
the WP0 worker already knows how to drain.

## 1. States used — existing enum, no additions

| Cloud event | Row state | Why |
|---|---|---|
| Webhook message accepted (`fcg_webhook_intake` outcome `new`) | `accepted` | Tap-gate hold, identical to local intake. NOT claimable — `accepted` is not in `CLAIMABLE_STATES`, so the worker's hands stay off it by construction. |
| Tap confirmed (`fcg_webhook_confirm_tap` outcome `queued`) | **`offline_queued`** | The cloud cannot verify Yoga liveness, so it ALWAYS uses the offline-honest state. `offline_queued` is already in `CLAIMABLE_STATES` and already carries the correct "Saved and safe — waiting" card copy. If the worker happens to be awake, it claims the row within one cycle — the pessimism costs nothing. |

**Decision: use `offline_queued`, never `queued`, from the cloud.** Justification:
`queued` vs `offline_queued` differ only in the liveness assumption at enqueue
time; the cloud has no truthful basis for the optimistic one. Both are
equivalent "safe and waiting" states in the contract pack (§4) and both are
claimable — no state-machine change, no wording change, no claim-predicate
change. A new state (e.g. `cloud_queued`) was rejected: it would force edits to
`states.js`, the enum, the claim predicate, the projection, and every
transition test, for zero behavioural difference.

## 2. Cloud-queued vs local rows — the worker does NOT distinguish

The claim loop is state-driven and stays transport-blind. `capture_envelope.
intake_transport` (`'poll'`|`'webhook'`, new in 0006) exists for observability
and failure triage ONLY. **Invariant: no worker/claim/retry logic may branch on
`intake_transport`.** A test greps/asserts the worker path never reads it.

## 3. Wake behaviour with a backlog

Unchanged mechanics, stated as the contract:

1. **Claim loop:** `claim()` takes the oldest claimable row (`queued`,
   `offline_queued`, expired-lease `claimed`, or due-retry `failed`/`partial`
   under `MAX_DELIVERY_ATTEMPTS`), ordered `received_at asc, created_at asc`,
   `FOR UPDATE SKIP LOCKED`, lease `leaseMs` (default 30 s), `attempt_count++`.
2. **Drain:** the runner drains to stable after each poll cycle (bounded
   10 000-iteration guard). A wake after a long sleep processes the entire
   cloud backlog one capture at a time, oldest first, each to a terminal or
   parked state before the summary returns.
3. **Backoff:** per-capture failures use the existing `retryPolicy` →
   `next_attempt_at`; the partial index from 0004 keeps the due-retry scan
   cheap. No new backlog-level backoff is introduced — at single-user scale a
   backlog is tens of rows, not thousands; the bounded drain loop and the
   claim ordering are sufficient. (Explicit non-goal: batch claiming.)
4. **Card recovery sweep (`recoverMissingCards`) stays, and now also covers
   cloud rows:** any `accepted` row with `card_ref` null — including a
   webhook-accepted capture whose edge card-send ultimately failed — gets a
   card re-offered on wake, bounded at 3 per cycle. This is the wake-time
   backstop behind the edge's Telegram-retry-driven card reconciliation.
5. **Completion projection:** the worker edits the ORIGINAL card via the
   durable `card_ref` regardless of who sent the card (edge or local adapter).
   0005 shape unchanged; `fcg_webhook_card_ref` writes the identical JSONB.

## 4. What changes in the worker (complete list)

1. **Nothing in the claim/drain/retry/lease/complete path.**
2. The live runner keeps long-polling the LIVE bot exactly as WP0 (binding
   constraint). In webhook-mode proofs (bot B / synthetic), the runner's poll
   loop is simply not the source of updates — the worker piece that matters is
   `drainToStable` + `recoverMissingCards` + the completion projection, all of
   which operate on store state, not on the transport.
3. Optional (recommended, small): a wake-time log line counting claimable rows
   by `intake_transport` — observability only.

## 5. Ordering guarantees — and explicit non-guarantees

**Guaranteed:**
- Per-capture state monotonicity: every capture follows the contract-pack §4
  machine; `completed` only via `written` → `evidenced`; enforced by
  `assertTransition` + the store's gated `complete()`.
- Drain order among claimable rows: oldest `received_at` first (tie:
  `created_at`). A backlog drains in arrival order.
- Exactly one envelope, one Markdown note, one completion per logical capture,
  regardless of transport, redelivery count, restarts, or duplicate taps.

**Explicitly NOT guaranteed:**
- Global cross-transport ordering: a poll-accepted and a webhook-accepted
  capture that arrive near-simultaneously may complete in either order.
- Card-edit ordering relative to state: card edits are retryable projections;
  a card may lag its capture's true state (never the reverse — wording is
  derived from durable state at projection time).
- Tap-to-claim latency: an `offline_queued` row waits until the next wake;
  no cloud component ever performs the governed write (hard boundary).

## 6. Invariants a test MUST assert (the contract's teeth)

| # | Invariant | Enforced by |
|---|---|---|
| I1 | No path other than local `confirmSave` (with `confirmedByTap:true`) or cloud `fcg_webhook_confirm_tap` (callback-backed, SaveToBrain, allowlisted) moves a row out of `accepted` to a queue state | store throw + RPC state check; tests: tap-gate matrix |
| I2 | `fcg_webhook_confirm_tap` transitions ONLY `accepted → offline_queued`; every other from-state returns an honest no-op outcome and leaves state untouched | RPC body; integration test per state |
| I3 | One `capture_envelope` + one `idempotency_key` row per logical capture across N redeliveries × both transports | ledger PK + idempotency PK; replay tests |
| I4 | At most one `channel_update_dedup` row per `(channel, update_id)` | PK; duplicate-POST test |
| I5 | Worker restart mid-anything never loses a capture, never writes a duplicate note, never falsely completes | lease expiry + idempotent write + gated complete; restart tests |
| I6 | A cloud-accepted capture with a lost card is never stranded: edge reconciliation (Telegram redelivery) OR wake-time `recoverMissingCards` re-offers it | duplicate-outcome `has_card_ref` + sweep; test kills the card send |
| I7 | `completed` unreachable without destination_ref + evidence pointer | store `complete()` gate; existing tests extended to cloud-origin rows |
| I8 | No worker logic branches on `intake_transport` | code assertion/test |
| I9 | anon/authenticated can neither EXECUTE any `fcg_webhook_*` RPC nor touch any `fcg.*` table | grants + RLS; SET ROLE integration tests |
| I10 | Unauthorised sender through the RPC leaves ZERO rows (no envelope, no ledger, no identity) | RPC ordering; integration test |
