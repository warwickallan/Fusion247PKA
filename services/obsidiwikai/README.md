# ObsidiWikAi — Knowledge Compiler (IDEA-007)

Turns a captured source into personalised, connected, queryable knowledge in **one authoritative
knowledge graph**. **DEV — not merged** (awaiting Warwick's merge gate + independent review).

## Architecture (FINAL — Neo4j-backed, one graph; cut over 2026-07-24)
There is ONE base knowledge graph:

```
Cairn LEARN → faithful-clean FULL-DETAIL source (TubeAIR §7.1) → LightRAG → Neo4JStorage → Neo4j
```

- **LightRAG 1.5.4** (box `:9621`, image `lightrag-neo4j:1.5.4-pinned`) — builds + retrieves the graph;
  its **graph storage backend is Neo4j** (`LIGHTRAG_GRAPH_STORAGE=Neo4JStorage`, workspace `owai_rebuild_v1`).
- **Neo4j 5.26** (box `:7687` bolt) — physically **stores/traverses** that same graph. Cypher works directly on it.
- **TubeAIR / raw source** — immutable source truth; §7.1 (faithful-clean, full-detail, de-duped) is the ingest artefact.
- **Honcho** (api.honcho.dev v3) — Warwick's interest/context **lens** + Context Outbox target.
- **Supabase** (`obsidiwikai.*`, `cairn.*`) — operational + provenance ledger; job/health state; makes the graph rebuildable.

There is **NO** second wholesale `OwaiConcept` copy of the graph — that projection is **parked**
(`src/core/compiler.mjs`, `compile-source.mjs`, `canonicaliser.mjs`, `encyclopedia.mjs`), kept only
as reusable logic (lens relevance, canonicalisation reasoning, deferred reservoir, suggestions) to
rehome onto the one graph / ledgers.

**Intent is two modes only:** `KEEP` = retain without learning · `LEARN` = process + searchable + add to graph.

## Run (all commands need the env files)
```
ENVS="--env-file=C:/.fusion247/lightrag.env --env-file=C:/.fusion247/neo4j.env \
      --env-file=C:/.fusion247/honcho.env --env-file=C:/.fusion247/fusion-capture-gateway.env"

node $ENVS src/bin/apply-schema.mjs         # create/upgrade schema (idempotent)
node $ENVS src/bin/learn-worker.mjs         # DRAIN the Cairn LEARN queue: §7.1 → LightRAG → Neo4j + health reconcile
                                            #   LEARN_POLL_INTERVAL_S=30 to daemonise
node $ENVS src/bin/trace.mjs "a concept"    # source navigation: concept → source → passage → clean/raw transcript
node $ENVS src/bin/ask.mjs "your question"  # grounded retrieval
node $ENVS src/bin/cairn-demo.mjs           # Cairn routing demo
npm test                                    # unit tests
```

The live capture flow is: capture (fcg) → **Cairn** routes intent → LEARN enqueues a durable job →
**learn-worker** ingests the faithful-clean source automatically (no Larry-in-session step).

## Email source adapter (Fusion247 mailbox → Cairn). One-time setup + auth: see EMAIL-SETUP.md
```
node --env-file=C:/.fusion247/msgraph.env $ENVS src/bin/email-authorize.mjs    # one-time device-code auth
node --env-file=C:/.fusion247/msgraph.env $ENVS src/bin/email-baseline.mjs     # skip pre-existing mail, set cursor
node --env-file=C:/.fusion247/msgraph.env $ENVS src/bin/email-poll.mjs         # poll → capture → Cairn
```

## Health check
A source routed LEARN ends up either **searchable + represented in the graph** (`compile_job.state='done'`)
or **visibly failed** (`state='failed'`, with error). `reconcileLearn()` (run by the learn-worker) enforces
this — no silent "captured but never finished" state.

## Operations / rollback
- **Production graph service:** `lightrag-neo4j-prod` (docker, `--restart unless-stopped`) on box `:9621`.
- **Rollback:** the old NetworkX instance `g327xy3z5zv3qzrf75htbkse-213500865202` is **stopped + retained**
  (`docker start` it + stop prod to roll back). Full pre-cutover snapshot:
  `C:\.fusion247\lightrag-backups\rag_storage-20260723-230755.tgz` (sha `668e4dd4…`) + `SNAPSHOT-*.md`.
- **Do not feed both systems.** Neo4JStorage is the only active path.

## Deprecated
- `fusiongptbot.mjs` — rollback-only (superseded by Cairn's Honcho lane + email adapter).
- `compile-source.mjs` / the OwaiConcept projection — parked (see Architecture).
