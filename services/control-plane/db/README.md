# BUILD-014 WP-A — Control Plane: Minimum Phase-0 Schema

**Migration:** `migrations/001_control_plane_min_schema.sql`
**Target schema:** `ops` (control-plane **DEV** namespace)
**Status:** DESIGN ARTIFACT — **not applied to any live/prod DB by this WP.** A live apply is Larry-gated and must target an isolated dev database. Never touches the `asdair` schema or any personal/entrusted data.
**Round:** R5 round-5 amend (round-2 → round-5 reviewer findings all folded into the single `001` migration — it has never been applied to any live DB, so there is no `002` patch; the full change log lives in the SQL header as `F1…F15` + `R3-trim` + `G1…G12`/`G-CI` + `R4-1…R4-3`/`R4-C4` + `R5-1…R5-3`). Round-5 changes:
- **R5-1 (Codex MAJOR / Fable LOW)** — `merge_gate_guard_mutation` is now **DEFAULT-DENY**: every column is frozen unless on an explicit allow-list (always-mutable = `github_*_cached` / `github_observed_at` / `policy_reason` / `updated_at`; supersede-only = `fusion_policy_decision` / `superseded_at`). This closes `id`, `created_at`, and **any future column** in one stroke and aligns `merge_gate` with the checkpoint/verdict guards (which already freeze `created_at`).
- **R5-2 (Fable LOW)** — the search_path catalog fence (test 19) now covers `language sql` as well as `plpgsql`.
- **R5-3 (Codex + Fable LOW)** — this header refreshed to round-5 to match the body.
- **Prior (R4)** — R4-1 terminal supersession, R4-2 born-live gate guard, R4-3 projection-refresh skip + advisory-lock ordering (no lock churn/deadlock), R4-C4 search_path pin + regression fence.

---

## Why this schema exists

Postgres becomes the **authoritative live operational + merge-gate store**. GitHub stays the **mechanical merge enforcer + code/evidence authority**. A verdict is bound to an **exact commit SHA by typed constraints**, not by application-level `===` string comparisons.

The Tower merge gate took four review rounds to harden because "merge-ready" state was **head-blind**. This schema moves that invariant out of fragile code and into the database, where it is *structurally impossible* to violate.

---

## How the constraints make "merge-ready for the wrong head" impossible

Two independent, layered structural defences — a bug has to defeat **both**:

1. **`ops.git_sha` domain** — a commit SHA column can only hold a **canonical, lower-case, full 40-char** hex value (`CHECK value ~ '^[0-9a-f]{40}$'`). The Tower bug was that `checkpoint.js` accepts `/^[0-9a-f]{7,40}$/i` (7–40 hex, case-insensitive) and then compares heads with raw `===`, so a short `abc1234` or upper-case `ABC1234…` silently fails to bind. Here a non-canonical head **cannot be stored at all**. Callers canonicalise at the boundary via `ops.canonicalize_sha(text)`, which *raises* on a short/abbreviated head instead of letting it through.
   - **Whitespace policy (F12 + G12):** `canonicalize_sha` uses `btrim()` with no character set, which strips leading/trailing ASCII **space (0x20) only** — *not* tab/newline/CR — then lower-cases. A tab/newline/CR-padded head is therefore **not** trimmed and fails canonicalisation (fail-closed), as does any interior whitespace or non-hex character. Its exception reports only the candidate **length**, never the raw candidate, so untrusted input is not echoed into server logs.

2. **Composite foreign key `verdict (checkpoint_id, reviewed_commit_sha) → checkpoint (id, head_sha)`** — a verdict can only reference a `(checkpoint, head)` pair the checkpoint actually recorded. A verdict for the *wrong head* is a **foreign-key violation at INSERT** (`23503`), not a runtime miscompare. A reused checkpoint ref at a new head is a *new* checkpoint row (identity is immutable — see the evidence guard), so a stale verdict cannot follow the head forward.

On top of these, the hard invariants:

- `verdict.reviewed_commit_sha`, `verdict.reviewer`, `verdict.verdict` are all **NOT NULL**.
- **Active-verdict uniqueness (F1 + G8):** partial unique index `verdict_active_unique` on `(checkpoint_id, reviewer, verdict_type) WHERE state='active'`. **G8:** the key is scoped to `checkpoint_id` (per-build), *not* `reviewed_commit_sha` — the head is already implied by the composite FK `(checkpoint_id, reviewed_commit_sha) → checkpoint (id, head_sha)` plus the immutable checkpoint identity. Keying on the raw SHA was harmful: two *different* builds/checkpoints that legitimately share a head would have falsely collided on `(reviewer, sha, type)`. `active_generation` is **deliberately NOT in the key** — it is an audit-only counter. **Supersede-then-insert in one transaction is the ONLY path to a new active verdict**; a concurrent second active row (even at a bumped generation) is a `23505`. This closes the round-1 hole where a bumped generation let a stale active `approve` co-exist with — and mask — a newer active `request_changes`.
- **Superseded-consistency (G6):** `verdict_superseded_consistency_chk` — a verdict is `superseded` **iff** `superseded_at` is set, so an `active` row always has a NULL `superseded_at`. A verdict also cannot be **born** superseded: the `verdict_reject_insert_superseded` BEFORE-INSERT trigger forces every verdict to pass through `active` first, so the `active → superseded` audit chain is unforgeable. The evidence-guard also now **forces** `superseded_at := now()` on supersession (G9) — a caller cannot forge a fabricated supersession timestamp.
- **Reviewer↔role binding (F6):** `verdict_reviewer_role_chk` — a `correction_loop` verdict can **only** come from `gpt_codex`, a `cold_final` verdict **only** from `fable`. One principal therefore cannot fill both reviewer slots, so the two-reviewer gate means **two distinct authorised reviewers**. `larry`/`tower`/`warwick` can never file a reviewer verdict.
- `merge_gate.expected_head_sha` **NOT NULL** (canonical by domain).

### Head-bound two-reviewer readiness as data

The head-bound two-reviewer invariant Tower implements in `computeMergeReady()` is reproduced as data in the view `ops.checkpoint_merge_readiness`: readiness = one **active** genuine `approve` of **each** `verdict_type` at the **same head**. Because verdicts are composite-FK-bound to the checkpoint's exact head, any verdict the view sees is guaranteed to have reviewed that head. `comment` (unverifiable) is never merge-ready.

- **Robustness (F1/F10):** the per-type aggregate is `coalesce(bool_and(verdict='approve') filter (where … active), false)` — because active-uniqueness guarantees at most one active verdict per `(reviewer, head, type)`, this is `true` **only** when that single active verdict is `approve`; a newer active reject makes it `false` and can never be masked by a stale approve. The `coalesce(…, false)` makes an unreviewed checkpoint report `false`, not `NULL`.
- The view is `WITH (security_invoker = true)` and `GRANT SELECT`ed to `service_role` (round-1 granted it to no one — a dead end).

---

## Merge gate: bound to the build **and** the head **and** verified verdicts (F2 + G1/G2/G3)

`ops.merge_gate` cannot advertise `mergeable` for a head the required reviewers did not both approve, cannot borrow another build's approvals, cannot be rewritten in place, and cannot outlive the approvals it rests on:

1. **Build-scoped composite FK (G1)** `(build_id, checkpoint_id, expected_head_sha) → checkpoint (build_id, id, head_sha)` `MATCH SIMPLE`, `ON DELETE NO ACTION`. `build_id` and `expected_head_sha` are `NOT NULL`, so a set `checkpoint_id` always makes all three non-null and the check fires. This closes a round-2 **cross-build borrow**: previously the FK was only `(checkpoint_id, expected_head_sha) → (id, head_sha)`, so a gate for build **B** could reference build **A**'s checkpoint — and thus A's approvals. Now the `(B, cpA, head)` tuple is not a recorded checkpoint → `23503`. `merge_gate_require_reviewers` **also** filters `build_id = NEW.build_id` in its readiness lookup, so readiness can never be read from another build. `MATCH SIMPLE` leaves the link optional while `checkpoint_id` is `NULL`; `NO ACTION` (not `SET NULL`) because `expected_head_sha` is `NOT NULL`.
2. **Trigger `merge_gate_require_reviewers`** — `fusion_policy_decision = 'approved'` is **rejected** (`23514`) unless `checkpoint_id` is set **and** the readiness view reports `both_reviewers_approved_this_head` for `(build_id, checkpoint_id, expected_head_sha)`. Readiness is **derived from the verdict chain**, never a free-text field a caller can set. Because `overall_action_state = 'mergeable'` requires `fusion_policy_decision = 'approved'`, a gate can never reach `mergeable` for a head both required reviewers have not actively approved.
3. **Immutability (G2 + R5-1, DEFAULT-DENY)** — `merge_gate_immutable_guard` now freezes **every** column by default and permits change only via an explicit allow-list, so `build_id`, `checkpoint_id`, `expected_head_sha`, **`id`, `created_at`, and any future column** are frozen for the life of the row. Once `fusion_policy_decision = 'approved'` the decision may **only** transition to `superseded` (never back to `pending`/`blocked`, which would erase the approved-for-this-head record). An in-place head/checkpoint rewrite, an `id`/`created_at` rewrite, or an `approved → pending` rewrite is a `23001`. `DELETE` is rejected outright (`23001` — **supersede, never delete**), `DELETE` is also revoked from `service_role`, and a `BEFORE TRUNCATE` guard is present. The **always-mutable** allow-list is the `github_mech_state_cached` / `github_head_sha_cached` / `github_review_decision_cached` / `github_observed_at` projection columns, `policy_reason`, and `updated_at`; the **supersede-only** allow-list is `fusion_policy_decision` + `superseded_at` (governed by the terminal-supersession rules in point 4). Generated columns (`heads_agree`, `overall_action_state`) are enumerated from the catalog and skipped (computed after BEFORE triggers). This default-deny stance aligns `merge_gate` with the checkpoint/verdict guards (which already freeze `created_at`) and ends the "one more unfrozen column" review loop; because `merge_gate_immutable_guard` fires **before** `merge_gate_require_reviewers` (alphabetical trigger order), an `id`/`created_at` change is rejected by the guard and can never masquerade as a projection refresh.
4. **Supersession is TERMINAL (R4-1, Codex)** — once a gate is superseded (either `fusion_policy_decision = 'superseded'` **or** `superseded_at` is set), `merge_gate_immutable_guard` freezes the decision there and freezes `superseded_at`: a `superseded → pending`/`approved` change, or clearing/altering `superseded_at`, is a `23001`. And `superseded_at` may be **set only in the same `UPDATE` that transitions the decision to `superseded`** — the old "mark a gate non-live via `superseded_at` alone" path is closed. Net: `approved → superseded` is allowed **once**; `superseded → anything-else` and clearing `superseded_at` are rejected. The canonical supersede is therefore always `(fusion_policy_decision='superseded', superseded_at=now())` **together** — which is exactly what the D1 `verdict_supersede_invalidates_gate` AFTER-trigger writes.
5. **Born live (R4-2, Fable)** — a `BEFORE INSERT` trigger `merge_gate_reject_insert_superseded` (mirroring `verdict_reject_insert_superseded`) rejects an `INSERT` with `superseded_at` set or `fusion_policy_decision='superseded'` (`23514`). A gate must be **born live**; supersession is a transition of an existing live gate, never an initial state. This also guarantees an `approved` gate is always inserted live (`superseded_at` NULL), so it can never side-step the require-reviewers gate by being born already-superseded.

### D1 — an approved gate can never outlive its approvals (CLOSED structurally, **not deferred**)

Round-2 left a discrepancy (**D1**): an `approved` gate whose supporting verdict was later superseded could remain `mergeable`. That is now closed **structurally**, both serially and concurrently:

- **Serial (G3a):** `verdict_supersede_invalidates_gate` — an `AFTER UPDATE` trigger on `verdict` firing on `active → superseded`. It supersedes any **live approved** gate at that `(build_id, checkpoint_id, head)` — so superseding a supporting verdict immediately invalidates the gate that rested on it. No recursion: it only `UPDATE`s `merge_gate` (never writes a verdict), so it cannot re-fire itself.
- **Concurrent (G3b):** `merge_gate_require_reviewers` takes `SELECT … FOR UPDATE` on the **active verdict rows** for `(checkpoint_id, expected_head_sha)` *before* it evaluates readiness. A concurrent supersede of any supporting verdict `UPDATE`s one of those rows and therefore **serialises** against the approval: if the approval locks first, the supersede blocks then invalidates the just-approved gate via G3a; if the supersede locks first, the approval waits, re-evaluates readiness under the committed change (the superseded row no longer matches `state='active'`), and is rejected `23514`. `FOR UPDATE` (not `FOR KEY SHARE`) is deliberate — superseding sets a *non-key* column (`state`), which takes `FOR NO KEY UPDATE` and would **not** conflict with `FOR KEY SHARE`.
  - **R4-3A — no lock churn on the refresh path (Fable):** `merge_gate_require_reviewers` **short-circuits** when an already-live-approved gate is `UPDATE`d with only its cached-GitHub projection (`github_*_cached` / `*_observed_at`) or `policy_reason` changing (build/checkpoint/head/decision/supersession all unchanged). Refreshing the GitHub cache is already-validated state and must **not** re-run the reviewer check nor re-take the verdict lock — that lock churn was the deadlock/contention source. It skips both entirely.
  - **R4-3B — deadlock-safe ordering (Codex):** a *genuine* approval (an `INSERT` of an approved gate, or a `pending → approved` `UPDATE`) takes a transaction-scoped `pg_advisory_xact_lock(hashtext(build_id || checkpoint_id || expected_head_sha))` **before** the verdict-row lock, and `verdict_supersede_invalidates_gate` takes the **byte-identical** key — so gate-approval and verdict-supersede serialise on the advisory lock instead of racing gate-row-vs-verdict-row in opposite orders. In the truly-simultaneous case a residual deadlock is still possible and is **acceptable** (Postgres aborts one txn cleanly with `40P01`); what can never happen is a silently-inconsistent commit — a live approved gate resting on a freshly-superseded verdict.
  - **Test coverage:** **12b** is the concurrent **supersede-first** race (against an `INSERT` approval), and the **approval-first** interleaving is now a real two-connection test too (**test 18**, per R4-3) — it stages both lock orders (supersede-first → the approval is rejected `23514`; approval-first → the committed approval is auto-superseded by D1/G3a) and asserts **no wrong state commits** and no deadlock in either staged order.

> Ordering note (D2): for an `approved` insert the reviewer trigger fires **before** the composite FK, so a wrong-head *approved* gate surfaces as the trigger's `23514`; the raw composite-FK `23503` is exercised via a non-approved (`pending`) gate in the test suite. A cross-build *approved* gate is rejected by either the FK (`23503`) or the build-filtered reviewer lookup (`23514`) — the test accepts both.

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
- **`checkpoint` (F3 + G5)** — evidence-guard trigger `checkpoint_immutable_identity` freezes `id/build_id/checkpoint_ref/head_sha/created_at` (only the `branch`/`brief_ref` pointers may change). A head change is a *new* checkpoint row — this is what makes head-binding an FK. **G5:** the trigger now also **rejects `DELETE` outright** (`23001`) — a checkpoint is review evidence and may never be removed, referenced or not; `DELETE` is also revoked from `service_role`. Because the `BEFORE DELETE` trigger fires **ahead of** the referenced-FK `RESTRICT` check, *all* checkpoint deletes surface as `23001` (the previous referenced-delete `23503` path is subsumed by the trigger).
- **`build`** — every FK into `build` is `ON DELETE NO ACTION`: a build with dependent evidence is undeletable (honest `23503`).
- **`merge_gate` (G2 + R5-1)** — a decision record, not free-form state: `merge_gate_immutable_guard` freezes **every column by default** (allow-list = the `github_*_cached`/`observed_at` projection + `policy_reason` + `updated_at`, plus `fusion_policy_decision`/`superseded_at` for the terminal `approved → superseded` transition), so identity/head binding, `id`, `created_at`, and the approved decision are all frozen (see the merge-gate section). It rejects `DELETE`, and `DELETE` is revoked from `service_role` (supersede, never delete).
- **TRUNCATE guards (F5 + G2)** — `agent_event`, `verdict`, `checkpoint`, and now `merge_gate` each carry a `BEFORE TRUNCATE … FOR EACH STATEMENT` guard (`reject_truncate`), because TRUNCATE bypasses row-level triggers. (`checkpoint` is additionally FK-referenced, so a bare `TRUNCATE` there is *also* refused by Postgres with `0A000` before the guard even fires.)

---

## Threat model (residuals — documented, accepted for DEV)

The evidence/append-only guarantees are enforced by **triggers, FKs, and privileges**. Two classes of out-of-band admin action can still bypass them; neither is reachable by the runtime `service_role`, and both are called out so a live-apply reviewer sizes them explicitly:

1. **Trigger bypass by the table owner / superuser.** The owner of a table can `ALTER TABLE … DISABLE TRIGGER` or set `SET session_replication_role = replica`, which suppresses the append-only, evidence-guard, and no-truncate triggers. Mitigation for a live apply: **separate object ownership from the runtime role** — own the objects with a dedicated admin/migration role that the runtime never authenticates as, and audit any `DISABLE TRIGGER` / `session_replication_role` change.
2. **RLS bypass by a `SUPERUSER` / `BYPASSRLS` role.** RLS is `ENABLE`d **and `FORCE`d** (F5) so even the table owner is subject to the policies — but a `SUPERUSER` or a role with `BYPASSRLS` sidesteps RLS entirely. On real Supabase the runtime `service_role` **is** a `BYPASSRLS` role, so the per-table policies here are defence-in-depth, and the security guarantee rests on `service_role` being the *only* granted role while `anon`/`authenticated` get neither grant nor policy. The migration's throwaway-dev roles are `nologin`, so nothing can authenticate as them locally.

**Live-apply hardening — `ops.job` state transitions are convention-only (R4-5, Fable).** The job lifecycle is *mediated* by the transactional helpers `claim_job` / `reclaim_expired_leases` / `complete_job` (they own the lease/attempt/dead-letter semantics), but `service_role` still holds **raw `UPDATE`** on `ops.job`, so nothing at the privilege layer *forces* callers through those helpers — a caller could hand-`UPDATE` `status`/`lease_owner`/`attempts` directly. The `CHECK` constraints (biconditional lease hygiene, `attempts <= max_attempts`, dead-letter-requires-exhausted) keep any such hand-edit from reaching an *invalid* row, but the *state machine* itself is convention, not enforcement. For a live apply, tighten this to either **column-level `UPDATE` grants** (grant `UPDATE` only on the mutable-by-hand columns and withhold it on `status`/`lease_*`/`attempts`) or **`SECURITY DEFINER` functions owned by the admin role** as the sole sanctioned mutation path, with `UPDATE` on `ops.job` revoked from the runtime role. (Documentation only — no change to the job grants this round.)

**Function hardening (G10):** every `plpgsql` function pins `SET search_path = ops, pg_catalog` (so a hijacked session `search_path` cannot shadow an unqualified reference), and `EXECUTE` on all `ops` functions is `REVOKE`d from `PUBLIC` before the explicit `service_role` grants — the transactional helpers (`claim_job`, `reclaim_expired_leases`, `complete_job`, `canonicalize_sha`) are default-deny. Trigger functions still fire regardless of `EXECUTE` grants (Postgres does not privilege-check trigger invocation), so the evidence/append-only guards are unaffected by the revoke.

**Test-role note:** the DB-proof suite connects as the throwaway cluster's **superuser**, which bypasses RLS. That is deliberate — it means every proof exercises the **trigger/FK/constraint** layer (the structural guarantees), independent of the privilege/RLS layer. The RLS/privilege layer is documented here and enforced separately on the live target.

---

## Field classification (R3)

Every table and column carries an inline `[tag]` in the SQL. Legend:
`phase0` = needed now to prove the seven things · `later` = kept minimal, expand in a later WP · `projection-only` = a cache of an external authority (GitHub), never the source of truth · `provenance-later` = deferred audit/provenance detail · `not-yet-justified` = present as a placeholder, must earn its place before it stays.

| Table | Class | Proof | Notes |
|---|---|---|---|
| `build` | phase0 | identity (7) | Minimal build identity to hang the rest on. |
| `agent_run` | phase0 | identity (7) | Minimal agent working-span record. **`role` removed** (R3-trim — unjustified free-text). |
| `job` | phase0 | (1) durable job/lease | pgmq-compatible: leaseable, idempotency-keyed, attempt-bounded (`attempts <= max`, G4), dead-letter. `claim_job`/`reclaim_expired_leases`/`complete_job` (F9+G4). |
| `agent_event` | phase0 | (2) append-only | INSERT-only via trigger + privilege + truncate guard; delivery key + payload hash + classification. |
| `checkpoint` | phase0 | (3) exact-SHA | Canonical head by domain; `(id, head_sha)` + build-scoped `(build_id, id, head_sha)` unique (G1) are the composite-FK targets; identity immutable; **DELETE rejected (G5)**. |
| `verdict` | phase0 | (3) exact-SHA | NOT NULL sha/reviewer/verdict; active-uniqueness keyed on `checkpoint_id` (G8); reviewer↔role binding; superseded-consistency (G6); composite-FK head binding; evidence-guarded; supersede auto-invalidates dependent gates (G3a). |
| `merge_gate` | phase0 | (4) policy gate, (5) divergence | Dual-gate separation; **build-scoped** composite-FK (G1) + reviewer-require trigger with approval-time verdict lock (G3b) + projection-refresh skip & advisory-lock ordering (R4-3); **immutable/no-delete guard (G2)** with **terminal supersession (R4-1)** + **born-live guard (R4-2)**; derived `overall_action_state`. |
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
- **`ops.claim_job(queue, owner, lease_seconds)` (F9 + G4)** — atomically leases the oldest pending job with `FOR UPDATE SKIP LOCKED` (N workers each get a distinct job, no double-lease, no blocking), increments `attempts` (each lease = one attempt), returns the leased row or `NULL` when the queue is empty. **G4:** it only leases jobs with `attempts < max_attempts`, and it **parks any pending-but-exhausted job** (`attempts >= max_attempts`) into `dead_letter` — an exhausted job can never be (re)leased.
- **`ops.reclaim_expired_leases()` (F9)** — expires stale leases: a job past its `lease_deadline_at` returns to `pending` (retryable) unless its `attempts` are exhausted, in which case it is parked in `dead_letter`. Clears the lease either way.
- **`ops.complete_job(id, owner, status)` (G4)** — the sanctioned way to finish a leased job. It requires the row to be `status='leased'` **and** still `lease_owner = owner`, so an **expired-lease worker** whose lease was reclaimed and re-leased to someone else **cannot clobber the live leaseholder** — its `UPDATE` matches no row and the function raises `23001`. `succeeded` is terminal; `failed` returns to `pending` for retry, or `dead_letter` when the budget is exhausted; the lease is cleared either way.
- **Attempt bounding (G4):** `job_attempts_within_budget_chk check (attempts <= max_attempts)` — `attempts` can never exceed the retry budget (claim only leases `attempts < max`, so the claim-time increment lands at most on `max_attempts`).
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

**Runner guard against green-on-skips (F8 + G-CI):** `run-db-tests.mjs` now tees the child `node --test` output and parses the TAP summary; if **0 subtests executed** (`pass + fail == 0`, i.e. every DB-gated proof skipped — e.g. `DATABASE_URL` never reached the child), it **fails loudly** instead of exiting 0. A mis-wired run can no longer go green on skips.

**CI (G-CI):** `.github/workflows/control-plane-tests.yml` runs `npm ci && npm test` against a Postgres 16 service container (`REUSE_DATABASE_URL=1`), so every push/PR touching `services/control-plane/**` executes the proofs for real. It mirrors the sibling `fusion-tower-tests.yml` / `tower-baton-tests.yml` pattern.

**What it proves (25 subtests, all passing against real Postgres):** the `ops.git_sha` domain + `canonicalize_sha` (incl. whitespace/upper-case); verdict NOT-NULLs + exact-SHA composite-FK head binding; no duplicate active verdict + supersede-then-insert (on a **pinned client**, F11); **F1** cross-generation double-active rejected + a stale approve cannot mask a newer reject; `agent_event` append-only (`23001`) + **F5** TRUNCATE rejected; `merge_gate` NOT-NULL head + derived `overall_action_state` transitions (unobserved/head_moved/github_blocked/mergeable) + **F7** review-decision fold; **F2** a gate cannot be approved/mergeable without a head-bound two-reviewer approve; idempotency/lease invariants + **F9** `claim_job`/`reclaim_expired_leases`; **F3** verdict UPDATE/DELETE + checkpoint identity protection; **F6** reviewer↔role binding; **G1** a gate cannot borrow another build's checkpoint/approvals; **G2** approved-gate head/checkpoint rewrite + `DELETE` rejected; **G3** D1 closed — serial verdict-supersede auto-invalidates the gate **and** a genuine two-connection concurrent race cannot commit an approved gate alongside a freshly-active reject; **G4** `attempts <= max_attempts`, exhausted-pending parked/not claimable, and a stale-lease `complete_job` rejected + a genuine two-connection `claim_job` SKIP-LOCKED distinct-job proof; **G5** an unreferenced checkpoint delete rejected; **G6** verdict superseded-consistency + a verdict cannot be born superseded; **R4-1** merge_gate supersession is terminal (`superseded → pending`/`approved` rejected, `superseded_at` cannot be cleared/altered) and `superseded_at` may be set only on the decision→superseded transition; **R4-2** a gate cannot be born superseded (born-live guard); **R4-3B** a genuine two-connection update-to-approved vs concurrent verdict-supersede (both lock orders) commits no wrong state and does not deadlock; **R4-C4/R5-2** a catalog assertion that every ops `plpgsql` **and `sql`** function pins `search_path`; **R5-1** merge_gate immutability is default-deny (`id`/`created_at`/base-column UPDATE → `23001`, while a `github_*_cached`-only refresh and the legal `approved → superseded` still succeed, and D1's own supersede write still passes).

The migration is idempotent (verified by double-apply): re-running it against an existing `ops` schema is a no-op (only `NOTICE`s).

---

## Modelling decisions for Larry to confirm

1. **`checkpoint` is per-`(build_id, ref, head)`** (F11 — natural key now includes `build_id`, so two builds may share a `checkpoint_ref`/head). A Tower `checkpoint_id` reused at a new head becomes a *new* row (this is what makes the composite-FK head binding sound). If the control plane instead wants one mutable checkpoint row whose head is updated in place, the composite FK would need replacing with a trigger — I chose the immutable-per-head shape because it turns the invariant into an FK.
2. **`ops.git_sha` refuses abbreviated SHAs outright** (full 40 only). If any real inbound source can only supply a 7–12 char short SHA that cannot be expanded at the boundary, that source must resolve to the full SHA before writing. Keeping the strict domain and resolving upstream is the recommendation — accepting short SHAs is exactly the Tower bug.
3. **Schema name `ops`** (generic dev namespace) rather than a build-specific one like `ftw`. Confirm the final production namespace before any live apply.
4. **Object-ownership separation for a live apply** (see Threat model): own the objects with a dedicated admin/migration role distinct from the runtime `service_role`.
