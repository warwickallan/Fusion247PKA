// Credential-model verification (PREPROVISION-CORRECTION-0001 §1).
//
// Proves the corrected, MINIMAL runtime configuration: the WP0 long-poll live
// proof needs exactly DATABASE_URL + TELEGRAM_BOT_TOKEN + AUTHORISED_TELEGRAM_
// USER_ID + WORKER_ID — and NOT the unused Supabase Data API keys, and NOT the
// webhook secret. Also proves describe() masks every secret.

import test from 'node:test';
import assert from 'node:assert/strict';

import {
  loadConfig,
  REQUIRED_AT_RUNTIME,
  SECRET_KEYS,
  CONFIG_KEYS,
} from '../src/config.js';

const MINIMAL = Object.freeze({
  DATABASE_URL: 'postgresql://postgres:sUpErSeCrEtDbPw@db.ref.supabase.co:5432/postgres?sslmode=require',
  TELEGRAM_BOT_TOKEN: '123456:FAKE-not-a-real-token-xyz',
  AUTHORISED_TELEGRAM_USER_ID: '424242',
  WORKER_ID: 'worker-live',
});

test('REQUIRED_AT_RUNTIME is exactly the minimal WP0 set (no unused Supabase/webhook secrets)', () => {
  assert.deepEqual(
    [...REQUIRED_AT_RUNTIME].sort(),
    ['AUTHORISED_TELEGRAM_USER_ID', 'DATABASE_URL', 'TELEGRAM_BOT_TOKEN', 'WORKER_ID'].sort(),
  );
  // Explicitly NOT required — the corrected model removed these from the gate.
  assert.ok(!REQUIRED_AT_RUNTIME.includes(CONFIG_KEYS.SUPABASE_URL), 'SUPABASE_URL must not be required');
  assert.ok(!REQUIRED_AT_RUNTIME.includes('SUPABASE_SERVICE_ROLE_KEY'), 'legacy service_role key gone');
  assert.ok(!REQUIRED_AT_RUNTIME.includes(CONFIG_KEYS.SUPABASE_SECRET_KEY), 'Data API key must not be required');
  assert.ok(!REQUIRED_AT_RUNTIME.includes(CONFIG_KEYS.TELEGRAM_WEBHOOK_SECRET), 'webhook secret must not be required');
});

test('the minimal set alone yields a runtime-ready (non-fixtures) config', () => {
  const config = loadConfig({ ...MINIMAL });
  assert.equal(config.fixturesMode, false, 'minimal set is sufficient — not fixtures mode');
  assert.equal(config.isRuntimeReady(), true);
  assert.deepEqual(config.missingRequired, []);
  assert.equal(config.databaseUrl, MINIMAL.DATABASE_URL);
  assert.equal(config.authorisedTelegramUserId, '424242');
});

test('absent Supabase Data API keys and webhook secret do NOT block a live runtime', () => {
  const config = loadConfig({ ...MINIMAL }); // none of the optional keys set
  assert.equal(config.isRuntimeReady(), true);
  assert.equal(config.supabaseUrl, null, 'SUPABASE_URL unused/absent');
  assert.equal(config.supabaseSecretKey, null, 'Data API key unused/absent');
  assert.equal(config.telegramWebhookSecret, null, 'webhook secret unused/absent for long polling');
});

test('SECRET_KEYS covers DATABASE_URL + bot token (the real WP0 secrets)', () => {
  assert.ok(SECRET_KEYS.includes(CONFIG_KEYS.DATABASE_URL), 'DATABASE_URL is a secret (DB password inline)');
  assert.ok(SECRET_KEYS.includes(CONFIG_KEYS.TELEGRAM_BOT_TOKEN), 'bot token is a secret');
});

test('describe() masks every secret VALUE and never leaks the DB password or bot token', () => {
  const config = loadConfig({ ...MINIMAL });
  const desc = config.describe();
  const serialised = JSON.stringify(desc);
  assert.ok(!serialised.includes('sUpErSeCrEtDbPw'), 'DB password must never appear in describe()');
  assert.ok(!serialised.includes('FAKE-not-a-real-token-xyz'), 'bot token must never appear in describe()');
  assert.equal(desc.DATABASE_URL, '***set (masked)***');
  assert.equal(desc.TELEGRAM_BOT_TOKEN, '***set (masked)***');
  // Non-secret identifiers are shown so diagnostics stay useful.
  assert.equal(desc.WORKER_ID, 'worker-live');
  assert.equal(desc.AUTHORISED_TELEGRAM_USER_ID, '424242');
});

test('CAPTURE_BRAIN_DIR is left NULL when unset so live/runtime can resolve the governed inbox', () => {
  const config = loadConfig({ ...MINIMAL }); // CAPTURE_BRAIN_DIR unset
  assert.equal(config.captureBrainDir, null, 'unset stays null (runtime resolves Team Inbox in live mode)');
});
