// BUILD-006 Phase 4 — db/004 as a set of properties, proven against real Postgres.
//
// These proofs are DB-GATED for the same reason Phases 1-3's are: every property here is a
// property OF POSTGRES — a CHECK, a foreign key, a deferred constraint trigger, an immutability
// trigger, and the gate itself. A fake would model the assumption and then prove the assumption.
//
// The one that matters most is the last block. THE GATE IS MADE TO FAIL AND THEN MADE TO PASS, in
// that order, against the same package: refused while a finding is undisposed, admitted once the
// finding is disposed. A gate only ever observed refusing is indistinguishable from a wall, and a
// gate only ever observed admitting is indistinguishable from an ornament.

import test, { after, before } from 'node:test';
import assert from 'node:assert/strict';

import { freshSchema, migrationFiles, newPool, readSql, structuralFingerprint } from './helpers/harness.mjs';
import { suppliedPackage, workingText } from './helpers/phase4-chain.mjs';
import { verifyAndRecord } from '../src/verify/store.mjs';

let pool;
let pkg = null;
let run = null;

before(async () => {
  pool = newPool();
  await freshSchema(pool);

  // A real chain, not a hand-inserted row: story_package's foreign keys reach evidence_pack,
  // content_seed and source_snapshot, and a package assembled by hand would be proving that this
  // file can write SQL rather than that the store behaves.
  pkg = await suppliedPackage({
    pool,
    angle: 'What does the verification gate actually refuse?',
    text: workingText('Phase 4 schema proof'),
    privacyState: 'internal',
  });

  run = await verifyAndRecord({ pool, packageId: pkg.packageId });
});

after(async () => { await pool.end(); });

// ─────────────────────────────────────────────────────────────────────────────────────────
// The migration itself
// ─────────────────────────────────────────────────────────────────────────────────────────

test('004 is present, numbered in sequence, and picked up by the migration runner', () => {
  const files = migrationFiles();
  assert.ok(files.includes('004_vlogops_verification.sql'), `004 missing from ${files.join(', ')}`);
  assert.equal(files[files.length - 1], '004_vlogops_verification.sql', 'migrations are out of order');
});

test('004 is idempotent — re-applying it leaves IDENTICAL structure', async () => {
  const client = await pool.connect();
  try {
    const before_ = await structuralFingerprint(client);
    await client.query(readSql('004_vlogops_verification.sql'));
    const after_ = await structuralFingerprint(client);
    assert.equal(after_, before_, 're-applying 004 changed the namespace structure');
  } finally {
    client.release();
  }
});

test('004 writes NOTHING outside the vlogops namespace', async () => {
  const sql = readSql('004_vlogops_verification.sql');
  const statements = sql.split('\n').filter((l) => !l.trimStart().startsWith('--'));
  const joined = statements.join('\n');

  // Tables, views and functions carry their own schema. Indexes and triggers do not — they take
  // the schema of the object they attach to, so for those the ON clause is what must be checked.
  for (const m of joined.matchAll(/create\s+(?:or\s+replace\s+)?(?:table|view|function)\s+(?:if\s+not\s+exists\s+)?([^\s(]+)/gi)) {
    assert.ok(
      m[1].startsWith('vlogops.'),
      `004 creates "${m[1]}", which is not schema-qualified into vlogops`,
    );
  }
  for (const m of joined.matchAll(/create\s+(?:constraint\s+)?(?:index|trigger)[\s\S]{0,300}?\son\s+([^\s(]+)/gi)) {
    assert.ok(
      m[1].startsWith('vlogops.'),
      `004 attaches an index or trigger to "${m[1]}", which is outside vlogops`,
    );
  }

  assert.ok(!/\bgrant\b/i.test(joined), '004 issues a GRANT; it must issue none');
  assert.ok(!/row level security/i.test(joined), '004 touches RLS; it must touch none');
});

test('004 alters no table belonging to Phases 1-3', () => {
  const sql = readSql('004_vlogops_verification.sql');
  assert.ok(!/\balter\s+table\b/i.test(sql), '004 contains an ALTER TABLE');
  for (const legacy of ['content_seed', 'source_snapshot', 'evidence_pack', 'evidence_pack_entry',
    'story_package', 'story_claim', 'story_claim_citation', 'story_segment']) {
    assert.ok(
      !new RegExp(`create\\s+(or\\s+replace\\s+)?trigger[\\s\\S]{0,200}on\\s+vlogops\\.${legacy}\\b`, 'i').test(sql),
      `004 puts a trigger on Phase 1-3 table ${legacy}`,
    );
  }
});

// ─────────────────────────────────────────────────────────────────────────────────────────
// Immutability — a verdict that could be edited is not a verdict
// ─────────────────────────────────────────────────────────────────────────────────────────

test('every Phase 4 table refuses UPDATE and DELETE', async () => {
  // SELF-CONTAINED ON PURPOSE. An immutability proof that ran an UPDATE against an EMPTY table
  // would touch zero rows, fire no trigger, raise nothing — and pass. That is a control reporting
  // on ground it never examined, which is the failure this whole phase is about. So this builds
  // its own package and drives it all the way to advanced, so that every one of the five tables
  // has a row for the mutation to be refused ON.
  const own = await suppliedPackage({
    pool,
    angle: 'A package that exists so immutability can be proven against real rows.',
    text: workingText('Phase 4 immutability proof'),
    privacyState: 'internal',
  });
  const ownRun = await verifyAndRecord({ pool, packageId: own.packageId });

  await pool.query(
    `insert into vlogops.source_rights (seed_id, source_ref, basis, basis_source, declared_by)
     values ($1,$2,'estate-owned','declared','Warwick')`,
    [own.seedId, own.sourceRef],
  );

  const openFindings = await pool.query(
    `select ordinal, severity from vlogops.verification_finding where verification_id = $1`,
    [ownRun.verificationId],
  );
  assert.ok(openFindings.rowCount > 0, 'this proof needs a run that produced findings to dispose');
  for (const f of openFindings.rows) {
    await pool.query(
      `insert into vlogops.finding_disposition
         (verification_id, ordinal, severity, disposition, decided_by, reason)
       values ($1,$2,$3,$4,'Warwick','Immutability proof: disposed so an advance row exists.')`,
      [ownRun.verificationId, f.ordinal, f.severity, f.severity === 'block' ? 'overridden' : 'answered'],
    );
  }
  await pool.query(
    `insert into vlogops.package_advance (package_id, verification_id, advanced_by)
     values ($1,$2,'immutability-proof')`,
    [own.packageId, ownRun.verificationId],
  );

  const vid = ownRun.verificationId;
  const cases = [
    ['vlogops.verification_run', `verdict = 'pass'`, `verification_id = '${vid}'`],
    ['vlogops.verification_finding', `severity = 'surface'`, `verification_id = '${vid}'`],
    ['vlogops.finding_disposition', `reason = 'changed my mind'`, `verification_id = '${vid}'`],
    ['vlogops.package_advance', `advanced_by = 'someone-else'`, `package_id = '${own.packageId}'`],
    ['vlogops.source_rights', `basis = 'public-domain'`, `seed_id = '${own.seedId}'`],
  ];

  // Each WHERE above matches at least one row, checked here rather than assumed — an immutability
  // proof over zero rows is the exact false green this block exists to avoid.
  for (const [table, , where] of cases) {
    const n = await pool.query(`select count(*)::int as n from ${table} where ${where}`);
    assert.ok(n.rows[0].n > 0, `${table}: the immutability proof would have touched 0 rows`);
  }

  for (const [table, set, where] of cases) {
    await assert.rejects(
      () => pool.query(`update ${table} set ${set} where ${where}`),
      (err) => /append-only|immutable/i.test(err.message),
      `${table} allowed an UPDATE`,
    );
    await assert.rejects(
      () => pool.query(`delete from ${table} where ${where}`),
      (err) => /append-only/i.test(err.message),
      `${table} allowed a DELETE`,
    );
  }
});

// ─────────────────────────────────────────────────────────────────────────────────────────
// The header cannot lie about its body
// ─────────────────────────────────────────────────────────────────────────────────────────

test('a run cannot declare `pass` while carrying findings, and cannot miscount them', async () => {
  // The CHECK: pass means zero findings, by arithmetic, before any trigger runs.
  await assert.rejects(
    () => pool.query(
      `insert into vlogops.verification_run
         (verification_id, package_id, verifier_version, ruleset_version, manifest, dimensions,
          verdict, finding_count, blocking_count, surfaced_count)
       values ($1,$2,'v','r','{}'::jsonb,'{}'::jsonb,'pass',1,1,0)`,
      ['a'.repeat(64), pkg.packageId],
    ),
    /verdict_matches_findings/,
    'a `pass` header over a body with findings was accepted',
  );

  // The deferred trigger: a header that counts its own findings wrongly is refused at COMMIT.
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query(
      `insert into vlogops.verification_run
         (verification_id, package_id, verifier_version, ruleset_version, manifest, dimensions,
          verdict, finding_count, blocking_count, surfaced_count)
       values ($1,$2,'v','r','{}'::jsonb,'{}'::jsonb,'blocked',5,5,0)`,
      ['b'.repeat(64), pkg.packageId],
    );
    await client.query(
      `insert into vlogops.verification_finding
         (verification_id, ordinal, dimension, severity, rule, detail, evidence)
       values ($1,0,'fact','block','FACT-1','planted','{}'::jsonb)`,
      ['b'.repeat(64)],
    );
    await assert.rejects(
      () => client.query('COMMIT'),
      /declares 5\/5\/0 .* and holds 1\/1\/0/s,
      'a run header miscounting its own findings was committed',
    );
  } finally {
    await client.query('ROLLBACK').catch(() => {});
    client.release();
  }
});

// ─────────────────────────────────────────────────────────────────────────────────────────
// Overruling a failure and answering a question are not interchangeable
// ─────────────────────────────────────────────────────────────────────────────────────────

test('a disposition cannot claim the wrong severity, and cannot be reasonless', async () => {
  const findings = await pool.query(
    `select verification_id, ordinal, severity from vlogops.verification_finding
      where verification_id = $1 order by ordinal`, [run.verificationId],
  );
  assert.ok(findings.rowCount > 0, 'this proof needs a run that produced at least one finding');

  const f = findings.rows[0];
  const wrongSeverity = f.severity === 'block' ? 'surface' : 'block';

  await assert.rejects(
    () => pool.query(
      `insert into vlogops.finding_disposition
         (verification_id, ordinal, severity, disposition, decided_by, reason)
       values ($1,$2,$3,$4,'Warwick','because')`,
      [f.verification_id, f.ordinal, wrongSeverity,
        wrongSeverity === 'block' ? 'overridden' : 'answered'],
    ),
    /finding_disposition_finding_fk/,
    'a disposition claiming a severity the finding does not have was accepted',
  );

  await assert.rejects(
    () => pool.query(
      `insert into vlogops.finding_disposition
         (verification_id, ordinal, severity, disposition, decided_by, reason)
       values ($1,$2,$3,$4,'Warwick','   ')`,
      [f.verification_id, f.ordinal, f.severity,
        f.severity === 'block' ? 'overridden' : 'answered'],
    ),
    /finding_disposition_reason_check|violates check constraint/,
    'an override with a blank reason was accepted',
  );
});

// ─────────────────────────────────────────────────────────────────────────────────────────
// THE GATE — made to fail, then made to pass
// ─────────────────────────────────────────────────────────────────────────────────────────

test('THE GATE: package_advance is REFUSED while a finding is undisposed, and ADMITTED once every finding is disposed', async () => {
  const open = await pool.query(
    `select f.verification_id, f.ordinal, f.severity from vlogops.verification_run r
       join vlogops.verification_finding f on f.verification_id = r.verification_id
       left join vlogops.finding_disposition d
         on d.verification_id = f.verification_id and d.ordinal = f.ordinal
      where r.package_id = $1 and d.verification_id is null`,
    [pkg.packageId],
  );
  assert.ok(
    open.rowCount > 0,
    'this proof requires a package with at least one undisposed finding — otherwise it would be '
    + 'observing the gate admit and calling that evidence it can refuse',
  );

  // ── made to FAIL ──
  await assert.rejects(
    () => pool.query(
      `insert into vlogops.package_advance (package_id, verification_id, advanced_by)
       values ($1,$2,'a-later-stage')`,
      [pkg.packageId, run.verificationId],
    ),
    (err) => /is BLOCKED and cannot advance/.test(err.message),
    'a blocked package was advanced',
  );

  // ── re-running verification must NOT clear it: the block is sticky across runs ──
  const second = await verifyAndRecord({ pool, packageId: pkg.packageId });
  assert.equal(second.deduplicated, true, 're-verifying produced a different verdict');
  await assert.rejects(
    () => pool.query(
      `insert into vlogops.package_advance (package_id, verification_id, advanced_by)
       values ($1,$2,'a-later-stage')`,
      [pkg.packageId, second.verificationId],
    ),
    (err) => /is BLOCKED and cannot advance/.test(err.message),
    're-running verification cleared a block',
  );

  // ── dispose every finding, attributed and reasoned ──
  for (const f of open.rows) {
    await pool.query(
      `insert into vlogops.finding_disposition
         (verification_id, ordinal, severity, disposition, decided_by, reason)
       values ($1,$2,$3,$4,'Warwick','Schema proof: disposed so the gate can be observed admitting.')`,
      [f.verification_id, f.ordinal, f.severity, f.severity === 'block' ? 'overridden' : 'answered'],
    );
  }

  // ── made to PASS ──
  await pool.query(
    `insert into vlogops.package_advance (package_id, verification_id, advanced_by)
     values ($1,$2,'a-later-stage')`,
    [pkg.packageId, run.verificationId],
  );

  const state = await pool.query(
    'select advanced, advanceable from vlogops.package_verification_state where package_id = $1',
    [pkg.packageId],
  );
  assert.equal(state.rows[0].advanced, true);
  assert.equal(state.rows[0].advanceable, true);
});

test('an advance cannot cite a verification of a DIFFERENT package', async () => {
  const other = await suppliedPackage({
    pool,
    angle: 'A second package, so the advance can be pointed at the wrong verdict.',
    text: workingText('Phase 4 schema proof — second package'),
    privacyState: 'internal',
  });

  await assert.rejects(
    () => pool.query(
      `insert into vlogops.package_advance (package_id, verification_id, advanced_by)
       values ($1,$2,'a-later-stage')`,
      [other.packageId, run.verificationId],
    ),
    /package_advance_run_fk/,
    'an advance borrowed another package\'s verification',
  );
});

test('source_rights refuses a derived basis that is not estate-owned, and a licence with no holder', async () => {
  await assert.rejects(
    () => pool.query(
      `insert into vlogops.source_rights
         (seed_id, source_ref, basis, basis_source, declared_by)
       values ($1,$2,'licensed','derived-from-provenance','test')`,
      [pkg.seedId, pkg.sourceRef],
    ),
    /derived_is_estate_owned/,
    'a derived basis other than estate-owned was accepted',
  );

  await assert.rejects(
    () => pool.query(
      `insert into vlogops.source_rights
         (seed_id, source_ref, basis, basis_source, declared_by)
       values ($1,$2,'licensed','declared','test')`,
      [pkg.seedId, pkg.sourceRef],
    ),
    /licensed_names_holder/,
    'a licensed basis with no holder was accepted',
  );
});
