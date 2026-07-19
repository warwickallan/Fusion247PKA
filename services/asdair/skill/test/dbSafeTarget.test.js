// =====================================================================
// IDEA-012 AsdAIr - WP1 skill: dbSafeTarget.test.js
//
// Runs under: node --test
//
// PURE unit tests for the DB-test SAFETY GUARD (dbSafeTarget.js). This file
// opens NO database, NO network, NO pg connection -- it only exercises the two
// pure functions:
//   * destructiveTestsEnabled() -- the PRIMARY positive opt-in marker check.
//   * assertSafeDbTarget()      -- the SECONDARY defence-in-depth host/db check,
//                                  resolved with the SAME parser pg uses.
//
// WHY (PR #36 Fable review):
//   The guard shipped with ZERO tests (finding #4), and had two real bypasses:
//   #1 a `?host=` / empty-host+PGHOST redirect that pg honours but a naive
//   `new URL().hostname` guard missed, and #3 a dead '::1' IPv6 check. These
//   tests pin all of that down. The bypass cases below FAIL against the pre-fix
//   guard (which read `new URL(rawUrl).hostname` and so saw 'localhost' for the
//   redirect URL, throwing nothing) and PASS against the fixed guard.
//
// PURE ASCII only. Synthetic hosts / db names only; no real credentials.
// =====================================================================

'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const {
  DESTRUCTIVE_OPT_IN_VAR,
  destructiveTestsEnabled,
  assertSafeDbTarget
} = require('./dbSafeTarget.js');

// Run fn with process.env[name] temporarily set to value (undefined => unset),
// restoring the prior value afterward no matter what.
function withEnv(name, value, fn) {
  const had = Object.prototype.hasOwnProperty.call(process.env, name);
  const prior = process.env[name];
  try {
    if (value === undefined) {
      delete process.env[name];
    } else {
      process.env[name] = value;
    }
    return fn();
  } finally {
    if (had) {
      process.env[name] = prior;
    } else {
      delete process.env[name];
    }
  }
}

// ---------------------------------------------------------------------
// destructiveTestsEnabled(): EXACT match on '1' or 'true' only.
// ---------------------------------------------------------------------
test('destructiveTestsEnabled: exact "1" and "true" opt in; everything else refuses', function () {
  // ACCEPT: the only two authorised markers.
  ['1', 'true'].forEach(function (v) {
    withEnv(DESTRUCTIVE_OPT_IN_VAR, v, function () {
      assert.equal(destructiveTestsEnabled(), true, JSON.stringify(v) + ' must opt in');
    });
  });

  // REFUSE: fuzzy truthiness, whitespace, case variants, off values, empty.
  ['TRUE ', 'True', ' true', 'yes', '0', '2', 'on', '', ' '].forEach(function (v) {
    withEnv(DESTRUCTIVE_OPT_IN_VAR, v, function () {
      assert.equal(destructiveTestsEnabled(), false, JSON.stringify(v) + ' must NOT opt in');
    });
  });

  // REFUSE: unset entirely.
  withEnv(DESTRUCTIVE_OPT_IN_VAR, undefined, function () {
    assert.equal(destructiveTestsEnabled(), false, 'unset must NOT opt in');
  });
});

// ---------------------------------------------------------------------
// assertSafeDbTarget(): ACCEPT cases (must NOT throw).
// PGHOST is cleared for these so an empty-host case is judged truly local.
// ---------------------------------------------------------------------
test('assertSafeDbTarget: accepts local hosts and *_test databases', function () {
  withEnv('PGHOST', undefined, function () {
    const ok = [
      'postgres://u:pw@localhost:5432/postgres',
      'postgres://u:pw@127.0.0.1:5432/postgres',
      'postgres://u:pw@[::1]:5432/postgres',        // finding #3: bracketed IPv6 loopback
      'postgres://u:pw@a-remote-host:5432/app_test' // remote host but explicit *_test throwaway
    ];
    ok.forEach(function (url) {
      assert.doesNotThrow(function () { assertSafeDbTarget(url); }, 'should accept ' + url);
    });
  });
});

test('assertSafeDbTarget: empty host is local ONLY when PGHOST is unset', function () {
  withEnv('PGHOST', undefined, function () {
    assert.doesNotThrow(
      function () { assertSafeDbTarget('postgres:///postgres'); },
      'empty host with no PGHOST is treated as local'
    );
  });
});

// ---------------------------------------------------------------------
// assertSafeDbTarget(): REFUSE cases (must throw).
// ---------------------------------------------------------------------
test('assertSafeDbTarget: refuses live Supabase / pooler hosts', function () {
  withEnv('PGHOST', undefined, function () {
    assert.throws(
      function () { assertSafeDbTarget('postgres://u:pw@db.abc.supabase.co:5432/postgres'); },
      /REFUSING to run/,
      'supabase host must be refused'
    );
    assert.throws(
      function () { assertSafeDbTarget('postgres://u:pw@aws-0-eu.pooler.supabase.com:6543/postgres'); },
      /REFUSING to run/,
      'pooler host must be refused'
    );
  });
});

test('assertSafeDbTarget: refuses a non-local host that is not a *_test database', function () {
  withEnv('PGHOST', undefined, function () {
    assert.throws(
      function () { assertSafeDbTarget('postgres://u:pw@example.com:5432/appdb'); },
      /REFUSING to run/,
      'non-local non-_test target must be refused'
    );
  });
});

test('assertSafeDbTarget: refuses the ?host= query-param bypass (finding #1)', function () {
  // pg copies ?host= into config and connects THERE; a naive hostname guard
  // sees only 'localhost'. This MUST be refused. (Fails against the pre-fix
  // guard, which threw nothing for this URL.)
  withEnv('PGHOST', undefined, function () {
    assert.throws(
      function () {
        assertSafeDbTarget('postgres://u:pw@localhost:5432/postgres?host=db.abc.supabase.co');
      },
      /REFUSING to run/,
      'a ?host= override that redirects pg to a live host must be refused'
    );
    // Also refuse a ?port= override on principle (ambiguous target).
    assert.throws(
      function () {
        assertSafeDbTarget('postgres://u:pw@localhost/postgres?port=6543');
      },
      /REFUSING to run/,
      'a ?port= override must be refused'
    );
  });
});

test('assertSafeDbTarget: refuses empty host when PGHOST is set (finding #1)', function () {
  // Empty URL host + PGHOST set => pg falls back to PGHOST (may be remote).
  withEnv('PGHOST', 'db.abc.supabase.co', function () {
    assert.throws(
      function () { assertSafeDbTarget('postgres:///postgres'); },
      /REFUSING to run/,
      'empty host with PGHOST set must be refused'
    );
  });
});

test('assertSafeDbTarget: refuses an unparseable / non-local garbage target', function () {
  withEnv('PGHOST', undefined, function () {
    assert.throws(
      function () { assertSafeDbTarget('not a url at all'); },
      /REFUSING to run|not a parseable/,
      'garbage that resolves to a non-local host must be refused'
    );
    assert.throws(
      function () { assertSafeDbTarget(''); },
      /REFUSING to run|not a parseable/,
      'empty string must be refused'
    );
  });
});
