// BUILD-014 Tower supervisor loop — the durable turn loop.
//
// runTurn(pool, {instruction, larryResponse}) executes EXACTLY Warwick's ordered steps:
//   (a) load the ACTIVE supervisor prompt from tower.supervisor_prompt FIRST;
//   (b) insert a tower.turn row (prompt id/version/hash + instruction + Larry's response + ts);
//   (e) RECONSTRUCT the turn by RE-READING it from the DB (not from memory), compute a
//       packet_hash over the reconstructed text, and stage that to the Codex supervisor;
//   (f) Codex reviews the reconstructed turn as GPT's stand-in;
//   (g) persist Codex's FULL output into tower.supervisor_review (typed fields + raw_output
//       jsonb + packet_hash);
//   (h) set turn.state from the verdict, and on the trigger conditions send the Watcher
//       Telegram via notify().
//
// Tower stages everything durably; Codex never touches the DB or holds any secret.

import { createHash } from 'node:crypto';
import { runSupervisor } from './supervisorCodex.mjs';
import { notify, composeMessage } from './notify.mjs';

export const VERDICT_TO_STATE = Object.freeze({
  continue: 'reviewed',
  correct: 'acted',
  block: 'blocked',
  ask_warwick: 'awaiting_warwick',
});

function sha256(text) {
  return createHash('sha256').update(String(text ?? ''), 'utf8').digest('hex');
}

/** Deterministic serialization of a turn — the exact text hashed AND staged to Codex.
 *  Built purely from durable DB rows so it is byte-identical before and after a restart. */
export function serializeReconstructedTurn({ turn, prompt }) {
  return [
    `# Reconstructed turn (from durable storage)`,
    `build_ref: ${turn.build_ref}`,
    `turn_id: ${turn.id}`,
    `turn_seq: ${turn.seq}`,
    `created_at: ${new Date(turn.created_at).toISOString()}`,
    `supervisor_prompt_id: ${prompt.id}`,
    `supervisor_prompt_version: ${prompt.version}`,
    `supervisor_prompt_hash: ${prompt.content_hash}`,
    ``,
    `## Instruction (what Warwick / Tower asked)`,
    String(turn.instruction ?? ''),
    ``,
    `## Larry's response / proposed action`,
    String(turn.larry_response ?? ''),
    ``,
  ].join('\n');
}

/**
 * INGEST — how a new eligible Larry turn ARRIVES. Split from processing: this only records
 * the turn as `state='pending'`; the persistent watcher claims and processes it later. The
 * prompt is intentionally NOT bound here — the watcher binds the ACTIVE prompt at process
 * time (load-prompt-FIRST stays a property of processing, not of arrival).
 *
 * @param {import('pg').Pool} pool
 * @param {object} input
 * @param {string}  input.instruction    what Warwick/Tower asked
 * @param {string} [input.larryResponse] Larry's response / proposed action
 * @param {string} [input.buildRef]      build this turn belongs to (default 'BUILD-014')
 * @param {boolean}[input.goalComplete]  caller signals this turn ships the goal
 * @param {string} [input.kind]          'ordinary' (default) or 'merge_review' (FIX 1)
 * @param {number} [input.prNumber]      merge-class: PR number
 * @param {string} [input.repo]          merge-class: owner/name
 * @param {string} [input.baseSha]       merge-class: base commit
 * @param {string} [input.headSha]       merge-class: exact head commit under review
 * @param {string} [input.sessionTurnKey] idempotency key (FIX 2 Stop-hook bridge). When a
 *   row with this key already exists, the existing row is returned and NO new turn is created.
 * @returns {Promise<{id,seq,build_ref,state,created_at,kind,deduped?:boolean}>}
 */
export async function ingestTurn(pool, {
  instruction, larryResponse = null, buildRef, goalComplete = false,
  kind = 'ordinary', prNumber = null, repo = null, baseSha = null, headSha = null,
  sessionTurnKey = null,
}) {
  if (typeof instruction !== 'string' || instruction.length === 0) {
    throw new Error('ingestTurn: instruction must be a non-empty string');
  }
  // Idempotent per session-turn key: the same Larry reply (same key) can never double-ingest.
  const { rows } = await pool.query(
    `insert into tower.turn
       (build_ref, instruction, larry_response, state, goal_complete,
        kind, pr_number, repo, base_sha, head_sha, session_turn_key)
     values (coalesce($1, 'BUILD-014'), $2, $3, 'pending', $4, $5, $6, $7, $8, $9, $10)
     on conflict (session_turn_key) where session_turn_key is not null do nothing
     returning id, seq, build_ref, state, created_at, kind`,
    [buildRef ?? null, instruction, larryResponse, goalComplete === true,
     kind ?? 'ordinary', prNumber, repo, baseSha, headSha, sessionTurnKey],
  );
  if (rows.length > 0) return { ...rows[0], deduped: false };

  // Lost the insert to an existing key — return the pre-existing turn (idempotent, no dup).
  const existing = await pool.query(
    `select id, seq, build_ref, state, created_at, kind
       from tower.turn where session_turn_key = $1`,
    [sessionTurnKey],
  );
  return { ...existing.rows[0], deduped: true };
}

/** Load the single ACTIVE supervisor prompt. Fail-closed if none active. */
export async function loadActivePrompt(pool) {
  const { rows } = await pool.query(
    `select id, version, content, content_hash, active, approved_by, created_at
       from tower.supervisor_prompt
      where active = true
      limit 1`,
  );
  if (rows.length === 0) throw new Error('no ACTIVE supervisor prompt in tower.supervisor_prompt — seed one first');
  return rows[0];
}

/** Reconstruct a complete turn PURELY from the DB: turn row + its bound prompt + its review.
 *  This is what proves durability — callable from a fresh pool after a restart. */
export async function reconstructTurn(pool, turnId) {
  const turnRes = await pool.query(
    `select id, seq, build_ref, prompt_id, prompt_version, prompt_hash,
            instruction, larry_response, state, created_at, updated_at
       from tower.turn where id = $1`,
    [turnId],
  );
  if (turnRes.rows.length === 0) throw new Error(`turn ${turnId} not found`);
  const turn = turnRes.rows[0];

  const promptRes = await pool.query(
    `select id, version, content, content_hash, active, approved_by, created_at
       from tower.supervisor_prompt where id = $1`,
    [turn.prompt_id],
  );
  const prompt = promptRes.rows[0] ?? null;

  const reviewRes = await pool.query(
    `select id, reviewer, model_id, packet_hash, aligned, over_engineering, drifting,
            administering, next_action, warwick_needed, verdict, summary, raw_output, created_at
       from tower.supervisor_review where turn_id = $1 order by created_at asc`,
    [turnId],
  );

  const notifRes = await pool.query(
    `select id, reason, state, message, telegram_ok, telegram_message_id, created_at
       from tower.notification where turn_id = $1 order by created_at asc`,
    [turnId],
  );

  // The reconstructed staged text (only computable when the prompt row survives).
  const reconstructedText = prompt ? serializeReconstructedTurn({ turn, prompt }) : null;

  return {
    turn,
    prompt,
    reviews: reviewRes.rows,
    notifications: notifRes.rows,
    reconstructedText,
    reconstructedPacketHash: reconstructedText ? sha256(reconstructedText) : null,
  };
}

/**
 * Run one full durable supervisor turn.
 *
 * @param {import('pg').Pool} pool
 * @param {object} input
 * @param {string} input.instruction    what Warwick/Tower asked
 * @param {string} input.larryResponse  Larry's response / proposed action
 * @param {object} [opts]
 * @param {boolean} [opts.goalComplete]  caller signals the goal is done → goal_complete notify
 * @param {Function} [opts.runSupervisorFn]  injectable for tests (defaults to real Codex)
 * @param {Function} [opts.notifyFn]         injectable for tests (defaults to real Telegram)
 */
export async function runTurn(pool, { instruction, larryResponse }, opts = {}) {
  const runSup = opts.runSupervisorFn ?? runSupervisor;
  const doNotify = opts.notifyFn ?? notify;

  // (a) load the ACTIVE supervisor prompt FIRST.
  const prompt = await loadActivePrompt(pool);

  // (b/c/d) insert the turn row, binding the prompt id/version/hash used for this turn.
  const insertRes = await pool.query(
    `insert into tower.turn (prompt_id, prompt_version, prompt_hash, instruction, larry_response, state)
     values ($1, $2, $3, $4, $5, 'open')
     returning id, seq, build_ref, created_at`,
    [prompt.id, prompt.version, prompt.content_hash, instruction, larryResponse],
  );
  const turnId = insertRes.rows[0].id;

  // (e) RECONSTRUCT the turn by RE-READING it from the DB (not from memory), hash it, stage it.
  const reconstructed = await reconstructTurn(pool, turnId);
  const stagedText = reconstructed.reconstructedText;
  const packetHash = reconstructed.reconstructedPacketHash;

  // (f) Codex reviews the reconstructed turn as GPT's product-supervisor stand-in.
  const sup = await runSup({
    supervisorPromptText: prompt.content,
    reconstructedTurnText: stagedText,
  });
  const r = sup.result;

  // (g) persist Codex's FULL output (typed fields + raw jsonb + packet_hash).
  await pool.query(
    `insert into tower.supervisor_review
       (turn_id, reviewer, model_id, packet_hash, aligned, over_engineering, drifting,
        administering, next_action, warwick_needed, verdict, summary, raw_output)
     values ($1, 'gpt_codex', $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
    [
      turnId, sup.modelId ?? null, packetHash,
      r.aligned, r.over_engineering, r.drifting, r.administering,
      r.next_action, r.warwick_needed, r.verdict, r.summary,
      JSON.stringify(r),
    ],
  );

  // (h) set turn.state from the verdict.
  const nextState = VERDICT_TO_STATE[r.verdict] ?? 'reviewed';
  await pool.query(
    `update tower.turn set state = $2, updated_at = now() where id = $1`,
    [turnId, nextState],
  );

  // (h cont.) fire the automatic Watcher Telegram on the trigger conditions.
  const notifications = [];
  const buildRef = insertRes.rows[0].build_ref;
  const turnSeq = insertRes.rows[0].seq;
  const baseMsg = { buildRef, turnSeq, turnId, state: nextState, verdict: r.verdict, summary: r.summary, nextAction: r.next_action, warwickNeeded: r.warwick_needed };

  // tower_failure: the supervisor could not run at all (fail-closed block).
  if (sup.blocked) {
    notifications.push(await doNotify(pool, {
      turnId, reason: 'tower_failure', state: nextState,
      message: composeMessage({ ...baseMsg, summary: `Tower supervisor unavailable — ${r.summary}` }),
    }));
  }

  // warwick_input_required: verdict=ask_warwick OR warwick_needed.
  if (r.verdict === 'ask_warwick' || r.warwick_needed === true) {
    notifications.push(await doNotify(pool, {
      turnId, reason: 'warwick_input_required', state: nextState,
      message: composeMessage(baseMsg),
    }));
  }

  // codex_block_or_redirect: verdict=block OR correct.
  if (r.verdict === 'block' || r.verdict === 'correct') {
    notifications.push(await doNotify(pool, {
      turnId, reason: 'codex_block_or_redirect', state: nextState,
      message: composeMessage(baseMsg),
    }));
  }

  // goal_complete: caller-signalled.
  if (opts.goalComplete === true) {
    await pool.query(`update tower.turn set state = 'complete', updated_at = now() where id = $1`, [turnId]);
    notifications.push(await doNotify(pool, {
      turnId, reason: 'goal_complete', state: 'complete',
      message: composeMessage({ ...baseMsg, state: 'complete', summary: `Goal complete — ${r.summary}` }),
    }));
  }

  return {
    turnId,
    turnSeq,
    buildRef,
    promptId: prompt.id,
    promptVersion: prompt.version,
    promptHash: prompt.content_hash,
    packetHash,
    supervisorBlocked: sup.blocked,
    supervisorResult: r,
    state: opts.goalComplete === true ? 'complete' : nextState,
    notifications,
  };
}
