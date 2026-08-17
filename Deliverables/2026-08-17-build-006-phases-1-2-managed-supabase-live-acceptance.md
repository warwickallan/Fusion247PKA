# BUILD-006 Phases 1 and 2 — managed-Supabase LIVE ACCEPTANCE evidence

- **Date:** 2026-08-17
- **Map:** `Deliverables/2026-08-03-build-006-vlogops-publishing-engine-wayfinder-plan.md`
- **Work class:** **ACCEPT** — proving already-built, already-merged, already-Codex-approved capability in its intended live environment. **No product code was written or changed.**
- **Executed by:** Larry, personally. See §7 for why this could not be delegated.
- **Target:** the managed Supabase project (Postgres 17.6), the same project holding `asdair.*` and `session_report.*`.
- **Repo state during the run:** `main` at `c06ee56`, working tree clean apart from Pax's two untracked report files.

> **STATUS: acceptance evidence COMPLETE. Phase PASS is NOT recorded here and is not Larry's to record.**
> Both phases are submitted to Veritas for Gate 1 and Gate 2 assurance. Under
> `GOVERNANCE-VERITAS-HIRE` the maximum permitted statement is that the work is integrated and
> submitted for assurance. The frontier instruction *"ONLY THEN mark Phase 1 PASS and Phase 2
> PASS"* fixes the **ordering** — evidence before PASS — and is read as not repealing the named
> Veritas gate, which Warwick has not been asked to waive. If he wants it waived he can say so.

---

## 1. What was outstanding, and why it mattered

Phases 1 and 2 were merged and individually Codex-approved, but **migrations `001` and `002` had never reached the managed project.** Merging applied nothing. Everything proven until today was proven on disposable clusters — capability, not the human outcome. This document closes that gap.

Verified before touching anything: **no `vlogops` schema existed**, and the migration ledger's last entry was `20260810215203`. Nothing vlogops had ever been applied. The map's claim was accurate.

## 2. The route, established by execution rather than recalled

`services/vlogops/RUNBOOK.md` §9 governs: the two migrations apply in numeric order, and doing so against the managed project is **a live action owned by Larry, never an operations task**.

**Safety verified mechanically, not from the files' own header comments.** Scanning both files for `grant`, `revoke`, `row level security`, drops, role changes, `search_path`, `truncate`, `delete`, `update`:

- every hit is either a `drop trigger if exists` idempotency guard or an append-only trigger definition;
- every hit targets a `vlogops` object;
- **zero GRANT, zero REVOKE, zero RLS statement, zero table/schema drop;**
- **no schema other than `vlogops` is referenced anywhere in the DDL.**

The files' "additive and isolated" claim therefore holds by measurement.

## 3. Migrations applied — steps (2) and (3)

Applied with the files' **exact bytes**, read and hashed at the moment of application, never a retyped copy. Each inside an explicit transaction with rollback on error.

| File | Bytes | sha256 | Ledger row |
|---|---|---|---|
| `db/001_vlogops_content_seed.sql` | 10,078 | `b19508b5ccdc00997ee87d6183d733b7727fe94b70b217bb10a643e12bdcbfcd` | `20260817120000` `vlogops_001_content_seed` |
| `db/002_vlogops_evidence_pack.sql` | 11,204 | `b93e188da7dfc1cc02476236b94c30cc2b8ebad776442f5bd3bde3d16fa1935c` | `20260817120001` `vlogops_002_evidence_pack` |

Both **COMMITTED**, as `postgres` / db `postgres` / Postgres 17.6.

### Schema state proven after application

| Property | Measured | Expected |
|---|---|---|
| Tables in `vlogops` | 6 | `content_seed`, `source_snapshot`, `intake_run`, `evidence_pack`, `evidence_pack_entry`, `compile_run` |
| Non-internal triggers | 7 | append-only + identity guards |
| Constraints | 44 | — |
| Indexes | 15 | — |
| Grants to `anon` / `authenticated` / `service_role` / `PUBLIC` | **0** | 0 — by design |
| `anon` can SELECT any `vlogops` table | **false** | false |
| Sole grantee on `vlogops` | `postgres` | the owner |
| RLS-enabled tables in `vlogops` | 0 | 0 — unreachable via Data API, so RLS is not the control |
| RLS changes to `asdair` / `session_report` | **0** | 0 — nothing outside `vlogops` touched |

### Idempotency proven against the managed project, not a fixture

A **second** application of both files left an identical fingerprint — 6 tables / 7 triggers / 44 constraints / 15 indexes — and the ledger still holds exactly **2** vlogops rows, no duplicates. The "FORWARD-ONLY and IDEMPOTENT" claim is now proven where it counts.

## 4. Phase 1 — the real Content Seed path, step (4)

Phase 1's recorded gate (§10 of the map): *"A seed from each route lands durably; kill mid-intake and recover; identity survives restart."* All three, live:

### All three intake routes landed durably

| Route | Command | Result |
|---|---|---|
| **records** | `records --from 2026-08-05 --to 2026-08-05` | `seed_id 0c19424e…` `deduplicated:false` **members 12** |
| **promote** | `promote --origin "AsdAIr weekly shop pipeline — BUILD-015 live run" --angle … --file DEMONSTRATION.md` | `seed_id 39c4428b…` `deduplicated:false` `members 1` |
| **supplied** | `supplied --angle … --file RUNBOOK.md` | `seed_id 3439b2cd…` `deduplicated:false` `members 1` |

All exit **0**. Real repository artefacts, not synthetic fixtures.

### Identity survives restart

Every route re-run in a **fresh process**: identical `seed_id`, `deduplicated: true`. Identity is a pure function of content, across process boundaries, against the managed store.

### Killed mid-intake — made to fail, at two timings

A complete wide-window intake takes **6.0s**, which is what makes the timings meaningful rather than decorative.

| Kill | Result | Store after |
|---|---|---|
| **SIGKILL at 500ms** (early) | exit 137 | seeds 3, snapshots 14, runs 6 — **unchanged**; orphan snapshots 0; unsealed 0; **`idle in transaction` 0** |
| **SIGKILL at 5,500ms** (near commit) | exit 137 | seeds 4, snapshots 26, runs 7 — **unchanged from the prior success**; orphans 0; unsealed 0; seeds-without-snapshots 0; stuck txns 0 |

Both killed intakes then **completed on re-run** with `deduplicated:false` (`70a43961…`, `e8a5fb30…`) — proving the killed work was genuinely absent rather than silently half-present. **The two-state invariant — nothing at all, or all of it — holds at both an early and a near-commit kill.**

## 5. Phase 2 — the real evidence-pack path, step (5)

Phase 2's recorded gate: *"A real seed produces a bounded, provenance-complete evidence pack; a connector failure cannot alter an existing run."*

### A real bounded pack

`compile --seed 0c19424e…` →
`pack_id 45c7ad3d…` · **entries 8** · `entry_bytes 232,356` · **`bounded: true`** · **`omitted: 4`** · `candidates 12`

A genuine narrowing that dropped real evidence and **says so**, which is the property the schema exists to make unfalsifiable.

### Determinism, by byte comparison

A second independent compile returned the **same `pack_id`** with `deduplicated: true` — one pack, not two. The two emitted canonical documents:

```
pack-a.json  3851 bytes  sha256 be3c23eca59662bb01010cf0291b3d764d2ff3ac879a2f5d97c981825ffc7cb3
pack-b.json  3851 bytes  sha256 be3c23eca59662bb01010cf0291b3d764d2ff3ac879a2f5d97c981825ffc7cb3
BYTE-IDENTICAL: true
```

### `verify` never re-reads the original sources — the reliability rule, proven

`verify --pack 45c7ad3d…` → `ok:true`, `entries_verified 8/8`, `problems []`.

Then the same verify **with `VLOGOPS_REPO_ROOT` pointed at an empty directory** — the original sources unreachable — → **`ok:true`, 8/8, `problems []`**, exit 0. It reads only frozen snapshots. This is the live form of "a source edited, corrupted or deleted afterwards cannot rewrite history".

### Killed mid-compile

Compiles are sub-second, so a 1,200ms kill fired *after* commit and tested nothing — recorded here because it would otherwise look like a passing test. Re-run against a fresh seed at **400ms**: exit 137, and packs 2 / entries 16 / compile_runs 3 **unchanged**, orphan entries 0, packs-without-entries 0, stuck txns 0. Completing it afterwards produced `c3606ddd…`.

### The append-only controls, mutation-tested live

**20 attempts, every one inside a transaction that was always rolled back**, so a control that failed to fire would still leave nothing behind. Attempts covered UPDATE and DELETE on all six tables, plus a genuine value change to **each of the nine identity-bearing columns** of `content_seed`.

**Result: 20 refused, 0 permitted**, each with the intended error — `append-only; UPDATE refused`, `append-only; DELETE refused`, `<col> is identity-bearing and immutable; UPDATE refused`.

**The harness was itself proven capable of observing a success:** a deliberate non-identity update was permitted on 5 rows and rolled back. Without that, "20 refused" could have meant a harness that never executed anything.

**One correction, recorded because the first attempt was wrong and a false finding is as bad as a false pass.** An initial attempt of `set seed_id = seed_id` was *permitted*. That is the control working as designed — the trigger compares with `is distinct from`, and `001` lines 158–160 document that lifecycle columns stay writable. The test was re-authored to change values to genuinely different ones. **No defect existed; my first probe was the defect.**

## 6. Final live state

| Measure | Value |
|---|---|
| Seeds | 5 |
| Routes present | `promotion`, `records`, `supplied` — **all three** |
| Source snapshots | 38 |
| Intake runs | 8 (attempts recorded even where nothing needed writing) |
| Evidence packs | 3 — **all `bounded`** |
| Pack entries | 24 |
| Compile runs | 4 |
| Unsealed seeds | **0** |
| Entries without a matching snapshot | **0** — provenance-completeness is structural |
| Tamper traces after the rollback suite | **0** |
| `manifest_algo` | `sha256-canonical-json-v1` on all 5, uniform |

## 7. Why this run was not delegated

The managed-project connection string lives at the **root** of `C:\.fusion247`. GL-012 §4 makes a surface at or above the secrets root an **invalid grant that a worker must refuse at read-back**. There was therefore no lawful way to hand this to Keel, and routing around the boundary to make delegation possible would have been the wrong trade. Larry executed it directly and states it here rather than leaving a silent Rule-4 deviation. The work was bounded, understood and reversible; the live write was authorised by the map's frontier.

## 8. Residuals and findings — reported once, for Warwick's decision

**None of these blocks the acceptance evidence above. None is raised as a Work Order.**

1. **`RUNBOOK.md` §2 does not name where `VLOGOPS_DB_URL` comes from** — `non-blocking`, and **narrower than it first appeared.** I initially recorded this as "the connection string only exists in another service's file", implying a borrow. That was wrong, and the correction matters: **`tools/session-report/populate.mjs` documents `C:/.fusion247/fusion-capture-gateway.env` → `DATABASE_URL` as the estate's *fixed approved credentials path* for this project's Postgres**, used by the same ding-pattern loader. It is the sanctioned route, not an improvisation. **What is genuinely missing is only that `vlogops` names its variable `VLOGOPS_DB_URL`** while the approved file supplies `DATABASE_URL`, so this run mapped the name at invocation. **Recommendation (Warwick's call, one line either way):** either add `VLOGOPS_DB_URL` to that approved file, or have `RUNBOOK.md` §2 name the file and the mapping explicitly. Until one of those happens the operator route depends on Larry remembering the mapping — which is the failure "nothing may live only in Larry's head" exists to prevent, even though the credential handling itself was correct.
2. **The vlogops runtime identity is `postgres`, the schema owner.** This follows from the migrations issuing no grants — a deliberate, Codex-approved design property that keeps `vlogops` invisible to the Data API. It also means the service connects as a superuser. Stated for his decision; the alternative is a dedicated `vlogops_rw` role plus grants, which is a schema change, not an operations one.
3. **The repo test suite was deliberately NOT pointed at the managed project.** `db/teardown.sql` drops the entire `vlogops` schema, packs included, and the suite is written for disposable clusters. Running it against managed Supabase would be destructive. Recorded so no future session "finishes the job" by doing it.
4. **The RLS advisory fired again** — 34 tables across `asdair` and `session_report`. **PARKED** under Warwick's standing ruling; this is his own worked example of the hobby-brain bar and is not re-raised. `vlogops` adds nothing to that surface: 0 grants, `anon` cannot select.

## 9. What this evidence does and does not establish

- **It establishes:** the schema is live on the managed project; both migrations are idempotent there; all three Phase-1 intake routes work against it; identity survives restart; a mid-intake kill leaves nothing partial at two timings; a real bounded provenance-complete pack compiles deterministically; `verify` passes without the original sources; the append-only controls actually fire.
- **It does not establish:** any Phase 3–7 capability; the eleven §9 programme criteria (those span BUILD-006 and BUILD-019 and require the full journey); or a phase PASS, which is Veritas's to grant.
