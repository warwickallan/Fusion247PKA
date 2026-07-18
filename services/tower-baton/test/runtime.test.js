import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';

const SERVICE_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const RUNTIME_CFG_URL = pathToFileURL(path.join(SERVICE_DIR, 'src', 'runtimeConfig.js')).href;
const PREFLIGHT = path.join(SERVICE_DIR, 'bin', 'preflight.js');
const CANARY = 'pk_88888888_ZYXWVUTSRQPONMLK0987654321';

function seedHome() {
  const home = path.join(os.tmpdir(), `fusion-home-${randomUUID()}`);
  fs.mkdirSync(home, { recursive: true });
  fs.writeFileSync(path.join(home, 'fusion-capture-gateway.env'), `CLICKUP_TOKEN=${CANARY}\nTELEGRAM_BOT_TOKEN=123:BOTV\nAUTHORISED_TELEGRAM_USER_ID=42\n`);
  return home;
}

// A minimal env with NO inherited terminal secrets — only what node needs + the store.
function cleanEnv(home) {
  const env = { FUSION247_HOME: home, PATH: process.env.PATH };
  if (process.env.SystemRoot) env.SystemRoot = process.env.SystemRoot;
  if (process.env.PATHEXT) env.PATHEXT = process.env.PATHEXT;
  return env;
}

test('runtimeConfig loads with NO inherited terminal env (child sees only the store)', () => {
  const home = seedHome();
  const script = path.join(home, 'probe.mjs');
  fs.writeFileSync(script, `import { loadRuntimeConfig } from ${JSON.stringify(RUNTIME_CFG_URL)};\n`
    + `const r = loadRuntimeConfig({ required: ['CLICKUP_TOKEN','TELEGRAM_BOT_TOKEN','AUTHORISED_TELEGRAM_USER_ID'] });\n`
    + `process.stdout.write(JSON.stringify({ ok: r.ok, describe: r.config ? r.config.describe() : null }));\n`);
  const out = execFileSync(process.execPath, [script], { env: cleanEnv(home), encoding: 'utf8' });
  const parsed = JSON.parse(out);
  assert.equal(parsed.ok, true, 'loads config from the store with no inherited env');
  assert.equal(out.includes(CANARY), false, 'no secret VALUE in the child output (masked)');
  assert.equal(parsed.describe.CLICKUP_TOKEN, '***set (masked)***');
});

test('preflight exits 0 when the store is complete (masked)', () => {
  const home = seedHome();
  const out = execFileSync(process.execPath, [PREFLIGHT], { env: cleanEnv(home), encoding: 'utf8' });
  assert.match(out, /READY/);
  assert.equal(out.includes(CANARY), false);
});

test('preflight fail-closed (exit 1) when CLICKUP_TOKEN missing', () => {
  const home = path.join(os.tmpdir(), `fusion-home-${randomUUID()}`);
  fs.mkdirSync(home, { recursive: true });
  fs.writeFileSync(path.join(home, 'fusion-capture-gateway.env'), 'TELEGRAM_BOT_TOKEN=123:BOTV\nAUTHORISED_TELEGRAM_USER_ID=42\n');
  let code = 0; let stdout = '';
  try { stdout = execFileSync(process.execPath, [PREFLIGHT], { env: cleanEnv(home), encoding: 'utf8' }); }
  catch (e) { code = e.status; stdout = String(e.stdout ?? '') + String(e.stderr ?? ''); }
  assert.equal(code, 1);
  assert.match(stdout, /CLICKUP_TOKEN: MISSING|FAIL-CLOSED/);
});
