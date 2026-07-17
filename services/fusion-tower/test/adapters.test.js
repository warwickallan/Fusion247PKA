import { test } from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { loadConfig } from '../src/config.js';
import { createLarryAdapter, LARRY_ALLOWED_TOOLS, buildLarryPrompt } from '../src/adapters/larryAdapter.js';
import { createCodexAdapter, CODEX_EXEC_FLAGS, buildCodexPrompt } from '../src/adapters/codexAdapter.js';
import { verifyEnvelope } from '../src/core/envelope.js';

// A fake spawn: scripts stdout/stderr/exit per invoked argv. `plan(argv)` returns
// { stdout, stderr, code } or throws to simulate a missing binary.
function fakeSpawn(plan) {
  return function spawn(bin, argv) {
    const child = new EventEmitter();
    child.stdout = new EventEmitter();
    child.stderr = new EventEmitter();
    const chunks = [];
    child.stdin = { write: (d) => chunks.push(d), end: () => {} };
    child.kill = () => {};
    let outcome;
    try { outcome = plan(argv, bin); }
    catch (e) { setImmediate(() => child.emit('error', e)); return child; }
    setImmediate(() => {
      if (outcome.stdout) child.stdout.emit('data', Buffer.from(outcome.stdout));
      if (outcome.stderr) child.stderr.emit('data', Buffer.from(outcome.stderr));
      child.emit('close', outcome.code ?? 0);
    });
    return child;
  };
}

const RUN = { run_id: 'r1', scope: 'docs typo', evidence_commit_sha: 'abc123' };
const TURN = { ordinal: 1, bounded_context_ref: { task: 'review the doc' } };

test('LARRY allow-list contains NO merge/push/force tool', () => {
  for (const t of LARRY_ALLOWED_TOOLS) {
    assert.ok(!/merge|push|force/i.test(t), `tool "${t}" must not be a merge/push tool`);
  }
});

test('larry prompt is bounded and forbids merge', () => {
  const p = buildLarryPrompt({ run: RUN, boundedContext: TURN.bounded_context_ref });
  assert.match(p, /NEVER merge/);
});

test('larry adapter: fail-closed blocker when claude not invocable (spawn error)', async () => {
  const config = loadConfig({ TOWER_HMAC_SECRET_LARRY: 'x'.repeat(40) });
  const spawn = fakeSpawn(() => { throw new Error('ENOENT claude'); });
  const adapter = createLarryAdapter({ config, spawn });
  const r = await adapter.runTurn({ run: RUN, turn: TURN, boundedContext: TURN.bounded_context_ref });
  assert.equal(r.blocked, true);
  assert.equal(r.signerPrincipal, 'larry');
  assert.match(r.structuredResult.blocker, /not invocable/);
  // The blocker is signed with the honest larry label.
  assert.equal(verifyEnvelope(r.envelope, r.signature, 'x'.repeat(40)), true);
});

test('larry adapter: live path parses claude JSON and signs an honest envelope', async () => {
  const config = loadConfig({ TOWER_HMAC_SECRET_LARRY: 'y'.repeat(40) });
  const spawn = fakeSpawn((argv) => {
    if (argv.includes('--version')) return { stdout: '2.1.0 (Claude Code)', code: 0 };
    // -p run: return the claude --output-format json envelope.
    return { stdout: JSON.stringify({ result: '{"summary":"looks good","proposed_action":{"type":"post_comment"},"confidence":0.9}', session_id: 's1', usage: { output_tokens: 12 } }), code: 0 };
  });
  const adapter = createLarryAdapter({ config, spawn, mode: 'auto' });
  const r = await adapter.runTurn({ run: RUN, turn: TURN, boundedContext: TURN.bounded_context_ref });
  assert.equal(r.ok, true);
  assert.equal(r.structuredResult.proposed_action.type, 'post_comment');
  assert.equal(r.tokensUsed, 12);
  assert.equal(r.envelope.agent, 'larry');
  assert.equal(r.envelope.provider, 'anthropic-claude-code');
  assert.equal(verifyEnvelope(r.envelope, r.signature, 'y'.repeat(40)), true);
});

test('larry adapter: record-blocker mode never spawns', async () => {
  const config = loadConfig({});
  let spawned = false;
  const spawn = fakeSpawn(() => { spawned = true; return { code: 0 }; });
  const adapter = createLarryAdapter({ config, spawn, mode: 'record-blocker' });
  const r = await adapter.runTurn({ run: RUN, turn: TURN });
  assert.equal(r.blocked, true);
  assert.equal(spawned, false);
});

test('CODEX exec flags: read-only, approval-never, from stdin', () => {
  assert.deepEqual(CODEX_EXEC_FLAGS.slice(0, 5), ['exec', '--sandbox', 'read-only', '--ask-for-approval', 'never']);
  assert.ok(CODEX_EXEC_FLAGS.includes('-'), 'prompt from stdin');
  assert.match(buildCodexPrompt({ run: RUN, boundedContext: {} }), /read-only/);
});

test('codex adapter: fail-closed blocker with NO api key (no spend, honest gpt_codex label)', async () => {
  const config = loadConfig({ TOWER_HMAC_SECRET_GPT_CODEX: 'z'.repeat(40) });
  let spawned = false;
  const spawn = fakeSpawn(() => { spawned = true; return { code: 0 }; });
  const adapter = createCodexAdapter({ config, spawn, mode: 'auto' });
  const r = await adapter.runTurn({ run: RUN, turn: TURN });
  assert.equal(r.blocked, true);
  assert.equal(spawned, false, 'must not spawn/spend without a credential');
  assert.match(r.structuredResult.blocker, /no codex credential/);
  assert.equal(r.envelope.provider, 'openai-codex'); // honest, never xai-grok
  assert.equal(verifyEnvelope(r.envelope, r.signature, 'z'.repeat(40)), true);
});

test('codex adapter: fail-closed blocker when binary absent even WITH key', async () => {
  const config = loadConfig({ CODEX_API_KEY: 'sk-test', TOWER_HMAC_SECRET_GPT_CODEX: 'z'.repeat(40) });
  const spawn = fakeSpawn((argv) => { if (argv.includes('--version')) throw new Error('ENOENT codex'); return { code: 0 }; });
  const adapter = createCodexAdapter({ config, spawn, mode: 'auto' });
  const r = await adapter.runTurn({ run: RUN, turn: TURN });
  assert.equal(r.blocked, true);
  assert.match(r.structuredResult.blocker, /no codex binary/);
});
