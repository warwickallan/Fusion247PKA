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

// WO-27 (Warwick, 2026-08-07): "treat today's index.lock event as an operational durability case, not
// just a one-off Larry accident. Parallel workers and orchestration are normal. A transient shared-Git
// lock must not leave a successfully generated capture permanently uncommitted."
//
// Two things were added for that, and they are deliberately the SMALLEST pair that closes it:
//   1. a bounded retry at the moment of failure, for TRANSIENT lock contention only;
//   2. `captureIsPersisted` — a probe of what git ACTUALLY holds, so a later pass can reconcile a
//      capture that was stranded anyway, and so a briefing is never built on a claim.
//
// The probe exists because the returned `committed` flag is a claim about the past. A claimed commit is
// not a durable commit, and the whole point of the briefing is to stop a green outrunning durability.

import { execFileSync } from 'node:child_process';

/** Default git runner. Returns stdout as a trimmed string; throws on non-zero exit. */
export function defaultRunGit(args, cwd) {
  return execFileSync('git', args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true }).trim();
}

/**
 * Lock contention that WILL clear on its own, versus a real failure that will not.
 *
 * Retrying a genuine error (not a repo, bad pathspec, nothing to commit) buys nothing and delays the
 * capture, so the retry is scoped to this shape only. NOTE: a lock is never DELETED here — a stale
 * `.git/index.lock` can still belong to a live process, and removing one is how a concurrent commit
 * gets corrupted. This waits; if the lock is still held it hands the capture to the reconcile pass.
 */
const TRANSIENT_GIT_LOCK = /index\.lock|cannot lock ref|Unable to create|another git process|File exists|Resource temporarily unavailable/i;

export function isTransientGitLockError(message) {
  return TRANSIENT_GIT_LOCK.test(String(message || ''));
}

export const DEFAULT_LOCK_RETRIES = 3;
export const DEFAULT_LOCK_BACKOFF_MS = 300;

/** Synchronous sleep — persistCapture is sync because its caller is. Zero-dep; injectable for tests. */
export function defaultSleepSync(ms) {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
}

/**
 * Is this capture ACTUALLY durable right now? Not "did a commit appear to succeed" — is it in the
 * committed tree, with no part of it left untracked, modified, or merely staged.
 *
 * Both halves are needed: `ls-tree` alone would call a note durable while a later edit sat uncommitted,
 * and `status` alone cannot tell "never committed" from "clean".
 *
 * @returns {boolean} false on ANY error — an unanswerable question is never reported as durable.
 */
export function captureIsPersisted({ repoRoot, paths, runGit = defaultRunGit }) {
  const clean = (paths || []).filter((p) => typeof p === 'string' && p.trim().length);
  if (!repoRoot || !clean.length) return false;
  try {
    const inHead = runGit(['ls-tree', '-r', '--name-only', 'HEAD', '--', ...clean], repoRoot);
    if (!inHead) return false;
    const pending = runGit(['status', '--porcelain', '--', ...clean], repoRoot);
    return !pending;
  } catch {
    return false;
  }
}

/**
 * Commit exactly the given repo-relative paths.
 *
 * @param {object}   o
 * @param {string}   o.repoRoot  absolute path to the git repository root
 * @param {string[]} o.paths     repo-relative paths to stage (files or directories)
 * @param {string}   o.message   commit message
 * @param {function} [o.runGit]  injected git runner (args, cwd) => stdout — for tests
 * @param {number}   [o.retries] bounded retries for TRANSIENT lock contention only
 * @param {number}   [o.backoffMs] base backoff between those retries
 * @param {function} [o.sleep]   injected sync sleep — for tests
 * @returns {{committed: boolean, sha?: string, reason?: string, error?: string, paths: string[],
 *            attempts?: number, lockRetries?: number}}
 */
export function persistCapture({
  repoRoot, paths, message, runGit = defaultRunGit,
  retries = DEFAULT_LOCK_RETRIES, backoffMs = DEFAULT_LOCK_BACKOFF_MS, sleep = defaultSleepSync,
}) {
  const clean = (paths || []).filter((p) => typeof p === 'string' && p.trim().length);
  if (!repoRoot) return { committed: false, reason: 'no-repo-root', paths: clean };
  if (!clean.length) return { committed: false, reason: 'no-paths', paths: clean };
  if (!message || !message.trim()) return { committed: false, reason: 'no-message', paths: clean };

  let lockRetries = 0;

  for (let attempt = 1; ; attempt++) {
    try {
      // Stage ONLY the generated artefacts. `--` guards paths that begin with a dash, and naming each
      // path explicitly means unrelated work in the tree is never swept into this commit.
      runGit(['add', '--', ...clean], repoRoot);

      // Nothing staged => the capture was already persisted (writeNote is idempotent on videoId, so a
      // re-run is normal and must not produce an empty commit).
      const staged = runGit(['diff', '--cached', '--name-only', '--', ...clean], repoRoot);
      if (!staged) return { committed: false, reason: 'no-changes', paths: clean, attempts: attempt, lockRetries };

      // Commit ONLY these pathspecs, so a commit is correct even if the caller's tree has other
      // staged work in progress.
      runGit(['commit', '-m', message, '--only', '--', ...clean], repoRoot);
      const sha = runGit(['rev-parse', 'HEAD'], repoRoot);
      return { committed: true, sha, paths: clean, attempts: attempt, lockRetries };
    } catch (e) {
      const error = (e && (e.stderr?.toString?.() || e.message)) || String(e);
      const trimmed = error.trim().split('\n').slice(0, 3).join(' | ');

      // A shared tree under concurrent orchestration is NORMAL here. Wait for the holder to finish and
      // try the whole sequence again — never delete the lock, never retry a non-lock failure.
      if (attempt <= retries && isTransientGitLockError(trimmed)) {
        lockRetries++;
        sleep(backoffMs * attempt);
        continue;
      }
      return { committed: false, reason: 'git-failed', error: trimmed, paths: clean, attempts: attempt, lockRetries };
    }
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
