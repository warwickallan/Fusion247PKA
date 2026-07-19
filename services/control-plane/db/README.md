# BUILD-014 WP-A — Control Plane: Minimum Phase-0 Schema

**Migration:** `migrations/001_control_plane_min_schema.sql`
**Target schema:** `ops` (control-plane **DEV** namespace)
**Status:** DESIGN ARTIFACT — **not applied to any live/prod DB by this WP.** A live apply is Larry-gated and must target an isolated dev database. Never touches the `asdair` schema or any personal/entrusted data.
**Round:** R3 amend (round-2 reviewer findings folded into the single `001` migration — it has never been applied to any live DB, so there is no `002` patch; the change log lives in the SQL header as `F1…F15` + `R3-trim`).

---

## Why this schema exists

Postgres becomes the **authoritative live operational + merge-gate store**. GitHub stays the **mechanical merge enforcer + code/evidence authority**. A verdict is bound to an **exact commit SHA by typed constraints**, not by application-level `===` string comparisons.

The Tower merge gate took four review rounds to harden because "merge-ready" state was **head-blind**. This schema moves that invariant out of fragile code and into the database, where it is *structurally impossible* to violate.

---

## How the constraints make "merge-ready for the wrong head" impossible

Two independent, layered structural defences — a bug has to defeat **both**:

1. **`ops.git_sha` domain** — a commit SHA column can only hold a **canonical, lower-case, full 40-char** hex value (`CHECK value ~ '^[0-9a-f]{40}$'`). The Tower bug was that `checkpoint.js` accepts `/^[0-9a-f]{7,40}$/i` (7–40 hex, case-insensitive) and then compares heads with raw `===`, so a short `abc1234` or upper-case `ABC1234…` silently fails to bind. Here a non-canonical head **cannot be stored at all**. Callers canonicalise at the boundary via `ops.canonicalize_sha(text)`, which *raises* on a short/abbreviated head instead of letting it through.
   - **Whitespace policy (F12):** `canonicalize_sha` strips only leading/trailing ASCII whitespace (`btrim`) then lower-cases; any interior whitespace or non-hex character fails. Its exception reports only the candidate **length**, never the raw candidate, so untrusted input is not echoed into server logs.

2. **Composite foreign key `verdict (checkpoint_id, reviewed_commit_sha) → checkpoint (id, head_sha)`** — a verdict can only reference a `(checkpoint, head)` pair the checkpoint actually recorded. A verdict for the *wrong head* is a **foreign-key violation at INSERT** (`23503`), not a runtime miscompare. A reused checkpoint ref at a new head is a *new* checkpoint row (identity is immutable — see the evidence guard), so a stale verdict cannot follow the head forward.

On top of these, the hard invariants:

- `verdict.reviewed_commit_sha`, `verdict.reviewer`, `verdict.verdict` are all **NOT NULL**.
- **Active-verdict uniqueness (F1):** partial unique index `verdict_active_unique` on `(reviewer, reviewed_commit_sha, verdict_type) WHERE state='active'`. `active_generation` is **deliberately NOT in the key** — it is an audit-only counter. **Supersede-then-insert in one transaction is the ONLY path to a new active verdict**; a concurrent second active row (even at a bumped generation) is a `23505`. This closes the round-1 hole where a bumped generation let a stale active `approve` co-exist with — and mask — a newer active `request_changes`.
- **Reviewer↔role binding (F6):** `verdict_reviewer_role_chk` — a `correction_loop` verdict can **only** come from `gpt_codex`, a `cold_final` verdict **only** from `fable`. One principal therefore cannot fill both reviewer slots, so the two-reviewer gate means **two distinct authorised reviewers**. `larry`/`tower`/`warwick` can never file a reviewer verdict.
- `merge_gate.expected_head_sha` **NOT NULL** (canonical by domain).

### Head-bound two-reviewer readiness as data

The head-bound two-reviewer invariant Tower implements in `computeMergeReady()` is reproduced as data in the view `ops.checkpoint_merge_readiness`: readiness = one **active** genuine `approve` of **each** `verdict_type` at the **same head**. Because verdicts are composite-FK-bound to the checkpoint's exact head, any verdict the view sees is guaranteed to have reviewed that head. `comment` (unverifiable) is never merge-ready.

- **Robustness (F1/F10):** the per-type aggregate is `coalesce(bool_and(verdict='approve') filter (where … active), false)` — because active-uniqueness guarantees at most one active verdict per `(reviewer, head, type)`, this is `true` **only** when that single active verdict is `approve`; a newer active reject makes it `false` and can never be masked by a stale approve. The `coalesce(…, false)` makes an unreviewed checkpoint report `false`, not `NULL`.
- The view is `WITH (security_invoker = true)` and `GRANT SELECT`ed to `service_role` (round-1 granted it to no one — a dead end).

---

## Merge gate: bound to the head **and** to verified verdicts (F2)

`ops.merge_gate` cannot advertise `mergeable` for a head the required reviewers did not both approve:

1. **Composite FK** `(checkpoint_id, expected_head_sha) → checkpoint (id, head_sha)` `MATCH SIMPLE`, `ON DELETE NO ACTION`. When `checkpoint_id` is set, the gate's expected head **must** be a head that checkpoint actually recorded (else `23503`). `MATCH SIMPLE` leaves the link optional while `checkpoint_id` is `NULL`. `NO ACTION` (not `SET NULL`) because `expected_head_sha` is `NOT NULL` — a `SET NULL` cascade would collide with it.
2. **Trigger `merge_gate_require_reviewers`** — `fusion_policy_decision = 'approved'` is **rejected** (`23514`) unless `checkpoint_id` is set **and** the readiness view reports `both_reviewers_approved_this_head` for `(checkpoint_id, expected_head_sha)`. Readiness is **derived from the verdict chain**, never a free-text field a caller can set. Because `overall_action_state = 'mergeable'` requires `fusion_policy_decision = 'approved'`, a gate can never reach `mergeable` for a head both required reviewers have not actively approved.

> Ordering note: for an `approved` insert the trigger fires **before** the composite FK, so a wrong-head *approved* gate surfaces as the trigger's `23514`; the raw composite-FK `23503` is exercised via a non-approved (`pending`) gate in the test suite.

### Dual-gate representation (Fusion policy vs GitHub mechanical)

`ops.merge_gate` keeps the two states **strictly separate** and makes one undifferentiated "Approved" impossible to represent:

| Concern | Columns |
|---|---|
| **Fusion policy** (authoritative for policy) | `fusion_policy_decision`, `expected_head_sha`, `policy_reason` |
| **GitHub mechanical** (cached projection; GitHub authoritative) | `github_mech_state_cached`, `github_head_sha_cached`, `github_review_decision_cached`, `github_observed_at` |
| **Derived** (generated, immutable) | `heads_agree`, `overall_action_state` |

`overall_action_state` (a stored generated column over base columns only) resolves to exactly one of:
`superseded` → `fusion_not_approved` → `github_unobserved` → `head_moved` → `github_blocked` → `mergeable`.

- **F13:** `github_unobserved` (no cached head yet) is distinguished from `head_moved` (a cached head that has diverged).
- **F7:** the cached GitHub **review decision** is folded into the mechanical gate — a non-`APPROVED` `github_review_decision_cached` (e.g. `CHANGES_REQUESTED`, `REVIEW_REQUIRED`) forces `github_blocked`, so a gate cannot report `mergeable` while GitHub's own review decision is unsatisfied. The field is constrained to `{APPROVED, CHANGES_REQUESTED, REVIEW_REQUIRED, NULL}`.

So the cockpit can render: **"Fusion policy: approved for `abc123…` / GitHub mechanical: blocked / Overall: not mergeable."**

**One live gate per build (`merge_gate_one_live_per_build`):** at most one non-superseded gate per build. **One-PR-per-build assumption (F14):** this schema assumes a build maps to a single open PR at a time — a moved head or a new decision requires superseding the prior gate first. `merge_gate_superseded_consistency_chk` ties the two supersession representations together (`fusion_policy_decision='superseded'` ⇒ `superseded_at` set). If a build ever needs multiple concurrent PRs, this index and assumption must be revisited (a later WP).

---

## Append-only events, evidence protection & provenance

`ops.agent_event` is **INSERT-only**, and `ops.verdict` / `ops.checkpoint` are **evidence** with narrow, audited mutation:

- **`agent_event`** — trigger `agent_event_append_only` rejects any `UPDATE`/`DELETE` (`restrict_violation` = **SQLSTATE 23001**); privilege layer grants `service_role` `SELECT, INSERT` only. `build_id` FK is **`ON DELETE NO ACTION` (F4)** — a `SET NULL` would fire the append-only trigger and abort (an impossible cascade), so a build that has emitted events is deliberately undeletable (`23503`), which also protects the event evidence. Every event carries a `delivery_key` (unique idempotency key) and a **NOT NULL** `payload_hash`. `classification` + the generated `git_provenance_eligible` (`true` only for `public`/`internal`) structurally excludes `sensitive`/`secret` events from public git provenance; `secret` values are never stored as values at all — pointers only.
- **`verdict` (F3)** — evidence-guard trigger `verdict_evidence_guard` permits the **only** legal update, `active → superseded` (setting `superseded_at`); every other column is frozen and a superseded verdict can **never** flip back to active. `DELETE` is always rejected (supersede, never delete) and `service_role` has **no DELETE** privilege. `verdict → checkpoint` FK is `ON DELETE NO ACTION`.
- **`checkpoint` (F3)** — evidence-guard trigger `checkpoint_immutable_identity` freezes `id/build_id/checkpoint_ref/head_sha/created_at` (only the `branch`/`brief_ref` pointers may change). A head change is a *new* checkpoint row — this is what makes head-binding an FK. Deleting a checkpoint that any verdict (or gate) references is a `23503` (`ON DELETE NO ACTION`), never a silent cascade.
- **`build`** — every FK into `build` is `ON DELETE NO ACTION`: a build with dependent evidence is undeletable (honest `23503`).
- **TRUNCATE guards (F5)** — `agent_event`, `verdict`, and `checkpoint` each carry a `BEFORE TRUNCATE … FOR EACH STATEMENT` guard (`reject_truncate`), because TRUNCATE bypasses row-level triggers.

---

## Threat model (residuals — documented, accepted for DEV)

The evidence/append-only guarantees are enforced by **triggers, FKs, and privileges**. Two classes of out-of-band admin action can still bypass them; neither is reachable by the runtime `service_role`, and both are called out so a live-apply reviewer sizes them explicitly:

1. **Trigger bypass by the table owner / superuser.** The owner of a table can `ALTER TABLE … DISABLE TRIGGER` or set `SET session_replication_role = replica`, which suppresses the append-only, evidence-guard, and no-truncate triggers. Mitigation for a live apply: **separate object ownership from the runtime role** — own the objects with a dedicated admin/migration role that the runtime never authenticates as, and audit any `DISABLE TRIGGER` / `session_replication_role` change.
2. **RLS bypass by a `SUPERUSER` / `BYPASSRLS` role.** RLS is `ENABLE`d **and `FORCE`d** (F5) so even the table owner is subject to the policies — but a `SUPERUSER` or a role with `BYPASSRLS` sidesteps RLS entirely. On real Supabase the runtime `service_role` **is** a `BYPASSRLS` role, so the per-table policies here are defence-in-depth, and the security guarantee rests on `service_role` being the *only* granted role while `anon`/`authenticated` get neither grant nor policy. The migration's throwaway-dev roles are `nologin`, so nothing can authenticate as them locally.

**Test-role note:** the DB-proof suite connects as the throwaway cluster's **superuser**, which bypasses RLS. That is deliberate — it means every proof exercises the **trigger/FK/constraint** layer (the structural guarantees), independent of the privilege/RLS layer. The RLS/privilege layer is documented here and enforced separately on the live target.

---

## Field classification (R3)

Every table and column carries an inline `[tag]` in the SQL. Legend:
`phase0` = needed now to prove the seven things · `later` = kept minimal, expand in a later WP · `projection-only` = a cache of an external authority (GitHub), never the source of truth · `provenance-later` = deferred audit/provenance detail · `not-yet-justified` = present as a placeholder, must earn its place before it stays.

| Table | Class | Proof | Notes |
|---|---|---|---|
| `build` | phase0 | identity (7) | Minimal build identity to hang the rest on. |
| `agent_run` | phase0 | identity (7) | Minimal agent working-span record. **`role` removed** (R3-trim — unjustified free-text). |
| `job` | phase0 | (1) durable job/lease | pgmq-compatible: leaseable, idempotency-keyed, attempt-bounded, dead-letter. `claim_job`/`reclaim_expired_leases` (F9). |
| `agent_event` | phase0 | (2) append-only | INSERT-only via trigger + privilege + truncate guard; delivery key + payload hash + classification. |
| `checkpoint` | phase0 | (3) exact-SHA | Canonical head by domain; `(id, head_sha)` unique is the composite-FK target; identity immutable. |
| `verdict` | phase0 | (3) exact-SHA | NOT NULL sha/reviewer/verdict; active-uniqueness; reviewer↔role binding; composite-FK head binding; evidence-guarded. |
| `merge_gate` | phase0 | (4) policy gate, (5) divergence | Dual-gate separation; composite-FK + reviewer-require trigger; derived `overall_action_state`. |
| `command_request` | phase0 | (6) command req/result | Idempotency-keyed; args/result hashes; classification. |
| `checkpoint_merge_readiness` (view) | **projection-only** | (3) | Head-bound two-reviewer readiness, as data; `security_invoker`. |

### R3 scope trim (what was removed and why)

- **`workflow_run` — REMOVED.** It was `projection-only`, nothing referenced it (no FK target), and no Phase-0 proof needs it — Codex correctly flagged it as flab. A GitHub Actions run cache belongs in a later WP that actually consumes it.
- **`agent_run.role` — REMOVED.** Free-text `[later]` column unjustified by any proof; the reviewer role that matters lives on `verdict.verdict_type`.

Kept deliberately (not over-cut, per the R3 guidance): `agent_run` itself (minimal build/principal working-span identity — a near-term pointer target), and every `merge_gate` `github_*_cached` projection column (they are the *point* of the dual-gate separation proof).

### Deliberately deferred (NOT in this minimum schema)

- Full run/turn orchestration state machine, token/time budgets (BUILD-010 `ftw.*` already models a richer version — not duplicated here).
- Cached CI/Actions run records (the former `workflow_run`), rich provenance/audit chains, signed-envelope storage, key registries (`provenance-later`).
- Multi-tenant / multi-user auth surface (`anon`/`authenticated` gated paths) — deny-by-default until a future WP authors it under the security gate.
- Notification/Telegram delivery records, retry/backoff schedules beyond the minimal `job` lease.
- Cross-build dependency graph, work-package decomposition, multiple concurrent PRs per build.

---

## Job lease/idempotency semantics

- **Idempotency key is GLOBAL** (`job.idempotency_key` unique across all queues), i.e. the key is the unit-of-work identity, not a per-queue counter. A redelivery re-using a key in a different queue collides too.
- **`ops.claim_job(queue, owner, lease_seconds)` (F9)** — atomically leases the oldest pending job with `FOR UPDATE SKIP LOCKED` (N workers each get a distinct job, no double-lease, no blocking), increments `attempts` (each lease = one attempt), returns the leased row or `NULL` when the queue is empty.
- **`ops.reclaim_expired_leases()` (F9)** — expires stale leases: a job past its `lease_deadline_at` returns to `pending` (retryable) unless its `attempts` are exhausted, in which case it is parked in `dead_letter`. Clears the lease either way.
- **Lease hygiene (F9/F15):** `job_lease_iff_leased_chk` is a per-field biconditional — `leased` ⇒ both `lease_owner` and `lease_deadline_at` set; **any non-leased status** ⇒ both `NULL`. A half-set lease is unrepresentable.
- `job_dead_letter_requires_exhausted_chk` keeps `dead_letter` a genuine terminal (`attempts >= max_attempts`).

---

## Validating the invariants (proven by execution, not by skip)

`test/constraint-invariants.test.js` is a DB proof (Node `node:test` + `pg`). **It does not silently self-skip (F8):** with `DATABASE_URL` unset it prints a loud pointer to the runner; with `DATABASE_URL` set but `pg` missing it **fails**. The one-command runner provisions a **disposable, isolated** Postgres cluster (temp dir, free port), runs every proof, and tears the cluster down:

```
cd services/control-plane
npm install                 # installs the pg dev-driver
npm test                    # provisions a throwaway Postgres, runs all proofs, tears down
# or, against your own isolated dev DB:
DATABASE_URL=postgres://user:pass@localhost:5432/scratch_dev node --test db/test/constraint-invariants.test.js
```

`run-db-tests.mjs` needs `initdb`/`pg_ctl`/`postgres` on `PATH` (or `POSTGRES_BIN` set to the Postgres `bin` dir). It always builds its own cluster; set `REUSE_DATABASE_URL=1` to run against a pre-provisioned `$DATABASE_URL` (e.g. a CI service container). It DROPs and rebuilds the `ops` schema per test — point it at throwaway substrate only.

**What it proves (12 subtests, all passing against Postgres 17.4):** the `ops.git_sha` domain + `canonicalize_sha` (incl. whitespace/upper-case); verdict NOT-NULLs + exact-SHA composite-FK head binding; no duplicate active verdict + supersede-then-insert; **F1** cross-generation double-active rejected + a stale approve cannot mask a newer reject; `agent_event` append-only (`23001`) + **F5** TRUNCATE rejected; `merge_gate` NOT-NULL head + derived `overall_action_state` transitions (unobserved/head_moved/github_blocked/mergeable) + **F7** review-decision fold; **F2** a gate cannot be approved/mergeable without a head-bound two-reviewer approve; idempotency/lease invariants + **F9** `claim_job`/`reclaim_expired_leases`; **F3** verdict UPDATE/DELETE + checkpoint DELETE-while-referenced + checkpoint identity protection; **F6** reviewer↔role binding.

The migration is idempotent (verified by double-apply): re-running it against an existing `ops` schema is a no-op (only `NOTICE`s).

---

## Modelling decisions for Larry to confirm

1. **`checkpoint` is per-`(build_id, ref, head)`** (F11 — natural key now includes `build_id`, so two builds may share a `checkpoint_ref`/head). A Tower `checkpoint_id` reused at a new head becomes a *new* row (this is what makes the composite-FK head binding sound). If the control plane instead wants one mutable checkpoint row whose head is updated in place, the composite FK would need replacing with a trigger — I chose the immutable-per-head shape because it turns the invariant into an FK.
2. **`ops.git_sha` refuses abbreviated SHAs outright** (full 40 only). If any real inbound source can only supply a 7–12 char short SHA that cannot be expanded at the boundary, that source must resolve to the full SHA before writing. Keeping the strict domain and resolving upstream is the recommendation — accepting short SHAs is exactly the Tower bug.
3. **Schema name `ops`** (generic dev namespace) rather than a build-specific one like `ftw`. Confirm the final production namespace before any live apply.
4. **Object-ownership separation for a live apply** (see Threat model): own the objects with a dedicated admin/migration role distinct from the runtime `service_role`.
