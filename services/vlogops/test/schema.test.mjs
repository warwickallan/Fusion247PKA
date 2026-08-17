// AC1 — the schema exists, is forward-only and idempotent, and cannot touch anything else.
//
// Isolation is proven TWO ways, and the second is the one that matters. A text control can
// only ever tell you what the file says; the runtime proof tells you what the database did.

import test, { after, before } from 'node:test';
import assert from 'node:assert/strict';
import {
  applyMigrations, migrationFiles, newPool, readSql, structuralFingerprint, teardown,
} from './helpers/harness.mjs';
import { forbiddenIdentifierReferences, stripNonIdentifiers } from './helpers/sql-identifiers.mjs';

let pool;

before(() => { pool = newPool(); });
after(async () => { await pool.end(); });

test('AC1 — the migration applies to a fresh namespace, and re-applies leaving IDENTICAL structure', async () => {
  const client = await pool.connect();
  try {
    await teardown(client);
    await applyMigrations(client);
    const first = await structuralFingerprint(client);

    // Forward-only and idempotent: the second application must be a no-op in effect, not
    // merely an absence of errors.
    await applyMigrations(client);
    const second = await structuralFingerprint(client);

    assert.equal(second, first, 'a second application changed the structure — the migration is not idempotent');
    assert.ok(first.includes('content_seed'), 'content_seed is missing from the applied structure');
    assert.ok(first.includes('source_snapshot'), 'source_snapshot is missing from the applied structure');
    assert.ok(first.includes('intake_run'), 'intake_run is missing from the applied structure');
  } finally {
    client.release();
  }
});

test('AC1 — teardown reverses the namespace, and re-runs cleanly', async () => {
  const client = await pool.connect();
  try {
    await teardown(client);
    await applyMigrations(client);

    await teardown(client);
    const gone = await client.query("select 1 from pg_namespace where nspname = 'vlogops'");
    assert.equal(gone.rowCount, 0, 'teardown left the vlogops namespace behind');

    // Re-runnable.
    await teardown(client);
    await applyMigrations(client);
  } finally {
    client.release();
  }
});

test('AC1(i) — no forbidden namespace is REFERENCED as an identifier by any migration', async () => {
  for (const f of migrationFiles()) {
    const hits = forbiddenIdentifierReferences(readSql(f));
    assert.deepEqual(hits, [], `${f} references forbidden namespace(s): ${hits.join(', ')}`);
  }
  const teardownHits = forbiddenIdentifierReferences(readSql('teardown.sql'));
  assert.deepEqual(teardownHits, [], `teardown.sql references forbidden namespace(s): ${teardownHits.join(', ')}`);
});

test('AC1(i) — THE CONTROL IS MADE TO FAIL: it catches a reference, and is not fooled by a mention', async () => {
  const real = readSql(migrationFiles()[0]);

  // MUTATION 1 — a genuine cross-namespace reference must be caught. Without this
  // assertion the clean result above would be evidence of nothing: a control that cannot
  // be shown to fail has not been shown to work.
  const mutated = `${real}\ncreate table vlogops.leak as select * from asdair.regulars;\n`;
  assert.notEqual(mutated, real, 'the mutant is identical to the source — the mutation did not apply');
  assert.deepEqual(
    forbiddenIdentifierReferences(mutated),
    ['asdair'],
    'the control did NOT catch a real cross-namespace reference',
  );

  // MUTATION 2 — a reference wearing double quotes is still a reference.
  assert.deepEqual(
    forbiddenIdentifierReferences(`${real}\nselect * from "session_report"."capae_occurrence";\n`),
    ['session_report'],
    'the control was fooled by a quoted identifier',
  );

  // NON-MUTATIONS — the two shapes that make a naive substring scan useless. Neither is a
  // reference, and a control that fires on them is noise that gets switched off.
  assert.deepEqual(
    forbiddenIdentifierReferences("create table vlogops.t (s text check (s in ('public', 'private')));"),
    [],
    "a privacy-state VALUE of 'public' was misread as a reference to the public namespace",
  );
  assert.deepEqual(
    forbiddenIdentifierReferences('-- this migration never touches asdair or session_report\ncreate schema vlogops;'),
    [],
    'a comment mentioning a namespace was misread as a reference to it',
  );

  // And the stripper keeps identifiers while discarding literals.
  const stripped = stripNonIdentifiers("select 'asdair' as x from vlogops.content_seed; -- tower");
  assert.ok(stripped.includes('vlogops'), 'the stripper discarded a real identifier');
  assert.ok(!/asdair/i.test(stripped), 'the stripper kept a string literal');
  assert.ok(!/tower/i.test(stripped), 'the stripper kept a comment');
});

test('AC1(ii) — RUNTIME PROOF: applying creates only vlogops and leaves neighbouring namespaces untouched', async () => {
  const client = await pool.connect();
  try {
    await teardown(client);
    await client.query('drop schema if exists asdair cascade');
    await client.query('drop schema if exists session_report cascade');

    // Stand up stubs of the namespaces the real destination actually holds. This is the
    // whole point: the migration is about to run in a database that is NOT empty, which is
    // the condition it will meet on the managed project.
    await client.query('create schema asdair');
    await client.query('create table asdair.regulars (id bigint primary key, name text not null)');
    await client.query("insert into asdair.regulars values (1, 'a regular')");
    await client.query('create schema session_report');
    await client.query('create table session_report.capae_occurrence (id bigint primary key, note text)');
    await client.query("insert into session_report.capae_occurrence values (1, 'an occurrence')");

    const schemasBefore = (await client.query(
      "select nspname from pg_namespace where nspname not like 'pg_%' and nspname <> 'information_schema' order by nspname",
    )).rows.map((r) => r.nspname);

    const neighbourFingerprint = async () => JSON.stringify((await client.query(`
      select table_schema, table_name, column_name, data_type
        from information_schema.columns
       where table_schema in ('asdair', 'session_report')
       order by table_schema, table_name, column_name`)).rows);

    const neighboursBefore = await neighbourFingerprint();
    const regularsBefore = (await client.query('select * from asdair.regulars order by id')).rows;
    const occurrenceBefore = (await client.query('select * from session_report.capae_occurrence order by id')).rows;

    await applyMigrations(client);

    const schemasAfter = (await client.query(
      "select nspname from pg_namespace where nspname not like 'pg_%' and nspname <> 'information_schema' order by nspname",
    )).rows.map((r) => r.nspname);

    const created = schemasAfter.filter((s) => !schemasBefore.includes(s));
    assert.deepEqual(created, ['vlogops'], `applying created more than its own namespace: ${created.join(', ')}`);

    assert.equal(await neighbourFingerprint(), neighboursBefore, 'a neighbouring namespace changed shape');
    assert.deepEqual(
      (await client.query('select * from asdair.regulars order by id')).rows, regularsBefore,
      'neighbouring data changed',
    );
    assert.deepEqual(
      (await client.query('select * from session_report.capae_occurrence order by id')).rows, occurrenceBefore,
      'neighbouring data changed',
    );

    // And tearing down removes only what was added.
    await teardown(client);

    const schemasAfterTeardown = (await client.query(
      "select nspname from pg_namespace where nspname not like 'pg_%' and nspname <> 'information_schema' order by nspname",
    )).rows.map((r) => r.nspname);
    assert.deepEqual(schemasAfterTeardown, schemasBefore, 'teardown did not return the database to its prior set of namespaces');

    assert.deepEqual(
      (await client.query('select * from asdair.regulars order by id')).rows, regularsBefore,
      'teardown damaged a neighbouring namespace',
    );
    assert.deepEqual(
      (await client.query('select * from session_report.capae_occurrence order by id')).rows, occurrenceBefore,
      'teardown damaged a neighbouring namespace',
    );

    // Leave the disposable cluster as we found it for the next proof file.
    await client.query('drop schema if exists asdair cascade');
    await client.query('drop schema if exists session_report cascade');
    await applyMigrations(client);
  } finally {
    client.release();
  }
});

test('AC1 — the migration issues NO grants, so the namespace is invisible to a Data API by default', async () => {
  const client = await pool.connect();
  try {
    await teardown(client);
    await applyMigrations(client);

    // Nothing in the migration may hand access to the managed project's API roles. Those
    // roles do not exist on this disposable cluster, so the honest check is that the
    // migration text issues no GRANT at all.
    for (const f of [...migrationFiles(), 'teardown.sql']) {
      const sql = stripNonIdentifiers(readSql(f));
      assert.ok(!/\bgrant\b/i.test(sql), `${f} issues a GRANT; this phase grants nothing to anyone`);
      assert.ok(!/\brow\s+level\s+security\b/i.test(sql), `${f} touches row-level security, which is out of scope`);
    }
  } finally {
    client.release();
  }
});
