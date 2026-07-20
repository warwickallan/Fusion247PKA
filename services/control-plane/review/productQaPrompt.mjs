// BUILD-014 PR-2b — the VERSIONED product-QA prompt (the load-bearing fix).
//
// THE MISS THIS CLOSES: the richer GPT-style product-QA reviewer prompt was written but never
// WIRED into the runtime — the loop ran an empty/thin skillText. This module wires the REAL,
// versioned product-QA prompt and binds its version + fingerprint onto every review_run.
//
// GOVERNANCE (honest provenance — never present an AI-authored prompt as approved):
//   · BASE = Builds/BUILD-010-fusion-tower/baton-mvp/tower-qa-skill.md — Warwick-authored and
//     RATIFIED (status: approved, standing_use_ratified: true). THIS is the governing text. Its
//     ordered checklist already puts acceptance alignment before "explore beyond", and its
//     product-QA (not pentest) orientation is exactly what we want wired.
//   · ORIENTATION = review/prompts/product-qa-runtime-orientation.md — a DRAFT layer authored by
//     Mack (PR-2b) that makes two behaviours EXPLICIT + TESTABLE: acceptance-FIRST ordering, and
//     explicit consumption of EVERY prior open finding. It is clearly flagged NOT-YET-APPROVED and
//     must not govern a live review until Warwick approves it — which is why the role_based_readiness
//     flag stays OFF and live activation is a Warwick gate.
//
// The assembled per-turn prompt = [ratified skill] + [draft orientation] + [resolved evidence:
// ALL acceptance criteria, then ALL prior open findings]. Acceptance criteria are injected BEFORE
// the adapter appends the staged diff, so acceptance-first ordering is STRUCTURAL, not merely
// requested. The reviewer subprocess still receives ONLY this staged text (secret-stripping in the
// adapters is preserved) — never DB or GitHub credentials.

import crypto from 'node:crypto';
import fsDefault from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Repo-root-relative default paths. review/ -> control-plane/ -> services/ -> repo root.
export const DEFAULT_APPROVED_SKILL_PATH = path.resolve(
  __dirname, '..', '..', '..', 'Builds', 'BUILD-010-fusion-tower', 'baton-mvp', 'tower-qa-skill.md');
export const DEFAULT_ORIENTATION_PATH = path.resolve(
  __dirname, 'prompts', 'product-qa-runtime-orientation.md');

function sha256(text) {
  return crypto.createHash('sha256').update(String(text), 'utf8').digest('hex');
}

/** Minimal leading-YAML frontmatter parse (key: value). Mirrors tower-baton qaSkill loader. */
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

const isTrue = (v) => /^true$/i.test(String(v ?? '').trim());

/**
 * Load + fingerprint the versioned product-QA prompt (fail-closed). Returns
 *   { ok, error?,
 *     approvedSkillText, approvedSkillFingerprint, approvedSkillVersion, approvedSkillRatified,
 *     orientationText, orientationFingerprint, orientationApproved,
 *     promptVersion, promptFingerprint, assemble }
 *
 * FAIL-CLOSED: a missing/empty/unreadable base skill, or an UNRATIFIED base skill, returns ok:false
 * (an unauthorised governing prompt must never drive a review). The orientation layer being an
 * unapproved DRAFT does NOT fail the load — it is deliberately wired-but-flagged; live governance is
 * gated elsewhere (the OFF-by-default readiness flag + Warwick activation).
 */
export function loadProductQaPrompt({
  skillPath = DEFAULT_APPROVED_SKILL_PATH,
  orientationPath = DEFAULT_ORIENTATION_PATH,
  fs = fsDefault,
} = {}) {
  // --- base (approved, ratified) ---
  let skillText;
  try {
    if (!fs.existsSync(skillPath)) return { ok: false, error: `fail-closed: product-QA base skill not found at ${skillPath}` };
    skillText = fs.readFileSync(skillPath, 'utf8');
  } catch (e) {
    return { ok: false, error: `fail-closed: product-QA base skill unreadable (${String(e?.message ?? e)})` };
  }
  if (!skillText || !skillText.trim()) return { ok: false, error: 'fail-closed: product-QA base skill is empty' };
  const approvedSkillFingerprint = sha256(skillText);
  const fm = parseFrontmatter(skillText);
  if (!fm.ok) return { ok: false, error: 'fail-closed: product-QA base skill has no frontmatter block' };
  const approvedSkillVersion = fm.fields.version ?? null;
  const approvedSkillRatified = isTrue(fm.fields.standing_use_ratified) || fm.fields.status === 'approved';
  if (!approvedSkillRatified) {
    return {
      ok: false,
      error: `fail-closed: product-QA base skill is not ratified/approved (status="${fm.fields.status ?? '(none)'}", `
        + `standing_use_ratified=${isTrue(fm.fields.standing_use_ratified)}) — an unauthorised governing prompt must not drive a review`,
    };
  }

  // --- orientation (DRAFT — wired but flagged) ---
  let orientationText = '';
  let orientationFingerprint = null;
  let orientationApproved = false;
  try {
    if (fs.existsSync(orientationPath)) {
      orientationText = fs.readFileSync(orientationPath, 'utf8');
      orientationFingerprint = sha256(orientationText);
      const ofm = parseFrontmatter(orientationText);
      orientationApproved = isTrue(ofm.fields.governs_live) || ofm.fields.status === 'approved';
    }
  } catch { /* orientation is optional reinforcement; absence is not fatal */ }

  // The stable prompt TEMPLATE identity (skill + orientation), recorded on every review_run. The
  // per-checkpoint evidence lives in the packet (packet_hash), so the template fingerprint is
  // stable across checkpoints and identifies exactly which governing prompt produced a verdict.
  const template = `${skillText}\n\n${orientationText}`;
  const promptFingerprint = sha256(template);
  const promptVersion =
    `tower-qa-skill@${approvedSkillVersion ?? '?'}(approved)`
    + `+orientation-draft@${parseFrontmatter(orientationText).fields.version ?? '0'}`
    + `(${orientationApproved ? 'approved' : 'UNRATIFIED-draft'})`;

  /**
   * Assemble the exact per-turn product-QA prompt string handed to the reviewer as `skillText`.
   * Order (acceptance-FIRST is structural): ratified skill -> draft orientation -> ACCEPTANCE
   * CRITERIA -> PRIOR OPEN FINDINGS. The adapter appends its pointer block + staged diff AFTER
   * this, so ordinary acceptance criteria are always presented before the exotic-diff exploration.
   *
   * `packet` is the RESOLVED packet payload (from packetBuilder): { acceptance_rows[], open_findings[] }.
   */
  function assemble({ packet = {} } = {}) {
    const acc = Array.isArray(packet.acceptance_rows) ? packet.acceptance_rows : [];
    const finds = Array.isArray(packet.open_findings) ? packet.open_findings : [];

    const accBlock = acc.length
      ? acc.map((a) => `  - [${a.acceptance_ref}] ${a.requirement_text}`
          + (a.expected_proof ? `  (expected proof: ${a.expected_proof})` : '')).join('\n')
      : '  (none resolved — if acceptance criteria were required and none resolved, the packet is BLOCKED)';

    const findBlock = finds.length
      ? finds.map((f) => `  - [${f.finding_ref}] (${f.severity}) ${f.title ?? ''}`
          + ` — you MUST state: addressed / still-open / unrelated`).join('\n')
      : '  (no prior open findings for this build)';

    return [
      template,
      '',
      '════════ ACCEPTANCE CRITERIA (verify these FIRST — product-QA before any exotic probing) ════════',
      accBlock,
      '',
      '════════ PRIOR OPEN FINDINGS (you MUST account for each — no silent carry-over) ════════',
      findBlock,
      '',
    ].join('\n');
  }

  return {
    ok: true,
    error: null,
    approvedSkillText: skillText,
    approvedSkillFingerprint,
    approvedSkillVersion,
    approvedSkillRatified,
    orientationText,
    orientationFingerprint,
    orientationApproved,
    promptVersion,
    promptFingerprint,
    assemble,
  };
}
