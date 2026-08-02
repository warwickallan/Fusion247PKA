import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync, existsSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  parseStdinPayload,
  extractHealthSample,
  sampleFromStdin,
  SAMPLE_SCHEMA_VERSION,
  SOURCE_STATUSLINE,
  SOURCE_TRANSCRIPT,
  TRANSCRIPT_TAIL_BYTES,
  readTranscriptTail,
  sumUsedTokens,
  newestAssistantUsage,
  resolveWindowTokens,
  WINDOW_SOURCE_ENV,
  WINDOW_SOURCE_OBSERVED,
  extractTranscriptSample,
  sampleFromTranscript,
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

// ===========================================================================
// THE TRANSCRIPT PATH (WO-OR-05) — the half that reaches Warwick
// ===========================================================================
// Everything above this line tests the statusLine path, which does not run on claude.ai
// web or Android. These tests cover the Stop-hook path that does.

/** One JSONL transcript, written to a scratch file. */
function writeTranscript(dir, lines) {
  const p = join(dir, 'transcript.jsonl');
  writeFileSync(p, lines.map((l) => (typeof l === 'string' ? l : JSON.stringify(l))).join('\n') + '\n');
  return p;
}

function assistantLine({ usage, model = 'claude-opus-5', effort = 'high', sessionId = 'sess-t' }) {
  return { type: 'assistant', sessionId, effort, message: { model, usage } };
}

const REAL_USAGE = {
  input_tokens: 2,
  cache_creation_input_tokens: 40041,
  cache_read_input_tokens: 32559,
  output_tokens: 475,
};
const REAL_USAGE_TOTAL = 2 + 40041 + 32559 + 475; // 73077

test('TRANSCRIPT: used tokens sum input + cache-creation + cache-read + output', () => {
  // Cache reads DOMINATE in a long session. Omitting them under-reports by an order of
  // magnitude, which would render a comfortable-looking percentage over a full window.
  assert.equal(sumUsedTokens(REAL_USAGE), REAL_USAGE_TOTAL);

  // MUTATION: drop the cache-read term and the answer changes materially — proving the
  // term is load-bearing rather than incidental.
  const withoutCacheRead = { ...REAL_USAGE, cache_read_input_tokens: undefined };
  assert.equal(sumUsedTokens(withoutCacheRead), REAL_USAGE_TOTAL - 32559);
  assert.notEqual(sumUsedTokens(withoutCacheRead), sumUsedTokens(REAL_USAGE));
});

test('TRANSCRIPT: NO usable field is null, never 0 — absence is not an empty context', () => {
  assert.equal(sumUsedTokens(null), null);
  assert.equal(sumUsedTokens({}), null);
  assert.equal(sumUsedTokens({ input_tokens: 'twelve' }), null, 'a string is not a count');
  assert.equal(sumUsedTokens({ input_tokens: Number.NaN }), null);
  assert.equal(sumUsedTokens({ input_tokens: -5 }), null);
  // But a genuine zero IS zero.
  assert.equal(sumUsedTokens({ input_tokens: 0 }), 0);
});

test('TRANSCRIPT: the NEWEST assistant message wins, and junk lines are skipped not fatal', () => {
  const dir = tempHealthDir();
  try {
    const p = writeTranscript(dir, [
      assistantLine({ usage: { input_tokens: 111 } }),
      { type: 'user', message: { content: 'hello' } },
      assistantLine({ usage: { input_tokens: 222 } }),
      '{ this line is truncated mid-wri',
      '',
    ]);
    const found = newestAssistantUsage(readTranscriptTail(p));
    assert.equal(sumUsedTokens(found.usage), 222, 'the LAST assistant message, not the first');
    assert.equal(found.modelId, 'claude-opus-5');
    assert.equal(found.effort, 'high', 'the effort in force is carried through');
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('TRANSCRIPT: a transcript with no assistant usage yields null, and an absent file never throws', () => {
  const dir = tempHealthDir();
  try {
    const p = writeTranscript(dir, [{ type: 'user', message: { content: 'x' } }]);
    assert.equal(newestAssistantUsage(readTranscriptTail(p)), null);
    assert.equal(readTranscriptTail(join(dir, 'nope.jsonl')), '', 'a missing file is empty, not a throw');
    assert.equal(readTranscriptTail(null), '');
    assert.equal(newestAssistantUsage(''), null);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('TRANSCRIPT: the tail read is BOUNDED — a huge transcript is not read whole', () => {
  // This runs on EVERY turn end and real transcripts reach tens of megabytes. An
  // unbounded read would make the Stop hook slower the longer a session ran.
  const dir = tempHealthDir();
  try {
    const filler = JSON.stringify({ type: 'user', message: { content: 'x'.repeat(2000) } });
    const lines = Array.from({ length: 3000 }, () => filler);
    lines.push(JSON.stringify(assistantLine({ usage: REAL_USAGE })));
    const p = writeTranscript(dir, lines);

    const tail = readTranscriptTail(p, 64 * 1024);
    assert.ok(tail.length <= 64 * 1024, 'the read is capped');
    assert.ok(tail.length < readFileSync(p, 'utf8').length, 'and genuinely smaller than the file');
    // The newest usage is still found, because it is at the END.
    assert.equal(sumUsedTokens(newestAssistantUsage(tail).usage), REAL_USAGE_TOTAL);
    // The first (partial) line is dropped rather than parsed.
    assert.equal(tail.startsWith('{'), true, 'the fragment is trimmed to a line boundary');
    assert.equal(TRANSCRIPT_TAIL_BYTES, 2 * 1024 * 1024);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

// ---------------------------------------------------------------------------
// THE DENOMINATOR — the rule that keeps the percentage honest
// ---------------------------------------------------------------------------

test('DENOMINATOR: an explicit CLAUDE_CONTEXT_WINDOW is authoritative', () => {
  assert.deepEqual(resolveWindowTokens({ sessionId: 'any', env: { CLAUDE_CONTEXT_WINDOW: '1000000' } }), {
    tokens: 1000000,
    source: WINDOW_SOURCE_ENV,
  });
  // Garbage in the variable is not a denominator.
  for (const bad of ['', 'lots', '0', '-1']) {
    assert.equal(resolveWindowTokens({ sessionId: null, env: { CLAUDE_CONTEXT_WINDOW: bad } }).tokens, null, bad);
  }
});

// ---------------------------------------------------------------------------
// WO-OR-09 — a denominator must be ESTABLISHED FOR THE LIVE SESSION.
//
// WO-OR-08 tried to make a cross-session model-id match trustworthy by guarding it.
// Codex TQA-001 showed the guards only fire when the store HAPPENS to hold the
// disproving entry: one bare-id observation with no variant sibling and a 1M session
// still borrowed a 200k window. Agreement between observations establishes store
// consistency, not live-session identity — so the cross-session rule is GONE rather
// than guarded again, and with it guards (a) and (b) and `variantBaseOf`.
//
// The store below is written in the shape the real one holds: one file per session,
// NAMED for that session, which is the only linkage that means anything here.
// ---------------------------------------------------------------------------

/** One statusLine observation, filed under the session that made it. */
function writeObservation(dir, sessionId, size, { at = '2026-08-02T00:00:00Z', modelId = 'some-model' } = {}) {
  writeFileSync(join(dir, `${sessionId}.json`), JSON.stringify({
    schema_version: 1,
    sampled_at: at,
    session_id: sessionId,
    source: SOURCE_STATUSLINE,
    model: { id: modelId },
    context_window: { context_window_size: size },
  }));
}

/** A transcript sample, as the Stop hook leaves it once it has overwritten the above. */
function writeCarriedForward(dir, sessionId, size, source, { usedTokens = 1 } = {}) {
  writeFileSync(join(dir, `${sessionId}.json`), JSON.stringify({
    schema_version: 1,
    sampled_at: '2026-08-02T01:00:00Z',
    session_id: sessionId,
    source: SOURCE_TRANSCRIPT,
    model: { id: 'some-model' },
    context_window: {
      context_window_size: size,
      context_window_source: source,
      used_tokens: usedTokens,
    },
  }));
}

test('WO-OR-09 REGRESSION (Codex TQA-001 / X1): ONE bare-id observation, NO sibling, is still not this session', () => {
  // THE EXACT SCENARIO THE WO-OR-08 REPAIR LEFT OPEN, and the reason that repair was
  // insufficient rather than wrong. The store holds a single 200k observation recorded by
  // SOME OTHER session under the bare model id. No variant sibling exists, so guard (b)
  // never fires; the observations do not disagree, so guard (a) never fires; 91164 fits
  // inside 200000, so guard (c) never fires. All three guards stay silent and the old
  // rule handed a 1M session a 200k denominator — a confident five-times-wrong figure, on
  // a fresh machine or simply before the variant session had ever been observed.
  //
  // Under the same-session rule there is nothing to decide: `live-1m-session` has no
  // record of its own, so no denominator exists. Reverting to any cross-session match
  // re-opens TQA-001 and this assertion is what stops it.
  const dir = tempHealthDir();
  const storeOpts = { envOverride: dir };
  try {
    writeObservation(dir, 'some-other-200k-session', 200000, { modelId: 'claude-opus-5' });

    assert.deepEqual(
      resolveWindowTokens({ sessionId: 'live-1m-session', usedTokens: 91164, env: {}, storeOpts }),
      { tokens: null, source: null },
      'another session\'s observation is not evidence about this one, however unambiguous it looks'
    );

    // MUTATION, in-test: file the SAME observation under the LIVE session's id and it
    // resolves immediately. This proves the refusal above is about identity, not about
    // the function having become incapable of returning a number.
    writeObservation(dir, 'live-1m-session', 1000000, { modelId: 'claude-opus-5' });
    assert.deepEqual(
      resolveWindowTokens({ sessionId: 'live-1m-session', usedTokens: 91164, env: {}, storeOpts }),
      { tokens: 1000000, source: WINDOW_SOURCE_OBSERVED },
      'and the session\'s OWN observation is authoritative for it'
    );
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('WO-OR-09: the store is never ENUMERATED — a hundred other sessions establish nothing', () => {
  // The property, not one example of it. The old rule scanned every file in the store;
  // no quantity of other sessions' records can now produce a denominator, so no future
  // "but they all agree" reasoning can creep back in.
  const dir = tempHealthDir();
  const storeOpts = { envOverride: dir };
  try {
    for (let i = 0; i < 100; i += 1) writeObservation(dir, `bystander-${i}`, 200000);
    assert.equal(
      resolveWindowTokens({ sessionId: 'live', usedTokens: 1000, env: {}, storeOpts }).tokens,
      null,
      'unanimous agreement among strangers is still not this session'
    );
    assert.equal(
      resolveWindowTokens({ sessionId: 'bystander-7', usedTokens: 1000, env: {}, storeOpts }).tokens,
      200000,
      'while any one of them resolves for ITSELF'
    );
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('WO-OR-09: no session id means the store is NOT CONSULTED AT ALL', () => {
  // Asserted against the CALL, not merely against the answer. Without the spy this test
  // passes for the wrong reason: `readHealthSample` throws on a non-string key, the
  // resolver's catch turns that into NO_WINDOW, and deleting the guard entirely would
  // leave the returned value unchanged — a mutation that survives, which is a test that
  // is not testing. Pinning "never asked" makes the guard's removal detectable.
  const dir = tempHealthDir();
  const storeOpts = { envOverride: dir };
  try {
    writeObservation(dir, 'live', 200000);
    for (const bad of [null, undefined, '', 42, {}]) {
      let consulted = 0;
      const readSample = (...args) => {
        consulted += 1;
        return readHealthSample(...args);
      };
      const label = String(bad);
      assert.equal(
        resolveWindowTokens({ sessionId: bad, env: {}, storeOpts, readSample }).tokens,
        null,
        label
      );
      assert.equal(consulted, 0, `an unusable session id must not reach the store (${label})`);
    }

    // CONTROL: a usable id does consult it, and does resolve. Without this the assertion
    // above would be satisfied by a resolver that never reads the store at all.
    let consulted = 0;
    const readSample = (...args) => {
      consulted += 1;
      return readHealthSample(...args);
    };
    assert.equal(resolveWindowTokens({ sessionId: 'live', env: {}, storeOpts, readSample }).tokens, 200000);
    assert.equal(consulted, 1, 'exactly one record is read — the store is never enumerated');
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('WO-OR-09 CARRY-FORWARD: the observation survives the transcript write that overwrites it', () => {
  // WHY THIS CASE EXISTS AT ALL. The health store is one file per session and every write
  // REPLACES it, so the turn-end transcript write clobbers the statusLine sample that
  // observed the window. Verified against health-store.mjs, which stringifies the whole
  // sample over the previous file. Accept only the direct observation and a terminal
  // session goes BLIND after its first turn, flickering back on the next statusLine
  // render — so a transcript sample that CARRIED the observation forward counts too.
  const dir = tempHealthDir();
  const storeOpts = { envOverride: dir };
  try {
    writeCarriedForward(dir, 'live', 1000000, WINDOW_SOURCE_OBSERVED);
    assert.deepEqual(
      resolveWindowTokens({ sessionId: 'live', usedTokens: 91164, env: {}, storeOpts }),
      { tokens: 1000000, source: WINDOW_SOURCE_OBSERVED },
      'a carried-forward observation is still this session\'s own observation'
    );

    // An env-sourced value is NOT carried. Rule 1 re-reads the variable on every call, so
    // carrying it buys nothing — and it would keep an operator's declaration rendering
    // after the operator withdrew it, which is false authority in a different costume.
    writeCarriedForward(dir, 'live', 1000000, WINDOW_SOURCE_ENV);
    assert.deepEqual(
      resolveWindowTokens({ sessionId: 'live', usedTokens: 91164, env: {}, storeOpts }),
      { tokens: null, source: null },
      'a withdrawn CLAUDE_CONTEXT_WINDOW must not keep rendering from the store'
    );
    // ...and while it is still declared, rule 1 supplies it live, so nothing is lost.
    assert.deepEqual(
      resolveWindowTokens({ sessionId: 'live', usedTokens: 91164, env: { CLAUDE_CONTEXT_WINDOW: '1000000' }, storeOpts }),
      { tokens: 1000000, source: WINDOW_SOURCE_ENV }
    );

    // A transcript sample carrying NO window is not a source either.
    writeCarriedForward(dir, 'live', null, null);
    assert.equal(resolveWindowTokens({ sessionId: 'live', env: {}, storeOpts }).tokens, null);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('WO-OR-09 guard (d) IDENTITY: a record whose own session_id disagrees is refused', () => {
  // The file is KEYED by session id, so this is normally tautological — which is exactly
  // why it is asserted rather than assumed. Identity is the single invariant the whole
  // function now rests on; a store that contradicts its own filename establishes nothing.
  const dir = tempHealthDir();
  const storeOpts = { envOverride: dir };
  try {
    writeFileSync(join(dir, 'live.json'), JSON.stringify({
      schema_version: 1,
      sampled_at: '2026-08-02T00:00:00Z',
      session_id: 'someone-else',
      source: SOURCE_STATUSLINE,
      model: { id: 'm' },
      context_window: { context_window_size: 200000 },
    }));
    assert.deepEqual(
      resolveWindowTokens({ sessionId: 'live', env: {}, storeOpts }),
      { tokens: null, source: null },
      'the filename says one session and the contents say another — that is not evidence'
    );

    // MUTATION: make the two agree and the same record resolves.
    writeObservation(dir, 'live', 200000);
    assert.equal(resolveWindowTokens({ sessionId: 'live', env: {}, storeOpts }).tokens, 200000);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('WO-OR-09 guard (c): a window SMALLER than its own numerator is disproven and refused', () => {
  // SURVIVES WO-OR-09 ON ITS OWN MERITS. Unlike (a) and (b) this is not an inference about
  // which session a record belongs to — it is arithmetic, and it is the ONE guard that
  // also binds the explicit operator statement, because a human can typo a value too.
  const dir = tempHealthDir();
  const storeOpts = { envOverride: dir };
  try {
    writeObservation(dir, 'live', 200000);

    assert.deepEqual(
      resolveWindowTokens({ sessionId: 'live', usedTokens: 408169, env: {}, storeOpts }),
      { tokens: null, source: null },
      'this session\'s own observation cannot be smaller than the count it must divide'
    );
    assert.deepEqual(
      resolveWindowTokens({ sessionId: 'live', usedTokens: 408169, env: { CLAUDE_CONTEXT_WINDOW: '200000' }, storeOpts }),
      { tokens: null, source: null },
      'and neither can an explicitly declared one'
    );

    // MUTATION: the SAME store and env with a coherent numerator still resolve. Guard (c)
    // must be sensitive to the numerator, not simply hostile to everything.
    assert.equal(resolveWindowTokens({ sessionId: 'live', usedTokens: 111019, env: {}, storeOpts }).tokens, 200000);
    assert.equal(resolveWindowTokens({ sessionId: 'live', usedTokens: 200000, env: {}, storeOpts }).tokens, 200000, 'exactly full is coherent');
    assert.equal(resolveWindowTokens({ sessionId: 'live', env: {}, storeOpts }).tokens, 200000, 'no numerator supplied disables (c) only');

    // And guard (c) also binds a CARRIED-FORWARD value, not just a fresh observation.
    writeCarriedForward(dir, 'live', 200000, WINDOW_SOURCE_OBSERVED);
    assert.equal(resolveWindowTokens({ sessionId: 'live', usedTokens: 408169, env: {}, storeOpts }).tokens, null);
    assert.equal(resolveWindowTokens({ sessionId: 'live', usedTokens: 111019, env: {}, storeOpts }).tokens, 200000);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('WO-OR-09 POSITIVE CONTROL: the honest cases still get a denominator', () => {
  // THE TEST THAT STOPS THE "FIX" BEING `return null`. A rule that only ever subtracts
  // would satisfy every assertion above while destroying the feature, so each case that
  // must STILL resolve is pinned explicitly. If this test ever goes red, the percentage
  // has been removed rather than repaired.
  const dir = tempHealthDir();
  const storeOpts = { envOverride: dir };
  try {
    // 1. An explicit operator statement, whatever the store says.
    assert.deepEqual(resolveWindowTokens({ sessionId: 'anything', env: { CLAUDE_CONTEXT_WINDOW: '1000000' }, storeOpts }), {
      tokens: 1000000,
      source: WINDOW_SOURCE_ENV,
    });

    // 2. This session's own statusLine observation — the terminal case.
    writeObservation(dir, 'live', 200000);
    assert.deepEqual(resolveWindowTokens({ sessionId: 'live', env: {}, storeOpts }), {
      tokens: 200000,
      source: WINDOW_SOURCE_OBSERVED,
    });

    // 3. The same session after a turn end has overwritten that sample — the case that
    //    keeps a terminal percentage alive across turns rather than for one turn only.
    writeCarriedForward(dir, 'live', 200000, WINDOW_SOURCE_OBSERVED);
    assert.deepEqual(resolveWindowTokens({ sessionId: 'live', env: {}, storeOpts }), {
      tokens: 200000,
      source: WINDOW_SOURCE_OBSERVED,
    });

    // 4. A neighbouring session's records neither help nor harm.
    writeObservation(dir, 'neighbour', 1000000);
    assert.equal(resolveWindowTokens({ sessionId: 'live', env: {}, storeOpts }).tokens, 200000, 'unaffected');
    assert.equal(resolveWindowTokens({ sessionId: 'neighbour', env: {}, storeOpts }).tokens, 1000000, 'and it resolves for itself');
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('WO-OR-09 END TO END: the real store shape yields a TRUE numerator and NO false percentage', () => {
  // The whole defect, end to end, through the function the Stop hook actually calls —
  // including that `extractTranscriptSample` resolves the window only AFTER it knows the
  // session id, which is now load-bearing rather than incidental ordering.
  //
  // THIS IS THE RED-PROOF FOR TQA-001, and it is deliberately routed through
  // `sampleFromTranscript` rather than the resolver. The resolver's SIGNATURE changed
  // (`modelId` out, `sessionId` in), so a unit-level test of the new rule would pass
  // against the old code for the wrong reason — the old function would simply ignore an
  // argument it never had. `sampleFromTranscript` takes identical arguments in both
  // versions, so the two can be compared on the same real situation.
  //
  // The store below holds ONE bare-id 200k observation and NO variant sibling — X1
  // exactly. Guard (b) cannot fire without the sibling, guard (a) cannot fire without a
  // disagreement, and 111019 fits inside 200000 so guard (c) cannot fire either. Against
  // the WO-OR-08 code this yields context_window_size 200000 and this test goes red.
  const dir = tempHealthDir();
  const storeOpts = { envOverride: dir };
  try {
    writeObservation(dir, 'other-200k-session', 200000, { modelId: 'claude-opus-5' });
    const p = writeTranscript(dir, [assistantLine({ usage: { input_tokens: 111019 }, sessionId: 'live' })]);

    const r = sampleFromTranscript(JSON.stringify({ session_id: 'live', transcript_path: p }), {
      sampledAt: '2026-08-02T05:22:31.045Z',
      storeOpts,
      env: {},
    });

    assert.equal(r.written, true, r.reason);
    assert.equal(r.sample.context_window.used_tokens, 111019, 'the numerator is real and survives');
    assert.equal(r.sample.context_window.context_window_size, null, 'and NO denominator is borrowed');
    assert.equal(r.sample.context_window.context_window_source, null);
    assert.equal(r.sample.context_window.used_percentage, null, 'so no percentage is invented');

    // POSITIVE CONTROL on the same path: give the LIVE session an observation of its own
    // and the very same call produces a denominator, provenance attached.
    writeObservation(dir, 'live', 1000000);
    const ok = sampleFromTranscript(JSON.stringify({ session_id: 'live', transcript_path: p }), {
      sampledAt: '2026-08-02T05:22:31.045Z',
      storeOpts,
      env: {},
    });
    assert.equal(ok.sample.context_window.context_window_size, 1000000);
    assert.equal(ok.sample.context_window.context_window_source, WINDOW_SOURCE_OBSERVED);

    // And the written sample CARRIES it, so the next turn is not blind — the overwrite
    // this store performs is exactly why that matters.
    const back = readHealthSample('live', { envOverride: dir });
    assert.equal(back.data.source, SOURCE_TRANSCRIPT, 'the statusLine sample has indeed been overwritten');
    assert.equal(back.data.context_window.context_window_size, 1000000, 'and the observation survived it');
    assert.equal(
      resolveWindowTokens({ sessionId: 'live', usedTokens: 111019, env: {}, storeOpts }).tokens,
      1000000,
      'so the NEXT turn still resolves'
    );
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('DENOMINATOR MUTATION: there is NO model-to-window table anywhere in the sampler source', () => {
  // The forbidden fix, asserted against the SOURCE rather than against behaviour, because
  // a table could be added and still produce correct answers on the machine that wrote
  // it. The literals below are the two window sizes this estate actually runs.
  const src = readFileSync(SAMPLER_PATH, 'utf8');
  const code = src.split('\n').filter((l) => !l.trimStart().startsWith('//')).join('\n');
  for (const literal of ['200000', '200_000', '1000000', '1_000_000']) {
    assert.equal(code.includes(literal), false, `a hardcoded window size (${literal}) is forbidden`);
  }
  assert.equal(/claude-opus|claude-sonnet|claude-haiku/.test(code), false, 'no model name is keyed on');
});

// ---------------------------------------------------------------------------
// End to end
// ---------------------------------------------------------------------------

test('TRANSCRIPT: a Stop payload produces a written sample with a REAL numerator', () => {
  const dir = tempHealthDir();
  try {
    const p = writeTranscript(dir, [assistantLine({ usage: REAL_USAGE, sessionId: 'from-transcript' })]);
    const r = sampleFromTranscript(
      JSON.stringify({ session_id: 'from-payload', transcript_path: p, cwd: 'C:/x' }),
      { sampledAt: '2026-08-02T05:00:00.000Z', storeOpts: { envOverride: dir }, env: {} }
    );

    assert.equal(r.written, true, r.reason);
    assert.equal(r.sample.source, SOURCE_TRANSCRIPT);
    assert.equal(r.sample.schema_version, SAMPLE_SCHEMA_VERSION, 'the footer reads this version');
    assert.equal(r.sample.context_window.used_tokens, REAL_USAGE_TOTAL);
    assert.equal(r.sample.context_window.context_window_size, null, 'no denominator was available');
    assert.equal(r.sample.context_window.context_window_source, null);
    assert.equal(r.sample.context_window.used_percentage, null, 'and NO percentage is invented');
    assert.equal(r.sample.model.id, 'claude-opus-5');
    assert.equal(r.sample.effort.level, 'high');
    // The PAYLOAD's session id wins: it is the runtime saying which session fired.
    assert.equal(r.sample.session_id, 'from-payload');

    const back = readHealthSample('from-payload', { envOverride: dir });
    assert.equal(back.ok, true);
    assert.equal(back.data.context_window.used_tokens, REAL_USAGE_TOTAL, 'durably on disk');
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('TRANSCRIPT: with a denominator available the sample carries BOTH numbers', () => {
  const dir = tempHealthDir();
  try {
    const p = writeTranscript(dir, [assistantLine({ usage: REAL_USAGE })]);
    const r = sampleFromTranscript(
      JSON.stringify({ session_id: 's', transcript_path: p }),
      { sampledAt: '2026-08-02T05:00:00.000Z', storeOpts: { envOverride: dir }, env: { CLAUDE_CONTEXT_WINDOW: '1000000' } }
    );
    assert.equal(r.sample.context_window.used_tokens, REAL_USAGE_TOTAL);
    assert.equal(r.sample.context_window.context_window_size, 1000000);
    assert.equal(r.sample.context_window.context_window_source, 'env:CLAUDE_CONTEXT_WINDOW',
      'the provenance is recorded, so no denominator is unattributable');
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('TRANSCRIPT: every hostile input is REPORTED, never thrown — a Stop hook must not crash', () => {
  // A throw here ends Warwick's turn with an error. Telemetry is never worth that.
  const dir = tempHealthDir();
  try {
    const cases = [
      ['', 'unreadable-payload'],
      ['not json', 'unreadable-payload'],
      ['[]', 'unreadable-payload'],
      ['{}', 'no-transcript-path'],
      ['{"transcript_path":""}', 'no-transcript-path'],
      [JSON.stringify({ session_id: 's', transcript_path: join(dir, 'absent.jsonl') }), 'no-usable-usage'],
    ];
    for (const [raw, reason] of cases) {
      const r = sampleFromTranscript(raw, { storeOpts: { envOverride: dir } });
      assert.equal(r.written, false, JSON.stringify(raw));
      assert.equal(r.reason, reason, JSON.stringify(raw));
    }
    assert.equal(cases.length, 6);

    // No session to key on anywhere -> nothing safe to write.
    const p = writeTranscript(dir, [{ type: 'assistant', message: { model: 'm', usage: REAL_USAGE } }]);
    assert.equal(extractTranscriptSample({ transcriptPath: p, sessionId: null }), null);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
