import { test } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { loadQaSkill, assertStandingStartupAllowed } from '../src/qaSkill.js';
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

test('loadQaSkill — fail-closed when status is draft with no authorisation flags', () => {
  const p = writeTmp('---\nstatus: draft\nversion: 1\n---\nbody', '.md');
  const r = loadQaSkill({ path: p });
  assert.equal(r.ok, false);
  assert.match(r.error, /not runnable/);
  // fingerprint is still computed even on a rejected skill (audit)
  assert.ok(r.fingerprint);
});

test('loadQaSkill — provisional WITHOUT authorisation flags fails closed', () => {
  const p = writeTmp('---\nstatus: provisional\nversion: 1\n---\nbody', '.md');
  const r = loadQaSkill({ path: p });
  assert.equal(r.ok, false);
  assert.match(r.error, /not runnable/);
  assert.equal(r.proofRunAuthorised, false);
  assert.equal(r.standingUseRatified, false);
});

test('loadQaSkill — provisional WITH proof_run_authorised loads (proof gate)', () => {
  const p = writeTmp('---\nstatus: provisional\nproof_run_authorised: true\nstanding_use_ratified: false\nversion: 3\n---\nbody', '.md');
  const r = loadQaSkill({ path: p });
  assert.equal(r.ok, true, r.error ?? '');
  assert.equal(r.proofRunAuthorised, true);
  assert.equal(r.standingUseRatified, false);
  assert.equal(r.version, '3');
});

test('loadQaSkill — the real shipped skill is ratified for standing use', () => {
  const r = loadQaSkill({ path: SHIPPED_SKILL });
  assert.equal(r.ok, true, r.error ?? '');
  assert.equal(r.status, 'approved', 'shipped skill is approved');
  assert.equal(r.standingUseRatified, true, 'standing use IS ratified');
  assert.equal(r.proofRunAuthorised, false, 'separately-authorised bounded proof run no longer required');
  assert.ok(r.version);
});

// ── STANDING-STARTUP GATE (pure) — assertStandingStartupAllowed ────────────────
test('assertStandingStartupAllowed — (a) ratified skill → standing startup ALLOWED', () => {
  const skill = { ok: true, status: 'approved', standingUseRatified: true, proofRunAuthorised: false };
  const g = assertStandingStartupAllowed(skill, { proofMode: false });
  assert.equal(g.ok, true, g.reason);
  assert.match(g.reason, /standing use ratified/i);
});

test('assertStandingStartupAllowed — (b) not-ratified, no proof → standing startup REFUSED with reason', () => {
  const skill = { ok: true, status: 'approved', standingUseRatified: false, proofRunAuthorised: false };
  const g = assertStandingStartupAllowed(skill, { proofMode: false });
  assert.equal(g.ok, false);
  assert.match(g.reason, /not ratified for standing use/i);
});

test('assertStandingStartupAllowed — (c) proofMode + proof_run_authorised (standing false) → ALLOWED', () => {
  const skill = { ok: true, status: 'provisional', standingUseRatified: false, proofRunAuthorised: true };
  const g = assertStandingStartupAllowed(skill, { proofMode: true });
  assert.equal(g.ok, true, g.reason);
  assert.match(g.reason, /proof/i);
});

test('assertStandingStartupAllowed — proof-authorised alone does NOT unlock STANDING mode', () => {
  const skill = { ok: true, standingUseRatified: false, proofRunAuthorised: true };
  const g = assertStandingStartupAllowed(skill, { proofMode: false });
  assert.equal(g.ok, false, 'standing mode must not accept a mere proof authorisation');
});

test('assertStandingStartupAllowed — a skill that did not load is refused (fail-closed)', () => {
  const g = assertStandingStartupAllowed({ ok: false, error: 'fail-closed: draft' }, { proofMode: false });
  assert.equal(g.ok, false);
  assert.match(g.reason, /did not load|fail-closed/i);
});
