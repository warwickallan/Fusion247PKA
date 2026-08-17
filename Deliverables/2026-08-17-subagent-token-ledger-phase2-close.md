# Subagent token ledger — session closing at `6dd40ba` (BUILD-006 Phase 2 complete)

**Larry-transcribed from the `<usage>` block on every `Agent` return. NOT independently instrumented.**
Any agent that emitted no usage block is **unmeasured, not zero**.

## ⚠️ CUMULATIVE vs PER-DISPATCH — re-tested this session, and the prior finding HOLDS

Where one agent ID returned several times, `subagent_tokens` is **MONOTONIC** across returns while
`tool_uses` and `duration_ms` are **NOT** — e.g. Keel Phase 4 `a7d081aa` returned 169,975 (35 tools) →
413,871 (104) → 437,992 (30). Tool count fell on the third return while tokens rose. **So
`subagent_tokens` is CUMULATIVE per agent ID; `tool_uses` and `duration_ms` are PER-DISPATCH.**
Summing every return would roughly double the true figure.

**Total A below therefore takes the FINAL (highest) reading per agent ID, never the sum of its returns.**

## Per-agent, final reading

| agent | role | disp. | final `subagent_tokens` | tool uses (last) |
|---|---|---|---|---|
| `a5e2d5b2` | Keel — Phase 1 WP-1 | 4 | 349,205 | 23 |
| `a7d081aa` | Keel — Phase 4 WP-4 | 3 | 437,992 | 30 |
| `afd9e08e` | Keel — Phase 3 WP-3 | 3 | 349,205 | 1 |
| `a449a591` | Keel — Phase 2 WP-2 | 2 | 267,978 | 90 |
| `aa038c2d` | Keel — BUILD-015 F-1 | 3 | 236,396 | 13 |
| `a6329b15` | Keel — convergence fixes | 3 | 206,290 | 12 |
| `a7c549b1` | Keel — BUILD-015 F-3 | 2 | 160,437 | 54 |
| `a7dafb17` | Veritas — WP-1 Gate 1 | 1 | 198,520 | 46 |
| `a9dd4615` | Veritas — WP-4 Gate 1 | 1 | 190,866 | 67 |
| `ac187620` | Veritas — F-1 Gate 1 | 1 | 183,609 | 67 |
| `a384d769` | Veritas — WP-3 Gate 1 | 1 | 182,853 | 59 |
| `aca5d45d` | Veritas — WP-2 Gate 1 | 1 | 177,140 | 38 |
| `a70bc27b` | Veritas — PR #111 Gate 1 | 1 | 151,368 | 41 |
| `aed6b440` | Veritas — F-3 Gate 1 | 1 | 128,994 | 35 |
| `a6168eb4` | Veritas — D-1 confirmation | 2 | 128,860 | 3 |
| `a67afb18` | Explore — Codex contract integrity | 1 | 153,883 | 53 |
| `a09310626` | Explore — excluded-surface adjudication | 1 | 120,243 | 48 |
| `a1e3167d` | Explore — lost Tower route | 1 | 116,078 | 43 |
| `a4d237ea` | Explore — Phase 1 preflight census | 1 | 91,767 | 44 |
| `a419d70c` | Explore — BUILD-015 Codex coverage | 1 | 88,584 | 29 |
| `a1b8ded3` | Explore — why /reconcile missed | 1 | 82,675 | 35 |
| `ae5c9992` | Explore — B15 release scope | 1 | 75,796 | 34 |
| `ac7b7716` | Explore — render-gate diagnosis | 1 | 65,286 | 16 |
| `a3cb9621` | Explore — gateway reality | 1 | 45,532 | 20 |

## The three totals — never blended

**A — deduplicated subagent token traffic:** **≈ 4,189,557** (sum of final readings, 24 agents, 37 dispatches).

**B — peak footprint per persistent agent:** the four multi-dispatch Keel instances dominate —
`a7d081aa` 437,992 · `a5e2d5b2` and `afd9e08e` 349,205 each · `a449a591` 267,978. **Every Veritas ran
single-dispatch**, so no reviewer accumulated a large persistent context.

**C — dispatch and tool counts:** 37 dispatches across 24 agents. Builders (7 Keel instances, 20
dispatches) carried the implementation; reviewers (9 Veritas dispatches) and read-only investigators
(9 Explore) the rest.

⛔ **Larry's own context is NOT included in A and must never be added to it.** Occupancy is a *level*;
subagent traffic is a *flow*. Only a ratio is an honest joint statement.

## Stated uncertainties

- Larry-transcribed, not instrumented; a mis-transcribed figure is possible.
- The cumulative/per-dispatch determination is inferred from monotonicity, not from documentation.
- `tool_uses` shown is the **last** dispatch's, not a session total.
- Codex executions ran through `reviewDiff.mjs` and the Tower watcher and emit **no** usage block here —
  **unmeasured, not zero**, and a material omission given how many review rounds ran.
