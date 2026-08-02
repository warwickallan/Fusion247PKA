-- BUILD-014 Tower — DURABLE HOLD model (SQLite, idempotent schema delta).
-- WO-TW-01: translated from the Postgres original.
--
-- Replaces the temporary "24h/7d recovery lease" stopgap with an explicit, auditable hold: a turn
-- in state='held' is OUT of the normal loop entirely — the watcher's claimOne (state='pending')
-- and reclaimStale (state='claimed') both ignore it, so it is never claimed, reviewed or notified,
-- and NO lease expiry can silently release it. Release is an explicit held -> pending transition.
--
-- The four held_* COLUMNS this delta used to ALTER onto tower.turn are declared inline on that
-- table in db/loop_schema.sql (SQLite has no `add column if not exists`), labelled with this file
-- as their origin. `state` has no CHECK, so 'held' is accepted exactly as before. What remains
-- genuinely this file's own is the lookup index over the small held subset.

create index if not exists tower.tower_turn_held_idx
  on turn (held_by) where state = 'held';
