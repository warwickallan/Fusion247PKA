-- BUILD-006 Phase 1 — reverse 001_vlogops_content_seed.sql, and reverse NOTHING else.
--
-- One statement, one namespace. The cascade reaches the tables, indexes, constraints,
-- triggers and the trigger function created by 001 because every one of them was created
-- inside this namespace and nowhere else. No other namespace is named here, which is the
-- property that makes this safe to run against a database that holds unrelated live data.
--
-- Re-runnable: `if exists` makes a second application a no-op rather than an error.

drop schema if exists vlogops cascade;
