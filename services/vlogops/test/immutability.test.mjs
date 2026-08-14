// AC3 — the snapshot is immutable, and a later source failure cannot rewrite history.
//
// The map's §3 rule, which this proves: accepted source content is snapshotted with
// timestamps, provenance and integrity metadata, and a later connector or source failure
// cannot erase or reinterpret an existing run.
//
// The fixture files are created, mutated and deleted in a TEMP DIRECTORY THIS TEST OWNS.
// Mutating a repository file to prove a point would be writing outside the declared file
// surface, so it is not done — and the proof is not weakened by that, because what is being
// tested is what the STORE does after its source goes bad, not which directory the source
// lived in.

import test, { after, before } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { freshSchema, newPool, testConfig } from './helpers/harness.mjs';
import { intake, readSeed } from '../src/intake.mjs';
import { snapshotFile, verifySnapshotIntegrity } from '../src/snapshot.mjs';
import { sha256Hex } from '../src/identity.mjs';

let pool;
let fixtureRoot;

before(async () => {
  pool = newPool();
  await freshSchema(pool);
  fixtureRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'vlogops-fixture-'));
});

after(async () => {
  await pool.end();
  try { fs.rmSync(fixtureRoot, { recursive: true, force: true }); } catch { /* best effort */ }
});

const ORIGINAL = '# the original source\n\nThis is what the seed captured at intake.\n';

async function intakeAFixture(name) {
  const abs = path.join(fixtureRoot, name);
  fs.writeFileSync(abs, ORIGINAL, 'utf8');

  const member = snapshotFile({
    repoRoot: fixtureRoot,
    absPath: abs,
    privacyState: 'internal',
    maxInlineBytes: 1024 * 1024,
    provenance: { source_system: 'test-fixture', route: 'records' },
  });

  const result = await intake({
    pool,
    route: 'records',
    selector: { kind: 'fixture', name },
    privacyState: 'internal',
    members: [member],
  });

  return { abs, member, result };
}

test('AC3 — the source is MUTATED and then DELETED, and the seed reads back unchanged', async () => {
  const { abs, member, result } = await intakeAFixture('source.md');
  assert.equal(result.deduplicated, false);

  // The source goes bad in the two ways that actually happen: it is rewritten, and then it
  // is gone entirely.
  fs.writeFileSync(abs, 'TOTALLY DIFFERENT CONTENT, WRITTEN AFTER INTAKE\n', 'utf8');
  fs.rmSync(abs);
  assert.equal(fs.existsSync(abs), false, 'the fixture source was not actually deleted');

  const read = await readSeed(pool, result.seedId);
  assert.ok(read, 'the seed vanished with its source');
  assert.equal(read.snapshots.length, 1);

  const snap = read.snapshots[0];
  assert.equal(snap.content.toString('utf8'), ORIGINAL, 'the stored bytes changed when the source did');
  assert.equal(snap.content_sha256.trim(), member.content_sha256, 'the stored hash changed');

  // The integrity check reads ONLY the stored bytes. It must still be able to answer after
  // the original is gone — that is the entire point of holding the bytes.
  const integrity = verifySnapshotIntegrity(snap);
  assert.ok(integrity.ok, `stored bytes failed their own integrity check: ${JSON.stringify(integrity)}`);

  // And the metadata the criterion names is all present.
  assert.ok(snap.captured_at instanceof Date, 'no capture timestamp');
  assert.ok(snap.provenance && snap.provenance.source_system, 'no provenance');
  assert.equal(snap.privacy_state, 'internal', 'no privacy state');
  assert.ok(Number(snap.byte_length) > 0, 'no integrity metadata');
});

test('AC3 — the DATABASE refuses to rewrite a snapshot, not merely the application', async () => {
  const { result } = await intakeAFixture('refuses.md');

  await assert.rejects(
    pool.query(
      "update vlogops.source_snapshot set content = $1 where seed_id = $2",
      [Buffer.from('rewritten history'), result.seedId],
    ),
    /append-only|UPDATE refused/i,
    'a snapshot could be UPDATEd',
  );

  await assert.rejects(
    pool.query('delete from vlogops.source_snapshot where seed_id = $1', [result.seedId]),
    /append-only|DELETE refused/i,
    'a snapshot could be DELETEd',
  );

  // Still intact after both attempts.
  const read = await readSeed(pool, result.seedId);
  assert.equal(read.snapshots[0].content.toString('utf8'), ORIGINAL);
});

test('AC3 — a seed\'s IDENTITY-BEARING columns cannot be rewritten; its lifecycle columns can', async () => {
  const { result } = await intakeAFixture('identity.md');

  for (const [col, value] of [
    ['manifest', '{"v":1,"route":"records","angle":null,"members":[]}'],
    ['route', 'supplied'],
    ['selection_key', 'f'.repeat(64)],
  ]) {
    await assert.rejects(
      pool.query(`update vlogops.content_seed set ${col} = $1 where seed_id = $2`, [value, result.seedId]),
      /identity-bearing and immutable/i,
      `${col} could be rewritten`,
    );
  }

  await assert.rejects(
    pool.query('delete from vlogops.content_seed where seed_id = $1', [result.seedId]),
    /append-only|DELETE refused/i,
    'a seed could be DELETEd',
  );

  // Lifecycle state remains writable — the seed can be marked abandoned without anyone
  // being able to change what the seed IS.
  await pool.query("update vlogops.content_seed set status = 'abandoned' where seed_id = $1", [result.seedId]);
  const after = await pool.query('select status from vlogops.content_seed where seed_id = $1', [result.seedId]);
  assert.equal(after.rows[0].status, 'abandoned');
});

test('AC3 — the ledger is append-only too, so the record of what happened cannot be edited', async () => {
  const { result } = await intakeAFixture('ledger.md');
  await assert.rejects(
    pool.query("update vlogops.intake_run set outcome = 'deduplicated' where seed_id = $1", [result.seedId]),
    /append-only|UPDATE refused/i,
  );
  await assert.rejects(
    pool.query('delete from vlogops.intake_run where seed_id = $1', [result.seedId]),
    /append-only|DELETE refused/i,
  );
});

test('AC3 — THE INTEGRITY CHECK IS MADE TO FAIL: tampered bytes are detected', () => {
  // The clean result above means nothing unless this control can be shown to fire.
  const good = { content: Buffer.from(ORIGINAL), content_sha256: null, byte_length: Buffer.byteLength(ORIGINAL) };
  good.content_sha256 = sha256Hex(good.content);
  assert.ok(verifySnapshotIntegrity(good).ok, 'a genuine snapshot failed its integrity check');

  const tampered = { ...good, content: Buffer.from('tampered') };
  assert.equal(verifySnapshotIntegrity(tampered).ok, false, 'tampered bytes passed the integrity check');

  const wrongLength = { ...good, byte_length: good.byte_length + 1 };
  assert.equal(verifySnapshotIntegrity(wrongLength).ok, false, 'a length mismatch passed the integrity check');
});
