---
artefact: decision-log
provenance: curated (Larry), append-only — NOT a transcript store
owner_intent: the smallest durable representation of WHY significant decisions were made (the Fresh-Larry test
  found Fusion remembers WHAT better than WHY). Human-readable now; parseable into Honcho/Neo4j/CuratAir later,
  but works without them. One entry per significant decision; newest last. Fields: decision · rationale ·
  alternatives-rejected · evidence · date · scope · provenance · supersedes/superseded-by.
note: PROPOSED format (Phase-1 of the T2 design package) — seeded with this session's decisions as the minimal
  capture; the format itself is up for Warwick + GPT red-team.
---

# Fusion decision log

## DEC-2026-07-25-01 · Lift the Cockpit out of Directus into a standalone PWA
- **decision:** the Warwick-facing surface becomes its own first-party app; Directus demoted to Larry back-office.
- **rationale:** Directus's admin "show-all-data" DNA + its session handling (the logout bug) is the wrong permanent host for a concierge; the valuable spine (contracts/projectors/governed intents) is host-agnostic.
- **alternatives rejected:** keep bending Directus (fought us continuously); a native app now (overkill — PWA gives the app feel).
- **evidence:** the logout-on-tab-switch bug; the airport/"suitcase at arrivals" framing; the PWA came together in an afternoon because the spine was already proven.
- **date:** 2026-07-25 · **scope:** IDEA-016 cockpit · **provenance:** Warwick GO. **superseded-by:** —

## DEC-2026-07-26-01 · Idea-engine execution = Path A (Sonnet via `claude -p`, Max sub only)
- **decision:** run the Transfer Specialist as ONE `claude -p` Sonnet call on Warwick's Anthropic Max 20x sub.
- **rationale:** stay inside the existing subscription (a core reason for using Claude headless); Sonnet is the model the faculty was validated on; low-volume human-triggered.
- **alternatives rejected:** an Anthropic API key (paid, separate spend); OpenAI/LiteLLM gateway (different, unproven model — would swap the validated faculty just to prettify the token counter).
- **evidence:** measured ~138k tokens/$0.41 per Mine — FACULTY ~18k vs Claude-Code WRAPPER ~128k (cache-heavy, cheap in £/quota). Accepted for low volume; revisit if volume grows. Keep the runner's execution boundary swappable.
- **date:** 2026-07-26 · **scope:** idea-engine runner · **provenance:** Warwick (Path A). **supersedes:** an earlier "hook dPax to OpenAI like dcairn" idea.

## DEC-2026-07-26-02 · SPIN-first presentation law (general)
- **decision:** every idea/finding leads with plain-English SPIN (Situation/Problem/Implication/Need-payoff); all machine detail behind Details.
- **rationale:** technically-impressive findings in architecture shorthand don't tell Warwick why they matter. NVFI ranks for the machine; SPIN tells Warwick why it matters, in seconds.
- **alternatives rejected:** surfacing raw candidate text / NVFI-only.
- **evidence:** the Docling Mine's cards were unreadable as shorthand until SPIN-fronted. **date:** 2026-07-26 · **scope:** all Warwick-facing surfaces · **provenance:** Warwick.

## DEC-2026-07-26-03 · Idea-engine architecture + clean role separation (no Critic in T1)
- **decision:** Cairn triage → Transfer Specialist (recognise→analogise→transfer→propose, provisional NVFI, self-kill) → Larry operational-reconciliation on Brain / Cash direct to Warwick → Keep/Later/Decline → separate Research-with-Pax. No separate Critic in T1. Fable = explicit-auth only.
- **rationale:** measure the transfer faculty without another agent rescuing it; keep the specialist lean+bold with safety bought downstream; opposite cognitive biases (Pax=verify) must not merge.
- **alternatives rejected:** merge ideator+researcher (Pax); a standing Critic in T1; parallel branches in T1 (that's T2).
- **evidence:** the 6-fixture frozen experiment PASSED with this shape. **date:** 2026-07-26 · **scope:** idea-engine · **provenance:** Warwick + GPT + Larra/Pax synthesis.

## DEC-2026-07-26-04 · Freeze fixtures before the contract; grade on intelligence not recall
- **decision:** the 6 evaluation fixtures were frozen BEFORE the specialist contract was written; success ≠ recall of GPT/Pax/Larry's lists; a defensible-novel find + zero on thin/poor-fit is the bar.
- **rationale:** avoid designing "a sophisticated ADHD-video detector"; a parrot with a regression suite is failure.
- **alternatives rejected:** tuning tests after seeing output. **date:** 2026-07-26 · **scope:** experiment · **provenance:** Warwick + GPT.

## DEC-2026-07-26-05 · Build UPWARD (T1 proven base → T2), not slice the goal to fit T1
- **decision:** T1 is the proven base layer, not the finished architecture; design T2 (true isolated divergence) as a report-back package before any build.
- **rationale:** the goal is maximum useful intelligence per Warwick decision, not the first successful experiment.
- **alternatives rejected:** declaring T1 "done"; bolting 5 Sonnet calls onto T1 on faith. **date:** 2026-07-26 · **scope:** idea-engine roadmap · **provenance:** Warwick.
