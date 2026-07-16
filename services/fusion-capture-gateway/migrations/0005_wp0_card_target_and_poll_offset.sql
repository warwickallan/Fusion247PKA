-- =============================================================================
-- BUILD-002 WP0 — Durable channel card target + long-poll offset (Postgres DDL)
-- Migration: 0005_wp0_card_target_and_poll_offset   (author: silas)
--
-- Source of truth:
--   Builds/BUILD-002-unified-personal-capture-gateway/Architecture/
--     supabase-operational-foundation-boundary.md  (§3 worker seam, §1.1.2 queue)
--   PREPROVISION-CORRECTION-0001 §4 (restart / card-target recovery + offset).
--
-- WHY THIS EXISTS (PREPROVISION-CORRECTION-0001 §4):
--   1. The live Telegram adapter previously remembered the card message id in an
--      in-memory Map. On a worker restart between "card sent" and "final card
--      edit", that target was LOST, so the completed status could not be projected
--      back onto the original card. This migration persists the card target
--      (chat id + message id) in the operational store so editCard's target is
--      RECONSTRUCTED from durable state after any restart.
--   2. The long-poll runner must advance the Telegram getUpdates offset durably,
--      or a restart would either re-process acknowledged updates (duplicates) or
--      skip un-acknowledged ones (loss). channel_poll_offset is that durable
--      cursor. Combined with idempotent intake (idempotency_key) and the
--      idempotent governed write, redelivery is safe: no lost accepted updates,
--      no endless duplicates, no duplicate Markdown, no false completion.
--
-- OPERATIONAL ONLY (matrix §3): both are transient operational state — a channel
-- routing pointer and a poll cursor. Neither holds canonical knowledge.
--
-- !! SECURITY GATE (Vex) — DO NOT WEAKEN !!
-- The new table gets RLS enabled + the SAME service_role-only posture as 0003;
-- anon/authenticated receive neither grant nor policy (deny-by-default stands).
-- =============================================================================

-- --------------------------------------------------------------------------
-- 1. Durable channel card target on the queue row. {chat_id, message_id} of the
--    card message so a RESTARTED worker can re-target editCard without any
--    in-memory state. Operational routing pointer only — never knowledge.
-- --------------------------------------------------------------------------

alter table fcg.processing_state
  add column if not exists card_ref jsonb;

-- Reverse lookup (card message -> capture) for inbound callback_query handling.
-- Partial: only rows that actually carry a card target. Tiny at WP0 scale; the
-- planner may still prefer a seq scan, but the index documents+enables the path.
create index if not exists processing_state_card_ref_idx
  on fcg.processing_state ((card_ref->>'chat_id'), (card_ref->>'message_id'))
  where card_ref is not null;

-- --------------------------------------------------------------------------
-- 2. Durable long-poll offset cursor — one row per channel. The runner reads it
--    on startup and advances it AFTER each update reaches the durable intake
--    commit point, so acknowledged updates are never re-fetched.
-- --------------------------------------------------------------------------

create table if not exists fcg.channel_poll_offset (
  channel      fcg.source_channel primary key,
  offset_value bigint      not null default 0,
  updated_at   timestamptz not null default now()
);

alter table fcg.channel_poll_offset enable row level security;

-- --------------------------------------------------------------------------
-- 3. service_role-only access for the NEW table (grants from 0003 were a
--    snapshot over the tables that existed THEN; a table created here needs its
--    own grant + policy). anon/authenticated get nothing — deny-by-default.
-- --------------------------------------------------------------------------

grant select, insert, update, delete on fcg.channel_poll_offset to service_role;

create policy service_role_all_channel_poll_offset
  on fcg.channel_poll_offset
  for all to service_role
  using (true) with check (true);
