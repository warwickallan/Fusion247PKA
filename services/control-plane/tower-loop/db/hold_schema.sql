-- BUILD-014 Tower — DURABLE HOLD model (idempotent schema delta).
--
-- Replaces the temporary "24h/7d recovery lease" stopgap with an explicit, auditable hold: a turn in
-- state='held' is OUT of the normal loop entirely — the watcher's claimOne (state='pending') and
-- reclaimStale (state='claimed') both ignore it, so it is never claimed, reviewed or notified, and NO
-- lease expiry can silently release it. Release is an explicit held -> pending transition. Additive +
-- idempotent (add column if not exists); no CHECK on state (none exists), so 'held' is accepted.
alter table tower.turn add column if not exists held_at    timestamptz;
alter table tower.turn add column if not exists held_by    text;
alter table tower.turn add column if not exists hold_reason text;
alter table tower.turn add column if not exists hold_until timestamptz;

-- Fast lookup of the held set (partial index on the small held subset).
create index if not exists tower_turn_held_idx on tower.turn (held_by) where state = 'held';
