// =====================================================================
// WO-2026-08-18-B15-RUNTIME - THE EXECUTABLE PROOFS FOR GAPS 3 AND 7.
//
// A FAKE REQUEST STORE, NOT A DATABASE. What is being proven here is the
// CONSUMER's behaviour - that a queued row causes a run with no shell, that a
// killed process leaves the request re-claimable, and that the second process
// does not re-do the first one's work. The SQL itself is lease.cjs's and is
// proven where it lives.
//
// The fake implements the two properties of the real lease that this consumer
// depends on, and nothing else:
//   * one claimer at a time
//   * an EXPIRED lease is claimable again
// If either of those is wrong in the fake, the last test in this file fails,
// which is why the fake models expiry rather than assuming it.
// =====================================================================
'use strict';

const { test } = require('node:test');
const assert = require('node:assert');

const { buildManifest, consumeOneBrowserBuildRequest } = require('./consume-request.cjs');

// ---------------------------------------------------------------------
// a fake asdair.browser_build_request
// ---------------------------------------------------------------------

function fakeStore(rows = []) {
  const store = { rows: rows.map((r) => ({ progress: {}, status: 'queued', ...r })), now: Date.now() };
  const find = (id) => store.rows.find((r) => String(r.id) === String(id));
  const fenced = (row, runnerId) => row
    && row.claimed_by === runnerId
    && row.progress && row.progress._lease && row.progress._lease.runner_id === runnerId;

  // Routed on the distinguishing clause of each statement in lease.cjs. Each
  // branch models the ONE property the consumer depends on; the SQL itself is
  // proven where it lives.
  store.query = async (text, params) => {
    // -- claim ------------------------------------------------------------
    if (/for update skip locked/.test(text)) {
      const [runnerId, leaseSecs] = params;
      const claimable = store.rows.find((r) => {
        if (!['queued', 'running'].includes(r.status)) return false;
        if (r.status === 'queued' || !r.claimed_by) return true;
        if (r.claimed_by === runnerId) return true;
        const exp = r.progress && r.progress._lease && r.progress._lease.expires_at;
        return exp != null && exp < store.now;
      });
      if (!claimable) return { rows: [] };
      claimable.status = 'running';
      claimable.claimed_by = runnerId;
      claimable.progress = {
        ...claimable.progress,
        _lease: { runner_id: runnerId, expires_at: store.now + Number(leaseSecs) * 1000 },
      };
      return { rows: [{ ...claimable }] };
    }
    // -- finish (terminal) ------------------------------------------------
    if (/finished_at = now\(\)/.test(text)) {
      const row = find(params[1]);
      if (!fenced(row, params[0])) return { rows: [] };
      row.status = params[2];
      row.last_error = params[4] || null;
      row.claimed_by = null;
      row.finished_at = store.now;
      if (params[3]) row.progress = { ...JSON.parse(params[3]) };
      return { rows: [{ ...row }] };
    }
    // -- release ----------------------------------------------------------
    if (/case when status in \('complete','failed','cancelled'\)/.test(text)) {
      const row = find(params[1]);
      if (!row || row.claimed_by !== params[0]) return { rows: [] };
      if (!['complete', 'failed', 'cancelled'].includes(row.status)) row.status = 'queued';
      row.claimed_by = null;
      const { _lease, ...rest } = row.progress || {};
      row.progress = { ...rest, _released_reason: params[2] };
      return { rows: [{ ...row }] };
    }
    // -- heartbeat --------------------------------------------------------
    if (/heartbeat_at/.test(text)) {
      const row = find(params[1]);
      if (!fenced(row, params[0])) return { rows: [] };
      row.progress._lease.expires_at = store.now + Number(params[2]) * 1000;
      return { rows: [{ expires_at: row.progress._lease.expires_at }] };
    }
    // -- writeProgress ----------------------------------------------------
    if (/set\s+progress\s+= \$3::jsonb/.test(text)) {
      const row = find(params[1]);
      if (!fenced(row, params[0])) return { rows: [] };
      row.progress = { ...JSON.parse(params[2]), _lease: row.progress._lease };
      if (params[3]) row.status = params[3];
      row.last_error = params[4] || null;
      return { rows: [{ ...row }] };
    }
    throw new Error(`the fake store does not model this statement:\n${text}`);
  };

  return store;
}

const SHOP = { id: 7, shop_ref: 'SHOP-2026-08-24', household_id: 1 };

function io(store, overrides = {}) {
  return {
    query: store.query,
    loadShop: async () => ({
      shop: SHOP,
      lines: [
        { line_no: 1, raw_reading: 'milk', quantity: 2, status: 'matched', canonical_name: 'ASDA British Semi Skimmed Milk 4 Pints', asda_product_id: '111' },
        { line_no: 2, raw_reading: 'tresemme conditioner', quantity: null, status: 'matched', canonical_name: 'TRESemme Rich Moisture HAIR CONDITIONER 680 ml', asda_product_id: null },
        { line_no: 3, raw_reading: 'scribble', quantity: null, status: 'unreadable' },
      ],
    }),
    loadCatalogue: async () => ({ rows: [] }),
    loadRules: async () => ({ rows: [] }),
    runBasket: async () => ({ basketReady: true, blockers: [], reconciliation: { summary: {}, ready: { ready: true } } }),
    announce: async () => {},
    ...overrides,
  };
}

// =====================================================================
// GAP 3 - A QUEUED REQUEST CAUSES A RUN. NO SHELL, NO REQUEST-ID LOOKUP.
// =====================================================================

test('a queued browser build request is claimed and run by the pass itself', async () => {
  const store = fakeStore([{ id: 42, shop_id: 7 }]);
  let invokedWith = null;
  const out = await consumeOneBrowserBuildRequest(io(store, {
    runBasket: async (opts) => { invokedWith = opts; return { basketReady: true, blockers: [], reconciliation: { ready: { ready: true } } }; },
  }));

  assert.ok(out, 'the request must be picked up');
  assert.strictEqual(out.requestId, 42);
  assert.ok(invokedWith, 'the executor must actually be invoked');
  assert.strictEqual(invokedWith.manifest.shop_ref, 'SHOP-2026-08-24');
  assert.strictEqual(store.rows[0].status, 'complete');
});

test('nothing queued is an ordinary answer, not an error', async () => {
  const store = fakeStore([]);
  assert.strictEqual(await consumeOneBrowserBuildRequest(io(store)), null);
});

test('the manifest is built from the durable rows, not from a hand-made file', async () => {
  const m = buildManifest({
    shop: SHOP,
    lines: [
      { line_no: 2, raw_reading: 'tresemme conditioner', quantity: null, status: 'matched', canonical_name: 'TRESemme Rich Moisture HAIR CONDITIONER 680 ml', asda_product_id: null },
      { line_no: 1, raw_reading: 'milk', quantity: 2, status: 'matched', canonical_name: 'ASDA British Semi Skimmed Milk 4 Pints', asda_product_id: '111' },
      { line_no: 3, raw_reading: 'scribble', quantity: null, status: 'unreadable' },
    ],
  });
  assert.strictEqual(m.shop_ref, 'SHOP-2026-08-24');
  assert.strictEqual(m.line_count, 2, 'an unreadable line is not shopped');
  assert.strictEqual(m.lines[0].n, 1, 'lines are ordered');
  // THE CANONICAL ASDA DESCRIPTION IS THE IDENTITY, from our own row by id.
  assert.strictEqual(m.lines[1].product, 'TRESemme Rich Moisture HAIR CONDITIONER 680 ml');
  assert.strictEqual(m.lines[1].asda_product_id, null, 'and a missing id does not stop the line');
});

test('a quantity nobody wrote down is filled in explicitly, and says where it came from', () => {
  const m = buildManifest({
    shop: SHOP,
    lines: [
      { line_no: 1, raw_reading: 'eggs', quantity: null, status: 'matched', matched_regular_id: 5 },
      { line_no: 2, raw_reading: 'bread', quantity: null, status: 'matched' },
    ],
    catalogue: { rows: [{ id: 5, name: 'ASDA Free Range Large Eggs 6 Pack', typical_qty: 2 }] },
  });
  assert.strictEqual(m.lines[0].qty, 2);
  assert.match(m.lines[0].qty_basis, /household typical quantity/);
  assert.strictEqual(m.lines[1].qty, 1);
  assert.match(m.lines[1].qty_basis, /defaulted to 1/);
});

test('"Mum\'s basket is ready" is announced only when the reconciliation is truthful', async () => {
  const said = [];
  const ok = fakeStore([{ id: 1, shop_id: 7 }]);
  await consumeOneBrowserBuildRequest(io(ok, { announce: async (p) => said.push(p) }));
  assert.strictEqual(said[0].kind, 'basket_ready');
  assert.strictEqual(said[0].text, "Mum's basket is ready.");

  said.length = 0;
  const blocked = fakeStore([{ id: 2, shop_id: 7 }]);
  await consumeOneBrowserBuildRequest(io(blocked, {
    announce: async (p) => said.push(p),
    runBasket: async () => ({ basketReady: false, blockers: [{ kind: 'quantity-not-established', line: 4 }], reconciliation: { ready: { ready: false } } }),
  }));
  assert.strictEqual(said[0].kind, 'basket_not_ready', 'a blocked basket must NOT be announced as ready');
  assert.notStrictEqual(said[0].text, "Mum's basket is ready.");
  assert.strictEqual(said[0].blockers.length, 1, 'and it must not go quiet either');
  assert.strictEqual(blocked.rows[0].status, 'failed');
});

// =====================================================================
// GAP 7 - KILL IT AND SOMETHING ELSE PICKS IT UP
// =====================================================================

test('a process that dies mid-shop leaves the request re-claimable, and the next one resumes it', async () => {
  const store = fakeStore([{ id: 99, shop_id: 7 }]);

  // ---- process 1: claims, does two lines, then is killed ------------------
  let flushed = null;
  await assert.rejects(consumeOneBrowserBuildRequest(io(store, {
    runBasket: async (opts) => {
      await opts.onProgress({ completed_steps: ['L01-add', 'L01-qty'] });
      flushed = true;
      throw Object.assign(new Error('process killed mid-shop'), { killed: true });
    },
  })));
  assert.ok(flushed, 'progress must reach the durable row BEFORE the process dies');
  assert.deepStrictEqual(store.rows[0].progress.executor.completed_steps, ['L01-add', 'L01-qty']);

  // ---- the lease expires, exactly as it would on the database clock -------
  store.now += 10 * 60 * 1000;

  // ---- process 2: a FRESH runtime, no shared memory, no local file --------
  let resumedWith = null;
  const out = await consumeOneBrowserBuildRequest(io(store, {
    runBasket: async (opts) => { resumedWith = opts.resumeFrom; return { basketReady: true, blockers: [], reconciliation: { ready: { ready: true } } }; },
  }));

  assert.ok(out, 'the abandoned request must be re-claimed by the next process');
  assert.strictEqual(out.requestId, 99);
  assert.deepStrictEqual(resumedWith.completed_steps, ['L01-add', 'L01-qty'],
    'the second process must be told what the first one already did, or it re-adds it');
  assert.notStrictEqual(out.runnerId, undefined);
});

test('a LIVE lease is not stolen - two pollers do not both shop the same trolley', async () => {
  const store = fakeStore([{ id: 5, shop_id: 7 }]);
  let released;
  const hold = new Promise((r) => { released = r; });

  const first = consumeOneBrowserBuildRequest(io(store, {
    runBasket: async () => { await hold; return { basketReady: true, blockers: [], reconciliation: { ready: { ready: true } } }; },
  }));

  // While the first still holds an unexpired lease, a second pass finds nothing.
  const second = await consumeOneBrowserBuildRequest(io(store));
  assert.strictEqual(second, null, 'a live lease must not be claimable');

  released();
  await first;
});
