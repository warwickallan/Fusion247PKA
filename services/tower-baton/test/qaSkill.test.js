import { test } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { loadQaSkill } from '../src/qaSkill.js';
import { writeTmp, approvedSkill } from '../test-helpers/fakes.js';

const SERVICE_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const REPO_ROOT = path.resolve(SERVICE_DIR, '..', '..');
const SHIPPED_SKILL = path.join(REPO_ROOT, 'Builds', 'BUILD-010-fusion-tower', 'baton-mvp', 'tower-qa-skill.md');

test('loadQaSkill — loads approved skill + records SHA-256 fingerprint', () => {
  const text = approvedSkill(2);
  const p = writeTmp(text, '.md');
  const r = loadQaSkill({ path: p });
  assert.equal(r.ok, true, r.error ?? '');
  assert.equal(r.status, 'approved');
  assert.equal(r.version, '2');
  assert.equal(r.fingerprint, crypto.createHash('sha256').update(text, 'utf8').digest('hex'));
});

test('loadQaSkill — fail-closed when file missing', () => {
  const r = loadQaSkill({ path: 'C:/no/such/skill.md' });
  assert.equal(r.ok, false);
  assert.match(r.error, /not found/);
});

test('loadQaSkill — fail-closed when frontmatter malformed/absent', () => {
  const p = writeTmp('# no frontmatter here\njust text', '.md');
  const r = loadQaSkill({ path: p });
  assert.equal(r.ok, false);
  assert.match(r.error, /no frontmatter/);
});

test('loadQaSkill — fail-closed when status is not approved', () => {
  const p = writeTmp('---\nstatus: draft\nversion: 1\n---\nbody', '.md');
  const r = loadQaSkill({ path: p });
  assert.equal(r.ok, false);
  assert.match(r.error, /must be "approved"/);
  // fingerprint is still computed even on a rejected skill (audit)
  assert.ok(r.fingerprint);
});

test('loadQaSkill — the real shipped skill is approved + versioned', () => {
  const r = loadQaSkill({ path: SHIPPED_SKILL });
  assert.equal(r.ok, true, r.error ?? '');
  assert.equal(r.status, 'approved');
  assert.ok(r.version);
});
