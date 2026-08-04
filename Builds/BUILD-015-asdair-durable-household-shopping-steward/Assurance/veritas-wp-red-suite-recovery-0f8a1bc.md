---
build: BUILD-015
scope: WP-red-suite-recovery
gate: 1
reviewed_sha: 0f8a1bcd715ac04833534bf014a15563f3df9dff
branch: build-015/live-acceptance-recovery-2026-08-03
verdict: HOLD
reviewed_by: veritas
reviewed_date: 2026-08-04
next_review_trigger: Resubmission of a new exact integrated head after corrective work on D1 (fakePg column projection) and D5 (documentation contradictions)
---

## Scope reviewed

The integrated head `0f8a1bc` only — six files: `pipeline/runPipeline.js`, `pipeline/runPipeline.test.js`,
`pipeline/test/fakePg.js`, `pipeline/test/harness.js`, `skill/planner.test.js`, `skill/ruleConsumption.test.js`.

Measured against the accepted outcome: recover both banked red suites by finishing the interrupted
transactions **without weakening, deleting, skipping or relaxing any acceptance test**, and give four
integration joins real production callers.

**Deliberately out of scope:** the governance commit `66d40d3` (Veritas's own hire — not Veritas's to
assure); the dirty working tree (Silas's uncommitted GL-009 and `db/*.sql` work, `services/hub/**`,
untracked drafts) — none of it is at this head; Codex's PR/release gate; Pax's final BUILD-015 acceptance.

**Method note.** All evidence was executed against a pristine `git archive` export of `0f8a1bc` in the
session scratchpad, with `node_modules` copied in. **The repository working tree was never modified.**
`git status` and `HEAD` at end of review are byte-identical to session start. Every mutation was applied
to the scratchpad copy and reverted with a SHA-256 match recorded.

## Evidence executed or inspected

| Command or artefact | Exit | Executed subtests | Result |
|---|---|---|---|
| `node --test` in `pipeline` @ `0f8a1bc` | 0 | 185 | 185 pass / 0 fail / 0 skip |
| `node --test` in `skill` @ `0f8a1bc` | 0 | 281 | 279 pass / 0 fail / **2 skip** |
| `node --test` × 14 suites @ `0f8a1bc` | 0 (all) | 1602 | **1599 pass / 0 fail / 3 skip** |
| `node --test` in `pipeline` @ `94978d2` | 1 | 181 | 173 pass / **8 fail** |
| `node --test` in `pipeline` @ `943a262` | 0 | 162 | 162 pass / 0 fail |
| `node --test` in `skill` @ `c15c627` | 1 | 280 | 275 pass / **3 fail** / 2 skip |
| MUT-1 delete `priorAnswers: inputs.priorAnswers` | 1 | 185 | **RED ×1** — JOIN 1. Restored, SHA `32a905a3…` |
| MUT-2 delete `store.recordGroundingEvidence(…)` | 1 | 185 | **RED ×1** — JOIN 2. Restored, SHA `32a905a3…` |
| MUT-3 delete `list_item_id:` carrier | 1 | 185 | **RED ×2** — JOIN 3 **and** JOIN 4. Restored, SHA `32a905a3…` |
| MUT-4 revert `REPLAN` to inline transition | 1 | 185 | **RED ×1** — JOIN 4. Restored, SHA `32a905a3…` |
| MUT-5 drop `sl.raw_reading AS photographed_wording` from real SELECT | **0** | 185 | **GREEN — DEFECT D1.** Restored, SHA `1e26dc63…` |
| MUT-7 drop `q.answer_text, q.answer_source` from real SELECT | **0** | 185 | **GREEN — DEFECT D1.** Restored, SHA `1e26dc63…` |
| Revert `test/fakePg.js` to `c15c627` | 1 | 185 | RED ×11 — reproduces the same 8 runtime failures. Restored, SHA `2b5da57b…` |

**Evidence unavailable, declared by name:** Postgres (no instance, no credentials, `live_authority: none`);
network; model gateway. `LEFT JOIN` semantics, the `rule_qa_log` INSERT and all durability run against
`fakePg`. **Kill-and-revive against a real process and a real database was not possible and was not performed.**

## Assurance dimensions

| Dimension | Verdict | Basis |
|---|---|---|
| Goal fidelity | **PASS** | Both suites recovered. No assertion property was lost: every property asserted before is still asserted (verified line-by-line on all three corrected tests). The corrections **strengthen** — the banned `requested_qty === 5` is replaced by `needs_decision`, `planned_qty 0`, `notEqual 5`, and a note carrying **both** written numbers. |
| Design fidelity | **PASS** | Placing the grounding record in `stepInterpret` rather than `deps.js` is correct and independently confirmed: `harness.js:146` replaces `deps.interpretPhoto` wholesale, so a caller at the original site is unreachable by any offline test. `applies_going_forward` is an explicit literal `false`, deferring to `deps.js`'s provenance note rather than amending it. |
| Functional proof | **PASS** *(offline scope)* | 1,599 passing / 0 failing reproduced independently across all 14 suites; every per-suite number in the commit message matches exactly. |
| Integration | **PASS** | Tests drive the real `runPipeline(HANDLE, deps)` entry point, not step functions. Production deps genuinely supply the seams: `deps.js:249-257` returns `priorAnswers` from `skill.loadRuleQaLog`; `deps.js:395` binds `recordAnswerLearning`. `planner.js` genuinely **consumes** `priorAnswers` (11 sites; flag raised at `planner.js:1710`), so this is a consumed input and not a stored-but-filtered one. |
| Durability | **HOLD** | "Restart" in the RESUMABILITY tests is a **new deps object over the same in-memory JS object graph** — not process death, not Postgres. Rows described as "durable" (`list_item_id`, `rule_qa_log`, grounding evidence) are evidenced only against a fake. Kill-and-revive unavailable at this head. |
| Test quality | **HOLD** | Four callers proven load-bearing by **my own** deletion tests, matching the claimed RED sets exactly. But **D1**: the fake cannot detect a dropped SELECT column, and its own comment claims it can. |
| Git truth | **HOLD** | The `94978d2` false-claim correction is **verified correct** (see below). Three claims **in this commit message** are wrong — D2, D3, D4. |
| Documentation truth | **FAIL** | **Zero documents changed at this head**, while the commit corrects a false claim and moves four capability statuses. Active documents would misdirect a fresh instance — including one that instructs the exact placement this head rejected. |
| Residual risk | **PASS** | The "NOT PROVEN, AND NOT CLAIMED" section is accurate on every point I tested: `packet/` persists nothing, no `execution_packet` table exists in `db/`, and `buildExecutionPacket` has no production caller outside `packet/`. |

## Production caller and journey

Traced hop by hop, all four confirmed **on** the production journey and load-bearing by deletion:

1. **Prior answers → planner.** `runPipeline` → `dispatchStep` → `stepPlan` → `deps.loadPlanningInputs`
   (prod: `realLoadPlanningInputs` → `skill.loadRuleQaLog(householdId)`) → `deps.planBasket({priorAnswers})`
   → `planner.js` `priorAnswersForLine()` → flag `prior decision on record`. Deleting the hand-off reddens JOIN 1.
2. **Grounding evidence.** `runPipeline` → `stepInterpret` → `store.recordGroundingEvidence` →
   `asdair.pipeline_command`. Written *after* the model returns, from `readings.length`, so a skipped
   call cannot forge it. Sanitization asserted by leak-scan over the serialised row. Deleting it reddens JOIN 2.
3. **`list_item_id` carrier.** `stepPlan` → `listItemIdByTerm` (built from `listItems`, **not** `plan.items`)
   → `deps.shopStore.openQuestion({list_item_id})` → `store.listQuestions` LEFT JOINs → card `Item:`.
   Deleting it reddens JOIN 3 **and** JOIN 4.
4. **Answer-learning write-back.** `runPipeline` → `stepReplan` → `store.claimAnswerLearning` (one-shot ledger)
   → `deps.recordAnswerLearning` (prod: `outcome/recordAnswerLearning.js` → `promoteDecision`) →
   `asdair.rule_qa_log`. Confirmed at `promoteDecision.js:496-498` that the log INSERT is **unconditional and
   outside** the `if (rule)` guard at `:501` — Larry's claim holds. Reverting `REPLAN` reddens JOIN 4.

The harness runs the **real** `recordAnswerLearning`/`promoteDecision` on the fake client, not a stub — a
genuine strengthening.

**Not on the journey, correctly declared:** `packet/buildExecutionPacket.js` — reachable only from its own tests.

## Restart and durability

**Not proven.** The RESUMABILITY tests construct `makeHarness({seed: h.db})` — a fresh dependency container
over the **same in-memory object graph**. This proves no state is carried in the deps container. It does
**not** prove state survives process death, and no row was ever written to Postgres. Kill-and-revive was
impossible at this head (no database, no credentials, no live authority) and is declared unavailable rather
than treated as passed.

## Documentation contradiction scan

**Larry's declared DOCUMENT IMPACT:** `NEXT-ASDAIR-SESSION-brief.md` (4 counts); `CANONICAL-WEEKLY-SHOP-PROCESS.md`
status table (1 confident + 3 suspected); `DEFECT-LEDGER.md` and `END-TO-END-PROCESS-AUDIT.md` marked unassessed.

**Verified independently — what held.** All four of his brief counts are correct. All four suspected status
rows are indeed false. His correction of `94978d2` is correct. He was right that the `identityKey` drift is
closed (`handoff/buildHandoff.js:98-100` now mirrors the packet's NFKC `normalizeSortKey`).

**What his list missed:**

1. **`Deliverables/NEXT-ASDAIR-SESSION-brief.md:66-69` instructs placing sanitized grounding evidence at
   `realInterpretPhoto` (`deps.js:157-181`) — the exact placement this head deliberately rejected as
   unreachable-by-any-test.** A fresh Larry following the brief would re-introduce this build's signature
   defect. **Highest-severity documentation finding; not on his list.**
2. Same brief: `HEAD 94978d2` and the `RED pipeline 173/8 · skill 275/3` suite table are stale (now green);
   **FRONTIER items 1 and 2 are complete** — the brief calls item 1 "unambiguous" next action.
3. Same brief `:62-64`: instructs adding `priorAnswers` to `realLoadPlanningInputs` — **already present at
   `c15c627`.** The brief was stale at its own commit.
4. **`DEFECT-LEDGER.md` D-2026-08-03-15** — "Alias matching is exact-string … **Status: OPEN — unfixed**".
   Stale: `termMatch.js` is wired into `planner.js` at 11 call sites. (File was unassessed.)
5. **`END-TO-END-PROCESS-AUDIT.md:36` and `:455`** — "`rule_qa_log` is **never read by the planner at all**";
   `:262` lists WO-Y as **OPEN, HIGH**. Both now false. (File was unassessed.)
6. **`Team Knowledge/SOPs/SOP-021-run-the-weekly-asdair-shop.md:407`** — "Alias matching is exact-string".
   An **active operational SOP outside `Builds/`**; his list did not extend beyond `Builds/` and `Deliverables/`.
7. `ACTIVATION-DEFERRED.md:74` — same stale exact-string claim.
8. `CANONICAL-WEEKLY-SHOP-PROCESS.md` row **G** — the stated reason "expected-count inputs do not [exist]" is
   stale; `reconcile/verifyBasket.js` consumes `expected` from the packet.

**Active documents that would misdirect a fresh instance:** items 1, 2, 3, 4, 5, 6, 7 above, plus
`CANONICAL-WEEKLY-SHOP-PROCESS.md` rows B, C, D, E which read **NO / NOT IMPLEMENTED / does not exist**
beside working, tested code. **Pax is BUILD-015's final acceptance gate and reads these as the specification
— they would produce a false NO.**

## Defects

| # | Severity | Finding | Owner |
|---|---|---|---|
| D1 | **HIGH** | `test/fakePg.js` `QUESTION_COLUMNS` is a **hard-coded literal**, not derived from the SQL. Dropping `q.answer_text` + `q.answer_source` from `store.listQuestions`' real SELECT leaves the suite **green at 185/0** (MUT-7); dropping `sl.raw_reading AS photographed_wording` leaves it green even though the resulting SQL is **syntactically invalid** (MUT-5). The file's own comment claims the opposite: *"The projection is EXPLICIT and lists only the columns the statement SELECTs … a fake that hands back every column regardless could never fail when one is dropped again."* **The stated protection does not exist, and the defect class this query was rewritten to fix remains undetectable.** | Larry to dispatch |
| D2 | LOW | Commit message: *"the two suites gained 12 tests between them."* Actual gain is **5** (pipeline 181→185, skill 280→281). 12 is the pipeline's *passing-count* delta alone. | Larry |
| D3 | LOW | Commit message: skill *"+7 assertions."* Actual **+5** (`planner.test.js` +3, `ruleConsumption.test.js` +2). | Larry |
| D4 | LOW | Commit message: grounding evidence *"moved from deps.js realInterpretPhoto."* Nothing was moved — `recordGroundingEvidence` never appears in `deps.js` at any commit. It was newly **placed** in `stepInterpret`. The engineering argument is sound; the word describes a diff that does not exist. | Larry |
| D5 | **HIGH** | Eight classes of stale active documentation (see scan above), including a brief that instructs the rejected `deps.js` placement, an active SOP outside `Builds/`, and four status rows reading NOT IMPLEMENTED beside working code. **Zero documents were changed at this head.** | Larry to dispatch |
| D6 | MEDIUM | Durability is claimed in prose ("durable" carrier, "durable rule_qa_log row") but evidenced only by an in-memory fake and a same-graph deps swap. No process death, no Postgres. | Larry / Pax scope |
| D7 | LOW | The commit reports "1599 passing" without noting **3 skipped** tests (2 skill, 1 outcome), one of which is the destructive Postgres integration test. True as stated, incomplete as a tree-state summary. | Larry |

## Verdict

**HOLD** — the implementation is sound and the four production callers are genuinely load-bearing under my
own deletion tests, but a documented test protection does not exist (D1) and active documents would send a
fresh instance down a superseded route (D5), which my contract forbids passing.

**Credit where it is due, verified independently:** the correction of `94978d2`'s false "181/181" claim is
**correct**. At `943a262` the pipeline suite held 162 tests, all passing; at `94978d2` it held 181 with the
8 failures; and none of the 8 test names existed before `94978d2`. They were created by that commit and had
never passed. Reverting `test/fakePg.js` alone reproduces exactly those 8, confirming the stated root cause.
The `skill` corrections strengthen acceptance and do not weaken it. This is not a false completion claim, and
the commit's own "NOT PROVEN, AND NOT CLAIMED" section is accurate on every point tested — which is why this
is a HOLD and not a FAIL.

## Next review trigger

Resubmission of a **new exact integrated head** after corrective work on **D1** and **D5**. D2–D4, D6 and D7
are recorded for disposition and do not by themselves require a new head.
