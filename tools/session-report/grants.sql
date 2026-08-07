-- BUILD-020 / WO-25 — least-privilege read access to the rotation mirror.
--
-- WHY THIS IS A SEPARATE FILE AND NOT PART OF schema.sql.
-- populate.mjs applies schema.sql on every run, under the credential that owns the schema. Grants are
-- a different decision with a different blast radius and a different reviewer, and folding them into
-- the DDL would mean every future writer silently re-asserts an access decision it never made. Keeping
-- them here means the access rule can be read, reviewed and reversed on sight, on its own.
--
-- WHO RUNS THIS: Larry, by hand, once. The author of this file has network: none and
-- credential_scope: none and has executed nothing against any database.
--
-- WHAT IT GRANTS, exactly, and nothing beyond it:
--   cp_directus  — USAGE on the schema, SELECT on the two tables. That is the Cockpit's READ pool
--                  (services/cockpit/db.mjs, `q`). It is the only role named here.
--
-- WHAT IT DELIBERATELY DOES NOT GRANT. This list is written out because a reviewer needs to see the
-- decisions that were taken, not only the statements that were kept:
--   * NOTHING to cp_worker. The Cockpit's write pool (`w`) has no business reading rotation reports,
--     and the read endpoint is wired to `q`. Granting the execute role read access it does not use
--     would widen the blast radius of a bug in the write path for no benefit.
--   * NOTHING to anon, authenticated or service_role. These reports describe how the estate is built,
--     not household or product data, and nothing browser-facing reaches them.
--   * NO INSERT, UPDATE, DELETE or TRUNCATE to anyone. The writer is populate.mjs under its own
--     credential; the Cockpit is a reader and must remain structurally unable to alter the evidence
--     it displays. A surface that can edit its own audit trail is not an audit trail.
--   * NO ALTER DEFAULT PRIVILEGES. That would silently cover objects created in this schema in
--     future, which is exactly the kind of grant that stops being reviewed because nobody sees it
--     happen. New tables here get an explicit line in this file or they get nothing.
--   * NO GRANT ... ON ALL TABLES IN SCHEMA, for the same reason: it reads as convenience and behaves
--     as a standing policy over objects that do not exist yet.
--
-- RE-RUNNABLE. GRANT is idempotent in Postgres — re-executing this file changes nothing and errors on
-- nothing. It is safe to run again after any schema.sql application.
--
-- TO UNDO IT, exactly (the matching REVOKE — run in this order, privileges before USAGE):
--
--   REVOKE SELECT ON session_report.specialist_dispatch FROM cp_directus;
--   REVOKE SELECT ON session_report.rotation            FROM cp_directus;
--   REVOKE USAGE  ON SCHEMA session_report              FROM cp_directus;
--
-- After the revoke the Cockpit's /api/rotation-reports returns ok:false with a sentence saying the
-- read role has not been granted access. It does not crash and it takes no other route down.

GRANT USAGE ON SCHEMA session_report TO cp_directus;

GRANT SELECT ON session_report.rotation            TO cp_directus;
GRANT SELECT ON session_report.specialist_dispatch TO cp_directus;
