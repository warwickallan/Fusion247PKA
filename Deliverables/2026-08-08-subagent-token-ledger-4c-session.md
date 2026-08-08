# SUBAGENT LEDGER — BUILD-020 Sub-phase 4C session, 2026-08-07/08

**Input to Pax's `/rotate` session report. Evidence for CAPAE / 4D — not a 4C task.**

Closes the gap Pax reported in **two consecutive** reports: *"All per-specialist token usage —
UNESTABLISHED. No figures were supplied and no subagent ledger exists in any committed artefact."*

**Source:** every `Agent` tool return emits a `<usage>` block (`subagent_tokens`, `tool_uses`,
`duration_ms`). Transcribed from the session transcript. **Larry reading an instrument he does not
author — but transcribing it by hand.** A transcription error is possible; the per-return table below
is the raw evidence so any figure can be re-derived rather than taken on trust.

---

## 1. EVERY RETURN, ungrouped — the raw evidence

**22 returns across 11 agents.** `tokens` is the `subagent_tokens` field exactly as reported.

| # | Agent type | Agent ID | Fresh/Resumed | Disp. | tokens (as reported) | tool_uses | duration_ms |
|---|---|---|---|---|---|---|---|
| 1 | **Pax** | `aba3fc4a8b2c0798a` | fresh *(started in the PRIOR session)* | 1 | 269,717 | 44 | 1,111,354 |
| 2 | **Keel** | `a7f4509427ab991d3` | fresh | 1 | 144,903 | 32 | 415,333 |
| 3 | **Keel** | `a7f4509427ab991d3` | resumed | 2 | 150,129 | 32 | 509,315 |
| 4 | **Keel** | `a7f4509427ab991d3` | resumed | 3 | 201,365 | 33 | 465,958 |
| 5 | **Nolan** | `abeae48094e6fff94` | fresh | 1 | 97,508 | 17 | 336,693 |
| 6 | **Nolan** | `abeae48094e6fff94` | resumed | 2 | 125,054 | 23 | 217,794 |
| 7 | **Nolan** | `abeae48094e6fff94` | resumed | 3 | 169,932 | 46 | 405,136 |
| 8 | **Keel** | `a0192c053a985d438` | fresh | 1 | 169,156 | 25 | 243,993 |
| 9 | **Keel** | `a0192c053a985d438` | resumed | 2 | 242,923 | 42 | 945,202 |
| 10 | **Keel** | `a0192c053a985d438` | resumed | 3 | 343,045 | 43 | 1,445,068 |
| 11 | **Keel** | `a0192c053a985d438` | resumed | 4 | 368,884 | 20 | 383,943 |
| 12 | **Keel** | `a0192c053a985d438` | resumed | 5 | 400,335 | 25 | 427,298 |
| 13 | **Keel** | `a0192c053a985d438` | resumed | 6 | 421,871 | 14 | 295,354 |
| 14 | **Keel** | `ab5dfe942f8350084` | fresh | 1 | 244,252 | 97 | 936,885 |
| 15 | **Veritas** | `a99ea253e4267c89f` | fresh | 1 | *(none emitted — STOPPED by Larry ~1 min in)* | — | — |
| 16 | **Keel** | `a76453c84d1662886` | fresh | 1 | 211,897 | 81 | 2,103,381 |
| 17 | **Nolan** | `a8c21d89b972130d1` | fresh | 1 | 106,981 | 35 | 413,119 |
| 18 | **Nolan** | `a8c21d89b972130d1` | resumed | 2 | 143,415 | 18 | 297,396 |
| 19 | **Veritas** | `a8619e86cc0b9c150` | fresh | 1 | 161,373 | 40 | 632,812 |
| 20 | **Veritas** | `a8619e86cc0b9c150` | resumed | 2 | 215,490 | 10 | 283,589 |
| 21 | **Nolan** | `acea79d28bfeefc29` | fresh | 1 | 73,606 | 24 | 222,711 |
| 22 | **Keel** | `a2c9bf3414c1e2b41` | fresh | 1 | 144,356 | 37 | 319,784 |
| 23 | **Keel** | `a2c9bf3414c1e2b41` | resumed | 2 | 219,816 | 56 | 1,454,729 |

**Model:** not reported in any `<usage>` block. **Unavailable, not omitted.** Every agent inherited the
session model (Opus 5) by dispatch default; **no dispatch set an explicit model override**, which is
Larry's evidence for the inheritance, not the harness's.

---

## 2. IS `subagent_tokens` CUMULATIVE OR PER-DISPATCH? — determined empirically

**Finding: `subagent_tokens` is CUMULATIVE per agent ID. `tool_uses` and `duration_ms` are PER-DISPATCH.**

**Test 1 — monotonicity.** If the field were per-dispatch it would rise and fall with the size of each
run. Across **all six** agents that were resumed, it is **strictly increasing, without exception**:

| Agent ID | sequence |
|---|---|
| `a0192…` | 169,156 → 242,923 → 343,045 → 368,884 → 400,335 → 421,871 |
| `a7f45…` | 144,903 → 150,129 → 201,365 |
| `abeae…` | 97,508 → 125,054 → 169,932 |
| `a8c21…` | 106,981 → 143,415 |
| `a8619…` | 161,373 → 215,490 |
| `a2c9b…` | 144,356 → 219,816 |

**6 of 6.** Under a per-dispatch reading, six independent sequences all happening to rise monotonically
is implausible.

**Test 2 — `tool_uses` is NOT monotonic, so the two fields cannot share a basis.** `a0192…` ran
25 → 42 → 43 → 20 → 25 → 14. A cumulative counter cannot decrease.

**Test 3 — the token DELTAS track per-dispatch `tool_uses`.** If tokens are cumulative, `Δtokens` is the
per-dispatch cost and should correlate with that dispatch's tool count. For `a0192…`:

| Dispatch | tool_uses | Δtokens | Δ per tool |
|---|---|---|---|
| 2 | 42 | +73,767 | 1,756 |
| 3 | 43 | +100,122 | 2,328 |
| 4 | 20 | +25,839 | 1,292 |
| 5 | 25 | +31,451 | 1,258 |
| 6 | 14 | +21,536 | 1,538 |

The two largest dispatches produce the two largest deltas; the smallest produces the smallest.
**Δ-per-tool stays in a narrow 1,258–2,328 band.** Consistent with cumulative; not with independent totals.

**Consequence: naively summing the `tokens` column double-counts badly — ≈ 3,906,000 instead of ≈ 2,171,000.**
That inflated figure is what a careless read produces, and it is why this section exists.

---

## 3. TOTAL A — subagent token traffic attributable to this session, DEDUPLICATED

**Final cumulative value per agent ID, summed once.**

| Agent ID | Type | Work | Final tokens |
|---|---|---|---|
| `a0192c053a985d438` | Keel | Convergence inventory · path-defect fix · Codex terminology · ratification banking | **421,871** |
| `aba3fc4a8b2c0798a` | Pax | 4B session performance report | **269,717** |
| `ab5dfe942f8350084` | Keel | Port stranded code (BUILD-002 gateway, w01, build-010 assessment) | **244,252** |
| `a2c9bf3414c1e2b41` | Keel | Codex merge-blocker corrections | **219,816** |
| `a8619e86cc0b9c150` | Veritas | 4C boundary assurance + focused confirmation | **215,490** |
| `a76453c84d1662886` | Keel | Forensic re-audit of 40 recovered branch tips | **211,897** |
| `a7f4509427ab991d3` | Keel | 4C governance contracts (two correct REFUSALs) | **201,365** |
| `abeae48094e6fff94` | Nolan | MERGE canonicalisation · Veritas contract · outcome-bound rebase | **169,932** |
| `a8c21d89b972130d1` | Nolan | S-1 privacy reconciliation + provenance recut | **143,415** |
| `acea79d28bfeefc29` | Nolan | RECONCILE/MERGE/CONVERGE/CLOSE terminology | **73,606** |
| `a99ea253e4267c89f` | Veritas | Estate re-audit — stopped as out-of-contract | **unmeasured** |

> ### **A = ≈ 2,171,361 subagent tokens** *(+ one unmeasured stopped agent)*

**By specialist:** Keel **1,299,201 (59.8 %)** · Nolan **386,953 (17.8 %)** · Pax **269,717 (12.4 %)** ·
Veritas **215,490 (9.9 %)**.

---

## 4. TOTAL B — peak/final context footprint per persistent agent

**How large each agent actually became behind the scenes.** Under the cumulative reading, the final value
**is** the peak footprint — the field never decreased for any agent.

| Agent | Peak footprint | Dispatches | Growth across resumptions |
|---|---|---|---|
| Keel `a0192…` | **421,871** | 6 | 169,156 → 421,871 (**2.5×**) |
| Pax `aba3f…` | **269,717** | 1 | single dispatch |
| Keel `ab5df…` | **244,252** | 1 | single dispatch |
| Keel `a2c9b…` | **219,816** | 2 | 144,356 → 219,816 (1.5×) |
| Veritas `a8619…` | **215,490** | 2 | 161,373 → 215,490 (1.3×) |
| Keel `a7645…` | **211,897** | 1 | single dispatch |
| Keel `a7f45…` | **201,365** | 3 | 144,903 → 201,365 (1.4×) |
| Nolan `abeae…` | **169,932** | 3 | 97,508 → 169,932 (1.7×) |
| Nolan `a8c21…` | **143,415** | 2 | 106,981 → 143,415 (1.3×) |
| Nolan `acea7…` | **73,606** | 1 | single dispatch |

**The largest single agent reached 421,871 — roughly half Larry's own context — and no single dispatch
approached a context limit.** Resumption is what grows an agent, not any one task.

---

## 5. TOTAL C — dispatches and tool uses, so cost relates to work

| Agent | Type | Dispatches | Tool uses | Tokens | Tokens/tool |
|---|---|---|---|---|---|
| `a0192…` | Keel | 6 | 169 | 421,871 | 2,496 |
| `aba3f…` | Pax | 1 | 44 | 269,717 | 6,130 |
| `ab5df…` | Keel | 1 | 97 | 244,252 | 2,518 |
| `a2c9b…` | Keel | 2 | 93 | 219,816 | 2,364 |
| `a8619…` | Veritas | 2 | 50 | 215,490 | 4,310 |
| `a7645…` | Keel | 1 | 81 | 211,897 | 2,616 |
| `a7f45…` | Keel | 3 | 97 | 201,365 | 2,076 |
| `abeae…` | Nolan | 3 | 86 | 169,932 | 1,976 |
| `a8c21…` | Nolan | 2 | 53 | 143,415 | 2,706 |
| `acea7…` | Nolan | 1 | 24 | 73,606 | 3,067 |
| `a99ea…` | Veritas | 1 | — | unmeasured | — |
| | | **23 returns / 11 agents** | **794** | **2,171,361** | **2,735 avg** |

**Aggregate subagent wall-clock: ≈ 13,866,847 ms ≈ 3 h 51 m.** Much ran **in parallel**, so this exceeds
elapsed session time and is **not** a session-duration figure.

**Pax's 6,130 tokens/tool is the highest** — consistent with a research/analysis agent reading large
artefacts per tool call. **Nolan's 1,976 is the lowest** — targeted contract edits.

---

## 6. LARRY'S OWN CONTEXT — DELIBERATELY SEPARATE

**Larry's main context: ≈ 839,000 tokens** (Warwick, measured at the time of writing).

> ⛔ **DO NOT ADD THIS TO TOTAL A.** They are different accounting bases and summing them produces a
> meaningless figure. **Larry's number is a context *occupancy* — a high-water mark of one live window.
> Total A is *traffic* — tokens consumed across 23 separate returns in 11 separate windows.** One is a
> level, the other is a flow. The only honest joint statement is the ratio: **subagent traffic ran ≈ 2.6×
> Larry's own context occupancy.**

---

## 7. UNCERTAINTY — stated, not buried

1. **The cumulative interpretation is INFERRED**, from the three tests in §2, not from documentation. It is the load-bearing assumption. If wrong, Total A is ≈ 3,906,000 and every derived figure changes.
2. **Transcribed by Larry from tool returns.** No independent instrument holds these figures and no store persists them — before this file they existed only in the session transcript. **That absence is precisely what Pax reported twice.**
3. **One agent (`a99ea…`) emitted no usage block** because Larry stopped it. Its cost is **unmeasured, not zero**. It ran ~1 minute.
4. **`model` is unavailable** in the usage block. Inheritance from the session model is Larry's inference from the absence of any override in his own dispatches.
5. **Pax's `aba3f…` began in the PRIOR session** and returned into this one. Its 269,717 may include work done before this session started — **attribution to "this session" is imperfect for that one agent.**
6. **Whether `subagent_tokens` counts input, output, or both is not stated** by the harness. Every figure here inherits that ambiguity.
