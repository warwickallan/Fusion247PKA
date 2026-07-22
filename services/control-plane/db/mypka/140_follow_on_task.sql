-- =============================================================================
-- MyPKA cockpit migration 140 — governed follow-on work (BUILD-002 WP3)
--
-- Closing the learning loop safely: when Warwick ACCEPTS a learning candidate, the worker must NOT
-- silently edit protected/governed material. Instead it records a durable, correlated FOLLOW-ON TASK
-- — a tracked work item ("do X, from candidate Y, source Z") that Larry/Warwick action deliberately.
-- Acceptance = a durable decision + a governed to-do, never an automatic mutation of the wiki/memory.
-- One task per accepted candidate (unique), so a re-applied accept never multiplies work. Idempotent;
-- reversible via teardown.sql (cockpit-schema cascade).
-- =============================================================================
create table if not exists cockpit.follow_on_task (
  id                  uuid primary key default gen_random_uuid(),
  origin              text        not null check (origin in ('learning_accept','decision_response')),
  source_candidate_id uuid        references cockpit.learning_candidate (id) on delete no action,
  source_video_id     text,
  correlation_id      text,
  title               text        not null,
  detail              text,
  proposed_target     text,
  status              text        not null default 'open' check (status in ('open','in_progress','done','dropped')),
  created_by          text        not null,
  is_synthetic        boolean     not null default false,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);
-- One follow-on per (candidate, origin): a re-applied accept cannot multiply tasks.
create unique index if not exists cockpit_follow_on_task_candidate_origin_uq
  on cockpit.follow_on_task (source_candidate_id, origin) where source_candidate_id is not null;

comment on table cockpit.follow_on_task is
  'Governed follow-on work (BUILD-002 WP3/WP4). An accepted learning candidate (or an A/B/C decision) '
  'creates a tracked task here — a durable, correlated to-do — instead of silently editing governed '
  'material. Larry/Warwick action it deliberately; the wiki/memory are never auto-mutated by an accept.';

-- Least-privilege grants: cp_worker creates + advances tasks; cp_directus reads + can close from the cockpit.
begin;
do $$ begin
  if exists (select 1 from pg_roles where rolname='cp_directus') and to_regclass('cockpit.follow_on_task') is not null then execute 'revoke all on cockpit.follow_on_task from cp_directus'; end if;
  if exists (select 1 from pg_roles where rolname='cp_worker') and to_regclass('cockpit.follow_on_task') is not null then execute 'revoke all on cockpit.follow_on_task from cp_worker'; end if;
end $$;
grant usage on schema cockpit to cp_directus;
grant select on cockpit.follow_on_task to cp_directus;
grant update (status, updated_at) on cockpit.follow_on_task to cp_directus;
grant usage on schema cockpit to cp_worker;
grant select on cockpit.follow_on_task to cp_worker;
grant insert (origin, source_candidate_id, source_video_id, correlation_id, title, detail, proposed_target, created_by, is_synthetic) on cockpit.follow_on_task to cp_worker;
grant update (status, updated_at) on cockpit.follow_on_task to cp_worker;
commit;
