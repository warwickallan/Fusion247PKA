// WO-TW-02 Tower supervisor loop — THE VERDICT WRITE-BACK: a review lands back on the PR.
//
// WHAT THIS CLOSES. The trigger made a PR comment start a review round automatically, and the
// verdict came out on TowerBot. Warwick's condition names both halves: "Codex responds ON THE PR
// and TowerBot." Until this module existed, anyone reading the pull request saw a checkpoint
// comment and then silence — the review had happened somewhere they could not see.
//
// ── WHY THIS IS A SEPARATE MODULE, AND WHY IT MUST STAY ONE ──────────────────────────────────
//
//   `pollPrComments.mjs` is READ-ONLY, structurally: `assertReadOnlyArgs` throws on `-X`,
//   `--method`, `-f`, `-F`, `--field`, `--raw-field` and `--input`. That guard is correct and it
//   is NOT relaxed here — not weakened, not bypassed, not made conditional. The poller reads; this
//   module writes; they share no seam. Two independent reasons a read path cannot write is a
//   property worth more than the few lines it costs to keep.
//
//   The symmetry is deliberate: where the reader refuses anything MUTATING, the writer refuses
//   anything that is not EXACTLY a comment POST. `assertCommentPostArgs` is an allowlist, not a
//   denylist, because a writer is the wrong place to be guessing at what is safe.
//
// ── IDEMPOTENCE BELONGS TO THE DATABASE ──────────────────────────────────────────────────────
//
//   Posting to a PR is outward and irreversible. `tower.pr_verdict_post.post_key` is UNIQUE and
//   deterministic in the REVIEW id, and this module INSERTs the claim BEFORE it calls GitHub —
//   only a caller that wins the insert may post. A restart mid-sweep therefore cannot double-post,
//   because the guarantee is not held in this process.
//
//   THE ONE WINDOW THE KEY ALONE CANNOT CLOSE: a crash after GitHub accepted the comment but
//   before `posted=1` was written. The row is then eligible for retry and would post twice. So a
//   RETRY (attempts > 0) first READS the PR's comments and looks for the marker this module
//   embeds in every body. That is the only reason a reader is passed in here, and it is why the
//   marker exists at all — it is not decoration.

import { execFile } from 'node:child_process';

const REPO_RE = /^[A-Za-z0-9._-]+\/[A-Za-z0-9._-]+$/;
// Exactly one endpoint shape may be written to, and only with POST.
const COMMENTS_ENDPOINT_RE = /^repos\/[A-Za-z0-9._-]+\/[A-Za-z0-9._-]+\/issues\/\d+\/comments$/;

/** The marker embedded in every posted body. Invisible in rendered GitHub markdown, and the only
 *  way a retry can tell "already posted" from "never posted" after a crash. */
export function verdictMarker(postKey) {
  return `<!-- tower-verdict-key: ${postKey} -->`;
}

/** The durable idempotency key. Deterministic in the review id — and there is at most one review
 *  per turn (tower.supervisor_review_turn_uniq), so this is also one post per round. */
export function verdictPostKey({ reviewId }) {
  return `pr-verdict:review:${reviewId}`;
}

/**
 * Refuse any argv that is not exactly "POST a comment onto this PR".
 *
 * An ALLOWLIST, deliberately. `assertReadOnlyArgs` in the poller can be a denylist because its
 * job is to forbid a category; a writer's job is to permit exactly one thing, and a denylist in
 * that position only forbids the mutations somebody thought of.
 *
 * Throws rather than returning false: a guard that can be ignored by not checking a return value
 * is not a guard.
 */
export function assertCommentPostArgs(args) {
  const a = Array.isArray(args) ? args : [];
  if (a[0] !== '--method' || a[1] !== 'POST') {
    throw new Error(`refusing a gh invocation that is not an explicit POST: ${a.join(' ')}`);
  }
  if (!COMMENTS_ENDPOINT_RE.test(String(a[2] ?? ''))) {
    throw new Error(`refusing a gh write to anything but a PR comments endpoint: ${String(a[2] ?? '')}`);
  }
  if (a[3] !== '-f' || !String(a[4] ?? '').startsWith('body=')) {
    throw new Error(`refusing a gh write whose only field is not the comment body: ${a.slice(3).join(' ')}`);
  }
  if (a.length !== 5) {
    throw new Error(`refusing a gh write carrying unexpected extra arguments: ${a.slice(5).join(' ')}`);
  }
  return a;
}

/** The real write seam. The ONLY place in this subsystem that mutates anything on GitHub.
 *  `gh` holds its own credential in the OS keyring; nothing here reads, prints or stores a token. */
export const ghCliWriter = {
  async postComment({ repo, prNumber, body }) {
    assertRepo(repo); assertPr(prNumber);
    const args = assertCommentPostArgs([
      '--method', 'POST', `repos/${repo}/issues/${prNumber}/comments`, '-f', `body=${body}`,
    ]);
    return new Promise((resolve, reject) => {
      execFile('gh', ['api', ...args], { maxBuffer: 8 * 1024 * 1024 }, (err, stdout, stderr) => {
        if (err) return reject(new Error(`gh api POST comment failed: ${String(stderr || err.message).trim()}`));
        try {
          const j = JSON.parse(String(stdout ?? '').trim() || '{}');
          resolve({ commentId: j.id ?? null, url: j.html_url ?? null });
        } catch (e) {
          reject(new Error(`gh api POST comment returned unparseable JSON: ${e.message}`));
        }
      });
    });
  },
};

/**
 * The comment a human actually reads on the PR.
 *
 * It must stand on its own: someone scrolling the pull request has no access to the store, so the
 * verdict, the head it was judged at, and which checkpoint it answers all have to be in the text.
 * A verdict with no head is unfalsifiable — it could be about any state of the branch.
 */
export function composeVerdictComment({
  postKey, verdict, summary, nextAction, headSha, buildRef, turnSeq, turnId,
  checkpointCommentId = null, warwickNeeded = false, reviewer = 'gpt_codex',
}) {
  const lines = [
    `**Tower review — ${String(verdict ?? 'unknown').toUpperCase()}**`,
    '',
    `- **Build:** ${buildRef ?? 'UNCLASSIFIED'} · turn \`${turnSeq ?? '?'}\` (\`${turnId}\`)`,
    `- **Head reviewed:** \`${headSha ?? '(none recorded)'}\``,
    checkpointCommentId
      ? `- **Answers checkpoint:** comment [\`${checkpointCommentId}\`](#issuecomment-${checkpointCommentId})`
      : '- **Answers checkpoint:** (none — this round was not opened by a PR checkpoint)',
    `- **Reviewer:** ${reviewer}`,
  ];
  if (warwickNeeded) lines.push('- ⚠️ **Warwick input required.**');
  lines.push('', summary ? String(summary) : '_(no summary recorded)_');
  if (nextAction) lines.push('', `**Next:** ${nextAction}`);
  lines.push('', '<sub>Posted automatically by the Tower watcher. Reply with `@tower head:` and',
    '`@tower finding <id>: <disposition> — <why>` to answer findings in the next round.</sub>',
    '', verdictMarker(postKey));
  return lines.join('\n');
}

/**
 * CLAIM the right to post one review's verdict.
 *
 * Returns `{ claimed: false }` when another caller (or an earlier run, or the same run before a
 * restart) already holds the claim. Nothing is sent from here — claiming and sending are separate
 * on purpose, so a send failure leaves a durable, retryable, INSPECTABLE record rather than
 * evaporating.
 */
export async function queueVerdictPost(pool, { reviewId, turnId, repo, prNumber, headSha, body }) {
  if (!reviewId || !turnId) throw new Error('queueVerdictPost: reviewId and turnId are required');
  assertRepo(repo); assertPr(prNumber);
  const postKey = verdictPostKey({ reviewId });
  const { rows } = await pool.query(
    `insert into tower.pr_verdict_post (post_key, review_id, turn_id, repo, pr_number, head_sha, body)
     values (?, ?, ?, ?, ?, ?, ?)
     on conflict (post_key) do nothing
     returning id, post_key`,
    [postKey, reviewId, turnId, repo, Number(prNumber), headSha ?? null, body],
  );
  if (rows.length > 0) return { claimed: true, id: rows[0].id, postKey };
  return { claimed: false, postKey };
}

/** Build the body for a completed round and claim it. Reads everything it needs from the store,
 *  so the caller hands over a turn id and nothing else. Returns null when the turn is not a PR
 *  round, or has no review yet — neither is an error. */
export async function queueVerdictForTurn(pool, turnId) {
  const { rows } = await pool.query(
    `select t.id turn_id, t.seq, t.build_ref, t.repo, t.pr_number, t.head_sha, t.session_turn_key,
            r.id review_id, r.verdict, r.summary, r.next_action, r.warwick_needed, r.reviewer
       from tower.turn t
       join tower.supervisor_review r on r.turn_id = t.id
      where t.id = ?`,
    [turnId],
  );
  const row = rows[0];
  if (!row) return null;
  if (!row.repo || row.pr_number === null || row.pr_number === undefined) return null;

  // Which checkpoint this answers. The session key encodes it for an auto-created round; a
  // hand-created turn simply has none, and the comment says so rather than inventing one.
  let checkpointCommentId = null;
  const m = /^pr-checkpoint:.+@(\d+)$/.exec(String(row.session_turn_key ?? ''));
  if (m) checkpointCommentId = Number(m[1]);

  const postKey = verdictPostKey({ reviewId: row.review_id });
  const body = composeVerdictComment({
    postKey, verdict: row.verdict, summary: row.summary, nextAction: row.next_action,
    headSha: row.head_sha, buildRef: row.build_ref, turnSeq: row.seq, turnId: row.turn_id,
    checkpointCommentId, warwickNeeded: row.warwick_needed === true, reviewer: row.reviewer,
  });
  return queueVerdictPost(pool, {
    reviewId: row.review_id, turnId: row.turn_id, repo: row.repo,
    prNumber: row.pr_number, headSha: row.head_sha, body,
  });
}

/**
 * SEND every claimed-but-unposted verdict.
 *
 * Fail-closed: a send failure records the error and leaves `posted = 0`, so the round is never
 * silently treated as answered on the PR. The caller escalates a persistent failure — see
 * watcher.mjs; this function only reports counts.
 */
export async function postPendingVerdicts(pool, { writer = ghCliWriter, reader = null, limit = 10 } = {}) {
  const { rows } = await pool.query(
    `select id, post_key, repo, pr_number, body, attempts
       from tower.pr_verdict_post
      where posted = 0
      order by created_at asc, rowid asc
      limit ?`,
    [limit],
  );
  if (rows.length === 0) return { pending: 0, posted: 0, failed: 0, skipped: 0, errors: [] };

  let posted = 0; let skipped = 0; const errors = [];
  for (const row of rows) {
    try {
      // THE CRASH WINDOW. On a retry, the previous attempt may have reached GitHub before this
      // process died. Look for our own marker before posting a second time.
      if (Number(row.attempts) > 0 && reader) {
        const already = await findExistingVerdictComment(reader, {
          repo: row.repo, prNumber: row.pr_number, postKey: row.post_key,
        });
        if (already) {
          await pool.query(
            `update tower.pr_verdict_post
                set posted = 1, comment_id = ?, comment_url = ?, last_error = null, updated_at = now()
              where id = ?`,
            [already.id ?? null, already.html_url ?? null, row.id]);
          skipped += 1;
          continue;
        }
      }

      await pool.query(`update tower.pr_verdict_post set attempts = attempts + 1, updated_at = now() where id = ?`, [row.id]);
      const res = await writer.postComment({ repo: row.repo, prNumber: row.pr_number, body: row.body });
      await pool.query(
        `update tower.pr_verdict_post
            set posted = 1, comment_id = ?, comment_url = ?, last_error = null, updated_at = now()
          where id = ?`,
        [res.commentId ?? null, res.url ?? null, row.id]);
      posted += 1;
    } catch (e) {
      const msg = String(e?.message ?? e);
      errors.push({ postKey: row.post_key, repo: row.repo, pr: row.pr_number, error: msg });
      await pool.query(
        `update tower.pr_verdict_post set last_error = ?, updated_at = now() where id = ?`,
        [msg.slice(0, 500), row.id]);
    }
  }
  return { pending: rows.length, posted, failed: errors.length, skipped, errors };
}

/** Read the PR's comments and find one already carrying our marker. Uses the READ seam, which is
 *  the poller's — this module never grows a reader of its own. */
async function findExistingVerdictComment(reader, { repo, prNumber, postKey }) {
  const out = await reader.api([`repos/${repo}/issues/${prNumber}/comments`, '--paginate']);
  const all = JSON.parse(String(out ?? '').trim() || '[]');
  if (!Array.isArray(all)) return null;
  const marker = verdictMarker(postKey);
  return all.find((c) => typeof c?.body === 'string' && c.body.includes(marker)) ?? null;
}

function assertRepo(repo) {
  if (!REPO_RE.test(String(repo ?? ''))) throw new Error(`repo must be "owner/name": ${JSON.stringify(repo)}`);
}
function assertPr(prNumber) {
  if (!Number.isInteger(Number(prNumber)) || Number(prNumber) <= 0) {
    throw new Error(`pr must be a positive integer: ${JSON.stringify(prNumber)}`);
  }
}
