# Subagent token ledger — session closing at `781859c`

**Session:** BUILD-015 AsdAIr recovery + BUILD-006 Phases 1–2 close, 2026-08-17 → 2026-08-18.
**Branch:** `main`. **Closing head:** `781859c`.
**Transcribed by Larry from each `Agent` return's `<usage>` block — NOT independently instrumented.**

## Per-dispatch vs cumulative — RE-TESTED this session, not assumed

The 2026-08-08 finding **HOLDS**: `subagent_tokens` is **CUMULATIVE per agent id**, while `tool_uses` and `duration_ms` are **PER-DISPATCH**.

| agent id | subagent_tokens across returns | tool_uses across returns |
|---|---|---|
| `a59d5680…` | 132,465 → 214,132 | 30 → 43 |
| `acde1c31…` | 212,897 → 373,349 | 52 → 119 |
| `a7b2c624…` | 203,342 → 321,535 → 375,227 | 36 → 75 → **51** |

Tokens are monotonic on every resumed agent; `tool_uses` is **not** (75 → 51), which is only possible if that field describes a single dispatch. **Summing every return would have inflated the total by ~26%.**

## A — deduplicated subagent token traffic

Final reading per agent id, counted once.

| agent | id | dispatches | final tokens |
|---|---|---|---|
| keel (intake) | `a7b2c624…` | 3 | **375,227** |
| keel (runtime) | `acde1c31…` | 2 | **373,349** |
| pax (session report) | `a8ac0836…` | 1 | 357,385 |
| keel (basket executor) | `a59d5680…` | 2 | 214,132 |
| veritas (confirm 1) | `a2133dfb…` | 1 | 156,268 |
| veritas (gate 1+2) | `a88dbb5b…` | 1 | 150,425 |
| veritas (confirm 2) | `a35558c5…` | 1 | 135,122 |
| asdair (corrected shop) | `a98aaef0…` | 1 | 134,596 |
| nolan (contract recut) | `ac0dc551…` | 1 | 133,010 |
| asdair (tonight's shop) | `a1a36adb…` | 1 | 132,834 |
| veritas (confirm 3) | `ae13d9a1…` | 1 | 112,186 |
| asdair (resolve answers) | `a0c592c1…` | 1 | 100,995 |
| asdair (verify manifest) | `afebbb78…` | 1 | 73,931 |
| nolan (complexity check) | `abd0812f…` | 1 | 60,299 |
| keel (CDP, stopped by Larry) | `a3290e36…` | 1 | **UNMEASURED** |

**A = 2,509,759 deduplicated subagent tokens** across **15 agents / 19 dispatches**.

⚠️ `a3290e36…` was stopped mid-flight before emitting a usage block: **unmeasured, NOT zero.**

## B — peak footprint per persistent agent

The three resumed Keels hold the largest contexts: **375k · 373k · 214k**. Everything else was single-dispatch. No oversized background agent was left running at rotation.

## C — dispatch and tool-use counts, and where the traffic went

19 dispatches across 15 agents.

| shape | dispatches | tokens | share of A |
|---|---|---|---|
| build (3 Keels) | 7 | 962,708 | **38.4%** |
| assurance (4 Veritas + 2 Nolan) | 6 | 747,310 | **29.8%** |
| session report (Pax) | 1 | 357,385 | 14.2% |
| operational shopping (4 Asdair) | 4 | 442,356 | 17.6% |

**Assurance ran at 0.78 : 1 against build this session** — better than the 1.18 : 1 Pax measured for the BUILD-006 close, and the reason is visible: four Veritas passes on BUILD-006 were front-loaded before the AsdAIr recovery began.

## Uncertainties, stated rather than smoothed

- Larry-transcribed from returns; **not independently instrumented**.
- **Larry's own context is deliberately EXCLUDED from A.** Occupancy is a level, traffic is a flow; summing them produces a meaningless "total tokens". A ratio is the only honest joint statement.
- One agent is unmeasured. All percentages are of **measured** traffic only.
- Two Keel worktrees were cut, and one was found **deleted from disk** by something other than its owner when it resumed — flagged in that return, cause unestablished.
