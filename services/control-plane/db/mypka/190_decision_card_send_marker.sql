-- =============================================================================
-- MyPKA cockpit migration 190 — decision_card durable send-attempt marker (BUILD-002 QA2 point 2)
--
-- Closes the send-before-receipt crash window: a REAL Telegram send (dry_run=false + --allow-send) is
-- an external side effect that can succeed even if the worker crashes before writing its receipt. Without
-- a durable record, a lease-reclaim would re-run and SEND AGAIN (duplicate card). This column is stamped
-- in a COMMITTED statement BEFORE the send; on reclaim, a card that already has send_attempted_at set
-- (but is still 'claimed') is NOT re-sent — it fails closed for manual re-projection. Dry-run sends
-- nothing, so this never applies there. Idempotent; reversed by teardown (cockpit cascade).
-- =============================================================================
alter table cockpit.decision_card add column if not exists send_attempted_at timestamptz;

do $$ begin
  if exists (select 1 from pg_roles where rolname='cp_worker') and to_regclass('cockpit.decision_card') is not null then
    execute 'grant update (send_attempted_at) on cockpit.decision_card to cp_worker';
  end if;
end $$;
