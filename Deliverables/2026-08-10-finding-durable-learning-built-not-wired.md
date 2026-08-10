---
title: FINDING — durable household learning is BUILT, TESTED, and DELIBERATELY NOT WIRED
date: 2026-08-10
author: Larry, established by execution
status: OPEN — the accepted outcome's second half does not run
relates_to: Warwick's standing list of 2026-08-10, item 3
---

# The learning half exists and has never run

Warwick, item 3: *"where Warwick's statement clearly expresses a standing preference/rule, persist
the appropriate durable household knowledge; **do not pretend this half exists if it has not
actually been built and exercised.**"*

**Checked, as instructed. Here is the honest answer.**

## It is built, and it is good

`services/asdair/outcome/promoteDecision.js` is complete and tested. Its own header states what it
was written to repair:

> *"The LEARNING half of the loop the schema always designed but never wired: `asdair.rule_qa_log`
> had zero writers, so `applies_going_forward` and its `promoted_rule_id` back-link into
> `asdair.rules` were dead code. **Every human answer was forgotten and nothing was ever learned
> from a shop.**"*

It records every decision, promotes one to a standing rule **only** when the human said it applies
going forward, does both in one transaction with rollback, and refuses to promote a one-week-only
exclusion — because *"Do not buy X this week"* promoted forever is a wrong-but-confident basket for
as long as nobody notices.

## It is not wired, and that was a decision, not an oversight

`services/asdair/pipeline/deps.js:317` — **"DELIBERATELY NOT WIRED HERE: promoteDecision"**, on the
grounds that inferring *"does this apply going forward?"* from an answer would be *"exactly the
ambiguous-inference failure promoteDecision's provenance guard exists to refuse."*

`buildAnswerLearning` demands a **strict boolean** and hard-errors on an absent one, precisely so
nobody can guess it. `productionWiring.test.js` and `answerJourney.test.js` both record the module
as complete, tested and unwired.

**So the honest status of item 3 is: the machinery exists, has production-grade guards, and has
never once run against a real answer.** This is the standing CAPAE family — *built, tested,
committed, and never activated* — and it is the second half of what Warwick asked for last night.

## What the real shop showed

Two of his four typed answers on `SHOP-2026-08-10-M64` plainly express standing preferences:

- *"This is definitely in regulars and favourites"*
- *"Any gloves, i don't care want to rotate as soon as safe to do so!"*

Both settled their question. **Neither wrote a rule, a `rule_qa_log` row, or anything durable.** They
will be asked again next week.

## The missing piece, precisely

Not the writer — that exists. **The missing piece is how `applies_going_forward` is established
honestly.** The code refuses to have it guessed, and it is right to.

Warwick's own requirements already determine the route, so this is engineering rather than a new
product decision: item 2 requires free text to be *"interpret[ed] … through the intended bounded
semantic path where required"*, and item 3 requires persistence *"where Warwick's statement clearly
expresses a standing preference/rule."* That is Terra's job — the bounded semantic consumer — and
the guard's demand for a strict boolean is satisfied by an explicit interpretation, not an inference
smuggled in by the caller.

## Sequencing

**Depends on WP-B15-09**, which is rebuilding where an answer is captured and how a free-text reply
maps to one or more questions. Wiring learning into a surface being replaced this hour would be
building on sand.

**Queued, not dropped, and written down rather than carried** — the rule this whole class of defect
breaks.

---

## CORRECTION — 2026-08-10. **I was about to order the wrong fix. The code stopped me.**

This document said durable learning is "built, tested and DELIBERATELY UNWIRED", and I read that as
*the second half Warwick asked for does not run, so wire it.* **I had cut a worktree to dispatch
exactly that.** Then I read the modules, and the estate's own comments say the obvious fix is the
wrong one.

### What is actually true

**1. The learning that matters IS wired, and it fires at RECONCILE.**
`deps.js:789` binds `recordLearning: realRecordLearning`, and `runPipeline.js:2198 stepReconcile`
calls it as *"the last arc of the cycle: what actually arrived becomes next week's catalogue."* It
performs **alias enrichment** — `add_aka` for any line that resolved by something weaker than an
exact alias, which is precisely the case where the household's shorthand is missing from the
catalogue.

**2. Wiring `promoteDecision` would NOT stop next week's question, and `buildAnswerLearning.js` says
so in its own header — in a passage written to stop somebody doing exactly what I was about to do:**

> *"WHAT MAKES NEXT WEEK'S QUESTION NOT HAPPEN — and it is NOT the rule. Read this before changing
> anything here, because the obvious answer is the wrong one. A promoted STANDING RULE is the audit
> record of a decision. It is NOT reliably the thing that stops the question, because `planner.js`
> `actionableRules()` DISCARDS every rule whose directive is `info`, and an unproven promotion is
> inert `info` BY DESIGN; and rule matching is exact-string on `match_term`."*

So wiring it would have produced audit rows that change no basket — and at worst a drift of inert
rules nobody reads, which is the "built something that looks like the fix" failure this estate has
been burned by.

**3. `promoteDecision`'s deferral has a real reason, not an oversight.** `deps.js:317`: the pipeline
*"does not currently capture 'and this applies going forward' as a distinct human act"*, and
guessing it is the ambiguous-inference failure its own provenance guard exists to stop.

### So why has nothing been learned?

**Because no shop has ever reached `RECONCILED`.** Learning fires in `stepReconcile`, at the end of
a completed cycle — and the cycle has never completed, because the supervised browser step dead-ends
(see [[2026-08-10-finding-supervised-browser-dead-end]], now partly closed by WP-B15-14).

**The learning half is not missing. It is downstream of the gap I have spent the evening fixing.**

### Corrected disposition

**No order is raised for this, and the worktree I cut for it has been removed.** The right sequence
is: finish the journey → a shop reconciles → alias enrichment runs for the first time → then judge
from real rows whether Warwick is still asked things he has already answered. **If he is, the fix is
in the resolver and the alias corpus, not in promoting rules** — and WP-B15-13's remembered-choice
finding (a memory keyed on a different normaliser) is already the more likely culprit.

**What stands from the original document:** two of Warwick's four typed answers on
`SHOP-2026-08-10-M64` expressed standing preferences and nothing durable was written from them. That
observation is still true. What was wrong was my inference about the cause and the fix.
