---
agent_id: larry
type: close-session
date: 2026-08-09
time: "17:24"
topic: The decision spine, and three gates that earned their place
---

# The decision spine, and three gates that earned their place

## Coverage window

**Start boundary:** [[2026-08-08-08-59_larry_4d-capae-built-and-the-push-gate-corrected]] — the previous `close-session` checkpoint. **Nothing before it is retold here.**

**This entry covers 2026-08-08 evening through 2026-08-09 17:24**: the BUILD-015 orientation, the WP-B15-1 live acceptance, the answer-to-plan establishment, WP-B15-2 end to end, the governor permission regression, and the commissioned post-build addendum.

## Context

The session opened on a routine orientation and ended with **the first human answer that can change a shopping plan** merged to `main`. In between, three independent gates each caught something the previous gate had passed — and in every case the thing they caught would have shipped silently.

## What we did

**Shop 6 recovered, live.** Break 8 — the interpretation-confirmation gate with no human surface — fired in production for the first time. The runtime queued a card, ShopperBot delivered it, Warwick tapped, the gate cleared, the shop reached `READY_TO_SHOP`. **Self-healing:** shop 6 had been parked silently since 3 August and no row was inserted to rescue it.

**Then Warwick stopped the route, and was right to.** Rather than fix the stale browser claim, he asked whether a natural answer actually changes the plan. **Pax established conclusion C:** it does not — and neither buttons nor free text do, because both die at the same barriers. **Shop 6's `READY_TO_SHOP` was semantically invalid**, reached by closing question rows while lines still carried vision misreads. Building a basket from it would have hunted for products nobody asked for.

**WP-B15-2** (Keel, order regenerated through the envelope route after a correct refusal): `asdair.shop_decision` on **Silas's** carrier decision, `decideAnswer` resolving a tap with zero model calls, **bounded Terra** on free text, clarification rounds, an honest gate that cannot livelock, and a park that speaks. **Silas** proved migration 017 against real PostgreSQL. **Veritas** ran Gate 1 to PASS across three rounds. **Codex** then found a fifth failure path none of them had.

**In parallel:** Lane C3's browser method contract (Keel), the four-lane execution view, three lane establishments (Pax), the `substitutes_allowed` archaeology, and the five-part post-build addendum.

## Decisions made

- **Route B** for applying decisions — after `planBasket` inside the pipeline, with the seam built so planner-level consumption can replace it later. Larry's call, on evidence that the other `planBasket` consumers are CLI-only.
- **Warwick: use Terra, not `reason`.** *"Do NOT substitute `reason` because it is easier to reach. Do NOT widen the durable vocabulary so `reason` can become acceptable after the fact."*
- **Warwick's three product rulings:** integrate the packet/handoff subsystem; reject the ASDA-reference hard stop (identity and retrieval are separate concerns); retain lease/fencing but not a 45-second lease for a human-paced step.
- **Warwick's §11 row 7 amendment** — `needs_review` is immutable provenance, not gate state.

## Realignments (verbatim)

> *"Please stop stopping and delaying things to ask me to allow things I just hit allow anyway cos I dont know what it means! My word is my allow/approval"*

> *"Do not treat my earlier instruction as authority to bypass the main-push/merge gate."*

> *"That is not yet Warwick's decision… 'Which current row does this old record belong to?' is his problem to establish, not yours to decide."*

> *"PARALLEL PREPARATION. SERIAL PRODUCT TRUTH."*

## Open threads

- **Migration 017 is not applied.** Both preflights pass; **Warwick's authority is the only remaining gate.**
- **Lane B1's `forward_intent` product decision** — deliberately unbundled, awaiting his ruling.
- **Fresh-photo acceptance** has not happened. Shop 6 is unsuitable.
- **`markCorrected` still has zero production callers** — deliberately open, no caller manufactured.
- Lane C1 and Lane D have executable seams banked and need envelope-generated orders.

## Next resumption point

`main` = `0731a94`. Open the active Wayfinder's four-lane execution view. **The next real event is the fresh photograph**, after Warwick applies 017.

## VlogOps / story signals

**The strongest story of the session is three gates catching what the previous one passed**, ending with a test that failed its own mutation and said so. *"Had I only reported green, I would have handed you the same defect wearing a rosette."*

---

# LARRY LESSONS LEARNED

## 1. A gate that passes is not a gate that saw everything

**LESSON** — When an internal gate passes, the next gate must be given **what the previous one could not see**, not a summary of its verdict. Codex's first review returned `request_changes` on two counts that were **packet defects, not code defects**: the accepted criteria and the assurance receipt were *described in prose* rather than *staged*, so the eight-criterion PASS was unverifiable.
**TRIGGER** — F1 and F3 on PR #103.
**CHANGE MADE** — **Prose only.** Recorded in `Deliverables/2026-08-09-codex-pr103-round1-findings.md`.
**FUTURE EFFECT** — Stage the artefacts a reviewer must verify; a claim about a receipt is not the receipt.
**STATUS** — **NO DURABLE CHANGE MADE — recorded, not enforced.** Nothing would stop this recurring.
**CLASS** — EVIDENCE.

## 2. A discriminating test must assert an ABSENCE

**LESSON** — *"Would fail if somebody quietly switched this back"* is an **absence** property. Asserting **presence** cannot express it. The Terra proof passed twice while the path was rebound — first by an aliased import, then by a **second** import taking the primary call while the retry stayed on Terra, at 290/290 green.
**TRIGGER** — Keel's own mutation, then Veritas's MUT-B.
**CHANGE MADE** — **Executable.** `services/asdair/pipeline/*.test.js` now asserts, over **every** import (`matchAll`, never `exec`), that the union of source names is exactly `{answer, answerModel}`, and **set equality** over every awaited callee. Three disguises go red; a fourth is documented as deliberate-evasion-only.
**FUTURE EFFECT** — Rebinding the model to a cheaper role fails CI.
**STATUS** — **PROMOTED — executable protection.**
**CLASS** — QUALITY.

## 3. A control that cannot be re-read on every branch is not installed

**LESSON** — The permission guard broke **three times in one day**. Twice a branch checkout silently reverted the live hook file, because the hook reads it **from the working tree** and the fix lived only on a branch. A fix present in git is not a fix present at the moment of action.
**TRIGGER** — Warwick clicking Allow through routine work, three separate bursts.
**CHANGE MADE** — **Executable.** PR **#104** merged the guard to `main`, so the file exists on every branch. Verified after merge: a fresh checkout leaves it live.
**FUTURE EFFECT** — A branch switch can no longer disarm the guard.
**STATUS** — **PROMOTED — executable protection.**
**CLASS** — INVARIANT.

## 4. An allow-list must cover the ordinary, or it is a denial machine

**LESSON** — The guard allowed a compound `git commit` carrying a substitution while a bare `mkdir` **stopped the session** — because the compound happened to contain a `>` redirect. Classification accident, not safety.
**TRIGGER** — Warwick's third burst of prompts.
**CHANGE MADE** — **Executable.** `ORDINARY_MUTATING_BINARIES` in `tools/governor/worktree-guard.mjs`. Still an allow-list: `rm`, `chmod`, `dd` are **deliberately absent rather than blocklisted**, because a denylist fails open on the verb nobody thought of.
**FUTURE EFFECT** — Ordinary file work stops interrupting; destructive work still reaches the human.
**STATUS** — **PROMOTED — executable protection.**
**CLASS** — OPERATING HEURISTIC.

## 5. Do not hand Warwick a question you have not done the work to sharpen

**LESSON** — Twice in one session Larry escalated something that was **his own engineering**: the disposable-Postgres proof (*"a genuinely disposable isolated Postgres… requires no Warwick authority"*) and the `substitutes_allowed` archaeology (*"Which current row does this old record belong to?" is Larry's to establish*). The archaeology then **closed the item** — the record was platform observation, not household intent, so nothing needed deciding.
**TRIGGER** — Two Warwick corrections.
**CHANGE MADE** — **Prose only.** Recorded on the Wayfinder with his qualifying tests for a genuine product choice.
**FUTURE EFFECT** — Establish first; escalate only what the evidence leaves genuinely open.
**STATUS** — **EXISTING RULE STRENGTHENED — prose only.** `CLAUDE.md` already forbids escalating what a safe default resolves; this adds *do the archaeology first*, and nothing enforces it.
**CLASS** — DELEGATION.

## 6. The envelope route was skipped three times under time pressure

**LESSON** — Larry hand-authored Work Orders **three times today**, and workers correctly refused each. The family's recorded cause names it exactly: *the generation route is treated as exempt for orders that feel urgent.*
**TRIGGER** — Three class-A refusals.
**CHANGE MADE** — **None. The control already exists and already worked** — `tools/wo/envelope.mjs` plus the worker refuse-gate caught all three.
**FUTURE EFFECT** — Unchanged: the gate holds, and the cost is a wasted dispatch each time.
**STATUS** — **NO DURABLE CHANGE NEEDED — already enforced executably.** The failure is Larry's compliance, not a missing mechanism, and **building a second control would be regrowth.**
**CLASS** — PREFLIGHT CHECK.

## Rejected as too task-specific

The `bigint`-as-string divergence · the round-1 question-key derivation · `Format-Volume` verb-prefix · the `pg_constraint` guard pattern. All are **file-level facts already recorded where the code lives**.

## Contradiction found in existing doctrine

**None.** One correction *within* this session's own record: Larry attributed the D-2 card as the control holding the no-gateway path visible; Veritas disproved it at one head and then **reversed itself in Keel's favour** once the throw design landed. Both states are recorded rather than one being quietly overwritten.

## Guaranteed-load path

**Not modified.** Lessons 3 and 4 became **code on `main`**; lesson 2 became **tests on `main`**. Lessons 1 and 5 are **prose only and say so**. No orphan lessons file was created.
