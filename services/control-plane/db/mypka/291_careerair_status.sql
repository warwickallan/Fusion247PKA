-- =============================================================================
-- MyPKA cockpit migration 291 — Warwick's own status for each CareerAIR opportunity
--
-- WHAT THIS IS FOR. The opportunity grid (services/cockpit/careerair.mjs, migration 290) renders 354
-- live opportunities and has no memory of what Warwick has done with any of them. He opens a listing
-- on his phone, finds it is no longer accepting applications, and the next visit looks identical.
-- This table is that memory, and it is the COCKPIT'S OWN lifecycle over a dataset the cockpit may
-- only read — exactly the shape `cockpit.attention_item.status` already has (migration 260).
--
-- IT DOES NOT LIVE IN THE `careerair` SCHEMA, AND THAT IS THE POINT. `careerair.*` is the
-- collector's, written by the acquisition pipeline. The cockpit reads it as `cp_directus` and cannot
-- write there at all — migration 290 granted `cp_worker` NOTHING in that schema, deliberately and in
-- writing, and 291 does not disturb that. Warwick's disposition is cockpit surface state, so it lives
-- in the cockpit's schema and is joined at read time.
--
-- NOT A SECOND COPY OF THE OPPORTUNITY. Three columns, and none of them is an employer, a role
-- title, a salary or a URL. A row here says "id 1131 is 'applied'" and nothing else. If a later
-- change wants to add a descriptive column to this table, that is the moment to ask whether the
-- opportunity record should have been read instead.
--
-- -- THE DEFAULT IS THE ABSENCE OF A ROW, NOT A BACKFILL -----------------------------------------
-- `todo` is what an opportunity is until Warwick says otherwise, and it is expressed by there being
-- no row for it. 354 opportunities therefore create ZERO rows here on day one. That makes the default
-- a property of the data model rather than of a migration that has to be re-run for every new
-- opportunity the collector finds, and it keeps this table proportional to Warwick's decisions rather
-- than to the collector's output. The read path supplies `todo` via a LEFT JOIN + coalesce.
--
-- `todo` is nevertheless a STORABLE value, and that is deliberate. Setting a row back to `todo`
-- stores `todo` rather than deleting the row: it needs no DELETE grant (so the write role stays as
-- narrow as 290's), and `updated_at` then records WHEN he moved it back, which a delete throws away.
-- Absence and a stored `todo` mean the same thing to the reader; only one of them remembers a date.
--
-- -- WHY THERE IS NO FOREIGN KEY TO `careerair.opportunity` --------------------------------------
-- The obvious integrity control is a cross-schema FK. It is deliberately absent, for three reasons
-- and one measurement:
--
--   1. It would require REFERENCES on a table in a schema this layer must not hold rights over, and
--      would let the cockpit's own DDL constrain the collector's table lifecycle.
--   2. The collector owns `careerair.opportunity`'s rows. An FK would make a collector DELETE either
--      fail or cascade — the cockpit deciding what the acquisition pipeline may do to its own data.
--   3. The risk an FK would defend against was MEASURED AWAY rather than assumed away, 2026-08-23,
--      by direct read of the live database:
--        - `careerair.opportunity.opportunity_id` is `bigint default nextval(...)` — a plain
--          surrogate sequence, NOT derived from any external source id, so it cannot collide with a
--          re-used id from a job board;
--        - the collector UPDATES IN PLACE and does not delete-and-reinsert — 688 rows carry 688
--          distinct non-null `source_fingerprint`s, 203 rows have `submission_count > 1` and one
--          sits at 143. A delete-and-reinsert cycle would have reset those counters to 1.
--      An id therefore belongs to ONE advert for that advert's life, so a status cannot silently
--      migrate onto a different job. That was the failure worth engineering against; it cannot arise.
--
-- The residual case is the harmless direction: if a row ever did vanish, its status row is orphaned,
-- invisible to the grid (which only joins rows it renders) and costs three columns of dead space.
--
-- -- THE KEY IS TEXT, AND IT IS CONSTRAINED TO ONE CANONICAL FORM --------------------------------
-- The API emits the id as a STRING (`shapeRow` does `String(r.opportunity_id)`), so the surface this
-- table serves is text and the key is text. The hazard that creates is silent: '1131', '01131' and
-- '1131 ' are three different text keys for one opportunity, and nothing about a `text primary key`
-- would notice. The check constraint below removes that by making the canonical decimal form the
-- ONLY storable form — a property of the data model, so it holds against any future writer, not only
-- against the route that exists today. `bigint::text` always produces exactly this form, so the read
-- join matches by construction. 18 digits is the bound: it keeps every value comfortably inside
-- bigint range, so the route's `$1::bigint` existence check can never overflow.
--
-- -- GRANTS: NARROWER THAN ASKED FOR, IN ONE DIRECTION ONLY --------------------------------------
--   cp_directus - SELECT. It renders the grid; it never records a decision.
--   cp_worker   - SELECT, INSERT, and UPDATE ON (status, updated_at) ONLY.
--
-- The column-tight UPDATE is migration 260's precedent applied here, and it earns its place: the one
-- destructive thing a bug in the write route could do to this table is move an existing row's
-- `opportunity_id`, which is precisely "a status attaches to the wrong job". The write role cannot
-- do it. Not because the route does not, but because the grant does not permit it. INSERT is
-- table-wide because creating the binding is what an insert IS; moving one afterwards is not.
--
-- No DELETE for anybody. Nothing in the product removes a row (setting `todo` stores `todo`), so the
-- grant that would allow it is not issued.
--
-- Idempotent and safe to re-run: one transaction, revoke-then-grant, guarded on each role and on the
-- schema existing, so it applies cleanly to a fresh cluster that has neither. A re-apply never opens
-- a window where the running cockpit has lost its privileges.
--
-- Reversible via teardown.sql — `drop schema if exists cockpit cascade` removes this table with the
-- rest of the layer, so no teardown edit is owed.
-- =============================================================================
begin;

-- ---- The table ----
-- Guarded on the cockpit schema existing (migration 050 creates it) so a partial chain does not error.
do $mig291$
begin
  if not exists (select 1 from pg_namespace where nspname = 'cockpit') then
    raise notice '291: schema cockpit absent - nothing created. Apply migration 050 first.';
    return;
  end if;

  create table if not exists cockpit.careerair_status (
    -- The canonical decimal form of careerair.opportunity.opportunity_id. See the header.
    opportunity_id text primary key
      constraint careerair_status_id_canonical check (opportunity_id ~ '^[1-9][0-9]{0,17}$'),
    -- The four states are frozen. An unknown value is not storable, so the route's validation is a
    -- fast path rather than the only thing standing between a typo and the data.
    status text not null
      constraint careerair_status_value check (status in ('todo', 'reviewed', 'applied', 'closed')),
    updated_at timestamptz not null default now()
  );

  -- Idempotent for an install created before either constraint existed. `create table if not exists`
  -- is a no-op on an existing table, so a constraint added later needs its own statement.
  if not exists (select 1 from pg_constraint where conname = 'careerair_status_id_canonical') then
    alter table cockpit.careerair_status
      add constraint careerair_status_id_canonical check (opportunity_id ~ '^[1-9][0-9]{0,17}$');
  end if;
  if not exists (select 1 from pg_constraint where conname = 'careerair_status_value') then
    alter table cockpit.careerair_status
      add constraint careerair_status_value check (status in ('todo', 'reviewed', 'applied', 'closed'));
  end if;
end
$mig291$;

-- ---- Grants: revoke the exact object first, then grant the narrow set, in THIS transaction ----
-- Same discipline as 040, 070 and 290. Guarded per role so an environment with one role and not the
-- other still applies cleanly, and so a fresh cluster with neither is a notice rather than an error.
do $grant291$
begin
  if to_regclass('cockpit.careerair_status') is null then
    raise notice '291: cockpit.careerair_status absent - nothing granted.';
    return;
  end if;

  if exists (select 1 from pg_roles where rolname = 'cp_directus') then
    execute 'revoke all on cockpit.careerair_status from cp_directus';
    execute 'grant usage on schema cockpit to cp_directus';
    execute 'grant select on cockpit.careerair_status to cp_directus';
  else
    raise notice '291: role cp_directus absent - no read grant issued.';
  end if;

  if exists (select 1 from pg_roles where rolname = 'cp_worker') then
    execute 'revoke all on cockpit.careerair_status from cp_worker';
    execute 'grant usage on schema cockpit to cp_worker';
    execute 'grant select, insert on cockpit.careerair_status to cp_worker';
    -- COLUMN-TIGHT. The write role may move a status; it may never move a row's identity.
    execute 'grant update (status, updated_at) on cockpit.careerair_status to cp_worker';
  else
    raise notice '291: role cp_worker absent - no write grant issued.';
  end if;

  -- NO `grant ... on all tables in schema cockpit`, and NO DELETE to anybody. A grant that widens
  -- itself as the schema grows is the control 290 was written to avoid; the same rule applies here.
end
$grant291$;

commit;
