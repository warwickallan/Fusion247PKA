// WO-OR-22 Tower supervisor loop — PR COMMENT INGEST.
//
// Turns a GitHub PR-comment payload into machine-readable review input: the body is preserved
// verbatim, bound to the exact PR and head SHA, persisted in tower.pr_comment, and its finding
// dispositions are written onto tower.finding where the NEXT review round reads them straight
// from the database (see findings.mjs).
//
// THERE IS NO LIVE WEBHOOK AND THIS DOES NOT BUILD ONE. The entrypoint is a function/CLI taking
// a payload — a fixture or a file — exactly how reviewDiff.mjs and apply.mjs are already driven.
//
//   node ingestComment.mjs --payload test/fixtures/pr-comment-dispositions.json
//   node ingestComment.mjs --payload <file> --json      (machine-readable result on stdout)
//
// WO-TW-01: the store is SQLite (better-sqlite3, WAL) at TOWER_SQLITE_PATH. `pool` is the
// pg-shaped handle from db.mjs; the CLI opens the default store itself.
//
// THE COMMENT GRAMMAR — directives a human (or Larry) writes in an ordinary PR comment:
//
//   @tower head: <40-char lower-case sha>
//   @tower checkpoint: <BUILD-REF>                        (WO-TW-02)
//   @tower finding <finding-uuid>: addressed — <rationale>
//   @tower finding <finding-uuid>: remains_open — <rationale>
//   @tower finding <finding-uuid>: unrelated — <rationale>
//
// WO-TW-02 — THE CHECKPOINT DIRECTIVE, and why it lives HERE. `@tower checkpoint:` is the
// explicit marker that makes a comment a review checkpoint: the watcher's poll step creates the
// `tower.turn` for it before ingest, so a real PR comment can start a review round with no human
// running a command. It is deliberately part of THIS grammar rather than a parallel syntax — one
// channel with two grammars is how the next reader gets it wrong. It is also why the parser had
// to learn it rather than merely tolerate it: the `unrecognised @tower directive` branch below
// makes ANY unknown `@tower` line malformed, and a malformed directive REFUSES the whole comment.
// Before this change, writing `@tower checkpoint:` would have got the comment thrown away.
//
// A CHECKPOINT IS NOT SELF-EXECUTING. Parsing it here only reports that the marker is present.
// Nothing in this module creates a turn; see pollPrComments.mjs. A comment WITHOUT the marker
// can never conjure a review round, which is the whole point of requiring an explicit one.
//
// The HEAD DIRECTIVE IS MANDATORY and is what the comment is bound to. It is taken from the
// BODY rather than the payload envelope on purpose: it records the head the author actually
// reviewed. A GitHub `issue_comment` webhook payload does not carry the PR head SHA at all, so
// an envelope-supplied head would have to be resolved separately and could bind a comment to a
// head its author never saw — which is the precise failure this seam exists to prevent.

import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { openDb } from './db.mjs';
import { applyAll } from './apply.mjs';
import { FINDING_DISPOSITIONS } from './findings.mjs';

const CANONICAL_SHA = /^[0-9a-f]{40}$/;
const HEAD_RE = /^\s*@tower\s+head\s*:\s*([0-9a-fA-F]{40})\s*$/;
// The em-dash is what a human actually types; hyphen and colon are accepted too. The rationale
// is optional at the parse layer and required at the apply layer, so a malformed line is
// reported as malformed rather than silently becoming a disposition with no reason.
const FINDING_RE = /^\s*@tower\s+finding\s+([0-9a-fA-F-]{8,40})\s*:\s*([a-z_]+)\s*(?:[—:-]\s*(.*))?$/i;
// WO-TW-02. The build ref is OPTIONAL in the grammar but is how a checkpoint binds to a build:
// without it, ingestTurn falls back to TOWER_BUILD_REF or 'UNCLASSIFIED' and never guesses.
const CHECKPOINT_RE = /^\s*@tower\s+checkpoint\s*(?::\s*([A-Za-z0-9][A-Za-z0-9._-]*))?\s*$/i;

/** Extract the head directive, the checkpoint marker and the finding dispositions from a comment
 *  body. Never throws: malformed lines are reported, not discarded silently. */
export function parseCommentBody(body) {
  const lines = String(body ?? '').split(/\r?\n/);
  const dispositions = [];
  const malformed = [];
  let headSha = null;
  let checkpoint = null;

  for (const line of lines) {
    const h = line.match(HEAD_RE);
    if (h) {
      const raw = h[1];
      // Upper-case hex is a real head but NOT a canonical one; refuse rather than silently
      // lower-casing it, so the author sees that the estate wants canonical heads.
      if (!CANONICAL_SHA.test(raw)) malformed.push(`head directive is not a canonical lower-case 40-hex SHA: ${raw}`);
      else if (headSha && headSha !== raw) malformed.push(`conflicting head directives: ${headSha} vs ${raw}`);
      else headSha = raw;
      continue;
    }
    const cp = line.match(CHECKPOINT_RE);
    if (cp) {
      const buildRef = cp[1] ? String(cp[1]).trim() : null;
      // Two checkpoint markers naming DIFFERENT builds is ambiguous, and a checkpoint that has to
      // be guessed is exactly the thing this marker exists to make explicit. Refuse, do not pick.
      if (checkpoint && checkpoint.buildRef !== buildRef) {
        malformed.push(`conflicting checkpoint directives: ${checkpoint.buildRef ?? '(no build ref)'} vs ${buildRef ?? '(no build ref)'}`);
      } else {
        checkpoint = { buildRef };
      }
      continue;
    }
    const f = line.match(FINDING_RE);
    if (f) {
      const [, findingId, statusRaw, rationaleRaw] = f;
      const status = String(statusRaw).toLowerCase();
      const rationale = String(rationaleRaw ?? '').trim();
      if (!FINDING_DISPOSITIONS.includes(status)) {
        malformed.push(`finding ${findingId}: unknown disposition "${statusRaw}" (expected one of ${FINDING_DISPOSITIONS.join(', ')})`);
        continue;
      }
      if (!rationale) {
        malformed.push(`finding ${findingId}: disposition "${status}" has no rationale`);
        continue;
      }
      dispositions.push({ findingId, status, rationale });
      continue;
    }
    if (/^\s*@tower\b/.test(line)) malformed.push(`unrecognised @tower directive: ${line.trim().slice(0, 100)}`);
  }
  return { headSha, checkpoint, dispositions, malformed };
}

/** Normalise a GitHub issue_comment-shaped payload into the fields the seam binds on. */
export function normalisePayload(payload) {
  const p = payload ?? {};
  const repo = p.repository?.full_name ?? p.repo ?? null;
  const prNumber = p.issue?.number ?? p.pull_request?.number ?? p.pr_number ?? null;
  const c = p.comment ?? {};
  return {
    repo,
    prNumber: prNumber === null ? null : Number(prNumber),
    commentId: c.id === undefined || c.id === null ? null : Number(c.id),
    author: c.user?.login ?? c.author ?? null,
    body: c.body ?? null,
    receivedAt: c.created_at ?? c.updated_at ?? null,
  };
}

class IngestRejection extends Error {
  constructor(reason, detail = {}) { super(reason); this.reason = reason; this.detail = detail; }
}

/**
 * INGEST one PR comment.
 *
 * Order of operations matters and is fail-closed throughout:
 *   1. normalise + parse            — a payload missing a bindable field is refused outright
 *      (nothing persisted: we cannot record provenance we do not have).
 *   2. resolve the turn             — by (repo, pr_number), most recent.
 *   3. STALE CHECK                  — comment head vs the turn's CURRENT head. A mismatch is
 *      persisted with applied=false + rejected_reason and its dispositions are NEVER applied.
 *   4. apply                        — persist applied=true, then write each disposition onto
 *      tower.finding carrying source='pr_comment', the comment row id, and the exact head.
 *
 * @returns {Promise<{applied: boolean, reason?: string, commentRowId?: string, turnId?: string,
 *                    headSha?: string, applied_count?: number, skipped?: string[]}>}
 */
export async function ingestPrComment(pool, payload, { turnId: explicitTurnId = null } = {}) {
  const n = normalisePayload(payload);
  const missing = ['repo', 'prNumber', 'commentId', 'author', 'body', 'receivedAt']
    .filter((k) => n[k] === null || n[k] === undefined || n[k] === '');
  if (missing.length) {
    throw new IngestRejection(`payload is missing required field(s): ${missing.join(', ')}`, { normalised: n });
  }

  const parsed = parseCommentBody(n.body);
  if (!parsed.headSha) {
    throw new IngestRejection(
      'comment carries no `@tower head: <40-hex>` directive — a comment that does not state the '
      + 'head it was written against cannot be bound to one');
  }
  if (parsed.malformed.length) {
    throw new IngestRejection(`comment has malformed directive(s): ${parsed.malformed.join(' | ')}`);
  }

  // Resolve the turn this comment answers.
  let turn = null;
  if (explicitTurnId) {
    turn = (await pool.query(
      `select id, head_sha, repo, pr_number, build_ref from tower.turn where id = ?`, [explicitTurnId])).rows[0] ?? null;
  } else {
    turn = (await pool.query(
      `select id, head_sha, repo, pr_number, build_ref from tower.turn
        where repo = ? and pr_number = ? order by seq desc limit 1`, [n.repo, n.prNumber])).rows[0] ?? null;
  }
  if (!turn) {
    throw new IngestRejection(`no tower.turn found for ${n.repo} PR #${n.prNumber} — nothing to bind the comment to`);
  }

  const turnHead = String(turn.head_sha ?? '').trim().toLowerCase();
  const stale = turnHead !== parsed.headSha;

  // --- STALE: persist the rejection (auditable), apply NOTHING. -------------------------
  if (stale) {
    const reason = `stale comment: written against head ${parsed.headSha.slice(0, 12)} but turn `
      + `${turn.id} is at head ${turnHead ? turnHead.slice(0, 12) : '(none)'} — dispositions NOT applied`;
    const row = await insertComment(pool, n, parsed.headSha, turn.id, false, reason);
    return { applied: false, reason, commentRowId: row.id, turnId: turn.id, headSha: parsed.headSha, applied_count: 0 };
  }

  // --- FRESH: persist, then apply each disposition. -------------------------------------
  const row = await insertComment(pool, n, parsed.headSha, turn.id, true, null);
  if (row.deduped) {
    return { applied: row.applied, reason: 'already ingested (idempotent no-op)', commentRowId: row.id,
      turnId: turn.id, headSha: parsed.headSha, applied_count: 0, deduped: true };
  }

  const skipped = [];
  let appliedCount = 0;
  // W4 (WO-2026-08-05-09) — the ids this call actually wrote a disposition onto, so the caller
  // (pollPrComments.mjs → watcher.mjs's pollRound) can trigger the Telegram echo without
  // re-parsing the comment body. Deliberately IDS ONLY, never the rationale text: the echo must
  // be read back from the store after the write, not carried through from what was parsed here —
  // see watcher.mjs readDisposedFindings / sendDispositionNotifications for why that distinction
  // is load-bearing.
  const disposedFindingIds = [];
  for (const d of parsed.dispositions) {
    const upd = await pool.query(
      `update tower.finding
          set disposition = ?, disposition_rationale = ?, disposition_source = 'pr_comment',
              disposition_comment_id = ?, disposition_head_sha = ?, disposition_at = now(),
              updated_at = now()
        where id = ? and state = 'open'
        returning id`,
      [d.status, d.rationale, row.id, parsed.headSha, d.findingId],
    );
    if (upd.rowCount === 1) { appliedCount += 1; disposedFindingIds.push(d.findingId); }
    else skipped.push(`${d.findingId} (no open tower.finding with that id)`);
  }

  return {
    applied: true, commentRowId: row.id, turnId: turn.id, headSha: parsed.headSha,
    applied_count: appliedCount, skipped, dispositions: parsed.dispositions.length, disposedFindingIds,
  };
}

async function insertComment(pool, n, headSha, turnId, applied, rejectedReason) {
  const ins = await pool.query(
    `insert into tower.pr_comment
       (turn_id, source, repo, pr_number, head_sha, comment_id, author, body, received_at, applied, rejected_reason)
     values (?, 'github_pr_comment', ?, ?, ?, ?, ?, ?, ?, ?, ?)
     on conflict (source, comment_id) do nothing
     returning id, applied`,
    [turnId, n.repo, n.prNumber, headSha, n.commentId, n.author, n.body, n.receivedAt, applied, rejectedReason],
  );
  if (ins.rows.length > 0) return { ...ins.rows[0], deduped: false };
  const existing = await pool.query(
    `select id, applied from tower.pr_comment where source = 'github_pr_comment' and comment_id = ?`, [n.commentId]);
  return { ...existing.rows[0], deduped: true };
}

// ── CLI ───────────────────────────────────────────────────────────────────────
function arg(name, dflt = undefined) {
  const i = process.argv.indexOf(`--${name}`);
  if (i === -1 || i === process.argv.length - 1) return dflt;
  return process.argv[i + 1];
}

if (import.meta.url === `file://${process.argv[1]}` || process.argv[1] === fileURLToPath(import.meta.url)) {
  (async () => {
    const file = arg('payload');
    if (!file) throw new Error('usage: node ingestComment.mjs --payload <payload.json> [--turn <turn-id>] [--json]');
    const payload = JSON.parse(fs.readFileSync(file, 'utf8'));
    const pool = openDb();
    await applyAll(pool);
    try {
      const res = await ingestPrComment(pool, payload, { turnId: arg('turn', null) });
      if (process.argv.includes('--json')) { console.log(JSON.stringify(res, null, 2)); }
      else if (res.applied) {
        console.log(`[ingest] APPLIED comment ${res.commentRowId} → turn ${res.turnId} @ ${res.headSha}`);
        console.log(`[ingest] dispositions written to tower.finding: ${res.applied_count}/${res.dispositions ?? 0}`);
        if (res.skipped?.length) console.log(`[ingest] skipped: ${res.skipped.join(', ')}`);
      } else {
        console.error(`[ingest] REJECTED — ${res.reason}`);
        console.error(`[ingest] comment persisted as applied=false (${res.commentRowId}); nothing was applied.`);
      }
      process.exit(res.applied ? 0 : 2);
    } finally { await pool.end(); }
  })().catch((e) => {
    console.error(`[ingest] REFUSED: ${e.message}`);
    process.exit(1);
  });
}
