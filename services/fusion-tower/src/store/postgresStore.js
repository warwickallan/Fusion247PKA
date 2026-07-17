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

    async end() { await pool.end(); },
  };

  return store;
}
