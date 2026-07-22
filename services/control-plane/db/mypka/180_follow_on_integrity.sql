-- =============================================================================
-- MyPKA cockpit migration 180 — follow_on_task integrity + boundary restore (BUILD-002 QA2)
--
-- Two adversarial-review corrections:
--   (A) CONCURRENCY: a partial unique index on (correlation_id, origin) for decision_response tasks, so
--       two response intents for the SAME card processed on two connections can NEVER both insert a task
--       (the worker uses INSERT ... ON CONFLICT DO NOTHING). Migration 140 already covers learning tasks
--       via (source_candidate_id, origin); this adds the decision-origin case (source_candidate_id NULL).
--   (4) BOUNDARY: REVOKE cp_directus's direct UPDATE on follow_on_task. Closing a follow-on must go
--       through the intent->worker->receipt seam (command_request 'close_follow_on'), never a direct,
--       unreceipted table write from Directus. cp_directus keeps SELECT only.
-- Idempotent; reversed by teardown.sql (cockpit-schema cascade).
-- =============================================================================
create unique index if not exists cockpit_follow_on_task_decision_correlation_uq
  on cockpit.follow_on_task (correlation_id, origin)
  where origin = 'decision_response' and correlation_id is not null;

-- Boundary restore: cp_directus may READ follow_on_task but NOT mutate it directly (use command_request).
do $$ begin
  if exists (select 1 from pg_roles where rolname='cp_directus') and to_regclass('cockpit.follow_on_task') is not null then
    execute 'revoke update on cockpit.follow_on_task from cp_directus';
  end if;
end $$;
