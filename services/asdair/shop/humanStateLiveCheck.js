// =====================================================================
// BUILD-015 AsdAIr - shop/humanStateLiveCheck.js
//
// THE AC1 SEAM PROOF, RUN AGAINST REAL DATA. READ-ONLY, ALWAYS.
//
//   node --env-file=<the asdair env file> humanStateLiveCheck.js
//
// WHAT THIS PROVES, AND WHAT IT DELIBERATELY DOES NOT
//
// WP-B15-35 AC1 asks for proof by EXECUTION that "the value written is the
// value read back" for asdair.shop.human_state. A literal write-then-read
// against the live household database is FORBIDDEN - a write to live data is
// one of the three things no Work Order authority ever reaches - and no
// disposable Postgres exists on this machine. A rolled-back write is equally
// forbidden: an UPDATE inside a rollback is still an UPDATE.
//
// So this check proves the seam the only honest way available to it:
//
//   FOR EVERY REAL ROW, the value the writer WOULD persist for that row -
//   computed by calling the production mapping, humanState.humanStateFor(),
//   the same function shopStore.js calls inside the transition - is compared
//   with the value actually stored in the column.
//
// That is a genuine execution proof of the mapping against real rows and the
// real column. It is NOT a proof that the write statement fires; that half is
// proven by shopStore.test.js against a scripted client, and is reported as
// test-and-wiring proven rather than live-proven. Do not let this file be
// described as more than it is.
//
// TWO CONDITIONS MAKE IT A CHECK RATHER THAN A CEREMONY
//
//   1. IT ASSERTS A NON-ZERO ROW COUNT. A comparison over zero rows passes
//      trivially and proves nothing whatsoever.
//   2. IT REPORTS, EXPLICITLY, WHETHER human_state IS NULL/ABSENT ON EVERY
//      ROW. Nothing writes that column until this Work Package's change is
//      deployed AND migration 020 is applied, so the naive form of the
//      comparison ("no row disagrees") passes against a column that is empty
//      everywhere - a green proving nothing. That case is reported as
//      NOT PROVEN, never as a pass.
//
// EXIT CODES
//   0  PROVEN         - rows exist, the column is populated, every row agrees.
//   0  NOT PROVEN     - rows exist but the column is absent or empty. This is
//                       a FINDING, printed loudly, and it is the state AC1
//                       exists to fix. It is not an error in this script, so
//                       it does not fail the run.
//   1  DISAGREEMENT   - a stored value differs from what the writer would
//                       write. The seam is genuinely broken. Fail loudly.
//   2  COULD NOT RUN  - no connection, no rows, or the query failed. Never
//                       reported as either of the above.
//
// SECRETS: the connection string is read from process.env.ASDAIR_DB_URL (the
// SELECT-only asdair_ro role) and is never printed, logged or interpolated
// into output. This file names the variable and never its value.
//
// PURE ASCII only.
// =====================================================================

'use strict';

const { humanStateFor, isHumanState } = require('./humanState');

// The tolerant read: `to_jsonb(s) ->> 'human_state'` yields the value where
// migration 020 has been applied and SQL NULL where it has not, without
// erroring on a database that has never seen the column.
const SQL =
  'SELECT id, shop_ref, status, needs_review, ' +
  "to_jsonb(s) ->> 'human_state' AS human_state " +
  'FROM asdair.shop s ORDER BY id';

const COLUMN_SQL =
  "SELECT 1 FROM information_schema.columns " +
  "WHERE table_schema = 'asdair' AND table_name = 'shop' AND column_name = 'human_state'";

function out(line) { process.stdout.write(line + '\n'); }

async function main() {
  const url = process.env.ASDAIR_DB_URL;
  if (!url || String(url).trim() === '') {
    out('COULD NOT RUN: ASDAIR_DB_URL is not set. Pass the asdair env file with node --env-file.');
    return 2;
  }

  const { Client } = require('pg');
  const client = new Client({ connectionString: url });

  try {
    await client.connect();
  } catch (err) {
    out('COULD NOT RUN: could not connect as the read role. ' + String(err.message));
    return 2;
  }

  try {
    // Belt and braces: this whole check is read-only by construction, and the
    // transaction says so to the server as well as to the reader.
    await client.query('BEGIN TRANSACTION READ ONLY');

    const role = (await client.query('SELECT current_user AS u')).rows[0].u;
    const columnPresent = (await client.query(COLUMN_SQL)).rowCount === 1;
    const rows = (await client.query(SQL)).rows;

    out('role                        : ' + role);
    out('asdair.shop.human_state     : ' + (columnPresent ? 'PRESENT' : 'ABSENT (migration 020 not applied)'));
    out('rows examined               : ' + rows.length);

    // CONDITION 1. A check over nothing is not a check.
    if (rows.length === 0) {
      out('');
      out('COULD NOT RUN: asdair.shop has ZERO rows. A comparison over zero rows passes trivially ' +
        'and proves nothing, so this is reported as unrun rather than as a pass.');
      return 2;
    }

    const populated = rows.filter((r) => isHumanState(r.human_state));
    const empty = rows.length - populated.length;

    out('rows with a stored value    : ' + populated.length);
    out('rows with NULL/absent value : ' + empty);
    out('');

    // Compare on every row that HAS a value. The mapping is exercised on every
    // row regardless, so a mapping that throws on a real status still fails.
    const disagreements = [];
    for (const r of rows) {
      const expected = humanStateFor(r.status, { needs_review: r.needs_review });
      if (isHumanState(r.human_state) && r.human_state !== expected) {
        disagreements.push({ shop_ref: r.shop_ref, status: r.status, stored: r.human_state, expected: expected });
      }
    }

    // What the writer WOULD write, over the real distribution of statuses.
    // Printed because it is the part a human can sanity-check by eye.
    const wouldWrite = new Map();
    for (const r of rows) {
      const k = r.status + ' -> ' + humanStateFor(r.status, { needs_review: r.needs_review });
      wouldWrite.set(k, (wouldWrite.get(k) || 0) + 1);
    }
    out('what the writer would persist, over the real rows:');
    for (const [k, n] of [...wouldWrite.entries()].sort()) out('  ' + k + '   x' + n);
    out('');

    if (disagreements.length > 0) {
      out('DISAGREEMENT: ' + disagreements.length + ' row(s) store a value the writer would not write.');
      for (const d of disagreements) {
        out('  ' + d.shop_ref + ': status=' + d.status + ' stored=' + d.stored + ' expected=' + d.expected);
      }
      return 1;
    }

    // CONDITION 2. Say plainly when the column proves nothing yet.
    if (populated.length === 0) {
      out('NOT PROVEN - and this is the finding, not a failure of the check.');
      out('');
      out('  Every one of the ' + rows.length + ' real rows has NO stored human_state, so "no row ' +
        'disagrees" is true of nothing. The round trip CANNOT be proven live until:');
      out('    1. migration 020 is applied to this database' +
        (columnPresent ? ' (done - the column exists)' : ' (NOT DONE - the column does not exist)') + ', and');
      out('    2. this Work Package\'s writer runs at least one status transition.');
      out('');
      out('  The write half is proven by test and by wiring only (shopStore.test.js: the transition ' +
        'emits human_state in the SAME statement as status). It is NOT live-proven, and must not be ' +
        'reported as though it were.');
      return 0;
    }

    out('PROVEN: all ' + populated.length + ' populated row(s) store exactly the value the production ' +
      'mapping would write for them. The reader and the writer share one function, so the seam holds.');
    return 0;
  } catch (err) {
    out('COULD NOT RUN: ' + String(err.message));
    return 2;
  } finally {
    try { await client.query('ROLLBACK'); } catch { /* read-only; nothing to undo */ }
    try { await client.end(); } catch { /* closing is best-effort */ }
  }
}

main().then((code) => { process.exitCode = code; }).catch((err) => {
  out('COULD NOT RUN: ' + String(err && err.message ? err.message : err));
  process.exitCode = 2;
});
