---
title: FINDING — the supervised browser step has no route back to BASKET_READY
date: 2026-08-10
author: Larry, established by execution
status: OPEN — real gap in the accepted journey, not yet fixed
severity: blocks the last mile of the accepted user outcome
found_via: WP-B15-12 read-back (Keel), then independently established by Larry
---

# The supervised browser step cannot complete

**Established by reading, at `ce84d94`. Not taken on report — Keel raised it at the boundary of its
surface and stopped, correctly; Larry then traced it independently.**

## The gap

A shop that reaches `SHOPPING` has **no automated route to `BASKET_READY`**.

| Evidence | Where |
|---|---|
| The pipeline WAITS on `SHOPPING` and never advances it | `stages.js` — `case 'SHOPPING': return decision(STEPS.AWAIT_BASKET, 'the supervised runner is building the basket')` |
| The transition is documented as coming from the supervised runner | `stages.js:91` — `SHOPPING … to: 'BASKET_READY | NEEDS_DECISION', waitsFor: 'the supervised browser runner'` |
| The ONLY writer of that transition in the whole estate | `browser-runner/runner.js` `finishBasketReady()` → `store.setShopStatus(SHOPPING → BASKET_READY)`. Grepped across `services/**`; there is no other. |
| …and that writer refuses on the production route BY DESIGN | `runner.js reconstruct()` — the supervised route consumes `progress.handoff`, the CDP arm consumes `progress.plan`, and **nothing on the production route writes `progress.plan`**, so the arm throws `NoExecutablePlanError` |
| The supervised completion module does not set shop status | `handoff/completion.js` validates line reports and feeds reconciliation; it writes no shop status |

**So after Warwick taps *Build ASDA basket*, the shop moves `WAITING_FOR_BROWSER` → `SHOPPING` and
then stops.** It can only proceed if a human drives the CDP runner with `--plan-file`, or somebody
runs `shop-cli transition` by hand.

## Why this matters more than it looks

This is a **manual step inside a journey nobody has declared manual**, which is precisely what root
`CLAUDE.md` § "Nothing may live only in Larry's head" exists to prevent:

> *a mechanism is not complete while any required production step depends on Larry remembering, an
> interactive shell, session-local state, a manual invocation, or Warwick reminding him.*

It is also consistent with the observed estate: `SHOP-2026-08-09` sits at `READY_TO_SHOP` with three
live browser requests and has never reached `SHOPPING`, so the gap has never been exercised.

## What is NOT in doubt

- The CDP arm refusing a supervised handoff is **correct and deliberate**, and must not be "fixed"
  by synthesising a step plan from a handoff. `runner.js` explains at length why that would be the
  real defect: a known line with no usable ASDA reference travels a retrieval contract, and the only
  allowlisted step that adds a searched product needs a `product_ref` that line does not have.
  Synthesising one would be the least-bad match this estate refuses everywhere else — while holding
  the trolley.
- Asdair is **the sole trolley writer against the live ASDA session** (`Team/Asdair …/AGENTS.md`).
  That decision stands and is not reopened here.

## The actual missing piece

**A route by which a supervised session's completion becomes durable shop state.** Asdair drives the
browser; nothing carries "the basket is built" back into `asdair.shop`. `handoff/completion.js` is
the natural home — it already ingests a line-by-line report and feeds reconciliation — but it
deliberately writes no shop status today.

## Disposition

**Not a new product decision.** Warwick's accepted outcome already requires supervised browser
operation ending in a basket he can check out, and his standing authority of 2026-08-10 is to finish
accepted work without asking. **What remains is engineering: give the supervised completion a
durable, observable route to `BASKET_READY`, subject to the same rule WP-B15-12 is installing —
never claim a basket that was not built.**

**Sequenced, not dropped.** Four workers are live on disjoint surfaces and Silas holds an open schema
decision. This is written down so it survives a rotation and is not rediscovered later, which is the
whole point of recording it rather than carrying it.

---

## ADDENDUM — 2026-08-10, later the same evening. The gap is wider than the transition.

**No handoff artefact has ever been written to a real browser request.** Measured read-only against
the live store:

```
asdair.browser_build_request — every row
  id 5  shop 6  running    has_handoff=false  has_plan=true
  id 4  shop 6  complete   has_handoff=false  has_plan=true
  id 3  shop 6  complete   has_handoff=false  has_plan=true
  id 2  shop 2  queued     has_handoff=false  has_plan=true
  id 1  shop 1  running    has_handoff=false  has_plan=false
```

**Every request that carries a payload carries `plan`, never `handoff`.** The two `complete` rows
are historical CDP runs driven from a supplied plan file. `openHandoff` — the producer of the
supervised artefact — **has never fired on a real request.**

**What this adds to the finding above.** The dead end is not only that a completed supervised build
has no route back to `BASKET_READY`. It is that **the supervised route has never run at all**: no
artefact has been produced, so nothing has ever been handed to an operator, so its content has never
been read by anyone who then had to shop from it.

**Consequence for Warwick's item 11** — *"handoff must contain actual executable shopping
instructions."* **That property is currently UNPROVEN and cannot be proven from the estate**, because
no real handoff exists to inspect. `buildHandoff.js` is pure, deterministic and well-tested against
fixtures, and WP-B15-07 traced its production callers as reachable — but reachable is not fired.
This is the same distinction the Veritas contract now draws between capability and current
readiness, arriving from a different direction.

**Not a new defect. A named limit**, so that nobody reports item 11 as satisfied on the strength of
`buildHandoff`'s test suite. The first real handoff will be generated by the first shop that reaches
the browser step — which is the same event WP-B15-14 exists to let complete.

**Minor, recorded not chased:** requests 1 and 5 sit `running` on old shops (1 and 6) with no runner
holding them — the three "live browser requests" the status tool reports. Stale lease state on dead
shops, no effect on the current journey.

---

## CORRECTION — 2026-08-10. **This was already recorded. I rediscovered a known-open row.**

**The Wayfinder had this before tonight**, in its own open-items table:

> | 4 | No basket writer | **OPEN** | The ruled writer is supervised Sonnet in Claude for Chrome
> (`RUNTIME-DECISION.md`); the handoff artefact it would consume is unreachable; **no programmatic
> invocation surface exists, deliberately** (`996a838`: "none was invented"). The CDP runner remains
> experimental and prohibited from live-account testing. **No basket has ever been built by the ruled
> route.** |

The sections above are still **true and independently established**, and the three-hop breakdown and
the "no handoff has ever been written" measurement are genuinely new detail. But the headline —
*the supervised route has never run* — was **already on the map**, and this document was written as
though establishing it fresh. Recording that plainly, because a finding that overstates its own
novelty is the same defect class as a receipt that overstates its evidence.

### What the record settles, so nobody re-opens it as a question

- **The ruled Stage 1 basket writer is Sonnet in Claude for Chrome**, supervised
  (`RUNTIME-DECISION.md` — *"A fresh instance must not be left choosing between Sonnet, Larry and
  the CDP runner. The answer is Sonnet in Claude for Chrome."*).
- **The absence of a programmatic trigger is DELIBERATE**, not an omission.
- **The completion step IS specified** — `CANONICAL-WEEKLY-SHOP-PROCESS.md` §G *"Verify the basket,
  then hand back"*: after Sonnet finishes, reconcile expected against actual, identify unavailable
  products **without substituting**, confirm no checkout or payment occurred, and only then hand
  back *«Basket ready for Warwick to review and order.»*
- **Warwick accepted the supervised bar** on 2026-07-28: *"The accepted bar is SUPERVISED, not
  hands-off."* A human in the weekly loop is the agreed design, not a defect.
- That same document already says of itself: *"This document describes the process Warwick
  commissioned. It is **not** a description of what the code does today."*

### Therefore — disposition CORRECTED

**This is NOT a new product decision and Warwick is not being asked one.** §G is already
commissioned; what is missing is that its handback is a **message**, while nothing writes the
durable state transition or routes the operator's report into `completeHandoff`. **Implementing a
commissioned process is engineering**, and it falls squarely inside his standing authority of
2026-08-10.

**What remains genuinely undecided is nothing.** The route is ruled, the process is written, the bar
is accepted. The work is to make the code match the record — which is the same sentence
`CANONICAL-WEEKLY-SHOP-PROCESS.md` has been carrying about itself since 2026-08-04.

---

## SELF-CORRECTION — the record reconciliation was incomplete, and luck closed it

**Recorded because a verification that reports success while missing something is the exact class of
defect this whole day has been about.**

Earlier tonight I reconciled 11 documents that existed on `origin/main` and not on local `main`, and
verified the result with:

```
git diff --numstat HEAD origin/main | awk '$2==0 && $1>0 {print $3}' | wc -l   →  0
```

**That instrument was wrong for the question.** `--numstat` counts line changes, so it conflates
"file absent here" with "file present but differing", and it reports a one-line DELETION on main as
an addition on origin — `services/asdair/intake/package.json` shows up that way purely because I
removed the `npm run fetch` script.

**It also missed a real file.** `Deliverables/2026-08-09-wo-b15-03-terra-order.md` was on
`origin/main` and absent from `main`. It reached `main` only because WP-B15-14's worker merged
`origin/main` into its branch — the unauthorised merge I flagged it for — and I then integrated that
branch. **A process breach fixed a gap my own verification had declared closed.**

**The correct instrument, and the one to use in future:**

```
git diff --diff-filter=A --name-only HEAD origin/main    → files present on origin, ABSENT here
```

Run now, it returns **zero**. The record side of the estate is genuinely converged — but it is
converged by accident on one file, and the claim I made earlier was not supported by the check I ran
to support it.

**No product code was ever stranded**; that half of the earlier claim was verified separately and
holds.
