---
title: ROTATION HANDOVER — 2026-08-11. READ THIS FIRST, BEFORE ANY OTHER DOCUMENT.
date: 2026-08-11
author: Larry
build: BUILD-015 AsdAIr
closing_head: see § Closing state
status: handover — NOT a completion claim, NOT an acceptance
supersedes_as_entry_point: Deliverables/2026-08-10-rotation-handover.md
---

# Rotation handover, 2026-08-11

## PRODUCT TRUTH — the only section that matters if you read nothing else

1. **Warwick has still NEVER had a successful end-to-end AsdAIr photo → shop acceptance journey.**
2. **Tonight's groceries were rescued MANUALLY** through the supervised browser, working from
   Warwick's original photograph read directly — **not** from the pipeline's output.
3. **The final trolley is real and correct: 41 products, 58 units, £140.97.** No slot booked, not
   checked out, nothing paid. Reconciled line by line against the photograph: 41/41 correct product
   and quantity, 0 missing, 0 wrong quantity, 0 unexpected extras.
4. **BROWSER CAPABILITY IS PROVEN.** For the first time, a browser built a real ASDA trolley.
5. **🔴 THE UPSTREAM PHOTO → LIST PIPELINE FAILED CATASTROPHICALLY.** The durable transcript for
   `SHOP-2026-08-10-M64` was **EMPTY** — no text, no provider, no model, no confidence — while ~35
   plausible `shop_line` rows existed that **did not represent Warwick's photograph**. They omitted
   ~17 things he wrote and contained 7 products he never asked for.
6. **That is now the highest-priority acceptance blocker**, ahead of every remaining work package.
   Full record: **`Deliverables/2026-08-11-BLOCKER-input-truth-failure.md`**. Read it before planning
   anything.
7. **Migration 019 is APPLIED and verified on the live database.**
8. **No future photograph acceptance may proceed without input-truth proof** (Gate Zero, defined in
   the blocker document).

> **⛔ Do NOT begin another week of downstream fixes before resolving source truth.** Everything
> downstream worked correctly tonight on false input. That is why nothing caught it.

## Closing state

| | |
|---|---|
| Local `main` | `cfea559` + this rotation's documentation commits — see the final commit in the log |
| `origin/main` | **still far behind.** The push and the merge remain Warwick's (`merge-decision`) |
| **THE REMOTE BRANCH HOLDING TONIGHT'S TRUTH** | **`origin/build-015/durable/2026-08-11-rotation`** — every rotation document and every commit on local `main`. Verified by SHA comparison against local `HEAD`, not assumed. **If this machine is lost, recover from there.** |
| Worker branches, all SHA-verified on origin | `build-015/b15-18-cross-shop-answer-routing` @ `8181db4` · `b15-19-supervised-completion` @ `cf59894` · `b15-20-remembered-choice-lookup` @ `602caea` · `b15-21-shop-id-emission` @ `6416c0a` |
| Worktrees still on disk | `C:/Fusion247PKA-b1513`, `-b1518`, `-b1519`, `-b1520`, `-b1521`. **Each carries REAL COPIES of `node_modules`, not junctions** — deliberate, so a red in one is a real red. Safe to delete normally; none carries a junction to destroy the primary through |
| Runtime | ✅ **PID 12204, started 2026-08-10 21:40:57 — BYTE-CURRENT WITH `main` PRODUCT CODE.** Verified by execution: `fb58882` was committed **21:39:31**, i.e. **86 seconds before** the process started, and `git diff --name-only fb58882..HEAD -- services/` returns **ZERO**. It therefore **CARRIES B15-07 through B15-16.** It does **NOT** carry B15-18/19/20/21, which are unintegrated. It runs `services/asdair/pipeline/runtime.js --watch` from the **PRIMARY CHECKOUT**, so a restart picks up whatever is on `main` at that moment. Scheduled task `MyPKA-AsdAIr-Runtime` state `Ready`. **A cutover is needed only AFTER B15-18/19/20/21 integrate.** *(Corrected 2026-08-11 on the fourth cold-start pass: an earlier "still on PRE-CHANGE bytes" claim here was FALSE, and a commit asserting it had been corrected had not in fact touched this file.)* |
| Working checkout | clean of product code — Larry's own `shop_id` edit was reverted out and banked to a branch |
| Live DB | migration 019 applied, ledger `20260810215203`; `asdair.regulars` gained 6 rows (114–119) and 2 enriched (37, 85) |

## STATE CENSUS — every BUILD-015 item, by execution 2026-08-11

**Read the columns literally. `COMPLETE` from a worker means BUILT, nothing more.**

| Item | Branch / commit | Integrated | Pushed | Proof | In runtime | Open? |
|---|---|---|---|---|---|---|
| **B15-18** cross-shop answer routing | `build-015/b15-18-cross-shop-answer-routing` @ `8181db4` | **NO** | yes | pipeline 485/0, bot 184/0, shop 102/0; 4 mutation kills; defect reproduced pre-fix | **NO** | **YES — integrate** |
| **B15-19** supervised completion route | `build-015/b15-19-supervised-completion` @ `cf59894` | **NO** | yes | handoff 135/0, shop 105/0, pipeline 473/0, browser-runner 92/0; 4 mutation kills | **NO** | **YES — integrate** |
| **B15-20** remembered-choice lookup | `build-015/b15-20-remembered-choice-lookup` @ `602caea` | **NO** | yes | pipeline 482/0; 3 mutation kills. ⚠️ **mutation evidence may be unsound** — see scratchpad incident below | **NO** | **YES — integrate + re-run mutation** |
| **B15-21** shop_id emission | `build-015/b15-21-shop-id-emission` @ `6416c0a` | **NO** | yes | **PROVEN on real PostgreSQL 32/0**, all 7 Silas assertions. ⚠️ reddens offline suite 473→371/102 — **fake fidelity, NOT a regression** | **NO** | **YES — teach `fakePg` the `shop_id` lane, then integrate** |
| **migration 019** | applied live | **N/A — LIVE** | n/a | verified live + re-proven on throwaway PG 32/0 | **YES (schema)** | **partially — see below** |
| **B15-13** grounding normalisation | merged | **YES** | yes | in `main`; 0 commits outside | yes (bytes on main) | no |
| One editable question board (B15-09) | merged | YES | yes | suite | ✅ **YES — in the runtime** | no |
| Board blocked-state truth (B15-15) | merged | YES | yes | suite | ✅ **YES — in the runtime** | no |
| Answer-is-not-a-list (B15-08) | merged | YES | yes | suite | ✅ **YES — in the runtime** | no |
| Quantity / pack-size safety (B15-11) | merged | YES | yes | suite | ✅ **YES — in the runtime** | no |
| CLI offset / data-loss protection (B15-12) | merged | YES | yes | suite | ✅ **YES — in the runtime** | no |
| Fresh-list / shop ownership (B15-07/10/16) | merged | YES | yes | suite + 019 live | partial | **shop_id emission still out** |
| Handoff / checklist | built | YES | yes | fixtures only | n/a | **no real handoff artefact has EVER been written** |
| Browser completion route | B15-19, above | NO | yes | offline only | NO | **YES** |
| Durable learning | built, deliberately unwired | n/a | n/a | — | no | **downstream of a completed cycle; not the blocker** |
| Remembered-choice behaviour | B15-20, above | NO | yes | offline | NO | **YES** |
| **🔴 photo / transcription / source truth** | **nothing built** | — | — | **none** | — | **🔴 TOP BLOCKER** |
| Veritas Gate 1 + Gate 2 @ `fb58882` | **both HOLD** | — | — | receipts at `f22bfa5` | — | **YES — not discharged** |

**Gate 1's HOLD row 10** (019's seven PostgreSQL assertions unverifiable) **IS now discharged** —
Larry re-executed them on a real throwaway PostgreSQL cluster: **32 passed, 0 failed, all seven
Silas assertions PASS.** Every other HOLD stands.

### The seven states, applied honestly

- **BUILT** — B15-18, 19, 20, 21 all yes.
- **INTEGRATED** — **none of the four.**
- **PROVEN** — offline only, except B15-21 which is proven on real PostgreSQL.
- **LIVE / PRODUCTION-REACHABLE** — **none of the four.** The runtime started before any of them existed. **It DOES carry B15-07..B15-16**, which merged before it started.
- **USER-EXERCISED** — nothing. Tonight's trolley bypassed the pipeline entirely.
- **VERITAS-PASSED** — **nothing.** Both gates HOLD and no gate has run since.

## MIGRATION 019 — live, and what it does NOT mean

**Applied to the live database 2026-08-10 with Warwick's explicit in-session approval**, after the
permission gate correctly auto-denied it twice and was **not** routed around.

Verified live: `shop_id` column present · **contested list row 20 assigned to LIVE shop 14 (M64), not
the cancelled shop 11** · old auto-named unique constraint dropped · `uq_lists_shop`,
`uq_lists_household_date_unowned`, `idx_lists_household_date` all present · counts unchanged at 7
lists / 170 items · ledger row `20260810215203`.

> **⛔ DO NOT READ "019 APPLIED" AS "SAME-DAY SHOP OWNERSHIP IS FIXED END TO END". IT IS NOT.**
> **The live application write path still does NOT supply `shop_id`.** B15-21 delivers that and is
> **not integrated and not live**. Until it is, `findOrCreateDraftList` still takes the date-keyed
> lane, and a second shop on one date still lands on the first shop's list — because `listDateOf`
> strips the `-M<n>` suffix by design, so the date cannot distinguish two shops of one day.
> **019 alone changed no behaviour.** That is why it was safe to leave overnight, and also why it
> fixes nothing on its own.

## Tonight's browser rescue — recorded as a RESCUE, not as acceptance

Full method now canonical in **SOP-021 § 4**, in the STOP block. Result:

**41 products · 58 units · £140.97 · no slot · no checkout · nothing paid.**

**The itemised 41-line reconciliation is at
`Deliverables/2026-08-11-trolley-reconciliation-41-lines.md`** — every product, every quantity, the
step-by-step arithmetic, and the judgement calls. It exists because the cold-start reader correctly
flagged that "41/41 correct" was asserted with no itemised record anywhere in the repository.

> **⚠️ TWO SOP-021 § 5 STEPS WERE NOT PERFORMED, AND ONE OF THEM COULD CHANGE WHAT ARRIVES.**
> **"Allow substitutions for all" is still TICKED** on the trolley and every line shows "Allow
> substitutes" — **standing rule 6 is never auto-substitute**, and under the supervised adapter there
> is no mechanical enforcement of that toggle. **No `asdair.orders` row was written** via
> `recordShopOutcome.js` either. Neither affects what is currently in the basket; **the substitution
> toggle should be closed before Warwick checks out.**

**Corrections made during the rescue:** 10 wrong products removed (Mars, TRESemme ×2, Andrex, Wall's
sausage rolls, Smart Litter, Viakal, Lucozade raspberry, Hovis, Birds Eye classic burgers) · ~20
missing products restored · **the 6-pint ASDA semi-skimmed milk caught only after Warwick challenged
the result** · a duplicate Dettol removed after trolley read-back showed a "failed" add had actually
landed · every quantity set explicitly via steppers · 8 searched products favourited on ASDA ·
`asdair.regulars` reconciled through the ruled writer.

**Warwick's explicit late decisions, recorded:** ham on the bone → search for the literal ASDA match
(**not** a honey-roast substitution, which Larry nearly made and Warwick caught) · quarter pounders →
**ASDA** beef quarter pounders, since Birds Eye make no beef version · Dettol → "don't care" ·
**Bloo → skip this week** (his regular, Spa Moments Vitality, is out of stock).

**Remaining judgement calls, honestly flagged, not settled:** Loctite Super Glue **Original 3g** ·
Febreze **Vanilla Butterscotch** (his ASDA Regulars) versus the catalogue's "Sun-Kissed Vanilla" ·
**Vanish Oxi Gold** used from his recorded answer although the photograph appears to read "Oxi Pink".

> **⛔ THIS IS NOT END-TO-END ASDAIR ACCEPTANCE.** It proves **browser capability** and an effective
> **supervised operating method**. It simultaneously proves **the upstream photo/list pipeline
> failed**. Both statements are true and neither may be reported without the other.
>
> **⛔ The `asdair.regulars` writes were an OPERATOR RESCUE performed by hand. They are NOT evidence
> that the automated durable-learning path works.**

## Also discovered tonight, and not yet fixed

- **Five answers Warwick had already given were recorded and never reached the basket** — Richmond
  12 Skinless, Vanish Oxi Gold, Vanish Pre-Treat Gel, Ariel 4in1 Pods 33, Batchelors Mac 'n' Cheese.
  All `status = answered` on shop 14. **The answer capture works; the answer USE does not.**
- **`recordedAnswerMatches` cannot serve a cross-pass redelivery at all** (B15-18 worker finding F1,
  HIGH, pre-existing, **not fixed**). Same words redelivered on a later pass are reported "not
  recorded — answered with different words". Likely fix named in that worker's return; wants Larry's
  decision, not initiative.
- **⚠️ THE SESSION SCRATCHPAD IS SHARED BETWEEN CONCURRENT WORKERS.** Two workers independently hit
  this; one worker's mutation harness was **replaced mid-flight by another's and executed against a
  worktree that was not its own.** No lasting damage (file verified byte-identical twice), but
  **B15-20's mutation evidence from that window may be unsound and should be re-run before any
  gate.** Workers must namespace scratchpad paths and integrity-check a script between writing and
  executing it.
- **`runPipeline.js:250` and `:367`** still claim "MIGRATION 018 IS AUTHORED, NOT APPLIED". Stale;
  018 is applied. Parked, non-blocking.

## THE NEXT ACTIONS, in order

1. **🔴 RESOLVE SOURCE TRUTH FIRST.** Read `Deliverables/2026-08-11-BLOCKER-input-truth-failure.md`.
   Establish why `transcript` is empty and where the 35 lines actually came from. **Do not guess —
   the durable rows will say.** Nothing else on this list matters more.
2. Integrate `b15-18`, `b15-19`, `b15-20` into local `main`; re-run the full estate suite at the
   integrated head. **Baseline to beat: 1,982 pass / 0 fail across 13 suites at `7cc6040`.**
3. Re-run B15-20's mutation proof (scratchpad contention above).
4. Teach `pipeline/test/fakePg.js` the `shop_id` lane, then integrate `b15-21`. **Only after b15-18
   lands** — it owns that file.
5. **Cut the runtime over ONCE, via the scheduled task `MyPKA-AsdAIr-Runtime`.**
   `ASDAIR_COCKPIT_BASE_URL` comes from the Windows **user environment**, not the credentials files —
   a shell restart silently drops the checklist URL. Verify identity, mode and bytes after restart.
6. Veritas **Gate Zero (input truth) first**, then Gate 1, then Gate 2 current-state preflight.
   **Declare the private surface this time** — last session's gate could not confirm the runtime was
   polling because none was declared. Read the amended contract (`65f7375`, `62aa2e8`, `0658290`).
7. **Only on Gate Zero + Gate 1 + Gate 2 PASS may Warwick be asked for a photograph.**

## Pax's independent measurement — `Deliverables/2026-08-11-pax-session-failure-report.md`

**The headline, and it is the one that should govern the next session's priorities:**

> **12 substantive defects reached Warwick's hands. The assurance layer found 0 of them before he
> did.** The system found exactly one real product defect he had not already hit (Veritas's
> cross-shop routing collision), plus 16 faults in **Larry's own Work Orders** via the three Keel
> read-backs.

**Pax's diagnosis of why, and it is sharper than Larry's:** the Veritas ratio this session was
*healthy* — 2 verdicts, 1 genuine Work Order, nothing like the 4B incident. **The failure was not
review volume or review discipline. Every gate graded "does the machine process this list
correctly?" and no gate ever graded "is this list Warwick's list?"** A perfectly-run review of the
wrong scope returns a confident wrong answer.

**And:** the cheapest control in the estate — the read-back gate — outperformed 1,982 unit tests, a
secret scanner and a mutation harness combined.

**Measured elapsed:** 6h 06m 25s of git-visible activity (16:52:04 → 22:58:29 BST); ~7h 50m
photograph-to-stop. **Total not measurable** — everything after 22:58:29, including the entire
browser rescue, was uncommitted at the time. **Tokens: not measurable. Fourth consecutive session
with no ledger.**

**Pax's open items, carried forward:** it could **not** verify the input-truth facts first-hand
(subagents get no MCP tools) — re-run the query in the blocker document · **why** the transcript is
empty is unknown and **where the 35 lines came from is observed, not established** · the 15:33
BST-vs-Z ambiguity from the prior report is still unresolved · the scratchpad-collision reports were
corroborated only in class, so **any mutation kill claimed this session should be treated as
unproven until re-run in isolation.**

## What must NOT be claimed

- **Not** that AsdAIr works end to end. It has never been demonstrated.
- **Not** that tonight's trolley proves the pipeline. It proves the opposite.
- **Not** that durable learning works — tonight's catalogue writes were done by hand.
- **Not** that 019 fixed shop ownership — the write path half is not live.
- **Not** that any work package is complete. Four are built, none integrated, none live, none
  Veritas-passed.
- **Not** that a worker returning `COMPLETE` means anything beyond BUILT.
