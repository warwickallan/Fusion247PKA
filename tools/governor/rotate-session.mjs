// /rotate-session — bank, VERIFY SAFETY, emit the /clear instruction (BUILD-018 T-10)
//
// The one component that is allowed to say NO. T-13 collects the estate and T-09
// validates and persists it; T-10 owns only the judgement layer between them —
// whether this estate is safe to rotate at all — plus the banking act itself.
//
// WHAT IT MUST NOT DO (INV-4, AD-13, AD-10)
// -----------------------------------------
// It must NOT invoke /close-session, write a programme session log, run a Librarian
// pass, mirror to ClickUp, mirror to Google Drive, or sign off. A rotation that costs
// what a close costs will not get used, and an unused governor is worse than none.
// Enforced by a source-scan test, not just by this comment.
//
// It must NOT run /clear (INV-7 — recommend, do not act). `/clear` is native and
// human-invoked; this command's last act is telling Warwick the exact thing to type.
//
// FAIL-CLOSED, and why that is correct HERE (D-6)
// -----------------------------------------------
// INV-2 ("never trap Warwick") governs BLOCKING PATHS in his live session — the RED
// preflight hook (T-06), which must fail open. This is not such a path: refusing to
// rotate costs Warwick nothing but a delay, whereas banking a state that is wrong or
// incomplete is silently wrong for every future session. So every uncertainty here
// resolves toward REFUSING, and "could not determine" is never treated as "safe" —
// the same INV-1 rule that makes BLIND a first-class state in the evaluator.
//
// AD-14 — a file cannot contain its own commit's SHA
// ---------------------------------------------------
// Banking writes the state, THEN commits it, so `banked.head_sha` is the head the
// state DESCRIBES: the parent of the banking commit. `isBankingCommit()` below is the
// comparison every consumer must use instead of a naive `HEAD !== banked.head_sha`,
// which would report every freshly banked state as stale and fire RECOVERY on every
// single rotation — training Warwick to ignore it.

import { execFileSync } from 'node:child_process';
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { pathToFileURL, fileURLToPath } from 'node:url';

import {
  readProgrammeState,
  writeProgrammeState,
  validateProgrammeState,
  programmeStatePath,
  renderSessionHandoff,
  sessionHandoffPath,
  frontierTickets,
} from './programme-state.mjs';
import { collectEstateState, mergeEstateIntoState } from './collect-state.mjs';

// Distinct exit codes so "did not run" can never be mistaken for "rotated" (INV-1).
export const EXIT = {
  ROTATED: 0,
  REFUSED: 1,
  BLIND: 2,
};

// ---------------------------------------------------------------------------
// The judgement — pure, and the only place a refusal is decided
// ---------------------------------------------------------------------------
// Returns schema-shaped obstacles (`kind` matches safe_boundary.obstacles' enum), so
// the verdict drops straight into the banked document rather than being described
// twice in two vocabularies.

export const SAFETY_CRITICAL_UNKNOWNS = new Set(['repository.head_sha', 'worktrees']);

export function assessRotationSafety(estate, { programmeWorktree, excludePids = [] } = {}) {
  const obstacles = [];
  let checked = 0;

  const repo = estate?.repository || {};

  checked += 1;
  if (!repo.head_sha || repo.head_sha === 'unknown') {
    obstacles.push({
      kind: 'unreadable',
      detail: 'Current git HEAD could not be read. Rotation cannot bank a state whose head it cannot name.',
    });
  }

  checked += 1;
  if (repo.clean === false) {
    obstacles.push({
      kind: 'dirty-tree',
      detail: 'The working tree has uncommitted changes. Uncommitted work is not in the banked state and would not survive the rotation.',
    });
  } else if (repo.clean === null || repo.clean === undefined) {
    obstacles.push({
      kind: 'unreadable',
      detail: 'Working-tree cleanliness could not be determined. Unknown is not clean — refusing rather than banking over possibly-uncommitted work.',
    });
  }

  checked += 1;
  if (typeof repo.unpushed_commits === 'number' && repo.unpushed_commits > 0) {
    obstacles.push({
      kind: 'unpushed-commits',
      detail: `${repo.unpushed_commits} commit(s) are not pushed. Banked state is not durable until the commits it describes are on the remote (INV-3).`,
    });
  } else if (repo.unpushed_commits === null || repo.unpushed_commits === undefined) {
    obstacles.push({
      kind: 'unreadable',
      detail: 'Unpushed-commit count could not be determined (no upstream configured, or the count failed). Unknown is never zero.',
    });
  }

  // Live workers IN THIS PROGRAMME'S OWN worktree only. Another worktree's worker is
  // not this rotation's business. F-7 keeps this best-effort, so it is deliberately
  // biased toward refusing: a false refusal costs a delay, a false all-clear rotates
  // out from under a running worker.
  checked += 1;
  const own = (estate?.worktrees || []).find(
    (w) => normalise(w.path) === normalise(programmeWorktree)
  );
  if (own) {
    const live = (own.liveWorkerPids || []).filter((pid) => !excludePids.includes(pid));
    if (live.length > 0) {
      obstacles.push({
        kind: 'live-worker',
        detail: `${live.length} process(es) appear to be running in this worktree (pids ${live.join(', ')}). Detection is best-effort under F-7, so this refuses rather than risks rotating out from under a live worker. Re-run once they are finished, or exclude them explicitly if they are false matches.`,
      });
    }
  } else {
    obstacles.push({
      kind: 'unreadable',
      detail: `This programme's own worktree (${programmeWorktree}) was not found in the worktree report, so live workers in it could not be checked.`,
    });
  }

  // A safety-critical field the collector could not gather is itself an obstacle —
  // otherwise a declared `unknown` would quietly pass a check it never actually ran.
  for (const u of estate?.unknown || []) {
    if (SAFETY_CRITICAL_UNKNOWNS.has(u.path)) {
      checked += 1;
      obstacles.push({
        kind: 'unreadable',
        detail: `${u.path} could not be gathered: ${u.why}`,
      });
    }
  }

  return { safe: obstacles.length === 0, obstacles, checked };
}

function normalise(p) {
  return p ? String(p).replace(/\\/g, '/').toLowerCase().replace(/\/+$/, '') : p;
}

// Path SEPARATORS are normalised for the banked document (case is not — these are
// display/identity values a human reads, not comparison keys). Node's resolve()
// yields backslashes on Windows while every path already in the schema uses forward
// slashes; mixing the two inside one document means a consumer comparing
// `repository.worktree` against `resumption.worktree` finds them unequal for a purely
// cosmetic reason. T-11 does exactly that comparison.
export function normaliseSeparators(p) {
  return typeof p === 'string' ? p.replace(/\\/g, '/').replace(/\/+$/, '') : p;
}

// ---------------------------------------------------------------------------
// AD-14 — the comparison every consumer of banked.head_sha must use
// ---------------------------------------------------------------------------

export function isBankingCommit({ headSha, bankedHeadSha, headParentSha }) {
  if (!headSha || !bankedHeadSha) return false;
  if (headSha === bankedHeadSha) return true;
  return Boolean(headParentSha) && headParentSha === bankedHeadSha;
}

// ---------------------------------------------------------------------------
// The /clear instruction — the command's actual deliverable to Warwick (INV-7)
// ---------------------------------------------------------------------------

export function renderClearInstruction(state) {
  const frontier = frontierTickets(state);
  const next = state.resumption;
  const model = state.model_recommendation;

  return [
    '',
    '='.repeat(72),
    'ROTATION BANKED — state is durable and pushed.',
    '='.repeat(72),
    '',
    'TYPE THIS EXACTLY:',
    '',
    '    /clear',
    '',
    `Then the fresh session resumes ${state.programme.id} at:`,
    `    ${next.next_action}`,
    '',
    `  worktree : ${next.worktree}`,
    `  branch   : ${next.branch}`,
    `  ticket   : ${next.ticket || '(none named)'}`,
    `  model    : ${model.model}${model.effort ? ` (effort: ${model.effort})` : ''}`,
    `  frontier : ${frontier.length ? frontier.map((t) => `${t.id} [${t.model}]`).join(', ') : '(none)'}`,
    '',
    'The handoff the fresh session reads:',
    '    Team Knowledge/fusion-brief/session-handoff.md',
    '',
    'This command did NOT run /close-session and did NOT run /clear.',
    'Rotation recommends; you act.',
    '='.repeat(72),
    '',
  ].join('\n');
}

export function renderRefusal(assessment, { programmeId = 'the programme' } = {}) {
  return [
    '',
    '='.repeat(72),
    'ROTATION REFUSED — nothing was banked, nothing was committed.',
    '='.repeat(72),
    '',
    `${programmeId} is not at a safe rotation boundary. ${assessment.obstacles.length} obstacle(s):`,
    '',
    ...assessment.obstacles.map((o, i) => `  ${i + 1}. [${o.kind}] ${o.detail}`),
    '',
    `(${assessment.checked} safety checks ran.)`,
    '',
    'Resolve the obstacles above and re-run /rotate-session.',
    'Do NOT type /clear — the current session still holds state that is not banked.',
    '='.repeat(72),
    '',
  ].join('\n');
}

// ---------------------------------------------------------------------------
// Git adapter — injectable so every path is testable against a real scratch repo
// ---------------------------------------------------------------------------

export function gitAdapter(repoPath, execFile = execFileSync) {
  const run = (args) => execFile('git', ['-C', repoPath, ...args], { encoding: 'utf8' }).trim();
  return {
    headSha: () => run(['rev-parse', 'HEAD']),
    headParentSha: () => {
      try {
        return run(['rev-parse', 'HEAD^']);
      } catch {
        return null; // root commit has no parent
      }
    },
    add: (paths) => run(['add', ...paths]),
    commit: (message) => run(['commit', '-m', message]),
    push: () => run(['push']),
  };
}

// ---------------------------------------------------------------------------
// The rotation itself
// ---------------------------------------------------------------------------

export function rotateSession({
  programmeHome,
  repoRoot,
  primaryCheckout,
  branch,
  ghRepo = null,
  primaryPath,
  bankedBy = 'unknown',
  bankedAt,
  now = () => new Date().toISOString().slice(0, 10),
  excludePids = [],
  push = true,
  dryRun = false,
  git,
  execFile = execFileSync,
  reconcileFn,
  writeFile = writeFileSync,
} = {}) {
  repoRoot = normaliseSeparators(repoRoot);
  primaryCheckout = normaliseSeparators(primaryCheckout);
  primaryPath = normaliseSeparators(primaryPath);
  const statePath = programmeStatePath(programmeHome);

  // 1. Read the durable base document (programme knowledge the estate cannot supply).
  const existing = readProgrammeState(statePath);
  if (!existing.ok) {
    return {
      status: 'blind',
      exitCode: EXIT.BLIND,
      reason: `durable programme state at ${statePath} is ${existing.reason}`,
      detail: existing.errors || existing.error || null,
    };
  }
  const base = existing.data;

  // 2. Collect the live estate (T-13).
  const branchSpecs = (base.branches || []).map((b) => ({
    name: b.name,
    role: b.role,
    upstream: b.upstream,
    note: b.note,
  }));
  const estate = collectEstateState({
    repoPath: repoRoot,
    primaryCheckout: primaryCheckout || base.repository.primary_checkout,
    worktree: repoRoot,
    branch: branch || base.repository.branch,
    baseSha: base.repository.base_sha,
    branchSpecs,
    ghRepo,
    primaryPath: primaryPath || base.repository.primary_checkout,
    buildPaths: [repoRoot],
    execFile,
    ...(reconcileFn ? { reconcileFn } : {}),
  });

  // 3. Judge. This is the only place a refusal is decided.
  const assessment = assessRotationSafety(estate, {
    programmeWorktree: repoRoot,
    excludePids,
  });

  if (!assessment.safe) {
    return {
      status: 'refused',
      exitCode: EXIT.REFUSED,
      assessment,
      message: renderRefusal(assessment, { programmeId: base.programme.id }),
    };
  }

  // 3a. Dry run stops here, having done the whole judgement and written nothing.
  if (dryRun) {
    return {
      status: 'would-rotate',
      exitCode: EXIT.ROTATED,
      assessment,
      message:
        `\nDRY RUN — safe to rotate. ${assessment.checked} safety checks ran, no obstacle found.\n` +
        `Nothing was written, committed or pushed. Re-run without --dry-run to bank.\n`,
    };
  }

  // 4. Safe. Compose the banked document. AD-14: head_sha is the head this state
  //    DESCRIBES — the commit that exists now, which becomes the banking commit's
  //    parent the moment we commit below.
  const at = bankedAt || now();
  const merged = mergeEstateIntoState(base, estate);
  const banked = {
    ...merged,
    banked: {
      ...merged.banked,
      at,
      by_model: bankedBy,
      head_sha: estate.repository.head_sha,
    },
    safe_boundary: {
      at_boundary: true,
      reason: `Verified by /rotate-session: ${assessment.checked} safety checks ran and found no obstacle. Tree clean, no unpushed commits, no live worker detected in this worktree.`,
      obstacles: [],
      verified_at: at,
    },
  };

  // 5. Validate before persisting. writeProgrammeState fails closed anyway (D-6);
  //    this makes the failure legible instead of an exception.
  const validation = validateProgrammeState(banked);
  if (!validation.ok) {
    return {
      status: 'blind',
      exitCode: EXIT.BLIND,
      reason: 'the composed state document failed validation — refusing to bank it',
      detail: validation.errors,
    };
  }

  // 6. Persist: durable state + the DERIVED handoff (AD-12 — rendered, never
  //    independently composed).
  writeProgrammeState(banked, statePath);
  const handoffPath = sessionHandoffPath(repoRoot);
  const handoff = renderSessionHandoff(banked);
  mkdirSync(dirname(handoffPath), { recursive: true });
  writeFile(handoffPath, handoff);

  // 7. Commit + push. Q-4: use the standing push authority, add no new mechanism.
  const g = git || gitAdapter(repoRoot, execFile);
  let committed = null;
  let pushed = false;
  try {
    g.add([statePath, handoffPath]);
    g.commit(`${base.programme.id}: bank programme state for rotation (${at})`);
    committed = g.headSha();
    if (push) {
      g.push();
      pushed = true;
    }
  } catch (err) {
    return {
      status: 'banked-not-pushed',
      exitCode: EXIT.BLIND,
      reason: `state was written but could not be committed/pushed: ${err.message}`,
      statePath,
      handoffPath,
      committed,
    };
  }

  return {
    status: 'rotated',
    exitCode: EXIT.ROTATED,
    statePath,
    handoffPath,
    bankedHeadSha: banked.banked.head_sha,
    bankingCommit: committed,
    pushed,
    assessment,
    message: renderClearInstruction(banked),
  };
}

// ---------------------------------------------------------------------------
// CLI — `node tools/governor/rotate-session.mjs [--dry-run] [--model <name>]`
// ---------------------------------------------------------------------------

function parseArgs(argv) {
  const args = { dryRun: false, model: 'unknown', excludePids: [] };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--dry-run') args.dryRun = true;
    else if (argv[i] === '--model') args.model = argv[++i] || 'unknown';
    else if (argv[i] === '--exclude-pid') {
      const pid = parseInt(argv[++i], 10);
      if (!Number.isNaN(pid)) args.excludePids.push(pid);
    } else if (argv[i] === '--programme-home') args.programmeHome = argv[++i];
    else if (argv[i] === '--gh-repo') args.ghRepo = argv[++i];
  }
  return args;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const args = parseArgs(process.argv.slice(2));
  const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
  const programmeHome =
    args.programmeHome || resolve(repoRoot, 'Deliverables', 'BUILD-018-session-governor');

  const result = rotateSession({
    programmeHome,
    repoRoot,
    ghRepo: args.ghRepo || null,
    bankedBy: args.model,
    // The rotation process itself, and whatever launched it, are not "live workers".
    excludePids: [process.pid, process.ppid, ...args.excludePids].filter(Boolean),
    dryRun: args.dryRun,
  });

  if (result.message) {
    process.stdout.write(result.message);
  } else {
    process.stdout.write(`\n${result.status.toUpperCase()}: ${result.reason}\n` +
      (result.detail ? `${JSON.stringify(result.detail, null, 2)}\n` : ''));
  }
  process.exitCode = result.exitCode;
}
