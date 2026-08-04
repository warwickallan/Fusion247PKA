# Next AsdAIr session — brief

**REWRITTEN 2026-08-04 at rotation, by the Larry who did the work.** Supersedes every earlier
version of this file — in particular the one that opened *"Do the shop first. It works."*
It did not work, and that sentence cost Warwick a night.

---

## STARTUP / ORIENTATION — state these four things before any tool call

1. **Map / focus** — this brief, then `Builds/BUILD-015-asdair-durable-household-shopping-steward/`.
   **The build record is the authority.** The Honcho continuity brief is a POINTER, never the
   authority — at the last rotation it was pointing at an unrelated Cairn task. If it disagrees
   with this file, open the build record and let it self-correct.
2. **Goal** — Warwick's `BUILD-015-END-TO-END-RECOVERY`: every gap closed, integrated, run,
   proven photo-to-basket, then an independent Pax audit.
3. **Phase / gate** — integration, part-done. Gate is Pax's `FINAL-END-TO-END-ACCEPTANCE-AUDIT.md`.
4. **Exact next action** — **THE FRONTIER** item 1 below. It is unambiguous.

**Verify by execution, not belief:** repository, worktree, branch, HEAD. Report the comparison.

---

## WHERE THINGS STAND

- **Branch** `build-015/live-acceptance-recovery-2026-08-03` · **HEAD** `94978d2`, pushed.
- Tree clean apart from two pre-existing untracked files (a BUILD-018 vlog draft, some Team
  Knowledge sources) that predate this work. Leave them.
- **No PR open yet.** Branch hygiene and the PR are outstanding. *(PR #73 named in the old
  version of this brief is a different, earlier PR — check its state, don't assume.)*

### Suite state at HEAD — READ BEFORE YOU PANIC

```
GREEN  bot 148 | interpret 25 | outcome 193 | reconcile 106 | packet 104
       handoff 81 | pipeline-runtime 130 | cockpit-api 132 | shop 91 | intake 24

RED    pipeline  173 pass / 8 FAIL
       skill     275 pass / 3 FAIL
```

**Both reds are expected, attributable and mid-transaction.** Seven agents were stopped where they
stood when Warwick called the rotation. Nothing was reverted — losing half-finished work is worse
than a labelled red.

- **`pipeline` — 8 failures.** The integration agent was part-way through `stepPlan` (prior answers
  + the durable `item_name` carrier). The failures are the whole question-card journey: `B1 END TO
  END`, `NEVER CARD TWICE`, the ledger-window test, `B2 THE ANSWER COMES BACK`, `STALE TAP`, `B2
  TYPED REPLY`, the id-less-suggestion adapter, the no-sender path. **They passed at 181/181
  immediately before that edit.** Finish it, or revert `runPipeline.js` alone.
- **`skill` — 3 failures.** The rule-consumption agent was part-way through removing a silent
  quantity **SUM** in `dedupeList()`. Two are its own "Finding 2 control" tests mid-correction;
  one is the new global-policy-row case.

---

## THE FRONTIER — in this order

1. **Finish the integration (`WO-ZI`).** Surface: `pipeline/runPipeline.js`, `stages.js`,
   `deps.js`, `store.js`, `pipeline` tests **only**. `pipeline/runtime.js` and `runtime.test.js`
   belong to the bot workstream — do not touch.
   - `deps.js realLoadPlanningInputs()` — add `skill.loadRuleQaLog(householdId)` to the existing
     `Promise.all`, return as `priorAnswers`; `stepPlan()` passes it to `deps.planBasket`.
     **Rotation needs no wiring** — `rules` + `lastOrder` already flow, and rule 32 is now `rotate`.
   - **Wire `buildAnswerLearning` / `recordAnswerLearning`.** ZERO production callers today. This
     is the blocker. `applies_going_forward` must be an **explicit boolean — absent is a HARD
     ERROR, never a default.**
   - **Sanitized grounding evidence** at `realInterpretPhoto` (`deps.js:157-181`). **Counts and ids
     only** — never product names, list content, prompt text or the photograph. Sink:
     `asdair.pipeline_command.result` (jsonb, merged with `||` at `store.js:479`). `kind` is
     CHECK-constrained to `('command','outbox')` — you cannot add a kind.
   - **`item_name` carrier** — `stepPlan` sets `list_item_id` (an allowed insert column; recover it
     from `listItems`, **NOT** `plan.items`, because `dedupeList` drops the id), and
     `store.listQuestions()` JOINs `shopping_list_items`. The one-line consumption at
     `runtime.js:441` belongs to the bot workstream.
   - **`store.listQuestions()`** must also select `rendered_candidates`, `render_fingerprint`,
     `render_version`, `callback_index` — a pipeline-side consumer silently gets `undefined` today.
   - **Prove the seams by EXECUTION.** Call `verifyBasket({expected: packet, actual})` with the
     **PACKET**, never the handoff, and assert a corrupted declared count yields
     `packet_self_consistent: false`.

2. **Finish the `skill` quantity fix.** `dedupeList()` at `planner.js:1278` **sums** explicit
   quantities (`+= normaliseQty`, line 1310) — *"2 milk"* + *"3 milk"* silently becomes 5.
   Same-or-absent quantity → dedupe as today. **Different explicit quantities → a question carrying
   both written numbers. Never sum, never pick, never drop.**

3. **Close the `identityKey` drift.** `packet/buildExecutionPacket.js:344` uses `normalizeSortKey`
   (NFKC, collapses punctuation); `handoff/buildHandoff.js:108` does `trim().toLowerCase()` only.
   `yazoo choc 2-pack` disagrees — and the consequence is **a VALID packet gets refused.** The
   handoff adopts the packet's normalisation: consumer follows producer.

4. **Make the execution packet DURABLE.** `services/asdair/packet/` persists **nothing** — no
   table, no INSERT — while the schema says *"stored in Postgres"* and the canonical process
   requires it. **The packet is ephemeral, which is the 2026-08-03 lost-plan failure with better
   provenance.** Read contract published and binding:
   `Builds/BUILD-015-.../COCKPIT-PACKET-AND-RECONCILIATION-INTERFACE.md` — `asdair.execution_packet`,
   `payload jsonb`, `asdair_ro` grant. The cockpit view is already built against it.

5. **The injected end-to-end journey.** photo → interpretation → planning (rules and prior answers
   consulted BEFORE questions) → question cards → answers → persistence → packet (Brand A–Z) →
   handoff → basket observation → reconciliation → `basket_ready`. Kill and restart at every stage
   boundary. **Mutation controls are the point: delete each caller you added and prove the journey
   turns RED.** A caller deletable with the suite still green is decorative — this build's
   signature defect.

6. **CI steps for `packet/` and `handoff/`.** `pipeline-runtime` and `browser-runner` were added
   2026-08-04 but **CI has not run yet** — a workflow edit is not a workflow run.

7. **Branch hygiene, one clean PR vs `main`, CI green at the exact head.**

8. **Pax `FINAL-END-TO-END-ACCEPTANCE-AUDIT.md`** at the final head. **Fable is CANCELLED**
   (Warwick, 2026-08-04) — Pax is the sole acceptance gate. Pax is a different hat, not a different
   model: report its verdict as *independent review by the same model*, never as external
   verification. Codex at the PR remains the standing rule.

---

## DECISIONS WAITING ON WARWICK — do not act alone

1. **`Team/Asdair - Household Shopping Steward/AGENTS.md`** still says *"Asdair runs `runner.js`
   itself"*, which `RUNTIME-DECISION.md` supersedes and prohibits from live-account testing. **A
   dispatched Asdair following its own contract would do the prohibited thing.** Reported
   independently by two agents. Hard rule forbids touching any `AGENTS.md` without approval;
   replacement text drafted 2026-08-04.
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

**The three-way Sure conflict does not exist and is RETRACTED.** Rule 32 opens by agreeing with
rule 23 — 23 picks the family, 32 rotates the scent, 37 rounds the quantity, and `rule_qa_log` #5
says the same. **Do not ask Warwick about it again.**

**Still open from the old brief and NOT addressed:** `Arla BOB Semi-Skimmed 2L` (regular 69) is
ACTIVE while rule 10 says never buy BOB — and rule 10 is `info` with no `match_term`, so nothing
enforces it. `milk` resolves correctly today **only because regular 69 happens to carry no alias.**
A `BUILD-002 live proof` test row still sits in a `next_week_draft` list.

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
