// Canonical-location verification and the PreToolUse deny gate (BUILD-018 T-11)
//
// THE FAILURE THIS EXISTS TO STOP
// -------------------------------
// A build has ONE canonical worktree and ONE canonical branch. A rotated or
// restarted session starts wherever the host puts it — usually the primary
// checkout on `main`. A Larry holding correct absolute paths can then write
// perfectly good code into the right FILES from the wrong REPOSITORY STATE:
// the edits land on the wrong branch, or in a checkout whose HEAD is nothing
// like the one the programme state describes. Nothing errors. The session looks
// productive. The work is misfiled.
//
// AD-18 — WHAT THE GATE KEYS ON
// -----------------------------
// The deny decision is made on cwd, repository root and branch ONLY. HEAD is
// compared and REPORTED (staleness, via reorient's AD-14 banking-commit rule)
// but never denies: the moment a session makes its first legitimate commit its
// HEAD diverges from the banked head, and a gate keyed on HEAD would block the
// session for having succeeded. Location is a precondition; head movement is
// normal progress.
//
// AD-19 — WHICH WAY EACH FAILURE FALLS
// ------------------------------------
// Two different unknowns, two different directions, deliberately:
//   * Cannot establish WHERE WE ARE, while a canonical location IS known
//     → DENY. Unknown is never aligned; that is the control doing its job.
//   * No active programme found at all, or the guard itself throws
//     → ALLOW. A guard that bricks every unrelated session, or that turns its
//       own bug into a total work stoppage, would be removed within a day — and
//       a removed control protects nothing. (Threat model: first-party mistakes,
//       not a malicious operator.)
// Both directions are proven by test, because an untested fail-direction is an
// assumption, not a control.
//
// ABSOLUTE-PATH LUCK IS NOT A CONTROL
// -----------------------------------
// The gate refuses on the session's LOCATION, never on the target path of the
// write. A Write whose file_path points into the canonical worktree is denied
// exactly as hard as one that does not: being right by accident is not the same
// as being in the right place, and the next call will not be lucky.

import { execFileSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

export const GUARDED_TOOLS = ['Write', 'Edit', 'MultiEdit', 'NotebookEdit', 'Bash', 'PowerShell'];

// Every tool in this grant that can execute a shell command, and therefore a
// `git push`. Enumerated rather than inspected: on 2026-08-08 the main-push gate
// covered `Bash` alone, and the push that defeated it went out through
// `PowerShell` — same command, same effect, no prompt. A gate that names one
// shell is not a gate.
export const SHELL_TOOLS = ['Bash', 'PowerShell'];

export const LOCATION = {
  ALIGNED: 'aligned',
  WRONG_WORKTREE: 'wrong-worktree',
  UNESTABLISHED: 'unestablished', // a canonical location exists; ours could not be read
  NO_PROGRAMME: 'no-programme', // nothing active to be wrong about
};

export const DECISION = { ALLOW: 'allow', DENY: 'deny', DEFER: 'defer', ASK: 'ask' };

export const PUSH_ASK_REASON = 'Warwick approval required for push to main.';

// ---------------------------------------------------------------------------
// Path comparison
// ---------------------------------------------------------------------------
// Windows: case-insensitive, and `C:\x` and `C:/x` are the same place. Path
// equality that says otherwise would produce a permanent false WRONG WORKTREE,
// which trains everyone to ignore the loudest signal the governor has.

export function normalisePath(p) {
  if (typeof p !== 'string' || p === '') return null;
  return p.replace(/\\/g, '/').replace(/\/+$/, '');
}

export function samePath(a, b) {
  const x = normalisePath(a);
  const y = normalisePath(b);
  if (!x || !y) return false;
  return x.toLowerCase() === y.toLowerCase();
}

export function isInside(child, parent) {
  const c = normalisePath(child);
  const p = normalisePath(parent);
  if (!c || !p) return false;
  const cl = c.toLowerCase();
  const pl = p.toLowerCase();
  return cl === pl || cl.startsWith(`${pl}/`);
}

// ---------------------------------------------------------------------------
// The canonical location, read from banked programme state
// ---------------------------------------------------------------------------

export function canonicalFromState(state, statePath) {
  if (!state || typeof state !== 'object') return null;
  const worktree =
    normalisePath(state.resumption?.worktree) || normalisePath(state.repository?.worktree);
  const branch = state.resumption?.branch || state.repository?.branch || null;
  if (!worktree || !branch) return null;
  return {
    programmeId: state.programme?.id || null,
    programmeTitle: state.programme?.title || null,
    worktree,
    branch,
    bankedHeadSha: state.banked?.head_sha || null,
    ticket: state.resumption?.ticket || null,
    statePath: normalisePath(statePath) || null,
  };
}

// ---------------------------------------------------------------------------
// Where this session actually is
// ---------------------------------------------------------------------------
// One `git rev-parse` for three facts. Every field is independently nullable:
// a partial answer must not read as a whole one.

export function liveLocation({ cwd, execFile = execFileSync } = {}) {
  const here = normalisePath(cwd);
  const out = { cwd: here, repoRoot: null, branch: null, headSha: null, gitError: null };
  if (!here) {
    out.gitError = 'no cwd was supplied';
    return out;
  }
  try {
    // Argument ORDER matters and is not obvious: `--abbrev-ref` is sticky — it
    // applies to every ref AFTER it, so `--abbrev-ref HEAD HEAD` prints the
    // branch name twice and the SHA never. Asking for the SHA first is what
    // makes all three answers distinct. (Caught by test, not by reading.)
    const raw = execFile(
      'git',
      ['-C', here, 'rev-parse', '--show-toplevel', 'HEAD', '--abbrev-ref', 'HEAD'],
      { encoding: 'utf8' }
    )
      .toString()
      .trim()
      .split('\n')
      .map((l) => l.trim())
      .filter(Boolean);
    out.repoRoot = normalisePath(raw[0]) || null;
    out.headSha = raw[1] || null;
    out.branch = raw[2] || null;
  } catch (err) {
    out.gitError = err?.message ? String(err.message).split('\n')[0] : 'git failed';
  }
  return out;
}

// ---------------------------------------------------------------------------
// The comparison (requirement 4)
// ---------------------------------------------------------------------------

export function compareLocation(canonical, live) {
  if (!canonical) {
    return { verdict: LOCATION.NO_PROGRAMME, mismatches: [], checked: 0 };
  }

  const mismatches = [];
  let checked = 0;

  // 1. cwd must be inside the canonical worktree.
  checked += 1;
  if (!live?.cwd) {
    mismatches.push({ field: 'cwd', expected: canonical.worktree, actual: '(unknown)' });
  } else if (!isInside(live.cwd, canonical.worktree)) {
    mismatches.push({ field: 'cwd', expected: canonical.worktree, actual: live.cwd });
  }

  // 2. repository root must BE the canonical worktree. This is the check that
  //    absolute-path writing cannot satisfy by luck.
  checked += 1;
  if (!live?.repoRoot) {
    mismatches.push({
      field: 'repository root',
      expected: canonical.worktree,
      actual: `(unknown${live?.gitError ? ` — ${live.gitError}` : ''})`,
    });
  } else if (!samePath(live.repoRoot, canonical.worktree)) {
    mismatches.push({ field: 'repository root', expected: canonical.worktree, actual: live.repoRoot });
  }

  // 3. branch must match exactly.
  checked += 1;
  if (!live?.branch) {
    mismatches.push({ field: 'branch', expected: canonical.branch, actual: '(unknown)' });
  } else if (live.branch !== canonical.branch) {
    mismatches.push({ field: 'branch', expected: canonical.branch, actual: live.branch });
  }

  // HEAD is compared for the record only — see AD-18. It never joins `mismatches`
  // and never contributes to a deny.
  const headMoved =
    canonical.bankedHeadSha && live?.headSha ? live.headSha !== canonical.bankedHeadSha : null;

  if (mismatches.length === 0) {
    return { verdict: LOCATION.ALIGNED, mismatches, checked, headMoved };
  }

  // An unknown-only mismatch is a different sentence from a genuinely different
  // place, and the recovery differs too — but both refuse. (AD-19)
  const allUnknown = mismatches.every((m) => String(m.actual).startsWith('(unknown'));
  return {
    verdict: allUnknown ? LOCATION.UNESTABLISHED : LOCATION.WRONG_WORKTREE,
    mismatches,
    checked,
    headMoved,
  };
}

// ---------------------------------------------------------------------------
// Bash classification
// ---------------------------------------------------------------------------
// Only used to decide what may still run WHILE MISALIGNED. The posture is
// deny-by-default: a command is permitted only if every segment of it is on the
// read-only list. "Unknown" is denied, because under mismatch the cost of a
// false deny is one explanatory message and the cost of a false allow is work
// committed to the wrong branch.

const READ_ONLY_BINARIES = new Set([
  'ls', 'pwd', 'cd', 'cat', 'head', 'tail', 'wc', 'echo', 'printf', 'grep', 'egrep', 'fgrep',
  'rg', 'find', 'file', 'stat', 'du', 'df', 'dirname', 'basename', 'realpath', 'readlink',
  'sort', 'uniq', 'cut', 'tr', 'date', 'whoami', 'hostname', 'env', 'type', 'which', 'command',
  'test', 'true', 'false', 'jq', 'diff', 'less', 'more', 'tree', 'sleep', 'seq', 'nl', 'md5sum',
  'sha1sum', 'sha256sum', 'gh', 'column', 'tac', 'comm', 'expr',
]);

const READ_ONLY_GIT_SUBCOMMANDS = new Set([
  'status', 'log', 'diff', 'show', 'rev-parse', 'rev-list', 'ls-files', 'ls-tree', 'ls-remote',
  'cat-file', 'describe', 'blame', 'shortlog', 'name-rev', 'symbolic-ref', 'for-each-ref',
  'whatchanged', 'reflog', 'count-objects', 'check-ignore', 'grep', 'version', 'help',
  'merge-base', 'show-ref', 'var',
]);

// `git branch`, `git tag`, `git remote`, `git worktree`, `git config` and `git stash` are
// read-only only in their listing forms. Anything else under them writes.
const CONDITIONAL_GIT = {
  branch: (args) => args.length === 0 || args.every((a) => /^(-a|-r|-v|-vv|--list|--all|--show-current|--format=.*|--sort=.*|--contains|--merged|--no-merged)$/.test(a)),
  tag: (args) => args.length === 0 || args.every((a) => /^(-l|--list|-n\d*|--sort=.*|--contains)$/.test(a)),
  remote: (args) => args.length === 0 || (args[0] === '-v' && args.length === 1) || args[0] === 'show' || args[0] === 'get-url',
  worktree: (args) => args[0] === 'list',
  config: (args) => args.some((a) => /^(--get|--get-all|--get-regexp|--list|-l)$/.test(a)),
  stash: (args) => args[0] === 'list' || args[0] === 'show',
  submodule: (args) => args[0] === 'status',
};

// Redirections that cannot create or modify a file the caller cares about.
const HARMLESS_REDIRECTS = /(?:\d?>>?\s*(?:\/dev\/null|NUL)\b|\d?>&\d)/gi;

export function splitBashSegments(command) {
  if (typeof command !== 'string') return [];
  return command
    .replace(/\\\n/g, ' ')
    .split(/\s*(?:\|\||&&|;|\||\n)\s*/)
    .map((s) => s.trim())
    .filter(Boolean);
}

export function classifyBashSegment(segment) {
  const raw = String(segment);

  // ── Command substitution, 2026-08-09 ──────────────────────────────────────
  // It used to be a flat 'unknown', which is why Larry's ordinary
  // `… && echo "banked: $(git rev-parse --short HEAD)"` could never be
  // classified and therefore could never be allowed. A substitution still hides
  // something — so classify what it hides, recursively, rather than guessing.
  // Every body must itself be read-only before the outer segment is judged on
  // the text that remains. `rm -rf $(anything-not-provably-read-only)` stays
  // 'unknown' and is never auto-allowed.
  if (/\$\(|`/.test(raw)) {
    const bodies = [];
    const dollar = /\$\(([^()]*)\)/g;
    const backtick = /`([^`]*)`/g;
    let m;
    while ((m = dollar.exec(raw)) !== null) bodies.push(m[1]);
    while ((m = backtick.exec(raw)) !== null) bodies.push(m[1]);
    // Nested or unbalanced substitution is not read honestly — stay unknown.
    const stripped = raw.replace(dollar, ' ').replace(backtick, ' ');
    if (bodies.length === 0 || /\$\(|`/.test(stripped)) return 'unknown';

    // A substitution standing in a COMMAND-DETERMINING position decides what
    // actually runs — `git $(echo commit)`, or `$(echo rm) -rf x`. Classifying
    // the visible remainder there would judge a command nobody has read. Only
    // substitutions in ARGUMENT position may be reduced. Caught by the existing
    // suite's "writes disguised as not-git are still writes" case, which failed
    // when this reduction was first written without the positional test.
    const head = raw.trim().split(/\s+/).slice(0, 2).join(' ');
    if (/\$\(|`/.test(head)) return 'unknown';
    for (const body of bodies) {
      if (classifyBashSegment(body) !== 'read-only') return 'unknown';
    }
    return classifyBashSegment(stripped);
  }

  const withoutHarmless = raw.replace(HARMLESS_REDIRECTS, ' ');
  if (/[<>]/.test(withoutHarmless)) return 'mutating'; // a real redirection writes

  let tokens = withoutHarmless.split(/\s+/).filter(Boolean);
  // Drop inline environment assignments: `FOO=bar git status`.
  while (tokens.length && /^[A-Za-z_][A-Za-z0-9_]*=/.test(tokens[0])) tokens = tokens.slice(1);
  if (tokens.length === 0) return 'read-only';
  // A trailing `&` backgrounds the segment; it does not change what it does.
  if (tokens[tokens.length - 1] === '&') tokens = tokens.slice(0, -1);
  if (tokens.length === 0) return 'read-only';

  const bin = tokens[0].replace(/^.*[\\/]/, '').toLowerCase();
  const args = tokens.slice(1);

  if (bin === 'git' || bin === 'git.exe') {
    // Skip the leading global flags git accepts before the subcommand.
    let i = 0;
    while (i < args.length && (args[i] === '-C' || args[i] === '-c')) i += 2;
    while (i < args.length && args[i].startsWith('-')) i += 1;
    const sub = (args[i] || '').toLowerCase();
    const rest = args.slice(i + 1);
    if (READ_ONLY_GIT_SUBCOMMANDS.has(sub)) return 'read-only';
    if (Object.prototype.hasOwnProperty.call(CONDITIONAL_GIT, sub)) {
      return CONDITIONAL_GIT[sub](rest) ? 'read-only' : 'mutating';
    }
    return 'mutating'; // commit, push, checkout, merge, rebase, reset, clean, add…
  }

  if (bin === 'node' || bin === 'node.exe' || bin === 'npm' || bin === 'npx' || bin === 'python' || bin === 'py') {
    // `node --version` is fine; `node anything.mjs` can write the whole disk.
    return args.every((a) => /^(--version|-v|--help|-h)$/.test(a)) ? 'read-only' : 'unknown';
  }

  if (bin === 'sed' || bin === 'awk' || bin === 'perl') {
    // `sed -i` edits in place; without it these only stream.
    return args.some((a) => /^-.*i/.test(a)) ? 'mutating' : 'read-only';
  }

  if (READ_ONLY_BINARIES.has(bin)) return 'read-only';
  return 'unknown';
}

export function classifyBashCommand(command) {
  const segments = splitBashSegments(command);
  if (segments.length === 0) return { kind: 'unknown', segments: [] };
  const kinds = segments.map((s) => ({ segment: s, kind: classifyBashSegment(s) }));
  if (kinds.some((k) => k.kind === 'mutating')) return { kind: 'mutating', segments: kinds };
  if (kinds.some((k) => k.kind === 'unknown')) return { kind: 'unknown', segments: kinds };
  return { kind: 'read-only', segments: kinds };
}

// ---------------------------------------------------------------------------
// The main-push human gate (Warwick, 2026-08-08)
// ---------------------------------------------------------------------------
// Warwick's required behaviour, and nothing more: an ordinary non-destructive
// push to origin/main raises an approval prompt; force-push, history rewrite,
// ref deletion and the other destructive push forms stay hard denied.
//
// This is deliberately INDEPENDENT of worktree alignment and of whether any
// programme state exists. The gate is about the destination `main`, not about
// where the session happens to be standing — a guard that only fires when
// misaligned would leave the ordinary case (aligned, on main) ungated, which
// is exactly the hole being closed.
//
// Direction of error is chosen on purpose: over-asking costs one prompt,
// under-asking loses the human gate. Anything push-shaped that cannot be
// positively established as NOT touching main asks.

const DESTRUCTIVE_PUSH_FLAG =
  /^(--force|-f|--force=.*|--force-with-lease(=.*)?|--force-if-includes|--mirror|--delete|-d|--prune)$/;

export function classifyPushSegment(segment) {
  const raw = String(segment ?? '');

  // The opacity test lives HERE, on the segment that actually pushes, rather
  // than over the whole compound command (D-B fix, 2026-08-09). A push whose
  // own arguments are hidden behind a substitution still goes to the human.
  if (/\bpush\b/.test(raw) && /\$\(|`/.test(raw)) {
    const bin0 = (raw.trim().split(/\s+/)[0] || '').replace(/^.*[\\/]/, '').toLowerCase();
    if (bin0 === 'git' || bin0 === 'git.exe') return 'main';
  }

  let tokens = raw.split(/\s+/).filter(Boolean);
  while (tokens.length && /^[A-Za-z_][A-Za-z0-9_]*=/.test(tokens[0])) tokens = tokens.slice(1);
  if (tokens.length === 0) return null;

  const bin = tokens[0].replace(/^.*[\\/]/, '').toLowerCase();
  if (bin !== 'git' && bin !== 'git.exe') return null;

  let args = tokens.slice(1);
  let i = 0;
  while (i < args.length && (args[i] === '-C' || args[i] === '-c')) i += 2;
  while (i < args.length && args[i].startsWith('-')) i += 1;
  if ((args[i] || '').toLowerCase() !== 'push') return null;

  const rest = args.slice(i + 1);

  // Destructive forms first — these are denied outright and never merely asked.
  for (const a of rest) {
    if (DESTRUCTIVE_PUSH_FLAG.test(a)) return 'destructive';
    // `origin +main` (forced refspec) and `origin :main` (ref deletion).
    if (!a.startsWith('-') && (a.startsWith('+') || a.startsWith(':'))) return 'destructive';
    if (!a.startsWith('-') && /:/.test(a) && a.split(':')[0] === '') return 'destructive';
  }

  // A dry run cannot move a remote ref, so it is not the gated event.
  if (rest.some((a) => a === '--dry-run' || a === '-n')) return null;

  const positional = rest.filter((a) => !a.startsWith('-'));

  // `git push` / `git push origin` with no refspec pushes the current branch to
  // its upstream. On this estate the working branch is main, and the guard
  // cannot prove otherwise from the command text alone, so it asks.
  if (positional.length <= 1) return 'main';

  // An explicit refspec: the DESTINATION is what matters. `feature:main` is a
  // push to main; `main:feature` is not.
  return positional.slice(1).some((spec) => {
    const dest = spec.includes(':') ? spec.split(':').pop() : spec;
    return /(^|\/)main$/.test(dest.replace(/^refs\/heads\//, ''));
  })
    ? 'main'
    : null;
}

export function classifyPushCommand(command) {
  const raw = String(command ?? '');
  if (!/\bpush\b/.test(raw)) return null;

  // ── D-B FIX, 2026-08-09 ───────────────────────────────────────────────────
  // The opacity test used to run over the WHOLE command string: any `$(` or
  // backtick ANYWHERE in a push-shaped command returned 'main', and therefore
  // ASK. Larry's ordinary shape ends
  //     … && git push -q origin HEAD:<feature> && echo "banked: $(git rev-parse --short HEAD)"
  // so a substitution in an unrelated `echo` forced Warwick's approval prompt on
  // every routine feature-branch push. Measured 2026-08-09: that is the repeated
  // "Allow Claude to run?" on safe work, and the overnight stall.
  //
  // The conservatism is KEPT where it is load-bearing and moved to the segment
  // that actually pushes — see classifyPushSegment. `git push origin $(b)` still
  // asks, because the substitution is in the push's own arguments. A substitution
  // in a sibling segment cannot change this push's destination and no longer
  // gates it.
  const kinds = splitBashSegments(raw).map(classifyPushSegment);
  if (kinds.includes('destructive')) return 'destructive';
  if (kinds.includes('main')) return 'main';
  return null;
}

// ---------------------------------------------------------------------------
// The decision
// ---------------------------------------------------------------------------

// ── The safe-operation allow (Warwick, 2026-08-09, requirements A/B) ────────
// ALLOW is emitted only for what the guard can POSITIVELY classify as ordinary.
// Anything it cannot read stays DEFER and reaches the host's own prompt — that
// is the difference between this and "allow everything", and it is why an
// unreadable `rm -rf $(…)` is not auto-approved.
//
// This never runs before the push classification in guard(): destination-main
// pushes ASK and destructive pushes DENY before control reaches here.
export function safeOperationDecision({ toolName, toolInput, allowReason, deferReason }) {
  if (!SHELL_TOOLS.includes(toolName)) {
    // Write/Edit/MultiEdit/NotebookEdit in an established location.
    return { decision: DECISION.ALLOW, reason: allowReason };
  }
  const cls = classifyBashCommand(toolInput?.command);
  if (cls.kind === 'read-only' || cls.kind === 'mutating') {
    return { decision: DECISION.ALLOW, reason: allowReason, classification: cls.kind };
  }
  return { decision: DECISION.DEFER, reason: deferReason, classification: cls.kind };
}

export function decide({ toolName, toolInput, comparison, canonical }) {
  if (!GUARDED_TOOLS.includes(toolName)) {
    return { decision: DECISION.DEFER, reason: `${toolName} is not a guarded tool.` };
  }
  if (!comparison || comparison.verdict === LOCATION.NO_PROGRAMME) {
    // Location cannot be enforced without programme state, so this branch does
    // not claim it is. It still answers the SAFETY question it can answer, so
    // that ordinary work is not pushed down to the host's native prompt for
    // want of a canonical location (Warwick, 2026-08-09, requirement E's
    // evidence clause: the unestablished-state semantics were themselves a
    // cause of the regression — measured, not assumed).
    return safeOperationDecision({
      toolName,
      toolInput,
      allowReason: 'No active programme state, so no location claim is made; the operation is ordinary and non-destructive.',
      deferReason: 'No active programme state, and this operation is not positively classifiable as ordinary.',
    });
  }
  if (comparison.verdict === LOCATION.ALIGNED) {
    return safeOperationDecision({
      toolName,
      toolInput,
      allowReason: 'Session is in the canonical worktree and branch, and the operation is ordinary and non-destructive.',
      deferReason: 'Session is aligned, but this operation is not positively classifiable as ordinary.',
    });
  }

  if (SHELL_TOOLS.includes(toolName)) {
    const cls = classifyBashCommand(toolInput?.command);
    if (cls.kind === 'read-only') {
      return {
        decision: DECISION.DEFER,
        reason: 'Read-only shell command permitted while misaligned (diagnosis must stay possible).',
        classification: cls.kind,
      };
    }
    return {
      decision: DECISION.DENY,
      reason: buildDenyReason({ toolName, comparison, canonical, classification: cls.kind }),
      classification: cls.kind,
    };
  }

  return {
    decision: DECISION.DENY,
    reason: buildDenyReason({ toolName, comparison, canonical }),
  };
}

export function buildDenyReason({ toolName, comparison, canonical, classification }) {
  const live = comparison.live || {};
  const lines = [
    '🚨 WRONG WORKTREE — the BUILD-018 Session Governor blocked this tool call.',
    '',
    `Blocked tool : ${toolName}${classification ? ` (${classification} shell command)` : ''}`,
    `Programme    : ${canonical?.programmeId || '(unidentified)'}${canonical?.ticket ? ` — next ticket ${canonical.ticket}` : ''}`,
    '',
    'CANONICAL (from banked programme state):',
    `  worktree : ${canonical?.worktree}`,
    `  branch   : ${canonical?.branch}`,
    'THIS SESSION:',
    `  cwd      : ${live.cwd || '(unknown)'}`,
    `  repo root: ${live.repoRoot || '(unknown)'}`,
    `  branch   : ${live.branch || '(unknown)'}`,
    `  HEAD     : ${live.headSha || '(unknown)'}`,
    '',
    `MISMATCH: ${comparison.mismatches.map((m) => m.field).join(', ')}`,
  ];

  if (comparison.verdict === LOCATION.UNESTABLISHED) {
    lines.push(
      '',
      'This session\'s location could NOT be established. Unknown is not aligned —',
      'the governor refuses rather than guessing it is in the right place.'
    );
  }

  lines.push(
    '',
    'NO IMPLEMENTATION IS PERMITTED FROM HERE.',
    'Absolute paths are NOT a workaround. Writing into the canonical worktree from a',
    'session rooted somewhere else is exactly the failure this guard exists to stop —',
    'the files may be right while the branch and HEAD the work lands on are wrong.',
    '',
    'RECOVERY — Larry performs this AUTOMATICALLY; Warwick does nothing:',
    `  1. Larry calls EnterWorktree with path: ${canonical?.worktree}`,
    '     This routes the session INTO the canonical checkout in-process. It needs no',
    '     relaunch, and in observed Remote Control use it needed no approval prompt.',
    '  2. Larry re-verifies cwd, repository root, branch and HEAD, then continues the work.',
    '',
    '  FALLBACK — ONLY if EnterWorktree actually BLOCKS on an approval that Warwick',
    '  cannot see from Remote Control: Larry says this once, verbatim, then waits —',
    '     "Approve the pending EnterWorktree request in the local Claude terminal"',
    '  Larry must NOT ask Warwick to relaunch, to open a terminal in a particular folder,',
    '  or to run git. Larry owns the complete git lifecycle (AD-20).'
  );

  return lines.join('\n');
}

// ---------------------------------------------------------------------------
// Discovery of the active programme (guard-weight, not schema-weight)
// ---------------------------------------------------------------------------
// The guard needs four fields, not a validated document. Full schema validation
// belongs to reorient, which reports corruption loudly at session start; paying
// for it again on every Write would tax the whole session for an answer this
// gate does not use.

// ESTATE-ROOT DISCOVERY — extracted so it has exactly ONE implementation.
// Every probe is asked `git worktree list --porcelain`; the union of the answers,
// normalised and de-duplicated case-insensitively (Windows), IS the estate as far
// as any governor component is concerned. A probe that is not a repository, or
// that git cannot answer for, is skipped silently — another probe may still find
// the estate, and a discovery step that threw would make one bad path fatal.
//
// Extracted for BUILD-018 T-14 (`build-registry.mjs`), which needs the same root
// set but must ENUMERATE every programme rather than collapse to one. Behaviour
// here is unchanged from findCanonical's original inline loop; a second copy in
// the registry would have been a second source of truth for what "the estate"
// means, and a drift test only reports divergence — it does not prevent it.
export function discoverWorktreeRoots({ probes = [], execFile = execFileSync } = {}) {
  const roots = [];
  const seen = new Set();
  const addRoot = (p) => {
    const n = normalisePath(p);
    if (n && !seen.has(n.toLowerCase())) {
      seen.add(n.toLowerCase());
      roots.push(n);
    }
  };

  for (const probe of probes) {
    if (!probe) continue;
    try {
      const out = execFile('git', ['-C', probe, 'worktree', 'list', '--porcelain'], {
        encoding: 'utf8',
      }).toString();
      for (const line of out.split('\n')) {
        if (line.startsWith('worktree ')) addRoot(line.slice('worktree '.length).trim());
      }
    } catch {
      // This probe is not a repository (or git is unavailable). Not fatal: another
      // probe may still find the estate.
    }
  }

  return roots;
}

export function findCanonical({
  cwd,
  estateRoots = [],
  execFile = execFileSync,
  readdir = readdirSync,
  read = readFileSync,
  exists = existsSync,
} = {}) {
  const roots = discoverWorktreeRoots({ probes: [cwd, ...estateRoots], execFile });

  const found = [];
  for (const root of roots) {
    const deliverables = join(root, 'Deliverables');
    let entries;
    try {
      entries = readdir(deliverables, { withFileTypes: true });
    } catch {
      continue;
    }
    for (const e of entries) {
      if (!e.isDirectory()) continue;
      const candidate = join(deliverables, e.name, 'programme-state.json');
      if (!exists(candidate)) continue;
      try {
        const doc = JSON.parse(read(candidate, 'utf8'));
        if (doc?.programme?.status !== 'active') continue;
        const canonical = canonicalFromState(doc, candidate);
        if (canonical) found.push(canonical);
      } catch {
        // A state file the guard cannot parse is reorient's problem to shout
        // about, not a reason for the guard to block every tool call.
      }
    }
  }

  if (found.length === 0) return { canonical: null, reason: 'no active programme state found', candidates: [] };

  // ONE PROGRAMME, MANY COPIES.
  // A programme-state file is a tracked file on a branch, so EVERY worktree with
  // that branch's content checked out has a copy — and after the build merges,
  // main has one too. Counting files would therefore report a single build as
  // two or three "active programmes" and the guard would disable itself on the
  // exact estate it was written for. Identity is the programme ID, not the path.
  const byProgramme = new Map();
  for (const c of found) {
    const key = c.programmeId || c.worktree;
    if (!byProgramme.has(key)) byProgramme.set(key, []);
    byProgramme.get(key).push(c);
  }

  const resolved = [];
  for (const [, copies] of byProgramme) {
    if (copies.length === 1) {
      resolved.push(copies[0]);
      continue;
    }
    // Prefer the SELF-CONSISTENT copy: the one sitting in the worktree it names
    // as canonical. A copy on some other branch may be an older banking of the
    // same programme, and letting it win would enforce a superseded location.
    const selfConsistent = copies.filter((c) => c.statePath && isInside(c.statePath, c.worktree));
    if (selfConsistent.length === 1) {
      resolved.push(selfConsistent[0]);
      continue;
    }
    const agreed = copies.every(
      (c) => samePath(c.worktree, copies[0].worktree) && c.branch === copies[0].branch
    );
    if (agreed) {
      resolved.push(copies[0]);
      continue;
    }
    // Genuinely contradictory copies of one programme: refuse to pick.
    return {
      canonical: null,
      reason: `copies of ${copies[0].programmeId} disagree about its canonical location`,
      candidates: copies,
    };
  }

  if (resolved.length > 1) {
    // Ambiguity must not silently pick one. It also must not block work on a
    // machine running two builds — reorient reports it loudly at session start.
    return {
      canonical: null,
      reason: `${resolved.length} active programmes found; the guard will not choose between them`,
      candidates: resolved,
    };
  }
  return { canonical: resolved[0], reason: null, candidates: resolved };
}

// ---------------------------------------------------------------------------
// Hook plumbing
// ---------------------------------------------------------------------------

export function parseHookInput(raw) {
  if (typeof raw !== 'string' || raw.trim() === '') {
    return { ok: false, reason: 'empty stdin', payload: {} };
  }
  try {
    const payload = JSON.parse(raw);
    if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
      return { ok: false, reason: 'stdin was not a JSON object', payload: {} };
    }
    return { ok: true, payload };
  } catch (err) {
    return { ok: false, reason: `stdin was not valid JSON: ${err.message}`, payload: {} };
  }
}

export function guard(payload, opts = {}) {
  const toolName = payload?.tool_name;
  const toolInput = payload?.tool_input || {};
  const cwd = payload?.cwd || opts.cwd;

  if (!GUARDED_TOOLS.includes(toolName)) {
    return { decision: DECISION.DEFER, reason: `${toolName ?? '(no tool)'} is not guarded.` };
  }

  // The main-push human gate runs BEFORE any location logic. It must fire in
  // the ordinary aligned case, and it must survive the absence of programme
  // state — both of which the location path exits early on.
  if (SHELL_TOOLS.includes(toolName)) {
    const push = classifyPushCommand(toolInput?.command);
    if (push === 'destructive') {
      return {
        decision: DECISION.DENY,
        reason:
          'Force-push, history rewrite and ref deletion are denied outright. ' +
          'Ordinary pushes to main are gated by Warwick\'s approval prompt, not by this route.',
        push,
      };
    }
    if (push === 'main') {
      return { decision: DECISION.ASK, reason: PUSH_ASK_REASON, push };
    }
  }

  const { canonical, reason } = findCanonical({ cwd, ...opts });
  if (!canonical) {
    // A guard that FAILED to establish its location is not the same thing as a
    // guard that correctly established there is no active programme. Only the
    // second may allow. The first hands the call to the human, because a
    // component that has just broken has not earned the right to approve
    // anything. (Found by the existing AD-19 fail-open test, which caught this
    // branch emitting `allow` after an internal throw.)
    if (reason !== 'no active programme state found') {
      return { decision: DECISION.DEFER, reason: `Guard has no canonical location: ${reason}.` };
    }
    // Same posture as NO_PROGRAMME in decide(): make no location claim, but do
    // not force ordinary work down to the host's native prompt for want of one.
    // MEASURED 2026-08-09: this is the branch every guarded call on this estate
    // actually takes, because the only programme-state.json present is
    // BUILD-018's and its status is "complete". The location half of this guard
    // is therefore inert until an active programme state exists — recorded
    // honestly rather than papered over.
    return {
      ...safeOperationDecision({
        toolName,
        toolInput,
        allowReason: `Guard has no canonical location (${reason}); no location claim is made, and the operation is ordinary and non-destructive.`,
        deferReason: `Guard has no canonical location (${reason}), and this operation is not positively classifiable as ordinary.`,
      }),
      canonical: null,
    };
  }

  const live = liveLocation({ cwd, execFile: opts.execFile });
  const comparison = { ...compareLocation(canonical, live), live };
  const d = decide({ toolName, toolInput, comparison, canonical });
  return { ...d, comparison, canonical, live };
}

const HOOK_DECISION = {
  [DECISION.ALLOW]: 'allow',
  [DECISION.ASK]: 'ask',
  [DECISION.DENY]: 'deny',
};

export function toHookOutput(result) {
  if (!result) return null;
  // DEFER alone emits nothing and falls through to the host's own permission
  // layer. ALLOW now emits, which is the half that was missing: before
  // 2026-08-09 this function returned null for everything except ASK and DENY,
  // so safe work reached Warwick's "Allow Claude to run?" prompt however
  // clearly the guard had established it was ordinary.
  const permissionDecision = HOOK_DECISION[result.decision];
  if (!permissionDecision) return null;
  return {
    hookSpecificOutput: {
      hookEventName: 'PreToolUse',
      permissionDecision,
      permissionDecisionReason: result.reason,
    },
  };
}

export function runHook(raw, opts = {}) {
  const parsed = parseHookInput(raw);
  if (!parsed.ok) {
    // AD-19: the guard's own inability to read its input must not stop the
    // session. It has established nothing, so it claims nothing.
    return { decision: DECISION.DEFER, reason: `Guard could not read its input (${parsed.reason}).` };
  }
  try {
    return guard(parsed.payload, opts);
  } catch (err) {
    return { decision: DECISION.DEFER, reason: `Guard errored (${err.message}); failing open by AD-19.` };
  }
}

// ---------------------------------------------------------------------------
// CLI — a PreToolUse hook. ALWAYS exits 0.
// ---------------------------------------------------------------------------

async function main() {
  let raw = '';
  try {
    const chunks = [];
    for await (const chunk of process.stdin) chunks.push(chunk);
    raw = Buffer.concat(chunks).toString('utf8');
  } catch {
    raw = '';
  }

  const estateRoots = [];
  const argv = process.argv.slice(2);
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--estate' && argv[i + 1]) estateRoots.push(argv[++i]);
  }
  if (process.env.GOVERNOR_ESTATE_ROOT) estateRoots.push(process.env.GOVERNOR_ESTATE_ROOT);

  let out = null;
  try {
    out = toHookOutput(runHook(raw, { estateRoots }));
  } catch {
    out = null; // fail open, never trap the session
  }
  if (out) process.stdout.write(JSON.stringify(out));
  process.exitCode = 0;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main();
}
