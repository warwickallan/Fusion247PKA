import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadConfig, maskSecret, PRINCIPAL_SIGNING_ENV } from '../src/config.js';

test('fixtures mode when DATABASE_URL absent', () => {
  const c = loadConfig({});
  assert.equal(c.fixturesMode, true);
  assert.equal(c.isRuntimeReady(), false);
});

test('runtime ready when DATABASE_URL present', () => {
  const c = loadConfig({ DATABASE_URL: 'postgresql://x' });
  assert.equal(c.fixturesMode, false);
  assert.equal(c.isRuntimeReady(), true);
});

test('per-adapter readiness reflects gated credentials', () => {
  const c = loadConfig({ DATABASE_URL: 'x', GITHUB_TOKEN: 't', TELEGRAM_BOT_TOKEN: 'b', AUTHORISED_TELEGRAM_USER_ID: '42' });
  assert.equal(c.githubReady, true);
  assert.equal(c.telegramReady, true);
  assert.equal(c.codexReady, false);
  assert.equal(c.clickupReady, false);
});

test('codex accepts either CODEX_API_KEY or OPENAI_API_KEY', () => {
  assert.equal(loadConfig({ CODEX_API_KEY: 'k' }).codexReady, true);
  assert.equal(loadConfig({ OPENAI_API_KEY: 'k' }).codexReady, true);
  assert.equal(loadConfig({}).codexReady, false);
});

test('telegram not ready without BOTH token and authorised id', () => {
  assert.equal(loadConfig({ TELEGRAM_BOT_TOKEN: 'b' }).telegramReady, false);
  assert.equal(loadConfig({ AUTHORISED_TELEGRAM_USER_ID: '1' }).telegramReady, false);
});

test('maskSecret never returns a real value', () => {
  assert.equal(maskSecret(null), '(unset)');
  assert.equal(maskSecret(''), '(unset)');
  assert.equal(maskSecret('super-secret-token'), '***set (masked)***');
});

test('describe() masks every secret and leaks none', () => {
  const c = loadConfig({
    DATABASE_URL: 'postgresql://postgres:PASSWORD@host/db',
    TELEGRAM_BOT_TOKEN: '123456:AAreal',
    GITHUB_TOKEN: 'ghp_real',
    CODEX_API_KEY: 'sk-real',
    TOWER_HMAC_SECRET_LARRY: 'hmacsecret',
  });
  const d = c.describe();
  const blob = JSON.stringify(d);
  for (const leak of ['PASSWORD', 'AAreal', 'ghp_real', 'sk-real', 'hmacsecret']) {
    assert.ok(!blob.includes(leak), `describe() must not leak "${leak}"`);
  }
  assert.equal(d.DATABASE_URL, '***set (masked)***');
  assert.equal(d.GITHUB_TOKEN, '***set (masked)***');
});

test('signingSecret returns the value; signingSecretEnvName returns the NAME pointer', () => {
  const c = loadConfig({ TOWER_HMAC_SECRET_GPT_CODEX: 'thevalue' });
  assert.equal(c.signingSecret('gpt_codex'), 'thevalue');
  assert.equal(c.signingSecretEnvName('gpt_codex'), 'TOWER_HMAC_SECRET_GPT_CODEX');
  assert.equal(c.signingSecretEnvName('gpt_codex'), PRINCIPAL_SIGNING_ENV.gpt_codex);
  assert.equal(c.signingSecret('warwick'), null); // human never signs
});
