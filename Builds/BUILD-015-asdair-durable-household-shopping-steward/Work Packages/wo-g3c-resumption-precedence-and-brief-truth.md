---
name: One directive resumption document, and four briefs that agree with the repository (Veritas D-G3-01, 02, 05, 06, 07, 10, 11)
work_order_id: WO-2026-08-04-03
build: BUILD-015
wp_number: n/a
status: draft
authorised_by: Warwick
authorised_date: 2026-08-04
owner: general-purpose
return_to: larry
blocking_dependencies: []
tags: [build-015, veritas-gate3, documentation-truth]

outcome: Exactly one document in `Deliverables/` directs the next BUILD-015 session; it is current, coherent and free of struck-through overlays; the other three are explicitly non-directive; and every factual claim carried forward in all four is either verified against the repository or labelled unverified.
acceptance_property: A fresh instance that reads `Deliverables/NEXT-ASDAIR-SESSION-brief.md` and acts on its stated exact next action performs work that is genuinely outstanding at the integrated head — not work already completed, and not work at a placement already rejected. Checkable by taking the stated next action and confirming against the repository that it is not already done.
integration_owner: larry
veritas_gate: 3
document_impact:
  - path: Deliverables/NEXT-ASDAIR-SESSION-brief.md
    owner: larry
  - path: Deliverables/2026-08-04-rotation-brief.md
    owner: larry
  - path: Deliverables/BUILD-015-STAGE1-continuation-brief.md
    owner: larry
  - path: Deliverables/NEXT-SESSION-MISSION-repo-worktree-hygiene.md
    owner: larry
  - path: Builds/BUILD-015-asdair-durable-household-shopping-steward/DEFECT-LEDGER.md
    owner: larry
  - path: Builds/BUILD-015-asdair-durable-household-shopping-steward/END-TO-END-PROCESS-AUDIT.md
    owner: larry
  - path: Builds/BUILD-015-asdair-durable-household-shopping-steward/ACTIVATION-DEFERRED.md
    owner: larry
  - path: Builds/BUILD-015-asdair-durable-household-shopping-steward/CANONICAL-WEEKLY-SHOP-PROCESS.md
    owner: larry
  - path: Team Knowledge/SOPs/SOP-021-run-the-weekly-asdair-shop.md
    owner: larry

file_surface:
  - Deliverables/NEXT-ASDAIR-SESSION-brief.md
  - Deliverables/2026-08-04-rotation-brief.md
  - Deliverables/BUILD-015-STAGE1-continuation-brief.md
  - Deliverables/NEXT-SESSION-MISSION-repo-worktree-hygiene.md
out_of_scope_policy: report-only

worker_contract:
  path: AGENTS.md
  governance_sha: 66d40d38b867d76aeeb698ec89b13aff800552e5

contract_basis:
  - surface: Deliverables/NEXT-ASDAIR-SESSION-brief.md
    permitted_by: "Cross-document reconciliation defaults to Larry per `Team Knowledge/Templates/work-order.md` §'On document_impact'; Larry delegates the mutation. These are Larry's own resumption documents, not Wayfinder maps and not acceptance-defining documents."
  - surface: Deliverables/2026-08-04-rotation-brief.md
    permitted_by: "As above."
  - surface: Deliverables/BUILD-015-STAGE1-continuation-brief.md
    permitted_by: "As above."
  - surface: Deliverables/NEXT-SESSION-MISSION-repo-worktree-hygiene.md
    permitted_by: "As above."
  - action: "read-only git and filesystem inspection across the whole primary checkout"
    permitted_by: "`Team Knowledge/SOPs/SOP-022-work-order-preflight.md` §'Phase 2 — the preflight' (line 121): 'Verify the order against observable reality. Read-only; nothing here writes.' CORRECTED 2026-08-04 (Veritas D-G3-14): this entry previously cited root `AGENTS.md` for a clause that does not exist there — verified absent by grep for `reconnaissance`, `read-only` and `unrestricted`, each returning no match across its 336 lines."

contract_conflicts: none

capability_evidence:
  source: host agent roster listing delivered to Larry at session start, 2026-08-04
  result: "general-purpose advertised with the full tool set (`*`). This order requires Read, Edit, Write, Grep, Glob and read-only Bash — all advertised. No live probe was available; if a required tool proves absent at read-back, REFUSE and name it."

credential_scope: none
live_authority: none
network: none
dependency_policy: no-new-runtime-deps
private_surface: none

worktree: C:/Fusion247PKA
branch: build-015/live-acceptance-recovery-2026-08-03

schema_decision: n/a
security_inputs: n/a
operational_handoff: none

veritas_source:
  receipt: Builds/BUILD-015-asdair-durable-household-shopping-steward/Assurance/veritas-gate3-governance-ecfb04b.md
  reviewed_sha: ecfb04b8b6d5173ffa68b318baf2c3a97c0dd040

veritas_findings:
  - id: D-G3-01
    disposition: assigned-here
  - id: D-G3-02
    disposition: assigned-here
  - id: D-G3-03
    disposition: assigned-to
    work_order: WO-2026-08-04-01
  - id: D-G3-04
    disposition: assigned-to
    work_order: WO-2026-08-04-02
  - id: D-G3-05
    disposition: assigned-here
  - id: D-G3-06
    disposition: assigned-here
  - id: D-G3-07
    disposition: assigned-here
  - id: D-G3-08
    disposition: returned-for-Warwick-decision
    reason: "The active artefact — Keel's contract — states the fourth condition ('explicitly authorised') in its lead-in but enumerates only three after 'when all of these hold'. The other half of the discrepancy is `7f83d4c`'s commit message, which is immutable. Folding the fourth condition into the enumerated list requires editing an `AGENTS.md`, reserved to Warwick. RECORD Larry's recommendation in the brief: fold it in at Warwick's next authorised touch of that contract; the ambiguity is a countable mismatch, not a live routing hazard."
  - id: D-G3-09
    disposition: already-resolved
    evidence: "Malformed 32-character `governance_sha` in a dispatch envelope, not a repository artefact. True tip `565351d5abad48d8cfd969e1616e0b81a827d8d1`, resolved by Veritas independently and re-resolved by Larry. Every SHA written into this package was resolved through git, never recalled."
  - id: D-G3-10
    disposition: assigned-here
  - id: D-G3-11
    disposition: assigned-here
---

> # ⚠️ HISTORICAL RECORD — a Work Order ISSUED 2026-08-04. Preserved unrewritten; not an instruction today.
>
> **One clause carried in this order is SUPERSEDED and must not be acted on.** Under "HARD RULES — carried
> forward complete and unweakened" this order states: *"**Sonnet in Claude for Chrome is the Stage 1 live basket
> writer**; the CDP `browser-runner` is prohibited from further live-account testing; there is no programmatic
> Sonnet invocation surface and none may be invented."* ⛔ **SUPERSEDED 2026-08-17** by Warwick's product ruling
> — canonical in [`../BUILD-015-goal-contract.md`](../BUILD-015-goal-contract.md), register **S-5, S-7, S-8,
> S-9**: **AsdAIr operates the live browser and chooses its own execution mechanism; CDP is AUTHORISED; and a
> route that cannot be invoked by the system is DISQUALIFIED from the runtime.**
>
> **The other hard rules in that same list are UNCHANGED and absolute:** never auto-substitute, never book a
> slot, never check out, never pay, never enter the ASDA password, `checked_out` stays false, and the two
> credentials are consumed, never inspected.
>
> **The order's text is not rewritten** — it recorded the standing law correctly on the day it was issued.

## AMENDMENTS

**Amended 2026-08-04 by Larry at read-back acceptance. Recorded here because they were issued
verbally in the dispatch message and not written into this artefact.**

- **The exact next action was not settled by this order, and it is the acceptance property.** The
  prescribed FRONTIER opened with an item the order itself sequenced behind a Gate 3 PASS the estate
  does not hold. Settled as: *"Read the Veritas Gate 3 receipt for the resubmitted exact integrated
  head. On `VERITAS_PASS`, begin FRONTIER item 1. On `HOLD` or `FAIL`, discharge every finding and
  resubmit a new exact head."* The whole-frontier precondition is stated once at the head of the
  list, not repeated per item.
- **Orientation block — ruled against reproducing all nine bullets.** Root `CLAUDE.md` §Wayfinder's
  verbatim clause binds **Wayfinder implementation plans**; a resumption brief is not one, and
  importing the full block would import three statements that are false inside a brief. **Bullet 2
  alone is reproduced verbatim** as the governing rule, with the four BUILD-015 statements beneath
  it, plus a recorded line showing the question was decided rather than missed.
- **AC6 narrowed.** No 7-character abbreviation as an **identifier of record**; every such SHA
  resolved through git before it is written. Incidental historical mentions in prose may stay short.
  This dissolves the collision with AC10 over the pre-existing `1cb73e8`.
- **AC4 scoped** to BUILD-015 resumption documents, using `Map / focus` and `STARTUP / ORIENTATION`
  as discriminators. A raw grep for the phrase returns other builds' maps and `BACKLOG.md`; that
  must be explained in the evidence rather than left looking like a failure.
- **AC5 reads as banning a surviving *assertion*, not a surviving string.** A sentence whose whole
  content is *"`0-of-8` discharged, not 1-of-8"* is the correction and must survive.
- **Precedence block inserted as real markdown**, `> ` prefixes stripped — they were a presentation
  device. **"Adjust nothing" amended** to permit one added sentence, identical in all four,
  recording that the duplication is deliberate and why, as a stated exception to the SSOT Golden
  Rule.
- **Traps, WHAT NOT TO DO and THE LIVE-PROBE CRITERION stay in place** in the rotation brief; the
  directive brief carries its own and points across.
- **All fourteen suites re-run** rather than quoted from a receipt.
- **Three additions to DECISIONS WAITING ON WARWICK**, none acted on: the `CLAUDE.md:90` versus root
  `AGENTS.md` §3 contradiction; that nothing obliges re-reconciling a host shim when its wiki
  contract changes; and six shims over-claiming `MultiEdit` this host does not deliver.

**Verdict at read-back: CLARIFY.** Reasons logged in `SHIT-TO-DO.md` §2.

## What this order is, in one paragraph

Veritas Gate 3 returned **HOLD** on `ecfb04b8b6d5173ffa68b318baf2c3a97c0dd040` with **11 defects, 5 HIGH**, and held **Documentation truth at FAIL**. Four resumption-shaped documents in `Deliverables/` compete with no recorded precedence; two of them open with the same orientation block and both declare *"Map / focus — this brief"*; the one a fresh instance is most likely to open sends it to redo completed work. Warwick's instruction of 2026-08-04 is explicit: **"A struck sentence is not a reconciled document. Rewrite active instructions into one current, coherent state."** That is this order.

## The single most important instruction

**Stop patching. Rewrite.**

`Deliverables/NEXT-ASDAIR-SESSION-brief.md` is currently a base document plus layer upon layer of struck-through text, `WITHDRAWN` markers, `CORRECTED` blockquotes and a `WITHDRAWN AGAIN` note. That structure is exactly what failed: a correction was applied at `be6d1a5`, then regressed at `d30beb1`, and the stale instruction was still sitting there as live text for a fresh instance to act on. Veritas caught it as `D-G3-01`, HIGH, and called it the single most consequential finding in the receipt.

**Rewrite that file as one clean, current document.** Where history is genuinely load-bearing — a rejected design that a fresh instance would otherwise rebuild, a lesson that cost a night — carry it forward as a **plainly-written present-tense statement of what is true and what must not be done**, in a clearly-marked section. Do not carry it forward as struck-through text with a correction note above it.

## The corrected Gate 3 headline — fix this everywhere it appears

Warwick's correction, 2026-08-04: **Gate 3 found 11 defects, 5 HIGH — not four.** D-G3-01, 02, 03, 04 and 05 are all HIGH; verify that yourself in the receipt's Defects table.

- `Deliverables/2026-08-04-rotation-brief.md:11` currently reads *"**HOLD**, 11 defects, 4 HIGH"* — **wrong, correct it to 5 HIGH.**
- The same line reads *"It found four of its five HIGH findings *outside* the scope I gave it"* — also wrong, and it contradicts "4 HIGH" in the same sentence. The dispatched scope was `7f83d4c`'s five files plus `ecfb04b`'s rotation brief. Of the five HIGH findings, **three** were outside it: D-G3-01 (`NEXT-ASDAIR-SESSION-brief.md`), D-G3-03 (`.claude/agents/keel.md`) and D-G3-04 (root `CLAUDE.md`). D-G3-02 and D-G3-05 both land on documents that were in scope. **Verify this count yourself against the receipt's §"Scope reviewed" and its Defects table before writing it.**
- Sweep both remaining briefs for any other "4 HIGH" or equivalent.
- **Note, and do not try to fix:** commit `7ca8c3b`'s message also says "4 HIGH". A commit message is immutable history and is not an active document. Record that fact once, plainly, in the rewritten brief so the next reader who finds it is not misled.

## The precedence block — verbatim, in all four files

Insert this block **near the top of all four documents in `file_surface`**, byte-identical in each, immediately after the title and before any other content. Adjust nothing.

> ## RESUMPTION PRECEDENCE — recorded 2026-08-04, discharging Veritas `D-G3-07`
>
> **Exactly one document may direct the next session. This is the order, and every resumption-shaped
> document in `Deliverables/` carries this identical block.**
>
> 1. **`Builds/BUILD-015-asdair-durable-household-shopping-steward/`** — the build record is the
>    authority for every BUILD-015 fact. A brief that disagrees with it is wrong.
> 2. **`Deliverables/NEXT-ASDAIR-SESSION-brief.md`** — **THE single DIRECTIVE resumption document.**
>    Only this file may state the exact next action for BUILD-015.
> 3. **`Deliverables/2026-08-04-rotation-brief.md`** — **NON-DIRECTIVE.** A dated snapshot of the
>    2026-08-04 rotation, kept for its record of what changed and the traps it names. It states no
>    next action.
> 4. **`Deliverables/BUILD-015-STAGE1-continuation-brief.md`** — **NON-DIRECTIVE. Superseded
>    2026-07-28 snapshot**, kept as a historical record only.
> 5. **`Deliverables/NEXT-SESSION-MISSION-repo-worktree-hygiene.md`** — **NOT a BUILD-015 resumption
>    document.** A standing repository-hygiene mission; it never directs BUILD-015 work.
>
> **The Honcho continuity brief is a POINTER, never the authority** (root `CLAUDE.md` Step 2).
> **Verify by execution, not belief.**

Then make each file behave accordingly:

- **`NEXT-ASDAIR-SESSION-brief.md`** keeps the STARTUP / ORIENTATION block and the exact next action. It is the only one that may state one.
- **`2026-08-04-rotation-brief.md`** — remove its competing *"Map / focus — this brief"* orientation block and its *"Exact next action — see THE FRONTIER item 1"*. Convert its FRONTIER into a dated record of what was outstanding at that rotation, pointing to the directive brief for the live list. **Preserve in full its §"TRAPS THAT COST REAL TIME TONIGHT", §"WHAT NOT TO DO" and §"THE LIVE-PROBE CRITERION IS OPEN"** — those are the load-bearing content and must survive, either in place or absorbed into the directive brief with a pointer left behind. Losing them is a failure of this order.
- **`BUILD-015-STAGE1-continuation-brief.md`** — add the precedence block and a dated superseded banner. **Change nothing else.** It is a 2026-07-28 historical record and its contents are not to be "corrected".
- **`NEXT-SESSION-MISSION-repo-worktree-hygiene.md`** — add the precedence block and one line stating it is a standing hygiene mission, not a BUILD-015 resumption document. **Change nothing else.**

## D5 — record the count truthfully, per class, with evidence

Veritas's earlier receipt (`Assurance/veritas-wp-red-suite-recovery-0f8a1bc.md`, §"What his list missed") enumerates **eight** classes of stale active documentation. Larry declared D5 as 1-of-8 discharged; Veritas established at Gate 3 that it was **0-of-8** — the one class claimed discharged had regressed (`D-G3-02`).

Put an explicit **eight-row table** in the rewritten directive brief. One row per class, each with: the class, the exact file, the specific stale claim, its **status verified by you against the repository at this head**, and the evidence for that status. The eight classes, read from that receipt — **read it yourself, this list is context not authority**:

1. `Deliverables/NEXT-ASDAIR-SESSION-brief.md` — instructs the **rejected** `deps.js` / `realInterpretPhoto` placement for sanitized grounding evidence.
2. Same file — stale HEAD, stale suite table, FRONTIER items 1 and 2 described as outstanding when complete.
3. Same file — instructs adding `priorAnswers` to `realLoadPlanningInputs`, already present.
4. `Builds/BUILD-015-.../DEFECT-LEDGER.md` — `D-2026-08-03-15` "Alias matching is exact-string … Status: OPEN — unfixed".
5. `Builds/BUILD-015-.../END-TO-END-PROCESS-AUDIT.md` — `:36` and `:455` "`rule_qa_log` is never read by the planner at all"; `:262` lists WO-Y as OPEN, HIGH.
6. `Team Knowledge/SOPs/SOP-021-run-the-weekly-asdair-shop.md:407` — "Alias matching is exact-string". An **active operational SOP**.
7. `Builds/BUILD-015-.../ACTIVATION-DEFERRED.md:74` — the same stale exact-string claim.
8. `Builds/BUILD-015-.../CANONICAL-WEEKLY-SHOP-PROCESS.md` — row **G**'s stated reason is stale, and rows **B, C, D, E** read NO / NOT IMPLEMENTED / does not exist beside working, tested code.

**Classes 4-8 are NOT in your `file_surface` and you must not edit them.** Warwick sequenced their reconciliation as the first frontier item after a Gate 3 PASS. Your job for those five is to **verify and record their current status accurately**, not to fix them.

Classes 1-3 are in the file you are rewriting. If your rewrite genuinely removes those defects, the table says so **with the evidence**, and the headline count reflects the table. **Write the count the table supports — do not write a number and then justify it.** State separately and explicitly that at the Gate 3 reviewed head `ecfb04b8b6d5173ffa68b318baf2c3a97c0dd040` the count was **0-of-8**, which is the figure Veritas established and Warwick confirmed.

## The remaining findings

**D-G3-05** — `2026-08-04-rotation-brief.md` §"WHAT CHANGED TONIGHT" carries *"~~Both are now fixed.~~"* struck with a correction after it. Rewrite the passage into clean current prose. **D1 is discharged at `d30beb1`** (verify: `git log -1 d30beb1`, and confirm `selectProjection()` derives the projection from the statement text in `services/asdair/pipeline/test/fakePg.js`). **D5 is as your table establishes.** No struck text left behind.

**D-G3-06** — the same brief's *"~~No PR open.~~"* plus a correction. Rewrite clean. **Resolve the PR list yourself with `gh pr list --state open` and write what you observe** — do not copy Larry's numbers. Larry observed five open at 2026-08-04: #93 `fix/watcher-polls-all-open-prs`, #92 `fix/windows-hide-spawn`, #91 `fix/thin-larry-mcp-grant`, #81 `session-log/2026-07-28-11-12-estate-closure-close`, #80 `audit/de-mypka-extraction-20260728` (DRAFT). If your observation differs, **yours is the fact** — say so. State plainly that **no PR is open for `build-015/live-acceptance-recovery-2026-08-03`**, and keep the standing warning that **#91 `fix/thin-larry-mcp-grant` must not be merged or rebound blindly.**

**D-G3-10** — Veritas recorded that the `CLAUDE.md` injected into *its* context at session start carried the **superseded** "BOUND" Rule 4 while the identical blob on disk said "UNBOUND". Larry investigated at the start of this session: **the `CLAUDE.md` injected into this fresh main session carries the current "UNBOUND — deliberately, by Warwick" text, matching disk.** So the staleness did not reproduce here. Record this in the directive brief as **evidence, honestly bounded**: one observation in one fresh main session, which does **not** establish that a corrected record always reaches a fresh agent, and specifically does not clear the subagent path where Veritas saw it. **The live-probe criterion stays OPEN.** Do not design a probe — Nolan specifies one if and when Warwick asks.

**D-G3-11** — `2026-08-04-rotation-brief.md` records HEAD as *"see the tip"*, which no longer resolves to the commit it describes. Pin it: that brief is a snapshot of `ecfb04b8b6d5173ffa68b318baf2c3a97c0dd040`, stated as an exact 40-character SHA, and labelled a historical snapshot rather than live state.

**D-G3-08** — record Larry's recommendation in the directive brief's Warwick-decisions list, as one line: Keel's contract enumerates three conditions after *"when all of these hold"* while the fourth ("explicitly authorised") appears only in the lead-in; fold it into the enumerated list at Warwick's next authorised touch of `Team/Keel - Implementation Engineer/AGENTS.md`. **Verify that reading against the contract before writing it.** It is a countable mismatch, not a live routing hazard. **Do not edit that contract.**

**D-G3-09** — record once, plainly: a malformed 32-character `governance_sha` reached a dispatch envelope and did not resolve. The true tip was `565351d5abad48d8cfd969e1616e0b81a827d8d1`. Every SHA in this package was resolved through git. **Resolve every SHA you write. Never reconstruct one.**

## What the rewritten directive brief must contain

- The precedence block, verbatim.
- STARTUP / ORIENTATION — the four things, **copied verbatim in structure** from `Deliverables/2026-08-02-wayfinder-operating-reset-plan.md` per root `CLAUDE.md` §Wayfinder ("It is not to be reworded"). Read that file and match it.
- **One** exact next action, true at this head.
- EXACT STATE — branch, an exact 40-character HEAD resolved by you, upstream, suite counts you re-ran or explicitly labelled as not re-run, the real open-PR list, and the unrelated dirty files to leave alone.
- The Veritas position: Gate 3 **HOLD** on `ecfb04b…`, 11 defects, 5 HIGH; what this package discharges; what remains.
- The D5 eight-class table.
- THE FRONTIER, in Warwick's recorded dependency order: (1) reconcile the remaining D5 documentation classes; (2) author migrations 013 and 014 as repository artefacts under the settled shopping-data classification; (3) migration 015 for execution-packet persistence per Silas's recorded schema decision; (4) verify the producer's actual database role before any live application; (5) wire the execution-packet producer into the real production pipeline — a tested module with no caller is not delivered; (6) prove persistence, read-back and restart/resume against the strongest safe environment available; (7) Keel's delivery half of the Codex closure-enumeration package through the existing Tower routes; (8) the injected end-to-end journey with duplicate, stale-answer, mutation and restart controls; (9) reconcile documentation against the implemented journey; (10) one clean PR with CI evidence bound to the exact head; (11) Codex external QA within the three-pass maximum; (12) Pax's final BUILD-015 acceptance.
- DECISIONS WAITING ON WARWICK — carried forward complete, including the Asdair `AGENTS.md` / `runner.js` live trap with its **DO NOT DISPATCH ASDAIR UNTIL WARWICK HAS RULED** precondition, the Favourites question, the dedupe-guard-in-schema question, and D-G3-08.
- HARD RULES — carried forward complete and unweakened: never auto-substitute, never book a slot, never check out, never pay, never enter the ASDA password, `checked_out` stays false; **Sonnet in Claude for Chrome is the Stage 1 live basket writer**; the CDP `browser-runner` is prohibited from further live-account testing; there is no programmatic Sonnet invocation surface and none may be invented; the two credentials are consumed, never inspected.
- The traps and the WHAT NOT TO DO content, absorbed or pointed to.
- The lesson: **the components were never the problem; the joins were** — with its status correction (`sendQuestionCard` now has a production caller) intact.

## Acceptance criteria

AC1 — `Deliverables/NEXT-ASDAIR-SESSION-brief.md` contains **no struck-through text and no `WITHDRAWN` / `CORRECTED` overlay blocks.** Every sentence in it is a present-tense statement of what is true or what must not be done.

AC2 — Its stated exact next action is genuinely outstanding at this head, verified by you against the repository. It does not name D1, and it does not name any FRONTIER item already complete.

AC3 — The rejected `realInterpretPhoto` / `deps.js` placement for sanitized grounding evidence is recorded as **a placement that must never be implemented**, with the reason (`pipeline/test/harness.js` replaces `deps.interpretPhoto` wholesale, so a caller there is unreachable by every offline test) and the correct placement (`pipeline/runPipeline.js` → `stepInterpret`, calling `store.recordGroundingEvidence`). Verify both against the code before writing them.

AC4 — All four files carry the byte-identical precedence block, and only `NEXT-ASDAIR-SESSION-brief.md` states an exact next action. Prove this with a grep across `Deliverables/`.

AC5 — No surviving "4 HIGH" or "1-of-8" claim in any of the four files. No unqualified "No PR open".

AC6 — Every SHA written into any of the four files is a full 40-character SHA that you resolved through git, and every one of them resolves. No 7-character abbreviation used as an identifier of record, and no reconstructed SHA.

AC7 — Every claim you could not verify offline is **labelled** unverified, not asserted and not silently dropped. Live database state, CI results and anything requiring credentials fall here — `live_authority: none`.

AC8 — Nothing declares any work package, phase, build, service or journey complete, operational, durable, ready, accepted, production-safe or closed. BUILD-015 holds a Veritas HOLD, and Larry has no authority to write closure.

AC9 — **No new mechanism, registry, validator, service, specialist or governance layer is created.** The regrowth cap applies.

AC10 — The two 2026-07-28 documents are changed **only** by the precedence block and their one-line status banner.

## Required evidence

- `git rev-parse HEAD` and `git status --porcelain` at start and at end, pasted.
- `gh pr list --state open` — full output.
- `git log -1 --format=%H%n%s d30beb1` — proof D1 is discharged, plus the `selectProjection()` evidence from `services/asdair/pipeline/test/fakePg.js`.
- The suite counts you assert, with the exact command that produced them — or an explicit statement that you did not re-run them and are labelling them as measured at a named SHA. **Do not quote a count you did not produce or explicitly attribute.**
- A grep proving exactly one directive document across `Deliverables/`, and a grep proving the precedence block appears in all four.
- `git diff --stat` for your four files, and the full `git diff` for the two 2026-07-28 files to prove AC10.
- `bash scripts/secret-scan.sh --surface Deliverables/NEXT-ASDAIR-SESSION-brief.md Deliverables/2026-08-04-rotation-brief.md Deliverables/BUILD-015-STAGE1-continuation-brief.md Deliverables/NEXT-SESSION-MISSION-repo-worktree-hygiene.md` — exit code AND coverage. Exit 2 is NOT SCANNED.

## Explicitly out of scope

- Every file outside `file_surface`. In particular: root `CLAUDE.md` (WO-2026-08-04-02), `.claude/agents/keel.md` (WO-2026-08-04-01), every `AGENTS.md`, everything under `Builds/`, and `Team Knowledge/SOPs/SOP-021-run-the-weekly-asdair-shop.md`.
- **D5 classes 4-8.** Verify and record their status; do not fix them.
- All mutating git operations. Read-only git only. Larry serialises the single writer to this branch.
- Any live database, credential or network action.
- Deleting either 2026-07-28 document. Non-directive is not deleted.
