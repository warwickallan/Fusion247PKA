// =====================================================================
// BUILD-015 AsdAIr - ensure-asdair-runtime.test.mjs   (Work Order WO-B)
//
// THE POINT OF THIS FILE: a check that cannot be made to FAIL is not a check.
//
// On 2026-08-03 a live shop failed four times on configuration that preflight
// had just declared fine. The old preflight asked whether four environment
// variables were SET; it never asked whether the gateway served the model, or
// whether Postgres actually held the grants, or whether the media root existed.
// Every check added by WO-B is therefore exercised HERE in both directions -
// once with the condition present, and once with it genuinely absent - because
// a check only proved in the passing direction is indistinguishable from a
// check that always passes.
//
// OFFLINE. No credentials, no network, no database, no Chrome, no scheduled
// task. Everything that touches a wire is injected (`deps`), so what is proved
// here is the DECISION LOGIC. The wire itself is explicitly NOT proved by this
// file - see the handback's "not verified".
//
// STATE DIRECTORY: redirected into the OS temp directory BEFORE the module is
// imported, because runtime-paths.mjs resolves STATE_DIR once at module load.
// Nothing in this suite reads or writes C:\.fusion247\** .
// =====================================================================

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const TEST_STATE_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'asdair-wo-b-'));
process.env.ASDAIR_RUNTIME_STATE_DIR = TEST_STATE_DIR;

const {
  preflight, BLOCKING, ADVISORY,
  GRANT_MATRIX, MATRIX_PRIVILEGES, COLUMN_DENIALS,
  grantExpectations, evaluateGrants, evaluateColumnDenials,
  extractModelIds, evaluateVisionModel, VISION_MODEL_DEFAULT,
  launcherPathFromTaskArguments, evaluateScheduledTask, SCHEDULED_TASK_NAME,
  looksLikeTelegramToken, PG_CONSUMERS, CHROME_DEFAULT_PROFILE_DIR,
} = await import('./ensure-asdair-runtime.mjs');

// ---------------------------------------------------------------------
// Fixtures. Deliberately fake values - none of these is a credential, and the
// leak test at the bottom depends on them being recognisable sentinels.
// ---------------------------------------------------------------------

// The password component of the two URLs below is the literal word
// `placeholder`, and the recognisable sentinel is carried in a query parameter
// instead. That is not cosmetic: a credential-SHAPED fixture trips
// scripts/secret-scan.sh's connection-string class, and a test file that makes
// the estate's secret scanner cry wolf is a test file people learn to exempt.
const FAKE_TOKEN = '12345:not-a-real-token-just-the-right-shape';
const FAKE_KEY = 'not-a-real-gateway-key';
const WRONG_SHAPE_BOT_VALUE = 'obviously-not-a-token';
const DB_SENTINEL = 'SENTINEL-DB-CONNECTION-STRING';
const FAKE_RO_URL = `postgres://asdair_ro:placeholder@127.0.0.1:1/asdair?application_name=${DB_SENTINEL}-RO`;
const FAKE_RW_URL = `postgres://asdair_rw:placeholder@127.0.0.1:1/asdair?application_name=${DB_SENTINEL}-RW`;
const FAKE_GATEWAY = 'http://gateway.invalid:4000/v1';
const REAL_MODEL = 'gpt-5-mini';

const EXISTING_DIR = TEST_STATE_DIR;                 // exists, and is writable
const MISSING_PATH = path.join(TEST_STATE_DIR, 'definitely-not-here');

function goodEnv(overrides = {}) {
  return {
    SHOPPER_BOT_TOKEN: FAKE_TOKEN,
    SHOPPER_ALLOWED_SENDER_IDS: '8601328832',
    ASDAIR_DB_URL: FAKE_RO_URL,
    ASDAIR_WRITE_DB_URL: FAKE_RW_URL,
    ASDAIR_MEDIA_ROOT: EXISTING_DIR,
    FUSION_GATEWAY_URL: FAKE_GATEWAY,
    FUSION_GATEWAY_KEY: FAKE_KEY,
    FUSION_MODEL_VISION: REAL_MODEL,
    ASDAIR_CHROME_EXE: path.join(TEST_STATE_DIR, 'chrome.exe'),
    ASDAIR_CHROME_PROFILE_DIR: EXISTING_DIR,
    ...overrides,
  };
}
fs.writeFileSync(path.join(TEST_STATE_DIR, 'chrome.exe'), 'not really chrome');

/** A database that holds EXACTLY what the committed migrations grant. Built
 *  from the matrix itself, so a change to the matrix cannot silently desync the
 *  fixture - and then perturbed, one privilege at a time, by the tests below. */
function correctPrivilegeRows(mutate = () => {}) {
  const rows = grantExpectations().map((e) => {
    const columnCapable = e.privilege !== 'DELETE';
    if (e.expect === 'table') {
      return { role: e.role, tbl: e.table, priv: e.privilege, table_priv: true, any_col_priv: columnCapable ? true : null };
    }
    if (e.expect === 'column-only') {
      return { role: e.role, tbl: e.table, priv: e.privilege, table_priv: false, any_col_priv: true };
    }
    return { role: e.role, tbl: e.table, priv: e.privilege, table_priv: false, any_col_priv: columnCapable ? false : null };
  });
  mutate(rows);
  return rows;
}

function correctColumnRows() {
  return COLUMN_DENIALS.map((d) => ({
    role: d.role, tbl: d.table, col: d.column, priv: d.privilege, col_priv: false,
  }));
}

/** A fake pg connection that answers by inspecting the SQL it is handed. */
function fakeDb({
  role = 'asdair_ro', db = 'postgres', roles = ['asdair_ro', 'asdair_rw'],
  privilegeRows = correctPrivilegeRows(), columnRows = correctColumnRows(),
} = {}) {
  return {
    query: async (sql) => {
      if (sql.includes('current_user')) return { rows: [{ role, db }] };
      if (sql.includes('pg_roles')) return { rows: roles.map((r) => ({ rolname: r })) };
      if (sql.includes('has_column_privilege')) return { rows: columnRows };
      if (sql.includes('has_table_privilege')) return { rows: privilegeRows };
      throw new Error(`unexpected SQL in test: ${sql.slice(0, 60)}`);
    },
    end: async () => {},
  };
}

function fakeDeps(overrides = {}) {
  return {
    existsSync: (p) => fs.existsSync(p),
    writeFileSync: (p, d) => fs.writeFileSync(p, d),
    rmSync: (p) => fs.rmSync(p, { force: true }),
    connectDb: async (cs) => fakeDb({ role: cs === FAKE_RW_URL ? 'asdair_rw' : 'asdair_ro' }),
    httpGetJson: async (url, opts = {}) => {
      if (url.includes('json/version')) return { reached: true, status: 200, body: { Browser: 'Chrome/1' } };
      const authed = Boolean(opts.headers && opts.headers.Authorization);
      if (!authed) return { reached: true, status: 401, body: { error: 'unauthorised' } };
      return { reached: true, status: 200, body: { data: [{ id: REAL_MODEL }, { id: 'fusion.reason' }] } };
    },
    readScheduledTask: () => ({
      found: true,
      execute: 'C:/node/node.exe',
      arguments: `--env-file="C:/.fusion247/secret.env" "${LAUNCHER}"`,
      workingDirectory: path.dirname(LAUNCHER),
    }),
    resolveFrom: () => 'ok',
    holderStatus: () => ({ state: 'free', reason: 'no lock', record: {} }),
    armed: () => ({ armed: true, since: '2026-08-03T00:00:00Z' }),
    ...overrides,
  };
}

const LAUNCHER = path.join(TEST_STATE_DIR, 'checkout-a', 'ensure-asdair-runtime.mjs');

async function run(envOverrides = {}, depOverrides = {}, opts = {}) {
  return preflight({
    mode: 'live',
    env: goodEnv(envOverrides),
    deps: fakeDeps(depOverrides),
    stateDir: TEST_STATE_DIR,
    launcherPath: LAUNCHER,
    ...opts,
  });
}

/** Every check for an AC, so a test can assert on the one it means. */
const forAc = (r, ac) => r.checks.filter((c) => c.ac === ac);
const blockedOn = (r, ac) => r.problems.filter((p) => p.startsWith(`[${ac}]`));
const warnedOn = (r, ac) => r.warnings.filter((p) => p.startsWith(`[${ac}]`));

// =====================================================================
// The baseline. If this does not pass, every failure test below is vacuous.
// =====================================================================

test('a fully configured runtime passes preflight with no blocking problem', async () => {
  const r = await run();
  assert.deepEqual(r.problems, [], `unexpected problems: ${r.problems.join(' | ')}`);
  assert.equal(r.ok, true);
  assert.ok(r.checks.length >= 20, `expected a substantial check list, got ${r.checks.length}`);
  // AC0's entry check is the one thing this fixture cannot fake, so it is
  // asserted separately rather than assumed.
  assert.equal(forAc(r, 'AC0')[0].ok, true);
});

test('the return shape the old consumers relied on is preserved, and warnings are additive', async () => {
  const r = await run();
  for (const key of ['ok', 'mode', 'entry', 'checks', 'problems']) {
    assert.ok(Object.prototype.hasOwnProperty.call(r, key), `lost key: ${key}`);
  }
  assert.ok(Array.isArray(r.warnings));
  assert.equal(r.ok, r.problems.length === 0, 'ok must still mean "no blocking problem"');
  for (const c of r.checks) {
    assert.ok(c.ac && c.check && c.severity, 'every check carries an ac, a name and a severity');
    assert.ok([BLOCKING, ADVISORY].includes(c.severity));
  }
});

test('an ADVISORY failure never reaches problems, and never flips ok', async () => {
  // Two advisories at once: no media root, and a dead CDP endpoint.
  const r = await run({ ASDAIR_MEDIA_ROOT: '' }, {
    httpGetJson: async (url, opts = {}) => {
      if (url.includes('json/version')) return { reached: false, status: 0, body: null, failure: 'unreachable' };
      const authed = Boolean(opts.headers && opts.headers.Authorization);
      return authed
        ? { reached: true, status: 200, body: { data: [{ id: REAL_MODEL }] } }
        : { reached: true, status: 401, body: null };
    },
  });
  assert.equal(r.ok, true, 'advisories must not block a start');
  assert.deepEqual(r.problems, []);
  assert.ok(r.warnings.length >= 2, `expected advisories, got ${JSON.stringify(r.warnings)}`);
  assert.equal(warnedOn(r, 'AC5').length, 1);
});

// =====================================================================
// AC1 - credentials present, never printed
// =====================================================================

for (const name of ['SHOPPER_BOT_TOKEN', 'ASDAIR_DB_URL', 'ASDAIR_WRITE_DB_URL']) {
  test(`AC1 BLOCKS when ${name} is absent`, async () => {
    const r = await run({ [name]: '' });
    assert.ok(blockedOn(r, 'AC1').some((p) => p.includes(name)), `no blocking problem named ${name}`);
    assert.equal(r.ok, false);
  });
}

test('AC1 flags a mis-shaped bot token as ADVISORY, not as a start-stopper', async () => {
  const r = await run({ SHOPPER_BOT_TOKEN: WRONG_SHAPE_BOT_VALUE });
  assert.equal(warnedOn(r, 'AC1').length, 1);
  assert.deepEqual(blockedOn(r, 'AC1'), []);
});

test('looksLikeTelegramToken rejects the shapes that authenticate as nothing', () => {
  assert.equal(looksLikeTelegramToken(FAKE_TOKEN), true);
  assert.equal(looksLikeTelegramToken('12345'), false, 'no colon');
  assert.equal(looksLikeTelegramToken('12345:short'), false, 'truncated body');
  assert.equal(looksLikeTelegramToken('abc:PLACEHOLDER-not-a-real-token'), false, 'non-numeric id');
  assert.equal(looksLikeTelegramToken(undefined), false);
});

// =====================================================================
// AC2 - the allowlist PARSES. "Is set" was never the question.
// =====================================================================

test('AC2 BLOCKS when no allowlist variable is set at all', async () => {
  const r = await run({ SHOPPER_ALLOWED_SENDER_IDS: '', SHOPPER_ALLOWED_USER_IDS: '' });
  assert.equal(blockedOn(r, 'AC2').length, 1);
  assert.match(blockedOn(r, 'AC2')[0], /default-deny/);
});

test('AC2 BLOCKS on an allowlist that is SET but parses to nothing usable', async () => {
  // This is the case the old presence check called healthy.
  const r = await run({ SHOPPER_ALLOWED_SENDER_IDS: '   ' });
  assert.equal(r.ok, false);
  assert.equal(blockedOn(r, 'AC2').length, 1);
});

test('AC2 BLOCKS on names instead of numeric Telegram ids', async () => {
  const r = await run({ SHOPPER_ALLOWED_SENDER_IDS: 'warwick, asdair' });
  assert.equal(r.ok, false);
  assert.match(blockedOn(r, 'AC2')[0], /numeric/i);
});

test('AC2 accepts the SHOPPER_ALLOWED_USER_IDS alias the live credentials file actually uses', async () => {
  const r = await run({ SHOPPER_ALLOWED_SENDER_IDS: '', SHOPPER_ALLOWED_USER_IDS: '8601328832' });
  assert.deepEqual(blockedOn(r, 'AC2'), []);
});

test('AC2 reports the id COUNT and never the ids themselves', async () => {
  const r = await run({ SHOPPER_ALLOWED_SENDER_IDS: '111222333,444555666' });
  const check = forAc(r, 'AC2').find((c) => c.check.includes('parses'));
  assert.match(check.detail, /2 allowed sender id\(s\)/);
  assert.ok(!check.detail.includes('111222333'), 'an allowlisted id leaked into the detail text');
});

// =====================================================================
// AC3 - both connections actually connect, as the roles they claim to be
// =====================================================================

test('AC3 BLOCKS when the read database refuses the connection', async () => {
  const r = await run({}, {
    connectDb: async (cs) => {
      if (cs === FAKE_RO_URL) { const e = new Error('nope'); e.code = 'ECONNREFUSED'; throw e; }
      return fakeDb({ role: 'asdair_rw' });
    },
  });
  assert.ok(blockedOn(r, 'AC3').some((p) => p.includes('ASDAIR_DB_URL')));
  assert.equal(r.ok, false);
});

test('AC3 BLOCKS when the WRITE database refuses the connection', async () => {
  const r = await run({}, {
    connectDb: async (cs) => {
      if (cs === FAKE_RW_URL) { const e = new Error('nope'); e.code = 'ETIMEDOUT'; throw e; }
      return fakeDb({ role: 'asdair_ro' });
    },
  });
  assert.ok(blockedOn(r, 'AC3').some((p) => p.includes('ASDAIR_WRITE_DB_URL')));
});

test('AC3 BLOCKS when the write URL is secretly the read-only role', async () => {
  // The exact defect class SOP-022 records: a string that connects fine, as the
  // wrong role. A presence check and a bare connection test both call this good.
  const r = await run({}, { connectDb: async () => fakeDb({ role: 'asdair_ro' }) });
  assert.ok(
    blockedOn(r, 'AC3').some((p) => p.includes('ASDAIR_WRITE_DB_URL') && p.includes('asdair_ro')),
    `expected a role-mismatch problem, got ${JSON.stringify(r.problems)}`,
  );
});

test('AC3 never puts a connection string into its output', async () => {
  // The driver's own error message carries the whole connection string. If
  // preflight forwards err.message rather than err.code, it leaks it.
  const r = await run({}, {
    connectDb: async () => { const e = new Error(`could not connect to ${FAKE_RO_URL}`); e.code = 'ECONNREFUSED'; throw e; },
  });
  const all = JSON.stringify(r);
  assert.ok(!all.includes(DB_SENTINEL), 'a connection string reached the preflight output');
  assert.ok(all.includes('ECONNREFUSED'), 'the useful half - the failure code - should still be reported');
});

// =====================================================================
// AC4 - the grant matrix, per role, per table, per privilege
// =====================================================================

test('the matrix is derived from the migrations, not invented: both roles, and the documented negatives', () => {
  assert.deepEqual(Object.keys(GRANT_MATRIX), ['asdair_ro', 'asdair_rw']);
  // 010 states these two get NO asdair_rw grant. If someone "helpfully" adds
  // one, this fails - which is the point.
  assert.deepEqual(GRANT_MATRIX.asdair_rw['asdair.budget_settings'], {});
  assert.deepEqual(GRANT_MATRIX.asdair_rw['asdair.product_alternatives'], {});
  // 005 grants insert/update on regulars per COLUMN, never per table.
  assert.deepEqual(GRANT_MATRIX.asdair_rw['asdair.regulars'].column, ['INSERT', 'UPDATE']);
  // No migration grants DELETE to asdair_rw on anything.
  for (const [tbl, spec] of Object.entries(GRANT_MATRIX.asdair_rw)) {
    assert.ok(!(spec.table || []).includes('DELETE'), `DELETE granted on ${tbl}`);
    assert.ok(!(spec.column || []).includes('DELETE'), `DELETE granted on ${tbl}`);
  }
  // asdair_ro is SELECT-only, everywhere.
  for (const [tbl, spec] of Object.entries(GRANT_MATRIX.asdair_ro)) {
    assert.deepEqual(spec.table, ['SELECT'], `asdair_ro is not SELECT-only on ${tbl}`);
    assert.equal(spec.column, undefined, `asdair_ro has a column grant on ${tbl}`);
  }
});

test('grantExpectations covers every privilege of every matrix pair', () => {
  const exp = grantExpectations();
  const pairs = Object.entries(GRANT_MATRIX)
    .reduce((n, [, tables]) => n + Object.keys(tables).length, 0);
  assert.equal(exp.length, pairs * MATRIX_PRIVILEGES.length);
  assert.ok(exp.length > 100, 'the matrix should be substantial, not a token sample');
});

test('evaluateGrants passes a database that matches the migrations exactly', () => {
  const exp = grantExpectations();
  const observed = new Map(correctPrivilegeRows().map((r) => [`${r.role}|${r.tbl}|${r.priv}`, r]));
  const v = evaluateGrants(exp, observed);
  assert.deepEqual(v.missing, []);
  assert.deepEqual(v.overGranted, []);
  assert.deepEqual(v.unobserved, []);
  assert.equal(v.verified, exp.length);
});

test('evaluateGrants CATCHES a missing grant - the D-07 failure', () => {
  const exp = grantExpectations();
  const rows = correctPrivilegeRows((rs) => {
    const target = rs.find((r) => r.role === 'asdair_ro' && r.tbl === 'asdair.households' && r.priv === 'SELECT');
    target.table_priv = false; target.any_col_priv = false;
  });
  const v = evaluateGrants(exp, new Map(rows.map((r) => [`${r.role}|${r.tbl}|${r.priv}`, r])));
  assert.equal(v.missing.length, 1);
  assert.match(v.missing[0], /asdair_ro lacks table-level SELECT on asdair\.households/);
});

test('evaluateGrants CATCHES an over-grant - a privilege no migration commits', () => {
  const exp = grantExpectations();
  const rows = correctPrivilegeRows((rs) => {
    const target = rs.find((r) => r.role === 'asdair_rw' && r.tbl === 'asdair.budget_settings' && r.priv === 'SELECT');
    target.table_priv = true; target.any_col_priv = true;
  });
  const v = evaluateGrants(exp, new Map(rows.map((r) => [`${r.role}|${r.tbl}|${r.priv}`, r])));
  assert.equal(v.missing.length, 0, 'an over-grant is not a missing grant');
  assert.equal(v.overGranted.length, 1);
  assert.match(v.overGranted[0], /asdair_rw HAS SELECT on asdair\.budget_settings/);
});

test('evaluateGrants CATCHES asdair_rw holding DELETE, which no migration ever grants', () => {
  const exp = grantExpectations();
  const rows = correctPrivilegeRows((rs) => {
    const target = rs.find((r) => r.role === 'asdair_rw' && r.tbl === 'asdair.shop' && r.priv === 'DELETE');
    target.table_priv = true;
  });
  const v = evaluateGrants(exp, new Map(rows.map((r) => [`${r.role}|${r.tbl}|${r.priv}`, r])));
  assert.equal(v.overGranted.length, 1);
  assert.match(v.overGranted[0], /DELETE on asdair\.shop/);
});

test('a COLUMN grant is not mistaken for a table grant, in either direction', () => {
  const exp = grantExpectations();

  // The correct live state: column-level UPDATE on regulars, no table-level one.
  // Reading has_table_privilege alone would call this MISSING and refuse to
  // start a correctly provisioned database - the C3 defect this matrix exists
  // to avoid.
  const ok = evaluateGrants(exp, new Map(correctPrivilegeRows().map((r) => [`${r.role}|${r.tbl}|${r.priv}`, r])));
  assert.deepEqual(ok.missing, []);

  // Widened to the whole table: that IS a finding, because 005 calls the column
  // list "the security boundary".
  const widened = correctPrivilegeRows((rs) => {
    const t = rs.find((r) => r.role === 'asdair_rw' && r.tbl === 'asdair.regulars' && r.priv === 'UPDATE');
    t.table_priv = true;
  });
  const v = evaluateGrants(exp, new Map(widened.map((r) => [`${r.role}|${r.tbl}|${r.priv}`, r])));
  assert.equal(v.overGranted.length, 1);
  assert.match(v.overGranted[0], /TABLE-level UPDATE on asdair\.regulars/);

  // Removed entirely: the learning path silently stops working.
  const removed = correctPrivilegeRows((rs) => {
    const t = rs.find((r) => r.role === 'asdair_rw' && r.tbl === 'asdair.regulars' && r.priv === 'UPDATE');
    t.table_priv = false; t.any_col_priv = false;
  });
  const gone = evaluateGrants(exp, new Map(removed.map((r) => [`${r.role}|${r.tbl}|${r.priv}`, r])));
  assert.equal(gone.missing.length, 1);
  assert.match(gone.missing[0], /lacks column-level UPDATE on asdair\.regulars/);
});

test('evaluateColumnDenials catches the columns 005 says must stay absent', () => {
  const clean = evaluateColumnDenials(COLUMN_DENIALS, new Map(correctColumnRows()
    .map((r) => [`${r.role}|${r.tbl}|${r.col}|${r.priv}`, r.col_priv])));
  assert.deepEqual(clean.overGranted, []);
  assert.equal(clean.verified, COLUMN_DENIALS.length);

  const leaked = correctColumnRows();
  leaked.find((r) => r.col === 'active').col_priv = true;
  const v = evaluateColumnDenials(COLUMN_DENIALS, new Map(leaked
    .map((r) => [`${r.role}|${r.tbl}|${r.col}|${r.priv}`, r.col_priv])));
  assert.equal(v.overGranted.length, 1);
  assert.match(v.overGranted[0], /asdair\.regulars\.active/);
});

test('an unobserved expectation is NOT counted as verified - silence is not a pass', () => {
  const exp = grantExpectations();
  const v = evaluateGrants(exp, new Map());   // the database answered nothing
  assert.equal(v.verified, 0);
  assert.equal(v.unobserved.length, exp.length);
  assert.deepEqual(v.missing, []);
});

test('AC4 BLOCKS end-to-end when a committed grant is missing from the database', async () => {
  const rows = correctPrivilegeRows((rs) => {
    const t = rs.find((r) => r.role === 'asdair_rw' && r.tbl === 'asdair.shopping_lists' && r.priv === 'INSERT');
    t.table_priv = false; t.any_col_priv = false;
  });
  const r = await run({}, { connectDb: async (cs) => fakeDb({ role: cs === FAKE_RW_URL ? 'asdair_rw' : 'asdair_ro', privilegeRows: rows }) });
  assert.equal(r.ok, false);
  assert.ok(blockedOn(r, 'AC4').some((p) => p.includes('asdair.shopping_lists')));
});

test('AC4 reports an over-grant as an ADVISORY drift finding, not as a start-stopper', async () => {
  const rows = correctPrivilegeRows((rs) => {
    const t = rs.find((r) => r.role === 'asdair_rw' && r.tbl === 'asdair.product_alternatives' && r.priv === 'UPDATE');
    t.table_priv = true; t.any_col_priv = true;
  });
  const r = await run({}, { connectDb: async (cs) => fakeDb({ role: cs === FAKE_RW_URL ? 'asdair_rw' : 'asdair_ro', privilegeRows: rows }) });
  assert.equal(r.ok, true, 'an over-grant must not strand the household mid-week');
  assert.ok(warnedOn(r, 'AC4').some((w) => w.includes('drifted')));
});

test('AC4 BLOCKS when a role is not provisioned at all', async () => {
  const r = await run({}, { connectDb: async () => fakeDb({ role: 'asdair_ro', roles: ['asdair_ro'] }) });
  assert.ok(blockedOn(r, 'AC4').some((p) => p.includes('asdair_rw')));
  assert.equal(r.ok, false);
});

test('AC4 BLOCKS when a matrix table does not exist on this database', async () => {
  // to_regclass filters absent tables out of the result set entirely.
  const rows = correctPrivilegeRows().filter((r) => r.tbl !== 'asdair.shop_line');
  const r = await run({}, { connectDb: async (cs) => fakeDb({ role: cs === FAKE_RW_URL ? 'asdair_rw' : 'asdair_ro', privilegeRows: rows }) });
  assert.ok(blockedOn(r, 'AC4').some((p) => p.includes('asdair.shop_line')));
});

test('AC4 says NOT CHECKED and BLOCKS when there was no connection to ask', async () => {
  const r = await run({ ASDAIR_DB_URL: '', ASDAIR_WRITE_DB_URL: '' });
  const notChecked = blockedOn(r, 'AC4');
  assert.equal(notChecked.length, 1);
  assert.match(notChecked[0], /NOT CHECKED.*not a pass/s);
});

test('AC4 says NOT CHECKED and BLOCKS when the privilege probe itself errors', async () => {
  const r = await run({}, {
    connectDb: async () => ({
      query: async (sql) => {
        if (sql.includes('current_user')) return { rows: [{ role: 'asdair_ro', db: 'x' }] };
        const e = new Error('boom'); e.code = '42501'; throw e;
      },
      end: async () => {},
    }),
  });
  assert.ok(blockedOn(r, 'AC4').some((p) => /NOT CHECKED/.test(p)));
});

// =====================================================================
// AC5 - media root. ADVISORY, and the severity itself is the assertion.
// =====================================================================

test('AC5 warns but does NOT block when ASDAIR_MEDIA_ROOT is unset (D-02)', async () => {
  const r = await run({ ASDAIR_MEDIA_ROOT: '' });
  assert.equal(warnedOn(r, 'AC5').length, 1);
  assert.deepEqual(blockedOn(r, 'AC5'), []);
  assert.match(warnedOn(r, 'AC5')[0], /media_root_not_configured/);
});

test('AC5 says plainly that this process cannot speak for cockpit-api', async () => {
  const r = await run({ ASDAIR_MEDIA_ROOT: '' });
  assert.match(warnedOn(r, 'AC5')[0], /separate process with its own env-file pair/);
});

test('AC5 warns when the media root is set but does not exist', async () => {
  const r = await run({ ASDAIR_MEDIA_ROOT: MISSING_PATH });
  assert.equal(warnedOn(r, 'AC5').length, 1);
  assert.match(warnedOn(r, 'AC5')[0], /does not exist/);
});

test('AC5 warns when the media root exists but is not writable', async () => {
  const r = await run({}, {
    writeFileSync: () => { const e = new Error('denied'); e.code = 'EACCES'; throw e; },
  });
  assert.ok(warnedOn(r, 'AC5').some((w) => w.includes('EACCES')));
});

// =====================================================================
// AC6 / AC7 - the gateway, and Warwick's named criterion
// =====================================================================

test('AC6 BLOCKS when FUSION_GATEWAY_URL is unset, and AC7 reports NOT CHECKED (D-04)', async () => {
  const r = await run({ FUSION_GATEWAY_URL: '' });
  assert.equal(r.ok, false);
  assert.match(blockedOn(r, 'AC6')[0], /TRANSCRIBING/);
  assert.match(blockedOn(r, 'AC7')[0], /NOT CHECKED.*not a pass/s);
});

test('AC6 BLOCKS when the gateway cannot be reached at all', async () => {
  const r = await run({}, {
    httpGetJson: async (url) => (url.includes('json/version')
      ? { reached: false, status: 0, body: null, failure: 'unreachable' }
      : { reached: false, status: 0, body: null, failure: 'unreachable' }),
  });
  assert.ok(blockedOn(r, 'AC6').some((p) => /unreachable/.test(p)));
  assert.ok(blockedOn(r, 'AC7').some((p) => /NOT CHECKED/.test(p)));
});

test('AC6 BLOCKS when the configured key is rejected', async () => {
  const r = await run({}, {
    httpGetJson: async (url, opts = {}) => {
      if (url.includes('json/version')) return { reached: true, status: 200, body: {} };
      return { reached: true, status: opts.headers ? 401 : 401, body: null };
    },
  });
  assert.ok(blockedOn(r, 'AC6').some((p) => /rejected the configured key with HTTP 401/.test(p)));
  assert.ok(blockedOn(r, 'AC7').some((p) => /NOT CHECKED/.test(p)));
});

test('AC6 BLOCKS when FUSION_GATEWAY_KEY is unset even though the gateway answers', async () => {
  const r = await run({ FUSION_GATEWAY_KEY: '' });
  assert.ok(blockedOn(r, 'AC6').some((p) => p.includes('FUSION_GATEWAY_KEY is not set')));
});

test('AC6 warns when the gateway serves /models to an unauthenticated request', async () => {
  const r = await run({}, {
    httpGetJson: async (url) => (url.includes('json/version')
      ? { reached: true, status: 200, body: {} }
      : { reached: true, status: 200, body: { data: [{ id: REAL_MODEL }] } }),
  });
  assert.ok(warnedOn(r, 'AC6').some((w) => /UNAUTHENTICATED/.test(w)));
  assert.equal(r.ok, true, 'an open gateway is a finding, not a reason to refuse the shop');
});

test('AC7 BLOCKS when the configured vision model is not one the gateway serves (D-05)', async () => {
  const r = await run({ FUSION_MODEL_VISION: 'model.that.does.not.exist' });
  assert.equal(r.ok, false);
  assert.match(blockedOn(r, 'AC7')[0], /is NOT in this gateway's \/models list/);
});

test("AC7 BLOCKS on the UNSET default - Warwick's exact criterion", async () => {
  // "A default model name that the gateway does not provide must never survive
  // preflight again." With FUSION_MODEL_VISION unset the pipeline falls back to
  // fusion.vision, which this gateway does not serve.
  const r = await run({ FUSION_MODEL_VISION: '' });
  assert.equal(r.ok, false);
  const p = blockedOn(r, 'AC7')[0];
  assert.match(p, /fusion\.vision/);
  assert.match(p, /UNSET/);
  assert.match(p, /models\.mjs/, 'the report should name where the bad default lives');
});

test('AC7 passes only when the model is genuinely in the gateway list', async () => {
  const r = await run({ FUSION_MODEL_VISION: 'fusion.reason' });   // the fixture serves it
  assert.deepEqual(blockedOn(r, 'AC7'), []);
});

test('evaluateVisionModel does not treat an unreadable /models body as a pass', () => {
  assert.equal(evaluateVisionModel(REAL_MODEL, null).ok, false);
  assert.match(evaluateVisionModel(REAL_MODEL, null).reason, /NOT be verified|not a recognisable/);
  // An EMPTY list is a real answer, and a real failure.
  assert.equal(evaluateVisionModel(REAL_MODEL, []).ok, false);
});

test('extractModelIds reads both gateway envelopes and refuses to guess at anything else', () => {
  assert.deepEqual(extractModelIds({ data: [{ id: 'a' }, { id: 'b' }] }), ['a', 'b']);
  assert.deepEqual(extractModelIds(['a', 'b']), ['a', 'b']);
  assert.deepEqual(extractModelIds({ data: [] }), []);
  assert.equal(extractModelIds({ error: 'nope' }), null);
  assert.equal(extractModelIds(null), null);
  assert.equal(extractModelIds('a string'), null);
});

test('the default vision alias is still the one that failed live, so the check stays honest', () => {
  assert.equal(VISION_MODEL_DEFAULT, 'fusion.vision');
});

// =====================================================================
// AC8 - Chrome
// =====================================================================

test('AC8 BLOCKS when no Chrome executable exists', async () => {
  const r = await run({ ASDAIR_CHROME_EXE: MISSING_PATH });
  assert.equal(r.ok, false);
  assert.ok(blockedOn(r, 'AC8').some((p) => /Chrome executable/.test(p)));
});

test('AC8 BLOCKS when the dedicated profile directory is absent', async () => {
  const r = await run({ ASDAIR_CHROME_PROFILE_DIR: MISSING_PATH });
  assert.equal(r.ok, false);
  assert.ok(blockedOn(r, 'AC8').some((p) => /not signed in/.test(p)));
});

test('AC8 falls back to the documented default profile path when unconfigured', async () => {
  const r = await run({ ASDAIR_CHROME_PROFILE_DIR: '' });
  const check = forAc(r, 'AC8').find((c) => c.check.includes('profile directory'));
  assert.ok(check.detail.includes(CHROME_DEFAULT_PROFILE_DIR),
    'an unset profile var must be reported against the documented default, not silently skipped');
});

test('AC8 treats a browser that is not running as ADVISORY, not as a start-stopper', async () => {
  const r = await run({}, {
    httpGetJson: async (url, opts = {}) => {
      if (url.includes('json/version')) return { reached: false, status: 0, body: null, failure: 'unreachable' };
      return opts.headers
        ? { reached: true, status: 200, body: { data: [{ id: REAL_MODEL }] } }
        : { reached: true, status: 401, body: null };
    },
  });
  assert.equal(r.ok, true, 'preflight runs at logon, before anyone opens Chrome');
  assert.ok(warnedOn(r, 'AC8').some((w) => /no CDP endpoint/.test(w)));
});

// =====================================================================
// AC9 - exactly one runtime, and the start path that must NOT use it
// =====================================================================

test('AC9 BLOCKS when another runtime already holds the single-poller lock', async () => {
  const r = await run({}, { holderStatus: () => ({ state: 'held', reason: 'pid 4242 is alive', record: { pid: 4242 } }) });
  assert.equal(r.ok, false);
  assert.match(blockedOn(r, 'AC9')[0], /single-poller lock/);
});

test('AC9 is omitted when the caller handles the holder itself, so logon recovery still exits 0', async () => {
  // start() passes includeSinglePoller:false. If AC9 fired there, the logon task
  // re-firing over a HEALTHY runtime would be reported as a failure.
  const r = await run({}, { holderStatus: () => ({ state: 'held', reason: 'alive', record: { pid: 1 } }) },
    { includeSinglePoller: false });
  assert.equal(forAc(r, 'AC9').length, 0);
  assert.equal(r.ok, true);
});

test('a stale lock does not block - it is reclaimable', async () => {
  const r = await run({}, { holderStatus: () => ({ state: 'stale', reason: 'pid gone', record: {} }) });
  assert.deepEqual(blockedOn(r, 'AC9'), []);
});

// =====================================================================
// AC10 - dependencies resolve from every caller (D-01)
// =====================================================================

test('AC10 checks every folder on the live path, not just shop/', () => {
  assert.ok(PG_CONSUMERS.length >= 7, 'D-01 hit three folders; checking one was the defect');
  const folders = new Set(PG_CONSUMERS.map((p) => p.split('/')[0]));
  for (const f of ['shop', 'pipeline', 'interpret', 'skill', 'outcome', 'reconcile', 'browser-runner']) {
    assert.ok(folders.has(f), `no pg consumer named for ${f}/`);
  }
});

test('every file named in PG_CONSUMERS actually EXISTS and actually requires pg', () => {
  // Written because the first draft of that list was guessed rather than read:
  // two of the seven paths did not exist, which would have made AC10 report a
  // permanent BLOCKING failure for a correctly installed product. A checker
  // pointed at a file that is not there fails in the same direction as a real
  // defect, which is the worst kind of wrong.
  // fileURLToPath rather than import.meta.dirname: package.json declares
  // engines.node >=18, and import.meta.dirname only landed in 20.11.
  const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
  for (const rel of PG_CONSUMERS) {
    const abs = path.join(root, rel);
    assert.ok(fs.existsSync(abs), `PG_CONSUMERS names a file that does not exist: ${rel}`);
    const src = fs.readFileSync(abs, 'utf8');
    assert.match(src, /require\(['"]pg['"]\)|from ['"]pg['"]/,
      `${rel} does not actually require pg, so resolving from it proves nothing`);
  }
});

test("AC10 BLOCKS when 'pg' is unresolvable from any single caller", async () => {
  const r = await run({}, {
    resolveFrom: (from) => (from.includes('browser-runner') ? 'unresolvable' : 'ok'),
  });
  assert.equal(r.ok, false);
  assert.match(blockedOn(r, 'AC10')[0], /browser-runner/);
  assert.match(blockedOn(r, 'AC10')[0], /resolves from the CALLER/);
});

test('AC10 names EVERY unresolvable caller, not just the first', async () => {
  const r = await run({}, { resolveFrom: () => 'unresolvable' });
  const p = blockedOn(r, 'AC10')[0];
  for (const c of PG_CONSUMERS) assert.ok(p.includes(c), `did not name ${c}`);
});

// =====================================================================
// AC11 - the logon task points at THIS checkout
// =====================================================================

test('AC11 warns when the task points at a different checkout', async () => {
  const other = path.join(TEST_STATE_DIR, 'checkout-b', 'ensure-asdair-runtime.mjs');
  const r = await run({}, {
    readScheduledTask: () => ({ found: true, arguments: `--env-file="x" "${other}"` }),
  });
  assert.equal(r.ok, true, 'a stale registration does not stop THIS start');
  assert.match(warnedOn(r, 'AC11')[0], /DIFFERENT checkout/);
  assert.ok(warnedOn(r, 'AC11')[0].includes('checkout-b'));
});

test('AC11 warns when no task is registered at all', async () => {
  const r = await run({}, { readScheduledTask: () => ({ found: false }) });
  assert.match(warnedOn(r, 'AC11')[0], /would not bring the runtime back/);
});

test('AC11 says NOT CHECKED when the task cannot be queried - never a silent pass', async () => {
  const r = await run({}, { readScheduledTask: () => null });
  assert.match(warnedOn(r, 'AC11')[0], /NOT CHECKED/);
});

test('AC11 passes when the registration matches this checkout, slashes and case aside', async () => {
  const r = await run({}, {
    readScheduledTask: () => ({ found: true, arguments: `--env-file="x" "${LAUNCHER.replace(/\//g, '\\').toUpperCase()}"` }),
  });
  assert.deepEqual(warnedOn(r, 'AC11'), []);
});

test('the launcher path is extracted from the task arguments WITHOUT the credentials paths', () => {
  const args = '--env-file="C:\\.fusion247\\.env keys\\shopper.env.txt" --env-file="C:\\.fusion247\\asdair.env" "C:\\repo\\ensure-asdair-runtime.mjs"';
  const got = launcherPathFromTaskArguments(args);
  assert.equal(got, 'C:\\repo\\ensure-asdair-runtime.mjs');
  assert.ok(!got.includes('.env'), 'a credentials file path leaked out of the task arguments');
});

test('evaluateScheduledTask never echoes the credentials paths it was handed', () => {
  const args = '--env-file="C:\\.fusion247\\.env keys\\shopper.env.txt" "C:\\other\\ensure-asdair-runtime.mjs"';
  const v = evaluateScheduledTask({ found: true, arguments: args }, 'C:\\repo\\ensure-asdair-runtime.mjs');
  assert.equal(v.ok, false);
  assert.ok(!v.detail.includes('shopper.env'), 'a credentials file path reached the preflight detail text');
  assert.ok(v.detail.includes(SCHEDULED_TASK_NAME));
});

// =====================================================================
// The standing discipline: env var NAMES only, never values.
// =====================================================================

test('no secret VALUE appears anywhere in the preflight output, pass or fail', async () => {
  const secrets = [FAKE_TOKEN, FAKE_KEY, DB_SENTINEL];

  const green = JSON.stringify(await run());
  const red = JSON.stringify(await run({ FUSION_MODEL_VISION: 'nope' }, {
    connectDb: async () => { const e = new Error('x'); e.code = 'ECONNREFUSED'; throw e; },
    readScheduledTask: () => ({ found: true, arguments: '--env-file="C:/.fusion247/secret.env" "C:/elsewhere/ensure-asdair-runtime.mjs"' }),
  }));

  for (const s of secrets) {
    assert.ok(!green.includes(s), `secret value leaked into a PASSING preflight: ${s.slice(0, 12)}...`);
    assert.ok(!red.includes(s), `secret value leaked into a FAILING preflight: ${s.slice(0, 12)}...`);
  }
  assert.ok(!red.includes('secret.env'), 'a credentials file path leaked from the scheduled task');
});

test('a gateway URL carrying userinfo is reported by host only', async () => {
  // services/asdair/transcribe/cli.test.js guards the same hazard: this
  // variable really can arrive as http://user:pass@host/v1.
  const r = await run({ FUSION_GATEWAY_URL: 'http://SENTINEL-USERINFO:placeholder@gw.invalid:4000/v1' }, {
    httpGetJson: async () => ({ reached: false, status: 0, body: null, failure: 'unreachable' }),
  });
  const all = JSON.stringify(r);
  assert.ok(!all.includes('SENTINEL-USERINFO'), 'userinfo from the gateway URL reached the output');
  assert.ok(all.includes('gw.invalid:4000'), 'the host should still be reported - it is the useful half');
});

test('every check the runtime can fail carries a severity, so nothing is unclassified', async () => {
  const r = await run({
    SHOPPER_BOT_TOKEN: '', ASDAIR_MEDIA_ROOT: '', FUSION_GATEWAY_URL: '',
    ASDAIR_CHROME_EXE: MISSING_PATH,
  }, { resolveFrom: () => 'unresolvable', readScheduledTask: () => ({ found: false }) });

  const failures = r.checks.filter((c) => !c.ok);
  assert.ok(failures.length >= 6);
  for (const f of failures) {
    assert.ok([BLOCKING, ADVISORY].includes(f.severity), `unclassified failure: ${f.check}`);
    const bucket = f.severity === BLOCKING ? r.problems : r.warnings;
    assert.ok(bucket.some((m) => m.includes(f.detail)), `${f.check} was classified ${f.severity} but is in neither list`);
  }
  assert.equal(r.problems.length + r.warnings.length, failures.length,
    'every failed check lands in exactly one of the two exit classes');
});
