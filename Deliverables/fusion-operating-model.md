# Fusion / myPKA — Operating Model (CANONICAL, locked 2026-07-27)

This is the canonical record of the operating model established through the idea-engine → Mason work.
It supersedes the interim `fusion-operating-model-brains.md` note (which it absorbs).

**Instantiation status (2026-07-27): Arc and Mason are LIVE, bound subagents** — not future intent. Nolan
instantiated both via SOP-001: `Team/Arc - Transfer Intelligence Specialist/AGENTS.md` +
`Team/Mason - Opportunity Synthesis Specialist/AGENTS.md` (contracts), `.claude/agents/arc.md` +
`.claude/agents/mason.md` (host shims, tools `Read, Bash, Glob, Grep`), and `Team/agent-index.md` rows.
Both were **proven end-to-end** on a real source (`vJEy3nP2_C8`). The initial proof was defective — Arc mined
only 3 atoms (mechanism→component bias, interpretation contamination, obvious-discard, one lossy pass). After
**Warwick's Arc quality correction (2026-07-27)** Arc on the same source (reading the factual source-core, T2
divergent across 6 domain frames) mines **24 provenance-bearing atoms (24/24 verbatim-verified), covering 15/16
major transfer veins** including the previously-missed strategic (vendor-lock-in), attention/phone-first, career
and public-reputation (Sahil-Bloom-style building-in-public) veins; Mason then converged the **92-atom estate →
5 surfaced / 5 emerging / 24 standalone / 3 rejected clusters, every atom accounted** — the richer estate did NOT
become a landfill (Arc favours recall, Mason protects attention). The T1/T2 generation implementation received
independent **Fable** review (Warwick-authorised); its three blockers (production→register wiring, positional-
key corruption, convergence silent-loss) were fixed and re-confirmed. See `Deliverables/2026-07-27-arc-quality-correction-CLOSURE.md`.

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
research/verify (Pax) and does NOT decide what Warwick sees (Mason). Output = atoms (with provenance + provisional
NVFI), NOT opportunities.

**Arc corrected behaviour (Warwick's Arc quality correction, 2026-07-27 — entrypoint `arc.mjs`):**
- **Reads a FACTUAL source-core, not the interpretation.** The Source-Intelligence note's factual sections (claims ·
  mechanisms · examples · people/tools · evidence/timestamps · caveats · themes) with the pre-written "What this means
  for Fusion247" / "Actions" conclusions STRIPPED — so legitimate transfers are not recognised-then-killed as "already
  said". The human note is untouched. Falls back to the transcript when no note exists.
- **Broad transfer domains** (they overlap): Fusion/system · architecture/technical · operational/process · Warwick
  workflow/attention · career · commercial/money · product/service · public reputation/distribution · strategic
  warnings (lock-in) · cross-domain. Strategic/career/commercial/reputation are IN Arc's remit — NOT SI-only. This
  was a **current Arc limitation** (mechanism→component bias), now corrected — not an intended boundary.
- **Obvious ≠ discard:** obvious+low-value → discard; obvious+HIGH-value (external validation / implementation-
  sharpening of an existing direction) → KEEP (`admission {obvious,value,kind}`).
- **Deterministic tier by substance, favouring RECALL:** rich/mechanism-dense source → T2 divergent (6 domain frames
  F1-F6 + non-model enrichment + convergence); medium → one strong T1 pass; thin/near-empty → cheap / ZERO. The
  register stores everything; Mason controls Warwick's attention downstream. Verbatim, machine-checked provenance.

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
disappearing into implementation. **Larry does NOT hold completion authority** (Warwick, 2026-08-04) — see Veritas
below.

**Veritas — Internal Quality and Truth Assurance.** *(Added 2026-08-04 by Warwick's order `GOVERNANCE-VERITAS-HIRE`.
This model is LOCKED against rewriting, not against Warwick changing it; a roles model that omits a mandatory role
sends every specialist who reads it down a superseded route.)* **Structurally separate INTERNAL assurance —
separate context, no authorship or integration authority, direct repository inspection, an uneditable verdict,
but the SAME runtime and model. It is not external verification; Codex remains the different-model external
gate.** Determines, independently of Larry's judgement, whether integrated work
meets the stated outcome and accepted design, **works through the production path**, is genuinely integrated rather
than merely implemented in isolation, is durable across restart and recovery, and is accurately represented in Git
and in every active document. Reviews the **exact integrated head** in a separate context — never a worker branch, a
read-back, or Larry's summary. Three gates only (integrated WP · phase or vertical slice · documentation and Git
truth) and **no pre-inspection of a Work Order before implementation**, so a specialist's start is never delayed.
Three verdicts only — PASS / HOLD / FAIL — and an unknown on a mandatory acceptance property is a HOLD.
**A Work Package cannot be recorded complete without VERITAS_PASS.** Veritas reports and never repairs; Larry
dispatches the corrections. Veritas does NOT replace Codex, does not research (Pax), does not do visual/UI QA
(Vera), does not implement (Keel), and does not audit team hygiene (Nolan). Canonical contract:
`Team/Veritas - Internal Quality and Truth Assurance/AGENTS.md`.

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
brief / PRD → Larry implementation plan → Warwick GO → delegated build → Larry integrates →
VERITAS internal assurance of the exact integrated head → CODEX external QA at the PR head → merge`

*Amended 2026-08-04 (`GOVERNANCE-VERITAS-HIRE`). The single undifferentiated `QA` step in the previous version is
what let internal assurance and external review be treated as one thing that either had happened or had not. They
are two gates with different scopes and different owners, and the build is not complete until both have passed.*

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
