-- =============================================================================
-- MyPKA cockpit migration 220 — IDEA-007 governed system-improvement candidates
--
-- Extends the EXISTING BUILD-002 learning_candidate record so ObsidiWikAi can
-- distinguish Warwick-facing opportunities from candidates that propose a
-- governed improvement to Larry / MyPKA / Fusion247 itself. The existing
-- learning_command -> follow_on_task -> command_request/receipt machinery remains
-- authoritative; this migration does not create another task or decision system.
--
-- candidate_ref is the durable, human-friendly lookup key (for example,
-- OWAI:MUN1eAlL0lc:A). Existing null refs remain valid. New system candidates are
-- source-scoped and idempotently upserted by that ref.
-- =============================================================================

alter table cockpit.learning_candidate
  add column if not exists candidate_scope text not null default 'warwick_opportunity',
  add column if not exists candidate_kind text,
  add column if not exists next_step text;

do $$ begin
  if not exists (
    select 1
      from pg_constraint
     where conrelid = 'cockpit.learning_candidate'::regclass
       and conname = 'learning_candidate_scope_check'
  ) then
    alter table cockpit.learning_candidate
      add constraint learning_candidate_scope_check
      check (candidate_scope in ('warwick_opportunity', 'system_improvement'));
  end if;
end $$;

-- Existing BUILD-002 candidate refs may repeat across sources. Only FR-029 system
-- candidates use this deterministic global ref, so uniqueness is scoped to them.
create unique index if not exists cockpit_learning_candidate_ref_uq
  on cockpit.learning_candidate (candidate_ref)
  where candidate_ref is not null and candidate_scope='system_improvement';

comment on column cockpit.learning_candidate.candidate_scope is
  'warwick_opportunity = advice for Warwick; system_improvement = governed candidate for Larry/MyPKA/Fusion247 itself.';
comment on column cockpit.learning_candidate.candidate_kind is
  'Specific system-improvement category, such as cairn_routing, retrieval, workflow, experiment, or foundry_idea.';
comment on column cockpit.learning_candidate.next_step is
  'Concrete first governed investigation or implementation step. Accept never executes it automatically.';

-- Keep the existing trust boundary: Directus/report may request a decision, but
-- only cp_worker may apply candidate state or create correlated follow-on work.
grant select on cockpit.learning_candidate to cp_directus;
grant select on cockpit.learning_candidate to cp_worker;
