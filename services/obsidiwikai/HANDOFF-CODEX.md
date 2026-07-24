# ObsidiWikAi (IDEA-007) — Codex handoff

Durable handoff to continue the build on Codex without losing momentum. Written 2026-07-24.

## Where we are
- **Branch:** `idea-007/obsidiwikai-build` · **head:** `b7729d6` · working tree clean · **PR #59** (draft, NOT merged).
- **32/32 unit tests** green (`cd services/obsidiwikai && npm test`).
- **WP1–WP5 COMPLETE.** WP6 partial (grounded Q&A via `ask.mjs`/`trace.mjs`). WP7 deferred by design.
- **Do NOT merge / branch / start Codex review or FR-029 implementation from the parking session.** Warwick's
  merge gate + independent review still stand. Next requirement = FR-029 (below).

## Architecture (final, one graph)
```
capture → Cairn LEARN → TubeAIR §7.1 faithful-clean → LightRAG 1.5.4 → Neo4JStorage → Neo4j
```
LightRAG builds+retrieves; **Neo4j stores+traverses the same graph** (workspace label `owai_rebuild_v1`).
No second OwaiConcept graph (retired/parked in `core/compiler.mjs`, `canonicaliser.mjs`, `directusCard.mjs` —
kept only to rehome lens/canonicalisation logic). Intent = **Keep | Learn**. Four joined surfaces = one Brain:
**Directus/cockpit** (ops/review, box:8055) · **report** (fusion-report box:8701) · **Neo4j graph** (fusion-graph
box:8700) · **Honcho** (evolving lens).

## Key code
- `src/cairn/` — intake router (contracts, classify, router, cairn). Honcho lane + email adapter.
- `src/core/learnIngest.mjs` — the automatic Learn path (faithful-clean §7.1 → LightRAG) + health reconcile.
- `src/core/suggestions.mjs` — WP5 grounded "so what" → `cockpit.learning_candidate`; `feedDecisions()` → Honcho.
- `src/core/reanalyse.mjs` — WP4 compounding (snapshot / reanalyse-DELTA / detectStale). Reads per-source graph
  data via the report server's `GET /api/source/<vid>`.
- `src/core/interests.mjs` — WP3 lens management.
- `src/bin/` — learn-worker, suggest, reanalyse, interests, trace, ask, email-*.
- `ops/graph-server.py`, `ops/report-server.py` — the two live view services (see ops/README.md).
- `migrations/0001–0007` — schema (0007 = source_interpretation for WP4).

## Runtime / infra (the box)
- SSH: `ssh -i ~/.ssh/hetzner_fusion247_ed25519 root@100.101.240.85` (Tailscale IP).
- Containers: `lightrag-neo4j-prod` (:9621, Neo4JStorage, image `lightrag-neo4j:1.5.4-pinned`), neo4j 5.26
  (`akdzfjqdpt8ivip4z202dz41-213500497069`, bolt :7687), `fusion-report` (:8701), `fusion-graph` (:8700).
- **LightRAG API quirks:** auth header is **`X-API-Key`** (not Bearer); `/documents/text` needs **`file_source`**;
  the box firewalls published ports EXCEPT 9621/7474/7687/8700/8701 → for others use a coolify-net sidecar
  (`docker run --network coolify curlimages/curl http://<container>:<port>`). Extraction ~80s/tiny doc.
- **Directus** reads the `cockpit.*` collections (metadata in `directus_sys` schema); `obsidiwikai.*` is NOT in its
  search path — surface things via `cockpit.*` tables (e.g. `learning_candidate`, `follow_on_task`, `youtube_source`).
- Env files in `C:\.fusion247\` (lightrag/neo4j/honcho/fusion-capture-gateway/fusion-gateway .env). `DATABASE_URL`
  carries a node-pg-only `uselibpqcompat` param — psycopg2 needs a sanitised DSN (see report-server `_clean_dsn`).
- **Rollback:** old NetworkX instance `g327xy3z5zv3qzrf75htbkse-213500865202` **stopped + retained** (`docker start`
  it + stop prod). Snapshot `C:\.fusion247\lightrag-backups\rag_storage-20260723-230755.tgz` (sha `668e4dd4…`).

## Known gaps / notes
- Early rebuild sources were ingested under artefact names (`graph-agents-MUN1e`) not video ids → report has an
  ALIAS dict (`MUN1eAlL0lc`→`graph-agents-MUN1e`, `pcR30j-sKxU`→`ai-memory-pcR30j`). Worth normalising later.
- `dhbcVxYhWaQ` ($1k business) has a note but was never graph-ingested (0 concepts) — re-learn to include it.
- WP4 uses a **simple trigger** (`reanalyse.mjs stale` / on-demand). No scheduler yet (by request).
- WP2 email E2E blocked on the **Warwick-only** dependency: create `warwickallan-f247@outlook.com` + one-time OAuth
  (see `EMAIL-SETUP.md`).

---

## NEXT REQUIREMENT — FR-029 / DoD #18: governed MyPKA self-improvement candidates

**Warwick's intent:** the Brain must not only tell Warwick how *source* knowledge helps him — it must proactively
analyse learned material for ways **Larry / MyPKA / Fusion247 ITSELF** could improve, so Warwick doesn't have to
spot them. Candidate kinds: architecture · Larry behaviour/instruction · Cairn · retrieval · new agent/tool
capability · reusable method · experiment · process change · Foundry candidate · research question.

**UX (in the "so what" experience):**
```
🛠 Make the Brain Better
  A — …   B — …   C — …
```
Each candidate carries: **what should change · target system/agent · why · supporting graph/source evidence ·
expected effect · confidence · risk/what-invalidates · suggested next step.** Warwick approves or dismisses.

**Flow (ACCEPT must NOT silently modify canonical MyPKA):**
```
candidate → Warwick Accept → existing governed follow_on_task → Larry/resume consumer → implementation/experiment → receipt/result
```
**Reuse existing BUILD-002 machinery — do NOT build a parallel task system:** `cockpit.learning_candidate`,
governed `cockpit.follow_on_task`, resume-followups / command+receipt. If full button-wiring is slow, retain a
**stable candidate reference** so Warwick can say *"Action A from <source/report>"* and Larry resolves it unambiguously.

**End goal — the semi-automated self-improving loop:**
```
SOURCE → Brain learns → Brain asks "can this make us better?" → proposes change → Warwick approves
      → Larry receives governed work → Larry improves the system → result becomes part of the system's history.
```

Likely shape (suggestion, not prescription): extend `suggestions.mjs` with a MyPKA-improvement generation pass
(target=the system, not Warwick's business), write candidates to `cockpit.learning_candidate` (or a clearly-tagged
subset) with a stable ref, surface a "🛠 Make the Brain Better" section on the report, and on Accept file a
`cockpit.follow_on_task` for the resume/command consumer. Keep it governed + human-gated throughout.
