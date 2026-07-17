---
build: BUILD-010
component: Fusion Tower / Governance Mode
wp: WP0
artifact: control-plane-schema
status: draft-for-wp0
author: silas
created: 2026-07-17
---

# Fusion Tower — Control-Plane Schema (WP0)

Parent build: [[BUILD-010-fusion-tower]]

This artifact defines the durable operational shape of the Fusion Tower governance
control plane: the tables, the run and turn state machines, the dedup/idempotency
invariants, the watchdog/timeout model, and how evidence binds to GitHub/ClickUp
without storing content. It is a **design/spec only** — no project is provisioned
and no migration is applied live by this work package. The migration artifact is
`services/fusion-tower/migrations/0001_wp0_control_plane.sql`; Larry gates any live
apply.

## 0. Source-of-truth boundary (inherited, non-negotiable)

Fusion Tower reuses BUILD-002's settled boundary. Supabase is **durable
operational state** for the governance loop — never the canonical Brain.

| Layer | Authority | Holds (for Tower) |
|---|---|---|
| Markdown / myPKA | Canonical durable knowledge | Build decisions, this spec, governed notes |
| Git / GitHub | Code, PRs, checks, merge state | The reviewed change; PR/check/commit truth |
| ClickUp | Delivery / governance surface | Task status Warwick reads |
| **Supabase (`ftw.*`)** | **Operational control plane** | Runs, turns, events, signer registry |

**Guardrail.** The Tower's rows are transient control state. A GitHub PR's mergeability
lives in GitHub; a task's status lives in ClickUp; the knowledge lives in Markdown.
`ftw.*` stores **pointers** to those (PR ref, head sha, task id, path) plus the loop's
own bookkeeping — never a copy of the governed content. Any future read path that
treats an `ftw` row as canonical knowledge is a boundary violation.

> Health data is out of scope and not coupled here.

## 1. Why this shape: the run / turn / event split

Three concerns, three tables, deliberately not merged:

- **`governance_run`** — the *aggregate*. One long-lived object per governance goal:
  scope lock, status machine, budgets/counters, guardrail flags, terminal outcome,
  evidence pointers. This is the thing Warwick ultimately sees a terminal verdict on.
- **`run_turn`** — the *unit of delegated work*. A bounded slice handed to exactly one
  responder (larry / gpt_codex / warwick). Turns are append-only and ordered
  (`ordinal`); each carries its own lease, deadline, and signed result. Splitting
  turns out of the run gives an auditable, idempotent, replayable ledger of who was
  asked what, when, and what they signed back — without mutating the run in place.
- **`run_event`** — the *external stimulus*. Webhooks and task changes arrive
  asynchronously, out of order, duplicated, and sometimes self-generated. They need
  their own dedup keys and a `processed` flag independent of any turn. Binding events
  to a separate table (nullable `run_id` until bound) means a redelivered GitHub check
  cannot corrupt turn state — it is deduped at ingest, then advances the run at most
  once.

Merging any two of these would couple an idempotency concern (events) to a lease
concern (turns) to a lifecycle concern (runs), and every dedup bug would become a
state-machine bug. The split is the smallest shape that keeps them orthogonal.

`agent_identity` is the fourth table: a tiny honest signer registry the other three
reference (turn signer, event responder). Created first so its FKs resolve.

## 2. Enums (first-class, collision-safe)

Per the BUILD-002 `0001` lesson, a table implicitly creates a composite type of its
own name, so **no enum shares a name with any table**.

| Enum | Values | Used by |
|---|---|---|
| `ftw.run_status` | created, active, awaiting_responder, awaiting_decision, blocked, timed_out, completed, cancelled | `governance_run.status` |
| `ftw.run_outcome` | ready, blocked, timed_out, decision_required, completed | `governance_run.terminal_outcome` |
| `ftw.turn_state` | pending, dispatched, in_progress, returned, failed, timed_out | `run_turn.state` |
| `ftw.principal` | larry, gpt_codex, warwick, tower | `agent_identity`, turn signer, `expected_responder` (CHECK ≠ tower), `run_event.bound_responder` |
| `ftw.event_source` | telegram, github, clickup, tower | `run_event.source` |

**One `principal` enum, not two.** The brief listed `expected_responder` as
(larry/gpt_codex/warwick) and the signer registry as (larry/gpt_codex/warwick/tower).
Rather than maintain two overlapping enums that must be kept in sync, WP0 uses a single
`ftw.principal` and constrains `run_turn.expected_responder <> 'tower'` with a CHECK —
`tower` orchestrates turns but never takes one. Smaller reusable slice, one place to add
a future responder. (Open question §7 flags this for confirmation.)

**Honest labels.** `gpt_codex` is OpenAI/Codex and is **never** relabelled xAI/Grok. The
`agent_identity_provider_honest_chk` CHECK pins the provider slug to the known-honest set
so a future edit cannot silently spoof provenance.

## 3. Run lifecycle (state machine)

```
                 created
                    │ (tower dispatches turn 1)
                    ▼
        ┌───────► active ◄─────────────────────┐
        │           │                          │
        │  (turn dispatched)          (event/turn advances,
        │           ▼                   rounds remain)
        │   awaiting_responder ─────────────────┤
        │           │                          │
        │  (responder returns signed result)    │
        │           ▼                          │
        │        active ── needs human? ──► awaiting_decision
        │                                       │ (warwick decides)
        │                                       ▼
        │                                    active
        ▼
   terminal states (set terminal_outcome, surface to Warwick):
     completed   → outcome completed | ready
     blocked     → outcome blocked
     timed_out   → outcome timed_out       (watchdog or budget)
     cancelled   → (withdrawn)
```

- **created → active** when the Tower prepares and dispatches the first turn.
- **active → awaiting_responder** on dispatch of a larry/gpt_codex turn.
- **awaiting_responder → active** when that turn returns a signed result (or fails →
  the Tower decides retry-within-budget vs escalate).
- **active → awaiting_decision** when a human decision gate opens (`decision_required`
  set; e.g. a green PR that only Warwick may merge — see `no_autonomous_merge`).
- **any live state → timed_out** when the watchdog reaps a dispatched turn whose lease
  expired, or the run's `deadline_at` / `max_rounds` budget is exhausted (§5, §6).
- **→ terminal** sets `status` to one of {completed, blocked, timed_out, cancelled} and
  writes `terminal_outcome`. The `governance_run_terminal_outcome_chk` CHECK forbids a
  terminal outcome while the run is still in a live state.

`current_turn_id` is a forward pointer to the turn currently in flight (FK added after
`run_turn` exists; `on delete set null`).

## 4. Turn lifecycle (state machine)

```
  pending ──dispatch──► dispatched ──ack──► in_progress ──return──► returned (signed)
                            │                    │
                            │                    └──error──► failed
                            └──lease_deadline_at <= now()──► timed_out  (watchdog)
```

- **pending** — created, ordinal assigned, not yet handed out.
- **dispatched** — handed to the responder; `dispatched_at` set and `lease_deadline_at`
  = `dispatched_at` + watchdog window (5 min). The
  `run_turn_dispatched_has_lease_chk` CHECK guarantees a dispatched turn always carries
  both timestamps, so the watchdog can never miss one.
- **in_progress** — responder acknowledged (optional intermediate; lease may be
  extended by re-stamping `lease_deadline_at`).
- **returned** — responder returned a `structured_result`, a detached
  `result_signature`, `signer_principal`, and `signed_at`. This is the signed commit
  point of a turn.
- **failed** — responder returned an error; `last_error` recorded, `attempt_count`
  incremented. Retry-within-budget is a Tower decision.
- **timed_out** — lease expired with no return; the watchdog reaped it (§5).

**Idempotency.** `run_turn_run_ordinal_key` (unique on `(run_id, ordinal)`) makes a turn
idempotent per run: re-dispatch of the same logical turn upserts on that key rather than
minting a duplicate. Full rules in `dedup-and-timeout-contract.md`.

**Signed results.** `structured_result` is the payload the responder returns;
`result_signature` is a **detached signature string / pointer** over it (never a private
key); `signer_principal` FKs the honest `agent_identity` row. The Tower can verify the
signer matches the `expected_responder` before accepting a return — a `gpt_codex` result
signed as `larry` is rejected.

## 5. Watchdog / timeout model (5-minute dead-man)

A dispatched turn that goes silent must not hang a run forever. The watchdog is a small
periodic sweep, encoded entirely in the schema so any runner can implement it:

```sql
-- reap silent turns
UPDATE ftw.run_turn
   SET state = 'timed_out', updated_at = now()
 WHERE state = 'dispatched'
   AND lease_deadline_at <= now();
```

- `run_turn_watchdog_idx` is a **partial index on `lease_deadline_at WHERE state =
  'dispatched'`** — the sweep is index-driven and confined to live dispatched turns
  (mirrors BUILD-002 `0004`'s due-retry partial index).
- A reaped turn drives the run: the Tower either dispatches a retry turn (new ordinal,
  within `max_rounds`) or transitions the run to `timed_out` with
  `terminal_outcome = 'timed_out'`.
- The **run-level** budget (`deadline_at` from `time_budget_seconds`, and the
  `max_rounds` / `round_count` counter) is the second timeout: even if turns keep
  returning, a run cannot exceed its round or wall-clock budget. Enforcement rules are
  in `dedup-and-timeout-contract.md` §"max-rounds" and §"watchdog".

Both timeouts are **terminal and human-visible**: Warwick sees `timed_out`, never a
stuck spinner.

## 6. Budgets, counters, and guardrails

- **`max_rounds` / `round_count`** — bounded conversation. `governance_run_round_within_max_chk`
  keeps `round_count <= max_rounds` as a hard invariant; the Tower increments
  `round_count` per completed round and refuses to open a new round past the cap.
- **`token_budget` / `token_spent`** — cost ceiling counters (NULL budget = unbounded
  for now); both non-negative by CHECK.
- **`decision_required`** — the decision-gate marker; set when the run parks in
  `awaiting_decision` for Warwick.
- **`no_autonomous_merge`** (default **true**) — the Tower **never** merges on its own
  authority. A green PR yields a `ready` outcome surfaced to Warwick; the merge itself is
  a human decision. This is the core governance guardrail and defaults to the safe value.

## 7. Evidence binding (pointers only)

Evidence proves a run touched its governed artefacts **without copying them** — the
BUILD-002 evidence-pointer doctrine:

- `governance_run.evidence_pr_ref` — GitHub PR pointer (`owner/repo#123` or URL).
- `governance_run.evidence_commit_sha` — head commit sha pointer.
- `governance_run.evidence_task_ref` — ClickUp task pointer (id / URL).
- `governance_run.evidence_refs` — an open pointer bag `[{kind, ref}, ...]` for anything
  else (a check-run id, an artefact path).
- `run_event.payload` — sanitised pointers + metadata for the triggering event.

None of these hold PR bodies, diffs, task descriptions, or note content. To read the
governed thing, the Tower dereferences the pointer against GitHub / ClickUp / Markdown at
the moment it needs it. Deleting a run cascades its turns and events; the external
artefacts are untouched (they are not the Tower's to delete).

## 8. Security posture (WP0)

- RLS **enabled deny-by-default** on all four tables.
- **Only** the server-side `service_role` principal has a grant + policy. `anon` and
  `authenticated` get neither — both gates refuse them. There is no direct client→DB
  path in WP0.
- **No secret value** is stored anywhere: `agent_identity.signing_key_ref` is a key
  id / KMS handle / env-var name (pointer), and payloads/refs are sanitised. Secret
  handling follows BUILD-002 `SECURITY.md` (secrets by name from env, masked in logs).
- The migration is a **design artifact**; live apply is Larry-gated.

## 9. Open questions

See the return note to Larry. Chiefly: (a) confirm the single-`principal`-enum + CHECK
vs two enums; (b) whether `blocked` should be a recoverable state or strictly terminal;
(c) whether run-level token/time budgets are enforced in WP0 or deferred to a later WP.
