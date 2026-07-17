// Operational store — REAL Postgres/Supabase-backed implementation.
//
// Satisfies the SAME OperationalStore surface as
// src/store/operationalStore.js (the in-memory fixture) so it drops in behind
// the identical caller contract. Everything the fixture holds in two Maps this
// implementation holds in the fcg.* schema (migrations 0001..0004).
//
// HARD BOUNDARY (source-of-truth matrix §3): OPERATIONAL ONLY. Envelopes,
// queue/processing state, idempotency keys, and evidence POINTERS — never the
// canonical knowledge. Markdown stays canonical.
//
// CI-SAFETY (critical): `pg` is imported DYNAMICALLY inside the async factory,
// never at module top-level. Loading this module does NOT require `pg` or a
// database; only calling createPostgresOperationalStore() does. The unit suite
// (node --test, no DATABASE_URL) therefore never touches pg or a DB.
//
// Determinism: `now` (epoch ms) is injectable on every method exactly like the
// fixture, so tests are reproducible. When `now` is omitted, the database's own
// now() is used (production path).

import {
  STATES,
  CLAIMABLE_STATES,
  MAX_DELIVERY_ATTEMPTS,
  assertTransition,
} from '../core/states.js';

// The reusable projection that shapes a stored capture back into the record
// surface callers expect from the fixture (epoch-ms time fields, evidence array,
// destination pointer). Kept identical between reads and post-write re-selects.
const RECORD_SELECT = `
  select
    ce.capture_id,
    ik.idempotency_key,
    ce.source_channel,
    ce.sender_identity_ref,
    ce.recorded_intent,
    ce.technical_source_type,
    ce.text_preview,
    ps.state,
    (extract(epoch from ce.received_at) * 1000)::bigint      as received_at_ms,
    (extract(epoch from ps.updated_at) * 1000)::bigint       as updated_at_ms,
    ps.claimed_by,
    (extract(epoch from ps.lease_expires_at) * 1000)::bigint as lease_expires_at_ms,
    ps.attempt_count,
    (extract(epoch from ps.next_attempt_at) * 1000)::bigint  as next_attempt_at_ms,
    ps.last_error,
    ps.destination_ref,
    ps.card_ref,
    coalesce(ev.pointers, '[]'::json)                        as evidence_pointers
  from fcg.capture_envelope ce
  join fcg.processing_state ps on ps.capture_id = ce.capture_id
  left join fcg.idempotency_key ik on ik.capture_id = ce.capture_id
  left join lateral (
    select json_agg(
      json_build_object(
        'evidence_kind', e.evidence_kind,
        'target_ref',    e.target_ref,
        'created_at_ms', (extract(epoch from e.created_at) * 1000)::bigint
      ) order by e.created_at
    ) as pointers
    from fcg.evidence_pointer e
    where e.capture_id = ce.capture_id
  ) ev on true
`;

// int8/bigint arrives from pg as a string; normalise the epoch-ms fields to
// numbers (or null) so the record shape matches the fixture exactly.
function toMs(v) {
  if (v === null || v === undefined) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function mapRow(row) {
  if (!row) return undefined;
  return {
    capture_id: row.capture_id,
    idempotency_key: row.idempotency_key ?? null,
    source_channel: row.source_channel ?? null,
    sender_identity_ref: row.sender_identity_ref ?? null,
    recorded_intent: row.recorded_intent ?? null,
    technical_source_type: row.technical_source_type ?? null,
    text_preview: row.text_preview ?? null,
    state: row.state,
    received_at_ms: toMs(row.received_at_ms),
    updated_at_ms: toMs(row.updated_at_ms),
    claimed_by: row.claimed_by ?? null,
    lease_expires_at_ms: toMs(row.lease_expires_at_ms),
    attempt_count: row.attempt_count,
    next_attempt_at_ms: toMs(row.next_attempt_at_ms),
    last_error: row.last_error ?? null,
    destination_ref: row.destination_ref ?? null,
    card_ref: row.card_ref ?? null,
    evidence_pointers: (row.evidence_pointers ?? []).map((e) => ({ ...e })),
  };
}

// Injectable-now as a timestamptz bind. A finite epoch-ms `now` becomes a Date
// (bound as timestamptz); otherwise null, and every query coalesces null to the
// database's own now() — the production path.
function nowTs(opts) {
  const now = opts?.now;
  return typeof now === 'number' && Number.isFinite(now) ? new Date(now) : null;
}

// A finite epoch-ms value -> Date bind (or null). Used for lease / next_attempt.
function msToTs(ms) {
  return typeof ms === 'number' && Number.isFinite(ms) ? new Date(ms) : null;
}

/**
 * Async factory. Dynamically imports `pg`, opens a connection pool against
 * `connectionString`, and returns an object satisfying the OperationalStore
 * interface. Call `store.end()` to close the pool (tests / graceful shutdown).
 *
 * @param {object} args
 * @param {string} args.connectionString  postgres:// connection string.
 * @param {number} [args.now]  ignored here; per-call `now` is the injection seam.
 * @param {object} [args.poolConfig]  extra node-postgres Pool options.
 */
export async function createPostgresOperationalStore({ connectionString, poolConfig } = {}) {
  if (typeof connectionString !== 'string' || connectionString.length === 0) {
    throw new Error('createPostgresOperationalStore: connectionString required');
  }
  // DYNAMIC import — never loaded by the unit suite.
  const pgModule = await import('pg');
  const { Pool } = pgModule.default ?? pgModule;
  const pool = new Pool({ connectionString, ...poolConfig });

  async function loadByCaptureId(client, captureId) {
    const res = await client.query(`${RECORD_SELECT} where ce.capture_id = $1`, [captureId]);
    return mapRow(res.rows[0]);
  }

  async function withTx(fn) {
    const client = await pool.connect();
    try {
      await client.query('begin');
      const out = await fn(client);
      await client.query('commit');
      return out;
    } catch (err) {
      try { await client.query('rollback'); } catch { /* ignore rollback error */ }
      throw err;
    } finally {
      client.release();
    }
  }

  // Fetch just the queue/state row fields needed to assert a legal transition.
  async function currentState(client, captureId) {
    const res = await client.query(
      `select state, destination_ref, attempt_count,
              (select count(*) from fcg.evidence_pointer e where e.capture_id = ps.capture_id) as evidence_count
         from fcg.processing_state ps where ps.capture_id = $1`,
      [captureId],
    );
    if (res.rows.length === 0) {
      throw new Error(`postgresOperationalStore: unknown capture_id "${captureId}"`);
    }
    return res.rows[0];
  }

  const store = {
    async recordIntake(envelope, opts) {
      if (!envelope || typeof envelope !== 'object') {
        throw new Error('recordIntake: envelope object required');
      }
      const { idempotency_key: key, capture_id: captureId } = envelope;
      if (typeof key !== 'string' || key.length === 0) {
        throw new Error('recordIntake: envelope.idempotency_key required');
      }
      if (typeof captureId !== 'string' || captureId.length === 0) {
        throw new Error('recordIntake: envelope.capture_id required');
      }
      const ts = nowTs(opts);

      return withTx(async (client) => {
        // Idempotency commit point: is this key already known? Lock the row if so
        // to serialise a concurrent re-delivery.
        const existing = await client.query(
          'select capture_id from fcg.idempotency_key where idempotency_key = $1 for update',
          [key],
        );
        if (existing.rows.length > 0) {
          const record = await loadByCaptureId(client, existing.rows[0].capture_id);
          return { record, isNew: false };
        }

        // New capture. Ensure the FK-referenced channel identity exists (intake
        // registers the authorised principal). Upsert keeps this idempotent.
        const principalRef = envelope.channel_principal_ref
          ?? envelope.sender_identity_ref
          ?? captureId;
        await client.query(
          `insert into fcg.channel_identity
             (identity_ref, channel, channel_principal_ref, is_authorised)
           values ($1, $2, $3, $4)
           on conflict (identity_ref) do nothing`,
          [
            envelope.sender_identity_ref ?? `identity:${captureId}`,
            envelope.source_channel ?? 'other',
            principalRef,
            envelope.is_authorised === true,
          ],
        );

        await client.query(
          `insert into fcg.capture_envelope
             (capture_id, source_channel, sender_identity_ref, recorded_intent,
              technical_source_type, payload_text, text_preview, captured_at, received_at)
           values ($1, $2, $3, $4, $5, $6, $7,
                   coalesce($8::timestamptz, now()), coalesce($8::timestamptz, now()))`,
          [
            captureId,
            envelope.source_channel ?? 'other',
            envelope.sender_identity_ref ?? `identity:${captureId}`,
            envelope.recorded_intent ?? 'SaveToBrain',
            envelope.technical_source_type ?? 'text',
            envelope.payload_text ?? null,
            envelope.text_preview ?? null,
            ts,
          ],
        );

        await client.query(
          `insert into fcg.processing_state (capture_id, state, updated_at)
           values ($1, $2, coalesce($3::timestamptz, now()))`,
          [captureId, STATES.ACCEPTED, ts],
        );

        // The durable idempotency commit. ON CONFLICT DO NOTHING is the
        // concurrency backstop: if a rival txn inserted the same key between our
        // check and here, we lose the race, return their record, isNew=false.
        const ins = await client.query(
          `insert into fcg.idempotency_key (idempotency_key, capture_id)
           values ($1, $2)
           on conflict (idempotency_key) do nothing
           returning capture_id`,
          [key, captureId],
        );
        if (ins.rows.length === 0) {
          // Rival won. Roll back our envelope/state by throwing to abort the tx,
          // then the caller re-reads via a fresh recordIntake; simpler: read the
          // winner within a nested savepoint is overkill for WP0 — abort + retry.
          const err = new Error('recordIntake: idempotency race');
          err.code = 'FCG_IDEMPOTENCY_RACE';
          throw err;
        }

        const record = await loadByCaptureId(client, captureId);
        return { record, isNew: true };
      }).catch(async (err) => {
        if (err && err.code === 'FCG_IDEMPOTENCY_RACE') {
          // The rival committed; a plain read now returns their record.
          const record = await store.getByIdempotencyKey(key);
          return { record, isNew: false };
        }
        throw err;
      });
    },

    async getByCaptureId(captureId) {
      const res = await pool.query(`${RECORD_SELECT} where ce.capture_id = $1`, [captureId]);
      return mapRow(res.rows[0]);
    },

    async getByIdempotencyKey(key) {
      const res = await pool.query(
        `${RECORD_SELECT} where ce.capture_id =
           (select capture_id from fcg.idempotency_key where idempotency_key = $1)`,
        [key],
      );
      return mapRow(res.rows[0]);
    },

    async enqueue(captureId, opts) {
      // TAP-GATE (store-enforced 2026-07-17, mirroring the in-memory fixture):
      // `accepted` awaits the human's tap; only intake.confirmSave() may move it,
      // and it must say so explicitly. Fail-closed before any SQL runs.
      if (opts?.confirmedByTap !== true) {
        throw new Error(
          'enqueue: tap-gate violation — an accepted capture leaves `accepted` only via '
          + 'intake.confirmSave() on a user tap (caller must pass confirmedByTap: true)',
        );
      }
      const offline = opts?.offline === true;
      const to = offline ? STATES.OFFLINE_QUEUED : STATES.QUEUED;
      const ts = nowTs(opts);
      return withTx(async (client) => {
        const cur = await currentState(client, captureId);
        assertTransition(cur.state, to);
        await client.query(
          `update fcg.processing_state
             set state = $2, updated_at = coalesce($3::timestamptz, now())
           where capture_id = $1`,
          [captureId, to, ts],
        );
        return loadByCaptureId(client, captureId);
      });
    },

    /**
     * Transactional, conditional, oldest-first claim with SKIP LOCKED. Two
     * concurrent workers cannot double-claim: the FOR UPDATE SKIP LOCKED SELECT
     * hands each a DIFFERENT unlocked candidate (or none).
     */
    async claim(workerId, leaseMs, opts) {
      if (typeof workerId !== 'string' || workerId.length === 0) {
        throw new Error('claim: workerId required');
      }
      if (typeof leaseMs !== 'number' || leaseMs <= 0) {
        throw new Error('claim: positive leaseMs required');
      }
      const ts = nowTs(opts);
      return withTx(async (client) => {
        // $1 = now (coalesced to db now()), $2 = MAX_DELIVERY_ATTEMPTS.
        // Claimable = fresh queue item, OR expired claim, OR due retry under cap.
        const pick = await client.query(
          `select ps.capture_id
             from fcg.processing_state ps
             join fcg.capture_envelope ce on ce.capture_id = ps.capture_id
            where (
                    ps.state = any($3::fcg.capture_processing_state[])
                 or (ps.state = 'claimed'
                     and ps.lease_expires_at is not null
                     and ps.lease_expires_at <= coalesce($1::timestamptz, now()))
                 or (ps.state in ('failed', 'partial')
                     and ps.next_attempt_at is not null
                     and ps.next_attempt_at <= coalesce($1::timestamptz, now())
                     and ps.attempt_count < $2)
                  )
            order by ce.received_at asc, ce.created_at asc
            for update of ps skip locked
            limit 1`,
          [ts, MAX_DELIVERY_ATTEMPTS, CLAIMABLE_STATES],
        );
        if (pick.rows.length === 0) return null;
        const captureId = pick.rows[0].capture_id;

        await client.query(
          `update fcg.processing_state
             set state = 'claimed',
                 claimed_by = $2,
                 claimed_at = coalesce($3::timestamptz, now()),
                 lease_expires_at = coalesce($3::timestamptz, now()) + ($4::bigint * interval '1 millisecond'),
                 attempt_count = attempt_count + 1,
                 next_attempt_at = null,
                 updated_at = coalesce($3::timestamptz, now())
           where capture_id = $1`,
          [captureId, workerId, ts, leaseMs],
        );
        return loadByCaptureId(client, captureId);
      });
    },

    async transition(captureId, toState, opts) {
      const ts = nowTs(opts);
      return withTx(async (client) => {
        const cur = await currentState(client, captureId);
        assertTransition(cur.state, toState);
        const clearLease = toState === STATES.QUEUED || toState === STATES.OFFLINE_QUEUED;
        await client.query(
          `update fcg.processing_state
             set state = $2,
                 updated_at = coalesce($3::timestamptz, now()),
                 claimed_by = case when $4 then null else claimed_by end,
                 lease_expires_at = case when $4 then null else lease_expires_at end
           where capture_id = $1`,
          [captureId, toState, ts, clearLease],
        );
        return loadByCaptureId(client, captureId);
      });
    },

    async recordDestination(captureId, destinationRef, opts) {
      if (!destinationRef || typeof destinationRef !== 'object') {
        throw new Error('recordDestination: destinationRef object required');
      }
      const ts = nowTs(opts);
      return withTx(async (client) => {
        await currentState(client, captureId); // existence check
        await client.query(
          `update fcg.processing_state
             set destination_ref = $2::jsonb, updated_at = coalesce($3::timestamptz, now())
           where capture_id = $1`,
          [captureId, JSON.stringify(destinationRef), ts],
        );
        return loadByCaptureId(client, captureId);
      });
    },

    /**
     * Persist the durable channel card target (§4): {chat_id, message_id} of the
     * card message, so a restarted worker re-targets editCard from durable state.
     */
    async recordCardRef(captureId, cardRef, opts) {
      if (!cardRef || typeof cardRef !== 'object'
        || cardRef.chat_id === undefined || cardRef.message_id === undefined) {
        throw new Error('recordCardRef: cardRef { chat_id, message_id } required');
      }
      const ts = nowTs(opts);
      return withTx(async (client) => {
        await currentState(client, captureId); // existence check
        await client.query(
          `update fcg.processing_state
             set card_ref = $2::jsonb, updated_at = coalesce($3::timestamptz, now())
           where capture_id = $1`,
          [captureId, JSON.stringify({ chat_id: cardRef.chat_id, message_id: cardRef.message_id }), ts],
        );
        return loadByCaptureId(client, captureId);
      });
    },

    /** Reverse lookup: which capture owns the card at (chat_id, message_id)? */
    async findCaptureIdByCard(chatId, messageId) {
      const res = await pool.query(
        `select capture_id from fcg.processing_state
           where card_ref->>'chat_id' = $1 and card_ref->>'message_id' = $2
           order by updated_at asc
           limit 1`,
        [String(chatId), String(messageId)],
      );
      return res.rows[0]?.capture_id;
    },

    /** Read the durable long-poll offset for a channel (default 0 when unset). */
    async getPollOffset(channel) {
      const res = await pool.query(
        'select offset_value from fcg.channel_poll_offset where channel = $1',
        [String(channel)],
      );
      return res.rows.length > 0 ? Number(res.rows[0].offset_value) : 0;
    },

    /**
     * Advance the durable long-poll offset for a channel. Monotonic: the upsert
     * uses greatest(existing, new) so a re-fetched batch can never rewind
     * acknowledged progress.
     */
    async setPollOffset(channel, offsetValue, opts) {
      const next = Number(offsetValue);
      if (!Number.isFinite(next)) throw new Error('setPollOffset: numeric offsetValue required');
      const ts = nowTs(opts);
      const res = await pool.query(
        `insert into fcg.channel_poll_offset (channel, offset_value, updated_at)
         values ($1, $2, coalesce($3::timestamptz, now()))
         on conflict (channel) do update
           set offset_value = greatest(fcg.channel_poll_offset.offset_value, excluded.offset_value),
               updated_at = coalesce($3::timestamptz, now())
         returning channel, offset_value`,
        [String(channel), next, ts],
      );
      return { channel: res.rows[0].channel, offset_value: Number(res.rows[0].offset_value) };
    },

    async recordEvidence(captureId, evidencePointer, opts) {
      if (!evidencePointer || typeof evidencePointer !== 'object') {
        throw new Error('recordEvidence: evidencePointer object required');
      }
      const { evidence_kind: kind, target_ref: target } = evidencePointer;
      if (typeof kind !== 'string' || typeof target !== 'string') {
        throw new Error('recordEvidence: evidence_kind and target_ref (strings) required');
      }
      const ts = nowTs(opts);
      return withTx(async (client) => {
        await currentState(client, captureId);
        // Idempotent on (capture_id, evidence_kind, target_ref) — the unique
        // constraint from 0001 backs ON CONFLICT DO NOTHING.
        await client.query(
          `insert into fcg.evidence_pointer (capture_id, evidence_kind, target_ref, created_at)
           values ($1, $2, $3, coalesce($4::timestamptz, now()))
           on conflict (capture_id, evidence_kind, target_ref) do nothing`,
          [captureId, kind, target, ts],
        );
        await client.query(
          `update fcg.processing_state set updated_at = coalesce($2::timestamptz, now())
           where capture_id = $1`,
          [captureId, ts],
        );
        return loadByCaptureId(client, captureId);
      });
    },

    async complete(captureId, opts) {
      const ts = nowTs(opts);
      return withTx(async (client) => {
        const cur = await currentState(client, captureId);
        if (cur.state !== STATES.EVIDENCED) {
          throw new Error(`complete: capture "${captureId}" is "${cur.state}", must be "evidenced" first`);
        }
        if (!cur.destination_ref) {
          throw new Error(`complete: capture "${captureId}" has no destination pointer`);
        }
        if (Number(cur.evidence_count) === 0) {
          throw new Error(`complete: capture "${captureId}" has no evidence pointer`);
        }
        assertTransition(cur.state, STATES.COMPLETED);
        await client.query(
          `update fcg.processing_state
             set state = 'completed', updated_at = coalesce($2::timestamptz, now())
           where capture_id = $1`,
          [captureId, ts],
        );
        return loadByCaptureId(client, captureId);
      });
    },

    async recordFailure(captureId, opts) {
      const ts = nowTs(opts);
      const nextTs = msToTs(opts?.nextAttemptAtMs);
      return withTx(async (client) => {
        const cur = await currentState(client, captureId);
        assertTransition(cur.state, STATES.FAILED);
        await client.query(
          `update fcg.processing_state
             set state = 'failed',
                 last_error = coalesce($2, last_error),
                 next_attempt_at = $3::timestamptz,
                 updated_at = coalesce($4::timestamptz, now())
           where capture_id = $1`,
          [captureId, opts?.error ?? null, nextTs, ts],
        );
        return loadByCaptureId(client, captureId);
      });
    },

    async deadLetter(captureId, opts) {
      const ts = nowTs(opts);
      return withTx(async (client) => {
        const cur = await currentState(client, captureId);
        assertTransition(cur.state, STATES.DEAD_LETTER);
        await client.query(
          `update fcg.processing_state
             set state = 'dead_letter',
                 last_error = coalesce($2, last_error),
                 updated_at = coalesce($3::timestamptz, now())
           where capture_id = $1`,
          [captureId, opts?.error ?? null, ts],
        );
        return loadByCaptureId(client, captureId);
      });
    },

    async deleteCapture(captureId, _opts) {
      // Idempotent hard-delete. The cascade FKs (0002) remove processing_state,
      // evidence_pointer, and idempotency_key with the parent envelope.
      const res = await pool.query(
        'delete from fcg.capture_envelope where capture_id = $1 returning capture_id',
        [captureId],
      );
      return { deleted: res.rows.length > 0, capture_id: captureId };
    },

    async list() {
      const res = await pool.query(
        `${RECORD_SELECT} order by ce.received_at asc, ce.created_at asc`,
      );
      return res.rows.map(mapRow);
    },

    // Not part of the durable API — pool lifecycle for tests / shutdown.
    async end() {
      await pool.end();
    },
  };

  return store;
}
