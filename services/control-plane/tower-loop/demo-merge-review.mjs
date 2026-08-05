// BUILD-014 Tower supervisor loop — LOCAL DEMO: REAL Codex reviewing REAL Git diff evidence.
//
// Proves the FIX 1 merge-class path end-to-end WITHOUT the DB or watcher: it builds a tiny
// throwaway git repo with two commits, gathers REAL Git evidence over base..head via the
// production gatherGitEvidence(), stages it under the APPROVED Tower QA skill, and runs the
// REAL Codex merge review (runMergeReview) over the actual diff. Codex reads a real change,
// not prose. No fake reviewer here — this is the genuine article.
//
//   node demo-merge-review.mjs           (uses a throwaway repo it creates)
//   node demo-merge-review.mjs <repoDir> <baseRef> <headRef>   (review a real range)
//
// Requires a resolvable Codex binary + auth (else it prints the honest fail-closed blocker).

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { gatherGitEvidence } from './gitEvidence.mjs';
import { runMergeReview } from './supervisorCodex.mjs';
import { CODEX_CONTRACT_PATH, loadCodexContract, assertDeliveredContract } from '../review/codexAdapter.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
// WP-2G — resolved from codexAdapter.mjs's single exported constant, never re-derived here.
export const QA_SKILL = process.env.TOWER_QA_SKILL_PATH || CODEX_CONTRACT_PATH;

function git(cwd, args) { return execFileSync('git', args, { cwd, encoding: 'utf8', windowsHide: true }); }

function makeThrowawayRepo() {
  const dir = path.join(os.tmpdir(), `tower-demo-${randomUUID()}`);
  fs.mkdirSync(dir, { recursive: true });
  git(dir, ['init', '-q']);
  git(dir, ['config', 'user.email', 'demo@example.com']);
  git(dir, ['config', 'user.name', 'demo']);
  // v1: a converter that claims to turn CSV → JSON but returns the raw string (a real bug).
  fs.writeFileSync(path.join(dir, 'convert.js'),
    'export function convert(csv) {\n  // TODO: parse the CSV\n  return csv;\n}\n');
  git(dir, ['add', '-A']); git(dir, ['commit', '-qm', 'add convert stub']);
  // v2: the claimed change — implement the CSV→JSON conversion for real.
  fs.writeFileSync(path.join(dir, 'convert.js'),
    'export function convert(csv) {\n' +
    '  const [head, ...rows] = csv.trim().split("\\n");\n' +
    '  const cols = head.split(",");\n' +
    '  return JSON.stringify(rows.map((r) => Object.fromEntries(r.split(",").map((v, i) => [cols[i], v]))));\n' +
    '}\n');
  git(dir, ['add', '-A']); git(dir, ['commit', '-qm', 'implement CSV->JSON conversion']);
  return dir;
}

async function main() {
  const [repoArg, baseArg, headArg] = process.argv.slice(2);
  const repoDir = repoArg || makeThrowawayRepo();
  const headRef = headArg || 'HEAD';
  const baseRef = baseArg || 'HEAD~1';

  console.log(`repo:  ${repoDir}`);
  console.log(`range: ${baseRef}..${headRef}`);

  const evidence = await gatherGitEvidence({ cwd: repoDir, headSha: headRef, baseSha: baseRef });
  console.log(`\n── GIT EVIDENCE (real, read-only) ──`);
  console.log(`resolved=${evidence.resolved} diff_range=${evidence.diff_range}`);
  console.log(`changed_files=${JSON.stringify(evidence.changed_files)}`);
  console.log(`diff bytes=${evidence.diff_text?.length ?? 0} truncated=${evidence.diff_truncated}`);
  if (!evidence.resolved) { console.error(`\nBLOCKED — evidence unresolved: ${evidence.blocker}`); process.exit(2); }

  // WP-2G — loaded and validated fail-closed, like the two production entrypoints. A demo that
  // loads the law more loosely than the real route is a demo that proves the wrong thing.
  const contract = loadCodexContract({ contractPath: QA_SKILL });
  if (!contract.ok) { console.error(`\nBLOCKED — codex operating contract refused: ${contract.error}`); process.exit(2); }
  const provenanceError = assertDeliveredContract(contract.text, contract);
  if (provenanceError) { console.error(`\nBLOCKED — codex operating contract provenance failed: ${provenanceError}`); process.exit(2); }
  const qaSkillText = contract.text;
  console.log(`contract: ${contract.provenance} sha256=${contract.fingerprint}`);
  const packet = {
    checkpoint_id: 'demo-checkpoint', build_id: 'BUILD-014-demo',
    repo: evidence.repo, branch: evidence.branch,
    head_sha: evidence.head_sha, base_sha: evidence.base_sha, diff_range: evidence.diff_range,
    changed_files: evidence.changed_files, diff_text: evidence.diff_text, diff_truncated: evidence.diff_truncated,
    summary: "Larry's claim: convert.js now turns CSV into JSON (was a stub returning the raw string).",
    brief_ref: 'demo', brief_excerpt: 'Acceptance: convert(csv) must return JSON, not the raw CSV string.',
  };

  console.log(`\n── REAL CODEX MERGE REVIEW (Tower QA skill over the staged diff) ──`);
  const mr = await runMergeReview({ qaSkillText, packet, cwd: repoDir });
  console.log(`ok=${mr.ok} blocked=${mr.blocked} model=${mr.modelId}`);
  console.log(JSON.stringify(mr.result, null, 2));
}

// Run main() only when this file is the ENTRY POINT. Importing it — as the WP-2G reach proof does,
// to read this loader's own exported contract path rather than re-deriving it — must NOT fire a
// review: unguarded, the import built a throwaway git repo, gathered evidence and exited 2 inside
// the importing process. The guard is copied from the sibling `reviewDiff.mjs`, which already had
// it for exactly this reason.
const invokedDirectly = process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url;
if (invokedDirectly) {
  main().catch((e) => { console.error(`[demo] FAILED: ${e.stack ?? e.message}`); process.exit(1); });
}
