# ObsidiWikAi — Traceability Matrix

> ## STATUS 2026-07-24 — FR-029 LIVE-PROVEN; WP6 + WP4 GROUNDED LENS-EXPANSION PROVEN
> **One authoritative graph:** LightRAG 1.5.4 on **Neo4JStorage** (physically in Neo4j); NetworkX + the
> duplicate `OwaiConcept` projection retired (NetworkX kept as rollback). Intent = **KEEP | LEARN**.
>
> - **WP1 ✅** Neo4JStorage cutover; Learn fully automatic (Cairn→learn-worker→§7.1→Neo4j) + health check.
> - **WP2 ✅ (bar 1 human dep)** Honcho lane (verbatim) + hardened outbox + MS Graph email adapter;
>   **needs Warwick: mailbox account + one-time OAuth** to finish email E2E.
> - **WP3 ✅** interest-lens management (surface + edit + feed Honcho).
> - **WP4 ✅** compounding loop proven. Codex's grounded mechanism (2-run consensus, exact-concept validation,
>   preserved interpretation history) correctly returns no delta when there is no real expansion. **Positive
>   grounded proof (Larry, head shows this):** baselined graph-agents → Warwick develops a *database-query-security*
>   interest → re-analysis surfaced **exact** newly-visible concepts (`Cypher Query`, `Prepared Statement`) with a
>   lens-driven relationship, survived the 2-run consensus, and wrote a before/after "Since you first learned this…"
>   note on the report. History preserved (9 interpretations). WP4B additive re-mining machinery (migration 0008,
>   verified additive writes + provenance) is present + correctly conservative.
> - **WP6 ✅** governed Brain access (FR-028) proven live: bounded read-only `brain_search`/`brain_ask` MCP
>   (no paths/Cypher/routes/writes; grounded-or-refuse; MyPKA advisory). Live `brain_ask` returns a grounded answer
>   with references back to source videos.
> - **WP5 ✅** grounded so-what suggestions (self_improve/fusion247/content/monetise), cited/confidence/
>   human-gated → Directus `learning_candidate`; Accept/Decline → Honcho.
> - **WP7 🔵** work/Bellrock walled lane — deferred by design.
>
> **Delivered product surfaces (Tailscale, managed):** report `fusion-report` box:8701 · graph `fusion-graph`
> box:8700 (both banked at `services/obsidiwikai/ops/`). **NOT merged** (Codex review + Warwick gate stand).
>
> **✅ FR-029 / DoD #18:** governed **MyPKA self-improvement candidates** ("🛠 Make the Brain
> Better") are deployed and proven live through the existing `learning_command → follow_on_task → Larry resume` machinery. This matrix is the canonical evidence record.

**Purpose:** the single source that maps PRD requirements → work package → PR → test → status, so **Codex QA (and Warwick) can judge alignment + progress**, not cosmetics. Kept live in Git; status ledger mirrored to Supabase.

**Status legend:** ⬜ not started · 🟨 in progress · ✅ proven-in-test · 🔵 deferred (named + approved).

## Build progress — 2026-07-23 (overnight, branch `idea-007/obsidiwikai-build`)

Built live against the real box (LightRAG/Neo4j/Honcho/Supabase). Service: `services/obsidiwikai/`.

**✅ Proven live:** FR-002, FR-003, FR-004, FR-005, FR-006, FR-008, FR-009, FR-010, FR-011, FR-012, FR-014, FR-015, FR-016, FR-017, FR-018, FR-019, FR-021, FR-029, FR-030, FR-A (one-tap review), FR-B (deferred reservoir), plus DoD 1–11, 18–20 mechanisms. Context Outbox (CONTEXT-OUTBOX.md) acceptance proven except the Telegram front door.
**🟨 Partial / mechanism-present:** FR-001 (bounded slice ingested, not full transcript), FR-007, FR-C & DoD #14 (three-source proof run but no repeatable grounded expansion), FR-013 (needs topically-overlapping sources to show compounding), FR-020 (Neo4j live; Supabase rebuild path not yet exercised), FR-022 (card data in Supabase; Directus collection registration pending), FR-024 & FR-D (Honcho write/read proven; feedback→lens loop + Directus edit UI pending), FR-028 (retrieval proven; governed agent interface pending).
**⬜ Not started:** FR-023 (feedback UI), FR-025/026/027 (WP5 suggestions/monetise), remaining DoD 12–17, WP7 (work/Bellrock lane — deferred by design).
**⛔ Human deps outstanding:** H1 fusiongptbot token (front door built, unrun), H2 Honcho cockpit check.

Two real sources compiled → **71 concepts / 142 relationships** in the curated Neo4j encyclopedia; 9 unit tests green.

_(Per-row table below reflects the original plan; the summary above is the live truth as of the overnight build.)_

## Functional requirements → WP

| FR | Requirement (short) | WP | Test / evidence | Status |
|---|---|---|---|---|
| FR-001 | Full transcript ingestion | reuse (TubeAIR) / WP1 | e2e: real URL → full transcript retained | ⬜ |
| FR-002 | Durable source identity | reuse (video_id) / WP1 | resubmit same URL → no dup source | ⬜ |
| FR-003 | Evolving Honcho lens (fresh per run) | WP1 | lens fetched + recorded per run | ⬜ |
| FR-004 | Interest horizons (enduring/active/emerging/…) | WP1/WP3 | lens record has all horizons | ⬜ |
| FR-005 | Broad discovery pass | WP1 | important concept captured w/ no lens match | ⬜ |
| FR-006 | Interest-conditioned pass | WP1 | lens-steered deeper extraction observed | ⬜ |
| FR-007 | Expanding semantic scope | WP4 | wider lens → more captured on re-run | 🟨 three-source proof failed conservatively |
| FR-008 | Emerging-interest discovery | WP1/WP4 | out-of-lens concept offered as emerging | ⬜ |
| FR-009 | Semantic entity search before create | WP1 | candidate matched vs existing by embedding+graph | ⬜ |
| FR-010 | Multi-outcome canonicalisation | WP1 | all 10 classifications exercised | ⬜ |
| FR-011 | Canonical concept identity | WP0/WP1 | node carries full canonical record | ⬜ |
| FR-012 | Source-preserving aliases | WP1 | original wording retained on merge | ⬜ |
| FR-013 | Duplicate prevention | WP1 | phrasing variants → one node | ⬜ |
| FR-014 | Over-merge prevention | WP1 | related-but-distinct NOT merged; low-conf reviewable | ⬜ |
| FR-015 | Graph relationship management | WP0/WP1 | typed edges created | ⬜ |
| FR-016 | Provenance | WP0/WP1 | every node/edge traces to evidence | ⬜ |
| FR-017 | Candidate/accepted states | WP0/WP1 | status lifecycle enforced | ⬜ |
| FR-018 | Source-keyed idempotency | WP1 | reprocess → replace, no dup universe | ⬜ |
| FR-019 | LightRAG retrieval | WP6 | grounded query across sources | ⬜ |
| FR-020 | Neo4j encyclopedia + rebuildable | WP0/WP6 | rebuild from source+provenance | ⬜ |
| FR-021 | One user-visible encyclopedia | WP1 | candidate layer never shown as 2nd brain | ⬜ |
| FR-022 | Directus plain-language explanation | WP1/WP3 | card reads in English before tech | ⬜ |
| FR-023 | Feedback capture (approve/reject/merge/split/…) | WP3 | all controls present + recorded | ⬜ |
| FR-024 | Feedback learning → Honcho | WP3 | feedback updates lens | ⬜ |
| FR-025 | Grounded suggestions (improve/Fusion247/monetise) | WP5 | suggestion cites source concepts | ⬜ |
| FR-026 | Suggestion uncertainty stated | WP5 | evidence+confidence+what-invalidates shown | ⬜ |
| FR-027 | No autonomous monetisation action | WP5 | human-gate enforced | ⬜ |
| FR-028 | Governed agent access | WP6 | agents retrieve via governed interface | ⬜ |
| FR-029 | MyPKA improvement candidates (governed) | WP5/WP6 | candidate ≠ canonical without governance | ✅ live real-source loop proven 2026-07-24 |
| FR-030 | Privacy separation (raw personal excluded) | cross-cutting/WP0 | classification blocks personal→external | ⬜ |
| FR-A (follow-up) | Human-assisted semantic resolution | WP1 | uncertain → one-tap Directus question | ⬜ |
| FR-B (follow-up) | Deferred semantic reservoir | WP4 | below-threshold retained, not discarded | ⬜ |
| FR-C (follow-up) | Historical re-analysis on lens change | WP4 | old sources re-mined, explained | 🟨 history/re-run proven; useful delta not proven |
| FR-D (follow-up) | Interest-lens management surface | WP3 | inspect+correct lens; Supabase canonical mirror | ⬜ |

## 20 Definition-of-Done criteria → WP

| # | DoD criterion | WP | Status |
|---|---|---|---|
| 1 | Telegram→transcript ingestion | reuse/WP1 | ⬜ |
| 2 | Fresh Honcho lens generation | WP1 | ⬜ |
| 3 | Broad semantic discovery | WP1 | ⬜ |
| 4 | Interest-conditioned analysis | WP1 | ⬜ |
| 5 | Adjacent/emerging interests identified | WP1/WP4 | ⬜ |
| 6 | Semantic match vs existing concepts | WP1 | ⬜ |
| 7 | All classification outcomes | WP1 | ⬜ |
| 8 | Duplicate-resistant Neo4j updates | WP1 | ⬜ |
| 9 | Provenance on every node/edge | WP1 | ⬜ |
| 10 | LightRAG retrieval across sources | WP6 | ⬜ |
| 11 | Directus visibility of changes | WP1/WP3 | ⬜ |
| 12 | Warwick correction/feedback controls | WP3 | ⬜ |
| 13 | Honcho learns from feedback | WP3 | ⬜ |
| 14 | Observable lens expansion over time | WP4 | 🟨 three-source proof found zero repeatable expansion |
| 15 | Grounded self-improvement suggestions | WP5 | ⬜ |
| 16 | Grounded Fusion247 suggestions | WP5 | ⬜ |
| 17 | Grounded content/monetisation opportunities | WP5 | ⬜ |
| 18 | Governed MyPKA idea/change candidates | WP5/WP6 | ✅ live real-source loop proven 2026-07-24 |
| 19 | Safe reprocessing + rebuilding | WP1/WP4 | ⬜ |
| 20 | Clear separation of vault / encyclopedia / lens | cross-cutting | ⬜ |

**First-build exit bar:** all 20 mechanisms ✅ with compounding shown across ~3–5 real sources + observable lens expansion. Deferred past first build (named + approved): **WP7 work/Bellrock lane** 🔵.

## WP4 bounded three-source compounding proof — honest non-pass (2026-07-24)

**Scope:** Cerebras `eCx3SSCcISo` (174 concepts / 43 connected), Graph Agents `MUN1eAlL0lc`
(253 / 62), and healthy overlapping AI Memory `pcR30j-sKxU` (134 / 40). No source was re-ingested and no
graph, schema, scheduler, UI, or product layer was added.

**Warwick-approved lens correction:** existing interest control added active interest
`support-resolution retrieval tested on representative questions` at weight `0.9`; the existing Context Outbox
delivered the correction to Honcho. This synthesises Warwick's already explicit priorities: operational agent
memory, a selected Knowledge Base or Support Tickets, representative retrieval questions, and an implementation
recommendation rather than autonomous operation.

**History preserved:** common pre-change interpretations were appended as `3738dc14…` (Cerebras), `c78f5167…`
(Graph Agents), and `a036eca2…` (AI Memory). Earlier Graph Agents interpretations and every exploratory after-run
remain in the append-only ledger.

**Why this does not pass:** the first one-pass re-analysis produced plausible prose and different selected concepts,
but both before and after selections were capped at 18; that could be ranking churn rather than expansion. The
acceptance path was therefore tightened to (a) require exact live-graph concept strings, (b) require at least one
known cross-source endpoint for a relationship, and (c) run two paired BEFORE/AFTER comparisons and accept only
their intersection. The final run isolated the comparison to the one approved interest string, excluding unrelated Honcho wording. Both passes returned zero newly visible concepts, zero newly visible
cross-source concepts, and zero new lens-driven relationships for all three sources. The graph also gained zero
connections because the retained sources were re-analysed, not re-ingested.

**Current honest live rows:** `62928d16…` (Cerebras), `993881a9…` (Graph Agents), `c89e799d…` (AI Memory).
Each has `lens_expansion=false`, a null delta, and two zero/zero/zero paired-comparison runs. In plain English:
before, the Brain already understood operational memory, support-ticket/knowledge-base retrieval, representative
testing, and implementation recommendations. After Warwick's lens correction, the Brain could phrase that focus
more sharply, but it did not reliably notice additional grounded material or connections. The old sources did not
become measurably more useful in this run.

**Verdict:** WP4's history and re-run mechanism are real; FR-007, FR-C and DoD #14 remain 🟨 partial. The
first-build exit bar is not met. A future proof needs a genuinely novel approved interest shift relative to the
stored baseline, not a more specific label for interests the baseline already contained.

## FR-029 / DoD #18 — live acceptance evidence (2026-07-24)

**Implemented, deployed, and proven on the existing branch and draft PR #59; not merged.**

- Live schema: migration `220_system_improvement_candidate.sql` applied transactionally and validated (three columns, scope constraint, partial unique index, least-privilege grants).
- Live service: `fusion-report` recreated with `REPORT_ACTION_DATABASE_URL` set to the request-only `cp_directus` role; the broader report DSN is no longer an action fallback.
- Exposure check: report port 8701 was unreachable on the box's public IPv4 address and reachable on the authorised Tailscale address.
- Real source: `eCx3SSCcISo` — _Cerebras Killed Notion, Obsidian, and Your "Second Brain"_ (174 graph concepts; 131 new, 43 connected).
- Generated candidates: four specific, source-grounded improvements with stable refs `OWAI:eCx3SSCcISo:A` through `:D`.
- Live report POST proof: foreign origin and invalid token returned 403; Action A Accept and Action B Dismiss returned 303 and displayed queued lifecycle states.
- Accepted proof: Action A (`lightrag` / `retrieval`) became `accepted`; one open `learning_accept` task `29a641b1-007a-4cab-8414-2cb7ec8fb581` is correlated to the source/ref and contains evidence, rationale, expected effect, confidence, risk, next step, and Warwick approval.
- Larry proof: the committed resume consumer sees that task; `Action A from the Cerebras report` resolves unambiguously to candidate `93b19aec-07ff-4e2a-a83c-c810e9eeb9a5` / `OWAI:eCx3SSCcISo:A` on Windows.
- Dismiss proof: Action B became `declined`; zero `follow_on_task` rows exist for it.
- Aggregate proof: `prove-idea007-system-loop.mjs --source=eCx3SSCcISo` passed 24/24; `PKM/` remained unchanged.
- Regression proof: the live report retains why-it-matters, what-changed, new/connected concepts, WP5 suggestions, evidence, WP4 delta, graph links, existing user decisions, and response security headers.
- Deployment-only defects fixed: request-only DSN now fails closed; report decision read no longer requests disallowed UPDATE locking; `cp_worker` has the narrow source-title read it needs; the resume CLI direct-run guard is Windows-safe.

**Completion rule met:** FR-029 and DoD #18 are ✅ complete. The accepted improvement is deliberately left with Larry as governed work and was not implemented during this acceptance proof.

## WP4B additive re-mining — implementation present, one-source acceptance held (2026-07-24)

**Scope:** retained faithful-clean `bankdPmQnHU` (“DEPLOY Fully Private + Local AI RAG Agents”), with Warwick's
approved emerging interest `AI data sovereignty for sensitive client documents`. No YouTube download or TubeAIR
work was repeated, and no authoritative graph node, relationship or provenance record was written.

- The pinned `lightrag-neo4j:1.5.4-pinned` isolated create→edit/backfill gate passed all eight checks: entity and
  relation reverse indexes, entity and relation vector provenance, stored chunk, entity retrieval and retrieval
  provenance. The temporary container had no Neo4j credentials or production storage mount.
- The retained source hash matched the authoritative full document exactly
  (`ea5736aa8b7839127c1479bebbb9c4a08177ec175a5e1651497a54f2787a2ead`); identity remained
  `bankdPmQnHU` / `doc-4ea6861fc6f1fe52307e848bb6548639` / 13 stable chunks.
- BEFORE was stored through existing WP4A: 332 source concepts, 392 relationships, 78 cross-source concepts. It
  understood a private n8n/Docling/Qdrant/Ollama RAG implementation, including `Air-Gapped Local Deployment` and
  `Client Documents`, but not `Sensitive Documents` as a source contribution.
- Isolated WP4B extraction produced a frozen 327-entity / 405-relationship candidate bundle. It newly extracted
  `Sensitive Documents` from exact chunk `...-chunk-000` (source chars 0–5556), grounded in the passage about
  legal, medical, financial and client documents requiring full control.
- The conservative selection chose `Local AI`, `Air Gap` and their relationship instead. `Local AI` was held
  uncertain; the relationship was consequently held; and `Air Gap` risked duplicating the existing
  `Air-Gapped Local Deployment`. Run `e080e42f-9ad6-462f-b7ea-c5b82956d834` preserves the frozen evidence as
  `held`, with zero operation receipts; the apply gate stopped before any LightRAG mutation.

**Plain English:** Before, the Brain understood the source as a practical private local-RAG deployment. After
Warwick's lens changed, isolated re-mining genuinely noticed the previously unrepresented `Sensitive Documents`
evidence, but the conservative promotion gate did not safely connect and canonicalise that evidence into the
authoritative graph. The old source has not yet become measurably more useful in the live Brain.

**Verdict:** the retained-source→fresh-extraction connection is implemented and the isolated pinned
write/provenance mechanics are proven. The authoritative additive apply/rollback path remains unexercised by live
knowledge because the one-source semantic proof honestly stopped. FR-007, FR-C, DoD #14 and the three-source exit
bar remain 🟨 partial; the prior three sources were not rerun.
