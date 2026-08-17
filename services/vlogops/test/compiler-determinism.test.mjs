// BUILD-006 Phase 2 — AC2. Determinism, proven by DIFFING, never by asserting.
//
// ── WHY THE ARTEFACT IS A DOCUMENT AND NOT TWO ROWS ─────────────────────────────────────
// The pack is content-addressed and written with ON CONFLICT DO NOTHING, so the second
// compile of the same seed deduplicates and there is only ever ONE row in the store. "Diff
// the two packs" is therefore not a thing the database can be asked. The determinism claim
// is genuinely two claims, and they are proven separately:
//
//   1. TWO INDEPENDENT PROCESSES each EMIT the canonical bytes they decided on, and those
//      two files are compared byte for byte. This is the claim that the compiler's decision
//      — content, dedupe, budget, ordering, identity — depends on nothing local to a run.
//
//   2. The second process's WRITE deduplicates onto the first's row. This is the claim that
//      the store agrees, and that re-compiling is a safe no-op rather than a second pack.
//
// Proving only (2) would pass with a compiler that produced garbage identically twice.
// Proving only (1) would leave the store free to accumulate duplicates. Both, or neither.

import test, { after, before } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { SERVICE_ROOT, databaseUrl, freshSchema, newPool } from './helpers/harness.mjs';
import { PACK_MAX_BYTES, PACK_MAX_ENTRIES } from '../src/config.mjs';
import { compileEvidencePack } from '../src/compiler.mjs';
import { planPack } from '../src/pack.mjs';

const INTAKE_CLI = path.join(SERVICE_ROOT, 'bin', 'vlogops-intake.mjs');
const COMPILE_CLI = path.join(SERVICE_ROOT, 'bin', 'vlogops-compile.mjs');

const FIXTURE_FROM = '2026-08-05';
const FIXTURE_TO = '2026-08-05';

let pool;
let seedId = null;
const emitted = [];

function runCli(cliPath, args) {
  return spawnSync(process.execPath, [cliPath, ...args], {
    encoding: 'utf8',
    env: { ...process.env, VLOGOPS_DB_URL: databaseUrl() },
  });
}

const lastJson = (stdout) => JSON.parse(stdout.trim().split('\n').pop());

before(async () => {
  pool = newPool();
  await freshSchema(pool);

  const r = runCli(INTAKE_CLI, ['records', '--from', FIXTURE_FROM, '--to', FIXTURE_TO]);
  assert.equal(r.status, 0, `Phase 1 intake failed: ${r.stderr}`);
  seedId = lastJson(r.stdout).seed_id;
});

after(async () => {
  await pool.end();
  for (const f of emitted) { try { fs.rmSync(f, { force: true }); } catch { /* best effort */ } }
});

test('AC2 — TWO SEPARATE PROCESSES compile the same real seed to BYTE-IDENTICAL documents', () => {
  const a = path.join(os.tmpdir(), `vlogops-det-a-${process.pid}.json`);
  const b = path.join(os.tmpdir(), `vlogops-det-b-${process.pid}.json`);
  emitted.push(a, b);

  // Two genuinely separate OS processes. Not two calls in one runtime, where a shared module
  // cache, a warm Map or an accumulated Set could carry state between them and make an
  // in-process determinism proof agree with itself for the wrong reason.
  const first = runCli(COMPILE_CLI, ['compile', '--seed', seedId, '--emit', a]);
  assert.equal(first.status, 0, `first compile failed: ${first.stderr}`);

  const second = runCli(COMPILE_CLI, ['compile', '--seed', seedId, '--emit', b]);
  assert.equal(second.status, 0, `second compile failed: ${second.stderr}`);

  const bytesA = fs.readFileSync(a);
  const bytesB = fs.readFileSync(b);

  assert.ok(bytesA.length > 0, 'the first process emitted an empty document');
  assert.ok(
    bytesA.equals(bytesB),
    'the two emitted pack documents differ:\n'
    + `  A (${bytesA.length} bytes): ${bytesA.toString('utf8').slice(0, 400)}\n`
    + `  B (${bytesB.length} bytes): ${bytesB.toString('utf8').slice(0, 400)}`,
  );

  const outA = lastJson(first.stdout);
  const outB = lastJson(second.stdout);
  assert.equal(outA.pack_id, outB.pack_id, 'two processes disagreed on the pack identity');

  // Half two: the store agreed, and did not accumulate a second pack.
  assert.equal(outA.deduplicated, false, 'the first compile thought the pack already existed');
  assert.equal(outB.deduplicated, true, 'the second compile wrote a second pack instead of deduplicating');

  console.log(
    `[AC2] two processes -> identical ${bytesA.length}-byte documents, pack_id=${outA.pack_id}\n`
    + `[AC2]   first: deduplicated=${outA.deduplicated} · second: deduplicated=${outB.deduplicated}`,
  );
});

test('AC2 — the store holds exactly ONE pack and one set of entries after two compiles', async () => {
  const packs = await pool.query(
    'select count(*)::int n from vlogops.evidence_pack where seed_id = $1', [seedId],
  );
  assert.equal(packs.rows[0].n, 1, 'two compiles left two packs');

  const runs = await pool.query(
    'select count(*)::int n, count(distinct outcome)::int kinds from vlogops.compile_run where seed_id = $1',
    [seedId],
  );
  // TWO ledger rows and ONE pack: the audit trail records both attempts, exactly as Phase 1's
  // intake_run does. An idempotent write that erased the evidence of the second attempt would
  // be hiding the thing an operator most wants to see.
  assert.equal(runs.rows[0].n, 2, 'the ledger did not record both compile attempts');
  assert.equal(runs.rows[0].kinds, 2, 'the ledger did not distinguish the compile from the deduplication');

  console.log(`[AC2] store after two compiles: packs=1 ledger_rows=${runs.rows[0].n}`);
});

test('AC2 — nothing time-varying, process-local or ordinal enters the pack identity', async () => {
  // Made to fail in the only way that matters: the manifest is inspected for the categories
  // of value that would make a re-compile diverge. A field-by-field ban is checkable; "we
  // were careful" is not.
  const pack = await pool.query(
    'select pack_id, manifest, created_at from vlogops.evidence_pack where seed_id = $1', [seedId],
  );
  const manifest = pack.rows[0].manifest;
  const text = JSON.stringify(manifest);

  for (const forbidden of ['captured_at', 'created_at', 'recorded_at', 'sealed_at', 'pid', 'hostname', 'attempt_key']) {
    assert.ok(!text.includes(forbidden), `the pack manifest carries '${forbidden}', which varies between runs`);
  }

  // The pack's own row clock exists and is deliberately NOT in the manifest.
  assert.ok(pack.rows[0].created_at, 'the pack row carries no created_at');

  // A CLOSED LIST of top-level keys. An open-ended "does not contain X" check only ever
  // catches the values someone already thought of; this one fails the moment anything new
  // is admitted into the identity, including something nobody has invented yet.
  assert.deepEqual(
    Object.keys(manifest).sort(),
    ['budget', 'compiler', 'entries', 'omitted', 'ordering_rule', 'seed_id', 'selection_rule', 'v'],
    'the pack manifest gained or lost a top-level field; identity has changed shape',
  );
  assert.deepEqual(
    Object.keys(manifest.entries[0]).sort(),
    ['byte_length', 'content_sha256', 'media_type', 'occurred_at', 'occurred_at_basis', 'ordinal', 'source_ref'],
    'a pack entry gained or lost a field inside the identity',
  );

  // Every entry's placement is derived from stored provenance, never from the capture clock.
  const bases = new Set(manifest.entries.map((e) => e.occurred_at_basis));
  for (const b of bases) {
    assert.ok(['git-commit-time', 'dated-filename', 'unknown'].includes(b), `unexpected ordering basis ${b}`);
  }
});

test('AC2 — planning is a PURE function: shuffled input rows produce the same plan', async () => {
  // The database returns rows in whatever order it likes. This proves the compiler's decision
  // does not inherit that order — the failure would be invisible in normal running and would
  // surface as two different packs on two machines.
  const snaps = await pool.query(
    `select seed_id, source_ref, content_sha256, byte_length, media_type, provenance
       from vlogops.source_snapshot where seed_id = $1`, [seedId],
  );
  const rows = snaps.rows;
  assert.ok(rows.length > 2, 'too few snapshots to shuffle meaningfully');

  const budget = { maxEntries: PACK_MAX_ENTRIES, maxBytes: PACK_MAX_BYTES };
  const forward = planPack({ snapshots: rows, ...budget });
  const reversed = planPack({ snapshots: [...rows].reverse(), ...budget });

  // A fixed, reproducible permutation rather than a random one: a proof that shuffles
  // differently on every run reports a different fact on every run.
  const rotated = [...rows.slice(3), ...rows.slice(0, 3)];
  const third = planPack({ snapshots: rotated, ...budget });

  const refsOf = (p) => p.entries.map((e) => `${e.ordinal}:${e.source_ref}`);
  assert.deepEqual(refsOf(reversed), refsOf(forward), 'reversing the input rows changed the pack');
  assert.deepEqual(refsOf(third), refsOf(forward), 'rotating the input rows changed the pack');
  assert.deepEqual(reversed.omitted, forward.omitted, 'input order changed what was disclosed as omitted');

  console.log(`[AC2] plan stable across 3 input permutations, ${forward.entries.length} entries`);
});

test('AC2 — a DIFFERENT seed compiles to a different pack, so identity is not a constant', async () => {
  // The complement of the determinism proof. Without it, a compiler that returned the same
  // hash for everything would pass every test above.
  const other = spawnSync(process.execPath, [
    INTAKE_CLI, 'supplied', '--angle', 'a different question entirely',
    '--text', 'A separate seed, with separate content.', '--privacy', 'internal',
  ], { encoding: 'utf8', env: { ...process.env, VLOGOPS_DB_URL: databaseUrl() } });
  assert.equal(other.status, 0, `intake failed: ${other.stderr}`);
  const otherSeed = lastJson(other.stdout).seed_id;

  const result = await compileEvidencePack({
    pool, seedId: otherSeed, maxEntries: PACK_MAX_ENTRIES, maxBytes: PACK_MAX_BYTES,
  });

  const first = await pool.query(
    'select pack_id from vlogops.evidence_pack where seed_id = $1', [seedId],
  );
  assert.notEqual(result.packId, first.rows[0].pack_id.trim(), 'two different seeds produced the same pack identity');
  assert.equal(result.bounded, false, 'a single-member seed was reported as budget-bound');
  assert.equal(result.entryCount, 1, 'a single-member seed did not produce a single-entry pack');

  console.log(`[AC2] a different seed -> a different pack: ${result.packId.slice(0, 12)}… (entries=1, bounded=false)`);
});
