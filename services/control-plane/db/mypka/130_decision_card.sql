-- =============================================================================
-- MyPKA cockpit migration 130 — decision→command→output seam (BUILD-002 WP4)
--
-- The hub's outbound arm: a decision that needs Warwick's tap becomes a governed Telegram card.
-- Same trust seam as the contract-approval + learning + asdair write-back: the cockpit (cp_directus)
-- may only INSERT an intent (a card to render + who/where, status=requested, no receipt); a trusted
-- worker (cp_worker) claims it, RENDERS the card, and records a receipt. The worker's default is
-- DRY-RUN — it renders + receipts the exact card that WOULD be sent, but sends nothing. An actual
-- Telegram send requires dry_run=false AND the worker's explicit --allow-send flag, so nothing ever
-- pings a phone as a side-effect of a render. This closes the input→route→knowledge loop with the
-- decision→command→output arm. Idempotent; reversible via teardown.sql (cockpit-schema cascade).
-- =============================================================================
create table if not exists cockpit.decision_card (
  id               uuid primary key default gen_random_uuid(),
  requested_by     text        not null,
  channel          text        not null default 'telegram' check (channel in ('telegram')),
  target           text        not null,                 -- symbolic recipient ref (e.g. 'devbot:warwick'); NEVER a secret/token
  subject          text        not null,
  body_markdown    text        not null,
  options          jsonb       not null,                 -- [{ "key": "A", "label": "..." }, ...] — the human-tap choices
  related_ref      text,                                 -- optional provenance link (e.g. 'learning_candidate:<uuid>', 'build:BUILD-002')
  dry_run          boolean     not null default true,    -- true = render+receipt only, no send (the safe default)
  status           text        not null default 'requested'
                     check (status in ('requested','claimed','done','failed')),
  idempotency_key  text        not null unique,
  receipt          jsonb,
  is_synthetic     boolean     not null default false,
  requested_at     timestamptz not null default now(),
  claimed_at       timestamptz,
  completed_at     timestamptz,
  constraint decision_card_options_is_array check (jsonb_typeof(options) = 'array' and jsonb_array_length(options) >= 1)
);
create index if not exists cockpit_decision_card_status_idx on cockpit.decision_card (status, requested_at);

comment on table cockpit.decision_card is
  'Outbound decision-card INTENT queue (BUILD-002 WP4). cp_directus INSERTs status=requested only; '
  'cp_worker claims it, renders the Telegram card, and writes a receipt. Default dry_run=true renders '
  'without sending; a real send needs dry_run=false AND the worker''s explicit --allow-send flag.';

create or replace function cockpit.decision_card_insert_guard() returns trigger
language plpgsql as $$
begin
  if new.status is distinct from 'requested' then raise exception 'decision_card insert must be status=requested' using errcode='23514'; end if;
  if new.receipt is not null or new.claimed_at is not null or new.completed_at is not null then raise exception 'decision_card insert: no receipt/claim/complete' using errcode='23514'; end if;
  return new;
end $$;
drop trigger if exists decision_card_insert_guard_t on cockpit.decision_card;
create trigger decision_card_insert_guard_t before insert on cockpit.decision_card for each row execute function cockpit.decision_card_insert_guard();

create or replace function cockpit.decision_card_update_guard() returns trigger
language plpgsql as $$
begin
  if new.requested_by is distinct from old.requested_by or new.channel is distinct from old.channel
     or new.target is distinct from old.target or new.subject is distinct from old.subject
     or new.body_markdown is distinct from old.body_markdown or new.options is distinct from old.options
     or new.related_ref is distinct from old.related_ref or new.dry_run is distinct from old.dry_run
     or new.idempotency_key is distinct from old.idempotency_key or new.requested_at is distinct from old.requested_at
     or new.is_synthetic is distinct from old.is_synthetic then
    raise exception 'decision_card core fields are immutable after creation' using errcode='23514';
  end if;
  if old.status in ('done','failed') then raise exception 'a completed decision_card (status=%) is immutable', old.status using errcode='23514'; end if;
  if new.status is distinct from old.status and not ((old.status='requested' and new.status='claimed') or (old.status='claimed' and new.status in ('done','failed'))) then
    raise exception 'invalid decision_card transition % -> %', old.status, new.status using errcode='23514';
  end if;
  return new;
end $$;
drop trigger if exists decision_card_update_guard_t on cockpit.decision_card;
create trigger decision_card_update_guard_t before update on cockpit.decision_card for each row execute function cockpit.decision_card_update_guard();

-- Least-privilege grants: cp_directus request-only; cp_worker execute-only.
begin;
do $$ begin
  if exists (select 1 from pg_roles where rolname='cp_directus') and to_regclass('cockpit.decision_card') is not null then execute 'revoke all on cockpit.decision_card from cp_directus'; end if;
  if exists (select 1 from pg_roles where rolname='cp_worker') and to_regclass('cockpit.decision_card') is not null then execute 'revoke all on cockpit.decision_card from cp_worker'; end if;
end $$;
grant usage on schema cockpit to cp_directus;
grant select on cockpit.decision_card to cp_directus;
grant insert (requested_by, channel, target, subject, body_markdown, options, related_ref, dry_run, idempotency_key) on cockpit.decision_card to cp_directus;
grant usage on schema cockpit to cp_worker;
grant select on cockpit.decision_card to cp_worker;
grant update (status, claimed_at, completed_at, receipt) on cockpit.decision_card to cp_worker;
commit;
