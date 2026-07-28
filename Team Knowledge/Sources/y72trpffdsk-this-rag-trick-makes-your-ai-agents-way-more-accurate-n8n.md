---
source_id: y72TrpffdSk
type: source-knowledge-note
source_type: youtube_transcript
title: This RAG Trick Makes Your AI Agents WAY More Accurate (n8n)
source_url: "https://www.youtube.com/watch?v=y72TrpffdSk"
video_id: y72TrpffdSk
channel: The AI Automators
published: 2025-10-13
transcript_source: auto_captions
captured_at: "2026-07-23T17:19:20+00:00"
capture_id: null
review_state: ai_created
build: BUILD-002
authored_by: cairn-sonnet
raw_evidence:
  - Sources/_raw/y72TrpffdSk/tubeair-report.md
  - Sources/_raw/y72TrpffdSk/manifest.json
tags:
  - youtube
  - source-knowledge
  - pending-warwick-review
---

## Executive orientation

This is a technical deep-dive by The AI Automators (n8n/RAG-focused YouTube channel) on why RAG (Retrieval-Augmented Generation) agents produce inaccurate or hallucinated answers: they retrieve isolated document fragments with no awareness of the document's structure. The video presents and demos five concrete "context expansion" techniques — implemented in n8n with Supabase/Postgres — that let an agent recover surrounding structural context after an initial vector search, culminating in a custom-built "agentic expansion" system driven by an extracted document hierarchy. The core argument: vector/hybrid search should only be a first-pass narrowing step, never the final source of context.

## What the source says

**The core problem: structural blindness causes hallucination.** [00:00–05:28] When a document is chunked and embedded, the vector store returns isolated fragments with no memory of where those fragments sit in the document. The presenter's running example: an insurance policy where a chunk says tennis elbow is covered, but a *different* chunk (never retrieved) says this falls under a policy *exclusions* section. The agent, seeing only the positive-sounding fragment, can confidently but wrongly conclude the injury is covered. **Counterintuitive reversal stated explicitly**: this is *not really the agent hallucinating* — "it's that it didn't get accurate enough information back from the vector store." The fix is not better prompting or a smarter model; it's giving the agent structural awareness the vector store doesn't provide by default.

**Competing/complementary mitigation approaches and their tradeoffs** [05:28–06:41]:
- **Contextual embeddings**: an LLM generates a one-sentence context snippet prepended to each chunk before embedding. Downside stated directly: requires an LLM call *per chunk*, so it is costly and "not really that scalable."
- **Query expansion**: agent fires multiple reformulated queries at the vector store from different angles. Downside stated directly: "lacks reliability."
- **Context expansion** (the video's actual subject): after an initial vector search returns candidate chunks, the agent uses a *separate* retrieval mechanism to pull in surrounding structural context. Framed as superior because it doesn't need an LLM call per chunk and works at scale.

**Five context expansion methods, in ascending sophistication** [06:41 onward]:

1. **Full document expansion** [06:41–13:00]. Agent gets candidate chunks (each carrying a `doc_id` in metadata), agent's reasoning selects the "golden chunk," then a tool does a plain SQL `SELECT` for all rows with that `doc_id`, loading the entire source document into context. Simplest and most accurate (comparable to just reading the source), but explicitly flagged as the *most expensive* option — impractical for long (e.g. 200-page) documents, fine for short ones. Presenter suggests a cost-guard pattern: store total character count in metadata, and only trigger full-document load if under a threshold; otherwise fall back to a cheaper method. Also notes this can be done as a cheaper deterministic LLM chain (rewrite query → retrieve/rerank → pick best chunk → size-gated branch → fetch full doc or file → final response) instead of an agentic loop, trading flexibility for speed/cost.

2. **Neighbor expansion** [13:22–15:29]. Fetches the chunk immediately before and after the selected chunk, using line-number metadata n8n's vector store integrations provide natively (start/end line per chunk). Query logic: find the chunk whose end line is (start-line − 1) and the chunk whose start line is (end-line + 1). **Named limitation, stated as the core weakness**: "the agent has no idea what's before or after... it doesn't know what it doesn't know" — neighbor chunks are arbitrary and may still miss the actually-relevant section. Caveat: breaks down where a source file has many consecutive blank lines (the line-count-based boundary math assumes typical 1–2 newline chunk separation).

3. **Parent / section expansion** [15:29–22:47]. Rather than arbitrary neighbors, fetch the entire structural section (e.g. everything under the same H1/H2) a chunk belongs to. This requires the document's inherent heading structure to have been captured at ingestion. Presenter frames this as usable for "the majority" of enterprise PDF/Word documents (policies, regulations, research papers, reports) since most have meaningful heading structure.

4. **Chunking mechanics deep-dive** (explains *why* parent/section expansion needs custom ingestion work) [17:24–22:47]:
   - **Recursive character text splitter** (n8n's default): splits at a target size (e.g. 500 chars, 100 overlap), then backtracks to the nearest natural delimiter (double newline → single newline → space → hard cut). Weakness demonstrated: on structured documents this routinely produces chunks spanning two unrelated topics/sections (e.g. half "dimensions," half "suspension"), which dilutes the embedding signal for both topics — "recommended that your chunks are focused on a particular topic."
   - **Markdown-aware splitting** (n8n supports via a "markdown" split-code setting, backtracking to H2/H3/H4 boundaries instead of newlines): better, but still imperfect — a chunk can still span two sections if the target size lands inside a large section.
   - **Gold-standard approach** (per the presenter, referencing LangChain's documented method, "not supported by n8n" out of the box): first split the whole document by headings into "subdocuments," *then* run recursive character splitting within each section. This guarantees no chunk crosses a section boundary. n8n has no native node for this — presenter built a **custom code-node chunker** to do it (~200 lines, built with Claude Code, "far from straightforward").
   - **Small-chunk merging problem** (found in both the presenter's custom splitter and n8n's native markdown splitter): heading-first splitting can produce very small trailing chunks that "pollute the vector store" by getting retrieved ahead of better, more substantive chunks. Fixed by a smart-merge step that combines undersized chunks.

5. **Agentic expansion via extracted document hierarchy** [00:00–04:36, 22:47–31:59, demoed at 00:00 and 30:26]. The most sophisticated method and the video's headline technique. At ingestion, custom code nodes:
   - Parse the document's heading structure and map it to chunk index ranges (which chunks fall under which H1/H2/H3).
   - Build a "hierarchical index" recording, for every heading, its chunk-index range and its parent's chunk-index range (e.g. a H3 "floor drain system" = chunk 10; its parent H2 "drain system" = chunks 9–11; its parent H1 "installation requirements" = chunks 3–27).
   - Persist this hierarchy in Supabase's **record manager** table (the same table n8n's RAG masterclass pattern uses to track de-duplication of upserted documents) as a single new column ("hierarchical index"), because a hierarchy artifact isn't itself a chunk and can't be stored in the vector store.
   At query time: vector search returns candidate chunks → agent selects the golden chunk and its `doc_id` → agent calls a tool that fetches the *entire hierarchy* for that document → agent reasons over the hierarchy to identify which chunk-index range(s) actually answer the question (which may span multiple *non-contiguous* sections, e.g. installation *and* electrical-connection, or disposal *and* cleaning *and* disassembly) → agent calls a Supabase Edge Function passing the doc ID plus an array of chunk-index ranges → a Postgres function loops the array, selects all matching chunk rows, and returns them concatenated → agent generates the answer from the assembled sections. Explicitly generalizes to cross-references within a document ("as discussed in section two," footnotes, appendices) without needing a full knowledge graph — "a simpler document hierarchy with chunk indexes is enough."

**Metadata enrichment (a sixth, complementary technique layered on top)** [24:58–26:35]. A single LLM call *per document* (not per chunk — explicitly contrasted with contextual embeddings' per-chunk cost) reads the first few pages and extracts: brand, appliance/document type, and a 5–8 word document summary. Combined with the section heading each chunk lives in, this is injected as a text snippet prefixed to each chunk's page content (e.g. "This chunk is from an Empava 24in single wall oven instruction manual, specifically the installation section part two"). Presenter's framing: this "almost achieves what you get with contextual embeddings" at a fraction of the cost, since it's one call per document rather than one call per chunk.

**Traceability side-benefit** [03:45, 32:14]. Because chunks carry cascading heading paths and page-number metadata (aggregated from OCR extraction), answers can be traced back to the exact PDF pages and heading path they came from.

## Mechanisms, methods & implementation detail

- **Metadata carried per chunk** (native n8n): `doc_id`, start/end line numbers. (Custom, presenter-built): chunk index, child chunk-index range (its own section), parent chunk-index range (enclosing section), cascading heading path (H1/H2/...), page numbers, document summary, brand/type.
- **Full-document fetch tool**: SQL `SELECT content, metadata FROM documents WHERE metadata->>doc_id = :doc_id ORDER BY id ASC` — ordering ascending reconstructs original document order; equivalent in effect to loading the source file directly.
- **Neighbor fetch tool**: SQL select where `doc_id` matches and line-start/line-end is exactly ±1 from the target chunk's boundary lines.
- **Context-expansion Edge Function** (Supabase): receives `doc_id` + an array of chunk-index ranges; does light validation; calls a Postgres database function `get_chunks_by_ranges` that loops each doc/range pair, runs an SQL select against the matching chunk IDs, and returns them all through the Edge Function back to the agent.
- **Ingestion pipeline** (full version, described at 31:59–33:44): Google Drive trigger → loop per file → Mistral OCR extraction (explicitly required because "the native extract from PDF node in n8n does not extract headings") → page-number aggregation into metadata → record-manager check (new document → create row; existing document with changed content → delete old vectors, re-ingest) → document/metadata enrichment LLM call → smart markdown chunking + hierarchy extraction (custom code nodes) → embeddings generated and inserted directly via a Postgres node into the Supabase vector store (native Supabase vector store node "doesn't perform that well" for this custom, chunk-rich-metadata-at-scale use case — a finding carried over from the presenter's earlier "RAG at scale" video).
- **Why Postgres/Supabase specifically**: it's the only setup (vs. Pinecone/Qdrant) that lets you run relational SQL queries (for doc_id lookups, chunk ranges, and record-manager hierarchy storage) *alongside* vector search in the same database. Pinecone/Qdrant users would need to run a companion Postgres database to replicate this.

## Tools, people, products & organisations

- **n8n**: workflow automation tool used throughout; explicitly criticized for lacking native support for heading-based document splitting and for OCR/PDF heading extraction ("a major failing of n8n... I really can't wait until they actually build this type of functionality in natively").
- **Supabase**: Postgres-based backend used as the vector store + relational database + record manager; central to why this whole approach is feasible.
- **The AI Automators**: the channel/community publishing this video; sells/hosts a "state-of-the-art n8n RAG system" plus a community of RAG builders; the presenter says the new hierarchy/chunking approach will be folded into that product (currently uses standard recursive-character/markdown splitting).
- **Mistral OCR**: used at ingestion specifically because it extracts document headings from PDFs, unlike n8n's native PDF extraction.
- **Claude Code**: used by the presenter to write the ~200-line custom smart-markdown-chunker/hierarchy-extractor code, described as having taken "a few hours" and being "far from straightforward."
- **LangChain**: credited as the source of the documented "split by headings, then recursive-character-split within sections" method the presenter implements manually since n8n lacks it.
- **"Alan"** (a colleague/co-creator, referenced but not otherwise identified): has published a separate full video specifically on markdown splitting, linked in the video's card.
- **Empava** oven manual and an unnamed 2025 insurance policy document: the two running example knowledge-base documents used throughout the demos.

## Examples & use cases

- **Product manual Q&A** ("How do I install the Empava oven?"): demoed across every method — full document, neighbor, parent/section, and full agentic hierarchy expansion — showing progressively more complete/accurate answers as the method sophistication increases.
- **Multi-section query** ("How do I clean and dispose of the oven?"): demonstrates the hierarchy method's key advantage — it correctly assembled *four separate, non-contiguous* chunk ranges (disposal, cleaning/maintenance, disassembly) that a single "expand around one chunk" method could never gather.
- **Insurance policy exclusion** ("Is tennis elbow covered under this policy?"): the running illustrative example for the core hallucination-by-missing-context problem, and for showing what each expansion method would/wouldn't catch (only parent/section or hierarchy expansion would surface that the topic sits under a policy-exclusions heading).
- **Washer manual hierarchy example**: used to concretely illustrate the nested hierarchy data structure (H3 "floor drain system" → H2 "drain system" parent range → H1 "installation requirements" grandparent range).

## Claims & confidence

- The primary cause of RAG agent failure/hallucination is loss of document structure during chunking, not model reasoning failure. [opinion/claim — presenter's framing, illustrated with a worked example, not independently benchmarked] — high confidence as the video's central thesis, not externally validated.
- Contextual embeddings require one LLM call per chunk and are costly/non-scalable. [claim, stated as established fact by presenter] — medium-high confidence (architecturally verifiable, not benchmarked with numbers in this video).
- Query expansion "lacks reliability." [opinion] — low-medium confidence; no supporting data given.
- n8n's default PDF extraction node does not extract headings; Mistral OCR does. [claim, stated as direct experience] — medium-high confidence (specific, falsifiable, presented as tested fact).
- n8n has no native node/support for heading-first-then-recursive chunking (the "gold standard" per LangChain). [claim] — medium-high confidence, stated plainly as a product gap.
- The native Supabase vector store node "doesn't perform that well" for custom chunk-metadata-at-scale ingestion, versus inserting directly via a Postgres node. [claim, attributed to "our RAG at scale video" findings] — medium confidence; no quantitative benchmark shown in *this* video.
- A document hierarchy with chunk-index ranges is sufficient for agentic navigation without needing a full knowledge graph, even for cross-references (footnotes, "see section 2," appendices). [opinion/claim] — medium confidence; plausible and demonstrated for the shown documents, but not stress-tested on more complex cross-referencing documents in the video.
- Metadata enrichment (single per-document LLM call) achieves a result "not far off" what contextual embeddings (per-chunk LLM call) would produce, at much lower cost. [opinion] — medium confidence; presenter's own comparative judgment, not a rigorous side-by-side evaluation.
- "The majority of PDF and Word documents generated in Enterprise have some level of meaningful structure." [opinion] — presented as a personal wager ("I would wager"), explicitly low-certainty per the presenter's own words.

## Caveats & source gaps

- No quantitative benchmarks (accuracy %, latency, cost figures) are given for any of the five methods or for contextual embeddings/query expansion — all comparisons are qualitative/demonstrative via live examples, not measured evaluation.
- The custom smart-markdown-chunker and hierarchy-extractor code (~200 lines across 3 nodes) is described only at a conceptual level; the actual code/logic is not shown or made available in this transcript (may be available via the community link mentioned, not confirmed).
- The neighbor-expansion line-number matching approach is acknowledged to break on documents with unusual blank-line patterns — no fix or workaround is given, just a caveat.
- No discussion of how this approach performs on non-heading-structured content (raw prose, chat logs, code) — the entire hierarchy-based approach explicitly assumes heading-structured source documents.
- The "smart merge of tiny chunks" system is named but its actual merge logic/threshold is not explained.
- No mention of how hierarchy data is kept in sync if a document is only partially updated (record manager delete/recreate behavior is described only for whole-document changes).
- Pricing/cost of Mistral OCR, or of the metadata-enrichment LLM call, is not discussed.

## What this means for Fusion247

This directly informs ObsidiWikAi's LightRAG→Neo4j retrieval design and any future myPKA/Cairn-produced knowledge notes that get embedded for retrieval: the described failure mode (isolated chunks losing structural/section context, leading to false-confidence answers) is exactly the risk with any RAG layer built over Team Knowledge notes or the wiki. Fusion247's knowledge notes (like this one) are markdown with heading structure — the "split by headings, then recursive-split within sections" gold-standard pattern, plus a stored heading-hierarchy/chunk-range index, maps cleanly onto how Cairn's notes and the wider PKM wiki could be chunked for retrieval-augmented Brain queries, if/when the ObsidiWikAi retrieval layer is revisited. The parent/section-expansion and hierarchy-navigation techniques are also a plausible pattern for Mason/Pax-style synthesis work that needs to pull a full argument thread rather than an isolated fragment. Supabase-as-relational-plus-vector-store is directly relevant since Fusion247 already runs Supabase for AsdAIr and other subsystems — the same "record manager + hierarchical index column" pattern could be reused rather than invented fresh. Nothing here requires immediate action; it's a reference architecture worth revisiting specifically if/when RAG-accuracy problems show up in a Fusion247 retrieval system.

## Key concepts & takeaways

- Vector/hybrid search is a first-pass narrowing filter, not a final context source — context expansion is a required second step for accurate RAG.
- Five expansion tiers, increasing in sophistication and accuracy, decreasing in simplicity: full document → neighbor chunks → parent/section → agentic hierarchy navigation (+ metadata enrichment as an orthogonal, cheap accuracy booster).
- Chunking strategy quality is foundational: recursive-character splitting < markdown-aware splitting < heading-first-then-recursive-split ("gold standard," not natively supported in n8n).
- A stored document hierarchy (heading → chunk-index range → parent range) lets an agent navigate a document like a table of contents instead of guessing from arbitrary chunk boundaries.
- Per-document metadata/summary enrichment (one LLM call) is a scalable alternative to per-chunk contextual embeddings.
- Postgres/Supabase's dual relational+vector nature is what makes several of these techniques (doc_id lookups, hierarchy storage in the record manager) practical; pure vector databases (Pinecone, Qdrant) would need a companion Postgres store.

## Actions & open questions

- If Fusion247 ever builds or revisits a RAG retrieval layer over Team Knowledge/PKM markdown notes, evaluate whether a heading-hierarchy chunk-range index (as described here) is worth implementing rather than flat chunking.
- No immediate build action required from this note alone — treat as a reference architecture pattern, not a task.
- Open question (not answered by the source): how this approach handles a knowledge base where documents are *not* consistently heading-structured (much of Fusion247's own journal/PKM content is prose, not headed documents) — would need separate evaluation before assuming transferability.
- Open question: real cost/latency numbers for the "agentic hierarchy expansion" approach vs. simpler methods, since the source gives none — would need independent testing if this pattern were ever adopted.

---

**RAW transcript — immutable source evidence:** `Sources/_raw/y72TrpffdSk/` — `tubeair-report.md` (sha256 `69d53ce0cbc8…`), `manifest.json` (sha256 `ff710963fe96…`). Preserved as captured; never edited or summarised.
