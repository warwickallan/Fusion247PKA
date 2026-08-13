// =====================================================================
// BUILD-015 AsdAIr Stage 1 - fakeClient.js
//
// A scripted stand-in for a `pg` client, used by the offline tests.
//
// WHY IT LOOKS LIKE THIS: the guarantees this module is built to provide are
// about the ORDER and SHAPE of statements - that the UPDATE and its audit
// event are in the same transaction, that the create is an insert-first
// (never a check-then-insert), that the claim is ONE statement. A fake that
// records every statement in order is the only way to prove those without a
// database, and the tests assert on `client.log`.
//
// It is deliberately NOT a Postgres emulator. It never evaluates SQL; it
// matches a statement against a script and returns the rows that step says.
// An unscripted statement is an ERROR, so a test cannot accidentally pass by
// running queries nobody thought about.
//
// Not a test file itself (the name does not match node --test's patterns), so
// it is loaded by the tests rather than run as one.
//
// PURE ASCII only.
// =====================================================================

'use strict';

// Transaction CONTROL, not data. Savepoints were added WP-B15-35: an optional
// read (a table not every database has yet) must be able to fail without
// aborting the surrounding snapshot, and in Postgres only a savepoint achieves
// that. None of these reads or writes a row.
const TRANSACTION_STATEMENTS = [
  'BEGIN', 'COMMIT', 'ROLLBACK', 'BEGIN TRANSACTION READ ONLY',
  'SAVEPOINT optional_read', 'RELEASE SAVEPOINT optional_read', 'ROLLBACK TO SAVEPOINT optional_read',
];

// ⚠️ GENERALISED WP-B15-41. The list above names ONE savepoint by hand, so the
// next module to open a differently-named savepoint broke every test using this
// fake - with an error pointing at the fake rather than at anything real. (It
// did: `SAVEPOINT provenance_probe`, added for AC9's schema probe.)
//
// A savepoint is transaction CONTROL whatever it is called: it reads no row and
// writes none, so a script has nothing to say about it and a test has nothing
// useful to assert about its return. Matching the SHAPE means the next one
// needs no edit here - naming today's case in a list is not a fix for a class.
//
// The identifier pattern is deliberately narrow (one bare, unquoted, lowercase
// identifier) so this can never swallow a statement that does touch data.
const SAVEPOINT_RE = /^(SAVEPOINT|RELEASE SAVEPOINT|ROLLBACK TO SAVEPOINT) [a-z_][a-z0-9_]*$/i;

function isTransactionControl(sql) {
  return TRANSACTION_STATEMENTS.indexOf(sql) !== -1 || SAVEPOINT_RE.test(String(sql).trim());
}

// script: [{ match: string|RegExp, rows: array|function(params), repeat?: true }]
// Steps are matched in order and CONSUMED unless `repeat` is set, so a script
// can say "the insert returns nothing, then the re-select finds the row".
function makeClient(script) {
  const log = [];
  const remaining = (script || []).slice();

  return {
    log: log,
    remaining: remaining,
    released: false,

    query: async function (sql, params) {
      log.push({ sql: sql, params: params || [] });

      if (isTransactionControl(sql)) {
        return { rows: [], rowCount: 0 };
      }

      for (let i = 0; i < remaining.length; i++) {
        const step = remaining[i];
        const hit = step.match instanceof RegExp
          ? step.match.test(sql)
          : sql.indexOf(step.match) !== -1;
        if (!hit) continue;
        if (!step.repeat) remaining.splice(i, 1);
        const rows = typeof step.rows === 'function' ? step.rows(params || []) : (step.rows || []);
        return { rows: rows, rowCount: rows.length };
      }

      throw new Error('fakeClient: no scripted response for statement:\n' + sql);
    },

    release: function () { this.released = true; }
  };
}

// The statements a client saw, transaction markers included, in order.
function statements(client) {
  return client.log.map(function (entry) { return entry.sql; });
}

// The first N words of each statement - enough to assert on shape without
// pinning every character of the SQL.
function shapes(client) {
  return statements(client).map(function (sql) {
    return sql.replace(/\s+/g, ' ').trim().split(' ').slice(0, 4).join(' ');
  });
}

function countMatching(client, needle) {
  return statements(client).filter(function (sql) {
    return needle instanceof RegExp ? needle.test(sql) : sql.indexOf(needle) !== -1;
  }).length;
}

function indexOfMatching(client, needle) {
  return statements(client).findIndex(function (sql) {
    return needle instanceof RegExp ? needle.test(sql) : sql.indexOf(needle) !== -1;
  });
}

module.exports = {
  makeClient: makeClient,
  statements: statements,
  shapes: shapes,
  countMatching: countMatching,
  indexOfMatching: indexOfMatching,
  isTransactionControl: isTransactionControl,
  SAVEPOINT_RE: SAVEPOINT_RE
};
