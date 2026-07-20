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
// The assembled per-turn prompt = [ratified skill] + [APPROVED+LIVE classification amendment] +
// [orientation] + [resolved evidence: ALL acceptance criteria, then ALL prior open findings].
// Acceptance criteria are injected BEFORE the adapter appends the staged diff, so acceptance-first
// ordering is STRUCTURAL, not merely requested. EVERY reviewer (Codex, adversarial/Fable, a future
// Grok) receives this same composed prompt. The reviewer subprocess still receives ONLY this staged
// text (secret-stripping in the adapters is preserved) — never DB or GitHub credentials.
//
// PR-2b COMPLETION provenance change (Condition 4): Warwick APPROVED the orientation body hash
// (cd65539a…253135) for the DEV/synthetic BUILD-014 campaign — recorded in prompts/prompt-approvals
// .json WITHOUT editing the orientation's own bytes/frontmatter (that exact hash is what he approved).
// When the on-disk orientation fingerprint matches an approved-for-campaign entry, its provenance
// stamp becomes APPROVED_FOR_BUILD_014_DEV_CAMPAIGN (governs_live=false) rather than UNRATIFIED-draft.

import crypto from 'node:crypto';
import fsDefault from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Repo-root-relative default paths. review/ -> control-plane/ -> services/ -> repo root.
export const DEFAULT_APPROVED_SKILL_PATH = path.resolve(
  __dirname, '..', '..', '..', 'Builds', 'BUILD-010-fusion-tower', 'baton-mvp', 'tower-qa-skill.md');
export const DEFAULT_CLASSIFICATION_PATH = path.resolve(
  __dirname, 'prompts', 'reviewer-classification-amendment.md');
export const DEFAULT_ORIENTATION_PATH = path.resolve(
  __dirname, 'prompts', 'product-qa-runtime-orientation.md');
export const DEFAULT_APPROVALS_PATH = path.resolve(
  __dirname, 'prompts', 'prompt-approvals.json');

const CAMPAIGN_SCOPE = 'BUILD_014_DEV_CAMPAIGN';

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
  classificationPath = DEFAULT_CLASSIFICATION_PATH,
  orientationPath = DEFAULT_ORIENTATION_PATH,
  approvalsPath = DEFAULT_APPROVALS_PATH,
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

  // --- classification amendment (APPROVED + LIVE governance — fail-closed like the base) ---
  // The three-judgement classifier + merge rule + R1 + R2 + round-economy is LIVE governance (Warwick,
  // 2026-07-19). It is load-bearing, so a missing/empty/unratified amendment fails the load.
  let classificationText;
  try {
    if (!fs.existsSync(classificationPath)) return { ok: false, error: `fail-closed: reviewer-classification-amendment not found at ${classificationPath}` };
    classificationText = fs.readFileSync(classificationPath, 'utf8');
  } catch (e) {
    return { ok: false, error: `fail-closed: reviewer-classification-amendment unreadable (${String(e?.message ?? e)})` };
  }
  if (!classificationText || !classificationText.trim()) return { ok: false, error: 'fail-closed: reviewer-classification-amendment is empty' };
  const classificationFingerprint = sha256(classificationText);
  const cfm = parseFrontmatter(classificationText);
  const classificationVersion = cfm.fields.version ?? null;
  const classificationRatified = isTrue(cfm.fields.governs_live) || cfm.fields.status === 'approved';
  if (!classificationRatified) {
    return {
      ok: false,
      error: `fail-closed: reviewer-classification-amendment is not approved/live (status="${cfm.fields.status ?? '(none)'}", `
        + `governs_live=${isTrue(cfm.fields.governs_live)}) — the classifier is LIVE governance and must be ratified to drive a review`,
    };
  }

  // --- orientation (DRAFT — wired; live-approval flagged; campaign-approval read from the record) ---
  let orientationText = '';
  let orientationFingerprint = null;
  let orientationApproved = false;      // LIVE governance approval (from the .md frontmatter) — stays false
  let orientationVersion = '0';
  try {
    if (fs.existsSync(orientationPath)) {
      orientationText = fs.readFileSync(orientationPath, 'utf8');
      orientationFingerprint = sha256(orientationText);
      const ofm = parseFrontmatter(orientationText);
      orientationApproved = isTrue(ofm.fields.governs_live) || ofm.fields.status === 'approved';
      orientationVersion = ofm.fields.version ?? '0';
    }
  } catch { /* orientation is optional reinforcement; absence is not fatal */ }

  // --- campaign approval record (Condition 4) — consent bound to the exact on-disk orientation hash,
  // WITHOUT editing the approved artifact's bytes. governs_live stays false, so readiness/live remain gated.
  let campaignEntry = null;
  try {
    if (orientationFingerprint && fs.existsSync(approvalsPath)) {
      const parsed = JSON.parse(fs.readFileSync(approvalsPath, 'utf8'));
      const approvals = Array.isArray(parsed?.approvals) ? parsed.approvals : [];
      campaignEntry = approvals.find((a) => a && a.fingerprint === orientationFingerprint && a.scope === CAMPAIGN_SCOPE) ?? null;
    }
  } catch { /* an unreadable/malformed approvals record is treated as NO campaign approval (fail-closed) */ }
  const orientationCampaignApproved = Boolean(campaignEntry);

  // The stable prompt TEMPLATE identity = base + classification + orientation, recorded on every
  // review_run. Per-checkpoint evidence lives in the packet (packet_hash); this template fingerprint
  // is stable across checkpoints and identifies exactly which composed governing prompt produced a verdict.
  const template = `${skillText}\n\n${classificationText}\n\n${orientationText}`;
  const promptFingerprint = sha256(template);
  const composedFingerprint = promptFingerprint;
  const short = (h) => String(h ?? '').slice(0, 12);
  const orientationStamp = orientationCampaignApproved
    ? `orientation@${orientationVersion}(APPROVED_FOR_${CAMPAIGN_SCOPE};approved_by=${campaignEntry.approved_by};governs_live=${campaignEntry.governs_live})`
    : (orientationApproved ? `orientation@${orientationVersion}(approved)` : `orientation-draft@${orientationVersion}(UNRATIFIED-draft)`);
  // prompt_version records ALL THREE component fingerprints (short) + the provenance stamps; the full
  // composed fingerprint is bound separately on review_run.prompt_fingerprint.
  const promptVersion =
    `tower-qa-skill@${approvedSkillVersion ?? '?'}(approved;fp=${short(approvedSkillFingerprint)})`
    + `+classification-amendment@${classificationVersion ?? '?'}(APPROVED_LIVE;fp=${short(classificationFingerprint)})`
    + `+${orientationStamp};orientation_fp=${short(orientationFingerprint)}`;

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
      ? acc.map((a) => `  - [${a.acceptance_ref}] (row_id: ${a.id}) ${a.requirement_text}`
          + (a.expected_proof ? `  (expected proof: ${a.expected_proof})` : '')).join('\n')
      : '  (none resolved — if acceptance criteria were required and none resolved, the packet is BLOCKED)';

    const findBlock = finds.length
      ? finds.map((f) => `  - [${f.finding_ref}] (id: ${f.id}) (${f.severity}) ${f.title ?? ''}`
          + ` — you MUST state a prior_finding_results status: addressed / remains_open / unrelated`).join('\n')
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
      '════════ REQUIRED MACHINE-READABLE OUTPUT (fail-closed — answers in typed arrays, NEVER in prose) ════════',
      '  · acceptance_results[]: one {acceptance_row_id, result∈{pass,fail,partial,blocked,not_applicable},',
      '    rationale, evidence} for EVERY acceptance criterion above (a missing one BLOCKS the review).',
      '  · prior_finding_results[]: one {finding_id, status∈{addressed,remains_open,unrelated}, rationale}',
      '    for EVERY prior open finding above (an omitted disposition BLOCKS — no silent carry-over).',
      '  · findings[]: each {id, technical_impact∈{BLOCKER,HIGH,MEDIUM,LOW,NOTE}, reachability∈{ACTIVE,',
      '    LATENT,HYPOTHETICAL}, required_disposition∈{BLOCKS_CURRENT_MERGE,REQUIRED_BEFORE_LIVE,',
      '    REQUIRED_BEFORE_EXTERNAL_OR_UNTRUSTED_ACCESS,TRACKED_FOLLOWUP,NOTE_ONLY},',
      '    assumed_deployment_baseline, evidence, required_correction}. DISPOSITION (not severity) decides',
      '    the merge: only a BLOCKS_CURRENT_MERGE finding (or a failed acceptance) blocks; an improvement',
      '    (NOTE_ONLY / TRACKED_FOLLOWUP) never blocks (reviewer-classification amendment, above).',
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
    classificationText,
    classificationFingerprint,
    classificationVersion,
    classificationRatified,
    orientationText,
    orientationFingerprint,
    orientationVersion,
    orientationApproved,               // LIVE governance approval — stays false (Warwick-gated)
    orientationCampaignApproved,       // DEV/synthetic BUILD-014 campaign approval (bound to the hash)
    orientationApprovalScope: campaignEntry?.scope ?? null,
    orientationApprovedBy: campaignEntry?.approved_by ?? null,
    orientationGovernsLive: campaignEntry ? Boolean(campaignEntry.governs_live) : false,
    promptVersion,
    promptFingerprint,
    composedFingerprint,               // = base + classification + orientation (recomputed this PR)
    assemble,
  };
}
