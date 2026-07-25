-- 0012 — WP1.5 Fix 2: lens-directed discoveries must carry EXACT source evidence. Records the verbatim
-- supporting span for each directed candidate/relationship, in the same provenance spirit as WP4B, so
-- no model-inferred concept or edge enters the authoritative graph without verifiable evidence.
alter table obsidiwikai.wp15_canonicalisation add column if not exists evidence text;
