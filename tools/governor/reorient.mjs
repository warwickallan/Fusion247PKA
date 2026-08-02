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
import { readdirSync, readFileSync, statSync, realpathSync } from 'node:fs';
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

export function gitFacts(worktreePath, execFile = execFileSync) {
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
  const soft = (fn) => {
    try {
      return fn();
    } catch {
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
  const resolved = soft(() => {
    const real = realpathSync.native(worktreePath);
    const st = statSync(real);
    return {
      path: normaliseSeparators(real),
      kind: st.isDirectory() ? 'directory' : st.isFile() ? 'file' : 'other',
    };
  });

  const gitReadable = soft(() => (run(['rev-parse', '--git-dir']), true)) === true;
  const repoRoot = soft(() => normaliseSeparators(run(['rev-parse', '--show-toplevel'])));
  const headSha = soft(() => run(['rev-parse', 'HEAD']));
  const branch = soft(() => run(['rev-parse', '--abbrev-ref', 'HEAD']));

  // WO-OR-14. `--abbrev-ref HEAD` prints the LITERAL STRING "HEAD" when HEAD is detached,
  // and the block rendered that as though it were a branch name. Matching on that string
  // would be reading a tell rather than taking a measurement, so the state is probed
  // directly: `symbolic-ref -q` returns the branch when HEAD is attached and exits
  // non-zero, silently, when it is not.
  const symbolicBranch = soft(() => run(['symbolic-ref', '-q', '--short', 'HEAD']));
  // TWO measurements, not one flag reused. If HEAD does not resolve at all — an unborn
  // branch, or git unavailable — then nothing can be concluded about attachment, so this
  // is null rather than false. Only a resolvable HEAD with no symbolic ref is detached.
  const detached = headSha === null ? null : symbolicBranch === null;

  // WO-OR-14. Whether this is the primary checkout or a LINKED worktree, measured by
  // `--git-dir` differing from `--git-common-dir` rather than by pattern-matching a path.
  // In an estate running twenty-odd worktrees, "which checkout am I in" is precisely the
  // question this block exists to answer. null when the probe cannot run, and it then
  // renders nothing at all rather than guessing either way.
  const linkedWorktree = soft(() => {
    const [gitDir, commonDir] = run([
      'rev-parse', '--path-format=absolute', '--git-dir', '--git-common-dir',
    ]).split('\n');
    if (!gitDir || !commonDir) return null;
    return normaliseSeparators(gitDir.trim()) !== normaliseSeparators(commonDir.trim());
  });

  const dirty = soft(() => run(['status', '--porcelain']).length > 0);
  const unpushed = soft(() => {
    const parsed = parseInt(run(['rev-list', '--count', '@{u}..HEAD']), 10);
    return Number.isNaN(parsed) ? null : parsed;
  });
  // The CURRENT pushed head, read live from the remote-tracking ref — not whatever was
  // pushed at some point in the past. A resuming session needs to know what is actually
  // durable on the remote right now.
  const upstreamRef = soft(() => run(['rev-parse', '--abbrev-ref', '@{u}']));
  const upstreamSha = soft(() => run(['rev-parse', '@{u}']));

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
      const row = soft(() =>
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
    detached,
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
    if (cwdClaimedByHost) return facts.resolvedPath;
    return (
      `${facts.resolvedPath} (UNCLAIMED — the host supplied no cwd, so this is the hook ` +
      "process's own working directory, not a location this session claimed)"
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
  return `(UNVERIFIED — host reported ${asShown}; no such directory on disk)`;
}

// WO-OR-14. `--show-toplevel` returns the root of the CURRENT WORKING TREE, which in a
// linked worktree is not the repository root at all. The old label "repo root" therefore
// printed a sentence its measurement did not back — and in an estate that is mostly linked
// worktrees it overclaimed on the COMMON case, not an edge one. The label now names what
// was measured, and the kind of checkout is measured too rather than left to the reader to
// infer from a path that looks unfamiliar.
function renderToplevel(facts) {
  if (facts.repoRoot === null || facts.repoRoot === undefined) return '(unknown)';
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
  if (facts.branch === null || facts.branch === undefined) return '(unknown)';
  if (facts.branch === 'HEAD') {
    // Reaching here means git said "HEAD" and the detached probe did NOT confirm it. The
    // honest answer is that this was not established, never the bare string.
    return '(UNVERIFIED — git returned the literal "HEAD", which is what a DETACHED HEAD returns, and the detached probe did not answer)';
  }
  return String(facts.branch);
}

export function renderLocationSection(facts, { cwdClaimedByHost = true } = {}) {
  if (!facts) return null;
  const lines = [
    '⟦GOV⟧ WHERE THIS SESSION IS (executed, not assumed):',
    `  cwd          : ${renderCwd(facts, cwdClaimedByHost)}`,
    `  worktree root: ${renderToplevel(facts)}`,
    `  branch       : ${renderBranch(facts)}`,
    `  HEAD         : ${show(facts.headSha)}`,
    `  working tree : ${facts.dirty === null ? '(unknown)' : facts.dirty ? 'DIRTY — uncommitted changes present' : 'clean'}`,
  ];
  if (facts.upstreamRef) {
    lines.push(`  upstream     : ${facts.upstreamRef} @ ${show(facts.upstreamSha)}`);
    lines.push(
      `  unpushed     : ${facts.unpushed === null ? '(unknown)' : `${facts.unpushed} commit(s) ahead of upstream`}`
    );
  } else if (facts.upstreamState === 'none-configured') {
    // git ANSWERED, the branch ref exists, and its upstream field is empty. The confident
    // sentence is earned here, and only here. WO-OR-11 put the gate one probe too far away
    // — `gitReadable` — which let a detached HEAD reach this line.
    lines.push('  upstream     : (none tracked — nothing here is pushed)');
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
const DEFAULT_SWEEP_IO = { readdirSync, statSync, readFileSync };

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
  for (const name of names) {
    if (!name.toLowerCase().endsWith('.md')) continue; // top-level *.md only
    const full = join(dir, name);
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
    rows.push({ name, title: h1, mtimeMs: st.mtimeMs, awaits });
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
  const top = rows.slice(0, 8);
  const lines = ['⟦GOV⟧ OPEN DELIVERABLES (loose, not BUILD-* — nothing else surfaces these):'];
  for (const r of top) {
    const flag = r.awaits ? '  ⟵ AWAITS YOUR DECISION' : '';
    lines.push(`  • ${r.title} — Deliverables/${r.name}${flag}`);
  }
  const pending = top.filter((r) => r.awaits).length;
  if (pending) lines.push(`  ${pending} deliverable(s) appear to be waiting on Warwick — treat as a pending product-decision handback.`);
  // WO-OR-14. A list that is SHOWN must say when it is incomplete, or a reader takes it as
  // the whole answer — which is exactly how a silently dropped file becomes invisible.
  if (unreadable) {
    lines.push(`  ${unreadable} file(s) could not be read and are NOT represented in this list.`);
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
  try {
    const chunks = [];
    for await (const chunk of process.stdin) chunks.push(chunk);
    raw = Buffer.concat(chunks).toString('utf8');
  } catch {
    raw = '';
  }

  let body;
  try {
    body = buildBrief(raw);
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
