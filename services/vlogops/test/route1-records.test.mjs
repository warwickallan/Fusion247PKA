// AC4 — Route 1, existing records: the smallest sufficient bundle.
// AC2 — and the half of it that can only be proven with two separate processes.

import test, { after, before } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { REPO_ROOT, SERVICE_ROOT, databaseUrl, freshSchema, newPool, testConfig } from './helpers/harness.mjs';
import { compileRecordsBundle, gatherCandidates, selectSmallestSufficient } from '../src/routes/records.mjs';

// ── THE FIXTURE WINDOW, AND WHY IT IS THIS ONE ──────────────────────────────────────────
// 2026-08-05 is a real, ordinary, busy day in this estate that produced ZERO session logs,
// 164 commits and 6 deliverables. It is the condition that breaks a session-log-first
// compiler: not a dry stream, but an INTERMITTENT one, which on any single window is
// indistinguishable from absence. If Route 1 returns a bundle here, `Deliverables/` and git
// history are genuinely first-class rather than a fallback nobody exercised.
const FIXTURE_FROM = '2026-08-05';
const FIXTURE_TO = '2026-08-05';

const CLI = path.join(SERVICE_ROOT, 'bin', 'vlogops-intake.mjs');

let pool;

before(async () => {
  pool = newPool();
  await freshSchema(pool);
});
after(async () => { await pool.end(); });

test('AC4 — the fixture window really does contain ZERO session logs', () => {
  const candidates = gatherCandidates({ repoRoot: REPO_ROOT, from: FIXTURE_FROM, to: FIXTURE_TO });
  const sessionLogs = candidates.filter((c) => c.klass === 'session-log');
  assert.equal(
    sessionLogs.length, 0,
    'the fixture window has acquired session logs; it no longer tests what it was chosen to test',
  );
  assert.ok(candidates.length > 0, 'the fixture window produced no candidates at all');
});

test('AC4 — a window with no session logs still produces a NON-EMPTY bundle', () => {
  const { members, selection } = compileRecordsBundle({
    config: testConfig(), from: FIXTURE_FROM, to: FIXTURE_TO,
  });

  assert.ok(members.length > 0, 'a zero-session-log window produced an empty bundle');
  assert.ok(
    selection.classes_selected.includes('deliverable') || selection.classes_selected.includes('git-commit'),
    `the bundle drew on neither Deliverables nor git history: ${selection.classes_selected.join(', ')}`,
  );
  assert.ok(!selection.classes_selected.includes('session-log'), 'a session log appeared in a window that has none');

  for (const m of members) {
    assert.match(m.content_sha256, /^[0-9a-f]{64}$/);
    assert.ok(m.byte_length > 0);
    assert.ok(m.provenance && typeof m.provenance === 'object', 'a member carries no provenance');
    assert.ok(m.privacy_state, 'a member carries no privacy state');
  }
});

test('AC4 — the range demonstrably contains MORE than the bundle, and the rejection is recorded', () => {
  const candidates = gatherCandidates({ repoRoot: REPO_ROOT, from: FIXTURE_FROM, to: FIXTURE_TO });
  const { chosen, stats } = selectSmallestSufficient({
    candidates, maxArtefacts: 12, maxBytes: 2 * 1024 * 1024,
  });

  assert.ok(
    candidates.length > chosen.length,
    `the rule selected everything in range (${chosen.length} of ${candidates.length}) — "smallest sufficient" proves nothing here`,
  );
  assert.equal(stats.candidates_considered, candidates.length);
  assert.equal(stats.selected, chosen.length);
  assert.equal(stats.rejected, candidates.length - chosen.length);
  assert.ok(stats.rejected > 0);
  assert.ok(chosen.length <= 12, 'the artefact budget was exceeded');
  assert.ok(stats.selected_bytes <= 2 * 1024 * 1024, 'the byte budget was exceeded');
});

test('AC4 — every non-empty class is represented, so no stream can be silently starved', () => {
  const candidates = gatherCandidates({ repoRoot: REPO_ROOT, from: FIXTURE_FROM, to: FIXTURE_TO });
  const { stats } = selectSmallestSufficient({ candidates, maxArtefacts: 12, maxBytes: 2 * 1024 * 1024 });

  for (const klass of stats.classes_present) {
    assert.ok(
      stats.classes_selected.includes(klass),
      `class ${klass} was present in range but absent from the bundle`,
    );
  }
});

test('AC4 — selection is DETERMINISTIC: the same window compiles to the same bundle', () => {
  const a = compileRecordsBundle({ config: testConfig(), from: FIXTURE_FROM, to: FIXTURE_TO });
  const b = compileRecordsBundle({ config: testConfig(), from: FIXTURE_FROM, to: FIXTURE_TO });
  assert.deepEqual(
    a.members.map((m) => [m.source_ref, m.content_sha256]),
    b.members.map((m) => [m.source_ref, m.content_sha256]),
  );
});

test('AC4 — a genuinely empty window is refused rather than sealed as an empty seed', () => {
  assert.throws(
    () => compileRecordsBundle({ config: testConfig(), from: '1999-01-01', to: '1999-01-02' }),
    /no source records found/,
  );
  assert.throws(
    () => compileRecordsBundle({ config: testConfig(), from: '2026-08-05', to: '2026-08-01' }),
    /precedes its start/,
  );
});

test('AC2 — TWO SEPARATE PROCESSES, same window: one seed, one identity, one set of snapshots', async () => {
  const env = { ...process.env, VLOGOPS_DB_URL: databaseUrl() };
  const args = [CLI, 'records', '--from', FIXTURE_FROM, '--to', FIXTURE_TO];

  const first = spawnSync(process.execPath, args, { encoding: 'utf8', env });
  assert.equal(first.status, 0, `first intake failed: ${first.stderr}`);
  const one = JSON.parse(first.stdout.trim().split('\n').pop());

  // A genuinely separate process: its own module registry, its own pool, its own memory.
  // Nothing survives between the two except what is in the database.
  const second = spawnSync(process.execPath, args, { encoding: 'utf8', env });
  assert.equal(second.status, 0, `second intake failed: ${second.stderr}`);
  const two = JSON.parse(second.stdout.trim().split('\n').pop());

  assert.equal(two.seed_id, one.seed_id, 'the same source taken in twice produced two different identities');
  assert.equal(one.deduplicated, false, 'the first intake reported itself as a duplicate');
  assert.equal(two.deduplicated, true, 'the second intake was not recognised as a duplicate');

  const seeds = await pool.query('select count(*)::int n from vlogops.content_seed where seed_id = $1', [one.seed_id]);
  assert.equal(seeds.rows[0].n, 1, 'the store holds more than one row for one identity');

  const snaps = await pool.query('select count(*)::int n from vlogops.source_snapshot where seed_id = $1', [one.seed_id]);
  assert.equal(snaps.rows[0].n, one.members, 'the snapshot count does not match the bundle');

  // Both attempts are recorded; only one of them sealed anything.
  const runs = await pool.query(
    'select outcome from vlogops.intake_run where seed_id = $1 order by recorded_at', [one.seed_id],
  );
  assert.equal(runs.rowCount, 2, 'the ledger did not record both attempts');
  assert.deepEqual(runs.rows.map((r) => r.outcome).sort(), ['deduplicated', 'sealed']);
});

test('AC2/AC4 — the stored manifest independently recomputes to the stored identity', async () => {
  const { seedIdentity } = await import('../src/identity.mjs');
  const rows = await pool.query('select seed_id, manifest from vlogops.content_seed');
  assert.ok(rows.rowCount > 0, 'no seeds to check');
  for (const row of rows.rows) {
    assert.equal(
      seedIdentity(row.manifest), row.seed_id.trim(),
      'a stored manifest does not hash to the identity stored beside it',
    );
  }
});
