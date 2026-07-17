-- =============================================================================
-- BUILD-010 WP1 — Reliable Autonomous Governance Loop, delta migration
-- Migration: 0004_wp1_notification_outbox                        (author: silas)
--
-- PROVENANCE — implements a convergence-brief requirement:
--   Requirement: "Telegram notification outbox: durable + retry-safe + deduplicated".
--   Defect it forecloses: the Tower must tell Warwick when a decision is required, a
--            run reaches a terminal outcome, a blocker lands, CI goes red, or a run is
--            READY. If that notification is fired straight at the Telegram API with no
--            durable record, FOUR failure modes follow — the SAME family as the
--            external-write outbox (GPT MEDIUM-1) that 0003 fixed:
--              (1) TELEGRAM-DOWN LOSES THE MESSAGE — a transient bot-API failure or a
--                  process crash between "decide to notify" and "sent" silently drops a
--                  decision request / terminal outcome. Warwick never learns the loop
--                  is waiting on him.
--              (2) RETRY DOUBLE-SENDS — a naive retry (or a redelivered upstream event)
--                  re-posts the same "decision required" twice, training Warwick to
--                  ignore the channel.
--              (3) RESTART LOSES THE GUARD — an in-memory "already notified" set is
--                  emptied by a restart, so the backlog either re-sends or vanishes.
--              (4) "SENT" WITHOUT PROOF — a row is marked sent though no Telegram
--                  message_id ever came back, so a lost send looks delivered.
--   Fix:     a DURABLE Tower notification outbox. A notification is ENQUEUED (durably
--            reserved) idempotently on a per-EVENT dedup key BEFORE any bot send; a
--            drainer claims the pending backlog and sends; a row only reaches `sent`
--            once a real Telegram message_id is recorded; a transient failure stays
--            retriable; a stale duplicate is `superseded`. A temporary Telegram outage
--            can NEVER lose a decision request, terminal outcome, blocker, or READY.
--
-- Source of truth for this shape:
--   Builds/BUILD-010-fusion-tower/Architecture/ (convergence brief §"Telegram
--     notification outbox: durable + retry-safe + deduplicated").
--
-- WHY A NEW MIGRATION (not an edit to 0001/0002/0003):
--   0001, 0002 and 0003 are committed, reviewed, and part of the WP0 proof history —
--   they are IMMUTABLE. This discrete 0004 delta only ADDS a new enum, a new table,
--   and its RLS. Apply order is always 0001 -> 0002 -> 0003 -> 0004 on a clean DB.
--
-- ENUM-VS-TABLE COLLISION LESSON (carried from 0001/0003): a table implicitly creates
-- a composite type of the same name, so NO enum may share a name with any table. This
-- migration adds enum `ftw.notification_state` and table `ftw.notification_outbox`.
-- The names differ by construction — no enum named `notification_outbox`, no table
-- named `notification_state` — so there is no collision.
--
-- Supabase is DURABLE OPERATIONAL STATE, NOT the canonical Brain. Every column here
-- holds a POINTER / metadata (a chat id, a message_id, a message-identity TAG),
-- NEVER a secret and NEVER the governed content itself.
--
-- !! SECURITY GATE (Vex) — DO NOT WEAKEN !!
-- Row-Level Security is ENABLED deny-by-default on the new table. ONLY the
-- server-side `service_role` principal receives a grant + policy;
-- `anon`/`authenticated` get NEITHER, so both the privilege check and RLS refuse
-- them. POINTERS / METADATA ONLY:
--   * `recipient` is the AUTHORISED CHAT ID — a routing pointer, NEVER a bot token.
--   * `logical_source` is the MESSAGE-IDENTITY TAG (TOWER/CODEX/LARRY/CI) — WHO the
--     message speaks AS. It is DELIBERATELY SEPARATE from the Telegram CREDENTIAL
--     OWNER (which lives only in the app's secret config, never in any column here).
--     The two are NEVER conflated: a row records the voice, not the key.
--   * `body` is the composed message TEXT and MUST be secret-free — the app
--     secret-scans it before enqueue, and a DB CHECK
--     (notification_outbox_body_no_token_chk) rejects an embedded bot-token shape as a
--     defence-in-depth backstop. NEVER relax it to allow a token.
--   * `provider_message_id` is the Telegram message_id returned on send — a public id.
-- Do NOT add an anon/authenticated policy, do NOT disable RLS, do NOT store a secret
-- (bot token / API key) in any column, and do NOT weaken the
-- `state='sent' => provider_message_id is not null` invariant nor the dedup_key
-- UNIQUE that makes enqueue idempotent.
-- =============================================================================

-- --------------------------------------------------------------------------
-- Enumerated type: the notification lifecycle. Guarded create so re-applying 0004 on
-- an already-migrated DB is a no-op (`create type` is not natively idempotent).
--   pending     -- enqueued/reserved; NOT yet handed to Telegram
--   sent        -- confirmed delivered: a real Telegram message_id came back
--                --   (provider_message_id set — enforced by a CHECK)
--   failed      -- terminal failure for this row; the drainer gave up
--   superseded  -- intentionally retired: a newer notification replaced this one
--                --   (e.g. a decision request obsoleted by a terminal outcome) so it
--                --   must not be sent
-- NB: `notification_state` is an ENUM; the table is `notification_outbox` — no name
-- collision.
-- --------------------------------------------------------------------------
do $$
begin
  if not exists (
    select 1 from pg_type t
    join pg_namespace n on n.oid = t.typnamespace
    where n.nspname = 'ftw' and t.typname = 'notification_state'
  ) then
    create type ftw.notification_state as enum (
      'pending',
      'sent',
      'failed',
      'superseded'
    );
  end if;
end
$$;

-- --------------------------------------------------------------------------
-- notification_outbox — the DURABLE notification outbox. One row per intended
-- Telegram message. `create table if not exists` makes the migration re-runnable; all
-- named constraints are created inline with the table (a no-op on re-apply because the
-- table already exists).
--
-- IDEMPOTENCY KEY: `dedup_key`. It is the convergence brief's dedup tuple —
-- run_id + event + recipient + purpose — composed by the app. Its UNIQUE constraint is
-- what makes enqueue idempotent: the first INSERT reserves it; every retry/redelivery
-- for the same (run, event, recipient, purpose) collides on the key and is a no-op, so
-- a single logical event never double-notifies the same recipient for the same purpose.
-- --------------------------------------------------------------------------
create table if not exists ftw.notification_outbox (
  notification_id      uuid not null
    constraint notification_outbox_pkey primary key
    default gen_random_uuid(),

  -- THE IDEMPOTENCY KEY (per run_id + event + recipient + purpose). UNIQUE, named.
  dedup_key            text not null
    constraint notification_outbox_dedup_key_key unique,

  -- Provenance link into the control plane. A run delete cascades its outbox rows.
  -- Nullable: some system messages (e.g. a boot/health ping) are not run-scoped.
  run_id               uuid
    constraint notification_outbox_run_id_fkey
    references ftw.governance_run (run_id) on delete cascade,

  -- The AUTHORISED CHAT ID (a routing POINTER). NEVER a bot token / secret.
  recipient            text not null,

  -- MESSAGE-IDENTITY TAG: who the message speaks AS. One of TOWER/CODEX/LARRY/CI.
  -- DELIBERATELY SEPARATE from the Telegram credential owner (which is never stored
  -- here). Explicitly named CHECK constrains the vocabulary.
  logical_source       text not null
    constraint notification_outbox_logical_source_chk
    check (logical_source in ('TOWER', 'CODEX', 'LARRY', 'CI')),

  -- WHY the message is sent (e.g. 'run_created','codex_complete','ci_red',
  -- 'decision_required','terminal_ready',...). Part of the dedup tuple.
  purpose              text not null,

  -- The composed message TEXT. MUST be secret-free (the app secret-scans before
  -- enqueue). The CHECK below is a defence-in-depth backstop, NOT the primary scan.
  body                 text not null,

  -- DB-level backstop: reject an embedded Telegram bot-token shape
  -- (<8+ digits>:<30+ token chars>). Legitimate bodies (times like '12:30', short
  -- ids) do not match. This is a HARD floor under the app's secret scan. DO NOT WEAKEN.
  constraint notification_outbox_body_no_token_chk
    check (body !~ '[0-9]{8,}:[A-Za-z0-9_-]{30,}'),

  state                ftw.notification_state not null default 'pending',

  -- The Telegram message_id once sent. NULL until the send is confirmed.
  provider_message_id  text,

  -- HARD INVARIANT: a row can be `sent` ONLY if it carries a real Telegram
  -- message_id. A "sent" with no provider_message_id can NEVER exist. This closes
  -- failure mode (4) at the DB level. Explicitly named.
  constraint notification_outbox_sent_requires_provider_chk
    check (state <> 'sent' or provider_message_id is not null),

  attempt_count        integer not null default 0
    constraint notification_outbox_attempt_count_nonneg_chk check (attempt_count >= 0),
  last_error           text,

  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now(),
  sent_at              timestamptz
);

comment on constraint notification_outbox_dedup_key_key on ftw.notification_outbox is
  'IDEMPOTENCY KEY: the convergence-brief dedup tuple run_id + event + recipient + '
  'purpose, composed by the app. UNIQUE here is what makes enqueue idempotent — a '
  'retry/redelivery of the same logical event never double-notifies. DO NOT WEAKEN to '
  'a coarser key (that re-introduces double-sends).';

comment on constraint notification_outbox_sent_requires_provider_chk on ftw.notification_outbox is
  'HARD INVARIANT: state=sent REQUIRES provider_message_id is not null. A send with no '
  'Telegram message_id can NEVER be recorded as sent (failure mode 4). DO NOT WEAKEN '
  'or drop without an equal-or-stronger replacement.';

comment on constraint notification_outbox_body_no_token_chk on ftw.notification_outbox is
  'DEFENCE-IN-DEPTH: rejects an embedded Telegram bot-token shape in body. The app '
  'secret-scans before enqueue; this is the DB backstop. DO NOT WEAKEN to allow a '
  'token — this table stores POINTERS/METADATA only, never a secret.';

comment on column ftw.notification_outbox.recipient is
  'The AUTHORISED CHAT ID — a routing pointer. NEVER a bot token or any secret.';

comment on column ftw.notification_outbox.logical_source is
  'MESSAGE-IDENTITY TAG (TOWER/CODEX/LARRY/CI): who the message speaks AS. '
  'DELIBERATELY SEPARATE from the Telegram credential owner, which is NEVER stored in '
  'this table. The voice and the key are never conflated.';

comment on column ftw.notification_outbox.provider_message_id is
  'The Telegram message_id returned on a confirmed send (a public id). Required before '
  'state can be sent (notification_outbox_sent_requires_provider_chk).';

-- Drainer backlog scan: the pending queue, oldest first. Partial index confines it to
-- the small unsent backlog (mirrors the 0003 reconcile index pattern).
create index if not exists notification_outbox_pending_idx
  on ftw.notification_outbox (created_at)
  where state = 'pending';

-- =============================================================================
-- SECURITY GATE (Vex) — RLS. DO NOT WEAKEN.
-- Enable RLS, then grant + policy the server-side `service_role` ONLY.
-- `anon`/`authenticated` get NEITHER a grant NOR a policy, so both the privilege
-- check and RLS refuse them (deny-by-default from both gates). Mirrors 0001/0003
-- exactly, including the concurrency-safe role guard, and is guarded to be re-runnable.
-- =============================================================================

alter table ftw.notification_outbox enable row level security;

-- Roles pre-exist on real Supabase and are created by 0001; created-if-absent here
-- too so 0004 is robust if ever applied against an isolated substrate. Concurrency-
-- safe guard (roles live in cluster-wide pg_authid): the inner exception blocks turn
-- a "someone created it first" race into the intended no-op.
do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then
    begin
      create role anon nologin;
    exception
      when duplicate_object then null;
      when unique_violation then null;
    end;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then
    begin
      create role authenticated nologin;
    exception
      when duplicate_object then null;
      when unique_violation then null;
    end;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'service_role') then
    begin
      create role service_role nologin;
    exception
      when duplicate_object then null;
      when unique_violation then null;
    end;
  end if;
end
$$;

-- Table + sequence privileges: service_role ONLY. anon/authenticated get nothing.
grant usage on schema ftw to service_role;
grant select, insert, update, delete on ftw.notification_outbox to service_role;
grant usage, select on all sequences in schema ftw to service_role;

-- One permissive FOR ALL policy scoped TO service_role. Guarded so re-applying 0004
-- is a no-op (`create policy` is not natively idempotent). Because no policy names
-- anon/authenticated and RLS is enabled, those roles stay denied.
do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'ftw'
      and tablename = 'notification_outbox'
      and policyname = 'service_role_all_notification_outbox'
  ) then
    create policy service_role_all_notification_outbox
      on ftw.notification_outbox
      for all to service_role
      using (true) with check (true);
  end if;
end
$$;

-- (No anon/authenticated policies on purpose — deny-by-default. DO NOT WEAKEN.)
