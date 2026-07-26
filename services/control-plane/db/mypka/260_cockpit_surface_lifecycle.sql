-- =============================================================================
-- MyPKA cockpit migration 260 — surface decision lifecycle (IDEA-016 standalone Cockpit)
--
-- The Warwick-facing Cockpit lets him decide every attention item: accept / decline / defer.
--   open      — needs Warwick (projector default)
--   accepted  — Warwick accepted; the real governed action was filed (worker completes → resolved)
--   deferred  — Warwick said "Later" — kept, de-urgented, out of the active lanes
--   declined  — Warwick dismissed — out of active views, preserved in Archive
--   resolved  — upstream source no longer open (projector auto-resolves)
-- 'dismissed' retained for back-compat.
--
-- Trust seam preserved: the surface (cp_worker) may move ONLY an item's status — never its content,
-- and never module data (obsidiwikai.*/asdair.*), which still changes only via governed intent→worker.
-- =============================================================================
alter table cockpit.attention_item drop constraint if exists attention_item_status_check;
alter table cockpit.attention_item add constraint attention_item_status_check
  check (status = any (array['open','accepted','declined','deferred','resolved','dismissed']));

-- Column-tight lifecycle grant for the Cockpit surface role.
grant update (status, updated_at) on cockpit.attention_item to cp_worker;
grant update (status, updated_at) on cockpit.output_item   to cp_worker;
