# Idea-engine — Neo4j graph-signal audit (investigation only, 2026-07-26; live reads)

## The failure, quantified
`suggestions.mjs` gates: `topConcepts(40)` (seed = 40 highest-degree nodes) + `exactConcept()` (discard unless
citation exactly matches one of those 40). Against the real graph: of **263 method+concept nodes** (the transferable
mechanisms), only **8 are in a top-40-by-degree window → 255 structurally invisible**. Density is **anti-correlated**
with mechanism-value: concept median degree **1**, method **2**; top-degree = generic hubs ("AI Agent" 37, "N8N" 36).
The transfer fuel ("Naive RAG", "Recency", "Conversation Window") is all deg ≤1. **This is the invariant to never recreate.**

## (a) Signal audit — real numbers
Graph: 1000 nodes / 1363 edges. Degree median 2, mean 2.73, p95 8, max 37; **69% deg≤2, 45% deg exactly 1.** All
nodes have description/source_id/file_path/created_at. entity_type populated (concept 142, method 121, artifact 316…).
**Critical caveat: the whole graph is ~5 source documents** — every cross-source signal is structurally thin TODAY.

| Signal | Today? | Quality | Freshness |
|---|---|---|---|
| Connectedness/degree | yes | **low-value as importance** (hub-biased, anti-correlated w/ mechanism-value) | live |
| **Novelty ("already in the brain?")** | **yes — STRONGEST** (`entityExists` exact + `queryData` semantic) | **high** — verified live (Honcho→known, Circadian-Scheduling→novel) | real-time |
| Recurrence (concept spans N docs) | yes | real but sparse (941 span 1 doc; only 59 span ≥2) — grows w/ corpus | ingest-time |
| Recency (created_at) | parseable | **useless now** (one 2-day ingest window, 21 timestamps) | coarse |
| Decisions around a concept | no | not viable (17 idea rows, 1 real decision; no join key) | — |
| Proximity to builds/problems | **not from graph** | build/problem state = git+BACKLOG (already the A-slice); graph has no Fusion build nodes | — |
| Source-mechanism → Fusion-target distance | **mostly not** | targets aren't graph nodes (free-text components); different namespace, no join key | — |

## (b) Proposed graph-context slice — augments, NEVER gates
**Architectural rule (preserves the invariant):** graph touches the pipeline ONLY as **post-hoc per-candidate
enrichment AFTER the Specialist emits** — never seeds ideation, never touches RECOGNISE/ANALOGISE/TRANSFER, never
decides candidate-set membership. It only adds **priors** on Novelty/Fit/Impact. A sparse/graph-absent mechanism is
transferred + emitted at FULL strength; graph can only ADD a "novel to your brain" boost, never subtract.
Per candidate, `graph_context`:
1. **`novelty_to_graph`** (HEADLINE) `{novel|partial|known, nearest}` — "genuinely new to your brain" vs "seen before".
   novel RAISES Novelty; known lowers it but MUST NOT drop the candidate (known mechanism → new target is valid).
2. **`mechanism_footprint`** (recurrence) — n≥2 docs = mild Fit/Impact prior; absence/n=1 = **NO penalty** (expected for novel).
3. **`established_hub`** (degree, DEMOTED) — informational boolean only, feeds the Specialist's own "already doing it?"
   self-kill; **never a multiplier, never a ranking key.**
4. **`target_note`** — does fusion_target resolve to a roster component (Fit sanity) — from the roster, not the graph.
Graceful degradation: while corpus is thin, almost everything returns novel/absent → contributes ≈0 (safe default);
identical slice grows valuable as ingestion broadens, no contract change.

## (c) Caveats + anti-features (forbidden — they re-introduce the gate)
Caveats: corpus=5 (cross-source signals immature); recency useless now; decision-history not viable + no join key;
source→target distance not computable (targets aren't nodes); entity_type LLM-extracted (soft hint).
❌ FORBID: top-N seed list · exactConcept citation gate · ranking/filtering by degree · graph-presence as prerequisite
· already-exists auto-kill · any penalty for sparse/low-degree/absent · graph context before/into ideation.
