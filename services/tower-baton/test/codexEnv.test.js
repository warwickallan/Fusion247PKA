import { test } from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';

import { createCodexAdapter, sanitizeCodexEnv, CODEX_ENV_DENYLIST, killProcessTree } from '../src/codexAdapter.js';
import { fakeSpawn, fakeFsForSchema, codexJsonl } from '../test-helpers/fakes.js';

test('sanitizeCodexEnv — strips every Telegram/ClickUp/DB secret from the child env', () => {
  const parent = { PATH: '/x', TELEGRAM_BOT_TOKEN: '123:SECRET', CLICKUP_TOKEN: 'pk_secret', AUTHORISED_TELEGRAM_USER_ID: '42', DATABASE_URL: 'postgres://u:p@h/db', HARMLESS: 'ok' };
  const child = sanitizeCodexEnv(parent);
  for (const name of CODEX_ENV_DENYLIST) assert.equal(child[name], undefined, `${name} must be stripped`);
  assert.equal(child.PATH, '/x');
  assert.equal(child.HARMLESS, 'ok');
});

test('Codex child process env contains NO Telegram/ClickUp secret (spawn-level)', async () => {
  // Seed the PARENT process env with the very secrets Codex must never see.
  const saved = { t: process.env.TELEGRAM_BOT_TOKEN, c: process.env.CLICKUP_TOKEN, a: process.env.AUTHORISED_TELEGRAM_USER_ID };
  process.env.TELEGRAM_BOT_TOKEN = '123:LEAKME';
  process.env.CLICKUP_TOKEN = 'pk_LEAKME';
  process.env.AUTHORISED_TELEGRAM_USER_ID = '42';
  try {
    const captured = {};
    const result = { verdict: 'approve', summary: 'ok', claims_verified: [], findings: [], proposed_action: { type: 'noop', target: '' } };
    const codex = createCodexAdapter({
      config: { signingSecret: () => null },
      spawn: fakeSpawn({ captured, stdout: codexJsonl(result), code: 0 }),
      resolveBin: () => ({ path: 'C:/fake/codex.exe', source: 'test', error: null }),
      authProbe: () => ({ authenticated: true, method: 'chatgpt-oauth' }),
      fs: fakeFsForSchema(),
    });
    const turn = await codex.runTurn({ checkpoint: { checkpoint_id: 'cp-1', head_sha: 'abc' }, packet: { head_sha: 'abc' }, skillText: 'skill', promptFingerprint: 'fp' });
    assert.equal(turn.ok, true);
    // The captured child env must NOT carry the secrets, even though the parent did.
    assert.equal(captured.env.TELEGRAM_BOT_TOKEN, undefined);
    assert.equal(captured.env.CLICKUP_TOKEN, undefined);
    assert.equal(captured.env.AUTHORISED_TELEGRAM_USER_ID, undefined);
  } finally {
    process.env.TELEGRAM_BOT_TOKEN = saved.t; process.env.CLICKUP_TOKEN = saved.c; process.env.AUTHORISED_TELEGRAM_USER_ID = saved.a;
    if (saved.t === undefined) delete process.env.TELEGRAM_BOT_TOKEN;
    if (saved.c === undefined) delete process.env.CLICKUP_TOKEN;
    if (saved.a === undefined) delete process.env.AUTHORISED_TELEGRAM_USER_ID;
  }
});

test('runTurn timeout -- reaps the codex process TREE (win32 taskkill /PID <pid> /T /F) and returns the timed_out blocker', async () => {
  // WP1 defect fix: a bare child.kill() leaves codex.exe children as orphans on Windows
  // and wedges the poll loop. Prove the timeout path spawns taskkill /T /F on the child
  // pid, and that runTurn still resolves with the `timed_out` blocker (never hangs).
  const spawnCalls = [];
  const spawn = (bin, argv, opts) => {
    spawnCalls.push({ bin, argv, opts });
    const child = new EventEmitter();
    child.stdout = new EventEmitter();
    child.stderr = new EventEmitter();
    child.stdin = { write() {}, end() {} };
    child.pid = 4242;
    child.kill = () => { child.__killed = true; };
    child.unref = () => {};
    // codex child: NEVER closes (forces the timeout). taskkill child: closes at once.
    if (bin === 'taskkill') setImmediate(() => child.emit('close', 0));
    return child;
  };
  const codex = createCodexAdapter({
    config: { signingSecret: () => null },
    spawn,
    resolveBin: () => ({ path: 'C:/fake/codex.exe', source: 'test', error: null }),
    authProbe: () => ({ authenticated: true, method: 'chatgpt-oauth' }),
    fs: fakeFsForSchema(),
    timeoutMs: 20,      // tiny -- force the timeout branch fast
    platform: 'win32',  // exercise the taskkill branch deterministically
  });
  const turn = await codex.runTurn({ checkpoint: { checkpoint_id: 'cp-1', head_sha: 'abc' }, packet: { head_sha: 'abc' }, skillText: 'skill', promptFingerprint: 'fp' });
  assert.equal(turn.blocked, true, 'a timed-out turn is a signed blocker, never a hang');
  assert.equal(turn.kind, 'timed_out');
  const kill = spawnCalls.find((c) => c.bin === 'taskkill');
  assert.ok(kill, 'taskkill was spawned to reap the whole process tree');
  assert.deepEqual(kill.argv, ['/PID', '4242', '/T', '/F'], 'taskkill /PID <childpid> /T /F (force whole tree)');
  assert.equal(kill.opts?.detached, true, 'the killer is detached so it cannot block the loop');
});

test('killProcessTree -- POSIX kills the process GROUP (process.kill(-pid, SIGKILL)), never spawns taskkill', () => {
  const killed = [];
  const savedKill = process.kill;
  process.kill = (pid, sig) => { killed.push({ pid, sig }); };
  try {
    killProcessTree({
      child: { pid: 999, kill() { killed.push({ pid: 'child-handle', sig: 'fallback' }); } },
      spawn: () => { throw new Error('spawn (taskkill) must NOT be used on posix'); },
      platform: 'linux',
    });
  } finally {
    process.kill = savedKill;
  }
  assert.ok(killed.some((k) => k.pid === -999 && k.sig === 'SIGKILL'), 'kills the NEGATIVE pid -- the whole process group');
});

test('Codex adapter fail-closed — no credential → signed blocked verdict', async () => {
  const codex = createCodexAdapter({
    config: { signingSecret: () => null },
    resolveBin: () => ({ path: 'C:/fake/codex.exe', source: 'test', error: null }),
    authProbe: () => ({ authenticated: false, method: 'none' }),
    fs: fakeFsForSchema(),
  });
  const turn = await codex.runTurn({ checkpoint: { checkpoint_id: 'cp-1' }, packet: {}, skillText: 's', promptFingerprint: 'fp' });
  assert.equal(turn.blocked, true);
  assert.equal(turn.kind, 'no_credential');
});
