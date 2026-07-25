-- WP4 — the compounding loop. A source's INTERPRETATION under the lens at a point in time is
-- stored, so that when Warwick's lens/knowledge changes we can RE-ANALYSE the retained faithful-clean
-- source and surface the DELTA ("since you first learned this…") — not silently replace history.
-- Every re-analysis appends a new row; the previous interpretation + its lens are preserved.
-- Idempotent; safe to re-run.

set search_path to obsidiwikai, public;

create table if not exists obsidiwikai.source_interpretation (
  interp_id     uuid primary key default gen_random_uuid(),
  source_id     text not null,
  lens_version  bigint,                              -- interest_lens version this reflects
  why_matters   text,                                -- grounded "why it matters to Warwick" under this lens
  top_concepts  jsonb not null default '[]'::jsonb,  -- concepts that mattered [{id, srcs}]
  cross_source  jsonb not null default '[]'::jsonb,  -- cross-source concept ids at this time
  concept_count int,
  lens_snapshot jsonb,                               -- the lens (active/emerging/goals/negative) then — so we can show WHAT changed
  delta         text,                                -- plain-English "since you first learned this…" (null on the baseline)
  delta_facets  jsonb,                               -- {newly_relevant:[], new_connections:[], new_suggestions:[], material:bool}
  is_current    boolean not null default true,
  created_at    timestamptz not null default now()
);
create index if not exists source_interp_source_idx on obsidiwikai.source_interpretation(source_id);
create index if not exists source_interp_current_idx on obsidiwikai.source_interpretation(source_id, is_current);
