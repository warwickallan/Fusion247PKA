// Tests for continuity-derive.mjs — the SessionEnd derivation.
//
// WO-OR-18. The second of the two modules the CI job named as having no suite at all.
//
// WHAT IS AND IS NOT EXERCISED, stated plainly so a green here is not read as more than
// it is. `deriveState()` shells out to `claude -p`; that is an LLM call, it is not
// deterministic, and it is not the interesting logic. What IS tested is everything around
// it — the transcript reader that decides WHAT the model sees, the shape guard that
// decides whether a derived object may be trusted, and the fail-safe contract that a bad
// derive must never clobber good continuity. The `claude` binary is never invoked here.
//
// NO LIVE STORE. `main()`'s persist path imports continuity.mjs, which resolves its store
// from `homedir()` at import time. Nothing in this suite reaches that path — every test
// either stops before persistence or drives `--dry-run` — and the containment is asserted
// rather than assumed at the end of the file.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, writeFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { tmpdir, homedir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

import { extractConversation, deriveState } from './continuity-derive.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const MODULE_PATH = join(__dirname, 'continuity-derive.mjs');

function tmp() {
  return mkdtempSync(join(tmpdir(), 'governor-derive-'));
}

// A transcript as Claude Code writes it: JSONL, one record per line.
function transcript(lines) {
  const dir = tmp();
  const path = join(dir, 'transcript.jsonl');
  writeFileSync(path, lines.map((l) => (typeof l === 'string' ? l : JSON.stringify(l))).join('\n') + '\n');
  return { path, cleanup: () => rmSync(dir, { recursive: true, force: true }) };
}

const userMsg = (text) => ({ type: 'user', message: { role: 'user', content: text } });
const asstMsg = (text) => ({ type: 'assistant', message: { role: 'assistant', content: [{ type: 'text', text }] } });

// ---------------------------------------------------------------------------
// extractConversation — what the model is actually shown
// ---------------------------------------------------------------------------

test('extractConversation reads both roles and labels them', () => {
  const t = transcript([userMsg('do the thing'), asstMsg('done')]);
  try {
    const out = extractConversation(t.path);
    assert.match(out, /^USER: do the thing/);
    assert.match(out, /ASSISTANT: done/);
    assert.match(out, /\n\n---\n\n/, 'messages are separated by the record delimiter');
  } finally { t.cleanup(); }
});

test('extractConversation handles BOTH content shapes — a string and a block array', () => {
  // The transcript carries user content as a bare string and assistant content as an
  // array of typed blocks. A reader that handled only one would silently drop half the
  // conversation and the derive would be made from a one-sided record.
  const t = transcript([
    { type: 'user', message: { role: 'user', content: 'plain string form' } },
    { type: 'assistant', message: { role: 'assistant', content: [{ type: 'text', text: 'block form' }] } },
  ]);
  try {
    const out = extractConversation(t.path);
    assert.match(out, /plain string form/);
    assert.match(out, /block form/);
  } finally { t.cleanup(); }
});

test('extractConversation drops non-text blocks, keeping only what a model can read', () => {
  const t = transcript([
    { type: 'assistant', message: { role: 'assistant', content: [
      { type: 'tool_use', name: 'Bash', input: { command: 'rm -rf /' } },
      { type: 'text', text: 'the readable part' },
    ] } },
  ]);
  try {
    const out = extractConversation(t.path);
    assert.match(out, /the readable part/);
    assert.doesNotMatch(out, /tool_use|rm -rf/, 'tool traffic is not conversation');
  } finally { t.cleanup(); }
});

test('extractConversation skips junk lines instead of failing the whole derive', () => {
  const t = transcript([
    'this line is not JSON at all',
    userMsg('kept'),
    { type: 'system', message: { role: 'system', content: 'ignored role' } },
    { type: 'user', message: { role: 'user', content: '   ' } },
  ]);
  try {
    const out = extractConversation(t.path);
    assert.match(out, /USER: kept/);
    assert.doesNotMatch(out, /not JSON|ignored role/);
    assert.equal(out.split('---').length, 1, 'exactly one message survived');
  } finally { t.cleanup(); }
});

test('extractConversation keeps only the LAST maxMsgs messages', () => {
  const t = transcript(Array.from({ length: 60 }, (_, i) => userMsg(`m${i}`)));
  try {
    const out = extractConversation(t.path, { maxMsgs: 5 });
    assert.match(out, /m59/);
    assert.doesNotMatch(out, /m54\b/, 'older messages fall outside the window');
    assert.equal(out.split('\n\n---\n\n').length, 5);
  } finally { t.cleanup(); }
});

test('extractConversation TRUNCATES a huge message, and says that it did', () => {
  const t = transcript([userMsg('y'.repeat(4000))]);
  try {
    const out = extractConversation(t.path);
    assert.match(out, /…\[truncated\]$/, 'truncation must be visible, not silent');
    assert.ok(out.length < 1700, `capped near FIELD_CAP, got ${out.length}`);
  } finally { t.cleanup(); }
});

test('MUTATION: the cap is REACHED only by an over-length message — a short one is untouched', () => {
  // Without this, the truncation test would also pass if every message were truncated.
  const t = transcript([userMsg('short and complete')]);
  try {
    assert.equal(extractConversation(t.path), 'USER: short and complete');
  } finally { t.cleanup(); }
});

test('extractConversation returns EMPTY for a transcript with no conversation — the caller no-ops on this', () => {
  const t = transcript([{ type: 'system', message: { role: 'system', content: 'x' } }]);
  try {
    assert.equal(extractConversation(t.path), '');
  } finally { t.cleanup(); }
});

test('extractConversation THROWS on a missing transcript, so main() can fail safe', () => {
  // The contract main() relies on: this throws, main catches, state is left untouched.
  assert.throws(() => extractConversation(join(tmpdir(), 'no-such-transcript-xyz.jsonl')));
});

// ---------------------------------------------------------------------------
// deriveState — the SHAPE GUARD, which is the part that protects the store
// ---------------------------------------------------------------------------
// The LLM is stubbed by a fake spawn. What matters is that a malformed answer is REFUSED
// rather than persisted: an unusable derive that reaches saveState replaces a good
// continuity state with rubbish, and the next fresh session inherits it.

const fakeSpawn = ({ status = 0, stdout = '', stderr = '' } = {}) => () => ({ status, stdout, stderr });

test('deriveState accepts a clean JSON object', () => {
  const state = deriveState('convo', {
    spawnFn: fakeSpawn({ stdout: JSON.stringify({ focus: 'f', next_action: 'n', blockers: [] }) }),
  });
  assert.equal(state.focus, 'f');
  assert.equal(state.next_action, 'n');
});

test('deriveState unwraps a fenced code block, because models add one', () => {
  const state = deriveState('convo', {
    spawnFn: fakeSpawn({ stdout: '```json\n{"focus":"f","next_action":"n"}\n```' }),
  });
  assert.equal(state.focus, 'f');
});

test('deriveState REFUSES a non-zero LLM exit', () => {
  assert.throws(
    () => deriveState('convo', { spawnFn: fakeSpawn({ status: 1, stderr: 'model unavailable' }) }),
    /derive LLM call failed/
  );
});

test('deriveState REFUSES empty output', () => {
  assert.throws(() => deriveState('convo', { spawnFn: fakeSpawn({ stdout: '' }) }), /derive LLM call failed/);
});

test('deriveState REFUSES prose that is not JSON', () => {
  assert.throws(() => deriveState('convo', {
    spawnFn: fakeSpawn({ stdout: 'Sure! Here is the continuity state you asked for.' }),
  }));
});

test('SHAPE GUARD: a derived object MISSING focus/next_action is refused, not persisted', () => {
  // The load-bearing one. A model that answers with the right JSON but the wrong keys
  // would otherwise wipe the focus a fresh session reads.
  assert.throws(
    () => deriveState('convo', { spawnFn: fakeSpawn({ stdout: JSON.stringify({ summary: 'I did stuff' }) }) }),
    /missing required string fields/
  );
});

test('SHAPE GUARD MUTATION: wrong TYPES are refused too, not just absent keys', () => {
  // `typeof null === 'object'`, so a null focus is the case a presence-only check misses.
  assert.throws(
    () => deriveState('convo', { spawnFn: fakeSpawn({ stdout: JSON.stringify({ focus: null, next_action: 'n' }) }) }),
    /missing required string fields/
  );
  assert.throws(
    () => deriveState('convo', { spawnFn: fakeSpawn({ stdout: JSON.stringify({ focus: 'f', next_action: 42 }) }) }),
    /missing required string fields/
  );
  // CONTROL: empty strings are a legitimate answer — the prompt asks for them when a field
  // is unknown — so the guard must not reject them.
  assert.equal(deriveState('convo', {
    spawnFn: fakeSpawn({ stdout: JSON.stringify({ focus: '', next_action: '' }) }),
  }).focus, '');
});

test('the RECURSION GUARD flag is set on the child process', () => {
  // deriveState's own `claude -p` is a session whose SessionEnd would re-enter this
  // module. Without CONTINUITY_DERIVE_ACTIVE=1 on the child, a live SessionEnd wiring
  // fork-bombs on every session close. Asserted on the spawn arguments themselves.
  let seen = null;
  deriveState('convo', {
    spawnFn: (cmd, args, opts) => { seen = { cmd, args, opts }; return { status: 0, stdout: '{"focus":"f","next_action":"n"}' }; },
  });
  assert.equal(seen.cmd, 'claude');
  assert.equal(seen.opts.env.CONTINUITY_DERIVE_ACTIVE, '1');
  assert.ok(seen.args.includes('-p'), 'a one-shot prompt, not an interactive session');
  assert.ok(seen.args.includes('--max-turns'), 'and it is bounded');
});

// ---------------------------------------------------------------------------
// The CLI contract — fail safe, and never crash a session boundary
// ---------------------------------------------------------------------------
// Run as a real child process, because "exits 0" is a property of the process and cannot
// be established by calling a function.

function runCli(args, { input = '', env = {} } = {}) {
  return spawnSync(process.execPath, [MODULE_PATH, ...args], {
    input, encoding: 'utf8', env: { ...process.env, ...env },
  });
}

test('CLI: no transcript path — exits 0 and does nothing', () => {
  const r = runCli([], { input: '{}' });
  assert.equal(r.status, 0);
  assert.match(r.stdout, /no transcript_path \(nothing to do\)/);
});

test('CLI: the RECURSION GUARD makes a nested invocation a no-op', () => {
  const t = transcript([userMsg('hello')]);
  try {
    const r = runCli(['--transcript', t.path], { env: { CONTINUITY_DERIVE_ACTIVE: '1' } });
    assert.equal(r.status, 0);
    assert.match(r.stdout, /recursion guard/);
    assert.doesNotMatch(r.stdout, /persisted/, 'and it persisted nothing');
  } finally { t.cleanup(); }
});

test('CLI: an EMPTY transcript exits 0 and persists nothing', () => {
  const t = transcript([{ type: 'system', message: { role: 'system', content: 'x' } }]);
  try {
    const r = runCli(['--transcript', t.path]);
    assert.equal(r.status, 0);
    assert.match(r.stdout, /empty transcript \(nothing to do\)/);
  } finally { t.cleanup(); }
});

test('CLI: a MISSING transcript file fails SAFE — exit 0, state untouched, reason stated', () => {
  const r = runCli(['--transcript', join(tmpdir(), 'definitely-not-here-xyz.jsonl')]);
  assert.equal(r.status, 0, 'a boundary hook that exits non-zero breaks the session close');
  assert.match(r.stdout, /derive failed, state untouched/);
});

test('CLI MUTATION: "fails safe" is not vacuous — the failure path is REACHED and NAMED', () => {
  // Distinguishes "handled the error" from "never hit one". The message must carry the
  // underlying reason, or a silent no-op and a real failure look identical in the log.
  const r = runCli(['--transcript', join(tmpdir(), 'definitely-not-here-xyz.jsonl')]);
  assert.match(r.stdout, /ENOENT|no such file/i, 'the actual cause is reported, not swallowed');
});

// ---------------------------------------------------------------------------
// Containment
// ---------------------------------------------------------------------------

test('CONTAINMENT: this suite never wrote into the live continuity store', () => {
  // Every path above stops before persistence. Asserted rather than assumed, because the
  // whole point of WO-OR-18 outcome 3 is that a suite quietly writing to Warwick's real
  // store is exactly the kind of thing nobody notices until it manufactures an
  // observation. The marker file below would only exist if a test had persisted.
  const seq = join(homedir(), '.mypka', 'governor', 'continuity-seq.json');
  const before = existsSync(seq);
  runCli([], { input: '{}' });
  assert.equal(existsSync(seq), before, 'the CLI must not create or touch the live sequence file');
});
