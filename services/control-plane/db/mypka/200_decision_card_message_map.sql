-- =============================================================================
-- MyPKA cockpit migration 200 — durable decision-card message mapping (BUILD-002 QA2 point 3)
--
-- A TYPED Telegram reply (reply_to_message) correlates to its card only via the SENT message id. On a
-- real send the worker records the Telegram (chat_id, message_id) of the card here, so an async resolver
-- can map a reply back to the card. Button taps do NOT need this (callback_data self-correlates); this
-- is only for the typed-reply path. Nullable — populated on a real send (Warwick-gated). Idempotent;
-- reversed by teardown (cockpit cascade).
-- =============================================================================
alter table cockpit.decision_card add column if not exists sent_chat_id text;
alter table cockpit.decision_card add column if not exists sent_message_id bigint;
create index if not exists cockpit_decision_card_sent_msg_idx on cockpit.decision_card (sent_chat_id, sent_message_id) where sent_message_id is not null;

do $$ begin
  if exists (select 1 from pg_roles where rolname='cp_worker') and to_regclass('cockpit.decision_card') is not null then
    execute 'grant update (sent_chat_id, sent_message_id) on cockpit.decision_card to cp_worker';
  end if;
  -- cp_directus reads the map to resolve a reply -> card when filing the inbound response intent.
  if exists (select 1 from pg_roles where rolname='cp_directus') and to_regclass('cockpit.decision_card') is not null then
    execute 'grant select on cockpit.decision_card to cp_directus';
  end if;
end $$;
