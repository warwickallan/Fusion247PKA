// =====================================================================
// BUILD-015 AsdAIr - handoff/claim.js
//
// THE DURABLE LIFECYCLE AROUND THE SUPERVISED STEP.
//
// THE RULE THIS FILE EXISTS TO ENFORCE, unchanged from the runner it borrows
// from: there is never more than one writer against Warwick's live ASDA
// trolley, and completion state is never lost. Two writers on one trolley is
// the failure that cannot happen even once, because its symptom is a real
// household paying for duplicated groceries.
//
// WHAT IS REUSED AND WHAT IS NOT. RUNTIME-DECISION.md excludes the CDP runner
// at services/asdair/browser-runner/ from the live route. This file therefore
// imports NOTHING from it and does not run it. What it reuses is the runner's
// CONCURRENCY DESIGN, which is sound and was proven against real Postgres with
// real concurrent processes (browser-runner/RUNNER-PROOF.md):
//
//  1. ATOMIC CLAIM - a single `update ... where id = (select ... for update
//     skip locked limit 1) returning *`. Two claimers racing cannot both win;
//     Postgres serialises them on the row lock and the loser gets zero rows.
//  2. BOUNDED LEASE EXPIRY - the claim carries `expires_at`, built from the
//     DATABASE clock, never a caller's. A writer killed with -9 does not strand
//     the request forever, and a LIVE writer's claim can never be stolen.
//  3. FENCING ON EVERY WRITE - every progress, heartbeat and completion write
//     carries `and claimed_by = $writer and progress->'_lease'->>'runner_id' =
//     $writer`. A writer whose lease was legitimately taken over gets zero rows
//     back on its very next write, raises LeaseLostError and stops.
//
// THE LEASE KEY IS DELIBERATELY THE SAME ONE lease.cjs USES
// (`progress->'_lease'->>'runner_id'`). If this module fenced on a different
// key, a CDP runner's live lease would be invisible to this module and this
// module's lease invisible to it - and the two would become the two writers
// this whole design exists to prevent. Compatibility here is a safety property,
// not tidiness.
//
// ONE MORE GUARD THE RUNNER DID NOT NEED. A handoff is bound to a PACKET, by
// fingerprint. The partial unique index `bbr_one_live_per_shop` only covers
// live statuses, so a COMPLETED request does not stop a fresh live row being
// inserted for the same shop - which would mean re-shopping a basket that was
// already built. openHandoff() therefore refuses to reopen a completed request
// unless the caller explicitly says so.
//
// NO DEPENDENCIES. `query` is injected exactly as it is into browser-runner's
// lease, so this module never imports `pg` and never opens a connection.
//
// PURE ASCII SOURCE ONLY.
// =====================================================================
'use strict';

// THE LEASE IS SIZED FOR A PERSON, NOT FOR A CDP RUNNER. Warwick, 2026-08-09:
// "Retain lease/fencing but NOT a 45-second CDP lease for a human-paced step."
//
// This module's claimant is the SUPERVISED browser step - a human, or Sonnet in
// Claude for Chrome under a human's supervision. It has no programmatic trigger
// (see README.md) and therefore nothing that reliably heartbeats every ten
// seconds. browser-runner/lease.cjs keeps 45_000 and is RIGHT to: that claimant
// is a machine process with a heartbeat timer, and a short window there is what
// recovers a runner killed with -9.
//
// At 45 seconds against a human the expiry did the OPPOSITE of its job. Warwick
// starts shopping, is interrupted, makes a coffee; the lease lapses under him
// and a second writer becomes eligible for the same trolley - a data-corruption
// defect, not an inconvenience. The expiry exists to stop two writers; sized for
// the wrong actor it invites them.
//
// 90 minutes covers a ~40 minute shop plus a long interruption, and stays
// BOUNDED so an abandoned session self-heals rather than wedging the request for
// ever. Expiry remains RECOVERABLE (another writer may claim once it lapses) and
// VISIBLE (`progress._lease.expires_at`, written from the DATABASE clock). The
// fencing itself is untouched: every progress, heartbeat and completion write
// still carries the runner_id guard.
//
// Pinned by claim.test.js against literals held in the TEST, so restoring the
// CDP value here fails the suite rather than silently re-opening the window.
const DEFAULT_LEASE_MS = 90 * 60_000;
const DEFAULT_HEARTBEAT_MS = 10_000;
const LIVE_STATUSES = ['queued', 'claimed', 'running'];
const TERMINAL_STATUSES = ['complete', 'failed', 'cancelled'];

class LeaseLostError extends Error {
  constructor(msg) { super(msg || 'lease lost - another writer now owns this request'); this.name = 'LeaseLostError'; }
}
class LiveWriterError extends Error {
  constructor(msg, detail) { super(msg); this.name = 'LiveWriterError'; this.detail = detail || null; }
}
class AlreadyCompleteError extends Error {
  constructor(msg, detail) { super(msg); this.name = 'AlreadyCompleteError'; this.detail = detail || null; }
}
class HandoffStateError extends Error {
  constructor(msg, detail) { super(msg); this.name = 'HandoffStateError'; this.detail = detail || null; }
}

// The lease object, built SERVER-SIDE so the clock that decides expiry is always
// the database's and never a writer's.
const LEASE_JSON = `jsonb_build_object(
        'runner_id', $RUNNER,
        'claimed_at', to_jsonb(now()),
        'heartbeat_at', to_jsonb(now()),
        'expires_at', to_jsonb(now() + make_interval(secs => $LEASESECS)),
        'lease_ms', $LEASEMS::bigint)`;

// Claimable when never claimed, already ours, or the lease has run out.
const CLAIMABLE = `(
      status = 'queued'
      or claimed_by is null
      or claimed_by = $RUNNER
      or coalesce(
           (progress->'_lease'->>'expires_at')::timestamptz,
           claimed_at + make_interval(secs => $LEASESECS),
           requested_at
         ) < now()
    )`;

function sql(template, map) {
  return template.replace(/\$([A-Z]+)/g, (m, k) => (map[k] !== undefined ? map[k] : m));
}

/** Is a fetched row currently held by a live (unexpired) lease? */
function leaseIsLive(row, nowMs) {
  const lease = row && row.progress && row.progress._lease;
  if (!lease || !lease.expires_at) return false;
  if (!row.claimed_by) return false;
  return new Date(lease.expires_at).getTime() > nowMs;
}

/** The handoff block stored on the request row. */
function handoffBlock(handoff, openedBy) {
  return {
    packet_fingerprint: handoff.packet_fingerprint,
    shop_ref: handoff.shop_ref,
    handoff_version: handoff.handoff_version,
    instructions_version: handoff.instructions_version,
    expected: { distinct_products: handoff.expected.distinct_products, total_units: handoff.expected.total_units },
    opened_by: openedBy == null ? null : String(openedBy),
  };
}

const SELECT_COLS = `id, shop_id, status, claimed_by, progress, requested_at, claimed_at, finished_at, last_error`;

/** The most recently completed request for a shop, or null. */
async function findComplete(query, shopId) {
  const res = await query(
    `select ${SELECT_COLS} from asdair.browser_build_request
      where shop_id = $1::bigint and status = 'complete'
      order by finished_at desc nulls last, id desc limit 1`,
    [String(shopId)],
  );
  return res.rows[0] || null;
}

/**
 * Idempotently establish EXACTLY ONE live browser_build_request for this shop,
 * bound to this handoff's packet fingerprint.
 *
 * Outcomes, all reported rather than silent:
 *   { created: true  }                    a fresh request was inserted
 *   { resumed: true  }                    a live request for the SAME packet already existed
 *   { superseded: true }                  a live request for a DIFFERENT packet existed and no
 *                                         writer held it; it was re-pointed IN PLACE (never a
 *                                         second row)
 * Throws LiveWriterError when a different packet is offered while a writer
 * holds a live lease - re-pointing under a live writer is how two writers
 * happen. Throws AlreadyCompleteError when the shop's request is already
 * complete, unless `allowAfterComplete` is explicitly set.
 *
 * @param {(text:string, params:any[]) => Promise<{rows:any[]}>} query write-pool query fn
 */
async function openHandoff(query, { shopId, handoff, openedBy = null, allowAfterComplete = false, now = () => Date.now() } = {}) {
  if (shopId == null) throw new HandoffStateError('openHandoff: shopId is required');
  if (!handoff || !handoff.packet_fingerprint) throw new HandoffStateError('openHandoff: handoff must carry a packet_fingerprint');

  const block = handoffBlock(handoff, openedBy);
  const progress = JSON.stringify({ handoff: block });

  // THE COMPLETED-SHOP GUARD COMES FIRST, and it has to.
  //
  // bbr_one_live_per_shop is PARTIAL - it only covers queued/claimed/running.
  // A completed request therefore blocks nothing, so an insert attempted first
  // would happily open a SECOND request for a shop that has already been
  // shopped, and the guard below would never be reached. (That is not
  // hypothetical: this function was written insert-first and the
  // "A COMPLETED SHOP IS NOT SILENTLY REOPENED" proof caught it.)
  //
  // The window between this read and the insert is not closed by the database.
  // It does not need to be: the index still guarantees at most one LIVE row, so
  // the worst case here is a re-opened shop, never two writers.
  const finished = await findComplete(query, shopId);
  if (finished && !allowAfterComplete) {
    throw new AlreadyCompleteError(
      `shop ${shopId} already has a COMPLETE browser build request (id ${finished.id}). Reopening it would re-shop a basket that was already built. Pass allowAfterComplete:true only when that is genuinely intended.`,
      { requestId: finished.id, storedFingerprint: (finished.progress && finished.progress.handoff && finished.progress.handoff.packet_fingerprint) || null },
    );
  }

  // The partial unique index makes this insert the single point at which a live
  // row can come into existence. A concurrent caller that loses the race gets
  // zero rows and falls through to the read below, so both callers converge on
  // the SAME row rather than creating two.
  const ins = await query(
    `insert into asdair.browser_build_request (shop_id, status, progress)
     values ($1::bigint, 'queued', $2::jsonb)
     on conflict (shop_id) where status in ('queued','claimed','running') do nothing
     returning ${SELECT_COLS}`,
    [String(shopId), progress],
  );
  if (ins.rows[0]) return { request: ins.rows[0], created: true, resumed: false, superseded: false };

  // Something live already exists for this shop. Find out what.
  const live = await query(
    `select ${SELECT_COLS} from asdair.browser_build_request
      where shop_id = $1::bigint and status = any($2::text[])
      order by requested_at, id limit 1`,
    [String(shopId), LIVE_STATUSES],
  );
  const row = live.rows[0];

  if (!row) {
    throw new HandoffStateError(
      `openHandoff: shop ${shopId} has no live request and one could not be inserted - the row was completed or cancelled concurrently. Re-read the shop's state rather than retrying blindly.`,
      { shopId: String(shopId) },
    );
  }

  const stored = (row.progress && row.progress.handoff && row.progress.handoff.packet_fingerprint) || null;
  if (stored === handoff.packet_fingerprint) {
    // The same packet. This is the repeated-handoff case and it must be a
    // no-op: resume the existing request rather than making a second one.
    return { request: row, created: false, resumed: true, superseded: false };
  }

  if (leaseIsLive(row, now())) {
    throw new LiveWriterError(
      `shop ${shopId} request ${row.id} is held by a live writer (${row.claimed_by}); a different packet cannot be swapped in underneath it. Wait for the lease to expire or release it first.`,
      { requestId: row.id, claimedBy: row.claimed_by, storedFingerprint: stored },
    );
  }

  // No live writer: re-point the SAME row at the new packet. Never a second row.
  const sup = await query(
    `update asdair.browser_build_request
        set progress = (coalesce(progress, '{}'::jsonb) - '_lease' - 'report')
                       || $2::jsonb
                       || jsonb_build_object('_superseded_at', to_jsonb(now()), '_superseded_from', $3::text),
            status = 'queued', claimed_by = null, last_error = null
      where id = $1::bigint and status = any($4::text[])
      returning ${SELECT_COLS}`,
    [String(row.id), progress, stored, LIVE_STATUSES],
  );
  if (!sup.rows[0]) throw new HandoffStateError(`openHandoff: failed to supersede request ${row.id}`);
  return { request: sup.rows[0], created: false, resumed: false, superseded: true };
}

/**
 * Atomically claim the shop's live request. Returns the claimed row, or null
 * when nothing is claimable (either nothing live, or a writer holds the lease).
 */
async function claimHandoff(query, { shopId = null, requestId = null, writerId, leaseMs = DEFAULT_LEASE_MS } = {}) {
  if (!writerId) throw new HandoffStateError('claimHandoff: writerId is required');
  const leaseSecs = leaseMs / 1000;
  const params = [writerId, leaseSecs, leaseMs, LIVE_STATUSES];
  let filter = '';
  if (requestId != null) { params.push(String(requestId)); filter = 'and id = $5::bigint'; }
  else if (shopId != null) { params.push(String(shopId)); filter = 'and shop_id = $5::bigint'; }

  const map = { RUNNER: '$1', LEASESECS: '$2::double precision', LEASEMS: '$3' };
  const text = `
    update asdair.browser_build_request b
       set status     = 'running',
           claimed_by = $1,
           claimed_at = now(),
           last_error = null,
           progress   = coalesce(b.progress, '{}'::jsonb)
                        || jsonb_build_object('_lease', ${sql(LEASE_JSON, map)})
     where b.id = (
             select id
               from asdair.browser_build_request
              where status = any($4::text[])
                ${filter}
                and ${sql(CLAIMABLE, map)}
              order by requested_at, id
              for update skip locked
              limit 1)
    returning b.id, b.shop_id, b.status, b.claimed_by, b.progress,
              b.requested_at, b.claimed_at, b.finished_at, b.last_error`;
  const res = await query(text, params);
  return res.rows[0] || null;
}

/** Extend the lease. Throws LeaseLostError if this writer no longer owns it. */
async function heartbeat(query, { requestId, writerId, leaseMs = DEFAULT_LEASE_MS }) {
  const text = `
    update asdair.browser_build_request
       set progress = progress || jsonb_build_object('_lease',
             coalesce(progress->'_lease', '{}'::jsonb) || jsonb_build_object(
               'runner_id', $1,
               'heartbeat_at', to_jsonb(now()),
               'expires_at', to_jsonb(now() + make_interval(secs => $3::double precision)),
               'lease_ms', $4::bigint))
     where id = $2::bigint
       and claimed_by = $1
       and progress->'_lease'->>'runner_id' = $1
    returning progress->'_lease'->>'expires_at' as expires_at`;
  const res = await query(text, [writerId, String(requestId), leaseMs / 1000, leaseMs]);
  if (!res.rows[0]) throw new LeaseLostError(`heartbeat rejected for request ${requestId}`);
  return res.rows[0].expires_at;
}

/**
 * Record progress through the packet, FENCED. `_lease` and `handoff` are
 * preserved from the ROW, never from the caller's in-memory copy, so a writer
 * can neither extend its own lease nor re-point the packet by writing progress.
 */
async function reportProgress(query, { requestId, writerId, progress, lastError = null }) {
  const clean = { ...(progress || {}) };
  delete clean._lease;
  delete clean.handoff;
  const text = `
    update asdair.browser_build_request
       set progress   = $3::jsonb
                        || jsonb_build_object('_lease', progress->'_lease')
                        || jsonb_build_object('handoff', progress->'handoff'),
           last_error = $4
     where id = $2::bigint
       and claimed_by = $1
       and progress->'_lease'->>'runner_id' = $1
    returning ${SELECT_COLS}`;
  const res = await query(text, [writerId, String(requestId), JSON.stringify(clean), lastError]);
  if (!res.rows[0]) throw new LeaseLostError(`progress write rejected for request ${requestId}`);
  return res.rows[0];
}

/**
 * Release the lease so a human can take the browser. Progress is preserved in
 * full - releasing is not abandoning. The request returns to 'queued' because
 * that is exactly what it now is: work that exists and has no owner.
 */
async function releaseHandoff(query, { requestId, writerId, reason = null }) {
  const text = `
    update asdair.browser_build_request
       set status     = case when status in ('complete','failed','cancelled') then status else 'queued' end,
           claimed_by = null,
           progress   = (progress - '_lease')
                        || jsonb_build_object('_released_at', to_jsonb(now()), '_released_reason', $3::text)
     where id = $2::bigint
       and claimed_by = $1
    returning ${SELECT_COLS}`;
  const res = await query(text, [writerId, String(requestId), reason]);
  return res.rows[0] || null;
}

/**
 * Terminal completion, FENCED and BOUND TO THE PACKET.
 *
 * Two guards, and both matter:
 *   * the lease fence - a writer that lost its lease cannot complete;
 *   * `and progress->'handoff'->>'packet_fingerprint' = $fingerprint` - a
 *     completion carrying a superseded packet's fingerprint updates zero rows
 *     and is refused, rather than overwriting the current packet's state.
 *
 * IDEMPOTENT: completing an already-complete request with the SAME fingerprint
 * returns the stored terminal row instead of erroring or writing twice, so a
 * retried completion never loses or duplicates completion state.
 */
async function completeHandoff(query, { requestId, writerId, packetFingerprint, report = null, status = 'complete', lastError = null }) {
  if (!TERMINAL_STATUSES.includes(status)) throw new HandoffStateError(`not a terminal status: ${status}`);
  if (!packetFingerprint) throw new HandoffStateError('completeHandoff: packetFingerprint is required');

  const text = `
    update asdair.browser_build_request
       set status      = $3,
           progress    = (progress - '_lease') || jsonb_build_object('report', $4::jsonb),
           last_error  = $5,
           claimed_by  = null,
           finished_at = now()
     where id = $2::bigint
       and claimed_by = $1
       and progress->'_lease'->>'runner_id' = $1
       and progress->'handoff'->>'packet_fingerprint' = $6
    returning ${SELECT_COLS}`;
  const res = await query(text, [
    writerId, String(requestId), status,
    report == null ? null : JSON.stringify(report), lastError, packetFingerprint,
  ]);
  if (res.rows[0]) return { request: res.rows[0], alreadyComplete: false };

  // Zero rows. Establish WHY rather than guessing - the three causes need
  // different answers and conflating them is how completion state gets lost.
  const cur = await query(`select ${SELECT_COLS} from asdair.browser_build_request where id = $1::bigint`, [String(requestId)]);
  const row = cur.rows[0];
  if (!row) throw new HandoffStateError(`completeHandoff: request ${requestId} does not exist`, { requestId });

  const storedFp = (row.progress && row.progress.handoff && row.progress.handoff.packet_fingerprint) || null;
  if (storedFp !== packetFingerprint) {
    throw new HandoffStateError(
      `completion refused: this report is for a SUPERSEDED packet. Request ${requestId} now carries a different packet.`,
      { requestId, code: 'SUPERSEDED_PACKET' },
    );
  }
  if (TERMINAL_STATUSES.includes(row.status)) {
    // Same packet, already terminal - the retried-completion case.
    return { request: row, alreadyComplete: true };
  }
  throw new LeaseLostError(`completion rejected for request ${requestId} - this writer does not hold the lease`);
}

/** Read-only view of a shop's request and its lease. */
async function peekHandoff(query, { shopId = null, requestId = null } = {}) {
  const expired = `(progress->'_lease'->>'expires_at')::timestamptz < now() as lease_expired, now() as db_now`;
  if (requestId != null) {
    const res = await query(`select ${SELECT_COLS}, ${expired} from asdair.browser_build_request where id = $1::bigint`, [String(requestId)]);
    return res.rows[0] || null;
  }
  if (shopId != null) {
    const res = await query(
      `select ${SELECT_COLS}, ${expired} from asdair.browser_build_request where shop_id = $1::bigint order by id desc`,
      [String(shopId)],
    );
    return res.rows;
  }
  const res = await query(`select ${SELECT_COLS}, ${expired} from asdair.browser_build_request order by id`, []);
  return res.rows;
}

module.exports = {
  DEFAULT_LEASE_MS, DEFAULT_HEARTBEAT_MS, LIVE_STATUSES, TERMINAL_STATUSES,
  LeaseLostError, LiveWriterError, AlreadyCompleteError, HandoffStateError,
  openHandoff, claimHandoff, heartbeat, reportProgress, releaseHandoff, completeHandoff, peekHandoff,
  _internal: { LEASE_JSON, CLAIMABLE, sql, leaseIsLive, handoffBlock },
};
