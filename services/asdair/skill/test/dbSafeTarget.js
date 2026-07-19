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
//
// IMPORTANT (PR #36 Fable finding #1): the target must be resolved with the
// SAME parser pg itself uses (pg-connection-string), NOT `new URL(...).hostname`.
// pg copies `?host=` / `?port=` query params into the connection config and
// only falls back to the URL hostname when config.host is empty. So a URL like
//   postgres://u:p@localhost:5432/db?host=db.xxx.supabase.co
// has hostname 'localhost' (a naive guard says "local") yet pg connects to the
// Supabase host in the query param. We therefore (a) refuse any URL that carries
// a host/port query param outright, and (b) apply the host/db checks to the
// RESOLVED config.host / config.database that pg would actually use.
function assertSafeDbTarget(rawUrl) {
  // (a) Refuse a host/port query-param override BEFORE trusting the parse.
  // pg would let such a param silently redirect the connection away from the
  // URL host, so an ambiguous target like this is never allowed to run.
  try {
    const params = new URL(rawUrl).searchParams;
    if (params.has('host') || params.has('port')) {
      throw new Error(
        'REFUSING to run: ASDAIR_DB_URL carries a host/port query parameter, which pg uses ' +
        'to override the URL host -- this could redirect the connection to a live DB. ' +
        'Refusing this ambiguous target.'
      );
    }
  } catch (e) {
    // Re-throw our own refusal; a plain URL parse failure here is non-fatal
    // because pg-connection-string below is the authoritative parser.
    if (e && e.message && e.message.indexOf('REFUSING to run') === 0) throw e;
  }

  // (b) Resolve host/db exactly as pg does.
  let config;
  try {
    config = require('pg-connection-string').parse(rawUrl);
  } catch (e) {
    throw new Error('ASDAIR_DB_URL is not a parseable connection string; refusing to run the DB test.');
  }
  const host = (config.host || '').toLowerCase();
  const dbName = (config.database || '').toLowerCase();

  // Hard refuse known managed / live hosts outright (on the RESOLVED host).
  if (host.indexOf('supabase') !== -1 || host.indexOf('pooler') !== -1) {
    throw new Error(
      'REFUSING to run: ASDAIR_DB_URL host looks like live Supabase / a pooler ("' + host +
      '"). This test only ever runs against a throwaway / CI Postgres, never live data.'
    );
  }

  // Determine whether the RESOLVED host is safely local. IPv6 loopback is
  // compared as '[::1]' because both WHATWG URL.hostname and pg-connection-string
  // return the bracketed form (finding #3: a bare '::1' check was dead code).
  const LOCAL_HOSTS = ['localhost', '127.0.0.1', '[::1]', '::1'];
  let isLocal;
  if (host === '') {
    // An empty resolved host means pg falls back to PGHOST (if set) or its
    // built-in default (localhost / unix socket). If PGHOST is set we cannot
    // see where it points, so refuse; otherwise treat as truly local.
    if (process.env.PGHOST) {
      throw new Error(
        'REFUSING to run: ASDAIR_DB_URL resolves to an empty host while PGHOST is set, so ' +
        'pg would connect to PGHOST -- which may be a remote/live DB this guard cannot vet. ' +
        'Set an explicit local/throwaway ASDAIR_DB_URL host instead.'
      );
    }
    isLocal = true;
  } else {
    isLocal = LOCAL_HOSTS.indexOf(host) !== -1;
  }

  // Otherwise require an explicitly-safe target: a local host, or a database
  // whose name ends in _test (a conventional throwaway marker).
  const isTestDb = dbName.endsWith('_test');
  if (!isLocal && !isTestDb) {
    throw new Error(
      'REFUSING to run: ASDAIR_DB_URL must point at localhost/127.0.0.1/[::1] or a *_test database ' +
      '(throwaway only). Got host "' + host + '". This test never runs against a remote/live DB.'
    );
  }
}

module.exports = {
  DESTRUCTIVE_OPT_IN_VAR,
  destructiveTestsEnabled,
  assertSafeDbTarget
};
