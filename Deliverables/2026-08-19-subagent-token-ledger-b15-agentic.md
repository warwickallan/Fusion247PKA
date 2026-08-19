# Subagent token ledger — session closing 2026-08-19

**Input to the Pax session report, per `/rotate` step 5b.** Larry holds this data and Pax cannot see it;
leaving it `UNESTABLISHED` when it could be supplied is the failure that step closes.

**Provenance and its limit, stated first.** Every row is transcribed by Larry from the `<usage>` block of
an `Agent` return in this session's transcript. It is **not independently instrumented**. An agent that
emitted no usage block is **UNMEASURED, not zero**.

---

## The empirical test — re-run, not assumed

The 2026-08-08 ledger established that `subagent_tokens` was **cumulative per agent id** while
`tool_uses` and `duration_ms` were **per-dispatch**, and instructed the next rotation to re-test rather
than inherit it. Re-tested here across **11 agents with more than one dispatch**:

| Field | Monotonic across dispatches? | Therefore |
|---|---|---|
| `subagent_tokens` | **yes**, in all 11 | **CUMULATIVE per agent id** |
| `tool_uses` | **no** (e.g. `34, 41, 41, 9, 18, 23, 28, 32`) | **PER-DISPATCH** |

**The finding still holds — and the cost of getting it wrong has doubled.**

```
A  deduplicated (max per agent id) : 4,702,385
   naive sum of every return       : 9,431,774   → +101% overstatement
```

Last rotation the same error would have inflated the total by ~80 %. **This session it would have
doubled it.** The deduplication is the difference between a real figure and a fiction.

---

## A — deduplicated subagent token traffic

**4,702,385 tokens**, across **17 agents** and **39 dispatches**.

**One agent is UNMEASURED, not zero:** `ab5aa89b3288aa9aa` (keel, WO-2026-08-18-05) was **killed by Larry
mid-read** on Warwick's instruction before it wrote anything, and emitted no usage block. Its cost is
real and unrecorded.

---

## B — final context footprint per agent, and C — dispatches and tool uses

Sorted by footprint, because that is what makes an oversized persistent agent visible.

| Final footprint | Dispatches | Tool uses | Wall time | Agent | Work |
|---:|---:|---:|---:|---|---|
| 459,251 | 3 | 230 | 52 m | keel | WO-06 MODEL DECIDES |
| 438,306 | **8** | 226 | 68 m | keel | WO-2026-08-19-01 lane and trolley |
| 411,253 | 2 | 175 | 46 m | keel | WO-07 board and lane |
| 393,129 | 2 | 149 | 34 m | keel | WO-04 audited answer correction |
| 355,376 | 4 | 146 | 67 m | vera | correction-control gate ×3 |
| 351,269 | 4 | 279 | 65 m | felix | cockpit correction control |
| 324,828 | 1 | 61 | 21 m | pax | session report (carried through the `/clear`) |
| 290,684 | 2 | 194 | 40 m | keel | WO-2026-08-19-03 cockpit parity |
| 281,107 | 2 | 52 | 15 m | keel | WO-03 answer-binding repair |
| 279,081 | 2 | 127 | 28 m | keel | WO-01 photo-path proof |
| 206,935 | 1 | 68 | 13 m | veritas | Gate 2 re-review — HOLD |
| 202,689 | 2 | 83 | 19 m | keel | WO-2026-08-19-02 grants |
| 196,083 | 2 | 79 | 17 m | asdair | WO-02 photo-door readiness |
| 187,993 | 1 | 72 | 18 m | nolan | SOP-021 standing-law conflict |
| 177,476 | 1 | 55 | 11 m | veritas | Gate 2 — FAIL |
| 146,925 | 1 | 40 | 10 m | nolan | propagate the approved contract |
| **UNMEASURED** | 1 | — | — | keel | WO-05 — killed before writing |

**Totals: 17 agents · 39 dispatches · 2,036 tool uses · 8.8 h of subagent wall time.**

⚠️ **That 8.8 h is CONCURRENT, not elapsed.** Up to four agents ran at once. It is a measure of work
done, never of session duration.

---

## Larry's own context — reported SEPARATELY and never added to A

**≈ 220,300 tokens** consumed against this session's budget counter (`15,000,000` → `14,779,691`).

**What that figure is, precisely:** the harness's session budget counter for the main loop. It is **not**
a context-window occupancy reading, and it is **not** comparable to a subagent's cumulative
`subagent_tokens`.

⛔ **It must not be added to A.** Context occupancy is a **level**; subagent traffic is a **flow**.
Summing them produces a meaningless "total tokens". **The only honest joint statement is a ratio:**

> **≈ 21 tokens of delegated subagent work per token of Larry's own context.**

That ratio is the argument for delegation, and it is also the number to watch if it ever inverts.

---

## Uncertainties, stated rather than buried

- **Larry-transcribed, not instrumented.** A missed return is invisible to this ledger.
- **One agent unmeasured** (killed pre-write). Real cost, unrecorded.
- **`subagent_tokens` semantics are inferred from monotonicity**, not from documentation. The inference
  is strong — 11 of 11 agents monotonic in tokens, and `tool_uses` demonstrably not — but it is an
  inference.
- **Wall time is concurrent.** Any elapsed-time claim must come from timestamps, not from this column.
- **Model attribution is not exposed** in the usage block; no per-model breakdown is possible.
