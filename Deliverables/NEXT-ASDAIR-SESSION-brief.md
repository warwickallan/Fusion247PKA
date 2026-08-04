# Next AsdAIr session — brief

## RESUMPTION PRECEDENCE — recorded 2026-08-04, discharging Veritas `D-G3-07`

**Recorded by `WO-2026-08-04-03`, re-seated by `WO-2026-08-04-04` when this map was added. Exactly
one document may direct the next session. This is the order, and every resumption-shaped document
in `Deliverables/` carries this identical block.**

1. **`Builds/BUILD-015-asdair-durable-household-shopping-steward/`** — the build record is the
   **authority for every BUILD-015 fact, and it is not a route.** A document that disagrees with it
   is wrong.
2. **`Deliverables/2026-08-04-build-015-asdair-wayfinder-plan.md`** — **THE Wayfinder map. The sole
   route, and the only document that may state the exact next action.**
3. **`Deliverables/NEXT-ASDAIR-SESSION-brief.md`** — **NON-DIRECTIVE.** Operational hazards and
   code-level do-not-rebuild warnings the map points at. It states no next action.
4. **`Deliverables/2026-08-04-rotation-brief.md`** — **NON-DIRECTIVE.** A dated snapshot of the
   2026-08-04 rotation, kept for its record of what changed and the traps it names. It states no
   next action.
5. **`Deliverables/BUILD-015-STAGE1-continuation-brief.md`** — **NON-DIRECTIVE. Superseded
   2026-07-28 snapshot**, kept as a historical record only.
6. **`Deliverables/NEXT-SESSION-MISSION-repo-worktree-hygiene.md`** — **NOT a BUILD-015 resumption
   document.** A standing repository-hygiene mission; it never directs BUILD-015 work.

**This block is deliberately duplicated byte-identically across all five documents, as a recorded
exception to the SSOT Golden Rule** (root `AGENTS.md` §1), because a fresh instance may open any one
of them first and must learn from that one which document it is allowed to act on.

**The Honcho continuity brief is a POINTER, never the authority** (root `CLAUDE.md` Step 2).
**Verify by execution, not belief.**

---

> ## THIS DOCUMENT IS NON-DIRECTIVE. IT STATES NO NEXT ACTION.
>
> It carries the **operational hazards, the hard rules and the code-level do-not-rebuild warnings**
> for BUILD-015 — the things that will cost you a night if you touch `services/asdair/**` without
> them. **It does not carry the route.** The current phase, gate, state and the single exact next
> action are in `Deliverables/2026-08-04-build-015-asdair-wayfinder-plan.md`, the Wayfinder map,
> which is the only document permitted to state one.
>
> **Read this before you touch the code. Do not resume from it.**

## THE VERITAS POSITION

**The gate verdict and the head it was returned against are recorded once, in the Wayfinder map.
This section carries the finding-level accounting, which is not repeated there.**
**The receipts are the register of findings; there is no findings ledger and none is to be built.**
**Documentation truth is the dimension that has FAILED, twice.** Read the receipts before forming
any view of BUILD-015's state.

> **TWO Gate 3 rounds have now been returned, both HOLD. Enumerate
> `Builds/BUILD-015-asdair-durable-household-shopping-steward/Assurance/` rather than trusting this
> section to be current.**
>
> | Round | Head reviewed | Verdict | Findings |
> |---|---|---|---|
> | 1 | `ecfb04b8b6d5173ffa68b318baf2c3a97c0dd040` | **HOLD** | 11 defects, **5 HIGH** — `D-G3-01`…`-11` |
> | 2 | `d63668f653e233a22b5a28b6eb60f5fb84ecce48` | **HOLD** | 9 defects, **3 HIGH** — `D-G3-12`…`-20`. **This is the live HOLD.** |
>
> Round 1 receipt: `…/Assurance/veritas-gate3-governance-ecfb04b.md`.
> Round 2 receipt: `…/Assurance/veritas-gate3-documentation-d63668f.md`.
> **The accounting below is round 1's.** Round 2's findings are dispositioned in
> `WO-2026-08-04-05`; `D-G3-12`, `D-G3-13` and `D-G3-14` are its HIGH findings, and all three are
> Larry's, two of them recurrences of failures this package itself documents.

**Of round 1's 11 defects, the HIGH findings are `D-G3-01`, `D-G3-02`, `D-G3-03`, `D-G3-04` and
`D-G3-05` — five, not four.** `D-G3-06` and `D-G3-07` are MEDIUM; `D-G3-08` through `D-G3-11` are
LOW.

**Three of the five HIGH findings fell outside the scope Larry dispatched.** The dispatched scope
was `7f83d4c2657b757b4aa8cbceb3274f15e0158fff`'s five files plus
`ecfb04b8b6d5173ffa68b318baf2c3a97c0dd040`'s rotation brief. `D-G3-01`
(`NEXT-ASDAIR-SESSION-brief.md`), `D-G3-03` (`.claude/agents/keel.md`) and `D-G3-04` (root
`CLAUDE.md`) all landed outside it; `D-G3-02` and `D-G3-05` landed on documents that were inside it.

**Commit `7ca8c3b58523758010d83855177f29175f32f283`'s message says "4 HIGH". It is wrong, and it
cannot be corrected** — a commit message is immutable history and is not an active document.
Recorded here once so the next reader who finds it is not misled.

### What this corrective package addresses, and what it does not

| Finding | Disposition |
|---|---|
| `D-G3-01` | Addressed here — this brief rewritten as one clean current document. |
| `D-G3-02` | Addressed here — D5 recorded as `0-of-8` at the reviewed head, with the per-class table below. |
| `D-G3-03` | Separate work order (`.claude/agents/keel.md`). Not this document's surface. |
| `D-G3-04` | Separate work order (root `CLAUDE.md`). Not this document's surface. |
| `D-G3-05` | Addressed here — the rotation brief's false *"both are now fixed"* rewritten clean. |
| `D-G3-06` | Addressed here — the real open-PR list, enumerated above. |
| `D-G3-07` | Addressed here — the precedence block, in all four resumption documents. |
| `D-G3-08` | **Warwick's decision.** See DECISIONS WAITING ON WARWICK, item 4. |
| `D-G3-09` | Recorded below. No repository artefact to change. |
| `D-G3-10` | Recorded below with its evidence, honestly bounded. The live-probe criterion stays OPEN. |
| `D-G3-11` | Addressed here — the rotation brief pinned to an exact 40-character SHA. |

**`D-G3-09` — resolve every SHA; never reconstruct one.** A malformed 32-character `governance_sha`
reached a dispatch envelope and did not resolve. The true tip was
`565351d5abad48d8cfd969e1616e0b81a827d8d1`. Every SHA written into this brief was resolved through
`git rev-parse`.

**`D-G3-10` — a corrected record does not automatically reach a fresh agent, and the probe for it
does not exist.** Veritas recorded that the `CLAUDE.md` injected into *its* context at session start
carried the superseded "BOUND" Rule 4 while the identical blob on disk said "UNBOUND". Larry
re-checked at the start of the following session: **the `CLAUDE.md` injected into that fresh main
session carried the current "UNBOUND — deliberately, by Warwick" text, matching disk.** The
staleness did not reproduce there. **That is one observation in one fresh main session. It does not
establish that a corrected record always reaches a fresh agent, and it says nothing at all about the
subagent path, which is where Veritas saw the fault.** **The live-probe criterion is OPEN.** Do not
record it as solved, and **do not design a probe** — Nolan specifies one if and when Warwick asks.

---

## D5 — the eight documentation classes, verified at this head

Veritas's earlier receipt
(`Builds/BUILD-015-asdair-durable-household-shopping-steward/Assurance/veritas-wp-red-suite-recovery-0f8a1bc.md`,
§"What his list missed") enumerates eight classes of stale active documentation.

**At the Gate 3 reviewed head `ecfb04b8b6d5173ffa68b318baf2c3a97c0dd040` the count was `0-of-8`
discharged.** That is the figure Veritas established and Warwick confirmed. An earlier claim of
`1-of-8` was wrong: this brief was reconciled at `be6d1a5296de6a32b92495ba430ba2e8cff592e4` and then
went stale again at `d30beb1cf4a807d4232d3a1ebc51c60784883f0c`, which fixed D1 without carrying the
brief forward.

**`0-of-8` is the figure AT THAT HEAD and is not the current position — do not quote it as one.**
Work has landed since, at `d63668f` and after. **No replacement count is asserted here**, because
none has been established by a receipt: the second Gate 3 receipt
(`…/Assurance/veritas-gate3-documentation-d63668f.md`) did not re-derive it. For the current
position read the per-class table below and the Wayfinder map's phase 1, which records classes 4–8
as the outstanding set.

**Status vocabulary.** `STALE — CONFIRMED PRESENT` means the wrong text is in the file today.
`NO LONGER TRUE` means the claim is contradicted by code at this head. `UNVERIFIABLE OFFLINE` means
it needs the live database.

> **On this table's pin (Veritas `D-G3-19`).** The Status column below was assessed at
> `cd51ac066895985463e88d3933de4e0c1db7c0db`, and rows reading *"ADDRESSED IN THIS REWRITE"* refer
> to a rewrite that first exists at `d63668f653e233a22b5a28b6eb60f5fb84ecce48`, the child of that
> head. **The pin is deliberately left at the head the assessment was made against, and annotated
> here rather than advanced** — re-pinning it to a newer head would only recreate the same drift one
> commit later, and would misstate when the work was actually checked. **Read the pin as "assessed
> at", never as "current at".** The `services/**` tree is object-identical across `cd51ac0`,
> `d63668f` and the head carrying this line, so nothing in the Evidence column turns on the
> difference.

| # | File | The stale claim | Status assessed at `cd51ac066895985463e88d3933de4e0c1db7c0db` | Evidence |
|---|---|---|---|---|
| 1 | `Deliverables/NEXT-ASDAIR-SESSION-brief.md` | Instructs the **rejected** `deps.js` / `realInterpretPhoto` placement for sanitized grounding evidence | **ADDRESSED IN THIS REWRITE** | The instruction is gone. The placement is now recorded below as one that must never be implemented, with the reason and the correct placement. |
| 2 | Same file | Stale HEAD, stale suite table, frontier items 1 and 2 described as outstanding when complete | **ADDRESSED, THEN SUPERSEDED** | Fixed in the 2026-08-04 rewrite (HEAD resolved by `git rev-parse`, suites re-run in all fourteen directories, completed items removed rather than struck). This class can no longer recur here: state and route left this file entirely for the Wayfinder map. |
| 3 | Same file | Instructs adding `priorAnswers` to `realLoadPlanningInputs`, already present | **ADDRESSED IN THIS REWRITE** | The instruction is gone. `pipeline/deps.js:255` calls `skill.loadRuleQaLog(householdId)`; `skill/planner.js:1462` reads `args.priorAnswers`, acted on at `:1704` and `:1708`. |
| 4 | `Builds/BUILD-015-.../DEFECT-LEDGER.md:152-156` | `D-2026-08-03-15` *"Alias matching is exact-string … Status: OPEN — unfixed"* | **STALE — CONFIRMED PRESENT.** The claim is `NO LONGER TRUE`. | `skill/termMatch.js` is required at `skill/planner.js:41` and at `interpret/resolveByCatalogue.js:23`; `termMatch` appears on 14 lines of `planner.js`. Matching is tolerant, not exact-string. |
| 5 | `Builds/BUILD-015-.../END-TO-END-PROCESS-AUDIT.md:36`, `:245`, `:262` | *"`rule_qa_log` is **never read by the planner at all**"* (`:36`, `:245`); `:262` lists WO-Y as **OPEN, HIGH** | **STALE — CONFIRMED PRESENT.** Both claims are `NO LONGER TRUE`. | `pipeline/deps.js:255` loads it into `realLoadPlanningInputs` as `priorAnswers`; `skill/planner.js:1462` reads it; `priorAnswersForLine` / `pointerAnswersForLine` act on it at `:1704` / `:1708`. `:455` repeats the same claim inside the WO-Y write-up. |
| 6 | `Team Knowledge/SOPs/SOP-021-run-the-weekly-asdair-shop.md:407` | *"Alias matching is exact-string"* — an **active operational SOP** | **STALE — CONFIRMED PRESENT.** `NO LONGER TRUE`, same evidence as row 4. | As row 4. This one is outside `Builds/` and is the SOP an operator follows. |
| 7 | `Builds/BUILD-015-.../ACTIVATION-DEFERRED.md:74` | The same stale exact-string claim | **STALE — CONFIRMED PRESENT.** `NO LONGER TRUE`, same evidence as row 4. | As row 4. |
| 8 | `Builds/BUILD-015-.../CANONICAL-WEEKLY-SHOP-PROCESS.md:215-225` | Row **G**'s stated reason is stale; rows **B**, **C**, **D**, **E** read NO / NOT IMPLEMENTED / does not exist beside working, tested code | **STALE — CONFIRMED PRESENT.** Per row, below. | See the row-by-row note beneath this table. |

**Classes 4-8 are not fixed here, deliberately.** Warwick sequenced their reconciliation into
**phase 1 of the Wayfinder map**, after a Gate 3 PASS. This package verified and recorded their status; it did not change
them. **Count at this head: classes 1-3 addressed in this rewrite; classes 4-8 confirmed still
stale.** Whether classes 1-3 are genuinely discharged is Veritas's to determine at Gate 3, not
Larry's to declare.

**Class 8, row by row, verified at this head:**

- **Row B** *"sanitized evidence of what was supplied to the model — **NO.** Not implemented."* —
  `NO LONGER TRUE`. `pipeline/runPipeline.js:228` calls `store.recordGroundingEvidence` from
  `stepInterpret`.
- **Row B** *"exactly one interpretation entry point — **NO.**"* — **still accurate.**
  `interpret/interpret-list.js` and the pipeline path both exist. Do not "correct" this row.
- **Row C** *"order/spelling-tolerant matching — **NO.** Exact-string."* — `NO LONGER TRUE`, same
  evidence as table row 4.
- **Row D** *"previous decisions consulted before asking — **NO — demonstrably broken.**"* — `NO
  LONGER TRUE` **of the code path**; `priorAnswers` is loaded and genuinely consumed. **Whether the
  live shop now behaves correctly is `UNVERIFIABLE OFFLINE`** and must not be asserted from the code
  alone.
- **Row E** *"deterministic Brand A–Z execution packet — **NO.** Does not exist."* — **half wrong,
  and the correction must not overshoot.** The **producer** exists: `packet/buildExecutionPacket.js`
  builds the Brand A–Z ordering (`:30`, `:464`) with 104 passing tests. **Persistence does not
  exist, and the packet has no production caller** — the only references outside `packet/` are
  comments and a cross-module test pin in `handoff/`. Writing "row E is simply false" would create
  the opposite error.
- **Row G** *"reconciliation against expected counts — **PARTIAL.** expected-count inputs do not
  [exist]."* — the **reason** is `NO LONGER TRUE`. `reconcile/verifyBasket.js` reads `expected` from
  the Sonnet execution packet, documented in its own header at `:10`.

---

## DECISIONS WAITING ON WARWICK — do not act alone

**None of these is to be acted on. Each states the decision and the recommendation; the ruling is
his.**

1. **`Team/Asdair - Household Shopping Steward/AGENTS.md` still says Asdair runs `runner.js`
   itself**, which `RUNTIME-DECISION.md` supersedes and which is prohibited from live-account
   testing. **A dispatched Asdair reads its own contract first, and that contract outranks this
   brief.** The prohibited action is a **live ASDA account** action, so the cost of losing the race
   is not a red test.

   > **DO NOT DISPATCH ASDAIR UNTIL WARWICK HAS RULED.**

   Three agents have now reported this independently; a fourth changes nothing. **The remedy is
   Warwick's ruling, not an edit** — no agent may touch any `AGENTS.md`. Replacement text was
   drafted 2026-08-04. *Recommendation: rule on the replacement text, then dispatch.*
2. **Should Favourites be a real second ASDA view at all?** `asdair.regulars` holds one distinct
   `source` value — `regular`. No `'favourite'` row has ever existed, so `source_view: "favourites"`
   is a forward contract describing nothing live. *(Row counts are `UNVERIFIABLE OFFLINE`.)*
   *Recommendation: his call on product intent; no safe default exists.*
3. **Should the dedupe guard live in the schema rather than in one writer?** `updateRegulars`
   protects only what goes through `updateRegulars`; a hand-written INSERT walked past it. Silas's
   design call, Warwick's authorisation.
4. **`D-G3-08` — Keel's contract enumerates three conditions after *"when all of these hold"*, while
   the fourth ("explicitly authorised") appears only in the lead-in.** Verified against
   `Team/Keel - Implementation Engineer/AGENTS.md:436-441`. It is a countable mismatch, not a live
   routing hazard. *Recommendation: fold the fourth condition into the enumerated list at Warwick's
   next authorised touch of that contract.* **Do not edit that contract.**
5. **Root `CLAUDE.md:90` will, after correction, state *"Larry … performs no mutation himself"* as a
   free-standing absolute**, which fights root `AGENTS.md` §3's carve-out that Larry retains
   authority to act personally on integration, merges and git surgery. Today the conflict is masked
   because `:90` reads as a consequence of incapacity. `CLAUDE.md` §"Source of truth" makes this a
   defect to raise, never a tie to resolve in the moment. *Recommendation: Warwick rules which
   governs; the strict-minimum correction was taken so this stays his call.*
6. **Nothing in the estate obliges anyone to re-reconcile a host shim under `.claude/agents/` when
   its wiki contract changes** — which is exactly how `D-G3-03` happened. Closing it needs an
   `AGENTS.md` edit, reserved to Warwick. *Recommendation: fold the obligation into the
   contract-change procedure at his next authorised touch.* **No mechanism is to be built for this
   — the regrowth cap applies.**
7. **`.claude/agents/nolan.md:4` requests `MultiEdit`, which this host does not deliver** —
   re-confirmed live 2026-08-04. Same defect class as the note frozen at `.claude/agents/keel.md:4-9`.
   *Recommendation: park; correct at the next authorised touch of that shim. A shim must not claim
   tools it does not get.*

---

## HARD RULES — never negotiable

Never auto-substitute · never book a slot · never check out · never pay · never enter the ASDA
password · `checked_out` stays false. **Warwick is the gate for every consequential action.**

**Sonnet in Claude for Chrome is the Stage 1 live basket writer** — not Larry, not a Claude Code
subagent, not the CDP runner at `services/asdair/browser-runner/`. That runner is experimental,
deferred, and **prohibited from further live-account testing without fresh authority.** Canonical:
`RUNTIME-DECISION.md`, `CANONICAL-WEEKLY-SHOP-PROCESS.md`.

**There is no programmatic Sonnet invocation surface. None was invented and none may be.** The
prohibitions in the handoff are **instructions, not enforcement** — the CDP runner blocked checkout
and substitution in three code layers; Sonnet in Chrome has none. That is a real reduction in
mechanical guarantee, and it is why the live pass is supervised and stops at checkout-ready.

Shopping content is **not** a privacy matter (Warwick, 2026-07-27) — report baskets plainly, and
that includes the migrations encoding them. Only **secrets** stay out of the repo. Two credentials
exist: `ASDAIR_DB_URL` (`asdair_ro`, SELECT-only) and `ASDAIR_WRITE_DB_URL` (`asdair_rw`, narrow
write), both in `C:/.fusion247/asdair.env`. **Consume the environment, never inspect it.**

---

## WHAT NOT TO DO

- **Do not implement sanitized grounding evidence at `realInterpretPhoto` in
  `pipeline/deps.js`. That placement is rejected and must never be built.** The reason:
  `pipeline/test/harness.js:146` replaces `deps.interpretPhoto` **wholesale**, so a caller sitting
  inside the real `realInterpretPhoto` is unreachable by every offline test in this repository. The
  correct placement, which is the one in the code today, is `pipeline/runPipeline.js` →
  `stepInterpret` → `store.recordGroundingEvidence` (`:228`), called **after** the model returns and
  deriving its counts from `readings.length` so a skipped call cannot forge it. The string
  `recordGroundingEvidence` does not appear in `deps.js` at any commit. **Counts and ids only** —
  never product names, list content, prompt text or the photograph.
- **Do not build a new mechanism** in response to anything in this file. No new specialist, service,
  registry, validator, state machine or control plane. BUILD-018 is the cautionary tale and the
  regrowth cap is real.
- **Do not declare anything complete.** That authority does not exist without a Veritas PASS. Until
  one exists, the maximum permitted statement is *«Integrated at "\<SHA>" and submitted to Veritas
  for assurance.»*
- **Do not distil a Veritas receipt into a Work Order.** Cite the receipt path, the `reviewed_sha`
  and **every** finding ID with an explicit disposition. Findings were lost doing exactly this,
  twice.
- **Do not trust a green test you have not tried to break.** Four separate builders found tests of
  their own passing for the wrong reason — a fixture short-circuiting the path under test, a
  scenario that could not occur, an `if (verdict.valid)` wrapper asserting nothing, and a sort
  comparator no test could distinguish from locale collation.
- **Do not treat two modules that describe each other correctly as a working seam.** Three seam
  defects were found by execution on 2026-08-03; every one sat between modules that individually
  passed everything they had.
- **Do not quote a suite count out of this file.** Re-run them. These counts were **measured at**
  `cd51ac066895985463e88d3933de4e0c1db7c0db` and are deliberately left pinned there rather than
  advanced to a newer head — the pin records **when the suites were actually executed**, which is
  the only thing it can honestly assert. Advancing it would claim a run that did not happen at the
  newer head. They will go stale; re-run them.
- **Do not preflight a Work Order only against reality — preflight it against the SIBLING orders.**
  One file was granted to two agents on 2026-08-04. Nothing collided, but only by luck.
- **Do not widen "private" to mean "anything concerning a household."** GL-009 carries Warwick's
  classification; ordinary shopping content is explicitly public. He has ruled this twice and asked
  not to be asked again.
- **Do not run `proof/run-proofs.mjs` expecting the old behaviour.** PROOF 10 fails the run if any
  proof resolves a path under `C:\.fusion247\`. That guard is the point — the harness was reading
  and printing real household state while its own header claimed otherwise. The file is at
  **`services/asdair/pipeline-runtime/proof/run-proofs.mjs`**; there is no `services/asdair/proof/`
  directory.

**The traps recorded at the 2026-08-04 rotation are held in
`Deliverables/2026-08-04-rotation-brief.md` §"TRAPS THAT COST REAL TIME TONIGHT" and §"WHAT NOT TO
DO".** That document is non-directive, but those two sections are still worth reading before
touching CRLF files, `.git/index.lock`, or a test fake that vouches for itself.

---

## THE ONE THING WORTH REMEMBERING

Every module in this build was individually complete, individually tested, and reachable from
nothing. `sendQuestionCard` had a full renderer, a full suite, and no production caller — which is
why Warwick spent 2026-08-03 answering questions by hand. Five separate builders reported "zero
production callers" about their own work in a single night.

**The components were never the problem. The joins were.**

That is history, and it is accurate as history. `sendQuestionCard` **now has a production caller**,
bound in `pipeline/runtime.js` and invoked from the outbox drain in the same file — stated so a
fresh reader does not take the lesson for a present-tense defect and go looking for a hole that was
filled.

**The lesson generalises, and the second half of it is the live one: a join is only proven when
deleting it turns the suite RED.** The four integration joins clear that bar under Veritas's own
deletion tests. The `listQuestions` column projection now clears it too — `selectProjection()` at
`pipeline/test/fakePg.js:105` derives the projection from the statement text rather than a
hard-coded literal, and reinstating the old defect produces 17 failures. **The remaining exposure is
the execution packet has no caller to delete — phase 2 of the Wayfinder map.**
