# Subagent token ledger — session 2026-08-09 (BUILD-015 · migration 017 · B15-3 · Lane C)

**Built by Larry at `/rotate` step 5b, transcribed from the `<usage>` block of every `Agent` return.**
**Handed to Pax as an input** so per-specialist usage is never reported `UNESTABLISHED` again.

> ⚠️ **This ledger is Larry-transcribed, not independently instrumented.** Every figure below is read
> from a `<usage>` block in an agent return. Any agent that emitted no usage block is **unmeasured,
> not zero**.
>
> ⚠️ **TWO AGENTS WERE STILL RUNNING WHEN THIS WAS WRITTEN.** `a71d28ce…` and `a8b4c945…` were each
> resumed a third time (the "build" go-ahead) after their last observed return. **Their true final
> figures are HIGHER than recorded here.** These are as-at-last-observed, not final.

---

## Every return, in order

| # | Agent type | Agent ID | Fresh/resumed | Dispatch | `subagent_tokens` | `tool_uses` | `duration_ms` | Verdict |
|---|---|---|---|---|---|---|---|---|
| 1 | keel | `a7e420aa52af1635c` | fresh | 1 | 138,580 | 18 | 392,729 | **REFUSE** |
| 2 | Explore | `aa381d475390a1940` | fresh | 1 | 248,516 | 61 | 617,024 | completed |
| 3 | keel | `aef9bdbe5eb175c5e` | fresh | 1 | 110,715 | 19 | 226,786 | **REFUSE** |
| 4 | keel | `ac471641593c3a54c` | fresh | 1 | 119,914 | 25 | 296,791 | **REFUSE** |
| 5 | keel | `a71d28ce5aa9a45f4` | fresh | 1 | 151,437 | 38 | 520,871 | **CLARIFY** |
| 6 | keel | `a8b4c945639a28d70` | fresh | 1 | 163,891 | 29 | 419,260 | **CLARIFY** |
| 7 | keel | `a71d28ce5aa9a45f4` | **resumed** | 2 | 167,151 | 1 | 66,068 | **CLARIFY** |
| 8 | keel | `a8b4c945639a28d70` | **resumed** | 2 | 190,538 | 9 | 196,885 | **HOLD** |

**Model:** not exposed in any usage block. **UNESTABLISHED.**

---

## Cumulative-vs-per-dispatch — RE-TESTED this session, not assumed

The 2026-08-08 observation was that `subagent_tokens` is **cumulative per agent** while `tool_uses`
and `duration_ms` are **per-dispatch**. The instruction is to re-test rather than inherit it.

**Re-tested on both resumed agents, and it still holds:**

| Agent | `subagent_tokens` across dispatches | Monotonic? | `tool_uses` across dispatches | Monotonic? |
|---|---|---|---|---|
| `a71d28ce5aa9a45f4` | 151,437 → 167,151 | **yes (+15,714)** | 38 → 1 | **NO** |
| `a8b4c945639a28d70` | 163,891 → 190,538 | **yes (+26,647)** | 29 → 9 | **NO** |

**Both agents show tokens rising while tool counts fall**, which is only consistent with tokens being
cumulative and tool counts per-dispatch. Return #7 in particular used **one** tool call yet reported
**+15,714** tokens — a resumed agent re-reading its own transcript, not doing 167k of fresh work.

**⛔ Summing the `subagent_tokens` column would give 1,290,742 and would be WRONG by ~24 %.**

---

## The three totals

### A — deduplicated subagent token traffic: **975,414**

Final observed value per **agent ID**, never a column sum.

| Agent ID | Final observed | Note |
|---|---|---|
| `a7e420aa52af1635c` | 138,580 | complete |
| `aa381d475390a1940` | 248,516 | complete |
| `aef9bdbe5eb175c5e` | 110,715 | complete |
| `ac471641593c3a54c` | 119,914 | complete |
| `a71d28ce5aa9a45f4` | 167,151 | **still running — floor, not final** |
| `a8b4c945639a28d70` | 190,538 | **still running — floor, not final** |
| **A** | **975,414** | **a FLOOR** |

### B — peak/final context footprint per persistent agent

The two long-lived agents are the largest: **`a71d28ce…` ≥167k** and **`a8b4c945…` ≥190k**, each
still growing. The single biggest footprint is the one-shot **Explore trace at 248,516** — the most
expensive agent of the session and, on the evidence, the most valuable: it produced the seven-question
production call-path map that located the dead `handoff/` package, the CI gap and the tab-per-item
cause.

### C — dispatch and tool-use count per agent

| Agent ID | Dispatches observed | Tool uses (summed per-dispatch) |
|---|---|---|
| `a7e420aa52af1635c` | 1 | 18 |
| `aa381d475390a1940` | 1 | 61 |
| `aef9bdbe5eb175c5e` | 1 | 19 |
| `ac471641593c3a54c` | 1 | 25 |
| `a71d28ce5aa9a45f4` | 2 (+1 running) | 39 |
| `a8b4c945639a28d70` | 2 (+1 running) | 38 |
| **Total** | **8 returns** | **200** |

---

## ⛔ Larry's own context is DELIBERATELY EXCLUDED from A

Larry's occupancy at rotation is **~560k and is a LEVEL**; subagent traffic is a **FLOW**. Adding them
produces a meaningless "total tokens". **The only honest joint statement is a ratio:** roughly
**1.7 : 1** subagent flow to Larry's final level — and even that compares two different kinds of
quantity and should be read as an order of magnitude, not a measurement.

---

## The finding this ledger exists to make visible

**Four of the eight returns are `REFUSE`. Two more are `CLARIFY`. One is a `HOLD`.**
**Not one Work Order reached a worker in a buildable state on first dispatch.**

**Token cost of refused or clarified orders: 975,414 — effectively the entire subagent spend of the
session**, against **zero lines of product code written by any worker.**

**That is not worker failure.** Every refusal was correct and each one found something Larry had
missed — the CI gap hiding 213 unrun tests, the real tab-per-item cause in two files, the
`Builds/**` precedence trap, and an outbox kind with no renderer that would have reproduced the very
silent-drop defect its own acceptance criterion existed to close.

**It is dispatch failure, and it is banked as a CAPA in 4F** —
`Deliverables/2026-08-04-proofline-wayfinder-plan.md`, *"THE WORK ORDER READINESS GATE IS A SYNTAX
CHECK WEARING A SEMANTICS BADGE"* (`63c9e18` on `build-020/4f-control-cost-evidence`).

**Pax should treat the ratio of refused-order tokens to product-change tokens as the headline
delivery-tax figure of this session.**
