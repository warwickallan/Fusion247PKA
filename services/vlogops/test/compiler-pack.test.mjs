// BUILD-006 Phase 2 — AC1, AC3, AC4, AC5.
//
// THE CONSTRAINT THAT OUTRANKS EVERY OTHER LINE IN THIS FILE: the seed compiled here is one
// PHASE 1'S OWN INTAKE MADE. AC1 runs `bin/vlogops-intake.mjs records` as a real child
// process, over the real repository window, and hands the resulting seed_id to the compiler.
// No fixture seed, no hand-inserted row, no synthetic substitute. A Phase 2 that had never
// seen a seed Phase 1 produced would be a second component wearing the same name.

import test, { after, before } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { REPO_ROOT, SERVICE_ROOT, databaseUrl, freshSchema, newPool } from './helpers/harness.mjs';
import { makeScratchTree } from './helpers/scratch-tree.mjs';
import { PACK_MAX_BYTES, PACK_MAX_ENTRIES } from '../src/config.mjs';
import { readPack, verifyPack } from '../src/compiler.mjs';
import { packIdentity } from '../src/pack.mjs';

const INTAKE_CLI = path.join(SERVICE_ROOT, 'bin', 'vlogops-intake.mjs');
const COMPILE_CLI = path.join(SERVICE_ROOT, 'bin', 'vlogops-compile.mjs');

// Phase 1's fixture window, kept deliberately: a real, ordinary, busy day with ZERO session
// logs. Measured in this worktree at the governance head: 150 non-merge commits, 6 dated
// deliverables, 0 session logs.
const FIXTURE_FROM = '2026-08-05';
const FIXTURE_TO = '2026-08-05';

let pool;
let realSeedId = null;
let realPackId = null;

function runCli(cliPath, args, env = {}) {
  return spawnSync(process.execPath, [cliPath, ...args], {
    encoding: 'utf8',
    env: { ...process.env, VLOGOPS_DB_URL: databaseUrl(), ...env },
  });
}

/** The last line of stdout is the JSON result; earlier lines are diagnostics. */
function lastJson(stdout) {
  return JSON.parse(stdout.trim().split('\n').pop());
}

before(async () => {
  pool = newPool();
  await freshSchema(pool);
});
after(async () => { await pool.end(); });

// ─────────────────────────────────────────────────────────────────────────────────────────
// AC1 — a REAL Phase 1 seed, made by Phase 1's own Route 1 intake, compiled by Phase 2.
// ─────────────────────────────────────────────────────────────────────────────────────────

test('AC1 — Phase 1 Route 1 intake creates a REAL seed from the real repository window', () => {
  const r = runCli(INTAKE_CLI, ['records', '--from', FIXTURE_FROM, '--to', FIXTURE_TO]);
  assert.equal(r.status, 0, `Phase 1 intake failed: ${r.stderr}`);

  const out = lastJson(r.stdout);
  assert.match(out.seed_id, /^[0-9a-f]{64}$/, 'intake did not return a content-derived seed id');
  assert.equal(out.deduplicated, false, 'the seed already existed before this proof ran');
  assert.ok(out.members > 0, 'Phase 1 produced a seed with no members');

  realSeedId = out.seed_id;
  console.log(
    `[AC1] REAL SEED via Phase 1 Route 1 (bin/vlogops-intake.mjs records `
    + `--from ${FIXTURE_FROM} --to ${FIXTURE_TO}) over ${REPO_ROOT}\n`
    + `[AC1]   seed_id=${out.seed_id} members=${out.members}`,
  );
});

test('AC1 — the seed the compiler is given is a sealed Phase 1 `records` seed in the store', async () => {
  assert.ok(realSeedId, 'no real seed was produced by the previous proof');

  const seed = await pool.query(
    'select route, status, manifest from vlogops.content_seed where seed_id = $1', [realSeedId],
  );
  assert.equal(seed.rowCount, 1, 'the seed is not in the store');
  assert.equal(seed.rows[0].route, 'records', 'the seed did not come from Phase 1 Route 1');
  assert.equal(seed.rows[0].status, 'sealed', 'the seed is not sealed');

  // Phase 1's own identity claim, rechecked here rather than assumed: the manifest stored
  // beside the seed still hashes to the seed's id. If that were untrue, everything Phase 2
  // builds on this seed would be built on a false identity.
  const { seedIdentity } = await import('../src/identity.mjs');
  assert.equal(seedIdentity(seed.rows[0].manifest), realSeedId, 'the stored manifest no longer hashes to the seed id');
});

test('AC1 — the compiler compiles that real seed into a durable pack', async () => {
  assert.ok(realSeedId, 'no real seed was produced');

  const emit = path.join(os.tmpdir(), `vlogops-ac1-${process.pid}.pack.json`);
  const r = runCli(COMPILE_CLI, ['compile', '--seed', realSeedId, '--emit', emit]);
  assert.equal(r.status, 0, `compile failed: ${r.stderr}`);

  const out = lastJson(r.stdout);
  assert.match(out.pack_id, /^[0-9a-f]{64}$/, 'the pack has no content-derived identity');
  assert.equal(out.seed_id, realSeedId, 'the pack was compiled from a different seed');
  assert.equal(out.deduplicated, false, 'this pack already existed before the proof ran');
  assert.ok(out.entries > 0, 'the pack is empty');

  const stored = await readPack(pool, out.pack_id);
  assert.ok(stored, 'the pack is not in the store');
  assert.equal(stored.entries.length, out.entries, 'the store holds a different number of entries');
  assert.equal(
    packIdentity(stored.pack.manifest), out.pack_id,
    'the stored manifest does not hash to the pack id — the identity is not recomputable',
  );

  realPackId = out.pack_id;
  fs.rmSync(emit, { force: true });

  console.log(
    `[AC1] COMPILED real seed ${realSeedId.slice(0, 12)}… -> pack ${out.pack_id.slice(0, 12)}… `
    + `entries=${out.entries} bytes=${out.entry_bytes} bounded=${out.bounded} `
    + `omitted=${out.omitted} candidates=${out.candidates}`,
  );
});

// ─────────────────────────────────────────────────────────────────────────────────────────
// AC3 — bounded, with the budget explicit and what was left out disclosed.
// ─────────────────────────────────────────────────────────────────────────────────────────

test('AC3 — the budget is a MODULE CONSTANT that no environment variable can widen', async () => {
  assert.equal(typeof PACK_MAX_ENTRIES, 'number');
  assert.equal(typeof PACK_MAX_BYTES, 'number');

  // Made to fail: if the budget could be read from the environment, this would move it.
  const { loadConfig } = await import('../src/config.mjs');
  const widened = loadConfig({
    VLOGOPS_DB_URL: databaseUrl(),
    VLOGOPS_REPO_ROOT: REPO_ROOT,
    PACK_MAX_ENTRIES: '9999',
    PACK_MAX_BYTES: '999999999',
    VLOGOPS_PACK_MAX_ENTRIES: '9999',
    VLOGOPS_PACK_MAX_BYTES: '999999999',
  });
  assert.equal(widened.packMaxEntries, PACK_MAX_ENTRIES, 'an environment variable widened the entry budget');
  assert.equal(widened.packMaxBytes, PACK_MAX_BYTES, 'an environment variable widened the byte budget');
});

test('AC3 — the real seed EXCEEDS the pack budget, so this proof is not vacuous', async () => {
  assert.ok(realSeedId, 'no real seed was produced');
  const snaps = await pool.query(
    'select count(*)::int n from vlogops.source_snapshot where seed_id = $1', [realSeedId],
  );
  assert.ok(
    snaps.rows[0].n > PACK_MAX_ENTRIES,
    `the real seed carries ${snaps.rows[0].n} members, which does not exceed the pack budget of `
    + `${PACK_MAX_ENTRIES}; this proof would pass without the budget ever binding`,
  );
  console.log(`[AC3] real seed members=${snaps.rows[0].n} vs pack budget entries=${PACK_MAX_ENTRIES}`);
});

test('AC3 — a bounded pack is DISTINGUISHABLE from a complete one, and says what it dropped', async () => {
  const stored = await readPack(pool, realPackId);
  assert.ok(stored, 'the AC1 pack is missing');

  assert.equal(stored.pack.bounded, true, 'a pack over budget did not record itself as bounded');
  assert.ok(stored.pack.entry_count <= PACK_MAX_ENTRIES, 'the pack exceeded its own entry budget');
  assert.ok(Number(stored.pack.entry_bytes) <= PACK_MAX_BYTES, 'the pack exceeded its own byte budget');

  const omitted = stored.pack.omitted;
  assert.ok(Array.isArray(omitted) && omitted.length > 0, 'a bounded pack disclosed nothing');
  const overBudget = omitted.filter((o) => o.reason === 'over-budget');
  assert.ok(overBudget.length > 0, 'nothing was recorded as over-budget on a bounded pack');
  for (const o of omitted) {
    assert.ok(o.source_ref, 'an omission does not say WHICH source was left out');
    assert.ok(o.reason, 'an omission does not say WHY');
    assert.ok(o.limit || o.duplicate_of, 'an omission does not say which limit or duplicate caused it');
  }

  // The budget in force is recorded ON the pack, so a reader does not have to know which
  // version of the code compiled it.
  assert.equal(stored.pack.budget.max_entries, PACK_MAX_ENTRIES);
  assert.equal(stored.pack.budget.max_bytes, PACK_MAX_BYTES);

  console.log(
    `[AC3] bounded=${stored.pack.bounded} entries=${stored.pack.entry_count} `
    + `bytes=${stored.pack.entry_bytes}/${PACK_MAX_BYTES} omitted=${omitted.length} `
    + `(over-budget=${overBudget.length}) first-omission=${JSON.stringify(overBudget[0])}`,
  );
});

test('AC3 — a SILENT truncation is unwritable: the database refuses a bounded flag with no disclosure', async () => {
  // Made to fail. The claim "a silent truncation cannot happen" is worth nothing unless the
  // control is shown refusing one, so this attempts the exact write the constraint exists to
  // stop — a pack claiming to be complete while having dropped things for budget.
  await assert.rejects(
    () => pool.query(
      `insert into vlogops.evidence_pack
         (pack_id, seed_id, compiler_version, selection_rule_version, ordering_rule_version,
          manifest, budget, omitted, entry_count, entry_bytes, bounded)
       values ($1, $2, 'x', 'y', 'z', '{}'::jsonb, '{}'::jsonb,
               '[{"source_ref":"a","reason":"over-budget","limit":"max_entries"}]'::jsonb,
               1, 1, false)`,
      ['f'.repeat(64), realSeedId],
    ),
    /evidence_pack_bounded_discloses/,
    'the database accepted a pack that dropped sources for budget while claiming not to be bounded',
  );

  // And the inverse: bounded with nothing over-budget to justify it.
  await assert.rejects(
    () => pool.query(
      `insert into vlogops.evidence_pack
         (pack_id, seed_id, compiler_version, selection_rule_version, ordering_rule_version,
          manifest, budget, omitted, entry_count, entry_bytes, bounded)
       values ($1, $2, 'x', 'y', 'z', '{}'::jsonb, '{}'::jsonb, '[]'::jsonb, 1, 1, true)`,
      ['e'.repeat(64), realSeedId],
    ),
    /evidence_pack_bounded_discloses/,
    'the database accepted a bounded claim with no evidence for it',
  );
});

// ─────────────────────────────────────────────────────────────────────────────────────────
// AC4 — deduplicated, and chronological with the rule explicit.
// ─────────────────────────────────────────────────────────────────────────────────────────

test('AC4 — the same source content twice in one seed produces ONE entry, and the collapse is recorded', async () => {
  // A real Phase 1 Route 1 intake, over a scratch tree holding two dated records with
  // BYTE-IDENTICAL content under different names. Phase 1 stores two snapshots (two refs,
  // two provenances — its primary key is (seed_id, source_ref), deliberately). The compiler
  // is what collapses them into one entry.
  const body = '# A day worth telling\n\nThe same bytes, filed twice under two names.\n';
  const tree = makeScratchTree({
    'Deliverables/2026-08-05-first-copy.md': body,
    'Deliverables/2026-08-05-second-copy.md': body,
    'Deliverables/2026-08-05-different.md': '# Something else entirely\n\nDifferent bytes.\n',
  });

  try {
    const intake = runCli(
      INTAKE_CLI,
      ['records', '--from', FIXTURE_FROM, '--to', FIXTURE_TO],
      { VLOGOPS_REPO_ROOT: tree.root },
    );
    assert.equal(intake.status, 0, `intake over the scratch tree failed: ${intake.stderr}`);
    const seed = lastJson(intake.stdout);
    assert.equal(seed.members, 3, 'Phase 1 did not snapshot all three scratch records');

    const compile = runCli(COMPILE_CLI, ['compile', '--seed', seed.seed_id]);
    assert.equal(compile.status, 0, `compile failed: ${compile.stderr}`);
    const pack = lastJson(compile.stdout);

    assert.equal(pack.entries, 2, 'the duplicate content was not collapsed into one entry');
    assert.equal(pack.bounded, false, 'collapsing a duplicate was misreported as a budget bound');

    const stored = await readPack(pool, pack.pack_id);
    const refs = stored.entries.map((e) => e.source_ref).sort();
    const hashes = new Set(stored.entries.map((e) => e.content_sha256));
    assert.equal(hashes.size, 2, 'two entries carry the same content hash');

    const dupes = stored.pack.omitted.filter((o) => o.reason === 'duplicate-content');
    assert.equal(dupes.length, 1, 'the collapsed duplicate was not disclosed');
    assert.ok(dupes[0].duplicate_of, 'the disclosure does not say which entry it duplicated');
    assert.ok(
      refs.includes(dupes[0].duplicate_of),
      'the omission points at a source that is not in the pack',
    );

    console.log(
      `[AC4] dedupe: 3 snapshots -> ${pack.entries} entries; `
      + `collapsed ${dupes[0].source_ref} into ${dupes[0].duplicate_of}`,
    );
  } finally {
    tree.cleanup();
  }
});

test('AC4 — the database itself refuses two entries with the same content in one pack', async () => {
  // The dedupe rule lives in the compiler AND in the schema, so a future caller that has
  // forgotten it cannot write a pack that contradicts it.
  const stored = await readPack(pool, realPackId);
  const first = stored.entries[0];
  await assert.rejects(
    () => pool.query(
      `insert into vlogops.evidence_pack_entry
         (pack_id, seed_id, ordinal, source_ref, content_sha256, byte_length, media_type,
          occurred_at, occurred_at_basis, provenance)
       values ($1, $2, 9999, $3, $4, $5, $6, null, 'unknown', '{}'::jsonb)`,
      [realPackId, first.seed_id, first.source_ref, first.content_sha256,
        first.byte_length, first.media_type],
    ),
    /evidence_pack_entry_unique/,
    'the database accepted a duplicate entry in a pack',
  );
});

test('AC4 — entries are in chronological order, with the basis for every placement recorded', async () => {
  const stored = await readPack(pool, realPackId);
  const entries = stored.entries;
  assert.ok(entries.length > 1, 'too few entries to demonstrate an ordering');

  // Ordinals are contiguous from zero — the presentation order is the stored order.
  entries.forEach((e, i) => assert.equal(e.ordinal, i, `ordinal ${e.ordinal} is out of sequence at index ${i}`));

  // Every entry says WHY it sits where it does, and the basis agrees with whether a time
  // was derivable at all.
  for (const e of entries) {
    assert.ok(
      ['git-commit-time', 'dated-filename', 'unknown'].includes(e.occurred_at_basis),
      `entry ${e.ordinal} carries an unknown ordering basis`,
    );
    assert.equal(
      e.occurred_at === null, e.occurred_at_basis === 'unknown',
      `entry ${e.ordinal} disagrees with itself about whether it has a time`,
    );
  }

  // Timed entries first, in non-decreasing time order; untimed entries bucketed last.
  const timed = entries.filter((e) => e.occurred_at !== null);
  const untimed = entries.filter((e) => e.occurred_at === null);
  assert.deepEqual(
    entries.map((e) => e.occurred_at !== null),
    [...timed.map(() => true), ...untimed.map(() => false)],
    'an entry with no defensible time was interleaved among entries that have one',
  );
  for (let i = 1; i < timed.length; i += 1) {
    assert.ok(
      new Date(timed[i - 1].occurred_at) <= new Date(timed[i].occurred_at),
      `entry ${timed[i].ordinal} is out of chronological order`,
    );
  }

  // The driver hands back timestamptz as a Date; print the ISO instant, because a local
  // rendering in the evidence would be a different string from the one identity was built on.
  const iso = (d) => (d === null ? 'null' : new Date(d).toISOString());
  console.log(
    `[AC4] chronology: ${timed.length} timed + ${untimed.length} untimed; bases = `
    + `${[...new Set(entries.map((e) => e.occurred_at_basis))].sort().join(', ')}`,
  );
  console.log(`[AC4] first=${iso(timed[0]?.occurred_at ?? null)} last=${iso(timed[timed.length - 1]?.occurred_at ?? null)}`);
  for (const e of entries) {
    console.log(`[AC4]   #${e.ordinal} ${iso(e.occurred_at)} (${e.occurred_at_basis}) ${e.source_ref}`);
  }
});

test('AC4 — NO CLASS IS SILENTLY STARVED: every stream in the seed reaches the pack', async () => {
  // The regression this exists for was real and was caught by running against the real
  // window, not by reasoning: the first version of the selection rule filled the pack with
  // the best-ranked class and dropped every git commit as over-budget. Phase 1 guarantees
  // breadth at intake; a compiler that discards that guarantee one stage later has starved
  // the stream just as effectively, and it takes the pack's only real timestamps with it.
  const stored = await readPack(pool, realPackId);

  const seedClasses = await pool.query(
    `select distinct provenance->>'source_class' as klass
       from vlogops.source_snapshot where seed_id = $1 and provenance->>'source_class' is not null`,
    [realSeedId],
  );
  const inSeed = seedClasses.rows.map((r) => r.klass).sort();
  const inPack = [...new Set(stored.entries.map((e) => e.provenance.source_class))].filter(Boolean).sort();

  assert.ok(inSeed.length > 1, 'the real seed carries only one class; this proof cannot demonstrate breadth');
  assert.deepEqual(
    inPack, inSeed,
    `the pack dropped an entire class of evidence: seed had [${inSeed}], pack has [${inPack}]`,
  );

  // And the consequence that matters: with commits present, the pack has a real chronology
  // rather than a column of identical midnight stamps.
  const timed = stored.entries.filter((e) => e.occurred_at_basis === 'git-commit-time');
  assert.ok(timed.length > 0, 'no entry carries a real commit timestamp, so the ordering is nominal');

  console.log(`[AC4] classes: seed=[${inSeed}] pack=[${inPack}] · commit-timed entries=${timed.length}`);
});

// ─────────────────────────────────────────────────────────────────────────────────────────
// AC5 — provenance-complete, and independently checkable.
// ─────────────────────────────────────────────────────────────────────────────────────────

test('AC5 — every entry traces to a frozen Phase 1 snapshot, and the pack verifies', async () => {
  const result = await verifyPack(pool, realPackId);
  assert.equal(result.ok, true, `verification failed: ${result.problems.join('; ')}`);
  assert.ok(result.entriesVerified > 0, 'nothing was actually verified');
  assert.equal(result.entriesVerified, result.entryCount, 'not every entry was verified');

  const stored = await readPack(pool, realPackId);
  for (const e of stored.entries) {
    assert.ok(e.provenance && Object.keys(e.provenance).length > 0, `entry ${e.ordinal} carries no provenance`);
    assert.ok(e.provenance.captured_by, `entry ${e.ordinal} does not say what captured it`);
  }

  console.log(`[AC5] verified ${result.entriesVerified}/${result.entryCount} entries by re-hashing stored bytes`);
});

test('AC5 — an entry pointing at no real snapshot is REFUSED by the database', async () => {
  // Made to fail: this is the structural claim, so the control is shown refusing the exact
  // write it exists to stop. Provenance-completeness that depended on the compiler behaving
  // would be a promise, not a property.
  await assert.rejects(
    () => pool.query(
      `insert into vlogops.evidence_pack_entry
         (pack_id, seed_id, ordinal, source_ref, content_sha256, byte_length, media_type,
          occurred_at, occurred_at_basis, provenance)
       values ($1, $2, 4242, 'file:does/not/exist.md', $3, 1, 'text/markdown',
               null, 'unknown', '{}'::jsonb)`,
      [realPackId, realSeedId, 'a'.repeat(64)],
    ),
    /evidence_pack_entry_snapshot_fk|foreign key/i,
    'the database accepted an entry that points at no frozen snapshot',
  );
});

test('AC5 — a compiled pack cannot be edited or deleted afterwards', async () => {
  await assert.rejects(
    () => pool.query('update vlogops.evidence_pack set entry_count = 1 where pack_id = $1', [realPackId]),
    /append-only|immutable/i,
    'a pack was editable after the fact',
  );
  await assert.rejects(
    () => pool.query('delete from vlogops.evidence_pack where pack_id = $1', [realPackId]),
    /append-only|immutable/i,
    'a pack was deletable',
  );
  await assert.rejects(
    () => pool.query('delete from vlogops.evidence_pack_entry where pack_id = $1', [realPackId]),
    /append-only|immutable/i,
    'pack entries were deletable',
  );
});
