# IMPLEMENTATION PLAN — ObsidiWikAi

> ## ✅ FINAL ARCHITECTURE (2026-07-24) — supersedes any conflicting design below
> **ONE authoritative knowledge graph.** `Cairn LEARN → faithful-clean full-detail source (TubeAIR §7.1)
> → LightRAG → Neo4JStorage → Neo4j`. LightRAG **builds + retrieves**; Neo4j **stores + traverses** the
> *same* graph (Cypher-queryable). TubeAIR/raw = source truth; Honcho = lens; Supabase = ledger/health.
> **The separate `OwaiConcept` curated projection is RETIRED/PARKED** (no duplicate graph) — its lens/
> canonicalisation/reservoir/suggestion logic is kept to rehome onto the one graph. **Intent = KEEP | LEARN**
> (the old Keep/Extract/Deep-index model is gone). The Learn path is **automatic** (learn-worker) — no
> Larry-in-session step. Production = `lightrag-neo4j-prod` on box `:9621`; old NetworkX stopped + retained
> as rollback. Proven A–G + a fresh E2E on the finished route. See README (obsidiwikai) + TRACEABILITY.

**Idea:** IDEA-007 · **Author:** Larry · **Date:** 2026-07-23
**Authority:** Builds to the canon in `PRD.md` + `PRD-FOLLOWUP.md` + `CONTEXT-OUTBOX.md` (this folder).
**Status:** Plan for Warwick approval. **No implementation authorised until Warwick says go.**
**Build stance (Warwick's explicit steer):** *Build to the goal, not to prove the idea.* The full 20-point Definition of Done is the target; the first milestone is **shiny and real**, not a throwaway skeleton. Staged implementation, single un-staged Definition of Done (PRD §12).

---

## 1. Executive recommendation — **GO**

Every hard mechanical move in this product already exists as a verified primitive on the box we already run (BUILD-002 spine, LightRAG `merge_entities`/`addon_params`, Neo4j, managed Honcho, Directus intent-cards). This is **orchestration + semantic judgement around proven parts**, not invention. Confidence is high; the unknowns are three things we settle with a half-day spike on the pinned deployment (WP0), not research.

**n8n: NO-GO** for this build. We have durable workers + Directus visibility; adding an orchestration engine now is theatre. Re-assess only if a real glue seam appears.

**The through-line:** *Your evolving interests aim the reader; the reader hunts for what matters and what's next-door; a personalised canonicaliser weaves it into one growing 3D encyclopedia — asking you only when it's unsure — and as it learns you, it re-reads your past.*

---

## 2. First shiny (why this won't be a week of admin)

**Milestone M1 — "The first video that makes the brain grow" (target: early, days not weeks).**
You send one real YouTube URL. Minutes later, a **Directus card** shows: *what it taught · what mattered to you and why · what I merged into your encyclopedia · the new nodes and links · the graph, visibly bigger than before.* That is a real slice of the actual product — not a mock — and it's the first thing you'll see. Everything after M1 **thickens** toward the full goal; nothing after M1 throws M1 away.

---

## 3. Verified foundations (what we reuse, what's proven, what we prove first)

### 3.1 Reuse unchanged — the BUILD-002 spine (do NOT rebuild)
- Durable Telegram capture, deterministic idempotency (`capture_id` = UUIDv5 of content hash), the `fcg` job queue with lease/claim (`FOR UPDATE SKIP LOCKED`), the 14-state machine, evidence-once, the durable monotonic poll-offset, and the **Directus intent-card pattern** (`cp_directus` inserts *requests*, `cp_worker` applies + writes receipts). TubeAIR already yields the transcript + immutable evidence + Karpathy packet, keyed by stable `video_id`.
- **Consequence:** capture, queueing, receipts, cockpit plumbing = **done**. ObsidiWikAi begins *after* durable capture.

### 3.2 Verified primitives (Pax, cited in the brief)
- `merge_entities(source_entities, target_entity, merge_strategy, target_entity_data)` — redirects relationships, merges duplicates, removes sources. The "3 terms → 1 node" engine.
- `addon_params["entity_types_guidance"]` / custom extraction prompt — **live-steerable** extraction (the evolving lens; re-steers next ingest without restart).
- Canonicaliser has named prior art (**Extract-Define-Canonicalize**): embedding + graph-neighbourhood + LLM tie-break, conservative thresholds → human review.

### 3.3 Prove-by-doing in WP0 (the only real unknowns)
1. `merge_entities`/`edit_entity` mutate the **Neo4j** backend correctly on pinned **v1.5.4** (not just default NetworkX).
2. `addon_params` re-steers the next ingest without restart on v1.5.4.
3. Honcho `context()` shape — what it actually returns / how inspectable.

---

## 4. Architecture (the shape)

```text
Telegram ──▶ BUILD-002 Gateway ──▶ Supabase capture/job  (REUSED)
                                        │
                                        ▼
                                     TubeAIR  (REUSED) — transcript + evidence + packet
                                        │
                    ┌───────────────────▼─────────────────────┐
                    │        KNOWLEDGE COMPILER (NEW)          │  ← cloud worker on Coolify
                    │  1. fetch Warwick LENS from Honcho       │
                    │  2. LightRAG broad discovery pass        │  (cheap models)
                    │  3. LightRAG interest-conditioned pass   │  (lens-steered)
                    │  4. CANONICALISER: same/alias/broader/…  │  (Opus/strong tie-break)
                    │     auto when confident · ASK when not   │
                    │  5. project ACCEPTED → encyclopedia      │  (merge_entities, idempotent per source)
                    │  6. provenance + status → Supabase       │
                    └───────────────────┬─────────────────────┘
        ┌───────────────┬───────────────┼───────────────┬───────────────┐
        ▼               ▼               ▼               ▼               ▼
   Neo4j            LightRAG        Directus          Supabase        Telegram
 ENCYCLOPEDIA       retrieval     knowledge card +   provenance +     receipt
 (3D, canonical)    index         lens mgmt + one-   receipts/ledger
                                  tap resolutions

   ChatGPT ──"send that to Honcho"──▶ Outbox capture bot ──▶ validate ──▶ ONE Honcho write ──▶ receipt
                                      (NEW, reuses spine)     (feeds & widens the LENS)
```

**Three layers, never confused:** personal vault (Obsidian/MyPKA — separate, canonical, yours) · the encyclopedia (Neo4j — world-knowledge, *not* your diary) · the lens (Honcho + Supabase mirror — the model of you, never poured into the encyclopedia).

**One Neo4j, two logical layers** (candidate inbox vs canonical, by `status`) — held as a **testable option** per PRD-FOLLOWUP, locked in WP0, not before. Derived-never-canonical holds via the Supabase provenance mirror; the encyclopedia is always rebuildable from retained source + provenance.

---

## 5. Data model (locked in WP0)
- **Encyclopedia nodes:** `Concept, Person, Organisation, Tool, Technology, Method, Claim, Source, Question, Opportunity, ProjectReference` (extensible).
- **Canonical concept record:** `canonical_id, canonical_name, description, aliases[], type, status, confidence, first_seen, last_updated, source_count, evidence_count, embedding_ref, privacy/domain, superseded_by`.
- **Relationships:** `IS_ALIAS_OF, IS_A, PART_OF, ENABLES, USES, SUPPORTS, CONTRADICTS, SUPERSEDES, CAUSES, AFFECTS, RELEVANT_TO, MENTIONED_IN, DERIVED_FROM` (extensible).
- **Evidence:** `source_id, transcript_span, original_wording, extracted_claim, model/version, processing_run, timestamp, confidence`.
- **Interest-lens record (per run):** `lens_version, enduring[], active[], emerging[], goals[], current_projects[], open_questions[], negative_signals[], adjacent_topics[], generated_at`.
- **Status lifecycle:** `candidate → (confident|uncertain) → accepted | held | rejected | superseded`. Source-keyed idempotent projection (same shape as the TQA-006 COALESCE upsert) so reprocessing *replaces* a source's contribution.

---

## 6. Work packages — built to the goal

Legend — **⏩ parallel-safe** (worktree-isolated) · **⛓ waterfall** (has hard predecessors) · **👤 human dep** · lead in *italics*.

| WP | What it delivers | Order | Human deps | Primary builder |
|---|---|---|---|---|
| **WP0 — Foundations & spike** | Prove the 3 unknowns on pinned v1.5.4; lock data model + Supabase schema + traceability matrix; Neo4j/LightRAG namespaces | ⛓ **first, blocks most** | 👤 Telegram bot token(s); confirm Honcho cockpit access | *Larry* + Silas (schema) |
| **WP1 — Compiler spine → M1 SHINY** | The new worker: lens→broad pass→interest pass→canonicaliser (auto + one-tap)→ project to encyclopedia→ Directus card. One real video, real card, graph grows | ⛓ after WP0 | 👤 pick the first real YouTube URL | *Larry* (canonicaliser+orchestration) + Mack (LightRAG/Neo4j wiring) |
| **WP2 — ChatGPT→Honcho Outbox bot** | Dedicated capture bot; packet schema; validate + single Honcho write; receipt; Directus visibility. **Feeds/widens the lens — early, not last** | ⏩ parallel w/ WP1 after WP0 | 👤 create the outbox Telegram bot token | *Mack* + Larry (Honcho semantics) |
| **WP3 — Interest-Lens Management** | Directus surface: "what we think you care about", editable; canonical interest mirror in Supabase; feedback controls that teach Honcho | ⏩ parallel after WP0 | — | *Felix/Vera* + Larry |
| **WP4 — Compounding & reservoir** | Run 3–5 real sources; prove cross-source connection (compounding); low-confidence reservoir; historical re-analysis when lens shifts; observable lens expansion | ⛓ after WP1 (+WP2 feeding lens) | 👤 the 3–5 acceptance sources | *Larry* |
| **WP5 — Grounded suggestions** | Self-improve / Fusion247 / **monetise** suggestions — cited, confidence-stated, human-gated. **Highest value, highest liar-risk → built last, strictest evidence bar** | ⛓ after WP4 (needs graph mass) | 👤 approve suggestion policy/thresholds | *Larry* + Vex (guardrails) |
| **WP6 — Retrieval & agent access** | LightRAG+Neo4j grounded Q&A with provenance for Larry/agents; optional Neo4j + Honcho **MCP** so Larry queries live in-chat | ⏩ parallel after WP1 | — | *Mack* + Larry |
| **WP7 — Work/Bellrock lane (FINAL, WALLED)** | Privacy-tagged separate domain to support you as implementation manager (Concerto→Bellrock). Own authority + segregation. **Deferred until core proven** | ⛓ last, gated | 👤 explicit go + authority/segregation decision | *Larry* + Vex |

Cross-cutting (every WP): provenance & rebuildability · privacy classification **before** any external-model call (personal/health/employer data excluded by default) · cost metering (cheap models for candidates, strong only for ambiguous canonicalisation/synthesis) · the traceability matrix kept live.

---

## 7. Waterfall vs parallel (the critical path)

```text
WP0 ──┬──▶ WP1 ──▶ WP4 ──▶ WP5
      │      └────────────▶ WP6 (parallel once WP1 exists)
      ├──▶ WP2  (parallel — start early; feeds WP4's lens)
      └──▶ WP3  (parallel)
                                   WP7 ──▶ (after core proven; gated)
```
- **Only WP0 → WP1 → WP4 → WP5 is truly serial.** WP2, WP3, WP6 run **in parallel** off WP0/WP1.
- Parallel WPs that touch files run in **isolated git worktrees** (no shared-tree races).
- **Critical path to M1 shiny = WP0 → WP1.** That's the fast, exciting bit; everything else thickens around it.

---

## 8. Optimise the build for Opus (model & effort allocation)

| Layer | Runs on | Why |
|---|---|---|
| Capture wiring, schema/migrations, Directus registration, idempotency, worker scaffolding | **Deterministic code** (no model) | cheap, exact, testable |
| Broad-pass extraction, keyword/candidate generation | **Cheap models** (LightRAG per-role: gpt-5-nano/mini) | high volume, low stakes |
| **Canonicaliser adjudication** (same/alias/broader/…), **Warwick-relevance synthesis**, **suggestion/monetise reasoning** | **Opus / strong (gpt-5.6-terra)** | the judgement calls that define quality — Opus's edge |
| Architecture, canonicaliser policy, privacy classification, sequencing, semantic-merge decisions | **Larry (Opus) judgement** | the irreducible thinking |
| Approvals, secrets, tokens, source choice, the one-tap resolutions | **Warwick** | authority + the human-in-the-loop that makes dedup tractable |

**Build orchestration optimised for Opus:** I (Opus) hold the whole PRD+plan+traceability in context and own the semantic core (canonicaliser, relevance, suggestions) directly. The independent peripheral WPs (WP2 outbox, WP3 Directus UI, WP6 retrieval) I delegate to specialists (**Mack, Felix/Vera, Vex**) running in **parallel worktrees**, then synthesise — so wall-clock is the critical path (WP0→WP1→WP4→WP5), not the sum of everything.

---

## 9. Human dependencies (so nothing stalls silently)

| # | Need | When | Why |
|---|---|---|---|
| H1 | Create **Telegram bot token(s)** (BotFather) — incl. the Honcho-outbox bot | before WP1/WP2 | new capture lanes |
| H2 | Confirm **Honcho cockpit** access + whether you can CRUD it | WP0 | lens visibility path |
| H3 | Provide/rotate any new **secrets into Coolify** | per WP | secrets never in Git |
| H4 | Pick the **first real YouTube URL** (H4a) and the **3–5 compounding sources** (H4b) | WP1 / WP4 | acceptance evidence |
| H5 | Approve **suggestion policy + confidence thresholds** | WP5 | monetise guardrails |
| H6 | **Work-lane authority + segregation** decision | WP7 | Bellrock walled lane |
| H7 | **Merge approvals** (per PR, expected-head guard) | every PR | your standing gate |

---

## 10. QA substrate — Codex sees the PRD, the plan, and progress (your point 4)

- **Canon + this plan + the Traceability Matrix live in Git, in `Fusion247PKA/ideas/IDEA-007/`** — so Codex reads them **at the exact reviewed commit**, automatically in context. (Enshrined already.)
- **`TRACEABILITY.md`** maps every FR + all 20 DoD points → WP → PR → test → status. This is what lets Codex judge **alignment + progress**, not typos.
- **Supabase** holds the live status ledger + the QA-dialogue record (Tower already does this); Directus surfaces the burn-down.
- **Codex merge brief (per PR):** the PRD, this plan, the traceability matrix, the diff at expected head, prior findings — with the explicit instruction: *"Does this PR advance the PRD and stay aligned? Which FR/DoD does it claim, and is that proven?"* Interactive, ≤3 rounds, recorded, escalate to Warwick, merge on your yes + expected-head SHA.

---

## 11. Definition of Done (the goal — un-staged)
All 20 PRD §12 criteria. **First-build exit bar** (agreed with the compounding reality): *all 20 mechanisms demonstrably working, with compounding shown across **~3–5 real sources** and observable lens expansion* — because a compounding engine can't prove it compounds on one video. Any capability deferred past this is **named and approved by you** (PRD §12), not quietly dropped. WP7 (work-lane) is the one explicitly-deferred item on the table today.

## 12. Cost, privacy, rollback (brief)
- **Cost:** cheap models for candidates, strong only for ambiguous canonicalisation/synthesis; cache unchanged analysis; batch Honcho; meter per source (alert £3, stop £5) — within the £10–15 + pennies target.
- **Privacy:** classification **before** any external-model call; personal/health/employer/Bellrock data excluded by default; only approved, abstracted signals influence the lens.
- **Rollback:** derived stores (Neo4j/LightRAG/Honcho) rebuildable from retained source + provenance; each WP ships its own rollback; no live cutover of the existing Telegram poller for the core build (the Compiler is a *new downstream consumer*, so no single-poller risk).

## 13. Warwick decisions required before WP0 starts
1. Approve this plan (or redline it).
2. H1 bot token(s) + H2 Honcho cockpit check.
3. H4a the first YouTube URL for M1.
4. Confirm the first-build exit bar (§11: ~3–5 sources) is the bar we're judged on.

*Nothing in this plan is built until you say go.*

---

## 14. Amendments — post-build decisions (2026-07-23)

The overnight build (branch `idea-007/obsidiwikai-build`, PR #59) proved the WP0–WP6 mechanisms. After a cost scare (the "£10" full-index was actually **~£0.60** — a misremembered credit balance) three decisions were taken (Warwick + GPT + Larry, unanimous).

### Three-axis model architecture — never welded together
- **INTENT** (`keep_raw` / `extract` / `deep_index`) — human-chosen at capture (the Telegram cards); decides *how much semantic work* a source earns. Default = `extract` (extract knowledge → populate Neo4j → link the raw source). `deep_index` (full-transcript search index) = explicit and priced.
- **ROLE** (`fusion.extract / keyword / query / reason / embed`) — *what capability* is needed. The app requests a role, never a provider/model.
- **GATEWAY** (thin LiteLLM) — *who supplies it*; maps role→provider→model by config, with centrally-enforced spend/rate limits (+ the provider's own credit cap as the ultimate backstop — deliberately **not** described as a penny-precise circuit breaker).

### New work packages (extend the goal — not a re-scope)
- **WP-INTENT** — intent-aware capture + compiler. *ObsidiWikAi side DONE (intent contract `src/core/intent.mjs`, `keep_raw` short-circuit, raw-link recorded). Telegram card buttons are capture-side (touch the live bot) → Warwick nod required.*
- **WP-GATEWAY** — thin LiteLLM on `fusion247-core`: 5 role aliases, one hard-budget key, Postgres+Redis, memory-capped, healthcheck. All roles → OpenAI initially (no new provider key). Acceptance: a deliberate over-budget call is blocked. *Live infra → Warwick's go.* Code already gateway-ready (`src/core/models.mjs`; set `FUSION_GATEWAY_URL` to activate).
- **WP-TOKEN-HYGIENE** — the real cost lever: chunk/overlap tuning, gleaning-pass count, caching, idempotent source-hash reprocess, Honcho-guided extraction depth. Profile *before* any model shopping.

### Standing decisions
- Keep OpenAI + `text-embedding-3-large`; build the `workspace`-based **blue-green re-index capability**, don't switch embeddings now.
- Qwen = benchmark **challenger**, not a commitment. Local inference deferred (no GPU on CX33; a future gateway config line).
- **Code decoupled to roles** (2026-07-23): `llm.mjs` reasoning now flows through `models.mjs → reason()` (provider-neutral), not LightRAG's OpenAI path.
- Guiding principles (Warwick, standing): build for scalability/future-proofing unless cost-prohibitive; build **to the goal**, use thin slices only to prove — never ship a slice as the goal.

## 15. Plan correction — Cairn / Unified Intake Intelligence (the missing upstream layer, 2026-07-23)

Not a new feature and not a YouTube add-on — this **closes a gap in the existing plan between durable Unified Fusion capture and the downstream specialist processors.** It replaces the deferred "D-cairn" (manual, in-session hand-authoring), now buildable because the LLM pipeline (gateway + LightRAG + Honcho + Compiler) exists.

**Cairn's responsibility** — for every *durably captured* object, decide: what it is · likely Warwick intent · privacy/domain class · destination lane/processor · treatment/action · confidence + bounded rationale · whether to **act / confirm / ask**.
**Cairn does NOT:** clean transcripts (TubeAIR owns that) · extract encyclopedia knowledge (LightRAG/Compiler) · become the personal vault · replace Honcho (Honcho = the evolving Warwick lens).
**Privacy ordering (non-negotiable):** classify routing/privacy *first*, locally, **without** shipping unrestricted raw content to Honcho/external reasoning to discover whether it's private. Fail closed.

**Knowledge treatment simplified** (Experiment B proved indexing is intrinsic to extraction — the Extract/Deep distinction was fake): **📄 Keep** (retain only) / **🧠 Learn** (full-quality extraction + encyclopedia + searchability). No Extract-vs-Deep tier.

**Lanes:** Lane 1 = real YouTube → external_knowledge/learn → TubeAIR (raw + faithful-clean + retained analysis) → LightRAG(clean) → Honcho lens → canonicaliser → searchable encyclopedia. Synthetic fixtures prove the generic contract: journal→personal/Obsidian, task→task, ambiguous→ask, explicit→explicit-wins. Other lanes are stubs this increment.

**Learning:** confirm-first for inferred actions; persist Warwick's corrections as governed routing feedback; explicit instruction outranks learned; low confidence asks; high-confidence learned may later be receipt-only, never silently crossing privacy/domain.

**Acceptance:** capture durable before Cairn · idempotent reruns · decision+confidence+rationale receipted · explicit wins · ambiguity asks · privacy fails closed · YouTube routes into the existing pipeline · journal/task fixtures prove generic architecture · Cairn failure cannot lose the object · decisions correctable/replayable · source-adapter based so email/article/audio/document add without rewriting Cairn.

**Sequence:** Cairn is built **before** the final Telegram buttons — the buttons are merely Cairn's confirmation UI. Experiment A stays a TubeAIR tuning task, not a Cairn blocker.
