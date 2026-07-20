# BUILD-014 PR-1 — Contract & Acceptance schema (build note)

**Migration:** `db/migrations/003_contract_acceptance_schema.sql` (additive; does not modify 001/002)
**Tests:** `db/test/contract-acceptance.test.js` + `db/test/run-contract-tests.mjs` (`npm run test:contract`)
**Branch:** `build-014/wp-1-contract-acceptance-schema`
**Status:** DESIGN ARTIFACT — **not applied to any hosted/live DB.** DEV/synthetic only. Never touches `asdair`/personal data. Larry runs the independent review + PR.

## What / why

003 adds the contract layer the Tower review flow verifies against, per v3 Part C/D and the campaign brief. Nine tables + two derived views, on top of 001 (checkpoint/verdict/head-binding) and 002 (authoritative current head):

- `prd`, `plan` — **immutable, versioned** (version chain via `(key, version)` + `supersedes_id`; at most one active version per key; supersede-then-insert is the only path to a new active version; a superseded version is retained for audit). `plan` carries `mypka_authoritative` + `machine_elements`.
- `wp` — the assurance **baseline** (risk tier + the four baseline required-assurance booleans). The checkpoint computes the *final* profile in PR-2 (`checkpoint_assurance` is intentionally NOT here).
- `acceptance_row` — **immutable requirement only** (`id, build_id, prd_version_id, acceptance_ref, requirement_text, owning_wp_id, expected_proof, impl_path`). No mutable evidence/result columns. UPDATE + DELETE both rejected.
- `acceptance_evidence` — **append-only** builder claim; `exact_sha` composite-FK-bound to the checkpoint's recorded head.
- `acceptance_verification` — **append-only, REVIEWER-PRINCIPAL ONLY**; contract-bound (`prd_version_id`/`plan_version_id`) and head-bound (composite FK to `checkpoint (id, head_sha)`).
- `finding` — normalised authority record (`opened_by`, `severity`, `impact`, `reachability`, `disposition`, `state`), replacing array-of-ids drift.
- `acceptance_finding` — the `(acceptance_row_id, finding_id)` many-to-many join replacing `open_finding_ids[]`.
- `pr` — `current_head_sha` labelled a **cached GitHub value** (GitHub authoritative; the checkpoint holds the frozen review target).
- `ops.contract_stale` (view) — system-derived staleness from **version supersession** only.
- `ops.current_acceptance_state` (view) — the latest verification bound to the **active** prd_version + **active** plan_version + the **authoritative current head** (`ops.build_head`), so a head move OR a contract supersession automatically invalidates a prior verification.

## The load-bearing guarantee: the builder cannot self-verify

`acceptance_verification.reviewer` is restricted to reviewer principals `{gpt_codex, fable, tower}` by a **named CHECK constraint** (`acceptance_verification_reviewer_is_reviewer_chk`) **plus** a defence-in-depth BEFORE INSERT trigger (`assert_acceptance_reviewer`). It is a CHECK deliberately (stronger than the spec's "trigger"): a CHECK is **not** bypassed by `session_replication_role=replica`, so `larry`/`warwick` cannot self-verify even with the trigger disabled — test 3 proves exactly this by disabling the trigger and re-attempting a `larry` insert (still `23514`). The reviewer set lives in one place (the CHECK + the function) so PR-2 widens it (e.g. a future `grok`) without a table rewrite. This is independent of the PR-4 DB-GRANT role separation.

Note: this reviewer set intentionally differs from 001's stricter verdict rule (`gpt_codex`/`fable` only). Tower is the trusted runtime that *writes* verifications on behalf of validated model results (v3 correction #1), so `tower` is an allowed verification principal here.

## How tested (executed, not asserted-on-paper)

`node db/test/run-contract-tests.mjs` provisions a throwaway isolated Postgres cluster, applies 001+002+003, runs 11 subtests, tears down. The runner fails loudly on 0 executed subtests. **Result: 11/11 pass, 0 fail, 0 skipped.** 001's suite still passes 25/25 (unaffected).

Subtests: (1) acceptance_row/prd/plan immutability incl. prd/plan only active→superseded and non-forgeable `superseded_at`; (2) evidence/verification append-only + exact-SHA FK binding; (3) **builder (larry/warwick) rejected from acceptance_verification, incl. the trigger-disabled CHECK proof; reviewers accepted**; (4) **head move → prior verification invalidated in `current_acceptance_state`, re-verify at new head restores**; (5) **PRD supersession → prior verification invalidated (`contract_stale` + current view)**; (5b) two active PRD versions per key rejected (supersede-then-insert only); (6) **TRUNCATE guards** (bare truncate refused `23001`/`0A000`; CASCADE hits the guard trigger `23001`); (7) verification citing a wrong PRD version rejected by composite FK; (8) finding normalisation + state/disposition CHECK + immutable authority fields + join; (9) catalog fence — every ops function (incl. 003's) pins `search_path`; (10) 003 double-apply idempotent.

## Self-review against the discipline checklist

- RLS **enabled + FORCED** deny-by-default on all 9 tables; `service_role` only; `anon`/`authenticated` get neither grant nor policy. ✔
- Reused `ops.git_sha` domain; every SHA column canonical; evidence/verification/finding heads bound via composite FK to `checkpoint (id, head_sha)`. ✔
- Immutability/append-only via triggers **and** typed constraints; BEFORE TRUNCATE guards on prd/plan/acceptance_row/evidence/verification; every plpgsql/sql function pins `set search_path = ops, pg_catalog` (catalog-fenced by test 9). ✔
- No enum/table name collisions; named CHECK constraints throughout; evidence FKs `ON DELETE NO ACTION`. ✔
- Default-deny function EXECUTE (`revoke ... from public`); all 003 functions are trigger functions (fire regardless of grant). ✔
- Fully idempotent (DO-block enums, `if not exists`, `create or replace`, drop-if-exists triggers/policies) — double-apply proven (test 10). ✔

## Residuals flagged for the reviewers

1. **`supersedes_id` same-key not enforced.** The chain pointer is build-scoped (composite FK to same build) but does not structurally force the predecessor to share the same `prd_key`/`plan_key`. The partial-unique-active index enforces the core one-active-per-key invariant; a mis-pointed `supersedes_id` across keys within a build is possible but harmless to the staleness logic. Low severity; can tighten with a trigger later if wanted.
2. **`acceptance_finding` allows DELETE (unlink).** Treated as a correctable relation, not evidence (the finding itself persists on `ops.finding`, which is delete-guarded). If reviewers want the link append-only for audit, drop the DELETE grant + add a reject-mutation trigger.
3. **`current_acceptance_state` depends on `ops.build_head` (002).** A build with no head advanced yet yields `is_currently_verified=false` for all its rows (no current head to match). This is the intended fail-closed default; ingress calls `advance_build_head` in the same txn as the checkpoint upsert (002).
4. **`finding.severity`/`reachability` mutable by design** (authority re-triage). Identity/authority fields (`opened_by`, `finding_ref`, `opened_at_sha`, etc.) are frozen; only triage/disposition/state change.
5. **Threat-model residuals inherited from 001** (owner `DISABLE TRIGGER` / `session_replication_role=replica`, SUPERUSER/BYPASSRLS) still apply to trigger-based guards. The reviewer-only guarantee is hardened against the trigger-disable case via the CHECK (test 3), but the append-only/immutability triggers share 001's documented residual. PR-4 owns the runtime DB-GRANT separation.
