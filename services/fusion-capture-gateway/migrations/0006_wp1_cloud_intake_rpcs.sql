-- =============================================================================
-- BUILD-002 WP1 — Always-on cloud intake: webhook dedup ledger, intake-transport
-- marker, SECURITY DEFINER RPC surface (Supabase / Postgres DDL)
-- Migration: 0006_wp1_cloud_intake_rpcs        (design: silas; build: mack)
--
-- Source of truth for this shape:
--   Builds/BUILD-002-unified-personal-capture-gateway/Architecture/
--     wp1-architecture-decision.md                          (§1–§3)
--   Builds/BUILD-002-unified-personal-capture-gateway/Architecture/
--     wp1-drain-contract.md                                 (invariants I1–I10)
--   Builds/BUILD-002-unified-personal-capture-gateway/Contracts/
--     capture-contract-pack-v1.md                           (§4, §5)
--   migrations/0001..0005 (this file only ADDS; it weakens nothing)
--
-- WHY THIS EXISTS (WP1):
--   1. TRANSPORT DEDUP — Telegram webhook delivery is at-least-once; the same
--      update_id can arrive many times. fcg.channel_update_dedup is the
--      transport-level ledger keyed (channel, update_id); the WP0
--      idempotency_key remains the capture-level layer beneath it.
--   2. CLOUD WRITE PATH — the Edge Function must reach non-exposed fcg without
--      raw DB credentials. Three SECURITY DEFINER functions in `public`
--      (search_path='', EXECUTE = service_role only, owned by a dedicated
--      least-privilege role) are the ONLY cloud surface: intake insert,
--      tap-confirm, card_ref persist. fcg stays OUT of the exposed schemas.
--   3. CLOUD-SIDE DEFAULT-DENY — the numeric allowlist is enforced INSIDE
--      fcg_webhook_intake / fcg_webhook_confirm_tap against
--      fcg.channel_identity, so a bypassed edge cannot insert for a stranger.
--
-- FIXTURES/ARTIFACT NOTE: this file provisions no secrets, no data, no
-- allowlist row (the single authorised identity row is a DEPLOY-TIME seed via
-- service_role — personal data never enters a migration; see
-- wp1-safe-cutover.md for the exact upsert shape).
--
-- !! SECURITY GATE (Vex) — DO NOT WEAKEN !!
-- * RLS stays ENABLED and deny-by-default on every fcg table, new ones included.
-- * anon / authenticated / PUBLIC receive NO grant, NO policy, NO EXECUTE here.
-- * The definer functions run as fcg_rpc_owner — a NOLOGIN role whose ONLY
--   privileges are the narrow per-table, per-operation set below. It cannot
--   DELETE anything, cannot touch raw_object, cannot administer.
-- * Every definer function: `set search_path = ''` + fully schema-qualified
--   references (Supabase hardening guidance, Pax Q3c). Any diff that removes
--   either is a Vex-gate failure.
-- * fcg_webhook_confirm_tap is the CLOUD TWIN of the WP0 confirmedByTap token:
--   it is the only cloud path out of `accepted`, it fires only for a real
--   callback_query update, and it must never be callable by any principal
--   other than service_role. Do not add callers. Do not relax its state check.
-- =============================================================================

-- --------------------------------------------------------------------------
-- 1. Intake transport marker. Which transport committed the envelope — poll
--    (WP0 long-poll runner) or webhook (WP1 edge intake). Observability +
--    failure triage only; the worker's claim loop does NOT branch on it.
--    Default 'poll' is historically correct for every pre-0006 row.
-- --------------------------------------------------------------------------

create type fcg.intake_transport as enum ('poll', 'webhook');

alter table fcg.capture_envelope
  add column intake_transport fcg.intake_transport not null default 'poll';

comment on column fcg.capture_envelope.intake_transport is
  'WP1: which transport committed this envelope (poll runner vs edge webhook). '
  'Diagnostic only — no worker/claim behaviour may branch on it.';

-- --------------------------------------------------------------------------
-- 2. Transport-level dedup ledger. One row per (channel, update_id) ever
--    handled by the webhook path. INSERT ... ON CONFLICT DO NOTHING inside the
--    RPCs turns Telegram's at-least-once redelivery into an idempotent no-op
--    (with card reconciliation — see fcg_webhook_intake).
--    * capture_id is SET NULL on capture erasure (0002 semantics): the ledger
--      keeps only the transport fact (a number), never personal content, so a
--      completed erasure leaves nothing personal behind here.
--    * update_kind records message vs callback for triage.
--    * Rows are prunable operational residue (retention: operator may purge
--      rows older than the Telegram redelivery horizon; never required for
--      correctness once idempotency_key exists for the capture).
-- --------------------------------------------------------------------------

create table fcg.channel_update_dedup (
  channel     fcg.source_channel not null,
  update_id   bigint             not null,
  update_kind text               not null
    constraint channel_update_dedup_kind_chk
    check (update_kind in ('message', 'callback_query', 'other')),
  capture_id  uuid
    constraint channel_update_dedup_capture_id_fkey
    references fcg.capture_envelope (capture_id)
    on delete set null,
  received_at timestamptz not null default now(),
  constraint channel_update_dedup_pkey primary key (channel, update_id)
);

alter table fcg.channel_update_dedup enable row level security;

-- Lookup for reconciliation + pruning by age.
create index channel_update_dedup_received_at_idx
  on fcg.channel_update_dedup (received_at);

-- --------------------------------------------------------------------------
-- 3. service_role posture for the NEW table (0003's grants were a snapshot).
--    anon/authenticated get nothing — deny-by-default stands.
-- --------------------------------------------------------------------------

grant select, insert, update, delete on fcg.channel_update_dedup to service_role;

create policy service_role_all_channel_update_dedup
  on fcg.channel_update_dedup
  for all to service_role
  using (true) with check (true);

-- --------------------------------------------------------------------------
-- 4. Dedicated definer-owner role: fcg_rpc_owner. NOLOGIN; nobody connects as
--    it. It exists ONLY to own the three RPCs so SECURITY DEFINER runs with a
--    principal whose privileges are the minimum the function bodies need —
--    NOT postgres, NOT service_role. Least-privilege per Pax Q3(c).
--
--    Privilege matrix (nothing else — notably NO DELETE anywhere, NO access to
--    fcg.raw_object / fcg.evidence_pointer / fcg.channel_poll_offset):
--      channel_identity     SELECT                      (allowlist check)
--      capture_envelope     SELECT, INSERT              (intake + rate guard)
--      processing_state     SELECT, INSERT, UPDATE      (accepted row; tap hop;
--                                                        card_ref persist)
--      idempotency_key      SELECT, INSERT              (capture-level dedup)
--      channel_update_dedup SELECT, INSERT, UPDATE      (ledger + capture link)
--    RLS: policies below are the SECOND gate (grants alone don't pass RLS).
--    Per-operation policies, not FOR ALL — the role can never read-modify
--    outside these verbs even if a future grant drifts.
--
--    CONCURRENCY-SAFE role creation (same root-cause fix as 0003, 2026-07-17):
--    roles live in the CLUSTER-wide shared catalog. When two sessions apply
--    this migration into DIFFERENT databases of the same cluster at once
--    (exactly what CI does: parallel test files migrating "<db>" and
--    "<db>_e2e"/"<db>_wp1"), a bare check-then-create races and the loser dies
--    with 42710/23505. The nested exception block turns "somebody else created
--    it first" into the no-op it was always meant to be.
-- --------------------------------------------------------------------------

do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'fcg_rpc_owner') then
    begin
      create role fcg_rpc_owner nologin;
    exception
      when duplicate_object then null;  -- 42710: lost the race after our check
      when unique_violation then null;  -- 23505: concurrent pg_authid insert
    end;
  end if;
end
$$;

-- LIVE-APPLY GUARD (build finding, Mack 2026-07-17 — deviation from the draft,
-- additive only): the `alter function ... owner to fcg_rpc_owner` statements at
-- the foot of this file require the APPLIER to be a member of fcg_rpc_owner
-- (superusers are exempt — the throwaway CI cluster applies as a superuser and
-- skips this; Supabase's `postgres` role is NOT a superuser and needs the
-- membership). The creator of the role holds ADMIN OPTION on it, so this
-- self-grant succeeds on a fresh Supabase apply; concurrent/duplicate grants
-- and exotic appliers fall through to the no-op.
do $$
begin
  if not (select rolsuper from pg_roles where rolname = current_user)
     and not pg_has_role(current_user, 'fcg_rpc_owner', 'usage') then
    begin
      execute format('grant fcg_rpc_owner to %I', current_user);
    exception
      when others then null;  -- best-effort; the ALTER OWNER below is the real check
    end;
  end if;
end
$$;

grant usage on schema fcg to fcg_rpc_owner;

grant select                 on fcg.channel_identity     to fcg_rpc_owner;
grant select, insert         on fcg.capture_envelope     to fcg_rpc_owner;
grant select, insert, update on fcg.processing_state     to fcg_rpc_owner;
grant select, insert         on fcg.idempotency_key      to fcg_rpc_owner;
grant select, insert, update on fcg.channel_update_dedup to fcg_rpc_owner;

create policy rpc_owner_select_channel_identity
  on fcg.channel_identity for select to fcg_rpc_owner using (true);

create policy rpc_owner_select_capture_envelope
  on fcg.capture_envelope for select to fcg_rpc_owner using (true);
create policy rpc_owner_insert_capture_envelope
  on fcg.capture_envelope for insert to fcg_rpc_owner with check (true);

create policy rpc_owner_select_processing_state
  on fcg.processing_state for select to fcg_rpc_owner using (true);
create policy rpc_owner_insert_processing_state
  on fcg.processing_state for insert to fcg_rpc_owner with check (true);
create policy rpc_owner_update_processing_state
  on fcg.processing_state for update to fcg_rpc_owner using (true) with check (true);

create policy rpc_owner_select_idempotency_key
  on fcg.idempotency_key for select to fcg_rpc_owner using (true);
create policy rpc_owner_insert_idempotency_key
  on fcg.idempotency_key for insert to fcg_rpc_owner with check (true);

create policy rpc_owner_select_channel_update_dedup
  on fcg.channel_update_dedup for select to fcg_rpc_owner using (true);
create policy rpc_owner_insert_channel_update_dedup
  on fcg.channel_update_dedup for insert to fcg_rpc_owner with check (true);
create policy rpc_owner_update_channel_update_dedup
  on fcg.channel_update_dedup for update to fcg_rpc_owner using (true) with check (true);

-- --------------------------------------------------------------------------
-- 5. RPC 1/3 — fcg_webhook_intake. The webhook commit point.
--    Order is normative (wp1-architecture-decision.md §3): allowlist BEFORE any
--    write (an unauthorised sender leaves ZERO rows — not even a ledger row, so
--    no stranger PII is retained); then the durable rate guard; then transport
--    dedup; then capture dedup; then the new-capture insert at `accepted`
--    (tap-gate hold — NEVER queued/offline_queued from intake).
--
--    Caller computes idempotency_key + capture_id with byte-identical ports of
--    core/idempotency.js + telegramMapping.deriveCaptureId (golden-vector
--    tested) so poll↔webhook crossover dedups for real.
--
--    Known corner (documented, accepted): a REDELIVERY of an already-committed
--    update that arrives while the sender is inside the rate-guard window
--    returns 'rate_limited' instead of 'duplicate' (guard runs before the
--    ledger by design — refusal must precede any write). The capture is already
--    durable; only card reconciliation is skipped, and the wake-time
--    recoverMissingCards sweep is the backstop (drain contract I6).
-- --------------------------------------------------------------------------

create function public.fcg_webhook_intake(
  p_channel          text,
  p_update_id        bigint,
  p_sender_principal text,          -- bare numeric Telegram user id, as text
  p_idempotency_key  text,
  p_capture_id       uuid,
  p_recorded_intent  text,
  p_technical_source_type text,
  p_payload_text     text,
  p_text_preview     text,
  p_channel_context  jsonb,
  p_captured_at      timestamptz
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $fn$
declare
  v_identity_ref text;
  v_existing_capture uuid;
  v_card_ref jsonb;
  v_recent int;
begin
  -- (1) CLOUD-SIDE ALLOWLIST — default-deny, before ANY write.
  select ci.identity_ref into v_identity_ref
    from fcg.channel_identity ci
   where ci.channel = p_channel::fcg.source_channel
     and ci.channel_principal_ref = p_sender_principal
     and ci.is_authorised;
  if v_identity_ref is null then
    return jsonb_build_object('outcome', 'unauthorised');
  end if;

  -- (2) Durable backpressure guard (F-04 cloud twin): ≤ 20 accepted captures
  --     per sender per rolling 60s. Tunable constant; excess is refused BEFORE
  --     the durable commit, mirroring WP0's fail-closed limiter.
  select count(*) into v_recent
    from fcg.capture_envelope ce
   where ce.sender_identity_ref = v_identity_ref
     and ce.received_at > now() - interval '60 seconds';
  if v_recent >= 20 then
    return jsonb_build_object('outcome', 'rate_limited');
  end if;

  -- (3) Transport dedup: at-least-once redelivery collapses here.
  insert into fcg.channel_update_dedup (channel, update_id, update_kind)
  values (p_channel::fcg.source_channel, p_update_id, 'message')
  on conflict on constraint channel_update_dedup_pkey do nothing;
  if not found then
    select d.capture_id into v_existing_capture
      from fcg.channel_update_dedup d
     where d.channel = p_channel::fcg.source_channel and d.update_id = p_update_id;
    if v_existing_capture is not null then
      select ps.card_ref into v_card_ref
        from fcg.processing_state ps where ps.capture_id = v_existing_capture;
    end if;
    return jsonb_build_object(
      'outcome', 'duplicate',
      'capture_id', v_existing_capture,
      'has_card_ref', v_card_ref is not null);
  end if;

  -- (4) Capture-level dedup (cross-transport: same message seen by the poll
  --     runner earlier). Link the ledger row; report existing.
  select ik.capture_id into v_existing_capture
    from fcg.idempotency_key ik where ik.idempotency_key = p_idempotency_key;
  if v_existing_capture is not null then
    update fcg.channel_update_dedup d
       set capture_id = v_existing_capture
     where d.channel = p_channel::fcg.source_channel and d.update_id = p_update_id;
    select ps.card_ref into v_card_ref
      from fcg.processing_state ps where ps.capture_id = v_existing_capture;
    return jsonb_build_object(
      'outcome', 'existing',
      'capture_id', v_existing_capture,
      'has_card_ref', v_card_ref is not null);
  end if;

  -- (5) New capture — committed at `accepted` (TAP-GATE HOLD; the worker
  --     cannot claim it; only a real tap moves it).
  insert into fcg.capture_envelope
    (capture_id, source_channel, sender_identity_ref, recorded_intent,
     technical_source_type, payload_text, text_preview, channel_context,
     intake_transport, captured_at, received_at)
  values
    (p_capture_id, p_channel::fcg.source_channel, v_identity_ref,
     p_recorded_intent::fcg.recorded_intent,
     p_technical_source_type::fcg.technical_source_type,
     p_payload_text, p_text_preview, p_channel_context,
     'webhook', coalesce(p_captured_at, now()), now());

  insert into fcg.processing_state (capture_id, state, updated_at)
  values (p_capture_id, 'accepted', now());

  insert into fcg.idempotency_key (idempotency_key, capture_id)
  values (p_idempotency_key, p_capture_id);

  update fcg.channel_update_dedup d
     set capture_id = p_capture_id
   where d.channel = p_channel::fcg.source_channel and d.update_id = p_update_id;

  return jsonb_build_object('outcome', 'new', 'capture_id', p_capture_id);
end;
$fn$;

-- --------------------------------------------------------------------------
-- 6. RPC 2/3 — fcg_webhook_confirm_tap. The CLOUD TWIN of confirmedByTap.
--    Fires only for a real callback_query update; enforces the same allowlist;
--    transitions accepted → offline_queued ONLY (the cloud cannot verify
--    worker liveness, so it always uses the offline-honest claimable state).
--    Every other current state is an idempotent no-op with an honest outcome.
-- --------------------------------------------------------------------------

create function public.fcg_webhook_confirm_tap(
  p_channel          text,
  p_update_id        bigint,
  p_sender_principal text,
  p_chat_id          text,
  p_message_id       text,
  p_action           text
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $fn$
declare
  v_identity_ref text;
  v_capture_id uuid;
  v_state fcg.capture_processing_state;
begin
  -- Allowlist first, always (same default-deny as intake).
  select ci.identity_ref into v_identity_ref
    from fcg.channel_identity ci
   where ci.channel = p_channel::fcg.source_channel
     and ci.channel_principal_ref = p_sender_principal
     and ci.is_authorised;
  if v_identity_ref is null then
    return jsonb_build_object('outcome', 'unauthorised');
  end if;

  -- Transport dedup for the callback update itself (a redelivered tap is a
  -- no-op even before state inspection).
  insert into fcg.channel_update_dedup (channel, update_id, update_kind)
  values (p_channel::fcg.source_channel, p_update_id, 'callback_query')
  on conflict on constraint channel_update_dedup_pkey do nothing;
  if not found then
    return jsonb_build_object('outcome', 'duplicate_update');
  end if;

  -- Only SaveToBrain confirms; KeepRaw/AskLarry stay WP0-minimal (honest
  -- "not available", capture stays pending). Unknown actions are inert.
  if p_action is distinct from 'SaveToBrain' then
    return jsonb_build_object('outcome', 'unavailable_action', 'action', p_action);
  end if;

  -- Resolve the capture from the durable card target (0005 reverse lookup),
  -- and LOCK its state row so a concurrent waking worker serialises with us.
  select ps.capture_id, ps.state into v_capture_id, v_state
    from fcg.processing_state ps
   where ps.card_ref->>'chat_id' = p_chat_id
     and ps.card_ref->>'message_id' = p_message_id
   order by ps.updated_at asc
   limit 1
   for update of ps;
  if v_capture_id is null then
    return jsonb_build_object('outcome', 'not_found');
  end if;

  if v_state = 'accepted' then
    -- THE gated hop: accepted → offline_queued. Legal per states.js
    -- (ACCEPTED → OFFLINE_QUEUED). Claimable by the waking worker.
    update fcg.processing_state
       set state = 'offline_queued', updated_at = now()
     where capture_id = v_capture_id;
    update fcg.channel_update_dedup d
       set capture_id = v_capture_id
     where d.channel = p_channel::fcg.source_channel and d.update_id = p_update_id;
    return jsonb_build_object('outcome', 'queued', 'capture_id', v_capture_id);
  elsif v_state = 'completed' then
    return jsonb_build_object('outcome', 'already_completed', 'capture_id', v_capture_id);
  else
    return jsonb_build_object('outcome', 'no_op', 'capture_id', v_capture_id,
                              'state', v_state::text);
  end if;
end;
$fn$;

-- --------------------------------------------------------------------------
-- 7. RPC 3/3 — fcg_webhook_card_ref. Persist the durable card target after the
--    EDGE sends the card (the Yoga may be asleep; the edge is the card sender
--    in webhook mode). Same JSONB shape as 0005 so the waking worker's
--    completion projection re-targets the ORIGINAL card with zero changes.
--    Idempotent overwrite, exactly like store.recordCardRef.
-- --------------------------------------------------------------------------

create function public.fcg_webhook_card_ref(
  p_capture_id uuid,
  p_chat_id    text,
  p_message_id text
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $fn$
declare
  v_found int;
begin
  update fcg.processing_state
     set card_ref = jsonb_build_object('chat_id', p_chat_id, 'message_id', p_message_id),
         updated_at = now()
   where capture_id = p_capture_id;
  get diagnostics v_found = row_count;
  if v_found = 0 then
    return jsonb_build_object('outcome', 'not_found');
  end if;
  return jsonb_build_object('outcome', 'ok', 'capture_id', p_capture_id);
end;
$fn$;

-- --------------------------------------------------------------------------
-- 8. Ownership + EXECUTE surface. Owner = fcg_rpc_owner (least-privilege
--    definer). EXECUTE: revoked from PUBLIC (Postgres grants it by default on
--    functions!), revoked from anon + authenticated explicitly, granted to
--    service_role ONLY. The edge function calls with the auto-injected service
--    credential — no raw DB password in the edge env (Pax Q3 bottom line, Q4).
--
--    OWNERSHIP-TRANSFER PRECONDITION (non-superuser live apply): the new owner
--    role must hold CREATE on the function's schema at ALTER time. Granted
--    transiently and revoked immediately after — fcg_rpc_owner retains NO
--    standing CREATE privilege on public (Vex posture: the definer role can
--    create nothing, anywhere).
-- --------------------------------------------------------------------------

grant create on schema public to fcg_rpc_owner;

alter function public.fcg_webhook_intake(text, bigint, text, text, uuid, text, text, text, text, jsonb, timestamptz)
  owner to fcg_rpc_owner;
alter function public.fcg_webhook_confirm_tap(text, bigint, text, text, text, text)
  owner to fcg_rpc_owner;
alter function public.fcg_webhook_card_ref(uuid, text, text)
  owner to fcg_rpc_owner;

revoke create on schema public from fcg_rpc_owner;

revoke execute on function public.fcg_webhook_intake(text, bigint, text, text, uuid, text, text, text, text, jsonb, timestamptz)
  from public, anon, authenticated;
revoke execute on function public.fcg_webhook_confirm_tap(text, bigint, text, text, text, text)
  from public, anon, authenticated;
revoke execute on function public.fcg_webhook_card_ref(uuid, text, text)
  from public, anon, authenticated;

grant execute on function public.fcg_webhook_intake(text, bigint, text, text, uuid, text, text, text, text, jsonb, timestamptz)
  to service_role;
grant execute on function public.fcg_webhook_confirm_tap(text, bigint, text, text, text, text)
  to service_role;
grant execute on function public.fcg_webhook_card_ref(uuid, text, text)
  to service_role;

comment on function public.fcg_webhook_intake(text, bigint, text, text, uuid, text, text, text, text, jsonb, timestamptz) is
  'WP1 cloud intake commit point. SECURITY DEFINER (fcg_rpc_owner), search_path='''', '
  'service_role EXECUTE only. Enforces the numeric allowlist against '
  'fcg.channel_identity BEFORE any write (cloud-side default-deny). Inserts at '
  '`accepted` — the tap-gate hold. DO NOT WEAKEN.';
comment on function public.fcg_webhook_confirm_tap(text, bigint, text, text, text, text) is
  'WP1 cloud twin of the confirmedByTap token: the ONLY cloud path out of '
  '`accepted`, fires only for a real callback_query, transitions only '
  'accepted → offline_queued. DO NOT add callers; DO NOT relax the state check.';
comment on function public.fcg_webhook_card_ref(uuid, text, text) is
  'WP1: persist the durable card target sent by the edge, 0005 card_ref shape, '
  'so the waking worker re-targets the original card. Idempotent overwrite.';

-- --------------------------------------------------------------------------
-- 9. What this migration deliberately does NOT do:
--    * No queued_at column — ce.received_at + ps.updated_at already carry the
--      ordering/age story the worker sorts and tests assert on; a third
--      timestamp is drift surface with no consumer.
--    * No change to channel_poll_offset, the claim predicate, retry indexes,
--      erasure cascades, or any 0001–0005 object.
--    * No allowlist data, no secrets, no bot identifiers (deploy-time seed).
--    * No EXECUTE for anon/authenticated anywhere; no RLS weakening anywhere.
-- =============================================================================
