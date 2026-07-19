import { test } from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';

import {
  createFableAdapter, sanitizeFableEnv, resolveFableBin, buildFableArgv, parseFableJson,
  FABLE_ENV_DENYLIST, FABLE_MODEL_ID,
} from '../src/fableAdapter.js';
import { CODEX_ENV_DENYLIST } from '../src/codexAdapter.js';
import { verifyEnvelope } from '../src/envelope.js';
import { fakeSpawn, fableCliJson } from '../test-helpers/fakes.js';

test('FABLE_ENV_DENYLIST IS the codex denylist (same secrets stripped, incl. the fable HMAC)', () => {
  assert.equal(FABLE_ENV_DENYLIST, CODEX_ENV_DENYLIST, 'reuses the SAME denylist, not a weaker fork');
  assert.ok(CODEX_ENV_DENYLIST.includes('TOWER_HMAC_SECRET_CLAUDE_FABLE'), 'Fable never sees its OWN signing secret');
});

test('sanitizeFableEnv -- strips every Telegram/ClickUp/DB/HMAC secret from the child env', () => {
  const parent = { PATH: '/x', TELEGRAM_BOT_TOKEN: '123:SECRET', CLICKUP_TOKEN: 'pk_secret', DATABASE_URL: 'postgres://u:p@h/db', TOWER_HMAC_SECRET_CLAUDE_FABLE: 'hmac', ANTHROPIC_API_KEY: 'sk-keep', HARMLESS: 'ok' };
  const child = sanitizeFableEnv(parent);
  for (const name of FABLE_ENV_DENYLIST) assert.equal(child[name], undefined, `${name} must be stripped`);
  assert.equal(child.PATH, '/x');
  assert.equal(child.HARMLESS, 'ok');
  assert.equal(child.ANTHROPIC_API_KEY, 'sk-keep', 'the auth key is NOT stripped -- Fable authenticates with it');
});

test('buildFableArgv -- read-only, tool-less, model claude-fable-5, stdin marker last', () => {
  const argv = buildFableArgv({ systemPrompt: 'SP' });
  assert.deepEqual(argv, ['-p', '--model', 'claude-fable-5', '--output-format', 'json', '--allowedTools', '', '--system-prompt', 'SP', '-']);
  assert.equal(FABLE_MODEL_ID, 'claude-fable-5');
  // '-' (stdin) must be LAST so the variadic --allowedTools cannot swallow it.
  assert.equal(argv[argv.length - 1], '-');
  // --allowedTools is immediately followed by a flag boundary, so the empty tool-list is its only value.
  const i = argv.indexOf('--allowedTools');
  assert.equal(argv[i + 1], '');
  assert.equal(argv[i + 2], '--system-prompt');
});

test('resolveFableBin -- FABLE_BIN override wins, then local-bin, then PATH', () => {
  const fs = { existsSync: (p) => String(p).includes('claude'), statSync: () => ({ isFile: () => true }) };
  const over = resolveFableBin({ env: { FABLE_BIN: 'C:/x/claude.exe' }, fs });
  assert.equal(over.path, 'C:/x/claude.exe');
  assert.equal(over.source, 'env:FABLE_BIN');

  // No override -> the known local-bin install under the home dir.
  const local = resolveFableBin({ env: {}, fs, homeDir: 'C:/Users/Bug', binName: 'claude.exe' });
  assert.match(local.path, /\.local[\\/]bin[\\/]claude\.exe$/);
  assert.equal(local.source, 'local-bin');

  // Nothing resolvable -> a clear, non-throwing error (fail-closed handled by runTurn).
  const none = resolveFableBin({ env: {}, fs: { existsSync: () => false, statSync: () => ({ isFile: () => false }) }, homeDir: 'C:/Users/Bug' });
  assert.equal(none.path, null);
  assert.match(none.error, /no claude binary/);
});

test('parseFableJson -- extracts the reviewer JSON from the CLI .result (bare and prose-wrapped)', () => {
  const verdict = { verdict: 'approve', summary: 'ok', claims_verified: [], findings: [], proposed_action: { type: 'noop', target: '' } };
  const bare = parseFableJson(fableCliJson(verdict));
  assert.equal(bare.ok, true);
  assert.equal(bare.result.verdict, 'approve');
  const wrapped = parseFableJson(fableCliJson(verdict, { wrap: true }));
  assert.equal(wrapped.ok, true, 'JSON is extracted even when wrapped in prose');
  assert.equal(wrapped.result.summary, 'ok');
  // A CLI error result fails closed.
  const errored = parseFableJson(JSON.stringify({ type: 'result', subtype: 'error_max_turns', is_error: true, result: '' }));
  assert.equal(errored.ok, false);
});

test('Fable child process env carries NO Telegram/ClickUp secret + argv selects claude-fable-5 (spawn-level)', async () => {
  const saved = { t: process.env.TELEGRAM_BOT_TOKEN, c: process.env.CLICKUP_TOKEN };
  process.env.TELEGRAM_BOT_TOKEN = '123:LEAKME';
  process.env.CLICKUP_TOKEN = 'pk_LEAKME';
  try {
    const captured = {};
    const result = { verdict: 'approve', summary: 'cold-final ok', claims_verified: [], findings: [], proposed_action: { type: 'noop', target: '' } };
    const fable = createFableAdapter({
      config: { signingSecret: () => null },
      spawn: fakeSpawn({ captured, stdout: fableCliJson(result), code: 0 }),
      resolveBin: () => ({ path: 'C:/fake/claude.exe', source: 'test', error: null }),
      authProbe: () => ({ authenticated: true, method: 'oauth-credentials' }),
    });
    const turn = await fable.runTurn({ checkpoint: { checkpoint_id: 'cp-1', head_sha: 'abc' }, packet: { head_sha: 'abc' }, skillText: 'skill', promptFingerprint: 'fp' });
    assert.equal(turn.ok, true);
    assert.equal(turn.signerPrincipal, 'claude_fable');
    assert.equal(captured.env.TELEGRAM_BOT_TOKEN, undefined, 'Fable child env has no Telegram token');
    assert.equal(captured.env.CLICKUP_TOKEN, undefined, 'Fable child env has no ClickUp token');
    const iModel = captured.argv.indexOf('--model');
    assert.equal(captured.argv[iModel + 1], 'claude-fable-5', 'the child is invoked with --model claude-fable-5');
    assert.ok(captured.argv.includes('--output-format') && captured.argv.includes('json'));
    assert.equal(captured.argv[captured.argv.length - 1], '-', 'reads the prompt from stdin');
  } finally {
    process.env.TELEGRAM_BOT_TOKEN = saved.t; process.env.CLICKUP_TOKEN = saved.c;
    if (saved.t === undefined) delete process.env.TELEGRAM_BOT_TOKEN;
    if (saved.c === undefined) delete process.env.CLICKUP_TOKEN;
  }
});

test('Fable well-formed verdict -> SIGNED ok verdict as claude_fable / anthropic / claude-fable-5', async () => {
  const SECRET = 'fable-hmac-test-secret';
  const result = { verdict: 'request_changes', summary: 'found a regression Codex missed', claims_verified: [], findings: [{ id: 'F1', severity: 'high', evidence: 'x:1', rationale: 'edge', required_correction: 'guard it' }], proposed_action: { type: 'post_review', target: 'pr' } };
  const fable = createFableAdapter({
    config: { signingSecret: (p) => (p === 'claude_fable' ? SECRET : null) },
    spawn: fakeSpawn({ stdout: fableCliJson(result), code: 0 }),
    resolveBin: () => ({ path: 'C:/fake/claude.exe', source: 'test', error: null }),
    authProbe: () => ({ authenticated: true, method: 'oauth-credentials' }),
  });
  const turn = await fable.runTurn({ checkpoint: { checkpoint_id: 'cp-1', head_sha: 'abc' }, packet: { head_sha: 'abc' }, skillText: 's', promptFingerprint: 'fp' });
  assert.equal(turn.ok, true);
  assert.equal(turn.structuredResult.verdict, 'request_changes');
  assert.equal(turn.envelope.agent, 'claude_fable');
  assert.equal(turn.envelope.provider, 'anthropic');
  assert.equal(turn.envelope.model_id, 'claude-fable-5');
  assert.ok(verifyEnvelope(turn.envelope, turn.signature, SECRET), 'the verdict is HMAC-signed under the claude_fable secret');
});

test('Fable fail-closed -- no credential -> signed blocked verdict (claude_fable)', async () => {
  const fable = createFableAdapter({
    config: { signingSecret: () => null },
    resolveBin: () => ({ path: 'C:/fake/claude.exe', source: 'test', error: null }),
    authProbe: () => ({ authenticated: false, method: 'none' }),
  });
  const turn = await fable.runTurn({ checkpoint: { checkpoint_id: 'cp-1' }, packet: {}, skillText: 's', promptFingerprint: 'fp' });
  assert.equal(turn.blocked, true);
  assert.equal(turn.kind, 'no_credential');
  assert.equal(turn.signerPrincipal, 'claude_fable');
});

test('Fable fail-closed -- no binary -> signed blocked verdict', async () => {
  const fable = createFableAdapter({
    config: { signingSecret: () => null },
    resolveBin: () => ({ path: null, source: 'discovery', error: 'no claude binary' }),
    authProbe: () => ({ authenticated: true, method: 'oauth-credentials' }),
  });
  const turn = await fable.runTurn({ checkpoint: { checkpoint_id: 'cp-1' }, packet: {}, skillText: 's', promptFingerprint: 'fp' });
  assert.equal(turn.blocked, true);
  assert.equal(turn.kind, 'no_binary');
});

test('Fable malformed output -> signed blocked verdict', async () => {
  const fable = createFableAdapter({
    config: { signingSecret: () => null },
    spawn: fakeSpawn({ stdout: JSON.stringify({ type: 'result', subtype: 'success', is_error: false, result: 'no json here, just prose' }), code: 0 }),
    resolveBin: () => ({ path: 'C:/fake/claude.exe', source: 'test', error: null }),
    authProbe: () => ({ authenticated: true, method: 'oauth-credentials' }),
  });
  const turn = await fable.runTurn({ checkpoint: { checkpoint_id: 'cp-1' }, packet: {}, skillText: 's', promptFingerprint: 'fp' });
  assert.equal(turn.blocked, true);
  assert.equal(turn.kind, 'malformed_output');
});

test('Fable timeout -- AWAITS the SAME process-tree kill (taskkill /PID /T /F) and returns the timed_out blocker', async () => {
  const events = [];
  let leaderChild = null;
  let taskkillClosed = false;
  const spawn = (bin, argv, opts) => {
    const child = new EventEmitter();
    child.stdout = new EventEmitter();
    child.stderr = new EventEmitter();
    child.stdin = { write() {}, end() {} };
    child.pid = 5150;
    child.unref = () => {};
    if (bin === 'taskkill') {
      child.kill = () => {};
      events.push({ ev: 'taskkill-spawn', argv, opts });
      setTimeout(() => { taskkillClosed = true; events.push({ ev: 'taskkill-close' }); child.emit('close', 0); }, 5);
    } else {
      leaderChild = child; // the claude LEADER never closes -- forces the timeout
      child.kill = () => { child.__killed = true; events.push({ ev: 'leader-kill' }); };
    }
    return child;
  };
  const fable = createFableAdapter({
    config: { signingSecret: () => null },
    spawn,
    resolveBin: () => ({ path: 'C:/fake/claude.exe', source: 'test', error: null }),
    authProbe: () => ({ authenticated: true, method: 'oauth-credentials' }),
    timeoutMs: 20,
    platform: 'win32',
  });
  const turn = await fable.runTurn({ checkpoint: { checkpoint_id: 'cp-1', head_sha: 'abc' }, packet: { head_sha: 'abc' }, skillText: 's', promptFingerprint: 'fp' });
  assert.equal(turn.blocked, true, 'a timed-out fable turn is a signed blocker, never a hang');
  assert.equal(turn.kind, 'timed_out');
  const kill = events.find((e) => e.ev === 'taskkill-spawn');
  assert.ok(kill, 'the SAME killProcessTree spawned taskkill to reap the whole tree');
  assert.deepEqual(kill.argv, ['/PID', '5150', '/T', '/F']);
  assert.equal(taskkillClosed, true, 'runTurn AWAITED the tree reap before resolving');
  assert.notEqual(leaderChild?.__killed, true, 'the leader was not pre-killed -- taskkill reaped the tree incl. leader');
});
