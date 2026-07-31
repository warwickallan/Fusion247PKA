// Exact-head QA binding (BUILD-018 T-14, deliverable 3)
//
// A review verdict is only meaningful against the EXACT commit it reviewed.
//
// THE SAFETY PROPERTY
// -------------------
// A verdict is `current` only at the exact canonical head. Any head movement marks
// it SUPERSEDED and it does NOT carry forward. An unknown, malformed or unresolvable
// head is never "the reviewed head" — it fails closed.
//
// THE BOUNDARY (AD-23 — the direct lesson of the Tower head-binding defect)
// ------------------------------------------------------------------------
// The SHA is canonicalised ONCE, here, in `canonicaliseTuple()`, by real git. Durable
// state is keyed on the resulting full canonical tuple (repo, branch, 40-hex sha).
// Nothing downstream re-derives it, re-checks it at a call site, or compares an
// abbreviated string. The Tower defect was exactly the opposite shape: the SHA was
// re-checked per call site, so one site could disagree with another and a verdict
// could be presented as current for a commit it had never seen.
//
// WHAT THIS MODULE CANNOT ENFORCE, said here rather than only in the map
// ---------------------------------------------------------------------
// `verdictStatus()` is pure — it takes no `execFile` and no `repoPath`, so it CANNOT
// resolve a sha and therefore cannot force its caller to have come through
// `canonicaliseTuple()`. Its 40-hex guard is a BACKSTOP, not the control. The control
// is the convention that no module other than this one ever constructs a head string.
// The backstop exists so that a bypass fails closed (UNKNOWN_HEAD) instead of
// silently producing a wrong answer.
//
// FAIL-CLOSED, and why that is correct here
// -----------------------------------------
// INV-2 ("never trap Warwick") governs BLOCKING PATHS in his live session — the RED
// preflight hook, which must fail open. This is not such a path. Refusing to call a
// verdict current costs a re-review; presenting a stale verdict as current merges
// unreviewed code. Every uncertainty here therefore resolves toward NOT APPROVED, the
// same posture as `assessRotationSafety` in rotate-session.mjs.
//
// WHERE THE LEDGER LIVES
// ----------------------
// `<programme.home>/qa-verdicts.json` — a durable SOURCE artefact (not a projection),
// with the programme, on the programme's branch, git-versioned. Same reasoning as
// AD-14's placement of programme-state.json: a verdict describes commits that exist
// only on that branch, and parking it estate-wide would make it lie the moment the
// branch advanced.

import { readFileSync, writeFileSync, renameSync, mkdirSync, existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join } from 'node:path';
import crypto from 'node:crypto';

import { normalisePath } from './worktree-guard.mjs';

export const QA_SCHEMA_VERSION = 1;

export const VERDICT = {
  APPROVE: 'approve',
  REJECT: 'reject',
  CHANGES: 'changes-requested',
};

export const BINDING = {
  CURRENT: 'current', // recorded at exactly this head
  SUPERSEDED: 'superseded', // recorded, but at a different head
  ABSENT: 'absent', // this reviewer has no verdict at all
  UNKNOWN_HEAD: 'unknown-head', // the head could not be established — fails closed
};

const VERDICT_VALUES = new Set(Object.values(VERDICT));

// Full canonical commit sha, as git itself emits it: 40 lowercase hex.
// Lowercase specifically: `git rev-parse` NEVER emits uppercase, so an uppercase
// 40-hex string can only have been hand-built by a caller that bypassed the
// boundary — which is precisely what this guard is here to catch.
const CANONICAL_SHA_RE = /^[0-9a-f]{40}$/;

export function isCanonicalSha(sha) {
  return typeof sha === 'string' && CANONICAL_SHA_RE.test(sha);
}

// ---------------------------------------------------------------------------
// Ledger location
// ---------------------------------------------------------------------------

export function qaLedgerPath(programmeHome) {
  if (!programmeHome || typeof programmeHome !== 'string') {
    throw new TypeError('programmeHome must be a non-empty string');
  }
  return normalisePath(join(programmeHome, 'qa-verdicts.json'));
}

export function emptyLedger() {
  return { schema_version: QA_SCHEMA_VERSION, generated_at: null, verdicts: [] };
}

// ---------------------------------------------------------------------------
// THE BOUNDARY — the only place a sha is resolved and identity is normalised
// ---------------------------------------------------------------------------
// `execFile` is injected (defaulting to execFileSync) so every path is testable
// against a real scratch repository rather than a mock — the house pattern from
// `gitAdapter` in rotate-session.mjs. It is synchronous because the frozen signature
// returns a plain object, not a promise.

export function canonicaliseTuple({ repo, branch, sha, repoPath, execFile = execFileSync } = {}) {
  const repoNorm = normaliseRepo(repo);
  if (!repoNorm) {
    return { ok: false, tuple: null, error: 'repo is required — a verdict without a repository has no identity' };
  }

  const branchNorm = normaliseBranch(branch);
  if (!branchNorm) {
    return { ok: false, tuple: null, error: 'branch is required — a verdict without a branch has no identity' };
  }

  if (typeof sha !== 'string' || sha.trim() === '') {
    return { ok: false, tuple: null, error: 'sha is required — an absent sha is never "the reviewed head"' };
  }

  if (!repoPath || typeof repoPath !== 'string') {
    return {
      ok: false,
      tuple: null,
      error:
        'repoPath is required — a sha cannot be canonicalised without a repository to resolve it in, ' +
        'and an unresolved sha must never enter the ledger',
    };
  }

  let out;
  try {
    // `--verify <rev>^{commit}` is doing two jobs: it resolves an abbreviation to the
    // full 40-hex sha, and it REFUSES an object that is not a commit (a tree or blob
    // sha would otherwise resolve happily and bind a verdict to a non-commit).
    out = execFile('git', ['-C', repoPath, 'rev-parse', '--verify', `${sha.trim()}^{commit}`], {
      encoding: 'utf8',
    });
  } catch (err) {
    return {
      ok: false,
      tuple: null,
      error: `git could not resolve ${JSON.stringify(sha)} to a commit in ${repoPath}: ${err.message}`,
    };
  }

  const resolved = String(out).trim().toLowerCase();
  if (!isCanonicalSha(resolved)) {
    return {
      ok: false,
      tuple: null,
      error: `git returned ${JSON.stringify(resolved)}, which is not a full 40-hex commit sha — refusing to bind a verdict to it`,
    };
  }

  return { ok: true, tuple: { repo: repoNorm, branch: branchNorm, sha: resolved }, error: null };
}

// Repo identity: separators normalised (a worktree path and a `owner/name` slug both
// pass through cleanly), trailing separator dropped. Case is NOT folded in storage —
// it is folded at COMPARISON time, because Windows paths and GitHub slugs are both
// case-insensitive while the value itself is something a human reads.
function normaliseRepo(repo) {
  if (typeof repo !== 'string') return null;
  const trimmed = repo.trim();
  if (trimmed === '') return null;
  return normalisePath(trimmed);
}

// Branch identity: trimmed, and a `refs/heads/` prefix stripped so the same branch
// named two ways is one branch. Case is deliberately NOT folded here or at
// comparison time — git refs are case-sensitive, and `Fix` and `fix` are two
// different branches.
function normaliseBranch(branch) {
  if (typeof branch !== 'string') return null;
  const trimmed = branch.trim().replace(/^refs\/heads\//, '');
  return trimmed === '' ? null : trimmed;
}

// ---------------------------------------------------------------------------
// Comparison rules
// ---------------------------------------------------------------------------
// These COMPARE; they never rewrite what is stored. Storage normalisation happens at
// the boundary and nowhere else — but comparison folds the two things that are not
// identity-bearing for a repository: separator spelling and case. `C:\x`, `C:/x` and
// `c:/X` are one repository on Windows, and a GitHub `owner/name` slug is
// case-insensitive too.
//
// This was not a judgement call made in the abstract. Comparing raw strings made every
// POSITIVE control in the test file fail while every negative still passed: the module
// could never approve anything, and only the positive controls revealed it. A module
// whose real-world caller (which naturally holds a backslash path from git or
// process.cwd()) always reads ABSENT is a control that never runs — a false BLOCKED
// that looks exactly like a real refusal.
//
// The SHA is deliberately NOT folded in any way: it is compared exactly, and only ever
// in the canonical 40-hex lowercase form that `canonicaliseTuple` produces.

function sameRepo(a, b) {
  const x = normalisePath(typeof a === 'string' ? a.trim() : a);
  const y = normalisePath(typeof b === 'string' ? b.trim() : b);
  if (!x || !y) return false;
  return x.toLowerCase() === y.toLowerCase();
}

function sameBranch(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string') return false;
  return a.trim() === b.trim();
}

function reviewerKey(name) {
  return typeof name === 'string' ? name.trim().toLowerCase() : '';
}

// ---------------------------------------------------------------------------
// Ledger read / write
// ---------------------------------------------------------------------------

export function readLedger(filePath) {
  if (!filePath || typeof filePath !== 'string') {
    return { ok: false, ledger: null, error: 'filePath must be a non-empty string' };
  }

  // A missing ledger is a legitimate empty ledger: nothing has been reviewed yet.
  // A CORRUPT ledger is not — returning an empty ledger for unreadable JSON would
  // report "no verdicts" over ground that was never examined, which is the exact
  // defect class this build exists to prevent (INV-5).
  if (!existsSync(filePath)) {
    return { ok: true, ledger: emptyLedger(), error: null };
  }

  let data;
  try {
    data = JSON.parse(readFileSync(filePath, 'utf8'));
  } catch (err) {
    return { ok: false, ledger: null, error: `qa ledger at ${filePath} is unreadable: ${err.message}` };
  }

  if (data?.schema_version !== QA_SCHEMA_VERSION) {
    return {
      ok: false,
      ledger: null,
      error: `qa ledger at ${filePath} declares schema_version ${JSON.stringify(data?.schema_version)}, expected ${QA_SCHEMA_VERSION}`,
    };
  }

  if (!Array.isArray(data.verdicts)) {
    return { ok: false, ledger: null, error: `qa ledger at ${filePath} has no verdicts array` };
  }

  return { ok: true, ledger: data, error: null };
}

export function validateLedger(ledger) {
  const errors = [];
  if (!ledger || typeof ledger !== 'object' || Array.isArray(ledger)) {
    return { ok: false, errors: ['ledger must be an object'] };
  }
  if (ledger.schema_version !== QA_SCHEMA_VERSION) {
    errors.push(`schema_version must be ${QA_SCHEMA_VERSION}, got ${JSON.stringify(ledger.schema_version)}`);
  }
  if (!Array.isArray(ledger.verdicts)) {
    errors.push('verdicts must be an array');
    return { ok: false, errors };
  }
  ledger.verdicts.forEach((v, i) => {
    const err = validateEntry(v);
    if (err) errors.push(`verdicts[${i}]: ${err}`);
  });
  return { ok: errors.length === 0, errors };
}

export function writeLedger(ledger, filePath) {
  if (!filePath || typeof filePath !== 'string') {
    return { ok: false, error: 'filePath must be a non-empty string' };
  }

  // Fails closed on write, for the same reason `writeProgrammeState` does: a corrupt
  // durable artefact is silently wrong for every future session.
  const validation = validateLedger(ledger);
  if (!validation.ok) {
    return { ok: false, error: `refusing to write an invalid qa ledger: ${validation.errors.join('; ')}` };
  }

  try {
    mkdirSync(dirOf(filePath), { recursive: true });
    // Atomic: temp file with a per-writer-unique name + rename. A write killed
    // mid-flight leaves the previous good file untouched; two concurrent writers
    // never interleave. Same recipe as health-store.mjs and writeProgrammeState.
    const tmpPath = `${filePath}.tmp-${process.pid}-${crypto.randomBytes(4).toString('hex')}`;
    writeFileSync(tmpPath, JSON.stringify(ledger, null, 2) + '\n');
    renameSync(tmpPath, filePath);
  } catch (err) {
    return { ok: false, error: `could not write qa ledger to ${filePath}: ${err.message}` };
  }

  return { ok: true, error: null };
}

function dirOf(filePath) {
  const norm = normalisePath(filePath) || filePath;
  const i = norm.lastIndexOf('/');
  return i === -1 ? '.' : norm.slice(0, i);
}

// ---------------------------------------------------------------------------
// Recording — append, idempotent, and refuses anything not canonicalised
// ---------------------------------------------------------------------------

function validateEntry(entry) {
  if (!entry || typeof entry !== 'object' || Array.isArray(entry)) return 'entry must be an object';

  const t = entry.tuple;
  if (!t || typeof t !== 'object' || Array.isArray(t)) {
    return 'tuple is required — a verdict with no identity cannot be bound to a head';
  }
  if (typeof t.repo !== 'string' || t.repo.trim() === '') return 'tuple.repo must be a non-empty string';
  if (typeof t.branch !== 'string' || t.branch.trim() === '') return 'tuple.branch must be a non-empty string';
  if (!isCanonicalSha(t.sha)) {
    // This is the fail-closed edge that keeps the boundary meaningful: an entry whose
    // sha did not come out of `canonicaliseTuple` cannot enter the durable ledger.
    return `tuple.sha must be a full 40-hex lowercase commit sha from canonicaliseTuple(), got ${JSON.stringify(t.sha)}`;
  }
  if (typeof entry.reviewer !== 'string' || entry.reviewer.trim() === '') {
    return 'reviewer must be a non-empty string';
  }
  if (!VERDICT_VALUES.has(entry.verdict)) {
    return `verdict must be one of ${[...VERDICT_VALUES].join(', ')}, got ${JSON.stringify(entry.verdict)}`;
  }
  if (typeof entry.at !== 'string' || entry.at.trim() === '') {
    return 'at must be a non-empty timestamp string — an undated verdict cannot be ordered against another';
  }
  if (entry.evidence !== undefined && !Array.isArray(entry.evidence)) return 'evidence must be an array when present';
  if (entry.summary !== undefined && typeof entry.summary !== 'string') return 'summary must be a string when present';
  return null;
}

export function recordVerdict(ledger, entry) {
  const base = ledger === null || ledger === undefined ? emptyLedger() : ledger;
  const ledgerCheck = validateLedger(base);
  if (!ledgerCheck.ok) {
    return { ok: false, ledger, error: `refusing to record into an invalid ledger: ${ledgerCheck.errors.join('; ')}` };
  }

  const entryError = validateEntry(entry);
  if (entryError) {
    return { ok: false, ledger: base, error: `refusing to record this verdict: ${entryError}` };
  }

  const row = {
    tuple: { repo: entry.tuple.repo, branch: entry.tuple.branch, sha: entry.tuple.sha },
    reviewer: entry.reviewer.trim(),
    verdict: entry.verdict,
    summary: typeof entry.summary === 'string' ? entry.summary : '',
    evidence: Array.isArray(entry.evidence) ? [...entry.evidence] : [],
    at: entry.at,
  };

  // Idempotent on the FULL identity (reviewer + repo + branch + sha): re-recording the
  // same review replaces it rather than stacking a duplicate. A verdict at a different
  // sha is a DIFFERENT record and is kept — that history is what makes supersession
  // legible instead of just missing.
  const verdicts = base.verdicts.filter(
    (v) =>
      !(
        reviewerKey(v.reviewer) === reviewerKey(row.reviewer) &&
        sameRepo(v.tuple?.repo, row.tuple.repo) &&
        sameBranch(v.tuple?.branch, row.tuple.branch) &&
        v.tuple?.sha === row.tuple.sha
      )
  );
  verdicts.push(row);

  return { ok: true, ledger: { ...base, verdicts }, error: null };
}

// ---------------------------------------------------------------------------
// THE QUERY — pure
// ---------------------------------------------------------------------------

export function verdictStatus(ledger, { repo, branch, headSha, requiredReviewers = [] } = {}) {
  const rows = Array.isArray(ledger?.verdicts) ? ledger.verdicts : [];

  // The backstop, not the control (see the header). `verdictStatus` cannot resolve a
  // sha, so it cannot verify that the caller came through `canonicaliseTuple`. What it
  // CAN do is refuse anything that is not already canonical — in particular an
  // abbreviation, which is NEVER prefix-matched. Prefix matching is the Tower
  // head-binding defect wearing a different hat.
  const headKnown = isCanonicalSha(headSha);
  const head = headKnown ? headSha : null;

  const required = (Array.isArray(requiredReviewers) ? requiredReviewers : [])
    .filter((r) => typeof r === 'string' && r.trim() !== '')
    .map((r) => r.trim());
  const requiredKeys = new Set(required.map(reviewerKey));

  // Group applicable rows by reviewer. Every row is examined — `checked` counts the
  // ground actually covered, so an empty scan can never read as a clean bill (INV-5).
  let checked = 0;
  const byReviewer = new Map();
  const order = [];
  for (const v of rows) {
    checked += 1;
    if (!sameRepo(v?.tuple?.repo, repo) || !sameBranch(v?.tuple?.branch, branch)) continue;
    const key = reviewerKey(v?.reviewer);
    if (key === '') continue;
    if (!byReviewer.has(key)) {
      byReviewer.set(key, []);
      order.push({ key, name: String(v.reviewer).trim() });
    }
    byReviewer.get(key).push(v);
  }

  // Report every REQUIRED reviewer (even with no verdict at all), then any other
  // reviewer who has one — so a required-but-absent reviewer is visible rather than
  // silently missing from the list.
  const reported = [];
  const seen = new Set();
  for (const name of required) {
    reported.push({ key: reviewerKey(name), name });
    seen.add(reviewerKey(name));
  }
  for (const { key, name } of order) {
    if (!seen.has(key)) {
      reported.push({ key, name });
      seen.add(key);
    }
  }

  const reviewers = reported.map(({ key, name }) => {
    const candidates = byReviewer.get(key) || [];

    if (!headKnown) {
      // Uniform, and deliberately shows no verdict value: printing "approve" beside an
      // unestablished head is how a stale verdict gets read as current.
      return {
        reviewer: name,
        binding: BINDING.UNKNOWN_HEAD,
        verdict: null,
        sha: null,
        at: null,
        detail:
          'the head could not be established, so no verdict can be bound to it — ' +
          'an unknown head is never "the reviewed head"',
      };
    }

    if (candidates.length === 0) {
      return {
        reviewer: name,
        binding: BINDING.ABSENT,
        verdict: null,
        sha: null,
        at: null,
        detail: `no verdict recorded by ${name} for ${repo} @ ${branch}`,
      };
    }

    // Exact head wins outright — the whole point of the module. Only if no verdict
    // exists AT the head do we fall back to the most recent one, and that is
    // SUPERSEDED by definition.
    const exact = candidates.filter((v) => v.tuple?.sha === head);
    if (exact.length > 0) {
      const chosen = mostRecent(exact);
      return {
        reviewer: name,
        binding: BINDING.CURRENT,
        verdict: chosen.verdict,
        sha: chosen.tuple.sha,
        at: chosen.at,
        detail: `recorded at exactly this head (${short(head)})`,
      };
    }

    const chosen = mostRecent(candidates);
    return {
      reviewer: name,
      binding: BINDING.SUPERSEDED,
      verdict: chosen.verdict,
      sha: chosen.tuple.sha,
      at: chosen.at,
      detail:
        `recorded at ${short(chosen.tuple.sha)}, but the head is now ${short(head)} — ` +
        're-review is required at the integrated head; this verdict does not carry forward',
    };
  });

  const byName = new Map(reviewers.map((r) => [reviewerKey(r.reviewer), r]));

  let reason = null;
  let allCurrentApproved = false;

  if (!headKnown) {
    reason = 'the head could not be established — an unknown head is never "the reviewed head"';
  } else if (requiredKeys.size === 0) {
    // DELIBERATE, and the opposite of vacuous truth. "Every member of the empty set
    // approved" would let a programme with NO reviewers configured pass the
    // independent-review gate — a control reporting success over ground it never
    // examined. Required-but-unavailable is BLOCKED, never waived; required-but-
    // -unconfigured is the same thing one step earlier.
    reason = 'no required reviewers are configured — independent review is not established, which is not the same as approved';
  } else {
    const failures = [];
    for (const key of requiredKeys) {
      const row = byName.get(key);
      if (!row) {
        failures.push(`${key} (not evaluated)`);
      } else if (row.binding !== BINDING.CURRENT) {
        failures.push(`${row.reviewer} (${row.binding})`);
      } else if (row.verdict !== VERDICT.APPROVE) {
        failures.push(`${row.reviewer} (${row.verdict} at this head)`);
      }
    }
    if (failures.length === 0) {
      allCurrentApproved = true;
    } else {
      reason = `required reviewer(s) not currently approving: ${failures.join(', ')}`;
    }
  }

  return {
    headKnown,
    head,
    reviewers,
    allCurrentApproved,
    superseded: reviewers.filter((r) => r.binding === BINDING.SUPERSEDED),
    checked,
    reason,
  };
}

// Most recent by timestamp; ties broken by last-recorded position, so the choice is
// deterministic. It only affects WHICH superseded sha is displayed — a superseded
// verdict is superseded whichever row is shown.
function mostRecent(rows) {
  let best = rows[0];
  for (const r of rows.slice(1)) {
    if (String(r.at) >= String(best.at)) best = r;
  }
  return best;
}

function short(sha) {
  return typeof sha === 'string' ? sha.slice(0, 7) : String(sha);
}

// ---------------------------------------------------------------------------
// Render
// ---------------------------------------------------------------------------

export function renderVerdictSummary(status) {
  const lines = [];
  lines.push('QA BINDING — review verdicts bound to the exact reviewed commit');
  lines.push(`  head: ${status.headKnown ? status.head : 'UNKNOWN — fails closed'}`);
  lines.push('');

  if (status.reviewers.length === 0) {
    lines.push('  (no reviewers required and none recorded)');
  }
  for (const r of status.reviewers) {
    const at = r.sha ? ` @ ${short(r.sha)}` : '';
    const verdict = r.verdict ? ` ${r.verdict}` : '';
    lines.push(`  ${pad(r.reviewer, 14)} ${pad(r.binding.toUpperCase(), 12)}${verdict}${at}`);
    lines.push(`  ${' '.repeat(14)} ${r.detail}`);
  }

  lines.push('');
  lines.push(
    status.allCurrentApproved
      ? 'VERDICT: APPROVED AT THIS HEAD — every required reviewer holds a current approve.'
      : `VERDICT: NOT APPROVED — ${status.reason || 'requirements not met at this head'}`
  );
  lines.push(`(${status.checked} verdict(s) examined.)`);
  return lines.join('\n');
}

function pad(s, n) {
  const str = String(s);
  return str.length >= n ? str : str + ' '.repeat(n - str.length);
}
