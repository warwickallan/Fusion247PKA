# Subagent token ledger — session "Apps and Opps ⑂" (fork), 2026-09-21

**Larry-transcribed from the `<usage>` block on each `Agent` return. NOT independently instrumented.**
Every figure below is a reading, not a measurement I control. Where the evidence is ambiguous it says
so rather than resolving it.

**Session:** `Apps and Opps ⑂ [3d400a]` · fork of `Apps and Opps [2762c8]`
**Branch:** `worktree-build-careerair-reconciliation` · **closing head** `bb63040`
**Worktree:** `C:/Fusion247PKA/.claude/worktrees/build-careerair-reconciliation`

---

## Per-return record, in conversation order

| # | Agent type | Agent ID | Fresh/resumed | What it did | `subagent_tokens` | `tool_uses` | `duration_ms` |
|---|---|---|---|---|---|---|---|
| 1 | careerair | `a27289688929ad1ff` | fresh | CV work-order read-back, held | 222,627 | 33 | 116,101 |
| 2 | careerair | `a27289688929ad1ff` | resumed | first tailored CV composed | 366,318 | 116 | 774,608 |
| 3 | careerair | `a27289688929ad1ff` | resumed | rewrite after external review FAIL | 410,330 | 22 | 167,803 |
| 4 | careerair | `a27289688929ad1ff` | resumed | v2 artefact row refused by guard | 427,896 | 30 | 268,084 |
| 5 | careerair | `a27289688929ad1ff` | resumed | application 1 close-out recorded | 480,856 | 10 | 66,487 |
| 6 | careerair | `a27289688929ad1ff` | resumed | standing ruling banked; duplicate STOPPED; second job blocked | 463,790 | 17 | 124,962 |
| 7 | careerair | `a27289688929ad1ff` | resumed | second tailored CV composed | 537,689 | 26 | 219,167 |
| 8 | careerair | `a27289688929ad1ff` | resumed | rewrite after second external review FAIL | 581,330 | 30 | 258,452 |
| 9 | careerair | `a27289688929ad1ff` | resumed | two rulings recorded | 591,575 | 8 | 51,826 |
| 10 | careerair | `a27289688929ad1ff` | resumed | application 2 close-out recorded | 607,333 | 9 | 75,742 |
| 11 | careerair | `a27289688929ad1ff` | resumed | reconciliation reconnaissance | 658,624 | 19 | 150,405 |
| 12 | careerair | `a27289688929ad1ff` | resumed | reconciliation built and proven | 738,341 | 48 | 371,613 |
| 13 | general-purpose (**fable**) | `ad0c9c5f18c869305` | fresh | adversarial CV review 1 | 158,404 | 12 | 441,375 |
| 14 | general-purpose (**fable**) | `a2cabe61a3282d775` | fresh | adversarial CV review 2 | 148,496 | 12 | 346,210 |

---

## Per-dispatch or cumulative? Tested, not assumed.

**The evidence supports CUMULATIVE for `subagent_tokens`, and PER-DISPATCH for `tool_uses` and
`duration_ms`** — the same shape recorded on 2026-08-08, re-tested here rather than carried forward.

- `subagent_tokens` rises monotonically across **11 of the 12** returns for `a27289688929ad1ff`
  (222,627 → 738,341). `tool_uses` does **not** (116 → 22 → 30 → 10 → 17 → …), and `duration_ms`
  does not. That divergence is the discriminator.
- **⚠ ONE COUNTER-EXAMPLE, stated rather than smoothed:** return #6 reads 463,790 against #5's
  480,856. On a cumulative model that is impossible. **The most likely explanation is a transcription
  or ordering error by me, not a counter-example to the model** — but I cannot prove that from here,
  so it stands as an anomaly. Treating it as real would not change the totals below, because A takes
  the final value.
- **Two `fable` agents were single-dispatch**, so the question does not arise for them.

## The three totals

**A — deduplicated subagent token traffic attributable to this session: ≈ 1,045,241**

| Agent | Basis | Tokens |
|---|---|---|
| `a27289688929ad1ff` | final cumulative value | 738,341 |
| `ad0c9c5f18c869305` | single dispatch | 158,404 |
| `a2cabe61a3282d775` | single dispatch | 148,496 |

**B — peak/final context footprint per persistent agent:** `a27289688929ad1ff` **738,341**, one
long-lived agent carrying the entire CV, application and reconciliation lane across twelve dispatches.
The two review agents closed at **158,404** and **148,496**, both deliberately capped at 25 tool calls
and both returning inside that ceiling at 12.

**C — dispatch and tool-use count per agent:**

| Agent | Dispatches | Tool uses |
|---|---|---|
| `a27289688929ad1ff` | 12 | 368 |
| `ad0c9c5f18c869305` | 1 | 12 |
| `a2cabe61a3282d775` | 1 | 12 |
| **Total** | **14** | **392** |

⛔ **Larry's own context is a LEVEL and is deliberately NOT added to A.** Subagent traffic is a flow;
context occupancy is a level. Summing them yields a meaningless number. No ratio is offered because
Larry's closing context was not read from the instrument at write time and **an unread number is not
a number.**

## Uncertainties, stated

- **Larry-transcribed throughout.** No independent instrumentation.
- Return #6's non-monotonic value (above) is **UNRESOLVED**.
- **Model per agent: UNESTABLISHED** for the careerair agent; the two review agents were dispatched
  with an explicit `fable` model override, which is recorded because Warwick authorised that model
  by name for this session and it is otherwise excluded by SOP.
- Any agent that emitted no usage block would be **unmeasured, not zero**. None was observed.
- Larry's opening and closing context readings: **UNESTABLISHED** — not read from the instrument.
