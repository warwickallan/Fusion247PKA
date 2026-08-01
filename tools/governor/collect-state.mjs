// Programme-State Collector (BUILD-018 T-13)
//
// Maps live estate signals — git, tools/governor/worktree-recon.mjs (T-07), and `gh` —
// onto the durable programme-state schema (T-09), so that /rotate-session (T-10) is
// left owning only the refusal JUDGEMENT, not also data collection (see T-09's
// handback and 02-MAP.md section 7: "T-13 is new, split out of T-10 by T-09").
//
// Every source here can fail independently (no `gh` on PATH, an unreadable worktree,
// a broken git invocation), and the map's missing-field rule applies: a source that
// could not be gathered must land its field in `unknown` WITH A REASON — never as a
// silently empty array, and never as a manufactured zero. This mirrors T-09's own
// enforcement (COLLECTION_FIELDS in programme-state.mjs rejects an undeclared empty
// collection) and AD-3's "BLIND, not GREEN" principle applied to data collection
// instead of health evaluation.
//
// `repository.branches.behind` is deliberately NEVER computed here: a trustworthy
// behind-count needs a fresh `git fetch`, and this collector performs no network
// mutation of refs (a collector should not have side effects on the repository it is
// reporting on). This is not a bug — the real BUILD-018 programme-state.json already
// declares `branches.behind` unknown for exactly this reason (T-09's live document).

import { execFileSync } from 'node:child_process';
import { reconcile as reconcileWorktreesLive } from './worktree-recon.mjs';

export function toUnknownEntry(path, why) {
  return { path, why };
}

function dedupeUnknown(entries) {
  const seen = new Map();
  for (const u of entries) {
    if (!u || !u.path) continue;
    if (!seen.has(u.path)) seen.set(u.path, u);
  }
  return [...seen.values()];
}

// ---------------------------------------------------------------------------
// git adapter — every call fails soft; nothing here ever throws past its own
// boundary, and a caller can inject `execFile` to simulate any failure mode.
// ---------------------------------------------------------------------------

function gitCapture(execFile, repoPath, args) {
  return execFile('git', ['-C', repoPath, ...args], { encoding: 'utf8' }).trim();
}

export function isGitRepoReadable(repoPath, { execFile = execFileSync } = {}) {
  try {
    gitCapture(execFile, repoPath, ['rev-parse', '--git-dir']);
    return true;
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------------------
// repository — required fields (`branch`, `base_sha`, `head_sha`) fall back to the
// schema's own "unknown" sentinel (its pattern explicitly allows the literal string
// "unknown" alongside a 40-hex sha) rather than an empty string, which the schema
// would reject outright. Nullable fields (`clean`, `unpushed_commits`, `upstream`)
// fall back to null, never to a manufactured 0/false/"" — AD-3's rule applied here.
// ---------------------------------------------------------------------------

export function collectRepository({
  repoPath,
  primaryCheckout,
  worktree,
  branch,
  baseSha,
  execFile = execFileSync,
} = {}) {
  const unknown = [];
  const readable = isGitRepoReadable(repoPath, { execFile });

  let headSha = 'unknown';
  let clean = null;
  let unpushedCount = null;
  let upstream = null;

  if (!readable) {
    unknown.push(toUnknownEntry('repository.head_sha', `git repository unreadable at ${repoPath}`));
  } else {
    try {
      headSha = gitCapture(execFile, repoPath, ['rev-parse', 'HEAD']);
    } catch {
      unknown.push(toUnknownEntry('repository.head_sha', 'git rev-parse HEAD failed'));
    }
    try {
      const out = gitCapture(execFile, repoPath, ['status', '--porcelain']);
      clean = out.length === 0;
    } catch {
      // clean stays null — "could not determine" must never collapse to true or false
    }
    try {
      upstream = gitCapture(execFile, repoPath, ['rev-parse', '--abbrev-ref', '--symbolic-full-name', '@{u}']);
    } catch {
      // no upstream configured, or lookup failed — stays null either way
    }
    try {
      const out = gitCapture(execFile, repoPath, ['rev-list', '--count', '@{u}..HEAD']);
      const parsed = parseInt(out, 10);
      unpushedCount = Number.isNaN(parsed) ? null : parsed;
    } catch {
      // no upstream, or the count failed — stays null, never 0
    }
  }

  return {
    repository: {
      primary_checkout: primaryCheckout || 'unknown',
      worktree: worktree || 'unknown',
      branch: branch || 'unknown',
      base_sha: baseSha || 'unknown',
      head_sha: headSha,
      clean,
      unpushed_commits: unpushedCount,
      upstream,
    },
    unknown,
  };
}

// ---------------------------------------------------------------------------
// worktrees — thin wrapper around T-07's reconcile(). Field names already mirror
// the schema (schema's own description: "deliberately mirror
// tools/governor/worktree-recon.mjs so its output maps in without translation").
// A throw from reconcile() (git worktree list failing, an unreadable worktree)
// collapses to an empty array PLUS a declared `unknown` entry — never a silent [].
// ---------------------------------------------------------------------------

export function collectWorktrees({ repoPath, primaryPath, buildPaths = [], reconcileFn = reconcileWorktreesLive } = {}) {
  let raw;
  try {
    raw = reconcileFn({ repoPath, primaryPath, buildPaths });
  } catch (err) {
    return {
      worktrees: [],
      unknown: [toUnknownEntry('worktrees', `worktree reconciliation failed: ${String(err && err.message || err).slice(0, 300)}`)],
    };
  }

  if (!Array.isArray(raw) || raw.length === 0) {
    return {
      worktrees: [],
      unknown: [toUnknownEntry('worktrees', 'reconcile() returned no worktrees — treated as unread, not as "there are none" (a repo always has at least a primary checkout)')],
    };
  }

  const worktrees = raw.map((wt) => ({
    path: wt.path,
    branch: wt.branch ?? null,
    head: wt.head ?? null,
    dirty: typeof wt.dirty === 'boolean' ? wt.dirty : null,
    unpushedCount: typeof wt.unpushedCount === 'number' ? wt.unpushedCount : null,
    classification: wt.classification,
    disposition: wt.disposition,
    liveWorkerPids: Array.isArray(wt.liveWorkerPids) ? wt.liveWorkerPids : [],
    protected: wt.classification === 'active-build' ? false : true,
  }));

  return { worktrees, unknown: [] };
}

// ---------------------------------------------------------------------------
// branches — takes a caller-supplied set of branch specs (which branches matter to
// THIS programme, and their role, is programme knowledge, not something git can
// enumerate on its own out of hundreds of branches in this estate). Per-branch
// lookups fail soft to null fields; a totally unreadable repository fails the
// whole collection to `unknown`, never to an empty array pretending "no branches".
// ---------------------------------------------------------------------------

export function collectBranches({ repoPath, branchSpecs = [], execFile = execFileSync } = {}) {
  if (!isGitRepoReadable(repoPath, { execFile })) {
    return {
      branches: [],
      unknown: [toUnknownEntry('branches', `repository unreadable at ${repoPath} — no branch could be inspected`)],
    };
  }

  if (branchSpecs.length === 0) {
    return {
      branches: [],
      unknown: [toUnknownEntry('branches', 'no branch specs were supplied to this collection')],
    };
  }

  const branches = branchSpecs.map((spec) => {
    let head = null;
    let ahead = null;
    const upstream = spec.upstream ?? null;

    try {
      head = gitCapture(execFile, repoPath, ['rev-parse', spec.name]);
    } catch {
      // branch not resolvable locally (not fetched, deleted, typo'd spec) — null, never ""
    }
    if (upstream) {
      try {
        const out = gitCapture(execFile, repoPath, ['rev-list', '--count', `${upstream}..${spec.name}`]);
        const parsed = parseInt(out, 10);
        ahead = Number.isNaN(parsed) ? null : parsed;
      } catch {
        // upstream ref not resolvable — stays null
      }
    }

    return {
      name: spec.name,
      head,
      upstream,
      ahead,
      behind: null,
      role: spec.role,
      note: spec.note ?? null,
    };
  });

  // Never computed without a fresh `git fetch`, which this collector deliberately
  // never performs (no side effects on the repo it reports on) — matches the real
  // BUILD-018 programme-state.json's own precedent (T-09).
  const unknown = [toUnknownEntry('branches.behind', 'no fetch was performed during this collection, so behind-counts against remotes were not computed')];
  return { branches, unknown };
}

// ---------------------------------------------------------------------------
// pull_requests — via `gh`. A `list --head <branch>` call legitimately returns []
// when no PR exists for that branch (a real, positive "none" — not a failure), so
// only a `gh` invocation ERROR (not installed, not authenticated, network down)
// counts as a source failure. The first such error aborts the whole collection
// (once `gh` is broken, every subsequent call would fail the same way) rather than
// silently degrading branch-by-branch.
// ---------------------------------------------------------------------------

function mapGhState(state) {
  const known = { OPEN: 'open', MERGED: 'merged', CLOSED: 'closed' };
  return known[state] || 'unknown';
}

export function collectPullRequests({ ghRepo, branchSpecs = [], execFile = execFileSync, cwd } = {}) {
  if (!ghRepo) {
    return { pull_requests: [], unknown: [toUnknownEntry('pull_requests', 'no GitHub repo (owner/name) configured for this collection')] };
  }
  if (branchSpecs.length === 0) {
    return { pull_requests: [], unknown: [toUnknownEntry('pull_requests', 'no branches were supplied to check for pull requests')] };
  }

  const entries = [];
  for (const spec of branchSpecs) {
    let raw;
    try {
      raw = execFile(
        'gh',
        ['pr', 'list', '--repo', ghRepo, '--head', spec.name, '--state', 'all', '--json', 'number,url,title,state,headRefName'],
        { encoding: 'utf8', cwd }
      );
    } catch (err) {
      return {
        pull_requests: [],
        unknown: [toUnknownEntry('pull_requests', `gh command failed: ${String(err && err.message || err).slice(0, 300)}`)],
      };
    }

    let list;
    try {
      list = JSON.parse(raw);
    } catch (err) {
      return {
        pull_requests: [],
        unknown: [toUnknownEntry('pull_requests', `gh returned unparseable output: ${String(err && err.message || err).slice(0, 300)}`)],
      };
    }

    if (!Array.isArray(list) || list.length === 0) {
      entries.push({
        number: null,
        url: null,
        title: null,
        state: 'none',
        branch: spec.name,
        head: null,
        note: 'No PR found for this branch',
      });
    } else {
      for (const pr of list) {
        entries.push({
          number: typeof pr.number === 'number' ? pr.number : null,
          url: pr.url || null,
          title: pr.title || null,
          state: mapGhState(pr.state),
          branch: spec.name,
          head: pr.headRefName || null,
          note: null,
        });
      }
    }
  }

  return { pull_requests: entries, unknown: [] };
}

// ---------------------------------------------------------------------------
// Compose — the full estate collection. `workers` is deliberately NOT collected
// here: which subagents this programme dispatched, for which ticket, is programme
// knowledge tracked by the caller, not something git/worktree-recon/gh can name
// (F-7 already establishes that even LIVE worker detection is best-effort; the
// dispatch RECORD is a different, non-git-derivable fact entirely). The caller
// merges its own `workers` list in via mergeEstateIntoState.
// ---------------------------------------------------------------------------

export function collectEstateState({
  repoPath,
  primaryCheckout,
  worktree,
  branch,
  baseSha,
  branchSpecs = [],
  ghRepo = null,
  primaryPath,
  buildPaths = [],
  execFile = execFileSync,
  reconcileFn = reconcileWorktreesLive,
} = {}) {
  const repo = collectRepository({ repoPath, primaryCheckout, worktree, branch, baseSha, execFile });
  const wt = collectWorktrees({ repoPath, primaryPath, buildPaths, reconcileFn });
  const br = collectBranches({ repoPath, branchSpecs, execFile });
  const prs = collectPullRequests({ ghRepo, branchSpecs, execFile, cwd: repoPath });

  return {
    repository: repo.repository,
    worktrees: wt.worktrees,
    branches: br.branches,
    pull_requests: prs.pull_requests,
    unknown: dedupeUnknown([...repo.unknown, ...wt.unknown, ...br.unknown, ...prs.unknown]),
  };
}

// ---------------------------------------------------------------------------
// Merge — folds a collected estate into a full programme-state document. Does
// NOT validate (programme-state.mjs owns validation; this stays single-purpose).
// `unknown` is unioned and deduplicated by path so a repeated collection run never
// grows the declaration list with the same reason twice.
// ---------------------------------------------------------------------------

export function mergeEstateIntoState(baseState, estate) {
  return {
    ...baseState,
    repository: estate.repository,
    worktrees: estate.worktrees,
    branches: estate.branches,
    pull_requests: estate.pull_requests,
    unknown: dedupeUnknown([...(baseState.unknown || []), ...estate.unknown]),
  };
}
