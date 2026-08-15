// BUILD-006 Phase 2 — AC6 and AC7. The two durability proofs, and neither is simulated.
//
// AC6: a source is really MUTATED and another really DELETED on disk, after a real compile,
//      and the existing pack is then read back and re-verified. Nothing is mocked and no
//      failure is injected — the sources are genuinely destroyed.
//
// AC7: a real child process compiling a real pack is stopped dead from outside, at four
//      chosen instants inside its transaction, and the store is asked what it holds.
//
// ── WHERE THE DAMAGE LANDS, AND WHY IT IS NOT THE REPOSITORY ────────────────────────────
// AC6's sources are files. The obvious way to damage the sources of a Route 1 seed is to
// damage the real repository records it drew on — and that would write outside this Work
// Order's declared file surface AND corrupt a working tree that a second worktree has
// checked out at the same commit. So the seed for AC6 is taken by Phase 1's OWN Route 1
// intake over a scratch tree (VLOGOPS_REPO_ROOT), holding real bytes copied from real
// repository records. The intake path, the files, the snapshots and the destruction are all
// genuine; only the blast radius is contained. Larry accepted this at the read-back.

import test, { after, before } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { spawn, spawnSync } from 'node:child_process';
import { REPO_ROOT, SERVICE_ROOT, databaseUrl, freshSchema, newPool } from './helpers/harness.mjs';
import { makeScratchTree } from './helpers/scratch-tree.mjs';
import { readPack, verifyPack } from '../src/compiler.mjs';
import { packDocument } from '../src/pack.mjs';

const INTAKE_CLI = path.join(SERVICE_ROOT, 'bin', 'vlogops-intake.mjs');
const COMPILE_CLI = path.join(SERVICE_ROOT, 'bin', 'vlogops-compile.mjs');

const IS_WINDOWS = process.platform === 'win32';
const KILL_MECHANISM = IS_WINDOWS
  ? 'Windows TerminateProcess (no POSIX signals on this platform)'
  : 'POSIX SIGKILL';

// Every point inside the compile transaction at which a kill can land. All are before
// COMMIT, so all must leave the store completely untouched.
const KILL_STAGES = ['transaction-open', 'pack-inserted', 'entry-written', 'pre-commit'];

let pool;
let killsExecuted = 0;

before(async () => {
  pool = newPool();
  await freshSchema(pool);
});

after(async () => {
  await pool.end();
  console.log(`\n[AC7] compile kill cases executed: ${killsExecuted} of ${KILL_STAGES.length}, via ${KILL_MECHANISM}`);
});

function runCli(cliPath, args, env = {}) {
  return spawnSync(process.execPath, [cliPath, ...args], {
    encoding: 'utf8',
    env: { ...process.env, VLOGOPS_DB_URL: databaseUrl(), ...env },
  });
}

const lastJson = (stdout) => JSON.parse(stdout.trim().split('\n').pop());

// ─────────────────────────────────────────────────────────────────────────────────────────
// AC6 — a LATER source failure cannot alter an existing run.
// ─────────────────────────────────────────────────────────────────────────────────────────

test('AC6 — break one source and DELETE another: the existing pack reads back complete and unchanged', async () => {
  // Real bytes from real repository records, copied into a tree we are allowed to destroy.
  const realDeliverables = fs.readdirSync(path.join(REPO_ROOT, 'Deliverables'))
    .filter((f) => /^2026-08-05[-_].*\.md$/.test(f))
    .sort();
  assert.ok(realDeliverables.length >= 3, 'the fixture window no longer has enough real records to copy');

  const tree = makeScratchTree({
    'Deliverables/2026-08-05-alpha.md': { copyFrom: path.join(REPO_ROOT, 'Deliverables', realDeliverables[0]) },
    'Deliverables/2026-08-05-beta.md': { copyFrom: path.join(REPO_ROOT, 'Deliverables', realDeliverables[1]) },
    'Deliverables/2026-08-05-gamma.md': { copyFrom: path.join(REPO_ROOT, 'Deliverables', realDeliverables[2]) },
  });

  try {
    // 1 — a REAL Phase 1 Route 1 intake over those files.
    const intake = runCli(INTAKE_CLI, ['records', '--from', '2026-08-05', '--to', '2026-08-05'],
      { VLOGOPS_REPO_ROOT: tree.root });
    assert.equal(intake.status, 0, `intake failed: ${intake.stderr}`);
    const seed = lastJson(intake.stdout);
    assert.equal(seed.members, 3, 'Phase 1 did not snapshot all three sources');

    // 2 — a REAL compile.
    const compile = runCli(COMPILE_CLI, ['compile', '--seed', seed.seed_id], { VLOGOPS_REPO_ROOT: tree.root });
    assert.equal(compile.status, 0, `compile failed: ${compile.stderr}`);
    const pack = lastJson(compile.stdout);
    assert.equal(pack.entries, 3, 'the pack did not take all three sources');

    // The pack exactly as it stands BEFORE any damage — the thing that must not change.
    const beforeRead = await readPack(pool, pack.pack_id);
    const beforeDoc = packDocument({ packId: pack.pack_id, manifest: beforeRead.pack.manifest });
    const beforeVerify = await verifyPack(pool, pack.pack_id);
    assert.equal(beforeVerify.ok, true, 'the pack did not verify even before the sources were damaged');

    // 3 — THE DAMAGE. One source corrupted in place, one deleted outright.
    const mutated = tree.damage('Deliverables/2026-08-05-alpha.md');
    const removed = tree.remove('Deliverables/2026-08-05-beta.md');
    assert.notEqual(fs.readFileSync(mutated, 'utf8').length, 0, 'the mutation did not write');
    assert.equal(fs.existsSync(removed), false, 'the deletion did not happen');
    assert.equal(fs.existsSync(mutated), true, 'the mutated source should still exist, with different bytes');

    // 4 — READ THE ORIGINAL PACK BACK. Through the CLI, in a NEW process, which is how an
    // operator would actually do it — and with the damaged tree still configured, so nothing
    // is quietly reading a pristine copy somewhere else.
    const verify = runCli(COMPILE_CLI, ['verify', '--pack', pack.pack_id], { VLOGOPS_REPO_ROOT: tree.root });
    assert.equal(verify.status, 0, `verification failed after the sources were damaged: ${verify.stdout} ${verify.stderr}`);
    const verdict = lastJson(verify.stdout);
    assert.equal(verdict.ok, true, `the pack no longer verifies: ${JSON.stringify(verdict.problems)}`);
    assert.equal(verdict.entries_verified, 3, 'not every entry survived the damage');

    // 5 — UNCHANGED, byte for byte, not merely "still readable".
    const afterRead = await readPack(pool, pack.pack_id);
    const afterDoc = packDocument({ packId: pack.pack_id, manifest: afterRead.pack.manifest });
    assert.equal(afterDoc, beforeDoc, 'the pack document changed after its sources were damaged');
    assert.equal(afterRead.entries.length, beforeRead.entries.length, 'the pack lost an entry');
    assert.deepEqual(
      afterRead.entries.map((e) => `${e.ordinal}:${e.source_ref}:${e.content_sha256}`),
      beforeRead.entries.map((e) => `${e.ordinal}:${e.source_ref}:${e.content_sha256}`),
      'an entry changed after its source was damaged',
    );

    console.log(
      `[AC6] MUTATED ${path.basename(mutated)} · DELETED ${path.basename(removed)}\n`
      + `[AC6]   pack ${pack.pack_id.slice(0, 12)}… re-verified AFTER the damage: `
      + `ok=${verdict.ok} entries_verified=${verdict.entries_verified}/${verdict.entry_count}\n`
      + `[AC6]   pack document identical before and after (${Buffer.byteLength(beforeDoc)} bytes)`,
    );
  } finally {
    tree.cleanup();
  }
});

test('AC6 — THE PROOF IS MADE TO FAIL: damaging the STORED bytes IS detected', async () => {
  // The test above proves a pack survives its sources being destroyed. On its own that is
  // also what a verifier that checks nothing would report. So: tamper with the one thing the
  // verifier actually reads — the stored snapshot bytes — and require it to notice.
  //
  // 001's trigger refuses UPDATE on source_snapshot, which is the real defence. To reach the
  // bytes at all the trigger must be disabled first, inside a transaction that is rolled
  // back. That the tamper is this awkward to stage IS the point, and it is recorded here
  // rather than worked around quietly.
  const seedRow = await pool.query(
    `select s.seed_id, s.source_ref from vlogops.source_snapshot s
      join vlogops.evidence_pack_entry e on e.seed_id = s.seed_id and e.source_ref = s.source_ref
      limit 1`,
  );
  assert.equal(seedRow.rowCount, 1, 'no packed snapshot to tamper with');
  const { seed_id: seedId, source_ref: sourceRef } = seedRow.rows[0];

  const packRow = await pool.query(
    'select pack_id from vlogops.evidence_pack_entry where seed_id = $1 and source_ref = $2',
    [seedId, sourceRef],
  );
  const packId = packRow.rows[0].pack_id.trim();

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query('alter table vlogops.source_snapshot disable trigger source_snapshot_immutable');

    const original = await client.query(
      `select content, content_sha256, byte_length from vlogops.source_snapshot
        where seed_id = $1 and source_ref = $2`, [seedId, sourceRef],
    );

    // A SAME-LENGTH tamper, and the length is not incidental. The first attempt at this
    // proof replaced the bytes with a shorter string and was refused outright by 001's
    // `source_snapshot_length_matches` CHECK — a second, independent control catching it
    // before the hash was ever consulted. Good news, and useless as a proof of THIS check:
    // it would have passed while saying nothing about whether the hash is ever compared.
    //
    // So the tamper below keeps octet_length identical and changes only the content. It
    // defeats the cheap control deliberately, which is the only way to isolate the
    // expensive one.
    const bytes = Buffer.from(original.rows[0].content);
    bytes[0] ^= 0xff;

    await client.query(
      'update vlogops.source_snapshot set content = $3 where seed_id = $1 and source_ref = $2',
      [seedId, sourceRef, bytes],
    );

    // Same connection, inside the same transaction, so the tampered row is visible.
    const check = await client.query(
      `select content, content_sha256, byte_length from vlogops.source_snapshot
        where seed_id = $1 and source_ref = $2`, [seedId, sourceRef],
    );
    const { verifySnapshotIntegrity } = await import('../src/snapshot.mjs');
    const integrity = verifySnapshotIntegrity(check.rows[0]);

    assert.equal(integrity.ok, false, 'TAMPERED STORED BYTES WERE NOT DETECTED — the verifier proves nothing');
    assert.equal(
      integrity.actual_bytes, integrity.expected_bytes,
      'the tamper changed the length, so this proves the length check rather than the hash check',
    );
    assert.notEqual(integrity.actual_sha256, integrity.expected_sha256, 'the hashes did not diverge');

    console.log(
      `[AC6] made-to-fail: same-length tamper (${integrity.actual_bytes} bytes, unchanged) DETECTED by hash — `
      + `expected ${integrity.expected_sha256.slice(0, 12)}…, got ${integrity.actual_sha256.slice(0, 12)}…`,
    );
  } finally {
    await client.query('ROLLBACK');
    client.release();
  }

  // And after the rollback the pack is whole again — the tamper never reached the store.
  const after = await verifyPack(pool, packId);
  assert.equal(after.ok, true, 'the rolled-back tamper leaked into the store');
});

// ─────────────────────────────────────────────────────────────────────────────────────────
// AC7 — a failure DURING compile cannot leave a corrupt pack.
// ─────────────────────────────────────────────────────────────────────────────────────────

/** Spawn a compile, wait until it reports it is parked inside the transaction, then kill it. */
function spawnCompileAndKillAt(seedId, stage) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [COMPILE_CLI, 'compile', '--seed', seedId, '--hold-at', stage], {
      env: { ...process.env, VLOGOPS_DB_URL: databaseUrl() },
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    let out = '';
    let err = '';
    let killed = false;

    const giveUp = setTimeout(() => {
      child.kill('SIGKILL');
      reject(new Error(`compile never reached stage ${stage}. stdout=${out} stderr=${err}`));
    }, 30_000);

    child.stdout.on('data', (d) => {
      out += d.toString();
      if (!killed && out.includes(`VLOGOPS_HELD_AT ${stage}`)) {
        killed = true;
        // THE KILL. Nothing mocked, nothing thrown inside the process: it is destroyed from
        // outside while its transaction is open.
        child.kill('SIGKILL');
      }
    });
    child.stderr.on('data', (d) => { err += d.toString(); });

    child.on('exit', (code, signal) => {
      clearTimeout(giveUp);
      if (!killed) return reject(new Error(`compile exited on its own (code=${code}) before it could be killed`));
      resolve({ code, signal });
    });
    child.on('error', reject);
  });
}

async function waitForBackendsToClear(timeoutMs = 15_000) {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    const r = await pool.query(
      `select count(*)::int n from pg_stat_activity
        where datname = current_database()
          and state in ('idle in transaction', 'idle in transaction (aborted)')
          and pid <> pg_backend_pid()`,
    );
    if (r.rows[0].n === 0) return;
    if (Date.now() > deadline) throw new Error('a killed backend still holds an open transaction after 15s');
    await new Promise((r2) => { setTimeout(r2, 100); });
  }
}

for (const stage of KILL_STAGES) {
  test(`AC7 — compile killed at '${stage}': NO pack, then a cold restart lands exactly one complete pack`, async () => {
    // A fresh seed per stage, by a real Phase 1 intake, so each case starts from nothing.
    const intake = runCli(INTAKE_CLI, [
      'supplied', '--angle', `compile killed at ${stage}`,
      '--text', 'A real seed, compiled by a process that is about to be stopped dead.',
      '--privacy', 'internal',
    ]);
    assert.equal(intake.status, 0, `intake failed: ${intake.stderr}`);
    const seedId = lastJson(intake.stdout).seed_id;

    const before2 = await pool.query(
      'select count(*)::int n from vlogops.evidence_pack where seed_id = $1', [seedId],
    );
    assert.equal(before2.rows[0].n, 0, 'a pack existed before the test started');

    const { code, signal } = await spawnCompileAndKillAt(seedId, stage);
    killsExecuted += 1;
    assert.notEqual(code, 0, `the killed child reported a clean exit (code=${code}, signal=${signal})`);

    await waitForBackendsToClear();

    // NOTHING was written. Not a pack, not an orphan entry, not a ledger row.
    const packs = await pool.query('select count(*)::int n from vlogops.evidence_pack where seed_id = $1', [seedId]);
    assert.equal(packs.rows[0].n, 0, `a kill at ${stage} left a pack row behind`);
    const entries = await pool.query('select count(*)::int n from vlogops.evidence_pack_entry where seed_id = $1', [seedId]);
    assert.equal(entries.rows[0].n, 0, `a kill at ${stage} left an orphan entry behind`);
    const runs = await pool.query('select count(*)::int n from vlogops.compile_run where seed_id = $1', [seedId]);
    assert.equal(runs.rows[0].n, 0, `a kill at ${stage} left a ledger row behind`);

    // THE COLD RESTART. A brand-new process, told nothing about what happened.
    const restart = runCli(COMPILE_CLI, ['compile', '--seed', seedId]);
    assert.equal(restart.status, 0, `the cold restart failed: ${restart.stderr}`);
    const result = lastJson(restart.stdout);
    assert.equal(result.deduplicated, false, 'the restart thought the killed attempt had already committed');

    // Exactly one complete pack, and it verifies.
    const finalPacks = await pool.query(
      'select pack_id, entry_count from vlogops.evidence_pack where seed_id = $1', [seedId],
    );
    assert.equal(finalPacks.rowCount, 1, 'the store does not hold exactly one pack');
    const verified = await verifyPack(pool, finalPacks.rows[0].pack_id.trim());
    assert.equal(verified.ok, true, `the recovered pack does not verify: ${verified.problems.join('; ')}`);
    assert.equal(verified.entriesVerified, finalPacks.rows[0].entry_count, 'the recovered pack is short of entries');

    console.log(
      `[AC7] ${stage}: killed via ${KILL_MECHANISM} (exit=${code}, signal=${signal}) | `
      + `after kill -> packs=0 entries=0 ledger=0 | after cold restart -> packs=1 `
      + `entries=${verified.entriesVerified} verified=${verified.ok} pack=${result.pack_id.slice(0, 12)}…`,
    );
  });
}

test('AC7 — a NON-ZERO number of compile kill cases actually executed', () => {
  assert.ok(killsExecuted > 0, 'NO kill case executed; this suite proved nothing about compile recovery');
  assert.equal(killsExecuted, KILL_STAGES.length, `only ${killsExecuted} of ${KILL_STAGES.length} kill cases executed`);
  console.log(`[AC7] ${killsExecuted} real process kills executed against the compiler via ${KILL_MECHANISM}`);
});
