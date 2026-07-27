# Idea-engine — FROZEN T1-vs-T2 experiment · COST / TECHNICAL report

**Run 45fc7e1b · 2026-07-26 19:50 UTC.** Sonnet throughout · no Fable · no Opus · all six fixtures run T1+T2 FRESH under one frozen brief.

> **Read the money correctly.** This runs on Claude **Max 20×** via `claude -p`, not the pay-as-you-go API. Four
> different things, kept separate:
> 1. **Reported Claude-Code token traffic** — the big numbers below (output + cache creation + cache read). Engineering evidence.
> 2. **Actual faculty/model work** — the reasoning tokens (payload-in est + output), a fraction of (1).
> 3. **Max-plan quota impact** — small; Warwick's usage UI showed ≈2% weekly (all models) after a full day's work.
> 4. **Actual marginal cash spend** — **£0**, unless something leaves the subscription path (no API key, no OpenAI/LiteLLM).
>
> The "$ (PAYG-equiv)" column is what this WOULD cost on the metered API — telemetry only, not a bill.

| source | class | T1 reported | T2 reported | T2/T1× | T1 faculty | T2 faculty | T1 cand | T2 cand |
|---|---|---|---|---|---|---|---|---|
| 1 AI-agent skill (ADHD) | rich, same-domain positive | 71,112 | 501,917 | 7.1 | 18,625 | 121,469 | 3 | 10 |
| 2 Running a business — 4 tasks | rich, non-AI, transferable | 71,649 | 497,215 | 6.9 | 17,856 | 116,560 | 3 | 8 |
| 3 Context Graphs (Neo4j) | rich, high-relevance positive | 70,719 | 489,661 | 6.9 | 16,882 | 104,757 | 3 | 12 |
| 4 How Audi Cheated in 1988 | rich, adversarial POOR-FIT | 138,974 | 436,067 | 3.1 | 16,279 | 110,466 | 3 | 10 |
| 5 Clean an Air Fryer (26s) | thin / negative | 127,155 | 468,378 | 3.7 | 11,211 | 73,221 | 2 | 6 |
| 6 Clean an Air Fryer (7s) | thin / negative | 53,193 | 334,610 | 6.3 | 2,468 | 12,223 | 0 | 0 |

**Grand totals**
- (1) Reported CC traffic: T1 532,802 · T2 2,727,848 · **combined 3,260,650 tok**
- (2) Faculty/model work: T1 83,321 · T2 538,696 · combined 622,017 tok (the actual reasoning; the rest is wrapper/cache)
- (3) Max quota impact: small (single-digit % of weekly, per Warwick's usage UI)
- (4) Marginal cash: **£0** (fully inside the Max 20× subscription)
- PAYG-equivalent telemetry (NOT a bill): ~$13.14 · summed wall ~61.6 min

**T2 vs T1 (measured):** across 6 fixtures, **T2 ≈ 5.1× T1** in reported traffic but only **≈6.5× in faculty work** — the multiplier is wrapper/cache over 6 calls, not 6× the thinking.
