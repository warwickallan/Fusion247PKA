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
//
// The name says BYTES and it is now enforced in bytes. It previously bounded `String.length`
// — UTF-16 CODE UNITS — so a diff of 64,003 real bytes was recorded as 60,045 and the
// truncation notice understated the unseen remainder by 6.2%. A cap that lies about its own
// unit is bad; a durable RECORD that understates how much the reviewer did not see is worse,
// because the packet is transient and the record is not. The cap value is unchanged.
export const MAX_DIFF_BYTES = 60_000;

/**
 * Largest cut index <= max that does NOT land inside a multibyte UTF-8 sequence.
 *
 * Cutting at an arbitrary byte can leave a lead byte with its continuation bytes shorn off;
 * decoding that yields U+FFFD, i.e. the cap itself would corrupt the final character of every
 * truncated diff. Continuation bytes are 0b10xxxxxx, so walking back while the byte AT the cut
 * is a continuation byte lands on the lead byte of the sequence that would have been split —
 * cutting before it is always safe. ASCII and an aligned boundary cut at `max` exactly.
 */
export function utf8SafeCut(buf, max) {
  if (buf.length <= max) return buf.length;
  let cut = max;
  while (cut > 0 && (buf[cut] & 0xC0) === 0x80) cut -= 1;
  return cut;
}

function toBuffer(chunks) {
  return Buffer.concat(chunks.map((c) => (Buffer.isBuffer(c) ? c : Buffer.from(String(c), 'utf8'))));
}

function run(cmd, args, { cwd, timeoutMs = DEFAULT_TIMEOUT_MS, spawn = nodeSpawn } = {}) {
  return new Promise((resolve) => {
    // Chunks accumulate as BYTES and are decoded EXACTLY ONCE, at the end.
    //
    // The previous form (`stdout += d.toString()`) decoded every chunk independently. A
    // multibyte UTF-8 sequence straddling a chunk boundary is then decoded as two invalid
    // fragments, each becoming U+FFFD — silently altering diff content that a reviewer
    // afterwards judges as if it were git's own output. Node delivers a pipe in multiple
    // chunks once output passes the 64KB high-water mark, and this estate's diffs are both
    // multibyte-bearing and larger than that, so the boundary is crossed routinely. It had
    // NOT manifested on any diff measured to date — where the boundaries happen to fall is
    // luck, not design. One decode over the concatenated bytes removes the class outright.
    const outChunks = [];
    const errChunks = [];
    let done = false;
    const settle = ({ ok, code, stderrOverride = null }) => {
      if (done) return;
      done = true;
      const outBuf = toBuffer(outChunks);
      resolve({
        ok,
        code,
        stdout: outBuf.toString('utf8'),
        stdoutBytes: outBuf,
        stderr: stderrOverride ?? toBuffer(errChunks).toString('utf8'),
      });
    };
    let child;
    try {
      child = spawn(cmd, args, { cwd, shell: false, windowsHide: true });
    } catch (e) {
      return settle({ ok: false, code: -1, stderrOverride: String(e?.message ?? e) });
    }
    const timer = setTimeout(() => { try { child.kill('SIGKILL'); } catch { /* ignore */ } settle({ ok: false, code: -2, stderrOverride: `timed out after ${timeoutMs}ms` }); }, timeoutMs);
    child.stdout?.on('data', (d) => { outChunks.push(d); });
    child.stderr?.on('data', (d) => { errChunks.push(d); });
    child.on('error', (e) => { clearTimeout(timer); settle({ ok: false, code: -1, stderrOverride: String(e?.message ?? e) }); });
    child.on('close', (code) => { clearTimeout(timer); settle({ ok: code === 0, code }); });
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
export async function gatherGitEvidence({ cwd, repo = null, branch = null, baseSha = null, headSha = null, prNumber = null, paths = [], spawn = nodeSpawn } = {}) {
  // `paths` (optional pathspec) exists because MAX_DIFF_BYTES silently truncates a large
  // range, and a truncated diff yields a verdict that does not cover the whole change —
  // a false green wearing a pass. Observed 2026-08-02: a 16-file DELETION produced
  // `approve` on 20/20 rows over a truncated diff, because a deletion puts the full text
  // of every deleted file into the diff. Scoping the range is the honest remedy; raising
  // the cap only moves the cliff.
  // It is applied to BOTH the --name-only call and the unified diff, so `changed_files`
  // and `diff_text` always describe the same set. Applying it to one and not the other
  // would produce a packet that quietly lies about its own coverage.
  // Empty (the default) is the previous behaviour exactly.
  const pathspec = Array.isArray(paths) && paths.length ? ['--', ...paths] : [];
  const ev = {
    resolved: false, blocker: null,
    repo, branch, base_sha: null, head_sha: null, diff_range: null,
    changed_files: [], diff_text: null, diff_truncated: false,
    // Both counts are REAL UTF-8 BYTES. `diff_bytes` is what was delivered, `diff_total_bytes`
    // what git produced; equal unless truncated. They exist so the durable record can state
    // the size of the gap instead of implying there isn't one.
    diff_bytes: 0, diff_total_bytes: 0,
    scoped_to: pathspec.length ? paths.slice() : null,
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
  const namesRes = await g(['diff', '--name-only', ev.diff_range, ...pathspec]);
  if (!namesRes.ok) {
    ev.blocker = `diff range unresolvable (${ev.diff_range}): ${String(namesRes.stderr).trim().slice(0, 200)}`;
    return ev;
  }
  ev.changed_files = namesRes.stdout.split(/\r?\n/).filter(Boolean);

  // Unified diff (bounded). No context bloat; bounded bytes; truncation flagged.
  const diffRes = await g(['diff', '--no-color', ev.diff_range, ...pathspec]);
  if (!diffRes.ok) {
    ev.blocker = `unable to collect unified diff for ${ev.diff_range}: ${String(diffRes.stderr).trim().slice(0, 200)}`;
    return ev;
  }
  // The cap is applied to the raw BYTES git produced, at a cut that cannot split a character.
  const diffBytes = diffRes.stdoutBytes ?? Buffer.from(String(diffRes.stdout), 'utf8');
  ev.diff_total_bytes = diffBytes.length;
  if (diffBytes.length > MAX_DIFF_BYTES) {
    const cut = utf8SafeCut(diffBytes, MAX_DIFF_BYTES);
    ev.diff_bytes = cut;
    ev.diff_truncated = true;
    ev.diff_text = `${diffBytes.subarray(0, cut).toString('utf8')}\n… [diff truncated at ${cut} bytes (cap ${MAX_DIFF_BYTES}) of ${diffBytes.length} bytes] …`;
  } else {
    ev.diff_bytes = diffBytes.length;
    ev.diff_text = diffBytes.toString('utf8');
  }

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
