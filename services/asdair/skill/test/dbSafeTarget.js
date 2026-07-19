// =====================================================================
// IDEA-012 AsdAIr - WP1 skill: dbSafeTarget.js
//
// Shared SAFETY GATING for the DESTRUCTIVE DB-gated tests
// (integration.dbtest.js and constraints.dbtest.js). ONE source of truth
// so both tests are authorised -- and refused -- with identical behaviour.
//
// These tests run DDL such as `DROP SCHEMA IF EXISTS asdair CASCADE` on the
// target database. That is destructive, so gating them safely has TWO
// independent layers:
//
//   PRIMARY GATE (positive, explicit opt-in): destructiveTestsEnabled().
//     The destructive DB tests run ONLY when the operator has EXPLICITLY
//     opted in by setting the dedicated, single-purpose env marker
//     ASDAIR_DB_TEST_ALLOW_DESTRUCTIVE to exactly "1" or "true". This var's
//     SOLE purpose is to authorise destructive DB testing; it is not a
//     general config value, so it cannot be set incidentally in a prod
//     environment. If it is not set, the tests are INERT (clean skip) even
//     if ASDAIR_DB_URL happens to point somewhere -- no connection, no DDL.
//     This is the primary gate because it does NOT rely on any heuristic
//     about the target: hostnames and database names can lie (a `localhost`
//     may be an SSH tunnel to production; a live database can be named
//     `*_test`), but an explicit positive marker cannot be inferred.
//
//   SECONDARY / DEFENCE-IN-DEPTH: assertSafeDbTarget(rawUrl).
//     Even AFTER the opt-in gate passes, this refuses an obviously-live
//     host (supabase / pooler / any non-local, non-*_test target). It is a
//     belt-and-braces backstop, NOT the authority to run -- the opt-in is.
//     It inspects ONLY the host and database name parsed from the URL; the
//     credentials in the URL are NEVER read out or logged. It THROWS (loud
//     failure -- the test fails, never silently proceeds) on an unsafe
//     target.
//
// PURE ASCII only.
// =====================================================================

'use strict';

// Dedicated, single-purpose opt-in marker. Its ONLY meaning is "the
// operator has explicitly authorised destructive DB tests against the
// configured ASDAIR_DB_URL". Nothing else reads it, so it cannot be set
// incidentally by ordinary app/prod configuration.
const DESTRUCTIVE_OPT_IN_VAR = 'ASDAIR_DB_TEST_ALLOW_DESTRUCTIVE';

// PRIMARY GATE. Returns true ONLY when the dedicated opt-in marker is set to
// exactly "1" or "true". Any other value (including unset, "", "0", "yes",
// "TRUE " with whitespace) means NOT opted in -> the destructive tests skip.
// Exact-match on purpose: no fuzzy truthiness that could be tripped by an
// unrelated value leaking in from the environment.
function destructiveTestsEnabled() {
  const raw = process.env[DESTRUCTIVE_OPT_IN_VAR];
  return raw === '1' || raw === 'true';
}

// SECONDARY / DEFENCE-IN-DEPTH. Refuse to run against anything that could be
// live, even once the operator has opted in. Only host / db-name are
// inspected; the credentials in the URL are never read out or logged. Throws
// (loud failure) on an unsafe target -- pointing a DB test at live Supabase
// MUST fail, never silently proceed. NOTE: this is a backstop only; the
// AUTHORITY to run destructive tests is destructiveTestsEnabled(), because a
// hostname / db-name heuristic can be fooled (tunnels, `*_test` live DBs).
function assertSafeDbTarget(rawUrl) {
  let host;
  let dbName;
  try {
    const u = new URL(rawUrl);
    host = (u.hostname || '').toLowerCase();
    dbName = (u.pathname || '').replace(/^\//, '').toLowerCase();
  } catch (e) {
    throw new Error('ASDAIR_DB_URL is not a parseable URL; refusing to run the DB test.');
  }

  // Hard refuse known managed / live hosts outright.
  if (host.indexOf('supabase') !== -1 || host.indexOf('pooler') !== -1) {
    throw new Error(
      'REFUSING to run: ASDAIR_DB_URL host looks like live Supabase / a pooler ("' + host +
      '"). This test only ever runs against a throwaway / CI Postgres, never live data.'
    );
  }

  // Otherwise require an explicitly-safe target: a local host, or a database
  // whose name ends in _test (a conventional throwaway marker).
  const isLocal = host === 'localhost' || host === '127.0.0.1' || host === '::1' || host === '';
  const isTestDb = dbName.endsWith('_test');
  if (!isLocal && !isTestDb) {
    throw new Error(
      'REFUSING to run: ASDAIR_DB_URL must point at localhost/127.0.0.1 or a *_test database ' +
      '(throwaway only). Got host "' + host + '". This test never runs against a remote/live DB.'
    );
  }
}

module.exports = {
  DESTRUCTIVE_OPT_IN_VAR,
  destructiveTestsEnabled,
  assertSafeDbTarget
};
