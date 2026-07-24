-- 0010 — WP1.5: Learn-path lens-conditioning + semantic canonicalisation on the ONE authoritative
-- LightRAG→Neo4j graph. The fresh Honcho lens now genuinely shapes the INITIAL Learn path (which
-- concepts the Brain keeps + how it stays coherent), and near-duplicate entities LightRAG extracted
-- separately are conservatively merged/related IN the one graph — never a second graph.
--
-- Self-contained ledgers (deliberately NO FK to the parked second-graph tables source/
-- candidate_concept/canonical_concept, so WP1.5 does not depend on or resurrect that machinery):
--   wp15_enrich_run       — one enrichment pass over a just-extracted source
--   wp15_entity_relevance — how the lens scored each extracted entity for Warwick-relevance (+deferred)
--   wp15_canonicalisation — what conservative action the pass took on the authoritative graph
create schema if not exists obsidiwikai;

create table if not exists obsidiwikai.wp15_enrich_run (
  run_id       uuid primary key default gen_random_uuid(),
  source_id    text not null,
  lens_version bigint,
  state        text not null default 'enriching',   -- enriching | completed | failed
  stats        jsonb,
  error        text,
  created_at   timestamptz not null default now(),
  finished_at  timestamptz
);

create table if not exists obsidiwikai.wp15_entity_relevance (
  id           uuid primary key default gen_random_uuid(),
  run_id       uuid not null references obsidiwikai.wp15_enrich_run(run_id) on delete cascade,
  source_id    text not null,
  entity_name  text not null,
  entity_type  text,
  relevance    numeric not null,
  why          text,
  emerging     boolean not null default false,       -- valuable but outside Warwick's stated lens
  deferred     boolean not null default false,       -- below relevance floor → reservoir (NOT deleted)
  lens_version bigint,
  created_at   timestamptz not null default now()
);
create index if not exists wp15_relevance_source_idx on obsidiwikai.wp15_entity_relevance(source_id);

create table if not exists obsidiwikai.wp15_canonicalisation (
  id             uuid primary key default gen_random_uuid(),
  run_id         uuid not null references obsidiwikai.wp15_enrich_run(run_id) on delete cascade,
  source_id      text not null,
  entity_name    text not null,
  classification text not null,                       -- SAME_CONCEPT|ALIAS_OF|RELATED_TO|NEW_CONCEPT|UNCERTAIN
  matched_name   text,
  action         text not null,                       -- merged | related | held | kept
  confidence     numeric,
  rationale      text,
  created_at     timestamptz not null default now()
);
create index if not exists wp15_canon_source_idx on obsidiwikai.wp15_canonicalisation(source_id);
create index if not exists wp15_canon_held_idx on obsidiwikai.wp15_canonicalisation(action) where action = 'held';
