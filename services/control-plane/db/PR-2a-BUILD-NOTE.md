# BUILD-014 PR-2a — Reviewer registry + review packet/run + checkpoint assurance (build note)

**Migration:** `db/migrations/004_reviewer_registry_and_packet.sql` (additive; does not modify 001/002/003)
**Tests:** `db/test/reviewer-registry-packet.test.js` + `db/test/run-registry-tests.mjs` (`npm run test:registry`)
**Branch:** `build-014/wp-2a-reviewer-registry-packet-run` (off `build-014/wp-1-contract-acceptance-schema` @ 65e77878)
**Status:** DESIGN ARTIFACT — **not applied to any hosted/live DB.** DEV/synthetic only. Never touches `asdair`/personal data. This is the SCHEMA half of the reviewer-trust core; the Tower packet-builder + reviewHandler refactor + product-QA prompt wiring are a SEPARATE follow-on (PR-2b) that consumes these tables.

## What / why

004 adds the reviewer-trust schema layer on top of 001 (head-bound checkpoint/verdict/merge-gate), 002 (authoritative current head) and 003 (contract/acceptance/finding):

- **`reviewer_registry`** — the GENERIC reviewer identity. **TEXT `reviewer_key` primary key (NOT `ops.principal`)** + provider, model, adapter_identity, `enabled` (availability), honest-label. Codex and Fable are ROWS here, not special cases.
- **`reviewer_authorised_role`** — normalised `(reviewer_key, review_role)` grant join table (replaces an `authorised_roles[]` array — no array drift). The FK target that lets `review_run` prove a reviewer only fills its authorised roles.
- **`ops.review_role`** enum — `product_qa` · `adversarial_assurance` · `security_assurance`.
- **`checkpoint_assurance`** (v3 Part B) — per-checkpoint COMPUTED required-role profile (`product_qa_required`, `adversarial_review_required`, `security_review_required`, `warwick_approval_required`, `auto_merge_eligible` **EXPLICIT — never inferred from green gates**, `triggers[]`, `policy_version`, `calculated_at`). The COMPUTATION lives in PR-2b; this is the table + constraints + FK only.
- **`review_packet`** (v3 Part A + correction #2) — first-class, versioned, **HASHED, RESOLVED-IMMUTABLE-PAYLOAD** snapshot. `resolved_payload jsonb` and/or `payload_artifact_ref` (content-addressed) + `packet_hash` — NOT bare arrays of record ids. Exact-head-bound by composite FK to `checkpoint(id, head_sha)`. Immutable once ready/hashed (guard); `packet_hash` write-once; ready/consumed/stale requires a hash + resolved payload (CHECK); blocked requires a reason (correction #3 — no silent truncation); state machine `building→ready|blocked`, `ready→consumed|stale`, `consumed→stale`.
- **`review_run`** (v3 Part A) — proves WHAT a model reviewed. Append-only. BOUND by **composite FK** to the packet's `packet_hash` + exact head + `prd_version_id` + `plan_version_id`, and to an AUTHORISED `(reviewer_key, review_role)` grant. All bindings structural FKs, not trigger checks.
- **`review_run_finding`** — normalised `(review_run_id, finding_id, relation∈{opened,closed})` join (replaces `findings_opened[]/closed[]`).
- **`ops.verdict_reviewer`** (view) — surfaces historical 001 verdicts with registry metadata via `principal_alias`, WITHOUT touching `verdict`.
- **`ops.checkpoint_role_readiness`** (view) — model-agnostic risk-tiered readiness from required roles + registry + latest completed runs.
- **`ops.feature_flag` + `ops.role_based_readiness_enabled()` + `ops.checkpoint_effective_readiness`** — the feature gate (correction B, below).

## Warwick correction A — the reviewer identity is text-keyed; the enum is NOT the extensibility boundary

Required shape delivered:
- registry PK is **`reviewer_key text`** (slug-checked), never `ops.principal`.
- a **separate `reviewer_authorised_role` join table** (`reviewer_key ↔ review_role`).
- **historical enum-bound verdict evidence is UNTOUCHED** — `verdict.reviewer` / `verdict_type` and every old row are never rewritten or migrated. The old principals map into the new model via `reviewer_registry.principal_alias` (nullable `ops.principal`, one-way surfacing) + the read-only **`ops.verdict_reviewer` compatibility view**.
- **adding a future reviewer is an INSERT** into `reviewer_registry` + one `reviewer_authorised_role` grant — **zero schema change, zero enum change.** Test 1 proves exactly this: a `grok` run is rejected until `grok` is registered by config, then accepted — and asserts `ops.principal` is byte-for-byte the closed 001 vocabulary (`fable, gpt_codex, larry, tower, warwick`), i.e. `grok` was NOT added to the enum.

**Design decision + alternatives (for the reviewers):**
- *Chosen:* text-key registry + normalised role-grant join + nullable `principal_alias` compatibility map + read-only surfacing view. Rationale: new reviewers are common (config), new roles are rare (schema) — the two axes are separated; history is immutable; the enum is retired as an extensibility boundary without being deleted (001's verdict rule still stands for legacy rows).
- *Alt 1 (rejected):* add `grok` to `ops.principal`. Rejected per Warwick — not model-agnostic; every future reviewer is DDL.
- *Alt 2 (rejected):* `authorised_roles review_role[]` array column on the registry. Rejected — array drift; can't be an FK target; can't protect used grants. The join table is the same discipline that replaced `open_finding_ids[]` in 003.
- *Alt 3 (considered):* migrate `verdict.reviewer` to text. Rejected — rewrites immutable historical evidence. The surfacing view achieves compatibility with zero rewrite.

## Warwick correction B — role-based readiness is ADDED but INERT (feature-gated OFF)

- 001's `checkpoint_merge_readiness` (both-required) **remains the governing path and is not modified or superseded.** The ACTIVE `merge_gate_require_reviewers` enforcement trigger (001) is untouched and still reads the legacy path — the role-based path is **not wired into any active gate** in PR-2a.
- The gate is an explicit flag: **`ops.feature_flag['role_based_readiness']` defaults `false`**. `ops.checkpoint_effective_readiness` (the governing read model) delegates to LEGACY both-required while OFF, and to role-based only when ON.
- `ops.checkpoint_role_readiness` is advisory/computable at all times but governs nothing until the flag flips (PR-2b).

Test 9 proves: (i) flag ON → role-based governs (low-risk checkpoint ready on product_qa alone); (ii) flag OFF (default) → legacy both-required governs, a legacy checkpoint with both verdicts is merge-ready and the role-based-"ready" checkpoint is NOT effective-ready (role-based does not govern); (iii) adversarial-required-but-unavailable is BLOCKED under the role-based policy, never silently downgraded. No 001/002/003 file is edited, so historical readiness is byte-for-byte unchanged (001 suite 25/25 unchanged).

## How tested (executed, not asserted-on-paper)

`node db/test/run-registry-tests.mjs` provisions a throwaway isolated Postgres cluster, applies 001+002+003+004, runs 9 subtests, tears down. The runner FAILS on 0 executed subtests.

```
# tests 9
# pass 9
# fail 0
# skipped 0
```

Subtests: (1) registry drives role authorisation — unauthorised `(reviewer,role)` → FK 23503; a new `grok` added by config only, `ops.principal` unchanged; (2) review_packet immutable once ready/hashed, packet_hash write-once, ready-requires-hash + blocked-requires-reason CHECKs, illegal transitions + born-consumed rejected, wrong-head packet → FK; (3) review_run composite-FK bound to packet_hash + head + prd/plan (each wrong binding → FK 23503), completed-consistency CHECK, append-only; (4) role-based readiness — low-risk ready on product_qa alone (and the old both-required rule cannot govern it), adversarial-required blocks until adversarial approves, adversarial-required-but-unavailable → BLOCKED; (5) historical verdicts preserved + surfaced (not relabelled) + old rule cannot govern a risk-tiered checkpoint; (6) 004 double-apply idempotent (6 tables + 3 enums + seed intact); (7) catalog fence — every ops function (incl. 004's) pins search_path; (8) reviewer_registry identity durability (DELETE rejected, key immutable, enable toggle, principal_alias unique); (9) feature-gate inertness (correction B).

**Regression:** 001 suite 25/25, 003 suite 11/11 — unchanged (004 is additive; those suites don't apply 004).

## Self-review against the discipline checklist

- RLS **enabled + FORCED** deny-by-default on all 7 new tables; `service_role` only; `anon`/`authenticated` get neither grant nor policy. ✔
- Reused `ops.git_sha` domain + `ops.canonicalize_sha` posture; every SHA column canonical; packet head bound via composite FK to `checkpoint(id, head_sha)`. ✔
- Immutability/append-only via triggers **and** typed constraints; write-once `packet_hash`; BEFORE TRUNCATE guards on every new table; every plpgsql/sql function pins `set search_path = ops, pg_catalog` (catalog-fenced by test 7). ✔
- No enum/table name collisions (new enums `review_role`/`packet_state`/`review_outcome`; new tables don't collide with any 001/003 enum or table). Named CHECK constraints throughout; evidence/binding FKs `ON DELETE NO ACTION`. ✔
- Registry stores HONEST labels + adapter POINTERS, never credentials (reviewer subprocesses get no DB/Telegram secrets — correction #1). ✔
- `auto_merge_eligible` EXPLICIT + a named CHECK forbidding it alongside `warwick_approval_required`. ✔
- Default-deny function EXECUTE (`revoke ... from public`); only `role_based_readiness_enabled()` needs + gets an explicit `service_role` grant (it's called by a security_invoker view). ✔
- Fully idempotent (DO-block enums, `if not exists`, `create or replace`, drop-if-exists triggers/policies, `on conflict do nothing` seeds) — double-apply proven (test 6). ✔

## Residuals flagged for the reviewers

1. **`review_run` per-role "latest wins" is by `(completed_at desc, created_at desc, id desc)`**, mirroring 001's active-verdict "latest supersedes" semantics but WITHOUT an explicit active/superseded column (review_run is append-only). A later `changes_requested` at the same head correctly supersedes an earlier `approve`. If reviewers prefer an explicit supersede chain (like verdict), that is a PR-2b addition; the readiness view already reflects the latest-run rule.
2. **`checkpoint_role_readiness` is head+role scoped, not contract-staleness composed.** It answers "are the required roles satisfied at this checkpoint's (immutable) head?". Contract-supersession invalidation for acceptance already lives in 003's `current_acceptance_state`; composing the two into one overall gate is PR-2b's job (this PR keeps the role-readiness view focused and inert).
3. **`review_packet.prd_version_id`/`plan_version_id` are nullable** (a building/blocked packet may not have resolved them). The `review_run` composite FKs still force a run to bind only to a packet with a resolved PRD+Plan (a null on the packet can't satisfy the composite FK) — so a run against an unresolved-contract packet is a fail-closed FK violation, which is the intended behaviour.
4. **`reviewer_authorised_role` allows DELETE (revoke a grant)** but the `review_run` composite FK is `ON DELETE NO ACTION`, so a grant a run already used cannot be revoked (evidence-protected). An unused grant can be removed. If reviewers want grants fully append-only, drop the DELETE grant + add a reject trigger.
5. **Feature flag is a global toggle** (`role_based_readiness`), not per-build/per-risk-tier. PR-2b may want per-build rollout; the `feature_flag` table generalises trivially (add rows), but the effective view currently reads the single global key.
6. **Threat-model residuals inherited from 001** (owner `DISABLE TRIGGER` / `session_replication_role=replica`, SUPERUSER/BYPASSRLS) still apply to the trigger-based guards. The registry role-authorisation + review_run bindings are **CHECK/FK-backed** (not only triggers), so those survive a trigger-disable; the packet immutability + append-only guards share 001's documented residual. PR-4 owns the runtime DB-GRANT (5-role least-privilege) separation.
