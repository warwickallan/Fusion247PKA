---
title: "Fusion gateway capability audit (by execution) and the redesigned agentic inspection loop"
date: 2026-08-12
author: Larry, synthesizing Asdair's capability audit
build: BUILD-015 AsdAIr
status: DESIGN, NOT YET BUILT. Per Warwick's explicit instruction, the next step is a standalone
  prototype proven against the known photograph, not a full pipeline integration.
---

# Gateway capability audit and the redesigned agentic inspection loop

## Why this exists

`Deliverables/2026-08-12-vision-pipeline-six-round-reconciliation.md` established, by evidence, that the
dominant vision-pipeline failure (~50% omission) is a visual-coverage problem the current
deterministic-trigger architecture cannot reach — the model's single first-pass call under-covers a
dense page, and no post-hoc signal on its output can detect an omission that left no trace. Warwick's
instruction: establish the real, deployed capability of the Fusion gateway before designing anything, by
execution, not documentation inference. Asdair did that. This document records the findings and the
concrete architecture they support.

## Capability audit — real evidence, this deployment specifically

| # | Capability | Verdict | Evidence |
|---|---|---|---|
| 1 | Multi-image input, one call | CONFIRMED WORKING | Two real images in one request, model correctly distinguished both. |
| 2 | Multi-turn continuation | **SPLIT BY ENDPOINT** | `/v1/chat/completions` + `previous_response_id` → real 400, genuinely stateless. `/v1/responses` → genuine server-side continuation confirmed: turn 2, fresh call, no resent history, correctly recalled turn 1's content via `previous_response_id` alone. |
| 3 | Targeted follow-up/crop calls | CONFIRMED, unremarkable | Already built; just independent `vision()` calls, same shape as #1. |
| 4 | Tool/function-calling | **CONFIRMED WORKING** — the load-bearing finding | Model correctly emitted a real tool call (`request_crop`, `region: "3"`) on both `/chat/completions` (requires `reasoning_effort:'none'`) and `/v1/responses` (keeps full reasoning). |
| 5 | Image-detail/resolution control | NOT DETECTABLY HONOURED, on a small test image — not ruled out on a full-size photo, explicitly unproven either way | Identical `prompt_tokens` and output regardless of `detail: low` vs `high` on a ~50KB crop. |
| 6 | Prompt caching | CONFIRMED WORKING, real numbers | Second identical 4,016-token prompt: full cache hit, ~90% discount per the gateway's own `/model/info` pricing (input $2.50/M normal vs. $0.25/M cached). |
| 7 | Usage/cost telemetry | CONFIRMED WORKING, per-call only | Every call returns real `usage`; nothing aggregates across turns — a caller must sum itself. |

**Two findings not asked for, material anyway:**
- **The codebase's own pricing constant is stale and under-costing.** `models.mjs` hard-codes
  `{input: 2.00, output: 12.00}` per million tokens and labels `{input: 2.50, output: 15.00}` as
  superseded. The live gateway's own `/model/info` right now bills `gpt-5.6-terra` at exactly
  `{input: 2.50, output: 15.00}` — every cost figure reported across all six rounds this session was
  ~25% too low. Real spend was somewhat higher than reported; the actual totals are still small
  (single-digit dollars), but the constant should be corrected regardless.
- **Reasoning-token overhead is real and non-trivial even on trivial calls** — 192 reasoning tokens on a
  two-sentence description, 704 on a four-word OCR read. A multi-turn loop's true cost includes this tax
  on every turn, not just the visible input/output tokens.

## The architecture this evidence supports

**Warwick's own conceptual diagram, now grounded in what's actually buildable:**

```
PHOTO → deterministic orientation/prep (unchanged, already built, sharp-based)
     → ONE /v1/responses call: full prepared image + numbered regions + household
       Regulars/Favourites/aliases context (prompt-cached — same context every shop) +
       a `request_crop(region)` tool definition + an instruction to keep inspecting
       until confident the whole page has been covered, not just the first pass
     → Terra itself decides, autonomously, whether it has seen enough — if not, it emits
       a tool call for a specific region
     → application supplies the requested crop as the next turn, chained via
       previous_response_id (genuine server-side continuation, proven working) — Terra
       continues with full memory of what it's already read, not a fresh blind call
     → repeat, bounded (a hard cap on tool-call iterations — cost control, not trust)
     → Terra emits a final structured list once it stops requesting crops
     → deterministic provenance/sanity checks still run on the OUTPUT afterward,
       unchanged in principle — the model's own final answer is not blindly trusted
       either, same as today
     → durable four-way provenance, canonical state, Cockpit exceptions (all unchanged,
       already built and proven this session)
```

**What genuinely changes from every round built so far**: the decision to re-inspect moves from the
APPLICATION (deterministic triage on the model's returned output, which cannot see what the model never
returned) to the MODEL ITSELF, mid-conversation, with live access to the actual image and its own
uncertainty — the same behaviour Warwick observed from ChatGPT/Claude directly. This is not a bigger
version of the existing follow-up mechanism; it is the same conceptual idea (targeted re-inspection)
built on a substrate that can actually see what it's missing, because the model decides, not a
post-hoc heuristic proven this session not to work.

**Cost control, per Warwick's "cost per trustworthy shop, not cost per call" framing**: a hard iteration
cap (proposed: 4 tool-calls maximum — a clean list should need 0-1, a genuinely hard one may need more,
never unbounded); `reasoning_effort` tuned per turn (full reasoning on the first pass where it matters
most, potentially reduced on quick crop-confirmation turns); prompt caching for the repeated household
context, which the evidence proves gives a real ~90% discount on exactly the content that would
otherwise be resent every turn.

## What happens next — a prototype, not an integration

Per Warwick's explicit instruction: "build the simplest version, prove it on the known photograph,
integrate it, and move on" — in that order. The next Work Order builds a STANDALONE prototype (a script,
not wired into `interpretPhotoOrchestrator.js` or any production call site) that implements exactly this
loop against `/v1/responses`, run directly against the one known photograph with the established 39-line
ground truth. Only once that prototype demonstrably clears Warwick's stated bar (~95%+ correctly
resolved, zero invented lines, zero silent quantity guesses, no large silent omission class, genuine
uncertainty surfaced honestly) does integration into the production pipeline become the next question —
not before.

Also folded into the same prototype work: the stale pricing constant fix (small, unrelated to the
architecture question, but directly relevant to costing whatever this prototype proves).
