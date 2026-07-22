---
title: "Honcho → MyPKA — idea & knowledge development from Honcho's memory mechanisms"
author: Pax (Senior Researcher)
date: 2026-07-22
type: research-brief
mode: idea-development (generative, not go/no-go)
follows: "[[2026-07-22-pax-honcho-mypka-research]]"
status: final
---

# Honcho → MyPKA: Mining the Mechanisms for Ideas

## Executive summary

Honcho's real contribution is not a product to adopt — it is a **reframing of memory from storage to reasoning**, expressed through four transferable mechanisms: (1) **selective persistence** — a model decides what is worth remembering and at what certainty level, rather than storing everything; (2) a periodic **"dreaming" reconcile pass** that finds contradictions, retires stale facts, and generalises traits; (3) **peer / theory-of-mind modelling** with an explicit *observer→observed* asymmetry; and (4) **memory portability** across agents and tools. Strip the AGPL/cloud-LLM/opaque-Postgres implementation away and these four ideas map cleanly onto things MyPKA already half-does in markdown — and in every case MyPKA's **governed, git-diffable, human-gated** substrate is a *better* home for the idea than Honcho's un-auditable DB. The most valuable move for Fusion247 is therefore **not** to run Honcho, but to **steal its cognitive structure into MyPKA's existing doctrine**. This brief distils the mechanisms from primary sources, develops five concrete MyPKA ideas (each with doctrine-fit, rough shape, and smallest experiment), maps the wider field, and proposes three Foundry candidates.

This is idea-development only. No build code, config, or memory was changed.

---

## Part A — The genuinely novel ideas (mechanism, not hype)

### A1. Memory as reasoning, not storage — *selective persistence* (confidence: High)

Honcho's ingest model **Neuromancer XR** (a fine-tuned Qwen3-8B) does not store raw messages. On each message it derives **atomic conclusions** at two certainty levels:

- **Explicit conclusions** — directly stated ("Erin's daughter plays soccer").
- **Deductive conclusions** — what *necessarily* follows ("Erin is a parent").

The rule that makes this more than tagging: **deductive conclusions may only scaffold from explicit ones** — "preventing speculation from contaminating factual memory." The model was specifically trained to *avoid* failure modes like bundling multiple facts into one conclusion or using speculative language. It selectively persists "only the relevant conclusions at appropriate certainty levels," reporting 86.9% on LoCoMo vs 69.6% for base Qwen3-8B and 80.0% for Claude 4 Sonnet.

**The insight, separated from the hype:** the value is the *discipline of the decision* — what is worth persisting, and labelling its epistemic status — not the specific fine-tuned model. The benchmark headline is weaker than it sounds (all vendor-self-run, LLM-judged, "fairly high variance"; and the *published* benchmark runs used gemini-2.5-flash-lite + claude-haiku-4-5, not Neuromancer XR — so the model's contribution to the headline numbers is ambiguous). The durable idea is **the fact/deduction/speculation split as a persistence gate.**

### A2. The "dreaming" reconcile pass (confidence: Medium-High)

Dreaming is "an autonomous, periodic consolidation cycle that refines the peer representation by reasoning over existing conclusions." A dream cycle runs **two specialists in sequence** (primary v3 doc, triangulated by DeepWiki + Starlog + community search):

- **Deduction specialist** — explores the observation space for: **knowledge updates** (a fact changed over time, e.g. employment), **logical implications** missed in real time, **contradictions** needing resolution, and biographical facts worth promoting to the peer card.
- **Induction specialist** — finds **patterns across ≥2 conclusions**: behavioural tendencies, consistent preferences, personality traits, correlations — each with a **confidence score** and requiring at least two source conclusions.

**Thresholds are now primary-source verified** (this resolves a "could not verify" flag from the first brief): a dream triggers only when **all** hold — **≥50 new conclusions** since the last dream, **≥8-hour cooldown**, dreaming enabled — and a **60-minute idle timeout** cancels pending dreams if the conversation resumes. Manual triggering bypasses thresholds but keeps deduplication.

**The insight:** memory should have a *maintenance loop* distinct from the *capture loop* — high-frequency cheap capture, low-frequency expensive reconciliation, split by cost. The deduction/induction division (retire-and-resolve vs generalise) is a genuinely good taxonomy for a self-cleaning pass.

**Anti-pattern flag (real, from Honcho's own tracker):** even Honcho's reconcile pass has trouble — open issue #729, *"Dreamer/deriver accumulates near-duplicate observations despite dedup guard,"* and issue #608 on silent config-validation failures that break the dreamer invisibly. A naive reconcile pass **generates noise and duplicates**. Any MyPKA version must be dedup-aware and fail loudly, not silently.

### A3. Peer / theory-of-mind modelling with observer→observed asymmetry (confidence: High)

Peers are the "most important entity… everything revolves around Peers," and humans and agents are modelled **uniformly**. Honcho keeps two representation types:

- **Global representation** — built from *any* message a peer ever produced: the peer's self-model.
- **Local representation** — "specific to a single Peer's view of another Peer": how A models B from observation. Off by default; enabled selectively.

The asymmetry is the clever part: when Alice messages Bob, it updates **Alice's global self-model** and **Bob's local model of Alice** — not the reverse. Plus **peer cards** (context-optimised biographical summaries) and per-observer **Collections** of facts.

**The insight:** an agent's model of a person is *not* that person's self-model, and both are first-class. For a team of agents serving one principal, that is exactly the right shape — Larry's model of Warwick is an artifact to be maintained, not an assumption.

### A4. Portable, cross-agent memory (confidence: High)

Because peers are tool-agnostic entities, one peer model is shared across Claude Code / Codex / Cursor / Cline via MCP — memory follows the *person*, not the app. **This is the one area where MyPKA already beats Honcho**: markdown + `AGENTS.md` is *more* portable than a Postgres service you must stand up, and it is git-diffable. The idea worth stealing is narrower: **continuity across the multi-model handoff** (Opus → Codex → Fable), which MyPKA does *not* yet formalise.

### A5. Reasoning-query over memory (the "dialectic") (confidence: High)

Honcho's `peer.chat()` answers "what does X believe about Y" by **reasoning over stored conclusions**, not keyword retrieval — "reasoning *over* memory rather than mere retrieval," claiming ~60% cost reduction vs raw-context queries on LongMem S. The insight: the query interface to memory should *synthesise with citations*, not just grep.

---

## Part B — Concrete ideas for how MyPKA / Larry could evolve

For each: **concept · doctrine-fit · rough shape · smallest experiment.** All are report-only / human-gated by default — nothing here proposes autonomous rewriting of governed memory.

### Idea 1 — "Dream Pass": a governed reconcile pass over Larry's markdown memory

- **Concept.** A periodic pass over `MEMORY.md` (~40 bullets and growing), the journal, and session-logs that mimics dreaming's *deduction + induction* split: (a) **contradictions** between notes, (b) **stale/superseded** notes (a later note overrides an earlier one), (c) **generalisation candidates** — where ≥2 notes point to a durable rule that should *graduate* to a Guideline/SOP.
- **Doctrine-fit.** Very strong. MyPKA **already** has the skeleton: **SOP-017 content-integrity audit** (report-only, finds contradictions/drift, never auto-fixes) and the standing "graduate set-in-stone insight from session-logs into SOPs" rule. Honcho supplies a *better internal structure* for SOP-017 — the deduction/induction taxonomy, confidence scores, and the ≥2-source rule for any generalisation (which is literally Pax's triangulation discipline). Honoring `no-self-edit-core-rules` and `write-discipline`: the pass **proposes**, Warwick disposes.
- **Rough shape.** A checklist-driven pass (no new service) producing a severity-classified report: `Contradictions | Superseded | Graduation candidates | Duplicates-to-merge`. Dedup-aware and fail-loud by design (learning directly from Honcho issues #729/#608). Cadence borrowed but relaxed: on-demand + an optional close-session nudge, not an 8-hour daemon.
- **Smallest experiment.** Pax runs **one manual dream pass over the 40 `MEMORY.md` bullets today** — output the four lists, no writes. Half a day. If it surfaces even 2–3 real contradictions/stale notes, the pattern earns a permanent home in SOP-017.

### Idea 2 — Selective-persistence gate ("is this worth remembering?")

- **Concept.** An explicit classifier applied *before* a memory write: is this an **explicit durable rule** (→ memory/Guideline), a **deduction/opinion** (→ flag as inferred, lower confidence), or a **one-off** (→ session-log only, not memory)? Borrows Neuromancer XR's explicit-vs-deductive-vs-speculative certainty labelling.
- **Doctrine-fit.** MyPKA already *has* the tiers — session-logs (ephemeral narrative) vs `MEMORY.md` (durable) vs SOPs/Guidelines (canonical) — but the **promotion decision is currently ad hoc**. This names it. Directly serves Pax's "distinguish opinion from fact" rule and Larry's close-session checkpoint discipline (which already decides what persists, just implicitly).
- **Rough shape.** A 3-line rubric in the close-session / "remember this" path: *stated-or-necessary → durable; inferred → label as inference; one-off → log only.* No code; a doctrine addition to the memory-write protocol.
- **Smallest experiment.** Retro-classify the existing `MEMORY.md` bullets: how many are durable rules vs one-offs that could be demoted to session-logs? Reveals whether the memory file is already accreting noise (the Honcho #729 failure mode, in markdown).

### Idea 3 — "Peer cards": structured, human-approved context models

- **Concept.** A **Warwick peer card** (values, current focus, standing preferences, communication style, decision authority) + a lightweight **card per specialist** — the markdown analog of Honcho's peer cards, with the *observer→observed* distinction made explicit: *Larry's model of Warwick is an artifact to maintain, not Warwick's self-model.*
- **Doctrine-fit.** Excellent, and already latent in memory: `warwick-current-context-sources` (the proposed "distilled current-context brief"), `GL-010` value profile, and the Flight Recorder. Markdown cards are **git-diffable and human-editable** — strictly better than Honcho's opaque embeddings, and they never touch personal-data doctrine because Warwick approves the card. This gives specialists a *consistent* model of who they serve at session start instead of re-deriving it each time.
- **Rough shape.** One `PKM/My Life/` (or `Team Knowledge/`) markdown card, human-approved, wikilinked, read at session boot. Observer asymmetry captured as an explicit "This is Larry's working model, last confirmed <date>" header — never presented as ground truth.
- **Smallest experiment.** Penn drafts a single Warwick peer card from existing memory + Flight Recorder; Warwick edits/approves; measure whether the next few sessions start "warmer." One session to draft.

### Idea 4 — Portable memory across the multi-model loop

- **Concept.** A shared **working-context handoff artifact** that carries the peer/task model across the Opus → Codex → Fable review loop, so reviewers inherit context instead of cold-starting.
- **Doctrine-fit.** Strong and *specifically fills a known gap* — `multi-model-build-verify-loop` and `reviewers-qa-not-pentest` note that independence must be multi-*model*, but each model currently re-reads raw diffs. A curated handoff artifact (markdown, git-tracked) is portability done the MyPKA way. Guardrail: it carries *context*, never *verdicts* (independence must not leak conclusions between reviewers).
- **Rough shape.** A short `Deliverables/`-style handoff note per review round: task, peer card refs, what to check, what NOT to pre-judge. Extends the existing brief format.
- **Smallest experiment.** On the next Tower WP review, hand Codex a one-page context artifact and compare round-count vs the usual cold read.

### Idea 5 — Dialectic query over the Brain (lower priority)

- **Concept.** A "reason over memory, cite sources" query mode — ask Larry a question and have him synthesise across memory + journal + session-logs *with wikilink citations*, rather than surface a single file.
- **Doctrine-fit.** Native — this is what Larry-as-Librarian already gestures at; it just names "synthesise-with-citations" as a first-class interface. No new storage.
- **Smallest experiment.** Fold into normal use; no separate build. Listed for completeness, weakest standalone case.

---

## Part C — Wider knowledge map: where Honcho sits

The field has converged on a shared vocabulary — three memory scopes now treated as standard: **episodic** (past interactions), **semantic** (facts/preferences), **procedural** (learned behaviours/rules). The main systems differ in *substrate* (confidence: Medium — mostly secondary comparison sources):

| System | Approach | Distinct from Honcho |
|---|---|---|
| **Mem0** | Dynamic extract→consolidate→retrieve loop; managed drop-in API. v3 (Apr 2026) reports LoCoMo 91.6 / LongMemEval 94.8 (LLM-judge). | Simpler, faster setup; fact-centric, **no theory-of-mind / peer asymmetry**. |
| **Letta / MemGPT** | OS-style virtual context; the LLM **self-edits** memory blocks via tool calls, paging between main context and archival store. | Agent manages its *own* memory; Honcho reasons about *peers* out-of-band. |
| **Zep / Graphiti** | Temporal knowledge graph over dense retrieval; strong multi-session temporal reasoning. | Graph-structured & explicitly temporal; Honcho's "diachronic" modelling is reasoning-tree, not a graph. |
| **LangMem** | Native LangGraph long-term layer; episodic/semantic/procedural; fact + behaviour memory. | Framework-coupled; no peer/ToM primitive. |
| **Honcho** | Reasoning-tree of conclusions per **peer**; theory-of-mind (global/local reps); **dreaming** consolidation. | Its **differentiators are ToM + the dreaming reconcile pass** — few competitors model *what one party believes about another* or run a scheduled generalisation loop. |

**Where Honcho is genuinely distinct:** the *peer/theory-of-mind primitive* and the *scheduled induction pass* (traits generalised across ≥2 observations with confidence). Most competitors do extract→store→retrieve; Honcho is the clearest expression of "memory = a maintained model of a mind." That lineage traces to Plastic Labs' earlier tutor-gpt / theory-of-mind work — it is a research thesis, not a bolt-on.

**Open research questions worth tracking:**
1. **Reconciliation without noise** — Honcho's own #729 shows dedup during consolidation is unsolved. When does a self-cleaning pass *degrade* memory?
2. **Persona / representation drift** — arxiv work on black-box persona-drift detection suggests derived self-models drift silently; how do you *detect* a bad representation?
3. **Attributing the lift** — recent arxiv ("Entity-Collision," stratified retrieval-lift protocols) questions how much benchmark gains come from memory vs test artefacts. Relevant to *all* vendor-self-run numbers, Honcho included.
4. **Human-auditable derived memory** — nearly all systems store opaque embeddings/graphs. MyPKA's markdown substrate is a rare position to ask: can derived memory stay *diffable and governed*? That is a genuinely open, and MyPKA-shaped, question.

---

## Part D — Foundry idea candidates

Proposed where genuinely warranted. Priority order: **1 > 2 > 3.**

**IDEA — "Dream Pass" (governed self-cleaning memory reconcile).**
A periodic, report-only pass over MyPKA's markdown memory (`MEMORY.md`, journal, session-logs) that borrows Honcho's deduction/induction split: surface contradictions, retire superseded notes, and nominate ≥2-source generalisations for graduation to Guidelines/SOPs — dedup-aware, fail-loud, human-gated. It is not a new system; it is a **structural upgrade to SOP-017** with a defined output schema. Strongest candidate because the skeleton already exists, doctrine-fit is exact, and the smallest experiment (one manual pass over 40 bullets) is free and immediately falsifiable. Explicitly avoids the Honcho failure mode of silent duplicate accretion.

**IDEA — "Peer Cards" (governed context/identity models for principal + specialists).**
Human-approved markdown cards modelling Warwick (values, current focus, authority, comms style) and each specialist, with the observer→observed asymmetry stated in-header ("Larry's working model, confirmed <date>"). Distils Honcho's peer-card + global/local-representation idea into git-diffable, personal-data-safe markdown that agents read at session boot. Consolidates several already-latent memory notes (`warwick-current-context-sources`, `GL-010`) into one maintained artifact.

**IDEA — "Selective-persistence doctrine" (an explicit memory-promotion gate).**
A named rubric — *stated-or-necessary → durable; inferred → labelled inference; one-off → log only* — applied at every memory write, borrowing Neuromancer XR's explicit/deductive/speculative certainty levels. Prevents `MEMORY.md` accreting one-off noise (Honcho's #729 problem, in markdown). Lightest-weight (pure doctrine, no artifact); could ship *inside* IDEA-1 rather than standalone.

---

## Methodology

Started from the prior assessment brief and Warwick's steer to *develop* rather than evaluate. Went to primary Plastic Labs / Honcho sources for mechanisms (core-concepts, the dedicated v3 **dreaming** doc, the Neuromancer XR research post, the benchmarking post), triangulated each mechanism against ≥2 independent sources (DeepWiki architecture, Starlog analysis, community search, and Honcho's own GitHub issues for limitations), then mapped the field via 2026 comparison surveys and two arxiv memory-research papers. MyPKA idea-development is grounded in the folder's own doctrine (AGENTS.md hard rules, SOP-017, and Warwick's standing memory notes). Confidence marked per finding.

## Limitations / could not verify

- **Dreaming thresholds now verified** (≥50 conclusions / ≥8h cooldown / 60-min idle) from the primary v3 doc — upgrades the prior brief's "unverified" flag. Still single-primary-doc; treat exact numbers as version-specific.
- Neuromancer XR's contribution to the *published* benchmark numbers remains ambiguous (runs used gemini-2.5-flash-lite + claude-haiku-4-5).
- All Honcho and Mem0 benchmark numbers are **vendor-self-run and LLM-judged** with acknowledged high variance — directional, not audited.
- Field-comparison table draws on secondary 2026 surveys (Medium/Atlan/Dev Genius) — Medium confidence; substrate claims are consistent across them but not primary-verified per system.
- The MyPKA ideas are *proposals for Warwick's decision*, not recommendations to build; none were prototyped.

## Sources

Primary (Honcho / Plastic Labs):
- [Honcho core concepts](https://honcho.dev/docs/v2/documentation/core-concepts) — peers, global/local representations, sessions, summary cadence
- [Honcho Dreaming (v3 doc)](https://honcho.dev/docs/v3/documentation/features/advanced/dreaming) — deduction/induction specialists, thresholds, idle timeout
- [Introducing Neuromancer XR](https://plasticlabs.ai/blog/research/Introducing-Neuromancer-XR) — explicit/deductive conclusions, reasoning tree, Qwen3-8B, LoCoMo
- [Benchmarking Honcho](https://plasticlabs.ai/blog/research/Benchmarking-Honcho) — models used, LongMem/LoCoMo/BEAM scores, variance caveat
- [Honcho GitHub](https://github.com/plastic-labs/honcho) · [issue #729 (duplicate observations)](https://github.com/plastic-labs/honcho/issues/729) · [issue #608 (silent config failures)](https://github.com/plastic-labs/honcho/issues/608) — architecture + real limitations
- [DeepWiki: plastic-labs/honcho](https://deepwiki.com/plastic-labs/honcho) — deriver/summary/dialectic pipelines, collections

Secondary (field + research):
- [Starlog — Honcho peer memory graph](https://starlog.is/articles/data-knowledge/plastic-labs-honcho)
- [andrew.ooo — Honcho review](https://dev.to/andrew-ooo/honcho-review-plastic-labs-agent-memory-layer-2026-2kb4)
- [Atlan — best agent memory frameworks 2026](https://atlan.com/know/best-ai-agent-memory-frameworks-2026/) · [Medium — 5 memory systems compared](https://medium.com/@wasowski.jarek/i-compared-5-ai-agent-memory-systems-across-6-dimensions-none-wins-6a658335ed0a) · [Dev Genius — 2026 memory systems](https://blog.devgenius.io/ai-agent-memory-systems-in-2026-mem0-zep-hindsight-memvid-and-everything-in-between-compared-96e35b818da8)
- [arxiv — persona-drift detection](https://arxiv.org/pdf/2605.09863) · [arxiv — Entity-Collision retrieval-lift attribution](https://arxiv.org/pdf/2605.29630)
