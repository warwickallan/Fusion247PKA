-- =============================================================================
-- MyPKA cockpit migration 250 — attention_item.kind (IDEA-016 semantic categories)
--
-- The four Warwick-facing categories must be DISTINCT in the projection, not just relabelled in the UI:
--   blocked    — work genuinely cannot continue without Warwick (this is the ONLY thing that reads
--                as "🔴 Blocked by you" / "Needs you"; NOT suggestions/opportunities/reviews)
--   decision   — a meaningful choice is waiting, but current work is not blocked (e.g. a held merge)
--   suggestion — something Fusion thinks Warwick MAY want to consider (opportunities, Make-the-Brain-Better)
-- (OUTPUT — a thing Fusion actually produced — is the separate cockpit.output_item contract.)
-- notify_policy carries the unified Directus/Telegram intent WITHOUT building any transport now:
--   immediate  — worth a Telegram interrupt now (blockers, meaningful failures, time-sensitive value)
--   selective  — Telegram only if high-value (strong insight/output); else Directus-only
--   none       — Directus-only (routine suggestions/state)
-- =============================================================================
alter table cockpit.attention_item
  add column if not exists kind text not null default 'suggestion'
    check (kind in ('blocked','decision','suggestion')),
  add column if not exists notify_policy text not null default 'none'
    check (notify_policy in ('immediate','selective','none'));

alter table cockpit.output_item
  add column if not exists notify_policy text not null default 'selective'
    check (notify_policy in ('immediate','selective','none'));

create index if not exists cockpit_attention_kind_idx on cockpit.attention_item (kind, status);
