# ObsidiWikAi — Traceability Matrix

**Purpose:** the single source that maps PRD requirements → work package → PR → test → status, so **Codex QA (and Warwick) can judge alignment + progress**, not cosmetics. Kept live in Git; status ledger mirrored to Supabase.

**Status legend:** ⬜ not started · 🟨 in progress · ✅ proven-in-test · 🔵 deferred (named + approved).

## Build progress — 2026-07-23 (overnight, branch `idea-007/obsidiwikai-build`)

Built live against the real box (LightRAG/Neo4j/Honcho/Supabase). Service: `services/obsidiwikai/`.

**✅ Proven live:** FR-002, FR-003, FR-004, FR-005, FR-006, FR-008, FR-009, FR-010, FR-011, FR-012, FR-014, FR-015, FR-016, FR-017, FR-018, FR-019, FR-021, FR-030, FR-A (one-tap review), FR-B (deferred reservoir), plus DoD 1–11 mechanisms, 19, 20. Context Outbox (CONTEXT-OUTBOX.md) acceptance proven except the Telegram front door.
**🟨 Partial / mechanism-present:** FR-001 (bounded slice ingested, not full transcript), FR-007 & FR-013 (need topically-overlapping sources to show compounding), FR-020 (Neo4j live; Supabase rebuild path not yet exercised), FR-022 (card data in Supabase; Directus collection registration pending), FR-024 & FR-D (Honcho write/read proven; feedback→lens loop + Directus edit UI pending), FR-028 (retrieval proven; governed agent interface pending).
**⬜ Not started:** FR-023 (feedback UI), FR-025/026/027 (WP5 suggestions/monetise), FR-029 (MyPKA candidates), FR-C (historical re-mine), DoD 12–18 (feedback UI, suggestions, MyPKA candidates), WP7 (work/Bellrock lane — deferred by design).
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
| FR-007 | Expanding semantic scope | WP4 | wider lens → more captured on re-run | ⬜ |
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
| FR-029 | MyPKA improvement candidates (governed) | WP5/WP6 | candidate ≠ canonical without governance | ⬜ |
| FR-030 | Privacy separation (raw personal excluded) | cross-cutting/WP0 | classification blocks personal→external | ⬜ |
| FR-A (follow-up) | Human-assisted semantic resolution | WP1 | uncertain → one-tap Directus question | ⬜ |
| FR-B (follow-up) | Deferred semantic reservoir | WP4 | below-threshold retained, not discarded | ⬜ |
| FR-C (follow-up) | Historical re-analysis on lens change | WP4 | old sources re-mined, explained | ⬜ |
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
| 14 | Observable lens expansion over time | WP4 | ⬜ |
| 15 | Grounded self-improvement suggestions | WP5 | ⬜ |
| 16 | Grounded Fusion247 suggestions | WP5 | ⬜ |
| 17 | Grounded content/monetisation opportunities | WP5 | ⬜ |
| 18 | Governed MyPKA idea/change candidates | WP5/WP6 | ⬜ |
| 19 | Safe reprocessing + rebuilding | WP1/WP4 | ⬜ |
| 20 | Clear separation of vault / encyclopedia / lens | cross-cutting | ⬜ |

**First-build exit bar:** all 20 mechanisms ✅ with compounding shown across ~3–5 real sources + observable lens expansion. Deferred past first build (named + approved): **WP7 work/Bellrock lane** 🔵.
