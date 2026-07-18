// Proves the tower-baton local scanner catches a token-SHAPED literal (not just a
// known secret VALUE) so "local clean" is a superset of what CI would reject. The
// token-shaped probe is assembled at RUNTIME so THIS test source contains no
// token-shaped substring (otherwise the default-mode scan of tracked files would
// flag this very file).

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { writeTmp } from '../test-helpers/fakes.js';

const SCRIPT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'scripts', 'secret-scan.sh');

function bashAvailable() {
  const probe = spawnSync('bash', ['--version'], { encoding: 'utf8' });
  return !probe.error;
}

test('local secret-scan flags a token-shaped literal and passes clean text', (t) => {
  if (!bashAvailable()) { t.skip('bash unavailable on this runner'); return; }

  // Assemble a token SHAPE (pk_ + 25 alnum) at runtime — no literal token in this file.
  const tokenLike = 'pk' + '_' + 'A'.repeat(25);
  const dirty = writeTmp(`const anything = '${tokenLike}';\n`, '.js');
  const clean = writeTmp('const anything = "just a normal string with plain words";\n', '.js');

  const rDirty = spawnSync('bash', [SCRIPT, dirty], { encoding: 'utf8' });
  const rClean = spawnSync('bash', [SCRIPT, clean], { encoding: 'utf8' });

  assert.equal(rDirty.status, 1, `token-shaped literal must fail: ${rDirty.stdout}${rDirty.stderr}`);
  assert.match(rDirty.stdout, /token-shaped/i);
  assert.equal(rClean.status, 0, `clean text must pass: ${rClean.stdout}${rClean.stderr}`);
});

test('local secret-scan flags a Telegram bot-token shape', (t) => {
  if (!bashAvailable()) { t.skip('bash unavailable on this runner'); return; }
  // <8+ digits>:<30+ base64ish> assembled at runtime.
  const tokenLike = '12345678' + ':' + 'A'.repeat(35);
  const dirty = writeTmp(`const t = '${tokenLike}';\n`, '.js');
  const r = spawnSync('bash', [SCRIPT, dirty], { encoding: 'utf8' });
  assert.equal(r.status, 1, `${r.stdout}${r.stderr}`);
});
