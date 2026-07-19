import { test } from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';

import { createCodexAdapter, sanitizeCodexEnv, CODEX_ENV_DENYLIST, CODEX_CROSS_REVIEWER_KEYS, killProcessTree } from '../src/codexAdapter.js';
import { fakeSpawn, fakeFsForSchema, codexJsonl } from '../test-helpers/fakes.js';
import { EventEmitter as EE } from 'node:events';

test('sanitizeCodexEnv — strips Telegram/ClickUp/DB secrets + the OTHER reviewer (Anthropic) creds', () => {
  const parent = { PATH: '/x', TELEGRAM_BOT_TOKEN: '123:SECRET', CLICKUP_TOKEN: 'pk_secret', AUTHORISED_TELEGRAM_USER_ID: '42', DATABASE_URL: 'postgres://u:p@h/db', ANTHROPIC_API_KEY: 'sk-fable', CLAUDE_CODE_OAUTH_TOKEN: 'oauth-fable', HARMLESS: 'ok' };
  const child = sanitizeCodexEnv(parent);
  for (const name of CODEX_ENV_DENYLIST) assert.equal(child[name], undefined, `${name} must be stripped`);
  // LOW I: the OTHER reviewer's (Fable/Anthropic) creds are stripped from the Codex child.
  for (const name of CODEX_CROSS_REVIEWER_KEYS) assert.equal(child[name], undefined, `${name} (Fable cred) must be stripped from the Codex child`);
  assert.deepEqual([...CODEX_CROSS_REVIEWER_KEYS], ['ANTHROPIC_API_KEY', 'CLAUDE_CODE_OAUTH_TOKEN']);
  assert.equal(child.PATH, '/x');
  assert.equal(child.HARMLESS, 'ok');
});

test('sanitizeCodexEnv — the api-key route still injects Codex creds AFTER the cross-strip', () => {
  const child = sanitizeCodexEnv({ ANTHROPIC_API_KEY: 'sk-fable' }, 'codex-secret');
  assert.equal(child.ANTHROPIC_API_KEY, undefined, 'the other reviewer cred is still stripped');
  assert.equal(child.CODEX_API_KEY, 'codex-secret', 'the codex api key is re-added for the api-key route');
  assert.equal(child.OPENAI_API_KEY, 'codex-secret');
});

test('CRITICAL B -- taskkill FAILURE retries the tree-kill once, then leader-only fallback, and returns tree_reaped:false (UNCONFIRMED)', async () => {
  const events = [];
  let taskkillSpawns = 0;
  // taskkill ALWAYS fails (close code 1); the leader child exposes .kill for the fallback.
  const spawn = (bin, argv) => {
    const child = new EE();
    child.pid = 7777;
    if (bin === 'taskkill') {
      taskkillSpawns += 1;
      events.push({ ev: 'taskkill', n: taskkillSpawns });
      setTimeout(() => child.emit('close', 1), 1); // FAIL
    }
    child.kill = () => { events.push({ ev: 'leader-kill' }); };
    return child;
  };
  const leader = { pid: 7777, kill: () => { events.push({ ev: 'leader-kill' }); } };
  const res = await killProcessTree({ child: leader, spawn, platform: 'win32', taskkillTimeoutMs: 50 });
  assert.equal(res.tree_reaped, false, 'a taskkill-failure reap is UNCONFIRMED -- never reported as a confirmed reap');
  assert.equal(taskkillSpawns, 2, 'the tree-kill is RETRIED once before the leader-only fallback');
  assert.ok(events.some((e) => e.ev === 'leader-kill'), 'the leader-only fallback ran after taskkill failed twice');
});

test('CRITICAL B -- taskkill SUCCESS returns tree_reaped:true (confirmed)', async () => {
  const spawn = (bin) => {
    const child = new EE();
    child.pid = 8888;
    if (bin === 'taskkill') setTimeout(() => child.emit('close', 0), 1);
    child.kill = () => {};
    return child;
  };
  const res = await killProcessTree({ child: { pid: 8888, kill: () => {} }, spawn, platform: 'win32', taskkillTimeoutMs: 50 });
  assert.equal(res.tree_reaped, true, 'a successful taskkill is a CONFIRMED tree reap');
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

test('runTurn timeout -- AWAITS taskkill /PID <leader> /T /F (whole tree, leader included) and does NOT pre-kill the leader', async () => {
  // WP1 CRITICAL fix: the earlier reap spawned taskkill detached+unref'd then IMMEDIATELY
  // child.kill()'d the leader -- a race in which the leader dies before taskkill enumerates
  // its descendants, so taskkill fails and the orphans survive UNCONFIRMED. The corrected
  // reap runs `taskkill /PID <leader> /T /F` (which kills the whole tree INCLUDING the
  // leader), AWAITS its exit, and only falls back to child.kill() if taskkill fails. Prove:
  //   (a) the leader is NOT killed before taskkill runs (no pre-kill race);
  //   (b) taskkill is AWAITED -- runTurn does not resolve until taskkill has closed;
  //   (c) on a successful taskkill the leader is never separately killed;
  //   (d) runTurn still resolves with the `timed_out` blocker (never hangs).
  const events = [];
  let leaderChild = null;
  let taskkillClosed = false;
  const spawn = (bin, argv, opts) => {
    const child = new EventEmitter();
    child.stdout = new EventEmitter();
    child.stderr = new EventEmitter();
    child.stdin = { write() {}, end() {} };
    child.pid = 4242;
    child.unref = () => {};
    if (bin === 'taskkill') {
      child.kill = () => {};
      events.push({ ev: 'taskkill-spawn', argv, opts });
      // Close on a real timer (not setImmediate): if runTurn did NOT await taskkill, it
      // would resolve the timed_out blocker BEFORE this close fires -- so the post-await
      // `taskkillClosed === true` assertion below is a genuine await proof.
      setTimeout(() => { taskkillClosed = true; events.push({ ev: 'taskkill-close' }); child.emit('close', 0); }, 5);
    } else {
      // The codex LEADER: NEVER closes (forces the timeout). Record if it is ever killed.
      leaderChild = child;
      child.kill = () => { child.__killed = true; events.push({ ev: 'leader-kill' }); };
    }
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
  const kill = events.find((e) => e.ev === 'taskkill-spawn');
  assert.ok(kill, 'taskkill was spawned to reap the whole process tree');
  assert.deepEqual(kill.argv, ['/PID', '4242', '/T', '/F'], 'taskkill /PID <leaderpid> /T /F (force whole tree, leader included)');
  assert.notEqual(kill.opts?.detached, true, 'taskkill is NOT detached now -- it is awaited, not fire-and-forget');
  assert.equal(taskkillClosed, true, 'runTurn AWAITED taskkill -- it did not resolve before taskkill closed');
  assert.notEqual(leaderChild?.__killed, true, 'the leader was NOT pre-killed -- taskkill (which kills the tree incl. leader) did the reap');
  // The leader must never appear killed before taskkill was spawned.
  const iLeaderKill = events.findIndex((e) => e.ev === 'leader-kill');
  assert.equal(iLeaderKill, -1, 'on a successful taskkill the leader is never separately child.kill()ed');
});

test('FINDING #3 -- POSIX reap is HONEST: EPERM from process.kill(-pid) yields tree_reaped:FALSE (unconfirmed)', async () => {
  // The posix branch previously set tree_reaped:true UNCONDITIONALLY -- even when the group
  // kill threw EPERM (descendants may survive). It must now be honest, at win32 parity.
  const savedKill = process.kill;
  process.kill = () => { const e = new Error('operation not permitted'); e.code = 'EPERM'; throw e; };
  let res;
  try {
    res = await killProcessTree({ child: { pid: 4242, kill() {} }, platform: 'linux', spawn: () => { throw new Error('no taskkill on posix'); } });
  } finally { process.kill = savedKill; }
  assert.equal(res.tree_reaped, false, 'an EPERM group-kill is UNCONFIRMED -- never reported as a confirmed reap');
});

test('FINDING #3 -- POSIX reap: ESRCH (group already gone) IS a confirmed reap (tree_reaped:true)', async () => {
  const savedKill = process.kill;
  process.kill = () => { const e = new Error('no such process'); e.code = 'ESRCH'; throw e; };
  let res;
  try {
    res = await killProcessTree({ child: { pid: 4243, kill() {} }, platform: 'linux', spawn: () => { throw new Error('no taskkill on posix'); } });
  } finally { process.kill = savedKill; }
  assert.equal(res.tree_reaped, true, 'ESRCH means the group is already gone == reaped -> confirmed');
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
