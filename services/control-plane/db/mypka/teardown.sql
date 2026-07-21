-- =============================================================================
-- MyPKA cockpit — TEARDOWN / rollback path (tested; see test/apply-teardown.test.mjs)
--
-- Fully reverses migrations 010–040, leaving the MyPKA brain schemas (asdair etc.) exactly
-- as they were before the cockpit layer was added. Ordered so dependent objects go first.
--
-- SAFETY: this drops the Directus system schema and the command-request queue. It does NOT
-- touch any existing asdair data table (households / regulars / shopping_lists / items / …).
-- Run ONLY when you intend to remove the cockpit layer.
-- =============================================================================
begin;

-- 1. Directus system schema + all its directus_* tables (owned by cp_directus).
drop schema if exists directus_sys cascade;

-- 2. The write-back queue (drops its triggers) + guard functions.
drop table if exists asdair.command_request cascade;
drop function if exists asdair.command_request_insert_guard();
drop function if exists asdair.command_request_update_guard();

-- 3. Remove every privilege the cockpit roles hold, then drop the roles. DROP OWNED clears
--    grants + any objects still owned by the role across the database.
do $$
begin
  if exists (select 1 from pg_roles where rolname='cp_directus') then
    execute 'drop owned by cp_directus cascade';
    execute 'drop role cp_directus';
  end if;
  if exists (select 1 from pg_roles where rolname='cp_worker') then
    execute 'drop owned by cp_worker cascade';
    execute 'drop role cp_worker';
  end if;
end $$;

commit;
