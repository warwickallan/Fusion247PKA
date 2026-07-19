// =====================================================================
// IDEA-012 AsdAIr - WP1 skill: dbSafeTarget.js
//
// Shared SAFETY GUARD for the DB-gated tests (integration.dbtest.js and
// constraints.dbtest.js). ONE source of truth so both tests refuse an
// unsafe target with identical behaviour (GPT PR #36 review: no live
// Supabase / no live mutation).
//
// assertSafeDbTarget(rawUrl) inspects ONLY the host and the database name
// parsed from ASDAIR_DB_URL. The credentials in the URL are NEVER read out
// or logged. It THROWS (loud failure -- the test fails, never skips) when
// the target could be live:
//   * any host containing 'supabase' or 'pooler', or
//   * any non-local host that is not an explicit *_test database.
// A safe target is localhost / 127.0.0.1 / ::1 (or empty host), OR a
// database whose name ends in _test (a conventional throwaway marker).
//
// PURE ASCII only.
// =====================================================================

'use strict';

// Refuse to run against anything that could be live. Only host / db-name are
// inspected; the credentials in the URL are never read out or logged. Throws
// (loud failure) on an unsafe target -- pointing a DB test at live Supabase
// MUST fail, never silently proceed.
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

module.exports = { assertSafeDbTarget };
