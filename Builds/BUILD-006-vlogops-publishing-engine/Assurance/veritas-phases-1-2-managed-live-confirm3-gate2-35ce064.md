---
build: BUILD-006
scope: phases-1-and-2 — GATE 2 CURRENT-READINESS RE-AFFIRMATION after the F2-5 state move
gate: 2

boundary: >
  The BUILD-006 Phase 1 + Phase 2 phase boundary, judged as ONE human outcome: can Warwick now
  produce and verify a durable evidence pack against the MANAGED Supabase project, through the
  documented operator route, without Larry explaining the machinery. Graded PASS at f373e4a. This
  receipt answers the single question that PASS left open by its own terms — whether it survives the
  durable-state move (packs 4->5, entries 32->40, compile_runs 6->7) caused by capturing the F2-5
  evidence I myself required. The journey is not re-graded; the current-readiness precondition is.

reviewed_sha: 35ce06444fb44aad3132f1bee0b1ef353e0cd3e8
governance_sha: 35ce06444fb44aad3132f1bee0b1ef353e0cd3e8
branch: main

evidence_method: target checkout at main, read in place, plus source-level establishment of the compile path's write set. The managed store was NOT inspected by me — no credential held, none requested, C:\.fusion247 correctly refused; its state reaches me as committed, checksum-verified raw capture.
evidence_workspace: C:/Fusion247PKA (read-only inspection); no export taken
worktree_head_at_start: 35ce06444fb44aad3132f1bee0b1ef353e0cd3e8
worktree_head_at_end: 35ce06444fb44aad3132f1bee0b1ef353e0cd3e8
worktree_status_clean: true
# Clean at start; at end only this receipt and its Gate 1 companion, untracked — my own output.

verdict: PASS
receipt_sha256: 7884e9c7a772e765b6cf69ca609f1f56b4f2e5fbb51b5c830479b6aee10a76b8
reviewed_by: veritas
reviewed_date: 2026-08-17
next_review_trigger: >
  A material change to the Phase 1-2 human journey: executable behaviour on intake, compile or
  verify, the documented operator route in RUNBOOK.md section 2, a load-bearing dependency or
  migration, or runtime wiring. On STATE: only a change that could redirect, endanger or lose the
  next action - a non-zero partial-state invariant, an unsealed snapshot, a stuck transaction, or the
  introduction of any offset, queue, lease, cursor or terminal status into this journey. A further
  legitimate pack, entry or attempt row is NOT a trigger.
---

## Scope reviewed

**ONE question, asked because Larry refused to assume the answer: does my Gate 2 PASS at `f373e4a` survive the durable-state move that capturing the F2-5 evidence necessarily caused?**

**The phase journey is NOT re-graded.** It was graded at `f373e4a` on executed evidence including my own execution of the documented front door, and this delta contains no product code, no SQL and no migration (`git show --stat 35ce064`). What is re-examined is the one property my contract forbids banking: **current readiness against the state that exists now.** Re-examining it is not standing on my own receipt — the commissioning question is answered by *"the state itself changed"*, which §"Current readiness is NOT capability" names explicitly as a valid reason.

**Deliberately not in scope:** Gate 3; the nine functional rows (Gate 1's, this same date, `…-confirm3-gate1-35ce064.md`); `C:\.fusion247`.

## The answer

**THE GATE 2 PASS SURVIVES. It is re-affirmed on the state measured at 11:46, not quoted forward from 11:33.**

**What moved:** `packs 4→5 · entries 32→40 · compile_runs 6→7` — one legitimate compile of seed `0618c483…`, the completing half of the F2-5 capture I required.

**What did not move, and I did not take this on Larry's word.** He states seeds 7 and snapshots 62 are unchanged. That is his account, and his account alone would be a HOLD. **It is independently established from the product's source at this head:** the compile transaction in `services/vlogops/src/compiler.mjs` inserts into exactly three tables — `vlogops.evidence_pack` (104), `vlogops.evidence_pack_entry` (134), `vlogops.compile_run` (156). **There is no write to a seed or a snapshot anywhere on the compile path, so the compile could not have moved either count, and `unsealed` cannot have moved off zero.** `stuck_txns` is not assumed either: the capture's final line reads `idle_in_txn 0`, measured after the kill.

**Whether it changes the branch Warwick's next action takes — the actual expiry test, applied hop by hop:**

| Hop of the exact next action | Effect of the move |
|---|---|
| `records --from … --to …` (intake) | **None.** Intake resolves a content-derived seed from a time window; seeds and snapshots are untouched, so this hop behaves identically. |
| `compile --seed <id>` | **None for any seed other than `0618c483…`.** For that one seed it flips new-work → `deduplicated:true`: an existing `pack_id` matches, `on conflict do nothing` returns the row, one append-only attempt row is written, and the operator is told. **This is the same benign branch my `f373e4a` receipt already named for seed `fbe257f3…` at item 4, and both branches were already executed against this store.** |
| `verify --pack <id>` | **None.** Verify reads frozen snapshots (F2-4); a further sealed pack cannot alter what it reads. |

**Nothing in this journey can absorb an event and lose it.** There is no offset, queue, lease, cursor, cancellation or terminal status — which is the exact property whose *presence* made the AsdAIr pre-fix estate a HOLD. Every partial-state invariant is zero at the newest measurement. **A row being added by a compile is therefore progress, not a state change that can redirect or endanger Warwick's next action.**

## On Larry's structural question — a real point, but not quite the one he framed

He asks whether scoping a verdict to a row count is a structural problem, given that producing the evidence I demanded moved the rows.

**The contract clause is right and needs no change:** a readiness verdict genuinely does expire when the state it rested on moves, because readiness is a property of now.

**The discipline the clause requires, and the one I under-served, is to name WHICH state properties are load-bearing** — the ones that can change the branch, the safety or the recoverability of the next action — rather than a bare inventory of counts. Named that way, legitimate forward progress cannot void a verdict, and **the paradox Larry describes cannot arise: capturing required evidence never invalidates the verdict it was required for.**

**My own receipt at `f373e4a` did this correctly in two places and loosely in one**, which is why he was right to ask rather than assume. Its `next_review_trigger` and its line 151 both read *"expires if that state moves **in a way that changes the branch Warwick's next action takes**"* — the operative, correct form. Its line 100 reads *"rests on that state and expires with it"*, unqualified; read alone, that would make any legitimate insertion void a PASS. **ERRATUM, recorded here because a committed receipt is never edited: the qualified form on line 151 and in the frontmatter governs.** The same erratum is recorded in today's Gate 1 receipt.

## Current readiness — the six mandatory namings, re-measured

1. **The exact next real event** — Warwick runs the RUNBOOK §2 route from the repository root: `records --from … --to …`, then `compile --seed <id>`, then `verify --pack <id>`.
2. **The measured production state relevant to it** — as of **11:46 on 2026-08-17**: **packs 5 · entries 40 · compile_runs 7**, with `orphan_entries 0 · packs_without_entries 0 · packs_miscounting_entries 0 · idle_in_txn 0`, from the committed raw capture (`live-proofs-raw.txt:174`), whose file checksum I recomputed against `SHA256SUMS.txt` and matched. **Seeds 7 · snapshots 62 · unsealed 0** unchanged — established from the compile path's write set in source, not from Larry's assertion.
3. **The production decision that will consume it** — content-derived `seed_id` / `pack_id` primary keys with `on conflict do nothing`; a matching identity returns the existing row and writes nothing beyond an append-only attempt row.
4. **State-dependent collision / rejection / resume / idempotency conditions** — the two branches, both executed against this managed store, and the F2-5 capture is now a fourth execution of the new-work branch. Seeds `fbe257f3…` and `0618c483…` both now have packs, so re-compiling either reports `deduplicated:true` — benign and reported.
5. **Has the exact event been executed?** — **Yes**, against the managed project, with raw stdout, exit codes and signals committed and re-checkable; and the documented front door was executed by me at the previous gate, on this machine, from the shell an operator uses.
6. **What establishes that the CURRENT state will admit it correctly** — not inference. Both branches are demonstrated; neither is destructive; no offset, queue, lease, cursor, cancellation or terminal status exists that can absorb an event and lose it; every partial-state invariant is zero at the newest measurement; and the hop-by-hop table above traces the exact next action against that measured state. **Applied to the AsdAIr pre-fix estate, this same reasoning still returns HOLD** — which is the discriminating test my contract demands of any formulation of this rule.

## Evidence provenance

- **Inspected in place at `35ce064`:** `live-proofs-raw.txt:149–175`; `src/compiler.mjs:51–175` (the write set); `bin/vlogops-compile.mjs:100–130`; `SHA256SUMS.txt`; my own `…-confirm2-gate2-f373e4a.md` lines 47–56, 94–112, 149–151; the map's Phase 1 row; `git show --stat 35ce064`.
- **Repository `git rev-parse HEAD`** start / end — `35ce06444fb44aad3132f1bee0b1ef353e0cd3e8` / identical. `git status --porcelain` clean at start; at end only this receipt and its Gate 1 companion, untracked — my own output.
- **`git branch -r --contains 35ce064`** → `origin/main`. Remotely reachable.
- **The managed store was not inspected by me.** No credential held, none requested, `C:\.fusion247` correctly refused. Its state reaches me only as committed, checksum-verified raw capture — the same evidence class my two prior gates accepted, and the class my contract permits from an actor who can produce it.

## Evidence executed or inspected

| Command or artefact | Exit | Executed subtests | Result |
|---|---|---|---|
| `sha256sum live-proofs-raw.txt README.md` vs `SHA256SUMS.txt` | 0 | 2 of 2 | both match — the state lines I re-measured against are the committed bytes |
| `sed -n '95,175p' src/compiler.mjs` | 0 | n/a | compile writes exactly three tables; **no seed or snapshot write exists on this path** |
| `grep -n "expire\|11:33\|next_review_trigger" …confirm2-gate2-f373e4a.md` | 0 | 4 hits | the qualified expiry form at frontmatter and line 151; the unqualified form at line 100 — the erratum above |
| `git show --stat 35ce064` | 0 | 6 files | evidence, two receipts, one map line. No product code, no SQL, no migration |
| `git rev-parse HEAD` / `git status --porcelain` / `git branch -r --contains` | 0 | 3 | head stable, tree unmodified, `origin/main` |

## Assurance dimensions

| Dimension | Verdict | Basis |
|---|---|---|
| Goal fidelity | **PASS** | Unchanged; the delta added evidence, not scope. |
| Design fidelity | **PASS** | Unchanged; the compile write set was re-read at this head and matches the accepted single-transaction design. |
| Functional proof | **PASS** | Unchanged, and strengthened: the compile path now has an observed crash-atomicity proof. |
| Integration | **PASS** | Unchanged; real CLI entry points throughout. |
| Durability | **PASS** | **Upgraded from HOLD.** The mid-compile kill that held this dimension at both prior gates is now captured inside a demonstrably open transaction. See the Gate 1 receipt. |
| Test quality | **PASS** | Unchanged; the discriminating assertion (`deduplicated:false`) would have flipped had the killed work partly survived. |
| Git truth | **PASS** | Delta accurately described; head on `origin/main`; the worthless 350 ms capture kept and labelled rather than quietly deleted. |
| Documentation truth | **PASS** for this scope | D-8 discharged. One non-blocking staleness (D-10, Gate 1) where the map's `Current phase` row still awaits a gate that has been granted. |
| Residual risk | **PASS** | The post-commit compile branch is disclosed unprompted (D-9); the single-actor capture limit and the GL-012 constraint remain stated. |
| Completed automation | **n-a** | No automatic outcome is promised by Phases 1–2; the RUNBOOK is explicit that autonomy is Phase 6's. |

## Production caller and journey

Not re-traced — the journey was executed and graded at `f373e4a`, including the documented front door by me. What is re-examined here is only the current-state precondition of its next run, in the hop-by-hop table above.

## Restart and durability

Now fully evidenced across both phases: intake kill-and-revive on both sides of commit (F1-4), and the mid-compile kill inside an open transaction holding real uncommitted rows (F2-5, this date). **Not evidenced:** a post-commit compile kill — bounded, disclosed, non-blocking.

## Documentation contradiction scan

- **Larry's declared changes:** the F2-5 second capture, checksums, README, my two receipts, one map line, plus two non-blocking items he raised himself (G2-5: §5's table implying exit 64 where a malformed `--from` exits 1; the wrapper resolving a signal-killed child to exit 1). **I accept both as non-blocking** — the emitted message names the fault, so no operator is misdirected, and neither changes what the human can do.
- **What his list missed:** D-10 (Gate 1) — map lines 100 and 109 still say Phase 1's PASS is awaited. Conservative direction, no journey misdirected, park it.
- **Closure claims since my last receipt, and the receipt behind each:** Phase 1 PASS (map line 577) → `…-confirm2-gate2-f373e4a.md:149`, which states in terms that it *"authorises recording Phase 1 PASS"*. **Supported. Larry did not overread me, and the row correctly attributes the grading to Veritas rather than to himself.**

## Defects

| # | Severity | Finding | blocking/non-blocking | Owner |
|---|---|---|---|---|
| **G2-4** | — | Remains DISCHARGED. | closed | — |
| **G2-5** | LOW | Larry's two self-raised RUNBOOK exit-code imprecisions. Recorded once, parked. **Not a Work Order.** | non-blocking | Larry |
| **ERRATUM** | — | Line 100 of `…-confirm2-gate2-f373e4a.md` states the expiry condition without its qualifier. The qualified form in that receipt's frontmatter and line 151 is operative. Recorded by successor receipt, never by editing the committed one. | non-blocking | Veritas |

## Verdict

**PASS** — the state moved by exactly one legitimate compile, in a direction that cannot redirect, endanger or lose Warwick's next action on any hop, and the properties that could have done so are unchanged and established from source rather than from Larry's account; the Gate 2 PASS survives and is re-affirmed on the 11:46 state.

**With Gate 1 PASS on the same boundary and the same date, PHASE 2 MAY NOW BE RECORDED PASS, and Phase 1's recorded PASS stands as written.**

## Next review trigger

A material change to the Phase 1–2 human journey: executable behaviour on the intake, compile or verify path, the documented operator route in `RUNBOOK.md` §2, a load-bearing dependency or migration, or runtime wiring. **On state:** only a change that could redirect, endanger or lose the next action — a non-zero partial-state invariant, an unsealed snapshot, a stuck transaction, or the introduction of any offset, queue, lease, cursor or terminal status into this journey. **A further legitimate pack, entry or attempt row is NOT a trigger**, and naming that explicitly is the correction this receipt makes to its predecessor.
