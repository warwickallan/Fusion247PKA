---
source_id: k4sMSsMzX2g
type: source-knowledge-note
source_type: youtube_transcript
title: Google Replaced The Karpathy's LLM Wiki
source_url: "https://www.youtube.com/watch?v=k4sMSsMzX2g"
video_id: k4sMSsMzX2g
channel: AI LABS
published: 2026-06-26
transcript_source: auto_captions
captured_at: "2026-07-27T11:55:16+00:00"
capture_id: null
review_state: ai_created
build: BUILD-002
authored_by: cairn-sonnet
raw_evidence:
  - Sources/_raw/k4sMSsMzX2g/tubeair-report.md
  - Sources/_raw/k4sMSsMzX2g/manifest.json
tags:
  - youtube
  - source-knowledge
  - pending-warwick-review
---

## Executive orientation
This is an AI Labs (software company/YouTube channel) explainer on Google's newly released **Open Knowledge Format (OKF)** — a standard for structuring "second brain" / AI knowledge-base folders so both agents and humans can navigate them predictably. It matters because AI Labs actually converted their own team's shared, Git-based second brain into OKF on a test branch and reports concrete before/after results on Claude Code's search behaviour, token use, and retrieval speed — not just a spec summary.

## What the source says

### The problem OKF is meant to solve
AI Labs maintains a team second brain (strategies, research, guidelines) version-controlled with Git/GitHub, governed by a root `Claude.md` plus per-folder `Claude.md` files that tell the agent how to navigate each directory. [00:44–01:20] Even with this setup, Claude "messes up a lot": it places files in the wrong folder, has to be corrected, and — critically — sometimes creates a *duplicate* folder for information that already exists elsewhere under a different name, because **Claude has no way of knowing information already exists in the knowledge base; it only discovers it when it actively searches**. [01:33–01:52] Search itself works by keyword-matching against file content and file names, so in a deeply nested folder structure the agent needs multiple attempts to land on the right file — costing both time and tokens. This gets worse as the knowledge base grows and isn't obvious in small ones. [01:52–02:20]

### OKF as the next entry in a standardization pattern
The presenter frames OKF as following a repeated industry pattern: when agents needed to reach external resources, **MCP** became the adopted protocol; when reusable instructions needed packaging, **Skills** became the standard; when design intent needed a shared format, Google shipped **design.md**. OKF is positioned as the same move applied to *knowledge*: a standard structure for knowledge bases themselves. [02:20–02:52]

### Lineage: from RAG, to Karpathy's LLM Wiki, to OKF
OKF is explicitly built on **Andrej Karpathy's "LLM Wiki" pattern**, not a new invention. [02:52–03:00]

- **Prior approach (RAG/vectors):** convert documents into vector embeddings; a query is matched against vectors by meaning and the closest matches are returned. Vectors work because they put content into a form the model can compare. [02:58–03:15]
- **Karpathy's critique (counterintuitive reversal — flagged explicitly as a myth-busting reframe by the source):** the common assumption is that vector/RAG search is the natural way to give an agent a knowledge base. Karpathy's reversal is that RAG doesn't actually build up knowledge — **every query causes the agent to reconstruct an answer from scratch, with nothing accumulated over time.** His proposed fix was to abandon vectors in favour of plain **markdown files**, using models' native ability to navigate a filesystem, so the agent genuinely accumulates context as it works rather than re-deriving it each time. [03:15–03:35]
- **What happened next:** this idea got popular and many people built personal "second brains" on it — but each was structured around its own creator's mental model. The creator could navigate it fine; anyone else (a new team member, or an agent without prior exposure) had to spend time exploring folders just to learn what existed. [03:35–04:12]

### What OKF actually is
OKF is a standard way of organizing files so that *both* an agent and a human can understand what a knowledge base contains, by packaging knowledge into a shareable **bundle**. [04:00–04:12] The bundle is markdown files carrying the actual content, each with a **YAML frontmatter block** describing what the file holds so the agent knows its contents without opening it. The presenter is explicit that "OKF doesn't really introduce anything new" — its value is purely that it's a standard format anyone can produce, read, and port across different systems/platforms. [04:12–04:55]

### Speculative angle: agentic web search
The presenter's own inference (flagged as speculation, not sourced from Google): since Google appears to be pushing web search toward *agentic* search, OKF could be a building block for that shift. Websites currently add `llms.txt` files to give models context about site content; websites might eventually ship OKF bundles too, letting agents query site content more efficiently and get better-structured results. Currently OKF is stated to be for **internal use only** — this web-facing use is the presenter's forward-looking guess, not a claim Google made. [04:55–05:15]

### How OKF works structurally
- Everything in a knowledge base is represented as **concepts** — objects that can be data, markdown documents, YAML files, or anything else in the bundle. [05:15–05:38]
- Content is organized into **folders named by topic**, each holding only that topic's content.
- Every folder — root and every subfolder — contains an **`index.md`**, described as "the most important" file because it's what the agent reads first for context on that folder's contents. [05:38–05:45; 09:31–09:38]
- Each concept document carries a small **YAML block** with a `name` and `description` (functionally parallel to the YAML block used by Skills) — the agent reads this first to decide whether it needs to open the full document. [05:45–06:04]
- A **`type` field** identifies what kind of thing a concept is.
- **Core design principle — minimalism:** each concept should represent exactly one thing; mixing multiple unrelated topics into one concept breaks the agent's ability to load precisely the information it needs. [06:04–06:20]
- **Second design principle — separation:** the knowledge base is independent of whoever/whatever consumes it (agent, human, team member) and is not tied to any specific platform — this is what makes it portable. [06:20–06:45]

### AI Labs' own test (the empirical core of the video)
AI Labs applied OKF to their real, existing, Git-shared second brain, working on a new branch to avoid touching main. [07:34–07:55]

**What OKF ships with, out of the box:**
1. An **enrichment agent** — pulls data from **BigQuery** (Google's data warehouse), converts it into OKF concept documents, then runs an LLM pass to check the output. [07:55–08:10]
2. An **HTML visualization tool** — turns an OKF bundle into an interactive graph view. [08:10–08:15]
3. **Reference examples** of properly formatted OKF data. [08:15–08:20]

**The gap they hit and how they closed it (their own contribution, not part of OKF):** their knowledge base was already tracked in Git, not BigQuery, and standing up a BigQuery/Google Cloud project just for the conversion wasn't worth it — but OKF's *only* shipped conversion tool targets BigQuery. So they built their own **custom Skill, "markdown to OKF,"** that converts any folder of markdown files into a spec-compliant OKF bundle. [08:20–09:00] Design choices for this skill:
- **Script-first**: code does most of the conversion work; the agent is invoked only for judgment calls, minimizing agent load and token usage.
- Ships with **eval prompts** the agent runs against the output to verify the conversion was done correctly. [09:00–09:20]

**Running it:** on the test branch, the skill's scripts converted the files and generated a root `index.md` linking to all subfolders (the presenter compares this directly to Obsidian's page-linking / graph-view mechanism) plus a per-subfolder `index.md` listing that folder's contents. [09:20–09:40] Running OKF's `visualize` command on the resulting bundle produced a browsable HTML graph of the whole knowledge base's nodes and connections. [09:38–10:07]

**Testing retrieval — first attempt failed, revealing an adoption gap:** when first asked to find a file, Claude ignored the new structure and fell back to its normal pattern-matching search, **because OKF is new/unadopted and Claude simply didn't know the standard existed.** [10:07–10:22] Fix: they added a section to `Claude.md` explicitly explaining the OKF navigation model — file roles and how to use the structure. After that, Claude located files by walking the `index.md` files instead. [10:22–10:36]

**Result after the fix:** faster results than full-knowledge-base search, and fewer tokens used, because Claude loaded YAML metadata first to decide whether a file was even worth opening before opening it. [10:36–10:52] Stated benefits: lower token usage, faster retrieval, fewer navigation errors (the `Claude.md` structure means it won't forget where files belong; the `index.md` files spell out what each file does). [10:52–11:15]

**Counterintuitive tempering (second reversal, stated directly by the presenter at the close — important, don't lose it):** despite framing this whole video around solving a real problem, the presenter's own bottom-line verdict is that **models are already quite capable on their own** via pattern matching and terminal commands, so **until OKF becomes a widely-supported open standard that agents adopt out of the box, it's "more of an optimization than something you really need."** [11:15–11:32] This directly undercuts the opening hype framing ("Google just solved the second-brain problem") with a more modest, "nice-to-have for now" conclusion.

## Mechanisms, methods & implementation detail
- **Folder-per-topic organization**, each folder single-topic only.
- **`index.md` at every level** (root + each subfolder) as the agent's first read for that scope — links to sub-content, mirrors Obsidian's page-linking/graph-view approach.
- **YAML frontmatter per concept document**: `name`, `description`, `type` — read before content, enabling the agent to decide relevance without opening the full file (mirrors how Skills' YAML blocks work).
- **Minimalism rule**: one concept = one thing; never mix topics in a single concept document.
- **Separation rule**: knowledge content stays independent of consumer and platform.
- **Conversion pipeline (native)**: BigQuery data → enrichment agent → OKF concept docs → LLM verification pass.
- **Conversion pipeline (AI Labs' workaround for non-BigQuery/Git-based knowledge bases)**: custom "markdown to OKF" Skill, script-first (code does the mechanical conversion; agent only handles judgment calls), with built-in eval prompts to check conversion fidelity.
- **Visualization**: a `visualize` terminal command turns any OKF bundle into an interactive HTML graph (nodes = concepts, edges = connections), opened directly in a browser.
- **Adoption fix required in practice**: Claude does not natively recognize OKF; you must add an explicit navigation section to `Claude.md` describing file roles and how to traverse the `index.md` structure before Claude will actually use it instead of defaulting to keyword search.
- **Workflow safety practice AI Labs used**: test structural/format changes to a shared knowledge base on a separate Git branch rather than main.

## Tools, people, products & organisations
- **Google** — released the Open Knowledge Format; also referenced as the source of the earlier **design.md** standard and (per the presenter's speculation) a company pushing web search toward agentic search.
- **Open Knowledge Format (OKF)** — Google's new standard for structuring shareable, agent-and-human-navigable knowledge bases; ships with an enrichment agent, an HTML visualizer, and format examples.
- **Andrej Karpathy** — originator of the "LLM Wiki" pattern (markdown-file-based, filesystem-navigated knowledge accumulation) that OKF is built on.
- **Claude / Claude Code** — the coding agent used throughout as the second-brain-navigating agent; referenced as not natively aware of OKF yet.
- **BigQuery** — Google's data warehouse product; the data source OKF's native enrichment agent is built to consume.
- **AI Labs** — the channel/company itself; built and shared the custom "markdown to OKF" Skill and ran the live test described in the video.
- **AI Labs Pro** — the presenter's paid community where their custom skills/starter packs (including the markdown-to-OKF skill) are distributed.
- **Mobbin** (sponsor segment, not part of the OKF story) — a design-reference company; launched an MCP server exposing a library of 621,000 real app screens and 142,000 flows from shipped products (Revolut, Uber, Wise) so coding agents can reference proven UI patterns/flows/states/hierarchy before generating code, rather than "AI slop" generic UI. Setup under a minute; works with Claude, Cursor, and V0.
- **Obsidian** — referenced only as a comparison point: OKF's index.md cross-linking and graph view work like Obsidian's page-linking and graph view.
- **MCP, Skills, design.md** — cited as prior examples of the same standardization pattern OKF now extends to knowledge.

## Examples & use cases
- AI Labs' own team second brain (strategies, research, guidelines, Git/GitHub-hosted, shared across the team) — the actual worked example: converted to OKF on a test branch, visualized, and search-tested with real results (search initially failed until `Claude.md` was updated; then succeeded faster with lower token use).
- A recurring illustrative failure mode from AI Labs' pre-OKF experience: Claude placing a file in the wrong location and then creating a duplicate folder for content that already existed elsewhere under a different name, because it had no way to know the info was already present.
- Mobbin example: building a checkout flow and asking the agent to reference how top apps (implicitly including the named brands) handle it, with Mobbin supplying real flow/state/hierarchy data rather than copyable screens.

## Claims & confidence
- OKF is built on/derived from Karpathy's LLM Wiki pattern. [fact — stated directly by the presenter as OKF's stated basis] High confidence.
- RAG/vector search causes the agent to rebuild answers from scratch each query rather than accumulating knowledge over time. [claim, attributed to Karpathy] Medium-high confidence (presented as Karpathy's reasoning, not independently verified by AI Labs in this video).
- Claude only "knows" information exists in a knowledge base if it actively searches and finds it; it has no persistent awareness of the base's full contents. [claim, AI Labs' own operational observation] Medium-high confidence (first-hand experience, not a benchmark).
- OKF bundles are structured as concepts, organized in topic folders with `index.md` and YAML-fronted concept docs, using minimalism + separation as core design principles. [fact, as described from the spec/tooling AI Labs used] High confidence.
- OKF ships with an enrichment agent (BigQuery-based), an HTML visualizer, and format examples. [fact, per AI Labs' hands-on use] High confidence.
- Post-conversion + `Claude.md` update, retrieval was faster and used fewer tokens than default keyword search. [claim, AI Labs' own informal before/after test] Medium confidence — no benchmark numbers, sample size, or control given; qualitative observation only.
- OKF could extend to websites replacing/supplementing `llms.txt` for agentic web search. [opinion/speculation, explicitly the presenter's own inference] Low confidence — presenter frames this as their own thought, not sourced from Google, and states OKF is currently internal-use only.
- "Right now... this is more of an optimization than something you really need" until OKF becomes a broadly adopted, out-of-the-box standard. [opinion, presenter's closing verdict] Stated with high confidence by the presenter, but is itself a subjective/tempering judgment rather than a factual claim.

## Caveats & source gaps
- The transcript's auto-captions render the format's name inconsistently as both **"OKF"** and **"OKP"** in a few places — no clarifying detail is given in the source about which is correct or whether this is a caption artifact; treated here as the same entity (OKF, used predominantly).
- No quantitative benchmarks are given for the token/speed savings — "faster" and "fewer tokens" are qualitative, first-hand impressions from one team's one conversion, not measured figures.
- The video does not explain OKF's `type` field taxonomy (what concept types exist) beyond naming that the field exists.
- No detail is given on how the native BigQuery-based enrichment agent or its LLM verification pass actually works internally — AI Labs didn't use it and describes it only from documentation, not hands-on.
- No detail on how the eval prompts in AI Labs' own "markdown to OKF" skill are structured or what failure modes they catch — named as existing but not shown.
- The web-search/`llms.txt` angle is explicitly speculative and unconfirmed by Google in the source.
- No version number, release date, or official Google source/link for OKF is given in the transcript itself.
- Mobbin segment is a paid sponsorship and its claims (screen/flow counts, "not copying" behavior) are Mobbin's own marketing claims relayed by the presenter, not independently verified in this video.

## What this means for Fusion247
*(Larry/Cairn interpretation — not sourced from the video.)*
- This directly validates the architecture already in place for myPKA: a Git-version-controlled, `AGENTS.md`/`CLAUDE.md`-governed markdown knowledge base with per-folder navigation instructions is structurally the same pattern OKF formalizes (folder-per-topic, an authoritative "read this first" index file, minimal per-file YAML description). The gap AI Labs hit — Claude defaulting to keyword search until told about a new structure — is a direct parallel to the SSOT/wikilink discipline already mandated in CLAUDE.md here; it reinforces that structure alone isn't enough, the agent has to be explicitly told how to use it.
- `Team Knowledge/INDEX.md` and `PKM/INDEX.md` already function like OKF's root `index.md`. Worth checking whether every subfolder in `Team Knowledge/` and `PKM/` has an equivalent local index — OKF's insistence on an index.md *at every level, not just root* is a concrete, cheap thing to audit for.
- The Karpathy reversal (RAG rebuilds from scratch vs. markdown-filesystem accumulates knowledge) is relevant background for the ObsidiWikAi / LightRAG→Neo4j graph work (see [[idea-007-obsidiwikai-build]]) — it's a useful citation if that build's design choices ever get questioned as "why not just use vector RAG."
- The presenter's own closing caveat — this is "an optimization, not a necessity, until it's an adopted standard" — is a useful data point for NOT chasing OKF adoption right now: it's unproven, Google-only-internal-use per the source, and the win AI Labs measured was informal. Low priority relative to current build sequencing ([[build-sequencing-brain-then-outputs]]).
- Mobbin (sponsor segment) is tangential but potentially relevant later for Felix/Iris/Charta's UI work if Fusion247 ever needs real-app design-pattern references — worth a note for Nolan/Pax rather than action now.

## Key concepts & takeaways
- **Open Knowledge Format (OKF)**: Google's standard for organizing shareable, agent+human-readable knowledge bases via topic folders, `index.md` files, and YAML-fronted "concept" documents.
- **Concept**: OKF's atomic unit — any single markdown/data/YAML object representing exactly one thing (minimalism principle).
- **LLM Wiki pattern (Karpathy)**: the foundational idea — markdown files navigated via filesystem, letting an agent accumulate knowledge over time, as a reversal of vector-RAG's "rebuild from scratch every query."
- **Standardization pattern**: MCP → Skills → design.md → OKF, each solving a fragmentation problem as agentic tooling matured.
- **Script-first skill design**: doing mechanical work in code and reserving the agent only for judgment calls, to cut token/agent load — the design principle behind AI Labs' own "markdown to OKF" skill.
- **Adoption gap**: a new structural standard is inert until the agent is explicitly told (via `Claude.md`) that it exists and how to use it.

## Actions & open questions
- Decide whether to trial OKF-style conventions (explicit per-folder `index.md`, minimal YAML-per-concept) inside `Team Knowledge/` as a low-cost structural check, separate from adopting the actual OKF tooling/spec.
- If curious, locate Google's official OKF spec/repo (not linked in this transcript) before considering any adoption — the source gives no authoritative link.
- No urgent action implied: the presenter's own verdict is that this is optional until broader agent-side adoption exists — treat as background awareness, not a build trigger, consistent with [[challenge-context-diluting-requests]].
- Optional: flag the Mobbin MCP server to Nolan/Pax as a candidate research item if/when UI-pattern reference tooling becomes relevant to Felix/Iris/Charta's workflow.

---

**RAW transcript — immutable source evidence:** `Sources/_raw/k4sMSsMzX2g/` — `tubeair-report.md` (sha256 `c44790cbaf26…`), `manifest.json` (sha256 `ea4954961fa9…`). Preserved as captured; never edited or summarised.
