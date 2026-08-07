#!/usr/bin/env node
/**
 * WO-28 — executed proof that session_report.specialist_dispatch cannot duplicate on re-run.
 *
 * WHAT THIS PROVES, AND AGAINST WHAT. Every assertion below runs against a REAL, DISPOSABLE
 * PostgreSQL cluster created by this script in a temp directory, started on a private loopback port,
 * and destroyed on exit. It never reaches Supabase, uses no credentials and no network.
 *
 * WHY A REAL CLUSTER RATHER THAN A MODEL. "exactly one row per (rotation_id, specialist)" and "no
 * duplicate-key error is raised" are properties of Postgres, not properties of a string. Asserting
 * them against a hand-written model of ON CONFLICT would prove only that the model agrees with the
 * SQL that was written to satisfy it. The unique index, the conflict inference, the NOT NULL on
 * `dispatches`, the NULL-vs-0 distinction and the duplicate-key error are all enforced here by
 * PostgreSQL itself.
 *
 * WHAT IT DOES NOT PROVE. It does not prove anything about the live Supabase instance: not that the
 * index has been applied there, not that the live table is clean, and not that a live re-run leaves
 * the counts unchanged. That test needs the real database and is Larry's.
 *
 * THE EXECUTED-HELPER TECHNIQUE (WO-25). populate.mjs invokes main() at module load, so importing it
 * directly would try to read credentials and exit. This script copies the file, removes ONLY that
 * trailing invocation, and asserts byte-for-byte that nothing else differs — so the functions
 * exercised below are the shipped functions, not a re-implementation of them.
 *
 * Usage:  node tools/session-report/idempotency-check.mjs
 * Exit:   0 = every check executed and passed · 1 = a check failed · 2 = the harness could not run
 */
import { readFileSync, writeFileSync, mkdtempSync, rmSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { randomBytes } from 'node:crypto';

const __dirname = dirname(fileURLToPath(import.meta.url));
const POPULATE = join(__dirname, 'populate.mjs');
const SCHEMA = join(__dirname, 'schema.sql');

/* ─── the runner ─────────────────────────────────────────────────────────────────────────────── */

let executed = 0;
let failed = 0;
const failures = [];

function check(name, fn) {
  executed++;
  try {
    fn();
    process.stdout.write(`  ok   ${executed}  ${name}\n`);
  } catch (err) {
    failed++;
    failures.push({ name, message: String(err && err.message ? err.message : err) });
    process.stdout.write(`  FAIL ${executed}  ${name}\n         ${String(err && err.message ? err.message : err)}\n`);
  }
}

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}
function assertEq(actual, expected, msg) {
  if (actual !== expected) throw new Error(`${msg} — expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
}

function die(why, detail) {
  process.stderr.write(`HARNESS COULD NOT RUN: ${why}\n${detail ?? ''}\n`);
  process.exit(2);
}

/* ─── the executed-helper copy: strip ONLY main()'s invocation ───────────────────────────────── */

const ORIGINAL_SRC = readFileSync(POPULATE, 'utf8');

const INVOCATION_LF = `main().catch((e) => {
  process.stderr.write(JSON.stringify({ ok: false, why: 'exception', message: String(e?.message || e) }) + '\\n');
  process.exit(1);
});
`;

// populate.mjs is checked in with CRLF endings on this machine. The comparison stays byte-exact —
// the literal is converted to the file's own line ending rather than the file being normalised,
// because normalising the file would defeat the whole point of a byte-identity assertion.
const EOL = ORIGINAL_SRC.includes('\r\n') ? '\r\n' : '\n';
const INVOCATION = EOL === '\r\n' ? INVOCATION_LF.replace(/\n/g, '\r\n') : INVOCATION_LF;

if (!ORIGINAL_SRC.endsWith(INVOCATION)) {
  die(
    'populate.mjs does not end with the exact main() invocation this check knows how to strip',
    'The technique asserts byte-identity of everything else; a changed tail must be re-read by a human, not guessed at.',
  );
}
const STRIPPED_SRC = ORIGINAL_SRC.slice(0, ORIGINAL_SRC.length - INVOCATION.length);

const workDir = mkdtempSync(join(tmpdir(), 'wo28-idempotency-'));
const copyPath = join(workDir, 'populate.under-test.mjs');
writeFileSync(copyPath, STRIPPED_SRC, 'utf8');

const { specialistRows, specialistWriteSql, woTotal } = await import(pathToFileURL(copyPath).href);

/* ─── the disposable cluster ─────────────────────────────────────────────────────────────────── */

// A random port in the ephemeral range, retried on collision. Node has no synchronous "is this port
// free" call, so the honest approach is to attempt the bind and react to the failure rather than to
// ask a question whose answer would be stale by the time the server started anyway.
function randomPort() {
  return 49152 + Math.floor(Math.random() * 16000);
}

const PGDATA = join(workDir, 'pgdata');
let PGPORT = String(randomPort());
let clusterUp = false;

function pgctl(...args) {
  return spawnSync('pg_ctl', ['-D', PGDATA, ...args], { encoding: 'utf8', timeout: 120_000, windowsHide: true });
}

function startCluster() {
  mkdirSync(PGDATA, { recursive: true });
  const init = spawnSync(
    'initdb',
    ['-D', PGDATA, '-U', 'postgres', '-A', 'trust', '--encoding=UTF8', '--no-locale'],
    { encoding: 'utf8', timeout: 180_000, windowsHide: true },
  );
  if (init.status !== 0) die('initdb failed', (init.stderr || '') + (init.stdout || ''));

  let lastLog = '';
  for (let attempt = 1; attempt <= 5; attempt++) {
    const logPath = join(workDir, `pg-${attempt}.log`);
    const start = pgctl('-o', `-p ${PGPORT} -h 127.0.0.1`, '-l', logPath, '-w', 'start');
    if (start.status === 0) {
      clusterUp = true;
      return;
    }
    try { lastLog = readFileSync(logPath, 'utf8'); } catch { lastLog = ''; }
    if (!/address (already )?in use|could not bind/i.test(lastLog + start.stderr)) {
      die('pg_ctl start failed', (start.stderr || '') + (start.stdout || '') + '\n--- server log ---\n' + lastLog);
    }
    PGPORT = String(randomPort()); // port collision only — try another
  }
  die('pg_ctl start failed after 5 port attempts', lastLog);
}

function stopCluster() {
  if (clusterUp) {
    pgctl('-m', 'immediate', '-w', 'stop');
    clusterUp = false;
  }
  try { rmSync(workDir, { recursive: true, force: true, maxRetries: 5 }); } catch { /* best effort */ }
}

process.on('exit', stopCluster);

/** Run SQL text. Returns { status, stdout, stderr }. ON_ERROR_STOP=1, so any error is a non-zero status. */
function sql(text) {
  const f = join(workDir, `q-${randomBytes(6).toString('hex')}.sql`);
  writeFileSync(f, text, 'utf8');
  const r = spawnSync(
    'psql',
    ['-h', '127.0.0.1', '-p', PGPORT, '-U', 'postgres', '-d', 'postgres',
     '-v', 'ON_ERROR_STOP=1', '-q', '-t', '-A', '-F', '|', '-f', f],
    { encoding: 'utf8', timeout: 60_000, windowsHide: true },
  );
  return { status: r.status, stdout: (r.stdout || '').trim(), stderr: (r.stderr || '').trim() };
}

/** Run SQL that must succeed; throws with the server's own message otherwise. */
function sqlOk(text) {
  const r = sql(text);
  if (r.status !== 0) throw new Error(`psql exited ${r.status}: ${r.stderr}`);
  return r.stdout;
}

/** One scalar. */
function scalar(query) {
  return sqlOk(query);
}

/** Rows as arrays of column strings. NULL renders as the empty string under -t -A, so callers that
 *  care about NULL-vs-empty ask the server directly with `IS NULL`, never by inspecting text. */
function rows(query) {
  const out = sqlOk(query);
  return out === '' ? [] : out.split(/\r?\n/).map((l) => l.split('|'));
}

/* ─── fixtures ───────────────────────────────────────────────────────────────────────────────── */

// The real production payload shape. Read-only input; never modified on disk.
const REAL_PAYLOAD = JSON.parse(
  readFileSync(join(__dirname, '..', '..', 'Deliverables', '2026-08-07-session-report-payload-subphase-4a.json'), 'utf8'),
);

const clone = (o) => JSON.parse(JSON.stringify(o));

/* ─── run ────────────────────────────────────────────────────────────────────────────────────── */

process.stdout.write('WO-28 session_report idempotency — executed against a disposable local PostgreSQL cluster\n');
startCluster();
process.stdout.write(`  cluster: 127.0.0.1:${PGPORT}  (disposable, destroyed on exit)\n\n`);

const SCHEMA_TEXT = readFileSync(SCHEMA, 'utf8');

check('populate.mjs copy differs from the shipped file by EXACTLY the main() invocation and nothing else', () => {
  assertEq(STRIPPED_SRC + INVOCATION, ORIGINAL_SRC, 'stripped copy + invocation must reconstruct the original byte-for-byte');
  assert(!STRIPPED_SRC.includes('main().catch('), 'the copy must not still invoke main()');
  assert(typeof specialistWriteSql === 'function', 'specialistWriteSql must be the shipped export');
  assert(typeof specialistRows === 'function', 'specialistRows must be the shipped export');
  assert(typeof woTotal === 'function', 'unrelated shipped exports must survive the strip');
});

check('schema.sql applies cleanly to an empty database', () => {
  const r = sql(SCHEMA_TEXT);
  assertEq(r.status, 0, `schema.sql must apply: ${r.stderr}`);
});

check('schema.sql applies a SECOND time cleanly — populate.mjs re-applies it on EVERY run', () => {
  const r = sql(SCHEMA_TEXT);
  assertEq(r.status, 0, `re-application must not error (this is what CREATE UNIQUE INDEX IF NOT EXISTS buys; a bare ADD CONSTRAINT would abort here): ${r.stderr}`);
});

check('the unique index on (rotation_id, specialist) exists and is UNIQUE', () => {
  const n = scalar(`SELECT count(*) FROM pg_indexes
    WHERE schemaname='session_report' AND tablename='specialist_dispatch'
      AND indexname='session_report_specialist_dispatch_rotation_specialist_idx';`);
  assertEq(n, '1', 'the named index must exist');
  const def = scalar(`SELECT indexdef FROM pg_indexes
    WHERE indexname='session_report_specialist_dispatch_rotation_specialist_idx';`);
  assert(/CREATE UNIQUE INDEX/i.test(def), `index must be UNIQUE, got: ${def}`);
  assert(/\(rotation_id, specialist\)/.test(def), `index must cover exactly (rotation_id, specialist), got: ${def}`);
});

check('the primary key is untouched — still id uuid, no surrogate added', () => {
  const cols = scalar(`SELECT string_agg(a.attname, ',' ORDER BY a.attname)
    FROM pg_index i JOIN pg_attribute a ON a.attrelid=i.indrelid AND a.attnum = ANY(i.indkey)
    WHERE i.indrelid='session_report.specialist_dispatch'::regclass AND i.indisprimary;`);
  assertEq(cols, 'id', 'primary key must remain the single id column');
});

check('AC8 — tokens column exists, is bigint and is NULLABLE', () => {
  const r = rows(`SELECT data_type, is_nullable FROM information_schema.columns
    WHERE table_schema='session_report' AND table_name='specialist_dispatch' AND column_name='tokens';`);
  assertEq(r.length, 1, 'tokens column must exist');
  assertEq(r[0][0], 'bigint', 'tokens must be bigint');
  assertEq(r[0][1], 'YES', 'tokens must be nullable — NULL means not established');
});

// Two rotations. The second exists solely to prove the prune never reaches beyond its own rotation.
const ROT_A = sqlOk(`INSERT INTO session_report.rotation (session_date, branch, closing_head, map_path, deliverable_path)
  VALUES ('2026-08-07','build-020/phase4-automation-law','${'a'.repeat(40)}','map.md','deliv-a.md') RETURNING id;`);
const ROT_B = sqlOk(`INSERT INTO session_report.rotation (session_date, branch, closing_head, map_path, deliverable_path)
  VALUES ('2026-08-07','build-020/phase4-automation-law','${'b'.repeat(40)}','map.md','deliv-b.md') RETURNING id;`);

check('fixture — two rotation rows created, and the real 4A payload carries 5 specialists / 15 dispatches', () => {
  assert(/^[0-9a-f-]{36}$/i.test(ROT_A), 'rotation A id');
  assert(/^[0-9a-f-]{36}$/i.test(ROT_B), 'rotation B id');
  assertEq(REAL_PAYLOAD.specialists.length, 5, 'the real payload must carry 5 specialists');
  assertEq(REAL_PAYLOAD.specialists.reduce((a, s) => a + (s.dispatches || 0), 0), 15, 'dispatches must sum to 15');
});

// Rotation B is populated once and never touched again — the control for prune scoping.
sqlOk(specialistWriteSql(ROT_B, REAL_PAYLOAD));

check('AC4 — first write of the real payload produces exactly one row per specialist', () => {
  assertEq(scalar(`SELECT count(*) FROM session_report.specialist_dispatch WHERE rotation_id='${ROT_A}';`), '0', 'precondition: rotation A empty');
  const r = sql(specialistWriteSql(ROT_A, REAL_PAYLOAD));
  assertEq(r.status, 0, `first write must succeed: ${r.stderr}`);
  assertEq(scalar(`SELECT count(*) FROM session_report.specialist_dispatch WHERE rotation_id='${ROT_A}';`), '5', 'five rows after first write');
  assertEq(scalar(`SELECT sum(dispatches)::text FROM session_report.specialist_dispatch WHERE rotation_id='${ROT_A}';`), '15', 'dispatch total must be 15');
});

check('AC4 — THE HEADLINE: re-running the identical payload changes no count and raises no duplicate-key error', () => {
  const r = sql(specialistWriteSql(ROT_A, REAL_PAYLOAD));
  assertEq(r.status, 0, `re-run must not raise a duplicate-key error: ${r.stderr}`);
  assert(!/duplicate key/i.test(r.stderr), `re-run must not report a duplicate key: ${r.stderr}`);
  assertEq(scalar(`SELECT count(*) FROM session_report.specialist_dispatch WHERE rotation_id='${ROT_A}';`), '5', 'STILL five rows — this is the defect being fixed');
  assertEq(scalar(`SELECT sum(dispatches)::text FROM session_report.specialist_dispatch WHERE rotation_id='${ROT_A}';`), '15', 'STILL 15, not 30');
});

check('AC4 — a third and fourth run are equally inert', () => {
  sqlOk(specialistWriteSql(ROT_A, REAL_PAYLOAD));
  sqlOk(specialistWriteSql(ROT_A, REAL_PAYLOAD));
  assertEq(scalar(`SELECT count(*) FROM session_report.specialist_dispatch WHERE rotation_id='${ROT_A}';`), '5', 'still five rows after four total runs');
});

check('AC8 — the measured `tokens` total is mirrored, not discarded', () => {
  const veritas = REAL_PAYLOAD.specialists.find((s) => s.specialist === 'veritas');
  assertEq(scalar(`SELECT tokens::text FROM session_report.specialist_dispatch WHERE rotation_id='${ROT_A}' AND specialist='veritas';`), String(veritas.tokens), 'veritas tokens must be mirrored verbatim');
  assertEq(scalar(`SELECT count(*) FROM session_report.specialist_dispatch WHERE rotation_id='${ROT_A}' AND tokens IS NULL;`), '0', 'every specialist in this payload carries a measured total');
});

check('AC2 — an absent value writes SQL NULL, never 0: tokens_in / tokens_out stay NULL', () => {
  assertEq(scalar(`SELECT count(*) FROM session_report.specialist_dispatch WHERE rotation_id='${ROT_A}' AND tokens_in IS NULL AND tokens_out IS NULL;`), '5', 'the payload carries no in/out split, so all five must be NULL');
  assertEq(scalar(`SELECT count(*) FROM session_report.specialist_dispatch WHERE rotation_id='${ROT_A}' AND (tokens_in = 0 OR tokens_out = 0);`), '0', 'NOT ZERO — a fabricated 0 would be indistinguishable from a measurement of zero');
});

check('AC2 — a NULL `tokens` survives as NULL, and does not inherit a previous run\'s value', () => {
  const p = clone(REAL_PAYLOAD);
  delete p.specialists.find((s) => s.specialist === 'keel').tokens;
  sqlOk(specialistWriteSql(ROT_A, p));
  assertEq(scalar(`SELECT count(*) FROM session_report.specialist_dispatch WHERE rotation_id='${ROT_A}' AND specialist='keel' AND tokens IS NULL;`), '1', 'a value removed from the payload must become NULL, not linger');
  sqlOk(specialistWriteSql(ROT_A, REAL_PAYLOAD)); // restore for the next checks
});

check('AC4 — a re-run with CHANGED values leaves one row per key carrying the SECOND run\'s values', () => {
  const p2 = clone(REAL_PAYLOAD);
  const pax = p2.specialists.find((s) => s.specialist === 'pax');
  pax.dispatches = 99;
  pax.tokens = 12345;
  pax.notes = 'second run';
  const r = sql(specialistWriteSql(ROT_A, p2));
  assertEq(r.status, 0, `second-run write must succeed: ${r.stderr}`);
  assertEq(scalar(`SELECT count(*) FROM session_report.specialist_dispatch WHERE rotation_id='${ROT_A}';`), '5', 'still exactly five rows');
  const row = rows(`SELECT dispatches::text, tokens::text, notes FROM session_report.specialist_dispatch WHERE rotation_id='${ROT_A}' AND specialist='pax';`);
  assertEq(row.length, 1, 'exactly one pax row');
  assertEq(row[0][0], '99', 'dispatches must be the second run\'s value');
  assertEq(row[0][1], '12345', 'tokens must be the second run\'s value');
  assertEq(row[0][2], 'second run', 'notes must be the second run\'s value');
});

check('AC3 — a specialist DROPPED from a later payload is removed, not left to linger', () => {
  const p3 = clone(REAL_PAYLOAD);
  p3.specialists = p3.specialists.filter((s) => s.specialist !== 'nolan');
  sqlOk(specialistWriteSql(ROT_A, p3));
  assertEq(scalar(`SELECT count(*) FROM session_report.specialist_dispatch WHERE rotation_id='${ROT_A}';`), '4', 'four rows after one specialist is dropped');
  assertEq(scalar(`SELECT count(*) FROM session_report.specialist_dispatch WHERE rotation_id='${ROT_A}' AND specialist='nolan';`), '0', 'the dropped specialist must be gone — a mirror equals the payload');
});

check('AC3 GUARD — an ABSENT specialists array is NO CLAIM: nothing written, NOTHING DELETED', () => {
  const p4 = clone(REAL_PAYLOAD);
  delete p4.specialists;
  assertEq(specialistRows(p4).claimed, false, 'an absent array must not be treated as a claim');
  assertEq(specialistWriteSql(ROT_A, p4), null, 'no SQL at all may be generated');
  assertEq(scalar(`SELECT count(*) FROM session_report.specialist_dispatch WHERE rotation_id='${ROT_A}';`), '4', 'row count unchanged — a truncated payload must never wipe the mirror');
});

check('AC3 GUARD — an EMPTY specialists array IS a claim of "none", and does remove the rows', () => {
  const p5 = clone(REAL_PAYLOAD);
  p5.specialists = [];
  assertEq(specialistRows(p5).claimed, true, 'an empty array is a positive assertion');
  const generated = specialistWriteSql(ROT_A, p5);
  assert(generated !== null, 'SQL must be generated for an empty claim');
  sqlOk(generated);
  assertEq(scalar(`SELECT count(*) FROM session_report.specialist_dispatch WHERE rotation_id='${ROT_A}';`), '0', 'an explicit "no specialists" empties this rotation');
});

check('AC3 SCOPE — the prune never reached the other rotation', () => {
  assertEq(scalar(`SELECT count(*) FROM session_report.specialist_dispatch WHERE rotation_id='${ROT_B}';`), '5', 'rotation B was written once and must still hold its five rows');
  assertEq(scalar(`SELECT sum(dispatches)::text FROM session_report.specialist_dispatch WHERE rotation_id='${ROT_B}';`), '15', 'rotation B totals untouched');
});

check('A4 — the generated script is ONE transaction, upsert-first and delete-LAST', () => {
  const s = specialistWriteSql(ROT_A, REAL_PAYLOAD);
  assert(s.startsWith('BEGIN;\n'), 'must open a transaction');
  assert(s.trimEnd().endsWith('COMMIT;'), 'must close the transaction');
  assertEq((s.match(/\bBEGIN;/g) || []).length, 1, 'exactly one transaction');
  assert(s.lastIndexOf('DELETE FROM') > s.lastIndexOf('INSERT INTO'), 'the DELETE must come AFTER every INSERT — delete-first opens a window in which the rotation has no rows');
  assertEq((s.match(/ON CONFLICT \(rotation_id, specialist\) DO UPDATE SET/g) || []).length, 5, 'one conflict clause per specialist');
});

check('a payload listing the same specialist TWICE is last-one-wins, not a hard failure', () => {
  const p6 = clone(REAL_PAYLOAD);
  p6.specialists = [
    { specialist: 'duplicated', dispatches: 1, tokens: 111 },
    { specialist: 'duplicated', dispatches: 2, tokens: 222 },
  ];
  const r = sql(specialistWriteSql(ROT_A, p6));
  assertEq(r.status, 0, `per-row statements must survive a repeated key (a multi-row VALUES would raise "cannot affect row a second time"): ${r.stderr}`);
  const row = rows(`SELECT dispatches::text, tokens::text FROM session_report.specialist_dispatch WHERE rotation_id='${ROT_A}' AND specialist='duplicated';`);
  assertEq(row.length, 1, 'one row');
  assertEq(row[0][0], '2', 'the last entry wins');
  assertEq(row[0][1], '222', 'the last entry wins');
});

/* ─── AC5 — mutation tests. A control that has never been made to fail is not evidence. ──────── */

check('AC5 MUTATION 1 — with the ON CONFLICT clause REMOVED, the re-run FAILS on the unique index', () => {
  sqlOk(`DELETE FROM session_report.specialist_dispatch WHERE rotation_id='${ROT_A}';`);
  sqlOk(specialistWriteSql(ROT_A, REAL_PAYLOAD)); // populate once

  const good = specialistWriteSql(ROT_A, REAL_PAYLOAD);
  const mutated = good.replace(/\nON CONFLICT \(rotation_id, specialist\) DO UPDATE SET[\s\S]*?;\n/g, ';\n');
  assert(mutated !== good, 'the mutation must actually change the SQL — a no-op mutation proves nothing');
  assertEq((mutated.match(/ON CONFLICT/g) || []).length, 0, 'no conflict clause may survive the mutation');

  const r = sql(mutated);
  assert(r.status !== 0, 'THE CHECK MUST GO RED without the conflict clause — if this passes, the assertion above is vacuous');
  assert(/duplicate key value violates unique constraint/i.test(r.stderr), `the failure must be the unique index firing, not some other error: ${r.stderr}`);
  assertEq(scalar(`SELECT count(*) FROM session_report.specialist_dispatch WHERE rotation_id='${ROT_A}';`), '5', 'the failed transaction rolled back — still five rows, not ten');
});

check('AC5 MUTATION 1 RESTORED — the unmutated SQL is green again', () => {
  const r = sql(specialistWriteSql(ROT_A, REAL_PAYLOAD));
  assertEq(r.status, 0, `restoring the conflict clause must restore the green: ${r.stderr}`);
  assertEq(scalar(`SELECT count(*) FROM session_report.specialist_dispatch WHERE rotation_id='${ROT_A}';`), '5', 'five rows');
});

check('AC5 MUTATION 2 — with the unique INDEX dropped, the re-run duplicates: this is the live defect, reproduced', () => {
  sqlOk('DROP INDEX session_report.session_report_specialist_dispatch_rotation_specialist_idx;');
  const good = specialistWriteSql(ROT_A, REAL_PAYLOAD);
  const noConflict = good.replace(/\nON CONFLICT \(rotation_id, specialist\) DO UPDATE SET[\s\S]*?;\n/g, ';\n');
  const r = sql(noConflict);
  assertEq(r.status, 0, `without the index there is nothing to violate, so the duplicate INSERT succeeds: ${r.stderr}`);
  assertEq(scalar(`SELECT count(*) FROM session_report.specialist_dispatch WHERE rotation_id='${ROT_A}';`), '10', 'TEN rows — exactly the 30-where-15-is-true defect, reproduced on demand');
  assertEq(scalar(`SELECT sum(dispatches)::text FROM session_report.specialist_dispatch WHERE rotation_id='${ROT_A}';`), '30', 'and the count Warwick reads is doubled');
});

check('AC5 MUTATION 2 RESTORED — re-applying schema.sql cannot recreate the index while duplicates exist, and says so', () => {
  const r = sql(SCHEMA_TEXT);
  assert(r.status !== 0, 'creating a unique index over duplicate rows must FAIL LOUDLY rather than silently skip');
  assert(/could not create unique index|duplicate key/i.test(r.stderr), `the failure must name the duplication: ${r.stderr}`);
  // clean up the deliberate duplicates, then prove the index comes back
  sqlOk(`DELETE FROM session_report.specialist_dispatch a
    USING session_report.specialist_dispatch b
    WHERE a.rotation_id=b.rotation_id AND a.specialist=b.specialist AND a.id > b.id;`);
  const r2 = sql(SCHEMA_TEXT);
  assertEq(r2.status, 0, `once the duplicates are gone the schema re-applies cleanly: ${r2.stderr}`);
  assertEq(scalar(`SELECT count(*) FROM pg_indexes WHERE indexname='session_report_specialist_dispatch_rotation_specialist_idx';`), '1', 'index restored');
});

/* ─── report ─────────────────────────────────────────────────────────────────────────────────── */

process.stdout.write(`\nexecuted: ${executed}   passed: ${executed - failed}   failed: ${failed}\n`);

if (executed === 0) {
  process.stderr.write('ZERO EXECUTED CHECKS — that is a FAILURE, never a pass.\n');
  process.exit(1);
}
if (failed > 0) {
  process.stderr.write(`\n${failed} check(s) failed:\n` + failures.map((f) => `  - ${f.name}: ${f.message}`).join('\n') + '\n');
  process.exit(1);
}
process.stdout.write('ALL CHECKS PASSED (builder self-test evidence — NOT independent review)\n');
process.exit(0);
