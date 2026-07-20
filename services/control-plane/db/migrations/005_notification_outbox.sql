-- =============================================================================
-- BUILD-014 PR-3a — Telegram notification OUTBOX (schema only)      (author: silas)
-- Migration: 005_notification_outbox
--
-- WHY THIS EXISTS  (v3 correction #5 — Telegram delivery)
--   Warwick must be pinged for the things that matter (a decision he owns, a merge
--   landing, a real high-crit finding) and NEVER spammed for the routine (ordinary
--   commits, intermediate reviews, CI progress). The correct home for that is NOT a
--   second news store — it is a DURABLE PROJECTION of the already-authoritative
--   ops.agent_event stream. This migration builds that projection + its delivery
--   state machine. The actual Telegram SENDER (the HTTP delivery worker that holds the
--   bot token + chat-id and performs the network call) is a SEPARATE follow-on
--   (PR-3b) and is deliberately NOT built here.
--
--   THE GUARANTEE THIS SCHEMA MAKES (structurally, not by convention):
--     · AT-MOST-ONCE per (source_event, destination, class): one agent_event yields
--       <=1 notification per destination/class. A redelivery / re-projection (e.g.
--       after a notifier restart) COLLIDES on a UNIQUE key and is read back, never
--       duplicated. This is the "no dup spam after restart" guarantee.
--     · SILENT is UNSENDABLE. A SILENT-classified event is projected into a terminal
--       'suppressed' row that can NEVER enter 'sending'/'sent' — enforced by a
--       biconditional CHECK (class='SILENT') = (state='suppressed'), so it is
--       impossible to REPRESENT a SILENT row that is queued/sending/sent.
--     · BOUNDED retry + dead-letter, mirroring ops.job: attempts <= max_attempts
--       (CHECK), dead_letter only once the budget is exhausted, next_attempt_at
--       backoff, a guarded state machine (queued->sending->sent | sending->failed->
--       queued/dead_letter).
--     · LEAST-PRIVILEGE NOTIFIER (the 5th boundary): the notifier can SELECT/claim
--       outbox rows and UPDATE ONLY the delivery-state columns (state / attempts /
--       next_attempt_at / sent_at / last_error_code). Everything else — the source
--       binding, class, destination, headline, message, deep-links — is FROZEN by a
--       default-deny guard trigger, and the notifier holds NO grant on any contract /
--       finding / verdict / gate table. (The DB-ROLE GRANT WIRING is applied+tested in
--       PR-4; the intended grants + the structural guard are encoded here.)
--
--   NO SECRETS IN THIS LAYER. There is no Telegram token / chat-id column anywhere.
--   `destination` is a LOGICAL channel label (e.g. 'warwick_primary'), never a chat-id.
--   The outbox holds only pointers + a sanitised headline/message + deep-link URLs. The
--   sender (PR-3b) resolves the logical destination to real credentials OUTSIDE any
--   reviewer process.
--
-- INFORMED BY (read, not copied) — the house patterns this mirrors:
--   001_control_plane_min_schema.sql
--     · ops.job                     — attempts<=max CHECK, dead_letter-requires-exhausted,
--                                      claim via FOR UPDATE SKIP LOCKED, dead-letter parking.
--     · ops.agent_event             — the immutable, append-only SOURCE this projects from.
--     · ops.merge_gate guard        — the DEFAULT-DENY, catalog-driven, generated-col-aware
--                                      column-freeze guard (R5-1) this delivery-state guard mirrors.
--     · SECURITY GATE               — RLS enable+FORCE deny-by-default; service_role policy;
--                                      TRUNCATE guard; revoke EXECUTE from public first.
--     · ops.touch_updated_at / ops.reject_truncate — shared helpers reused verbatim.
--
-- !! DESIGN ARTIFACT — DEV SCHEMA ONLY. DO NOT APPLY TO ANY LIVE/HOSTED DB. Additive to
--    the immutable, already-merged 001 (+002); it does NOT modify them. Idempotent /
--    re-runnable (enums guarded by DO-blocks, `if not exists` throughout) so it can be
--    applied repeatedly against a throwaway dev substrate for verification. Target schema
--    `ops`; never touches `asdair` or any personal/entrusted data. NO real Telegram
--    credentials anywhere in this layer. !!
--
-- ENUM-VS-TABLE COLLISION LESSON (carried from 001): a table implicitly creates a
--   composite type of the same name, so no enum shares a name with any table. New table:
--   notification_outbox. New enums: notification_class, notification_state. No overlap
--   with any 001/002 name.
-- =============================================================================

-- --------------------------------------------------------------------------
-- Enumerated types (closed vocabularies). DO-block guarded for idempotency.
-- --------------------------------------------------------------------------

-- [phase0] Notification CLASS — the routing decision derived from an agent_event.
--   ACTION_NEEDED — Warwick must act: a decision he owns, a merge-live gate, a
--                   Warwick-only blocker, a material scope/privacy/cost/outcome change,
--                   or autonomous work stopped pending his authority.
--   MILESTONE     — a meaningful thing HAPPENED: a WP built, final QA clean, a real
--                   high-crit finding, a merge landed, a live activate/recover/rollback,
--                   a build completed/parked.
--   SILENT        — routine noise that must NEVER ping: ordinary commits, intermediate
--                   reviews, ordinary fixes, CI progress, handoffs, ledger churn.
do $$ begin
  create type ops.notification_class as enum (
    'ACTION_NEEDED',
    'MILESTONE',
    'SILENT'
  );
exception when duplicate_object then null; end $$;

-- [phase0] Delivery STATE machine.
--   queued      — projected, awaiting the sender (next_attempt_at gates when).
--   sending     — claimed by the notifier; a send attempt is in flight.
--   sent        — terminal: delivered (sent_at set).
--   failed      — an attempt failed; awaiting a retry decision.
--   dead_letter — terminal: retry budget exhausted; parked for a human.
--   suppressed  — terminal: a SILENT row that must NEVER be sent (the ONLY state a
--                 SILENT row may ever hold, per the biconditional CHECK below).
do $$ begin
  create type ops.notification_state as enum (
    'queued',
    'sending',
    'sent',
    'failed',
    'dead_letter',
    'suppressed'
  );
exception when duplicate_object then null; end $$;

-- --------------------------------------------------------------------------
-- ops.notification_outbox — the durable PROJECTION of ops.agent_event.
--
-- This is NOT a second news store: every row is DERIVED from exactly one immutable
-- agent_event (source_event_id FK, ON DELETE NO ACTION => append-only source binding,
-- an event with outbox rows is undeletable). The projection carries only sanitised,
-- link-bearing metadata — never governed content, never a secret.
-- --------------------------------------------------------------------------
create table if not exists ops.notification_outbox (
  id             uuid not null
    constraint notification_outbox_pkey primary key default gen_random_uuid(),

  -- [phase0] APPEND-ONLY SOURCE BINDING: this notification is a projection of exactly
  -- one immutable agent_event. NO ACTION (not CASCADE): deleting an event that has
  -- projected notifications is an honest 23503, never a silent cascade. (agent_event is
  -- itself append-only in 001, so this is belt-and-braces.)
  source_event_id uuid not null
    constraint notification_outbox_event_fkey
      references ops.agent_event (id) on delete no action,

  notification_class ops.notification_class not null,           -- [phase0] the routing decision

  -- [phase0] LOGICAL destination channel (e.g. 'warwick_primary'). NOT a chat-id, NOT a
  -- secret — the sender (PR-3b) resolves this label to real credentials outside any
  -- reviewer process.
  destination    text not null
    constraint notification_outbox_destination_nonempty_chk check (length(btrim(destination)) > 0),

  -- [phase0] AT-MOST-ONCE KEY. DERIVED from exactly the three fields that define
  -- notification identity, so it cannot be forged to bypass dedup: a BEFORE INSERT trigger
  -- (ops.notification_outbox_set_dedup_key) OVERWRITES any caller-supplied value with the
  -- canonical derivation. (It is computed by a trigger rather than a GENERATED column
  -- because the enum->text cast is only STABLE, not IMMUTABLE, which a generated-column
  -- expression forbids.) Its UNIQUE constraint + the composite unique below both enforce
  -- the SAME guarantee (defense in depth): one event -> <=1 notification per
  -- destination/class. A re-projection collides here and is read back (ON CONFLICT DO
  -- NOTHING in ops.project_event_to_outbox).
  dedup_key      text
    constraint notification_outbox_dedup_key_key unique,

  -- [phase0] SANITISED presentation. headline/message are safe-to-display strings the
  -- projector composed from event metadata — never governed content, never a secret.
  headline       text not null,
  message        text not null,
  -- [phase0] DEEP LINKS (pointers only): Directus cockpit + GitHub. Nullable — not every
  -- event has both.
  cockpit_url    text,
  github_url     text,

  state          ops.notification_state not null default 'queued', -- [phase0]

  -- [phase0] BOUNDED RETRY (mirrors ops.job). attempts increments once per send attempt
  -- (at claim time). It can NEVER exceed the budget, and dead_letter is only reachable
  -- once the budget is exhausted.
  attempts       integer not null default 0
    constraint notification_outbox_attempts_nonneg_chk check (attempts >= 0),
  max_attempts   integer not null default 5
    constraint notification_outbox_max_attempts_positive_chk check (max_attempts >= 1),
  constraint notification_outbox_attempts_within_budget_chk check (attempts <= max_attempts),
  constraint notification_outbox_dead_letter_requires_exhausted_chk
    check (state <> 'dead_letter' or attempts >= max_attempts),

  next_attempt_at timestamptz,                                  -- [phase0] backoff gate (when queued)
  sent_at        timestamptz,                                   -- [phase0] set iff state='sent'
  last_error_code text,                                         -- [phase0] sanitised failure code

  created_at     timestamptz not null default now(),           -- [phase0]
  updated_at     timestamptz not null default now(),           -- [phase0]

  -- HARD INVARIANT: a SILENT notification is UNSENDABLE. class='SILENT' IFF state=
  -- 'suppressed'. So a SILENT row can only ever be 'suppressed' (it can never be queued/
  -- sending/sent), and only a SILENT row may be 'suppressed'. This makes "SILENT was
  -- sent" impossible to REPRESENT, not merely impossible to compute.
  constraint notification_outbox_silent_is_suppressed_chk
    check ((notification_class = 'SILENT') = (state = 'suppressed')),

  -- HARD INVARIANT: sent_at is set IFF the row is terminally 'sent'. A non-sent row
  -- never carries a sent_at; a sent row always does.
  constraint notification_outbox_sent_at_consistency_chk
    check ((state = 'sent') = (sent_at is not null)),

  -- AT-MOST-ONCE (structural): one event -> <=1 notification per destination/class. This
  -- is the ON CONFLICT target for the idempotent projection function.
  constraint notification_outbox_event_dest_class_key
    unique (source_event_id, destination, notification_class)
);

-- [phase0] Ready-scan: the sender pulls due, queued rows for a destination (FIFO by id
-- within the due window). Partial-index-confined to the queued state.
create index if not exists notification_outbox_ready_idx
  on ops.notification_outbox (destination, next_attempt_at, id)
  where state = 'queued';

comment on constraint notification_outbox_silent_is_suppressed_chk on ops.notification_outbox is
  'A SILENT notification is UNSENDABLE: class=SILENT IFF state=suppressed. A SILENT row can '
  'never be queued/sending/sent, and only a SILENT row may be suppressed. DO NOT WEAKEN — this '
  'is the structural "SILENT never pings" guarantee.';
comment on constraint notification_outbox_dead_letter_requires_exhausted_chk on ops.notification_outbox is
  'dead_letter is reachable ONLY once the retry budget is exhausted (attempts >= max_attempts). '
  'Mirrors ops.job. DO NOT WEAKEN — keeps the dead-letter park a genuine terminal, not a bypass.';
comment on column ops.notification_outbox.destination is
  'LOGICAL channel label (e.g. warwick_primary) — NEVER a Telegram chat-id or secret. The sender '
  '(PR-3b) resolves this to real credentials outside any reviewer process.';

-- DERIVE dedup_key deterministically at INSERT (non-forgeable): OVERWRITE any caller
-- value with source_event_id | destination | class. This is the at-most-once identity, so
-- it must be the canonical derivation regardless of what an inserter supplied. (A trigger,
-- not a GENERATED column, because the enum->text cast is only STABLE.)
create or replace function ops.notification_outbox_set_dedup_key()
returns trigger
language plpgsql
set search_path = ops, pg_catalog
as $$
begin
  new.dedup_key := new.source_event_id::text || '|' || new.destination || '|' || (new.notification_class::text);
  return new;
end;
$$;

drop trigger if exists notification_outbox_set_dedup_key on ops.notification_outbox;
create trigger notification_outbox_set_dedup_key
  before insert on ops.notification_outbox
  for each row execute function ops.notification_outbox_set_dedup_key();

-- --------------------------------------------------------------------------
-- CLASSIFIER — derive the notification_class from an agent_event.
--
-- RULES (v3 correction #5):
--   · Warwick-needed is ALWAYS ACTION_NEEDED   (highest precedence).
--   · Merge (landed) is ALWAYS MILESTONE.
--   · Routine commits / intermediate reviews / ordinary fixes / CI progress / handoffs /
--     ledger churn are SILENT.
--   · The SAFE DEFAULT for an unrecognised event_kind is SILENT — an unknown event must
--     never spam Warwick. Escalation to ACTION_NEEDED/MILESTONE is by explicit rule only.
--
-- Two authoritative payload flags make the two "always" rules crisp and forgery-free at
-- the projection boundary (a caller can only RAISE the signal, never invent a class):
--   payload->>'warwick_needed' = 'true'  -> ACTION_NEEDED
--   payload->>'merge_landed'   = 'true'  -> MILESTONE
-- event_kind sets provide the same routing for events that don't carry a flag.
--
-- IMMUTABLE + search_path pinned (function-hijack fence, like every ops function).
-- --------------------------------------------------------------------------
create or replace function ops.classify_notification_class(p_event_kind text, p_payload jsonb)
returns ops.notification_class
language plpgsql
immutable
set search_path = ops, pg_catalog
as $$
declare
  k text := coalesce(p_event_kind, '');
  -- Warwick-needed event kinds: a decision he owns, a merge-live gate, a Warwick-only
  -- blocker, a material scope/privacy/cost/outcome change, autonomous work stopped.
  action_needed_kinds constant text[] := array[
    'warwick.decision_needed', 'warwick.blocker', 'merge.live_gate',
    'scope.material_change', 'autonomy.stopped'];
  -- Milestone event kinds: a WP built, final QA clean, a real high-crit finding, a merge
  -- landed, a live activate/recover/rollback, a build completed/parked.
  milestone_kinds constant text[] := array[
    'wp.built', 'qa.final_clean', 'finding.high_crit', 'merge.landed',
    'live.activated', 'live.recovered', 'live.rolled_back',
    'build.complete', 'build.parked'];
begin
  -- (1) Warwick-needed ALWAYS wins — flag, explicit kind, or any 'warwick.*' event.
  if coalesce(p_payload ->> 'warwick_needed', '') = 'true'
     or k = any(action_needed_kinds)
     or k like 'warwick.%' then
    return 'ACTION_NEEDED';
  end if;
  -- (2) Merge landed is ALWAYS a MILESTONE — flag, the explicit kind, or any other
  -- 'merge.*' event (the merge-live GATE is already caught as ACTION_NEEDED in (1)).
  if coalesce(p_payload ->> 'merge_landed', '') = 'true'
     or k = 'merge.landed'
     or k like 'merge.%' then
    return 'MILESTONE';
  end if;
  -- (3) Other recognised milestones.
  if k = any(milestone_kinds) then
    return 'MILESTONE';
  end if;
  -- (4) SAFE DEFAULT: everything else (routine + unknown) is SILENT.
  return 'SILENT';
end;
$$;

-- --------------------------------------------------------------------------
-- ops.project_event_to_outbox — the IDEMPOTENT projection.
--
-- Derives an outbox row from ONE agent_event for ONE destination, assigning the class
-- via ops.classify_notification_class. SILENT rows are born terminal ('suppressed');
-- every other class is born 'queued' with next_attempt_at = now() (send-ready).
--
-- IDEMPOTENT: INSERT ... ON CONFLICT (source_event_id, destination, notification_class)
-- DO NOTHING. Re-projecting the SAME event for the SAME destination inserts NOTHING new
-- and returns the pre-existing row — the restart / no-dup-spam guarantee. RAISES if the
-- source event does not exist (fail-closed).
--
-- headline/message/urls are composed from SANITISED event metadata only (payload holds
-- pointers/sanitised text per 001; there is no governed content or secret to leak here).
-- --------------------------------------------------------------------------
create or replace function ops.project_event_to_outbox(p_event_id uuid, p_destination text default 'warwick_primary')
returns ops.notification_outbox
language plpgsql
set search_path = ops, pg_catalog
as $$
declare
  e            ops.agent_event;
  v_class      ops.notification_class;
  v_state      ops.notification_state;
  v_next       timestamptz;
  v_headline   text;
  v_message    text;
  v_row        ops.notification_outbox;
begin
  if p_destination is null or length(btrim(p_destination)) = 0 then
    raise exception 'project_event_to_outbox: destination is required (a logical channel label)'
      using errcode = 'check_violation';
  end if;

  select * into e from ops.agent_event where id = p_event_id;
  if not found then
    raise exception 'project_event_to_outbox: agent_event % does not exist — cannot project a non-existent event', p_event_id
      using errcode = 'foreign_key_violation';
  end if;

  v_class := ops.classify_notification_class(e.event_kind, e.payload);
  -- SILENT is born terminal 'suppressed' (never sendable); all else born send-ready.
  if v_class = 'SILENT' then
    v_state := 'suppressed';
    v_next  := null;
  else
    v_state := 'queued';
    v_next  := now();
  end if;

  -- SANITISED presentation from event metadata. payload carries pointers/sanitised text
  -- only (001 invariant), so these are safe to display; fall back to the event kind.
  v_headline := coalesce(nullif(btrim(coalesce(e.payload ->> 'headline', '')), ''), e.event_kind);
  v_message  := coalesce(nullif(btrim(coalesce(e.payload ->> 'message', '')), ''),
                         'Event ' || e.event_kind
                           || coalesce(' for build ' || e.build_id::text, ''));

  insert into ops.notification_outbox (
    source_event_id, notification_class, destination,
    headline, message, cockpit_url, github_url,
    state, next_attempt_at)
  values (
    p_event_id, v_class, p_destination,
    v_headline, v_message, e.payload ->> 'cockpit_url', e.payload ->> 'github_url',
    v_state, v_next)
  on conflict (source_event_id, destination, notification_class) do nothing
  returning * into v_row;

  -- ON CONFLICT DO NOTHING returns no row when the projection already existed: read it
  -- back so the projection is convergent (same event -> same row, never a duplicate).
  if v_row.id is null then
    select * into v_row from ops.notification_outbox
     where source_event_id = p_event_id
       and destination = p_destination
       and notification_class = v_class;
  end if;

  return v_row;
end;
$$;

-- --------------------------------------------------------------------------
-- DELIVERY-STATE GUARD — the STRUCTURAL half of the least-privilege NOTIFIER boundary.
--
-- DEFAULT-DENY (mirrors ops.merge_gate_guard_mutation R5-1): on UPDATE, EVERY column is
-- frozen by default; ONLY the delivery-state allow-list may change. So even if a future
-- grant were too broad, the notifier still cannot rewrite the source binding, class,
-- destination, headline, message or deep-links — it can ONLY drive delivery. Generated
-- columns (dedup_key) are enumerated from the catalog and skipped. DELETE is rejected
-- (the outbox is an audit projection; rows are superseded by state, never deleted).
--
-- It ALSO enforces the state-machine transition graph and monotonic attempts, so the
-- delivery lifecycle cannot be driven into an illegal state even by a legitimate notifier.
-- --------------------------------------------------------------------------
create or replace function ops.notification_outbox_guard_mutation()
returns trigger
language plpgsql
set search_path = ops, pg_catalog
as $$
declare
  -- The ONLY columns an UPDATE may change. Everything else (and any FUTURE column) is
  -- frozen by default -> restrict_violation (23001).
  allow_delivery constant text[] := array[
    'state', 'attempts', 'next_attempt_at', 'sent_at', 'last_error_code', 'updated_at'];
  generated_cols text[];
  old_j jsonb;
  new_j jsonb;
  col text;
begin
  if tg_op = 'DELETE' then
    raise exception 'ops.notification_outbox is an append-only audit projection: DELETE is rejected (drive delivery state, never delete)'
      using errcode = 'restrict_violation';
  end if;

  -- Skip generated columns (dedup_key): NEW carries no user value for them in a BEFORE
  -- trigger, and they derive from base columns (which ARE frozen). Read from the catalog
  -- so a FUTURE generated column is auto-skipped too.
  select coalesce(array_agg(attname), array[]::text[]) into generated_cols
    from pg_attribute
   where attrelid = tg_relid and attgenerated <> '' and not attisdropped;
  old_j := to_jsonb(old);
  new_j := to_jsonb(new);

  -- DEFAULT-DENY: any base column that actually changed and is NOT a delivery column is a
  -- restrict_violation. is-distinct-from is null-safe.
  for col in select jsonb_object_keys(new_j) loop
    if col = any(generated_cols) then
      continue;
    end if;
    if (new_j -> col) is distinct from (old_j -> col) then
      if col = any(allow_delivery) then
        continue;
      end if;
      raise exception 'ops.notification_outbox: column "%" is immutable (default-deny) — the notifier may only update delivery state (state / attempts / next_attempt_at / sent_at / last_error_code)', col
        using errcode = 'restrict_violation';
    end if;
  end loop;

  -- attempts is MONOTONIC non-decreasing: a notifier can never reset the counter to dodge
  -- the retry budget.
  if new.attempts < old.attempts then
    raise exception 'ops.notification_outbox: attempts is monotonic (attempted % -> %) — the retry budget cannot be reset', old.attempts, new.attempts
      using errcode = 'restrict_violation';
  end if;

  -- STATE-MACHINE transition graph. A no-op (state unchanged) is always allowed (e.g.
  -- rescheduling next_attempt_at while queued). suppressed is terminal + SILENT-only (the
  -- biconditional CHECK already forbids it as a source/target for a non-SILENT row), so it
  -- never appears in a legal transition here.
  if new.state is distinct from old.state then
    if not (
         (old.state = 'queued'  and new.state = 'sending')
      or (old.state = 'queued'  and new.state = 'dead_letter')   -- claim-time park of an exhausted queued row
      or (old.state = 'sending' and new.state = 'sent')
      or (old.state = 'sending' and new.state = 'failed')
      or (old.state = 'failed'  and new.state = 'queued')        -- schedule a retry
      or (old.state = 'failed'  and new.state = 'dead_letter')   -- budget exhausted
    ) then
      raise exception 'ops.notification_outbox: illegal delivery-state transition % -> % (sent/dead_letter/suppressed are terminal; SILENT never enters sending/sent)', old.state, new.state
        using errcode = 'restrict_violation';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists notification_outbox_immutable_guard on ops.notification_outbox;
create trigger notification_outbox_immutable_guard
  before update or delete on ops.notification_outbox
  for each row execute function ops.notification_outbox_guard_mutation();

-- Keep updated_at honest (shared toucher from 001).
drop trigger if exists notification_outbox_touch_updated_at on ops.notification_outbox;
create trigger notification_outbox_touch_updated_at before update on ops.notification_outbox
  for each row execute function ops.touch_updated_at();

-- TRUNCATE bypasses row triggers — guard it like the other evidence/projection tables.
drop trigger if exists notification_outbox_no_truncate on ops.notification_outbox;
create trigger notification_outbox_no_truncate
  before truncate on ops.notification_outbox
  for each statement execute function ops.reject_truncate();

-- --------------------------------------------------------------------------
-- DELIVERY HELPERS — the transactional state-machine operations the notifier calls.
-- These are the "SELECT/claim + UPDATE delivery state" surface the least-privilege
-- notifier is granted (and NOTHING else). All pin search_path and touch ONLY delivery
-- columns (so they pass the guard above).
-- --------------------------------------------------------------------------

-- CLAIM the next due, queued notification for a destination and mark it 'sending'.
-- Mirrors ops.claim_job: FOR UPDATE SKIP LOCKED so concurrent notifiers grab DISTINCT
-- rows; each claim counts as one attempt (incremented here); an already-exhausted queued
-- row (attempts >= max, only reachable via out-of-band edits) is parked into dead_letter
-- rather than (re)sent. Only rows whose next_attempt_at is due (<= now, or null) are
-- eligible. Returns the claimed row, or NULL when nothing is due.
create or replace function ops.claim_notification(p_destination text)
returns ops.notification_outbox
language plpgsql
set search_path = ops, pg_catalog
as $$
declare n ops.notification_outbox;
begin
  -- Park any pending-but-exhausted row so it is never (re)claimed.
  update ops.notification_outbox
     set state = 'dead_letter'::ops.notification_state
   where destination = p_destination
     and state = 'queued'
     and attempts >= max_attempts;

  select * into n
    from ops.notification_outbox
   where destination = p_destination
     and state = 'queued'
     and attempts < max_attempts
     and (next_attempt_at is null or next_attempt_at <= now())
   order by next_attempt_at nulls first, id
   for update skip locked
   limit 1;
  if not found then
    return null;
  end if;

  update ops.notification_outbox
     set state    = 'sending'::ops.notification_state,
         attempts = attempts + 1
   where id = n.id
   returning * into n;
  return n;
end;
$$;

-- MARK a claimed ('sending') notification delivered. sending -> sent (terminal), sent_at
-- set. RAISES if the row is not currently 'sending' (a stale/duplicate completion cannot
-- clobber a row that has moved on).
create or replace function ops.mark_notification_sent(p_id uuid)
returns ops.notification_outbox
language plpgsql
set search_path = ops, pg_catalog
as $$
declare n ops.notification_outbox;
begin
  update ops.notification_outbox
     set state   = 'sent'::ops.notification_state,
         sent_at = now()
   where id = p_id and state = 'sending'
   returning * into n;
  if not found then
    raise exception 'mark_notification_sent: notification % is not in state=sending (stale or duplicate completion)', p_id
      using errcode = 'restrict_violation';
  end if;
  return n;
end;
$$;

-- MARK a claimed ('sending') notification as failed and decide its next step (mirrors the
-- ops.job retry/dead-letter semantics). sending -> failed, then: if the retry budget is
-- exhausted (attempts >= max_attempts) -> dead_letter; else -> queued with a backoff
-- next_attempt_at. All within one transaction (both transitions pass the guard). RAISES if
-- the row is not 'sending'.
create or replace function ops.mark_notification_failed(p_id uuid, p_error_code text, p_backoff_seconds integer default 60)
returns ops.notification_outbox
language plpgsql
set search_path = ops, pg_catalog
as $$
declare n ops.notification_outbox;
begin
  if p_backoff_seconds < 0 then
    raise exception 'mark_notification_failed: backoff seconds must be >= 0' using errcode = 'check_violation';
  end if;

  -- sending -> failed (records the error).
  update ops.notification_outbox
     set state = 'failed'::ops.notification_state,
         last_error_code = p_error_code
   where id = p_id and state = 'sending'
   returning * into n;
  if not found then
    raise exception 'mark_notification_failed: notification % is not in state=sending (stale or duplicate completion)', p_id
      using errcode = 'restrict_violation';
  end if;

  -- failed -> dead_letter (budget exhausted) | queued (retry with backoff).
  if n.attempts >= n.max_attempts then
    update ops.notification_outbox
       set state = 'dead_letter'::ops.notification_state
     where id = p_id
     returning * into n;
  else
    update ops.notification_outbox
       set state = 'queued'::ops.notification_state,
           next_attempt_at = now() + make_interval(secs => p_backoff_seconds)
     where id = p_id
     returning * into n;
  end if;
  return n;
end;
$$;

-- =============================================================================
-- SECURITY GATE — RLS deny-by-default, FORCED (matches 001). DO NOT WEAKEN.
--
-- Two roles get access to the outbox, each least-privilege:
--   · service_role — the PROJECTOR + orchestrator: full DML (INSERT projections, read,
--     and drive delivery). This is the runtime that also owns agent_event.
--   · notifier     — the 5th least-privilege boundary (STRUCTURAL DEFINITION here; the
--     full DB-role wiring is applied+tested in PR-4). It gets SELECT + COLUMN-LEVEL
--     UPDATE on ONLY the delivery-state columns, plus EXECUTE on the claim/mark helpers.
--     It gets NO grant on any other ops table, so it CANNOT alter contracts / findings /
--     verdicts / gates / heads. The guard trigger is the second, defense-in-depth wall.
--
-- anon/authenticated get NEITHER a grant NOR a policy (deny-by-default).
-- =============================================================================

alter table ops.notification_outbox enable row level security;
alter table ops.notification_outbox force  row level security;

-- Roles pre-exist on real Supabase; created-if-absent for an isolated dev substrate
-- (concurrency-safe, mirrors 001). 'notifier' is the new 5th least-privilege principal.
do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'service_role') then
    begin create role service_role nologin; exception when duplicate_object then null; when unique_violation then null; end;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'notifier') then
    begin create role notifier nologin; exception when duplicate_object then null; when unique_violation then null; end;
  end if;
end
$$;

grant usage on schema ops to notifier;

-- service_role: full DML on the outbox (projector + orchestrator). No DELETE (the guard
-- rejects it anyway; the outbox is an append-only audit projection).
grant select, insert, update on ops.notification_outbox to service_role;

-- notifier: SELECT (to claim) + COLUMN-LEVEL UPDATE on ONLY the delivery-state columns.
-- This is the GRANT half of the least-privilege boundary; the guard trigger is the
-- structural half. NO insert/delete, NO other-table grants.
grant select on ops.notification_outbox to notifier;
grant update (state, attempts, next_attempt_at, sent_at, last_error_code)
  on ops.notification_outbox to notifier;

-- G10-style default-deny on function EXECUTE: revoke the PUBLIC default first, then grant
-- explicitly. The projector runs as service_role; the notifier runs claim/mark only.
revoke execute on function ops.classify_notification_class(text, jsonb) from public;
revoke execute on function ops.project_event_to_outbox(uuid, text) from public;
revoke execute on function ops.claim_notification(text) from public;
revoke execute on function ops.mark_notification_sent(uuid) from public;
revoke execute on function ops.mark_notification_failed(uuid, text, integer) from public;

grant execute on function ops.classify_notification_class(text, jsonb) to service_role;
grant execute on function ops.project_event_to_outbox(uuid, text) to service_role;
-- claim/mark are the notifier's delivery surface (service_role may drive them too).
grant execute on function ops.claim_notification(text) to service_role, notifier;
grant execute on function ops.mark_notification_sent(uuid) to service_role, notifier;
grant execute on function ops.mark_notification_failed(uuid, text, integer) to service_role, notifier;

-- Policies. service_role: full. notifier: SELECT + UPDATE only (no insert/delete policy,
-- so those stay denied at the RLS layer too — belt-and-braces with the column grants and
-- the guard trigger). Idempotent via drop-if-exists.
drop policy if exists service_role_all_notification_outbox on ops.notification_outbox;
create policy service_role_all_notification_outbox on ops.notification_outbox
  for all to service_role using (true) with check (true);

drop policy if exists notifier_select_notification_outbox on ops.notification_outbox;
create policy notifier_select_notification_outbox on ops.notification_outbox
  for select to notifier using (true);

drop policy if exists notifier_update_notification_outbox on ops.notification_outbox;
create policy notifier_update_notification_outbox on ops.notification_outbox
  for update to notifier using (true) with check (true);

-- (No anon/authenticated policies on purpose — deny-by-default.)
