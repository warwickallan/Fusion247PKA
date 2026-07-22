-- =============================================================================
-- MyPKA cockpit migration 150 — inbound A/B/C decision response (BUILD-002 WP4)
--
-- The INBOUND half of the human-tap gate. A decision_card was offered; the human replies (Telegram
-- text or a Directus pick). cp_directus files the raw reply as an intent (card_id + responder +
-- raw_text, status=requested) — it does NOT interpret it. cp_worker claims it, parses the reply
-- against THAT card's own options (never guesses), records the durable, correlated decision, and —
-- on a match — creates governed follow-on work (follow_on_task, origin='decision_response'). A reply
-- that matches no option completes as done+matched=false so the human can simply re-answer; only a
-- genuine error (unknown card) fails. Idempotent; reversible via teardown.sql (cockpit cascade).
-- =============================================================================
create table if not exists cockpit.decision_response (
  id               uuid primary key default gen_random_uuid(),
  card_id          uuid        not null references cockpit.decision_card (id) on delete no action,
  responder        text        not null,
  raw_text         text        not null,
  chosen_key       text,                     -- filled by the worker after parsing (never by cp_directus)
  chosen_label     text,
  status           text        not null default 'requested'
                     check (status in ('requested','claimed','done','failed')),
  idempotency_key  text        not null unique,
  receipt          jsonb,
  is_synthetic     boolean     not null default false,
  requested_at     timestamptz not null default now(),
  claimed_at       timestamptz,
  completed_at     timestamptz
);
create index if not exists cockpit_decision_response_status_idx on cockpit.decision_response (status, requested_at);

comment on table cockpit.decision_response is
  'Inbound A/B/C reply to a decision_card (BUILD-002 WP4). cp_directus files the raw reply (status='
  '''requested''); cp_worker parses it against the card options, records the correlated decision, and '
  'on a match creates governed follow-on work. It never guesses an ambiguous reply.';

create or replace function cockpit.decision_response_insert_guard() returns trigger
language plpgsql as $$
begin
  if new.status is distinct from 'requested' then raise exception 'decision_response insert must be status=requested' using errcode='23514'; end if;
  if new.chosen_key is not null or new.receipt is not null or new.claimed_at is not null or new.completed_at is not null then raise exception 'decision_response insert: no chosen_key/receipt/claim/complete' using errcode='23514'; end if;
  return new;
end $$;
drop trigger if exists decision_response_insert_guard_t on cockpit.decision_response;
create trigger decision_response_insert_guard_t before insert on cockpit.decision_response for each row execute function cockpit.decision_response_insert_guard();

create or replace function cockpit.decision_response_update_guard() returns trigger
language plpgsql as $$
begin
  if new.card_id is distinct from old.card_id or new.responder is distinct from old.responder
     or new.raw_text is distinct from old.raw_text or new.idempotency_key is distinct from old.idempotency_key
     or new.requested_at is distinct from old.requested_at or new.is_synthetic is distinct from old.is_synthetic then
    raise exception 'decision_response core fields are immutable after creation' using errcode='23514';
  end if;
  if old.status in ('done','failed') then raise exception 'a completed decision_response (status=%) is immutable', old.status using errcode='23514'; end if;
  if new.status is distinct from old.status and not ((old.status='requested' and new.status='claimed') or (old.status='claimed' and new.status in ('done','failed'))) then
    raise exception 'invalid decision_response transition % -> %', old.status, new.status using errcode='23514';
  end if;
  return new;
end $$;
drop trigger if exists decision_response_update_guard_t on cockpit.decision_response;
create trigger decision_response_update_guard_t before update on cockpit.decision_response for each row execute function cockpit.decision_response_update_guard();

-- Least-privilege grants: cp_directus files the raw reply; cp_worker parses + applies.
begin;
do $$ begin
  if exists (select 1 from pg_roles where rolname='cp_directus') and to_regclass('cockpit.decision_response') is not null then execute 'revoke all on cockpit.decision_response from cp_directus'; end if;
  if exists (select 1 from pg_roles where rolname='cp_worker') and to_regclass('cockpit.decision_response') is not null then execute 'revoke all on cockpit.decision_response from cp_worker'; end if;
end $$;
grant usage on schema cockpit to cp_directus;
grant select on cockpit.decision_response to cp_directus;
grant insert (card_id, responder, raw_text, idempotency_key) on cockpit.decision_response to cp_directus;
grant usage on schema cockpit to cp_worker;
grant select on cockpit.decision_response to cp_worker;
grant update (chosen_key, chosen_label, status, claimed_at, completed_at, receipt) on cockpit.decision_response to cp_worker;
commit;
