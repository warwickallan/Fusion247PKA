import { test } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import fs from 'node:fs';

import { loadQaSkill, assertStandingStartupAllowed, parseFrontmatter } from '../src/qaSkill.js';
import { writeTmp, approvedSkill } from '../test-helpers/fakes.js';

const SERVICE_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const REPO_ROOT = path.resolve(SERVICE_DIR, '..', '..');
// WP-2G — the governing contract left `Builds/**` (a build record) for its durable runtime home
// beside the two other governing texts. This test is the one place in the estate that asserts the
// SHIPPED file, so a stale constant here would silently assert nothing.
const SHIPPED_SKILL = path.join(REPO_ROOT, 'services', 'control-plane', 'review', 'prompts', 'tower-qa-skill.md');

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

// The shipped governing contract, asserted WITHOUT pinning a ratification state.
//
// The previous version of this test asserted `status === 'approved'` and
// `standingUseRatified === true` against the shipped file. That was true of the BUILD-010 file and
// is NOT true of the WP-2G rewrite, which ships DRAFT on purpose: Warwick reads the wording and
// flips the frontmatter, and that flip is what makes it govern. Re-pinning either state here just
// moves the booby trap — the test would go red the day he ratifies it, which is precisely the
// stale-pin failure this WP was raised over (review/test/tower-runtime.test.js carried a
// `tower-qa-skill@1` pin against a shipped `version: 2`).
//
// So assert the INVARIANT instead: the shipped file exists, parses, carries a version, and the
// loader's runnable verdict AGREES with the file's own frontmatter. That holds before and after
// ratification, and it still fails on the things that actually matter — a moved file, a deleted
// frontmatter block, or a loader that stops honouring the declared state.
test('loadQaSkill — the real shipped contract loads, and the verdict matches its own frontmatter', () => {
  assert.ok(fs.existsSync(SHIPPED_SKILL), `the shipped governing contract must exist at ${SHIPPED_SKILL}`);
  const raw = fs.readFileSync(SHIPPED_SKILL, 'utf8');
  const fm = parseFrontmatter(raw);
  assert.equal(fm.ok, true, 'the shipped contract has a frontmatter block');
  assert.ok(fm.fields.version, 'the shipped contract declares a version');

  const declaredStanding = /^true$/i.test(String(fm.fields.standing_use_ratified ?? ''));
  const declaredProof = /^true$/i.test(String(fm.fields.proof_run_authorised ?? ''));
  const declaredRunnable = declaredStanding || declaredProof || fm.fields.status === 'approved';

  const r = loadQaSkill({ path: SHIPPED_SKILL });
  assert.equal(r.version, fm.fields.version, 'the loader reads the declared version');
  assert.equal(r.standingUseRatified, declaredStanding, 'the loader reads the declared standing-use flag');
  assert.equal(r.ok, declaredRunnable,
    `the loader's runnable verdict must follow the frontmatter (declared runnable=${declaredRunnable}, got ok=${r.ok}: ${r.error ?? 'ok'})`);
  assert.equal(assertStandingStartupAllowed(r, { proofMode: false }).ok, declaredStanding,
    'standing startup is allowed exactly when standing use is ratified — never on a draft');
  // Visible in the run output, so a reader of CI can see WHICH state was in force that day.
  console.log(`[qaSkill] shipped contract: version=${fm.fields.version} status=${fm.fields.status} `
    + `standing_use_ratified=${declaredStanding} → loadable=${r.ok}`);
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
