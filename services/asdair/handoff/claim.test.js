// =====================================================================
// BUILD-015 AsdAIr - handoff/claim.test.js
//
// THE ONE THING THAT MUST NEVER HAPPEN: two writers against Warwick's live
// ASDA trolley. THE OTHER THING THAT MUST NEVER HAPPEN: completion state lost
// across a restart or a repeated handoff.
//
// FULLY OFFLINE against test/fakeRequestStore.js, which reproduces the PROTOCOL
// and NOT the SQL. Read that file's honest-scope header before trusting a green
// here: the atomicity of `for update skip locked` and the partial unique index
// bbr_one_live_per_shop are properties of Postgres and are not re-proven by any
// in-memory fake.
// =====================================================================
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const { buildHandoff } = require('./buildHandoff');
const {
  openHandoff, claimHandoff, heartbeat, reportProgress, releaseHandoff, completeHandoff, peekHandoff,
  LeaseLostError, LiveWriterError, AlreadyCompleteError, DEFAULT_LEASE_MS,
} = require('./claim');
const { makeFakeStore } = require('./test/fakeRequestStore');
const { basePacket, goodReport } = require('./test/fixtures');

const SHOP = 42;

/** A store with a clock we control, so lease expiry is testable without waiting. */
function harness(opts = {}) {
  let t = Date.UTC(2026, 7, 9, 9, 0, 0);
  const store = makeFakeStore({ ...opts, now: () => new Date(t) });
  return {
    ...store,
    now: () => t,
    advance: (ms) => { t += ms; },
    open: (handoff, extra = {}) => openHandoff(store.query, { shopId: SHOP, handoff, now: () => t, ...extra }),
  };
}

const liveCount = (h) => h.state.requests.filter((r) => ['queued', 'claimed', 'running'].includes(r.status)).length;

// ---------------------------------------------------------------------
// ONE LIVE REQUEST PER SHOP
// ---------------------------------------------------------------------

test('OPEN: the first handoff creates exactly one live request carrying the fingerprint', async () => {
  const h = harness();
  const handoff = buildHandoff(basePacket());
  const r = await h.open(handoff);
  assert.equal(r.created, true);
  assert.equal(r.resumed, false);
  assert.equal(liveCount(h), 1);
  assert.equal(r.request.progress.handoff.packet_fingerprint, handoff.packet_fingerprint);
  assert.deepEqual(r.request.progress.handoff.expected, { distinct_products: 4, total_units: 7 });
});

test('A SECOND HANDOFF FOR THE SAME SHOP CANNOT CREATE A SECOND LIVE CLAIM', async () => {
  const h = harness();
  const handoff = buildHandoff(basePacket());

  const first = await h.open(handoff);
  const second = await h.open(handoff);
  const third = await h.open(buildHandoff(basePacket()));   // rebuilt, identical

  assert.equal(first.created, true);
  assert.equal(second.created, false);
  assert.equal(second.resumed, true, 'a repeated handoff must RESUME, not queue again');
  assert.equal(third.resumed, true);
  assert.equal(second.request.id, first.request.id);
  assert.equal(third.request.id, first.request.id);
  assert.equal(liveCount(h), 1, 'a second live request was created - that is two writers waiting to happen');
  assert.equal(h.state.requests.length, 1, 'a second ROW was created at all');
});

test('SUPERSEDE: a NEW packet with no live writer re-points the SAME row, never a second one', async () => {
  const h = harness();
  const first = buildHandoff(basePacket());
  const replan = buildHandoff(basePacket({ expected_total_units: 8, lines: basePacket().lines.map((l, i) => (i === 0 ? { ...l, required_quantity: 3 } : l)) }));
  assert.notEqual(first.packet_fingerprint, replan.packet_fingerprint);

  const a = await h.open(first);
  const b = await h.open(replan);
  assert.equal(b.superseded, true);
  assert.equal(b.request.id, a.request.id, 'supersession must happen IN PLACE');
  assert.equal(liveCount(h), 1);
  assert.equal(b.request.progress.handoff.packet_fingerprint, replan.packet_fingerprint);
  assert.equal(b.request.progress._superseded_from, first.packet_fingerprint, 'what it superseded must be recorded, not erased');
});

test('SUPERSEDE IS REFUSED WHILE A WRITER HOLDS A LIVE LEASE', async () => {
  const h = harness();
  const first = buildHandoff(basePacket());
  const replan = buildHandoff(basePacket({ expected_total_units: 8, lines: basePacket().lines.map((l, i) => (i === 0 ? { ...l, required_quantity: 3 } : l)) }));

  await h.open(first);
  const claimed = await claimHandoff(h.query, { shopId: SHOP, writerId: 'sonnet-A' });
  assert.ok(claimed, 'the first writer should have claimed');

  await assert.rejects(() => h.open(replan), (e) => {
    assert.ok(e instanceof LiveWriterError, `expected LiveWriterError, got ${e.name}`);
    assert.equal(e.detail.claimedBy, 'sonnet-A');
    return true;
  });
  // the packet under the live writer is UNCHANGED
  const row = await peekHandoff(h.query, { requestId: claimed.id });
  assert.equal(row.progress.handoff.packet_fingerprint, first.packet_fingerprint);
});

test('A COMPLETED SHOP IS NOT SILENTLY REOPENED, and its completion state survives', async () => {
  const h = harness();
  const handoff = buildHandoff(basePacket());
  await h.open(handoff);
  const claimed = await claimHandoff(h.query, { shopId: SHOP, writerId: 'sonnet-A' });
  const report = goodReport(handoff.packet_fingerprint);
  await completeHandoff(h.query, { requestId: claimed.id, writerId: 'sonnet-A', packetFingerprint: handoff.packet_fingerprint, report });

  await assert.rejects(() => h.open(handoff), (e) => {
    assert.ok(e instanceof AlreadyCompleteError, `expected AlreadyCompleteError, got ${e.name}`);
    assert.equal(e.detail.storedFingerprint, handoff.packet_fingerprint);
    return true;
  });

  const rows = await peekHandoff(h.query, { shopId: SHOP });
  assert.equal(rows.length, 1, 'no second row may appear behind a completed one');
  assert.equal(rows[0].status, 'complete');
  assert.equal(rows[0].progress.report.basket.total_units, 7, 'the stored completion report was lost');
});

// ---------------------------------------------------------------------
// THE TWO-WRITERS GUARD
// ---------------------------------------------------------------------

test('TWO WRITERS: the second claimer gets NOTHING while the first lease is live', async () => {
  const h = harness();
  await h.open(buildHandoff(basePacket()));

  const a = await claimHandoff(h.query, { shopId: SHOP, writerId: 'sonnet-A' });
  const b = await claimHandoff(h.query, { shopId: SHOP, writerId: 'sonnet-B' });

  assert.ok(a, 'the first writer must win the claim');
  assert.equal(a.claimed_by, 'sonnet-A');
  assert.equal(b, null, 'A SECOND WRITER CLAIMED A LIVE REQUEST. This is the failure that cannot happen once.');
});

test('TWO WRITERS: a re-claim by the SAME writer is safe (a restart resumes, it does not duplicate)', async () => {
  const h = harness();
  await h.open(buildHandoff(basePacket()));
  const a1 = await claimHandoff(h.query, { shopId: SHOP, writerId: 'sonnet-A' });
  const a2 = await claimHandoff(h.query, { shopId: SHOP, writerId: 'sonnet-A' });
  assert.ok(a2);
  assert.equal(a2.id, a1.id);
  assert.equal(liveCount(h), 1);
});

test('BOUNDED EXPIRY: a killed writer does not strand the request forever', async () => {
  const h = harness();
  await h.open(buildHandoff(basePacket()));
  const a = await claimHandoff(h.query, { shopId: SHOP, writerId: 'sonnet-A', leaseMs: DEFAULT_LEASE_MS });
  assert.ok(a);

  assert.equal(await claimHandoff(h.query, { shopId: SHOP, writerId: 'sonnet-B' }), null, 'stealable before expiry');
  h.advance(DEFAULT_LEASE_MS + 1000);            // sonnet-A was killed with -9
  const b = await claimHandoff(h.query, { shopId: SHOP, writerId: 'sonnet-B' });
  assert.ok(b, 'an EXPIRED lease must be claimable, or a crash blocks the shop forever');
  assert.equal(b.id, a.id, 'it must be the same request, resumed - not a new one');
  assert.equal(b.claimed_by, 'sonnet-B');
});

test('FENCING: the stale writer stops at its very next write', async () => {
  const h = harness();
  const handoff = buildHandoff(basePacket());
  await h.open(handoff);
  const a = await claimHandoff(h.query, { shopId: SHOP, writerId: 'sonnet-A' });
  await reportProgress(h.query, { requestId: a.id, writerId: 'sonnet-A', progress: { done: [1] } });

  h.advance(DEFAULT_LEASE_MS + 1000);            // sonnet-A was suspended
  const b = await claimHandoff(h.query, { shopId: SHOP, writerId: 'sonnet-B' });
  assert.ok(b);

  await assert.rejects(
    () => reportProgress(h.query, { requestId: a.id, writerId: 'sonnet-A', progress: { done: [1, 2] } }),
    LeaseLostError,
    'a stale writer kept writing - it would still be clicking in the browser',
  );
  await assert.rejects(() => heartbeat(h.query, { requestId: a.id, writerId: 'sonnet-A' }), LeaseLostError);
  await assert.rejects(
    () => completeHandoff(h.query, { requestId: a.id, writerId: 'sonnet-A', packetFingerprint: handoff.packet_fingerprint, report: goodReport(handoff.packet_fingerprint) }),
    LeaseLostError,
  );
});

test('FENCING: a writer cannot extend its own lease by writing progress', async () => {
  const h = harness();
  await h.open(buildHandoff(basePacket()));
  const a = await claimHandoff(h.query, { shopId: SHOP, writerId: 'sonnet-A' });
  const originalExpiry = a.progress._lease.expires_at;

  h.advance(1000);
  const after = await reportProgress(h.query, {
    requestId: a.id,
    writerId: 'sonnet-A',
    progress: { done: [1], _lease: { runner_id: 'sonnet-A', expires_at: '2999-01-01T00:00:00.000Z' } },
  });
  assert.equal(after.progress._lease.expires_at, originalExpiry, 'a writer forged its own lease expiry through progress');
});

test('FENCING: a writer cannot re-point the packet by writing progress', async () => {
  const h = harness();
  const handoff = buildHandoff(basePacket());
  await h.open(handoff);
  const a = await claimHandoff(h.query, { shopId: SHOP, writerId: 'sonnet-A' });
  const after = await reportProgress(h.query, {
    requestId: a.id,
    writerId: 'sonnet-A',
    progress: { done: [1], handoff: { packet_fingerprint: 'sha256:forged' } },
  });
  assert.equal(after.progress.handoff.packet_fingerprint, handoff.packet_fingerprint, 'the packet binding was overwritten from a caller in-memory value');
});

// ---------------------------------------------------------------------
// COMPLETION STATE IS NEVER LOST
// ---------------------------------------------------------------------

test('COMPLETION against a SUPERSEDED packet is REFUSED, not silently accepted', async () => {
  const h = harness();
  const first = buildHandoff(basePacket());
  const replan = buildHandoff(basePacket({ expected_total_units: 8, lines: basePacket().lines.map((l, i) => (i === 0 ? { ...l, required_quantity: 3 } : l)) }));

  await h.open(first);
  await h.open(replan);                                    // supersedes in place
  const c = await claimHandoff(h.query, { shopId: SHOP, writerId: 'sonnet-A' });

  await assert.rejects(
    () => completeHandoff(h.query, { requestId: c.id, writerId: 'sonnet-A', packetFingerprint: first.packet_fingerprint, report: goodReport(first.packet_fingerprint) }),
    (e) => { assert.equal(e.detail.code, 'SUPERSEDED_PACKET'); return true; },
  );
  const row = await peekHandoff(h.query, { requestId: c.id });
  assert.equal(row.status, 'running', 'the refused completion must not have moved the request');
  assert.equal(row.progress.report, undefined, 'a superseded report must not be stored');
});

test('COMPLETION IS IDEMPOTENT: a retried completion neither errors nor double-writes', async () => {
  const h = harness();
  const handoff = buildHandoff(basePacket());
  await h.open(handoff);
  const c = await claimHandoff(h.query, { shopId: SHOP, writerId: 'sonnet-A' });
  const report = goodReport(handoff.packet_fingerprint);

  const one = await completeHandoff(h.query, { requestId: c.id, writerId: 'sonnet-A', packetFingerprint: handoff.packet_fingerprint, report });
  assert.equal(one.alreadyComplete, false);
  assert.equal(one.request.status, 'complete');

  const two = await completeHandoff(h.query, { requestId: c.id, writerId: 'sonnet-A', packetFingerprint: handoff.packet_fingerprint, report });
  assert.equal(two.alreadyComplete, true, 'a retried completion must be recognised, not treated as a new one');
  assert.equal(two.request.progress.report.basket.total_units, 7, 'completion state was lost on retry');
  assert.equal(h.state.requests.length, 1);
});

test('RELEASE hands the browser back without abandoning progress', async () => {
  const h = harness();
  await h.open(buildHandoff(basePacket()));
  const a = await claimHandoff(h.query, { shopId: SHOP, writerId: 'sonnet-A' });
  await reportProgress(h.query, { requestId: a.id, writerId: 'sonnet-A', progress: { done: [1, 2] } });

  const rel = await releaseHandoff(h.query, { requestId: a.id, writerId: 'sonnet-A', reason: 'human took the browser' });
  assert.equal(rel.status, 'queued', 'released work has no owner - that is what queued means');
  assert.equal(rel.claimed_by, null);
  assert.deepEqual(rel.progress.done, [1, 2], 'releasing is not abandoning');
  assert.equal(rel.progress._lease, undefined);

  const b = await claimHandoff(h.query, { shopId: SHOP, writerId: 'sonnet-B' });
  assert.ok(b, 'a released request must be immediately claimable');
  assert.deepEqual(b.progress.done, [1, 2]);
});

test('RESTART: a fresh writer resumes the same request with progress intact', async () => {
  const h = harness();
  const handoff = buildHandoff(basePacket());
  await h.open(handoff);
  const a = await claimHandoff(h.query, { shopId: SHOP, writerId: 'sonnet-A' });
  await reportProgress(h.query, { requestId: a.id, writerId: 'sonnet-A', progress: { done: [1, 2, 3] } });

  h.advance(DEFAULT_LEASE_MS + 1);                      // the machine rebooted
  const resumed = await h.open(handoff);                // the handoff is issued again
  assert.equal(resumed.resumed, true);
  assert.equal(resumed.request.id, a.id);
  assert.deepEqual(resumed.request.progress.done, [1, 2, 3], 'progress did not survive the restart');

  const b = await claimHandoff(h.query, { shopId: SHOP, writerId: 'sonnet-B' });
  assert.equal(b.id, a.id);
  assert.deepEqual(b.progress.done, [1, 2, 3]);
  assert.equal(liveCount(h), 1);
});

test('The claim statement really is the guarded one - the SQL carries the fence and the skip-locked', async () => {
  const h = harness();
  await h.open(buildHandoff(basePacket()));
  await claimHandoff(h.query, { shopId: SHOP, writerId: 'sonnet-A' });
  const claimSql = h.state.calls.map((c) => c.text).find((t) => t.includes("set status = 'running'"));
  assert.ok(claimSql.includes('for update skip locked'), 'the claim is not atomic');
  assert.ok(claimSql.includes('limit 1'));

  const a = h.state.requests[0];
  await reportProgress(h.query, { requestId: a.id, writerId: 'sonnet-A', progress: {} });
  const progressSql = h.state.calls.map((c) => c.text).find((t) => t.includes('set progress = $3::jsonb'));
  assert.ok(progressSql.includes('claimed_by = $1'), 'the progress write is not fenced on claimed_by');
  assert.ok(progressSql.includes("progress->'_lease'->>'runner_id' = $1"), 'the progress write is not fenced on the lease holder');
});

// ---------------------------------------------------------------------
// THE LEASE IS SIZED FOR A HUMAN (Warwick, 2026-08-09)
//
// "Retain lease/fencing but NOT a 45-second CDP lease for a human-paced step."
//
// The bound is asserted against literals held HERE, not read from the module,
// so restoring the CDP value in claim.js fails this test rather than silently
// re-opening a window in which a second writer becomes eligible for a trolley a
// person is standing in front of.
// ---------------------------------------------------------------------

test('THE LEASE FITS A PERSON: the supervised handoff TTL is human-paced, not the 45s CDP lease', () => {
  const FORTY_MINUTES = 40 * 60_000;
  const FOUR_HOURS = 4 * 60 * 60_000;

  assert.ok(DEFAULT_LEASE_MS >= FORTY_MINUTES,
    `the supervised lease is ${DEFAULT_LEASE_MS}ms. Warwick may take forty minutes, be interrupted, or come `
    + 'back after a coffee; a lease that expires mid-shop lets a SECOND writer at the same trolley, which is a '
    + 'data-corruption defect rather than an inconvenience.');
  assert.notEqual(DEFAULT_LEASE_MS, 45_000,
    'that is the CDP runner\'s lease, and it belongs to a machine process with a heartbeat - not to a human step');
  assert.ok(DEFAULT_LEASE_MS <= FOUR_HOURS,
    'expiry must stay BOUNDED: an abandoned session has to self-heal rather than wedge the request for ever');
});

test('THE LEASE STILL EXPIRES: a lapsed human lease is recoverable, and a live one is never stealable', async () => {
  const h = harness();
  await h.open(buildHandoff(basePacket()));
  const first = await claimHandoff(h.query, { shopId: SHOP, writerId: 'sonnet-A' });

  // VISIBLE: the expiry is on the durable row, written from the DATABASE clock.
  assert.ok(first.progress._lease.expires_at, 'the expiry must be readable off the request');

  // NOT STEALABLE WHILE LIVE - the whole point of retaining the lease.
  assert.equal(await claimHandoff(h.query, { shopId: SHOP, writerId: 'sonnet-B' }), null,
    'a live human lease must not be stolen, however long it is');

  // RECOVERABLE once it genuinely lapses.
  h.advance(DEFAULT_LEASE_MS + 1000);
  const second = await claimHandoff(h.query, { shopId: SHOP, writerId: 'sonnet-B' });
  assert.ok(second, 'an abandoned lease must still be recoverable after it expires');
  assert.equal(second.progress._lease.runner_id, 'sonnet-B');
});

test('The lease key is the SAME one browser-runner/lease.cjs uses - two systems must be able to see each other', async () => {
  const h = harness();
  await h.open(buildHandoff(basePacket()));
  const a = await claimHandoff(h.query, { shopId: SHOP, writerId: 'sonnet-A' });
  assert.equal(a.progress._lease.runner_id, 'sonnet-A',
    "the lease must be stored under progress._lease.runner_id. A different key would make the excluded CDP runner's lease invisible to this module, and this module's lease invisible to it - which IS two writers.");
});
