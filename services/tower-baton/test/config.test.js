import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { randomUUID } from 'node:crypto';

import { loadConfig, parseEnvBody, maskSecret } from '../src/config.js';
import { loadRuntimeConfig, findMalformedLines, healthSummary } from '../src/runtimeConfig.js';

const CANARY = 'pk_99999999_ABCDEFGHIJKLMNOP1234567890';

function tmpHome() {
  const home = path.join(os.tmpdir(), `fusion-home-${randomUUID()}`);
  fs.mkdirSync(home, { recursive: true });
  return home;
}

test('parseEnvBody — names + values, ignores comments/blanks/export', () => {
  const parsed = parseEnvBody('# comment\n\nexport CLICKUP_TOKEN=pk_abc\nTELEGRAM_BOT_TOKEN="123:XYZ"\n');
  assert.equal(parsed.CLICKUP_TOKEN, 'pk_abc');
  assert.equal(parsed.TELEGRAM_BOT_TOKEN, '123:XYZ');
});

test('config — clickup fail-closed when CLICKUP_TOKEN absent', () => {
  const c = loadConfig({ env: {}, home: tmpHome() });
  assert.equal(c.clickupReady, false);
  const gate = c.requireClickup();
  assert.equal(gate.ok, false);
  assert.match(gate.blocker, /CLICKUP_TOKEN missing/);
});

test('config — describe() masks every secret (canary never leaks)', () => {
  const c = loadConfig({ env: { CLICKUP_TOKEN: CANARY, TELEGRAM_BOT_TOKEN: '123:SECRETVALUE' }, home: tmpHome() });
  const snap = JSON.stringify(c.describe());
  assert.equal(snap.includes(CANARY), false, 'canary must not appear in describe()');
  assert.equal(snap.includes('SECRETVALUE'), false);
  assert.equal(c.describe().CLICKUP_TOKEN, '***set (masked)***');
});

test('config — redact() removes secret values from any log line', () => {
  const c = loadConfig({ env: { CLICKUP_TOKEN: CANARY }, home: tmpHome() });
  const redacted = c.redact(`error posting with token ${CANARY} to clickup`);
  assert.equal(redacted.includes(CANARY), false);
  assert.match(redacted, /\*\*\*redacted\*\*\*/);
});

test('maskSecret — unset vs set', () => {
  assert.equal(maskSecret(null), '(unset)');
  assert.equal(maskSecret('anything'), '***set (masked)***');
});

test('config — TOWER_AUTHORISED_AUTHOR_IDS parsed; missing → fail-closed gate (no default-open)', () => {
  const c = loadConfig({ env: { TOWER_AUTHORISED_AUTHOR_IDS: '222204263, 99' }, home: tmpHome() });
  assert.equal(c.authorGateConfigured, true);
  assert.equal(c.isAuthorisedAuthor('222204263'), true);
  assert.equal(c.isAuthorisedAuthor(222204263), true, 'numeric id is coerced');
  assert.equal(c.isAuthorisedAuthor('nope'), false);
  assert.equal(c.isAuthorisedAuthor(null), false);
  assert.equal(c.describe().TOWER_AUTHORISED_AUTHOR_IDS, '222204263,99');

  const empty = loadConfig({ env: {}, home: tmpHome() });
  assert.equal(empty.authorGateConfigured, false);
  assert.equal(empty.isAuthorisedAuthor('222204263'), false, 'unconfigured gate never authorises (fail-closed)');
  assert.equal(empty.describe().TOWER_AUTHORISED_AUTHOR_IDS, '(unset)');
});

test('runtimeConfig — fail-closed on missing secret store dir', () => {
  const missing = path.join(os.tmpdir(), `does-not-exist-${randomUUID()}`);
  const r = loadRuntimeConfig({ home: missing, env: {}, required: ['CLICKUP_TOKEN'] });
  assert.equal(r.ok, false);
  assert.match(r.error, /secret store not found/);
});

test('runtimeConfig — fail-closed on missing required var (masked, names only)', () => {
  const home = tmpHome();
  fs.writeFileSync(path.join(home, 'fusion-capture-gateway.env'), 'TELEGRAM_BOT_TOKEN=123:X\nAUTHORISED_TELEGRAM_USER_ID=42\n');
  const r = loadRuntimeConfig({ home, env: {}, required: ['CLICKUP_TOKEN', 'TELEGRAM_BOT_TOKEN', 'AUTHORISED_TELEGRAM_USER_ID'] });
  assert.equal(r.ok, false);
  assert.ok(r.missing.includes('CLICKUP_TOKEN'));
  assert.match(r.error, /CLICKUP_TOKEN/);
});

test('runtimeConfig — fail-closed on malformed env file (redacted, line numbers only)', () => {
  const home = tmpHome();
  const secretLine = `this is not a key=value line ${CANARY}`;
  fs.writeFileSync(path.join(home, 'tower-baton.env'), `CLICKUP_TOKEN=${CANARY}\n${secretLine}\n`);
  const r = loadRuntimeConfig({ home, env: {}, required: ['CLICKUP_TOKEN'] });
  assert.equal(r.ok, false);
  assert.match(r.error, /malformed env file/);
  assert.equal(r.error.includes(CANARY), false, 'malformed error must not echo the secret-bearing line');
});

test('findMalformedLines — reports line NUMBERS not content', () => {
  const bad = findMalformedLines('OK=1\n# c\nnot a kv line\n');
  assert.deepEqual(bad, [3]);
});

test('runtimeConfig — loads a valid store (from files, no inherited env)', () => {
  const home = tmpHome();
  fs.writeFileSync(path.join(home, 'fusion-capture-gateway.env'), `CLICKUP_TOKEN=${CANARY}\nTELEGRAM_BOT_TOKEN=123:X\nAUTHORISED_TELEGRAM_USER_ID=42\n`);
  const r = loadRuntimeConfig({ home, env: {}, required: ['CLICKUP_TOKEN', 'TELEGRAM_BOT_TOKEN', 'AUTHORISED_TELEGRAM_USER_ID'] });
  assert.equal(r.ok, true, r.error ?? '');
  assert.equal(r.config.clickupReady, true);
  // healthSummary is masked
  const h = healthSummary({ home, env: {}, required: ['CLICKUP_TOKEN'] });
  assert.equal(h.ok, true);
  assert.equal(JSON.stringify(h).includes(CANARY), false);
});
