// BUILD-014 Tower supervisor loop — REAL Git evidence gatherer for merge-class turns (FIX 1).
//
// A merge-class turn must be reviewed against ACTUAL Git evidence, not prose. This module
// collects that evidence READ-ONLY via `git` and `gh` (never a write, never a merge): the
// exact repo/branch/base+head SHA, the base..head unified diff, changed files, and CI
// conclusions. It is FAIL-CLOSED: if the head or the diff cannot be resolved, `resolved` is
// false and `blocker` explains why — the caller must then BLOCK the review (never assume-and-
// pass). CI conclusions from `gh` are best-effort (an unauthenticated/absent gh is recorded
// honestly as unavailable, which is a weaker signal, not a hard block).
//
// Nothing here talks to the DB or holds a Telegram/Supabase secret. It only shells read-only
// git/gh in the given repo dir.

import { spawn as nodeSpawn } from 'node:child_process';

const DEFAULT_TIMEOUT_MS = 30_000;
// Bound the staged diff so a huge PR cannot blow the Codex context. Truncation is flagged.
const MAX_DIFF_BYTES = 60_000;

function run(cmd, args, { cwd, timeoutMs = DEFAULT_TIMEOUT_MS, spawn = nodeSpawn } = {}) {
  return new Promise((resolve) => {
    let stdout = '';
    let stderr = '';
    let done = false;
    const finish = (r) => { if (!done) { done = true; resolve(r); } };
    let child;
    try {
      child = spawn(cmd, args, { cwd, shell: false });
    } catch (e) {
      return finish({ ok: false, code: -1, stdout: '', stderr: String(e?.message ?? e) });
    }
    const timer = setTimeout(() => { try { child.kill('SIGKILL'); } catch { /* ignore */ } finish({ ok: false, code: -2, stdout, stderr: `timed out after ${timeoutMs}ms` }); }, timeoutMs);
    child.stdout?.on('data', (d) => { stdout += d.toString(); });
    child.stderr?.on('data', (d) => { stderr += d.toString(); });
    child.on('error', (e) => { clearTimeout(timer); finish({ ok: false, code: -1, stdout, stderr: String(e?.message ?? e) }); });
    child.on('close', (code) => { clearTimeout(timer); finish({ ok: code === 0, code, stdout, stderr }); });
  });
}

/**
 * Gather read-only Git evidence for a merge-class turn.
 *
 * @param {object} args
 * @param {string} args.cwd          repo working dir to run git/gh in (must be a git repo).
 * @param {string} [args.repo]       owner/name (for gh; optional — gh infers from cwd remote).
 * @param {string} [args.branch]     branch under review (recorded; not required to resolve).
 * @param {string} [args.baseSha]    base ref/sha. Falls back to the merge-base with HEAD~ if absent.
 * @param {string} [args.headSha]    exact head ref/sha under review. Falls back to HEAD.
 * @param {number} [args.prNumber]   PR number (for `gh pr checks`).
 * @param {Function} [args.spawn]    injectable spawn (tests).
 * @returns {Promise<object>} evidence packet (see fields below). `resolved` false ⇒ caller BLOCKS.
 */
export async function gatherGitEvidence({ cwd, repo = null, branch = null, baseSha = null, headSha = null, prNumber = null, spawn = nodeSpawn } = {}) {
  const ev = {
    resolved: false, blocker: null,
    repo, branch, base_sha: null, head_sha: null, diff_range: null,
    changed_files: [], diff_text: null, diff_truncated: false,
    ci_checks: null, ci_source: 'unavailable',
    collected_at: new Date().toISOString(),
  };
  const g = (args) => run('git', args, { cwd, spawn });

  // Resolve HEAD (fail-closed).
  const headRef = headSha || 'HEAD';
  const headRes = await g(['rev-parse', '--verify', `${headRef}^{commit}`]);
  if (!headRes.ok) {
    ev.blocker = `head unresolvable (${headRef}): ${String(headRes.stderr).trim().slice(0, 200)}`;
    return ev;
  }
  ev.head_sha = headRes.stdout.trim();

  // Resolve base: explicit base if given, else merge-base(head, head~1) as a minimal default.
  let baseResolved = null;
  if (baseSha) {
    const baseRes = await g(['rev-parse', '--verify', `${baseSha}^{commit}`]);
    if (!baseRes.ok) {
      ev.blocker = `base unresolvable (${baseSha}): ${String(baseRes.stderr).trim().slice(0, 200)}`;
      return ev;
    }
    baseResolved = baseRes.stdout.trim();
  } else {
    const parentRes = await g(['rev-parse', '--verify', `${ev.head_sha}~1^{commit}`]);
    if (!parentRes.ok) {
      ev.blocker = `no base_sha given and head has no parent to diff against: ${String(parentRes.stderr).trim().slice(0, 200)}`;
      return ev;
    }
    baseResolved = parentRes.stdout.trim();
  }
  ev.base_sha = baseResolved;
  ev.diff_range = `${ev.base_sha}..${ev.head_sha}`;

  // Changed files (fail-closed).
  const namesRes = await g(['diff', '--name-only', ev.diff_range]);
  if (!namesRes.ok) {
    ev.blocker = `diff range unresolvable (${ev.diff_range}): ${String(namesRes.stderr).trim().slice(0, 200)}`;
    return ev;
  }
  ev.changed_files = namesRes.stdout.split(/\r?\n/).filter(Boolean);

  // Unified diff (bounded). No context bloat; bounded bytes; truncation flagged.
  const diffRes = await g(['diff', '--no-color', ev.diff_range]);
  if (!diffRes.ok) {
    ev.blocker = `unable to collect unified diff for ${ev.diff_range}: ${String(diffRes.stderr).trim().slice(0, 200)}`;
    return ev;
  }
  let diff = diffRes.stdout;
  if (diff.length > MAX_DIFF_BYTES) {
    diff = `${diff.slice(0, MAX_DIFF_BYTES)}\n… [diff truncated at ${MAX_DIFF_BYTES} bytes of ${diffRes.stdout.length}] …`;
    ev.diff_truncated = true;
  }
  ev.diff_text = diff;

  // CI conclusions via gh — best-effort (an absent/unauth gh is honestly 'unavailable').
  if (prNumber != null) {
    const args = ['pr', 'checks', String(prNumber)];
    if (repo) args.push('--repo', repo);
    const ci = await run('gh', args, { cwd, spawn, timeoutMs: DEFAULT_TIMEOUT_MS });
    if (ci.ok || ci.stdout.trim()) {
      ev.ci_checks = String(ci.stdout).trim().slice(0, 4000) || String(ci.stderr).trim().slice(0, 400);
      ev.ci_source = ci.ok ? 'gh pr checks' : 'gh pr checks (non-zero — checks may be pending/failing)';
    } else {
      ev.ci_checks = `gh pr checks unavailable: ${String(ci.stderr).trim().slice(0, 200)}`;
      ev.ci_source = 'unavailable';
    }
  }

  // Diff + head + base + changed files all resolved: evidence is trustworthy for review.
  ev.resolved = true;
  return ev;
}
