# SUBAGENT LEDGER — BUILD-020 4E → BUILD-015 WP-B15-1 session, 2026-08-08 (rotation input for Pax)

**Larry-transcribed from each `Agent` return's `<usage>` block — not independently instrumented.**
Session range: opening head `3e775d0` (main) → closing branch head recorded in the rotation block.
Every return this session carried a usage block — **nothing is unmeasured**.

## Every return, grouped by agent

| # | Agent (role) | Fresh/resumed | Dispatch | subagent_tokens | tool_uses | duration_ms |
|---|---|---|---|---|---|---|
| 1 | veritas — 4E preparation review | fresh | 1 | 132,230 | 28 | 375,358 |
| 2 | pax — grounded-vision investigation | fresh | 1 | 206,601 | 42 | 548,585 |
| 3 | nolan — WP-B15-1 review | fresh | 1 | 97,392 | 18 | 216,568 |
| 4 | keel — WO-2026-08-08-B15-01 | fresh | 1 (read-back) | 144,169 | 28 | 329,099 |
| 5 | keel — same agent | **resumed** | 2 (implementation; one mid-flight awareness message also rode this dispatch) | 406,658 | 95 | 1,408,668 |
| 6 | pax — Supabase household-knowledge audit | fresh | 1 | 150,959 | 30 | 480,563 |
| 7 | pax — old-brain continuity audit | fresh | 1 | 125,964 | 18 | 323,813 |
| 8 | veritas — WP-B15-1 Gate 1 | fresh | 1 | 130,580 | 39 | 557,629 |

*(Note: the three Pax commissions and two Veritas commissions were separate FRESH agents each —
only Keel was resumed. Codex ran via `reviewDiff.mjs` CLI, not the Agent tool, and is outside this
ledger: three executions, token usage not exposed by that route — UNESTABLISHED, not zero.)*

## The cumulative-vs-per-dispatch determination — re-tested, not assumed

Only ONE agent (keel) produced multiple returns this session, so the 4D multi-agent monotonicity
proof **cannot be re-run at this frequency**. The single pair is CONSISTENT with the 4D-proven
reading (`subagent_tokens` cumulative per agent: 406,658 ≥ 144,169; `tool_uses`/`duration_ms`
per-dispatch) but cannot alone prove it. **This ledger adopts the 4D-proven interpretation and
states the alternative:** if `subagent_tokens` were per-dispatch, Keel's total would be 550,827
and total A below rises by 144,169 (+11.5%).

## The three totals (never one blended number)

- **A — deduplicated subagent token traffic: 1,250,384** (rows 1–3 + row 5 as Keel's cumulative
  total + rows 6–8; naive summing of all eight rows would give 1,394,553, overstating by 144,169).
- **B — final/peak footprint per agent:** keel 406,658 · pax 206,601 / 150,959 / 125,964 (three
  separate agents) · veritas 132,230 / 130,580 (two separate agents) · nolan 97,392.
- **C — dispatch and tool-use counts:** keel 2 dispatches (+1 queued message), 123 tool uses on
  the per-dispatch reading (28+95); all others 1 dispatch each — veritas 28/39, pax 42/30/18,
  nolan 18. Total tool uses across all subagents: 298.

## Larry's own context — SEPARATE, a level not a flow

Read from `tools/governor/footer.mjs` at rotation: **582.9k of 1000k (~58%), AMBER.** Never added
to A. The only honest joint statement is the ratio: subagent traffic ≈ **2.1×** Larry's context
level at close.

## Uncertainties, stated

- Larry-transcribed; a transcription slip is possible — the source blocks are in the session
  transcript.
- Codex CLI usage unexposed (three executions, UNESTABLISHED).
- The cumulative-reading adoption above rests on the 4D proof, re-tested only as far as one
  resumed pair allows.
