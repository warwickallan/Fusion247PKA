import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, writeFileSync, readFileSync, mkdirSync } from 'node:fs';
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
