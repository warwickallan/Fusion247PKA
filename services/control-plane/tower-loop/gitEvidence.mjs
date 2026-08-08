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
// WO-2026-08-08-4C-14 — the cap is now OVERRIDABLE via TOWER_MAX_DIFF_BYTES, default unchanged
// at 60,000. Reason, recorded because a raised cap must never become the silent default: the
// BUILD-020 4C merge-class review delivered Codex 60,000 of 1,050,971 bytes — 5.7% of the change —
// and it correctly refused to clear findings it could not see. A reviewer asked to judge an
// implementation it was never shown is not an independent check; it is a formality. The default
// stays low because most reviews do not need more; the override exists so a large, genuinely
// merge-class change can be delivered in full rather than the reviewer being blamed for the gap.
export const MAX_DIFF_BYTES = Number(process.env.TOWER_MAX_DIFF_BYTES ?? 60_000);

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

// WO-2026-08-05-TW3 (Gap 2) — a full 40-hex SHA, the same shape `gh` itself hands back and the
// same discipline `tower/merge-check.mjs`'s headGuard already applies to a PR's authoritative head.
const CANONICAL_SHA = /^[0-9a-f]{40}$/;
const short = (s) => String(s ?? '(none)').slice(0, 12);

/** The MAX_DIFF_BYTES truncation, factored out so BOTH the local-git path and the gh-sourced path
 *  apply the exact same cap, cut and notice — one rule, not two copies that could drift. */
function truncateDiff(diffBytes) {
  if (diffBytes.length > MAX_DIFF_BYTES) {
    const cut = utf8SafeCut(diffBytes, MAX_DIFF_BYTES);
    return {
      diff_bytes: cut, diff_total_bytes: diffBytes.length, diff_truncated: true,
      diff_text: `${diffBytes.subarray(0, cut).toString('utf8')}\n… [diff truncated at ${cut} bytes (cap ${MAX_DIFF_BYTES}) of ${diffBytes.length} bytes] …`,
    };
  }
  return { diff_bytes: diffBytes.length, diff_total_bytes: diffBytes.length, diff_truncated: false, diff_text: diffBytes.toString('utf8') };
}

/**
 * Base/head/diff/changed-files resolved ENTIRELY via `gh` — no local git object lookup at all.
 *
 * THIS IS WHAT CLOSES GAP 2. Exact-head review must not depend on `cwd` (in production,
 * `TOWER_EVIDENCE_REPO_DIR`) already holding the reviewed commits in its local object database.
 * That happened to be true only because every worktree in this estate shares one `.git` object
 * store by `git worktree add` convention — a convention, never a guarantee. This function needs
 * no local object at all: a fresh temp dir with zero relationship to the reviewed repo resolves
 * evidence identically, because every fact below comes from the GitHub API.
 *
 * head_sha: `gh api repos/<repo>/pulls/<N>` is the SAME authoritative source
 * `tower/merge-check.mjs`'s headGuard already trusts (there, via `gh pr view --json headRefOid`;
 * here, via the equivalent REST field) — never a local ref. A caller-supplied `headSha` that
 * disagrees is a real signal (the PR moved) and fails CLOSED, the same spirit as headGuard's
 * exact-head chain, without re-deriving its full TOCTOU machinery here (a merge DECISION's
 * provenance chain is Codex's job; this function only gathers evidence for one).
 *
 * base_sha: an explicit `baseSha` is trusted exactly as the local-git path trusts one. Absent one,
 * this resolves the PR's actual base ref via the SAME `gh api` call — a deliberate, disclosed
 * change from the local-git fallback's `head~1` heuristic, which inherently needs a local object
 * to walk and is also a less correct reading of "the PR's base" than the PR's real base ref.
 *
 * diff_text / changed_files: BOTH via `gh pr diff <N>` — the same tool
 * `tower/merge-check.mjs`'s `collectEvidence()` already proves in production — so they can never
 * quietly describe different ranges, same discipline the local-git path already applies.
 *
 * Returns `{ ok: false, blocker }` on any unresolved step (fail-closed, never assume-and-pass) or
 * `{ ok: true, fields }` — `fields` merges directly onto the evidence packet.
 */
async function resolveViaGh({ gh, repo, prNumber, baseSha, headSha }) {
  const prRes = await gh(['api', `repos/${repo}/pulls/${prNumber}`, '--jq', '{"head":.head.sha,"base":.base.sha}']);
  if (!prRes.ok) {
    return { ok: false, blocker: `gh api repos/${repo}/pulls/${prNumber} failed: ${String(prRes.stderr).trim().slice(0, 200)}` };
  }
  let apiSha;
  try { apiSha = JSON.parse(String(prRes.stdout).trim()); } catch (e) {
    return { ok: false, blocker: `gh returned non-JSON for PR #${prNumber} head/base: ${String(e?.message ?? e)}` };
  }
  const apiHead = String(apiSha?.head ?? '').trim();
  if (!CANONICAL_SHA.test(apiHead)) {
    return { ok: false, blocker: `gh returned a non-canonical head SHA for PR #${prNumber}: ${JSON.stringify(apiHead)}` };
  }
  if (headSha && headSha !== apiHead) {
    return {
      ok: false,
      blocker: `head mismatch: caller-supplied headSha ${short(headSha)} disagrees with PR #${prNumber}'s `
        + `authoritative head ${short(apiHead)} from gh api (the PR may have moved) — fail closed rather than review the wrong tree`,
    };
  }

  let resolvedBase = baseSha;
  if (!resolvedBase) {
    const apiBase = String(apiSha?.base ?? '').trim();
    if (!CANONICAL_SHA.test(apiBase)) {
      return { ok: false, blocker: `gh returned a non-canonical base SHA for PR #${prNumber}: ${JSON.stringify(apiBase)}` };
    }
    resolvedBase = apiBase;
  }

  const namesRes = await gh(['pr', 'diff', String(prNumber), '--repo', repo, '--name-only']);
  if (!namesRes.ok) {
    return { ok: false, blocker: `gh pr diff --name-only failed for PR #${prNumber}: ${String(namesRes.stderr).trim().slice(0, 200)}` };
  }
  const changed_files = String(namesRes.stdout).split(/\r?\n/).filter(Boolean);

  const diffRes = await gh(['pr', 'diff', String(prNumber), '--repo', repo]);
  if (!diffRes.ok) {
    return { ok: false, blocker: `gh pr diff failed for PR #${prNumber}: ${String(diffRes.stderr).trim().slice(0, 200)}` };
  }
  const diffBytes = diffRes.stdoutBytes ?? Buffer.from(String(diffRes.stdout), 'utf8');

  return {
    ok: true,
    fields: {
      base_sha: resolvedBase, head_sha: apiHead, diff_range: `${resolvedBase}..${apiHead}`,
      changed_files, scoped_to: null,
      ...truncateDiff(diffBytes),
    },
  };
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
 * TWO MECHANISMS (WO-2026-08-05-TW3, Gap 2). When `prNumber` and `repo` are both given (and no
 * `paths` pathspec), evidence is resolved ENTIRELY via `gh` — see `resolveViaGh` — needing no
 * local git object database at all. Otherwise (no `prNumber`, e.g. reviewDiff.mjs's local/dev
 * use, or a scoped `paths` review) the LOCAL-GIT mechanism below runs exactly as before.
 *
 * @param {object} args
 * @param {string} args.cwd          repo working dir to run git/gh in (must be a git repo ON
 *                                   THE LOCAL-GIT MECHANISM ONLY — the gh-sourced mechanism needs
 *                                   no relationship between `cwd` and the reviewed repo at all).
 * @param {string} [args.repo]       owner/name. Optional on the local-git mechanism (gh infers
 *                                   from cwd's remote there); REQUIRED to activate the gh-sourced
 *                                   mechanism, since `gh pr diff --repo` needs it explicitly.
 * @param {string} [args.branch]     branch under review (recorded; not required to resolve).
 * @param {string} [args.baseSha]    base ref/sha. Local-git: falls back to merge-base with HEAD~.
 *                                   Gh-sourced: falls back to the PR's actual base ref via `gh`.
 * @param {string} [args.headSha]    exact head ref/sha under review. Local-git: falls back to
 *                                   HEAD. Gh-sourced: cross-checked against the PR's authoritative
 *                                   head from `gh`, fail-closed on a mismatch (the PR moved).
 * @param {number} [args.prNumber]   PR number. Present + `repo` present ⇒ activates the
 *                                   gh-sourced mechanism (and is always used for `gh pr checks`).
 * @param {Function} [args.spawn]    injectable spawn (tests) — the ONE seam both mechanisms share.
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
  const gh = (args) => run('gh', args, { cwd, spawn });

  // WO-2026-08-05-TW3 (Gap 2) — PREFER GITHUB, not the local checkout, whenever a PR number is
  // available together with its repo. This is the case for EVERY real invocation from the
  // watcher's PR-poll path (see watcher.mjs processTurn) and is what removes this function's
  // dependence on `cwd`'s local object database happening to already hold the target commits.
  // Pathspec scoping (`paths`) has no gh equivalent here, and no current prNumber-passing caller
  // uses it — that one combination still falls through to the local-git mechanism below,
  // unchanged, rather than silently dropping the scope.
  if (prNumber != null && repo && pathspec.length === 0) {
    const resolved = await resolveViaGh({ gh, repo, prNumber, baseSha, headSha });
    if (!resolved.ok) {
      ev.blocker = resolved.blocker;
      return ev;
    }
    Object.assign(ev, resolved.fields);
  } else {
    // ── THE LOCAL-GIT MECHANISM — UNCHANGED. This is the fallback for the no-PR-number
    // (local/dev) case, which genuinely has no PR to ask GitHub about — e.g. reviewDiff.mjs —
    // and for the pathspec-scoped case, which the gh path above does not support.

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
    Object.assign(ev, truncateDiff(diffBytes));
  }

  // CI conclusions via gh — best-effort (an absent/unauth gh is honestly 'unavailable'). UNCHANGED
  // and shared by BOTH mechanisms above — this was already the only gh call on the local-git path.
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
