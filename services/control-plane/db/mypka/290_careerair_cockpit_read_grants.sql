-- =============================================================================
-- MyPKA cockpit migration 290 — read-only grants so the cockpit can RENDER the opportunity grid
--
-- ⚠️ APPLIED OUT-OF-BAND ON 2026-08-23, BEFORE THIS FILE EXISTED. Read that as a fact about this
-- file, not a licence: the grants below were executed directly against the live database as the
-- superuser role while diagnosing why the new cockpit page would have rendered ZERO rows, and this
-- migration is the versioned record of exactly what was executed. It is therefore written to be
-- IDEMPOTENT AND SAFE TO RE-RUN against a database that already has them — re-applying it is a
-- no-op, not an error and not a widening.
--
-- THE DEFECT THIS CLOSES, recorded because it was nearly shipped. The cockpit reads as `cp_directus`,
-- the SELECT-only pooler role. The `careerair` schema was created outside this migration series and
-- `cp_directus` had NO usage on it and NO select on any of its tables. Every check made while
-- designing the page had been run as the superuser, which HAS access — so the page would have been
-- built, reviewed and demonstrated against a role that could see everything, and then rendered an
-- empty grid for the one role that actually serves it. The lesson is the general one: verify a grant
-- as the ROLE THAT WILL USE IT, never as the role that happens to be connected.
--
--   cp_directus  — RENDER ONLY: usage on the schema, SELECT on exactly three OBJECTS. Nothing else.
--   cp_worker    — DELIBERATELY NOT GRANTED ANYTHING HERE. The cockpit's write role has no business
--                  in this schema; the grid is a read surface and there is no intent queue behind it.
--
-- ⚠️ ONE OF THE THREE IS A VIEW, AND THAT IS A PRIVILEGE-INDIRECTION OBJECT. Say it plainly, because
-- "three tables" understated it. `careerair.opportunity_field_current` is a VIEW, and its
-- `security_invoker` is UNSET — so it executes with the privileges of its OWNER (`postgres`), not of
-- the caller. Granting SELECT on it is therefore how `cp_directus` reads `opportunity_field`,
-- `opportunity_field_name` and `opportunity_classification` WITHOUT holding any grant on those
-- tables, and `\dp` against them will show none.
--
-- That is intended and it is bounded — the reach is exactly the view's own text and nothing wider,
-- and the view exposes current field values, which is precisely what the grid renders. But a future
-- maintainer reading "SELECT on three tables" would conclude the role's reach is three tables, and
-- it is not. TWO CONSEQUENCES WORTH CARRYING: redefining this view silently widens what the cockpit
-- role can read, with no grant change to review; and setting `security_invoker = on` would break the
-- grid unless the underlying tables were granted at the same time. Neither is changed here.
--
-- ⛔ `careerair.email_message` IS DELIBERATELY OMITTED, AND ITS OMISSION IS THE POINT.
-- That table carries the content of Warwick's mail. The grid does not need it, so the role that
-- serves a browser page cannot read it — a property of the GRANT, not of the application code, and
-- therefore one that survives any future change to the application code. A later migration that adds
-- it should have to argue for it in its own header. Asserted by services/cockpit/careerair-check.mjs.
--
-- No DDL. No data is written, altered or deleted by this file.
-- Reversible via teardown.sql.
-- =============================================================================
begin;

-- ---- Reset the three tables (scoped — touches nothing else in any schema) ----
-- Same discipline as 040 and 070: revoke the exact objects first, then grant the narrow set, in ONE
-- transaction. A re-apply therefore never opens a window where the running cockpit has lost its
-- privileges, and never leaves a WIDER privilege in place than the grants below describe. Guarded on
-- the role and on each table existing, so this runs cleanly on a fresh database where neither does.
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'cp_directus') then
    if to_regclass('careerair.opportunity')               is not null then execute 'revoke all on careerair.opportunity from cp_directus'; end if;
    if to_regclass('careerair.opportunity_field_current') is not null then execute 'revoke all on careerair.opportunity_field_current from cp_directus'; end if;
    if to_regclass('careerair.fit_assessment')            is not null then execute 'revoke all on careerair.fit_assessment from cp_directus'; end if;
  end if;
end $$;

-- ---- cp_directus: render the grid, and nothing more ----
-- Guarded the same way. `grant` on a missing schema or table is an ERROR, not a no-op, so an
-- unguarded statement here would make this migration fail on any database that has not yet created
-- the schema — which is every fresh clone.
do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'cp_directus') then
    raise notice '290: role cp_directus absent — nothing granted. This is expected on a database that has no cockpit role.';
    return;
  end if;
  if to_regclass('careerair.opportunity') is null then
    raise notice '290: schema careerair absent — nothing granted. The grid will report an unread list, never an empty one.';
    return;
  end if;

  execute 'grant usage on schema careerair to cp_directus';
  execute 'grant select on careerair.opportunity               to cp_directus';
  execute 'grant select on careerair.opportunity_field_current to cp_directus';
  execute 'grant select on careerair.fit_assessment            to cp_directus';
  -- ⛔ NO `grant ... on all tables in schema careerair`. That form would silently pick up
  -- careerair.email_message today and every table added to this schema in future — a grant that
  -- widens itself as the schema grows is exactly the control this file is written to avoid.
end $$;

commit;
