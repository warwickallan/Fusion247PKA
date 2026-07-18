// Tower baton — GitHub evidence collector, bound to the EXACT head SHA.
//
// Given { repo, branch, headSha, baseSha } it verifies (fail-closed) that:
//   · the head SHA exists as a real commit (git rev-parse --verify <sha>^{commit});
//   · the branch resolves and its head matches the claimed head_sha (a DIFFERENT
//     live head INVALIDATES the checkpoint — Larry pushed past it);
//   · the diff range base..head resolves → changed files;
//   · CI / check conclusions for the exact head via `gh api`.
//
// Everything binds to the exact head_sha. A new head invalidates a prior review.
//
// READ-ONLY BY CONSTRUCTION. Every shelled command passes through an ALLOWLIST:
// only read git subcommands (rev-parse, cat-file, diff, log, show, merge-base,
// ls-remote, for-each-ref) and `gh api` GET are permitted. Any mutating verb
// (git-merge, git-push, gh-pr-merge, commit, reset, ...) is REFUSED before it can
// run — this is the structural no-autonomous-merge guarantee at the evidence layer.
//
// `runCmd` is injectable: tests pass a fake that never touches a real repo or gh.

import { spawn as nodeSpawn } from 'node:child_process';

const ALLOWED_GIT = new Set([
  // read-only subcommands only. NOTE: 'branch' is deliberately EXCLUDED — `git branch -f/-D/-m`
  // are mutating and the guard only inspects the subcommand, not its flags.
  'rev-parse', 'cat-file', 'diff', 'log', 'show', 'merge-base', 'ls-remote', 'for-each-ref',
]);
// Verbs that must NEVER be shelled from this module (defence-in-depth deny-list).
const FORBIDDEN_VERBS = new Set([
  'merge', 'push', 'commit', 'rebase', 'reset', 'checkout', 'am', 'cherry-pick', 'revert', 'tag', 'fetch', 'pull', 'clean',
]);

/** Guard a command against the read-only allowlist. Throws (fail-closed) on a mutating verb. */
export function assertReadOnlyCommand(bin, args) {
  const a = Array.isArray(args) ? args : [];
  if (bin === 'git') {
    const sub = a.find((x) => !String(x).startsWith('-'));
    if (FORBIDDEN_VERBS.has(sub)) throw new Error(`githubEvidence: REFUSED mutating git verb "${sub}" (read-only collector; no autonomous merge)`);
    if (!ALLOWED_GIT.has(sub)) throw new Error(`githubEvidence: git subcommand "${sub}" is not on the read-only allowlist`);
    // Even a read subcommand can WRITE via --output=<file> (e.g. `git diff --output`). Refuse it.
    if (a.some((x) => /^--output(=|$)/.test(String(x)) || String(x) === '-o')) {
      throw new Error('githubEvidence: REFUSED git --output/-o (writes a file; read-only collector)');
    }
    return true;
  }
  if (bin === 'gh') {
    if (a[0] !== 'api') throw new Error(`githubEvidence: only "gh api" is permitted (got "gh ${a[0]}")`);
    // Reject any write method on gh api (default is GET).
    const mIdx = a.findIndex((x) => x === '-X' || x === '--method');
    if (mIdx >= 0 && !/^get$/i.test(String(a[mIdx + 1] ?? 'GET'))) {
      throw new Error(`githubEvidence: gh api write method "${a[mIdx + 1]}" refused (read-only)`);
    }
    // A `pr merge` shape can never reach here (a[0] must be 'api'); double-check anyway.
    if (a.includes('merge')) throw new Error('githubEvidence: gh command containing "merge" refused (read-only)');
    return true;
  }
  throw new Error(`githubEvidence: binary "${bin}" is not permitted (only git/gh)`);
}

/** Default real command runner (shell:false). Returns { code, stdout, stderr }. */
export function defaultRunCmd(bin, args, { cwd, timeoutMs = 20_000, spawn = nodeSpawn } = {}) {
  assertReadOnlyCommand(bin, args);
  return new Promise((resolve) => {
    let stdout = '';
    let stderr = '';
    let done = false;
    const finish = (r) => { if (!done) { done = true; resolve(r); } };
    let child;
    try {
      child = spawn(bin, args, { cwd, shell: false });
    } catch (e) {
      return finish({ code: -1, stdout: '', stderr: String(e?.message ?? e) });
    }
    const timer = setTimeout(() => { try { child.kill(); } catch { /* ignore */ } finish({ code: -2, stdout, stderr: 'command timed out' }); }, timeoutMs);
    child.stdout?.on('data', (d) => { stdout += d.toString(); });
    child.stderr?.on('data', (d) => { stderr += d.toString(); });
    child.on('error', (e) => { clearTimeout(timer); finish({ code: -1, stdout, stderr: String(e?.message ?? e) }); });
    child.on('close', (code) => { clearTimeout(timer); finish({ code, stdout, stderr }); });
  });
}

/**
 * Create the evidence collector.
 * @param {object} args
 * @param {string} [args.repoDir]  working dir of the governed local clone (git reads run here).
 * @param {string} [args.repo]     'owner/repo' for `gh api` CI reads.
 * @param {function} [args.runCmd] injectable (bin, args, opts) => { code, stdout, stderr }.
 */
export function createGithubEvidence({ repoDir = process.cwd(), repo = null, runCmd = defaultRunCmd } = {}) {
  const git = (args) => runCmd('git', args, { cwd: repoDir });
  const gh = (args) => runCmd('gh', args, { cwd: repoDir });

  return {
    /**
     * Collect evidence bound to the EXACT head SHA. Returns
     * { ok, headSha, resolved, branchHeadSha, headMatchesBranch, diffRange,
     *   changedFiles[], checks[], error }. Fail-closed: ok=false on any unresolvable
     * SHA/branch/diff, with a specific blocker in `error`.
     */
    async collect({ branch, headSha, baseSha, repo: repoOverride } = {}) {
      const ghRepo = repoOverride ?? repo;
      if (!headSha || !/^[0-9a-f]{7,40}$/i.test(headSha)) {
        return { ok: false, headSha: headSha ?? null, resolved: false, error: 'fail-closed: missing/invalid head_sha' };
      }

      // 1. head SHA must exist as a real commit.
      const verify = await git(['rev-parse', '--verify', '--quiet', `${headSha}^{commit}`]);
      if (verify.code !== 0 || !verify.stdout.trim()) {
        return { ok: false, headSha, resolved: false, error: `fail-closed: head_sha ${headSha} does not resolve to a commit in ${repoDir}` };
      }
      const resolvedHead = verify.stdout.trim();

      // 2. branch head — a DIFFERENT live head invalidates the checkpoint.
      let branchHeadSha = null;
      let headMatchesBranch = null;
      if (branch) {
        const bh = await git(['rev-parse', '--verify', '--quiet', `${branch}`]);
        if (bh.code === 0 && bh.stdout.trim()) {
          branchHeadSha = bh.stdout.trim();
          headMatchesBranch = branchHeadSha.startsWith(headSha) || resolvedHead === branchHeadSha;
        }
      }

      // 3. diff range base..head → changed files AND the actual diff CONTENT (base
      //    optional; when absent, diff the commit itself). The diff TEXT is captured
      //    read-only here and STAGED into the Codex prompt: on Windows a read-only
      //    sandbox blocks Codex's own shell/file reads, so Tower feeds it the real diff
      //    (collected via the allowlisted read-only git) rather than relying on Codex to
      //    self-navigate the disk. Bounded so a huge diff cannot blow the prompt.
      let diffRange = null;
      let changedFiles = [];
      let diffText = null;
      let diffTruncated = false;
      const DIFF_TEXT_CAP = 120_000; // ~120 KB of unified diff
      if (baseSha) {
        const baseOk = await git(['rev-parse', '--verify', '--quiet', `${baseSha}^{commit}`]);
        if (baseOk.code !== 0 || !baseOk.stdout.trim()) {
          return { ok: false, headSha: resolvedHead, resolved: true, error: `fail-closed: base_sha ${baseSha} does not resolve` };
        }
        diffRange = `${baseSha}..${headSha}`;
        const diff = await git(['diff', '--name-only', diffRange]);
        if (diff.code !== 0) return { ok: false, headSha: resolvedHead, resolved: true, error: `fail-closed: git diff ${diffRange} failed: ${diff.stderr.trim()}` };
        changedFiles = diff.stdout.split(/\r?\n/).map((s) => s.trim()).filter(Boolean);
        const full = await git(['diff', diffRange]);
        if (full.code === 0) { diffText = full.stdout; }
      } else {
        diffRange = `${headSha}^..${headSha}`;
        const show = await git(['show', '--name-only', '--pretty=format:', headSha]);
        if (show.code === 0) changedFiles = show.stdout.split(/\r?\n/).map((s) => s.trim()).filter(Boolean);
        const full = await git(['show', '--pretty=format:%H%n%an%n%s%n', headSha]);
        if (full.code === 0) { diffText = full.stdout; }
      }
      if (typeof diffText === 'string' && diffText.length > DIFF_TEXT_CAP) {
        diffText = `${diffText.slice(0, DIFF_TEXT_CAP)}\n… [diff truncated at ${DIFF_TEXT_CAP} bytes — ${changedFiles.length} files changed]`;
        diffTruncated = true;
      }

      // 4. CI / check conclusions for the exact head via `gh api` (best-effort; a
      //    blocked network is recorded as a boundary, not a hard fail).
      let checks = [];
      let checksError = null;
      if (ghRepo) {
        const res = await gh(['api', `repos/${ghRepo}/commits/${headSha}/check-runs`]);
        if (res.code === 0 && res.stdout.trim()) {
          try {
            const parsed = JSON.parse(res.stdout);
            checks = (parsed?.check_runs ?? []).map((c) => ({ name: c.name, status: c.status, conclusion: c.conclusion }));
          } catch { checksError = 'gh api check-runs returned unparseable JSON'; }
        } else {
          checksError = `gh api check-runs unavailable (code ${res.code}) — recorded as a boundary, not a bug`;
        }
      }

      return {
        ok: true,
        headSha: resolvedHead,
        resolved: true,
        branchHeadSha,
        headMatchesBranch,
        diffRange,
        changedFiles,
        diffText,
        diffTruncated,
        checks,
        checksError,
        error: null,
      };
    },
  };
}
