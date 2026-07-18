import { test } from 'node:test';
import assert from 'node:assert/strict';

import { createCodexAdapter, sanitizeCodexEnv, CODEX_ENV_DENYLIST } from '../src/codexAdapter.js';
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
