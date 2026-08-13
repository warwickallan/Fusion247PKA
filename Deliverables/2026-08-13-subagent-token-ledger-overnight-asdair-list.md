---
title: "Subagent token ledger — overnight session, BUILD-015 AsdAIr, 2026-08-12/13"
date: 2026-08-13
author: Larry (transcribed, NOT independently instrumented)
build: BUILD-015 AsdAIr
purpose: "/rotate step 5b — input to Pax's session report. Larry holds this data; Pax cannot see it."
session_range: 4e6508d (session start) → 80b5cd3 (closing head)
---

# Subagent token ledger

**⛔ Provenance and its limits, stated first.** Every figure here is **transcribed by Larry from the
`<usage>` block on each `Agent` return**. It is **not independently instrumented**, no tool verified it, and
a transcription error would be invisible. Any agent that emitted no usage block would be **unmeasured, not
zero** — none was observed this session, but that is an observation, not a guarantee.

## The cumulative-vs-per-dispatch test — RE-RUN, not assumed

The 2026-08-08 ledger found `subagent_tokens` **CUMULATIVE per agent** while `tool_uses` and `duration_ms`
were **PER-DISPATCH**. `/rotate` §5b requires re-testing rather than inheriting that. **Re-tested on this
session's nine resumed agents:**

- **`subagent_tokens` is monotonically non-decreasing across every resumed agent, without exception**
  (9 of 9). Consistent with cumulative.
- **`tool_uses` is NOT monotonic** — `nolan` 15 → 19 → **8**; `keel/WP-B15-31` 42 → 56 → **39**;
  `keel/WP-B15-35` 34 → 164 → **56**; `felix` 206 → **31**. Four independent falsifications. Consistent
  with per-dispatch.

**Verdict: the 2026-08-08 finding STILL HOLDS.** Tokens cumulative, tool-uses and duration per-dispatch.

**⚠️ Why this matters more than it looks:** summing every return's token figure gives **6,027,922**.
Deduplicating to the final value per agent gives **3,818,356**. **A naive sum inflates the total by ~58%.**

## A — deduplicated subagent token traffic (final value per agent ID)

| # | Agent type | Agent ID | Dispatches | Final `subagent_tokens` | Tool uses (Σ per-dispatch) |
|---|---|---|---:|---:|---:|
| 1 | asdair | `a10cbe60…` | 1 | 79,273 | 21 |
| 2 | general-purpose (recon) | `a2387574…` | 2 | 219,148 | 72 |
| 3 | keel — WP-B15-29 | `a8b3cc8c…` | 2 | 319,334 | 126 |
| 4 | keel — WP-B15-30 | `aaf3200a…` | 2 | 431,674 | 163 |
| 5 | nolan — contract amendment | `a6f8f22e…` | 3 | 134,093 | 42 |
| 6 | keel — WP-B15-31 | `aab0fcb4…` | 3 | 334,733 | 137 |
| 7 | veritas — amendment review | `a1a305e5…` | 1 | 138,980 | 22 |
| 8 | veritas — F1 confirmation | `a0466798…` | 1 | 117,682 | 14 |
| 9 | keel — WP-B15-32 variance | `ac8d0bd8…` | 2 | 190,203 | 64 |
| 10 | keel — WP-B15-33 | `a585f7ca…` | 2 | 312,028 | 118 |
| 11 | keel — WP-B15-34 vision final | `acb11bba…` | 1 | 333,298 | 192 |
| 12 | keel — WP-B15-35 cockpit backend | `af007a70…` | 3 | 368,544 | 254 |
| 13 | felix — WP-B15-36 cockpit UI | `a1f0a80e…` | 2 | 407,991 | 237 |
| 14 | vera — UI quality gate | `a03d4903…` | 1 | 134,190 | 26 |
| 15 | keel — WP-B15-37 Lane A | `a2d733bc…` | 1 | 297,185 | 120 |
| | **TOTAL A** | **15 agents** | **27** | **3,818,356** | **1,608** |

## B — peak/final context footprint per persistent agent

Identical to the final-value column above, by construction: for a cumulative counter the final reading **is**
the peak. **The four largest footprints are `felix` (407,991), `keel/WP-B15-30` (431,674),
`keel/WP-B15-35` (368,544) and `keel/WP-B15-34` (333,298)** — all long-running implementation agents, which
is where an oversized background agent would show up if one existed.

## C — dispatch and tool-use counts

**27 dispatches to 15 agents; 1,608 tool uses.** Mean 1.8 dispatches per agent; **9 of 15 were resumed at
least once**, and every resume was an amendment round-trip after a read-back found a defect in Larry's own
order.

**Highest tool-use-per-dispatch:** `keel/WP-B15-34` at **192 in a single dispatch** (the controlled
positional-field comparison) and `felix` at **206 in its first** (a full render-verified UI build).

## ⛔ Larry's own context is NOT in this ledger, and must never be added to it

Context occupancy is a **level**; subagent traffic is a **flow**. Adding them yields a meaningless "total
tokens". **A ratio is the only honest joint statement**, and Larry's own figure is not read from an
instrument here, so no ratio is asserted.

## Uncertainties, stated rather than smoothed

- **Larry-transcribed, not instrumented.** No tool produced this table.
- **`subagent_tokens` semantics are inferred from monotonicity**, not from documentation. The inference is
  re-tested and four-times falsified in the other direction for `tool_uses`, but it remains an inference.
- **Duration is per-dispatch and NOT summed here** — wall-clock overlaps heavily across parallel lanes, so a
  sum would misrepresent elapsed time. Pax should take elapsed session time from the transcript, not from
  this ledger.
- **Cost is not derived.** Token counts are not dollars; the gateway spend measured by the workers
  themselves (~$2.61 vision + ~$1.02 variance + ~$0.43 + ~$0.05 probes) is a **separate, independently
  measured figure** and must not be conflated with subagent token traffic.
