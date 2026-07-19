# BUILD-014 WP-A — Control Plane: Minimum Phase-0 Schema

**Migration:** `migrations/001_control_plane_min_schema.sql`
**Target schema:** `ops` (control-plane **DEV** namespace)
**Status:** DESIGN ARTIFACT — **not applied to any live/prod DB by this WP.** A live apply is Larry-gated and must target an isolated dev database. Never touches the `asdair` schema or any personal/entrusted data.

---

## Why this schema exists

Postgres becomes the **authoritative live operational + merge-gate store**. GitHub stays the **mechanical merge enforcer + code/evidence authority**. A verdict is bound to an **exact commit SHA by typed constraints**, not by application-level `===` string comparisons.

The Tower merge gate took four review rounds to harden because "merge-ready" state was **head-blind**. This schema moves that invariant out of fragile code and into the database, where it is *structurally impossible* to violate.

---

## How the constraints make "merge-ready for the wrong head" impossible

Two independent, layered structural defences — a bug has to defeat **both**:

1. **`ops.git_sha` domain** — a commit SHA column can only hold a **canonical, lower-case, full 40-char** hex value (`CHECK value ~ '^[0-9a-f]{40}$'`). The Tower bug was that `checkpoint.js` accepts `/^[0-9a-f]{7,40}$/i` (7–40 hex, case-insensitive) and then compares heads with raw `===`, so a short `abc1234` or upper-case `ABC1234…` silently fails to bind. Here a non-canonical head **cannot be stored at all**. Callers canonicalise at the boundary via `ops.canonicalize_sha(text)`, which *raises* on a short/abbreviated head instead of letting it through.

2. **Composite foreign key `verdict (checkpoint_id, reviewed_commit_sha) → checkpoint (id, head_sha)`** — a verdict can only reference a `(checkpoint, head)` pair the checkpoint actually recorded. A verdict for the *wrong head* is a **foreign-key violation at INSERT**, not a runtime miscompare. A reused checkpoint ref at a new head is a *new* checkpoint row, so a stale verdict cannot follow the head forward.

On top of these, the hard invariants:

- `verdict.reviewed_commit_sha`, `verdict.reviewer`, `verdict.verdict` are all **NOT NULL**.
- Partial unique index `verdict_active_unique` on `(reviewer, reviewed_commit_sha, verdict_type, active_generation) WHERE state='active'` — **no duplicate active verdict**. Superseding (`state='superseded'`) or bumping `active_generation` is the only way to record a new active verdict.
- `merge_gate.expected_head_sha` **NOT NULL** (canonical by domain).

The head-bound **two-reviewer** invariant Tower implements in `computeMergeReady()` is reproduced as data in the view `ops.checkpoint_merge_readiness`: readiness = one **active** genuine `approve` of **each** `verdict_type` at the **same head**. Because verdicts are composite-FK-bound to the checkpoint's exact head, any verdict the view sees is guaranteed to have reviewed that head. `comment` (unverifiable) is excluded — never merge-ready.

---

## Dual-gate representation (Fusion policy vs GitHub mechanical)

`ops.merge_gate` keeps the two states **strictly separate** and makes one undifferentiated "Approved" impossible to represent:

| Concern | Columns |
|---|---|
| **Fusion policy** (authoritative for policy) | `fusion_policy_decision`, `expected_head_sha`, `policy_reason` |
| **GitHub mechanical** (cached projection; GitHub authoritative) | `github_mech_state_cached`, `github_head_sha_cached`, `github_review_decision_cached`, `github_observed_at` |
| **Derived** (generated, immutable) | `heads_agree`, `overall_action_state` |

`overall_action_state` (a stored generated column over base columns only) resolves to exactly one of:
`superseded` → `fusion_not_approved` → `head_moved` → `github_blocked` → `mergeable`.

So the cockpit can render: **"Fusion policy: approved for `abc123…` / GitHub mechanical: blocked / Overall: not mergeable."**

A **moved head invalidates the prior decision two ways**: (a) explicit supersede (`superseded_at`, enforced by the `merge_gate_one_live_per_build` partial-unique index — at most one live gate per build), and (b) the derived state flips to `head_moved` the instant `github_head_sha_cached` diverges from `expected_head_sha`.

---

## Append-only events & provenance

`ops.agent_event` is **INSERT-only**:
- **Trigger** `agent_event_append_only` rejects any `UPDATE`/`DELETE` of an existing row (corrections are *new* events).
- **Privilege layer** grants `service_role` `SELECT, INSERT` only (defence in depth behind the trigger).
- Every event carries a `delivery_key` (unique idempotency key) and a **NOT NULL** `payload_hash` (material-payload integrity fingerprint).
- `classification` + the generated `git_provenance_eligible` (`true` only for `public`/`internal`) structurally excludes `sensitive`/`secret` events from public git provenance. `secret` values are never stored here at all — pointers only.

---

## Field classification (R3)

Every table and column carries an inline `[tag]` in the SQL. Legend:
`phase0` = needed now to prove the seven things · `later` = kept minimal, expand in a later WP · `projection-only` = a cache of an external authority (GitHub), never the source of truth · `provenance-later` = deferred audit/provenance detail · `not-yet-justified` = present as a placeholder, must earn its place before it stays.

| Table | Class | Proof | Notes |
|---|---|---|---|
| `build` | phase0 | identity (7) | Minimal build identity to hang the rest on. |
| `workflow_run` | **projection-only** | identity (7) | Cache of a GitHub Actions run; GitHub authoritative. |
| `agent_run` | phase0 | identity (7) | Minimal agent working-span record. `role` is `later`. |
| `job` | phase0 | (1) durable job/lease | pgmq-compatible: leaseable, idempotency-keyed, attempt-bounded, dead-letter. |
| `agent_event` | phase0 | (2) append-only | INSERT-only via trigger + privilege; delivery key + payload hash + classification. |
| `checkpoint` | phase0 | (3) exact-SHA | Canonical head by domain; `(id, head_sha)` unique is the composite-FK target. |
| `verdict` | phase0 | (3) exact-SHA | NOT NULL sha/reviewer/verdict; active-uniqueness; composite-FK head binding. |
| `merge_gate` | phase0 | (4) policy gate, (5) divergence | Dual-gate separation; derived `overall_action_state`. |
| `command_request` | phase0 | (6) command req/result | Idempotency-keyed; args/result hashes; classification. |
| `checkpoint_merge_readiness` (view) | **projection-only** | (3) | Head-bound two-reviewer readiness, as data. |

Column-level classifications live inline in the SQL (`[phase0]`, `[projection-only]`, `[later]`). Fields tagged `projection-only` are all the `github_*_cached` / `*_observed_at` / `workflow_run.*` columns — caches of GitHub, never authoritative.

### Deliberately deferred (NOT in this minimum schema)

- Full run/turn orchestration state machine, token/time budgets (BUILD-010 `ftw.*` already models a richer version — not duplicated here).
- Rich provenance/audit chains, signed-envelope storage, key registries (`provenance-later`).
- Multi-tenant / multi-user auth surface (`anon`/`authenticated` gated paths) — deny-by-default until a future WP authors it under the security gate.
- Notification/Telegram delivery records, retry/backoff schedules beyond the minimal `job` lease.
- Cross-build dependency graph, work-package decomposition.

---

## Modelling decisions for Larry to confirm

1. **`checkpoint` is per-`(ref, head)`** — a Tower `checkpoint_id` reused at a new head becomes a *new* row (this is what makes the composite-FK head binding sound). If the control plane instead wants one mutable checkpoint row whose head is updated in place, the composite FK would need replacing with a trigger. I chose the immutable-per-head shape because it turns the invariant into an FK.
2. **`ops.git_sha` refuses abbreviated SHAs outright** (full 40 only). If any real inbound source can *only* supply a 7–12 char short SHA that cannot be expanded at the boundary, that source must resolve to the full SHA before writing. I recommend keeping the strict domain and resolving upstream — accepting short SHAs is exactly the Tower bug.
3. **Schema name `ops`** (generic dev namespace) rather than a build-specific one like `ftw`, since BUILD-014 is the broader control plane. Confirm the final production namespace before any live apply.

---

## Validating the invariants

`test/constraint-invariants.test.js` is a **DB-gated** proof (Node `node:test` + `pg`). It self-skips when `DATABASE_URL` is unset, so it never touches prod by default. Against an **isolated throwaway** dev Postgres it: applies the migration into a fresh `ops` schema, then asserts each hard invariant fails/passes as designed (non-canonical SHA rejected, wrong-head verdict rejected by FK, duplicate active verdict rejected, `agent_event` UPDATE/DELETE rejected, `merge_gate` derived state transitions, idempotency-key collisions).

```
DATABASE_URL=postgres://user:pass@localhost:5432/scratch_dev node --test services/control-plane/db/test/
```
