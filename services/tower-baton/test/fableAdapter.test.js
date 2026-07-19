import { test } from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';

import os from 'node:os';
import {
  createFableAdapter, sanitizeFableEnv, resolveFableBin, buildFableArgv, parseFableJson,
  FABLE_ENV_DENYLIST, FABLE_MODEL_ID, FABLE_TOOL_DENYLIST, FABLE_CROSS_REVIEWER_KEYS, wireFable,
} from '../src/fableAdapter.js';
import { CODEX_ENV_DENYLIST } from '../src/codexAdapter.js';
import { verifyEnvelope } from '../src/envelope.js';
import { fakeSpawn, fableCliJson } from '../test-helpers/fakes.js';

test('FABLE_ENV_DENYLIST IS the codex denylist (same secrets stripped, incl. the fable HMAC)', () => {
  assert.equal(FABLE_ENV_DENYLIST, CODEX_ENV_DENYLIST, 'reuses the SAME denylist, not a weaker fork');
  assert.ok(CODEX_ENV_DENYLIST.includes('TOWER_HMAC_SECRET_CLAUDE_FABLE'), 'Fable never sees its OWN signing secret');
});

test('sanitizeFableEnv -- strips Telegram/ClickUp/DB/HMAC secrets + the OTHER reviewer creds; keeps Fable auth', () => {
  const parent = { PATH: '/x', TELEGRAM_BOT_TOKEN: '123:SECRET', CLICKUP_TOKEN: 'pk_secret', DATABASE_URL: 'postgres://u:p@h/db', TOWER_HMAC_SECRET_CLAUDE_FABLE: 'hmac', ANTHROPIC_API_KEY: 'sk-keep', OPENAI_API_KEY: 'sk-codex', CODEX_API_KEY: 'codex-key', HARMLESS: 'ok' };
  const child = sanitizeFableEnv(parent);
  for (const name of FABLE_ENV_DENYLIST) assert.equal(child[name], undefined, `${name} must be stripped`);
  // LOW I: the OTHER reviewer's (Codex/OpenAI) creds are stripped from the Fable child.
  for (const name of FABLE_CROSS_REVIEWER_KEYS) assert.equal(child[name], undefined, `${name} (Codex cred) must be stripped from the Fable child`);
  assert.deepEqual([...FABLE_CROSS_REVIEWER_KEYS], ['OPENAI_API_KEY', 'CODEX_API_KEY']);
  assert.equal(child.PATH, '/x');
  assert.equal(child.HARMLESS, 'ok');
  assert.equal(child.ANTHROPIC_API_KEY, 'sk-keep', 'the auth key is NOT stripped -- Fable authenticates with it');
});

test('buildFableArgv -- GENUINELY tool-less via --tools "" (availability), + belt-and-braces allow/deny lists', () => {
  const argv = buildFableArgv({ systemPrompt: 'SP' });
  assert.equal(FABLE_MODEL_ID, 'claude-fable-5');
  // CRITICAL A: --tools "" is the AVAILABILITY flag that actually disables all tools (per
  // `claude --help`: "Use \"\" to disable all tools"). --allowedTools "" alone is only a
  // permission pre-approval list and does NOT remove Read/Glob/Grep from the child.
  const iTools = argv.indexOf('--tools');
  assert.ok(iTools >= 0, '--tools is present (the real tool-lessness flag)');
  assert.equal(argv[iTools + 1], '', '--tools "" -> empty value disables all tools');
  // belt-and-braces: permission pre-approval empty + explicit per-tool denylist.
  const iAllowed = argv.indexOf('--allowedTools');
  assert.ok(iAllowed >= 0);
  assert.equal(argv[iAllowed + 1], '');
  const iDeny = argv.indexOf('--disallowedTools');
  assert.ok(iDeny >= 0, '--disallowedTools names the built-in tools explicitly');
  for (const t of ['Read', 'Glob', 'Grep', 'Bash', 'Edit', 'Write']) {
    assert.ok(argv.includes(t), `disallowedTools includes ${t}`);
  }
  assert.deepEqual(FABLE_TOOL_DENYLIST.slice(0, 3), ['Read', 'Write', 'Edit']);
  // --disallowedTools (variadic) is bounded by the following --system-prompt flag.
  assert.equal(argv[iDeny + 1 + FABLE_TOOL_DENYLIST.length], '--system-prompt');
  const iSys = argv.indexOf('--system-prompt');
  assert.equal(argv[iSys + 1], 'SP');
  // '-' (stdin) must be LAST so no variadic flag can swallow it.
  assert.equal(argv[argv.length - 1], '-');
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
    const NEUTRAL = os.tmpdir();
    const turn = await fable.runTurn({ checkpoint: { checkpoint_id: 'cp-1', head_sha: 'abc' }, packet: { head_sha: 'abc' }, skillText: 'skill', promptFingerprint: 'fp' });
    assert.equal(turn.ok, true);
    assert.equal(turn.signerPrincipal, 'claude_fable');
    assert.equal(captured.env.TELEGRAM_BOT_TOKEN, undefined, 'Fable child env has no Telegram token');
    assert.equal(captured.env.CLICKUP_TOKEN, undefined, 'Fable child env has no ClickUp token');
    const iModel = captured.argv.indexOf('--model');
    assert.equal(captured.argv[iModel + 1], 'claude-fable-5', 'the child is invoked with --model claude-fable-5');
    // CRITICAL A at spawn level: --tools "" (availability disable) reaches the real spawn.
    const iTools = captured.argv.indexOf('--tools');
    assert.ok(iTools >= 0 && captured.argv[iTools + 1] === '', 'the tool-less --tools "" flag reaches spawn');
    assert.ok(captured.argv.includes('--output-format') && captured.argv.includes('json'));
    assert.equal(captured.argv[captured.argv.length - 1], '-', 'reads the prompt from stdin');
    // J3: the NEUTRAL cwd (never the repo) reaches spawn so claude cannot auto-discover CLAUDE.md.
    assert.equal(captured.cwd, NEUTRAL, 'the neutral cwd (os.tmpdir) reaches spawn, not the repo');
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

test('MEDIUM H -- a CLI modelUsage that lacks claude-fable-5 fails closed (silent model substitution rejected)', async () => {
  // The reviewer JSON is well-formed, but the CLI reports it ran a DIFFERENT model. The
  // signer would otherwise stamp model_id=claude-fable-5 from the argv alone -- reject.
  const result = { verdict: 'approve', summary: 'ok', claims_verified: [], findings: [], proposed_action: { type: 'noop', target: '' } };
  const substituted = JSON.stringify({
    type: 'result', subtype: 'success', is_error: false, result: JSON.stringify(result),
    usage: { output_tokens: 5 }, modelUsage: { 'claude-3-5-sonnet': { outputTokens: 5 } }, // NOT claude-fable-5
  });
  const fable = createFableAdapter({
    config: { signingSecret: () => null },
    spawn: fakeSpawn({ stdout: substituted, code: 0 }),
    resolveBin: () => ({ path: 'C:/fake/claude.exe', source: 'test', error: null }),
    authProbe: () => ({ authenticated: true, method: 'oauth-credentials' }),
  });
  const turn = await fable.runTurn({ checkpoint: { checkpoint_id: 'cp-1', head_sha: 'abc' }, packet: { head_sha: 'abc' }, skillText: 's', promptFingerprint: 'fp' });
  assert.equal(turn.blocked, true, 'a substituted model is a signed blocker, not a signed approve');
  assert.equal(turn.kind, 'model_substituted');
});

test('MEDIUM H -- absent modelUsage does NOT block (older CLI shape cannot be confirmed, so not held against it)', async () => {
  const result = { verdict: 'approve', summary: 'ok', claims_verified: [], findings: [], proposed_action: { type: 'noop', target: '' } };
  const noUsage = JSON.stringify({ type: 'result', subtype: 'success', is_error: false, result: JSON.stringify(result) });
  const fable = createFableAdapter({
    config: { signingSecret: () => null },
    spawn: fakeSpawn({ stdout: noUsage, code: 0 }),
    resolveBin: () => ({ path: 'C:/fake/claude.exe', source: 'test', error: null }),
    authProbe: () => ({ authenticated: true, method: 'oauth-credentials' }),
  });
  const turn = await fable.runTurn({ checkpoint: { checkpoint_id: 'cp-1', head_sha: 'abc' }, packet: { head_sha: 'abc' }, skillText: 's', promptFingerprint: 'fp' });
  assert.equal(turn.ok, true, 'no modelUsage -> unconfirmable, not a substitution blocker');
});

test('MAJOR E -- wireFable: DISABLED yields NO fable (codex-only path)', async () => {
  let built = 0;
  const wired = await wireFable({ enabled: false, buildAdapter: () => { built += 1; return {}; } });
  assert.equal(wired.fable, null, 'disabled -> no fable adapter (byte-identical codex-only path)');
  assert.equal(wired.fatal, undefined);
  assert.equal(built, 0, 'the adapter is not even constructed when disabled');
});

test('MAJOR E -- wireFable: ENABLED + provisioned yields the adapter', async () => {
  const adapter = { async verifyInvocable() { return { invocable: true, authenticated: true }; } };
  const wired = await wireFable({ enabled: true, buildAdapter: () => adapter });
  assert.equal(wired.fable, adapter);
  assert.equal(wired.fatal, undefined);
});

test('MAJOR E -- wireFable: ENABLED but UNPROVISIONED fails LOUD (fatal), never silently null', async () => {
  const noBin = { async verifyInvocable() { return { invocable: false, authenticated: true, binError: 'no claude binary' }; } };
  const w1 = await wireFable({ enabled: true, buildAdapter: () => noBin });
  assert.equal(w1.fatal, true, 'enabled-but-no-binary is fatal at startup, not a silent BLOCK-everything flow');
  assert.equal(w1.fable, null);
  assert.match(w1.reason, /not provisioned/);

  const noAuth = { async verifyInvocable() { return { invocable: true, authenticated: false }; } };
  const w2 = await wireFable({ enabled: true, buildAdapter: () => noAuth });
  assert.equal(w2.fatal, true, 'enabled-but-no-auth is fatal at startup');
  assert.equal(w2.fable, null);
});
