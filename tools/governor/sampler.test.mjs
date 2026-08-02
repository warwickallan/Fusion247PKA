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
  variantBaseOf,
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
  assert.deepEqual(resolveWindowTokens({ modelId: 'm', env: { CLAUDE_CONTEXT_WINDOW: '1000000' } }), {
    tokens: 1000000,
    source: 'env:CLAUDE_CONTEXT_WINDOW',
  });
  // Garbage in the variable is not a denominator.
  for (const bad of ['', 'lots', '0', '-1']) {
    assert.equal(resolveWindowTokens({ modelId: null, env: { CLAUDE_CONTEXT_WINDOW: bad } }).tokens, null, bad);
  }
});

test('DENOMINATOR: a statusLine observation counts ONLY when the model id matches', () => {
  const dir = tempHealthDir();
  const storeOpts = { envOverride: dir };
  const observed = (id, size, at) => ({
    schema_version: 1,
    sampled_at: at,
    session_id: `s-${id}-${size}`,
    source: SOURCE_STATUSLINE,
    model: { id },
    context_window: { context_window_size: size },
  });
  try {
    writeFileSync(join(dir, 'a.json'), JSON.stringify(observed('claude-opus-5', 1000000, '2026-08-02T00:00:00Z')));
    assert.deepEqual(resolveWindowTokens({ modelId: 'claude-opus-5', env: {}, storeOpts }), {
      tokens: 1000000,
      source: 'statusline-observed',
    });

    // THE RULE THAT MATTERS. This estate runs 1M-context and 200k-context sessions of
    // DIFFERENT models; borrowing across them renders a percentage wrong by a factor of
    // five while looking authoritative.
    assert.deepEqual(resolveWindowTokens({ modelId: 'claude-haiku-9', env: {}, storeOpts }), {
      tokens: null,
      source: null,
    });

    // An unknown live model cannot match anything, so rule 2 cannot fire at all.
    assert.equal(resolveWindowTokens({ modelId: null, env: {}, storeOpts }).tokens, null);

    // A TRANSCRIPT-sourced sample is never a denominator source — it never observed one.
    writeFileSync(join(dir, 'b.json'), JSON.stringify({
      ...observed('claude-sonnet-5', 500000, '2026-08-02T00:00:00Z'),
      source: SOURCE_TRANSCRIPT,
    }));
    assert.equal(resolveWindowTokens({ modelId: 'claude-sonnet-5', env: {}, storeOpts }).tokens, null);

    // INVERTED BY WO-OR-08, ON LARRY'S EXPLICIT WORD — DO NOT "RESTORE" THIS.
    //
    // This assertion USED TO READ:
    //     // Newest matching observation wins.
    //     assert.equal(resolveWindowTokens({ modelId: 'claude-opus-5', ... }).tokens, 200000);
    //
    // It was green, and it encoded the defect. `a.json` and `c.json` carry the SAME model
    // id and DISAGREE about the window; "newest wins" resolved that by picking the most
    // recent, which is a guess about which session a stored sample belongs to dressed up
    // as a rule. Recency says nothing about which window is the LIVE session's — the two
    // observations may both be from other sessions entirely. Disagreement settles nothing,
    // so the honest answer is no denominator at all, and the footer degrades to a bare
    // token count with state BLIND rather than rendering a confident wrong percentage.
    //
    // Guard (a) in resolveWindowTokens. Reverting this assertion re-opens the defect.
    writeFileSync(join(dir, 'c.json'), JSON.stringify(observed('claude-opus-5', 200000, '2026-08-02T09:00:00Z')));
    assert.deepEqual(
      resolveWindowTokens({ modelId: 'claude-opus-5', env: {}, storeOpts }),
      { tokens: null, source: null },
      'matched observations that DISAGREE on the size establish nothing'
    );
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

// ---------------------------------------------------------------------------
// WO-OR-08 — the denominator must be ESTABLISHED, not merely matched.
//
// The defect these cover was observed LIVE on this estate, twice, and it survived a
// fully green suite because every existing denominator test used a store in which the
// recorded ids all came from ONE namespace. They do not in reality: a statusLine payload
// records a variant-suffixed id for a 1M-context session while the transcript's own
// `message.model` reports the bare base id. The store shape below is the real one.
// ---------------------------------------------------------------------------

/** One statusLine observation, in the shape the real store holds. */
function observedWindow(id, size, at) {
  return {
    schema_version: 1,
    sampled_at: at,
    session_id: `s-${id}-${size}`,
    source: SOURCE_STATUSLINE,
    model: { id },
    context_window: { context_window_size: size },
  };
}

test('WO-OR-08 guard (b): a BARE model id is AMBIGUOUS while a variant-suffixed sibling exists', () => {
  // THE LIVE DEFECT, reproduced from the real store's actual contents. A 1M session is
  // recorded under a variant-suffixed id; an unrelated 200k session under the bare id.
  // The transcript reports the BARE id, so the old rule matched the 200k entry and
  // rendered a 1M session at ~5x its true percentage — graded AMBER, advising rotation.
  const dir = tempHealthDir();
  const storeOpts = { envOverride: dir };
  try {
    writeFileSync(join(dir, 'a.json'), JSON.stringify(observedWindow('claude-opus-5[1m]', 1000000, '2026-08-01T00:49:52Z')));
    writeFileSync(join(dir, 'b.json'), JSON.stringify(observedWindow('claude-opus-5', 200000, '2026-08-01T00:49:56Z')));

    assert.deepEqual(
      resolveWindowTokens({ modelId: 'claude-opus-5', env: {}, storeOpts }),
      { tokens: null, source: null },
      'the bare id cannot be told apart from its variant sibling, so NO denominator'
    );

    // MUTATION, in-test: with the variant sibling absent the SAME bare id resolves
    // normally. This is what proves guard (b) is doing the work rather than the function
    // having simply become incapable of returning a number.
    rmSync(join(dir, 'a.json'));
    assert.deepEqual(
      resolveWindowTokens({ modelId: 'claude-opus-5', env: {}, storeOpts }),
      { tokens: 200000, source: 'statusline-observed' },
      'remove the ambiguity and the denominator comes back'
    );
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('WO-OR-08 guard (b) is ASYMMETRIC: a variant-suffixed LIVE id is already specific', () => {
  // A bare sibling must NOT widen a suffixed id. The suffixed id names its namespace
  // exactly; refusing it too would make the guard fire on the one case it need not.
  const dir = tempHealthDir();
  const storeOpts = { envOverride: dir };
  try {
    writeFileSync(join(dir, 'a.json'), JSON.stringify(observedWindow('claude-opus-5[1m]', 1000000, '2026-08-01T00:49:52Z')));
    writeFileSync(join(dir, 'b.json'), JSON.stringify(observedWindow('claude-opus-5', 200000, '2026-08-01T00:49:56Z')));
    assert.deepEqual(
      resolveWindowTokens({ modelId: 'claude-opus-5[1m]', env: {}, storeOpts }),
      { tokens: 1000000, source: 'statusline-observed' }
    );
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('WO-OR-08 guard (c): a window SMALLER than its own numerator is disproven and refused', () => {
  // The blatant shape, and the only one the map's proposed fix would have caught. Also
  // the ONE guard that applies to the explicit operator statement — a human can typo a
  // value too, and an env var is not evidence that survives contradiction.
  const dir = tempHealthDir();
  const storeOpts = { envOverride: dir };
  try {
    writeFileSync(join(dir, 'a.json'), JSON.stringify(observedWindow('m', 200000, '2026-08-02T00:00:00Z')));

    assert.deepEqual(
      resolveWindowTokens({ modelId: 'm', usedTokens: 408169, env: {}, storeOpts }),
      { tokens: null, source: null },
      'a store observation cannot be smaller than the count it must divide'
    );
    assert.deepEqual(
      resolveWindowTokens({ modelId: 'm', usedTokens: 408169, env: { CLAUDE_CONTEXT_WINDOW: '200000' }, storeOpts }),
      { tokens: null, source: null },
      'and neither can an explicitly declared one'
    );

    // MUTATION: the SAME store and env with a coherent numerator still resolve. Guard (c)
    // must be sensitive to the numerator, not simply hostile to everything.
    assert.equal(resolveWindowTokens({ modelId: 'm', usedTokens: 111019, env: {}, storeOpts }).tokens, 200000);
    assert.equal(resolveWindowTokens({ modelId: 'm', usedTokens: 200000, env: {}, storeOpts }).tokens, 200000, 'exactly full is coherent');
    assert.equal(resolveWindowTokens({ modelId: 'm', env: {}, storeOpts }).tokens, 200000, 'no numerator supplied disables (c) only');
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('WO-OR-08 POSITIVE CONTROL: the honest cases still get a denominator', () => {
  // THE TEST THAT STOPS THE "FIX" BEING `return null`. Three guards that only ever
  // subtract would satisfy every assertion above while destroying the feature, so the
  // cases that must STILL resolve are pinned explicitly.
  const dir = tempHealthDir();
  const storeOpts = { envOverride: dir };
  try {
    // 1. An explicit operator statement, always.
    assert.deepEqual(resolveWindowTokens({ modelId: 'anything', env: { CLAUDE_CONTEXT_WINDOW: '1000000' }, storeOpts }), {
      tokens: 1000000,
      source: 'env:CLAUDE_CONTEXT_WINDOW',
    });

    // 2. A single unambiguous observation.
    writeFileSync(join(dir, 'a.json'), JSON.stringify(observedWindow('solo', 200000, '2026-08-02T00:00:00Z')));
    assert.deepEqual(resolveWindowTokens({ modelId: 'solo', env: {}, storeOpts }), {
      tokens: 200000,
      source: 'statusline-observed',
    });

    // 3. SEVERAL observations that AGREE. Agreement is not ambiguity, and refusing here
    //    would make the footer BLIND for every ordinary repeat-observed session.
    writeFileSync(join(dir, 'b.json'), JSON.stringify(observedWindow('solo', 200000, '2026-08-02T01:00:00Z')));
    writeFileSync(join(dir, 'c.json'), JSON.stringify(observedWindow('solo', 200000, '2026-08-02T02:00:00Z')));
    assert.deepEqual(resolveWindowTokens({ modelId: 'solo', env: {}, storeOpts }), {
      tokens: 200000,
      source: 'statusline-observed',
    });

    // 4. An unrelated model's ambiguity is NOT contagious.
    writeFileSync(join(dir, 'd.json'), JSON.stringify(observedWindow('other[1m]', 1000000, '2026-08-02T00:00:00Z')));
    writeFileSync(join(dir, 'e.json'), JSON.stringify(observedWindow('other', 200000, '2026-08-02T00:00:00Z')));
    assert.equal(resolveWindowTokens({ modelId: 'other', env: {}, storeOpts }).tokens, null, 'other IS ambiguous');
    assert.equal(resolveWindowTokens({ modelId: 'solo', env: {}, storeOpts }).tokens, 200000, 'solo is NOT');
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('WO-OR-08: variantBaseOf recognises the SHAPE, and names no particular variant', () => {
  assert.equal(variantBaseOf('claude-opus-5[1m]'), 'claude-opus-5');
  assert.equal(variantBaseOf('claude-opus-4-8[1m]'), 'claude-opus-4-8');
  assert.equal(variantBaseOf('x[anything-at-all]'), 'x');
  assert.equal(variantBaseOf('claude-opus-5'), null, 'a bare id has no base');
  assert.equal(variantBaseOf('[1m]'), null, 'a suffix with no base is not a variant id');
  assert.equal(variantBaseOf('x[]'), null, 'an empty variant is not a variant');
  assert.equal(variantBaseOf('x[1m'), null, 'unterminated');
  assert.equal(variantBaseOf(null), null);
  assert.equal(variantBaseOf(42), null);
});

test('WO-OR-08 END TO END: the real store shape yields a TRUE numerator and NO false percentage', () => {
  // The whole defect, end to end, through the function the Stop hook actually calls.
  const dir = tempHealthDir();
  const storeOpts = { envOverride: dir };
  try {
    writeFileSync(join(dir, 'a.json'), JSON.stringify(observedWindow('claude-opus-5[1m]', 1000000, '2026-08-01T00:49:52Z')));
    writeFileSync(join(dir, 'b.json'), JSON.stringify(observedWindow('claude-opus-5', 200000, '2026-08-01T00:49:56Z')));
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
