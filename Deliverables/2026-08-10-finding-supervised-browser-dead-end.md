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
