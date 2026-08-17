---
build: BUILD-006-vlogops-publishing-engine
scope: phases-1-and-2-north-star-journey — FOCUSED CONFIRMATION of G2-1 and G2-2
gate: 2

boundary: >
  The BUILD-006 Phase 1 + Phase 2 phase boundary, judged as ONE human outcome: can Warwick now
  supply a source through one of the three routes and obtain a durable, bounded,
  provenance-complete evidence pack in the real intended context — the managed Supabase
  project — using only the product in front of him. Same boundary as 5254f15. This is the ONE
  focused confirmation of G2-1 and G2-2 that the predecessor receipt named as its own trigger.
  THE SHAs BELOW ARE PROVENANCE, NOT THE GATE.

predecessor_receipt: veritas-phases-1-2-managed-live-gate2-5254f15.md   # HOLD
predecessor_receipt_sha256: 9f2a1370abbf265d9b6a7446ad424ef7b6a1e0d5e522e7875744598a15806af1
companion_receipt: veritas-phases-1-2-managed-live-confirm-gate1-2877dfb.md   # Gate 1 — HOLD, eight of nine PASS

reviewed_sha: 2877dfbf57c020ed71411f003501ca8caaed8d7e
governance_sha: 2877dfbf57c020ed71411f003501ca8caaed8d7e
branch: main
remote_reachable: true

evidence_method: >
  mixed — committed raw capture from the managed project; the target checkout at 2877dfb; and
  LIVE EXECUTION BY THIS REVIEWER of the newly documented configuration route, three ways,
  against a dummy env file in its own ephemeral workspace. The journey's front door was
  executed as documented rather than reasoned about.
evidence_workspace: >
  C:/Fusion247PKA (read in place) and
  C:/Users/Buggly/AppData/Local/Temp/claude/C--Fusion247PKA/058cb015-e803-4b49-9e9b-0819935f9eca/scratchpad/veritas-g21
  (ephemeral, outside the repository; one dummy env file with an unreachable 127.0.0.1:1 URL and
  no real secret; never committed)
worktree_head_at_start: 2877dfbf57c020ed71411f003501ca8caaed8d7e
worktree_head_at_end: 2877dfbf57c020ed71411f003501ca8caaed8d7e
worktree_status_clean: true
worktree_state_disclosure: >
  `git status --porcelain` empty at start and at end; HEAD identical. No tracked file modified.
  Only the two untracked receipts of this confirmation were authored. The repository did not
  move under this review.

review_ceiling: 25 minutes elapsed / ~80k tokens — shared with the Gate 1 receipt; honoured, not extended
credential_surface_refused: >
  C:\.fusion247 root, refused again per GL-012 §4. No credential read, requested, inferred or
  used; no connection to the managed project attempted; Larry was not asked for one.

verdict: HOLD
receipt_sha256: ac669ba3944ed06b15512d038bd4ac46d297469fbbaf58d7ec02e341931a4197
reviewed_by: veritas
reviewed_date: 2026-08-17
next_review_trigger: >
  `RUNBOOK.md` §2 printing ONE runnable command that sets VLOGOPS_DB_URL from the approved
  file's DATABASE_URL and invokes the bin — the form §2 already recommends in prose but does
  not print — then ONE focused confirmation of that single line. Nothing else reopens this
  gate: not a moved head, not a receipt, not the map, not a clerical repair, and not G2-2,
  which is discharged.
---
## Scope reviewed

**The ONE question, and Larry does not set its scope:** *«Can Warwick now do the thing Phases 1 and 2 promised, in the real intended context, without Larry explaining the machinery behind it?»*

**The two blockers this confirmation is bound to:** **G2-1** — the documented journey cannot be started by Warwick alone, because `RUNBOOK.md` §2 named neither the approved credentials file nor the `DATABASE_URL` → `VLOGOPS_DB_URL` mapping. **G2-2** — the current durable managed state was not established by the reviewer, and the exact next real action is state-dependent.

**No narrowing was attempted.** The dispatch named both gates, all nine functional rows, the four defects by name, the held cut, and its own single-actor limit — and explicitly invited a HOLD.

**What I did differently from the predecessor review, and it is what decides this gate.** The predecessor established G2-1 by *reading* §2. This confirmation **executed the documented route**, because contract §Method 2a makes the documented entrypoint, command and environment part of the journey: *"execute the exact entrypoint, command, environment and user-visible journey the phase promises, as documented, from the shell and operating context the user is actually expected to use."* I could do this without any credential, because a configuration route can be tested with a deliberately dead URL.

## G2-2 — DISCHARGED. The current-readiness naming, now measured

The predecessor recorded items 2 and 6 as UNKNOWN. Both are now answered.

1. **Exact next real event** — Warwick runs `node … bin/vlogops-intake.mjs records --from … --to …`, then `vlogops-compile compile --seed <id>`, then `verify --pack <id>`.
2. **Measured production state relevant to it** — **NOW MEASURED, from the store's own catalogue output.** At the capture: 5 seeds (3 `records`, 1 `promotion`, 1 `supplied`), all `status='sealed'`, 38 snapshots, 8 intake runs, 3 packs, 24 entries, 4 compile runs. After the behavioural proofs: **7 seeds · 62 snapshots · 15 intake runs**, with `unsealed 0` · `orphan_snapshots 0` · `seeds_without_snapshots 0` · `orphan_entries 0` · `packs_without_entries 0` · `stuck_transactions 0`. **The state this verdict rests on is that state, named here so the verdict expires with it.**
3. **The production decision that will consume it** — content-derived `seed_id` as primary key; a matching identity yields `deduplicated:true` and writes no new seed. Verified in the DDL **and now observed live**.
4. **State-dependent collision / rejection / resume / idempotency conditions — and this is the substance of the discharge.** The next action has exactly two branches and **both have now been executed against the managed store with committed output.** *Already-seeded source* → the existing `seed_id` returned, `deduplicated:true`, **seeds and snapshots unchanged** (5 → 5, 38 → 38 across three restarts), one append-only attempt-ledger row. *New source* → `deduplicated:false`, new seed, +12 snapshots. Compile behaves identically: three compiles, one `pack_id`, `packs` and `entries` unchanged, byte-identical emissions.
5. **Has that exact event been executed?** — **Yes, against the managed project, with raw stdout, real exit codes and real signals committed.** Single-actor (Larry); the store's own output rather than his account of it.
6. **If not executed, what establishes that the current state will admit it correctly?** — no longer hypothetical. Both branches are demonstrated, and **neither branch is destructive.**

**Why that last sentence is the whole discharge, and why this rule still bites elsewhere.** The counterexample that created the current-readiness rule was destructive: a date-derived identity collided with a **terminal** row, and the collision **absorbed the event, advanced the offset, and persisted nothing** — one branch silently lost the user's work. **This system has no such branch.** There is no offset, no queue, no lease, no cursor, no cancellation state, and no terminal status that can swallow an event: `sealed` is the *complete* state, `unsealed` is zero across the store, and the collision path is idempotent by design, demonstrated benign, and **reported to the operator** (`deduplicated: true`). A state change between the capture and Warwick's next run can therefore change **which** branch fires; it cannot make the action unsafe or lossy. **Applied to the AsdAIr pre-fix estate this reasoning still returns HOLD**, because there one branch destroyed the outcome — which is the discriminating test this contract requires the rule to survive.

**Named residual, non-blocking:** the measured state is as of 2026-08-17 ~11:16 and nothing later is captured. It is named rather than smoothed over, and it is not load-bearing here for the reason just given.

## G2-1 — the named defect is DISCHARGED; the printed route does not run, and I proved it

**What §2 now supplies, and it is exactly what was missing:** the approved file by **exact path** (`C:/.fusion247/fusion-capture-gateway.env`, cross-referenced to the same path `tools/session-report/populate.mjs` uses), the **name mismatch stated outright** (`DATABASE_URL` supplied vs `VLOGOPS_DB_URL` required), a reason not to duplicate the credential into a second file (*"a rotation silently leaves one stale"* — correct, and the better argument), and Warwick's parked decision recorded so nobody reopens it. **Warwick is no longer sent to a person to learn where the value lives. That was the finding, and it is discharged.**

**But the journey is the test, so I ran it.** Three executions, dummy env file, no credential:

| | What I ran | Result |
|---|---|---|
| **A** | The natural composition of new §2 (which names the file) with §3 (which shows `node --env-file=<path> bin/…`) | **exit 78** — `VLOGOPS_DB_URL is required … unset or empty`. `--env-file` supplies `DATABASE_URL`; the service needs the other name. **The most obvious reading of the newly repaired section fails.** |
| **B** | The **literal second code form §2 prints**: `node --env-file=… -e "process.env.VLOGOPS_DB_URL=process.env.DATABASE_URL"` | **exit 0 and nothing ran.** It sets a variable in a process that immediately exits. The trailing comment `# …then spawn the bin` is where the instruction stops. |
| **C** | The mapped form, which I had to compose myself: `VLOGOPS_DB_URL=<url> node bin/vlogops-intake.mjs …` | **Configuration PASSED**; only the deliberately dead host failed (`ECONNREFUSED 127.0.0.1:1`). **The mapping is the correct fix and the mechanism is right.** |

**§2's first form is not runnable either.** `export VLOGOPS_DB_URL="$DATABASE_URL"` is prefixed *"after sourcing the approved file"*, and **nowhere in the RUNBOOK is that sourcing shown** — `--env-file` does not export into the parent shell, which is precisely why A fails.

**§2 says in prose: *"Simplest reliable form, and the one the acceptance evidence used: run the bin as a child with the variable set from `DATABASE_URL`."* That form is the right answer and §2 does not print it.** So the section names the two facts it was faulted for omitting, and then hands the operator two examples, neither of which works.

**The operative test:** *«Could Warwick complete this journey correctly using ONLY the product in front of him?»* Following §2 as written: **no.** He can still get there — by ignoring both §2 examples and using §3's `export VLOGOPS_DB_URL='postgres://…'` with a value hand-copied out of the named file, which §2's own no-duplication warning discourages. **That is a completable route via a warning-against form, arrived at after a failed command.** The failure is loud, named and harmless (exit 78 naming the exact variable, before any connection), which is why this is a HOLD on one printed line and not a re-statement of the original hard stop.

## Accepted requirements

Gate 2 grades the journey. The nine numbered functional rows are graded once, in the companion Gate 1 receipt `veritas-phases-1-2-managed-live-confirm-gate1-2877dfb.md` — **eight PASS, F2-5 HOLD.** No row is silently omitted. **The re-cut clause requiring Gate 2 to re-grade a user-facing row that Gate 1 passed on backend evidence does not fire:** the eight Gate 1 passes rest on the managed store's own executed output, not on component tests or rows standing in for a human outcome, and the one user-facing property in this phase — the operator's ability to start the documented journey — is graded here, at this gate, on executed evidence.

## The journey, walked as the human would walk it

| Step | What the product tells him now | Result |
|---|---|---|
| 1. Find out what this is and what to run | Unchanged and still genuinely good: *"You should not need to read its source"*, no daemon, no port, all five commands tabulated in Warwick's language. | **PASS** |
| 2. Configure it | §2 now names the exact file and the exact mapping, warns against duplicating the credential, and records Warwick's parked decision. **Its two printed examples do not work — proved, A and B.** The recommended form is described in prose and never printed. | **HOLD** — no longer a hard stop; one wrong turn with a loud, named, harmless failure, and a completable route on the same page. |
| 3. Run an intake | §3 gives the exact command line; bad config exits 78 naming every fault at once — **I observed exactly that**. §1 now prepares him for `deduplicated: true` as *"the system working … You have done nothing wrong and there is nothing to clean up"* (**G2-3 discharged**), which matters because with 7 seeds already stored it is his likely first experience. | **PASS** once step 2 is past |
| 4. Compile and verify | §1 gives both commands; §6 explains that a pack is a narrowing and that a pack which omitted something says so — and the store confirms it does (`bounded true`, `omitted 4`, reason `over-budget`). | **PASS** |
| 5. Get the promised artefact | Executed against the managed store: a bounded, provenance-complete pack (8 entries = 8 stored, `entries_without_snapshot 0`), `verify` 8/8 **and still 8/8 with the original sources unreachable**, and three compiles emitting byte-identical documents whose digest **I recomputed myself**. | **PASS** |

**The promised outcome exists and is reachable. The front door has one broken example on it.**

## Assurance dimensions

| Dimension | Verdict | Basis |
|---|---|---|
| Goal fidelity | **PASS** | Phases 1–2 deliver the North Star's "durable evidence pack" half, and the RUNBOOK is honest that autonomy is Phase 6's. No overclaim. |
| Design fidelity | **PASS** | Verified from the migrations, and now confirmed in the live catalogue. |
| Functional proof | **PASS** | The end-to-end journey has been executed against the real managed store with committed raw output at every step. |
| Integration | **HOLD** | Operator → configuration → managed store: the store end is now witnessed; **the operator end has no working documented invocation.** That is the one link still broken, and it is broken in the document rather than in the code. |
| Durability | **HOLD** | Per Gate 1: intake kill-and-revive now evidenced on both branches; the mid-compile kill has no capture (F2-5 / D-7). |
| Test quality | **n-a** | Graded at Gate 1 (PASS, and improved). Re-grading would be duplication. |
| Git truth | **PASS** | `2877dfb` on `origin/main`; scope and status truthful; PASS withheld in four places, one of which repeats Warwick's instruction that the gate not be waived. |
| Documentation truth | **HOLD** | `RUNBOOK.md` §2's printed commands do not run (executed, A and B) in the document that opens by promising the operator will not need the source. **D-2 and G2-3 are discharged.** |
| Residual risk | **PASS** | The evidence README states the single-actor limit, the structural GL-012 constraint, the superseded early kills, the deliberately-kept failing capture, and *"No Phase PASS."* Its one omission (the absent F2-5 capture) is recorded at Gate 1 as D-8. |
| Completed automation | **n-a — legitimately reclassified as manual** | Unchanged: no daemon, no scheduled task, no port until Phase 6. The honest reclassification root `CLAUDE.md` permits. The North Star autonomy obligation stays on the frontier and is not discharged by anything here. |

## Restart and durability

Graded at Gate 1. **Intake: evidenced on both sides of the commit. Mid-compile kill: not captured.** Not re-examined here.

## Documentation contradiction scan

- **Would still misdirect the human doing this journey:** `services/vlogops/RUNBOOK.md` §2 — the code block at lines 73–75. Line 73 `export VLOGOPS_DB_URL="$DATABASE_URL"` presupposes a sourcing step the RUNBOOK never shows; lines 74–75 are a fragment that exits without running anything (**executed: exit 0, no intake**). Nothing else in the document misdirects.
- **Discharged:** the predecessor's *"Values live outside this repository … and that is all it says"* finding — §2 now says a great deal more, and all of it accurate.
- **Would misdirect a fresh instance:** none. `…wayfinder-plan.md` line 502 is re-cut, struck through and dated (D-2 discharged, verified at Gate 1).
- **Closure claims:** none. Both map rows record the HOLDs and that Larry may not record PASS himself; the README states these are inputs to Veritas, not a verdict. **No false completion claim.**

## Defects

| # | Severity | Finding | blocking/non-blocking | Owner |
|---|---|---|---|---|
| **G2-1** | — | **DISCHARGED as to its named defect.** §2 now names the approved file by exact path and the `DATABASE_URL` → `VLOGOPS_DB_URL` mapping outright. Warwick is no longer sent to a person for the value. | closed | — |
| **G2-2** | — | **DISCHARGED.** The current durable managed state is measured and committed; both branches of the state-dependent next action are executed against the managed store; neither branch is destructive. Named residual: the state is as of ~11:16 today. | closed | — |
| **G2-3** | — | **DISCHARGED.** §1 prepares the operator for `deduplicated: true` as correct and expected. | closed | — |
| **G2-4** | **MEDIUM** | **§2's printed configuration commands do not work, and the form it recommends in prose is never printed.** Executed, not inferred: the natural §2+§3 composition exits **78**; §2's own second form exits **0 having run nothing**; only a form I composed myself reaches the database layer. **Blocks: any statement that Warwick can now do the thing these phases promised using only the product in front of him — and therefore Gate 2 PASS.** It blocks no product work, no safe continuation, and nothing in Phase 3 planning. **The fix is to print the one command §2 already describes as the reliable form** — a single fenced line, no product change, no decision required from Warwick (his parked question is a different one and stays parked). | **blocking** (Gate 2 PASS only) | Larry |

## Verdict

**HOLD** — the machinery is now genuinely proven against the managed store and the promised artefact demonstrably exists; the operator's hidden knowledge has been written down, which was the real finding; but the two commands `RUNBOOK.md` §2 prints do not work when run, and I established that by running them rather than by reading them.

**Stated plainly so no reader can take this as permission:** this receipt does **not** authorise or endorse a claim that Warwick can today start this journey from the product alone. **What changed, and it is substantial:** he is no longer blocked on knowledge only Larry had — he is blocked on one worked example, with a loud named non-destructive failure if he takes the wrong turn, and a route on the same page if he takes the right one. That is a materially different and much smaller defect than the predecessor's hard stop.

**And stated with equal plainness:** no product defect was found at this gate either, at either review. Everything I could check independently — both migration digests, the re-derived 6/7/15 fingerprint, the live grants and RLS state, the `bounded`⇔`omitted` semantics in live data, `entries_without_snapshot = 0`, the three recomputed pack digests, the 20/20 mutation refusals with their positive control, the two cross-file state seams — agreed with what Larry reported. **The single-actor limit is real and permanent for this reviewer; it did not decide either verdict.** Both surviving findings are one absent capture and one absent code fence.

**On the two things Larry asked me to be hard about, answered directly.** *Is single-actor capture sufficient?* **Yes, for the eight requirements where the capture covers the requirement** — my contract's own discharge route permits raw executed evidence from an actor who can produce it, and this capture survived recomputation, cross-file seam agreement and arithmetic closure. **No, wherever the capture does not reach the requirement** — which is F2-5, held. *Does the capture evidence the requirement or only the mechanism?* **Outcome on eight rows; on F2-5 neither**, and that is the `acceptance-proves-mechanism-not-outcome` family recurring at its third occurrence, exactly where he predicted it.

## Next review trigger

`RUNBOOK.md` §2 printing **one runnable command** that sets `VLOGOPS_DB_URL` from the approved file's `DATABASE_URL` and invokes the bin — then **ONE focused confirmation of that single line**, which is a ten-second execution. Not triggered by a moved head, a receipt, the map, a clerical repair, or G2-2.
