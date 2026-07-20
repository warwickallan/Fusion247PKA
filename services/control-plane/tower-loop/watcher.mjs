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
import { createHash } from 'node:crypto';
import pg from 'pg';
import { applySchema, applyWatcherSchema } from './apply.mjs';
import {
  loadActivePrompt,
  reconstructTurn,
  VERDICT_TO_STATE,
} from './loop.mjs';
import { runSupervisor } from './supervisorCodex.mjs';
import { notify, composeMessage } from './notify.mjs';

const DB_URL = process.env.CONTROL_PLANE_DEV_DATABASE_URL;
const WATCHER_ID = process.env.WATCHER_ID || `${os.hostname()}#${process.pid}`;
const POLL_MS = Number(process.env.WATCHER_POLL_MS || 1500);
const LEASE_SECONDS = Number(process.env.WATCHER_LEASE_SECONDS || 30);

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

// ── notification triggers (identical policy to the proven runTurn) ────────────
async function fireTriggers(pool, { turnId, buildRef, turnSeq, nextState, r, blocked, goalComplete }) {
  const base = {
    buildRef, turnSeq, turnId, state: nextState, verdict: r.verdict,
    summary: r.summary, nextAction: r.next_action, warwickNeeded: r.warwick_needed,
  };
  const out = [];
  if (blocked) {
    out.push(await notify(pool, {
      turnId, reason: 'tower_failure', state: nextState,
      message: composeMessage({ ...base, summary: `Tower supervisor unavailable — ${r.summary}` }),
    }));
  }
  if (r.verdict === 'ask_warwick' || r.warwick_needed === true) {
    out.push(await notify(pool, { turnId, reason: 'warwick_input_required', state: nextState, message: composeMessage(base) }));
  }
  if (r.verdict === 'block' || r.verdict === 'correct') {
    out.push(await notify(pool, { turnId, reason: 'codex_block_or_redirect', state: nextState, message: composeMessage(base) }));
  }
  if (goalComplete === true) {
    await pool.query(`update tower.turn set state = 'complete', updated_at = now() where id = $1`, [turnId]);
    out.push(await notify(pool, {
      turnId, reason: 'goal_complete', state: 'complete',
      message: composeMessage({ ...base, state: 'complete', summary: `Goal complete — ${r.summary}` }),
    }));
  }
  return out;
}

/**
 * Process ONE already-claimed turn by REUSING the proven durable path. Idempotent: if the
 * turn already has a supervisor_review it will NOT re-run Codex — it only (re)finalises state
 * and (idempotently) fires notifications.
 */
export async function processTurn(pool, turnId) {
  // (a) load the ACTIVE supervisor prompt FIRST, and bind it onto the turn if unbound.
  const prompt = await loadActivePrompt(pool);
  const bindRes = await pool.query(
    `update tower.turn
        set prompt_id = coalesce(prompt_id, $2),
            prompt_version = coalesce(prompt_version, $3),
            prompt_hash = coalesce(prompt_hash, $4)
      where id = $1
      returning build_ref, seq, goal_complete`,
    [turnId, prompt.id, prompt.version, prompt.content_hash],
  );
  const { build_ref: buildRef, seq: turnSeq, goal_complete: goalComplete } = bindRes.rows[0];

  // IDEMPOTENCY — if a review already exists, do NOT re-run Codex. Finalise + notify only.
  const existing = await pool.query(
    `select verdict, warwick_needed, next_action, summary, aligned, over_engineering,
            drifting, administering, raw_output
       from tower.supervisor_review where turn_id = $1 order by created_at asc limit 1`,
    [turnId],
  );
  if (existing.rows.length > 0) {
    const rr = existing.rows[0];
    const r = rr.raw_output ?? rr;
    const blocked = r.status === 'blocked';
    const nextState = VERDICT_TO_STATE[r.verdict] ?? 'reviewed';
    await pool.query(`update tower.turn set state = $2, updated_at = now() where id = $1`, [turnId, nextState]);
    const notifications = await fireTriggers(pool, { turnId, buildRef, turnSeq, nextState, r, blocked, goalComplete });
    log('processed_idempotent', { turnId, verdict: r.verdict, state: nextState });
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

  // (f) REAL Codex reviews the staged (reconstructed + findings) turn.
  const sup = await runSupervisor({ supervisorPromptText: prompt.content, reconstructedTurnText: stagedInput });
  const r = sup.result;

  // (g) persist Codex's FULL output + the exact staged input + packet_hash.
  await pool.query(
    `insert into tower.supervisor_review
       (turn_id, reviewer, model_id, packet_hash, staged_input, aligned, over_engineering,
        drifting, administering, next_action, warwick_needed, verdict, summary, raw_output)
     values ($1, 'gpt_codex', $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)`,
    [
      turnId, sup.modelId ?? null, packetHash, stagedInput,
      r.aligned, r.over_engineering, r.drifting, r.administering,
      r.next_action, r.warwick_needed, r.verdict, r.summary, JSON.stringify(r),
    ],
  );

  // (h) set turn.state from the verdict.
  const nextState = VERDICT_TO_STATE[r.verdict] ?? 'reviewed';
  await pool.query(`update tower.turn set state = $2, lease_owner = null, updated_at = now() where id = $1`, [turnId, nextState]);

  // Carry-forward is the DEFAULT: open findings stay open (never silently dropped) unless
  // something explicitly resolves them. The watcher does not auto-resolve.

  // (h cont.) auto-Telegram on the trigger conditions (idempotent).
  const notifications = await fireTriggers(pool, { turnId, buildRef, turnSeq, nextState, r, blocked: sup.blocked, goalComplete });

  log('processed', { turnId, verdict: r.verdict, blocked: sup.blocked, state: nextState, injectedFindings: openFindings.length });
  return { turnId, reused: false, verdict: r.verdict, blocked: sup.blocked, state: nextState, packetHash, notifications };
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

  const pool = new pg.Pool({ connectionString: DB_URL, max: 4 });
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
        const res = await processTurn(pool, claimed.id);
        lastTurnId = res.turnId;
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
