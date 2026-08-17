---
build: BUILD-006-vlogops-publishing-engine
scope: phases-1-and-2-north-star-journey
gate: 2

boundary: >
  The BUILD-006 Phase 1 + Phase 2 phase boundary, judged as ONE human outcome: can Warwick now
  supply a source through one of the three routes and obtain a durable, bounded,
  provenance-complete evidence pack in the real intended context — the managed Supabase project
  — using only the product in front of him. THE SHAs BELOW ARE PROVENANCE, NOT THE GATE.

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
  ⚠️ The repository moved under this review — HEAD 5254f150…dee3 → 70dd2278…e256, with two
  Team Knowledge/Templates files left modified-unstaged by a concurrent writer. CHECKED, not
  assumed: the diff between those heads has ZERO overlap with any path this review read, so no
  evidence here was gathered against a silently different state. Full disclosure in the
  companion Gate 1 receipt. This review authored only its two untracked receipts and modified
  no tracked file. `receipt_sha256` covers the BODY only and is unaffected.

review_ceiling: 45 minutes elapsed / ~150k tokens — shared with the Gate 1 receipt; honoured, not extended
credential_surface_refused: >
  C:\.fusion247 root. GL-012 §4 makes a surface at or above the secrets root an invalid grant a
  worker must refuse. No credential was read, requested, inferred or used; no connection to the
  managed project was attempted. The live figures in Larry's evidence document are therefore
  LARRY-ATTESTED and were not independently verified.

companion_receipt: veritas-phases-1-2-managed-live-gate1-5254f15.md   # Gate 1 — HOLD, nine of nine rows HOLD

verdict: HOLD
receipt_sha256: 9f2a1370abbf265d9b6a7446ad424ef7b6a1e0d5e522e7875744598a15806af1
reviewed_by: veritas
reviewed_date: 2026-08-17
next_review_trigger: >
  RUNBOOK.md §2's configuration route documented (or Warwick's recorded decision between the two
  forms), AND the Gate 1 D-1 raw-evidence gap discharged — then ONE focused confirmation of
  G2-1 and G2-2. NEVER a moved head, a receipt, a map re-cut or a clerical repair.
---
## Scope reviewed

**The ONE question, and Larry does not set its scope:** *«Can Warwick now do the thing Phases 1 and 2 promised, in the real intended context, without Larry explaining the machinery behind it?»*

**The accepted journey, taken from the map's §1 North Star and §10 phase gates rather than from the dispatch:** Warwick supplies a source through one of three routes and gets back a **durable, bounded, provenance-complete evidence pack** held in the real store, traceable to exactly the frozen bytes it was built from. The map's own bar is *"If this build ends with a pipeline that needs a human to nudge it between stages, it has failed its North Star"* — at Phases 1–2 that autonomy obligation is explicitly deferred to Phase 6 by `RUNBOOK.md`, so what is graded here is the human's ability to run the two documented commands and obtain the promised artefact, not autonomy.

**Not in scope:** Phase 3+ consumption of the pack; the creative/voice half; the eleven §9 programme criteria; the Codex gate.

**No narrowing was attempted by the dispatch.** It named all nine functional rows, both gates, and its own evidential limit.

## Accepted requirements

Gate 2 grades the journey, not the numbered functional rows — those are graded once, in the Gate 1 receipt `veritas-phases-1-2-managed-live-gate1-5254f15.md`, where nine of nine returned **HOLD**. **None of them was passed on engineering evidence, so the re-cut clause requiring Gate 2 to grade a user-facing row Gate 1 passed on backend evidence does not fire here.** No row is silently omitted.

## The journey, walked as the human would walk it

| Step | What the product in front of Warwick tells him | Result |
|---|---|---|
| 1. Find out what this is and what to run | `RUNBOOK.md` opens with *"Read this before operating VlogOps. You should not need to read its source."* and states plainly that there is no daemon, no port, nothing to supervise. §1 tabulates all five commands with a one-line meaning each. | **Genuinely good.** Honest about what exists, and it names the three routes in Warwick's language, not the schema's. |
| 2. Configure it | §2: `VLOGOPS_DB_URL` is **required**. *"Values live outside this repository. The estate convention is `node --env-file=<path outside the repo> …"* — **and that is all it says.** It names no file, no location, and no variable mapping. | **BLOCKED.** Warwick cannot obtain the value from the product in front of him. |
| 3. Run an intake | §3 gives the exact command line. Bad config exits **78** and reports every fault at once, with the faults named — a well-made surface. | Reachable **only** once step 2 is solved by someone who already knows the answer. |
| 4. Compile and verify | §1 gives both commands; §6 explains that a pack is a narrowing and that a pack which left something out says so. | Same dependency as step 3. |

**Step 2 is a hard stop, and it is verified by my own reading of the repository, not attested by anyone.** The value lives in an approved file at `C:/.fusion247/` under a **different variable name** (`DATABASE_URL`), and the run that produced today's evidence mapped that name at invocation. **Nothing in the product records the mapping.** The operative Gate 2 test — *«Could Warwick complete this journey correctly using ONLY the product in front of him, without Larry explaining hidden state?»* — answers **NO**, and it answers no at the second step, before any of the machinery this build spent two phases getting right is ever reached.

This is root `CLAUDE.md` §"Nothing may live only in Larry's head" applied to an outcome that is legitimately **manual**: manual is permitted here and is properly reclassified in the RUNBOOK, but *"the operator route depends on Larry remembering the mapping"* is the same defect the clause names, at smaller scale. Larry declared it himself as R1 and recommended the one-line fix; the finding is his, correctly reported, and it is nonetheless the thing that decides this gate.

## Current readiness — mandatory, and it is UNKNOWN

Contract §"Current readiness is NOT capability": for any stateful system, before a verdict may authorise the user's exact next real action, the preconditions of that action must be established **against the current durable production state**.

**I could not establish that state at all.** No live query, no row count, no schema read. The store is not empty — per the attestation it now holds 5 seeds, 38 snapshots, 8 intake runs, 3 packs and 4 compile runs, all created today — and this system's identity is **content-derived with deduplication**, so what the production path does next is genuinely state-dependent. A load-bearing state property that has not been examined is **HOLD**, never a qualified pass.

The six mandatory namings, because the practical effect of any conclusion here bears on whether Warwick should proceed:

1. **Exact next real event** — Warwick runs `node --env-file=… services/vlogops/bin/vlogops-intake.mjs records --from … --to …`, then `vlogops-compile compile --seed <id>`.
2. **Measured production state relevant to it** — **UNKNOWN. NOT MEASURED BY THIS REVIEWER.** Attested as 5 seeds / 38 snapshots / 3 packs.
3. **The production decision that will consume it** — content-derived `seed_id` as primary key; a matching identity yields `deduplicated: true` and writes no new seed. Verified from the DDL, not from the live state.
4. **State-dependent collision / rejection / resume / idempotency conditions** — re-taking a source already seeded returns the **existing** `seed_id` and writes nothing; recompiling a seed returns the **existing** `pack_id`. Correct behaviour, and it means Warwick's first re-run against the now-populated managed store may legitimately produce **no new row** — which the CLI does report (`deduplicated`), but which nothing in the RUNBOOK prepares him for as an expected outcome rather than a failure.
5. **Has that exact event been executed?** — **Attested yes, by Larry, on 2026-08-17. Not witnessed, and no raw capture exists.**
6. **If not executed, what establishes that the current state will admit it correctly?** — **Nothing available to this reviewer.**

Items 2 and 6 are UNKNOWN on load-bearing properties. That alone is `HOLD`, independently of step 2 above.

## Assurance dimensions

| Dimension | Verdict | Basis |
|---|---|---|
| Goal fidelity | **PASS** | Phases 1–2 target exactly the North Star's "durable evidence pack" half, and the RUNBOOK is honest that the autonomy half is Phase 6's. No overclaim of the promise. |
| Design fidelity | **PASS** | Verified in the Gate 1 receipt from the migrations themselves. |
| Functional proof | **HOLD** | The journey's final hop into the managed store is attested only; and the journey cannot be started from the documentation as written. |
| Integration | **HOLD** | The operator → configuration → managed store integration is the one link that is both undocumented and unwitnessed. |
| Durability | **HOLD** | Per Gate 1: mechanism verified in the DDL, managed-context observation unwitnessed. |
| Test quality | **n-a** | Graded at Gate 1 (PASS). Not re-run here; re-grading it would be duplication, not assurance. |
| Git truth | **PASS** | `5254f15` is on `origin/main`; scope and status accurately reported; PASS correctly withheld by Larry in three places. |
| Documentation truth | **HOLD** | `RUNBOOK.md` §2 cannot get the operator to a working configuration, and it is the document explicitly promising *"you should not need to read its source."* Plus the map's live §9.2 line 503 (D-2 at Gate 1). |
| Residual risk | **HOLD** | R1 is declared and accurate; the evidence-reproducibility residual is missing (D-1 at Gate 1). |
| Completed automation | **n-a — explicitly and legitimately reclassified as manual** | `RUNBOOK.md` §"WHAT THIS SERVICE IS TODAY" states there is no daemon, no scheduled task, no port and nothing to supervise until Phase 6. That is the honest reclassification root `CLAUDE.md` permits, not a manual step disguised as automation. The North Star autonomy obligation stays on the frontier for Phase 6 and is not discharged by anything here. |

## Restart and durability

Graded at Gate 1 — **HOLD**, mechanism verified, managed-context observation unwitnessed. Not re-examined here.

## Documentation contradiction scan

- **Would misdirect the human doing this journey:** `services/vlogops/RUNBOOK.md` §2 — *"Values live outside this repository. The estate convention is `node --env-file=<path outside the repo> …`"*. A document that opens by promising the operator will not need the source, and then declines to say where the one required value comes from, sends him to a person instead of to the product.
- **Would misdirect a fresh instance:** `Deliverables/2026-08-03-…-wayfinder-plan.md:503` (D-2 at Gate 1).
- **Closure claims:** no PASS claimed for either phase; both map rows correctly state a Veritas receipt is still required. **No false completion claim found.**

## Defects

| # | Severity | Finding | blocking/non-blocking | Owner |
|---|---|---|---|---|
| G2-1 | **HIGH** | **The documented journey cannot be started by Warwick alone.** `RUNBOOK.md` §2 requires `VLOGOPS_DB_URL` and names neither the approved file nor the `DATABASE_URL` → `VLOGOPS_DB_URL` mapping. Independently verified by reading the repository. **Blocks: recording Phase 1 PASS or Phase 2 PASS as a phase, and any statement that Warwick can now do the thing these phases promised.** It blocks no product work and no safe continuation. The fix is one line, and Warwick has a genuine choice between two forms (add the variable to the approved file, or name the file and mapping in §2) — Larry has already put both to him. | **blocking** | Larry / Warwick's one-line choice |
| G2-2 | **HIGH** | **The current durable managed state was not established by this reviewer, and the exact next real action is state-dependent.** UNKNOWN on items 2 and 6 of the anti-overclaim naming. Same root cause as Gate 1 D-1. **Blocks: any verdict whose practical effect is to authorise Warwick's next live run.** | **blocking** | Larry |
| G2-3 | LOW | Nothing in the RUNBOOK prepares the operator for `deduplicated: true` / no new row as a **correct and expected** outcome of re-taking an already-seeded source. Now that the managed store is populated, that is a likely first experience. A sentence in §1 or §6 would close it. | non-blocking | Larry |

## Verdict

**HOLD** — Phases 1 and 2 have built something well-designed and, on every structural check I could run myself, sound; but Warwick cannot today start the promised journey using only the product in front of him, because the one required configuration value is undocumented, and the current state of the real store the journey writes to is unknown to this reviewer.

**Stated plainly so no reader can take this as permission:** this receipt does **not** authorise, recommend or endorse proceeding with a live run, and does **not** say Warwick can now do the thing these phases promised. It says the opposite, for two named reasons, one of which I verified myself and neither of which is a defect in the built product.

**And stated equally plainly, because an honest HOLD must not read as condemnation:** no product defect was found. Every cross-check available to me — both migration digests, the whole of `001`, the structure of `002`, the derived 6/7/15 fingerprint, the nine identity columns, the `bounded`⇔`omitted` constraint, the `is distinct from` comparison behind R5, the route enum — agreed with what Larry reported. The two blockers are a missing line in a runbook and a missing raw capture. Neither costs a re-implementation, and neither is a reason to reopen anything that was already merged and Codex-approved.

## Next review trigger

The `RUNBOOK.md` §2 configuration route documented (or Warwick's recorded decision on which of the two forms he wants), **and** the Gate 1 D-1 evidence gap discharged — then **ONE focused confirmation of G2-1 and G2-2**. Not triggered by a moved head, a receipt, a map re-cut or any clerical repair.
