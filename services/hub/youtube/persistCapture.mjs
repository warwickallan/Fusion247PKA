// Durable persistence for GENERATED captures.
//
// Why this exists. The YouTube capture path writes a knowledge note and its immutable `_raw`
// transcript evidence into the vault working tree and then left them UNTRACKED. Untracked files do
// not survive `git clean`, a worktree removal, or a fresh clone — so a capture could sit on exactly
// one machine, unbacked, until a human happened to run `git status`. Two were found in that state on
// 2026-07-28, and a third appeared during the same cleanup pass, which is what proved it was a
// standing leak rather than a one-off oversight.
//
// Warwick's ruling: generated captures AUTO-PERSIST; `pending-warwick-review` remains the HUMAN
// ACCEPTANCE GATE. Those are different things:
//
//     stored / durable   !=   approved / canonical knowledge
//
// So this module commits the artefact and deliberately does NOT touch `review_state` or the
// `pending-warwick-review` tag. Persisting is not approving.
//
// DELIBERATELY NOT DONE HERE: pushing. Pushing would mean choosing a branch and a moment on the
// caller's behalf — whatever happens to be checked out, mid-work — which is exactly the "uncertain
// repository semantics" this change is meant to avoid. Committing already removes the loose-untracked
// failure mode; off-machine durability follows the branch's normal push/PR flow.
//
// FAIL-SOFT BY CONSTRUCTION: capture is the valuable work. If git is missing, the tree is not a repo,
// or the commit fails for any reason, this reports the failure and returns — it never throws, and it
// never prevents a capture from completing.

import { execFileSync } from 'node:child_process';

/** Default git runner. Returns stdout as a trimmed string; throws on non-zero exit. */
function defaultRunGit(args, cwd) {
  return execFileSync('git', args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
}

/**
 * Commit exactly the given repo-relative paths.
 *
 * @param {object}   o
 * @param {string}   o.repoRoot  absolute path to the git repository root
 * @param {string[]} o.paths     repo-relative paths to stage (files or directories)
 * @param {string}   o.message   commit message
 * @param {function} [o.runGit]  injected git runner (args, cwd) => stdout — for tests
 * @returns {{committed: boolean, sha?: string, reason?: string, error?: string, paths: string[]}}
 */
export function persistCapture({ repoRoot, paths, message, runGit = defaultRunGit }) {
  const clean = (paths || []).filter((p) => typeof p === 'string' && p.trim().length);
  if (!repoRoot) return { committed: false, reason: 'no-repo-root', paths: clean };
  if (!clean.length) return { committed: false, reason: 'no-paths', paths: clean };
  if (!message || !message.trim()) return { committed: false, reason: 'no-message', paths: clean };

  try {
    // Stage ONLY the generated artefacts. `--` guards paths that begin with a dash, and naming each
    // path explicitly means unrelated work in the tree is never swept into this commit.
    runGit(['add', '--', ...clean], repoRoot);

    // Nothing staged => the capture was already persisted (writeNote is idempotent on videoId, so a
    // re-run is normal and must not produce an empty commit).
    const staged = runGit(['diff', '--cached', '--name-only', '--', ...clean], repoRoot);
    if (!staged) return { committed: false, reason: 'no-changes', paths: clean };

    // Commit ONLY these pathspecs, so a commit is correct even if the caller's tree has other
    // staged work in progress.
    runGit(['commit', '-m', message, '--only', '--', ...clean], repoRoot);
    const sha = runGit(['rev-parse', 'HEAD'], repoRoot);
    return { committed: true, sha, paths: clean };
  } catch (e) {
    const error = (e && (e.stderr?.toString?.() || e.message)) || String(e);
    return { committed: false, reason: 'git-failed', error: error.trim().split('\n').slice(0, 3).join(' | '), paths: clean };
  }
}

/**
 * Build the commit message for a generated capture. Records that the artefact is stored but NOT
 * approved, so the distinction survives in git history rather than only in frontmatter.
 */
export function captureCommitMessage({ videoId, title, reviewState = 'ai_created' }) {
  const t = (title || '').replace(/\s+/g, ' ').trim();
  return [
    `Capture: ${videoId}${t ? ` — ${t.slice(0, 72)}` : ''}`,
    '',
    'Auto-persisted by the YouTube capture path so the note and its immutable _raw',
    'transcript evidence cannot sit untracked on a single machine.',
    '',
    `review_state: ${reviewState} — STORED, NOT APPROVED. pending-warwick-review remains`,
    'the human acceptance gate; persisting a capture never accepts it.',
  ].join('\n');
}
