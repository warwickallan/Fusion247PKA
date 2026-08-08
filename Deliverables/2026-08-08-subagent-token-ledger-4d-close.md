# SUBAGENT LEDGER — BUILD-020 Sub-phase 4D close, 2026-08-08

**Larry-transcribed from the `<usage>` block of every `Agent` return. NOT independently instrumented.**
Any agent that emitted no usage block is **unmeasured, not zero**. Every figure below is read from the
instrument; nothing is estimated.

## Every return, in order

| agent | agent id | fresh/resumed | dispatch | subagent_tokens | tool_uses | duration_ms | model |
|---|---|---|---|---|---|---|---|
| pax | `a066e35e…` | fresh | 1 | 164,764 | 30 | 406,777 | not exposed |
| nolan | `a022c82a…` | fresh | 1 | 147,554 | 26 | 847,724 | not exposed |
| veritas | `ac7e55fe…` | fresh | 1 | 180,484 | 67 | 1,128,436 | not exposed |
| veritas | `ac7e55fe…` | resumed | 2 | 206,112 | 14 | 299,949 | not exposed |
| veritas | `ac7e55fe…` | resumed | 3 | 229,037 | 12 | 288,494 | not exposed |

## ⭐ Cumulative or per-dispatch? — RE-TESTED THIS SESSION, not assumed

The 2026-08-08 observation **still holds**, proven on Veritas's three returns:

- `subagent_tokens` **180,484 → 206,112 → 229,037** — monotonic ⇒ **CUMULATIVE per agent**
- `tool_uses` **67 → 14 → 12** — NOT monotonic ⇒ **PER-DISPATCH**
- `duration_ms` **1,128,436 → 299,949 → 288,494** — NOT monotonic ⇒ **PER-DISPATCH**

**Naively summing the token column gives 927,951 — an overstatement of 386,596 (71 %).**

## A — deduplicated subagent token traffic

| agent | final cumulative | dispatches | total tool uses | total wall time |
|---|---|---|---|---|
| pax | 164,764 | 1 | 30 | 6.8 m |
| nolan | 147,554 | 1 | 26 | 14.1 m |
| veritas | 229,037 | 3 | 93 | 28.6 m |
| **TOTAL A** | **541,355** | **5** | **149** | **49.5 m** |

## B — peak/final context footprint per persistent agent

`pax 164,764` · `nolan 147,554` · `veritas 229,037`. Veritas is the largest, which is expected: three
review rounds against a live estate, with CI fetches and mutation runs.

## C — dispatch and tool-use count per agent

`pax 1/30` · `nolan 1/26` · `veritas 3/93`. Veritas's cost bought three rounds and **three genuine
product corrections** — provenance blind to the whole 4D surface, an attention signal asserted by
nothing, and a false coverage claim in product source. Cost per correction is the honest framing.

## ⛔ Larry's own context is NOT in A, and must never be added to it

Context occupancy is a **level**; subagent traffic is a **flow**. Summing them yields a meaningless
"total tokens". A ratio is the only honest joint statement.

**Larry's own opening and closing context readings are `UNESTABLISHED`** — this session exposes no
instrument Larry can read for them, and inventing a number is worse than the gap.

## Stated uncertainties

- Larry-transcribed, not instrumented; a transcription slip is possible and would not be detectable here.
- Model per agent is **not exposed** in the return.
- `tokens_in` / `tokens_out` are **not exposed** at all — only a single total. Absent, not zero.
- The cumulative/per-dispatch finding is inferred from monotonicity across one agent's three returns.
  It is consistent and re-tested, but it remains an inference about the harness, not a documented contract.
