-- =====================================================================
-- BUILD-015 AsdAIr / WP-B15-16 - migration 019: THE SHOP OWNS THE LIST,
--                                               NOT THE DATE
--
-- WHY THIS FILE EXISTS. The schema has contradicted itself since migration
-- 006. Two statements, both load-bearing, and they cannot both be true:
--
--   * asdair.shop.list_id (006:50)      -- "a shop owns one list"
--   * unique (household_id, list_date)  -- "a household+date owns one list"
--     on asdair.shopping_lists (001:251)
--
-- Postgres enforces the second. So when a second shop exists for one date,
-- it CANNOT be given a list of its own: the database refuses the row, and
-- the second shop is forced onto the first shop's list - including a dead
-- one. On 2026-08-10 that put an item from a CANCELLED week into Warwick's
-- real shop, and it is why two live shops silently overwrite each other's
-- quantities through the shared row (a unit asked for once, gone by the
-- time he reaches the door).
--
-- WP-B15-07 already moved SHOP identity off the bare date and grounded it
-- in the inbound message. That same repair cannot be applied one layer
-- down, because at the list layer the date IS the identity, by schema, and
-- the index carries no status - so a second row is refused whatever state
-- the first is in. This migration finishes the move that 006 started
-- rather than inventing a new idea:
--
--   list_date answers "which week is this list for?"  -- a PROPERTY.
--   shop_id   answers "whose list is this?"           -- the IDENTITY.
--
-- list_date STAYS, stays not null, and stays meaningful. It is read by
-- services/asdair/skill/data.js and rendered by the cockpit. What it stops
-- being is a key.
--
-- ORDERING IS DELIBERATE AND FAIL-SAFE: add -> backfill -> build the new
-- indexes -> only THEN drop the old constraint. If any index build fails,
-- the old constraint is still standing and the database is exactly where
-- it started. Nothing is dropped on the strength of something unbuilt.
--
-- WHAT THIS DOES NOT DO, deliberately:
--   * It moves, rewrites and orphans NOTHING. No shopping_list_items row
--     changes its list_id. There is no retro-repair of the damaged
--     2026-08-10 rows - 019 makes tomorrow correct; the WP-B15-10 interim
--     is what makes today's shop usable, and it stays.
--   * It adds NO unique index on shopping_list_items. That is the right
--     long-term shape for the (list_id, lower(item_name)) upsert, but live
--     data may already hold duplicates from before the advisory lock
--     covered every path, in which case the build FAILS and blocks this
--     whole migration. A build that can fail on live data is never
--     bundled with a change that must land. Parked as a separate, cheap,
--     independently-provable step: count duplicates first, then decide.
--
-- DESIGN RULES (same as 001/006/008):
--   * PURE ASCII only. No currency symbols, no smart quotes.
--   * NO secrets and NO rows. Structure only.
--   * Idempotent - safe to re-run. Forward-only.
--   * Depends on 001 (shopping_lists) and 006 (asdair.shop).
--
-- Schema decision: Deliverables/2026-08-10-silas-shopping-lists-identity-decision.md
-- Proof:           services/control-plane/wp-d-proof/add-list-item.dbtest.mjs
--                  (assertions (a)-(g); (d) is the defect above, proven closed)
-- =====================================================================

-- 1. The owning shop. NULLABLE on purpose: the cockpit and Shopper routes
--    legitimately create a list with no shop behind it, and minting a
--    synthetic shop for them would be machinery this outcome does not need.
--    A nullable column with no default is a catalogue-only change: no table
--    rewrite, and only a brief ACCESS EXCLUSIVE lock.
alter table asdair.shopping_lists
  add column if not exists shop_id bigint references asdair.shop(id);

-- 2. Backfill from the link that already exists (asdair.shop.list_id).
--
--    THE LIVE SHOP WINS A SHARED ROW. This rule is LOAD-BEARING, not a
--    tie-break preference, and it must not be "simplified" to earliest-id:
--
--      On the real 2026-08-10 data, SHOP-2026-08-10 (CANCELLED) and
--      SHOP-2026-08-10-M64 (live) both carry list_id = the same row,
--      because stepInterpret binds shop.list_id to whatever
--      findOrCreateDraftList returned. If the migration gave that row to
--      the EARLIEST shop, the cancelled one would own it and M64 would be
--      left with no list. M64's next write would create a fresh list - but
--      its shop_line.list_item_id values are ALREADY set, and the replay
--      guard in runPipeline.js will not re-materialise a line that already
--      carries one. M64's items would be STRANDED on a row it no longer
--      owns: a live shop silently missing the things Warwick asked for.
--
--    Preferring the non-terminal shop, then the highest id, makes the
--    still-running shop the owner and leaves the dead one - which will
--    never write again - as the one without ownership. Harmless.
--
--    Terminal is ('RECONCILED','CANCELLED'), matching TERMINAL_STATUSES in
--    services/asdair/shop/shopState.js. 'FAILED' is deliberately NOT
--    terminal: a failed shop can still be resumed, so it must not lose its
--    list to a sibling. shop.status is NOT NULL with a CHECK constraint
--    (006), so the boolean ordering below has no NULL-sorting hazard.
--
--    A shop points at exactly one list (shop.list_id is a single column),
--    so each shop appears in exactly one group here and can never be made
--    the owner of two lists - uq_lists_shop below cannot be violated by
--    this backfill.
with owner as (
  select s.list_id,
         (array_agg(s.id order by (s.status in ('RECONCILED','CANCELLED')) asc, s.id desc))[1] as shop_id
    from asdair.shop s
   where s.list_id is not null
   group by s.list_id
)
update asdair.shopping_lists sl
   set shop_id = o.shop_id
  from owner o
 where o.list_id = sl.id
   and sl.shop_id is null;

-- 3. Observability, not silence: say when a row had more than one claimant.
--    A migration that quietly resolves a contested row is how the next
--    person loses an afternoon.
do $$
declare n int;
begin
  select count(*) into n from (
    select list_id from asdair.shop where list_id is not null
     group by list_id having count(*) > 1) x;
  if n > 0 then
    raise notice '019: % list row(s) were claimed by more than one shop; the live/most-recent shop was made owner. Items already materialised stay where they are and are NOT moved.', n;
  end if;
end $$;

-- 4. The real key: one list per shop. Partial, because the unowned lane
--    legitimately has many rows with a NULL shop_id.
create unique index if not exists uq_lists_shop
  on asdair.shopping_lists (shop_id) where shop_id is not null;

-- 5. Keep the guarantee the old constraint was genuinely providing, for the
--    unowned lane only (cockpit / Shopper, which have no shop behind them).
--    Guaranteed to build: the constraint it replaces already forbade any
--    two rows sharing (household_id, list_date), so any subset is unique.
create unique index if not exists uq_lists_household_date_unowned
  on asdair.shopping_lists (household_id, list_date) where shop_id is null;

-- 6. Preserve the lookup the read path depends on, as an INDEX not a
--    constraint. Demoting the uniqueness must not cost the seek.
create index if not exists idx_lists_household_date
  on asdair.shopping_lists (household_id, list_date);

-- 7. Drop the old constraint BY DISCOVERY - its name is auto-generated by
--    Postgres and must NOT be guessed. Nothing here fires if it is already
--    gone, which is what makes re-running this file a no-op.
do $$
declare c text;
begin
  select conname into c from pg_constraint
   where conrelid = 'asdair.shopping_lists'::regclass and contype = 'u'
     and pg_get_constraintdef(oid) like '%(household_id, list_date)%';
  if c is not null then
    execute format('alter table asdair.shopping_lists drop constraint %I', c);
  end if;
end $$;
