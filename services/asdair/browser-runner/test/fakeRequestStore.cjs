// =====================================================================
// Offline fake for asdair.browser_build_request and friends.
//
// HONEST SCOPE - read this before trusting a green test.
//
// This fake reproduces the runner's PROTOCOL: one row, one lease holder at a
// time, a bounded expiry, fenced writes. It lets the whole control flow -
// claim, pause, resume, human takeover, basket-ready, restart-without-
// duplicating - be tested with no database, no Chrome and no ASDA.
//
// It does NOT prove the SQL. The claim statement's atomicity comes from
// Postgres (`for update skip locked` inside a single `update ... returning`),
// and no in-memory fake can demonstrate that. THAT is proven against the real
// database, with two real concurrent runner processes, in RUNNER-PROOF.md.
// =====================================================================
'use strict';

const LIVE = ['queued', 'claimed', 'running'];

function makeFakeStore({ requests = [], shops = [], now = () => new Date() } = {}) {
  const state = {
    requests: requests.map((r) => ({
      id: String(r.id), shop_id: String(r.shop_id ?? 1), status: r.status || 'queued',
      claimed_by: r.claimed_by ?? null, progress: r.progress ? JSON.parse(JSON.stringify(r.progress)) : {},
      requested_at: r.requested_at || now(), claimed_at: r.claimed_at ?? null,
      finished_at: r.finished_at ?? null, last_error: r.last_error ?? null,
    })),
    shops: shops.map((s) => ({ id: String(s.id), household_id: String(s.household_id ?? 1), shop_ref: s.shop_ref || 'SHOP-TEST', status: s.status || 'WAITING_FOR_BROWSER', list_id: s.list_id ?? null })),
    events: [],
    pendingActions: [],
    calls: [],
  };

  const leaseOf = (r) => (r.progress && r.progress._lease) || null;
  const expired = (r) => {
    const l = leaseOf(r);
    if (!l) return true;
    return new Date(l.expires_at).getTime() < now().getTime();
  };
  const clone = (r) => JSON.parse(JSON.stringify({ ...r, requested_at: r.requested_at, claimed_at: r.claimed_at }));

  async function query(text, params = []) {
    state.calls.push({ text, params });
    const t = text.replace(/\s+/g, ' ').trim();

    // ---- claim --------------------------------------------------------
    if (t.startsWith("update asdair.browser_build_request b set status = 'running'")) {
      const [runnerId, leaseSecs, leaseMs, statuses, filterId] = params;
      const candidates = state.requests
        .filter((r) => (statuses || LIVE).includes(r.status))
        .filter((r) => (filterId == null ? true : (t.includes('and id = $5') ? r.id === String(filterId) : r.shop_id === String(filterId))))
        .filter((r) => r.status === 'queued' || r.claimed_by == null || r.claimed_by === runnerId || expired(r));
      const row = candidates[0];
      if (!row) return { rows: [] };
      const nowMs = now().getTime();
      row.status = 'running';
      row.claimed_by = runnerId;
      row.claimed_at = now();
      row.last_error = null;
      row.progress = { ...row.progress, _lease: {
        runner_id: runnerId,
        claimed_at: new Date(nowMs).toISOString(),
        heartbeat_at: new Date(nowMs).toISOString(),
        expires_at: new Date(nowMs + Number(leaseSecs) * 1000).toISOString(),
        lease_ms: Number(leaseMs),
      } };
      return { rows: [clone(row)] };
    }

    // ---- heartbeat ----------------------------------------------------
    if (t.includes("jsonb_build_object( 'runner_id', $1, 'heartbeat_at'")) {
      const [runnerId, id, leaseSecs, leaseMs] = params;
      const row = state.requests.find((r) => r.id === String(id));
      if (!row || row.claimed_by !== runnerId || !leaseOf(row) || leaseOf(row).runner_id !== runnerId) return { rows: [] };
      const nowMs = now().getTime();
      row.progress._lease = { ...row.progress._lease, runner_id: runnerId, heartbeat_at: new Date(nowMs).toISOString(), expires_at: new Date(nowMs + Number(leaseSecs) * 1000).toISOString(), lease_ms: Number(leaseMs) };
      return { rows: [{ expires_at: row.progress._lease.expires_at }] };
    }

    // ---- writeProgress ------------------------------------------------
    if (t.startsWith('update asdair.browser_build_request set progress = $3::jsonb')) {
      const [runnerId, id, json, status, lastError] = params;
      const row = state.requests.find((r) => r.id === String(id));
      if (!row || row.claimed_by !== runnerId || !leaseOf(row) || leaseOf(row).runner_id !== runnerId) return { rows: [] };
      row.progress = { ...JSON.parse(json), _lease: row.progress._lease };
      if (status) row.status = status;
      row.last_error = lastError ?? null;
      return { rows: [clone(row)] };
    }

    // ---- release ------------------------------------------------------
    if (t.includes("set status = case when status in ('complete','failed','cancelled')")) {
      const [runnerId, id, reason] = params;
      const row = state.requests.find((r) => r.id === String(id));
      if (!row || row.claimed_by !== runnerId) return { rows: [] };
      if (!['complete', 'failed', 'cancelled'].includes(row.status)) row.status = 'queued';
      row.claimed_by = null;
      const { _lease, ...rest } = row.progress;
      void _lease;
      row.progress = { ...rest, _released_at: now().toISOString(), _released_reason: reason ?? null };
      return { rows: [{ id: row.id, status: row.status }] };
    }

    // ---- finish -------------------------------------------------------
    if (t.startsWith('update asdair.browser_build_request set status = $3, progress = coalesce($4::jsonb, progress)')) {
      const [runnerId, id, status, json, lastError] = params;
      const row = state.requests.find((r) => r.id === String(id));
      if (!row || row.claimed_by !== runnerId || !leaseOf(row) || leaseOf(row).runner_id !== runnerId) return { rows: [] };
      const next = json ? JSON.parse(json) : { ...row.progress };
      delete next._lease;
      row.progress = next;
      row.status = status;
      row.last_error = lastError ?? null;
      row.claimed_by = null;
      row.finished_at = now();
      return { rows: [clone(row)] };
    }

    // ---- reads / side tables ------------------------------------------
    if (t.startsWith('select status from asdair.browser_build_request where id')) {
      const row = state.requests.find((r) => r.id === String(params[0]));
      return { rows: row ? [{ status: row.status }] : [] };
    }
    if (t.startsWith('select id, household_id, shop_ref, status, list_id from asdair.shop')) {
      const s = state.shops.find((x) => x.id === String(params[0]));
      return { rows: s ? [s] : [] };
    }
    if (t.startsWith('update asdair.shop set status')) {
      const [id, from, to] = params;
      const s = state.shops.find((x) => x.id === String(id) && x.status === from);
      if (!s) return { rows: [] };
      s.status = to;
      return { rows: [{ id: s.id, status: s.status }] };
    }
    if (t.startsWith('insert into asdair.shop_event')) { state.events.push(params); return { rows: [] }; }
    if (t.startsWith('insert into asdair.pending_action')) { state.pendingActions.push(params); return { rows: [] }; }
    if (t.startsWith('select id, shop_id, status, claimed_by, progress')) {
      const rows = params.length ? state.requests.filter((r) => r.id === String(params[0])) : state.requests;
      return { rows: rows.map((r) => ({ ...clone(r), lease_expired: expired(r), db_now: now() })) };
    }

    throw new Error('fake store received an unrecognised statement:\n' + t.slice(0, 200));
  }

  query.end = async () => {};
  query.state = state;
  return query;
}

/** A browser session stand-in that records what it was asked to do. */
function makeFakeSession(overrides = {}) {
  const calls = [];
  const record = (name) => (...args) => { calls.push({ name, args }); return Promise.resolve({ ok: true, added: true, product_ref: args[0], qty_after: 1 }); };
  const s = {
    calls,
    open: async () => s,
    close: () => { calls.push({ name: 'close', args: [] }); },
    state: async () => ({ url: 'https://www.asda.com/groceries', reauth_required: false, rate_limited: false }),
    open_groceries: async () => ({ url: 'https://www.asda.com/groceries', reauth_required: false }),
    open_trolley: record('open_trolley'),
    open_regulars: record('open_regulars'),
    locate_product: record('locate_product'),
    add_known_product: record('add_known_product'),
    search: async (t) => { calls.push({ name: 'search', args: [t] }); return { term: t, results: [] }; },
    select_search_result: record('select_search_result'),
    set_quantity: record('set_quantity'),
    read_quantity: async (r) => { calls.push({ name: 'read_quantity', args: [r] }); return { product_ref: r, qty: 0 }; },
    add_to_favourites: record('add_to_favourites'),
    report_unavailable: record('report_unavailable'),
    read_basket_line_count: record('read_basket_line_count'),
    read_estimated_total: record('read_estimated_total'),
    read_basket: async () => { calls.push({ name: 'read_basket', args: [] }); return { product_count: '2', order_total: '4.50', item_count: '3', products: [] }; },
    ...overrides,
  };
  return s;
}

/** A control channel stand-in with a settable directive. */
function makeFakeControl(directive = 'run') {
  const c = { directive, read: () => ({ directive: c.directive, at: null, by: 'test', note: null, source: '(fake)' }) };
  return c;
}

module.exports = { makeFakeStore, makeFakeSession, makeFakeControl };
