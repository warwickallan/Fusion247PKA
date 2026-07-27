# Fusion / myPKA — Operating Model (CANONICAL, locked 2026-07-27)

This is the canonical record of the operating model established through the idea-engine → Mason work.
It supersedes the interim `fusion-operating-model-brains.md` note (which it absorbs). Roles here are
operating identities Larry adopts/dispatches; instantiating Arc and Mason as bound subagents (via Nolan /
SOP-001) is a follow-up, not required for this record to be authoritative.

---

## The core conclusion (locked)

**THE IDEA ENGINE IS NOT A BACKLOG GENERATOR.** Its product is a *small number of coherent, evidence-backed
OPPORTUNITIES worth Warwick's attention.* Individual ideas/atoms are **evidence and substrate, not automatically
work items.** A system that turned 68 atoms into 68 things for Warwick to triage would be a failure; the whole
point of synthesis is to protect his attention, not consume it.

---

## Roles

**Arc — Transfer Intelligence (generation).** Source → atomic transferable ideas. Recognise → analogise → transfer
→ propose. Deliberately bold ("this might be mad, but…"); its own self-kill is the quality gate. It does NOT
research/verify (Pax) and does NOT decide what Warwick sees (Mason). T1 = one pass; T2 = N isolated frames +
convergence. Output = atoms (with provenance + provisional NVFI), NOT opportunities.

**Mason — Improvement / Product Manager (synthesis).** Atom estate → cross-idea synthesis → coherent OPPORTUNITIES
→ mature SPIN + ROI → what deserves Warwick's scarce attention. Owns the durable idea/opportunity estate; watches
weak/emerging opportunities and detects changed state; challenges duplication / current-capability; decides when
evidence is insufficient; commissions Pax where warranted. Mason does NOT research facts (Pax), define
architecture (Silas), own personal memory (Honcho), route raw intake (Cairn), implement, approve its own
recommendations, or replace Larry. Distinct from "the Brain" (the LightRAG→Neo4j graph); the agent is **Mason**.

**Pax — Research / Evidence.** Commissioned current-state research and cross-source verification. Turns "we think"
into "we checked." Runs on Mason's or Larry's commission, returns structured briefs.

**Silas — Architecture / Schema / Governance boundaries.** Owns data/technical architecture, schema, the SSOT and
governance boundaries. Distinct from Mason (Mason is product/synthesis, Silas is the engineering substrate).

**Larry — Orchestrator / Quarterback.** Routes work to specialists, keeps operational truth, reconciles, and holds
integration + merge authority. **NOT default implementation labour** — bounded builds increasingly go to delegated
builder agents (see the next commissioned design). Larry stays available to Warwick for orchestration rather than
disappearing into implementation.

**Warwick — Strategic authority.** Sets priorities; expresses opportunity interest and commissions; holds BUILD
authorisation, merge-to-main, live-apply, Fable use, and all exceptions. Commissions **outcomes, not implementation
administration.**

---

## Opportunity typing

- **STRATEGIC / PRODUCT** — something genuinely new or consequential Warwick may want to explore.
- **SELF-IMPROVEMENT** — an improvement to Fusion itself, which should increasingly be handled *autonomously*
  (the Brain accumulates and synthesises improvement opportunities without Warwick or Larry manually driving
  every atom) rather than becoming another Warwick project.

---

## The idea lifecycle (canonical)

`source → atoms (Arc) → Mason synthesis → opportunity → Warwick interest → Pax research where warranted →
brief / PRD → Larry implementation plan → Warwick GO → delegated build → QA → merge`

**Self-improvement path:** the Brain can accumulate + synthesise self-improvement opportunities without Warwick or
Larry manually driving every atom; mature ones flow through the same lifecycle, with Warwick's GO as the gate
between "recommendation" and "build."

---

## Standing principles (locked)

- **Provenance + "no detail lost."** Every opportunity traces to its atoms → source evidence → reasoning →
  (where relevant) graph relationships and prior decisions. Technical detail is layered *underneath* the human
  SPIN/ROI presentation, never discarded.
- **Weak / emerging / standalone ideas remain durable** in the register and inspectable, **without demanding
  Warwick's attention.** Only surfaced opportunities compete for it.
- **Warwick's disposition is durable human authority** — it survives re-synthesis (matched by atom overlap);
  genuine ambiguity is surfaced for re-confirmation, never guessed or silently overwritten.
- **Fable remains hardlocked** — used only on Warwick's explicit per-use authorisation (as granted for the Mason
  review when Codex/Tower were unavailable). Codex is the default independent reviewer; Fable is the authorised
  substitute.
- **Cockpit UI is served from the working tree with no build step** — no cockpit UI change ships without a
  render-check pass (`services/cockpit/render-check.mjs`). Editing = deploying.

---

## This run's deferrals / status

- **Cockpit VISUAL acceptance (this run): owner-deferred by Warwick.** NOT failed, NOT a Mason blocker. The live
  cockpit serves opportunities and render-checks clean headlessly; Warwick chose not to verify client-side tonight.

---

## Next commissioned design (NOT yet GO to build)

**Larry Builder Delegation / Orchestration** — promote Larry from primary builder to engineering orchestrator:
take an authorised implementation plan, recruit/instantiate builder agent(s), issue bounded work packages,
supervise, receive evidence/deliverables, challenge failures, coordinate QA, and return the completed build for
governance/merge — while staying available to Warwick. Design returned for Warwick/GPT review before any build.
