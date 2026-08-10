---
title: Forward correction — the "coherent question surface" PASS was falsified by the first real use
date: 2026-08-10
author: Larry (orchestrator), on Warwick's direct order
status: durable record — corrects forward, rewrites nothing
corrects: the prior Veritas PASS on the coherent-question-surface requirement (WP-B15-3 requirement 2 and its successors)
governs: Team/Veritas - Internal Quality and Truth Assurance/AGENTS.md § "GATE 2 IS NOT GATE 1 AT WIDER SCOPE"
counterexample: SHOP-2026-08-10-M64
---

# The "coherent question surface" PASS was falsified by the first real use of the surface

**Corrects FORWARD. No prior receipt is edited, summarised or deleted.** This is the second
falsification recorded today; the first is
[[2026-08-10-assurance-falsification-current-readiness]] and concerned *current readiness*.
This one concerns *what was graded at all*.

## What was graded PASS

The requirement, in Warwick's words on the active map: **"Coherent question surface — unresolved
questions presented together; one typed reply may answer several where the mapping can be
grounded safely."** It was graded **PASS**.

## What Warwick actually got, on `SHOP-2026-08-10-M64`

Measured from the live estate and from Warwick's own report while using it:

| # | What happened | Evidence |
|---|---|---|
| 1 | **Eight separate question cards**, not one surface | `shop_question` rows 76466-76473, eight distinct `card_message_id` |
| 2 | **He cannot tell what he has answered.** Larry had to query the database and tell him "6 of 8" | the product emits no answered/outstanding state at all |
| 3 | **Free-text answers were double-consumed** — each also created a new shop | `SHOP-2026-08-10-M76`, `M77`, `M79`, `M82`, one per typed reply |
| 4 | **Cards contradict themselves** — *"No candidate products found."* printed directly above suggested products | `renderMessages.js:200-212` vs the Note built at `runtime.js:843-846` |
| 5 | **Obvious grounded matches escalated** — e.g. a reading against a catalogue entry that plainly matches it | Warwick: *"its bloody obvious!"* |
| 6 | **He missed a question** because the surface is fragmented | *"The richmond question I have only just seen now whilst replying to you"* |
| 7 | **A dead control on every card.** *Search ASDA* is declared, rendered, and has NO handler | `inbound_refused … action:"search" … "that button is not a command"` |
| 8 | **The full free-text journey — this-shop decision AND durable household learning — is still not demonstrated** through the real interface | no durable rule was written by any of his four typed answers |

Item 7 deserves its own sentence: **the product draws a button on every question card that it
refuses when pressed, and journals the refusal instead of telling the user.** That shipped under
a PASS on the coherence of that very surface.

## The miss, named precisely

> **Veritas graded technical emission and persistence behaviour rather than the accepted human
> outcome.**

Eight technically successful `question` rows are not evidence that *one coherent question
surface* works. Six `answered` rows in a table are not evidence that Warwick can **tell** he has
answered six. A working answer router is not evidence that free-text interaction works when the
same message also creates another shop.

**This is an ASSURANCE-SCOPE defect.** It is **not** to be explained away as *"more bugs found
in live testing"*, and it is not evidence that independent assurance is pointless — the scope was
wrong, and scope is what this correction fixes.

**Larry's share, again the larger one.** Gate dispatches were composed around the Work Orders and
acceptance criteria Larry had just implemented. **Nothing in any dispatch pointed Veritas at the
Telegram surface Warwick actually uses.** Warwick's correction removes that choice from Larry
entirely: the accepted user journey is now both the scope floor and the scope ceiling, and Larry
may not narrow it.

## What has changed

`Team/Veritas - Internal Quality and Truth Assurance/AGENTS.md`, § **"GATE 2 IS NOT GATE 1 AT
WIDER SCOPE"** (Warwick, 2026-08-10, binding):

- **Gate 1 stays engineering assurance.** Gate 2 answers one binding question — *can the user do
  the promised thing through the REAL production interface, without Larry explaining the
  machinery?*
- **Larry does not control Gate 2 scope.** The active accepted user journey is the scope floor
  **and** ceiling; a dispatch offering a narrower slice does not shrink the gate.
- **Gate 2 must inspect the real human interface** — for a Telegram journey, Telegram. The test:
  *could the user complete this correctly using only the product in front of them, without Larry
  querying the database, explaining hidden state, naming missed cards, or interpreting
  contradictions?* **NO → HOLD/FAIL. UNKNOWN → HOLD.**
- **TECHNICAL CAPABILITY ≠ USER OUTCOME**, stacked on the earlier CAPABILITY vs CURRENT
  READINESS distinction. User outcome may never be inferred from green tests, database rows,
  cards emitted, answers persisted, call-site reachability, historical journeys, **or Larry being
  able to explain the state afterwards.**
- **What a coherent surface must let a user do**, stated generally: see every outstanding
  question, which they answered, which answers were accepted, what remains, whether anything
  still blocks completion, and when they are finished — from the product, not from scrollback.
  **Today's item names appear nowhere in the contract; they are the counterexample, not the rule.**
- **The trigger is the EFFECT, not the wording.** If the practical effect of a conclusion is to
  authorise, recommend, permit, endorse or tell anyone to proceed with a state-dependent live
  journey, the current-readiness and user-outcome rules apply in full. **No wording dodge** —
  this closes the loophole the independent read-back of the first amendment identified.
- **Three verdicts only.** `PASS` · `HOLD` · `FAIL`. *"Confirmed"* describes an individual fact,
  never a fourth top-level verdict — closing the escape hatch the first amendment accidentally
  opened while closing another.

## The discriminating result

**Under the corrected Gate 2 semantics, the estate as Warwick experienced it tonight MUST NOT be
capable of a PASS** on *coherent question surface* or on the end-to-end live shopping journey:

- exact journey: photograph a list → answer the questions → reach a shop he can build;
- real interface: Telegram;
- could he complete it using only the product? **No.** Larry had to read the database to tell him
  what he had answered; a control on every card refuses him; his answers created junk shops; a
  card told him there were no candidates while listing candidates.

**Verdict under the amended contract: `HOLD` or `FAIL`. Never PASS.** **If any formulation of
this amendment would still permit that PASS, the amendment is insufficient and must be rejected.**
