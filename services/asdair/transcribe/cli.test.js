// =====================================================================
// BUILD-015 - the runtime caller. OFFLINE.
//
// Every child process here is pointed at 127.0.0.1:1 (nothing listens),
// so if any test path made a model call it would fail loudly. --dry-run
// is expected to exit 0 regardless, which is the proof it made none.
// =====================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const CLI = join(import.meta.dirname, 'transcribe-list.js');

// A real (tiny, 1x1) PNG so the CLI's own validation runs against a real file.
const PNG_1X1 = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64'
);
const dir = mkdtempSync(join(tmpdir(), 'asdair-transcribe-'));
const IMAGE = join(dir, 'list.png');
writeFileSync(IMAGE, PNG_1X1);

const SENTINEL_KEY = 'sk-SENTINELCREDVALUE0123456789';
const SENTINEL_PASS = 'SENTINELGATEWAYPASSWORD';

function cli(args, extraEnv = {}) {
  try {
    const stdout = execFileSync(process.execPath, [CLI, ...args], {
      encoding: 'utf8',
      env: {
        ...process.env,
        // Unroutable on purpose: any real call fails.
        FUSION_GATEWAY_URL: 'http://user:' + SENTINEL_PASS + '@127.0.0.1:1/v1',
        FUSION_GATEWAY_KEY: SENTINEL_KEY,
        ...extraEnv,
      },
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    return { code: 0, stdout, stderr: '' };
  } catch (e) {
    return { code: e.status, stdout: e.stdout || '', stderr: e.stderr || '' };
  }
}

test('--dry-run validates and makes NO model call', () => {
  const r = cli(['--image', IMAGE, '--dry-run', '--json']);
  assert.equal(r.code, 0, 'exited clean against an unroutable gateway => no call was made');
  const plan = JSON.parse(r.stdout);
  assert.equal(plan.dry_run, true);
  assert.equal(plan.would_call, false);
  assert.equal(plan.mime, 'image/png');
  assert.equal(plan.bytes, PNG_1X1.length);
  assert.equal(plan.gateway_configured, true, 'presence is reported...');
  assert.ok(!JSON.stringify(plan).includes('127.0.0.1'), '...but the URL value is never printed');
});

test('--dry-run prints no credential value on stdout or stderr', () => {
  for (const args of [['--image', IMAGE, '--dry-run', '--json'], ['--image', IMAGE, '--dry-run']]) {
    const r = cli(args);
    const all = r.stdout + r.stderr;
    assert.ok(!all.includes(SENTINEL_KEY), 'leaked FUSION_GATEWAY_KEY');
    assert.ok(!all.includes(SENTINEL_PASS), 'leaked the gateway URL password');
    assert.ok(!all.includes('Bearer'), 'leaked an auth header');
  }
});

test('--dry-run reports honestly when no gateway is configured', () => {
  const r = cli(['--image', IMAGE, '--dry-run', '--json'], { FUSION_GATEWAY_URL: '' });
  assert.equal(r.code, 0);
  assert.equal(JSON.parse(r.stdout).gateway_configured, false);
});

test('a bad image is rejected before any model call', () => {
  const r = cli(['--image', join(dir, 'nope.png'), '--json']);
  assert.equal(r.code, 1);
  assert.match(r.stderr, /image not found/);
});

test('an unsupported image type is rejected', () => {
  const bad = join(dir, 'list.txt');
  writeFileSync(bad, 'milk');
  const r = cli(['--image', bad, '--dry-run']);
  assert.equal(r.code, 1);
  assert.match(r.stderr, /unsupported image type/);
});

test('--help exits 0 and documents the one-shot contract', () => {
  const r = cli(['--help']);
  assert.equal(r.code, 0);
  assert.match(r.stdout, /--dry-run\s+validate inputs and print the plan; NO model call/);
  assert.match(r.stdout, /never/i);
});

test('a missing --image is a usage error, not a crash', () => {
  const r = cli([]);
  assert.equal(r.code, 2);
  assert.match(r.stdout, /Usage: node --env-file/);
});
