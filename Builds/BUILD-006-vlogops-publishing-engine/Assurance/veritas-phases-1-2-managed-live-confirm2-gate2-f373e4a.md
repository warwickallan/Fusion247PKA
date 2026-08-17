---
build: BUILD-006-vlogops-publishing-engine
scope: phases-1-and-2-north-star-journey — SECOND FOCUSED CONFIRMATION, G2-4 ONLY
gate: 2

boundary: >
  The BUILD-006 Phase 1 + Phase 2 phase boundary, judged as ONE human outcome: can Warwick now
  supply a source through one of the three routes and obtain a durable, bounded,
  provenance-complete evidence pack in the real intended context — the managed Supabase project
  — using only the product in front of him. Same boundary as 5254f15 and 2877dfb. This is the
  ONE focused confirmation of G2-4, the single blocking finding the predecessor receipt named as
  its own trigger. THE SHAs BELOW ARE PROVENANCE, NOT THE GATE.

predecessor_receipt: veritas-phases-1-2-managed-live-confirm-gate2-2877dfb.md   # HOLD, G2-4 only
predecessor_receipt_sha256: ac669ba3944ed06b15512d038bd4ac46d297469fbbaf58d7ec02e341931a4197
companion_receipt: veritas-phases-1-2-managed-live-confirm2-gate1-f373e4a.md   # Gate 1 — HOLD on F2-5

reviewed_sha: f373e4a3e26a404ad49038248b017036fc8f9cc9
governance_sha: f373e4a3e26a404ad49038248b017036fc8f9cc9
branch: main
remote_reachable: true

evidence_method: >
  mixed — LIVE EXECUTION by this reviewer of the exact command RUNBOOK.md §2 prints, four ways,
  against a dummy env file in its own ephemeral workspace; the target checkout at f373e4a for
  the RUNBOOK, the CLI sources and tools/session-report/populate.mjs; and the committed raw
  capture from the managed project for the state this verdict rests on. The journey's front door
  was executed as documented rather than reasoned about.
evidence_workspace: >
  C:/Fusion247PKA (read in place) and
  C:/Users/Buggly/AppData/Local/Temp/claude/C--Fusion247PKA/058cb015-e803-4b49-9e9b-0819935f9eca/scratchpad/veritas-g24
  (ephemeral, outside the repository; one dummy env file with an unreachable 127.0.0.1:1 URL and
  no real secret; never committed)
worktree_head_at_start: f373e4a3e26a404ad49038248b017036fc8f9cc9
worktree_head_at_end: f373e4a3e26a404ad49038248b017036fc8f9cc9
worktree_status_clean: true
worktree_state_disclosure: >
  `git status --porcelain` empty at start; at end only the two untracked receipts of this
  confirmation. HEAD identical at start and end. No tracked file modified.

review_ceiling: 15 minutes elapsed / ~45k tokens — shared with the Gate 1 receipt; honoured, not extended
credential_surface_refused: >
  C:\.fusion247 root, refused again per GL-012 §4. No credential read, requested, inferred or
  used; no connection to the managed project attempted; Larry was not asked for one. The
  DATABASE_URL variable name was corroborated from the repository instead.

verdict: PASS
receipt_sha256: cfee97b199c633f3dedf1a702e60a3030b3c345df64619557dc7aa810cdc161e
reviewed_by: veritas
reviewed_date: 2026-08-17
next_review_trigger: >
  A material change to the OPERATOR-FACING journey for Phases 1–2: the documented invocation,
  the configuration route, the CLI surface, the exit-code contract, or the accepted user
  outcome. NOT a moved head, NOT a receipt, NOT the map, NOT a clerical repair, and NOT F2-5,
  which is Gate 1's. This PASS also rests on the durable state measured at 11:33 on 2026-08-17
  and expires if that state moves in a way that changes the branch Warwick's next action takes.
---
## Scope reviewed

**G2-4 alone — the one blocking finding my Gate 2 confirmation at `2877dfb` named as its own trigger:** `RUNBOOK.md` §2 printing one runnable command that maps the approved file's `DATABASE_URL` to `VLOGOPS_DB_URL` and invokes the bin. **I ran the printed line rather than reading it**, which is the only reason this is a discharge rather than a belief.

G2-1, G2-2 and G2-3 remain discharged at `veritas-phases-1-2-managed-live-confirm-gate2-2877dfb.md` (`ac669ba3944ed06b15512d038bd4ac46d297469fbbaf58d7ec02e341931a4197`) and are not re-graded. The nine numbered functional rows are graded once, at Gate 1: **eight PASS, F2-5 HOLD** — companion receipt `veritas-phases-1-2-managed-live-confirm2-gate1-f373e4a.md`.

**Deliberately not in scope:** Phases 0 and 3–7 · the §9 programme criteria · the Tower/Codex gate · estate reconciliation · Warwick's parked dedicated-location and `postgres`-role questions, both untouched and correctly still parked.

## G2-4 — DISCHARGED, by execution

§2 now prints **one** fenced command, tells the operator to run it from the repository root, and shows where to put the subcommand. I executed it **exactly as printed**, substituting only the credentials path — because I refuse the `C:\.fusion247` surface — with a dummy env file holding `DATABASE_URL=postgresql://u:p@127.0.0.1:1/postgres` and no secret.

| # | What I ran | Exit | Result |
|---|---|---|---|
| 1 | The printed line verbatim, `records --from 2026-08-05 --to 2026-08-05`, from the repository root | **1** | **Configuration PASSED — no exit 78.** The real entry point ran: the stack names `bin/vlogops-intake.mjs:152` → `src/db.mjs:50 withTransaction` → `pg-pool`, failing only at `connect ECONNREFUSED 127.0.0.1:1`, my deliberately dead host. **The mapping works and the journey reaches the database layer.** |
| 2 | The compiler variant §2 describes (`vlogops-compile.mjs`, `verify` with no `--pack`) | **64** | Usage printed, and **64 forwarded through the wrapper to my shell.** This is the check that matters: §5's exit-code contract survives the child/parent hop, executed rather than asserted. |
| 3 | The printed line with a malformed date (`--from NOTADATE`) | **1** | Message is exact and self-explaining — *"vlogops: window dates must be YYYY-MM-DD (got NOTADATE .. 2026-08-05)"*. The **code** is 1, not the 64 §5's table implies for a wrong command line. Recorded as G2-5, non-blocking: the human is told precisely what is wrong; only a script would consult the number. |
| 4 | The printed line from `services/vlogops/` instead of the repository root | 1 | `Cannot find module …\services\vlogops\services\vlogops\bin\…` — loud, self-diagnosing, and the instruction says repository root. §3's commands are repo-root-relative too, so **§2 and §3 now compose**, which is exactly what failed before. Non-blocking. |

**The substitution I made, and how I closed it without touching the private surface.** I did not read `C:/.fusion247/fusion-capture-gateway.env`, so I could not confirm from the file itself that its variable is named `DATABASE_URL`. I confirmed it from the repository instead: `tools/session-report/populate.mjs` declares `CREDENTIALS_PATH = 'C:/.fusion247/fusion-capture-gateway.env'` (line 40) and `CREDENTIAL_NAMES_DB = ['DATABASE_URL']` (line 43), against the same fixed path §2 names. **The mapping §2 prints is therefore correct against an independently declared name, not against Larry's account of a file I cannot see.**

**Both forms I proved broken are retained in §2 as an explicit warning**, including that the second *"exits 0 and nothing runs at all … its success is silent, which is worse than the failure above"*. That is the right disclosure: the trap is named where the next reader will meet it, and the reason it is dangerous is stated.

## The one Gate 2 question

> **«Can Warwick now do the thing Phases 1 and 2 promised, in the real intended context, using only the product in front of him?»**

**Yes.** Walked as the human walks it, with the two steps that had held now executed:

| Step | Result |
|---|---|
| 1. Find out what this is and what to run | **PASS**, unchanged. |
| 2. Configure it | **PASS — the change.** One printed line, executed by me exactly as printed, reaching the database layer. The two wrong turns are named on the page as wrong turns instead of being offered as examples. |
| 3. Run an intake | **PASS.** §3's command line is repo-root-relative and composes with §2; `deduplicated: true` is pre-explained as *"the system working"*. |
| 4. Compile and verify | **PASS.** Both commands given, `bounded`/`omitted` explained, and the store's live data matches the explanation. |
| 5. Get the promised artefact | **PASS.** Demonstrated against the managed store at the prior gate and recomputed by me then: three byte-identical pack documents, `entries_without_snapshot 0`, `verify` 8/8 with the original sources unreachable. |

**No narrowing was attempted by the dispatch.** It named both gates, both survivors, the ceiling, and invited a HOLD explicitly.

## Current readiness — the six mandatory namings, because this receipt's practical effect is to let Warwick proceed

1. **The exact next real event** — Warwick runs the §2 line from the repository root with `records --from … --to …`, then `compile --seed <id>`, then `verify --pack <id>`.
2. **The measured production state relevant to it** — as of the F2-5 capture at **11:33 today (2026-08-17)**, which is later than the state my prior receipt rested on: **packs 4 · entries 32 · compile_runs 6 · seeds 7 · snapshots 62**, with `orphan_entries 0` · `packs_without_entries 0` · `packs_miscounting_entries 0` · `unsealed 0` · `stuck_txns 0`. **This verdict rests on that state and expires with it.**
3. **The production decision that will consume it** — content-derived `seed_id` / `pack_id` as primary keys with `on conflict do nothing`; a matching identity returns the existing row and writes nothing.
4. **State-dependent collision / rejection / resume / idempotency conditions** — two branches, **both executed against the managed store, and the F2-5 capture adds a third execution of the new-work branch** (`deduplicated:false`, packs 3→4). Already-stored source → existing id, `deduplicated:true`, nothing written, one append-only attempt row. New source → new row set. Seed `fbe257f3…` now **has** a pack, so re-compiling it will report `deduplicated:true` — benign, and reported to the operator.
5. **Has the exact event been executed?** — **Yes** against the managed project, single-actor (Larry), with raw stdout, exit codes and signals committed and re-checkable; and **the documented front door has now been executed by me**, on this machine, from the shell an operator uses.
6. **What establishes that the current state will admit it correctly** — not inference: both branches are demonstrated, and **neither is destructive.** There is no offset, queue, lease, cursor, cancellation or terminal status that can absorb an event and lose it; `sealed` is the complete state and `unsealed` is zero across the store. A state change between the capture and Warwick's run can change **which** branch fires; it cannot make the action unsafe or lossy. Applied to the AsdAIr pre-fix estate this same reasoning still returns HOLD, which is the discriminating test my contract requires.

## Assurance dimensions

| Dimension | Verdict | Basis |
|---|---|---|
| Goal fidelity | **PASS** | Phases 1–2 deliver the North Star's durable-evidence-pack half, and the RUNBOOK is honest that autonomy is Phase 6's. No overclaim. |
| Design fidelity | **PASS** | Unchanged; verified from the migrations and confirmed in the live catalogue at the prior gate. |
| Functional proof | **PASS** | The whole journey has now been executed against the real managed store, and its documented front door by this reviewer. |
| Integration | **PASS — the change.** | Operator → configuration → managed store. The operator end was the one broken link; it is now one printed line that I ran, and its exit code forwards. |
| Durability | **HOLD, at Gate 1** | Intake kill-and-revive evidenced both branches; the mid-compile kill window is unlocated (F2-5 / D-7). **Carried here for truthfulness, not re-graded: it is engineering assurance and it does not obstruct the human journey.** |
| Test quality | **n-a** | Graded at Gate 1 (HOLD, on the F2-5 harness only). Re-grading here would be duplication. |
| Git truth | **PASS** | `f373e4a` on `origin/main`; scope and status truthful; no Phase PASS claimed anywhere. |
| Documentation truth | **PASS** | §2's printed command runs — executed four ways. §5's table survives the wrapper for 64 and 1. The one imprecision (a malformed date exits 1, not 64) is G2-5, non-blocking, because the printed message names the fault exactly. |
| Residual risk | **PASS** | The single-actor limit, the structural GL-012 constraint, the superseded early kills, the absent POST-commit compile branch and *"No Phase PASS"* are all stated in the evidence README. |
| Completed automation | **n-a — legitimately reclassified as manual** | No daemon, no scheduled task, no port until Phase 6. The North Star autonomy obligation stays on the frontier and nothing here discharges it. |

## Restart and durability

Graded at Gate 1 and not re-examined. **Intake: both branches evidenced. Mid-compile: the kill window is unlocated (D-7).**

## Documentation contradiction scan

- **Larry's declared change:** §2 prints one executed line; both broken forms retained as a warning; the parked location question untouched.
- **Verified independently by execution:** all four rows above. **§2 and §3 now compose** — the previous failure mode was precisely a composition that nobody had run.
- **What his list missed:** **G2-5** — §5's exit-code table maps "the command line was wrong" to 64, while a malformed `--from` value exits 1 and sends the reader to §7 for a database problem. Non-blocking: the printed message is unambiguous.
- **Also observed, non-blocking:** the wrapper resolves a child killed by signal to exit 1 (`r.status ?? 1`), so a SIGKILL through this line reports 1 rather than the signal. Irrelevant to the operator journey; recorded once so it is not rediscovered.
- **Active documents that would misdirect the human doing this journey:** **none found.** That sentence has not been available at either previous gate.
- **Closure claims since the last receipt, and the receipt behind each:** **none made.** The commit message states *"Still NO Phase PASS, and none is claimed"* and repeats Warwick's instruction that the gate not be waived. **No false completion claim.**

## Defects

| # | Severity | Finding | blocking/non-blocking | Owner |
|---|---|---|---|---|
| **G2-4** | — | **DISCHARGED.** §2 prints one command; I ran it exactly as printed and it reaches the database layer with configuration accepted; the exit code forwards (64 observed through the wrapper); the two broken forms are retained as named warnings; the `DATABASE_URL` name is corroborated by `populate.mjs`, not by Larry's account. | closed | — |
| **G2-5** | LOW | §5's exit-code table implies 64 for a wrong command line; a malformed date value exits 1. Recorded once for the scheduled reconciliation. | non-blocking | Larry |
| **D-7** | MEDIUM | The F2-5 kill window (Gate 1). Named here because it is the reason Phase 2 cannot be recorded PASS, **not** because it obstructs the human journey. | blocking (Phase 2 PASS only) | Larry |

## Verdict

**PASS** — Warwick can now do the thing Phases 1 and 2 promised, in the real intended context, using only the product in front of him: one printed command that I executed exactly as printed, a journey whose every step is documented in his language, and a bounded, provenance-complete, verifiable evidence pack demonstrated in the managed store.

**What this PASS authorises, stated exactly, because a PASS is quoted forward and a scope is not.**

- **It authorises the human journey.** Warwick may run the §2 line and work through §3–§6. Both branches of his next action are executed and neither is destructive.
- **It authorises recording Phase 1 PASS** — its four functional requirements are PASS at Gate 1 and the journey is PASS here.
- **It does NOT authorise recording Phase 2 PASS, and Gate 1 remains HOLD on F2-5.** Root `CLAUDE.md` requires Gate 1 PASS on the boundary being merged and Gate 2 PASS for a phase-complete merge; **Gate 1 is held, so no Phase 2 completion, closure or merge claim is available, and Codex is not eligible on this boundary.** A Gate 2 PASS beside a Gate 1 HOLD is not a contradiction: this gate asks whether the human can do the thing, and he can; the held requirement is a crash-atomicity proof he does not encounter.
- **It rests on the state measured at 11:33 on 2026-08-17** and expires when that state moves in a way that changes the branch his next action takes.

**And plainly: no product defect has been found at any of the three Gate 2 passes on this boundary.** The two findings that held it were one absent capture and one absent code fence, both in Larry's own documentation, both fixed by him without argument, and the second fixed by executing the command before printing it — which is the discipline that would have prevented it.

## Next review trigger

**Nothing on this Gate 2 boundary.** The journey question is answered and the answer is yes. Not a moved head, not a receipt, not the map, not a clerical repair, and not F2-5 — which is Gate 1's. This gate reopens only if the operator-facing journey materially changes: the documented invocation, the configuration route, the CLI surface, the exit-code contract, or the accepted user outcome for Phases 1–2.
