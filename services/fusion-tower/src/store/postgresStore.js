// Fusion Tower — REAL Postgres/Supabase-backed store over the ftw schema.
//
// Satisfies the SAME surface as memoryStore.js so the dispatcher/adapters/tests
// drop in behind the identical contract. Every invariant the fixture enforces in
// JS this implementation enforces in SQL via migration 0001's constraints.
//
// CI-SAFETY (fcg rule): `pg` is imported DYNAMICALLY inside the async factory,
// never at module top-level. Importing this module requires neither `pg` nor a
// database; only calling createPostgresStore() does. The unit suite never touches pg.
//
// Determinism: `opts.now` (epoch ms) is an injectable timestamptz on every
// mutating call; when omitted the database's own now() is used (production path).

import {
  RUN_STATUS,
  TURN_STATE,
  WRITE_STATE,
  NOTIFICATION_STATE,
  assertRunTransition,
  assertTurnTransition,
  isTerminalRunStatus,
  WATCHDOG_LEASE_MS,
} from '../core/states.js';
import { assertSignerMatchesResponder, assertValidResponder } from '../core/guardrails.js';
import { buildSslConfig } from './pgSslConfig.js';

function nowTs(opts) {
  const now = opts?.now;
  return typeof now === 'number' && Number.isFinite(now) ? new Date(now) : null;
}

function mapRun(r) {
  if (!r) return undefined;
  return {
    run_id: r.run_id,
    schema_version: r.schema_version,
    title: r.title,
    scope: r.scope ?? null,
    scope_lock: r.scope_lock ?? {},
    status: r.status,
    current_turn_id: r.current_turn_id ?? null,
    max_rounds: r.max_rounds,
    round_count: r.round_count,
    token_budget: r.token_budget === null || r.token_budget === undefined ? null : Number(r.token_budget),
    token_spent: Number(r.token_spent),
    time_budget_seconds: r.time_budget_seconds ?? null,
    deadline_at: r.deadline_at ?? null,
    terminal_outcome: r.terminal_outcome ?? null,
    decision_required: r.decision_required,
    no_autonomous_merge: r.no_autonomous_merge,
    evidence_pr_ref: r.evidence_pr_ref ?? null,
    evidence_commit_sha: r.evidence_commit_sha ?? null,
    evidence_task_ref: r.evidence_task_ref ?? null,
    evidence_refs: r.evidence_refs ?? null,
    created_at: r.created_at,
    updated_at: r.updated_at,
  };
}

function mapTurn(t) {
  if (!t) return undefined;
  return {
    turn_id: t.turn_id,
    run_id: t.run_id,
    ordinal: t.ordinal,
    expected_responder: t.expected_responder,
    state: t.state,
    bounded_context_ref: t.bounded_context_ref ?? null,
    dispatched_at: t.dispatched_at ?? null,
    lease_deadline_at: t.lease_deadline_at ?? null,
    returned_at: t.returned_at ?? null,
    structured_result: t.structured_result ?? null,
    result_signature: t.result_signature ?? null,
    signer_principal: t.signer_principal ?? null,
    signed_at: t.signed_at ?? null,
    attempt_count: t.attempt_count,
    last_error: t.last_error ?? null,
    created_at: t.created_at,
    updated_at: t.updated_at,
  };
}

function mapEvent(e) {
  if (!e) return undefined;
  return {
    event_id: e.event_id,
    run_id: e.run_id ?? null,
    source: e.source,
    source_event_id: e.source_event_id,
    head_sha: e.head_sha ?? null,
    kind: e.kind,
    payload: e.payload ?? null,
    bound_responder: e.bound_responder ?? null,
    self_generated: e.self_generated,
    processed: e.processed,
    processed_at: e.processed_at ?? null,
    received_at: e.received_at,
    created_at: e.created_at,
  };
}

function mapWrite(w) {
  if (!w) return undefined;
  return {
    write_id: w.write_id,
    mutation_key: w.mutation_key,
    run_id: w.run_id ?? null,
    turn_id: w.turn_id ?? null,
    target_kind: w.target_kind,
    target_id: w.target_id,
    payload_checksum: w.payload_checksum,
    mutation_id: w.mutation_id,
    state: w.state,
    response_id: w.response_id ?? null,
    attempt_count: w.attempt_count,
    last_error: w.last_error ?? null,
    created_at: w.created_at,
    updated_at: w.updated_at,
  };
}

function mapNotification(n) {
  if (!n) return undefined;
  return {
    notification_id: n.notification_id,
    dedup_key: n.dedup_key,
    run_id: n.run_id ?? null,
    recipient: n.recipient,
    logical_source: n.logical_source,
    purpose: n.purpose,
    body: n.body,
    state: n.state,
    provider_message_id: n.provider_message_id ?? null,
    attempt_count: n.attempt_count,
    last_error: n.last_error ?? null,
    created_at: n.created_at,
    updated_at: n.updated_at,
    sent_at: n.sent_at ?? null,
  };
}

/**
 * Async factory. Dynamically imports `pg`, opens a pool with verify-full TLS
 * (pinned CA) for remote Supabase or plaintext for a local throwaway cluster.
 *
 * @param {object} args
 * @param {string} args.connectionString
 * @param {string|null} [args.caFile]  DATABASE_SSL_CA_FILE path (pinned CA)
 * @param {object} [args.poolConfig]
 */
export async function createPostgresStore({ connectionString, caFile = null, poolConfig } = {}) {
  if (typeof connectionString !== 'string' || connectionString.length === 0) {
    throw new Error('createPostgresStore: connectionString required');
  }
  const pgModule = await import('pg');
  const { Pool } = pgModule.default ?? pgModule;
  const ssl = buildSslConfig({ connectionString, caFile });
  const pool = new Pool({ connectionString, ...(ssl === false ? {} : { ssl }), ...poolConfig });

  async function withTx(fn) {
    const client = await pool.connect();
    try {
      await client.query('begin');
      const out = await fn(client);
      await client.query('commit');
      return out;
    } catch (err) {
      try { await client.query('rollback'); } catch { /* ignore */ }
      throw err;
    } finally {
      client.release();
    }
  }

  async function readRun(client, runId) {
    const res = await client.query('select * from ftw.governance_run where run_id = $1', [runId]);
    return mapRun(res.rows[0]);
  }
  async function readTurn(client, turnId) {
    const res = await client.query('select * from ftw.run_turn where turn_id = $1', [turnId]);
    return mapTurn(res.rows[0]);
  }

  const store = {
    async getAgentIdentity(principal) {
      const res = await pool.query('select * from ftw.agent_identity where principal = $1', [principal]);
      return res.rows[0] ?? undefined;
    },
    async listAgentIdentities() {
      const res = await pool.query('select * from ftw.agent_identity order by principal');
      return res.rows;
    },

    async createRun(args = {}, opts) {
      const ts = nowTs(opts);
      const res = await pool.query(
        `insert into ftw.governance_run
           (title, scope, scope_lock, max_rounds, token_budget, time_budget_seconds,
            deadline_at, no_autonomous_merge, evidence_pr_ref, evidence_commit_sha,
            evidence_task_ref, evidence_refs, created_at, updated_at)
         values ($1,$2,$3::jsonb,$4,$5,$6,$7,$8,$9,$10,$11,$12::jsonb,
                 coalesce($13::timestamptz, now()), coalesce($13::timestamptz, now()))
         returning *`,
        [
          args.title ?? 'untitled run',
          args.scope ?? null,
          JSON.stringify(args.scopeLock ?? {}),
          Number.isFinite(args.maxRounds) ? args.maxRounds : 1,
          args.tokenBudget ?? null,
          args.timeBudgetSeconds ?? null,
          args.deadlineAt ?? null,
          args.noAutonomousMerge === false ? false : true,
          args.evidencePrRef ?? null,
          args.evidenceCommitSha ?? null,
          args.evidenceTaskRef ?? null,
          args.evidenceRefs ? JSON.stringify(args.evidenceRefs) : null,
          ts,
        ],
      );
      return mapRun(res.rows[0]);
    },

    async getRun(runId) {
      const res = await pool.query('select * from ftw.governance_run where run_id = $1', [runId]);
      return mapRun(res.rows[0]);
    },
    async listRuns() {
      const res = await pool.query('select * from ftw.governance_run order by created_at');
      return res.rows.map(mapRun);
    },

    async setRunStatus(runId, status, opts = {}) {
      const ts = nowTs(opts);
      return withTx(async (client) => {
        const cur = await readRun(client, runId);
        if (!cur) throw new Error(`setRunStatus: unknown run ${runId}`);
        const terminal = isTerminalRunStatus(status);
        // Guard outcome/status pairing before the transition assert (specific error first).
        if (opts.terminalOutcome && !terminal) {
          throw new Error('setRunStatus: terminal_outcome only allowed on a terminal status');
        }
        assertRunTransition(cur.status, status);
        const res = await client.query(
          `update ftw.governance_run
             set status = $2,
                 terminal_outcome = case when $3 and $4::ftw.run_outcome is not null
                                         then $4::ftw.run_outcome else terminal_outcome end,
                 decision_required = coalesce($5, decision_required),
                 updated_at = coalesce($6::timestamptz, now())
           where run_id = $1
           returning *`,
          [runId, status, terminal, opts.terminalOutcome ?? null,
            opts.decisionRequired ?? null, ts],
        );
        return mapRun(res.rows[0]);
      });
    },

    async incrementRound(runId, opts) {
      const ts = nowTs(opts);
      // The DB CHECK round_count <= max_rounds rejects an over-cap increment.
      const res = await pool.query(
        `update ftw.governance_run
           set round_count = round_count + 1, updated_at = coalesce($2::timestamptz, now())
         where run_id = $1 returning *`,
        [runId, ts],
      );
      if (res.rows.length === 0) throw new Error(`incrementRound: unknown run ${runId}`);
      return mapRun(res.rows[0]);
    },

    async addTokens(runId, n, opts) {
      const ts = nowTs(opts);
      const res = await pool.query(
        `update ftw.governance_run
           set token_spent = token_spent + greatest(0, $2::bigint),
               updated_at = coalesce($3::timestamptz, now())
         where run_id = $1 returning *`,
        [runId, Math.max(0, Number(n) || 0), ts],
      );
      if (res.rows.length === 0) throw new Error(`addTokens: unknown run ${runId}`);
      return mapRun(res.rows[0]);
    },

    async setEvidence(runId, ev = {}, opts) {
      const ts = nowTs(opts);
      const res = await pool.query(
        `update ftw.governance_run
           set evidence_pr_ref = coalesce($2, evidence_pr_ref),
               evidence_commit_sha = coalesce($3, evidence_commit_sha),
               evidence_task_ref = coalesce($4, evidence_task_ref),
               evidence_refs = coalesce($5::jsonb, evidence_refs),
               updated_at = coalesce($6::timestamptz, now())
         where run_id = $1 returning *`,
        [runId, ev.prRef ?? null, ev.commitSha ?? null, ev.taskRef ?? null,
          ev.refs ? JSON.stringify(ev.refs) : null, ts],
      );
      if (res.rows.length === 0) throw new Error(`setEvidence: unknown run ${runId}`);
      return mapRun(res.rows[0]);
    },

    async setCurrentTurn(runId, turnId, opts) {
      const ts = nowTs(opts);
      const res = await pool.query(
        `update ftw.governance_run set current_turn_id = $2, updated_at = coalesce($3::timestamptz, now())
         where run_id = $1 returning *`,
        [runId, turnId, ts],
      );
      if (res.rows.length === 0) throw new Error(`setCurrentTurn: unknown run ${runId}`);
      return mapRun(res.rows[0]);
    },

    // Idempotent per (run_id, ordinal) — ON CONFLICT DO NOTHING then read-back.
    async appendTurn(runId, args = {}, opts) {
      assertValidResponder(args.expectedResponder);
      const ts = nowTs(opts);
      return withTx(async (client) => {
        let ordinal = args.ordinal;
        if (!Number.isFinite(ordinal)) {
          const r = await client.query(
            'select coalesce(max(ordinal),0)+1 as next from ftw.run_turn where run_id = $1',
            [runId],
          );
          ordinal = r.rows[0].next;
        }
        const ins = await client.query(
          `insert into ftw.run_turn
             (run_id, ordinal, expected_responder, bounded_context_ref, created_at, updated_at)
           values ($1,$2,$3,$4::jsonb, coalesce($5::timestamptz, now()), coalesce($5::timestamptz, now()))
           on conflict (run_id, ordinal) do nothing
           returning *`,
          [runId, ordinal, args.expectedResponder,
            args.boundedContextRef ? JSON.stringify(args.boundedContextRef) : null, ts],
        );
        if (ins.rows.length > 0) return mapTurn(ins.rows[0]);
        // Conflict: the logical turn already exists — return it (idempotent).
        const existing = await client.query(
          'select * from ftw.run_turn where run_id = $1 and ordinal = $2',
          [runId, ordinal],
        );
        return mapTurn(existing.rows[0]);
      });
    },

    async getTurn(turnId) {
      const res = await pool.query('select * from ftw.run_turn where turn_id = $1', [turnId]);
      return mapTurn(res.rows[0]);
    },
    async listTurns(runId) {
      const res = await pool.query('select * from ftw.run_turn where run_id = $1 order by ordinal', [runId]);
      return res.rows.map(mapTurn);
    },

    async dispatchTurn(turnId, opts = {}) {
      const ts = nowTs(opts);
      const leaseMs = Number.isFinite(opts.leaseMs) ? opts.leaseMs : WATCHDOG_LEASE_MS;
      return withTx(async (client) => {
        const cur = await readTurn(client, turnId);
        if (!cur) throw new Error(`dispatchTurn: unknown turn ${turnId}`);
        assertTurnTransition(cur.state, TURN_STATE.DISPATCHED);
        const res = await client.query(
          `update ftw.run_turn
             set state = 'dispatched',
                 dispatched_at = coalesce($2::timestamptz, now()),
                 lease_deadline_at = coalesce($2::timestamptz, now()) + ($3::bigint * interval '1 millisecond'),
                 attempt_count = attempt_count + 1,
                 updated_at = coalesce($2::timestamptz, now())
           where turn_id = $1 returning *`,
          [turnId, ts, leaseMs],
        );
        return mapTurn(res.rows[0]);
      });
    },

    // Single-dispatcher claim: oldest pending turn, FOR UPDATE SKIP LOCKED so two
    // dispatchers can never grab the same turn.
    async claimNextPendingTurn(opts = {}) {
      const ts = nowTs(opts);
      const leaseMs = Number.isFinite(opts.leaseMs) ? opts.leaseMs : WATCHDOG_LEASE_MS;
      return withTx(async (client) => {
        const pick = await client.query(
          `select turn_id from ftw.run_turn
             where state = 'pending'
             order by created_at asc
             for update skip locked
             limit 1`,
        );
        if (pick.rows.length === 0) return null;
        const turnId = pick.rows[0].turn_id;
        const res = await client.query(
          `update ftw.run_turn
             set state = 'dispatched',
                 dispatched_at = coalesce($2::timestamptz, now()),
                 lease_deadline_at = coalesce($2::timestamptz, now()) + ($3::bigint * interval '1 millisecond'),
                 attempt_count = attempt_count + 1,
                 updated_at = coalesce($2::timestamptz, now())
           where turn_id = $1 returning *`,
          [turnId, ts, leaseMs],
        );
        return mapTurn(res.rows[0]);
      });
    },

    async recordTurnResult(turnId, args = {}, opts) {
      const ts = nowTs(opts);
      return withTx(async (client) => {
        const cur = await readTurn(client, turnId);
        if (!cur) throw new Error(`recordTurnResult: unknown turn ${turnId}`);
        if (cur.state === TURN_STATE.RETURNED) return cur; // idempotent second return
        assertTurnTransition(cur.state, TURN_STATE.RETURNED);
        assertSignerMatchesResponder(cur.expected_responder, args.signerPrincipal);
        const res = await client.query(
          `update ftw.run_turn
             set state = 'returned',
                 structured_result = $2::jsonb,
                 result_signature = $3,
                 signer_principal = $4,
                 signed_at = coalesce($5::timestamptz, now()),
                 returned_at = coalesce($5::timestamptz, now()),
                 updated_at = coalesce($5::timestamptz, now())
           where turn_id = $1 returning *`,
          [turnId, args.structuredResult ? JSON.stringify(args.structuredResult) : null,
            args.resultSignature ?? null, args.signerPrincipal ?? null, ts],
        );
        return mapTurn(res.rows[0]);
      });
    },

    async recordTurnFailure(turnId, args = {}, opts) {
      const ts = nowTs(opts);
      return withTx(async (client) => {
        const cur = await readTurn(client, turnId);
        if (!cur) throw new Error(`recordTurnFailure: unknown turn ${turnId}`);
        assertTurnTransition(cur.state, TURN_STATE.FAILED);
        const res = await client.query(
          `update ftw.run_turn
             set state = 'failed', last_error = $2, updated_at = coalesce($3::timestamptz, now())
           where turn_id = $1 returning *`,
          [turnId, args.error ?? null, ts],
        );
        return mapTurn(res.rows[0]);
      });
    },

    // Ingest with primary (source, source_event_id) DO NOTHING + secondary
    // (source, head_sha, kind) partial-unique. Returns { event, isNew }.
    async ingestEvent(args = {}, opts) {
      const source = args.source;
      const sourceEventId = args.sourceEventId;
      if (!source || !sourceEventId) {
        throw new Error('ingestEvent: source and sourceEventId are required');
      }
      const ts = nowTs(opts);
      const selfGenerated = args.selfGenerated === true || source === 'tower';
      try {
        const ins = await pool.query(
          `insert into ftw.run_event
             (run_id, source, source_event_id, head_sha, kind, payload,
              bound_responder, self_generated, received_at, created_at)
           values ($1,$2,$3,$4,$5,$6::jsonb,$7,$8,
                   coalesce($9::timestamptz, now()), coalesce($9::timestamptz, now()))
           on conflict (source, source_event_id) do nothing
           returning *`,
          [args.runId ?? null, source, sourceEventId, args.headSha ?? null,
            args.kind ?? 'unknown', args.payload ? JSON.stringify(args.payload) : null,
            args.boundResponder ?? null, selfGenerated, ts],
        );
        if (ins.rows.length > 0) return { event: mapEvent(ins.rows[0]), isNew: true };
        // Primary conflict — read the existing row.
        const existing = await pool.query(
          'select * from ftw.run_event where source = $1 and source_event_id = $2',
          [source, sourceEventId],
        );
        return { event: mapEvent(existing.rows[0]), isNew: false };
      } catch (err) {
        // Secondary partial-unique (source, head_sha, kind) violation: a different
        // native id for the same head-sha/kind. Treat as a dedup no-op.
        if (err && err.code === '23505') {
          const existing = await pool.query(
            `select * from ftw.run_event
               where source = $1 and head_sha = $2 and kind = $3 limit 1`,
            [source, args.headSha ?? null, args.kind ?? 'unknown'],
          );
          return { event: mapEvent(existing.rows[0]), isNew: false };
        }
        throw err;
      }
    },

    async getEvent(eventId) {
      const res = await pool.query('select * from ftw.run_event where event_id = $1', [eventId]);
      return mapEvent(res.rows[0]);
    },
    async listEvents(runId) {
      const res = runId === undefined
        ? await pool.query('select * from ftw.run_event order by received_at')
        : await pool.query('select * from ftw.run_event where run_id = $1 order by received_at', [runId]);
      return res.rows.map(mapEvent);
    },

    // Advance-once claim: oldest unprocessed, non-self event. FOR UPDATE SKIP
    // LOCKED so a concurrent advance never double-consumes.
    async claimNextEvent(opts = {}) {
      return withTx(async (client) => {
        const runFilter = opts.runId ? 'and (run_id = $1 or run_id is null)' : '';
        const params = opts.runId ? [opts.runId] : [];
        const res = await client.query(
          `select * from ftw.run_event
             where processed = false and self_generated = false and source <> 'tower' ${runFilter}
             order by received_at asc
             for update skip locked
             limit 1`,
          params,
        );
        return res.rows.length > 0 ? mapEvent(res.rows[0]) : null;
      });
    },

    async bindEvent(eventId, runId, boundResponder, opts) {
      const res = await pool.query(
        `update ftw.run_event
           set run_id = coalesce($2, run_id), bound_responder = coalesce($3, bound_responder)
         where event_id = $1 returning *`,
        [eventId, runId ?? null, boundResponder ?? null],
      );
      if (res.rows.length === 0) throw new Error(`bindEvent: unknown event ${eventId}`);
      return mapEvent(res.rows[0]);
    },

    async markEventProcessed(eventId, opts) {
      const ts = nowTs(opts);
      const res = await pool.query(
        `update ftw.run_event
           set processed = true, processed_at = coalesce($2::timestamptz, now())
         where event_id = $1 and processed = false
         returning *`,
        [eventId, ts],
      );
      if (res.rows.length > 0) return mapEvent(res.rows[0]);
      // Already processed (idempotent) — read back.
      const cur = await pool.query('select * from ftw.run_event where event_id = $1', [eventId]);
      if (cur.rows.length === 0) throw new Error(`markEventProcessed: unknown event ${eventId}`);
      return mapEvent(cur.rows[0]);
    },

    // Watchdog: dispatched turns whose lease expired -> timed_out. Index-driven,
    // idempotent, never clobbers a returned turn (only touches 'dispatched').
    async watchdogSweep(opts = {}) {
      const ts = nowTs(opts);
      const res = await pool.query(
        `update ftw.run_turn
           set state = 'timed_out', updated_at = coalesce($1::timestamptz, now())
         where state = 'dispatched'
           and lease_deadline_at <= coalesce($1::timestamptz, now())
         returning turn_id`,
        [ts],
      );
      return { reaped: res.rows.length, turnIds: res.rows.map((r) => r.turn_id) };
    },

    // ---- external write outbox (GPT MEDIUM-1) --------------------------------
    // Durable, restart-safe idempotency for the ClickUp review write. The write is
    // CLAIMED (reserved) BEFORE any remote post; a redelivery/restart/retry collides
    // on the per-mutation key and reads back the existing row + its current state.

    // Reserve the per-mutation key BEFORE posting. INSERT ... ON CONFLICT
    // (mutation_key) DO NOTHING, then read back the existing row on conflict — the
    // same proven pattern as appendTurn (ON CONFLICT DO NOTHING waits out a
    // concurrent uncommitted insert, so the read-back always sees the winner).
    // Returns { claimed:true, write } if newly reserved (state 'applying'), or
    // { claimed:false, write } with the EXISTING row so the caller sees its state.
    async claimWrite(args = {}, opts) {
      const {
        mutationKey, runId, turnId, targetKind, targetId, payloadChecksum, mutationId,
      } = args;
      if (!mutationKey) throw new Error('claimWrite: mutationKey required');
      if (!targetKind) throw new Error('claimWrite: targetKind required');
      if (!targetId) throw new Error('claimWrite: targetId required');
      if (!payloadChecksum) throw new Error('claimWrite: payloadChecksum required');
      if (!mutationId) throw new Error('claimWrite: mutationId required');
      const ts = nowTs(opts);
      return withTx(async (client) => {
        const ins = await client.query(
          `insert into ftw.external_write
             (mutation_key, run_id, turn_id, target_kind, target_id, payload_checksum,
              mutation_id, created_at, updated_at)
           values ($1,$2,$3,$4,$5,$6,$7,
                   coalesce($8::timestamptz, now()), coalesce($8::timestamptz, now()))
           on conflict (mutation_key) do nothing
           returning *`,
          [mutationKey, runId ?? null, turnId ?? null, targetKind, targetId,
            payloadChecksum, mutationId, ts],
        );
        if (ins.rows.length > 0) return { claimed: true, write: mapWrite(ins.rows[0]) };
        // Conflict: the mutation was already claimed — return the existing row so the
        // caller can inspect its state (e.g. applied_verified => do NOT re-post).
        const existing = await client.query(
          'select * from ftw.external_write where mutation_key = $1 for share',
          [mutationKey],
        );
        return { claimed: false, write: mapWrite(existing.rows[0]) };
      });
    },

    // Verify a write. REQUIRES a non-empty responseId (the real comment id): the
    // store throws if it is missing, and the DB CHECK
    // external_write_applied_requires_response_chk is the second, independent gate —
    // applied_verified can NEVER be reached without a response id.
    async markWriteApplied(mutationKey, responseId, opts) {
      if (!mutationKey) throw new Error('markWriteApplied: mutationKey required');
      if (typeof responseId !== 'string' || responseId.length === 0) {
        throw new Error(
          'markWriteApplied: a non-empty responseId (comment id) is REQUIRED — a '
          + 'response without a comment id can never be applied_verified (GPT MEDIUM-1)',
        );
      }
      const ts = nowTs(opts);
      const res = await pool.query(
        `update ftw.external_write
           set state = 'applied_verified',
               response_id = $2,
               updated_at = coalesce($3::timestamptz, now())
         where mutation_key = $1 returning *`,
        [mutationKey, responseId, ts],
      );
      if (res.rows.length === 0) throw new Error(`markWriteApplied: unknown mutation_key ${mutationKey}`);
      return mapWrite(res.rows[0]);
    },

    async markWriteOutcomeUnknown(mutationKey, err, opts) {
      return this._markWriteState(mutationKey, WRITE_STATE.OUTCOME_UNKNOWN, err, opts,
        'markWriteOutcomeUnknown');
    },
    async markWriteRetryPending(mutationKey, err, opts) {
      return this._markWriteState(mutationKey, WRITE_STATE.RETRY_PENDING, err, opts,
        'markWriteRetryPending');
    },
    async markWriteFailed(mutationKey, err, opts) {
      return this._markWriteState(mutationKey, WRITE_STATE.FAILED, err, opts,
        'markWriteFailed');
    },

    // Shared error-transition: set state + attempt_count++ + last_error. attempt_count
    // is bumped atomically in SQL, so no read-modify-write (and no FOR UPDATE) is
    // needed here.
    async _markWriteState(mutationKey, state, err, opts, label) {
      if (!mutationKey) throw new Error(`${label}: mutationKey required`);
      const ts = nowTs(opts);
      const lastError = err == null ? null : (err.message ?? String(err));
      const res = await pool.query(
        `update ftw.external_write
           set state = $2::ftw.write_state,
               attempt_count = attempt_count + 1,
               last_error = $3,
               updated_at = coalesce($4::timestamptz, now())
         where mutation_key = $1 returning *`,
        [mutationKey, state, lastError, ts],
      );
      if (res.rows.length === 0) throw new Error(`${label}: unknown mutation_key ${mutationKey}`);
      return mapWrite(res.rows[0]);
    },

    async getWrite(mutationKey) {
      const res = await pool.query(
        'select * from ftw.external_write where mutation_key = $1', [mutationKey],
      );
      return mapWrite(res.rows[0]) ?? null;
    },

    // ---- Telegram notification outbox (BUILD-010 WP1) ------------------------
    // Durable, restart-safe, deduplicated notification queue. A notification is
    // ENQUEUED (reserved) idempotently on its per-EVENT dedup key BEFORE any bot send;
    // a redelivery/restart/retry collides on the dedup_key and is a no-op read-back.
    // A temporary Telegram outage can never lose a decision request / terminal outcome
    // / blocker / READY.

    // Reserve the dedup key. INSERT ... ON CONFLICT (dedup_key) DO NOTHING then
    // read-back — the same proven pattern as appendTurn/claimWrite. Returns
    // { enqueued:true, notification } when newly reserved (state 'pending'), or
    // { enqueued:false, notification } with the EXISTING row when a duplicate
    // run+event+recipient+purpose was already enqueued (so it never double-sends).
    async enqueueNotification(args = {}, opts) {
      const {
        dedupKey, runId, recipient, logicalSource, purpose, body,
      } = args;
      if (!dedupKey) throw new Error('enqueueNotification: dedupKey required');
      if (!recipient) throw new Error('enqueueNotification: recipient (chat id) required');
      if (!logicalSource) throw new Error('enqueueNotification: logicalSource required');
      if (!purpose) throw new Error('enqueueNotification: purpose required');
      if (typeof body !== 'string' || body.length === 0) {
        throw new Error('enqueueNotification: non-empty body required');
      }
      const ts = nowTs(opts);
      return withTx(async (client) => {
        const ins = await client.query(
          `insert into ftw.notification_outbox
             (dedup_key, run_id, recipient, logical_source, purpose, body,
              created_at, updated_at)
           values ($1,$2,$3,$4,$5,$6,
                   coalesce($7::timestamptz, now()), coalesce($7::timestamptz, now()))
           on conflict (dedup_key) do nothing
           returning *`,
          [dedupKey, runId ?? null, recipient, logicalSource, purpose, body, ts],
        );
        if (ins.rows.length > 0) return { enqueued: true, notification: mapNotification(ins.rows[0]) };
        // Conflict: the (run, event, recipient, purpose) was already enqueued — return
        // the existing row so the caller sees its current state (never re-sends).
        const existing = await client.query(
          'select * from ftw.notification_outbox where dedup_key = $1 for share',
          [dedupKey],
        );
        return { enqueued: false, notification: mapNotification(existing.rows[0]) };
      });
    },

    // Mark delivered. REQUIRES a non-empty providerMessageId (the real Telegram
    // message_id): the store throws if it is missing, and the DB CHECK
    // notification_outbox_sent_requires_provider_chk is the second, independent gate —
    // 'sent' can NEVER be reached without a provider_message_id.
    async markNotificationSent(dedupKey, providerMessageId, opts) {
      if (!dedupKey) throw new Error('markNotificationSent: dedupKey required');
      if (typeof providerMessageId !== 'string' || providerMessageId.length === 0) {
        throw new Error(
          'markNotificationSent: a non-empty providerMessageId (Telegram message_id) '
          + 'is REQUIRED — a send without a message_id can never be recorded as sent',
        );
      }
      const ts = nowTs(opts);
      const res = await pool.query(
        `update ftw.notification_outbox
           set state = 'sent',
               provider_message_id = $2,
               sent_at = coalesce($3::timestamptz, now()),
               updated_at = coalesce($3::timestamptz, now())
         where dedup_key = $1 returning *`,
        [dedupKey, providerMessageId, ts],
      );
      if (res.rows.length === 0) throw new Error(`markNotificationSent: unknown dedup_key ${dedupKey}`);
      return mapNotification(res.rows[0]);
    },

    async markNotificationFailed(dedupKey, err, opts) {
      return this._markNotificationState(dedupKey, NOTIFICATION_STATE.FAILED, err, opts,
        'markNotificationFailed');
    },
    async markNotificationSuperseded(dedupKey, opts) {
      return this._markNotificationState(dedupKey, NOTIFICATION_STATE.SUPERSEDED, null, opts,
        'markNotificationSuperseded');
    },

    // Shared error/retire transition: set state + attempt_count++ + last_error.
    // attempt_count is bumped atomically in SQL (no read-modify-write).
    async _markNotificationState(dedupKey, state, err, opts, label) {
      if (!dedupKey) throw new Error(`${label}: dedupKey required`);
      const ts = nowTs(opts);
      const lastError = err == null ? null : (err.message ?? String(err));
      const res = await pool.query(
        `update ftw.notification_outbox
           set state = $2::ftw.notification_state,
               attempt_count = attempt_count + 1,
               last_error = coalesce($3, last_error),
               updated_at = coalesce($4::timestamptz, now())
         where dedup_key = $1 returning *`,
        [dedupKey, state, lastError, ts],
      );
      if (res.rows.length === 0) throw new Error(`${label}: unknown dedup_key ${dedupKey}`);
      return mapNotification(res.rows[0]);
    },

    // Drainer claim: the pending backlog, oldest first, FOR UPDATE SKIP LOCKED so two
    // drainers never grab the same notification. Returns only pending rows.
    async claimPendingNotifications(limit = 10, opts = {}) {
      const lim = Number.isFinite(limit) && limit > 0 ? Math.floor(limit) : 10;
      return withTx(async (client) => {
        const res = await client.query(
          `select * from ftw.notification_outbox
             where state = 'pending'
             order by created_at asc
             for update skip locked
             limit $1`,
          [lim],
        );
        return res.rows.map(mapNotification);
      });
    },

    async getNotification(dedupKey) {
      const res = await pool.query(
        'select * from ftw.notification_outbox where dedup_key = $1', [dedupKey],
      );
      return mapNotification(res.rows[0]) ?? null;
    },

    async end() { await pool.end(); },
  };

  return store;
}
