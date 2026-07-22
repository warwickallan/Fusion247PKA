// BUILD-014 Tower supervisor loop — the PERSISTENT WATCHER.
//
// This is the smallest thing that automatically supervises Larry by wrapping the ALREADY-
// PROVEN durable path (loadActivePrompt → reconstructTurn → REAL Codex → persist review →
// apply verdict → auto-Telegram). It adds nothing that the acceptance proof does not require.
//
// One process, one loop, forever until SIGINT:
//   reclaim stale leases → claim ONE pending turn (exactly-once, restart-safe) → process it
//   (reuse the proven path) → mark final → heartbeat → sleep(poll) → repeat.
//
// Turns ARRIVE via ingestTurn() (loop.mjs) as state='pending'. The watcher is the only thing
// that processes them. Exactly-once is guaranteed by a durable lease + FOR UPDATE SKIP LOCKED
// and by refusing to re-run Codex when a turn already has a supervisor_review.
//
//   CONTROL_PLANE_DEV_DATABASE_URL=postgres://... node watcher.mjs

import os from 'node:os';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createHash } from 'node:crypto';
import pg from 'pg';
import { applySchema, applyWatcherSchema, applyHoldSchema } from './apply.mjs';
import {
  loadActivePrompt,
  reconstructTurn,
  VERDICT_TO_STATE,
} from './loop.mjs';
import { runSupervisor, runMergeReview } from './supervisorCodex.mjs';
import { gatherGitEvidence } from './gitEvidence.mjs';
import { detectMergeClass } from './mergeClass.mjs';
import { notify, composeMessage, composeLarryMessage } from './notify.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const DB_URL = process.env.CONTROL_PLANE_DEV_DATABASE_URL;
const WATCHER_ID = process.env.WATCHER_ID || `${os.hostname()}#${process.pid}`;
const POLL_MS = Number(process.env.WATCHER_POLL_MS || 1500);
const LEASE_SECONDS = Number(process.env.WATCHER_LEASE_SECONDS || 30);

// Repo root (…/services/control-plane/tower-loop → up 3) + the APPROVED Tower QA skill used
// on merge-class turns. Both overridable via env for tests / relocated checkouts.
const REPO_ROOT = process.env.TOWER_EVIDENCE_REPO_DIR || path.resolve(__dirname, '../../..');
const QA_SKILL_PATH = process.env.TOWER_QA_SKILL_PATH
  || path.join(REPO_ROOT, 'Builds', 'BUILD-010-fusion-tower', 'baton-mvp', 'tower-qa-skill.md');

// Injectable dependencies (FIX 3 — deterministic CI doubles via env module paths). The
// watcher resolves reviewer + git-evidence functions once at boot; a fake reviewer / fake
// git-evidence module (canned, no network) is loaded when the env var points at it. The
// Telegram transport double is env-controlled INSIDE notify (TOWER_NOTIFY_TRANSPORT=none).
const REAL_DEPS = { runSupervisor, runMergeReview, gatherGitEvidence, notify };

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
  return {
    runSupervisor: reviewerMod.runSupervisor ?? runSupervisor,
    runMergeReview: reviewerMod.runMergeReview ?? runMergeReview,
    gatherGitEvidence: gitMod.gatherGitEvidence ?? gatherGitEvidence,
    notify,
  };
}

/** Load the APPROVED Tower QA skill (governing prompt) + its sha256 fingerprint. Fail-closed:
 *  if the skill file is missing, merge-class review is BLOCKED (never assume-and-pass). */
function loadQaSkill() {
  try {
    const text = fs.readFileSync(QA_SKILL_PATH, 'utf8');
    return { text, fingerprint: sha256(text), path: QA_SKILL_PATH, ok: true };
  } catch (e) {
    return { text: null, fingerprint: null, path: QA_SKILL_PATH, ok: false, error: String(e?.message ?? e) };
  }
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
     values ($1, $2, $3, 'open') returning id, build_ref, state`,
    [buildRef, openedTurnId, description],
  );
  return rows[0];
}

async function loadOpenFindings(pool, buildRef) {
  const { rows } = await pool.query(
    `select id, build_ref, description, state, created_at
       from tower.finding where build_ref = $1 and state = 'open' order by created_at asc`,
    [buildRef],
  );
  return rows;
}

// ── lease / claim (exactly-once, restart-safe) ───────────────────────────────
async function reclaimStale(pool) {
  const { rows } = await pool.query(
    `update tower.turn
        set state = 'pending', lease_owner = null, lease_deadline_at = null, updated_at = now()
      where state = 'claimed' and lease_deadline_at is not null and lease_deadline_at < now()
      returning id`,
  );
  if (rows.length) log('reclaimed_stale', { count: rows.length });
  return rows.length;
}

async function claimOne(pool) {
  // Atomic single-row claim: pick the oldest pending turn, skipping rows another worker holds.
  const { rows } = await pool.query(
    `update tower.turn t
        set state = 'claimed', lease_owner = $1,
            lease_deadline_at = now() + make_interval(secs => $2), updated_at = now()
       from (
         select id from tower.turn
          where state = 'pending'
          order by seq
          for update skip locked
          limit 1
       ) s
      where t.id = s.id
      returning t.id, t.seq, t.build_ref, t.goal_complete`,
    [WATCHER_ID, LEASE_SECONDS],
  );
  return rows[0] ?? null;
}

// ── notification triggers (proven delivery policy + FIX 1 merge-class QA gate) ─
// `merge` (optional): { isMergeClass, blocked, verdict, summary } for a merge-class turn.
// A merge-class turn ONLY reaches goal_complete when its Tower-QA review APPROVED against
// real Git evidence; a blocked/unresolved QA fires tower_failure, a non-approve fires
// codex_block_or_redirect — a prose "done" can never silently ship.
async function fireTriggers(pool, { turnId, buildRef, turnSeq, nextState, r, blocked, goalComplete, notifyFn = notify, merge = null, larryResponse = null }) {
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
    await pool.query(`update tower.turn set state = 'complete', updated_at = now() where id = $1`, [turnId]);
    reason = 'goal_complete'; state = 'complete'; summary = `Goal complete — ${r.summary}`;
  }

  if (!reason) return []; // continue / aligned -> SILENT (no Telegram)
  // Two SEPARATE Telegram messages (one dedup row): Larry's side of the dialogue first, THEN Codex's
  // verdict — an actual back-and-forth on TowerBot, never one combined message. Larry's is omitted
  // when there is no larry_response, so a pure-Codex turn still sends exactly one message.
  const messages = [
    composeLarryMessage({ buildRef, turnSeq, turnId, larryResponse }),
    composeMessage({ ...base, state, warwickNeeded, summary }),
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
            set lease_deadline_at = now() + make_interval(secs => $2), updated_at = now()
          where id = $1 and lease_owner = $3 and state = 'claimed'`,
        [turnId, LEASE_SECONDS, WATCHER_ID],
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
 * @param {import('pg').Pool} pool
 * @param {string} turnId
 * @param {object} [deps]  injectable { runSupervisor, runMergeReview, gatherGitEvidence, notify }
 */
export async function processTurn(pool, turnId, deps = REAL_DEPS) {
  const doReview = deps.runSupervisor ?? runSupervisor;
  const doMergeReview = deps.runMergeReview ?? runMergeReview;
  const doGatherEvidence = deps.gatherGitEvidence ?? gatherGitEvidence;
  const doNotify = deps.notify ?? notify;

  // (a) load the ACTIVE supervisor prompt FIRST, and bind it onto the turn if unbound.
  const prompt = await loadActivePrompt(pool);
  const bindRes = await pool.query(
    `update tower.turn
        set prompt_id = coalesce(prompt_id, $2),
            prompt_version = coalesce(prompt_version, $3),
            prompt_hash = coalesce(prompt_hash, $4)
      where id = $1
      returning build_ref, seq, goal_complete, kind, pr_number, repo, base_sha, head_sha, larry_response`,
    [turnId, prompt.id, prompt.version, prompt.content_hash],
  );
  const turnRow = bindRes.rows[0];
  const { build_ref: buildRef, seq: turnSeq, goal_complete: goalComplete } = turnRow;

  // IDEMPOTENCY — if a review already exists, do NOT re-run Codex. Finalise + notify only.
  const existing = await pool.query(
    `select verdict, warwick_needed, next_action, summary, aligned, over_engineering,
            drifting, administering, raw_output, merge_review
       from tower.supervisor_review where turn_id = $1 order by created_at asc limit 1`,
    [turnId],
  );
  if (existing.rows.length > 0) {
    const rr = existing.rows[0];
    const r = rr.raw_output ?? rr;
    const blocked = r.status === 'blocked';
    const merge = mergeFlagsFrom(rr.merge_review);
    const nextState = VERDICT_TO_STATE[r.verdict] ?? 'reviewed';
    await pool.query(`update tower.turn set state = $2, updated_at = now() where id = $1`, [turnId, nextState]);
    const notifications = await fireTriggers(pool, { turnId, buildRef, turnSeq, nextState, r, blocked, goalComplete, notifyFn: doNotify, merge, larryResponse: turnRow.larry_response });
    log('processed_idempotent', { turnId, verdict: r.verdict, state: nextState, mergeClass: !!merge });
    return { turnId, reused: true, verdict: r.verdict, state: nextState, notifications };
  }

  // (e) RECONSTRUCT the turn PURELY from the DB (turn + bound prompt).
  const recon = await reconstructTurn(pool, turnId);
  const baseText = recon.reconstructedText;

  // Finding carry-forward — inject the build's OPEN findings so Codex must account for each.
  const openFindings = await loadOpenFindings(pool, buildRef);
  let stagedInput = baseText;
  if (openFindings.length > 0) {
    stagedInput = [
      baseText,
      `## Open findings for ${buildRef} — MUST be accounted for`,
      `These findings are still OPEN from earlier reviews. If Larry's response silently drops`,
      `any of them without resolving it, do NOT continue — correct or block, and carry it`,
      `forward. Never let a finding silently disappear.`,
      ...openFindings.map((f) => `- [finding ${f.id}] (${f.state}) ${f.description}`),
      ``,
    ].join('\n');
  }
  const packetHash = sha256(stagedInput);

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
        const packet = buildMergePacket({ turnRow, evidence, buildRef, larryClaim: turnRow.larry_response, openFindings });
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
     values ($1, 'gpt_codex', $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
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
         from tower.supervisor_review where turn_id = $1 limit 1`, [turnId],
    );
    const wr = win.rows[0];
    const rWin = wr.raw_output ?? wr;
    const mergeWin = mergeFlagsFrom(wr.merge_review);
    const stateWin = VERDICT_TO_STATE[rWin.verdict] ?? 'reviewed';
    await pool.query(`update tower.turn set state = $2, updated_at = now() where id = $1`, [turnId, stateWin]);
    const notifications = await fireTriggers(pool, { turnId, buildRef, turnSeq, nextState: stateWin, r: rWin, blocked: rWin.status === 'blocked', goalComplete, notifyFn: doNotify, merge: mergeWin, larryResponse: turnRow.larry_response });
    return { turnId, reused: true, verdict: rWin.verdict, state: stateWin, notifications };
  }

  // (h) set turn.state from the verdict.
  const nextState = VERDICT_TO_STATE[r.verdict] ?? 'reviewed';
  await pool.query(`update tower.turn set state = $2, lease_owner = null, updated_at = now() where id = $1`, [turnId, nextState]);

  // (h cont.) auto-Telegram on the trigger conditions (idempotent), incl. the merge-class gate.
  const notifications = await fireTriggers(pool, { turnId, buildRef, turnSeq, nextState, r, blocked: sup.blocked, goalComplete, notifyFn: doNotify, merge: mergeFlags, larryResponse: turnRow.larry_response });

  log('processed', {
    turnId, verdict: r.verdict, blocked: sup.blocked, state: nextState,
    injectedFindings: openFindings.length,
    mergeClass: detection.isMergeClass, mergeBlocked: mergeFlags?.blocked ?? null, mergeVerdict: mergeFlags?.verdict ?? null,
    promptsApplied: promptsApplied.map((p) => p.name),
  });
  return { turnId, reused: false, verdict: r.verdict, blocked: sup.blocked, state: nextState, packetHash, mergeReview: mergeReviewRecord, notifications };
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

/** Build the buildCodexPrompt packet for the merge-class QA review from the Git evidence. */
function buildMergePacket({ turnRow, evidence, buildRef, larryClaim, openFindings }) {
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
  };
}

async function heartbeat(pool, lastTurnId, state) {
  await pool.query(
    `insert into tower.watcher_heartbeat (watcher_id, last_beat, last_turn_id, state)
     values ($1, now(), $2, $3)
     on conflict (watcher_id) do update
       set last_beat = now(), last_turn_id = excluded.last_turn_id, state = excluded.state`,
    [WATCHER_ID, lastTurnId ?? null, state],
  );
}

function sleep(ms) { return new Promise((res) => setTimeout(res, ms)); }

export async function runWatcher() {
  if (!DB_URL) throw new Error('CONTROL_PLANE_DEV_DATABASE_URL is not set.');

  // Self-sufficient boot: ensure both schemas exist (idempotent).
  await applySchema(DB_URL);
  await applyWatcherSchema(DB_URL);
  await applyHoldSchema(DB_URL);

  const pool = new pg.Pool({ connectionString: DB_URL, max: 6 });
  const deps = await resolveDeps();
  let stopping = false;
  let lastTurnId = null;

  const onSignal = () => { stopping = true; log('signal_stop'); };
  process.on('SIGINT', onSignal);
  process.on('SIGTERM', onSignal);

  log('watcher_up', { pollMs: POLL_MS, leaseSeconds: LEASE_SECONDS });

  try {
    while (!stopping) {
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
