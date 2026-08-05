// WO-OR-24 Tower supervisor loop — THE FIRST HOP: a real GitHub PR comment → the existing ingest.
//
// WHAT THIS CLOSES. WO-OR-22 built and proved everything from an `issue_comment`-shaped payload
// onward. Nothing delivered one. The only thing that had ever driven that path was a JSON file a
// human typed, so the journey was real from the second step and synthetic at the first. This module
// is the missing first step and nothing more: it ASKS GitHub what is on the PR and hands the answer
// to `ingestPrComment` unaltered.
//
// A POLLER, NOT A WEBHOOK — say it plainly wherever this is cited. A webhook needs a public
// listener and inbound ingress; that is a new service and it is not wanted. Nothing here evidences
// push-delivery. What it evidences is narrower and is the thing that was actually missing: bytes
// that provably originated on github.com reach the ingest path with no human constructing a payload.
//
//   node pollPrComments.mjs --repo warwickallan/Fusion247PKA --pr 87
//   node pollPrComments.mjs --repo <owner/name> --pr <n> --marker <substring> --json
//
// AUTHORITY. Read-only, and structurally so. `gh` is invoked as a subprocess and holds its own
// credential in the OS keyring — this module never reads, prints, passes or stores a token, and it
// has no code path that writes to GitHub. The argv is built here from `repo` and `prNumber` alone;
// a caller cannot inject a method, and `assertReadOnlyArgs` refuses a mutating invocation anyway.
// Two independent reasons the same defect cannot happen, because one of them is a habit.
//
// THE HEAD SHA — read this before changing it, the subtlety is the whole point.
//
//   `ingestComment.mjs` binds a comment to the head named in its BODY, deliberately: that records
//   the head the author actually reviewed, and an envelope-supplied head could bind a comment to a
//   head its author never saw. That design is accepted and is NOT reopened here.
//
//   But a SHA a human typed is not, on its own, evidence of anything. So this poller fetches the
//   PR's REAL head from the GitHub API and VALIDATES the body directive against it. A comment whose
//   directive disagrees with the API never reaches ingest at all. The typed SHA therefore never
//   becomes authority, while the author's own declaration is still what gets recorded.
//
//   Two layers, and they catch different things — do not collapse them:
//     layer 1 (here)                body directive  vs  the PR's real head from the API
//     layer 2 (ingestComment.mjs)   body directive  vs  the turn's current head  → the stale check
//   Layer 1 catches a comment that misdescribes the PR. Layer 2 catches a comment that is honest
//   about a head the work has since moved past. Both fail closed; neither applies anything.

// WO-TW-02 — THE CHECKPOINT HOP, and the refusal it removes.
//
//   `ingestPrComment` resolves the turn a comment answers and THROWS when there is none:
//   "no tower.turn found for <repo> PR #<n> — nothing to bind the comment to". So before this
//   change, an automatic poll of a real PR refused every real comment unless a human had already
//   created the turn by hand. That manual prerequisite is what made the journey not unattended.
//
//   A comment carrying an explicit `@tower checkpoint:` marker now CREATES its turn, here, before
//   ingest. Two boundaries make that safe and neither may be softened:
//
//     - ONLY an explicit marker. A stray PR comment must never conjure a review round. No
//       marker → no turn → the pre-existing refusal stands, unchanged.
//     - The head is STILL the API's. The checkpoint turn is created at `apiHeadSha`, and the
//       comment only gets that far because layer 1 already validated its body directive against
//       it. A typed SHA remains a declaration, never authority.
//
//   IDEMPOTENCE IS THE DATABASE'S, NOT THIS MODULE'S. The turn carries a deterministic
//   `session_turn_key` derived from (repo, pr, comment_id), and `tower.turn_session_turn_key_uniq`
//   — a partial UNIQUE INDEX — is what refuses the second insert. Re-polling the same checkpoint
//   therefore cannot duplicate a turn even if this process restarts mid-round, because no
//   application state carries the guarantee. That is the difference between idempotent and
//   "idempotent until something crashes at the wrong moment".

import { execFile } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { openDb } from './db.mjs';
import { applyAll } from './apply.mjs';
import { ingestPrComment, parseCommentBody } from './ingestComment.mjs';
import { ingestTurn } from './loop.mjs';

const CANONICAL_SHA = /^[0-9a-f]{40}$/;
const REPO_RE = /^[A-Za-z0-9._-]+\/[A-Za-z0-9._-]+$/;

// Anything that could make `gh api` do more than read. Belt-and-braces: the argv is built
// internally, so this should be unreachable — which is exactly when a guard is worth having,
// because the day it becomes reachable is the day nobody remembers it was not.
const MUTATING_ARG = /^(-X|--method|-f|-F|--input|--field|--raw-field)$/;

/** Refuse an argv that could write. Throws rather than returning false: a read-only guard that
 *  can be ignored by not checking the return value is not a guard. */
export function assertReadOnlyArgs(args) {
  for (const a of args) {
    if (MUTATING_ARG.test(a)) {
      throw new Error(`refusing a non-read-only gh invocation: ${a} (this poller may only read)`);
    }
  }
  return args;
}

/** The real seam: `gh api <args>` as a subprocess, stdout returned as a string.
 *  This is the ONLY place the process boundary to GitHub is crossed, which is what makes the
 *  whole thing testable without a network. */
export const ghCliReader = {
  async api(args) {
    assertReadOnlyArgs(args);
    return new Promise((resolve, reject) => {
      execFile('gh', ['api', ...args], { maxBuffer: 32 * 1024 * 1024, windowsHide: true }, (err, stdout, stderr) => {
        if (err) return reject(new Error(`gh api ${args.join(' ')} failed: ${String(stderr || err.message).trim()}`));
        resolve(stdout);
      });
    });
  },
};

/** The PR's REAL head SHA, from GitHub — never from a comment body. */
export async function fetchPrHeadSha(gh, { repo, prNumber }) {
  assertRepo(repo); assertPr(prNumber);
  const out = await gh.api([`repos/${repo}/pulls/${prNumber}`, '--jq', '.head.sha']);
  const sha = String(out ?? '').trim();
  if (!CANONICAL_SHA.test(sha)) {
    throw new Error(`GitHub returned a head SHA that is not a canonical 40-hex value: ${JSON.stringify(sha)}`);
  }
  return sha;
}

/**
 * Every OPEN pull request on the repository, right now, as GitHub has them.
 *
 * WHY THIS EXISTS, and it is the whole point of WO-2026-08-03-05. Which PRs are open is a fact
 * about GitHub. It was previously inferred from `tower.turn` — work-in-progress state — which made
 * the watcher's success condition and its blindness condition the same event: a round that
 * finished set `state='complete'` and thereby removed its own PR from the poll list. The healthier
 * the loop was, the more certainly it went quiet, and the only thing that ever added a PR back was
 * a human supplying `TOWER_PR_SEED` at launch. Both of those are bindings that go stale; this
 * question does not, because it is re-asked every round.
 *
 * FAILS LOUD, NEVER EMPTY. A discovery error THROWS. It must never degrade to "no open PRs",
 * because an empty target set is indistinguishable from a healthy idle watcher — which is exactly
 * the failure this module is being changed to end.
 */
export async function fetchOpenPrs(gh, { repo }) {
  assertRepo(repo);
  // `--jq .[].number` with `--paginate` emits one number per line per page, so a repo with more
  // open PRs than one page still yields a complete list without stitching JSON arrays together.
  const out = await gh.api([`repos/${repo}/pulls?state=open&per_page=100`, '--paginate', '--jq', '.[].number']);
  const lines = String(out ?? '').split('\n').map((s) => s.trim()).filter(Boolean);
  const numbers = [];
  for (const line of lines) {
    if (!/^\d+$/.test(line)) {
      throw new Error(`gh returned a non-numeric open-PR entry for ${repo}: ${JSON.stringify(line)}`);
    }
    const n = Number(line);
    if (!Number.isInteger(n) || n <= 0) throw new Error(`gh returned a non-positive PR number for ${repo}: ${line}`);
    numbers.push(n);
  }
  return numbers;
}

/** Every comment on the PR, as GitHub returns them. No filtering here — filtering is a decision
 *  and belongs where it can be seen. */
export async function fetchPrComments(gh, { repo, prNumber }) {
  assertRepo(repo); assertPr(prNumber);
  const out = await gh.api([`repos/${repo}/issues/${prNumber}/comments`, '--paginate']);
  const parsed = JSON.parse(String(out ?? '').trim() || '[]');
  if (!Array.isArray(parsed)) throw new Error('gh api returned a non-array comment list');
  return parsed;
}

/** Shape one GitHub comment into the `issue_comment` payload `ingestPrComment` already accepts.
 *  This is a rename, not a transformation: every value below comes straight off the API response.
 *  Nothing is defaulted, invented or normalised — a missing field must stay missing so ingest can
 *  refuse it, rather than being quietly filled in here. */
export function toIngestPayload({ repo, prNumber, comment }) {
  return {
    action: 'created',
    repository: { full_name: repo },
    issue: { number: prNumber },
    comment: {
      id: comment.id,
      user: { login: comment.user?.login },
      created_at: comment.created_at,
      updated_at: comment.updated_at,
      body: comment.body,
      html_url: comment.html_url,
    },
  };
}

/**
 * The DURABLE idempotency key for a checkpoint turn.
 *
 * Deterministic in (repo, pr, comment_id) and nothing else — not the body, not the head, not the
 * time. Editing a checkpoint comment on GitHub keeps its id, so an edit re-binds to the SAME turn
 * rather than opening a second review round; posting a NEW comment is how you ask for a new one.
 */
export function checkpointTurnKey({ repo, prNumber, commentId }) {
  return `pr-checkpoint:${repo}#${Number(prNumber)}@${Number(commentId)}`;
}

/**
 * Create — or re-find — the review turn for one explicit checkpoint comment.
 *
 * All six required bindings are durable after this call:
 *   repository, PR number and head SHA   → tower.turn.{repo, pr_number, head_sha}
 *   build reference                      → tower.turn.build_ref
 *   durable idempotency key              → tower.turn.session_turn_key (UNIQUE, partial index)
 *   checkpoint comment id                → encoded in that key, and additionally recorded on
 *                                          tower.pr_comment.comment_id ↔ turn_id when the same
 *                                          comment is ingested moments later in this same round.
 *
 * `kind` is left 'ordinary' ON PURPOSE. `detectMergeClass` already treats a response mentioning a
 * checkpoint/PR/completion as merge-class by heuristic (mergeClass.mjs COMPLETION_PATTERNS
 * includes /\bcheckpoint\b/), and that classifier is already tested. Declaring 'merge_review'
 * here would hard-code a routing decision that existing, proven code already makes.
 */
export async function ensureCheckpointTurn(pool, { repo, prNumber, headSha, comment, buildRef = null }) {
  const commentId = Number(comment?.id);
  if (!Number.isInteger(commentId)) throw new Error('checkpoint comment has no usable id');
  const author = comment?.user?.login ?? '(unknown)';
  const sessionTurnKey = checkpointTurnKey({ repo, prNumber, commentId });

  const turn = await ingestTurn(pool, {
    // The instruction is Tower's side of the dialogue: what this round is being asked to do.
    instruction: `PR checkpoint — ${repo} PR #${prNumber} at head ${headSha} `
      + `(comment ${commentId} by ${author}). Review this checkpoint against the diff at that head.`,
    // Larry's side is the comment, VERBATIM. Same discipline as tower.pr_comment.body: the
    // reviewer must see what was actually written, not a summary of it.
    larryResponse: String(comment?.body ?? ''),
    // `undefined` (not null) so classifyBuildRef falls through to TOWER_BUILD_REF / UNCLASSIFIED
    // rather than treating an absent marker ref as an explicit one.
    buildRef: buildRef ?? undefined,
    kind: 'ordinary',
    prNumber, repo, headSha, baseSha: null,
    sessionTurnKey,
  });

  // WHETHER THE MARKER'S BUILD REF WAS ACTUALLY HONOURED — reported, never silently swallowed.
  // classifyBuildRef enforces /^BUILD-\d{3}$/ and falls back to UNCLASSIFIED for anything else.
  // Never guessing is correct. Doing it SILENTLY is not: a typo'd marker opens a round on a
  // build nobody is watching, and that round's findings then carry forward against it. This cost
  // a debugging round when a test used 'BUILD-A15' and the gate quietly failed to fire.
  const buildRefHonoured = buildRef === null || turn.build_ref === buildRef;
  return { ...turn, sessionTurnKey, buildRefRequested: buildRef, buildRefHonoured };
}

/**
 * POLL one PR and ingest every @tower comment on it.
 *
 * Idempotent by construction: it re-sees the same comments on every run, and re-ingesting is a
 * no-op via `(source, comment_id)` in tower.pr_comment. That is WO-OR-22's constraint doing the
 * work; nothing here tracks what it has already seen, because a poller that keeps its own memory
 * of that is a second source of truth waiting to disagree with the first.
 *
 * @returns {Promise<{repo, prNumber, apiHeadSha, scanned, candidates, results: object[]}>}
 */
export async function pollPrComments(pool, { repo, prNumber, gh = ghCliReader, marker = null } = {}) {
  assertRepo(repo); assertPr(prNumber);

  // 1. The real head, from GitHub. Fetched FIRST: if this fails, nothing is ingested, because
  //    without it there is nothing to validate a body directive against.
  const apiHeadSha = await fetchPrHeadSha(gh, { repo, prNumber });

  // 2. The comments, as GitHub has them.
  const all = await fetchPrComments(gh, { repo, prNumber });
  const candidates = all.filter((c) => typeof c?.body === 'string'
    && /@tower\b/.test(c.body)
    && (marker === null || c.body.includes(marker)));

  const results = [];
  for (const comment of candidates) {
    const base = { commentId: comment.id, author: comment.user?.login ?? null, url: comment.html_url ?? null };

    // 3. VALIDATE the body's head directive against the API head. Reuses WO-OR-22's parser so
    //    there is exactly one grammar in the estate, not two that will drift.
    const parsed = parseCommentBody(comment.body);
    if (!parsed.headSha) {
      results.push({ ...base, outcome: 'refused_no_head_directive',
        reason: 'comment carries no `@tower head:` directive' });
      continue;
    }
    if (parsed.headSha !== apiHeadSha) {
      results.push({ ...base, outcome: 'refused_head_mismatch',
        bodyHeadSha: parsed.headSha, apiHeadSha,
        reason: `body head directive ${parsed.headSha.slice(0, 12)} disagrees with the PR's real head `
          + `${apiHeadSha.slice(0, 12)} from the GitHub API — not ingested` });
      continue;
    }

    // 4. CHECKPOINT (WO-TW-02): an explicit marker creates/re-finds its turn BEFORE ingest, so
    //    the comment has something to bind to. Order matters — ingest resolves the turn by
    //    (repo, pr_number) newest-first, so the checkpoint comment binds to the turn it just
    //    opened. Without a marker this is skipped entirely and nothing is created.
    let checkpoint = null;
    if (parsed.checkpoint) {
      try {
        const t = await ensureCheckpointTurn(pool, {
          repo, prNumber, headSha: apiHeadSha, comment, buildRef: parsed.checkpoint.buildRef,
        });
        checkpoint = {
          turnId: t.id, turnSeq: t.seq, buildRef: t.build_ref,
          buildRefRequested: t.buildRefRequested, buildRefHonoured: t.buildRefHonoured,
          sessionTurnKey: t.sessionTurnKey, created: t.deduped !== true,
        };
      } catch (e) {
        // Fail closed and LOUD: a checkpoint that could not open its round must not fall through
        // and be ingested against some older turn as if it were an ordinary comment.
        results.push({ ...base, outcome: 'refused_checkpoint', reason: e.message });
        continue;
      }
    }

    // 5. Hand the untouched comment to the ACCEPTED ingest path. No second write path into the
    //    tables exists, by design.
    const payload = toIngestPayload({ repo, prNumber, comment });
    try {
      const res = await ingestPrComment(pool, payload);
      if (res.deduped) results.push({ ...base, checkpoint, outcome: 'deduped', commentRowId: res.commentRowId, headSha: res.headSha });
      else if (res.applied) results.push({ ...base, checkpoint, outcome: 'applied', commentRowId: res.commentRowId,
        turnId: res.turnId, headSha: res.headSha, applied_count: res.applied_count, skipped: res.skipped });
      else results.push({ ...base, checkpoint, outcome: 'rejected_stale', commentRowId: res.commentRowId,
        turnId: res.turnId, headSha: res.headSha, reason: res.reason });
    } catch (e) {
      results.push({ ...base, checkpoint, outcome: 'refused_ingest', reason: e.message });
    }
  }

  return {
    repo, prNumber, apiHeadSha,
    scanned: all.length, candidates: candidates.length,
    checkpointsCreated: results.filter((r) => r.checkpoint?.created === true).length,
    results,
  };
}

function assertRepo(repo) {
  if (!REPO_RE.test(String(repo ?? ''))) throw new Error(`repo must be "owner/name": ${JSON.stringify(repo)}`);
}
function assertPr(prNumber) {
  if (!Number.isInteger(Number(prNumber)) || Number(prNumber) <= 0) {
    throw new Error(`pr must be a positive integer: ${JSON.stringify(prNumber)}`);
  }
}

// ── CLI ───────────────────────────────────────────────────────────────────────
function arg(name, dflt = undefined) {
  const i = process.argv.indexOf(`--${name}`);
  if (i === -1 || i === process.argv.length - 1) return dflt;
  return process.argv[i + 1];
}

if (import.meta.url === `file://${process.argv[1]}` || process.argv[1] === fileURLToPath(import.meta.url)) {
  (async () => {
    const repo = arg('repo');
    const prNumber = Number(arg('pr'));
    if (!repo || !prNumber) throw new Error('usage: node pollPrComments.mjs --repo <owner/name> --pr <n> [--marker <substring>] [--json]');
    const pool = openDb();
    await applyAll(pool);
    try {
      const res = await pollPrComments(pool, { repo, prNumber, marker: arg('marker', null) });
      if (process.argv.includes('--json')) { console.log(JSON.stringify(res, null, 2)); }
      else {
        console.log(`[poll] ${res.repo} PR #${res.prNumber} — real head from GitHub API: ${res.apiHeadSha}`);
        console.log(`[poll] ${res.scanned} comment(s) on the PR, ${res.candidates} carrying @tower directives`);
        for (const r of res.results) {
          console.log(`[poll] comment ${r.commentId} by ${r.author} → ${r.outcome.toUpperCase()}`
            + (r.checkpoint ? ` [checkpoint ${r.checkpoint.created ? 'OPENED' : 'already open'} turn ${r.checkpoint.turnId} ${r.checkpoint.buildRef}]` : '')
            + (r.applied_count !== undefined ? ` (dispositions applied: ${r.applied_count})` : '')
            + (r.reason ? ` — ${r.reason}` : ''));
        }
      }
      // Exit non-zero if anything was refused or rejected: a poll that silently swallowed a
      // rejection would be the same false green this estate keeps paying for.
      const bad = res.results.filter((r) => r.outcome !== 'applied' && r.outcome !== 'deduped');
      process.exit(bad.length ? 2 : 0);
    } finally { await pool.end(); }
  })().catch((e) => {
    console.error(`[poll] REFUSED: ${e.message}`);
    process.exit(1);
  });
}
