import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, writeFileSync, readFileSync, mkdirSync, utimesSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { tmpdir } from 'node:os';
import { spawn } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';

import {
  projectKeyFor,
  healthStoreDir,
  healthFilePath,
  writeHealthSample,
  readHealthSample,
} from './health-store.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const MODULE_PATH = join(__dirname, 'health-store.mjs');

function freshDir() {
  return mkdtempSync(join(tmpdir(), 'governor-health-test-'));
}

test('projectKeyFor matches the observed Claude Code transcript-path convention', () => {
  assert.equal(projectKeyFor('C:\\Fusion247PKA'), 'C--Fusion247PKA');
});

test('projectKeyFor rejects a missing cwd', () => {
  assert.throws(() => projectKeyFor(''), TypeError);
});

test('healthStoreDir honours MYPKA_GOVERNOR_HEALTH_DIR override', () => {
  const dir = healthStoreDir({ cwd: 'C:\\Fusion247PKA', envOverride: 'D:\\custom\\root' });
  assert.equal(dir, 'D:\\custom\\root');
});

test('healthFilePath rejects a missing sessionId', () => {
  assert.throws(() => healthFilePath(''), TypeError);
});

test('write then read round-trips the sample exactly', () => {
  const dir = freshDir();
  try {
    const opts = { envOverride: dir };
    const sample = { used_percentage: 42, compactions: 0, ts: 'redacted-for-test' };
    writeHealthSample('sess-a', sample, opts);
    const result = readHealthSample('sess-a', opts);
    assert.equal(result.ok, true);
    assert.deepEqual(result.data, sample);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('reading a session that was never written reports missing, not a crash', () => {
  const dir = freshDir();
  try {
    const result = readHealthSample('never-written', { envOverride: dir });
    assert.equal(result.ok, false);
    assert.equal(result.reason, 'missing');
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

// Mutation test (per 02-MAP.md §9 T-02 row): kill mid-write → reader still gets last
// good state, never a partial parse. A real kill leaves only a stray, incomplete temp
// file behind and never reaches the rename — so we simulate exactly that: write one
// good sample, then drop a truncated temp file next to it (mimicking what a killed
// writer would have left) WITHOUT renaming it over the target, and prove the reader is
// unaffected.
test('mutation: a stray incomplete temp file from a killed write never corrupts a read', () => {
  const dir = freshDir();
  try {
    const opts = { envOverride: dir };
    const goodSample = { used_percentage: 10, compactions: 0 };
    writeHealthSample('sess-b', goodSample, opts);
    const filePath = healthFilePath('sess-b', opts);

    // Simulate a writer killed after opening its temp file but before rename.
    const strayTmp = `${filePath}.tmp-99999-deadbeef`;
    writeFileSync(strayTmp, '{"used_percentage": 9'); // truncated, invalid JSON, never renamed

    const result = readHealthSample('sess-b', opts);
    assert.equal(result.ok, true);
    assert.deepEqual(result.data, goodSample, 'reader must return the last good state, not the stray partial');

    // The stray temp file must still exist untouched — writeHealthSample never
    // reaches into or cleans up another writer's temp file; only the reader's
    // immunity to it is being asserted here.
    const strayContent = readFileSync(strayTmp, 'utf8');
    assert.equal(strayContent, '{"used_percentage": 9');
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

// Mutation test (per 02-MAP.md §9 T-02 row): concurrent writes never yield a torn file.
// Node's own process is single-threaded, so a genuine OS-level race requires separate
// processes. Spawns N real child processes that all call writeHealthSample against the
// SAME session id concurrently, then asserts the file on disk parses as complete valid
// JSON matching exactly one of the N payloads written — never a byte-interleaved mix.
test('mutation: N concurrent writer processes never produce a torn file', async () => {
  const dir = freshDir();
  const opts = { envOverride: dir };
  const N = 12;
  try {
    const children = [];
    for (let i = 0; i < N; i++) {
      const payload = JSON.stringify({ writer: i, marker: 'x'.repeat(200) });
      const script = `
        import { writeHealthSample } from ${JSON.stringify(pathToFileURL(MODULE_PATH).href)};
        writeHealthSample('sess-concurrent', ${payload}, { envOverride: ${JSON.stringify(dir)} });
      `;
      children.push(
        new Promise((resolve, reject) => {
          const child = spawn(process.execPath, ['--input-type=module', '-e', script], {
            stdio: 'pipe',
          });
          let stderr = '';
          child.stderr.on('data', (d) => { stderr += d; });
          child.on('exit', (code) => {
            if (code !== 0) reject(new Error(`writer ${i} exited ${code}: ${stderr}`));
            else resolve();
          });
        })
      );
    }
    await Promise.all(children);

    const result = readHealthSample('sess-concurrent', opts);
    assert.equal(result.ok, true, 'final file must parse as complete, valid JSON');
    assert.equal(typeof result.data.writer, 'number');
    assert.equal(result.data.marker, 'x'.repeat(200), 'payload must be one writer\'s complete output, never a mix');

    // No stray temp files should remain — every writer's rename must have succeeded.
    const { readdirSync } = await import('node:fs');
    const leftoverTmp = readdirSync(dirname(healthFilePath('sess-concurrent', opts)))
      .filter((f) => f.includes('.tmp-'));
    assert.deepEqual(leftoverTmp, [], 'no leftover temp files after N concurrent writers');
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

// ===========================================================================
// WO-OR-18 — the SPLIT-STORE hazard (Codex TQA-002)
// ===========================================================================
// One session's statusLine and its own Stop hook can run from different checkouts of this
// same repository, landing their records under different `cwd`-derived project keys. The
// reader then found nothing and the footer went BLIND while a valid observation for that
// exact session sat one directory away.
//
// Every test below passes `envOverride: ''` — an EXPLICIT "no override" rather than
// letting the parameter default to `process.env.MYPKA_GOVERNOR_HEALTH_DIR`. Otherwise an
// ambient variable on whatever machine runs this suite would silently redirect these
// tests and they would pass without exercising the project-key layout at all.

const CWD_A = 'C:\\Fusion247PKA';
const CWD_B = 'C:\\Fusion247PKA-governor';
const CWD_C = 'C:\\Fusion247PKA-wt-wo-or-99';

function fakeHome() {
  const home = mkdtempSync(join(tmpdir(), 'governor-health-home-'));
  return {
    home,
    optsFor: (cwd) => ({ cwd, homeDir: home, envOverride: '' }),
    cleanup: () => rmSync(home, { recursive: true, force: true }),
  };
}

test('WO-OR-18: a KNOWN session id resolves across project keys — the split store no longer blinds it', () => {
  const h = fakeHome();
  try {
    const sample = { session_id: 'split-1', context_window: { context_window_size: 1000000 } };
    // Written from checkout A, as that checkout's statusLine would.
    writeHealthSample('split-1', sample, h.optsFor(CWD_A));

    // CONTROL: the two checkouts genuinely resolve to different directories. Without this
    // the test could pass because nothing was ever split.
    assert.notEqual(
      healthStoreDir(h.optsFor(CWD_A)),
      healthStoreDir(h.optsFor(CWD_B)),
      'CONTROL: the hazard requires two distinct project keys'
    );

    // Read from checkout B, as the Stop hook or footer in another worktree would.
    const read = readHealthSample('split-1', h.optsFor(CWD_B));
    assert.equal(read.ok, true, 'THE DEFECT: this returned {ok:false, missing} and the footer went BLIND');
    assert.equal(read.data.context_window.context_window_size, 1000000);
    assert.equal(read.resolvedAcrossProjectKey, true, 'and it reports that it had to look elsewhere');
  } finally {
    h.cleanup();
  }
});

test('WO-OR-18 MUTATION: the cross-key sweep is IDENTITY, not filename — a mismatched record is refused', () => {
  // Makes the test above fail-able, and pins the one invariant the sweep rests on. A
  // sweep that trusted the filename would hand back another session's telemetry, which is
  // strictly worse than the BLIND it replaced.
  const h = fakeHome();
  try {
    const dirA = healthStoreDir(h.optsFor(CWD_A));
    mkdirSync(dirA, { recursive: true });
    // A file NAMED for our session, whose contents belong to someone else.
    writeFileSync(
      join(dirA, 'split-2.json'),
      JSON.stringify({ session_id: 'somebody-elses-session', context_window: { context_window_size: 200000 } })
    );

    const read = readHealthSample('split-2', h.optsFor(CWD_B));
    assert.equal(read.ok, false, 'a record that does not claim this session id must NOT be adopted');
    assert.equal(read.reason, 'missing');

    // CONTROL: the sweep really did run and really did examine that directory — otherwise
    // the refusal above would prove nothing at all. Correct the id and it is found.
    writeHealthSample('split-2', { session_id: 'split-2', ok: true }, h.optsFor(CWD_A));
    assert.equal(readHealthSample('split-2', h.optsFor(CWD_B)).ok, true, 'CONTROL: the sweep reaches this directory');
  } finally {
    h.cleanup();
  }
});

test('WO-OR-18: the CURRENT checkout wins when it has its own record', () => {
  // The sweep is a fallback on a MISS, never a preference. A co-located record is this
  // session's own most recent write and must not be displaced by a foreign key's copy.
  const h = fakeHome();
  try {
    writeHealthSample('split-3', { session_id: 'split-3', where: 'A' }, h.optsFor(CWD_A));
    writeHealthSample('split-3', { session_id: 'split-3', where: 'B' }, h.optsFor(CWD_B));
    assert.equal(readHealthSample('split-3', h.optsFor(CWD_B)).data.where, 'B');
    assert.equal(readHealthSample('split-3', h.optsFor(CWD_A)).data.where, 'A');
  } finally {
    h.cleanup();
  }
});

test('WO-OR-18: with several foreign records for one session id, the NEWEST is taken', () => {
  const h = fakeHome();
  try {
    writeHealthSample('split-4', { session_id: 'split-4', where: 'A' }, h.optsFor(CWD_A));
    writeHealthSample('split-4', { session_id: 'split-4', where: 'C' }, h.optsFor(CWD_C));
    // Pin the mtimes rather than relying on write order and filesystem timestamp
    // granularity — a race here would make this test flaky and its verdict meaningless.
    const older = new Date(Date.now() - 60_000);
    const newer = new Date();
    utimesSync(healthFilePath('split-4', h.optsFor(CWD_A)), older, older);
    utimesSync(healthFilePath('split-4', h.optsFor(CWD_C)), newer, newer);
    assert.equal(readHealthSample('split-4', h.optsFor(CWD_B)).data.where, 'C');

    // MUTATION: flip which one is newer. The answer must follow the mtime, not whatever
    // order the filesystem happens to list the directories in.
    utimesSync(healthFilePath('split-4', h.optsFor(CWD_A)), newer, newer);
    utimesSync(healthFilePath('split-4', h.optsFor(CWD_C)), older, older);
    assert.equal(readHealthSample('split-4', h.optsFor(CWD_B)).data.where, 'A');
  } finally {
    h.cleanup();
  }
});

test('WO-OR-18: MYPKA_GOVERNOR_HEALTH_DIR still pins ONE directory and is never swept past', () => {
  // The portability seam (Q-3/T-12) and outcome 3's test containment both rest on this:
  // an explicitly pinned root IS the whole store, so it has no siblings by construction.
  // If the sweep ignored the override, a redirected test store would start resolving
  // records out of the real one — the pollution problem running backwards.
  const h = fakeHome();
  const pinned = freshDir();
  try {
    writeHealthSample('split-5', { session_id: 'split-5', where: 'home-rooted-store' }, h.optsFor(CWD_A));
    const read = readHealthSample('split-5', { envOverride: pinned, homeDir: h.home, cwd: CWD_B });
    assert.equal(read.ok, false, 'a pinned store must not reach into the home-rooted store');
    assert.equal(read.reason, 'missing');
  } finally {
    rmSync(pinned, { recursive: true, force: true });
    h.cleanup();
  }
});

test('WO-OR-18: the store is STILL project-keyed — the unknown-session fallback stays scoped', () => {
  // The invariant that stopped this repair from becoming a regression. `footer.mjs`'s
  // `resolveHealthSample` rule 2 enumerates this directory to pick the newest sample when
  // the session id is UNKNOWN, returning `approximate: true`. That path has only
  // SIMILARITY to go on, so its blast radius must stay one project. Flattening the store
  // would have let it reach into an unrelated repository's sessions — this machine's
  // store carries a `C--ClaudeJobs` key. Identity may cross that boundary; similarity may
  // not. Pinned to the literal layout so a future flattening cannot pass silently.
  assert.equal(
    healthStoreDir({ cwd: CWD_A, homeDir: 'H', envOverride: '' }),
    join('H', '.mypka', 'governor', 'health', 'C--Fusion247PKA')
  );
  assert.notEqual(
    healthStoreDir({ cwd: CWD_A, homeDir: 'H', envOverride: '' }),
    healthStoreDir({ cwd: CWD_B, homeDir: 'H', envOverride: '' })
  );
});
