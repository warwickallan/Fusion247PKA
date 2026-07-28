'use strict';
const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const control = require('./control.cjs');

function tmpEnv() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'asdair-runner-ctl-'));
  return { ASDAIR_RUNNER_STATE_DIR: dir };
}

test('with no file at all the runner simply proceeds', () => {
  const env = tmpEnv();
  assert.strictEqual(control.read(env).directive, 'run');
});

test('a directive round-trips and survives the process that wrote it', () => {
  const env = tmpEnv();
  control.write('pause', { by: 'test', env });
  assert.strictEqual(control.read(env).directive, 'pause');
  control.write('resume', { by: 'test', env });
  assert.strictEqual(control.read(env).directive, 'resume');
});

test('a corrupt control file never crashes the runner - it falls back to run', () => {
  const env = tmpEnv();
  fs.mkdirSync(env.ASDAIR_RUNNER_STATE_DIR, { recursive: true });
  fs.writeFileSync(control.controlPath(env), '{not json', 'utf8');
  assert.strictEqual(control.read(env).directive, 'run');
});

test('an unknown directive in the file is ignored rather than obeyed', () => {
  const env = tmpEnv();
  fs.mkdirSync(env.ASDAIR_RUNNER_STATE_DIR, { recursive: true });
  fs.writeFileSync(control.controlPath(env), JSON.stringify({ directive: 'checkout' }), 'utf8');
  assert.strictEqual(control.read(env).directive, 'run');
});

test('an unknown directive cannot be written either', () => {
  const env = tmpEnv();
  assert.throws(() => control.write('pay', { env }), /unknown directive/);
});

test('each directive maps to exactly one runner decision', () => {
  assert.strictEqual(control.decide('run'), 'proceed');
  assert.strictEqual(control.decide('resume'), 'proceed');
  assert.strictEqual(control.decide('pause'), 'hold');
  assert.strictEqual(control.decide('takeover'), 'release');
  assert.strictEqual(control.decide('stop'), 'finish');
});

test('the write is atomic - no temp file is left behind for a reader to see', () => {
  const env = tmpEnv();
  control.write('takeover', { env });
  const left = fs.readdirSync(env.ASDAIR_RUNNER_STATE_DIR);
  assert.deepStrictEqual(left, ['control.json']);
});
