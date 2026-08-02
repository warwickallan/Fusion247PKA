#!/usr/bin/env node
// SESSION-START REORIENTATION (BUILD-018 T-11, NARROWED by WO-OR-05 2026-08-02).
//
// ---------------------------------------------------------------------------
// WHAT THIS MODULE IS NOW, AND WHAT IT STOPPED BEING
// ---------------------------------------------------------------------------
// It used to be a BUILD-* programme recovery engine: it walked every worktree in the
// estate looking for `Deliverables/*/programme-state.json`, collapsed multiple checkouts
// of one programme, adjudicated disagreeing copies, assessed banked-head freshness
// against the banking commit, and rendered a resumption ticket. All of that is deleted.
// Programme state no longer exists in this estate, so on every real session that machinery
// had exactly one output — "NO BANKED PROGRAMME STATE FOUND" — which is a lot of code to
// print one sentence nobody can act on.
//
// THREE BEHAVIOURS SURVIVE, and they are the reason the module survives at all:
//
//   1. THE LOOSE-`Deliverables/` SWEEP. Recent top-level `Deliverables/*.md` that no
//      programme file describes, with the ones that appear to be waiting on Warwick
//      flagged. This is the behaviour that caught the VlogOps plan a fresh session had
//      no other way of seeing, and it has no replacement anywhere in the estate.
//   2. THE HONCHO CONTINUITY BRIEF. `continuity.mjs` owns the single read path; this
//      module calls it and passes the result through. It is the AUTHORITATIVE source of
//      current focus — the sweep is a fallback and must never be mistaken for it.
//   3. REPOSITORY / WORKTREE / BRANCH VERIFICATION. Where this session actually is, read
//      by EXECUTING git rather than by believing anything.
//
// ---------------------------------------------------------------------------
// ONE HONEST CHANGE IN KIND TO (3), STATED RATHER THAN SMUGGLED
// ---------------------------------------------------------------------------
// Verification used to be a COMPARISON: live location versus the canonical location
// recorded in banked programme state, producing ALIGNED or a WRONG WORKTREE alarm. With
// no banked state there is no canonical location to compare against, so what survives is
// the REPORT — cwd, repository root, branch, HEAD, working-tree cleanliness, unpushed
// count and upstream — with no verdict attached. Every fact below is still executed and
// still true; there is simply nothing left to be right or wrong relative to. Anyone
// reading this brief expecting an alignment verdict should know it is gone rather than
// assume a silent ALIGNED.
//
// INV-2 THROUGHOUT: this is a SessionStart hook. It always exits 0, it never blocks a
// session, and every section fails open independently — a section that cannot be produced
// is reported as such and the others still render.

import { execFileSync } from 'node:child_process';
import { readdirSync, readFileSync, statSync, lstatSync, realpathSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { pathToFileURL, fileURLToPath } from 'node:url';

import { readContinuityBrief } from './continuity.mjs';

// INLINED from the deleted `rotate-session.mjs` (WO-OR-05). Four lines, one caller, and
// keeping a module alive to export them would have been the tail wagging the dog.
//
// Its sibling `isBankingCommit` was NOT inlined: its only consumer here was the
// banked-freshness assessment, which went with the programme state. Inlining a helper
// whose sole consumer has been deleted would re-grow the corpse this Work Order removed.
export function normaliseSeparators(p) {
  return typeof p === 'string' ? p.replace(/\\/g, '/').replace(/\/+$/, '') : p;
}

// ---------------------------------------------------------------------------
// SessionStart source policy — Silas's decision D-B §B-2 (2026-08-01)
// ---------------------------------------------------------------------------
// An UNRECOGNISED source falls through to the MOST informative brief, never to
// silence: an over-informative brief wastes a few hundred characters, an absent
// one loses the session. Unknown is never absent (INV-1).
export const BRIEF_MODE = { FULL: 'full', DELTA: 'delta' };

export const SOURCE_POLICY = {
  clear: {
    mode: BRIEF_MODE.FULL,
    headline: 'This context was CLEARED. Nothing of the previous session survives in context.',
  },
  startup: {
    mode: BRIEF_MODE.FULL,
    headline: 'This is a FRESH session. Nothing has been established in this context yet.',
  },
  compact: {
    mode: BRIEF_MODE.FULL,
    headline:
      'RECOVERY — this context was COMPACTED. Treat in-context memory as a lossy summary, ' +
      'not as evidence; re-read from disk before acting on anything you think you remember.',
  },
  resume: {
    mode: BRIEF_MODE.DELTA,
    headline:
      'This session was RESUMED, so your restored transcript already carries the history. ' +
      'Only the delta is below. Your restored history may PREDATE durable state on disk — ' +
      'durable state on disk wins over anything in the transcript.',
  },
};

// Returns the rendering policy for a SessionStart source. Never returns null:
// an unrecognised or absent source is reported as such and still gets a brief.
export function briefModeFor(source) {
  const known = Object.prototype.hasOwnProperty.call(SOURCE_POLICY, source)
    ? SOURCE_POLICY[source]
    : null;
  if (known) return { ...known, source, recognised: true };
  const shown = source === undefined || source === null ? '(absent)' : JSON.stringify(source);
  return {
    mode: BRIEF_MODE.FULL,
    recognised: false,
    source,
    headline:
      `UNRECOGNISED SessionStart source ${shown} — this governor does not know this entry ` +
      'path, so it is giving you the FULL brief rather than guessing. Report the value above.',
  };
}

// ---------------------------------------------------------------------------
// Hook input — pure, never throws
// ---------------------------------------------------------------------------

export function parseHookInput(raw) {
  if (typeof raw !== 'string' || raw.trim() === '') {
    return { ok: false, reason: 'empty stdin', payload: {} };
  }
  try {
    const payload = JSON.parse(raw);
    // `typeof [] === 'object'`, so an array would slip through a naive check and
    // then read `source`/`cwd` as undefined — a malformed payload silently
    // becoming a skip. Only a plain object is a hook payload.
    if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
      return { ok: false, reason: 'stdin was not a JSON object', payload: {} };
    }
    return { ok: true, payload };
  } catch (err) {
    return { ok: false, reason: `stdin was not valid JSON: ${err.message}`, payload: {} };
  }
}

// ---------------------------------------------------------------------------
// PRESERVED BEHAVIOUR 3 — repository / worktree / branch verification
// ---------------------------------------------------------------------------
// Injectable and fails soft, field by field. Every field is INDEPENDENTLY nullable
// because a partial answer must never read as a whole one: `unpushed: null` means "there
// is no upstream, or git would not say", and it is a different claim from `unpushed: 0`.

// WO-OR-17. The default filesystem for the location probes, injectable. This mirrors the
// sweep's `DEFAULT_SWEEP_IO` exactly — it is this module's EXISTING idiom rather than new
// machinery — and it exists for the identical reason WO-OR-14 gave: an unreadable-directory
// failure cannot be induced deterministically on every machine, and a proof that cannot be
// made to fail is not a proof. Every injected test is PAIRED with a control asserting these
// defaults read the real disk, so the seam can never end up testing a fiction.
export const DEFAULT_GIT_IO = {
  realpathSync: (p) => realpathSync.native(p),
  statSync,
  // TQA-005. Non-mutating occupation probe: if THIS process is already in the resolved
  // directory, the session (at least the hook process) can be there — measured. chdir is
  // forbidden (INV-2); access(X_OK) is meaningless on Windows; readdir is listability.
  getProcessCwd: () => process.cwd(),
};

// WO-OR-17 / TQA-001. WHY A PATH PROBE'S FAILURE IS CLASSIFIED RATHER THAN COLLAPSED.
//
// "The filesystem answered and there is nothing there" and "the probe could not answer" are
// different claims, and only the first entitles anyone to say a directory does not exist.
// The exception carries which one it was; `soft()` used to throw it away.
//
//   'absent'      ENOENT / ENOTDIR — a MEASUREMENT. The filesystem answered.
//   'not-a-path'  the argument was never a path, so nothing on disk was consulted at all.
//   'unreadable'  EPERM / EACCES / ELOOP / anything else carrying an errno — the path may
//                 exist perfectly well and the probe was REFUSED. Verified on this estate:
//                 an ACL-denied directory raises EPERM from `realpathSync.native` while
//                 `statSync` still reports `isDirectory() === true`, so rendering that as
//                 "no such directory on disk" was flatly false.
//   'unknown'     the throw carried no code at all. Never upgraded into a claim about disk.
export function classifyPathFailure(err) {
  const code = err && typeof err === 'object' ? err.code : undefined;
  if (code === 'ENOENT' || code === 'ENOTDIR') return 'absent';
  if (code === 'ERR_INVALID_ARG_TYPE' || code === 'ERR_INVALID_ARG_VALUE') return 'not-a-path';
  if (typeof code === 'string') return 'unreadable';
  return 'unknown';
}

export function gitFacts(worktreePath, execFile = execFileSync, io = DEFAULT_GIT_IO) {
  const run = (args) =>
    execFile('git', ['-C', worktreePath, ...args], {
      encoding: 'utf8',
      // WO-OR-14. `execFileSync` INHERITS stderr unless told otherwise, so every failing
      // probe below wrote a raw `fatal:` line straight into a LIVE SessionStart path — a
      // single file-as-cwd probe emitted eight of them, and this revision adds more probes.
      // Each of those failures is ALREADY represented honestly in the rendered block as
      // `(unknown)` or `UNVERIFIED`, so the stderr carried no information a reader uses.
      // Suppressing it hides no signal; it removes noise from the one surface Warwick
      // actually reads. stdin is `ignore` so no probe can ever block waiting on input at
      // session start.
      stdio: ['ignore', 'pipe', 'ignore'],
    })
      .toString()
      .trim();
  // WO-OR-17. THE DEFECT UNDERNEATH THE PREVIOUS THREE ROUNDS, AND WHY THEY KEPT FINDING
  // "another instance".
  //
  // `soft()` was `try { return fn(); } catch { return null; }` across TWELVE call sites, and
  // it returned the SAME null for "I measured, and the answer is nothing" as for "the probe
  // could not answer". The one distinction this whole module exists to preserve was
  // destroyed in a shared helper BEFORE any field existed, and every field downstream
  // inherited it. The renderer was then left to reconstruct a distinction that had already
  // been thrown away — and did so by guessing: an existing-but-unreadable directory rendered
  // as "no such directory on disk" (TQA-001), and ANY symbolic-ref failure rendered as proof
  // of detachment (TQA-002). Those were never two defects seen in two fields; they are one
  // defect seen twice, which is why fixing instances never converged.
  //
  // This is a NARROWING of the lie, not a mechanism. The VALUE channel is untouched — null
  // still means "no value", every field is still independently nullable, and no caller of
  // this object changes shape. What is added is that the CAUSE is kept beside the value
  // instead of discarded, and only the two derivations that were guessing ever read it.
  const causes = Object.create(null);
  const soft = (name, fn) => {
    try {
      return fn();
    } catch (err) {
      // `?? { code: 'unknown' }` because `throw null` is legal and would otherwise make a
      // recorded cause indistinguishable from no cause at all — the same collapse, one
      // level down, inside the very helper closing it.
      causes[name] = err ?? { code: 'unknown' };
      return null;
    }
  };

  // WO-OR-14. The values are computed BEFORE the returned object rather than inside it,
  // because two of them are now DERIVED from others — `detached` from the head and
  // symbolic-ref probes, `upstreamState` from `detached` and the branch. Deriving one
  // answer from another is only honest when every input is itself a measurement, so each
  // input is named here and each stays independently nullable exactly as before.

  // ---- cwd: resolved, true-cased, AND established to be a directory ----
  // WO-OR-11 earned the true on-disk casing with `realpathSync.native`. But RESOLVING a
  // path and establishing that A SESSION CAN BE IN IT are different claims, and a regular
  // FILE resolves perfectly well — `cwd : C:/Fusion247PKA/CLAUDE.md` rendered as an
  // established location beneath "executed, not assumed". Existence was the weaker
  // question all along; the heading claims a DIRECTORY, so directory-ness is measured and
  // the outcomes are kept apart instead of collapsed into one truthy string.
  //
  // WO-OR-17 measured what this establishes and, just as importantly, what it does NOT.
  // `statSync(...).isDirectory()` establishes TYPE. It does not establish ENTERABILITY, and
  // the two genuinely come apart: with only Read-Data denied, `realpathSync.native` and
  // `statSync` both succeed and report a directory while `readdirSync` raises EPERM. No
  // probe is added for it, and the reason is that no honest one exists here. `readdirSync`
  // measures LISTABILITY, which is strictly stronger than the TRAVERSE a working directory
  // actually needs, so adopting it would replace one false claim with a different false
  // claim pointing the other way — the exact trade WO-OR-11 refused when it declined to
  // delete the field. `process.chdir()` is the only true test and it MUTATES the hook
  // process, which INV-2 forbids. So the claim is TYPE, and the limit is stated rather than
  // papered over: a directory whose contents cannot be listed still renders as an
  // established cwd, because type was measured and listability was not.
  const resolved = soft('resolved', () => {
    const real = io.realpathSync(worktreePath);
    const st = io.statSync(real);
    return {
      path: normaliseSeparators(real),
      kind: st.isDirectory() ? 'directory' : st.isFile() ? 'file' : 'other',
    };
  });
  // WO-OR-17 / TQA-001. WHY the path has no value, carried from the point of measurement to
  // the rendered line rather than inferred downstream from its absence.
  const cwdFailure = resolved ? null : classifyPathFailure(causes.resolved);
  // The errno itself, for the reader. Only the CODE — never the message, which carries
  // stacks and paths and is the noise WO-OR-14 removed from this surface.
  const cwdFailureCode =
    !resolved && causes.resolved && typeof causes.resolved.code === 'string'
      ? causes.resolved.code
      : null;
  // TQA-005 (Codex repairs run 3). ENTERABILITY without mutation.
  //
  // Directory TYPE (realpath + isDirectory) does not prove the session can occupy the path.
  // The only non-mutating positive proof available here: the hook process is ALREADY in that
  // directory. If realpath(process.cwd()) equals the resolved path, occupation is measured
  // and the bare path is earned. If not, we hold only type and must not claim session location.
  // null = could not measure occupation (probe failed, or type was never established).
  const cwdOccupiedByHook = (() => {
    if (!resolved || resolved.kind !== 'directory') return null;
    const proc = soft('processCwd', () => normaliseSeparators(io.realpathSync(io.getProcessCwd())));
    if (proc === null) return null;
    return proc === resolved.path;
  })();

  const gitReadable = soft('gitReadable', () => (run(['rev-parse', '--git-dir']), true)) === true;
  const repoRoot = soft('repoRoot', () => normaliseSeparators(run(['rev-parse', '--show-toplevel'])));
  const headSha = soft('headSha', () => run(['rev-parse', 'HEAD']));
  const branch = soft('branch', () => run(['rev-parse', '--abbrev-ref', 'HEAD']));

  // WO-OR-14. `--abbrev-ref HEAD` prints the LITERAL STRING "HEAD" when HEAD is detached,
  // and the block rendered that as though it were a branch name. Matching on that string
  // would be reading a tell rather than taking a measurement, so the state is probed
  // directly: `symbolic-ref -q` returns the branch when HEAD is attached and exits
  // non-zero, silently, when it is not.
  const symbolicBranch = soft('symbolicBranch', () => run(['symbolic-ref', '-q', '--short', 'HEAD']));
  // TWO measurements, not one flag reused. If HEAD does not resolve at all — an unborn
  // branch, or git unavailable — then nothing can be concluded about attachment, so this
  // is null rather than false.
  //
  // WO-OR-17 / TQA-002. `symbolicBranch === null` was treated as PROOF OF DETACHMENT, so a
  // probe that could not answer produced the confident sentence "(DETACHED — HEAD is not on
  // a branch)". That is the same defect as TQA-001 wearing a different field: `soft()`
  // handed the renderer one null for two different worlds and the derivation guessed which.
  //
  // The cause settles it, and it settles it MECHANICALLY rather than by judgement. Verified
  // by execution on this estate:
  //
  //     detached HEAD    symbolic-ref -q --short HEAD  ->  exit status 1     <- the ANSWER
  //     not a repository  symbolic-ref ...             ->  exit status 128
  //     git not on PATH   spawn                        ->  no status, code ENOENT
  //
  // `-q` exits 1 for exactly one reason: HEAD is not a symbolic ref. That IS the measured
  // detached response, and nothing else is. Any other failure leaves this null — not false,
  // because "the probe broke" is not evidence that HEAD is attached either.
  const detached =
    headSha === null
      ? null
      : symbolicBranch !== null
        ? false
        : causes.symbolicBranch?.status === 1
          ? true
          : null;
  // WO-OR-17 completion (Grok handover). WHY the symbolic-ref probe has no value — the same
  // cause-preservation pattern as cwdFailure. Without this, exit 128 and ENOENT both left
  // detached=null and the renderer had one line for two worlds; worse, that line still said
  // "DETACHED HEAD" in the prose of the unverified branch case, so a failed probe still
  // *mentioned* the confident diagnosis it was no longer allowed to claim.
  //
  //   null            probe answered (value is in symbolicBranch) or was never attempted
  //   'fatal'         git ran and exited non-1 (e.g. 128 — not a repo / corrupt ref)
  //   'unavailable'   spawn/system failure with a code (ENOENT = git not on PATH)
  //   'unknown'       throw carried neither status nor code
  // status===1 is measured detachment and lives in `detached`, not here.
  const symbolicRefFailure = (() => {
    if (symbolicBranch !== null) return null;
    const err = causes.symbolicBranch;
    if (!err) return null;
    if (err.status === 1) return null; // measured detached — carried by `detached`
    if (typeof err.status === 'number') return 'fatal';
    if (typeof err.code === 'string') return 'unavailable';
    return 'unknown';
  })();
  const symbolicRefStatus =
    symbolicRefFailure === 'fatal' && typeof causes.symbolicBranch?.status === 'number'
      ? causes.symbolicBranch.status
      : null;
  const symbolicRefCode =
    symbolicRefFailure === 'unavailable' && typeof causes.symbolicBranch?.code === 'string'
      ? causes.symbolicBranch.code
      : null;

  // WO-OR-14. Whether this is the primary checkout or a LINKED worktree, measured by
  // `--git-dir` differing from `--git-common-dir` rather than by pattern-matching a path.
  // In an estate running twenty-odd worktrees, "which checkout am I in" is precisely the
  // question this block exists to answer. null when the probe cannot run, and it then
  // renders nothing at all rather than guessing either way.
  const linkedWorktree = soft('linkedWorktree', () => {
    const [gitDir, commonDir] = run([
      'rev-parse', '--path-format=absolute', '--git-dir', '--git-common-dir',
    ]).split('\n');
    if (!gitDir || !commonDir) return null;
    return normaliseSeparators(gitDir.trim()) !== normaliseSeparators(commonDir.trim());
  });

  const dirty = soft('dirty', () => run(['status', '--porcelain']).length > 0);
  const unpushed = soft('unpushed', () => {
    const parsed = parseInt(run(['rev-list', '--count', '@{u}..HEAD']), 10);
    return Number.isNaN(parsed) ? null : parsed;
  });
  // The CURRENT pushed head, read live from the remote-tracking ref — not whatever was
  // pushed at some point in the past. A resuming session needs to know what is actually
  // durable on the remote right now.
  const upstreamRef = soft('upstreamRef', () => run(['rev-parse', '--abbrev-ref', '@{u}']));
  const upstreamSha = soft('upstreamSha', () => run(['rev-parse', '@{u}']));

  // WO-OR-14. THE DEFECT WO-OR-11 INTRODUCED WHILE CLOSING ANOTHER ONE.
  //
  // WO-OR-11 gated the sentence "nothing here is pushed" on `gitReadable`, which comes from
  // `rev-parse --git-dir`. But the UPSTREAM probe fails INDEPENDENTLY of general git
  // readability, and a DETACHED HEAD is an entirely ordinary state that separates them:
  //
  //     git rev-parse --git-dir            -> .git    (so gitReadable === true)
  //     git rev-parse --abbrev-ref @{u}    -> fatal: HEAD does not point to a branch
  //
  // On a detached HEAD the commit may well BE pushed, so that sentence was flatly false —
  // and `actions/checkout` produces exactly this state on every CI run. `gitReadable` was
  // never too coarse a THRESHOLD; it was the wrong QUESTION. It asks "did any git command
  // work here" and was made to answer "is this branch pushed".
  //
  // So the upstream answer now carries its own measured state, each value reached by a
  // probe that can mean only one thing:
  //
  //   'tracked'          @{u} answered, or for-each-ref found an upstream
  //   'none-configured'  the branch ref EXISTS and its upstream field is empty — measured
  //   'detached'         HEAD resolves and is not a symbolic ref, so no branch tracks anything
  //   'unreadable'       git could not answer here at all
  //   'unknown'          the probes ran and did not settle it — never a confident sentence
  const upstreamState = (() => {
    if (!gitReadable) return 'unreadable';
    if (upstreamRef) return 'tracked';
    if (detached === true) return 'detached';
    if (symbolicBranch) {
      // `for-each-ref` exits 0 and prints `<name>|<upstream>` for a ref that exists, with
      // an EMPTY second half when nothing is tracked — and prints NOTHING AT ALL when the
      // ref does not match. That difference is what makes "no upstream is configured" a
      // MEASUREMENT rather than merely the absence of one, which is exactly what the old
      // `gitReadable` gate could not express.
      const row = soft('forEachRef', () =>
        run([
          'for-each-ref',
          '--format=%(refname:short)|%(upstream:short)',
          `refs/heads/${symbolicBranch}`,
        ])
      );
      if (row === null || row === '') return 'unknown';
      return row.endsWith('|') ? 'none-configured' : 'tracked';
    }
    return 'unknown';
  })();

  return {
    // WHAT THE CALLER CLAIMED. Preserved verbatim and NEVER rendered as an established
    // location on its own — see `resolvedPath` immediately below and `renderLocationSection`.
    worktreePath: normaliseSeparators(worktreePath),
    // WO-OR-11. THE MEASUREMENT `worktreePath` never had. Every other field in this object
    // comes from executing git; `worktreePath` alone was the caller's own argument handed
    // straight back, and it was then printed under a heading reading "executed, not
    // assumed". That heading was a claim the value had not earned.
    //
    // `realpathSync.native` earns it, and it is the right probe rather than an existence
    // check: it returns the TRUE ON-DISK CASING, so a host-supplied `c:/Fusion247PKA` comes
    // back as `C:/Fusion247PKA` and stops disagreeing with the `repoRoot` that git measured.
    // That disagreement was the fingerprint of one value being supplied and the other
    // measured; resolving the path removes the CAUSE rather than hiding the tell.
    //
    // WHY NOT SIMPLY DELETE OR RELABEL THE FIELD (the other route offered): the
    // cwd-versus-repo-root comparison is HOW a wrong-location session becomes visible to a
    // human reading the brief. Dropping the field to stop it lying would trade a lie for a
    // blind spot. One syscall makes it true instead.
    //
    // null means NOT ESTABLISHED — the path does not exist, is unreadable, is not a
    // directory, or was not a string at all. It never falls back to the claimed value.
    // WO-OR-14 narrowed it: a non-null `resolvedPath` now means "a DIRECTORY was
    // established here", which is the claim the heading actually makes.
    resolvedPath: resolved && resolved.kind === 'directory' ? resolved.path : null,
    // WO-OR-14. WHAT IT ACTUALLY RESOLVED TO, kept separately so the reader can be told
    // WHY a path failed rather than only that it did. "There is no such directory" and
    // "that is a file, not a directory" are different diagnoses and point at different
    // mistakes. null means it did not resolve at all.
    resolvedKind: resolved ? resolved.kind : null,
    // WO-OR-17 / TQA-001. WHY it has no value, not merely THAT it has none. null when the
    // path resolved; otherwise 'absent' (measured — the filesystem answered and there is
    // nothing there), 'unreadable' (the probe was refused; the path may exist perfectly
    // well), 'not-a-path' (nothing on disk was consulted at all), or 'unknown'.
    //
    // This field is the whole repair in one line: without it the renderer had a single null
    // for four different worlds and picked the most confident of them.
    cwdFailure,
    // The errno, for the reader. The CODE only — never the message, which carries stacks and
    // paths and is precisely the noise WO-OR-14 took off this surface.
    cwdFailureCode,
    // TQA-005. true when the hook process is measured to occupy resolvedPath; false when
    // type was established but the process is elsewhere; null when occupation was not measured.
    cwdOccupiedByHook,
    // WO-OR-11. Whether git ANSWERED here at all, as its own measurement.
    //
    // `soft()` returns null both when a git call fails and when git legitimately reports
    // nothing, which made "git could not run" and "this branch tracks nothing" the same
    // value — and the renderer turned that single null into the confident sentence
    // "nothing here is pushed". This flag is what separates them.
    //
    // It is the one field here that is deliberately NOT nullable, and that is consistent
    // with the invariant above rather than an exception to it: it records whether a
    // measurement was possible, so "we could not tell" IS "not established" — false. It
    // fails closed, which is the direction that cannot manufacture a reassuring claim.
    //
    // WO-OR-14 REMOVED ITS SECOND JOB. It no longer gates the upstream sentence; that is
    // `upstreamState`'s, measured by upstream probes rather than by this one. A flag that
    // answers a question it never asked is the whole shape of the defect being closed here.
    gitReadable,
    repoRoot,
    linkedWorktree,
    headSha,
    branch,
    // WO-OR-17. EXPOSED because it was already MEASURED and was being thrown away.
    //
    // On an unborn branch (`git init`, no commit yet) git answers:
    //     rev-parse HEAD               -> exit 128   so `branch` is null
    //     rev-parse --abbrev-ref HEAD  -> exit 128   so `branch` is null
    //     symbolic-ref -q --short HEAD -> "main"     MEASURED, and then discarded
    // and the block printed `branch : (unknown)` while holding the answer. Every defect in
    // this sequence so far has been the block claiming MORE than it measured; this one
    // claims LESS, which is the same dishonesty inverted and is invisible to anyone looking
    // only for overclaims. The four-state test does not care which direction it fails in.
    symbolicBranch,
    detached,
    // WO-OR-17 completion. Cause of a null symbolicBranch that is NOT measured detachment.
    // null when the probe answered or when status===1 (that case is `detached === true`).
    symbolicRefFailure,
    symbolicRefStatus,
    symbolicRefCode,
    dirty,
    unpushed,
    upstreamRef,
    upstreamSha,
    upstreamState,
  };
}

function show(v) {
  if (v === null || v === undefined) return '(unknown)';
  return String(v);
}

// TQA-009 (Codex repairs run 6). `dirty === undefined` was treated as falsy and rendered
// `clean` — an unmeasured state wearing a factual costume. Clean is earned only by
// `=== false`. The same strictness applies to HEAD: absence is never a value.
function renderDirty(facts) {
  if (facts.dirty === true) return 'DIRTY — uncommitted changes present';
  if (facts.dirty === false) return 'clean';
  // TQA-008 partial: when git itself could not be read, say so rather than a bare unknown.
  if (facts.gitReadable === false) {
    return '(unknown — git could not be read here, so working-tree state is NOT established)';
  }
  return '(unknown)';
}

function renderHead(facts) {
  if (facts.headSha) return String(facts.headSha);
  if (facts.gitReadable === false) {
    return '(unknown — git could not be read here)';
  }
  return '(unknown)';
}

// WO-OR-11. How the cwd line reports itself.
//
// Three outcomes, and keeping them three is the point of the exercise. A single
// "(unknown)" for the last two would be honest about the failure while HIDING that the
// host asserted a path at all — and the asserted value is the most useful diagnostic
// there is when a session has been started in the wrong place.
//
//   measured      -> the resolved, true-cased path. This one is a fact.
//   nothing said  -> the host supplied no cwd. Nobody claimed anything.
//   claimed, bad  -> the host supplied a path that does not exist on disk. Something WAS
//                    claimed and it did not check out, which is a different and much more
//                    interesting failure than silence.
//
// WO-OR-14 SPLIT "claimed, bad" INTO THE DIAGNOSES IT WAS HIDING, and added the state the
// four-state test showed was missing entirely:
//
//   claimed a FILE   -> it resolved, so the old probe passed it; but a file is not a place
//                       a session can be in, and the heading claims one that is.
//   nothing claimed, -> the host said nothing and the module fell back to its OWN process
//   showing our own     directory. The PATH is measured and true; the HEADING — "where
//                       this session is" — is not, because the only authority on that said
//                       nothing. A true value can still carry an unearned claim.
function renderCwd(facts, cwdClaimedByHost) {
  if (facts.resolvedPath) {
    // TQA-003 / TQA-005. Bare path is EARNED only when occupation is measured
    // (cwdOccupiedByHook === true). Directory type alone never upgrades into "session is here".
    const occupied = facts.cwdOccupiedByHook === true;
    if (cwdClaimedByHost) {
      if (occupied) return facts.resolvedPath;
      return (
        `${facts.resolvedPath} (directory type measured; session enterability NOT established` +
        (facts.cwdOccupiedByHook === false
          ? ' — hook process is not in this directory)'
          : ')')
      );
    }
    return (
      `${facts.resolvedPath} (UNCLAIMED — the host supplied no cwd, so this is the hook ` +
      "process's own working directory, not a location this session claimed;" +
      (occupied
        ? ' occupation measured for the hook process)'
        : ' directory type measured, enterability NOT established)')
    );
  }
  const claimed = facts.worktreePath;
  // A non-string reaches here because `normaliseSeparators` passes it through unchanged
  // and a truthy non-string then sails on as if it were a location. Quoting it makes it
  // visibly not-a-path rather than letting `String(7)` render as `7`.
  const asShown = typeof claimed === 'string' ? claimed : JSON.stringify(claimed);
  if (facts.resolvedKind === 'file') {
    return `(UNVERIFIED — host reported ${asShown}; that path is a FILE, not a directory a session can be in)`;
  }
  if (facts.resolvedKind === 'other') {
    return `(UNVERIFIED — host reported ${asShown}; that path exists but is not a directory)`;
  }
  if (claimed === null || claimed === undefined || claimed === '') {
    return '(UNVERIFIED — no path was supplied)';
  }
  // WO-OR-17 / TQA-001. THE DEFECT: every remaining failure fell into the line below, so an
  // existing directory the probe was REFUSED read as a confident claim that it does not
  // exist. "I measured, and there is nothing" and "I could not look" are not the same
  // sentence, and only the first of them is about the disk. The cause now arrives here from
  // the point of measurement instead of being guessed from the absence of a value.
  if (facts.cwdFailure === 'unreadable') {
    const why = facts.cwdFailureCode ? ` (${facts.cwdFailureCode})` : '';
    return (
      `(UNVERIFIED — host reported ${asShown}; that path could NOT BE READ${why} — ` +
      'this is NOT a claim that it does not exist)'
    );
  }
  if (facts.cwdFailure === 'not-a-path') {
    return `(UNVERIFIED — host reported ${asShown}; that is not a path, so nothing on disk was consulted)`;
  }
  if (facts.cwdFailure === 'unknown') {
    return (
      `(UNVERIFIED — host reported ${asShown}; the probe failed and gave no reason — ` +
      'this is NOT a claim that it does not exist)'
    );
  }
  // Reached only on a MEASURED absence — ENOENT or ENOTDIR, i.e. the filesystem answered.
  return `(UNVERIFIED — host reported ${asShown}; no such directory on disk)`;
}

// WO-OR-14. `--show-toplevel` returns the root of the CURRENT WORKING TREE, which in a
// linked worktree is not the repository root at all. The old label "repo root" therefore
// printed a sentence its measurement did not back — and in an estate that is mostly linked
// worktrees it overclaimed on the COMMON case, not an edge one. The label now names what
// was measured, and the kind of checkout is measured too rather than left to the reader to
// infer from a path that looks unfamiliar.
function renderToplevel(facts) {
  if (facts.repoRoot === null || facts.repoRoot === undefined) {
    // TQA-008: bare (unknown) hid whether git itself was unreadable.
    if (facts.gitReadable === false) return '(unknown — git could not be read here)';
    return '(unknown)';
  }
  if (facts.linkedWorktree === true) return `${facts.repoRoot} (LINKED worktree)`;
  if (facts.linkedWorktree === false) return `${facts.repoRoot} (primary checkout)`;
  // The probe did not answer. Say nothing rather than guess a kind.
  return String(facts.repoRoot);
}

// WO-OR-14. `rev-parse --abbrev-ref HEAD` returns the literal string "HEAD" on a detached
// HEAD, which this line rendered as if it were a branch name — a reader cannot tell it
// from a branch actually called HEAD, and the state it really signals is the one worth
// knowing. `detached` is measured by `symbolic-ref`, so this renders a state rather than
// a string that happens to look like one.
function renderBranch(facts) {
  if (facts.detached === true) {
    return `(DETACHED — HEAD is not on a branch${facts.headSha ? `, it is commit ${facts.headSha}` : ''})`;
  }
  if (facts.branch === null || facts.branch === undefined) {
    // WO-OR-17. `symbolic-ref` may have answered when `rev-parse` could not — the unborn
    // branch is exactly that state. Rendering "(unknown)" over a name the module is holding
    // is the four-state test failing downwards: a MEASUREMENT reported as "I could not
    // tell". What is claimed here is only what was measured — HEAD points at this branch —
    // and specifically NOT that any commit exists on it, because none was resolved.
    if (facts.symbolicBranch) {
      return `${facts.symbolicBranch} (MEASURED by symbolic-ref; no commit resolved on it)`;
    }
    return '(unknown)';
  }
  if (facts.branch === 'HEAD') {
    // Reaching here means git said "HEAD" and the detached probe did NOT confirm it.
    // Never name the unconfirmed diagnosis: the word DETACHED in this line was still a
    // confident sentence wearing an UNVERIFIED coat (TQA-002 residual on the unfinished WO).
    // Distinguish fatal vs unavailable so two different probe failures cannot collapse
    // into one rendered line (PIN LAYER 2).
    if (facts.symbolicRefFailure === 'fatal') {
      const st = facts.symbolicRefStatus != null ? ` (exit ${facts.symbolicRefStatus})` : '';
      return (
        `(UNVERIFIED — git returned the literal "HEAD"; symbolic-ref failed fatally${st}, ` +
        'so attachment is not established)'
      );
    }
    if (facts.symbolicRefFailure === 'unavailable') {
      const c = facts.symbolicRefCode ? ` (${facts.symbolicRefCode})` : '';
      return (
        `(UNVERIFIED — git returned the literal "HEAD"; symbolic-ref could not run${c}, ` +
        'so attachment is not established)'
      );
    }
    return '(UNVERIFIED — git returned the literal "HEAD"; attachment is not established)';
  }
  return String(facts.branch);
}

export function renderLocationSection(facts, { cwdClaimedByHost = true } = {}) {
  if (!facts) return null;
  // TQA-005. The heading used to say "WHERE THIS SESSION IS (executed, not assumed)" which
  // overclaimed relative to any line that could only report directory type. Each line now
  // states its own measurement; the heading must not promise more than they deliver.
  const lines = [
    '⟦GOV⟧ SESSION LOCATION PROBES (executed; each line states what was measured):',
    `  cwd          : ${renderCwd(facts, cwdClaimedByHost)}`,
    `  worktree root: ${renderToplevel(facts)}`,
    `  branch       : ${renderBranch(facts)}`,
    `  HEAD         : ${renderHead(facts)}`,
    `  working tree : ${renderDirty(facts)}`,
  ];
  if (facts.upstreamRef) {
    lines.push(`  upstream     : ${facts.upstreamRef} @ ${show(facts.upstreamSha)}`);
    lines.push(
      `  unpushed     : ${facts.unpushed === null ? '(unknown)' : `${facts.unpushed} commit(s) ahead of upstream`}`
    );
  } else if (facts.upstreamState === 'none-configured') {
    // TQA-006 (Codex repairs run 4). Measured fact: the attached branch's upstream field
    // is empty. That is NOT a measurement of remote push status — a branch can be pushed
    // without having @{u} configured (no remote, reconfigured remote, push without -u).
    // The old sentence "nothing here is pushed" was the same defect class as the rest of
    // this sequence: a stronger claim than the probe earned. State only what was measured.
    lines.push(
      '  upstream     : (no upstream configured — pushed status NOT established)'
    );
  } else if (facts.upstreamState === 'detached') {
    lines.push(
      '  upstream     : (unknown — HEAD is DETACHED, so no branch is tracking anything here; this is NOT a claim that nothing is pushed)'
    );
  } else if (facts.upstreamState === 'unreadable' || !facts.gitReadable) {
    // WO-OR-11. git never ran, so the module has measured nothing about what is pushed.
    // This branch used to fall into the sentence above, which meant a session on an
    // unreadable path was told "nothing here is pushed" — a claim about the remote
    // derived from a git call that never happened. Stating the reason matters as much as
    // withholding the claim: a bare "(unknown)" invites the reader to assume the branch
    // is simply untracked.
    lines.push(
      '  upstream     : (unknown — git could not be read here, so this is NOT a claim that nothing is pushed)'
    );
  } else {
    // WO-OR-14. The probes ran and did not settle it. This arm FAILS CLOSED on purpose:
    // any fact object that does not carry a measured `upstreamState` lands here rather
    // than inheriting the confident sentence, so a future caller cannot re-open the defect
    // simply by omitting the field.
    lines.push(
      '  upstream     : (unknown — the upstream probe did not answer, so this is NOT a claim that nothing is pushed)'
    );
  }
  // Stated because its ABSENCE is a change a reader could otherwise mistake for a pass.
  lines.push(
    '  No alignment verdict is offered: with no banked programme state there is no canonical'
  );
  lines.push('  location to compare against. These are facts, not an approval to implement.');
  return lines.join('\n');
}

// ---------------------------------------------------------------------------
// PRESERVED BEHAVIOUR 1 — the loose-`Deliverables/` sweep
// ---------------------------------------------------------------------------
// Carried through this narrowing UNCHANGED in behaviour. It surfaces recent top-level
// `Deliverables/*.md` that the deleted programme recovery could never see — the failure
// that let a fresh session miss the VlogOps plan entirely — and flags the ones whose text
// reads as waiting on Warwick.
//
// It is a FALLBACK and never the source of truth for current focus (Warwick's ruling);
// Honcho holds the explicit focus. The rendering says so on its own line, because a
// reader who takes this list as the focus will work on the wrong thing.

const ESTATE_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const DELIVERABLE_WINDOW_DAYS = 21;
const DECISION_MARKER =
  /nothing (will|would) be built|awaiting (your|a) |until you accept|your call|needs? (a )?(decision|your )|accept (this|a) plan|what i need:|waiting on you|before any building/i;

// WO-OR-14. The default filesystem, injectable. This is the module's EXISTING idiom —
// `gitFacts(path, execFile = execFileSync)` and `buildBrief({ factsFn, sweepFn })` already
// do exactly this — not new machinery. It exists because a per-file read failure cannot be
// induced deterministically on Windows, and a proof that cannot be made to fail is not a
// proof. The suite pairs every injected test with a control asserting these defaults read
// the real disk, so the seam can never end up testing a fiction.
// WO-OR-17 added `lstatSync` and `realpathSync`. `statSync` FOLLOWS a symlink, so a link at
// `Deliverables/linked.md` pointing outside the swept root was read, reported, and labelled
// `Deliverables/linked.md` — a claim about WHERE THE CONTENT CAME FROM that was never
// measured. `lstat` sees the link itself; `realpath` says where it actually goes.
const DEFAULT_SWEEP_IO = { readdirSync, statSync, readFileSync, lstatSync, realpathSync };

export function sweepOpenDeliverables(root = ESTATE_ROOT, now = Date.now(), io = DEFAULT_SWEEP_IO) {
  const dir = join(root, 'Deliverables');
  let names;
  try {
    names = io.readdirSync(dir);
  } catch (err) {
    // WO-OR-14. ENOENT is the ONE honest silence: there is no `Deliverables/` here at all,
    // so there is genuinely nothing to sweep and nothing to say.
    //
    // EVERY OTHER failure means something IS there and could not be read — a file where the
    // directory should be, a permissions refusal, a traversal error. Returning null for
    // those made "I swept and there is nothing open" and "I could not look" render
    // BYTE-IDENTICALLY, because `buildBrief` then omits the section entirely. That is the
    // same silence-reads-as-health failure this whole module exists to prevent, sitting
    // inside the module itself.
    if (err && err.code === 'ENOENT') return null;
    return (
      '⟦GOV⟧ OPEN DELIVERABLES: NOT SWEPT — Deliverables/ could not be read ' +
      `(${err?.code || err?.message || 'unknown error'}). ` +
      'This is NOT a report that there is nothing open.'
    );
  }
  const cutoff = now - DELIVERABLE_WINDOW_DAYS * 86400_000;
  const rows = [];
  // WO-OR-14. Files that could not be READ, counted so the omission can be stated. This is
  // the same defect one level down: a per-file failure was silently `continue`d, so a
  // rendered list could be quietly incomplete with nothing to tell the reader so.
  //
  // Note what is deliberately NOT counted here: a non-file (a directory named `*.md`) and a
  // file outside the 21-day window are legitimate EXCLUSIONS, not failures, and inflating
  // the count with them would cry wolf on a healthy estate.
  let unreadable = 0;
  // TQA-007 (Codex repairs run 5). Provenance is containment under the estate's claimed
  // Deliverables path, measured via realpath of the LEAF against realpath of the ESTATE
  // ROOT plus the logical "Deliverables/" segment — NOT against realpath(Deliverables)
  // alone, and NOT via leaf-is-symlink alone.
  //
  // Why leaf-is-symlink was incomplete: if Deliverables itself is a junction or directory
  // symlink to an external tree, every regular file under it has lstat isSymbolicLink=false
  // and was labelled "inside" while the content lived outside the estate. Comparing against
  // realpath(Deliverables) makes the same mistake: both the dir and the file resolve into
  // the external tree, so containment holds and the label still lies.
  //
  // Against estate root: a redirected Deliverables puts file realpaths outside
  // `<estateReal>/Deliverables/…`, so they render outside. A leaf symlink to outside does
  // the same. A genuine in-tree file matches. Probe failure stays unverified.
  let estateReal = null;
  try {
    estateReal = normaliseSeparators(io.realpathSync(root));
  } catch {
    estateReal = null;
  }
  const expectedPrefix = estateReal ? `${estateReal}/Deliverables` : null;
  for (const name of names) {
    if (!name.toLowerCase().endsWith('.md')) continue; // top-level *.md only
    const full = join(dir, name);
    let provenance = 'unverified';
    let realPath = null;
    try {
      realPath = normaliseSeparators(io.realpathSync(full));
      if (!expectedPrefix || !realPath) {
        provenance = 'unverified';
      } else {
        // Case-insensitive containment on win32 — the estate is Windows-primary.
        const a = process.platform === 'win32' ? realPath.toLowerCase() : realPath;
        const p = process.platform === 'win32' ? expectedPrefix.toLowerCase() : expectedPrefix;
        provenance = a === p || a.startsWith(`${p}/`) ? 'inside' : 'outside';
      }
    } catch {
      // The probe could not answer. That is NOT "it is fine" — same rule as everywhere else
      // in this module, which is the point of fixing the shared helper rather than a field.
      provenance = 'unverified';
    }
    let st;
    try {
      st = io.statSync(full);
    } catch {
      unreadable += 1;
      continue;
    }
    if (!st.isFile() || st.mtimeMs < cutoff) continue;
    let head = '';
    try {
      head = io.readFileSync(full, 'utf8').slice(0, 6000);
    } catch {
      unreadable += 1;
      continue;
    }
    const h1 = (head.match(/^#\s+(.+)$/m) || [])[1]?.trim() || name.replace(/\.md$/, '');
    const awaits = DECISION_MARKER.test(head);
    rows.push({ name, title: h1, mtimeMs: st.mtimeMs, awaits, provenance, realPath });
  }
  if (!rows.length) {
    // WO-OR-14. Nothing to show — but WHY there is nothing to show is the whole question.
    // If files were unreadable, "nothing open" would be a claim the sweep did not earn.
    if (unreadable) {
      return (
        `⟦GOV⟧ OPEN DELIVERABLES: NOT SWEPT IN FULL — ${unreadable} file(s) in Deliverables/ ` +
        'could not be read, and nothing else was in scope. ' +
        'This is NOT a report that there is nothing open.'
      );
    }
    return null;
  }
  rows.sort((a, b) => b.mtimeMs - a.mtimeMs);
  // Display cap — intentional, not a failure. TQA-004 (Codex repairs final run 2): when the
  // list is truncated, the reader MUST be told. A silent slice is incompleteness wearing the
  // costume of a complete answer — the same defect class as an unreadable file dropped
  // without a tell (WO-OR-14). The cap itself is not the defect; silence about it is.
  const DISPLAY_CAP = 8;
  const top = rows.slice(0, DISPLAY_CAP);
  const lines = ['⟦GOV⟧ OPEN DELIVERABLES (loose, not BUILD-* — nothing else surfaces these):'];
  for (const r of top) {
    const flag = r.awaits ? '  ⟵ AWAITS YOUR DECISION' : '';
    // WO-OR-17. `Deliverables/<name>` is a provenance claim. It is now made plainly only
    // where provenance was measured and held; otherwise the reader is told what is actually
    // known, on the same line, rather than being left with a label that reads as settled.
    const where =
      r.provenance === 'outside'
        ? `  ⟵ CONTENT IS NOT IN Deliverables/ — it resolves to ${r.realPath}`
        : r.provenance === 'unverified'
          ? '  ⟵ provenance NOT established — this path may not be where the content is'
          : '';
    lines.push(`  • ${r.title} — Deliverables/${r.name}${flag}${where}`);
  }
  const pending = top.filter((r) => r.awaits).length;
  if (pending) lines.push(`  ${pending} deliverable(s) appear to be waiting on Warwick — treat as a pending product-decision handback.`);
  // WO-OR-14. A list that is SHOWN must say when it is incomplete, or a reader takes it as
  // the whole answer — which is exactly how a silently dropped file becomes invisible.
  if (unreadable) {
    lines.push(`  ${unreadable} file(s) could not be read and are NOT represented in this list.`);
  }
  // TQA-004. Readable rows omitted by the display cap are incompleteness of a different
  // kind from unreadable ones — both must be disclosed, neither may masquerade as the full set.
  if (rows.length > DISPLAY_CAP) {
    lines.push(
      `  … and ${rows.length - DISPLAY_CAP} more recent deliverable(s) not shown ` +
      `(display cap ${DISPLAY_CAP}) — this list is NOT complete.`
    );
  }
  return lines.join('\n');
}

// ---------------------------------------------------------------------------
// Composition
// ---------------------------------------------------------------------------

export function toHookOutput(additionalContext) {
  return {
    hookSpecificOutput: {
      hookEventName: 'SessionStart',
      additionalContext: additionalContext || '',
    },
  };
}

/**
 * buildBrief(raw, deps) -> string
 *
 * The three surviving sections, each guarded independently so one failure cannot
 * suppress the others. Synchronous half only — the Honcho brief is async and is appended
 * by `main()`, which keeps this function testable with no network and no clock.
 */
export function buildBrief(raw, {
  cwd = process.cwd(),
  facts = null,
  factsFn = gitFacts,
  sweepFn = sweepOpenDeliverables,
  stdinError = null,
} = {}) {
  const parsed = parseHookInput(raw);
  const policy = briefModeFor(parsed.payload?.source);

  // WO-OR-14. WHETHER THE HOST SAID ANYTHING AT ALL about where this session is.
  //
  // The old `normaliseSeparators(payload.cwd) || normaliseSeparators(cwd)` let an absent,
  // empty or falsy value fall silently through to the HOOK'S OWN process directory, which
  // then rendered beneath a heading reading "WHERE THIS SESSION IS". The path was measured
  // and true; the claim was not, because the only authority on the session's location had
  // said nothing and the module substituted its own with no tell. A true value can still
  // carry an unearned claim — that is the whole lesson of this sequence.
  //
  // A falsy-but-PRESENT value (`false`, `0`) is a CLAIM THAT FAILED, not silence, and is
  // preserved as one so the reader sees what the host actually sent. The old `||` erased
  // that distinction too.
  const claimedCwd = parsed.payload?.cwd;
  const cwdClaimedByHost = !(
    claimedCwd === undefined ||
    claimedCwd === null ||
    (typeof claimedCwd === 'string' && claimedCwd.trim() === '')
  );
  const where = cwdClaimedByHost ? normaliseSeparators(claimedCwd) : normaliseSeparators(cwd);

  const sections = [`⟦GOV⟧ SESSION START — ${policy.headline}`];

  // WO-OR-17. THE SECOND SITE OF THE SAME DEFECT, found by sweeping for the SHAPE rather
  // than for more instances of the first one.
  //
  // `main()` read stdin inside `try { ... } catch { raw = ''; }`, so a READ FAILURE became
  // byte-identical to genuinely empty stdin — after which `parseHookInput` reported the
  // MEASURED absence "empty stdin" about a payload it never saw. Identical to `soft()`: a
  // probe failure wearing the costume of a measurement, one layer above the git probes.
  if (stdinError !== null && stdinError !== undefined) {
    sections.push(
      '⟦GOV⟧ HOOK INPUT: NOT READ — stdin could not be read ' +
        `(${(stdinError && stdinError.code) || 'no reason given'}). Everything below was ` +
        'produced from an EMPTY payload, which is NOT a report that the host sent nothing.'
    );
  }

  try {
    const f = facts ?? factsFn(where);
    const rendered = renderLocationSection(f, { cwdClaimedByHost });
    if (rendered) sections.push(rendered);
  } catch (err) {
    sections.push(`⟦GOV⟧ WHERE THIS SESSION IS: could not be established (${err.message}).`);
  }

  try {
    const sweep = sweepFn();
    if (sweep) sections.push('(fallback, not the source of truth for focus)\n' + sweep);
  } catch (err) {
    sections.push(`⟦GOV⟧ OPEN DELIVERABLES: sweep failed (${err.message}).`);
  }

  return sections.join('\n\n');
}

// ---------------------------------------------------------------------------
// CLI — installed as a SessionStart hook. ALWAYS exits 0 (INV-2).
// ---------------------------------------------------------------------------

async function main() {
  let raw = '';
  // WO-OR-17. The cause is CAPTURED rather than swallowed, so "stdin could not be read" and
  // "the host sent nothing" stop being the same empty string. See `buildBrief`.
  let stdinError = null;
  try {
    const chunks = [];
    for await (const chunk of process.stdin) chunks.push(chunk);
    raw = Buffer.concat(chunks).toString('utf8');
  } catch (err) {
    stdinError = err ?? { code: 'unknown' };
    raw = '';
  }

  let body;
  try {
    body = buildBrief(raw, { stdinError });
  } catch (err) {
    body = `⟦GOV⟧ SESSION START: reorientation failed hard (${err.message}). Orient by hand.`;
  }

  // PRESERVED BEHAVIOUR 2 — the Honcho continuity brief, read EVERY session start.
  // `continuity.mjs` owns the single read path; this is a passthrough and adds no
  // interpretation. It is read LAST in code and placed FIRST in nothing: it is the
  // authoritative focus, so it is appended where a reader will reach it after knowing
  // where they are. It fails open — a slow or unreachable Honcho never blocks a session.
  let continuity;
  try {
    continuity = await readContinuityBrief();
  } catch (err) {
    continuity = `⟦GOV⟧ HONCHO CONTINUITY: brief failed hard (${err.message}).`;
  }

  process.stdout.write(JSON.stringify(toHookOutput(`${body}\n\n${continuity}`)));
  process.exitCode = 0;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main();
}
