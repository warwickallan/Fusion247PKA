# Idea-engine — Audi calibration · TECHNICAL / COST report

**Calibration id:** 287e2c11 · **source:** --regen ("How Audi Cheated in 1988") · **frozen fixture #4** (adversarial poor-fit) · **2026-07-26 18:27 UTC**
**Path:** 5 isolated Sonnet branches (parallel) → non-model Neo4j enrichment → 1 Sonnet convergence pass. No Fable, no Opus.

## Real measured usage (per `claude -p` call)
| call | faculty payload-in (est) | model output | cache creation | cache read | **TOTAL reported** | cost | wall |
|---|---|---|---|---|---|---|---|
| F1-mechanism | 4595 | 11335 | 25139 | 35036 | **71510** | $0.3314 | 149.9s |
| F2-inversion | 4627 | 9922 | 25173 | 35036 | **70131** | $0.3104 | 128.2s |
| F3-operational | 4598 | 8186 | 25124 | 35036 | **68346** | $0.2841 | 112.6s |
| F4-commercial | 4594 | 8130 | 28650 | 35036 | **71816** | $0.3044 | 121.6s |
| F5-crossdomain | 4609 | 9501 | 32012 | 95217 | **136730** | $0.3632 | 148.1s |
| convergence | 10674 | 29874 | 49952 | 101090 | **180916** | $0.7782 | 306.6s |

> **payload-in is ESTIMATED** (`prompt.length/4`): `claude -p` caches the whole prompt so the API reports input≈0.
> **TOTAL reported = output + cache_creation + cache_read** — the real Claude-Code usage, wrapper/cache included.

## Whole-T2 (this calibration)
| metric | value |
|---|---|
| **Actual reported total** | **599,449 tokens** |
| — faculty/payload estimate (transfer reasoning) | 110,645 tokens |
| — wrapper/cache overhead (cache creation+read) | 522,501 tokens |
| Reported `total_cost_usd` (Max-sub, indicative) | $2.3715 |
| Wall-clock (5 branches parallel 149.9s + convergence 306.6s) | **456.4s** |

**Apples-to-apples vs T1 (the correction):** a production T1 Mine reported **~144k total** through `claude -p`
(wrapper-dominated), NOT the ~50k/75k faculty figures. This T2 calibration's **actual reported total is 599,449**,
i.e. **~4.2× a real T1 Mine** — measured, not asserted. Faculty reasoning is only 110,645
of that; the rest is the same wrapper/cache overhead T1 carries, ×6 calls.

## Candidate flow
| stage | count |
|---|---|
| emitted by branches (pre-convergence) | 14 |
| after dedup / cross-branch kill | 10 |
| killed at L2 (cross-branch) | 1 |
| conflicts preserved | 0 |
| forced-analogy survivors (flagged, not killed) | 0 |

## Convergence findings
- **Novel-independent convergence:** 1 — Larry's cross-session context continuity (decision-rationale log + session-continuity capture, commits bcf9b41/5d57de9) — extend from point-in-time capture to a continuously-maintained rolling state; the same fix additionally applies to the YouTube capture pipeline (Gateway/TubeAIR knowledge-note step), per F2.
- **Context-induced convergence:** 1 — idea-engine's discarded output — both the automated kill-pass (Cairn→Transfer→Critic discarded_obvious/killed-NVFI list) and the Cockpit Decline/Later action stream — routed back as forced input into the next Cairn/Transfer-Intelligence mining pass.
- **Killed at L2:** cockpit.build / cockpit.overall_state self-model tables (Under cross-examination against sibling candidates that each propose a specific, distinct build mechanism (recycle exhaust, keep anti-lag warm, add one bounded intent-check question, run one live-graph test), this candidate's fix is 'find the actual process and repair it' — no named mechanism, just the root-cause-vs-symptom trope, which the frame's own trap note already half-concedes ('keep this grounded... or it degrades into generic advice'). It restates a principle Warwick already holds (build-to-goal, not lever-by-lever patching) without the mechanism-level insight its siblings deliver.)

## Graph annotations ACTUALLY available today
- **Fired this run:** novelty_to_graph, related_prior_decision, related_active_problem
- **Not wired today (honest):** prior_rejection/duplication (needs idea_candidate history join) · recurrence footprint (corpus ≈5 docs) · recency/trajectory (single ingest window).
- Enrichment ran AFTER branches emitted, BEFORE convergence. It NEVER gated generation and NEVER deleted a candidate.

## Per-branch health
- **F1-mechanism** — ok
- **F2-inversion** — ok
- **F3-operational** — ok
- **F4-commercial** — ok
- **F5-crossdomain** — ok
