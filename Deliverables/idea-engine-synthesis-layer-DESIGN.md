# Synthesis Layer — atoms → opportunities (DESIGN, no build)

**North-star for this layer:** Fusion preserves every atomic idea, but Warwick primarily sees **chunky
opportunities / build theses** created by joining related evidence across ideas, sources, live problems, prior
decisions and system state. Flow: `idea atoms → durable register/graph → synthesis → opportunity → Warwick`
(never `atoms → Warwick`).

**Proving dataset:** the 68 kept candidates from the frozen T1-vs-T2 experiment (`Deliverables/idea-engine-exp-raw-*.json`,
extracted to `_corpus-dump.txt`). Atom numbers below (#N) index that dump. **This analysis worked the real corpus —
the clusters are proven/refuted against atoms, not accepted because GPT proposed them.**

> **Load-bearing caveat (read first):** the experiment ran under a git-live brief that told the engine "you are
> mid-experiment on T1-vs-T2 right now." The corpus is therefore **over-weighted toward the idea-engine improving
> itself** (~15 atoms target `t2-calibrate.mjs` / the Critic / calibration). A random-day Mine would be more diverse.
> This inflates apparent cluster mass and is corrected for below (see Cluster F). It does not invalidate the synthesis
> exercise — it makes the semantic-vs-thesis discriminator matter *more*.

---

## The discriminator (the crux) — SEMANTIC CLUSTER vs BUILD THESIS

A candidate cluster earns Warwick's attention as an **Opportunity** only if it passes all four. Graph density / edge
count is deliberately absent — *seven weak ideas with seven edges are still seven weak ideas.*

1. **COHERENT OUTCOME (hard gate).** There is one describable thing you could build such that building it satisfies/
   subsumes most atoms in the cluster — not "they mention the same noun."
2. **NON-REDUNDANT FACETS.** Atoms contribute *different* evidence/angles to that outcome (different mechanisms/
   sources/frames), not restatements of one idea.
3. **INDEPENDENT SUPPORT.** ≥2 independent **sources** OR ≥2 independent **reasoning frames** reach it (corpus-scale
   version of the T2 `novel_independent` signal).
4. **LIVE ANCHOR.** It attaches to a real Fusion problem / build / decision, not free-floating theory.

Fail any → it stays in the **Idea Register** (semantic cluster or standalone), it does **not** surface.
*Worked rejection:* many atoms "mention Neo4j" (#36 memory API, #37 retrieval, #42 multi-tenant product, #44 community
detection) — a tempting "graph cluster," but they build four different things → **rejected as semantic**; atoms
distributed to their real theses. That is the discriminator earning its keep.

---

## 1–4. CLUSTER VERDICTS (proven / refuted / missed) + atom assignments

| # | Opportunity thesis | Verdict | Atoms | Sources | Frames | Live anchor |
|---|---|---|---|---|---|---|
| **1** | **CONTEXT FABRIC** — a durable, continuously-current model of what Fusion is doing, decided, why, and what Warwick cares about, available across sessions & agents | **PROVEN (strongest)** | #12 #14 #17 #20 #22 #30 #33 #38 #39 #48 #54 #56 #66 | 5 (ADHD, Business, ContextGraphs, Audi, AirFryer) | 4 (F1/F2/F3/F5) + 3 T1 | HIGH backlog "context evaporation" (#48, flagged 2026-07-26); decision-rationale log already seeded; `cockpit.build`/`overall_state` stale since 2026-07-22 |
| **2** | **DECISION LEARNING LOOP** — Fusion learns from Warwick's actual Keep/Decline/Later + the engine's own kill-decisions, instead of proposing against a blank judgement state | **PROVEN** | #9 #23 #31 #34 #40 #47 #49 #51 #59 | 3 (ContextGraphs, Audi, Business) | F1/F2/F3/F5 | Cockpit Keep/Decline/Later is live; killed-candidate data produced every Mine |
| **4** | **INTENT-AWARE ASSURANCE** — verify builds/decisions achieve the *intended outcome*, not literal test/checklist satisfaction (letter-vs-spirit) | **PROVEN** | #2 #4(novel_indep) #5 #8 #11 #28 #46 #53 #55 #60 | 3 (ADHD, Audi, Business) | F1/F2/F3/F5 | Builder Preflight, Critic self-kill, Vex WS-003 checklist all live |
| **3** | **PROACTIVE OUTPUTS** — surface meaningful change/connection without Warwick asking | **SUPPORTED (splits)** | #18 #22 #24 #25 #32 #37 #44 #50 | 3 | F1/F3/F5 | Outputs Layer = north star |
| **G** | **BRAIN INGESTION HYGIENE** — the compiler's entity-extract/merge is one central point that silently accumulates error and needs a normalization/hygiene discipline | **MISSED by GPT — real but source-concentrated → EMERGING** | #29 #36 #37 #61 #62 #63 #64 #65 #67 #68 | 3 (mostly AirFryer) | F1/F2/F3/F5 | ObsidiWikAi WP1.5 lens-conditioning; dedup/canonicalisation; Cockpit lift-out corrections |
| **F** | "IDEA-ENGINE SELF-IMPROVEMENT" | **REFUTED as its own opportunity** | #1 #6 #7 #13 #15 #35 #43 (+#47/#49/#55/#59 shared) | — | — | — |
| **5** | **EXPLAINER / CONTENT LAYER** | **REFUTED as a corpus cluster** | #58 only (n=1) | 1 | 1 | — |

**Notes on the corrections (this is the value-add over GPT's read):**

- **Cluster 5 (Explainer) is refuted as a *cluster*** — exactly **one** atom (#58 "ExplainAIr") supports it. It is a
  genuine *need* the experiment exposed (60 cards are hard to grasp), but the corpus does not synthesize it. **It
  belongs as an Opportunity *feature* — the "Explain this to me" action (§8) — not a synthesized opportunity.** #58
  becomes the *mechanism* for that feature. Honest refutation, need preserved.
- **Cluster F ("improve the idea-engine") is refuted as a separate opportunity.** It *looks* like the biggest cluster
  (~15 atoms) but that mass is the **git-live-brief contamination**. Decomposing it: its durable residue is *killed-
  idea feedback* (→ Cluster 2) and *check-the-critic-for-bias* (→ Cluster 4). What's left (#1 #13 #35 #43 tier-
  calibration) is the engine narrating its own live experiment — **navel-gazing, not a durable transfer**. It
  dissolves into 2 + 4 + noise. A synthesis layer that reported "improve the idea-engine!" as a top opportunity would
  be fooled by volume — precisely the failure you warned against.
- **Cluster 3 splits** into (a) **graph-community-change surfacing** (#32 #44 — the true "you nearly missed this",
  Louvain over the graph) and (b) **pipeline-staleness nudges** (#18 #22 #24 #25 — simpler instrumentation). (a) is
  the north-star mechanism; (b) is a cheap early win. Also: **this synthesis layer we are designing IS Cluster 3(a)**
  applied to ideas — the opportunity and the layer are the same faculty pointed at itself.
- **Cluster 1 has three facets** worth naming (they share one substrate, the decision/context store): (a) session
  continuity / short-term-memory persistence (#12 #39 #48 #56), (b) decision-WHY capture (#14 #17 #30 #33), (c)
  operational self-model freshness — `cockpit.build`/`overall_state` (#20 #22 #38 #54 #66). One build thesis, three
  facets. **Clusters 1 and 2 share the decision-log substrate but are distinct outcomes** (durable memory vs active
  learning); 2 depends on 1.

**Genuinely standalone atoms** (stay in the Register, do not join a thesis): #3 (require PRD+spec before a build
session — build-*input* discipline, a thin micro-thesis with #15, not assurance), #10/#26/#27/#41/#42 (commercial
"productise the spine" — loosely coherent but **not-now** per the personal-brain-first roadmap; parked-cash), #52
(background-agent vent path — infra safety), #29 (ontology/pot-size cap — scaling concern, weakly joins G).

---

## 5. Opportunity scoring (incl ROI) — a prior for ranking, never a gate that hides atoms

The **coherence gate** (above) is the only hard pass/fail. Everything else is a weighted **evidence prior** that sets
surface priority. All atoms stay durable and inspectable regardless of score.

`OpportunityStrength = f(` (each 0–1, weighted)
- **independent_source_count** — distinct sources (recurrence across unrelated origins = strong)
- **independent_frame_count** — distinct reasoning frames / T2 `novel_independent` convergence present
- **source_evidence_quality** — verbatim quote + named mechanism vs hand-wave (avg of member atoms)
- **live_anchor_strength** — links to HIGH backlog / active WP / recent decision (0 if free-floating)
- **prior_decision_alignment** — matches Warwick's stated preferences/decisions (+), or *conflicts* (flag, don't hide)
- **graph_novelty_recurrence** — novel-to-graph (+ for surprise) and cross-source recurrence (+ for durability)
- **feasibility** — build tractability (viability), penalises "needs a platform first"
- **coherence_confidence** — how cleanly the atoms resolve to ONE outcome (the anti-semantic-cluster continuous score)
`)`

**ROI / VALUE (named, not a fake number).** ROI = **expected value ÷ feasibility-adjusted build cost**, expressed as
a band (high/med/low) **with the value-type named**, weighted toward Warwick's Impact lens: *kills a manual step ·
catches a blind spot · changes what he'd do next · unblocks the north star · money*. Cognitive-load reduction counts
as value. Never invent hours/£ we can't defend; say "removes the manual X you do every session" not "saves 4.2h/wk."

Anti-gaming rules, explicit: **edge count is not a term.** Independent-*source* and independent-*frame* counts are
capped and diminishing (the 8th atom from the same source adds ~nothing). A cluster of restatements scores low on
`source_evidence_quality × coherence_confidence` even with many atoms.

---

## 6. Neo4j role + graph representation — recall, never verdict

Graph **proposes candidate clusters** (recall); a **synthesis reasoning pass adjudicates** them (precision, coherence
gate). Density never decides.

**Model:**
- `(:IdeaAtom {id, source_id, engine, frames[], nvfi, target, spin, reasoning, decision_state})`
- `(:IdeaAtom)-[:FROM_SOURCE]->(:Source)`, `-[:VIA_FRAME]->(:Frame)`, `-[:TARGETS]->(:Component|:Problem)`,
  `-[:SUPPORTS]->(:Opportunity)`, `(:Opportunity)-[:ANCHORS_TO]->(:Problem|:Decision)`
- Atoms link into the **existing** Brain graph via `:TARGETS` a component/problem node → provenance + live-anchor come for free.

**What the graph provides:** (i) **provenance** (which atoms/sources/frames/decisions back an opportunity — the
expandable trail); (ii) **candidate discovery** — Louvain community detection (#32/#44) over the atom+problem+decision
subgraph *proposes* co-membership; (iii) **novelty/recurrence** signals per §5. **What it must never do:** decide an
opportunity by node count / community size / edge density. A community is a *hypothesis for the synthesis pass to test
against the coherence gate*, nothing more. **Graph availability is optional for v1** — atom metadata (shared target/
source/frame/invariant) already yields candidate clusters without a graph, so the graph is an enrichment, not a
dependency (consistent with the T2 Neo4j audit: augment, never gate).

---

## 7. Synthesis cadence — how / when it runs

Not per-atom (that surfaces noise). Triggered by **accumulation**:
- after each Mine (new atoms land), and/or on a light cadence (weekly), **re-run synthesis over the register**;
- a new atom that pushes a *weak* cluster past the coherence gate promotes it to **emerging**; enough evidence past
  threshold promotes **emerging → surfaced** (only surfaced opportunities reach Warwick);
- incremental: only clusters touched by new atoms re-score; unchanged opportunities are stable.
- **Silent-truncation guard:** if synthesis caps surfaced opportunities (top-N), it logs what it held back as
  emerging — never a silent "nothing new."

Pipeline: `atoms persist → (graph) community proposal → synthesis pass adjudicates each candidate (gate + score) →
opportunity state updated → surface only ≥ threshold`.

---

## 8. Opportunity Cockpit — two user-facing levels

**A · IDEA REGISTER** (the library). Complete corpus, searchable/filterable (source, frame, target, engine, decision-
state, opportunity-membership), graph-linked (an atom shows its opportunities + related atoms). **Not** competing for
attention — you go to it, it doesn't come to you. In the current Cockpit this is what the **Ideas** lane becomes.

**B · OPPORTUNITIES** (the small active set). A new lane *above* Ideas. Each is a **SPIN-first card**, reusing the
existing card + detail-sheet pattern, with every field you specified:

```
HEADLINE
SITUATION      what is happening now
PROBLEM        the coherent problem the linked atoms collectively expose
IMPLICATION    why it's worth Warwick / build attention
NEED-PAYOFF    the meaningful outcome the opportunity delivers
WHY NOW        what changed / accumulated / converged to surface it now
ROI / VALUE    named value-type + band (time / quality / reliability / capability / money / cognitive load)
EVIDENCE       "7 atoms · 4 independent sources · 3 frames · linked to 2 live problems · 1 novel-independent convergence"
WHAT WE'D BUILD  short human outline of the likely build (NOT a pretend PRD)
PROVENANCE     ▸ expandable: atoms, source evidence (quote+timestamp), graph relationships, prior decisions
ACTIONS        Keep watching · Explain this to me · Research with Pax · Make build brief · Later · Decline
```

Technical detail is **layered under** the human presentation (behind Provenance / Details), never discarded.

---

## 9. "Explain this to me" / YouTube-script output

On-demand, one model call, **bound to the opportunity's provenance** (cites its atoms/sources — can't drift past the
evidence). Layered output:
1. plain-English what-it-is · 2. why it matters *to Warwick specifically* · 3. an analogy/example · 4. what the build
looks like · 5. expected payoff · 6. risks · 7. **optional 5–8 min explainer script**.

Decision-support first (Warwick's understanding — the experiment's clearest lesson: good ideas die on unreadable
cards). A **public-safe variant later** (strip internal specifics, keep the transferable insight) = a VlogOps/YouTube
**content seed**. Mechanism = atom **#58 "ExplainAIr"** — the lone Explainer atom becomes this feature's engine, so
the refuted Cluster 5 is preserved as the tool that powers §8. Closes cleanly into the Outputs Layer.

---

## Opportunity state machine

`weak cluster` (graph co-membership, coherence unproven) → `emerging` (coherence gate passed, below surface
threshold) → `surfaced` (score ≥ threshold, shown to Warwick) → **Warwick interest** (Keep watching / Explain) →
`researching` (Pax, if requested) → `build brief` → **BUILD**.
Plus **Later** (re-surfaces on new supporting evidence) and **Decline** (suppresses the cluster; *the decline reason
feeds Cluster 2's learning loop* — a declined opportunity teaches future ranking). New atoms can revive a Later/weak
cluster; nothing is lost.

---

## 10. Smallest proof — atoms → opportunity WITHOUT building a platform

**Do not build the register, the graph schema, or the Opportunity Cockpit yet.** The faculty to prove is *synthesis*,
and it is provable with the pattern we already own.

**The proof = one corpus-level synthesis pass** (a single Sonnet `claude -p` call, exactly the shape of the T2
convergence/lead pass but ranging over all 68 durable atoms instead of one fixture's branches). It receives the atoms
+ the §-discriminator + the §5 scoring rubric and must emit:
1. **3–5 Opportunity cards** (the §8 SPIN-first shape, with evidence strength + member atoms + ROI band);
2. an explicit **rejected list** — semantic clusters it refused and *why* (must reject the "graph cluster" and the
   brief-induced "improve-the-idea-engine" mass);
3. the **standalone** atoms it left in the register.

**Inputs already exist** (the raw dumps); **no new infrastructure** (no Neo4j required — atom metadata carries
target/source/frame; graph is a later enrichment). **This design section is itself the manual version of that pass** —
the cluster table above is the human proof that atoms→opportunities is real on this corpus. The automated pass is the
smallest *buildable* proof, and its acceptance test is sharp: **does it reproduce these proven clusters, correctly
reject the two traps (semantic "graph" cluster + brief-induced volume), and produce cards Warwick finds more valuable
than 68 atoms?** If yes → the faculty works → *then* build register → graph → cockpit incrementally. If no → we learn
the discriminator needs work before any platform exists.

**Cost shape:** one `claude -p` call over ~68 compact atoms ≈ a single T2-branch-sized call (£0 marginal on Max). No
fan-out, no platform, reversible.
