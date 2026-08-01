import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync, existsSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  parseStdinPayload,
  extractHealthSample,
  sampleFromStdin,
  SAMPLE_SCHEMA_VERSION,
} from './sampler.mjs';
import { readHealthSample, healthFilePath } from './health-store.mjs';

const SAMPLER_PATH = fileURLToPath(new URL('./sampler.mjs', import.meta.url));

function tempHealthDir() {
  return mkdtempSync(join(tmpdir(), 'governor-sampler-test-'));
}

const REAL_PAYLOAD = {
  session_id: 'sess-abc123',
  transcript_path: '/redacted/path.jsonl',
  version: '2.1.220',
  model: { id: 'claude-opus-5', display_name: 'Opus 5' },
  effort: { level: 'high' },
  exceeds_200k_tokens: false,
  context_window: {
    used_percentage: 42.5,
    remaining_percentage: 57.5,
    context_window_size: 1000000,
    total_input_tokens: 120000,
    total_output_tokens: 8000,
    current_usage: {
      input_tokens: 100,
      output_tokens: 50,
      cache_creation_input_tokens: 10,
      cache_read_input_tokens: 5,
    },
  },
  rate_limits: {
    five_hour: { used_percentage: 12, resets_at: 1780000000 },
    seven_day: { used_percentage: 30, resets_at: 1780500000 },
  },
  workspace: { current_dir: '/redacted', repo: { host: 'github.com', owner: 'x', name: 'y' } },
};

// ---------------------------------------------------------------------------
// parseStdinPayload
// ---------------------------------------------------------------------------

test('parseStdinPayload: valid JSON object parses', () => {
  const parsed = parseStdinPayload(JSON.stringify(REAL_PAYLOAD));
  assert.equal(parsed.session_id, 'sess-abc123');
});

test('parseStdinPayload: empty string -> null', () => {
  assert.equal(parseStdinPayload(''), null);
});

test('parseStdinPayload: whitespace-only string -> null', () => {
  assert.equal(parseStdinPayload('   \n\t  '), null);
});

test('parseStdinPayload: malformed JSON -> null', () => {
  assert.equal(parseStdinPayload('{not: valid json'), null);
});

test('parseStdinPayload: non-object JSON (array) -> null', () => {
  assert.equal(parseStdinPayload('[1,2,3]'), null);
});

test('parseStdinPayload: non-object JSON (primitive) -> null', () => {
  assert.equal(parseStdinPayload('"just a string"'), null);
  assert.equal(parseStdinPayload('42'), null);
  assert.equal(parseStdinPayload('null'), null);
});

test('parseStdinPayload: not a string input -> null', () => {
  assert.equal(parseStdinPayload(undefined), null);
  assert.equal(parseStdinPayload(null), null);
});

// ---------------------------------------------------------------------------
// extractHealthSample
// ---------------------------------------------------------------------------

test('extractHealthSample: full payload extracts every known field', () => {
  const sample = extractHealthSample(REAL_PAYLOAD, { sampledAt: '2026-07-31T00:00:00.000Z' });
  assert.equal(sample.schema_version, SAMPLE_SCHEMA_VERSION);
  assert.equal(sample.sampled_at, '2026-07-31T00:00:00.000Z');
  assert.equal(sample.session_id, 'sess-abc123');
  assert.equal(sample.model.id, 'claude-opus-5');
  assert.equal(sample.effort.level, 'high');
  assert.equal(sample.context_window.used_percentage, 42.5);
  assert.equal(sample.context_window.context_window_size, 1000000);
  assert.equal(sample.context_window.exceeds_200k_tokens, false);
  assert.equal(sample.rate_limits.five_hour.used_percentage, 12);
  assert.equal(sample.rate_limits.seven_day.resets_at, 1780500000);
});

test('extractHealthSample: missing session_id -> null (nothing safe to key on)', () => {
  const { session_id, ...rest } = REAL_PAYLOAD;
  assert.equal(extractHealthSample(rest), null);
});

test('extractHealthSample: empty session_id -> null', () => {
  assert.equal(extractHealthSample({ ...REAL_PAYLOAD, session_id: '' }), null);
});

test('extractHealthSample: missing nested fields are null, never 0 or false', () => {
  const sparse = { session_id: 'sess-1' };
  const sample = extractHealthSample(sparse);
  assert.equal(sample.context_window.used_percentage, null);
  assert.equal(sample.context_window.exceeds_200k_tokens, null);
  assert.equal(sample.rate_limits.five_hour.used_percentage, null);
  assert.equal(sample.rate_limits.five_hour.resets_at, null);
  assert.equal(sample.model.id, null);
  assert.equal(sample.pr.number, null);
  assert.equal(sample.worktree.name, null);
});

test('extractHealthSample: a real false boolean survives (not coerced to null)', () => {
  const sample = extractHealthSample({ session_id: 's', exceeds_200k_tokens: false });
  assert.equal(sample.context_window.exceeds_200k_tokens, false);
});

test('extractHealthSample: non-object payload -> null', () => {
  assert.equal(extractHealthSample(null), null);
  assert.equal(extractHealthSample('nope'), null);
  assert.equal(extractHealthSample(42), null);
});

// ---------------------------------------------------------------------------
// sampleFromStdin — the composed, still-pure-enough-to-test-without-real-IO path
// ---------------------------------------------------------------------------

test('sampleFromStdin: valid payload writes via the injected writer', () => {
  let calledWith = null;
  const result = sampleFromStdin(JSON.stringify(REAL_PAYLOAD), {
    sampledAt: '2026-07-31T00:00:00.000Z',
    writer: (sessionId, sample) => {
      calledWith = { sessionId, sample };
      return '/fake/path.json';
    },
  });
  assert.equal(result.written, true);
  assert.equal(result.path, '/fake/path.json');
  assert.equal(calledWith.sessionId, 'sess-abc123');
  assert.equal(calledWith.sample.session_id, 'sess-abc123');
});

test('sampleFromStdin: malformed stdin writes nothing, never calls the writer', () => {
  let writerCalled = false;
  const result = sampleFromStdin('{ not json', {
    writer: () => {
      writerCalled = true;
      return '/fake/path.json';
    },
  });
  assert.equal(result.written, false);
  assert.equal(result.reason, 'unreadable-payload');
  assert.equal(writerCalled, false);
});

test('sampleFromStdin: empty stdin writes nothing, never calls the writer', () => {
  let writerCalled = false;
  const result = sampleFromStdin('', { writer: () => { writerCalled = true; } });
  assert.equal(result.written, false);
  assert.equal(result.reason, 'unreadable-payload');
  assert.equal(writerCalled, false);
});

test('sampleFromStdin: valid JSON with no session_id writes nothing', () => {
  let writerCalled = false;
  const { session_id, ...rest } = REAL_PAYLOAD;
  const result = sampleFromStdin(JSON.stringify(rest), { writer: () => { writerCalled = true; } });
  assert.equal(result.written, false);
  assert.equal(result.reason, 'no-session-id');
  assert.equal(writerCalled, false);
});

test('sampleFromStdin: a throwing writer is caught, never propagates', () => {
  const result = sampleFromStdin(JSON.stringify(REAL_PAYLOAD), {
    writer: () => {
      throw new Error('disk full');
    },
  });
  assert.equal(result.written, false);
  assert.equal(result.reason, 'write-failed');
  assert.match(result.error, /disk full/);
});

// ---------------------------------------------------------------------------
// Real health-store round trip (real fs, not an injected fake)
// ---------------------------------------------------------------------------

test('sampleFromStdin: real round trip through the actual health store', () => {
  const dir = tempHealthDir();
  try {
    const result = sampleFromStdin(JSON.stringify(REAL_PAYLOAD), {
      sampledAt: '2026-07-31T00:00:00.000Z',
      storeOpts: { envOverride: dir },
    });
    assert.equal(result.written, true);
    const read = readHealthSample('sess-abc123', { envOverride: dir });
    assert.equal(read.ok, true);
    assert.equal(read.data.session_id, 'sess-abc123');
    assert.equal(read.data.context_window.used_percentage, 42.5);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

// ---------------------------------------------------------------------------
// MUTATION TEST (map-specified): malformed/empty stdin writes nothing, exits 0,
// never corrupts the store. Proven against the REAL health store: bank one good
// sample, then feed garbage, then prove the good sample survives untouched.
// ---------------------------------------------------------------------------

test('mutation: malformed stdin after a good sample never corrupts the store', () => {
  const dir = tempHealthDir();
  try {
    const good = sampleFromStdin(JSON.stringify(REAL_PAYLOAD), {
      sampledAt: '2026-07-31T00:00:00.000Z',
      storeOpts: { envOverride: dir },
    });
    assert.equal(good.written, true);

    const beforeCorruptAttempt = readHealthSample('sess-abc123', { envOverride: dir });
    assert.equal(beforeCorruptAttempt.ok, true);

    const garbageAttempts = ['{ not json at all', '', '   ', '[1,2,3]', 'null', '"just a string"'];
    for (const garbage of garbageAttempts) {
      const result = sampleFromStdin(garbage, { storeOpts: { envOverride: dir } });
      assert.equal(result.written, false);
    }

    const after = readHealthSample('sess-abc123', { envOverride: dir });
    assert.equal(after.ok, true);
    assert.deepEqual(after.data, beforeCorruptAttempt.data);

    // The file on disk must still be exactly one complete, parseable JSON document —
    // never partially overwritten by a garbage attempt.
    const raw = readFileSync(healthFilePath('sess-abc123', { envOverride: dir }), 'utf8');
    assert.doesNotThrow(() => JSON.parse(raw));
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('mutation: malformed stdin never creates a store file for that session', () => {
  const dir = tempHealthDir();
  try {
    sampleFromStdin('{ not json', { storeOpts: { envOverride: dir } });
    const filePath = healthFilePath('sess-never-written', { envOverride: dir });
    assert.equal(existsSync(filePath), false);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

// ---------------------------------------------------------------------------
// Real-process CLI mutation test: the actual `node sampler.mjs` invocation must
// exit 0 on malformed stdin (a statusLine command that exits non-zero can break
// the UI that invokes it) and must still not write anything for that session.
// ---------------------------------------------------------------------------

test('mutation (real process): CLI exits 0 on malformed stdin', () => {
  const dir = tempHealthDir();
  try {
    const result = spawnSamplerSync('{ not valid json', dir);
    assert.equal(result.status, 0);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('mutation (real process): CLI exits 0 on empty stdin', () => {
  const dir = tempHealthDir();
  try {
    const result = spawnSamplerSync('', dir);
    assert.equal(result.status, 0);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('real process: CLI exits 0 and writes a sample on valid stdin', () => {
  const dir = tempHealthDir();
  try {
    const result = spawnSamplerSync(JSON.stringify(REAL_PAYLOAD), dir);
    assert.equal(result.status, 0);
    const filePath = healthFilePath('sess-abc123', { envOverride: dir });
    assert.equal(existsSync(filePath), true);
    const data = JSON.parse(readFileSync(filePath, 'utf8'));
    assert.equal(data.session_id, 'sess-abc123');
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

function spawnSamplerSync(stdin, healthDir) {
  try {
    execFileSync(process.execPath, [SAMPLER_PATH], {
      input: stdin,
      encoding: 'utf8',
      env: { ...process.env, MYPKA_GOVERNOR_HEALTH_DIR: healthDir },
    });
    return { status: 0 };
  } catch (err) {
    return { status: err.status ?? 1, error: err };
  }
}

// ---------------------------------------------------------------------------
// Performance: the ticket's "<100ms" acceptance shape, measured on the actual
// extract+write path (excluding node process startup, which is a fixed cost of
// the host runtime, not this module).
// ---------------------------------------------------------------------------

test('performance: extract + write completes well under 100ms', () => {
  const dir = tempHealthDir();
  try {
    const start = process.hrtime.bigint();
    const result = sampleFromStdin(JSON.stringify(REAL_PAYLOAD), {
      sampledAt: '2026-07-31T00:00:00.000Z',
      storeOpts: { envOverride: dir },
    });
    const elapsedMs = Number(process.hrtime.bigint() - start) / 1e6;
    assert.equal(result.written, true);
    assert.ok(elapsedMs < 100, `expected < 100ms, took ${elapsedMs}ms`);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
