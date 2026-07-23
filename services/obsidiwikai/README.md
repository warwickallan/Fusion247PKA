# ObsidiWikAi — Knowledge Compiler (IDEA-007)

Turns a captured source into personalised, connected, queryable knowledge in a curated Neo4j
encyclopedia. Built overnight 2026-07-23 against the live cloud engine room. **DEV — not merged.**

## Architecture (settled by live probe)
- **LightRAG** (box `:9621`) — extraction + retrieval engine (the candidate/working layer) **and**
  the LLM path (`/api/generate`) so the OpenAI key stays Coolify-only.
- **Neo4j** (box `:7474`) — the **curated encyclopedia** (`Owai*` labels), canonical layer.
- **Honcho** (api.honcho.dev v3) — the Warwick **lens** (read) + Context Outbox target (write).
- **Supabase** (`obsidiwikai.*`) — canonical operational + provenance ledger; makes the
  encyclopedia rebuildable.

## Run (all commands need the env files)
```
ENVS="--env-file=C:/.fusion247/lightrag.env --env-file=C:/.fusion247/neo4j.env \
      --env-file=C:/.fusion247/honcho.env --env-file=C:/.fusion247/fusion-capture-gateway.env"

node $ENVS src/bin/apply-schema.mjs                 # create schema (idempotent)
node $ENVS src/bin/ingest-source.mjs <id> <textfile># ingest a new source into LightRAG
node $ENVS src/bin/compile-source.mjs <id> "title"  # compile -> encyclopedia + card  (M1)
node $ENVS src/bin/ask.mjs "your question"          # grounded retrieval (WP6)
node $ENVS src/bin/suggest.mjs                       # grounded suggestions (WP5)
node $ENVS src/bin/submit-packet.mjs '{...}'         # enqueue a ChatGPT->Honcho context packet
node $ENVS src/bin/outbox-worker.mjs [--watch]       # deliver packets to Honcho (WP2)
npm test                                             # unit tests
```

## Context Outbox front door (needs the fusiongptbot token)
Drop the token in `C:\.fusion247\fusiongptbot.env` (`FUSIONGPTBOT_TOKEN=...`,
`FUSIONGPTBOT_AUTHORISED_USER_ID=...`) then:
```
node --env-file=C:/.fusion247/fusiongptbot.env $ENVS src/bin/fusiongptbot.mjs   # + outbox-worker --watch
```

## Proven live (overnight)
2 real sources compiled → **71 concepts / 142 relationships**; interest lens ranks by relevance;
one-tap review queue; deferred reservoir; Context Outbox delivers to Honcho (idempotent, privacy-held);
grounded Q&A; grounded suggestions incl. a monetise offer. See `../../ideas/IDEA-007/TRACEABILITY.md`.

## Top follow-ups (morning)
1. `fusiongptbot` token → run the outbox front door.
2. Expose `obsidiwikai` to Directus (add to `DB_SEARCH_PATH` or register collections) so cards are visible.
3. Compounding demo with two topically-overlapping sources.
4. Full-transcript ingestion (currently bounded slice for cost).
5. WP7 work/Bellrock walled lane (deferred by design).
