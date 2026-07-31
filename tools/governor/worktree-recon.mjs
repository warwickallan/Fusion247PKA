// Worker + Worktree Reconciliation (BUILD-018 T-07)
//
// Enumerates every git worktree of this repo, its git status (clean/dirty, unpushed
// commits), and any OS process that appears to be running inside it — then reports a
// disposition per worktree. This module NEVER deletes, prunes, or mutates anything; it
// is a read-only report. "Baseline evidence, not cleanup permission" (00-ESTATE.md).
//
// Split into pure functions (parsing/classification/disposition — unit-testable
// without touching git or the OS) and a thin OS-adapter layer at the bottom, mirroring
// the pure-core / adapter split the map already uses for the evaluator (AD-11).

import { execFileSync } from 'node:child_process';

export function parseWorktreePorcelain(output) {
  const blocks = output
    .split(/\r?\n\r?\n/)
    .map((b) => b.trim())
    .filter(Boolean);
  return blocks.map((block) => {
    const lines = block.split(/\r?\n/);
    const rec = { path: null, head: null, branch: null, bare: false, detached: false };
    for (const line of lines) {
      if (line.startsWith('worktree ')) rec.path = line.slice('worktree '.length).trim();
      else if (line.startsWith('HEAD ')) rec.head = line.slice('HEAD '.length).trim();
      else if (line.startsWith('branch ')) rec.branch = line.slice('branch '.length).replace(/^refs\/heads\//, '').trim();
      else if (line === 'bare') rec.bare = true;
      else if (line === 'detached') rec.detached = true;
    }
    return rec;
  });
}

function normPath(p) {
  return p ? p.replace(/\\/g, '/').toLowerCase().replace(/\/+$/, '') : p;
}

export function classifyWorktree(wt, { primaryPath, buildPaths = [] } = {}) {
  const path = normPath(wt.path);
  if (path === normPath(primaryPath)) return 'primary-checkout';
  if (buildPaths.some((bp) => normPath(bp) === path)) return 'active-build';
  if (/\/\.claude\/worktrees\/agent-/.test(path)) return 'baseline-agent-worktree';
  if (/-audit$/.test(path) || /-tower$/.test(path) || /-w01$/.test(path)) return 'baseline-named-worktree';
  return 'unknown';
}

export function computeDisposition({ classification, dirty, unpushedCount, statusError }) {
  if (classification === 'active-build') return 'in-progress-owned';
  if (statusError) return 'unknown-unreadable';
  if (dirty) return 'unreconciled-dirty';
  if (typeof unpushedCount === 'number' && unpushedCount > 0) return 'unreconciled-unpushed';
  return 'reconciled-clean';
}

// A naive `commandLine.includes(path)` false-positives on sibling directories that
// share a name prefix (e.g. "C:/Fusion247PKA" is a substring of
// "C:/Fusion247PKA-governor") — confirmed live against the real 22-worktree estate,
// where the primary checkout's path spuriously "matched" processes actually running in
// the -governor/-audit/-tower/-w01 sibling worktrees. A match only counts if `path` is
// followed by a path separator, a quote, a space, or end-of-string.
function referencesPath(commandLine, path) {
  const cl = normPath(commandLine);
  let idx = -1;
  while ((idx = cl.indexOf(path, idx + 1)) !== -1) {
    const after = cl[idx + path.length];
    if (after === undefined || after === '/' || after === '"' || after === "'" || after === ' ') {
      return true;
    }
  }
  return false;
}

export function matchLiveWorkers(worktrees, processes) {
  return worktrees.map((wt) => {
    const path = normPath(wt.path);
    const matches = (processes || []).filter((p) => p.commandLine && referencesPath(p.commandLine, path));
    return { ...wt, liveWorkerPids: matches.map((m) => m.pid) };
  });
}

// ---- OS adapter layer (git + process enumeration). Read-only, best-effort. ----

export function listWorktreesLive(repoPath) {
  const output = execFileSync('git', ['worktree', 'list', '--porcelain'], {
    cwd: repoPath,
    encoding: 'utf8',
  });
  return parseWorktreePorcelain(output);
}

export function gitStatusFor(worktreePath) {
  try {
    const out = execFileSync('git', ['-C', worktreePath, 'status', '--porcelain'], {
      encoding: 'utf8',
    });
    return { dirty: out.trim().length > 0, statusError: false };
  } catch (err) {
    return { dirty: null, statusError: true, error: err.message };
  }
}

export function unpushedCountFor(worktreePath) {
  try {
    const out = execFileSync('git', ['-C', worktreePath, 'rev-list', '--count', '@{u}..HEAD'], {
      encoding: 'utf8',
    });
    return parseInt(out.trim(), 10);
  } catch {
    // No upstream configured, or detached HEAD — unknown, not zero.
    return null;
  }
}

export function listWindowsNodeProcesses() {
  try {
    const out = execFileSync(
      'powershell',
      [
        '-NoProfile',
        '-Command',
        "Get-CimInstance Win32_Process | Where-Object { $_.Name -match 'node.exe|claude.exe' } | Select-Object ProcessId,CommandLine | ConvertTo-Json -Compress",
      ],
      { encoding: 'utf8' }
    );
    const parsed = JSON.parse(out || '[]');
    const list = Array.isArray(parsed) ? parsed : [parsed];
    return list
      .filter(Boolean)
      .map((p) => ({ pid: p.ProcessId, commandLine: p.CommandLine || '' }));
  } catch {
    // Best-effort only (F-7 is open fog) — never let a failed process query break
    // the worktree report, which is this ticket's actual acceptance criterion.
    return [];
  }
}

export function reconcile({ repoPath, primaryPath, buildPaths = [] } = {}) {
  const raw = listWorktreesLive(repoPath);
  const processes = listWindowsNodeProcesses();
  const enriched = raw.map((wt) => {
    const classification = classifyWorktree(wt, { primaryPath, buildPaths });
    const { dirty, statusError } = gitStatusFor(wt.path);
    const unpushedCount = statusError ? null : unpushedCountFor(wt.path);
    const disposition = computeDisposition({ classification, dirty, unpushedCount, statusError });
    return { ...wt, classification, dirty, statusError, unpushedCount, disposition };
  });
  return matchLiveWorkers(enriched, processes);
}
