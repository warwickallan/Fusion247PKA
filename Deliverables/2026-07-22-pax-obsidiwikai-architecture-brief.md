---
title: ObsidiWikAi (IDEA-007) Architecture Hardening Brief
author: Pax (Senior Researcher)
date: 2026-07-22
audience: Larry (orchestrator) — build-design decision
decision: GO/ADJUST per architecture question before walking-skeleton build
status: research complete (Correction & Deepening appended 2026-07-23)
---

# ObsidiWikAi Architecture Hardening Brief

## Executive summary

The vision is sound and buildable on the verified infra, but two instincts need to flip. **(1)** LightRAG v1.5.x *natively supports Neo4j as its own graph-storage backend* — so "LightRAG's graph" and "the Neo4j encyclopedia" are not necessarily two fighting stores, but pointing LightRAG's raw backend at Neo4j is **not** the same as a curated encyclopedia and should not be confused with it. The right architecture is **LightRAG-for-extraction/retrieval → a curated projection into a SEPARATE Neo4j encyclopedia** (Q1 option b). **(2)** Deferring Neo4j and Honcho entirely past the first URL is *partly* wrong: the graph and the lens ARE the core of the vision, and a walking skeleton that proves only "transcript in, LightRAG retrieval out" proves the least novel part. The skeleton should include a *thin* slice of the projection and the lens, not the full platform — otherwise you build a RAG demo, not ObsidiWikAi.

> **Read the "Correction & Deepening" section (bottom, 2026-07-23) alongside this — it revises Q1's implementation (one Neo4j / two logical layers), softens the GraphRAG framing, and confirms interest-conditioned extraction is supported.**

Confidence levels below: **High** = multiple independent sources incl. primary docs/source; **Medium** = one primary + secondary; **Low** = single/contested.

---

## Q1 — LightRAG vs Neo4j division of labour (THE fork)

### What LightRAG actually does and stores — **High confidence**
LightRAG runs **entity-relation extraction on every text chunk** during indexing and builds its **own internal knowledge graph plus a vector store** (the "dual-level retrieval" that is the whole point of LightRAG). It is not just a vector retriever — the graph is core to it. [HKUDS/LightRAG README]

### Does v1.5.x support a Neo4j graph backend? — **YES, High confidence (two independent sources)**
LightRAG's graph storage is pluggable. Default is `NetworkXStorage` (file-persisted, dev-only). It can be overridden to **`Neo4JStorage`** (also `MemgraphStorage`), configured via `NEO4J_URI` / `NEO4J_USERNAME` / `NEO4J_PASSWORD` env vars (bolt/neo4j URI schemes, connection-pool settings for production). Vector + KV storage are independently pluggable (PostgreSQL, Milvus, Qdrant, MongoDB). So all four storage types can be externalised.
- Source 1: [HKUDS/LightRAG README](https://github.com/HKUDS/LightRAG) — "select specialized databases … Neo4j or Memgraph for graph storage."
- Source 2: search-triangulated config detail — `graph_storage="Neo4JStorage"`, `NEO4J_URI=neo4j://…`, e.g. [homayounsrp/lightRAG Neo4j example](https://github.com/homayounsrp/lightRAG) and [LightRAG issue #222](https://github.com/HKUDS/LightRAG/issues/222).

### The critical distinction the config detail hides — **High confidence (architectural reasoning)**
Option (c) "point LightRAG's graph backend at Neo4j" works technically, but what lands in Neo4j is **LightRAG's raw, per-chunk, un-curated extraction graph** — every entity/relation LightRAG hallucinated or fragmented, keyed to LightRAG's own schema and lifecycle. That is LightRAG's *working memory*, not a "3D encyclopedia." If you also try to curate that same store, LightRAG will overwrite/rewrite it on every reprocess and you get exactly the "two fighting graphs" problem — one process owns the nodes, another edits them. **This violates derived-never-canonical**: LightRAG's backend must stay disposable. *(See C2 below — LightRAG's explicit in-place merge/edit API changes how best to implement this: two logical layers in one Neo4j, not two databases.)*

### The three options, judged
- **(a) LightRAG's graph AS the encyclopedia** — *ADJUST/reject.* Cheapest, but LightRAG's graph is optimised for retrieval, not curation. No candidate→accepted lifecycle, no clean ontology, no stable node identity across reprocessing, and it becomes canonical-by-accident. Fails the "curated, rebuildable, queryable encyclopedia" and derived-never-canonical tests.
- **(b) LightRAG for extraction/retrieval → project ACCEPTED entities/relations into a SEPARATE Neo4j encyclopedia** — **GO. Recommended.** Two stores, one boundary: LightRAG's Neo4j/NetworkX backend is disposable working memory; the curated encyclopedia is a *second* Neo4j database (or a namespaced sub-graph) that only receives entities/relations that passed the relevance lens + (optionally) Warwick's review in Directus. Clean lifecycle, stable identity, idempotent projection, rebuildable from Supabase provenance. This is the standard GraphRAG production pattern: extraction pipeline ≠ serving graph. [deepsense.ai ontology-driven GraphRAG; Memgraph "GraphRAG alongside a graph database"]
- **(c) LightRAG graph backend = the encyclopedia Neo4j** — *ADJUST/reject for curation, fine for convenience only.* Technically supported, but conflates working memory with the curated store. Only acceptable if you decide the encyclopedia is NOT separately curated — which contradicts Warwick's vision.

**Recommendation: GO with (b).** Run LightRAG on its default `NetworkXStorage` (or a *disposable* Neo4j label namespace) for the skeleton; project accepted extractions into the curated encyclopedia as a deliberate, keyed step. Do NOT let LightRAG write directly into the encyclopedia graph. *(C2 refines the "second store" into "second logical layer.")*

**Anti-patterns to avoid:** (1) letting LightRAG's raw graph *become* the encyclopedia because Neo4j-backend "just works"; (2) two processes with write access to the same nodes; (3) treating Neo4j as canonical — provenance and accepted facts must be reconstructable from Supabase + Git.

---

## Q2 — Building a clean, rebuildable concept graph at single-user scale

### Entity resolution / dedup — **High confidence**
The single biggest KG-construction failure is **fragmentation**: the same concept spawns many nodes ("IBM", "IBM Corp", "International Business Machines"; "2024" vs "Year 2024"; "IT" vs "Information Technology"). Microsoft's own GraphRAG *shipped without reliable autonomous entity resolution* — they pulled the standalone config because they "were not happy with it," and there are open bugs where dedup keeps only the first node of a title. **Do not assume the extractor dedups for you.** [microsoft/graphrag #962, #1718; Modern Data 101 / Shereshevsky] *(See C1 for the fair, non-doom reading — GraphRAG is actively maintained and does full extraction + Leiden community detection.)*

**What works (cascading, cheap-first):** Rules → embedding similarity → LLM adjudication, in that order for cost control. Use **embedding-based semantic matching** (not string overlap) as the primary signal, and **graph-aware resolution** (two candidates sharing neighbours are more likely the same entity). Avoid **pure transitive closure** (A=B, B=C ⇒ A=C blindly) — it over-merges and is the classic anti-pattern. At single-user scale you can afford an LLM adjudication step per candidate merge because volume is tiny. [Shereshevsky "Entity Resolution at Scale"; Graphlet AI "Semantic Entity Resolution"; Senzing]

### Lifecycle, provenance, idempotency — **Medium confidence (best-practice synthesis)**
- **candidate → accepted → superseded**, never hard-delete. Each node/edge carries: `source_id` (the YouTube URL / TubeAIR packet), `evidence_span`, `confidence`, `extracted_by` (model+version), `status`, `first_seen`, `superseded_by`. Provenance is what makes the store rebuildable and keeps Neo4j non-canonical.
- **Idempotent projection keyed by source:** re-ingesting the same URL must UPSERT, never duplicate. Key the projection on a stable `(canonical_entity_id, source_id)` and MERGE on canonical id — this is directly analogous to the BUILD-002 poller fix (upsert DO UPDATE COALESCE, not blind insert). Reprocessing a source should *replace that source's contribution*, not append a parallel universe.
- Store the **canonical fact + provenance in Supabase** (operational canonical) so the entire Neo4j graph can be dropped and rebuilt from Supabase + Git at any time.

### Minimal useful ontology — start tiny — **Medium confidence**
Personal-KG practice converges on **three node types to start: Concept, Entity (person/org/tool/work), Source** — plus edges: `RELATES_TO` (typed: causal / hierarchical / associative), `MENTIONED_IN` (→Source, carries provenance), `PART_OF` (hierarchy). Add types only when a query demands them. [Pavlyshyn "Personal Knowledge Graphs in Obsidian"; deepsense.ai] Resist a rich upfront ontology — over-modelling is a known GraphRAG anti-pattern that produces **"graph theatre"**: a pretty graph nobody queries. **Design the first real query before you design the schema** — if no query needs an edge type, don't create it.

**Recommendation: GO**, with a 3-node / 3-edge starter ontology, embedding+LLM cascade dedup, full provenance, source-keyed idempotent UPSERT, canonical in Supabase.

**Anti-patterns:** assuming the extractor dedups; transitive-closure over-merge; hard-deleting on reprocess; rich speculative ontology; graph theatre (no query drives the schema); Neo4j as sole home of a fact.

---

## Q3 — User-model as a relevance/classification LENS, kept separate

### What Honcho is — **High confidence (two independent sources)**
Honcho (Plastic Labs) is an **agent-memory / theory-of-mind layer**. It ingests messages and, via a fine-tuned reasoning model, writes a **structured "user representation"** (preferences, beliefs, communication style, mental models). It is queried two ways: `context()` (curated reasoning + history, ~200ms) and the **Dialectic API / `.chat()`** — a natural-language, LLM-to-LLM endpoint you *ask* about the user ("would Warwick care about X?"). Tiered cost ~$0.001–$0.50/query. [honcho.dev; docs.honcho.dev; plasticlabs.ai Dialectic API blog; NousResearch Hermes docs]

### The lens pattern (and why it fits) — **Medium confidence**
This is exactly a **relevance/classification lens**. *(Correction, see C3: the stronger and correct framing is a LIVE pre/during-extraction lens that steers LightRAG via `addon_params`, not merely a post-hoc filter.)* The user model drives *what gets in and how it's tagged*, and **never becomes a node in the encyclopedia**. This preserves Warwick's three-way separation: personal brain (Obsidian) ≠ encyclopedia (Neo4j) ≠ lens (Honcho).

### The privacy boundary — **High confidence (hard rule, matches existing doctrine)**
- **Into Honcho:** only interest/goal signals (topics, stated preferences, feedback on suggestions). **NOT** health/Samsung/employer/AsdAIr household data. This mirrors the existing "personal data never on the public repo" and AsdAIr private-Supabase doctrine.
- **Into external model APIs (LightRAG extraction, Honcho reasoning):** only **public source content** (the YouTube transcript) + coarse interest tags. Keep personal/health/employer data out of every external-API payload. Warwick's interest profile sent to Honcho should be *curated tags*, not raw journal text.
- **Inspectability:** Honcho does **not** expose raw model internals — the representation is only inspectable *through its query APIs* (`context()` returns the peer card/user representation as text). **Flag (single-source, Medium):** treat Honcho as a **semi-inspectable** store. Mitigation: keep the *canonical* interest/goal profile in Supabase/Obsidian (SSOT), feed Honcho from it, and never let Honcho become the only place a preference lives — same derived-never-canonical rule. If Honcho's model drifts or is unavailable, the lens is rebuildable.

**Anti-patterns:** pouring personal/health/journal data into Honcho or into extraction-API payloads; letting the lens become an un-inspectable black box that silently decides relevance with no audit trail (log every accept/reject verdict + reason to Supabase so Warwick can review in Directus); letting Honcho's representation become the canonical home of Warwick's goals.

**Recommendation: GO on the lens pattern; ADJUST the trust model** — treat Honcho as derived + semi-inspectable, keep canonical interests in Supabase, log every lens verdict.

---

## Q4 (lighter) — the self-improvement / monetise suggestion loop

### Evidence — **Medium confidence**
LLM "opportunity/insight" suggestion over a personal KB is a recommender-style task with two well-documented risks: **(1) confident hallucination** — plausible-sounding suggestions with no factual basis, especially dangerous in advice/monetisation framing; and **(2) feedback-loop echo** — the system reinforcing its own prior suggestions and narrowing Warwick's inputs over time. [arXiv 2401.01313 hallucination survey; arXiv 2602.07442 "Echoes in the Loop"; arXiv 2306.05817 LLM recommender survey]

### Safe pattern — **Medium confidence**
- **Grounded, not free-associating:** every suggestion must cite the encyclopedia nodes/sources it stands on (provenance pointers from Q2). No citation → no suggestion. This is the "verified/curated response before generation" mitigation.
- **Human-gated, no autonomous action** — matches Warwick's existing Codex→Telegram-card→human-tap doctrine and Fable hardlock. Suggestions land as *review cards in Directus*, never actions.
- **Confidence-labelled and falsifiable:** each suggestion states what it assumes and how Warwick could disprove it — counters overconfidence.
- **Break the echo loop:** periodically inject novelty / flag when suggestions cluster on the same few nodes.

**Recommendation: GO, but DEFER to after the graph has real content.** The suggestion loop is worthless over an empty encyclopedia — it's a Phase-2+ feature, correctly deferred past the walking skeleton.

**Anti-patterns:** ungrounded suggestions; any autonomous action; unlabelled confidence; monetisation advice presented as fact; self-reinforcing feedback loop.

---

## Recommended walking-skeleton target shape

One real public YouTube URL → BUILD-002 gateway capture → TubeAIR transcript/packet → LightRAG ingest (interest-steered via `addon_params`, see C3) producing extracted entities/relations into a **candidate inbox layer** → a **thin canonicaliser** that scores each candidate against existing nodes (embedding + neighbourhood + LLM tie-break, see C4) and routes uncertain ones to Directus → promote accepted, merged (LightRAG `merge_entities`) entities/relations into the **canonical encyclopedia layer** with full provenance, canonical-mirrored to Supabase → surface the result in Directus for Warwick to eyeball. Then **PARK**. This proves the *novel* spine end-to-end (steered extract → candidate → canonicalise → curated graph) on one URL — not just RAG retrieval — while every derived store stays rebuildable. Explicitly out of skeleton: multi-source, the suggestion loop (Q4), n8n orchestration, rich ontology, automated self-learning.

## The 3 biggest technical risks
1. **Entity fragmentation / duplicate universes** (Q2). No leader ships turnkey autonomous resolution (C1); you must implement assisted canonicalisation (C4). Idempotent source-keyed projection + embedding/LLM cascade + LightRAG `merge_entities` must be in the skeleton, or the encyclopedia rots on the second URL. **Highest risk.**
2. **Two-fighting-graphs / canonical-by-accident** (Q1/C2). If LightRAG writes directly into the canonical layer "because the backend supports it," you lose the curation boundary and violate derived-never-canonical. Keep the candidate layer disposable; promote via explicit merge.
3. **Cost + lens opacity** (Q1/Q3). Per-source extraction is token-heavy (Microsoft warns indexing is expensive) and Honcho dialectic queries are metered ($0.001–$0.50 each). Batch lens calls, cache, and hold the £3 alert / £5 stop. Log every lens config + verdict so relevance decisions are auditable, not black-box.

## Where this contradicts Larry's current instinct
- **Reuse BUILD-002 spine — GO, correct.** Gateway capture + TubeAIR packet are the right front end; no change.
- **Build the Knowledge Compiler — GO, correct**, but its hard part is *projection + dedup + provenance* (Q2/C4), not extraction. Don't underweight it.
- **LightRAG-first for retrieval — ADJUST the framing.** LightRAG's value here is *extraction + graph management* (C2), and its graph is *working memory*, not the encyclopedia. Treating it as "just retrieval" undersells and mis-slots it.
- **DEFER Neo4j-encyclopedia + Honcho past the first URL — ADJUST (your instinct is partly wrong here).** The graph + lens ARE the core of Warwick's vision; a skeleton that omits both proves only a generic RAG demo. Include a *thin* slice of each. Keep DEFERRING the *depth*: rich ontology, multi-source, the suggestion loop, n8n, automated self-learning. Thin-slice the novel spine; defer the platform.

## Methodology & limitations
Sources triangulated across LightRAG primary docs/source + independent config examples, Microsoft GraphRAG issue tracker + changelog (primary), KG-construction practitioner writing, Honcho primary docs + independent reviews, and arXiv surveys for Q4. **Limitations:** (1) Some LightRAG behaviours verified at README/doc/config level, not by reading the pinned v1.5.4 source line-by-line — see the "verify by doing" list in C. (2) Honcho inspectability is single-source (docs don't detail export/audit) — flagged Medium, mitigated by keeping canonical interests in Supabase. (3) Q4 evidence is pattern-level, not ObsidiWikAi-specific.

## Sources
- [HKUDS/LightRAG (README, storage backends, Neo4j)](https://github.com/HKUDS/LightRAG)
- [homayounsrp/lightRAG — Neo4j example](https://github.com/homayounsrp/lightRAG) · [LightRAG issue #222 (Neo4j URI)](https://github.com/HKUDS/LightRAG/issues/222)
- [microsoft/graphrag #962 (enable entity resolution)](https://github.com/microsoft/graphrag/issues/962) · [#1718 (dedup bug)](https://github.com/microsoft/graphrag/issues/1718)
- [Shereshevsky — Entity Resolution at Scale](https://www.moderndata101.com/blogs/entity-resolution-at-scale-deduplication-strategies-for-knowledge-graph-construction) · [Graphlet AI — Semantic Entity Resolution](https://blog.graphlet.ai/the-rise-of-semantic-entity-resolution-45c48d5eb00a) · [Senzing — Entity-Resolved KGs](https://senzing.com/entity-resolved-knowledge-graphs/)
- [deepsense.ai — Ontology-Driven KG for GraphRAG](https://deepsense.ai/resource/ontology-driven-knowledge-graph-for-graphrag/) · [Memgraph — GraphRAG alongside a graph DB](https://memgraph.com/blog/how-microsoft-graphrag-works-with-graph-databases) · [Pavlyshyn — Personal KGs in Obsidian](https://volodymyrpavlyshyn.medium.com/personal-knowledge-graphs-in-obsidian-528a0f4584b9)
- [honcho.dev](https://honcho.dev) · [docs.honcho.dev overview](https://docs.honcho.dev/v2/documentation/introduction/overview) · [Plastic Labs — Dialectic API](https://plasticlabs.ai/blog/archive/ARCHIVED;-Introducing-Honcho's-Dialectic-API) · [NousResearch Hermes — Honcho](https://github.com/NousResearch/hermes-agent/blob/main/website/docs/user-guide/features/honcho.md)
- [arXiv 2401.01313 — Hallucination Mitigation Survey](https://arxiv.org/html/2401.01313v1) · [arXiv 2602.07442 — Echoes in the Loop](https://arxiv.org/pdf/2602.07442) · [arXiv 2306.05817 — LLMs for Recommender Systems](https://arxiv.org/pdf/2306.05817)

---

# Correction & Deepening (appended 2026-07-23)

Warwick + GPT pushed back, correctly, on four points where the first pass over-reached or under-specified. This section supersedes the harsher readings above where they conflict. **Net effect on recommendations: no reversal — but confidence in the architecture goes UP, because the two tools I leaned on (LightRAG, and graph-KG systems generally) turn out to have the exact primitives this design needs.**

## C1 — Microsoft GraphRAG: the fair picture (correcting my Q2 doom reading) — **High confidence**
My first pass ("removed entity resolution, no replacement, known drop-node bugs") was accurate about *one specific autonomous config* but framed as if graph-KG systems don't work. That was over-reach. The fair picture:
- GraphRAG is **actively maintained** — latest is **v3.1.1** (changelog + releases confirm ongoing work; recent entries include "filter phantom relationships in graph" at v3.0.6, a CosmosDB table provider, streaming workflows). It is not abandoned. [microsoft/graphrag CHANGELOG](https://raw.githubusercontent.com/microsoft/graphrag/main/CHANGELOG.md) · [releases](https://github.com/microsoft/graphrag/releases)
- It **still does the full pipeline**: entity extraction, relationship extraction, claim/covariate extraction, and **hierarchical Leiden community detection** with per-community LLM summaries. [Community detection docs](https://www.mintlify.com/microsoft/graphrag/concepts/community-detection) · [GraphRAG dataflow](https://microsoft.github.io/graphrag/index/default_dataflow/) · [Bertelsmann step-by-step](https://tech.bertelsmann.com/en/blog/articles/how-microsoft-graphrag-works-step-by-step-part-12)
- **On entity resolution specifically:** GraphRAG largely handles concept consolidation *through community detection + summarization* rather than a dedicated deterministic dedup step. The standalone entity-resolution config was pulled because the team wasn't satisfied with it — i.e. they removed a **generic, fully-autonomous** resolver, not the ability to build useful graphs. [microsoft/graphrag #962](https://github.com/microsoft/graphrag/issues/962)
- **Corrected takeaway:** *generic, fully-autonomous entity resolution is imperfect and the leaders don't ship it turnkey* — therefore ObsidiWikAi should treat canonicalisation as a **deliberate, assisted, human-reviewable step** (C4), not expect it for free. A design nudge, not a reason for pessimism. **This actively validates the curated-projection architecture (Q1 option b / C2).**

## C2 — LightRAG is a graph-management tool, not just an extractor (deepening Q1/Q2) — **High confidence, primary source**
Confirmed from LightRAG's core programming doc that it exposes **explicit, callable entity/relation management** — the single most important correction, because it means LightRAG can *do the canonicalisation work itself*, in-place, with merges propagating to the configured backend:
- **`merge_entities(source_entities, target_entity, merge_strategy, target_entity_data)`** (+ async `amerge_entities`). Documented behaviour: *"All relationships from source entities are redirected to the target entity. Duplicate relationships are intelligently merged. Self-relationships (loops) are prevented. Source entities are removed after merging."* This is **exactly** the AI / Artificial Intelligence / Machine Intelligence → one-node merge WITH relationship redirection that was asked about. Merge strategies: `concatenate`, `keep_first`, `join_unique`. [LightRAG ProgramingWithCore.md](https://github.com/HKUDS/LightRAG/blob/main/docs/ProgramingWithCore.md) · corroborated by [LightRAG issue #1323](https://github.com/HKUDS/LightRAG/issues/1323)
- Full CRUD siblings: `create_entity`, `edit_entity`, `delete_by_entity`/`adelete_by_entity`, `create_relation`, `edit_relation`, `delete_by_relation`. [same doc] · [DeepWiki: Entity & Relation Extraction](https://deepwiki.com/HKUDS/LightRAG/2.2-document-processing-pipeline)
- **Does merge work with `graph_storage=Neo4JStorage`?** These operate through LightRAG's storage abstraction, so they apply against whichever backend is configured — the mutations land in Neo4j when Neo4j is the graph store. **Confidence Medium-High:** confirmed at the API/abstraction level, **not** yet line-verified against the pinned **v1.5.4** tag with a live Neo4j backend. *Action before relying on it: run `merge_entities` against v1.5.4 + Neo4j once and confirm the node/edge rewrite in the graph.*
- **Architectural consequence — this simplifies the design.** My Q1 assumed the canonical encyclopedia had to be a fully separate DB from LightRAG's graph. Given LightRAG's in-place merge/edit API, the cleaner shape is Warwick's: **one Neo4j service, two logical layers** — a *candidate inbox* (fresh extractions, LightRAG's raw output) and a *canonical encyclopedia* (promoted, merged, provenance-stamped nodes), distinguished by a `status` label/property, with LightRAG's own `merge_entities`/`edit_entity` doing the promotion mutations. The "derived-never-canonical" rule still holds via the Supabase provenance mirror; the two *logical* layers replace the two *physical* stores. **This ADJUSTS my Q1 recommendation: keep option (b)'s curation boundary, but implement it as two layers in one graph, not two databases.**

## C3 — Interest-conditioned extraction IS supported (the crux) — **High confidence**
The vision's hardest requirement — Honcho as a lens that *steers extraction before/during analysis*, not a post-hoc filter — is achievable with real LightRAG hooks, not a fork:
- **`addon_params["entity_types_guidance"]`** and **`addon_params["entity_type_prompt_file"]`** — inject custom entity-type guidance into the extraction prompt at ingest. Precedence: `entity_types_guidance` > prompt-file profile > built-in default. `addon_params` is an *observable mapping* — updating it marks the prompt cache dirty and the next extraction rebuilds runtime config, so **the lens can evolve between ingests and take effect on the next document without a restart.** [LightRAG issue #308 (Custom Entity Types & Prompts)](https://github.com/HKUDS/LightRAG/issues/308) · [issue #665](https://github.com/HKUDS/LightRAG/issues/665) · [discussion #1672 (custom extraction prompt)](https://github.com/HKUDS/LightRAG/discussions/1672) · [prompt.py](https://github.com/HKUDS/LightRAG/blob/main/lightrag/prompt.py) · [Neo4j: Under the covers with LightRAG — Extraction](https://neo4j.com/blog/developer/under-the-covers-with-lightrag-extraction/)
- **Custom extraction prompt** (override `PROMPTS["entity_extraction"]` / provide a profile) lets you seed *emphasis* — "pay special attention to concepts related to <Warwick's active interests + adjacent domains>" — while the base prompt still performs a **broad discovery pass**. This gives exactly the "look harder for specific + adjacent concepts, but don't tunnel-vision" behaviour.
- **Pattern for the lens loop:** Honcho's dialectic output → a compact interest/entity-type guidance string + seed concept list → written into `addon_params` before each ingest batch. As Honcho learns Warwick, the guidance broadens, capture scope expands, and — per Warwick's note — **historical low-confidence candidate nodes can be re-mined** by re-running extraction/promotion with the widened lens. This is the "evolving lens" the coordinator described, and LightRAG's dirty-cache `addon_params` is the mechanism that makes it live.
- **Caveat (Medium):** steering biases what gets *extracted*; keep a floor of un-steered broad extraction so the lens narrows *emphasis*, not *coverage* — otherwise you get a self-reinforcing interest bubble (same echo-loop risk as Q4). Log lens config per ingest so any node's "why was this captured" is auditable.

## C4 — Canonicaliser prior art (deepening Q2) — **High confidence**
There is direct, named prior art for the classify-a-candidate-against-existing-nodes step Warwick wants (same / alias / broader / narrower / related / contradictory / new / uncertain):
- **"Extract–Define–Canonicalize (EDC)"** is the closest published framework: an LLM-based KG-construction pipeline whose explicit third stage *canonicalizes* extracted triplets by mapping semantically equivalent entities/relations to a single canonical form. [EDC framework review](https://www.themoonlight.io/en/review/extract-define-canonicalize-an-llm-based-framework-for-knowledge-graph-construction)
- **The working recipe (triangulated):** (1) **hybrid representation** — TF-IDF of the name + semantic embedding of the description; (2) **agglomerative clustering with a dynamic threshold** to propose candidate matches; (3) **graph-neighbourhood overlap** as an independent signal (shared neighbours ⇒ more likely same concept — random-walk / N-hop context); (4) **LLM judge as tie-break** to confirm merge, or to *split* a cluster when members are related-but-distinct (this is where broader/narrower/related/contradictory get assigned). [EDC review] · [Springer survey: KG entity alignment via graph embedding](https://link.springer.com/article/10.1007/s10462-024-10866-4) · [Hagerer — KG creation using LLMs](https://medium.com/@jhagerer/knowledge-graphs-200d5c2cf243)
- **Threshold routing to human review:** choose thresholds **conservatively** (bias against auto-merge). Route the **uncertain band** — high embedding similarity but low neighbourhood overlap, or LLM low-confidence — to **Directus** for Warwick's decision. Auto-merge only the high-confidence `same`/`alias` band; auto-create only the clearly-`new` band; everything ambiguous waits. [EDC review]
- **Pitfalls at single-user scale:** (a) **over-merging** related-but-distinct concepts (e.g. "RAG" vs "GraphRAG") — the classic transitive-closure / aggressive-threshold error; conservative thresholds + the split-capable LLM judge counter it. (b) **Cold-start sparsity** — with few nodes, neighbourhood-overlap signal is weak, so early on lean more on embedding + LLM and expect a higher human-review rate; it self-improves as the graph grows. (c) **Review fatigue** — if the uncertain band is too wide, Warwick drowns; tune the band so the *inbox* stays small, and let low-confidence candidates sit un-promoted (re-mined later per C3) rather than forcing a decision. (d) **Non-idempotent promotion** — key promotion on `(canonical_id, source_id)` so re-mining a widened lens UPSERTs, never duplicates (ties back to the Q2 idempotency rule).

## What changed vs the original brief
- **Q1:** recommendation stays option (b) *conceptually*, but **implementation ADJUSTS** to Warwick's "one Neo4j, two logical layers (candidate inbox + canonical)" using LightRAG's own `merge_entities`/`edit_entity` for promotion — cleaner than two physical databases. Derived-never-canonical preserved via the Supabase provenance mirror.
- **Q2:** the "GraphRAG can't dedup" framing is **softened to** "no leader ships turnkey autonomous resolution → do it as a deliberate assisted step (C4)." LightRAG's explicit merge API means much of this is a library call, not bespoke code.
- **Q3 (the crux):** upgraded from "post-extraction relevance gate" to **"live pre/during-extraction lens via `addon_params`"** — confirmed supported; the correct and more powerful framing.
- **Overall confidence: raised.** The novel spine (steered extraction → candidate inbox → assisted canonicalisation → curated encyclopedia) maps onto documented LightRAG primitives + published canonicalisation prior art. Fewer unknowns than the first pass implied.

## Residual things to verify by *doing* (before trusting them in the build)
1. `merge_entities` / `edit_entity` mutate a **Neo4j** backend correctly on the **pinned v1.5.4** tag (not just default NetworkX) — one live test.
2. `addon_params["entity_types_guidance"]` dirty-cache actually re-steers the *next* ingest without restart on v1.5.4.
3. GraphRAG **v3.1.x exact release date** could not be machine-confirmed (the changelog carries no dates; the releases-page parse was unreliable). The *actively-maintained + full-pipeline* facts are solid; treat any specific "May 2026 / v3.1.0" date as unverified until read directly off the releases page.

## Added sources
- [microsoft/graphrag CHANGELOG](https://raw.githubusercontent.com/microsoft/graphrag/main/CHANGELOG.md) · [releases](https://github.com/microsoft/graphrag/releases) · [Community detection docs](https://www.mintlify.com/microsoft/graphrag/concepts/community-detection) · [default dataflow](https://microsoft.github.io/graphrag/index/default_dataflow/) · [Bertelsmann step-by-step](https://tech.bertelsmann.com/en/blog/articles/how-microsoft-graphrag-works-step-by-step-part-12)
- [LightRAG ProgramingWithCore.md (entity/relation API)](https://github.com/HKUDS/LightRAG/blob/main/docs/ProgramingWithCore.md) · [DeepWiki extraction pipeline](https://deepwiki.com/HKUDS/LightRAG/2.2-document-processing-pipeline) · [issue #1323 (auto-merge same entity)](https://github.com/HKUDS/LightRAG/issues/1323)
- [LightRAG issue #308 (custom entity types & prompts)](https://github.com/HKUDS/LightRAG/issues/308) · [#665 (custom entity types)](https://github.com/HKUDS/LightRAG/issues/665) · [discussion #1672 (custom extraction prompt)](https://github.com/HKUDS/LightRAG/discussions/1672) · [prompt.py](https://github.com/HKUDS/LightRAG/blob/main/lightrag/prompt.py) · [Neo4j — Under the covers: Extraction](https://neo4j.com/blog/developer/under-the-covers-with-lightrag-extraction/)
- [Extract-Define-Canonicalize (EDC) framework](https://www.themoonlight.io/en/review/extract-define-canonicalize-an-llm-based-framework-for-knowledge-graph-construction) · [Springer — KG entity alignment via graph embedding](https://link.springer.com/article/10.1007/s10462-024-10866-4) · [Hagerer — KG creation using LLMs](https://medium.com/@jhagerer/knowledge-graphs-200d5c2cf243)
