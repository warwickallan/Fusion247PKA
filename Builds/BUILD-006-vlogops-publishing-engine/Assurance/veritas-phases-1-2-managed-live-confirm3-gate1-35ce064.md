---
build: BUILD-006
scope: phases-1-and-2-managed-supabase-live-acceptance — THIRD FOCUSED CONFIRMATION, F2-5 ONLY
gate: 1

boundary: >
  BUILD-006 Phases 1 and 2 live acceptance against the MANAGED Supabase project, as accepted in the
  ACTIVE SESSION WORK PACKAGE's nine numbered functional requirements F1-1…F1-4 and F2-1…F2-5. This
  receipt is the ONE focused confirmation of the single blocking finding my receipt at f373e4a named
  as its own next trigger: D-7 / requirement F2-5 — "killed mid-compile, nothing is written, and the
  compile completes on re-run". The other eight requirements are carried, not re-graded; I verified
  only that this delta did not damage them.

reviewed_sha: 35ce06444fb44aad3132f1bee0b1ef353e0cd3e8
governance_sha: 35ce06444fb44aad3132f1bee0b1ef353e0cd3e8
branch: main

evidence_method: target checkout at main, read in place — the reviewed head IS main, so no export was needed; no mutation testing was performed and nothing was replayed byte-exactly. The managed store was NOT inspected by me: I hold no credential, C:\.fusion247 is correctly out of bounds, I requested none, and its state reaches me only as Larry's committed, checksum-verified raw capture.
evidence_workspace: C:/Fusion247PKA (read-only inspection); no separate export taken
worktree_head_at_start: 35ce06444fb44aad3132f1bee0b1ef353e0cd3e8
worktree_head_at_end: 35ce06444fb44aad3132f1bee0b1ef353e0cd3e8
worktree_status_clean: true
# `git status --porcelain` was clean at start and shows, at end, only this receipt and its Gate 2
# companion as untracked — my own output, in my declared write surface. No tracked file was modified.

verdict: PASS
receipt_sha256: 5fb5ce1abb43b819ef74f20606b6d4e7f78f01b6a2559fcecd9aa6a647adac55
reviewed_by: veritas
reviewed_date: 2026-08-17
next_review_trigger: >
  A material change to the Phase 1-2 promised outcome: executable behaviour in services/vlogops, the
  accepted functional scope of the nine requirements, a load-bearing interface, dependency or
  migration, or runtime wiring. NOT a receipt, NOT the map, NOT a moved head, NOT clerical repair,
  and NOT a further legitimate row in the managed store.
---

## Scope reviewed

**F2-5 ALONE.** This is the ONE focused confirmation of the single blocking finding (D-7 / requirement F2-5) that my receipt at `f373e4a` named as its own next trigger. The dispatch asked for exactly that and nothing more, which matches the trigger I set.

**The eight already-PASSed requirements are NOT re-graded.** I checked only whether this delta damaged them: `git show --stat 35ce064` touches the evidence README, `SHA256SUMS.txt`, `live-proofs-raw.txt` (+28 lines), my own two receipts and one map line — **no product code, no SQL, no migration, no configuration.** They are undamaged and carried forward.

**Commissioning question satisfied.** *«What changed that could plausibly change my answer?»* — a capture using the product's own `--hold-at` facility now exists, which is the exact discharge route my prior receipt prescribed. That is a material change to the evidence for the held requirement.

**Deliberately not in scope:** Gate 3, the post-commit compile branch beyond recording it as a disclosed limit, and `C:\.fusion247` (correctly refused; no credential was requested or supplied).

## Accepted requirements

| # | Requirement | Verdict | Evidence | Residual |
|---|---|---|---|---|
| F1-1 | Phase 1 intake — three routes land against the managed store | **PASS** (carried, not re-graded) | `veritas-…-confirm-gate1-2877dfb.md`; undamaged by this delta (`git show --stat 35ce064`: no product code) | none |
| F1-2 | Content Seed identity is content-derived and idempotent | **PASS** (carried) | as above | none |
| F1-3 | Identity survives restart — fresh processes, same seed, `deduplicated:true` | **PASS** (carried) | as above | none |
| F1-4 | Killed mid-intake, nothing or all of it, both sides of commit | **PASS** (carried) | as above | none |
| F2-1 | Snapshot freezing / sealing against the managed store | **PASS** (carried) | as above | none |
| F2-2 | Pack planning is bounded and reports omissions | **PASS** (carried) | as above | none |
| F2-3 | Determinism — a third independent compile lands on the SAME pack, identical bytes | **PASS** (carried) | as above | none |
| F2-4 | Verify reads only frozen snapshots | **PASS** (carried) | as above | none |
| **F2-5** | **Killed mid-compile, nothing is written, and the compile completes on re-run** | **PASS** | **See §"The F2-5 window, established three independent ways" below.** Kill window proven by the product's own marker inside the open transaction with a pack row and one entry row already inserted (verified by me in `src/compiler.mjs`, not inferred from timing); corroborated server-side by 1 session `idle in transaction`; rollback proven by unchanged counts and three zero partial-pack invariants; completion proven by a `deduplicated:false` re-run writing exactly one pack and eight entries | **Non-blocking, and already disclosed by Larry:** no capture of a POST-commit mid-compile kill. See D-9 |

**Nine of nine functional requirements PASS. No mandatory row is held, and none is omitted.**

## The F2-5 window, established three independent ways

The whole of my prior HOLD was that the 350 ms kill sat inside the 317–337 ms boot-to-first-connect floor, so the harness's PRE-commit detection could not separate *killed after inserting* from *killed before connecting*. **That inference is now removed entirely, not narrowed.**

1. **From the product's source, at this head — the decisive one, because it does not depend on the harness at all.** `services/vlogops/src/compiler.mjs`: `withTransaction(pool, async (client) => { … })` at line 65; `insert into vlogops.evidence_pack` at 104–124; `await pause('pack-inserted')` at 129; then the entry loop, `insert into vlogops.evidence_pack_entry` at 134, with **`await pause('entry-written')` at line 150 INSIDE the loop body** — so it fires after the FIRST entry insert; and only afterwards, at 156, `insert into vlogops.compile_run`. **Therefore at the instant the marker is printed: the transaction is open, one `evidence_pack` row and one `evidence_pack_entry` row are inserted and uncommitted, and no `compile_run` row exists yet.** Real work existed to roll back. `bin/vlogops-compile.mjs:110–122` writes `VLOGOPS_HELD_AT <stage>` to stdout and then parks on `await new Promise(() => {})` with an explicit `keepalive.ref()` — so the process cannot exit cleanly and be mistaken for a survived kill.
2. **From the capture's own stdout.** `VLOGOPS_HELD_AT entry-written` observed at **675 ms** — roughly double the measured boot floor — with `[stdout] VLOGOPS_HELD_AT entry-written` recorded and SIGKILL delivered only after it. Timing is now corroboration, not the argument.
3. **From the server, independently of the harness's reading of its own stdout.** `[server-side] sessions idle in transaction at the moment of the kill: 1`, against `idle_in_txn 0` before and `idle_in_txn 0` after. This is the check I would have asked for had Larry not taken it, and it is what makes the claim not rest on a harness interpreting itself.

**Rollback:** `packs 4 · entries 32 · compile_runs 6` identical before and after the SIGKILL; `orphan_entries 0 · packs_without_entries 0 · packs_miscounting_entries 0`. The uncommitted pack + entry are gone, and no attempt row leaked.

**Completion:** the same seed re-run at the real CLI entry point returned `deduplicated:false`, pack `9649891c…`, 8 entries, exit 0 — `deduplicated:false` being the discriminating assertion, since a half-present pack would have produced `true` — and `packs 4→5 · entries 32→40`.

**Answering the question Larry asked me to ask as hard as twice before — does this evidence the REQUIREMENT or only the mechanism?** **The requirement.** The distinction that failed twice was that a clean store afterwards is the outcome of *nothing having been written*, not of *a write being rolled back*. This capture closes precisely that: item 1 establishes from the product's own source that rows WERE written before the kill, so the unchanged counts afterwards are now evidence of rollback rather than of absence. The `--hold-at` affordance does not alter the SQL, the transaction structure or the commit boundary — it only chooses *when* the kill lands, which was the one unknown. This is the third occurrence of the `acceptance-proves-mechanism-not-outcome` family closed on its merits, not waived.

## Evidence provenance

- **Inspected in place at `35ce064`** (no export needed; nothing was mutated and no byte-exact replay was required): `## F2-5 (SECOND ATTEMPT …)` at `Builds/BUILD-006-vlogops-publishing-engine/Assurance/evidence/live-proofs-raw.txt:149–175`; `services/vlogops/src/compiler.mjs:51–175`; `services/vlogops/bin/vlogops-compile.mjs:100–130`; `SHA256SUMS.txt`; `git show --stat 35ce064`.
- **Repository `git rev-parse HEAD`** at start and end — `35ce06444fb44aad3132f1bee0b1ef353e0cd3e8` / `35ce06444fb44aad3132f1bee0b1ef353e0cd3e8`, identical.
- **`git status --porcelain`** — clean at start; at end it shows only this receipt and its Gate 2 companion as untracked. Those are my own output and my declared write surface; **no tracked file was modified, and no mutation testing was performed in the repository.**
- **`git branch -r --contains 35ce064`** → `origin/main`. The head is remotely reachable, so `PASS` is available to it.
- **I did not measure the managed store myself.** I hold no credential, `C:\.fusion247` remains correctly out of bounds, and I asked for none. The store's state reaches me only as Larry's committed raw capture, which is the same evidence class my two prior confirmations accepted, and its integrity is recomputable: `SHA256SUMS.txt` matches on recomputation for both files I graded from.

## Evidence executed or inspected

| Command or artefact | Exit | Executed subtests | Result |
|---|---|---|---|
| `sha256sum live-proofs-raw.txt README.md` vs `SHA256SUMS.txt` | 0 | 2 of 2 | `2f290083…` and `ea2b41c3…` — **both match.** The capture I graded is the capture that was committed |
| `grep -n "^## " live-proofs-raw.txt` | 0 | 9 sections | `## F2-5 (SECOND ATTEMPT …)` present at line 149 |
| `sed -n '95,175p' src/compiler.mjs` | 0 | n/a | `pause('entry-written')` at line 150, **inside** the entry loop, **inside** `withTransaction`, **after** the pack insert, **before** the `compile_run` insert |
| `sed -n '100,130p' bin/vlogops-compile.mjs` | 0 | n/a | marker written to stdout, then an unresolvable promise with a ref'd keepalive — no clean-exit confound |
| `git show --stat 35ce064` | 0 | 6 files | evidence, two receipts, one map line. **No product code, no SQL, no migration** |
| `git rev-parse HEAD` / `git status --porcelain` / `git branch -r --contains` | 0 | 3 | head stable, tree unmodified, `origin/main` |
| The managed store itself | — | — | **NOT reachable by me.** Declared, not smoothed over: graded from committed raw capture, checksum-verified |

## Assurance dimensions

| Dimension | Verdict | Basis |
|---|---|---|
| Goal fidelity | **PASS** | The requirement asked for a mid-compile kill that writes nothing and re-runs to completion. That is now what was captured. |
| Design fidelity | **PASS** | The single-`withTransaction` design is confirmed from source and is now demonstrated rather than argued. |
| Functional proof | **PASS** | Real CLI entry point, managed store, exit/signal captured, discriminating assertion. |
| Integration | **PASS** | `bin/vlogops-compile.mjs` → `compileEvidencePack` → `withTransaction` → the three inserts. Nothing was reached by a test calling it directly. |
| Durability | **PASS** | **The dimension that was held, and it is now discharged.** Kill-and-revive is evidenced for compile as it already was for intake: a kill inside an open transaction holding real uncommitted rows, rolled back to the byte-count, and the work reproduced on re-run. |
| Test quality | **PASS** | The assertion turns red in the failing direction: `deduplicated:false` would have been `true` had the killed work partly survived, and the partial-pack invariant is stated in its discriminating three-part form rather than as "the store looks clean". |
| Git truth | **PASS** | Delta accurately described by Larry; head remotely reachable; the superseded 350 ms capture is retained and labelled rather than deleted, which preserves the third occurrence of the pattern. |
| Documentation truth | **PASS** for this scope | D-8 is discharged: the README's limits section now names the superseded capture with my measurement and names the absent post-commit branch. One non-blocking staleness elsewhere — D-10. |
| Residual risk | **PASS** | The one remaining gap (post-commit compile branch) is disclosed by Larry at README line 79, unprompted, and bounded. |
| Completed automation | **n-a** | Phases 1–2 promise operator-invoked CLI routes; the RUNBOOK is explicit that autonomy is Phase 6's. No automatic outcome is claimed on this boundary, so the clause does not fire. |

## Production caller and journey

Unchanged and not re-traced. The F2-5 capture invokes `node bin/vlogops-compile.mjs compile --seed … --hold-at entry-written` — the real entry point — not a harness calling `compileEvidencePack` directly. That is why both halves count as journey evidence.

## Restart and durability

**Compile (F2-5) — now evidenced.** SIGKILL to pid 24064 while the transaction was open with one `evidence_pack` and one `evidence_pack_entry` row inserted; server reported 1 session `idle in transaction` at that instant; after the kill, `idle_in_txn 0` and all counts unchanged; the same compile then completed and wrote exactly one pack with eight entries. **The structural argument my last receipt accepted-but-refused-to-count is now a captured observation.**

**Not evidenced, and named:** a kill in the POST-commit window of a compile (D-9).

## Documentation contradiction scan

- **Larry's declared changes:** the second F2-5 capture · `SHA256SUMS.txt` recomputed · the README recording the superseded capture with my measurement · the map · his two disclosed non-blocking items.
- **Verified independently:** checksums recompute; the README does now name the absent post-commit branch and the worthless 350 ms capture; the map's Phase 1 row (line 577) quotes my authorisation accurately and attributes the grading to Veritas rather than to himself.
- **What his list missed:** **D-10** — the map's `Current phase` row (line 100) still reads *"Awaiting Veritas Gate 1 + Gate 2"* and line 109 still asserts *"No Phase PASS yet"*, both now contradicted by line 577's recorded Phase 1 PASS. It errs conservatively and misdirects no executable action, so it is non-blocking.
- **Closure claims since my last receipt, and the receipt behind each:** Phase 1 PASS (map line 577) → `veritas-…-confirm2-gate2-f373e4a.md`, whose line 149 states in terms that it *"authorises recording Phase 1 PASS"*. **The claim is supported. Larry has not overread me.**

## Defects

| # | Severity | Finding | blocking/non-blocking | Owner |
|---|---|---|---|---|
| **D-7** | — | **DISCHARGED.** The F2-5 mid-compile kill is captured inside a demonstrably open transaction holding real uncommitted rows. This closes the only blocking finding on this boundary. | closed | — |
| **D-8** | — | **DISCHARGED.** The evidence README's limits section now names the superseded capture and the absent post-commit branch. | closed | — |
| **D-9** | LOW | No capture of a kill in the POST-commit window of a compile. Bounded and unimportant: F2-5's falsifiable claim is *"nothing is written"*, which is the pre-commit branch; the post-commit branch's claim is *"all of it"*, already evidenced by F2-3 determinism and the `deduplicated:true` dedup path, and the "nothing, or all of it" invariant is checked across both branches in the capture. **Disclosed by Larry before I asked.** | non-blocking | Larry |
| **D-10** | LOW | Map lines 100 and 109 still say Phase 1 PASS is awaited. Clerical status staleness in the conservative direction; no executable journey is misdirected. Park to the scheduled reconciliation. **Not a Work Order.** | non-blocking | Larry |
| **ERRATUM** | — | **Correction to my own receipt `…-confirm2-gate2-f373e4a.md`, line 100**, recorded here because a committed receipt is never edited. That line reads *"This verdict rests on that state and expires with it"* — unqualified — while the same receipt's frontmatter trigger and line 151 both carry the correct qualifier, *"expires if that state moves **in a way that changes the branch Warwick's next action takes**"*. **The qualified form is the operative one**; the bare form on line 100 was imprecise and, read alone, would make any legitimate row insertion void a Gate 2 PASS. See the Gate 2 delta receipt. | non-blocking | Veritas |

## Verdict

**PASS** — F2-5's kill now lands in a window proven from the product's own source, corroborated by the server, holding real uncommitted rows that demonstrably rolled back, with the compile completing on re-run; nine of nine functional requirements are PASS and Gate 1 is no longer held on this boundary.

## Next review trigger

A material change to the Phase 1–2 promised outcome: executable behaviour in `services/vlogops`, the accepted functional scope of the nine requirements, a load-bearing interface, dependency or migration, or runtime wiring. **Not** a receipt, not the map, not a moved head, not clerical repair, and **not** a further legitimate row in the managed store.
