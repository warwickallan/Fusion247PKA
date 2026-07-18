// Tower baton — the modifiable Tower QA skill loader (Warwick addition #1).
//
// The QA operating instructions live as a FIRST-CLASS, versioned, modifiable skill
// doc at Builds/BUILD-010-fusion-tower/baton-mvp/tower-qa-skill.md. The watcher
// loads THIS file FRESH on every turn and records its SHA-256 fingerprint, so:
//   · a mid-run edit to the skill takes effect on the very next turn, and
//   · every verdict is bound to the exact prompt bytes that produced it (audit).
//
// FAIL-CLOSED: a missing file, an unreadable file, or malformed/absent frontmatter
// blocks the turn. A skill is RUNNABLE only when it is explicitly authorised:
//   · standing_use_ratified: true  (Warwick ratified the text for the standing watcher), OR
//   · proof_run_authorised: true   (Warwick authorised a bounded proof run), OR
//   · legacy status: approved      (back-compat with the original single-gate fixtures).
// Anything else (e.g. status: draft/provisional with neither flag) FAILS CLOSED — an
// unauthorised governing prompt must never drive a live review. A future standing-watcher
// installer can additionally require standingUseRatified === true.

import crypto from 'node:crypto';
import fsDefault from 'node:fs';

/** Parse a minimal leading YAML frontmatter block (key: value lines). */
export function parseFrontmatter(text) {
  const m = String(text ?? '').match(/^﻿?---\r?\n([\s\S]*?)\r?\n---\r?\n?/);
  if (!m) return { ok: false, fields: {} };
  const fields = {};
  for (const line of m[1].split(/\r?\n/)) {
    const kv = line.match(/^\s*([A-Za-z_][A-Za-z0-9_-]*)\s*:\s*(.*)$/);
    if (kv) fields[kv[1].toLowerCase()] = kv[2].trim().replace(/^["']|["']$/g, '');
  }
  return { ok: true, fields };
}

/** Coerce a frontmatter boolean field (`true`/`false` string) → boolean. Absent → false. */
function fmBool(value) {
  return /^true$/i.test(String(value ?? '').trim());
}

/**
 * Load the QA skill fresh and fingerprint it. Returns
 * { ok, text, fingerprint, version, status, proofRunAuthorised, standingUseRatified, error }.
 * Fingerprint is sha256(file bytes) — the prompt_fingerprint recorded on every verdict.
 *
 * Runnable iff standingUseRatified || proofRunAuthorised || legacy status === 'approved'.
 */
export function loadQaSkill({ path, fs = fsDefault } = {}) {
  if (!path) return { ok: false, error: 'fail-closed: no QA skill path configured' };
  let text;
  try {
    if (!fs.existsSync(path)) return { ok: false, error: `fail-closed: QA skill not found at ${path}` };
    text = fs.readFileSync(path, 'utf8');
  } catch (e) {
    return { ok: false, error: `fail-closed: QA skill unreadable (${String(e?.message ?? e)})` };
  }
  if (!text || !text.trim()) return { ok: false, error: 'fail-closed: QA skill is empty' };
  const fingerprint = crypto.createHash('sha256').update(text, 'utf8').digest('hex');
  const fm = parseFrontmatter(text);
  if (!fm.ok) return { ok: false, error: 'fail-closed: QA skill has no frontmatter block', fingerprint };
  const status = fm.fields.status ?? null;
  const version = fm.fields.version ?? null;
  const proofRunAuthorised = fmBool(fm.fields.proof_run_authorised);
  const standingUseRatified = fmBool(fm.fields.standing_use_ratified);

  const runnable = standingUseRatified || proofRunAuthorised || status === 'approved';
  if (!runnable) {
    return {
      ok: false,
      error: `fail-closed: QA skill is not runnable — status "${status ?? '(none)'}", `
        + `proof_run_authorised=${proofRunAuthorised}, standing_use_ratified=${standingUseRatified} `
        + '(need standing_use_ratified:true, or proof_run_authorised:true, or legacy status:approved)',
      fingerprint, status, version, proofRunAuthorised, standingUseRatified,
    };
  }
  return { ok: true, text, fingerprint, version, status, proofRunAuthorised, standingUseRatified, error: null };
}

/**
 * STANDING-STARTUP GATE (pure, testable). Decides whether the standing watcher daemon
 * may start given a loaded QA-skill result. This is STRICTER than loadQaSkill's runnable
 * check: a legacy `status: approved` or a bounded `proof_run_authorised` is enough to RUN
 * a single review turn, but the STANDING daemon must refuse to come online unless the
 * governing prompt has been explicitly ratified for standing use.
 *
 *   · standing mode (default): ok:true ONLY if standingUseRatified === true.
 *   · bounded proof mode (proofMode:true): ok:true if standingUseRatified === true OR
 *     proofRunAuthorised === true (a bounded proof run may remain separately authorised).
 *
 * Fail-closed: a skill that did not load (skillLoadResult.ok === false) is never allowed.
 * Returns { ok, reason } — reason is a clear, non-sensitive blocker string.
 */
export function assertStandingStartupAllowed(skillLoadResult, { proofMode = false } = {}) {
  const r = skillLoadResult ?? {};
  if (r.ok === false) {
    return { ok: false, reason: `standing-startup refused: QA skill did not load (${r.error ?? 'fail-closed'})` };
  }
  const standingUseRatified = r.standingUseRatified === true;
  const proofRunAuthorised = r.proofRunAuthorised === true;
  if (standingUseRatified) {
    return { ok: true, reason: 'standing use ratified — standing startup allowed' };
  }
  if (proofMode && proofRunAuthorised) {
    return { ok: true, reason: 'bounded proof run authorised — proof startup allowed (standing use not yet ratified)' };
  }
  return {
    ok: false,
    reason: proofMode
      ? 'bounded-proof startup refused: QA skill is neither standing_use_ratified nor proof_run_authorised'
      : 'standing startup refused: QA skill is not ratified for standing use (standing_use_ratified:false)',
  };
}
