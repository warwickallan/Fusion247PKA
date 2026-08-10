---
title: Session performance and failure report — 2026-08-10 into 2026-08-11, BUILD-015 AsdAIr
date: 2026-08-11
author: Pax (Senior Researcher)
type: independent measurement — bounded, rotation prep
commissioned_by: Larry, for Warwick
method: git plumbing read directly from .git; repository documents read as claims to check; live store NOT reachable (see Limits)
status: measurement — findings and lessons, no recommendations to build anything
supersedes: nothing. Extends Deliverables/2026-08-10-pax-session-performance-report.md
---

# Session performance and failure report — 2026-08-10 into 2026-08-11

**Same-model review — not independently verified.** I am a separately-dispatched context, but the
same model that produced the work under review.

**This is not a defence document.** Warwick's framing is quoted here because it is the finding:

> **Weeks of work and extensive assurance occurred before anyone proved that the derived shopping
> list actually matched Warwick's photograph.**

That is accurate. Nothing below softens it.

---

## 1. Limits on this measurement — read before using any number

- **No shell.** No `git log`, no `git status`, no suite execution. Every commit time below was read
  from `.git/logs/refs/heads/main` and `.git/refs/heads/main` directly.
- **🔴 The MCP tools are NOT available to me.** I was instructed to verify facts 1 and 3 against the
  live Supabase store read-only. **I attempted three tool names and all returned "No such tool
  available."** This confirms the estate's own standing memory (*subagents get NO MCP tools*) by
  execution. **I therefore did NOT independently verify the `asdair.shop` id 14 row, the 35
  `shop_line` rows, or the £74.30 total.** Those remain **Larry's single-source measurement**,
  recorded at `Deliverables/2026-08-11-BLOCKER-input-truth-failure.md`. They are flagged as such
  throughout. Anyone who needs them verified must run the query from a context that holds the tools.
- **Tokens: NOT MEASURABLE.** No telemetry, no ledger. I will not estimate and present it as
  measurement.

---

## 2. Elapsed time — measured

All BST. Anchor `1786320000` = 2026-08-10 01:00:00 BST (re-verified against two known commits).

| Marker | SHA | BST |
|---|---|---|
| Photograph arrives (per session log; **Z/BST ambiguity still unresolved from the prior report**) | — | ~15:33 |
| First evening commit on `main` | `9f4e37c` | 16:52:04 |
| Head declared at the first rotation attempt | `fb58882` | 21:39:31 |
| Handover / Veritas receipts / Pax report banked | `7cc6040` | 22:39:30 |
| Warwick's hard timebox set | — | 22:44 |
| **Last commit on local `main`** | `cfea559` | **22:58:29** |
| Stop verdict sent (FusionDevBot `message_id 491`) | — | 23:23 |

**Git-measurable committing activity: 6h 06m 25s** (16:52:04 → 22:58:29).
**From the photograph to the stop verdict: ~7h 50m.**

**Everything after 22:58:29 is invisible to git.** The browser run, the £74.30 trolley, Warwick's
three catches, the input-truth discovery and the BLOCKER document itself were **all produced after
the last commit and were still uncommitted at the time of this measurement** (`refs/heads/main` =
`cfea559`). **Total session elapsed is therefore NOT precisely measurable.** That is itself a
defect: the two most consequential documents of the session — the STOP record and the TOP-LEVEL
BLOCKER — were not in git.

**Token accounting: NOT MEASURABLE. There is still no subagent token ledger.** `Deliverables/`
holds ledgers dated `2026-08-08` (×3) and `2026-08-09` (×1). None for `2026-08-10`. None for
`2026-08-11`. **Fourth consecutive session.** Commit `08b87c0` was titled *"closes the gap Pax
reported UNESTABLISHED twice"*; `e708c8c` made it *"a mandatory step, not a thing Larry
remembered."* It remains a thing Larry remembers, and he did not.

---

## 3. The core metric — who found what

**12 substantive defects reached Warwick's hands this session. The assurance layer found 0 of them
before he did.**

### Found by Warwick, using the product — 12

| # | Defect | When |
|---|---|---|
| 1 | Photograph silently absorbed into a `CANCELLED` shop; no acknowledgement card | daytime |
| 2 | Eight separate question cards, not one surface | daytime |
| 3 | He could not tell what he had answered | daytime |
| 4 | Free-text answers double-consumed, minting junk shops (`M76/77/79/82`) | daytime |
| 5 | Card contradicted itself — *"No candidate products found"* above candidates | daytime |
| 6 | Obvious grounded matches escalated as questions | daytime |
| 7 | He missed a question entirely — fragmented surface | daytime |
| 8 | Dead `Search ASDA` button on every card | daytime |
| 9 | **The basket was too cheap — £74.30.** He caught it by looking at the price | post-23:23 |
| 10 | **Honey-roast ham substitution attempt** | post-23:23 |
| 11 | **Missing 6-pint ASDA semi-skimmed milk** — it was ON the photograph | post-23:23 |
| 12 | **🔴 THE LIST DID NOT COME FROM THE PHOTOGRAPH.** *"there is absolutely no way that can be correct"* | post-23:23 |

Items 1–8 are carried forward from the prior report and re-verified against its sources. Items 9–12
are new and are the reason this report exists. **#12 is the top-level blocker of the entire build**
and it was discovered by a human noticing a price.

### Found by the system, before Warwick hit it — 1 product defect, plus order-quality findings

- **Veritas (Gate 1 + Gate 2, both `HOLD` at `fb58882`)** found the **cross-shop answer-routing
  collision** — `loadOpenQuestions` flattens open questions across all active shops while computing
  `ordinal` per shop, and `new Map` is last-write-wins. Armed and live, not yet hit by Warwick.
  **Genuine, unambiguous assurance value.** It also caught three record defects: the migration-019
  limit carried only half way; `WO-B15-FIX1` absent from the dispatch and therefore ungraded; and no
  `private_surface` declared, so it could not confirm the runtime was polling.
- **Three Keel read-backs, 3 of 3 returned `CLARIFY`, and all three were right.** Enumerated from
  the three Work Orders' Amendment 1 blocks and the night-stop record — **16 distinct findings**
  before a line of code was written:

  | Order | Findings |
  |---|---|
  | WO-B15-18 | defect is 4–5 holes not 1 · the worst hole carries **no number at all**, so nothing survives for a reviewer to blame · `recordedAnswerMatches` has the same defect and no AC covered it · AC3 demanded two incompatible things · `questionKeyFor` has no shop component · the `productionWiring` source-text pin is fragile |
  | WO-B15-19 | **three of Larry's cited line numbers were wrong** (`shopStore.js:729`→`713/730`; `shop-cli.js:232`→`238`; `claim.js:294`→`285`) · `pg` does not resolve from `handoff/` · the ordered "merge" would have stranded another worker's deliberate statement-shape pin — **fence, not merge** · filename/secret-scan pinning · the automatic-proof limit stated honestly |
  | WO-B15-20 | **the lookup is in TWO places** — a SQL-only fix fetches the row and still misses · **a SECOND gate at `runPipeline.js:317`** short-circuits on `memoriesByTerm.size === 0`, so today the function was never called at all · Larry's dispatch note about the harness was wrong · a wrong test label · two stale "018 not applied" comments |

  **Two worker designs were taken over Larry's own.** *The orders needed more scrutiny than the
  work. Again.*
- **1,982 unit tests across 13 suites, a secret scanner and a mutation harness found 0 of the 12.**
  None of them was ever pointed at whether the list came from the photograph.

### The ratio, stated plainly

> **Every defect that determined whether Warwick got the right groceries was found by Warwick.**
> The estate's assurance found one real defect on a path he had not yet walked, and sixteen faults
> in Larry's own instructions. It found nothing at all about the input.

---

## 4. False readiness and success claims — and the corrections

| # | Claim | Correction |
|---|---|---|
| 1 | **"Ready to shop"** (morning of 2026-08-10) | Falsified within minutes by the first real photograph |
| 2 | **"23 of 23 correct product AND quantity, 0 substitutions, 0 invented products"** | **The single worst claim of the session.** True against the derived list. The derived list was never reconciled to the photograph. Corrected only after Warwick queried the price |
| 3 | Declared closing head `fb58882` | Stale by two (`d1bab9a`, `6eb815e`) — **second consecutive rotation** |
| 4 | FusionDevBot described as "available" on the strength of the file existing | Tightened to proven only after `message_id` 489/490/491 each exited 0 |
| 5 | Warwick instructed to approve a permission prompt | Retry proved the classifier **auto-denies without prompting**; he would have sat waiting. Corrected within minutes (`490`) |

**#2 had two independent in-repo signals available before it was made, and neither was used:**

1. **`SOP-021` rule 7** — *"Check the total against the GBP 120–150 band and flag if outside (rule 7
   — flag, never block)"* (`SOP-021`:267). **Verified by me directly in the SOP.** The SOP also
   states rule 7 is structurally inoperative in code — *"any budget observation in a shop report is
   a **human** one"* (`SOP-021`:431). It was Larry's to make. He did not make it.
2. **The historical real basket** — `RUNTIME-DECISION.md`:53 records the 2026-08-03 live acceptance
   run at **35 products, £136.94**, inside the band. £74.30 across 23 products is **~54% of the last
   real basket for this household.**

**Two independent sources, in the repository, both pointing at the anomaly. Zero consulted.**

---

## 5. Work later invalidated by a more fundamental defect

**Not "wasted" — but not acceptable either, and the distinction matters.** None of the evening's
engineering is wrong. All of it is now **un-acceptable** until GATE ZERO (input truth) is closed,
because it is all downstream of a list whose provenance is unproven:

- **6h 06m of committed activity** on `main`, eleven work packages earlier in the day, plus three
  new Work Orders (`B15-18/19/20`) authored 22:39–22:58 and a fourth (`B15-21`) taken on personally.
- **Two Veritas gates** graded question routing, board rendering and list identity — surfaces that
  were faithfully asking Warwick about **items he never wrote down**.
- The read-backs, mutation proofs and 1,982 green tests certified the correct processing of a
  fiction.

**The BLOCKER document states it exactly right and I confirm the logic: every layer downstream of
the missing transcription behaved impeccably, which is precisely why nothing caught it.**

---

## 6. Assurance value versus assurance cost

**Cost is not token-measurable** (§1). What is measurable is dispatch count and yield.

| Assurance layer | Cost | Yield this session |
|---|---|---|
| Keel read-back gate (×3) | 3 preflight contexts | **16 findings + 2 superior designs, before any code.** Highest yield in the estate, by a distance |
| Veritas (Gate 1 + Gate 2 at `fb58882`) | 2 full contexts | **2 × HOLD → 1 genuine Work Order** (`WO-B15-18`) + 3 record defects |
| 1,982 unit tests, secret scan, mutation harness | continuous | **0 of the 12** |
| Input-truth check | **never commissioned** | — |

**Two honest readings, and they do not cancel:**

1. **Veritas volume was NOT the problem this session.** Two verdicts producing one real Work Order
   is a healthy ratio and is a marked improvement on the Sub-phase 4B incident (11 verdicts, 0 PASS,
   57.7% of a working phase, 0 product change after verdict #1). The commissioning discipline held.
2. **The whole assurance stack was pointed at the wrong question.** Every gate graded *"does the
   machine process this list correctly?"* Nobody ever graded *"is this list Warwick's list?"*
   **A perfectly-run review of the wrong scope returns a confident wrong answer**, and that is what
   happened.

---

## 7. The browser rescue outcome

**The browser worked. That is the good news and it is also the trap.**

Per the BLOCKER record (**Larry's measurement — I could not verify it against the store**), the
supervised browser leg ran after the stop and **faithfully built a 23-product, £74.30 trolley** from
the plan, with Larry's reconciliation reporting 23/23 product-and-quantity correct, 0 substitutions,
0 invented products *against the derived list*.

**Outcome, stated correctly:**

- **The browser is not the blocker.** The mechanism executed what it was given, accurately.
- **Its accuracy was worth nothing**, because the input was fiction. Seven products Warwick never
  asked for were faithfully placed in a real trolley.
- **Warwick stopped it at the trolley** — too cheap, a honey-roast ham substitution attempt, and a
  missing 6-pint semi-skimmed milk that **was on the photograph**. He was the last control and the
  only one that fired.
- The one thing the rescue genuinely proved: **an end-to-end browser leg is reachable.** That is a
  real asset and it should not be lost in the wreckage of the input failure.

---

## 8. What finally worked

1. **Warwick using the product.** 12 of 12. This is not a compliment to him; it is a measurement of
   everything else.
2. **The read-back gate.** Cheapest control in the estate, three for three, 16 findings, and it
   twice produced a better design than the order it was given.
3. **Comparing derived output to the original human artefact.** One line-by-line read of the
   photograph against the rows settled in minutes what 1,982 tests could not see. It required no
   machinery.
4. **The clean stop.** Warwick set 23:44; the verdict was reached at 23:23 and **sent early rather
   than held to the deadline**, because he needed the time to buy food. Delivering bad news early
   beat delivering it on schedule.
5. **Refusing to route around the migration permission gate.** It fired twice; the sibling connector
   and raw `execute_sql` were both available and both deliberately unused. Correct call.

---

## 9. What must never recur

1. **Reporting success against a derived artefact without reconciling it to the human source.**
   *"23 of 23 correct"* is the canonical example and should be quoted whenever this is taught.
2. **Holding a numeric sanity band in a written SOP and not consulting it.** Rule 7 existed. The
   historical £136.94 basket existed. Both were in the repository. Neither was read.
3. **Allowing a pipeline to continue past a step that produced nothing and recorded nothing.** An
   empty transcript with null provider, null model, null confidence and `needs_review = true`
   produced 35 line rows and 28 requested items. *(Larry's measurement; I could not verify it.)*
4. **Larry taking a foreseen-blocked package on personally at the end of a timebox.** At ~23:10 with
   34 minutes left he took the `shop_id` emitter under the Rule 4 exception. The `fakePg` collision
   was not merely foreseeable — **it had already been his own stated reason not to dispatch it to a
   fourth worker.** He relocated the blocker rather than removing it, and spent time owed to a clean
   stop. Rule 4's exception requires *the change is already understood* and *delegation overhead
   would materially exceed the work*; neither held.
5. **Concurrent workers sharing a mutable session scratchpad.** Two workers independently reported
   that the scratchpad is shared and that **one worker's mutation harness was replaced mid-flight
   and executed against another worker's worktree.** *(Reported to me by the dispatching agent; the
   worker returns were not on disk at measurement, so I could not read them first-hand. The defect
   class is corroborated in the estate's own history — `DEFECT-LEDGER` `D-2026-07-27-01`, the
   disposable per-session scratchpad.)* **Mutation evidence produced under those conditions is not
   evidence.** Any mutation kill claimed in this session's returns should be treated as unproven
   until re-run in isolation.
6. **Session-critical documents living outside git.** The STOP record and the TOP-LEVEL BLOCKER were
   both uncommitted when I measured. A fresh session reading `main` would not have seen either.
7. **A fourth consecutive session with no token ledger**, while token spend is the thing Warwick
   keeps asking about by name.

---

## 10. What I could not resolve

- **Facts 1 and 3 are unverified by me.** No MCP tools in a subagent context. They rest on Larry's
  single read-only measurement.
- **The photograph's arrival time remains ambiguous** (15:33 BST vs 15:33Z — an hour apart). Flagged
  in the prior report; still unresolved; the acceptance narrative depends on it.
- **Why the transcript is empty is not known** — never ran, ran and failed silently, or ran and
  failed to persist. The BLOCKER document is right to refuse to guess.
- **Where the 35 lines actually came from is not established**, only observed. The "all invented
  items are household Regulars" signature is the strongest available evidence for the mechanism and
  it is inference, not proof.

**No new mechanism is recommended anywhere in this report.** The regrowth cap applies at full force.
The findings above are measurement and lessons; the fix for the input-truth failure is almost
certainly to make an absent transcription fatal and loud, and that is a bar on claiming, not a
platform to build.
