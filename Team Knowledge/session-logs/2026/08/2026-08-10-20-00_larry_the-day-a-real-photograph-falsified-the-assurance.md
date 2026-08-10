---
title: The day a real photograph falsified the assurance
date: 2026-08-10
session_window: ~15:30 – 20:00 (following the 02:45 night shift log)
author: Larry
build: BUILD-015 AsdAIr
status: session record — lessons are OBSERVATIONS and PROPOSALS, never operating law
---

# The day a real photograph falsified the assurance

Warwick sent one real shopping-list photograph. It exposed nine work packages' worth of defects,
falsified two Veritas verdicts, and produced three amendments to the assurance contract. This is the
record.

## What actually happened

**15:33** — he sent the photograph. **No acknowledgement card.** His words: *"not a good start!"*

The list was nearly lost outright. It was downloaded, the Telegram offset advanced to `consumed`,
and **no shop row was created at all**. The cause: shop identity was the calendar date, a spurious
`SHOP-2026-08-10` already existed from *his own typed answer being ingested as a list the previous
night*, that row had been correctly CANCELLED at 00:49 — and cancelling it **armed the trap**.
`INSERT … ON CONFLICT DO NOTHING` resumed the corpse and wrote nothing. **The cleanup at the end of
one session created the failure at the start of the next.**

Only the downloaded image on disk saved the list.

## What was built (nine work packages, five integrated by the end of this window)

| WP | Outcome |
|---|---|
| B15-07 | a new list never dies in a terminal shop — fresh identity grounded in the inbound message |
| B15-08 | a typed answer is never also a shopping list; dead `Search ASDA` withdrawn; card self-contradiction fixed |
| B15-09 | **ONE question board, edited in place** — the Gate 2 blocker |
| B15-10 | fresh-list scoping; retire the superseded `lines_unresolved` card *(in flight at close)* |
| B15-11 | pack-size rule SHARED; intake CLI can no longer eat a pending list |
| B15-12 | no false `BASKET_READY`; dry-run stops moving real shop state; four unawaited terminations |
| B15-13 | grounding: `VANISH PRETREAT GEL` must find `Vanish Pre-Treat Gel` *(in flight)* |
| B15-14 | the supervised browser step can finish *(in flight)* |
| Silas | migration 019 — the shop owns the list, not the date |

## The governance change, and why Warwick forced it

Veritas had graded *"coherent question surface"* **PASS**. The first real use produced eight
separate cards, no way to tell what was answered, free-text answers double-consumed into four junk
shops, a card announcing *"No candidate products found"* above a list of candidates, and a
**`Search ASDA` button on every card with no handler at all**.

Warwick: *"There is absolutely no point in Veritas if she checks the wrong thing and claims
something works that doesn't."*

Three amendments followed — `65f7375`, `62aa2e8`, `0658290` — each independently read back:

1. **Current readiness is not capability.** Readiness may not be inferred from green tests, wiring,
   reachability, healthy processes or historical journeys. Unexamined load-bearing state ⇒ `HOLD`.
2. **Gate 2 grades the real interface, and Larry does not set its scope.** The accepted user journey
   is scope floor *and* ceiling.
3. **The user-outcome rule binds by REQUIREMENT TYPE, at whatever gate grades it.**

That third one exists because **I filed the first correction against the wrong gate.** The falsified
PASS was a **Gate 1** row; I put every new rule under Gate 2, above a sentence reaffirming Gate 1's
job as unchanged. An independent read-back caught it and Warwick's own test A was not forced. By the
contract's own standard, a formulation that would still have passed that estate had not been
implemented.

---

# LESSONS — observations and proposals. **NOT operating law, and not to be promoted without Warwick.**

**1. I diagnosed from the shape of a symptom instead of measuring, three times, and workers caught
all three.**
- AC1: I said the claim fires and ingestion happens anyway. Keel proved that impossible by reading —
  the real cause was that the claim *deliberately declines replies*.
- AC5: I blamed a parser that never ran on the photographed path; the number came from the vision
  model.
- AC3: I said no drop route existed. A **"Skip this week"** button had shipped on every card all
  along, and I had told Warwick the opposite.
- AC6: I named the refusal branch that does not acknowledge; the tap went through the one that
  **does**, whose acknowledgement is a toast that expires.

The estate already has a memory for this — *diagnose from the durable rows* — and I did it anyway,
under time pressure, four times in one evening. **The read-back gate is what caught every one.**

**2. I propagated an unverified claim between workers.** I copied "7 pre-existing skill failures"
from one worker's report into another's briefing. The failures were **absent `node_modules` in an
isolated worktree** — the same suite is 325/0 on main. Left alone, two receipts would have carried a
false "pre-existing" claim, which is exactly what Veritas checks. *A green suite on my machine is not
green on yours* — and the inverse is equally true, and I walked into it.

**3. Silent no-op mutations are a harness-hazard CLASS, not a one-off.** Three workers hit them in
one evening, three different ways: a CRLF anchor that matched nothing; a latin1 round-trip on
en-dashes; and `--test-name-pattern` matching **zero tests and exiting 0** — a vacuous green inside
a proof of correctness. Every one *looked orderly*. The countermeasure that worked was the same in
each case: **assert the source actually changed, and assert a non-zero executed count**, before
believing any mutation result.

**4. "Reachable" is not "fired".** `openHandoff` has production callers, traced and proven reachable
by an earlier WP — and has **never executed once**. The same distinction the new Veritas rule draws,
arriving from a different direction. Worth carrying as a general test of any "it's wired" claim.

**5. The fix for one defect created the conditions for the next.** Cancelling the spurious shop was
correct, and it armed the collision that ate the photograph. Nobody could have seen it, because the
precondition did not exist until 34 minutes after the last assurance round finished. **This is the
argument for current-state readiness, in one worked example.**

**6. Workers refusing at their surface boundary is what made the parallelism safe.** Every one of
the five stopped rather than crossing — and two of the most valuable findings of the night
(`resolveByCatalogue`'s tokenisation miss, the supervised dead end) came from a worker that
**reported and stopped** instead of fixing what it could see.

**7. A worker killed my own authorised design, and was right.** I ruled for an allowlist scoping;
Keel built it, the existing suite caught that it silently dropped Warwick's own corrections and the
cockpit's additions, and it **reverted rather than shipped**. Silent partial loss is worse than the
bug it replaced.

**8. MY OWN FINDING BECAME THE AUTHORITY FOR A WRONG DECISION, AND I NEARLY ACTED ON MY SUMMARY
INSTEAD OF THE CODE.**

I wrote a finding saying durable learning was *"built, tested and DELIBERATELY UNWIRED"*. Every word
was true. Hours later I read my own document, inferred *"so wire it"*, and **cut a worktree to
dispatch that**. What stopped me was reading the modules, where `buildAnswerLearning.js` carries a
header written for exactly this moment: *"WHAT MAKES NEXT WEEK'S QUESTION NOT HAPPEN — and it is NOT
the rule. Read this before changing anything here, because the obvious answer is the wrong one."*
Wiring it would have produced audit rows that change no basket.

Two things in this, and the second is the durable one:

- **A finding that states a FACT without its CONSEQUENCE invites the wrong fix.** "Unwired" is a
  fact. "Wiring it would not deliver the outcome, and here is what would" is the thing a later
  reader — including me — actually needs. **A finding should carry what it implies for action, or it
  becomes a trap with my own name on it.**
- **The estate's code comments are load-bearing documentation, not commentary.** Three times tonight
  a comment written by a previous worker prevented a defect: this one, `runner.js reconstruct()`'s
  explanation of the two-arm split, and `deps.js:317`'s reason for the deferral. **Read the comment
  before changing the code it guards.**

*(Recorded because the near-miss is more instructive than the catch. Five times today I diagnosed
from the shape of a symptom; this is the only one where nothing external caught it and the code
itself did.)*

---

## Open at the close of this window

Three workers in flight. Migration 019 queued behind B15-10. **Durable household learning is built,
tested and deliberately unwired — the second half Warwick asked for has never run.** The
remembered-choice normaliser mismatch means an answer given under one spelling is not found under
another. `SHOP-2026-08-10-M64` is **preserved evidence, not the acceptance vehicle**.

**Nothing has been reported complete, accepted or ready.** Veritas's Gate 1 `HOLD` and Gate 2 `FAIL`
at `e0667dc` stand until re-graded under the amended contract, against a clean journey that has not
yet been run.
