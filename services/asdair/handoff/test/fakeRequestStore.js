// =====================================================================
// BUILD-015 AsdAIr - handoff/test/fakeRequestStore.js
//
// Offline fake for asdair.browser_build_request.
//
// HONEST SCOPE - READ THIS BEFORE TRUSTING A GREEN TEST.
//
// This fake reproduces the PROTOCOL of claim.js: one live row per shop, one
// lease holder at a time, a bounded expiry, fenced writes, and completion bound
// to a packet fingerprint. That lets the whole control flow - open, claim,
// resume, supersede, lose a lease, complete, retry a completion - be tested
// with no database, no Chrome and no ASDA account.
//
// It does NOT prove the SQL. The atomicity of the claim comes from Postgres
// (`for update skip locked` inside a single `update ... returning`), and the
// one-live-row-per-shop guarantee comes from the partial unique index
// `bbr_one_live_per_shop` in db/006_shop_control_surface.sql. NO in-memory fake
// can demonstrate either. Those properties are inherited from statement shapes
// proven against a real database with real concurrent processes in
// browser-runner/RUNNER-PROOF.md, and they are NOT re-proven here.
//
// What this fake CAN prove, and what the tests use it for: that claim.js issues
// the guarded statement rather than an unguarded one, and that the guards are
// load-bearing - remove one via `mutate` and the corresponding proof fails.
//
// PURE ASCII SOURCE ONLY. No dependencies.
// =====================================================================
'use strict';

const LIVE = ['queued', 'claimed', 'running'];
const TERMINAL = ['complete', 'failed', 'cancelled'];

// =====================================================================
// THE CLAIM LIFECYCLE, OVER SOMEBODY ELSE'S ROW ARRAY.
//
// WP-B15-19. `makeFakeStore` below owns its own rows and is the right fake for
// unit-testing claim.js on its own. The END-TO-END proof needs something this
// file did not previously offer: claim.js's SIX LIFECYCLE STATEMENTS answered
// against the row array of a DIFFERENT fake - `pipeline/test/fakePg.js`'s
// in-memory `browser_build_request` - so the supervised operator's real report
// and the pipeline's real next pass meet over ONE durable state rather than two
// disconnected ones.
//
// WHY IT LIVES HERE RATHER THAN IN THE PIPELINE'S FAKE. `pipeline/test/fakePg.js`
// already models `openHandoff`'s four statements and shopStore's, but not the
// lifecycle six, and it is outside this Work Order's file surface AND held by
// another worker this session. So the lifecycle is implemented once, here,
// beside the module whose statements it mirrors - which is also where it belongs
// on the merits: when claim.js changes shape, this is the file a reader is
// already looking at.
//
// SAME HONEST SCOPE AS THE HEADER ABOVE: this reproduces the PROTOCOL, never the
// SQL. `for update skip locked` and `bbr_one_live_per_shop` are Postgres
// properties and no in-memory fake demonstrates either.
//
// FIRST-MATCH-WINS, AND THE EXCLUSIONS ARE LOAD-BEARING. `peekHandoff`'s select
// and `openHandoff`'s two selects all begin `select id, shop_id, status`, so the
// peek branch below refuses any statement carrying `status = any(` or
// `status = 'complete'` and lets those fall through to the delegate. Answering
// the wrong statement is worse than answering none, because "none" is loud.
// =====================================================================

/**
 * @param {object}   opts
 * @param {Array}    opts.rows     the row array to operate on, BY REFERENCE
 * @param {Function} opts.now      controllable clock, returns a Date
 * @param {object}   opts.mutate   defect injection - see makeFakeStore below
 * @param {Function} opts.delegate called for any statement this does not own
 * @returns {(text:string, params:Array) => Promise<{rows:Array}>}
 */
function makeClaimQuery({ rows, now = () => new Date(), mutate = {}, delegate = null } = {}) {
  if (!Array.isArray(rows)) throw new Error('makeClaimQuery: rows must be the array to operate on');

  const clone = (r) => JSON.parse(JSON.stringify(r));
  const leaseOf = (r) => (r.progress && r.progress._lease) || null;
  const leaseLive = (r) => {
    const l = leaseOf(r);
    if (!l || !r.claimed_by) return false;
    return new Date(l.expires_at).getTime() > now().getTime();
  };
  const owns = (r, writerId) => {
    if (mutate.noFencing) return true;
    const l = leaseOf(r);
    return r.claimed_by === writerId && !!l && l.runner_id === writerId;
  };
  const makeLease = (writerId, leaseMs) => {
    const t = now().getTime();
    return {
      runner_id: writerId,
      claimed_at: new Date(t).toISOString(),
      heartbeat_at: new Date(t).toISOString(),
      expires_at: new Date(t + leaseMs).toISOString(),
      lease_ms: leaseMs,
    };
  };
  const byId = (id) => rows.find((r) => String(r.id) === String(id));

  return async function claimQuery(text, params = []) {
    const t = String(text).replace(/\s+/g, ' ').trim();

    // ---- claimHandoff: the atomic claim -----------------------------------
    if (t.startsWith("update asdair.browser_build_request b set status = 'running'")) {
      const [writerId, leaseSecs, leaseMs, statuses, filterId] = params;
      const candidates = rows
        .filter((r) => (statuses || LIVE).includes(r.status))
        .filter((r) => {
          if (filterId == null) return true;
          return t.includes('and id = $5::bigint')
            ? String(r.id) === String(filterId)
            : String(r.shop_id) === String(filterId);
        })
        .filter((r) => {
          // THE GUARD. Without it, a second writer claims a live request.
          if (mutate.claimIgnoresLease) return true;
          return r.status === 'queued' || r.claimed_by == null || r.claimed_by === writerId || !leaseLive(r);
        })
        .sort((a, b) => Number(a.id) - Number(b.id));
      const row = candidates[0];
      if (!row) return { rows: [] };
      row.status = 'running';
      row.claimed_by = writerId;
      row.claimed_at = now();
      row.last_error = null;
      row.progress = { ...row.progress, _lease: makeLease(writerId, Number(leaseMs)) };
      void leaseSecs;
      return { rows: [clone(row)] };
    }

    // ---- heartbeat --------------------------------------------------------
    if (t.includes("set progress = progress || jsonb_build_object('_lease'")) {
      const [writerId, id, , leaseMs] = params;
      const row = byId(id);
      if (!row || !owns(row, writerId)) return { rows: [] };
      row.progress = { ...row.progress, _lease: { ...leaseOf(row), ...makeLease(writerId, Number(leaseMs)) } };
      return { rows: [{ expires_at: row.progress._lease.expires_at }] };
    }

    // ---- reportProgress (fenced) -----------------------------------------
    if (t.includes('set progress = $3::jsonb')) {
      const [writerId, id, progressJson, lastError] = params;
      const row = byId(id);
      if (!row || !owns(row, writerId)) return { rows: [] };
      const next = JSON.parse(progressJson);
      row.progress = { ...next, _lease: leaseOf(row), handoff: row.progress.handoff };
      row.last_error = lastError == null ? null : lastError;
      return { rows: [clone(row)] };
    }

    // ---- releaseHandoff ---------------------------------------------------
    if (t.includes("set status = case when status in ('complete','failed','cancelled')")) {
      const [writerId, id, reason] = params;
      const row = byId(id);
      if (!row) return { rows: [] };
      if (!mutate.noFencing && row.claimed_by !== writerId) return { rows: [] };
      if (!TERMINAL.includes(row.status)) row.status = 'queued';
      row.claimed_by = null;
      delete row.progress._lease;
      row.progress._released_at = now().toISOString();
      row.progress._released_reason = reason;
      return { rows: [clone(row)] };
    }

    // ---- completeHandoff (fenced AND fingerprint-bound) --------------------
    //
    // THE THREE CLAUSES ARE READ OFF THE STATEMENT, NOT ASSUMED. This branch
    // used to hard-code all three behaviours, which meant a mutation of
    // claim.js's SQL changed NOTHING here and the corresponding proof passed
    // vacuously - a false green of exactly the kind this estate keeps paying
    // for. So each is derived:
    //
    //   * `(progress - '_lease') ||`  the other keys SURVIVE and only the lease
    //     is dropped. THIS is why `progress.handoff` is still there afterwards
    //     and why this route is correct where updateBrowserProgress is not. A
    //     bare `progress = jsonb_build_object('report', ...)` would REPLACE.
    //   * the lease fence     `claimed_by = $1 and progress->'_lease'->>'runner_id' = $1`
    //   * the packet fence    `progress->'handoff'->>'packet_fingerprint' = $6`
    //
    // HONEST LIMIT, same as the file header: this models the CLAUSES, not the
    // SQL. `owns()` stands for the lease fence's two conditions together, so
    // deleting only `claimed_by = $1` while leaving the lease clause in place
    // would not be noticed here. Postgres is where that pair is really enforced.
    if (t.includes("jsonb_build_object('report'")) {
      const [writerId, id, status, reportJson, lastError, fingerprint] = params;
      const fencedOnLease = t.includes("progress->'_lease'->>'runner_id' = $1");
      const fencedOnPacket = t.includes("progress->'handoff'->>'packet_fingerprint' = $6");
      const preservesOtherKeys = t.includes("(progress - '_lease') ||");

      const row = byId(id);
      if (!row) return { rows: [] };
      if (fencedOnLease && !owns(row, writerId)) return { rows: [] };
      const stored = (row.progress.handoff && row.progress.handoff.packet_fingerprint) || null;
      if (fencedOnPacket && stored !== fingerprint) return { rows: [] };

      row.status = status;
      if (preservesOtherKeys) delete row.progress._lease;
      else row.progress = {};
      row.progress.report = reportJson == null ? null : JSON.parse(reportJson);
      row.last_error = lastError == null ? null : lastError;
      row.claimed_by = null;
      row.finished_at = now();
      return { rows: [clone(row)] };
    }

    // ---- peekHandoff, and completeHandoff's zero-row diagnostic read -------
    // Both are `select <SELECT_COLS> ... from asdair.browser_build_request`.
    // openHandoff's two selects share that prefix and are EXCLUDED here.
    if (t.startsWith('select id, shop_id, status')
      && t.includes('from asdair.browser_build_request')
      && !t.includes('status = any(')
      && !t.includes("status = 'complete'")) {
      const withLease = (r) => ({ ...clone(r), lease_expired: leaseOf(r) ? !leaseLive(r) : null, db_now: now() });
      if (t.includes('where id = $1::bigint')) {
        const row = byId(params[0]);
        return { rows: row ? [withLease(row)] : [] };
      }
      if (t.includes('where shop_id = $1::bigint')) {
        return {
          rows: rows.filter((r) => String(r.shop_id) === String(params[0]))
            .sort((a, b) => Number(b.id) - Number(a.id)).map(withLease),
        };
      }
      return { rows: rows.slice().sort((a, b) => Number(a.id) - Number(b.id)).map(withLease) };
    }

    if (delegate) return delegate(text, params);
    throw new Error(`makeClaimQuery: unrecognised statement: ${t.slice(0, 140)}`);
  };
}

/**
 * @param {object} opts
 * @param {Array}  opts.requests seed rows
 * @param {Function} opts.now    controllable clock, returns a Date
 * @param {object} opts.mutate   DELIBERATE DEFECT INJECTION for mutation testing:
 *   { claimIgnoresLease: true } - the claim no longer checks whether a live
 *     lease is held, i.e. the atomic-claim guard is removed.
 *   { noFencing: true } - progress/heartbeat/complete writes no longer check
 *     `claimed_by` and the stored lease runner_id, i.e. the fence is removed.
 *   { noLiveRowConstraint: true } - the partial unique index is disabled, so a
 *     second live row for the same shop can be inserted.
 */
function makeFakeStore({ requests = [], now = () => new Date(), mutate = {} } = {}) {
  const state = {
    seq: 0,
    requests: requests.map((r, i) => ({
      id: String(r.id != null ? r.id : i + 1),
      shop_id: String(r.shop_id != null ? r.shop_id : 1),
      status: r.status || 'queued',
      claimed_by: r.claimed_by != null ? r.claimed_by : null,
      progress: r.progress ? JSON.parse(JSON.stringify(r.progress)) : {},
      last_error: r.last_error != null ? r.last_error : null,
      requested_at: r.requested_at || now(),
      claimed_at: r.claimed_at != null ? r.claimed_at : null,
      finished_at: r.finished_at != null ? r.finished_at : null,
    })),
    calls: [],
  };
  state.seq = state.requests.reduce((m, r) => Math.max(m, Number(r.id) || 0), 0);

  const clone = (r) => JSON.parse(JSON.stringify(r));
  const leaseOf = (r) => (r.progress && r.progress._lease) || null;
  const leaseLive = (r) => {
    const l = leaseOf(r);
    if (!l || !r.claimed_by) return false;
    return new Date(l.expires_at).getTime() > now().getTime();
  };
  const liveRows = (shopId) => state.requests.filter((r) => LIVE.includes(r.status) && (shopId == null || r.shop_id === String(shopId)));

  // The claim/heartbeat/progress/release/complete/peek half, over THESE rows.
  // openHandoff's four statements are answered below, before this is reached.
  const lifecycle = makeClaimQuery({ rows: state.requests, now, mutate });

  async function query(text, params = []) {
    const t = text.replace(/\s+/g, ' ').trim();
    state.calls.push({ text: t, params });

    // ---- openHandoff: insert if no live row exists for the shop ----------
    if (t.startsWith('insert into asdair.browser_build_request (shop_id, status, progress)')) {
      const [shopId, progressJson] = params;
      if (!mutate.noLiveRowConstraint && liveRows(shopId).length > 0) return { rows: [] }; // partial unique index
      const row = {
        id: String(++state.seq),
        shop_id: String(shopId),
        status: 'queued',
        claimed_by: null,
        progress: JSON.parse(progressJson),
        last_error: null,
        requested_at: now(),
        claimed_at: null,
        finished_at: null,
      };
      state.requests.push(row);
      return { rows: [clone(row)] };
    }

    // ---- openHandoff: read the live row ---------------------------------
    if (t.includes("where shop_id = $1::bigint and status = any($2::text[])")) {
      const [shopId] = params;
      const rows = liveRows(shopId).sort((a, b) => Number(a.id) - Number(b.id));
      return { rows: rows.slice(0, 1).map(clone) };
    }

    // ---- openHandoff: read the completed row -----------------------------
    if (t.includes("where shop_id = $1::bigint and status = 'complete'")) {
      const [shopId] = params;
      const rows = state.requests
        .filter((r) => r.shop_id === String(shopId) && r.status === 'complete')
        .sort((a, b) => Number(b.id) - Number(a.id));
      return { rows: rows.slice(0, 1).map(clone) };
    }

    // ---- openHandoff: supersede the packet on the SAME row ---------------
    if (t.includes("'_superseded_at'")) {
      const [id, progressJson, from] = params;
      const row = state.requests.find((r) => r.id === String(id) && LIVE.includes(r.status));
      if (!row) return { rows: [] };
      const next = JSON.parse(progressJson);
      delete row.progress._lease;
      delete row.progress.report;
      row.progress = { ...row.progress, ...next, _superseded_at: now().toISOString(), _superseded_from: from };
      row.status = 'queued';
      row.claimed_by = null;
      row.last_error = null;
      return { rows: [clone(row)] };
    }

    // ---- the six lifecycle statements, and the peek ------------------------
    // Shared with the pipeline end-to-end proof (WP-B15-19) so there is ONE
    // implementation of claim.js's protocol, not two that can drift apart.
    return lifecycle(text, params);
  }

  return { query, state, helpers: { leaseLive, liveRows, clone } };
}

module.exports = { makeFakeStore, makeClaimQuery, LIVE, TERMINAL };
