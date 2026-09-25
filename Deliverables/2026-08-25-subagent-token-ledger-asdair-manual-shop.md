# Subagent token ledger — session 2026-08-24/25 (BUILD-015, manual collaborative shop)

Reconstructed from the `<usage>` blocks Larry receives on every `Agent` return. Larry holds this data;
Pax cannot see it — supplied here per `/rotate` step 5b so it is never reported `UNESTABLISHED` when it
didn't need to be.

**Session span:** 2026-08-24 (session start) through 2026-08-25 (this rotation), crossing midnight
mid-session. All dispatches below are agent type `asdair`. No agent was resumed via `SendMessage` this
session — every dispatch below has a distinct agent ID and ran exactly once, so the cumulative-vs-
per-dispatch question that mattered in earlier sessions does not arise here: every figure below is a
single dispatch's own usage, not a running total.

## Per-return record

| # | Agent ID | Label | Fresh/resumed | Dispatch # | `subagent_tokens` | `tool_uses` | `duration_ms` | Model |
|---|---|---|---|---|---|---|---|---|
| 1 | `a9012750c351f4375` | AsdAIr runtime reconnaissance | Fresh | 1 | **UNMEASURED** (task returned `stopped`, no completion record) | UNMEASURED | UNMEASURED | not reported |
| 2 | `aad603211f366887d` | Resume AsdAIr reconnaissance (re-dispatched fresh, not a true resume — new agent ID) | Fresh | 1 | 105,024 | 33 | 390,806 | not reported |
| 3 | `a1bca8821d36aa23c` | Resolve shopping list against catalogue | Fresh | 1 | 133,249 | 22 | 358,507 | not reported |
| 4 | `ac2085cf456b44f2d` | Bank two standing shopping rules | Fresh | 1 | **UNMEASURED** (task returned `stopped`, no completion record) | UNMEASURED | UNMEASURED | not reported |
| 5 | `a027954d1f04a9073` | Record this week's shop in Supabase | Fresh | 1 | 331,460 | 83 | 1,312,458 | not reported |

**Rows 1 and 4 are unmeasured, not zero.** Both were interrupted by a session pause/resume (the harness
resumed this session mid-run at least twice tonight) and returned `stopped` with no `<usage>` block. Row
4's intended work (banking the two standing rules) was subsequently completed and verified as part of
agent 5's dispatch, which checked for and found no trace of row 4's write ever having reached the
database — confirming row 4 genuinely did no durable work, not merely that its tokens are unknown.

## A — deduplicated subagent token traffic attributable to this session

**569,733 tokens** measured, across 3 agents with a reported `<usage>` block. **Plus an unknown amount
from 2 further dispatches (rows 1, 4) that never reported usage** — do not treat the 569,733 figure as
the whole cost of subagent work tonight; it is a floor, not a total.

⛔ **This is kept separate from Larry's own context occupancy**, per the standing instruction — context
occupancy is a level, subagent traffic is a flow, and summing them produces a meaningless number.

## B — peak/final context footprint per persistent agent

Not applicable this session — no agent was persistent or resumed. Each of the 5 dispatches is a single
fresh agent that ran once and returned (or stopped) once. Final footprint = the single figure in column
`subagent_tokens` above, where measured.

## C — dispatch count and tool-use count per agent

| Agent ID | Dispatches | Tool uses | Duration |
|---|---|---|---|
| `a9012750c351f4375` | 1 | UNMEASURED | UNMEASURED |
| `aad603211f366887d` | 1 | 33 | 6m 31s |
| `a1bca8821d36aa23c` | 1 | 22 | 5m 59s |
| `ac2085cf456b44f2d` | 1 | UNMEASURED | UNMEASURED |
| `a027954d1f04a9073` | 1 | 83 | 21m 52s |

**Total measured tool uses across the session's subagents: 138** (rows 1 and 4 excluded, unmeasured not
zero). **Total measured subagent wall-clock: ~34m 22s** (excluding rows 1 and 4) — note this is elapsed
time per background dispatch, not necessarily serial; several ran while Larry (and Warwick, live in
chat) did other work concurrently.

## Explicit uncertainties

- This ledger is **Larry-transcribed from tool-result text**, not independently instrumented. It reflects
  exactly what the `Agent` tool's return payload reported.
- Rows 1 and 4 are **unmeasured, not zero** — their actual token cost is unknown and excluded from total A
  rather than assumed absent.
- Model identity was not reported in any return this session; all rows are blank in that column rather
  than guessed.
- No agent in this ledger was resumed, so the cumulative-vs-per-dispatch empirical question from earlier
  sessions (BUILD-015, 2026-08-08) does not apply to any row here and was not re-tested.
