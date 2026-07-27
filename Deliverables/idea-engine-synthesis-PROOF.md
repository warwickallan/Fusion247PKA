# Smallest proof — atoms → opportunities (Brains synthesis, one pass)

**68 atoms · one Sonnet call · 35382 output tok · 371.8s · £0 marginal (Max).**
No register, no graph, no cockpit — just the synthesis faculty tested on the real corpus.

## SURFACED opportunities (5) — the few worth Warwick's scarce attention
★ Give Larry a durable memory: persist decision-rationale and session working-state in the graph, not just live context  
**[self_improvement]** · ROI high/reliability · atoms 8 · 4 sources · 4 frames

- **Situation:** Larry's reasoning, judgment calls, and in-session working state currently live only inside whatever conversation happens to be running.
- **Problem:** When a session compacts or restarts, that reasoning evaporates — Warwick has to re-explain context and Larry has to re-derive decisions already made.
- **Implication:** This is already a flagged HIGH-ish gap (the Fresh-Larry WHY gap), and it compounds as Fusion's scope grows — more subsystems, more decisions, more lost every time a thread ends.
- **Need-payoff:** A graph-persisted session/decision layer — an incrementally-written current-session node, decision-rationale linked into the Brain graph, and a checkpoint at natural pause points — turns 'hope compaction doesn't hit at a bad time' into a non-issue.
- **Why now:** Already named as a live, flagged problem, and IDEA-016's own Brain/Neo4j schema work is actively deciding node types right now — the moment to bake the memory layer in rather than retrofit it later.
- **ROI:** Removes a recurring, compounding failure point in Larry's own operation, not a one-off convenience.
- **Evidence:** Four independently-mined sources — an ADHD-skill video, a business-tasks video, a context-graphs paper, and an Audi ad — using four different reasoning frames (mechanism, inversion, operational, crossdomain), all land on the identical structural fix: durable graph-backed state instead of live-conversation-only state. · live anchors: Fresh-Larry WHY gap (flagged HIGH-ish, 2026-07-26); IDEA-016 Brain/Neo4j schema currently being decided
- **What we'd build:** A session/decision-rationale layer in the Brain graph: a current-task/current-session node written incrementally through a session (not reconstructed after the fact), a decision-rationale node type linked to entities/sources, and a lightweight checkpoint file written at natural pause points (turn end, pre-compaction) that the next session reads first.
- **Coherence:** Passes all four bars — one describable artifact (graph-backed session+rationale layer), eight non-redundant facets, four independent sources, and a real named live problem.
- **Member atoms:** 12, 14, 17, 30, 33, 39, 48, 56
- **Actions:** Make build brief · Research with Pax

---

★ Stop trusting stale gauges: bind cockpit.build/overall_state refresh to real events, not manual updates  
**[self_improvement]** · ROI high/reliability · atoms 5 · 3 sources · 3 frames

- **Situation:** Larry's self-model tables (cockpit.build, cockpit.overall_state) exist to tell Larry what's actually true about the build right now.
- **Problem:** They've been stale since 2026-07-22, with nothing forcing a refresh — updated manually, if at all.
- **Implication:** Any orchestration or gating decision Larry makes off these tables silently inherits whatever staleness they carry — a gauge that looks structured and is wrong is worse than no gauge, because nobody thinks to double-check it.
- **Need-payoff:** Refresh automatically on real trigger events (merge, build-state-change) and treat these tables as reasoning-graph material with a routine drift check, not ad-hoc SQL nobody revisits.
- **Why now:** The tables are demonstrably stale right now — this is exactly the kind of invisible, load-bearing component that looks fine at the surface while decaying underneath.
- **ROI:** Cheap fix (event-bound refresh trigger) for a silent trust failure that could mislead a future merge/gating decision.
- **Evidence:** Three sources converge from different angles — a stale-gauge-is-worse-than-no-gauge inversion, a domain-graph-vs-reasoning-graph structural split, and an invisible-component-decays-fastest pattern — all naming the same two tables as the concrete fix target. · live anchors: cockpit.build / cockpit.overall_state confirmed stale since 2026-07-22
- **What we'd build:** An event-bound refresh trigger (fires on merge/build-state-change) for cockpit.build/cockpit.overall_state, plus a routine drift check that flags when the tables haven't moved despite real activity elsewhere.
- **Coherence:** Concrete and narrow — low risk of being a semantic trap since every atom names the literal same two tables, not just shared vocabulary.
- **Member atoms:** 20, 22, 38, 54, 66
- **Actions:** Make build brief

---

★ Close the loop: TubeAIR captures land in Cairn's inbox and the knowledge note still waits on 'next session'  
**[self_improvement]** · ROI med/time · atoms 4 · 2 sources · 3 frames

- **Situation:** TubeAIR already pulls a clean YouTube transcript and hands it to Cairn's inbox, flagged pending_cairn.
- **Problem:** The write-up step is informal — 'pending, I'll write it next session' — a promise, not a defined pipeline step, so it silently accumulates.
- **Implication:** Already a logged HIGH backlog item, and the failure mode (deferred-to-a-vibe rather than a scripted step) will recur for every future capture type built the same way.
- **Need-payoff:** Make the write-up an automatic step triggered on capture, or at minimum keep the pipeline primed with cheap background activity so the expensive synthesis step never fully idles.
- **Why now:** Already a named, logged HIGH backlog item — the smallest, most concrete, most shovel-ready fix in the whole set.
- **ROI:** Removes one recurring manual promise that's already known to slip.
- **Evidence:** Two independent sources name the identical concrete target (the pending_cairn write-up step) and converge on the same diagnosis — a step filed as an informal promise rather than a defined pipeline stage — while proposing two complementary fixes (auto-write-on-capture vs. keep-the-pipeline-warm). · live anchors: TubeAIR pending_cairn write-up step, logged HIGH backlog item
- **What we'd build:** An automatic trigger that fires the knowledge-note write-up the moment a transcript lands pending_cairn; if full automation isn't safe yet, a scheduled low-stakes background pass that keeps the synthesis path primed so the real request never queues cold.
- **Coherence:** Smallest, most concrete, most shovel-ready of the surfaced set.
- **Member atoms:** 16, 21, 45, 57
- **Actions:** Make build brief

---

★ Close the Cockpit↔Brain decision loop: every Keep/Decline/Later gets written back, ruled, and reused  
**[self_improvement]** · ROI high/cognitive_load · atoms 6 · 4 sources · 3 frames

- **Situation:** Warwick reviews Cockpit cards and taps Keep/Decline/Later while the Brain surfaces new candidates to review.
- **Problem:** That loop is mostly one-way — no mandatory first-step, no written verdict rule, no explicit handling of a stalled 'Later,' and no precedent check before a near-duplicate idea resurfaces.
- **Implication:** Every gap costs Warwick a small amount of friction on every single card, and it compounds — vaguer decisions, silent re-litigation of already-declined ideas, 'Later' items quietly rotting.
- **Need-payoff:** A tighter loop: cards carry a mandatory first-step, a written NVFI-to-verdict rubric sorts cards before they reach Warwick, 'Later' gets an explicit re-surface/archive rule, and past decisions plus reasons write back into the graph so precedent is checked before a repeat surfaces.
- **Why now:** Cockpit's Keep/Decline/Later is Warwick's single highest-frequency touchpoint with this whole system — friction here is paid daily — and the Brain graph schema work happening right now is the natural place to add the write-back edge.
- **ROI:** Reduces the number and vagueness of decisions Warwick has to make per card, and stops already-declined ideas from resurfacing.
- **Evidence:** Four independent sources each name a distinct gap in the same live Cockpit decision loop — actionability, consistency, stall-handling, write-back, precedent, same-session feedback — none restating another's point. · live anchors: Cockpit Keep/Decline/Later — Warwick's live daily decision surface
- **What we'd build:** Extend the Cockpit card schema with a mandatory first-step field and a written NVFI-to-verdict rubric; add an explicit stall-branch rule for 'Later' (re-surface trigger or archive); write Accept/Decline/Later outcomes plus reasons back into the Brain graph; check new candidates against that stored precedent before they reach a Cockpit card.
- **Coherence:** Six atoms, four sources, zero restatement — each solves a genuinely different piece of the same funnel, anchored to the one live surface Warwick actually uses every day.
- **Member atoms:** 9, 19, 23, 34, 40, 51
- **Actions:** Make build brief · Explain

---

★ Point the Brain's own capture→structure→output pipeline at other people's sales calls, sell the output  
**[strategic]** · ROI med/money · atoms 2 · 1 sources · 1 frames

- **Situation:** Solo/small service-business owners (consultants, agencies, trades) run their entire sales process from memory — undocumented, un-handoffable.
- **Problem:** Fusion already built the exact pipeline needed to fix that for itself — recording intake, graph structuring, readable output — but it's only ever been pointed at Warwick's own knowledge.
- **Implication:** The same spine, repointed at a client's own recorded sales calls, converts an unstructured tacit process into a structured, sellable, hand-off-ready system, with a lightweight pipeline-visibility dashboard as a natural add-on.
- **Need-payoff:** A genuinely new external revenue line built almost entirely on capability that already exists, not a from-scratch product.
- **Why now:** The ingestion pipeline (capture → graph structuring → readable output) is already live and proven internally (TubeAIR, ObsidiWikAi) — this is a repointing exercise, not a new build.
- **ROI:** Unvalidated externally — real upside if the target market bites, but needs a market check before any build spend.
- **Evidence:** Single source, but two genuinely complementary facets — the extraction service and a dashboard bolt-on — forming one coherent, sellable bundle rather than a restatement. · live anchors: Brain ingestion pipeline (already built for internal knowledge); Cockpit dashboard pattern (already built for internal use)
- **What we'd build:** Nothing yet — this needs Pax market validation first (real demand, price point, target segment) before any build brief.
- **Coherence:** Only one independent source, below the normal two-source bar — surfaced anyway as the strongest external/strategic candidate in the set; flagged as needing validation, not build-ready.
- **Member atoms:** 26, 27
- **Actions:** Research with Pax · Explain


## EMERGING (4) — coherent but below the surface bar
- **Add a PRD-vs-built drift audit to Larry's pre-merge check** [self_improvement] — atoms 2, 4 — _Single source — two frames within one atom (mechanism+operational) clear the frame-diversity bar on their own, but there's no cross-source corroboration yet. Worth watching for a second independent hit before elevating._
- **Give the idea pipeline itself a measured flow-state (stage counts + staleness) instead of vibes** [self_improvement] — atoms 15, 18, 24 — _All three atoms come from the same single source restating the same 'measure the funnel' insight at slightly different targets — fails non-redundant-facets and independent-support. Distinct from the self-model-tables opportunity above, which targets existing tables, not this pipeline-specific view._
- **Give the Brain's entity-extraction/merge stage a dedicated, scheduled hygiene pass distinct from Cockpit's per-source review** [self_improvement] — atoms 61, 62, 63, 64, 65, 67, 68 — _Seven atoms with genuinely differentiated facets (prevention, detection, containment, governance, cadence) and a tie to already-authorized Cockpit lift-out dedup work — but all seven come from a single source (one ad), so it reads as one source's central metaphor applied seven times rather than independent corroboration. Worth a second mining pass before build-briefing._
- **myPKA itself, offered multi-tenant** [strategic] — atoms 42 — _Single atom, single source, no corroboration — and it's a substantial pivot deserving explicit research rather than surfacing off one line. Flagged for its scale, not its evidence._

## REJECTED clusters (1) — the discriminator earning its keep
- **Idea-engine self-tuning (T1/T2 calibration, Critic isolation, tier auto-routing, taxonomy locking, discard-recycling)** (atoms 1, 5, 6, 7, 8, 10, 11, 13, 31, 35, 43, 46, 47, 49, 53, 59) — volume — this is exactly the corpus's flagged self-referential bias (mined mid-experiment on the idea-engine's own T1-vs-T2 tiering). 16 of 68 atoms — nearly a quarter of the corpus — all point back at the idea-engine examining itself. Frame and source diversity don't rescue it: most atoms are a handful of source videos re-applying their central mechanism to slightly different internal targets rather than independently converging on one build thesis. None individually clears a Warwick-attention bar; a couple (taxonomy-lock-before-run, score causal-sufficiency risk) are sound enough to just apply quietly without a brief — see standalone_atoms.

## STANDALONE atoms (stay in the register)
3, 25, 28, 29, 32, 36, 37, 41, 44, 50, 52, 55, 58, 60

## Notes
Corpus explicitly warned as over-weighted toward the idea-engine improving itself; that mass (16 atoms) was isolated into one rejected cluster rather than allowed to leak volume-credit into any surfaced opportunity — no surfaced item above depends on idea-engine-internal atom count for its evidence. Every atom landed in surfaced, emerging, rejected, or standalone; nothing silently dropped.
