// Bounded Codex review of a REAL diff against a REAL claim.
//
// WHY THIS EXISTS. `demo-merge-review.mjs` accepts <repoDir> <baseRef> <headRef> and will
// happily stage a real diff — but its checkpoint packet is hard-coded to the throwaway
// demo's claim ("convert.js now turns CSV into JSON"). Point it at real work and Codex
// faithfully reviews a real diff against a fabricated, unrelated claim. Observed
// 2026-08-02 reviewing a CLAUDE.md commit: verdict `request_changes`, HIGH,
// BLOCKS_CURRENT_MERGE, refuting a CSV-converter claim that no one had made. The verdict
// was literally true and entirely meaningless.
//
// That failure mode is worse than a blocked review, because it is silent. A trivially
// satisfiable demo claim could just as easily have produced a FALSE GREEN over a real
// change nobody actually reviewed. Tower's own bar (BUILD-010 §4) is that the diff must
// be genuinely staged into Codex's prompt; this file extends the same bar to the CLAIM.
//
// WHAT IS REUSED, DELIBERATELY. Everything that does real work: gatherGitEvidence for the
// evidence, runMergeReview + the approved Tower QA skill for the review, and therefore
// codexAdapter's fail-closed binary/auth resolution. This module replaces exactly one
// thing — the fabricated claim — and adds no new review logic. The operating reset's
// regrowth cap says a new mechanism must show that no existing route suffices; the run
// described above IS that evidence.
//
//   node reviewDiff.mjs --repo <dir> --base <ref> --head <ref> --claim <claim.json>
//
// claim.json supplies the five fields the demo hard-codes:
//   { "checkpoint_id", "build_id", "summary", "brief_ref", "brief_excerpt" }
// `summary` is the claim being tested; `brief_excerpt` carries the acceptance criteria.
// All other packet fields come from real git evidence and are never author-supplied.
//
// Fail-closed, like the rest of the path: unresolved evidence, a missing claim file, or a
// claim missing `summary`/`brief_excerpt` exits non-zero rather than reviewing against a
// blank or partial claim. Reviewing against no claim is the defect this file exists to
// prevent, so it must never be reachable by omission.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { gatherGitEvidence } from './gitEvidence.mjs';
import { runMergeReview } from './supervisorCodex.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const QA_SKILL = process.env.TOWER_QA_SKILL_PATH
  || path.join(__dirname, '..', '..', '..', 'Builds', 'BUILD-010-fusion-tower', 'baton-mvp', 'tower-qa-skill.md');

function arg(name, def = undefined) {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : def;
}

function die(msg, code = 2) {
  console.error(`BLOCKED — ${msg}`);
  process.exit(code);
}

async function main() {
  const repoDir = arg('repo');
  const baseRef = arg('base');
  const headRef = arg('head');
  const claimPath = arg('claim');
  if (!repoDir || !baseRef || !headRef || !claimPath) {
    die('usage: node reviewDiff.mjs --repo <dir> --base <ref> --head <ref> --claim <claim.json>');
  }
  if (!fs.existsSync(claimPath)) die(`claim file not found: ${claimPath}`);

  let claim;
  try {
    claim = JSON.parse(fs.readFileSync(claimPath, 'utf8'));
  } catch (e) {
    die(`claim file is not valid JSON: ${e.message}`);
  }
  // The whole point of this module. Never review against an absent claim.
  for (const field of ['summary', 'brief_excerpt']) {
    if (typeof claim[field] !== 'string' || claim[field].trim() === '') {
      die(`claim.${field} is required and must be a non-empty string — reviewing a real diff against no claim is exactly the defect this module prevents`);
    }
  }

  console.log(`repo:  ${repoDir}`);
  console.log(`range: ${baseRef}..${headRef}`);
  console.log(`claim: ${claimPath}`);

  const evidence = await gatherGitEvidence({ cwd: repoDir, headSha: headRef, baseSha: baseRef });
  console.log(`\n── GIT EVIDENCE (real, read-only) ──`);
  console.log(`resolved=${evidence.resolved} diff_range=${evidence.diff_range}`);
  console.log(`changed_files=${JSON.stringify(evidence.changed_files)}`);
  console.log(`diff bytes=${evidence.diff_text?.length ?? 0} truncated=${evidence.diff_truncated}`);
  if (!evidence.resolved) die(`evidence unresolved: ${evidence.blocker}`);
  if (!evidence.changed_files?.length) die('no changed files in range — nothing to review');
  if (evidence.diff_truncated) {
    // Not fatal, but it must be visible: a truncated diff means Codex did not see all of it.
    console.log('WARNING: diff was TRUNCATED — the verdict does not cover the whole change.');
  }

  const packet = {
    checkpoint_id: claim.checkpoint_id ?? `review-${evidence.head_sha?.slice(0, 10)}`,
    build_id: claim.build_id ?? 'unscoped',
    repo: evidence.repo,
    branch: evidence.branch,
    head_sha: evidence.head_sha,
    base_sha: evidence.base_sha,
    diff_range: evidence.diff_range,
    changed_files: evidence.changed_files,
    diff_text: evidence.diff_text,
    diff_truncated: evidence.diff_truncated,
    summary: claim.summary,
    brief_ref: claim.brief_ref ?? claimPath,
    brief_excerpt: claim.brief_excerpt,
  };

  console.log(`\n── REAL CODEX MERGE REVIEW (Tower QA skill over the staged diff + the REAL claim) ──`);
  const mr = await runMergeReview({ qaSkillText: fs.readFileSync(QA_SKILL, 'utf8'), packet, cwd: repoDir });
  console.log(`ok=${mr.ok} blocked=${mr.blocked} model=${mr.modelId}`);
  if (mr.blocked) die(`codex review blocked: ${mr.blocker ?? 'unknown'}`, 3);
  console.log(JSON.stringify(mr.result, null, 2));
}

main().catch((e) => { console.error(`[reviewDiff] FAILED: ${e.stack ?? e.message}`); process.exit(1); });
