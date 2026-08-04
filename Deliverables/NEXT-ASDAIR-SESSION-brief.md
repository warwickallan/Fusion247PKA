# Next AsdAIr session — brief

**REWRITTEN 2026-08-04 at rotation, by the Larry who did the work.** Supersedes every earlier
version of this file — in particular the one that opened *"Do the shop first. It works."*
It did not work, and that sentence cost Warwick a night.

> **CORRECTED 2026-08-04 (WO-ZN, discharging Veritas D5 at `0f8a1bc`).** The rotation rewrite above
> was itself stale in eight places, including one instruction that would have rebuilt a rejected
> design. Every correction in this file is marked with a dated note like this one, names the code
> symbol that establishes it, and **leaves the wrong text visible rather than deleting it** — a
> correction a later well-meaning edit could silently undo is not a closed defect. Superseded
> instructions are struck through **and** marked WITHDRAWN, because a note above a live instruction
> is not a correction. Source receipt:
> `Builds/BUILD-015-asdair-durable-household-shopping-steward/Assurance/veritas-wp-red-suite-recovery-0f8a1bc.md`.
> Code pinned at `37a97c5`. Claims that cannot be checked offline are marked
> **REQUIRES CONFIRMATION** rather than asserted.

---

## STARTUP / ORIENTATION — state these four things before any tool call

1. **Map / focus** — this brief, then `Builds/BUILD-015-asdair-durable-household-shopping-steward/`.
   **The build record is the authority.** The Honcho continuity brief is a POINTER, never the
   authority — at the last rotation it was pointing at an unrelated Cairn task. If it disagrees
   with this file, open the build record and let it self-correct.
2. **Goal** — Warwick's `BUILD-015-END-TO-END-RECOVERY`: every gap closed, integrated, run,
   proven photo-to-basket, then an independent Pax audit.
3. **Phase / gate** — integration, part-done. ~~Gate is Pax's `FINAL-END-TO-END-ACCEPTANCE-AUDIT.md`.~~
   **WITHDRAWN — that is no longer the *next* gate.** The current gate is an **open
   `VERITAS_HOLD`** on `0f8a1bc` (defects D1 and D5). Pax's audit remains the final *product*
   acceptance gate, but it sits behind a `VERITAS_PASS` on a new exact head. See FRONTIER item 0.
4. **Exact next action** — ~~**THE FRONTIER** item 1 below. It is unambiguous.~~ ~~**WITHDRAWN — item 1
   is COMPLETE.** The exact next action is **THE FRONTIER item 0** below: discharge the open Veritas
   **HOLD**, defect **D1**.~~

> **WITHDRAWN AGAIN 2026-08-04 ~05:10 — `D1 IS DISCHARGED`. DO NOT REDO IT.** Fixed at **`d30beb1`**
> (`selectProjection()` derives the projection from the statement text; `pipeline` 185 → **192/192**;
> six mutation proofs; Veritas independently reinstated the defect and got **17 failures**). This
> file was reconciled at `be6d1a5` and then `d30beb1` fixed D1 **without carrying the brief forward**
> — so the line above still sent a fresh instance to redo completed work. **Veritas Gate 3 caught it
> as `D-G3-01`, HIGH, and it is the reason this brief sits inside a documentation-truth review.**
>
> **The real exact next action:** read
> `Builds/BUILD-015-.../Assurance/veritas-gate3-governance-ecfb04b.md` (HOLD, 11 defects) and
> `Deliverables/2026-08-04-rotation-brief.md`, then discharge **D-G3-01 … D-G3-07**. **`D5` is
> `0-of-8` discharged, not 1-of-8** — the earlier claim that this brief discharged one class was
> itself wrong (`D-G3-02`).
>
> **The whole file below is under that HOLD. A struck line is not a reconciled document — verify any
> instruction here against the code before acting on it.**

> **CORRECTED 2026-08-04 (WO-ZN, discharging Veritas D5 at `0f8a1bc`):** this was the single line a
> fresh instance acts on first, and it pointed at finished work. All four of FRONTIER item 1's
> sub-tasks landed: `priorAnswers` (`pipeline/deps.js` → `realLoadPlanningInputs`, calling
> `skill.loadRuleQaLog`), answer-learning (`pipeline/deps.js` → `realRecordAnswerLearning`, bound
> into the production deps object), sanitized grounding evidence (`pipeline/runPipeline.js` →
> `stepInterpret` → `store.recordGroundingEvidence`), and the `list_item_id` carrier
> (`pipeline/store.js` → `listQuestions`). Verified by execution at `37a97c5`: all fourteen asdair
> suites green — 1602 tests, 1599 pass, 0 fail, 3 skip.

**Verify by execution, not belief:** repository, worktree, branch, HEAD. Report the comparison.

---

## WHERE THINGS STAND

- **Branch** `build-015/live-acceptance-recovery-2026-08-03` · ~~**HEAD** `94978d2`, pushed.~~
- Tree clean apart from two pre-existing untracked files (a BUILD-018 vlog draft, some Team
  Knowledge sources) that predate this work. Leave them.
- **No PR open yet.** Branch hygiene and the PR are outstanding. *(PR #73 named in the old
  version of this brief is a different, earlier PR — check its state, don't assume.)*

> **CORRECTED 2026-08-04 (WO-ZN, discharging Veritas D5 at `0f8a1bc`):** the head moved four times
> after this line was written. **HEAD is `37a97c5`** (`git rev-parse HEAD`, executed). The
> intervening commits are `0f8a1bc` (the red-suite recovery), `66d40d3` (Veritas hired), `fa484bf`
> (the Veritas receipt) and `37a97c5` (GL-009 household-data classification plus two schema
> comments). **Do not trust any head named in a brief — resolve it.** *Whether `37a97c5` is pushed,
> and the state of any PR, is a network fact: **REQUIRES CONFIRMATION**, not assumed from this
> file.* The tree also carries uncommitted work outside asdair (`services/hub/youtube/**`) and a
> line-ending-only touch on `skill/planner.js` — content-identical to HEAD, verified with
> `git diff --numstat`.

### Suite state at HEAD — READ BEFORE YOU PANIC

**WITHDRAWN — the table below describes `94978d2` and no longer describes any live state. The
current numbers are in the corrected table beneath it.**

```
WITHDRAWN — SUPERSEDED, describes 94978d2 only:

GREEN  bot 148 | interpret 25 | outcome 193 | reconcile 106 | packet 104
       handoff 81 | pipeline-runtime 130 | cockpit-api 132 | shop 91 | intake 24

RED    pipeline  173 pass / 8 FAIL
       skill     275 pass / 3 FAIL
```

~~**Both reds are expected, attributable and mid-transaction.**~~ Seven agents were stopped where they
stood when Warwick called the rotation. Nothing was reverted — losing half-finished work is worse
than a labelled red.

- ~~**`pipeline` — 8 failures.** The integration agent was part-way through `stepPlan` (prior answers
  + the durable `item_name` carrier). The failures are the whole question-card journey: `B1 END TO
  END`, `NEVER CARD TWICE`, the ledger-window test, `B2 THE ANSWER COMES BACK`, `STALE TAP`, `B2
  TYPED REPLY`, the id-less-suggestion adapter, the no-sender path. **They passed at 181/181
  immediately before that edit.** Finish it, or revert `runPipeline.js` alone.~~
- ~~**`skill` — 3 failures.** The rule-consumption agent was part-way through removing a silent
  quantity **SUM** in `dedupeList()`. Two are its own "Finding 2 control" tests mid-correction;
  one is the new global-policy-row case.~~

> **CORRECTED 2026-08-04 (WO-ZN, discharging Veritas D5 at `0f8a1bc`):** **both reds are closed and
> the tree is green.** Executed at `37a97c5`, `node --test` in each service directory, exit 0 for
> all fourteen:
>
> ```
> bot 148/148   interpret 25/25   outcome 194 (193 pass, 1 skip)   reconcile 106/106
> packet 104/104   handoff 81/81   pipeline-runtime 130/130   cockpit-api 132/132
> shop 91/91   intake 24/24   transcribe 36/36   browser-runner 65/65
> pipeline 185/185   skill 281 (279 pass, 2 skip)
>
> TOTAL 1602 tests · 1599 pass · 0 fail · 3 skip
> ```
>
> Two further corrections inside the withdrawn text, both of which mattered:
>
> 1. **"They passed at 181/181 immediately before that edit" was FALSE.** Those eight tests never
>    passed — they were *created* by `94978d2` and were red on arrival. The suite held **162 tests,
>    all green,** at `943a262`. This false claim originated in `94978d2`'s own commit message and
>    was repeated here; Veritas verified the correction independently. **A count carried forward
>    from a commit message is not evidence.**
> 2. The old table **omitted `transcribe` and `browser-runner` entirely** and listed `outcome` as
>    `193` — that is its *passing* count, not its test count. A suite absent from the table is
>    indistinguishable from a suite that does not exist.
>
> **3 skips are real and are not failures:** 1 in `outcome` and 2 in `skill`, all DB-gated proofs
> that stay inert without `ASDAIR_DB_TEST_ALLOW_DESTRUCTIVE`. *Whether CI ran these suites at this
> exact head is a network fact: **REQUIRES CONFIRMATION.** An absent CI run is never a passing CI
> run.*
>
> **These counts are pinned to `37a97c5` and will already be stale — that is expected, not a
> defect.** While they were being measured, a concurrent work order was discharging **D1** in
> `pipeline/store.js` and `pipeline/test/fakePg.js`; the `pipeline` suite had moved from **185 to
> 192** before this note was finished. **Re-run the suites; never quote a count out of this file.**
> Verbatim, executed in each service directory: `node --test`.

---

## THE FRONTIER — in this order

0. **Discharge the open Veritas HOLD — this is the actual next action.**
   `Assurance/veritas-wp-red-suite-recovery-0f8a1bc.md` returned **HOLD** on `0f8a1bc` with two
   HIGH defects. **D5 (stale documentation) is being worked now, under `WO-ZN`.** **D1 is open and
   is yours:**

   > **D1, HIGH — a documented test protection does not exist.** `pipeline/test/fakePg.js` projects
   > `listQuestions` rows through a **hard-coded** `QUESTION_COLUMNS` literal instead of deriving
   > the projection from the SQL. Veritas dropped `q.answer_text` + `q.answer_source` from the real
   > `SELECT` and the suite stayed **green at 185/0**; dropping
   > `sl.raw_reading AS photographed_wording` also stayed green, even though the resulting SQL is
   > **syntactically invalid**. The file's own comment claims the opposite protection. **The defect
   > class this query was rewritten to fix is currently undetectable.**

   D2, D3, D4 (three wrong counts in `0f8a1bc`'s commit message), D6 (durability claimed in prose,
   evidenced only against a fake) and D7 (3 skips unreported) are recorded for disposition and do
   **not** require a new head by themselves.

   **A Work Package can no longer be recorded complete without a `VERITAS_PASS` against the exact
   integrated head.** Corrective work on D1 means resubmitting a **new** exact head.

1. ~~**Finish the integration (`WO-ZI`).**~~ **COMPLETE — WITHDRAWN as an instruction. Do not
   rebuild any of it.** Kept below only as the record of what was asked for, struck so it cannot be
   read as work outstanding. **The sanitized-grounding-evidence bullet in particular describes a
   placement that was tried and REJECTED — see the correction note.**
   - ~~`deps.js realLoadPlanningInputs()` — add `skill.loadRuleQaLog(householdId)` to the existing
     `Promise.all`, return as `priorAnswers`; `stepPlan()` passes it to `deps.planBasket`.~~
     **Rotation needs no wiring** — `rules` + `lastOrder` already flow, and rule 32 is now `rotate`.
   - ~~**Wire `buildAnswerLearning` / `recordAnswerLearning`.** ZERO production callers today. This
     is the blocker.~~ `applies_going_forward` must be an **explicit boolean — absent is a HARD
     ERROR, never a default.**
   - ~~**Sanitized grounding evidence** at `realInterpretPhoto` (`deps.js:157-181`).~~ **WITHDRAWN —
     THIS PLACEMENT WAS REJECTED. DO NOT IMPLEMENT IT.** **Counts and ids
     only** — never product names, list content, prompt text or the photograph. Sink:
     `asdair.pipeline_command.result` (jsonb, merged with `||` in `store.js`). `kind` is
     CHECK-constrained to `('command','outbox')` — you cannot add a kind.
   - ~~**`item_name` carrier** — `stepPlan` sets `list_item_id` (an allowed insert column; recover it
     from `listItems`, **NOT** `plan.items`, because `dedupeList` drops the id), and
     `store.listQuestions()` JOINs `shopping_list_items`.~~ The one-line consumption in
     `runtime.js` belongs to the bot workstream.
   - ~~**`store.listQuestions()`** must also select `rendered_candidates`, `render_fingerprint`,
     `render_version`, `callback_index` — a pipeline-side consumer silently gets `undefined` today.~~
   - ~~**Prove the seams by EXECUTION.** Call `verifyBasket({expected: packet, actual})` with the
     **PACKET**, never the handoff, and assert a corrupted declared count yields
     `packet_self_consistent: false`.~~

> **CORRECTED 2026-08-04 (WO-ZN, discharging Veritas D5 at `0f8a1bc`).** Every bullet above landed
> at `0f8a1bc`, and one of them landed **somewhere else on purpose**. Verified at `37a97c5` —
> `services/asdair/pipeline/**` is cited by **symbol, not line number**, because a sibling order is
> rewriting that surface concurrently and a line citation is the most perishable evidence there is.
>
> - **`priorAnswers`** — `pipeline/deps.js` → `realLoadPlanningInputs` calls
>   `skill.loadRuleQaLog(householdId)` inside the existing `Promise.all` and returns it as
>   `priorAnswers`. Genuinely *consumed*, not merely carried: `skill/planner.js:1462` reads
>   `args.priorAnswers`, and `priorAnswersForLine` / `pointerAnswersForLine` act on it at
>   `planner.js:1704` and `:1708`.
> - **Answer-learning** — `pipeline/deps.js` → `realRecordAnswerLearning` requires
>   `outcome/recordAnswerLearning.js` and is bound into the production deps object;
>   `pipeline/runPipeline.js` → `stepReplan` calls `deps.recordAnswerLearning`. The
>   `applies_going_forward` hard-error rule survived and is still correct.
> - **🚨 Sanitized grounding evidence — PLACED IN `stepInterpret`, NOT IN `deps.js`. THIS IS THE
>   ONE THAT MATTERS.** The instruction above named `realInterpretPhoto` in `pipeline/deps.js`.
>   That placement is **untestable by construction**: `pipeline/test/harness.js` replaces
>   `deps.interpretPhoto` **wholesale**, so any caller sitting inside the real
>   `realInterpretPhoto` is unreachable by every offline test in this repo. It was therefore
>   deliberately placed in `pipeline/runPipeline.js` → `stepInterpret`, calling
>   `store.recordGroundingEvidence`, **after** the model returns and deriving its counts from
>   `readings.length` so a skipped call cannot forge it. The string `recordGroundingEvidence`
>   **does not appear in `deps.js` at any commit.** Veritas confirmed the placement is correct and
>   flagged this brief as *"a fresh Larry would re-introduce the signature defect on the next
>   session's first action."* **Following the original bullet would have rebuilt the defect.**
> - **`list_item_id` carrier** — `pipeline/store.js` → `listQuestions` `LEFT JOIN`s
>   `shopping_list_items`, and `stepPlan` recovers the id from `listItems` exactly as instructed.
> - **The four extra columns** — `pipeline/store.js` → `listQuestions` now selects
>   `rendered_candidates`, `render_fingerprint`, `render_version`, `callback_index`.
> - **`verifyBasket` against the packet** — `reconcile/verifyBasket.js` reads `expected.lines` via
>   `readExpectedLines`, documented in its own header as *"expected (from the Sonnet execution
>   packet)"*.
>
> All four joins were proven load-bearing by Veritas's own deletion tests (deleting each one turns
> the suite red), which is the standard this build asked for. **⚠️ But see D1 at item 0: the
> `listQuestions` projection is proven by a fake that cannot detect a dropped column.**

2. ~~**Finish the `skill` quantity fix.** `dedupeList()` at `planner.js:1278` **sums** explicit
   quantities (`+= normaliseQty`, line 1310) — *"2 milk"* + *"3 milk"* silently becomes 5.
   Same-or-absent quantity → dedupe as today. **Different explicit quantities → a question carrying
   both written numbers. Never sum, never pick, never drop.**~~ **COMPLETE — WITHDRAWN.**

> **CORRECTED 2026-08-04 (WO-ZN, discharging Veritas D5 at `0f8a1bc`):** done, **and both line
> numbers were wrong even when written.** `dedupeList` is at `skill/planner.js:1358`, not `1278`;
> there is no `+=` at `1310` or anywhere else in the function. The removal is recorded in the code
> itself at `planner.js:1336`: *"This function used to do `acc.requested_qty += normaliseQty(...)`"*.
> The replacement behaviour is what was asked for — differing explicit quantities raise
> `needs_decision` with `planned_qty 0` and a note carrying **both** written numbers, and Veritas
> confirmed the banned `requested_qty === 5` assertion is gone rather than relaxed. **Line numbers
> in a brief rot faster than anything else in it; cite the symbol.**

3. ~~**Close the `identityKey` drift.** `packet/buildExecutionPacket.js:344` uses `normalizeSortKey`
   (NFKC, collapses punctuation); `handoff/buildHandoff.js:108` does `trim().toLowerCase()` only.
   `yazoo choc 2-pack` disagrees — and the consequence is **a VALID packet gets refused.** The
   handoff adopts the packet's normalisation: consumer follows producer.~~ **COMPLETE — WITHDRAWN.**

> **CORRECTED 2026-08-04 (WO-ZN, discharging Veritas D5 at `0f8a1bc`):** the drift is closed and
> this entry was stale. `normalizeSortKey` at `packet/buildExecutionPacket.js:136` and at
> `handoff/buildHandoff.js:98` are now **character-identical** — NFKC → trim → lowercase →
> `[^\p{L}\p{N}]+` collapsed to a single space → trim, returning `null` for a value that normalizes
> away. `buildHandoff.js:93-97` deliberately records the earlier wrong `trim().toLowerCase()`
> version and why it failed, so the history is in the code and does not depend on this file.
> **Do not "fix" it again.** The copy is intentional and explained at `buildHandoff.js:83-91`
> (the packet module is ESM, the handoff is CommonJS — a `require` is impossible); the two are
> pinned against one shared fixture set by a cross-module test.

4. **Make the execution packet DURABLE.** `services/asdair/packet/` persists **nothing** — no
   table, no INSERT — while the schema says *"stored in Postgres"* and the canonical process
   requires it. **The packet is ephemeral, which is the 2026-08-03 lost-plan failure with better
   provenance.** Read contract published and binding:
   `Builds/BUILD-015-.../COCKPIT-PACKET-AND-RECONCILIATION-INTERFACE.md` — `asdair.execution_packet`,
   `payload jsonb`, `asdair_ro` grant. The cockpit view is already built against it.

> **VERIFIED STILL OPEN 2026-08-04 (WO-ZN):** re-checked, not assumed. `services/asdair/packet/`
> contains no `INSERT INTO`, and no `execution_packet` table exists in `services/asdair/db/` (the
> committed migrations stop at `012`). Veritas reached the same conclusion independently and
> recorded that `buildExecutionPacket` has **no production caller outside its own tests**. This
> item is real work and is the largest remaining functional gap.

5. **The injected end-to-end journey.** photo → interpretation → planning (rules and prior answers
   consulted BEFORE questions) → question cards → answers → persistence → packet (Brand A–Z) →
   handoff → basket observation → reconciliation → `basket_ready`. Kill and restart at every stage
   boundary. **Mutation controls are the point: delete each caller you added and prove the journey
   turns RED.** A caller deletable with the suite still green is decorative — this build's
   signature defect.

> **PARTIALLY DONE — CORRECTED 2026-08-04 (WO-ZN, discharging Veritas D5 at `0f8a1bc`).** Split the
> two halves, because one is finished and the other is not started:
> - **Mutation controls: DONE for the four integration joins**, and independently reproduced.
>   Veritas deleted each caller in turn and recorded the exact red sets. **This is the half of the
>   build that finally worked.**
> - **Kill and restart: NOT PROVEN, and must not be described as proven.** The `RESUMABILITY` tests
>   build a fresh deps container over the **same in-memory JS object graph** — that proves no state
>   hides in the container, not that anything survives process death. **No row has ever been
>   written to Postgres by this journey.** Veritas held Durability at HOLD for exactly this
>   (defect D6) and declared kill-and-revive *unavailable* rather than passed: no database, no
>   credentials, `live_authority: none`. Words like "durable" applied to `list_item_id`,
>   `rule_qa_log` or the grounding-evidence row are, today, **evidenced only against a fake.**

6. **CI steps for `packet/` and `handoff/`.** `pipeline-runtime` and `browser-runner` were added
   2026-08-04 but **CI has not run yet** — a workflow edit is not a workflow run.

> **VERIFIED STILL OPEN 2026-08-04 (WO-ZN):** correct as written, re-checked against
> `.github/workflows/asdair-tests.yml` at `37a97c5`. `pipeline-runtime` and `browser-runner` each
> have `npm ci` + `node --test` steps; **`packet/` and `handoff/` appear in no step of that
> workflow at all.** Both suites pass locally (104 and 81) and gate nothing — the same shape as the
> defect the workflow's own comments warn about. *Whether CI has since run is a network fact:
> **REQUIRES CONFIRMATION.** Check the last result **per workflow**, at the exact SHA — an absent
> run is never a passing run.*

7. **Branch hygiene, one clean PR vs `main`, CI green at the exact head.**

> **REQUIRES CONFIRMATION 2026-08-04 (WO-ZN):** unverifiable offline. Resolve the PR state and CI
> result yourself; do not carry either forward from this file.

8. **Pax `FINAL-END-TO-END-ACCEPTANCE-AUDIT.md`** at the final head. **Fable is CANCELLED**
   (Warwick, 2026-08-04) — Pax is the sole acceptance gate. Pax is a different hat, not a different
   model: report its verdict as *independent review by the same model*, never as external
   verification. Codex at the PR remains the standing rule.

> **STILL TRUE, BUT INCOMPLETE — CORRECTED 2026-08-04 (WO-ZN).** Pax remains BUILD-015's final
> acceptance gate under an explicit carve-out. What this brief predates: **`Veritas` was hired on
> 2026-08-04 (`66d40d3`, `GOVERNANCE-VERITAS-HIRE`) and now holds the internal assurance gate.**
> Two consequences a fresh instance must not discover late:
> 1. **A Work Package cannot be recorded complete without a `VERITAS_PASS` receipt against the
>    exact integrated head, and Larry may not write `closed` from his own assessment.** Until that
>    receipt exists the maximum permitted statement is *"Integrated at `<SHA>` and submitted to
>    Veritas for assurance."*
> 2. **BUILD-015 currently holds a `VERITAS_HOLD`** on `0f8a1bc` (see item 0). It is not eligible
>    for closure, and Pax's audit is not the only gate ahead of it.
>
> Canonical: `AGENTS.md` (roster + the SOP-018 routing change) and
> `Team Knowledge/Templates/work-order.md` (the lifecycle). **Pax being "the sole acceptance gate"
> was written before Veritas existed — read it as *the sole* ***product*** *acceptance gate*.**

---

## DECISIONS WAITING ON WARWICK — do not act alone

1. **`Team/Asdair - Household Shopping Steward/AGENTS.md`** still says *"Asdair runs `runner.js`
   itself"*, which `RUNTIME-DECISION.md` supersedes and prohibits from live-account testing. **A
   dispatched Asdair following its own contract would do the prohibited thing.** Reported
   independently by two agents. Hard rule forbids touching any `AGENTS.md` without approval;
   replacement text drafted 2026-08-04.

> **STRENGTHENED 2026-08-04 (WO-ZN, discharging Veritas D5 at `0f8a1bc`) — this is a LIVE TRAP, not
> a paperwork item, and it is the same defect class as the `realInterpretPhoto` instruction
> corrected above: a document that instructs a rejected design.** Read it as an operational hazard
> with a standing precondition:
>
> **DO NOT DISPATCH ASDAIR UNTIL WARWICK HAS RULED.** The contract is the first thing a dispatched
> Asdair reads and it outranks any brief, including this one. The prohibited action is a **live
> ASDA account** action, so the cost of the race is not a red test.
>
> A third agent (`WO-ZN`) has now reported it independently. **The remedy is Warwick's ruling, not
> an edit** — no agent may touch any `AGENTS.md`, and this entry must not be read as licence to
> "just fix the wording". It stays on this list until he rules; a fourth independent report changes
> nothing.
2. **Should Favourites be a real second ASDA view at all?** `asdair.regulars` holds **one** distinct
   `source` value — `regular`, 103 rows. **No `'favourite'` row has ever existed.**
   `source_view: "favourites"` is a forward contract describing nothing live.
3. **The dedupe guard lives in one writer, not in the schema.** `updateRegulars` protects only what
   goes through `updateRegulars`; a hand-written INSERT walked past it. Schema question — Silas's
   call, Warwick's authorisation.

---

## LIVE STATE CHANGED 2026-08-04 — both reversible, both defect corrections

- **Migration 013** — `asdair.rules` id 32 `info` → `rotate`. The rotation code had been built,
  tested and **unreachable for weeks** because the planner discarded every `info` row before
  matching. Verified: `23 map / 32 rotate / 37 info`.
- **Migration 014** — six regulars (108–113) carried `source = 'learned-2026-08-03'`. That column
  means *which ASDA view* and is part of `UNIQUE (household_id, source, name)`. Larry's own defect
  from 2026-08-03. Verified after: 103 rows, one value.
- **Both cockpit services restarted and verified live.** `/asdair/health` genuinely queries the
  database (`latency_ms` reported); `/api/app-status` reads the body, not the port.

> **REQUIRES CONFIRMATION + ONE REAL GAP — 2026-08-04 (WO-ZN).** Everything in this section is
> **live** state and none of it can be verified offline (`live_authority: none`, no database, no
> credentials). Treat all three bullets as unconfirmed until re-observed. **One thing is checkable
> and it does not hold:** *"Migration 013"* and *"Migration 014"* **have no committed files.**
> `services/asdair/db/` at `37a97c5` stops at `012_complete_grant_matrix.sql`; there is no `013`
> or `014` anywhere under `services/`. The `rotate` **directive** exists (migration
> `007_rules_rotate_directive.sql` — it makes the instruction storable) but the row change
> described here does not exist as a migration. So either the two changes were applied straight to
> the live database without committing the SQL, or they are named something else. **If it is the
> former, a fresh clone or a bootstrap restore does not reproduce the live state, and the live
> database is now ahead of the repository — that is a durability gap, not a naming quibble.**
> Establish which before relying on the *"Verified: 23 map / 32 rotate / 37 info"* and
> *"103 rows, one value"* counts above.

**The three-way Sure conflict does not exist and is RETRACTED.** Rule 32 opens by agreeing with
rule 23 — 23 picks the family, 32 rotates the scent, 37 rounds the quantity, and `rule_qa_log` #5
says the same. **Do not ask Warwick about it again.**

> **UNRESOLVED CONTRADICTION — flagged 2026-08-04 (WO-ZN). Marked unknown rather than guessed.**
> The retraction above concerns the **three-way** reading (23 / 32 / 37) and I found nothing to
> dispute it. But **a `sure`-variant conflict is still live in code and in two other active
> documents**, and I could not establish offline whether it is the same conflict or a different
> one:
> - `skill/planner.js:524` still returns `rotationDecision('needs_decision', …,
>   'fixed_variant_conflict', …)`, with a test pinning it (`skill/lastOrder.test.js:446`).
> - `services/asdair/db/007_rules_rotate_directive.sql` states in its header that the household
>   *"currently holds a REAL CONFLICT: rules 23/24 map `sure male` to a FIXED variant, while
>   `rule_qa_log` #5 says ROTATE it"*, and that the migration does **not** resolve it.
> - `Builds/BUILD-015-.../ACTIVATION-DEFERRED.md` says the same, calling it *"Real, unresolved."*
>
> **23/24-vs-`rule_qa_log`-#5 is not obviously the same thing as 23/32/37.** Resolving it needs the
> live rules table, so it is **REQUIRES CONFIRMATION**. Do not delete the code path on the strength
> of this file's retraction, and **do not read this note as re-opening a question Warwick closed** —
> it records that three artefacts disagree, which is a thing to establish, not a thing to ask him.

**Still open from the old brief and NOT addressed:** `Arla BOB Semi-Skimmed 2L` (regular 69) is
ACTIVE while rule 10 says never buy BOB — and rule 10 is `info` with no `match_term`, so nothing
enforces it. `milk` resolves correctly today **only because regular 69 happens to carry no alias.**
A `BUILD-002 live proof` test row still sits in a `next_week_draft` list.

> **REQUIRES CONFIRMATION 2026-08-04 (WO-ZN):** every claim in the paragraph above is about **live
> database rows** — unverifiable offline and not re-checked here. One reason to re-check rather
> than carry it forward: the sentence *"`milk` resolves correctly today only because regular 69
> happens to carry no alias"* was written when matching was **exact-string**. Matching is now
> tolerant (`skill/termMatch.js`, the single shared matcher used by `skill/planner.js` and
> `interpret/resolveByCatalogue.js`), so **the reason that safety held may no longer hold.** That
> makes it more urgent, not less.

---

## HARD RULES — never negotiable

Never auto-substitute · never book a slot · never check out · never pay · never enter the ASDA
password · `checked_out` stays false. **Warwick is the gate for every consequential action.**

**Sonnet in Claude for Chrome is the Stage 1 live basket writer** — not Larry, not a Claude Code
subagent, not the CDP runner at `services/asdair/browser-runner/` (experimental, deferred,
**prohibited from further live-account testing without fresh authority**). Canonical:
`RUNTIME-DECISION.md`, `CANONICAL-WEEKLY-SHOP-PROCESS.md`.

**There is no programmatic Sonnet invocation surface. None was invented and none may be.** The
prohibitions in the handoff are **instructions, not enforcement** — the CDP runner blocked checkout
and substitution in three code layers; Sonnet in Chrome has none. That is a real reduction in
mechanical guarantee, and it is why the live pass is supervised and stops at checkout-ready.

Shopping content is **not** a privacy matter (Warwick, 2026-07-27) — report baskets plainly. Only
**secrets** stay out of the repo. Two credentials exist: `ASDAIR_DB_URL` (`asdair_ro`, SELECT-only)
and `ASDAIR_WRITE_DB_URL` (`asdair_rw`, narrow write), both in `C:/.fusion247/asdair.env`.
**Consume the environment, never inspect it.**

---

## WHAT NOT TO DO

- **Do not build a new mechanism** in response to any of this. The regrowth cap is real; BUILD-018
  is the cautionary tale.
- **Do not run `proof/run-proofs.mjs` expecting the old behaviour** — PROOF 10 now fails if any
  proof resolves a path under `C:\.fusion247\`. That guard is the point. It exists because the
  harness was reading and printing real household state while its own header claimed otherwise.

> **CORRECTED 2026-08-04 (WO-ZN) — the guard is real, the path is wrong.** PROOF 10 exists and
> arms as described (*"household-state boundary: ARMED (PROOF 10 fails the run if any path
> resolves under a household root)"*), but the file is at
> **`services/asdair/pipeline-runtime/proof/run-proofs.mjs`**. There is no `services/asdair/proof/`
> directory. A warning nobody can locate is not a warning.
- **Do not treat two modules that describe each other correctly as a working seam.** Three seam
  defects were found by execution on 2026-08-04, every one between modules that individually passed
  everything they had.
- **Do not trust a green test you have not tried to break.** Four separate builders found tests of
  their own passing for the wrong reason — a fixture short-circuiting the path under test, a
  scenario that could not occur, an `if (verdict.valid)` wrapper asserting nothing, and a sort
  comparator no test could distinguish from locale collation.
- **Do not preflight a Work Order only against reality — preflight it against the SIBLING orders.**
  One file was granted to two agents on 2026-08-04. Nothing collided, but only by luck.

---

## THE ONE THING WORTH REMEMBERING

Every module in this build was individually complete, individually tested, and reachable from
nothing. `sendQuestionCard` had a full renderer, a full suite, and **no production caller** — which
is why Warwick spent 2026-08-03 answering questions by hand. Five separate builders reported "zero
production callers" about their own work in a single night.

**The components were never the problem. The joins were.**

> **STILL THE LESSON — one status correction, 2026-08-04 (WO-ZN, discharging Veritas D5 at
> `0f8a1bc`).** The paragraph above is **history and is accurate as history**; keep it. But
> `sendQuestionCard` **now has a production caller** — bound in `pipeline/runtime.js` and invoked
> from the outbox drain in the same file. Stated here because a fresh reader can easily take the
> present-tense lesson for a present-tense defect, and go looking for a hole that was filled.
>
> **The lesson generalises and the second half of it is now the live risk:** a join is only proven
> when **deleting it turns the suite RED.** The four integration joins clear that bar (item 1). The
> `listQuestions` **column projection does not** — Veritas dropped columns from the real `SELECT`
> and the suite stayed green, because the fake projects a hard-coded list (**D1**, item 0). *A
> green test you have not tried to break is not evidence — including the ones written to close this
> very defect.*
