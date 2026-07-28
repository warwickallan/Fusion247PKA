// =====================================================================
// BUILD-015 AsdAIr browser runner - THE SINGLE-WRITER LEASE.
//
// THE RULE THIS FILE EXISTS TO ENFORCE: there is never more than one process
// issuing writes against Warwick's live ASDA trolley. Two writers on one
// trolley is the failure that cannot be allowed to happen even once, because
// its symptom is a real household paying for duplicated groceries.
//
// HOW IT IS ENFORCED (three independent mechanisms, not one):
//
//  1. ATOMIC CLAIM. Claiming is a SINGLE `update ... where id = (select ...
//     for update skip locked limit 1) returning *`. Two runners racing cannot
//     both win: Postgres serialises them on the row lock, and the loser gets
//     zero rows back and refuses (or waits, with --wait).
//
//  2. BOUNDED LEASE EXPIRY. The claim carries `expires_at`. A claim is only
//     stealable once that instant has passed, so a runner killed with -9 -
//     which never gets to release anything - does not strand the request
//     forever, and yet a LIVE runner's claim can never be stolen.
//
//  3. FENCING ON EVERY WRITE. The heartbeat and every progress write carry
//     `and claimed_by = $runner and progress->'_lease'->>'runner_id' = $runner`.
//     If this runner's lease was legitimately taken over while it was blocked
//     (a long CDP call, a laptop suspend), its very next database write returns
//     zero rows, raises LeaseLostError, and the runner stops issuing browser
//     commands immediately. A stale writer therefore cannot resume clicking.
//
// WHERE THE LEASE LIVES. In `browser_build_request.progress -> '_lease'`, not
// in dedicated columns: this build may not apply migrations (Larry owns those),
// and `progress` is a durable jsonb column on the same row, so the heartbeat is
// exactly as durable and exactly as atomic as a column would be. If dedicated
// `heartbeat_at` / `lease_expires_at` columns are added later, this file is the
// only place that has to change - nothing outside it reads `_lease`.
// =====================================================================
'use strict';

const os = require('node:os');
const crypto = require('node:crypto');

const DEFAULT_LEASE_MS = 45_000;
const DEFAULT_HEARTBEAT_MS = 10_000;
const LIVE_STATUSES = ['queued', 'claimed', 'running'];

class LeaseLostError extends Error {
  constructor(msg) { super(msg || 'lease lost - another runner now owns this request'); this.name = 'LeaseLostError'; }
}
class NoClaimError extends Error {
  constructor(msg) { super(msg || 'no claimable browser_build_request'); this.name = 'NoClaimError'; }
}

/**
 * A runner identity that is unique per PROCESS by default, so a restarted
 * runner cannot masquerade as the process that died and skip the expiry check.
 * `ASDAIR_RUNNER_ID` may pin it - only ever pin it for one process at a time.
 */
function newRunnerId(env = process.env) {
  if (env.ASDAIR_RUNNER_ID) return String(env.ASDAIR_RUNNER_ID).slice(0, 120);
  return `asdair-browser-runner@${os.hostname()}#${process.pid}#${crypto.randomBytes(3).toString('hex')}`;
}

// The lease object written into progress._lease, built server-side so the clock
// that decides expiry is always the DATABASE clock - never a runner's clock.
const LEASE_JSON = `jsonb_build_object(
        'runner_id', $RUNNER,
        'claimed_at', to_jsonb(now()),
        'heartbeat_at', to_jsonb(now()),
        'expires_at', to_jsonb(now() + make_interval(secs => $LEASESECS)),
        'lease_ms', $LEASEMS::bigint)`;

// A claim is available when it has never been claimed, or its lease has run out.
// coalesce order matters: an old row written before leases existed falls back to
// claimed_at + the lease window, and finally to requested_at.
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

/**
 * Atomically claim one request. Returns the claimed row, or null when nothing
 * is claimable (either nothing is queued, or a live runner holds the lease).
 *
 * @param {(text:string, params:any[]) => Promise<{rows:any[]}>} query write-pool query fn
 */
async function claim(query, { runnerId, leaseMs = DEFAULT_LEASE_MS, requestId = null, shopId = null } = {}) {
  const leaseSecs = leaseMs / 1000;
  const params = [runnerId, leaseSecs, leaseMs, LIVE_STATUSES];
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

/** Claim, waiting (polling) up to `waitMs` for a live lease to expire. */
async function claimOrWait(query, opts, { waitMs = 0, pollMs = 2000, onWait = () => {} } = {}) {
  const deadline = Date.now() + waitMs;
  for (;;) {
    const row = await claim(query, opts);
    if (row) return row;
    if (Date.now() >= deadline) return null;
    onWait(Math.max(0, deadline - Date.now()));
    await new Promise((r) => setTimeout(r, pollMs));
  }
}

/**
 * Extend the lease. Returns the new expiry. Throws LeaseLostError if this
 * runner no longer owns the request - the fencing check every writer relies on.
 */
async function heartbeat(query, { requestId, runnerId, leaseMs = DEFAULT_LEASE_MS }) {
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
  const res = await query(text, [runnerId, String(requestId), leaseMs / 1000, leaseMs]);
  if (!res.rows[0]) throw new LeaseLostError(`heartbeat rejected for request ${requestId}`);
  return res.rows[0].expires_at;
}

/**
 * Write progress, FENCED. The stored `_lease` is preserved from the row itself,
 * never from the caller's in-memory copy, so a runner cannot extend its own
 * lease by writing progress.
 */
async function writeProgress(query, { requestId, runnerId, progress, status = null, lastError = null }) {
  const clean = { ...progress };
  delete clean._lease;
  const text = `
    update asdair.browser_build_request
       set progress   = $3::jsonb || jsonb_build_object('_lease', progress->'_lease'),
           status     = coalesce($4, status),
           last_error = $5
     where id = $2::bigint
       and claimed_by = $1
       and progress->'_lease'->>'runner_id' = $1
    returning id, status, progress`;
  const res = await query(text, [runnerId, String(requestId), JSON.stringify(clean), status, lastError]);
  if (!res.rows[0]) throw new LeaseLostError(`progress write rejected for request ${requestId}`);
  return res.rows[0];
}

/**
 * Release the lease so a human can take the browser, or so another runner may
 * pick the request up later. Progress is preserved in full - releasing is not
 * abandoning. The request returns to 'queued' because that is precisely what it
 * now is: work that exists and has no owner.
 */
async function release(query, { requestId, runnerId, reason = null }) {
  const text = `
    update asdair.browser_build_request
       set status     = case when status in ('complete','failed','cancelled') then status else 'queued' end,
           claimed_by = null,
           progress   = (progress - '_lease')
                        || jsonb_build_object('_released_at', to_jsonb(now()),
                                              '_released_reason', $3::text)
     where id = $2::bigint
       and claimed_by = $1
    returning id, status`;
  const res = await query(text, [runnerId, String(requestId), reason]);
  return res.rows[0] || null;
}

/** Finish the request. Terminal; the lease is dropped with it. */
async function finish(query, { requestId, runnerId, status = 'complete', progress = null, lastError = null }) {
  if (!['complete', 'failed', 'cancelled'].includes(status)) throw new Error(`not a terminal status: ${status}`);
  const clean = progress ? { ...progress } : null;
  if (clean) delete clean._lease;
  const text = `
    update asdair.browser_build_request
       set status      = $3,
           progress    = coalesce($4::jsonb, progress) - '_lease',
           last_error  = $5,
           claimed_by  = null,
           finished_at = now()
     where id = $2::bigint
       and claimed_by = $1
       and progress->'_lease'->>'runner_id' = $1
    returning id, status, progress, finished_at`;
  const res = await query(text, [runnerId, String(requestId), status, clean ? JSON.stringify(clean) : null, lastError]);
  if (!res.rows[0]) throw new LeaseLostError(`finish rejected for request ${requestId}`);
  return res.rows[0];
}

/** Read-only view of a request and its lease, for the status CLI. */
async function peek(query, { requestId = null } = {}) {
  const text = requestId
    ? `select id, shop_id, status, claimed_by, progress, requested_at, claimed_at, finished_at, last_error,
              (progress->'_lease'->>'expires_at')::timestamptz < now() as lease_expired, now() as db_now
         from asdair.browser_build_request where id = $1::bigint`
    : `select id, shop_id, status, claimed_by, progress, requested_at, claimed_at, finished_at, last_error,
              (progress->'_lease'->>'expires_at')::timestamptz < now() as lease_expired, now() as db_now
         from asdair.browser_build_request order by id`;
  const res = await query(text, requestId ? [String(requestId)] : []);
  return requestId ? (res.rows[0] || null) : res.rows;
}

module.exports = {
  DEFAULT_LEASE_MS, DEFAULT_HEARTBEAT_MS, LIVE_STATUSES,
  LeaseLostError, NoClaimError,
  newRunnerId, claim, claimOrWait, heartbeat, writeProgress, release, finish, peek,
  _sql: { LEASE_JSON, CLAIMABLE, sql },
};
