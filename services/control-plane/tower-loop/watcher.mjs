// BUILD-014 Tower supervisor loop — the PERSISTENT WATCHER.
//
// This is the smallest thing that automatically supervises Larry by wrapping the ALREADY-
// PROVEN durable path (loadActivePrompt → reconstructTurn → REAL Codex → persist review →
// apply verdict → auto-Telegram). It adds nothing that the acceptance proof does not require.
//
// One process, one loop, forever until SIGINT:
//   poll PR comments (WO-TW-02, on its own slower interval) → reclaim stale leases → claim ONE
//   pending turn (exactly-once, restart-safe) → process it (reuse the proven path) → mark final
//   → heartbeat → sleep(poll) → repeat.
//
// WO-TW-02 — THE AUTOMATIC TRIGGER, which is one loop step and deliberately nothing more.
// The subsystem's own README said it plainly: "Something must still invoke the poller."
// `pollPrComments.mjs` was a real, proven GitHub→ingest hop that only ever ran because a human
// typed it. This loop is now that something. No scheduler, no second process, no new store: a
// second interval on the loop that was already running forever.
//
//   Turns still ARRIVE via ingestTurn() (loop.mjs) as state='pending' — but they no longer arrive
//   ONLY by hand. A PR comment carrying an explicit `@tower checkpoint:` marker now opens its own
//   turn inside the poll step (see pollPrComments.ensureCheckpointTurn), idempotently, keyed in
//   the database. A comment WITHOUT that marker cannot create anything.
//
// The watcher is still the only thing that PROCESSES turns. Exactly-once is guaranteed by a durable lease taken inside a single
// BEGIN IMMEDIATE write transaction, and by refusing to re-run Codex when a turn already has a
// supervisor_review.
//
// WO-TW-01 — the store is SQLite (better-sqlite3, WAL) at TOWER_SQLITE_PATH, not Postgres. The
// exactly-once claim used to lean on `FOR UPDATE SKIP LOCKED`, which SQLite does not have. It now
// leans on SQLite's single-writer guarantee instead: BEGIN IMMEDIATE takes the write lock before
// the candidate row is even read, and the UPDATE re-asserts `state='pending'` in its WHERE clause,
// so two watchers racing for the same turn cannot both win. The guarantee is the same one and it
// still holds ACROSS PROCESSES, which is what T7 exercises.
//
//   TOWER_SQLITE_PATH=/path/to/tower.db node watcher.mjs

import os from 'node:os';
import fs from 'node:fs';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createHash } from 'node:crypto';
import { openDb, isBusyError } from './db.mjs';
import { applySchema, applyWatcherSchema, applyHoldSchema, applyCommentSchema, applyPostSchema } from './apply.mjs';
import {
  loadActivePrompt,
  reconstructTurn,
  VERDICT_TO_STATE,
} from './loop.mjs';
// WO-OR-22: finding carry-forward + the disposition gate now live in findings.mjs so the gate
// is the code the REAL review round runs, not a parallel module nothing calls.
import { loadOpenFindings, checkFindingDispositions, buildStagedInput } from './findings.mjs';
import { runSupervisor, runMergeReview } from './supervisorCodex.mjs';
import { CODEX_CONTRACT_PATH, loadCodexContract, assertDeliveredContract } from '../review/codexAdapter.mjs';
import { gatherGitEvidence } from './gitEvidence.mjs';
// WO-2026-08-07-4C-03 — ONE implementation of the §3b estate-convergence inventory, two callers.
// Copying the gatherer into this file would have produced two enumerations that drift apart, and
// the whole defect being closed here is one merge-class route carrying evidence the other does
// not. (Its natural home is gitEvidence.mjs, which is the estate's read-only git-shelling module;
// it lives in mergeCheck.mjs because that was the shared surface this Work Order authorised.
// Reported, not repaired — see the return.)
import { safeGatherConvergenceEvidence } from './mergeCheck.mjs';
import { detectMergeClass } from './mergeClass.mjs';
import {
  notify, composeMessage, composeLarryMessage,
  // W3/W4 (WO-2026-08-05-09, WP-2E) — the QA-exchange composers.
  composeFindingsMessage, composeDispositionMessage,
  // WO-2026-08-07-33 — the QA-STARTED composer: the one card that fires BEFORE Codex returns.
  composeQaStartedMessage,
} from './notify.mjs';
// WO-TW-02 — the automatic trigger. The poller was already real and already proven; the only
// thing missing was something that ran it without a human. That something is the loop below.
// WO-2026-08-03-05 — `fetchOpenPrs` is the paginated, fail-loud open-PR discovery call, imported
// from pollPrComments.mjs rather than re-derived here: one seam, one implementation.
import { pollPrComments, fetchOpenPrs, ghCliReader } from './pollPrComments.mjs';
// WO-TW-02 — the other half of Warwick's condition: the verdict goes back ONTO the PR. A
// SEPARATE module with a SEPARATE seam; the poller stays structurally read-only.
import { queueVerdictForTurn, postPendingVerdicts, ghCliWriter } from './postVerdict.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const WATCHER_ID = process.env.WATCHER_ID || `${os.hostname()}#${process.pid}`;
const POLL_MS = Number(process.env.WATCHER_POLL_MS || 1500);
const LEASE_SECONDS = Number(process.env.WATCHER_LEASE_SECONDS || 30);

// ── WO-TW-02: the PR-comment poll step ───────────────────────────────────────
// Deliberately NOT a scheduler. A second interval on the existing loop, three constants, and a
// consecutive-failure count. If that reads as underwhelming, good: the gap was "something must
// still invoke the poller", and anything larger than this is solving a problem nobody has.
const PR_POLL_ENABLED = process.env.TOWER_PR_POLL !== 'off';
// The turn loop runs every POLL_MS (1.5s default). GitHub must not be asked that often, so the
// poll has its own, much slower interval. 60s is the smallest value that is obviously polite.
const PR_POLL_MS = Number(process.env.TOWER_PR_POLL_MS || 60000);
// A LITERAL, not config: how many CONSECUTIVE all-failed poll rounds before the alarm fires. Held
// here rather than in env so a misconfigured deployment cannot quietly raise it to infinity —
// which is how a loud failure becomes a silent one.
const PR_POLL_FAIL_ESCALATE_AFTER = 3;
// Also a literal. Bounds how many PRs one round can ask GitHub about, so an old store full of
// stale turns cannot turn a poll into a rate-limit incident.
const PR_POLL_MAX_TARGETS = 5;
// WO-2026-08-05-TW3 (Gap 1) — a LITERAL, not config, same discipline as PR_POLL_FAIL_ESCALATE_AFTER:
// how many of `limit`'s slots ROTATE through the overflow rather than being fixed by rank. One slot
// is enough to guarantee bounded rotation (see pollTargets below) without meaningfully weakening the
// fixed ranking's protection for in-flight/newest PRs.
const PR_POLL_ROTATE_SLOTS = 1;
// The verdict write-back. Same shape and same literal threshold as the poll: a persistent
// inability to WRITE to the PR is exactly as serious as a persistent inability to read it,
// because in both cases the loop looks healthy while the human on the PR sees nothing.
const PR_WRITEBACK_ENABLED = process.env.TOWER_PR_WRITEBACK !== 'off';
const PR_POST_FAIL_ESCALATE_AFTER = 3;

// Repo root (…/services/control-plane/tower-loop → up 3) + the APPROVED Tower QA skill used
// on merge-class turns. Both overridable via env for tests / relocated checkouts.
const REPO_ROOT = process.env.TOWER_EVIDENCE_REPO_DIR || path.resolve(__dirname, '../../..');
// WP-2G — resolved from codexAdapter.mjs's single exported constant, never re-derived here.
export const QA_SKILL_PATH = process.env.TOWER_QA_SKILL_PATH || CODEX_CONTRACT_PATH;

// Injectable dependencies (FIX 3 — deterministic CI doubles via env module paths). The
// watcher resolves reviewer + git-evidence functions once at boot; a fake reviewer / fake
// git-evidence module (canned, no network) is loaded when the env var points at it. The
// Telegram transport double is env-controlled INSIDE notify (TOWER_NOTIFY_TRANSPORT=none).
const REAL_DEPS = { runSupervisor, runMergeReview, gatherGitEvidence, notify, gatherConvergence: safeGatherConvergenceEvidence };

async function resolveDeps() {
  let reviewerMod = {};
  let gitMod = {};
  if (process.env.TOWER_REVIEWER_MODULE) {
    reviewerMod = await import(pathToFileURL(path.resolve(process.env.TOWER_REVIEWER_MODULE)).href);
    log('reviewer_double_loaded', { module: process.env.TOWER_REVIEWER_MODULE });
  }
  if (process.env.TOWER_GIT_EVIDENCE_MODULE) {
    gitMod = await import(pathToFileURL(path.resolve(process.env.TOWER_GIT_EVIDENCE_MODULE)).href);
    log('git_evidence_double_loaded', { module: process.env.TOWER_GIT_EVIDENCE_MODULE });
  }
  // WO-TW-02: the `gh` seam, injected the same way as the other two so the trigger is provable
  // with no network and no gh binary. Drop the var and it is the real `gh api` reader.
  let ghMod = {};
  if (process.env.TOWER_GH_MODULE) {
    ghMod = await import(pathToFileURL(path.resolve(process.env.TOWER_GH_MODULE)).href);
    log('gh_double_loaded', { module: process.env.TOWER_GH_MODULE });
  }
  return {
    runSupervisor: reviewerMod.runSupervisor ?? runSupervisor,
    runMergeReview: reviewerMod.runMergeReview ?? runMergeReview,
    gatherGitEvidence: gitMod.gatherGitEvidence ?? gatherGitEvidence,
    gh: ghMod.ghCliReader ?? ghCliReader,
    // Same env var, DIFFERENT export. The reader and the writer are two seams and the double has
    // to supply them separately, exactly as the code does — a double that merged them would let
    // the suite pass over a design the real modules do not have.
    ghWriter: ghMod.ghCliWriter ?? ghCliWriter,
    notify,
  };
}

/**
 * WO-TW-02 — send any verdicts that are claimed but not yet on the PR.
 *
 * Returns counts; never throws. Escalation of a persistent failure is the caller's, so that the
 * decision to be loud lives in one place next to the poll's identical decision.
 */
export async function postRound(pool, deps) {
  try {
    return await postPendingVerdicts(pool, { writer: deps.ghWriter, reader: deps.gh });
  } catch (e) {
    const msg = String(e?.message ?? e);
    log('pr_post_sweep_failed', { error: msg });
    return { pending: 1, posted: 0, failed: 1, skipped: 0, errors: [{ postKey: '(sweep)', repo: '-', pr: 0, error: msg }] };
  }
}

// ── WO-2026-08-03-05: poll targets, discovered from GITHUB ───────────────────
const REPO_SLUG_RE = /^[A-Za-z0-9._-]+\/[A-Za-z0-9._-]+$/;

/**
 * WHICH REPOSITORY this checkout belongs to, re-derived from the filesystem on every call.
 *
 * THE DURABILITY RULE THIS EXISTS TO SATISFY. Anything that lives only in `process.env` at spawn
 * is lost the moment the process is replaced, and nothing refreshes it. `TOWER_PR_SEED` was
 * exactly that shape: a launch-time binding, held in no store and no repository, which is why five
 * rounds of validation passed on a mechanism that kept dying — every test supplied, at test time,
 * the same binding production supplies once at launch and then never refreshes.
 *
 * The checkout's own `origin` remote is not that shape. It is on disk, it survives process death,
 * and it is re-read every poll round rather than snapshotted at boot. A restarted watcher
 * therefore re-derives it rather than inheriting it.
 *
 * Returns `null` — never throws — when there is no usable remote. Not knowing which repository we
 * are in is a legitimate state (a detached copy, a tarball — see TOWER_PR_REPOS below for exactly
 * this case in production); the LOUD handling of "no repositories at all" belongs one level up,
 * where it can be seen against the other sources.
 *
 * @param {object}   [opts]
 * @param {string}   [opts.cwd]   directory to interrogate; defaults to this checkout's root.
 * @param {Function} [opts.exec]  injectable child-process runner (tests). Never an env var — a
 *                                test double selected by the environment would be one more
 *                                launch-time binding of the kind this function removes.
 */
export function detectCheckoutRepo({ cwd = REPO_ROOT, exec = execFile } = {}) {
  return new Promise((resolve) => {
    exec('git', ['remote', 'get-url', 'origin'], { cwd, windowsHide: true, timeout: 10000 }, (err, stdout) => {
      if (err) return resolve(null);
      const url = String(stdout ?? '').trim();
      // Both shapes GitHub hands out, with or without the `.git` suffix:
      //   https://github.com/owner/name.git   git@github.com:owner/name.git
      const m = /[/:]([A-Za-z0-9._-]+\/[A-Za-z0-9._-]+?)(?:\.git)?$/.exec(url);
      if (!m || !REPO_SLUG_RE.test(m[1])) return resolve(null);
      resolve(m[1]);
    });
  });
}

/** Repositories named by TOWER_PR_SEED. RETAINED, but no longer load-bearing: a seed entry now
 *  contributes only its REPOSITORY, and its PR number has no power at all — that PR is polled if
 *  and only if GitHub says it is open, exactly like every other. A stale seed can therefore no
 *  longer pin the watcher to a merged PR, which is what it had been doing. */
export function seedRepos(env = process.env) {
  return String(env.TOWER_PR_SEED ?? '')
    .split(',').map((s) => s.trim()).filter(Boolean)
    .map((s) => {
      const m = /^([A-Za-z0-9._-]+\/[A-Za-z0-9._-]+)(?:#\d+)?$/.exec(s);
      return m ? m[1] : null;
    })
    .filter(Boolean);
}

/**
 * Repositories named by TOWER_PR_REPOS — the STABLE MACHINE-RUNTIME repository source, retained
 * as a FOURTH source alongside `detectCheckoutRepo` / the store / `seedRepos` (Warwick's own
 * instruction, WO 2026-08-05: "retain TOWER_PR_REPOS as the stable machine-runtime repository
 * source, because the installed runtime is not a Git checkout").
 *
 * WHY THIS IS NOT REDUNDANT WITH `detectCheckoutRepo`, and it is worth spelling out because it
 * looks like a duplicate source at a glance. `detectCheckoutRepo` reads `git remote get-url
 * origin` from `cwd` — it needs an actual `.git` directory to interrogate. Tower's real machine
 * deployment (`~/.mypka/tower-runtime/`) is a PLAIN FILE COPY, not a git checkout: there is no
 * `origin` remote to read, so `detectCheckoutRepo` resolves `null` there every time, by design and
 * correctly (it never throws or guesses). Without this function, that deployment would have NO
 * durable repository source at all beyond whatever is already in the store or a seed — exactly the
 * bootstrap gap this whole change exists to close, reopened for the one environment where it
 * actually runs live. DO NOT "clean this up" as a duplicate of `detectCheckoutRepo` or of
 * `seedRepos` — it is neither: it is the only source that survives a non-git deployment.
 *
 * Comma-separated `owner/name`, no PR number (a repo, not a PR — the shape TOWER_PR_SEED uses for
 * its optional `#pr` suffix does not apply here, because this variable was never about one PR).
 * Read from `process.env` fresh on every call — no caching, same discipline as `seedRepos`.
 */
export function explicitRepos(env = process.env) {
  return String(env.TOWER_PR_REPOS ?? '')
    .split(',').map((s) => s.trim()).filter(Boolean)
    .filter((s) => REPO_SLUG_RE.test(s));
}

/**
 * Which PRs this watcher should ask GitHub about, right now.
 *
 * THE CHANGE, AND WHY THE OLD RULE WAS SELF-EXTINGUISHING. Targets used to be the distinct
 * `(repo, pr_number)` of turns `where state <> 'complete'`. That made the poll list a function of
 * WORK-IN-PROGRESS STATE rather than of the repository: a round that completed removed its own PR
 * from the list, so finishing a review successfully was the same event as going blind to that PR.
 * A still-open PR could be made invisible by nothing more than Tower having done its job on it,
 * and a PR nobody had ever opened a turn against was invisible from the start.
 *
 *   openness is a fact about GITHUB          → asked of GitHub, every round
 *   `state <> 'complete'` is a fact about US → kept, but only for RANKING under the cap
 *
 * So the cut is: **every open PR on every repository we know about is a target.** A merged or
 * closed PR is not, whatever the store or the environment says about it.
 *
 * WHERE THE REPOSITORIES COME FROM — FOUR sources, and every one of them is durable:
 *   1. this checkout's `origin` remote        — on disk, re-read every round
 *   2. every repo named by any turn in the store — in the database, survives restart
 *   3. `TOWER_PR_SEED`                        — retained as an operator escape hatch for a repo
 *                                               that is neither of the above
 *   4. `TOWER_PR_REPOS`                       — the stable machine-runtime source, for a
 *                                               deployment (a plain file copy, not a git checkout)
 *                                               where source 1 structurally cannot resolve anything
 * Source 2 deliberately reads ALL turns and NOT `state <> 'complete'`: filtering there would
 * reintroduce the self-extinguishing bug one level up, since a repo whose every turn had completed
 * would stop being asked about.
 *
 * FAILS LOUD. A discovery failure THROWS, which `runWatcher` already converts into a failed round
 * and, after three consecutive rounds, into a `tower_failure` alarm. It must never return an empty
 * list on error: an empty list is what a healthy idle watcher returns, and silence that looks like
 * health is the failure mode this whole change exists to remove.
 *
 * The cap (`limit`, default `PR_POLL_MAX_TARGETS`) bounds RANKING, never DISCOVERY: every open PR
 * across every known repository — sources 1-4 above, with no separate cap per source — is fetched
 * and ranked as one combined list (in-flight rounds first, then newest-first), and only then is the
 * list truncated to `limit`. This is what stops a fourth source from silently starving a PR that a
 * different source would have kept visible: there is one ranking and one cap, not four.
 *
 * WO-2026-08-05-TW3 (Gap 1) — TRUNCATION ALONE IS NOT ENOUGH. The ranking above is static:
 * newest-first for anything not already in-flight. With more open PRs than `limit`, whatever
 * ranks below the cutoff was dropped EVERY round, forever — `pr_poll_targets_truncated` logged
 * the drop loudly, but nothing ever un-dropped it. A PR sitting behind `limit` higher-ranked ones
 * was invisible to comment-polling indefinitely, even though discovery itself found it fresh
 * every round. See the rotation logic below the sort for the fix and the bounded-rounds proof.
 */
export async function pollTargets(pool, { gh = ghCliReader, limit = PR_POLL_MAX_TARGETS, detectRepo = detectCheckoutRepo, now = Date.now } = {}) {
  // In-flight rounds, most recently active first. Used ONLY to rank targets under the cap, so a
  // PR with a review round waiting on a disposition comment is never the one dropped.
  const { rows } = await pool.query(
    `select repo, pr_number, max(seq) as seq
       from tower.turn
      where repo is not null and pr_number is not null and state <> 'complete'
      group by repo, pr_number
      order by seq desc`,
  );
  const inFlight = new Map();
  for (const r of rows) inFlight.set(`${String(r.repo)}#${Number(r.pr_number)}`, Number(r.seq));

  // Every repo any turn has ever pointed at — no state filter, deliberately (see above).
  const { rows: repoRows } = await pool.query(
    `select distinct repo from tower.turn where repo is not null`,
  );

  const repos = [];
  const addRepo = (r) => { if (r && REPO_SLUG_RE.test(r) && !repos.includes(r)) repos.push(r); };
  addRepo(await detectRepo());
  for (const r of repoRows) addRepo(String(r.repo));
  for (const r of seedRepos()) addRepo(r);
  for (const r of explicitRepos()) addRepo(r);

  if (repos.length === 0) {
    // Distinct from `pr_poll_no_targets`, and the distinction is the point: "there is nothing open
    // to watch" and "I do not know where to look" are different states and must not share a line.
    log('pr_poll_no_repos');
    return [];
  }

  // ASK GITHUB. Any failure propagates — see the fail-loud note above.
  const open = [];
  for (const repo of repos) {
    const numbers = await fetchOpenPrs(gh, { repo });
    log('pr_poll_discovery', { repo, open: numbers.length, prs: numbers });
    for (const prNumber of numbers) open.push({ repo, prNumber });
  }

  // A PR the store or the seed still points at, which GitHub says is no longer open. Reported
  // rather than silently dropped: this is the exact transition that used to leave the watcher
  // polling a corpse, so seeing it happen is worth a log line.
  const openKeys = new Set(open.map((t) => `${t.repo}#${t.prNumber}`));
  const dropped = [...inFlight.keys()].filter((k) => !openKeys.has(k));
  if (dropped.length) log('pr_poll_targets_dropped', { dropped });

  // Rank: in-flight rounds first (most recent), then the rest of the open PRs, newest first.
  open.sort((a, b) => {
    const sa = inFlight.get(`${a.repo}#${a.prNumber}`);
    const sb = inFlight.get(`${b.repo}#${b.prNumber}`);
    if (sa !== undefined && sb !== undefined) return sb - sa;
    if (sa !== undefined) return -1;
    if (sb !== undefined) return 1;
    return b.prNumber - a.prNumber;
  });

  if (open.length <= limit) return open;

  // ── WO-2026-08-05-TW3 (Gap 1) — ROTATION, so a truncated PR is never PERMANENTLY invisible. ──
  //
  // `open` still holds every open PR here — the sort above only ordered it. Reserve most of
  // `limit` for the fixed ranking (in-flight rounds ALWAYS fully included — a round waiting on a
  // disposition comment must never starve merely because more PRs are open than `limit`), and let
  // the remaining PR_POLL_ROTATE_SLOTS slot(s) rotate deterministically through the OVERFLOW —
  // everything the fixed ranking would otherwise drop every single round.
  //
  // Deterministic, not random, and using ONLY already-available inputs: wall-clock time (via the
  // injectable `now`, real Date.now() in production) and the sorted overflow list itself. NO new
  // store, registry or table — the rotation index is RECOMPUTED from time on every call, never
  // remembered between rounds. One tick per PR_POLL_MS of wall-clock time — the SAME cadence the
  // watcher actually polls at (see runWatcher's `nextPrPollAt` gate) — so consecutive PRODUCTION
  // rounds land in different ticks without needing to remember which overflow PR went last.
  const inFlightCount = open.filter((t) => inFlight.has(`${t.repo}#${t.prNumber}`)).length;
  // Never sacrifice an in-flight round for a rotation slot, and never exceed the cap itself.
  const rankedSlots = Math.min(limit, Math.max(limit - PR_POLL_ROTATE_SLOTS, inFlightCount));
  const head = open.slice(0, rankedSlots);
  const overflow = open.slice(rankedSlots);
  const rotateBudget = limit - head.length;

  const picked = [];
  if (rotateBudget > 0 && overflow.length > 0) {
    const tick = Math.floor(now() / PR_POLL_MS);
    const start = tick % overflow.length;
    for (let i = 0; i < Math.min(rotateBudget, overflow.length); i += 1) {
      picked.push(overflow[(start + i) % overflow.length]);
    }
  }

  const kept = [...head, ...picked];
  const keptKeys = new Set(kept.map((t) => `${t.repo}#${t.prNumber}`));
  const droppedThisRound = open.filter((t) => !keptKeys.has(`${t.repo}#${t.prNumber}`));
  if (droppedThisRound.length) {
    // The cap is real rate-limit protection, but a silent cap is the same defect in a new shape:
    // a PR that is never polled and never mentioned is invisible for exactly the same reason a
    // merged target was. `rotating` names which overflow PR got this round's rotating slot(s), so
    // the rotation itself is visible in the log, not just claimed in a comment.
    log('pr_poll_targets_truncated', {
      considered: open.length, limit, kept: kept.length,
      rotating: picked.map((t) => `${t.repo}#${t.prNumber}`),
      dropped: droppedThisRound.map((t) => `${t.repo}#${t.prNumber}`),
    });
  }
  return kept;
}

/**
 * ONE poll round: ask GitHub about every target, hand every @tower comment to the existing
 * ingest, and let an explicit checkpoint open its own turn.
 *
 * Returns counts rather than throwing. A poll failure must never take the turn loop down with it:
 * GitHub being briefly unreachable is not a reason to stop supervising turns that are already in
 * the store. Escalation of a PERSISTENT failure is the caller's job, and it is not optional —
 * see runWatcher.
 */
export async function pollRound(pool, deps) {
  // WO-2026-08-03-05 — pass the injected `gh` seam through so open-PR DISCOVERY runs on every real
  // poll round. deps.gh is the same seam pollPrComments below is about to use for each target, so
  // this is the one existing gh invocation point, not a second one.
  const targets = await pollTargets(pool, { gh: deps.gh });
  if (targets.length === 0) { log('pr_poll_no_targets'); return { targets: 0, ok: 0, failed: 0, errors: [] }; }

  let ok = 0;
  const errors = [];
  for (const { repo, prNumber } of targets) {
    try {
      const res = await pollPrComments(pool, { repo, prNumber, gh: deps.gh });
      ok += 1;
      log('pr_poll_ok', {
        repo, pr: prNumber, head: res.apiHeadSha, scanned: res.scanned,
        candidates: res.candidates, checkpointsCreated: res.checkpointsCreated,
        outcomes: res.results.map((r) => r.outcome),
      });
      // W4 (WO-2026-08-05-09) — echo every FRESHLY-applied disposition to Telegram. Only
      // outcome==='applied' carries disposedFindingIds; a deduped re-poll of the same comment
      // never reaches this branch, so a re-poll can never re-echo.
      for (const r of res.results) {
        if (r.outcome === 'applied' && Array.isArray(r.disposedFindingIds) && r.disposedFindingIds.length > 0) {
          await sendDispositionNotifications(pool, deps, { turnId: r.turnId, disposedFindingIds: r.disposedFindingIds });
        }
      }
    } catch (e) {
      const msg = String(e?.message ?? e);
      errors.push({ repo, pr: prNumber, error: msg });
      log('pr_poll_failed', { repo, pr: prNumber, error: msg });
    }
  }
  return { targets: targets.length, ok, failed: errors.length, errors };
}

/** Load + VALIDATE Codex's operating contract (governing prompt) and fingerprint the exact bytes
 *  that will be delivered. Fail-closed: missing, empty, frontmatter-less, sentinel-less, NOT
 *  RATIFIED, or a delivered/loaded hash mismatch all BLOCK merge-class review (never
 *  assume-and-pass). Until WP-2G this was a bare readFileSync with no validation of any kind, so
 *  unratified content could have run as law — the real degradation risk, not an absent file. */
function loadQaSkill() {
  const contract = loadCodexContract({ contractPath: QA_SKILL_PATH });
  if (!contract.ok) return { text: null, fingerprint: null, path: QA_SKILL_PATH, ok: false, error: contract.error };
  const provenanceError = assertDeliveredContract(contract.text, contract);
  if (provenanceError) return { text: null, fingerprint: null, path: QA_SKILL_PATH, ok: false, error: provenanceError };
  return { text: contract.text, fingerprint: contract.fingerprint, path: contract.contractPath, ok: true, provenance: contract.provenance };
}

function sha256(text) {
  return createHash('sha256').update(String(text ?? ''), 'utf8').digest('hex');
}

function log(evt, extra = {}) {
  // Structured, credential-free.
  console.log(JSON.stringify({ ts: new Date().toISOString(), watcher: WATCHER_ID, evt, ...extra }));
}

// ── findings ────────────────────────────────────────────────────────────────
export async function openFinding(pool, { buildRef = 'BUILD-014', openedTurnId = null, description }) {
  const { rows } = await pool.query(
    `insert into tower.finding (build_ref, opened_turn_id, description, state)
     values (?, ?, ?, 'open') returning id, build_ref, state`,
    [buildRef, openedTurnId, description],
  );
  return rows[0];
}

// ── W1 (WO-2026-08-05-09, WP-2E) — the wire that turns openFinding() from a dead function into
// the live disposition machinery's front door ──────────────────────────────────────────────────
//
// openFinding() has existed since BUILD-014 and was called only by the acceptance harness and
// tests — never by this live review path. Four real Codex findings (TQA-001, TQA-002, TQA-003,
// TOWER-QA-001) sat inside tower.supervisor_review.merge_review as structured JSON while
// tower.finding held zero rows, because nothing looped merge_review.qa.findings[] and called it.
// This is that loop, and it is the ONLY new mechanism this Work Order adds — everything it calls
// (openFinding, the disposition columns, the ingest grammar, the gate) already existed and was
// already tested.

/** [TQA-001] BLOCKER/ACTIVE/BLOCKS_CURRENT_MERGE — <evidence> — Required correction: <correction>
 *  Codex's own short ref (f.id, e.g. "TQA-001") is embedded as a prefix in the free-text
 *  `description` column so every surface that already renders it (the staged reviewer input,
 *  the PR verdict comment, Telegram) shows BOTH ids — the tower.finding UUID the reply grammar
 *  requires, and the ref Warwick and Codex actually talk about — with NO new column and NO
 *  schema growth (regrowth cap; §14.7 "Named as unestablished" leaves this mapping to W1,
 *  approved by Larry 2026-08-05 as stated). */
export function formatMergeFindingDescription(f) {
  const head = `[${f.id}] ${f.technical_impact ?? '?'}/${f.reachability ?? '?'}/${f.required_disposition ?? '?'}`;
  const evidence = String(f.evidence ?? '').trim();
  const correction = String(f.required_correction ?? '').trim();
  const tail = [evidence, correction ? `Required correction: ${correction}` : null].filter(Boolean).join(' — ');
  return tail ? `${head} — ${tail}` : head;
}

/**
 * Turn a round's NEW Codex findings (merge_review.qa.findings[], per CODEX_RESULT_SCHEMA) into
 * durable tower.finding rows via the existing openFinding(). Called ONCE, from processTurn, at
 * the exact point a review is first persisted — never on an idempotent replay, so a restart or a
 * lost insert race can never double-open a finding.
 *
 * FAIL-CLOSED ON THE ARRAY, per the Work Order. Three distinct "no findings" shapes are told
 * apart rather than collapsed into one guess:
 *   - not merge-class at all              → nothing to open, expected, not reported.
 *   - merge-class but qa.findings absent  → a BLOCKED merge review (evidence unresolved, Codex
 *                                           unreachable) never reaches CODEX_RESULT_SCHEMA at all,
 *                                           so mergeReviewRecord.qa is a hand-built
 *                                           { status:'blocked', ... } object with no `findings`
 *                                           key. That is the CORRECT, expected shape for a
 *                                           blocked round, not a defect to report.
 *   - qa.findings present but NOT an array → genuinely malformed; logged, nothing opened, and the
 *                                           round is NOT failed for it (a findings-loop failure
 *                                           must never take a review round down with it).
 * A malformed INDIVIDUAL entry (no usable `id`) is skipped and logged rather than crashing the
 * whole loop or silently dropping the rest.
 *
 * NEVER THROWS.
 *
 * @returns {{opened: Array<{id:string, codexId:string, technical_impact:?string,
 *            reachability:?string, required_disposition:?string, evidence:?string,
 *            required_correction:?string}>, skipped: number, reason: string|null}}
 */
export async function openFindingsFromMergeReview(pool, { buildRef, turnId, mergeReviewRecord }) {
  if (!mergeReviewRecord || mergeReviewRecord.isMergeClass !== true) {
    return { opened: [], skipped: 0, reason: 'not-merge-class' };
  }
  const raw = mergeReviewRecord.qa?.findings;
  if (raw === undefined) {
    return { opened: [], skipped: 0, reason: mergeReviewRecord.blocked === true ? 'blocked-no-findings' : 'absent' };
  }
  if (!Array.isArray(raw)) {
    log('findings_array_malformed', { turnId, buildRef, type: typeof raw });
    return { opened: [], skipped: 0, reason: 'malformed-array' };
  }
  const opened = [];
  let skipped = 0;
  for (const f of raw) {
    if (!f || typeof f !== 'object' || typeof f.id !== 'string' || !f.id.trim()) {
      log('finding_entry_malformed', { turnId, buildRef, entry: JSON.stringify(f ?? null).slice(0, 200) });
      skipped += 1;
      continue;
    }
    try {
      const description = formatMergeFindingDescription(f);
      const row = await openFinding(pool, { buildRef, openedTurnId: turnId, description });
      opened.push({
        id: row.id, codexId: f.id,
        technical_impact: f.technical_impact ?? null, reachability: f.reachability ?? null,
        required_disposition: f.required_disposition ?? null, evidence: f.evidence ?? null,
        required_correction: f.required_correction ?? null,
      });
    } catch (e) {
      log('open_finding_failed', { turnId, buildRef, codexId: f.id, error: String(e?.message ?? e) });
      skipped += 1;
    }
  }
  return { opened, skipped, reason: null };
}

// ── W4 (WO-2026-08-05-09, WP-2E) — the disposition ECHO's read-back-after-write ────────────────
//
// This is the spine of the design: what Telegram renders must be provably what tower.finding
// holds AFTER a disposing PR comment's UPDATE committed — never the text the comment PARSED in
// memory. readDisposedFindings performs the ONLY read; sendDispositionNotifications performs the
// ONLY compose+send. Keeping the read in its own function (rather than inlining a SELECT beside
// the send) is what makes "renders from the store, not from what was claimed" a property a
// mutation test can pin to a single seam.

/** Re-SELECT tower.finding for exactly the ids a disposing comment just wrote. Order is
 *  preserved to match the caller's disposedFindingIds order; ids with no matching row (should
 *  not happen — ingestComment.mjs only reports an id here when its own UPDATE returned exactly
 *  one row) are silently dropped rather than throwing, so one bad id cannot block the rest. */
export async function readDisposedFindings(pool, findingIds) {
  if (!Array.isArray(findingIds) || findingIds.length === 0) return [];
  const placeholders = findingIds.map(() => '?').join(',');
  const { rows } = await pool.query(
    `select id, description, disposition, disposition_rationale, disposition_source,
            disposition_comment_id, disposition_head_sha, disposition_at
       from tower.finding where id in (${placeholders})`,
    findingIds,
  );
  const byId = new Map(rows.map((row) => [row.id, row]));
  return findingIds.map((id) => byId.get(id)).filter(Boolean);
}

/**
 * Echo every FRESHLY-applied disposition to Telegram, one message per finding, read back from
 * the store via readDisposedFindings — never from the comment's parsed dispositions.
 *
 * turnId is deliberately NOT passed to notify() as the dedup key (see NOTIFY_REASONS'
 * 'finding_disposed' comment in notify.mjs): a null turn_id is treated as distinct by the unique
 * (turn_id, reason) index, so every disposition event gets its own message even when several
 * land against the same round — the "ongoing thread, not a single digest" requirement.
 *
 * NEVER THROWS: a notify failure for one finding must not stop the others or the poll loop.
 */
export async function sendDispositionNotifications(pool, deps, { turnId, disposedFindingIds }) {
  if (!Array.isArray(disposedFindingIds) || disposedFindingIds.length === 0) return [];
  const t = await pool.query(`select build_ref, seq from tower.turn where id = ?`, [turnId]);
  const { build_ref: buildRef, seq: turnSeq } = t.rows[0] ?? {};
  const findings = await readDisposedFindings(pool, disposedFindingIds);
  const doNotify = deps?.notify ?? notify;
  const sent = [];
  for (const finding of findings) {
    const message = composeDispositionMessage({ buildRef, turnSeq, turnId, finding });
    try {
      sent.push(await doNotify(pool, { turnId: null, reason: 'finding_disposed', state: 'disposed', message }));
    } catch (e) {
      log('disposition_notify_failed', { turnId, findingId: finding.id, error: String(e?.message ?? e) });
    }
  }
  return sent;
}

// loadOpenFindings moved to findings.mjs (WO-OR-22) — it is now imported above, alongside the
// disposition gate that consumes it.

// ── lease / claim (exactly-once, restart-safe) ───────────────────────────────
async function reclaimStale(pool) {
  try {
    const { rows } = await pool.query(
      `update tower.turn
          set state = 'pending', lease_owner = null, lease_deadline_at = null, updated_at = now()
        where state = 'claimed' and lease_deadline_at is not null and lease_deadline_at < now()
        returning id`,
    );
    if (rows.length) log('reclaimed_stale', { count: rows.length });
    return rows.length;
  } catch (e) {
    // Another watcher holds the write lock for longer than busy_timeout. Nothing is lost: the
    // stale lease is still stale on the next poll. Crashing the watcher over write contention
    // would be strictly worse than waiting one poll interval.
    if (isBusyError(e)) { log('reclaim_busy'); return 0; }
    throw e;
  }
}

async function claimOne(pool) {
  // Atomic single-row claim. ONE write transaction, taken with BEGIN IMMEDIATE so the write lock
  // is held from before the candidate is read until after the claim is committed — the SQLite
  // equivalent of the `FOR UPDATE SKIP LOCKED` this used to do, and equally exactly-once across
  // processes. The `and state = 'pending'` in the UPDATE is the second half of the guarantee:
  // even if the read were somehow stale, the write refuses a turn someone else already took.
  //
  // ORDERING IS PRESERVED: `order by seq` picks the OLDEST pending turn, exactly as before. `seq`
  // is the autoincrement rowid alias, so it is still strictly insertion-ordered.
  try {
    return await pool.immediate((q) => {
      const candidate = q(
        `select id from tower.turn where state = 'pending' order by seq limit 1`,
      ).rows[0];
      if (!candidate) return null;
      const { rows } = q(
        `update tower.turn
            set state = 'claimed', lease_owner = ?,
                lease_deadline_at = now_plus_seconds(?), updated_at = now()
          where id = ? and state = 'pending'
          returning id, seq, build_ref, goal_complete`,
        [WATCHER_ID, LEASE_SECONDS, candidate.id],
      );
      return rows[0] ?? null;
    });
  } catch (e) {
    // A concurrent watcher held the write lock past busy_timeout. Claim nothing this round and
    // let the next poll try again — the turn stays 'pending' and is not lost.
    if (isBusyError(e)) { log('claim_busy'); return null; }
    throw e;
  }
}

// ── notification triggers (proven delivery policy + FIX 1 merge-class QA gate) ─
// `merge` (optional): { isMergeClass, blocked, verdict, summary } for a merge-class turn.
// A merge-class turn ONLY reaches goal_complete when its Tower-QA review APPROVED against
// real Git evidence; a blocked/unresolved QA fires tower_failure, a non-approve fires
// codex_block_or_redirect — a prose "done" can never silently ship.
async function fireTriggers(pool, { turnId, buildRef, turnSeq, nextState, r, blocked, goalComplete, notifyFn = notify, merge = null, larryResponse = null, findingsOpened = [] }) {
  const base = {
    buildRef, turnSeq, turnId, state: nextState, verdict: r.verdict,
    summary: r.summary, nextAction: r.next_action, warwickNeeded: r.warwick_needed,
    larryResponse,
  };
  const mergeBlocked = merge?.isMergeClass && merge.blocked;
  const mergeNotApprove = merge?.isMergeClass && !merge.blocked && merge.verdict !== 'approve';
  const mergeLine = merge?.isMergeClass
    ? ` | Merge-class QA verdict=${mergeBlocked ? 'BLOCKED (evidence unresolved)' : merge.verdict}${merge.summary ? ` — ${merge.summary}` : ''}`
    : '';

  // ONE durable turn -> ONE notification. Previously each matched trigger fired its own Telegram,
  // so an ask_warwick turn whose merge-class QA also requested changes sent TWO messages. Now we
  // pick the single highest-priority reason and fold the merge-class QA verdict into that one
  // message. Priority: tower_failure > warwick_input_required > codex_block_or_redirect > goal_complete.
  let reason = null;
  let state = nextState;
  let summary = r.summary;
  let warwickNeeded = r.warwick_needed === true;
  if (blocked || mergeBlocked) {
    reason = 'tower_failure'; warwickNeeded = true;
    summary = blocked
      ? `Tower supervisor unavailable — ${r.summary}`
      : `Merge-class QA could NOT verify Git evidence — ${merge.summary ?? 'evidence unresolved'}`;
  } else if (r.verdict === 'ask_warwick' || r.warwick_needed === true) {
    reason = 'warwick_input_required'; warwickNeeded = true; summary = `${r.summary}${mergeLine}`;
  } else if (r.verdict === 'block' || r.verdict === 'correct' || mergeNotApprove) {
    reason = 'codex_block_or_redirect'; warwickNeeded = mergeNotApprove || r.warwick_needed === true;
    summary = `${r.summary}${mergeLine}`;
  } else if (goalComplete === true) {
    await pool.query(`update tower.turn set state = 'complete', updated_at = now() where id = ?`, [turnId]);
    reason = 'goal_complete'; state = 'complete'; summary = `Goal complete — ${r.summary}`;
  }

  const hasNewFindings = Array.isArray(findingsOpened) && findingsOpened.length > 0;
  if (!reason) {
    // W3 (WO-2026-08-05-09) — an otherwise-SILENT round (continue/aligned, merge QA approved or
    // not merge-class) must still surface any findings it opened. Findings must never be
    // silently dropped just because the overall verdict was fine.
    if (!hasNewFindings) return []; // continue / aligned, nothing raised -> SILENT (no Telegram)
    reason = 'findings_raised'; summary = `${r.summary}${mergeLine}`;
  }
  // THREE SEPARATE Telegram messages (one dedup row): Larry's side of the dialogue first, THEN
  // Codex's verdict, THEN (W3) any NEW findings this round raised — an actual back-and-forth on
  // TowerBot, never one combined message. Each is omitted when it has nothing to say, so an
  // ordinary delivery round with no findings is unchanged (exactly the pre-existing two-message
  // shape).
  const messages = [
    composeLarryMessage({ buildRef, turnSeq, turnId, larryResponse }),
    composeMessage({ ...base, state, warwickNeeded, summary }),
    composeFindingsMessage({ buildRef, turnSeq, turnId, findings: findingsOpened }),
  ].filter(Boolean);
  return [await notifyFn(pool, { turnId, reason, state, message: messages })];
}

// ── lease renewer (FIX 4) ─────────────────────────────────────────────────────
// While a turn is being processed (a long Codex run in flight), a background renewer keeps
// extending lease_deadline_at so a HEALTHY long turn is never reclaimed mid-flight by another
// watcher. It renews ONLY while THIS watcher still owns the claim (lease_owner + state), and
// no-ops the moment the turn is finalised or reclaimed. Returns a stop() to call in finally.
function startLeaseRenewer(pool, turnId) {
  const intervalMs = Math.max(1000, Math.floor((LEASE_SECONDS * 1000) / 3));
  let stopped = false;
  const timer = setInterval(async () => {
    if (stopped) return;
    try {
      const res = await pool.query(
        `update tower.turn
            set lease_deadline_at = now_plus_seconds(?), updated_at = now()
          where id = ? and lease_owner = ? and state = 'claimed'`,
        [LEASE_SECONDS, turnId, WATCHER_ID],
      );
      if (res.rowCount > 0) log('lease_renewed', { turnId });
    } catch (e) {
      log('lease_renew_failed', { turnId, error: String(e?.message ?? e) });
    }
  }, intervalMs);
  timer.unref?.();
  return () => { stopped = true; clearInterval(timer); };
}

/** Re-derive the merge-class notification flags from a persisted merge_review jsonb (used on
 *  the idempotent-replay path so re-finalisation matches the original decision). */
function mergeFlagsFrom(mergeReview) {
  if (!mergeReview || mergeReview.isMergeClass !== true) return null;
  return {
    isMergeClass: true,
    blocked: mergeReview.blocked === true,
    verdict: mergeReview.qa?.verdict ?? null,
    summary: mergeReview.qa?.summary ?? mergeReview.evidence?.blocker ?? null,
  };
}

/**
 * Process ONE already-claimed turn by REUSING the proven durable path. Idempotent: if the
 * turn already has a supervisor_review it will NOT re-run Codex — it only (re)finalises state
 * and (idempotently) fires notifications. A MERGE-CLASS turn (FIX 1) ALSO runs the APPROVED
 * Tower QA skill against REAL Git evidence and records both prompts + their fingerprints.
 *
 * @param {ReturnType<import('./db.mjs').openDb>} pool
 * @param {string} turnId
 * @param {object} [deps]  injectable { runSupervisor, runMergeReview, gatherGitEvidence, notify }
 */
export async function processTurn(pool, turnId, deps = REAL_DEPS) {
  const doReview = deps.runSupervisor ?? runSupervisor;
  const doMergeReview = deps.runMergeReview ?? runMergeReview;
  const doGatherEvidence = deps.gatherGitEvidence ?? gatherGitEvidence;
  const doGatherConvergence = deps.gatherConvergence ?? safeGatherConvergenceEvidence;
  const doNotify = deps.notify ?? notify;

  // (a) load the ACTIVE supervisor prompt FIRST, and bind it onto the turn if unbound.
  const prompt = await loadActivePrompt(pool);
  const bindRes = await pool.query(
    `update tower.turn
        set prompt_id = coalesce(prompt_id, ?),
            prompt_version = coalesce(prompt_version, ?),
            prompt_hash = coalesce(prompt_hash, ?)
      where id = ?
      returning build_ref, seq, goal_complete, kind, pr_number, repo, base_sha, head_sha, larry_response`,
    [prompt.id, prompt.version, prompt.content_hash, turnId],
  );
  const turnRow = bindRes.rows[0];
  const { build_ref: buildRef, seq: turnSeq, goal_complete: goalComplete } = turnRow;

  // IDEMPOTENCY — if a review already exists, do NOT re-run Codex. Finalise + notify only.
  const existing = await pool.query(
    `select verdict, warwick_needed, next_action, summary, aligned, over_engineering,
            drifting, administering, raw_output, merge_review
       from tower.supervisor_review where turn_id = ? order by created_at asc, rowid asc limit 1`,
    [turnId],
  );
  if (existing.rows.length > 0) {
    const rr = existing.rows[0];
    const r = rr.raw_output ?? rr;
    const blocked = r.status === 'blocked';
    const merge = mergeFlagsFrom(rr.merge_review);
    const nextState = VERDICT_TO_STATE[r.verdict] ?? 'reviewed';
    await pool.query(`update tower.turn set state = ?, updated_at = now() where id = ?`, [nextState, turnId]);
    const notifications = await fireTriggers(pool, { turnId, buildRef, turnSeq, nextState, r, blocked, goalComplete, notifyFn: doNotify, merge, larryResponse: turnRow.larry_response });
    log('processed_idempotent', { turnId, verdict: r.verdict, state: nextState, mergeClass: !!merge });
    return { turnId, reused: true, verdict: r.verdict, state: nextState, notifications };
  }

  // (e) RECONSTRUCT the turn PURELY from the DB (turn + bound prompt).
  const recon = await reconstructTurn(pool, turnId);
  const baseText = recon.reconstructedText;

  // Finding carry-forward — inject the build's OPEN findings so Codex must account for each.
  const openFindings = await loadOpenFindings(pool, buildRef);

  // WO-OR-22 — THE DISPOSITION GATE. Every PRIOR open finding must carry a disposition, judged
  // at THIS round's head. Otherwise the round is REJECTED here, BEFORE any reviewer is invoked
  // (so no Codex is spent on a round that cannot be trusted) and the rejection is persisted as
  // the turn's review so it is durable, idempotent on replay, and visible on Telegram.
  const gate = checkFindingDispositions(openFindings, { currentTurnId: turnId, headSha: turnRow.head_sha });
  if (!gate.ok) {
    const r = {
      status: 'gate_blocked', verdict: 'block', warwick_needed: true,
      aligned: null, over_engineering: null, drifting: null, administering: null,
      next_action: 'Dispose every prior open finding in a PR comment at the current head, then re-run.',
      summary: `Review round REJECTED — ${gate.errors.length} finding-disposition problem(s): ${gate.errors.join(' | ')}`,
    };
    await pool.query(
      `insert into tower.supervisor_review
         (turn_id, reviewer, verdict, warwick_needed, next_action, summary, raw_output)
       values (?, 'tower_findings_gate', ?, 1, ?, ?, ?)
       on conflict (turn_id) do nothing`,
      [turnId, r.verdict, r.next_action, r.summary, JSON.stringify(r)],
    );
    const gateState = VERDICT_TO_STATE[r.verdict] ?? 'blocked';
    await pool.query(`update tower.turn set state = ?, lease_owner = null, updated_at = now() where id = ?`, [gateState, turnId]);
    const gateNotifications = await fireTriggers(pool, {
      turnId, buildRef, turnSeq, nextState: gateState, r, blocked: false, goalComplete,
      notifyFn: doNotify, merge: null, larryResponse: turnRow.larry_response,
    });
    log('review_round_rejected', { turnId, required: gate.required, disposed: gate.disposed, errors: gate.errors.length });
    return { turnId, reused: false, gateBlocked: true, gateErrors: gate.errors, verdict: r.verdict, state: gateState, notifications: gateNotifications };
  }

  // Dispositions reach the packet straight from the DB — nothing is hand-carried in.
  const stagedInput = buildStagedInput(baseText, buildRef, openFindings);
  const packetHash = sha256(stagedInput);

  // (f-pre) WO-2026-08-07-33 — THE FIRST CARD OF THE QA SEQUENCE: "it is running".
  //
  // THE POSITION IS THE FEATURE. Every other notification in this file is emitted from
  // fireTriggers, i.e. AFTER a verdict exists — so TowerBot (which is DISPLAY ONLY; Warwick never
  // types into it) showed him each outcome and never the beat that says a review is under way.
  // This is the last line at which "a real Codex QA execution has begun" becomes true, and it is
  // reached only after everything that could stop one has already returned:
  //
  //   - the IDEMPOTENT-REPLAY branch returned above, so re-processing an already-reviewed turn
  //     never re-announces a Codex run that is not happening;
  //   - the FAIL-CLOSED findings-disposition gate returned above, and it rejects the round
  //     "BEFORE any reviewer is invoked" — a card emitted at poll time would have announced QA
  //     for rounds that never reach Codex at all (that gate, an unreadable QA skill, unresolved
  //     Git evidence, detectMergeClass not firing, or a claim that never happens);
  //   - `doReview` on the very next line IS the real Codex invocation.
  //
  // TWO CONSTRAINTS, both load-bearing. Neither is an implementation preference:
  //
  //   1. THE REAL TURN ID, NEVER null. notify() dedups on (turn_id, reason), and SQLite treats
  //      every NULL as distinct in a unique index — the property 'tower_failure' and
  //      'finding_disposed' deliberately exploit so they CAN repeat. This card must send exactly
  //      once per turn, so it depends on that index actually biting. A null here would re-announce
  //      on every pass, forever.
  //   2. UNCONDITIONAL — never gated on a "did we just create it?" flag. The idempotence is the
  //      database's, exactly as notify()'s own header requires. Gating on a freshly-created flag
  //      would lose the card permanently if the process died between the turn write and this one.
  //
  // A failed send must not take the review round down with it, and must not be silent either.
  // Logged and continue — the same shape as the poll/post alarms further down this file.
  try {
    await doNotify(pool, {
      turnId,
      reason: 'codex_qa_started',
      state: 'qa_started',
      message: composeQaStartedMessage({
        buildRef, turnSeq, turnId,
        prNumber: turnRow.pr_number, headSha: turnRow.head_sha,
      }),
    });
  } catch (e) {
    log('qa_started_notify_failed', { turnId, error: String(e?.message ?? e) });
  }

  // (f) DELIVERY review: REAL Codex reviews the staged (reconstructed + findings) turn under
  //     the lean delivery-supervisor prompt (ordinary path, unchanged).
  const sup = await doReview({ supervisorPromptText: prompt.content, reconstructedTurnText: stagedInput });
  const r = sup.result;

  // Which prompt(s) ran + their fingerprints (persisted on the review).
  const promptsApplied = [{ name: 'delivery_supervisor', version: prompt.version, fingerprint: prompt.content_hash }];

  // (f-merge) MERGE-CLASS review (FIX 1): a PR/checkpoint/completion/merge/review/deploy turn
  //     ALSO runs the APPROVED Tower QA skill against REAL Git evidence — never prose.
  const detection = detectMergeClass(turnRow, { heuristic: process.env.TOWER_MERGE_CLASS_HEURISTIC !== 'off' });
  let mergeReviewRecord = null;
  let mergeFlags = null;
  if (detection.isMergeClass) {
    const qa = loadQaSkill();
    if (!qa.ok) {
      // Fail-closed: the governing QA skill file is missing — cannot verify, escalate.
      mergeReviewRecord = {
        isMergeClass: true, blocked: true, detected: { source: detection.source, reason: detection.reason },
        evidence: { resolved: false, blocker: `QA skill unreadable at ${qa.path}: ${qa.error}` },
        qa: { status: 'blocked', verdict: 'blocked', summary: `Tower QA skill unreadable — ${qa.error}` },
        model_id: null,
      };
    } else {
      promptsApplied.push({ name: 'tower_qa_skill', fingerprint: qa.fingerprint, source: detection.source, path: qa.path });
      const evidence = await doGatherEvidence({
        cwd: REPO_ROOT, repo: turnRow.repo, branch: null,
        baseSha: turnRow.base_sha, headSha: turnRow.head_sha, prNumber: turnRow.pr_number,
      });
      if (!evidence.resolved) {
        mergeReviewRecord = {
          isMergeClass: true, blocked: true, detected: { source: detection.source, reason: detection.reason },
          evidence: summariseEvidence(evidence),
          qa: { status: 'blocked', verdict: 'blocked', summary: `Git evidence unresolved — ${evidence.blocker}` },
          model_id: null,
        };
      } else {
        // WO-2026-08-07-4C-03 — §3b responsibility B's evidence, on the AUTOMATIC route. This is
        // the route that actually fires: staging the inventory only into mergeCheck.mjs's CLI
        // entrypoint would have worked when the command was run by hand and silently not worked
        // here, which is the "works if you invoke the right thing" failure, not durability.
        const convergence = await doGatherConvergence({ cwd: REPO_ROOT });
        const packet = buildMergePacket({ turnRow, evidence, buildRef, larryClaim: turnRow.larry_response, openFindings, convergence });
        const mr = await doMergeReview({ qaSkillText: qa.text, packet, cwd: REPO_ROOT });
        mergeReviewRecord = {
          isMergeClass: true, blocked: mr.blocked === true,
          detected: { source: detection.source, reason: detection.reason },
          evidence: summariseEvidence(evidence),
          qa: mr.result, model_id: mr.modelId ?? null,
        };
      }
    }
    mergeFlags = mergeFlagsFrom(mergeReviewRecord);
  }

  // (g) persist Codex's FULL output + the exact staged input + packet_hash + prompts + merge
  //     review — EXACTLY ONE row per turn (FIX 4). ON CONFLICT (turn_id) DO NOTHING guards the
  //     race with a second watcher; if we lose it, read the existing row and use it (no 2nd run).
  const ins = await pool.query(
    `insert into tower.supervisor_review
       (turn_id, reviewer, model_id, packet_hash, staged_input, aligned, over_engineering,
        drifting, administering, next_action, warwick_needed, verdict, summary, raw_output,
        prompts_applied, merge_review)
     values (?, 'gpt_codex', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     on conflict (turn_id) do nothing
     returning id`,
    [
      turnId, sup.modelId ?? null, packetHash, stagedInput,
      r.aligned, r.over_engineering, r.drifting, r.administering,
      r.next_action, r.warwick_needed, r.verdict, r.summary, JSON.stringify(r),
      JSON.stringify(promptsApplied), mergeReviewRecord ? JSON.stringify(mergeReviewRecord) : null,
    ],
  );
  if (ins.rows.length === 0) {
    // Lost the insert race — a concurrent watcher already persisted THE review. Use it; never
    // run/persist a second Codex result. Re-finalise + notify idempotently from the winner.
    log('review_insert_conflict_reuse', { turnId });
    const win = await pool.query(
      `select verdict, warwick_needed, next_action, summary, raw_output, merge_review
         from tower.supervisor_review where turn_id = ? limit 1`, [turnId],
    );
    const wr = win.rows[0];
    const rWin = wr.raw_output ?? wr;
    const mergeWin = mergeFlagsFrom(wr.merge_review);
    const stateWin = VERDICT_TO_STATE[rWin.verdict] ?? 'reviewed';
    await pool.query(`update tower.turn set state = ?, updated_at = now() where id = ?`, [stateWin, turnId]);
    const notifications = await fireTriggers(pool, { turnId, buildRef, turnSeq, nextState: stateWin, r: rWin, blocked: rWin.status === 'blocked', goalComplete, notifyFn: doNotify, merge: mergeWin, larryResponse: turnRow.larry_response });
    return { turnId, reused: true, verdict: rWin.verdict, state: stateWin, notifications };
  }

  // (g cont.) W1 (WO-2026-08-05-09) — the ONLY point findings are opened for this round: this
  // insert just won, so this is the FIRST and ONLY time this review is persisted. Never on the
  // idempotent-reuse branch above, so a restart or a lost insert race can never double-open a
  // finding.
  const findingsOpened = await openFindingsFromMergeReview(pool, { buildRef, turnId, mergeReviewRecord });

  // (h) set turn.state from the verdict.
  const nextState = VERDICT_TO_STATE[r.verdict] ?? 'reviewed';
  await pool.query(`update tower.turn set state = ?, lease_owner = null, updated_at = now() where id = ?`, [nextState, turnId]);

  // (h cont.) auto-Telegram on the trigger conditions (idempotent), incl. the merge-class gate
  // and (W3) any findings this round opened.
  const notifications = await fireTriggers(pool, { turnId, buildRef, turnSeq, nextState, r, blocked: sup.blocked, goalComplete, notifyFn: doNotify, merge: mergeFlags, larryResponse: turnRow.larry_response, findingsOpened: findingsOpened.opened });

  log('processed', {
    turnId, verdict: r.verdict, blocked: sup.blocked, state: nextState,
    injectedFindings: openFindings.length,
    findingsOpened: findingsOpened.opened.length, findingsSkipped: findingsOpened.skipped, findingsReason: findingsOpened.reason,
    mergeClass: detection.isMergeClass, mergeBlocked: mergeFlags?.blocked ?? null, mergeVerdict: mergeFlags?.verdict ?? null,
    promptsApplied: promptsApplied.map((p) => p.name),
  });
  return { turnId, reused: false, verdict: r.verdict, blocked: sup.blocked, state: nextState, packetHash, mergeReview: mergeReviewRecord, notifications, findingsOpened: findingsOpened.opened };
}

/** Compact, DB-safe summary of the Git evidence (no full diff text stored in the DB). */
function summariseEvidence(ev) {
  return {
    resolved: ev.resolved, blocker: ev.blocker,
    repo: ev.repo, branch: ev.branch, base_sha: ev.base_sha, head_sha: ev.head_sha,
    diff_range: ev.diff_range, changed_files: ev.changed_files, changed_files_count: ev.changed_files?.length ?? 0,
    diff_truncated: ev.diff_truncated, ci_source: ev.ci_source, ci_checks: ev.ci_checks ? String(ev.ci_checks).slice(0, 1000) : null,
    collected_at: ev.collected_at,
  };
}

/** Build the buildCodexPrompt packet for the merge-class QA review from the Git evidence.
 *  Exported so the packet's CONTENTS can be asserted directly — a packet built inside a private
 *  function can only ever be evidenced by spending a real review. */
export function buildMergePacket({ turnRow, evidence, buildRef, larryClaim, openFindings, convergence = null }) {
  return {
    checkpoint_id: `turn:${turnRow.seq ?? '?'}`,
    build_id: buildRef,
    repo: evidence.repo, branch: evidence.branch,
    head_sha: evidence.head_sha, base_sha: evidence.base_sha, diff_range: evidence.diff_range,
    changed_files: evidence.changed_files, diff_text: evidence.diff_text, diff_truncated: evidence.diff_truncated,
    summary: larryClaim ?? '(no claim recorded)',
    ci_checks: evidence.ci_checks,
    // Carry open findings forward into the QA packet so a merge review must dispose of each.
    evidence_refs: (openFindings ?? []).map((f) => `finding:${f.id} ${String(f.description).slice(0, 120)}`),
    // WO-2026-08-07-4C-03 — §3b responsibility B. `null` when no inventory was gathered, which
    // buildCodexPrompt renders as NOTHING rather than as an empty inventory: a section reading
    // "no branches, no worktrees" would be a converged-looking estate produced by an absent probe.
    convergence: convergence?.text ?? null,
  };
}

async function heartbeat(pool, lastTurnId, state) {
  try {
    await pool.query(
      `insert into tower.watcher_heartbeat (watcher_id, last_beat, last_turn_id, state)
       values (?, now(), ?, ?)
       on conflict (watcher_id) do update
         set last_beat = now(), last_turn_id = excluded.last_turn_id, state = excluded.state`,
      [WATCHER_ID, lastTurnId ?? null, state],
    );
  } catch (e) {
    // A heartbeat is an aliveness signal, not a correctness one. Losing one to write contention
    // must never take the watcher down with it — the next loop writes another.
    if (isBusyError(e)) { log('heartbeat_busy'); return; }
    throw e;
  }
}

function sleep(ms) { return new Promise((res) => setTimeout(res, ms)); }

export async function runWatcher() {
  // Self-sufficient boot: open the durable store and ensure every schema exists (idempotent).
  const pool = openDb();
  await applySchema(pool);
  await applyWatcherSchema(pool);
  await applyHoldSchema(pool);
  await applyCommentSchema(pool);
  await applyPostSchema(pool);
  log('store_open', { path: pool.path });

  const deps = await resolveDeps();
  let stopping = false;
  let lastTurnId = null;
  // WO-TW-02 poll-step state. In-process on purpose: it is scheduling and alerting state, not
  // durable state. A restart re-polls, which is safe (the DB owns idempotence) and re-arms the
  // alarm, which is correct — a fresh process has no standing to stay quiet about GitHub.
  let nextPrPollAt = 0;                 // 0 = poll on the very first iteration
  let consecutivePollFailures = 0;
  let consecutivePostFailures = 0;

  // WO-TW-02 — the write-back sweep, shared by both call sites (after a turn is processed, and
  // once per poll round so a failed post is retried without waiting for the next turn).
  const sweepVerdicts = async () => {
    if (!PR_WRITEBACK_ENABLED) return;
    const r = await postRound(pool, deps);
    if (r.pending === 0) return;
    if (r.posted > 0 || r.skipped > 0) log('pr_verdict_posted', { posted: r.posted, alreadyOnPr: r.skipped, pending: r.pending });
    if (r.failed > 0 && r.posted === 0) {
      consecutivePostFailures += 1;
      log('pr_post_failed', {
        consecutive: consecutivePostFailures, escalateAfter: PR_POST_FAIL_ESCALATE_AFTER,
        errors: r.errors.map((e) => `${e.repo}#${e.pr}: ${e.error}`),
      });
      // FAIL-CLOSED AND LOUD. The verdict row stays posted=0, so nothing anywhere claims the
      // round was answered on the PR — and once the streak reaches the threshold, TowerBot is
      // told, once, that reviews are no longer reaching the pull request.
      if (consecutivePostFailures === PR_POST_FAIL_ESCALATE_AFTER) {
        const detail = r.errors.map((e) => `${e.repo}#${e.pr}: ${e.error}`).join(' | ').slice(0, 300);
        try {
          await deps.notify(pool, {
            turnId: null, reason: 'tower_failure', state: 'post_failing',
            message: composeMessage({
              buildRef: 'BUILD-014', turnSeq: '?', turnId: null, state: 'post_failing', verdict: null,
              summary: `Watcher ${WATCHER_ID}: ${PR_POST_FAIL_ESCALATE_AFTER} consecutive verdict posts FAILED — `
                + `reviews are NOT reaching the pull request. ${detail}`,
              nextAction: 'Check `gh auth status` and that the token still carries write scope on the repo.',
              warwickNeeded: true,
            }),
          });
          log('pr_post_alarm_fired', { consecutive: consecutivePostFailures });
        } catch (e) {
          log('pr_post_alarm_failed', { error: String(e?.message ?? e) });
        }
      }
    } else if (r.posted > 0 || r.skipped > 0) {
      if (consecutivePostFailures > 0) log('pr_post_recovered', { after: consecutivePostFailures });
      consecutivePostFailures = 0;
    }
  };

  const onSignal = () => { stopping = true; log('signal_stop'); };
  process.on('SIGINT', onSignal);
  process.on('SIGTERM', onSignal);

  log('watcher_up', {
    pollMs: POLL_MS, leaseSeconds: LEASE_SECONDS,
    prPoll: PR_POLL_ENABLED ? `every ${PR_POLL_MS}ms` : 'off',
    prWriteback: PR_WRITEBACK_ENABLED ? 'on' : 'off',
  });

  try {
    while (!stopping) {
      // ── WO-TW-02: the automatic trigger. This is the whole feature: the already-running
      // watcher asks GitHub, on its own schedule, with nobody typing a command.
      if (PR_POLL_ENABLED && Date.now() >= nextPrPollAt) {
        nextPrPollAt = Date.now() + PR_POLL_MS;
        let round = null;
        try {
          round = await pollRound(pool, deps);
        } catch (e) {
          // pollTargets itself failed — the store, OR (since WO-2026-08-03-05) open-PR DISCOVERY.
          // Counting it as a FAILED round rather than a quiet zero-target round is load-bearing:
          // discovery that fails silently would return no targets, and no targets is precisely
          // what a healthy idle watcher looks like. This is the line that keeps a blind watcher
          // from reading as a calm one, and it feeds the same 3-strike tower_failure alarm.
          round = { targets: 1, ok: 0, failed: 1, errors: [{ repo: '(targets)', pr: 0, error: String(e?.message ?? e) }] };
          log('pr_poll_targets_failed', { error: String(e?.message ?? e) });
        }

        // A round counts as failed only when it had targets and NONE of them succeeded. A round
        // with no targets is not a failure — it is an idle watcher with nothing to watch, and
        // alarming on it would train whoever reads TowerBot to ignore the alarm.
        const roundFailed = round.targets > 0 && round.ok === 0;
        if (roundFailed) {
          consecutivePollFailures += 1;
          log('pr_poll_round_failed', { consecutive: consecutivePollFailures, escalateAfter: PR_POLL_FAIL_ESCALATE_AFTER });
          // FIRE ONCE per failure streak, exactly at the threshold. Not every round (that is
          // spam, and spam is ignored) and not never (that is silence, and silence reads as
          // "nothing to review" — the failure mode this whole subsystem exists to prevent).
          if (consecutivePollFailures === PR_POLL_FAIL_ESCALATE_AFTER) {
            const detail = round.errors.map((e) => `${e.repo}#${e.pr}: ${e.error}`).join(' | ').slice(0, 300);
            try {
              await deps.notify(pool, {
                turnId: null, reason: 'tower_failure', state: 'poll_failing',
                message: composeMessage({
                  buildRef: 'BUILD-014', turnSeq: '?', turnId: null, state: 'poll_failing',
                  verdict: null,
                  summary: `Watcher ${WATCHER_ID}: ${PR_POLL_FAIL_ESCALATE_AFTER} consecutive PR-comment poll rounds FAILED — `
                    + `Tower is no longer seeing PR checkpoints. ${detail}`,
                  nextAction: 'Check `gh auth status` and network reachability on the watcher host.',
                  warwickNeeded: true,
                }),
              });
              log('pr_poll_alarm_fired', { consecutive: consecutivePollFailures });
            } catch (e) {
              log('pr_poll_alarm_failed', { error: String(e?.message ?? e) });
            }
          }
        } else if (round.targets > 0) {
          if (consecutivePollFailures > 0) log('pr_poll_recovered', { after: consecutivePollFailures });
          consecutivePollFailures = 0;
        }

        // Retry anything that failed to reach the PR earlier, on the same cadence.
        await sweepVerdicts();
      }

      await reclaimStale(pool);
      const claimed = await claimOne(pool);
      if (claimed) {
        lastTurnId = claimed.id;
        await heartbeat(pool, lastTurnId, 'processing');
        // FIX 4: keep the lease fresh for the whole (possibly long) Codex run so a healthy
        // turn is never reclaimed mid-flight by another watcher.
        const stopRenew = startLeaseRenewer(pool, claimed.id);
        try {
          const res = await processTurn(pool, claimed.id, deps);
          lastTurnId = res.turnId;
          // WO-TW-02 — the verdict goes back onto the PR. CLAIMED here (durably, keyed on the
          // review) and SENT by the sweep, so a send failure leaves a retryable record rather
          // than a round that quietly never answered.
          if (PR_WRITEBACK_ENABLED) {
            try {
              const q = await queueVerdictForTurn(pool, res.turnId);
              if (q?.claimed) log('pr_verdict_queued', { turnId: res.turnId, postKey: q.postKey });
            } catch (e) {
              log('pr_verdict_queue_failed', { turnId: res.turnId, error: String(e?.message ?? e) });
            }
            await sweepVerdicts();
          }
        } finally {
          stopRenew();
        }
      }
      await heartbeat(pool, lastTurnId, claimed ? 'processed' : 'idle');
      if (!claimed) await sleep(POLL_MS);
    }
    log('watcher_down_clean');
  } catch (err) {
    // CRASH WRAPPER — fire a tower_failure Telegram before exiting.
    log('watcher_crash', { error: String(err?.message ?? err) });
    try {
      await notify(pool, {
        turnId: lastTurnId, reason: 'tower_failure', state: 'crashed',
        message: composeMessage({
          buildRef: 'BUILD-014', turnSeq: '?', turnId: lastTurnId, state: 'crashed',
          verdict: null, summary: `Watcher ${WATCHER_ID} crashed: ${String(err?.message ?? err).slice(0, 200)}`,
          nextAction: 'Restart the watcher and inspect logs.', warwickNeeded: true,
        }),
      });
    } catch (e2) {
      log('crash_notify_failed', { error: String(e2?.message ?? e2) });
    }
    await pool.end();
    process.exitCode = 1;
    return;
  }
  await pool.end();
}

if (import.meta.url === `file://${process.argv[1]}` || process.argv[1]?.endsWith('watcher.mjs')) {
  runWatcher().catch((e) => { console.error(`[watcher] FATAL: ${e.stack ?? e.message}`); process.exit(1); });
}
