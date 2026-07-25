-- =============================================================================
-- MyPKA cockpit migration 230 — the TWO universal human contracts (IDEA-016)
--
-- Every Fusion247 module (Brain, Shopping, Builds, later CareerAIr…) projects its human-useful
-- state, via a bounded idempotent PROJECTOR, into exactly two Warwick-facing tables:
--
--   cockpit.attention_item  — something Warwick genuinely needs to DO/decide/review/approve/recover
--   cockpit.output_item     — something Fusion247 has PRODUCED for Warwick (a real result: insight,
--                             report, recommendation, artefact, completed useful outcome)
--
-- Redline (GPT/Warwick): do NOT turn every routine learn/enrich/state-transition into an Output, and
-- do NOT turn every warning-shaped row into Attention. Only genuine results / genuine decisions land
-- here; routine state stays in module detail/read-models. A shared typed `provenance_ref` (+ optional
-- `related_ref`) keeps a "this output needs your decision" journey ONE coherent thing.
--
-- These are READ projections: Directus (cp_directus) SELECTs them; the projector (trusted service role,
-- cross-schema) writes them idempotently by (source_module, source_key). ACTIONS never mutate these —
-- they go through the existing governed intent→worker→receipt queues (learning_command / command_request
-- / decision_card), whose keys are carried in `actions`. Idempotent; reversible via teardown (cockpit cascade).
-- =============================================================================

create table if not exists cockpit.attention_item (
  id             uuid primary key default gen_random_uuid(),
  source_module  text        not null,                 -- 'brain' | 'shopping' | 'builds' | 'careerair' | ...
  source_type    text        not null,                 -- e.g. 'held_canonicalisation' | 'learning_candidate' | 'system_improvement' | 'shopping_alternative' | 'budget_flag'
  source_key      text       not null,                 -- stable per-source id → idempotent upsert
  title          text        not null,
  reason         text,                                 -- plain-English WHY it matters / needs you
  priority       text        not null default 'medium' check (priority in ('high','medium','low')),
  status         text        not null default 'open'   check (status in ('open','resolved','dismissed')),
  actions        jsonb       not null default '[]',    -- [{ "key":"accept", "label":"Accept", "intent":"learning_command", "args":{...} }]
  provenance_ref text        not null,                 -- typed authority ref, e.g. 'obsidiwikai:wp15_canonicalisation:<id>'
  related_ref    text,                                 -- optional cross-link to a related output/attention journey
  detail_route   text,                                 -- cockpit route to drill into, e.g. '/brain/held/<id>'
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  constraint attention_item_source_uq unique (source_module, source_key),
  constraint attention_item_actions_is_array check (jsonb_typeof(actions) = 'array')
);
create index if not exists cockpit_attention_open_idx on cockpit.attention_item (status, priority, updated_at desc);
create index if not exists cockpit_attention_module_idx on cockpit.attention_item (source_module, status);
create index if not exists cockpit_attention_prov_idx on cockpit.attention_item (provenance_ref);

comment on table cockpit.attention_item is
  'IDEA-016 universal ATTENTION contract: one queue of things Warwick genuinely must do/decide/review, '
  'projected idempotently from every module by (source_module, source_key). Read-only to Directus; '
  'actions fire the existing governed intent queues named in `actions`.';

create table if not exists cockpit.output_item (
  id             uuid primary key default gen_random_uuid(),
  source_module  text        not null,                 -- 'brain' | 'careerair' | 'health' | ...
  source_type    text        not null,                 -- e.g. 'so_what' | 'report' | 'recommendation' | 'application_pack'
  source_key      text       not null,
  title          text        not null,
  value          text,                                 -- short value / why it matters to Warwick
  status         text        not null default 'new'    check (status in ('new','seen','archived')),
  produced_at    timestamptz not null default now(),   -- freshness
  evidence_url   text,                                 -- artefact / deeper-evidence link (report, graph, file)
  provenance_ref text        not null,
  related_ref    text,                                 -- e.g. the attention_item this result also needs a decision on
  detail_route   text,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  constraint output_item_source_uq unique (source_module, source_key)
);
create index if not exists cockpit_output_fresh_idx on cockpit.output_item (status, produced_at desc);
create index if not exists cockpit_output_module_idx on cockpit.output_item (source_module, produced_at desc);
create index if not exists cockpit_output_prov_idx on cockpit.output_item (provenance_ref);

comment on table cockpit.output_item is
  'IDEA-016 universal OUTPUT contract: the inbox of genuine Warwick-facing results (insight/report/'
  'recommendation/artefact). NOT routine learn/enrich state. Shares provenance_ref with any related '
  'attention_item so "this output needs your decision" is one journey.';

-- Least-privilege: Directus reads only; the projector writes as the trusted service role (owner).
begin;
do $$ begin
  if exists (select 1 from pg_roles where rolname='cp_directus') then
    execute 'grant usage on schema cockpit to cp_directus';
    execute 'grant select on cockpit.attention_item to cp_directus';
    execute 'grant select on cockpit.output_item to cp_directus';
  end if;
  if exists (select 1 from pg_roles where rolname='cp_worker') then
    execute 'grant usage on schema cockpit to cp_worker';
    execute 'grant select on cockpit.attention_item to cp_worker';
    execute 'grant select on cockpit.output_item to cp_worker';
  end if;
end $$;
commit;
