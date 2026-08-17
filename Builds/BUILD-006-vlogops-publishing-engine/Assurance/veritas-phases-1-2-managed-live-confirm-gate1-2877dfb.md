---
build: BUILD-006-vlogops-publishing-engine
scope: phases-1-and-2-managed-supabase-live-acceptance — FOCUSED CONFIRMATION of D-1 and D-2
gate: 1

boundary: >
  BUILD-006 Phase 1 (seed intake + durable Content Seed store) and Phase 2 (Source Compiler /
  evidence pack), at the managed-Supabase live-acceptance boundary — the same logical boundary
  graded at 5254f15. This is the ONE focused confirmation of the blocking findings D-1 and D-2
  that the prior receipt named as its own next trigger. It is not a re-review: no product code
  changed between 5254f15 and 2877dfb (verified below), and no requirement was re-derived.
  THE SHAs BELOW ARE PROVENANCE, NOT THE IDENTITY OF THIS GATE.

predecessor_receipt: veritas-phases-1-2-managed-live-gate1-5254f15.md   # HOLD, nine of nine rows HOLD
predecessor_receipt_sha256: 77c93ee8073f12febd9132d70c425dfd472c50c24d4f03aa15d2cec995049ecd

reviewed_sha: 2877dfbf57c020ed71411f003501ca8caaed8d7e
governance_sha: 2877dfbf57c020ed71411f003501ca8caaed8d7e
branch: main
remote_reachable: true

evidence_method: >
  mixed — (a) committed RAW CAPTURE from the managed project, read in place and independently
  recomputed where recomputable; (b) target checkout at 2877dfb for the repository and DDL
  cross-checks; (c) LIVE EXECUTION by this reviewer of the newly documented configuration
  route, against a dummy env file in its own workspace, with NO credential and NO connection
  to the managed project.
evidence_workspace: >
  C:/Fusion247PKA (repository, read in place) and
  C:/Users/Buggly/AppData/Local/Temp/claude/C--Fusion247PKA/058cb015-e803-4b49-9e9b-0819935f9eca/scratchpad/veritas-g21
  (ephemeral, outside the repository, one dummy env file holding a deliberately unreachable
  127.0.0.1:1 URL and no real secret; never committed)
worktree_head_at_start: 2877dfbf57c020ed71411f003501ca8caaed8d7e
worktree_head_at_end: 2877dfbf57c020ed71411f003501ca8caaed8d7e
worktree_status_clean: true
worktree_state_disclosure: >
  `git status --porcelain` EMPTY at start and EMPTY at end. HEAD identical at start and end.
  This review modified no tracked file and created nothing inside the repository except the two
  untracked receipts it authored under Builds/BUILD-006-vlogops-publishing-engine/Assurance/.
  Unlike the predecessor review, the repository did NOT move under this one.

review_ceiling: 25 minutes elapsed / ~80k tokens — honoured, not extended
credential_surface_refused: >
  C:\.fusion247 root, refused again and for the same reason (GL-012 §4). No credential was
  read, requested, inferred or used; no connection to the managed project was attempted. The
  dummy env file this review created contains no secret. Larry was not asked for a credential.

verdict: HOLD
receipt_sha256: ac7198b4ee551ae26ba9622e8b107eb4a031ed92e7775c0428b34a72ac604b48
reviewed_by: veritas
reviewed_date: 2026-08-17
next_review_trigger: >
  A raw capture of the F2-5 mid-compile SIGKILL against the managed store — the exit/signal,
  the pack/entry/compile_run counts either side, and the completing re-run — committed
  alongside the others. Then ONE focused confirmation of F2-5 alone. NOTHING ELSE reopens this
  gate: not a moved head, not a receipt, not the map re-cut, not a clerical repair, and not the
  eight requirements this receipt PASSES.
---
## Scope reviewed

**The ONE focused confirmation the predecessor receipt specified**, on the same logical boundary: whether **D-1** (no raw capture of any live evidence committed) and **D-2** (the map's stale §9.2 clause) are discharged, and what the discharge does to the nine numbered functional requirements F1-1…F1-4 and F2-1…F2-5.

**The commissioning question is satisfied, and I record why.** *«What changed that could plausibly change Veritas's answer?»* — the evidence base itself changed: a new `Assurance/evidence/` directory containing the managed store's own output. That is a material change to the evidence for the promised outcome, not a receipt or a wording repair, so this confirmation is properly opened.

**No product code changed.** `git diff --stat 5254f15 2877dfb` returns 16 files: the seven new evidence artefacts, the two predecessor receipts, `CLAUDE.md` (3 lines), the map, the RUNBOOK, and four Team Knowledge / template files. **Under `services/vlogops/` the only change is `RUNBOOK.md`.** No `.mjs`, no `.sql`, no migration. **Nothing in the eight requirements below is re-graded because code moved; they are re-graded because evidence arrived.**

**Deliberately not in scope:** Phases 0 and 3–7; the eleven §9 programme criteria; the Tower/Codex external gate; estate-wide reconciliation; the RLS park. The Gate 2 journey is a separate receipt.

**The limit that still governs, stated before the table.** I hold no route to the managed project and refused the `C:\.fusion247` root again. **The capture is single-actor: Larry produced it.** What changed is decisive but bounded — the store's own output is now committed and re-checkable, so my contract's permitted discharge route applies: *"raw unfiltered captures … supplied by an actor who can produce them"* (§Gate 2 discharge, and §Method 2a *"executed evidence from an actor that can perform it"*). **Single-actor capture is therefore not by itself a bar to PASS under this contract — but only where the capture actually covers the requirement, and only because it survived the independent checks below.**

**The three checks that made the capture trustworthy rather than merely present**, all run by me:

1. **Cross-file seam agreement.** `managed-state-capture.txt` (11:12:56) ends the store at seeds 5 · snapshots 38 · intake_runs 8 · packs 3 · entries 24 · compile_runs 4. `live-proofs-raw.txt` (11:13:49) opens `[state before kill]` at **exactly those six figures**. Two files generated by different scripts at different times agree precisely at their seam.
2. **Arithmetic closure.** The per-seed snapshot counts (12 + 1 + 1 + 12 + 12) sum to **38**, the independently reported total. The 5,000 ms kill moved snapshots 38 → 50, **exactly +12 for its reported 12 members**.
3. **Recomputation.** I recomputed every digest in `SHA256SUMS.txt` (5/5 OK) and the three pack digests directly.

A fabricated summary would have had to survive all three. **This is sufficient evidence, not maximum confidence** — which is the standard this gate is held to.

## Accepted requirements

| # | Requirement | Verdict | Evidence | Residual |
|---|---|---|---|---|
| F1-1 | Migration 001 applied to the managed project; managed schema at the expected state | **PASS** | Live catalogue: `tables 6 · triggers 7 · indexes 15`, and I re-derived all three from the DDL at this head — `grep -c "^create trigger"` gives **4** in `001` + **3** in `002` = **7**; tables 3+3=6; indexes 6+9=15. Full table inventory returned exactly the six DDL tables by name. Migration ledger row `20260817120000` / `vlogops_001_content_seed` present. `sha256sum` of `001` = `b19508b5cc…bcfd`, matching | `constraints 44` still not independently derived (counting CHECK/PK/UNIQUE by hand is error-prone and was not worth the cost). The fingerprint proves the schema matches the files; the ledger names the migration. Non-blocking |
| F1-2 | A seed from each of the three intake routes lands durably in the managed store | **PASS** | The store's own read-back: `content_seed` grouped by route → `promotion 1` · `records 3` · `supplied 1`, each with a real `first_seen` (10:37:37 / 10:38:23 / 10:39:10). Every seed `status='sealed'` with its snapshot count (12/1/1/12/12). `seeds_without_snapshots 0` · `orphan_snapshots 0`. **Durability is exactly what a later read-back evidences, and this is a later read-back from the managed store** | The first landing *events* (`deduplicated:false` per route) remain transcript-only. The requirement's outcome is durable landing and that is read out of the store, so non-blocking |
| F1-3 | Identity survives restart — same source, fresh process, same `seed_id`, nothing new written | **PASS** | **Cross-file, and this is the strongest row in the table.** The three ids `0c19424e…` / `39c4428b…` / `3439b2cd…` are recorded in `managed-state-capture.txt` at **11:12:56**; three *fresh processes* in `live-proofs-raw.txt` at **11:13:49+** returned the **identical three ids** with `deduplicated:true`, exit 0. *"Nothing new written"* is bracketed by two independent state lines spanning all three restarts: **seeds 5 → 5, snapshots 38 → 38**; `intake_runs 9 → 12` is exactly +3 attempt-ledger rows, the designed append-only record | none material |
| F1-4 | Killed mid-intake, the store holds nothing or all of it, and the same command completes on re-run | **PASS** | **The 1,500 ms capture carries the row and it is clean:** the harness **detects** the branch rather than assuming it, records `PRE-commit`, shows the store completely unchanged including the attempt ledger (6 / 50 / 14 → 6 / 50 / 14), zero on all four partial-state invariants, and the re-run reports **`deduplicated:false`** — which is the only assertion that discriminates *nothing* from *half*. **The 5,000 ms capture is a valid POST-commit outcome, and I verified that reading from its own raw numbers, not from the README's claim:** the result line printed, seeds 5 → 6 and snapshots 38 → 50 (+12 = its 12 members), zero orphans / unsealed / stuck, re-run returns the same id `deduplicated:true`. **All of it, not part of it.** Both sides of the commit are therefore evidenced | The two earliest kills (500 ms / 5,500 ms) stay transcript-only and are correctly declared superseded. Non-blocking — they are not needed |
| F2-1 | Migration 002 applied to the managed project; managed schema at the expected state | **PASS** | As F1-1, plus ledger row `20260817120001` / `vlogops_002_evidence_pack`, `sha256sum` of `002` = `b93e188da7…935c` matching, and the **live** design-property query confirming what I had only read in the DDL: `api_role_grants 0` · `vlogops_grantees` = `postgres` alone · `anon_can_select_any false` · `vlogops_rls_enabled 0` · `other_schema_rls_enabled 0` | none material |
| F2-2 | A real seed produces a bounded, provenance-complete evidence pack against the managed store | **PASS** | Three packs, each `entry_count 8` **=** `entries_stored 8` (no phantom count), `bounded true`, `omitted 4`, **and the omission reasons actually recorded as `over-budget` ×4 per pack** — which matters because `evidence_pack_bounded_discloses` ties `bounded` to the presence of that reason, so the constraint's own semantics are satisfied in live data. **Provenance-completeness tested directly, not inferred:** `entries_without_snapshot = 0` against `source_snapshot(seed_id, source_ref)` | none material |
| F2-3 | Compilation is deterministic — two independent compiles yield one pack and byte-identical documents | **PASS** | **Fully discharged and recomputed by me.** `sha256sum pack-45c7ad3d-{a,b,c}.json` → all three `be3c23eca59662bb01010cf0291b3d764d2ff3ac879a2f5d97c981825ffc7cb3`, **3,851 bytes each**; `cmp` a==b and a==c byte-identical; `sha256sum -c SHA256SUMS.txt` 5/5 OK. **Plus store-level determinism:** across the third compile `compile_runs 4 → 5` while `packs 3 → 3` **and** `entries 24 → 24` — a third attempt wrote a ledger row and no new pack. The `-c` emission was a fresh third compile after the HOLD | none. This row went from the cheapest to discharge to independently checkable by anyone in one command, which is what was asked |
| F2-4 | A source failure cannot alter or invalidate an existing run; `verify` passes without re-reading the original sources | **PASS** | *"Cannot alter"* — **20 of 20 live mutation attempts refused**, named per table and per identity column, **with a positive control** (a non-identity update permitted on 7 rows) proving the harness could observe a success, and `rollbacks left NO trace: tamper_traces 0 · md5_traces 0`. That is a mutation-tested control, which is the standard this contract demands. *"Cannot invalidate"* — `verify` → `ok:true, entries_verified 8/8, problems []` **both** normally **and** with `VLOGOPS_REPO_ROOT` pointed at an empty directory (0 children), exit 0 both times | **Prior D-5 is now materially closed rather than parked:** a failing connector is a client, and the 20/20 live refusals prove no client can mutate an existing run |
| F2-5 | Killed mid-compile, nothing is written, and the compile completes on re-run | **HOLD** | **NO RAW CAPTURE EXISTS FOR THIS REQUIREMENT.** `live-proofs-raw.txt`'s section headers are, in full: `F1-4` · `F1-3` · `F2-3` · `F2-4` · `F1-4 (STRONGER)` · `F1-4 (CORRECTED ASSERTIONS)` · `APPEND-ONLY CONTROLS`. **There is no mid-compile kill.** The only `F2-5` string in the whole evidence directory is a comment on the post-hoc integrity-invariants query — which evidences that no partial pack state exists **now**, not that killing a compile mid-flight produces that outcome. The completion half has state evidence (pack `c3606ddd…`, seed `70a43961…`, 8 entries, present in the store); **the kill half has none.** The predecessor's evidence was *"attested only: exit 137 at 400 ms"* and that attestation is unchanged and un-captured | **blocking, and narrowly. See D-7 and D-8.** Dischargeable by one short re-capture; no re-implementation and no re-run of anything else |

**Eight PASS, one HOLD. Overall PASS is therefore unavailable** (contract §"Accepted requirements table": an overall PASS cannot conceal a mandatory HOLD). **The character of this HOLD is nothing like its predecessor's:** eight of nine requirements are discharged on the store's own output, and the ninth is one absent capture.

## The mechanism-versus-outcome test, applied per row because that is where it recurs

Larry named `acceptance-proves-mechanism-not-outcome` as the family most likely to recur here. **He was right, and it recurs on exactly one row.**

| Row | Does the capture evidence the OUTCOME, or only the mechanism? |
|---|---|
| F1-1 / F2-1 | **Outcome.** The requirement is *"schema at the expected state"* and a catalogue fingerprint is that state. |
| F1-2 | **Outcome.** *"Lands durably"* is evidenced by reading the sealed rows back out of the store afterwards. |
| F1-3 | **Outcome.** Identical ids from fresh processes **plus** unchanged seed/snapshot totals. Exit codes alone would have been mechanism. |
| F1-4 | **Outcome, and only just.** *"Exit 137, counts unchanged"* on its own is mechanism. The `deduplicated:false` re-run in the 1,500 ms capture is what makes it outcome evidence — it proves the killed work was **absent**, not half-present. That single assertion is load-bearing for the whole row. |
| F2-2 | **Outcome.** `entries_without_snapshot = 0` and the recorded omission reasons test the promised properties directly. |
| F2-3 | **Outcome.** Byte-identical emitted documents, recomputed. |
| F2-4 | **Outcome.** Refusals observed live, with a positive control. |
| **F2-5** | **NEITHER — and this is the recurrence.** A clean store *now* is the outcome of *no kill having damaged it*; it is not the outcome of a kill being survived. The post-hoc invariant query is being asked to stand in for an experiment that was not captured. **This is the family Larry named, landing precisely where he predicted it would.** |

## Evidence provenance

- **Inspected:** the committed raw capture under `Builds/BUILD-006-vlogops-publishing-engine/Assurance/evidence/` (all 7 files, read in full); the repository at `main` / `2877dfb`, read in place; the DDL at this head for the re-derivation.
- **Executed by me against the product:** the newly documented configuration route, three ways, using a dummy env file in my own ephemeral workspace outside the repository. **No credential, no connection to the managed project, no live state touched.** The dummy URL points at `127.0.0.1:1`, which is deliberately unreachable.
- **NOT inspected:** the managed Supabase project. I refused the `C:\.fusion247` root again per GL-012 §4, did not request a credential, and attempted no connection. **This limit is structural and permanent for this reviewer.**
- `git rev-parse HEAD` start / end — `2877dfbf57c020ed71411f003501ca8caaed8d7e` / identical.
- `git status --porcelain` start / end — **empty / empty.** No tracked file touched; only the two untracked receipts authored.
- `git branch -r --contains 2877dfb` → `origin/main`. Remotely reachable, so the unpushed-head bar on PASS does not apply.
- Ceiling: 25 min / ~80k tokens. Honoured, not extended.

## Evidence executed or inspected

| Command or artefact | Exit | Executed subtests | Result |
|---|---|---|---|
| `git rev-parse 2877dfb:"Team/Veritas…/AGENTS.md"` | 0 | n/a | blob `d63d613d0c4001e6476a750316fa3193bd6ee2d4` |
| `sha256sum pack-45c7ad3d-{a,b,c}.json` | 0 | 3 | **all three** `be3c23eca59662bb01010cf0291b3d764d2ff3ac879a2f5d97c981825ffc7cb3` |
| `wc -c pack-45c7ad3d-*.json` | 0 | 3 | 3,851 · 3,851 · 3,851 — matches the claim exactly |
| `cmp` a↔b, a↔c | 0 | 2 | byte-identical, both pairs |
| `sha256sum -c SHA256SUMS.txt` | 0 | **5** | `5/5 OK` — every committed artefact matches its declared digest |
| `git diff --stat 5254f15 2877dfb` | 0 | n/a | 16 files; **under `services/vlogops/` only `RUNBOOK.md`** — no code, no SQL, no migration |
| `git show 2877dfb:…/001….sql \| grep -c "^create trigger"` | 0 | n/a | **4** |
| `git show 2877dfb:…/002….sql \| grep -c "^create trigger"` | 0 | n/a | **3** → 7 total, matching the live `triggers: 7` |
| `grep -n "^## " live-proofs-raw.txt` | 0 | 7 | seven sections, **none of them a mid-compile kill** — this is D-7 |
| **A.** `node --env-file=<dummy> bin/vlogops-intake.mjs records …` — the natural composition of new §2 (file named) + §3 (command shape) | **78** | n/a | `Error: vlogops: invalid configuration — VLOGOPS_DB_URL is required … unset or empty` |
| **B.** `node --env-file=<dummy> -e "process.env.VLOGOPS_DB_URL=process.env.DATABASE_URL"` — the literal second form printed in §2 | 0 | n/a | **exit 0 and NO intake ran.** It is not an invocation of anything |
| **C.** `VLOGOPS_DB_URL=<dummy> node bin/vlogops-intake.mjs records …` — the mapped form | 1 | n/a | `connect ECONNREFUSED 127.0.0.1:1` — **configuration PASSED**, only the deliberately dead host failed. The mapping is the correct fix |
| Live execution against the managed project by this reviewer | — | — | **NOT AVAILABLE. Declared, not smoothed over** |
| Raw capture of the F2-5 mid-compile kill | — | — | **DOES NOT EXIST.** This is the one surviving gap |

## Assurance dimensions

| Dimension | Verdict | Basis |
|---|---|---|
| Goal fidelity | **PASS** | Unchanged from the predecessor. The corrective work targeted exactly the two named blockers and did not drift into new scope. |
| Design fidelity | **PASS** | Verified from the migrations at the prior gate and now **confirmed in the live catalogue**: zero API-role grants, `postgres` the only grantee, `anon` cannot select, RLS untouched everywhere. |
| Functional proof | **PASS** | The real production path against the managed store is now evidenced by the store's own output for eight of nine requirements, cross-checked three independent ways. |
| Integration | **PASS** | The one hop that had never been exercised — CLI → config → `VLOGOPS_DB_URL` → managed Postgres — is now witnessed by committed raw output at both ends: the CLI's stdout and the catalogue's read-back agree. |
| Durability | **HOLD** | Intake kill-and-revive is now properly evidenced on **both** sides of the commit. **The mid-compile kill is not evidenced at all** (F2-5 / D-7), and durability is precisely the dimension that must be observed rather than reasoned about. |
| Test quality | **PASS** | Better than at the prior gate, and for a specific reason: the third kill harness **detects the branch** instead of asserting a fixed expectation, and the mutation harness carries a **positive control**. Both are the disciplines this estate learned the hard way, applied without being asked. |
| Git truth | **PASS** | `2877dfb` is on `origin/main`; the commit message states the work truthfully; the map records the HOLDs rather than the hoped-for PASS; no completion claim is made anywhere. |
| Documentation truth | **HOLD** | **D-2 is discharged** (§9.2 re-cut at source, struck through, dated, with the enduring principle preserved above it). But **D-8**: the README's *"What this evidence still does NOT establish"* section — whose entire job is naming absent proofs — does not name the absent F2-5 capture. |
| Residual risk | **PASS** | The predecessor's central complaint is answered head-on: the README opens by stating the finding was fair, and its closing section names the single-actor limit, the structural GL-012 constraint, the superseded early kills, and *"No Phase PASS. These are inputs to Veritas, not a verdict."* **The one omission is D-8, recorded there rather than here.** |
| Completed automation | **n-a** | Unchanged and still correctly reclassified as manual until Phase 6 by `RUNBOOK.md` §"WHAT THIS SERVICE IS TODAY". Not re-graded. |

## Production caller and journey

Unchanged from the predecessor and not re-traced. **What changed is that the final hop is no longer dark.** `operator shell` → `node bin/vlogops-intake.mjs <route> …` → config validation (**exit 78 observed by me**) → `VLOGOPS_DB_URL` → **managed Postgres `vlogops` schema** → single-transaction seal → `vlogops-compile compile` → `evidence_pack` (+ entries, + `compile_run`) → `vlogops-compile verify` reading frozen snapshots only (**observed returning 8/8 with sources unreachable**). No component in this journey was reached only by a test calling it directly.

## Restart and durability

- **Intake (F1-4) — evidenced, both branches.** Pre-commit: store completely unchanged, re-run `deduplicated:false`. Post-commit: complete row set, +12 snapshots for 12 members, re-run `deduplicated:true`. The invariant *"nothing at all, or all of it"* held in both, and no capture shows a partial row set.
- **On Larry's direct question — is the disclosure adequate, or is a weak proof being dressed up?** **On F1-4 the disclosure is adequate and better than adequate.** Keeping the capture whose asserts read `FALSE`, rather than deleting it, is the correct instinct; the invariant is stated correctly (*"nothing at all, or all of it"*, **not** *"the store is unchanged"*); the 400 ms capture is labelled *"weaker than it looks"* with the dedupe-path reason given; and the reader is told which capture to rely on. **I did not take that reading on trust — I re-derived the post-commit outcome from the raw numbers myself.** No, a weak proof is not being dressed up here.
- **Compile (F2-5) — NOT evidenced.** No capture. See D-7.

## Documentation contradiction scan

- **Larry's declared changes:** raw capture committed (D-1) · RUNBOOK §2 route documented (G2-1) · §9.2 re-cut (D-2) · §1 dedupe sentence (G2-3) · three superseded STATUS rows deleted and two compressed (Nolan's cut, declared as out of scope and flagged for me to check).
- **Verified independently:** **D-2 is genuinely discharged at source** — line 502 now strikes the clause through, marks it `SPENT, and re-cut here 2026-08-17`, names #105's merge at `c35e4f9`, **preserves the enduring principle above it unchanged**, and records that Veritas found it. It carries a dated note explaining *why*, so a later editor tidying the list cannot innocently restore it — which is this contract's own revert-proofing test, met. **G2-3 is discharged** — the §1 note tells the operator `deduplicated: true` is *"the system working"* and *"You have done nothing wrong and there is nothing to clean up."*
- **Nolan's cut, checked as asked: it damaged nothing I graded.** The three deleted rows were genuinely superseded (a duplicate next-action row, a struck-through zombie dispatch, a stale *"Model for Phase 1"*), and the two compressed rows kept every load-bearing figure. **One observation, non-blocking:** the map no longer carries a dedicated **"Exact next action"** row. The frontier is still unambiguous — the FRONTIER row and the *"Live acceptance — evidence complete, GATE HELD"* row between them state it — but root `CLAUDE.md` makes the Wayfinder the only document permitted to state the exact next action, and it now states it by implication rather than directly. Recorded once (D-9), for the scheduled reconciliation.
- **What his list missed:** **D-7** (F2-5 has no raw capture) and **D-8** (the README's own limits section does not disclose that absence).
- **Active documents that would misdirect a fresh instance:** none in this Gate 1 scope. `RUNBOOK.md` §2's non-runnable example misdirects the **operator**, and is graded in the Gate 2 receipt where the human journey lives.
- **Closure claims since the last receipt, and the receipt behind each:** **none made.** The map's re-cut row states *"Veritas returned Gate 1 HOLD (all nine) and Gate 2 HOLD"* and *"GATE HELD"*; the FRONTIER row records *"Larry may not record PASS himself, and Warwick has ruled the gate is not to be waived."* The README states *"No Phase PASS. These are inputs to Veritas, not a verdict."* **No false completion claim. Larry withheld PASS correctly in four places, and one of them repeats Warwick's instruction against waiving the gate rather than leaning on it.**

## Defects

| # | Severity | Finding | blocking/non-blocking | Owner |
|---|---|---|---|---|
| **D-1** | — | **DISCHARGED.** Raw capture from the managed store is committed, internally consistent across two independently generated files, and partially recomputable by any reader — which I did. The predecessor's *"every managed-project figure exists only as narrative"* is no longer true of any requirement except F2-5, and that survivor is recorded as D-7 rather than as D-1 unhealed. | closed | — |
| **D-2** | — | **DISCHARGED.** Re-cut at source, struck through, dated, `#105`'s merge at `c35e4f9` stated, enduring principle preserved, and revert-proofed with a note explaining why. | closed | — |
| **D-7** | **MEDIUM** | **F2-5 has no raw capture.** The mid-compile SIGKILL is the one behavioural proof that was not re-executed, and the post-hoc integrity query cannot stand in for it: a clean store now evidences that nothing damaged it, not that a kill was survived. **The exact next action this blocks: recording Phase 2 PASS.** It blocks nothing else — no product code is implicated, no continuation is unsafe, Phase 1 is unaffected, and the Gate 2 human journey is unaffected. Dischargeable by one short capture: the exit/signal, the `packs` / `entries` / `compile_runs` counts either side, the four partial-state invariants, and the completing re-run. | **blocking** (Phase 2 PASS only) | Larry |
| **D-8** | LOW | The evidence README's *"What this evidence still does NOT establish"* section — whose whole function is to name absent proofs — names the two superseded F1-4 kills but **not** the entirely absent F2-5 capture. The disclosure Larry asked me to judge is adequate where it speaks and silent where it matters most. **Non-blocking**: it misstates nothing and misdirects no journey; it is an omission in a limits list, and I found the absence in ten seconds from the section headers, which is the test of whether it could mislead a careful reader. | non-blocking | Larry |
| **D-9** | LOW | The map no longer carries a dedicated *"Exact next action"* row after the STATUS-table cut; the frontier is derivable from two other rows but is no longer stated outright, and root `CLAUDE.md` reserves that statement to the Wayfinder. Recorded once for the scheduled reconciliation. | non-blocking | Larry |
| D-5 | — | **Now materially closed** by the 20/20 live append-only refusals with a positive control: a failing connector is a client, and no client can alter an existing run. Recorded as closed rather than carried. | closed | — |
| D-6 | LOW | Runtime still connects as `postgres`. Unchanged, correctly declared, and now **explicitly parked by Warwick** in `RUNBOOK.md` §2 alongside the location question. Under the hobby-brain bar this is not escalated and is not re-raised. | non-blocking | Warwick, at his leisure |

## Verdict

**HOLD** — eight of the nine functional requirements are now genuinely evidenced by the managed store's own committed output, cross-checked three independent ways and recomputed where recomputable; the ninth, F2-5's mid-compile kill, has no capture at all, and the post-hoc integrity query offered in its place proves the store is clean rather than that a kill was survived.

**What this HOLD does and does not do.** It gates **recording Phase 2 PASS** and nothing else. **Phase 1's four requirements are all PASS.** It does not invalidate the work, reopen any product code, transfer the frontier, or require re-running anything already captured. **D-1, D-2, D-5 and G2-3 are discharged; the corrective work was accurate, honest and proportionate, and two of its habits — a branch-detecting kill harness and a positive control on the mutation harness — are better practice than the gate asked for.**

**Said plainly, because an eight-of-nine HOLD must not read as an eight-of-nine failure:** no product defect was found at this gate, at either review. The single outstanding item is one missing capture of a test that was already run once, and the honest reason it is a HOLD rather than a PASS is that this contract does not let me pass a durability property on an inference — which is the same standard that produced the predecessor HOLD Larry has just discharged.

## Next review trigger

A raw capture of the **F2-5 mid-compile SIGKILL** against the managed store, committed alongside the others — then **ONE focused confirmation of F2-5 alone.** Not the other eight requirements, not this receipt, not the map, not a moved head, and not any clerical repair.
