-- =============================================================================
-- BUILD-010 WP1 — Reliable Autonomous Governance Loop, delta migration
-- Migration: 0006_wp1_notification_cards                          (author: mack)
--
-- PROVENANCE — implements the APPROVED human-decision-gate contract:
--   Source of truth: Builds/BUILD-010-fusion-tower/Architecture/
--     fusion-tower-operating-instructions.md §4a "HUMAN DECISION GATE" (Warwick-
--     approved 2026-07-17). After a Codex review turn returns, the Tower posts a
--     [CODEX] summary to Warwick's private Telegram WITH OPTION CARDS (an inline
--     keyboard) and HALTS in awaiting_decision — Larry's correction turn is NOT
--     dispatched until Warwick taps a card. This migration adds the two durable
--     shapes that gate needs:
--
--     (1) notification_outbox.reply_markup — the OPTIONAL Telegram inline-keyboard
--         card definition attached to a notification. It is persisted on the outbox
--         row so a RESTART between "enqueue the gate" and "send the card" still sends
--         the card with its buttons. Without durable storage a crash would drop the
--         buttons and Warwick would get a text-only [CODEX] message he could not act
--         on — defeating the gate.
--
--     (2) ftw.decision_gate — the DURABLE PENDING-DECISION MARKER. One row per open
--         Codex-review gate: run_id + the review head SHA + the allowed decisions +
--         a compact gate_token that the button callback_data carries. It records the
--         human decision durably (proceed | hold | stop) EXACTLY ONCE. Without it a
--         tap would have nowhere durable to land: a restart would lose "which gate is
--         open", a STALE tap on an OLD review head could be applied to a NEWER review,
--         and a DUPLICATE tap could act twice.
--
--   Defect it forecloses: an autonomous Codex→Larry handoff. The gate makes every
--     handoff human-gated and restart-safe: the loop CANNOT advance a review to a
--     Larry correction turn without a durably-recorded PROCEED decision for the
--     CURRENT review head. A card is NEVER a merge.
--
-- WHY A NEW MIGRATION (not an edit to 0001–0005):
--   0001–0005 are committed, reviewed, and part of the WP0/WP1 proof history — they
--   are IMMUTABLE. This discrete 0006 delta only ADDS one nullable column to the
--   EXISTING ftw.notification_outbox and one NEW table ftw.decision_gate (+ its RLS).
--   Apply order is always 0001 -> 0002 -> 0003 -> 0004 -> 0005 -> 0006 on a clean DB.
--
-- ENUM-VS-TABLE COLLISION LESSON (carried from 0001/0003/0004/0005): a table
-- implicitly creates a composite type of the same name, so NO enum may share a name
-- with any table. This migration adds NO enum — the gate's `status` and `decision`
-- are TEXT + named CHECK vocabularies (the same low-friction pattern as
-- notification_outbox.logical_source), and the one new table is `decision_gate`.
-- There is therefore no name collision by construction.
--
-- Supabase is DURABLE OPERATIONAL STATE, NOT the canonical Brain. Every column here
-- holds a POINTER / metadata (a chat-card definition of button labels + callback
-- tokens, a run id, a head SHA, a decision label, a tapper id) — NEVER a secret and
-- NEVER the governed review content itself (that stays in ClickUp/staged, linked).
--
-- !! SECURITY GATE (Vex) — DO NOT WEAKEN !!
--   * notification_outbox keeps its 0004 posture: RLS enabled deny-by-default,
--     service_role-only. Adding a nullable column grants NOTHING new; the existing
--     policy covers it. The body_no_token / sent_requires_provider / dedup_key
--     invariants are UNTOUCHED. `reply_markup` holds a Telegram inline_keyboard
--     (button text + callback tokens) — POINTERS only, never a bot token / secret.
--   * ftw.decision_gate gets RLS ENABLED deny-by-default with ONE service_role-only
--     policy — identical to 0001/0003/0004. anon/authenticated get NEITHER a grant
--     NOR a policy. Do NOT add an anon/authenticated policy, do NOT disable RLS, and
--     do NOT store a secret in any column (gate_token is a NON-secret routing token,
--     safe to place in a public Telegram callback_data; it is NOT a credential).
-- =============================================================================

-- --------------------------------------------------------------------------
-- (1) notification_outbox.reply_markup — OPTIONAL durable Telegram inline-keyboard.
-- Nullable jsonb: most notifications are text-only (NULL). A gate notification carries
-- the card definition ({"inline_keyboard":[[{"text":"...","callback_data":"dec:..."}]]}).
-- Guarded ADD so re-applying 0006 is a clean no-op. The drainer sends `reply_markup`
-- verbatim to the Telegram Bot API when present; it survives a restart because it is
-- stored on the durable outbox row, not held in memory.
-- --------------------------------------------------------------------------
alter table ftw.notification_outbox
  add column if not exists reply_markup jsonb;

comment on column ftw.notification_outbox.reply_markup is
  'OPTIONAL Telegram inline_keyboard (option cards) for this notification. POINTERS '
  'only — button labels + callback tokens (e.g. dec:<gate_token>:proceed). NEVER a '
  'secret. NULL for a plain text notification. Stored durably so a restart still '
  'sends the card. A card is NEVER a merge — the allowed decisions are proceed/hold/stop.';

-- --------------------------------------------------------------------------
-- (2) ftw.decision_gate — the DURABLE PENDING-DECISION MARKER for a Codex-review gate.
--
--   run_id            -- which run this gate belongs to (cascade-deletes with the run).
--   gate_token        -- the COMPACT, NON-secret token carried in each button's
--                        callback_data (`dec:<gate_token>:<decision>`), so a tap maps
--                        back to THIS specific gate (this run + this review head). It
--                        is UNIQUE. A callback for a superseded/decided gate's token is
--                        rejected — that is how a STALE tap on an OLD head is refused.
--   review_head_sha   -- the exact head SHA the Codex review was for. A newer review
--                        (new head) SUPERSEDES this gate; a tap that does not match the
--                        current pending gate for the run is stale.
--   allowed_decisions -- the bounded card set for this gate, e.g. {proceed,hold,stop}.
--                        NONE is a merge. A decision not in this set is rejected.
--   status            -- pending -> decided (one human tap) | superseded (a newer
--                        review head obsoleted it, do-not-honour). Named CHECK.
--   decision          -- the recorded decision once decided (proceed|hold|stop). NULL
--                        while pending. Named CHECK vocabulary; proceed is the ONLY
--                        decision that lets the loop dispatch a Larry correction turn.
--   decided_by        -- the authorised tapper's Telegram user id (a POINTER).
--   decided_at        -- when the decision was recorded.
--   notification_dedup_key -- link to the [CODEX] card notification in the outbox.
--
-- ONE-PENDING-GATE-PER-RUN is enforced by a partial UNIQUE index below, so a run can
-- never have two open gates racing. Recording a decision is a single atomic UPDATE
-- (pending -> decided) — a second/stale tap affects zero rows and is rejected
-- idempotently (exactly one decision per gate).
-- --------------------------------------------------------------------------
create table if not exists ftw.decision_gate (
  gate_id            uuid not null
    constraint decision_gate_pkey primary key
    default gen_random_uuid(),

  run_id             uuid not null
    constraint decision_gate_run_id_fkey
    references ftw.governance_run (run_id) on delete cascade,

  -- The compact, NON-secret token placed in the button callback_data. UNIQUE so a tap
  -- resolves to exactly one gate. Kept short (<64-byte callback_data budget).
  gate_token         text not null
    constraint decision_gate_gate_token_key unique
    constraint decision_gate_gate_token_len_chk check (char_length(gate_token) between 6 and 40),

  review_head_sha    text not null,

  -- The bounded card set. TEXT[] of decision labels; each must be in the vocabulary.
  allowed_decisions  text[] not null
    constraint decision_gate_allowed_nonempty_chk check (array_length(allowed_decisions, 1) >= 1)
    constraint decision_gate_allowed_vocab_chk
      check (allowed_decisions <@ array['proceed','hold','stop']::text[]),

  status             text not null default 'pending'
    constraint decision_gate_status_chk check (status in ('pending','decided','superseded')),

  -- The recorded decision. NULL while pending; one of the bounded verbs once decided.
  -- A card is NEVER a merge — 'merge' is deliberately absent from this vocabulary.
  decision           text
    constraint decision_gate_decision_vocab_chk
      check (decision is null or decision in ('proceed','hold','stop')),

  -- HARD INVARIANT: a decided gate MUST carry a decision + who decided it + when. A
  -- 'decided' row with no decision can NEVER exist.
  constraint decision_gate_decided_requires_decision_chk
    check (status <> 'decided'
           or (decision is not null and decided_by is not null and decided_at is not null)),

  decided_by         text,
  decided_at         timestamptz,

  notification_dedup_key text,

  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

comment on table ftw.decision_gate is
  'DURABLE pending-decision marker for a Codex-review HUMAN DECISION GATE (OI §4a). '
  'One row per open gate: run + review head SHA + allowed cards + a compact gate_token '
  'the button callback_data carries. Records the human decision (proceed|hold|stop) '
  'exactly once. proceed is the ONLY decision that lets the loop dispatch a Larry '
  'correction turn. A card is NEVER a merge.';

comment on constraint decision_gate_gate_token_key on ftw.decision_gate is
  'The token placed in Telegram button callback_data (dec:<gate_token>:<decision>). '
  'UNIQUE so a tap resolves to exactly one gate (this run + this review head). A tap on '
  'a superseded/decided gate token is rejected — this is how a STALE tap on an OLD head '
  'is refused. NON-secret routing token, NOT a credential.';

comment on constraint decision_gate_decision_vocab_chk on ftw.decision_gate is
  'A card is NEVER a merge: the decision vocabulary is proceed|hold|stop only. DO NOT '
  'add merge/deploy/any destructive verb here.';

-- ONE PENDING GATE PER RUN. A partial UNIQUE index makes a second open gate for the
-- same run impossible; opening a new gate (new review head) must first SUPERSEDE the
-- prior pending one. This is the structural guarantee behind "one decision per gate".
create unique index if not exists decision_gate_one_pending_per_run_idx
  on ftw.decision_gate (run_id)
  where status = 'pending';

-- Token lookup on tap: index the UNIQUE token (the unique constraint already creates a
-- btree, so no extra index needed) and the pending-per-run scan is covered above.

-- =============================================================================
-- SECURITY GATE (Vex) — RLS. DO NOT WEAKEN.
-- notification_outbox is UNCHANGED (0004 posture inherits the new nullable column).
-- ftw.decision_gate: enable RLS, grant + policy the server-side service_role ONLY.
-- anon/authenticated get NEITHER a grant NOR a policy (deny-by-default from both the
-- privilege check and RLS). Mirrors 0001/0003/0004 exactly, guarded re-runnable.
-- =============================================================================

alter table ftw.decision_gate enable row level security;

-- Roles pre-exist on real Supabase (created by 0001); created-if-absent here too so
-- 0006 is robust against an isolated substrate. Concurrency-safe guard.
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
grant select, insert, update, delete on ftw.decision_gate to service_role;
grant usage, select on all sequences in schema ftw to service_role;

-- One permissive FOR ALL policy scoped TO service_role. Guarded re-runnable. Because
-- no policy names anon/authenticated and RLS is enabled, those roles stay denied.
do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'ftw'
      and tablename = 'decision_gate'
      and policyname = 'service_role_all_decision_gate'
  ) then
    create policy service_role_all_decision_gate
      on ftw.decision_gate
      for all to service_role
      using (true) with check (true);
  end if;
end
$$;

-- (No anon/authenticated policies on purpose — deny-by-default. DO NOT WEAKEN.)
