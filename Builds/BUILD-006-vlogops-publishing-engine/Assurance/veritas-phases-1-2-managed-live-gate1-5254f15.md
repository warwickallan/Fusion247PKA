---
build: BUILD-006-vlogops-publishing-engine
scope: phases-1-and-2-managed-supabase-live-acceptance
gate: 1

boundary: >
  BUILD-006 Phase 1 (seed intake + durable Content Seed store) and Phase 2 (Source Compiler /
  evidence pack), at the managed-Supabase live-acceptance boundary. The outcome promised:
  the two phases' recorded §10 gates hold in the REAL intended context — the managed Supabase
  project — which is the single named ground on which PASS was withheld from both phases.
  THE SHAs BELOW ARE PROVENANCE, NOT THE IDENTITY OF THIS GATE.

reviewed_sha: 5254f1507c9b8012d4bde200b1aec1cf4473dee3
governance_sha: 5254f1507c9b8012d4bde200b1aec1cf4473dee3
branch: main
remote_reachable: true

evidence_method: target checkout (repository, read in place) — LIVE RUNTIME NOT REACHABLE BY THIS REVIEWER
evidence_workspace: C:/Fusion247PKA (no export taken; no mutation testing performed)
worktree_head_at_start: 5254f1507c9b8012d4bde200b1aec1cf4473dee3
worktree_head_at_end: 70dd22785153df85c03bcfd62639a848d198e256
worktree_status_clean: false
worktree_state_disclosure: >
  ⚠️ THE REPOSITORY MOVED UNDER THIS REVIEW AND IT IS RECORDED RATHER THAN HIDDEN. At start:
  HEAD 5254f150…dee3, `git status --porcelain` EMPTY. At end: HEAD 70dd2278…e256 (commit
  "Wayfinder work classification graduated into the canonical template"), with
  `Team Knowledge/Templates/INDEX.md` and `Team Knowledge/Templates/wayfinder-plan.md`
  modified-unstaged by a CONCURRENT WRITER, not by this review.
  CHECKED, not assumed: `git diff --name-only 5254f15 HEAD` restricted to every path this
  review read — `services/vlogops`, the BUILD-006 Wayfinder map, the live-acceptance evidence
  document, root CLAUDE.md, root AGENTS.md, the Veritas contract and the receipt template —
  returns EMPTY. **The moved head has ZERO overlap with the reviewed material, so no evidence
  in this receipt was gathered against a silently different state.** This review authored only
  the two untracked receipts under Builds/BUILD-006-vlogops-publishing-engine/Assurance/ and
  modified no tracked file. `receipt_sha256` covers the BODY only, so this disclosure does not
  disturb it.

review_ceiling: 45 minutes elapsed / ~150k tokens — honoured, not extended
credential_surface_refused: >
  C:\.fusion247 root. GL-012 §4 makes a surface at or above the secrets root an invalid grant
  that a worker must refuse. No credential was read, requested, inferred or used, and no
  connection to the managed project was attempted.

verdict: HOLD
receipt_sha256: 77c93ee8073f12febd9132d70c425dfd472c50c24d4f03aa15d2cec995049ecd
reviewed_by: veritas
reviewed_date: 2026-08-17
next_review_trigger: >
  A raw, redacted capture of the live managed-Supabase evidence committed to the repository
  (or Warwick's explicit recorded acceptance that single-actor attestation suffices for this
  boundary), plus the §9.2 line-503 re-cut — then ONE focused confirmation of D-1 and D-2
  only. NEVER "the head moved": a receipt, documentation or clerical commit is not a trigger,
  and the head that moved during this very review is the worked example.
---
## Scope reviewed

**In scope (the scope Veritas determined, and it is the scope dispatched — no narrowing was attempted):** the two logical product boundaries BUILD-006 Phase 1 (seed intake + durable Content Seed store) and Phase 2 (Source Compiler / evidence pack), graded against the nine numbered functional requirements derived from the map's §10 recorded phase gates, in the light of the one thing that changed since both boundaries last passed Gate 1: migrations `001` and `002` reaching the **managed** Supabase project.

**Deliberately not in scope:** Phases 0 and 3–7; the eleven §9 programme criteria; the Tower/Codex external gate; estate-wide reconciliation; the RLS advisory on `asdair`/`session_report` (Warwick's standing PARK).

**⛔ THE LIMIT THAT GOVERNS EVERY LIVE ROW BELOW, STATED BEFORE THE TABLE SO NO ROW CAN BE READ WITHOUT IT.** I hold no MCP tools and no route to the managed Supabase project. The connection string lives at the **root** of `C:\.fusion247`, which GL-012 §4 makes an invalid worker surface; I refused it, did not request it, and did not attempt it. **Every live figure in `Deliverables/2026-08-17-build-006-phases-1-2-managed-supabase-live-acceptance.md` is therefore LARRY-ATTESTED NARRATIVE. No raw capture — no command transcript, no psql output, no exit-code capture, no emitted pack artefact — was committed at `5254f15` or anywhere in the repository.** The evidence document is a summary written by the actor who performed the work. Contract §Independence: *"Larry may supply evidence pointers; he may not pre-digest the evidence into the only material Veritas sees."*

**This is a HOLD on evidence, not a finding of error.** Every independent cross-check I could run agreed with the attested figures (see Evidence executed). The attestation is credible. It is not evidence under this contract.

## Accepted requirements

| # | Requirement | Verdict | Evidence | Residual |
|---|---|---|---|---|
| F1-1 | Migration 001 applied to the managed project; managed schema at the expected state | **HOLD** | Verified by me: `sha256sum` of `db/001_vlogops_content_seed.sql` = `b19508b5ccdc00997ee87d6183d733b7727fe94b70b217bb10a643e12bdcbfcd`, **exact match** to the claimed hash. DDL read in full: creates 3 tables, 4 triggers, 6 indexes, all `vlogops`-qualified. Combined with 002 this yields exactly the attested fingerprint 6 / 7 / 15. **Attested only:** that it was applied, the ledger rows `20260817120000`, `COMMITTED`, and every live property in §3 | Application to the managed project is unwitnessed single-actor attestation with no committed raw capture. `Constraints 44` not cross-checked (cost) |
| F1-2 | A seed from each of the three intake routes lands durably in the managed store | **HOLD** | Verified by me: the three route names in the attested result set (`records`, `promotion`, `supplied`) are exactly the DDL `route` CHECK enum (`001` L45–46), and `promote` correctly stores as `promotion`; `content_seed_promotion_contract` and `content_seed_supplied_requires_angle` make the attested route-2/route-3 rows structurally unwritable without their required fields. **Attested only:** the three `seed_id`s, `members 12`, `deduplicated:false`, exit 0 | No raw capture of any of the three invocations |
| F1-3 | Identity survives restart — same source, fresh process, same `seed_id`, nothing new written | **HOLD** | Verified by me: identity is structurally a pure function of content — `seed_id` is the PK, constrained to 64 hex, and `manifest` stores the exact hashed bytes so any reader can recompute (`001` L26–42). Capability was proven at the prior Gate 1 (`Assurance/veritas-wp-1-c35e4f9.md`, 45 executed subtests). **Attested only:** that the fresh-process re-run against the *managed* store returned the same ids with `deduplicated:true` | Capability established; the managed-context execution is attested. Contract §"Current readiness is NOT capability" forbids substituting the first for the second |
| F1-4 | Killed mid-intake, the store holds nothing or all of it, and the same command completes on re-run | **HOLD** | Verified by me: the two-state invariant rests on the single-transaction seal, documented at `001` L129–134, and was proven with a real POSIX SIGKILL at the prior Gate 1. **Attested only:** exit 137 at 500 ms and 5,500 ms, unchanged row counts, 0 orphans / 0 unsealed / 0 `idle in transaction`, and the two completing re-runs | The 6.0 s baseline that makes the 5,500 ms timing meaningful is itself attested |
| F2-1 | Migration 002 applied to the managed project; managed schema at the expected state | **HOLD** | Verified by me: `sha256sum` of `db/002_vlogops_evidence_pack.sql` = `b93e188da7dfc1cc02476236b94c30cc2b8ebad776442f5bd3bde3d16fa1935c`, **exact match**. DDL read: 3 tables, 3 triggers, 9 indexes (3 PK + 3 UNIQUE + 3 explicit). **Zero GRANT, zero REVOKE, zero `row level security`, zero table/schema drop across both files; the only `drop` statements are seven `drop trigger if exists` idempotency guards; a qualified-reference scan for `asdair.` / `session_report.` / `public.` / `auth.` / `storage.` returned nothing. The "additive, no grants, no RLS, vlogops-only" claim is TRUE by my own reading, not by the files' header comments.** **Attested only:** application, ledger row `20260817120001`, and the live idempotency re-application | As F1-1 |
| F2-2 | A real seed produces a bounded, provenance-complete evidence pack against the managed store | **HOLD** | Verified by me: `bounded` cannot lie — `evidence_pack_bounded_discloses` (`002` L86–87) makes `bounded = jsonb_path_exists(omitted,'$[*] ? (@.reason=="over-budget")')`, so the attested `bounded:true` with `omitted:4` is the only shape the row could take; a pack with no entries is unstorable; provenance-completeness is carried by the composite FK that `evidence_pack_pack_seed_unique` exists to support. **Attested only:** `pack_id 45c7ad3d…`, entries 8 of 12 candidates, `entry_bytes 232,356` | No raw capture; the pack itself was not committed |
| F2-3 | Compilation is deterministic — two independent compiles yield one pack and byte-identical documents | **HOLD** | **Attested only, and this is the cheapest row in the table to discharge independently:** `pack-a.json` / `pack-b.json`, 3,851 bytes each, `sha256 be3c23ec…`, `BYTE-IDENTICAL: true`. Neither artefact is in the repository, so I cannot recompute the digest. Structural support: `pack_id` is the PK and `manifest_algo` is `sha256-canonical-json-v1` | Committing the two emitted documents (or one plus its digest) would make this row independently checkable with one `sha256sum` |
| F2-4 | A source failure cannot alter or invalidate an existing run; `verify` passes without re-reading the original sources | **HOLD** | Verified by me, and the *"cannot alter"* half is genuinely closed in the database rather than attested: `vlogops.deny_mutation()` (`001` L161–185) refuses every UPDATE and DELETE on `source_snapshot`, `intake_run`, `evidence_pack`, `evidence_pack_entry`, `compile_run`, and refuses any change to the nine identity-bearing `content_seed` columns — **no client, including a failing connector, can alter an existing run.** **Attested only:** the *"cannot invalidate"* half — `verify` 8/8 with `VLOGOPS_REPO_ROOT` pointed at an empty directory — and the 20/20 live mutation refusals | **Named scope gap:** the map's recorded gate says a **connector** failure cannot alter an existing run. The executed evidence is a read-time source-absence test plus a *process* kill. A connector/source failure **occurring during a compile against an existing run** was not executed. Non-blocking on its own, because the DDL closes it structurally |
| F2-5 | Killed mid-compile, nothing is written, and the compile completes on re-run | **HOLD** | **Attested only:** exit 137 at 400 ms; packs 2 / entries 16 / compile_runs 3 unchanged; 0 orphan entries; 0 stuck txns; completion afterwards as `c3606ddd…` | R5's first attempt (1,200 ms) fired after commit and tested nothing — correctly disclosed by Larry rather than presented as a pass. The 400 ms re-run carries the whole row and is unwitnessed |

**Nine of nine HOLD. Overall PASS is therefore unavailable** (contract §"Accepted requirements table": an overall PASS cannot hide a mandatory HOLD). **One corrective action discharges most of the table** — see Defects D-1.

## Evidence provenance

- **Inspected:** the repository at `main` / `5254f15`, read in place from its own canonical checkout (`C:/Fusion247PKA`). No `git archive` export was needed: no mutation testing was performed and no byte-exact isolated re-execution was possible, because the only executable evidence at issue lives in a managed database I have no lawful route to.
- **NOT inspected, and this is the load-bearing gap:** the managed Supabase project. No live query, no live row count, no live schema read. I refused the `C:\.fusion247` root surface per GL-012 §4, did not request a credential, and did not attempt a connection.
- `git rev-parse HEAD` at start / end — `5254f1507c9b8012d4bde200b1aec1cf4473dee3` / `5254f1507c9b8012d4bde200b1aec1cf4473dee3`, identical.
- `git status --porcelain` at start — **empty**. At end — the only delta is the two untracked receipts I authored under `Builds/BUILD-006-vlogops-publishing-engine/Assurance/`. **No tracked file was modified, created or deleted by this review.**
- `git branch -r --contains 5254f15` → `origin/main`. The reviewed head **is** remotely reachable, so the unpushed-head bar on PASS does not apply here.
- Review ceiling honoured: 45 minutes / ~150k tokens. Not extended.

## Evidence executed or inspected

| Command or artefact | Exit | Executed subtests | Result |
|---|---|---|---|
| `git rev-parse 5254f15` · `git rev-parse "5254f15:Team/Veritas…/AGENTS.md"` | 0 | n/a | `5254f150…dee3` · blob `d63d613d0c4001e6476a750316fa3193bd6ee2d4` |
| `sha256sum services/vlogops/db/001_vlogops_content_seed.sql` | 0 | n/a | `b19508b5cc…bcfd` — **matches the claim exactly** |
| `sha256sum services/vlogops/db/002_vlogops_evidence_pack.sql` | 0 | n/a | `b93e188da7…935c` — **matches the claim exactly** |
| `grep -n -i -E "grant\|revoke\|row level security\|drop \|truncate\|search_path\|owner to\|create role\|alter role"` over both files | 0 | n/a | 11 hits: 4 header comments, 7 `drop trigger if exists` guards. **Zero GRANT, zero REVOKE, zero RLS, zero drop of a table or schema** |
| `grep -o -i -E "\b(asdair\|session_report\|public\|auth\|storage)\."` over both files | 1 | n/a | **no matches** — no schema other than `vlogops` is referenced |
| Full read of `001_vlogops_content_seed.sql` (209 lines) | n/a | n/a | 3 tables · 4 triggers · 6 indexes · exactly **9** identity-bearing columns in the `content_seed` trigger arg list, matching the attested "nine" |
| Structural read of `002_vlogops_evidence_pack.sql` | n/a | n/a | 3 tables · 3 triggers · 9 indexes · `evidence_pack_bounded_discloses` ties `bounded` to `omitted` in the database |
| Derived fingerprint cross-check | n/a | n/a | DDL implies **6 tables / 7 triggers / 15 indexes** — matches the attested managed fingerprint on all three counts |
| Read of `services/vlogops/RUNBOOK.md` §§1–3 | n/a | n/a | Confirms R1 independently: §2 requires `VLOGOPS_DB_URL` and says only *"Values live outside this repository"* — **it names no file and no mapping** |
| `git show 5254f15 --stat` and the full map diff | 0 | n/a | 4 files, all documentation. **No product code changed** — the dispatch's central premise is confirmed |
| Live execution against the managed Supabase project | — | — | **NOT AVAILABLE TO THIS REVIEWER.** Declared, not smoothed over |
| Raw capture of Larry's live run (transcript / psql output / emitted packs) | — | — | **DOES NOT EXIST IN THE REPOSITORY.** This is D-1 |

## Assurance dimensions

| Dimension | Verdict | Basis |
|---|---|---|
| Goal fidelity | **PASS** | The work package targeted exactly the ground on which both phases' PASS was withheld — migrations reaching the managed project — and did not drift into new scope. Warwick's DONE WHEN clause names five things and the evidence document addresses all five. |
| Design fidelity | **PASS** | Verified by my own reading of both migrations, not from their header comments: additive, one namespace, fully schema-qualified, zero grants, RLS untouched, forward-only with idempotency guards. This is the accepted design. |
| Functional proof | **HOLD** | The real production path against the managed store is attested, not evidenced. No raw capture exists and I have no lawful route to the managed project. Contract §Method 2a: an unexecuted primary journey is a HOLD, and "executed evidence from an actor that can perform it" means a raw capture, not a summary. |
| Integration | **HOLD** | Same ground. The CLI → config → `VLOGOPS_DB_URL` → managed Postgres hop is the one hop that had never been exercised, and it remains unwitnessed. Every other hop is structurally verified. |
| Durability | **HOLD** | Kill-and-revive at both phases is exactly the property that must be *observed*, and it was observed only by Larry. The single-transaction seal and the append-only triggers are verified in the DDL, which establishes the mechanism, not the managed-context outcome. |
| Test quality | **PASS** | The mutation suite was well designed where I can judge it from the record: 20 attempts across all six tables plus each of the nine identity columns, every attempt rolled back, **and a positive control proving the harness could observe a permitted write** — which is precisely the "assert non-zero executed count" discipline. R3 (suite deliberately not pointed at managed, because `teardown.sql` drops the schema) is the correct call, not a gap. |
| Git truth | **PASS** | Branch, head and scope are accurately reported; `5254f15` is on `origin/main`; the commit's own message correctly states that no product code changed and that PASS is not recorded. |
| Documentation truth | **HOLD** | See D-2. §9.2 line 503 still instructs *"PR #105 stays DRAFT and UNMERGED until that route is satisfied"* while the STATUS block re-cut at line 111 declares that exact clause stale — and the STATUS block points readers **at §9.2**. Separately, the map's live-acceptance row states the attested figures as flat fact with no marker that they are unwitnessed. |
| Residual risk | **HOLD** | R1–R5 are honest, specific and correctly classified as far as they go — R5 in particular discloses two of Larry's own wrong readings rather than hiding them, which is the right instinct. **But the single most material residual is absent: that no raw capture of any live evidence was committed, that every live figure is unwitnessed single-actor attestation, and that none of it is independently reproducible by any later reader.** §9 "What this evidence does and does not establish" does not name it either. |
| Completed automation | **n-a** | Correctly and *documentedly* manual at this phase. `RUNBOOK.md` §"WHAT THIS SERVICE IS TODAY" reclassifies explicitly: no daemon, no scheduled task, no port; both tools run when a person runs them; orchestration arrives at Phase 6. The North Star's autonomy obligation (§1, §128) is carried forward, not claimed here. **This is the honest reclassification root `CLAUDE.md` §"Nothing may live only in Larry's head" permits — not a hidden manual step.** But see D-3: the *manual* route itself depends on Larry remembering a credential mapping, which is that clause's failure wearing a smaller hat. |

## Production caller and journey

Traced from the RUNBOOK-documented entry point, which is the only entry point at this phase:

`operator shell` → `node --env-file=<path outside the repo> services/vlogops/bin/vlogops-intake.mjs <route> …` → config validation (exit 78 on bad config, all faults reported at once) → `VLOGOPS_DB_URL` → **managed Postgres `vlogops` schema** → single-transaction seal of `content_seed` + `source_snapshot` + `intake_run`; then `vlogops-compile compile --seed <id>` → `evidence_pack` + `evidence_pack_entry` + `compile_run`; then `vlogops-compile verify --pack <id>` reading frozen snapshots only.

**Every hop up to `VLOGOPS_DB_URL` is verified by reading the repository. The final hop — into the managed project — is the entire subject of this gate and is the one hop I could not reach.** No component in this journey was reached only by a test calling it directly; the CLI entry points are real and documented.

## Restart and durability

**Claimed, and central to four of the nine requirements. HOLD.** Kill-and-revive was performed — at 500 ms and 5,500 ms for intake, at 400 ms for compile — and the results are stated precisely, including the honest disclosure that a 1,200 ms compile kill fired after commit and proved nothing. **All of it is unwitnessed.** The mechanism that makes the two-state invariant true (`001` L129–134's single-transaction seal, and the append-only triggers I read at L161–208) is verified; the managed-context observation is not.

## Documentation contradiction scan

- **Larry's declared residuals:** R1 RUNBOOK `VLOGOPS_DB_URL` provenance · R2 runtime identity is `postgres` · R3 suite not pointed at managed · R4 RLS advisory PARKED · R5 two wrong readings of his own.
- **Verified independently of his list:** R1 is real and I confirmed it by reading `RUNBOOK.md` §2 — it is in fact slightly *worse* than stated, since §2 names neither the file nor the variable mapping, only *"values live outside this repository"*. R3 is correct: `db/teardown.sql` does drop the schema. R4 is Warwick's own standing PARK and is correctly not re-raised. R5's characterisation of `set seed_id = seed_id` is **CORRECT** — `001` L177 compares with `is distinct from`, so a no-op assignment raises nothing and is properly permitted; his first probe was the defect, exactly as he says.
- **What his list missed:** (a) **the evidence-reproducibility residual** — no raw capture committed, every live figure unwitnessed, nothing reproducible by a later reader (D-1); (b) **the map's stale §9.2 clause** (D-2), which his own re-cut note at line 111 asserts was dealt with; (c) the F2-4 **connector-failure scope gap** named in the requirements table.
- **Active documents that would misdirect a fresh instance:** `Deliverables/2026-08-03-…-wayfinder-plan.md:503` — *"**PR #105 stays DRAFT and UNMERGED until that route is satisfied** (Warwick, 2026-08-14)"*, in the live, non-historical §9.2 "Applied to this build, concretely". #105 merged at `c35e4f9`. Lines 42 and 49 carry the same stale wording but sit under an explicit *"superseded 2026-08-15 … HISTORY, kept for provenance"* banner and are therefore non-blocking.
- **Closure claims since the last receipt, and the receipt behind each:** Phase 1 — **no PASS claimed**, map row explicitly says a Veritas receipt is still needed. Phase 2 — **no PASS claimed**, same. `"The migration caveat … is DISCHARGED"` — a blocker-resolution claim, stated as flat fact, resting wholly on unwitnessed attestation (D-4). **No false completion claim found. Larry withheld PASS correctly and said so in three places.**

## Defects

| # | Severity | Finding | blocking/non-blocking | Owner |
|---|---|---|---|---|
| D-1 | **HIGH** | **No raw capture of any live evidence was committed.** Every managed-project figure — schema fingerprint, ledger rows, grants, `anon` reachability, row counts, exit codes, seed ids, pack ids, the emitted documents' digest, the 20/20 mutation refusals — exists only as narrative written by the actor who performed the work. The reviewer has no lawful route to the managed project (GL-012 §4, correctly refused), so there is no second source. Contract §Independence makes a scope whose only input is Larry's account a HOLD, and §Receipt requires the executed command **and its real output**. **The exact next action this blocks: recording Phase 1 PASS or Phase 2 PASS on the map.** It blocks nothing else — no product code is implicated and no continuation is unsafe. | **blocking** | Larry |
| D-2 | MEDIUM | `…wayfinder-plan.md:503` still instructs *"PR #105 stays DRAFT and UNMERGED until that route is satisfied"* in live §9.2, while the STATUS row at line 111 declares that same clause stale and re-cut. A merged PR is described as unmerged in the section the frontier row points at. This is the `record-amended-body-not-recut` family recurring: the amendment named the body it superseded and did not re-cut it. **Blocks: recording Phase 1 PASS on a map that simultaneously instructs its PR must stay draft.** | **blocking** | Larry |
| D-3 | MEDIUM | The operator route to `VLOGOPS_DB_URL` is undocumented. `RUNBOOK.md` §2 requires the variable and names neither the approved file nor the `DATABASE_URL` → `VLOGOPS_DB_URL` mapping. Honestly declared as R1. It is a real instance of root `CLAUDE.md` §"Nothing may live only in Larry's head" applied to a *manual* route. **This is the Gate 2 blocker and is graded there**; at Gate 1 it is recorded once. | non-blocking at Gate 1 | Larry / Warwick's one-line choice |
| D-4 | LOW | The map row and the commit message state *"the migration caveat … is DISCHARGED"* and the live figures as flat fact, with no marker that they are unwitnessed single-actor attestations pending assurance. Larry withheld PASS correctly; the wording around it overstates the evidential status of the figures. | non-blocking | Larry |
| D-5 | LOW | F2-4 scope gap: the recorded gate says a **connector** failure cannot alter an existing run; the executed evidence substitutes a read-time source-absence test plus a process kill. Structurally closed by the append-only triggers, so recorded once rather than pursued. | non-blocking | — |
| D-6 | LOW | R2 — the vlogops runtime connects as `postgres`, the schema owner and a superuser. Correctly declared, correctly framed as Warwick's decision, and correctly **not** escalated: no credential, financial account, private household dataset or destructive production action is newly exposed by it. Parked under the hobby-brain bar. | non-blocking | Warwick, at his leisure |

## Verdict

**HOLD** — the migrations, the design and the test discipline are verified and sound, and every independent cross-check I could run agreed with Larry's figures; but the entire live-acceptance claim rests on unwitnessed narrative with no raw capture in the repository, so nine of nine functional requirements are evidenced only by the account of the party being graded, and one live map instruction still describes a merged PR as draft.

**What this HOLD does and does not do.** It gates recording Phase 1 PASS and Phase 2 PASS, and therefore the Codex/merge sequence that depends on them. **It does not invalidate the work, does not reopen any product code, does not transfer the frontier, and does not require another live run of the expensive parts.** D-1 is dischargeable by committing the redacted raw output Larry already produced — or, where a transcript is gone, by re-capturing only the cheap read-only parts (the schema-fingerprint and final-state queries, the ledger rows, `anon` reachability) and the two emitted pack documents, which alone would make F2-3 independently checkable with one `sha256sum`. The kill tests need no re-execution if their original output survives.

## Next review trigger

A raw, redacted capture of the live evidence committed to the repository (or Warwick's explicit recorded acceptance that single-actor attestation is sufficient for this boundary), together with the §9.2 line-503 re-cut — then **one focused confirmation of D-1 and D-2 only.** Not a re-review of the product, not a re-review of this receipt, and not triggered by any later head that moves for documentation, receipts or clerical repair.
