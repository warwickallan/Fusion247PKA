// Tower baton — Larry's handoff logic (the other half of the baton).
//
// runHandoff: post Larry's [LARRY → TOWER] checkpoint to the ClickUp control thread,
// then POLL the SAME thread for the matching [TOWER → LARRY] reply (correlated by
// checkpoint_id + reviewed_head), and return it as structured output for Larry's
// session.
//
// RE-ENTRANT (Fable nit #1): BEFORE posting, scan the thread for (a) an existing
// Tower reply for this checkpoint_id → return it immediately (a restarted Larry
// resumes without waiting), or (b) an existing checkpoint comment for this
// checkpoint_id → do NOT double-post; just wait. Stable checkpoint_id makes this safe.
//
// HONEST TIMEOUT: if no matching reply arrives within the budget, post an honest
// TOWER_UNAVAILABLE checkpoint to the thread, fire a Telegram alert, and return a
// HALT signal so Larry STOPS QA-dependent work (does not continue unsupervised).

import { formatCheckpoint, parseResponse, correlateResponse } from './checkpoint.js';

// Re-parse a comment as a checkpoint just enough to read its checkpoint_id (for the
// re-entrant "did I already post this checkpoint?" scan). We avoid importing the full
// parseCheckpoint requirement set — a same-id post is a match even if fields differ.
function commentCheckpointId(text) {
  const m = String(text ?? '').match(/\[LARRY\s*(?:→|->|=>)\s*TOWER\][\s\S]*?checkpoint_id\s*:\s*(\S+)/i);
  return m ? m[1] : null;
}

async function scanThread(clickup, taskId) {
  const comments = await clickup.getTaskComments(taskId);
  return comments.map((c) => ({ id: c.id, text: c.comment_text ?? c.text ?? c.body ?? '' }));
}

/** Find a matching [TOWER → LARRY] reply in a set of comments (correlate by id + head). */
export function findMatchingReply(comments, { checkpointId, expectedHead }) {
  for (const c of comments) {
    const parsed = parseResponse(c.text ?? '');
    if (!parsed.ok) continue;
    const corr = correlateResponse(parsed.response, { checkpointId, expectedHead });
    if (corr.match) return { comment: c, response: parsed.response, stale: false };
    if (corr.stale) { /* right checkpoint, stale head — keep looking for a fresh one */ }
  }
  return null;
}

/**
 * @param {object} args
 * @param {object} args.clickup       ClickUp client
 * @param {object} args.notifier      milestone notifier (for TOWER_UNAVAILABLE alert)
 * @param {string} args.taskId        control task id
 * @param {object} args.checkpoint    the [LARRY → TOWER] fields ({ checkpoint_id, head_sha, ... })
 * @param {number} [args.timeoutMs]   total wait budget (default 15 min)
 * @param {number} [args.pollMs]      poll interval (default 15 s)
 * @param {function} [args.sleep]     injectable sleep (tests pass a no-op)
 * @param {function} [args.now]       injectable clock
 * @returns {Promise<{ status, response?, commentId?, halt?, reason }>}
 *   status ∈ { RESUMED, RECEIVED, TIMED_OUT }
 */
export async function runHandoff({ clickup, notifier, taskId, checkpoint, timeoutMs = 15 * 60 * 1000, pollMs = 15_000, sleep = (ms) => new Promise((r) => setTimeout(r, ms)), now = Date.now } = {}) {
  const checkpointId = checkpoint.checkpoint_id;
  const expectedHead = checkpoint.head_sha;

  // RE-ENTRANT pre-scan.
  const pre = await scanThread(clickup, taskId);
  const existingReply = findMatchingReply(pre, { checkpointId, expectedHead });
  if (existingReply) {
    return { status: 'RESUMED', response: existingReply.response, commentId: existingReply.comment.id, reason: 'matching Tower reply already on the thread — resumed without re-posting' };
  }
  const alreadyPosted = pre.some((c) => commentCheckpointId(c.text) === checkpointId);

  // Post the checkpoint (only if not already posted for this id).
  let checkpointCommentId = null;
  if (!alreadyPosted) {
    const posted = await clickup.createTaskComment(taskId, formatCheckpoint(checkpoint));
    checkpointCommentId = posted.id;
  }

  // Poll for the matching reply.
  const deadline = now() + timeoutMs;
  // Always do at least one scan after posting, then loop until the deadline.
  // The first iteration runs immediately (no leading sleep) so a fast Tower is caught.
  for (let first = true; ; first = false) {
    if (!first) {
      if (now() >= deadline) break;
      await sleep(Math.min(pollMs, Math.max(0, deadline - now())));
      if (now() >= deadline) {
        // one last look before giving up
        const last = await scanThread(clickup, taskId);
        const hit = findMatchingReply(last, { checkpointId, expectedHead });
        if (hit) return { status: 'RECEIVED', response: hit.response, commentId: hit.comment.id, checkpointCommentId, reason: 'matching Tower reply received' };
        break;
      }
    }
    const comments = await scanThread(clickup, taskId);
    const hit = findMatchingReply(comments, { checkpointId, expectedHead });
    if (hit) return { status: 'RECEIVED', response: hit.response, commentId: hit.comment.id, checkpointCommentId, reason: 'matching Tower reply received' };
  }

  // TIMEOUT → honest TOWER_UNAVAILABLE + Telegram alert + HALT signal.
  const unavailableBody = [
    '[LARRY → TOWER]',
    'state: TOWER_UNAVAILABLE',
    `checkpoint_id: ${checkpointId}`,
    `head_sha: ${expectedHead ?? ''}`,
    `summary: No [TOWER → LARRY] reply within ${Math.round(timeoutMs / 1000)}s. Larry is HALTING QA-dependent work — not proceeding unsupervised.`,
  ].join('\n');
  let unavailableCommentId = null;
  try { const u = await clickup.createTaskComment(taskId, unavailableBody); unavailableCommentId = u.id; }
  catch { /* even the honest post failed — still return HALT */ }
  if (notifier) {
    await notifier.notifyMilestone({ purpose: 'tower_unavailable', logicalSource: 'LARRY', body: `Tower did not answer checkpoint ${checkpointId} within budget — Larry HALTED.`, checkpointId });
  }
  return { status: 'TIMED_OUT', halt: true, checkpointCommentId, unavailableCommentId, reason: 'no Tower reply within budget — HALT (Larry stops QA-dependent work)' };
}
