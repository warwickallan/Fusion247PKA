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
                -- BACKING OFF. A request that has just failed is not claimable
                -- again until its retry window opens. Without this, a failing
                -- request re-claims on every 60-second pass forever, which is
                -- what produced 291 identical failures on request id 1 between
                -- 2026-07-28 and the Gate 2 review. An absent _retry_after is
                -- the ordinary case and stays immediately claimable.
                and (progress->>'_retry_after' is null
                     or (progress->>'_retry_after')::timestamptz <= now())
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
/**
 * HOW MANY TIMES A REQUEST MAY FAIL BEFORE IT STOPS ASKING.
 *
 * ── WHY THIS EXISTS (Veritas Gate 2, defect 6) ────────────────────────────
 * `browser_build_request` id 1 was queued on 2026-07-28 and re-claimed, failed
 * and released on EVERY runtime pass from then until the review - 291 logged
 * failures, identical, with no ceiling, no backoff and no terminal state.
 * Veritas: "A failure that repeats 291 times without escalating is not a
 * durable failure mode; it is a silent one wearing a loud log."
 *
 * ⚠️ AND WHY THE CEILING SHIPS SECOND, NOT FIRST. A ceiling alone would have
 * converted an endless-noise failure into a PERMANENTLY TERMINAL browser lane,
 * days before the shop - the root cause (an unconverted manifest argument in
 * run-basket.cjs) would still have been there, and the lane would simply have
 * given up quietly instead of loudly. The join is fixed first; this stops the
 * NEXT unknown failure from hiding in the same way.
 *
 * ── NO SCHEMA CHANGE, DELIBERATELY ───────────────────────────────────────
 * `browser_build_request` has no attempts column (db/006), and a Work Order
 * that needs a migration stops and returns. The count lives in the existing
 * `progress` jsonb, which this module already owns and already writes.
 */
const MAX_ATTEMPTS = 5;

/** Exponential, bounded: 1, 2, 4, 8, 16 minutes. A failing request stops
 *  occupying every 60-second pass long before it reaches its ceiling. */
function backoffMsFor(attempts) {
  const n = Math.max(1, Number(attempts) || 1);
  return Math.min(2 ** (n - 1), 16) * 60_000;
}

/**
 * Release the lease so a human can take the browser, or so another runner may
 * pick the request up later. Progress is preserved in full - releasing is not
 * abandoning. The request returns to 'queued' because that is precisely what it
 * now is: work that exists and has no owner.
 *
 * ── `countAttempt` IS OPT-IN, AND THAT DEFAULT IS LOAD-BEARING ────────────
 * A release is NOT a failure. This same function is what runs when a human
 * takes the browser over, when a pause is honoured, when ASDA asks for
 * re-authentication, and when the runner is throttled - all of which are the
 * system behaving correctly, and none of which may consume a retry or push a
 * request towards a terminal state.
 *
 * The first draft of this change defaulted it to `true` and the browser-runner
 * suite failed ten of its own proofs, correctly: "being throttled leaves the
 * request queued for later rather than marking it failed" is exactly the
 * property that default would have broken. Only the caller that knows it is
 * handling an ERROR passes `countAttempt: true` - today that is
 * basket-executor/consume-request.cjs, in its catch.
 *
 * When it IS counted and the count reaches `MAX_ATTEMPTS`, the request becomes
 * `failed` and stops asking. The count and the next-eligible time live in
 * `progress`, so `claim` can skip a request that is backing off and a human can
 * see how many times it tried and why.
 *
 * The backoff is computed IN SQL from the row's own counter - no read-then-write
 * round trip, so two runners cannot both read "2" and both write "3".
 */
/**
 * WHY A FAILURE WAS A FAILURE, recorded as a CLASS rather than as prose.
 *
 * WO-2026-08-18-07 AC4. `last_error` is a human sentence and it changes when
 * somebody improves the wording; a recovery rule that greps it is a rule that
 * silently stops matching. The class is written into `progress` - the jsonb
 * this module already owns - and it is what `requeueEnvironmentFailures` selects
 * on.
 *
 *   ENVIRONMENT - the machine was not ready: Chrome not configured, a path or
 *                 port absent. Nothing about the shop is wrong and nothing
 *                 about the request needs re-planning. Once the environment is
 *                 supplied the SAME request is still exactly the work to do.
 *   RUN         - the run happened and did not produce a truthful basket. That
 *                 is a fact about this shop and it needs a human looking at the
 *                 shop, not another attempt.
 */
const FAILURE_CLASS = Object.freeze({ ENVIRONMENT: 'environment', RUN: 'run' });

async function release(query, {
  requestId, runnerId, reason = null, countAttempt = false, failureClass = null,
}) {
  const text = `
    update asdair.browser_build_request
       set status     = case
                          when status in ('complete','failed','cancelled') then status
                          when $4::boolean
                           and coalesce((progress->>'_attempts')::int, 0) + 1 >= $5::int then 'failed'
                          else 'queued'
                        end,
           claimed_by = null,
           last_error = coalesce($3::text, last_error),
           finished_at = case
                          when $4::boolean
                           and coalesce((progress->>'_attempts')::int, 0) + 1 >= $5::int
                           and status not in ('complete','failed','cancelled') then now()
                          else finished_at
                        end,
           progress   = (progress - '_lease')
                        || jsonb_build_object('_released_at', to_jsonb(now()),
                                              '_released_reason', $3::text,
                                              '_attempts',
                                                case when $4::boolean
                                                  then coalesce((progress->>'_attempts')::int, 0) + 1
                                                  else coalesce((progress->>'_attempts')::int, 0) end,
                                              '_retry_after',
                                                case when $4::boolean
                                                  then to_jsonb(now() + make_interval(secs =>
                                                         (least(power(2, coalesce((progress->>'_attempts')::int, 0)), 16) * 60)::int))
                                                  else progress->'_retry_after' end,
                                              -- COALESCED, never blindly written: a release that
                                              -- names no class must not erase the class an earlier
                                              -- one recorded.
                                              '_failure_class',
                                                to_jsonb(coalesce($6::text, progress->>'_failure_class')))
     where id = $2::bigint
       and claimed_by = $1
    returning id, status, (progress->>'_attempts')::int as attempts, progress->>'_retry_after' as retry_after,
              progress->>'_failure_class' as failure_class`;
  const res = await query(text, [
    runnerId, String(requestId), reason, countAttempt === true, MAX_ATTEMPTS, failureClass,
  ]);
  return res.rows[0] || null;
}

/**
 * A CONFIGURATION FAILURE IS NOT A PERMANENT FAILURE (WO-2026-08-18-07 AC4).
 *
 * -- WHAT THIS RECOVERS, AND WHAT IT DELIBERATELY DOES NOT ------------------
 * On 2026-08-18 four queued browser build requests were terminated between
 * 21:22:48Z and 21:26:03Z because three environment variables were absent.
 * Nothing about those requests was wrong; the machine simply had no Chrome
 * configured. Under the retry above, such a request now backs off and reaches
 * `failed` only at the ceiling - but it STILL ends terminal, and the moment the
 * values are placed there is nothing to pick it back up. A shop parked at
 * `wait:browser_runner` with its only request terminal has no route back.
 *
 * So: a request that failed for an ENVIRONMENT reason becomes claimable again
 * when the environment is ready, and only then.
 *
 * Three bounds, all load-bearing:
 *
 *  1. THE CLASS, NOT THE MESSAGE. Selection is on `_failure_class`, written by
 *     `release`. Nothing here reads `last_error`, so improving an error
 *     sentence can never turn this rule off.
 *  2. NEVER A SHOP THAT HAS MOVED ON. `shopStatuses` is an ALLOW-LIST supplied
 *     by the caller - the states in which a browser build is still the work to
 *     do. A cancelled, reconciled or already-basketed shop is not resurrected,
 *     and the list is a positive one so a new shop status cannot silently
 *     qualify.
 *  3. THE COUNTER IS RESET, THE WORK IS NOT. `_attempts` and `_retry_after` go;
 *     the executor's own progress stays exactly where it was, because the whole
 *     point of Gap 7 is that a resumed run does not re-add everything.
 *
 * FORWARD-ONLY, AND SAY SO. A request finished by `lease.finish` before this
 * shipped carries no `_failure_class`, so it is NOT selected. The four live
 * requests killed on 2026-08-18 are outside this rule by construction; putting
 * them back is a live data decision that belongs to whoever owns live data.
 */
async function requeueEnvironmentFailures(query, { shopStatuses, reason = null, limit = 50 } = {}) {
  const allowed = Array.isArray(shopStatuses) ? shopStatuses.filter((s) => typeof s === 'string' && s !== '') : [];
  if (allowed.length === 0) return [];
  const text = `
    update asdair.browser_build_request r
       set status      = 'queued',
           claimed_by  = null,
           finished_at = null,
           last_error  = coalesce($1::text, r.last_error),
           progress    = (r.progress - '_lease' - '_retry_after' - '_attempts')
                         || jsonb_build_object('_requeued_at', to_jsonb(now()),
                                               '_requeued_from', to_jsonb($2::text))
      from asdair.shop s
     where s.id = r.shop_id
       and r.id in (
             select r2.id from asdair.browser_build_request r2
              join asdair.shop s2 on s2.id = r2.shop_id
             where r2.status = 'failed'
               and r2.progress->>'_failure_class' = $2::text
               and s2.status = any($3::text[])
             order by r2.id
             limit $4::int)
    returning r.id, r.shop_id, r.status`;
  const res = await query(text, [
    reason, FAILURE_CLASS.ENVIRONMENT, allowed, Number(limit) || 50,
  ]);
  return res.rows || [];
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
  requeueEnvironmentFailures, FAILURE_CLASS,
  MAX_ATTEMPTS, backoffMsFor,
  _sql: { LEASE_JSON, CLAIMABLE, sql },
};
