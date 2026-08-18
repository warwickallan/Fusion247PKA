-- =====================================================================
-- AsdAIr - migration 022: REVOKE asdair_rw's SELECT on
--                         asdair.budget_settings and
--                         asdair.product_alternatives
--
-- WHY THIS FILE EXISTS. The live runtime preflight
-- (services/asdair/pipeline-runtime/ensure-asdair-runtime.mjs, check AC4)
-- has been reporting, on every start:
--
--     2 privilege(s) exist that NO committed migration grants -
--     schema-as-deployed has drifted from schema-as-code:
--     asdair_rw HAS SELECT on asdair.budget_settings;
--     asdair_rw HAS SELECT on asdair.product_alternatives
--
-- THAT MESSAGE IS FALSE AS WRITTEN, and establishing so is the whole
-- reason this file exists. A committed migration DOES grant both:
-- 012_complete_grant_matrix.sql, in its asdair_rw READ-ONLY tier
-- ("grant select on asdair.budget_settings, ... asdair.product_alternatives
-- ... to asdair_rw"). The deployment and the committed SQL agree with each
-- other. What disagreed was 012's own header prose, and a hand-maintained
-- constant in the preflight that was never told 012 existed.
--
-- So this is NOT undocumented drift being swept away. It is a COMMITTED
-- OVER-GRANT being withdrawn, and 012's grant of these two privileges is
-- SUPERSEDED HERE, forward-only. 012 itself is not edited: its body is
-- what ran, and rewriting an applied migration would make git lie about
-- what the database was told. Its header has been corrected in place to
-- admit what its body does - that, and this file, are the whole repair.
--
-- WHY THE PRIVILEGE GOES RATHER THAN STAYS. Every reader of these two
-- tables was traced through the real call graph, not assumed:
--
--   asdair.budget_settings
--     * services/asdair/skill/data.js  loadBudget()
--         -> connects ONLY via process.env.ASDAIR_DB_URL (asdair_ro)
--     * reached from services/asdair/pipeline/deps.js skill.loadBudget()
--
--   asdair.product_alternatives
--     * services/asdair/skill/data.js  loadList()          -> ASDAIR_DB_URL
--     * services/asdair/cockpit-api/readWorkspace.js       -> ASDAIR_DB_URL
--         (that file's own header: "the SELECT-only asdair_ro role, never
--          the write URL")
--     * services/control-plane/cockpit/project-shopping.mjs
--         -> connects via DATABASE_URL, the trusted service role. Not
--            asdair_rw, and out of scope of the asdair_ro/asdair_rw matrix.
--
-- NO asdair_rw CODE PATH IN THIS ESTATE TOUCHES EITHER TABLE. That is
-- exactly what 010_household_and_list_grants.sql said when it deliberately
-- granted asdair_rw nothing on them ("asdair_rw never touches
-- budget_settings or product_alternatives anywhere in the codebase"), and
-- what 012's own header claimed to be preserving while its body granted
-- them. This migration restores the narrowest-possible-write-path posture
-- that 005's SAFETY MODEL states and 010 applied.
--
-- HOW THE OVER-GRANT GOT INTO GIT, recorded so the mechanism is not
-- repeated: 012 was ENUMERATED from information_schema.role_table_grants on
-- the LIVE database. The privilege was already live - granted out-of-band
-- and by nobody's recorded decision - so the enumeration faithfully copied
-- it into git, under a header asserting that the file "grants NOTHING new".
-- An enumeration of a live database cannot distinguish an intended grant
-- from an accident; only the call graph can, and it was not consulted.
--
-- -- AUTHORED, NOT APPLIED ---------------------------------------------
-- This file is authored and proven against a DISPOSABLE PostgreSQL 17.4
-- cluster built from these committed migrations. It has NOT been applied to
-- the live household database. Application to live is Larry's action under
-- Warwick's authority, and is deliberately HELD until after the current
-- week's shop: narrowing a live role's access days before a real shop buys
-- that shop nothing and carries non-zero risk, however good the call-graph
-- evidence above is. Until it is applied, the AC4 advisory continues to
-- fire on the live runtime, and that is the expected and correct state.
--
-- WHAT TO EXPECT WHEN IT IS APPLIED. The AC4 over-grant row goes quiet
-- because the privilege is gone, not because any check was relaxed. If the
-- live database holds these privileges in a form this file cannot reach -
-- a grant to a GROUP ROLE asdair_rw is a member of, or a grant to PUBLIC,
-- rather than directly to asdair_rw - the residue block below RAISES A
-- WARNING naming it rather than reporting a silent success.
--
-- COLUMN-LEVEL GRANTS ARE NOT ONE OF THOSE SHAPES, and the difference was
-- established by execution rather than assumed (PostgreSQL 17.4):
--
--     grant select (min_normal) on asdair.budget_settings to asdair_rw;
--     -> has_any_column_privilege(...) = true
--     revoke select on asdair.budget_settings from asdair_rw;
--     -> has_any_column_privilege(...) = false
--
-- A table-level REVOKE clears the role's column-level grants on that table
-- too. The residue block still probes for them, because probing costs
-- nothing and the cost of being wrong about this is a silent half-revoke.
--
-- ORDERING HAZARD, PROVEN BY EXECUTION AND WORTH KNOWING BEFORE YOU REPLAY
-- ANYTHING. 012 advertises itself as idempotent and safe to re-run, and it
-- is - but re-running it AFTER this file REINSTATES the over-grant this file
-- removes. Verified on the disposable cluster, 2026-08-19: apply 022 (rw
-- SELECT = false, false), re-apply 012, re-probe (rw SELECT = true, true).
-- Forward-only migrations are applied once and in order, so this is not a
-- defect in either file; it is a trap for anyone who replays 012 by hand to
-- "make sure the grants are right". After any such replay, re-apply 022.
--
-- Rules of the road (same as 001/004/005/006/008/009/010/012):
--   * PURE ASCII. No secrets - role passwords are never in migrations.
--   * Idempotent; safe to re-run; safe where a role does not exist.
--     REVOKE of a privilege that is not held is a no-op in PostgreSQL.
--   * Forward-only. Nothing above 012 is rewritten.
--   * Depends on 001_asdair_schema.sql (both tables) and supersedes the
--     two asdair_rw grants made by 012_complete_grant_matrix.sql.
--   * Touches asdair_rw ONLY. asdair_ro's SELECT on both tables is the
--     REAL read path and is left exactly as 010 and 012 grant it.
-- =====================================================================

do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'asdair_rw') then
    raise notice 'asdair_rw does not exist on this database - skipping (nothing to revoke)';
    return;
  end if;

  if to_regclass('asdair.budget_settings') is null
     or to_regclass('asdair.product_alternatives') is null then
    raise notice 'asdair.budget_settings or asdair.product_alternatives is absent - skipping (apply 001 first)';
    return;
  end if;

  execute 'revoke select on asdair.budget_settings, asdair.product_alternatives '
       || 'from asdair_rw';
end $$;

-- ---------------------------------------------------------------------
-- RESIDUE CHECK. A table-level REVOKE cannot remove a privilege held
-- indirectly - through a group role asdair_rw is a member of, or through
-- PUBLIC. (It DOES clear that role's column-level grants; see the header.)
-- This block does not guess: it asks Postgres whether asdair_rw can still
-- read either table in ANY form, and says so out loud if it can. It
-- changes nothing - a warning here means the live grant has a shape this
-- migration did not reach, and that is a finding for a human, not
-- something to widen a REVOKE on the strength of.
-- ---------------------------------------------------------------------
do $$
declare
  t text;
  residue text[] := '{}';
begin
  if not exists (select 1 from pg_roles where rolname = 'asdair_rw') then
    return;
  end if;

  foreach t in array array['asdair.budget_settings', 'asdair.product_alternatives'] loop
    if to_regclass(t) is null then
      continue;
    end if;
    if has_table_privilege('asdair_rw', t, 'SELECT')
       or has_any_column_privilege('asdair_rw', t, 'SELECT') then
      residue := residue || (t || ' (still readable by asdair_rw after the revoke)');
    end if;
  end loop;

  if array_length(residue, 1) is null then
    raise notice '022 OK - asdair_rw holds no SELECT on budget_settings or product_alternatives, at table or column level';
  else
    raise warning '022 INCOMPLETE - asdair_rw can still read: %. The privilege is held in a form a table-level REVOKE cannot reach (a group role asdair_rw belongs to, or PUBLIC). Investigate before treating the AC4 advisory as resolved.', array_to_string(residue, '; ');
  end if;
end $$;
