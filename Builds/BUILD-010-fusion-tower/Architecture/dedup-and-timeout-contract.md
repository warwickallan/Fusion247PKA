---
build: BUILD-010
component: Fusion Tower / Governance Mode
wp: WP0
artifact: dedup-and-timeout-contract
status: draft-for-wp0
author: silas
created: 2026-07-17
---

# Fusion Tower — Dedup & Timeout Contract (WP0)

Parent build: [[BUILD-010-fusion-tower]]

The precise rules that keep the governance loop **safe under redelivery, self-loops,
crashes, and runaway rounds**. Every rule maps to a schema constraint in
`services/fusion-tower/migrations/0001_wp0_control_plane.sql`; the intent is that any
runner implementing the loop gets these guarantees from the database, not from clever
application code. Companion: `control-plane-schema.md`.

Governing principle: **at-least-once delivery, exactly-once effect.** Webhooks and task
changes arrive duplicated and out of order; the schema's dedup keys turn "delivered N
times" into "advanced the run once."

## 1. Event dedup

### 1.1 Primary key: `(source, source_event_id)`

`run_event_source_eventid_key` is a UNIQUE constraint on `(source, source_event_id)`.

- **Rule.** Every inbound event is ingested with `INSERT ... ON CONFLICT (source,
  source_event_id) DO NOTHING`. A redelivered webhook (GitHub retries, ClickUp resends)
  maps to the SAME row and is a no-op at ingest.
- **`source_event_id` is required** (`NOT NULL`). An event with no stable native id
  (GitHub `X-GitHub-Delivery`, ClickUp event id, Telegram update id) cannot be deduped;
  upstream must mint a deterministic synthetic id (e.g. a content hash) before ingest.
  A random id would defeat dedup and is a bug.
- **Effect boundary.** Ingest dedup only guarantees one *row*. Advancing the run off that
  row is separately guarded by the `processed` flag (§1.4) so a re-seen event never
  double-advances even if it somehow bypassed the unique insert.

### 1.2 Secondary key (GitHub): `(source, head_sha, kind)`

`run_event_source_headsha_kind_key` is a PARTIAL UNIQUE index on `(source, head_sha,
kind) WHERE head_sha IS NOT NULL`.

- **Why.** GitHub emits multiple deliveries for the same logical state: a `check_suite`
  can be reported by several apps, a push can re-fire checks, and a rerun repeats the
  same `head_sha`. Deduping on the native delivery id alone would let the same
  "checks green on sha abc123" advance a run several times.
- **Rule.** For GitHub events carrying a head sha, `(github, head_sha, kind)` is unique.
  The second "check_suite.completed for sha abc123" is rejected/ignored — the run already
  saw that terminal check state for that commit.
- **Partial** so non-GitHub events (no head sha) are unaffected; a NULL `head_sha` never
  participates in this index.

### 1.3 Self-loop ignore

`run_event.source = 'tower'` and/or `run_event.self_generated = true` marks events the
Tower itself produced (it comments on a PR, moves a task, posts a card).

- **Rule.** The advance loop **ignores self-generated events** for state transitions. The
  Tower must never advance a run off its own output — that is an infinite loop generator.
- Self-generated events may still be *recorded* (audit/trace) but are filtered out of the
  "does this event move the run?" decision. Practically: the advance query excludes
  `self_generated = true` (and typically `source = 'tower'`).

### 1.4 The `processed` flag (advance-once)

- **Rule.** The loop selects unprocessed, non-self events bound (or bindable) to a run,
  applies the transition, and sets `processed = true, processed_at = now()` in the SAME
  transaction as the run/turn state change. An event is consumed exactly once.
- `run_event_unprocessed_idx` (partial on `received_at WHERE processed = false`) keeps the
  backlog scan cheap. Combined with §1.1/§1.2 dedup, redelivery is safe end to end: no
  lost events, no double advance.

## 2. Turn idempotency

`run_turn_run_ordinal_key` is UNIQUE on `(run_id, ordinal)`.

- **Rule.** A logical turn is identified by `(run_id, ordinal)`, not by `turn_id`.
  Dispatch uses `INSERT ... ON CONFLICT (run_id, ordinal) DO UPDATE` (or `DO NOTHING`
  then read) so a re-dispatch — after a crash between "row written" and "responder
  actually invoked" — maps to the SAME turn instead of minting a duplicate.
- **Monotonic ordinals.** Ordinals are assigned by the Tower per run, strictly increasing
  from 1 (`run_turn_ordinal_positive_chk`). A retry after a `failed`/`timed_out` turn is a
  NEW ordinal (a new turn), not a mutation of the old one — the failed turn stays in the
  ledger for audit. This keeps the turn history append-only and replayable.
- **Signed-return idempotency.** A responder returning the same signed result twice is
  absorbed by the turn already being in `returned`; the loop treats a second return for an
  already-`returned` turn as a no-op (it checks state before writing).

## 3. The 5-minute dead-man watchdog

A dispatched turn that never returns must not hang the run. The lease is the dead-man
switch.

### 3.1 Lease encoding

- On dispatch: `state = 'dispatched'`, `dispatched_at = now()`, `lease_deadline_at =
  now() + interval '5 minutes'`. The `run_turn_dispatched_has_lease_chk` CHECK guarantees
  a dispatched turn ALWAYS carries both timestamps, so no dispatched turn can escape the
  sweep.
- Optional heartbeat: a responder that acknowledges (`in_progress`) MAY extend the lease
  by re-stamping `lease_deadline_at`. WP0 keeps a flat 5-minute window; heartbeat
  extension is a forward-compatible option, not required.

### 3.2 The sweep (dispatched → timed_out)

```sql
UPDATE ftw.run_turn
   SET state = 'timed_out', updated_at = now()
 WHERE state = 'dispatched'
   AND lease_deadline_at <= now();
```

- `run_turn_watchdog_idx` (partial on `lease_deadline_at WHERE state = 'dispatched'`)
  makes this an index range scan over only the live dispatched turns.
- The sweep is **idempotent and safe to run on any cadence** — it only ever moves an
  expired dispatched turn to `timed_out`; a turn that returned first is no longer
  `dispatched` and is untouched (no race clobber of a genuine return).

### 3.3 timed_out → terminal (run level)

A reaped turn forces a Tower decision:

1. **Retry within budget** — if `round_count < max_rounds` and time/token budget remains,
   dispatch a NEW turn (next ordinal), run stays `active`/`awaiting_responder`.
2. **Escalate/terminate** — otherwise transition the run to `status = 'timed_out'`,
   `terminal_outcome = 'timed_out'`. Warwick sees a terminal timeout, never a hang.

`governance_run_terminal_outcome_chk` forbids writing a terminal outcome while the run is
still live, so the two steps of terminalisation (status + outcome) stay consistent.

## 4. Max-rounds enforcement

- `governance_run_round_within_max_chk` (`round_count <= max_rounds`) is a hard DB
  invariant — the run row physically cannot record more rounds than its cap.
- **Rule.** The Tower increments `round_count` at the close of each round and refuses to
  open a new round when `round_count = max_rounds`. Hitting the cap without resolution
  terminates the run: `status = 'timed_out'` (budget exhausted) or `status = 'blocked'`
  with `terminal_outcome = 'blocked'` / `'decision_required'` if a human is needed.
- Token/time budgets (`token_spent <= token_budget`, `now() <= deadline_at`) are the same
  shape of ceiling and terminate the run identically when breached. (WP0 may enforce these
  in the loop and defer strict DB CHECKs — see open question in `control-plane-schema.md`
  §9.)

## 5. Combined guarantee

With §1–§4 together, the loop is **crash-safe and redelivery-safe**:

- A webhook delivered 3×, plus 2 self-generated echoes, plus a rerun on the same sha →
  advances the run **once** (event PK + head-sha partial-unique + self-loop filter +
  `processed`).
- A worker crash mid-dispatch → the same `(run_id, ordinal)` re-dispatches to the SAME
  turn (no duplicate turn), and if the responder went silent the watchdog reaps it within
  5 minutes.
- A chatty or looping responder → bounded by `max_rounds` and the token/time budget; the
  run always reaches a terminal, human-visible outcome.
- No governed content is stored to make any of this work — only pointers and the loop's
  own bookkeeping.

## 6. Invariant checklist (for the runner / test suite)

1. Duplicate `(source, source_event_id)` insert yields exactly one row.
2. Duplicate `(github, head_sha, kind)` (head_sha not null) yields exactly one advancing
   row.
3. `self_generated = true` / `source = 'tower'` events never advance run state.
4. An event advances a run at most once (`processed` flips exactly once, transactionally).
5. Duplicate dispatch of `(run_id, ordinal)` yields exactly one turn.
6. A dispatched turn always has `dispatched_at` and `lease_deadline_at` (CHECK).
7. The watchdog moves only expired dispatched turns to `timed_out`; a returned turn is
   never clobbered.
8. `round_count` never exceeds `max_rounds` (CHECK); the run terminates at the cap.
9. `terminal_outcome` is set only when `status` is terminal (CHECK).
10. RLS denies `anon`/`authenticated` on every table; only `service_role` transacts.
