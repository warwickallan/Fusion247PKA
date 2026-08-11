---
title: Subagent token ledger — 2026-08-11 AsdAIr Gate Zero + live acceptance session
date: 2026-08-11
author: Larry
status: Larry-transcribed from conversation history, NOT independently instrumented. Hand to Pax as input, not as his conclusion.
---

# Subagent ledger

**Methodology note, stated openly:** each `Agent` dispatch return carries a `<usage>` block with
`subagent_tokens`, `tool_uses`, `duration_ms`. Prior-session empirical testing (2026-08-08) found
`subagent_tokens` CUMULATIVE per agent ID across resumed dispatches, while `tool_uses`/`duration_ms`
are PER-DISPATCH. That was **not independently re-verified this session** beyond observing that every
resumed agent below shows a monotonically increasing token figure across its dispatches, which is
consistent with (but does not prove) the cumulative hypothesis holding. Treat the "final cumulative"
column as the best available estimate, not a re-proven fact.

## Per-agent detail

| Agent | Type | Dispatches | Per-dispatch tokens (reported) | Final cumulative tokens | Total tool_uses | Total duration |
|---|---|---|---|---|---|---|
| `a2b702883a8064707` | keel | 3 (fresh, resumed, resumed) | 176,607 / 530,539 / 683,173 | **683,173** | 423 | ~98.6 min |
| `afa533e4abc024a93` | felix | 2 (fresh, resumed) | 329,162 / 351,626 | **351,626** | 224 | ~33.7 min |
| `a350fc3c725ea5e26` | vera | 2 (fresh, resumed) | 195,019 / 223,749 | **223,749** | 117 | ~23.8 min |
| `a9eb8d1c942397976` | veritas (Gate 1) | 2 (fresh, resumed) | 243,376 / 262,755 | **262,755** | 118 | ~19.4 min |
| `a07c3e4a6cc1a234b` | veritas (Gate 2 preflight) | 2 (fresh, resumed) | 228,642 / 249,733 | **249,733** | 107 | ~20.5 min |
| `a355bb8127c640c5c` | asdair | 1 (fresh, refused — zero mutations) | 100,663 | **100,663** | 14 | ~2.5 min |

No agent emitted a return with no usage block this session — none are "unmeasured" by that gap.

## Three totals, never blended

- **A — deduplicated subagent token traffic attributable to this session** (sum of final-cumulative
  column): **683,173 + 351,626 + 223,749 + 262,755 + 249,733 + 100,663 = 1,871,699 tokens.**
- **B — peak/final context footprint per persistent agent**: same as the final-cumulative column
  above — no agent in this session ran long enough in a single dispatch to need a separate peak
  figure from its own final one; Keel's 683,173 is both the peak and the final for that agent.
- **C — dispatch count and tool-use count per agent**: see table. Keel is the heaviest by a wide
  margin (3 dispatches, 423 tool uses, ~99 minutes of agent wall-clock) — proportionate to it owning
  the largest scope (branch integration + Gate Zero repair + two acceptance-critical closeout fixes).

**Larry's own context is deliberately excluded from A.** Context occupancy is a level; subagent
traffic is a flow; summing them produces a meaningless number. Larry went from a fresh session start
to context genuinely maxed (Warwick's own assessment, prompting this rotation) — no numeric reading
of Larry's own token consumption was taken during the session, so that figure is `UNESTABLISHED`
for this ledger; Pax should read it from whatever instrument is actually available at rotation time,
not from Larry's own estimate.

## Uncertainties, stated openly

- Cumulative-vs-per-dispatch token semantics assumed, not re-proven this session.
- No agent's usage block was cross-checked against an independent token count.
- The Asdair dispatch made zero mutations (correctly refused per its own contract) — its 100,663
  tokens and 14 tool uses represent investigation and a well-reasoned refusal, not product work.
