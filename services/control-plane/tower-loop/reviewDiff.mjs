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
// plus two optional ones: "wp_id" (explicitly nullable) and "scoped_to" (see below).
// `summary` is the claim being tested; `brief_excerpt` carries the acceptance criteria.
// All other packet fields come from real git evidence and are never author-supplied.
//
// Fail-closed, like the rest of the path: unresolved evidence, a missing claim file, or a
// claim missing `summary`/`brief_excerpt` exits non-zero rather than reviewing against a
// blank or partial claim. Reviewing against no claim is the defect this file exists to
// prevent, so it must never be reachable by omission.
//
// IDENTITY IS VALIDATED, NOT INVENTED (TQA-TOOL-003). `checkpoint_id`, `build_id` and
// `brief_ref` were `??`-defaulted, so a claim naming none of them still produced a
// confident-looking record that identified itself as `review-<sha>` / `unscoped` / the
// claim file's own path. A record that silently fills in its own identity is a weaker
// record than one that refuses. `wp_id` is carried as an EXPLICIT NULL rather than
// required: the defect is invented defaults passing silently, not a missing optional
// identifier, and an honest `(none)` beats a fabricated value. (A reviewer flagged
// "branch is unknown and wp_id is absent" from inside a packet before this was audited
// for — the record's own weakness was legible to the party relying on it.)

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
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

// The claim itself. Absent or blank ⇒ there is nothing to review the diff AGAINST, which is
// the whole reason this module exists. Never relax these two.
export const CLAIM_FIELDS = Object.freeze(['summary', 'brief_excerpt']);
// The record's identity. Absent ⇒ REFUSE; never substitute a plausible-looking default.
export const IDENTITY_FIELDS = Object.freeze(['checkpoint_id', 'build_id', 'brief_ref']);

/** One normalisation, used for BOTH the git pathspec and the claim's scope check. */
export function normalisePaths(raw) {
  if (raw == null) return [];
  const list = Array.isArray(raw) ? raw : String(raw).split(',');
  return list.map((p) => String(p).trim()).filter(Boolean);
}

const nonEmptyString = (v) => typeof v === 'string' && v.trim() !== '';

/**
 * Validate a claim against the review's actual scope. Returns an array of error strings —
 * empty means valid. Every error NAMES the field, because "the claim is invalid" sends the
 * reader hunting.
 *
 * @param {object} claim  the parsed claim.json
 * @param {string[]} paths  the NORMALISED pathspec this review is actually scoped to ([] = whole range)
 */
export function validateClaim(claim, { paths = [] } = {}) {
  const errors = [];
  if (!claim || typeof claim !== 'object' || Array.isArray(claim)) return ['claim must be a JSON object'];

  for (const field of CLAIM_FIELDS) {
    if (!nonEmptyString(claim[field])) {
      errors.push(`claim.${field} is required and must be a non-empty string — reviewing a real diff against no claim is exactly the defect this module prevents`);
    }
  }
  for (const field of IDENTITY_FIELDS) {
    if (!nonEmptyString(claim[field])) {
      errors.push(`claim.${field} is required and must be a non-empty string — this module validates the record's identity rather than inventing it`);
    }
  }
  if ('wp_id' in claim && claim.wp_id !== null && !nonEmptyString(claim.wp_id)) {
    errors.push('claim.wp_id, when present, must be a non-empty string or an explicit null');
  }

  // OPTIONAL machine-checked scope disclosure.
  //
  // The scope of a review used to reach the reviewer only because the author remembered to
  // write it into the claim prose. Audited across ten scoped runs, that sentence was missing
  // once. Parsing prose to detect the contradiction cannot be made reliable and would
  // false-positive on correct reviews — a check that cries wolf gets switched off. An
  // EXPLICIT array can be checked exactly: when present it must set-equal the pathspec the
  // review actually ran with, and when absent nothing happens, so every existing claim file
  // keeps working unchanged.
  if ('scoped_to' in claim && claim.scoped_to !== null) {
    if (!Array.isArray(claim.scoped_to) || claim.scoped_to.some((p) => !nonEmptyString(p))) {
      errors.push('claim.scoped_to, when present, must be an array of non-empty strings (or null)');
    } else {
      const declared = [...new Set(claim.scoped_to.map((p) => p.trim()))];
      const actual = [...new Set(paths)];
      const same = declared.length === actual.length && declared.every((p) => actual.includes(p));
      if (!same) {
        errors.push(`claim.scoped_to disagrees with the review's actual scope — claim declares [${declared.join(', ')}], the review is scoped to [${actual.join(', ') || '(unscoped — the whole range)'}]`);
      }
    }
  }
  return errors;
}

/**
 * Build the review packet. THE PACKET MUST NEVER DESCRIBE COVERAGE IT DID NOT DELIVER.
 *
 * The scope is taken from `evidence.scoped_to` — what the gatherer actually applied — not
 * from what the caller intended, so the packet cannot claim a scope the diff does not have.
 *
 * `diff_range` is rendered in GIT'S OWN SYNTAX, `<base>..<head> -- <path>…`, for one
 * structural reason: `buildCodexPrompt` renders a FIXED WHITELIST of packet keys and
 * silently drops anything it does not know, so a bare `scoped_to` field would satisfy this
 * on its face and reach the reviewer NOT AT ALL. Folding the pathspec into `diff_range`
 * puts it through both whitelisted renderings (the `diff_range:` pointer line and the
 * "── STAGED DIFF (…)" header), and the result is copy-pasteable straight into git, so a
 * reader can reproduce exactly what was reviewed. `scoped_to` is kept as the machine field.
 *
 * The previous packet sent the FULL base..head range alongside a scoped `diff_text`, so it
 * contradicted itself: `changed_files` told the truth while `diff_range` did not, and
 * resolving that was left to the reviewer. One did — refusing to grade twelve rows it could
 * not see — but a packet whose honesty depends on the reader catching it is not an
 * instrument. These two now agree.
 *
 * NOTE the boundary: this annotation happens HERE, at packet construction. `evidence.diff_range`
 * inside gitEvidence.mjs stays a pure machine range, because watcher.mjs persists it,
 * mergeCheck.mjs stages it and accept.mjs gates on it.
 */
export function buildReviewPacket({ evidence, claim }) {
  const scope = Array.isArray(evidence.scoped_to) ? evidence.scoped_to.filter(Boolean) : [];
  const scoped = scope.length > 0;
  return {
    checkpoint_id: claim.checkpoint_id,
    build_id: claim.build_id,
    wp_id: nonEmptyString(claim.wp_id) ? claim.wp_id.trim() : null,
    repo: evidence.repo,
    branch: evidence.branch,
    head_sha: evidence.head_sha,
    base_sha: evidence.base_sha,
    diff_range: scoped ? `${evidence.diff_range} -- ${scope.join(' ')}` : evidence.diff_range,
    scoped_to: scoped ? scope.slice() : null,
    changed_files: evidence.changed_files,
    diff_text: evidence.diff_text,
    diff_truncated: evidence.diff_truncated,
    summary: claim.summary,
    brief_ref: claim.brief_ref,
    brief_excerpt: claim.brief_excerpt,
  };
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

  const scopePaths = normalisePaths(arg('paths'));
  // Validate BEFORE spending a git walk or a Codex call. Every failure names its field.
  const claimErrors = validateClaim(claim, { paths: scopePaths });
  if (claimErrors.length) die(`claim ${claimPath} is not reviewable:\n  - ${claimErrors.join('\n  - ')}`);

  console.log(`repo:  ${repoDir}`);
  console.log(`range: ${baseRef}..${headRef}`);
  console.log(`claim: ${claimPath}`);

  // NOTE ON SCOPE, and why there is no --paths flag here.
  // gatherGitEvidence caps the diff at MAX_DIFF_BYTES (60k) and TRUNCATES beyond it. A
  // truncated diff means the verdict does not cover the whole change — a false green
  // wearing a pass. Observed 2026-08-02: the Phase 5 range returned `approve` with 20/20
  // rows over a TRUNCATED diff, because deleting 16 files puts the full text of every
  // deleted file into the diff.
  // --paths scopes the range so a large change can be reviewed WITHOUT truncation. It was
  // briefly drafted, then removed on finding gatherGitEvidence had no pathspec (an option
  // that silently does nothing is the same defect class this module exists to catch), and
  // is restored here only now that gitEvidence.mjs genuinely supports it and the
  // unscoped path is proven byte-identical to before.
  // Scoping is a promise you owe the reader: whatever you exclude MUST be verified another
  // way and SAID OUT LOUD. That promise is now carried BY THE PACKET (see buildReviewPacket)
  // rather than by the author remembering to write it into the claim prose — and, when the
  // claim declares `scoped_to`, it is machine-checked against this pathspec above.
  // Truncation is still flagged loudly below, because a scoped diff can overflow too.
  // Resolve the branch rather than leaving it '(unknown)'. Codex flagged this as a
  // record-hygiene defect (TQA-002) and it was right: a review packet that cannot say
  // which branch it reviewed is not a durable record, however good the verdict.
  let branch = arg('branch') ?? null;
  if (!branch) {
    try {
      const { execFileSync } = await import('node:child_process');
      branch = execFileSync('git', ['rev-parse', '--abbrev-ref', 'HEAD'], { cwd: repoDir, encoding: 'utf8', windowsHide: true }).trim() || null;
    } catch { branch = null; }
  }
  const evidence = await gatherGitEvidence({
    cwd: repoDir, headSha: headRef, baseSha: baseRef, branch,
    ...(scopePaths.length ? { paths: scopePaths } : {}),
  });
  if (scopePaths.length) console.log(`scope  : ${scopePaths.join(' ')}`);
  console.log(`branch : ${branch ?? '(unresolved)'}`);
  console.log(`\n── GIT EVIDENCE (real, read-only) ──`);
  console.log(`resolved=${evidence.resolved} diff_range=${evidence.diff_range}`);
  console.log(`changed_files=${JSON.stringify(evidence.changed_files)}`);
  console.log(`diff bytes=${evidence.diff_bytes} of ${evidence.diff_total_bytes} (real UTF-8 bytes) truncated=${evidence.diff_truncated}`);
  if (!evidence.resolved) die(`evidence unresolved: ${evidence.blocker}`);
  if (!evidence.changed_files?.length) die('no changed files in range — nothing to review');
  if (evidence.diff_truncated) {
    // Not fatal, but it must be visible: a truncated diff means Codex did not see all of it.
    console.log('WARNING: diff was TRUNCATED — the verdict does not cover the whole change.');
  }

  const packet = buildReviewPacket({ evidence, claim });
  console.log(`packet diff_range=${packet.diff_range}`);
  console.log(`packet scoped_to=${JSON.stringify(packet.scoped_to)} wp_id=${JSON.stringify(packet.wp_id)}`);

  console.log(`\n── REAL CODEX MERGE REVIEW (Tower QA skill over the staged diff + the REAL claim) ──`);
  const mr = await runMergeReview({ qaSkillText: fs.readFileSync(QA_SKILL, 'utf8'), packet, cwd: repoDir });
  console.log(`ok=${mr.ok} blocked=${mr.blocked} model=${mr.modelId}`);
  if (mr.blocked) die(`codex review blocked: ${mr.blocker ?? 'unknown'}`, 3);
  console.log(JSON.stringify(mr.result, null, 2));
}

// Run main() only when this file is the entry point. Importing it (as the proofs in
// test/reviewTooling.test.mjs do) must NOT fire a review — the packet-construction and
// claim-validation logic has to be reachable without invoking Codex, or it cannot be tested.
const invokedDirectly = process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url;
if (invokedDirectly) {
  main().catch((e) => { console.error(`[reviewDiff] FAILED: ${e.stack ?? e.message}`); process.exit(1); });
}
