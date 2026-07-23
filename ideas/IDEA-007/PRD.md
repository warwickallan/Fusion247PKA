# ObsidiWikAi — Product Requirements Document

**Idea:** IDEA-007
**Product owner:** Warwick
**Document purpose:** Define the complete product ObsidiWikAi must deliver.
**Document status:** Product requirements only.
**Authority:** This document does **not** instruct Larry or any other agent to begin implementation.

---

## 1. Executive summary

ObsidiWikAi is a personalised, self-expanding knowledge engine that turns material Warwick deliberately captures into a living **3D encyclopedia**.

A YouTube video sent through Telegram should not end as a transcript, a summary or another file in a folder. The system must understand the knowledge contained in the source, recognise which parts matter to Warwick, connect that knowledge to concepts already held, resolve different phrases that describe the same idea, and grow a coherent Neo4j knowledge graph over time.

The defining product loop is:

```text
Warwick’s interests, goals and feedback
                ↓
Honcho’s evolving understanding of Warwick
                ↓
Personalised semantic lens
                ↓
LightRAG analyses each new source
                ↓
Concepts are matched against existing knowledge
                ↓
Merge, alias, relate or create
                ↓
Neo4j encyclopedia grows
                ↓
Useful insight is surfaced in Directus
                ↓
MyPKA agents become better informed
                ↓
Warwick accepts, rejects or explores suggestions
                ↓
Honcho learns and the future lens expands
```

The system must perform both:

1. **Broad semantic discovery**, so unexpected but important knowledge is not missed.
2. **Interest-conditioned semantic analysis**, so it pays particular attention to Warwick’s established, active and emerging interests, goals and projects.

As Honcho understands Warwick more deeply, LightRAG’s field of attention must expand. The same source processed six months later may produce richer connections because the system understands more about Warwick and possesses a larger encyclopedia.

This adaptive compounding behaviour is the central product—not an optional later enhancement. 

---

## 2. Product vision

> **Anything Warwick deliberately captures should make his knowledge system more intelligent, more connected and more useful to him.**

ObsidiWikAi should become a continuously improving bridge between:

* what Warwick encounters in the world;
* what he already knows;
* what he is currently interested in;
* what he is trying to achieve;
* what Fusion247 and MyPKA are building;
* opportunities to improve his work, knowledge, health, systems, content or income.

The product should feel as though Warwick is constructing a personal, explorable encyclopedia whose coverage evolves with him.

It is not merely a searchable archive. It should be able to answer:

* What does this source teach?
* Which ideas in it are genuinely relevant to Warwick?
* How do they connect with existing concepts?
* Is this the same idea under a different name?
* Does this contradict something already accepted?
* What new capability or opportunity does this suggest?
* How could Warwick use this to improve himself, Fusion247 or a potential commercial offering?

---

## 3. The three knowledge layers

The build must preserve a strict distinction between three different forms of knowledge.

### 3.1 Warwick’s personal knowledge

**Primary home:** Obsidian.

This includes:

* journals;
* reflections;
* personal notes;
* health observations;
* Samsung and other personal data;
* family and private life;
* personal plans;
* material Warwick writes and thinks with.

This is Warwick’s personal vault. It is **not** the Neo4j encyclopedia.

Personal records may influence the wider system only through explicit, privacy-controlled summaries or preferences. Raw journals, health records and similar material must not automatically become encyclopedia nodes.

### 3.2 The external knowledge encyclopedia

**Primary home:** Neo4j, supported by LightRAG.

This contains knowledge learned from sources:

* concepts;
* people;
* organisations;
* tools;
* technologies;
* methods;
* claims;
* evidence;
* relationships;
* competing viewpoints;
* broader and narrower concepts;
* source provenance.

This is the “3D encyclopedia.”

It represents knowledge about the world, not a graph of Warwick’s private life.

### 3.3 The Warwick lens

**Primary capability:** Honcho, with inspectable supporting state.

This represents:

* enduring interests;
* current interests;
* emerging interests;
* goals;
* projects;
* recurring questions;
* preferences;
* rejected themes;
* current priorities;
* feedback on previous suggestions.

The lens determines what deserves deeper attention and why it may matter to Warwick.

It does not replace the source evidence and does not become part of the encyclopedia itself.

---

## 4. Core product principles

### 4.1 Honcho guides analysis

Honcho must not be reduced to a final relevance score applied after LightRAG has extracted arbitrary content.

Before and during source analysis, Honcho must provide an evolving semantic lens describing:

* what Warwick consistently cares about;
* what he is currently working on;
* what he is beginning to explore;
* what goals he is pursuing;
* which questions remain unresolved;
* which adjacent areas may be useful;
* which themes usually prove irrelevant or low value.

LightRAG must use this lens to determine where deeper semantic analysis is warranted.

### 4.2 The lens must not become blinkers

The system must still perform a broad discovery pass.

A source may introduce an important idea Warwick has never previously encountered. That idea must not be discarded solely because Honcho does not already know Warwick is interested in it.

The product therefore requires two complementary modes:

```text
Broad discovery
What important knowledge does this source contain?

Interest-directed discovery
What deserves deeper attention because of Warwick’s
interests, goals, projects and emerging direction?
```

Unexpected high-value concepts may be presented as **emerging-interest candidates**.

### 4.3 Semantic concepts, not repeated words

The encyclopedia must not create a separate node every time a source uses different wording.

For example:

```text
persistent context
long-term agent memory
cross-session conversational continuity
```

The system must determine whether these are:

* aliases for the same concept;
* narrower or broader concepts;
* closely related but distinct;
* contradictory;
* genuinely new;
* too uncertain to resolve automatically.

### 4.4 The graph must compound

Each source must build upon what already exists.

A new video about agent memory should not create an isolated miniature graph. It should connect to existing knowledge about:

* Honcho;
* context engineering;
* MyPKA;
* agent continuity;
* retrieval;
* LightRAG;
* Neo4j;
* Fusion247 architecture;
* relevant previous sources.

### 4.5 Evidence must survive every transformation

Every concept, claim and relationship must remain traceable to:

* its source;
* the relevant transcript passage or evidence;
* the processing run;
* the model or method that extracted it;
* the semantic-resolution decision;
* its current status and confidence.

### 4.6 The product must improve through Warwick’s feedback

Warwick’s acceptance, rejection, correction and exploration of results must influence:

* Honcho’s understanding;
* future semantic focus;
* ranking of opportunities;
* preferred depth of analysis;
* negative-interest signals;
* confidence in inferred interests.

One isolated action must not permanently redefine Warwick. Repeated or explicit feedback should carry more weight.

---

## 5. Primary user journey

### 5.1 Capture

Warwick sends a public YouTube URL through Telegram.

The Unified Gateway must:

* authenticate and accept the capture;
* preserve the original URL and message;
* prevent duplicate processing;
* create a durable processing record;
* acknowledge receipt;
* route the source to TubeAIR.

### 5.2 Source preparation

TubeAIR must produce:

* full transcript;
* source metadata;
* immutable evidence;
* cleaned reading version;
* structured source packet;
* stable source and processing identifiers;
* explicit success or failure state.

### 5.3 Interest-lens creation

Before semantic analysis, the system requests a bounded lens from Honcho.

The lens should contain:

* enduring interests;
* active interests;
* emerging interests;
* current projects and builds;
* goals;
* unresolved questions;
* known low-value themes;
* relevant recent corrections;
* adjacent areas worth exploring.

The lens must be structured, inspectable and recorded with the processing run.

### 5.4 Broad semantic discovery

LightRAG analyses the complete source to identify its main knowledge independently of Warwick’s existing interests.

It should identify candidate:

* themes;
* concepts;
* entities;
* claims;
* methods;
* relationships;
* questions;
* unusual or novel ideas;
* evidence passages.

### 5.5 Interest-conditioned semantic analysis

LightRAG performs deeper analysis using the Honcho lens.

It should look specifically for:

* material directly relevant to established interests;
* concepts connected indirectly to Warwick’s interests;
* implications for active projects;
* knowledge that resolves current questions;
* contradictions with previous conclusions;
* transferable techniques;
* personal or professional improvement opportunities;
* potential Fusion247 features;
* potential services, products, content or monetisation opportunities;
* adjacent subjects that may become new interests.

### 5.6 Semantic canonicalisation

Every candidate concept must be compared with the existing encyclopedia.

The system must classify it as one of:

* `SAME_CONCEPT`;
* `ALIAS_OF`;
* `BROADER_THAN`;
* `NARROWER_THAN`;
* `RELATED_TO`;
* `SUPPORTS`;
* `CONTRADICTS`;
* `SUPERSEDES`;
* `NEW_CONCEPT`;
* `UNCERTAIN`.

The matching process must consider:

* normalized names;
* known aliases;
* semantic embeddings;
* concept descriptions;
* neighbouring graph nodes;
* relationship patterns;
* source context;
* model-assisted adjudication;
* confidence thresholds.

### 5.7 Encyclopedia update

The canonicalisation result determines whether the system should:

* merge evidence into an existing node;
* add a new alias;
* create a broader/narrower relationship;
* create a related or contradictory relationship;
* create a genuinely new canonical node;
* hold the candidate for review.

Reprocessing the same source must update that source’s contribution rather than create duplicate nodes and edges.

### 5.8 Warwick-facing result

Directus must show Warwick:

* what the source was;
* what it principally discussed;
* which knowledge was considered relevant;
* why it matters to him;
* which existing concepts were found;
* which aliases were merged;
* which new nodes were created;
* which relationships were added;
* contradictions or uncertainties;
* emerging-interest candidates;
* potential applications;
* improvement or monetisation suggestions;
* source evidence and confidence.

### 5.9 Agentic use

The updated encyclopedia must become available to authorised MyPKA agents.

They should be able to use it to:

* answer grounded questions;
* understand relationships across sources;
* prepare relevant context;
* identify patterns;
* suggest improvements;
* support new Foundry ideas;
* challenge existing plans;
* identify reusable knowledge.

The encyclopedia informs MyPKA. It must not autonomously rewrite MyPKA’s canonical rules or decisions.

---

## 6. Functional requirements

### FR-001 — Full transcript ingestion

The product shall ingest the complete available transcript rather than relying only on a summary, title or sample.

### FR-002 — Durable source identity

Each source shall have a stable identity so that repeated submission updates or reuses the existing source rather than generating duplicate universes.

### FR-003 — Evolving Warwick lens

The product shall obtain a fresh Honcho lens for each substantive analysis rather than using a permanently hard-coded interest list.

### FR-004 — Interest horizons

The Honcho lens shall distinguish:

* enduring interests;
* active interests;
* emerging interests;
* current goals;
* active projects;
* unresolved questions;
* negative or low-value signals.

### FR-005 — Broad discovery pass

The product shall identify the important content of the source without restricting discovery to known interests.

### FR-006 — Interest-conditioned pass

The product shall use Honcho’s lens to perform deeper semantic analysis of directly relevant, indirectly relevant and adjacent knowledge.

### FR-007 — Expanding semantic scope

As Honcho learns more about Warwick, the set of subjects, relationships and opportunities examined by LightRAG shall expand.

The product shall not be limited forever to the interest categories present at initial deployment.

### FR-008 — Emerging-interest discovery

The product shall identify potentially valuable concepts outside the current lens and offer them as emerging interests rather than automatically discarding them.

### FR-009 — Semantic entity search

Before creating any concept node, the product shall search the existing encyclopedia using semantic similarity, aliases, descriptions and graph neighbourhood.

### FR-010 — Multi-outcome canonicalisation

Concept resolution shall support more than merge versus create.

It must support:

* same concept;
* alias;
* broader;
* narrower;
* related;
* supporting;
* contradictory;
* superseding;
* new;
* uncertain.

### FR-011 — Canonical concept identity

Each accepted concept shall have:

* stable canonical ID;
* canonical name;
* description;
* aliases;
* concept type;
* current status;
* confidence;
* timestamps;
* provenance;
* source references.

### FR-012 — Source-preserving aliases

When terms are merged, the original wording used in each source shall remain recorded as evidence and as an alias or source-local expression.

### FR-013 — Duplicate prevention

Equivalent concepts shall not be represented as separate canonical nodes merely because spelling, abbreviation or phrasing differs.

### FR-014 — Over-merge prevention

Semantically related but genuinely distinct concepts shall not be collapsed solely because their embeddings are similar.

Low-confidence decisions must be reviewable.

### FR-015 — Graph relationship management

The encyclopedia shall support typed relationships including:

* `IS_ALIAS_OF`;
* `IS_A`;
* `PART_OF`;
* `ENABLES`;
* `USES`;
* `SUPPORTS`;
* `CONTRADICTS`;
* `SUPERSEDES`;
* `CAUSES`;
* `AFFECTS`;
* `RELEVANT_TO`;
* `MENTIONED_IN`;
* `DERIVED_FROM`.

The relationship vocabulary may expand when real use demands it.

### FR-016 — Provenance

Every node and relationship shall retain evidence of why it exists.

### FR-017 — Candidate and accepted states

The product shall distinguish between:

* automatically extracted candidates;
* confidently canonicalised knowledge;
* items awaiting review;
* rejected knowledge;
* superseded knowledge.

### FR-018 — Source-keyed idempotency

Reprocessing a source shall replace or update that source’s contribution without duplicating its knowledge.

### FR-019 — LightRAG retrieval

LightRAG shall support semantic and graph-aware retrieval across the accumulated source knowledge.

### FR-020 — Neo4j encyclopedia

Neo4j shall expose the accepted, canonicalised encyclopedia and its relationships.

The encyclopedia must remain rebuildable from retained source, processing and provenance records.

### FR-021 — One user-visible encyclopedia

Warwick shall experience a single encyclopedia.

Any provisional extraction or candidate layer must remain an internal processing concern and must not present itself as a competing second brain.

### FR-022 — Directus explanation

Directus shall explain results in ordinary language before exposing technical records.

### FR-023 — Feedback capture

Warwick shall be able to:

* approve;
* reject;
* correct;
* merge;
* split;
* reclassify;
* mark irrelevant;
* adopt an emerging interest;
* dismiss a suggestion.

### FR-024 — Feedback learning

Explicit Warwick feedback shall update Honcho and influence future semantic analysis.

### FR-025 — Grounded suggestions

The system shall suggest:

* self-improvement opportunities;
* learning priorities;
* system improvements;
* new Fusion247 ideas;
* content opportunities;
* commercial or monetisation possibilities.

Every suggestion must cite the source concepts and relationships supporting it.

### FR-026 — Suggestion uncertainty

Suggestions must state:

* evidence;
* reasoning;
* confidence;
* assumptions;
* potential benefit;
* practical next step;
* what could invalidate the suggestion.

### FR-027 — No autonomous monetisation action

The system may suggest opportunities. It shall not create businesses, publish content, spend money, contact people or initiate commercial activity without Warwick’s approval.

### FR-028 — Agent access

Authorised agents shall be able to retrieve relevant encyclopedia knowledge and relationship paths through governed interfaces.

### FR-029 — MyPKA improvement candidates

New knowledge may create candidate:

* ideas;
* procedures;
* architecture changes;
* experiments;
* agent instructions;
* research questions.

These candidates shall not become canonical MyPKA content without governance.

### FR-030 — Privacy separation

Raw journals, Samsung data, private health information, family material and employer/client information shall not automatically enter Honcho, LightRAG or Neo4j.

Only expressly approved, appropriately abstracted information may influence the lens.

---

## 7. Required knowledge model

### 7.1 Principal node classes

The encyclopedia should support at least:

* `Concept`;
* `Person`;
* `Organisation`;
* `Tool`;
* `Technology`;
* `Method`;
* `Claim`;
* `Source`;
* `Question`;
* `Opportunity`;
* `ProjectReference`.

The schema should remain extensible.

### 7.2 Canonical concept record

A canonical concept should contain:

```text
canonical_id
canonical_name
description
aliases
type
status
confidence
first_seen
last_updated
source_count
evidence_count
embedding_reference
privacy/domain
superseded_by
```

### 7.3 Evidence record

Evidence should contain:

```text
source_id
transcript_span
original_wording
extracted_claim
model/version
processing_run
timestamp
confidence
```

### 7.4 Interest-lens record

The processing run should retain the lens used:

```text
lens_version
enduring_interests
active_interests
emerging_interests
goals
current_projects
open_questions
negative_signals
adjacent_discovery_topics
generated_at
```

This allows Warwick to understand why one source was interpreted in a particular way.

---

## 8. Directus product experience

For each source, Warwick should see one clear knowledge card.

### What arrived

* title;
* creator;
* URL;
* capture date;
* transcript status;
* original evidence.

### What it contains

* major themes;
* concepts;
* entities;
* claims;
* methods;
* relationships;
* novel material.

### Why it matters to Warwick

* matched interests;
* matched goals;
* related projects;
* unresolved questions addressed;
* adjacent opportunities;
* explanation of relevance.

### How the encyclopedia changed

* existing nodes reused;
* aliases added;
* nodes merged;
* new nodes created;
* broader/narrower links;
* supporting or contradictory relationships;
* uncertain candidates held.

### What may follow

* personal improvement idea;
* Fusion247 improvement;
* new Foundry idea;
* experiment;
* learning recommendation;
* content idea;
* monetisation opportunity;
* no action.

### Warwick’s controls

* approve;
* correct;
* reject;
* merge;
* split;
* adopt interest;
* dismiss interest;
* request deeper analysis;
* mark source low value.

---

## 9. The adaptive growth loop

The system must become meaningfully better over time.

### Initial state

Honcho may know only broad interests:

```text
AI
automation
knowledge systems
health
implementation consulting
```

### Developed state

Through conversations, feedback and repeated decisions, it may understand:

```text
Warwick values practical, human-controlled agent systems
that preserve continuity, reduce implementation work,
produce visible outcomes and could become useful products
or services for small organisations.
```

This developed understanding must change future analysis by:

* finding subtler relevant concepts;
* exploring more distant semantic relationships;
* recognising commercial relevance;
* connecting sources to ongoing builds;
* filtering low-value noise;
* identifying emerging areas earlier.

The product must therefore store the lens version used for every analysis and support later re-analysis where Warwick’s interests have materially changed.

---

## 10. Search and question-answering requirements

Warwick and authorised agents should be able to ask:

* What have I learned about persistent agent memory?
* Are “context engineering” and “persistent memory” the same concept?
* Which sources disagree about graph-based retrieval?
* What ideas have appeared repeatedly across unrelated videos?
* Which knowledge is relevant to the current Fusion247 build?
* What new interests have emerged over the last month?
* Which concepts might improve my implementation-consulting work?
* What monetisable patterns are appearing across what I am learning?
* Which suggestion was based on weak evidence?
* Why does the system think this matters to me?

Answers must use:

* LightRAG semantic retrieval;
* Neo4j relationships;
* source provenance;
* current Honcho context;
* accepted MyPKA authority where system decisions are involved.

Answers must show their evidence.

---

## 11. Non-functional requirements

### Reliability

* No source loss.
* No silent partial processing.
* Safe retries.
* Stable source identity.
* Idempotent reprocessing.
* Recoverable derived stores.

### Quality

* Semantic matching must use more than string equality.
* Merge decisions must consider description and graph context.
* Low-confidence matches must remain reviewable.
* Different concepts must not be merged merely because they are related.

### Transparency

Warwick must be able to inspect:

* the interest lens used;
* concepts found;
* merge/create decisions;
* evidence;
* confidence;
* graph changes;
* reasons behind suggestions.

### Cost control

* Cache unchanged source analysis.
* Batch Honcho queries where appropriate.
* Avoid one paid Honcho request per trivial phrase.
* Use inexpensive processing for initial candidate generation.
* Reserve stronger reasoning for ambiguous canonicalisation and valuable synthesis.

### Security and privacy

* Private administration.
* Secrets outside Git.
* Personal/private data excluded by default.
* No Bellrock or customer-identifiable material.
* Model/API payloads limited to permitted source content and bounded contextual signals.

### Portability

* Source evidence and canonical knowledge must survive replacement of Honcho, LightRAG, Neo4j or a model provider.
* The encyclopedia must be rebuildable.
* No critical decision may exist only in an opaque managed service.

---

## 12. Product completion criteria

ObsidiWikAi is not complete merely because one transcript can be queried.

The complete product must demonstrate:

1. Full Telegram-to-transcript ingestion.
2. Fresh Honcho lens generation.
3. Broad semantic discovery.
4. Interest-conditioned semantic analysis.
5. Identification of adjacent and emerging interests.
6. Semantic matching against existing encyclopedia concepts.
7. Alias, broader, narrower, related, contradictory, new and uncertain classifications.
8. Duplicate-resistant Neo4j updates.
9. Provenance for every accepted node and relationship.
10. LightRAG retrieval across multiple accumulated sources.
11. Directus visibility of knowledge and graph changes.
12. Warwick correction and feedback controls.
13. Honcho learning from Warwick’s feedback.
14. Observable expansion of the semantic lens over time.
15. Grounded self-improvement suggestions.
16. Grounded Fusion247 improvement suggestions.
17. Grounded content or monetisation opportunities.
18. Governed MyPKA idea/change candidates.
19. Safe reprocessing and rebuilding.
20. Clear separation between personal vault, encyclopedia and Warwick lens.

A staged implementation is acceptable. A staged **definition of done** is not.

Any capability postponed beyond the build must be explicitly named and approved by Warwick rather than quietly disappearing from scope.

---

## 13. Non-goals

This product is not:

* a replacement Obsidian editor;
* a graph of Warwick’s private diary;
* a Samsung Health graph;
* a raw transcript archive;
* a generic “chat with your documents” application;
* an uncontrolled LightRAG extraction dump;
* a system that creates one node per phrase;
* a static hard-coded interest filter;
* an autonomous business or investment adviser;
* an automatic MyPKA rule writer;
* a public commercial SaaS at this stage;
* a pretty graph with no useful retrieval or insight.

---

## 14. Final product statement

> **ObsidiWikAi must use Honcho’s continually evolving understanding of Warwick to guide broad and interest-conditioned semantic analysis of captured sources. LightRAG must identify and retrieve meaningful knowledge, while a semantic canonicalisation capability resolves candidate terms against the existing Neo4j encyclopedia as aliases, broader or narrower concepts, related or contradictory knowledge, genuinely new concepts or uncertain candidates. The encyclopedia must compound across sources, remain evidence-backed and become increasingly personalised as Honcho learns. Directus must make the result understandable and correctable, while the accumulated knowledge enables MyPKA agents to suggest grounded ways for Warwick to learn, improve Fusion247, create useful content and identify potential commercial opportunities.**

That is the product. It defines **what must exist and how it must behave**, without telling Larry to start building it.
