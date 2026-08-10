'use strict';
const { test } = require('node:test');
const assert = require('node:assert');
const { Runner, parseArgs } = require('./runner.js');
const { makeFakeStore, makeFakeSession, makeFakeControl } = require('./test/fakeRequestStore.cjs');
const { ReauthRequiredError, RateLimitedError } = require('./browser.cjs');

const PLAN = [
  { step_id: 's1', command: 'add_known_product', product_ref: '489747', origin: 'regular', name: 'Cravendale 2L' },
  { step_id: 's2', command: 'select_search_result', term: 'mixed herbs', product_ref: '544334', origin: 'searched', name: 'Mixed Herbs 12g' },
  { step_id: 's3', command: 'set_quantity', product_ref: '544334', qty: 2 },
];

function scenario({ plan = PLAN, progress = {}, directive = 'run', session, clock, options = {} } = {}) {
  const now = clock || (() => new Date());
  const query = makeFakeStore({
    requests: [{ id: 1, shop_id: 1, status: 'queued', progress: { plan, ...progress } }],
    shops: [{ id: 1, household_id: 1, shop_ref: 'SHOP-TEST', status: 'WAITING_FOR_BROWSER' }],
    now,
  });
  const logs = [];
  const ctl = makeFakeControl(directive);
  const sess = session || makeFakeSession();
  const runner = new Runner({
    query,
    makeSession: () => sess,
    controlChannel: ctl,
    log: (...a) => logs.push(a.join(' ')),
    runnerId: 'runner-A',
    options: { leaseMs: 5000, heartbeatMs: 60_000, pollMs: 5, interStepMs: 0, maxPauseMs: 500, ...options },
  });
  return { runner, query, logs, ctl, session: sess };
}

const commandsIssued = (s) => s.calls.map((c) => c.name).filter((n) => n !== 'close');

test('a clean run claims one request, executes the plan and stops at basket-ready', async () => {
  const { runner, query, session } = scenario();
  const res = await runner.run({});
  assert.strictEqual(res.outcome, 'basket_ready');
  assert.deepStrictEqual(res.summary.regulars_added, 1);
  assert.deepStrictEqual(res.summary.searched_added, 1);
  assert.strictEqual(res.summary.basket_product_count, 2);
  assert.strictEqual(res.summary.estimated_total, '4.50');
  assert.deepStrictEqual(commandsIssued(session), ['add_known_product', 'select_search_result', 'set_quantity', 'read_basket']);

  const row = query.state.requests[0];
  assert.strictEqual(row.status, 'complete');
  assert.strictEqual(row.claimed_by, null, 'the lease is given back when the request finishes');
  assert.ok(!row.progress._lease, 'and the lease is removed from the durable row');
  assert.strictEqual(query.state.shops[0].status, 'BASKET_READY');
});

test('nothing was ordered: the runner stopped at basket-ready and finished the request, not the shop', async () => {
  const { runner, query } = scenario();
  await runner.run({});
  assert.strictEqual(query.state.shops[0].status, 'BASKET_READY');
  assert.ok(!['ORDER_CONFIRMATION_RECEIVED', 'RECONCILED'].includes(query.state.shops[0].status));
});

test('a SECOND runner is refused while the first holds a live lease - never two writers', async () => {
  const clockAt = { t: Date.now() };
  const { runner, query } = scenario({ clock: () => new Date(clockAt.t) });
  assert.strictEqual(await runner.claim({}), true);

  const second = new Runner({
    query, makeSession: () => makeFakeSession(), controlChannel: makeFakeControl(),
    log: () => {}, runnerId: 'runner-B',
    options: { leaseMs: 5000, heartbeatMs: 60_000, pollMs: 5, waitMs: 0 },
  });
  assert.strictEqual(await second.claim({}), false, 'runner B must NOT get the lease');
  const res = await second.run({});
  assert.strictEqual(res.outcome, 'refused');
  assert.strictEqual(query.state.requests[0].claimed_by, 'runner-A', 'the lease is still runner A\'s');
});

test('a DEAD runner\'s claim is recovered once - and only once - the bounded lease expires', async () => {
  const clockAt = { t: Date.now() };
  const { runner, query } = scenario({ clock: () => new Date(clockAt.t) });
  await runner.claim({});
  runner.stopHeartbeat();                        // this process is now, in effect, dead

  const second = new Runner({
    query, makeSession: () => makeFakeSession(), controlChannel: makeFakeControl(),
    log: () => {}, runnerId: 'runner-B',
    options: { leaseMs: 5000, heartbeatMs: 60_000, pollMs: 5 },
  });
  assert.strictEqual(await second.claim({}), false, 'before expiry: refused');
  clockAt.t += 5001;                             // the lease window elapses
  assert.strictEqual(await second.claim({}), true, 'after expiry: recovered');
  assert.strictEqual(query.state.requests[0].claimed_by, 'runner-B');
});

test('RESTART: a fresh process reloads durable state and never repeats a completed add', async () => {
  const clockAt = { t: Date.now() };
  const { runner, query, session } = scenario({ clock: () => new Date(clockAt.t) });

  // First process: claim, do exactly one step, then die without releasing anything.
  await runner.claim({});
  runner.reconstruct({});
  runner.session = session;
  await runner.executeStep(runner.remaining[0], false);
  runner.stopHeartbeat();
  assert.deepStrictEqual(commandsIssued(session), ['add_known_product']);
  assert.strictEqual(query.state.requests[0].progress._completed_steps.length, 1);

  clockAt.t += 5001;                             // its lease expires

  // Second, independent process: same database row, nothing else carried over.
  const session2 = makeFakeSession();
  const second = new Runner({
    query, makeSession: () => session2, controlChannel: makeFakeControl(),
    log: () => {}, runnerId: 'runner-B',
    options: { leaseMs: 5000, heartbeatMs: 60_000, pollMs: 5, interStepMs: 0 },
  });
  const res = await second.run({});
  assert.strictEqual(res.outcome, 'basket_ready');
  assert.deepStrictEqual(commandsIssued(session2), ['select_search_result', 'set_quantity', 'read_basket'],
    'the completed add is NOT repeated by the restarted process');
  assert.strictEqual(res.summary.regulars_added, 1, 'and it is still counted exactly once');
});

test('a step that was IN FLIGHT at the moment of death is resolved by READING, never by clicking again', async () => {
  const clockAt = { t: Date.now() };
  const { query } = scenario({ clock: () => new Date(clockAt.t) });
  // Simulate: process died between the click and the commit.
  const row = query.state.requests[0];
  row.progress = { ...row.progress, _in_flight: 's1' };

  const session = makeFakeSession({ read_quantity: async (r) => ({ product_ref: r, qty: 1 }) });
  const seen = [];
  const wrapped = new Proxy(session, { get: (t, k) => (typeof t[k] === 'function' && k !== 'close' ? (...a) => { seen.push(k); return t[k](...a); } : t[k]) });
  const runner = new Runner({
    query, makeSession: () => wrapped, controlChannel: makeFakeControl(),
    log: () => {}, runnerId: 'runner-C',
    options: { leaseMs: 5000, heartbeatMs: 60_000, pollMs: 5, interStepMs: 0 },
  });
  const res = await runner.run({});
  assert.ok(seen.includes('read_quantity'), 'it read the live quantity');
  assert.ok(!seen.includes('add_known_product'), 'and it did NOT click add again');
  assert.strictEqual(res.summary.regulars_added, 1, 'the add that had landed is counted once');
});

test('PAUSE holds without releasing: no browser commands, lease retained, browser left usable', async () => {
  const { runner, query, logs, ctl, session } = scenario({ directive: 'pause' });
  let reads = 0;
  ctl.read = () => { reads += 1; return { directive: reads <= 3 ? 'pause' : 'resume' }; };

  const res = await runner.run({});
  assert.strictEqual(res.outcome, 'basket_ready');
  assert.ok(logs.some((l) => /PAUSED/.test(l)), 'it announced the pause');
  assert.ok(logs.some((l) => /resuming from the last durable checkpoint/.test(l)), 'and the resume');
  assert.strictEqual(query.state.requests[0].claimed_by, null, 'only because it FINISHED - it held the lease throughout the pause');
  assert.deepStrictEqual(commandsIssued(session), ['add_known_product', 'select_search_result', 'set_quantity', 'read_basket']);
});

test('a pause that is never lifted eventually releases the lease rather than holding the trolley for ever', async () => {
  const { runner, query, logs, session } = scenario({ directive: 'pause', options: { maxPauseMs: 30 } });
  const res = await runner.run({});
  assert.strictEqual(res.outcome, 'human_takeover');
  assert.ok(logs.some((l) => /releasing the lease so nothing holds the trolley/.test(l)));
  assert.strictEqual(query.state.requests[0].claimed_by, null);
  assert.deepStrictEqual(commandsIssued(session), [], 'not one browser command was issued while paused');
});

test('HUMAN TAKEOVER releases the writing lease so no automated click can race a hand', async () => {
  const { runner, query, session } = scenario({ directive: 'takeover' });
  const res = await runner.run({});
  assert.strictEqual(res.outcome, 'human_takeover');
  const row = query.state.requests[0];
  assert.strictEqual(row.claimed_by, null, 'the lease is released');
  assert.strictEqual(row.status, 'queued', 'the work still exists - it simply has no owner');
  assert.ok(Array.isArray(row.progress.plan) && row.progress.plan.length === 3, 'the plan is preserved in full');
  assert.strictEqual(row.progress._released_reason, 'human takeover requested');
  assert.deepStrictEqual(commandsIssued(session), [], 'and not one click was issued');
});

test('STOP finishes cleanly at basket-ready without executing the rest of the plan', async () => {
  const { runner, query, session } = scenario({ directive: 'stop' });
  const res = await runner.run({});
  assert.strictEqual(res.outcome, 'basket_ready');
  assert.deepStrictEqual(commandsIssued(session), ['read_basket'], 'it read the basket and stopped');
  assert.strictEqual(query.state.requests[0].status, 'complete');
});

test('a cancelled request stops the runner even with no control file', async () => {
  const { runner, query, session } = scenario();
  const original = query.state.requests[0];
  const wrapped = async (t, p) => {
    const r = await query(t, p);
    if (/^\s*select status from asdair.browser_build_request/.test(t)) return { rows: [{ status: 'cancelled' }] };
    return r;
  };
  wrapped.state = query.state;
  runner.query = wrapped;
  const res = await runner.run({});
  assert.strictEqual(res.outcome, 'cancelled');
  assert.deepStrictEqual(commandsIssued(session), []);
  assert.ok(original);
});

test('LOSING the lease mid-run stops browser commands immediately - a stale writer cannot resume clicking', async () => {
  const { runner, query, session } = scenario();
  await runner.claim({});
  runner.reconstruct({});
  runner.session = session;
  await runner.executeStep(runner.remaining[0], false);
  // Another runner legitimately takes over while this one was busy.
  query.state.requests[0].claimed_by = 'runner-Z';
  query.state.requests[0].progress._lease.runner_id = 'runner-Z';
  await assert.rejects(() => runner.executeStep(runner.remaining[1], false), /lease/i);
  assert.deepStrictEqual(commandsIssued(session), ['add_known_product'], 'the second step never reached the browser');
});

test('RE-AUTHENTICATION is reported and the lease released - the runner never enters credentials', async () => {
  const session = makeFakeSession({
    open_groceries: async () => { throw new ReauthRequiredError('https://login.asda.com/shopper/authorise'); },
  });
  const { runner, query, logs } = scenario({ session });
  const res = await runner.run({});
  assert.strictEqual(res.outcome, 'human_reauth_required');
  const row = query.state.requests[0];
  assert.strictEqual(row.progress.human_reauth_required, true);
  assert.strictEqual(row.claimed_by, null, 'the lease is released so Warwick can sign in without a race');
  assert.strictEqual(row.status, 'queued');
  assert.ok(logs.some((l) => /never sees or handles what he types/.test(l)));
  assert.deepStrictEqual(commandsIssued(session), [], 'nothing was typed, clicked or added');
});

test('a request already flagged for re-authentication is not retried blind', async () => {
  const session = makeFakeSession({ state: async () => ({ url: 'https://login.asda.com/x', reauth_required: true }) });
  const { runner, session: s } = scenario({ session, progress: { human_reauth_required: true } });
  const res = await runner.run({});
  assert.strictEqual(res.outcome, 'human_reauth_required');
  assert.deepStrictEqual(commandsIssued(s), []);
});

test('an unavailable item is reported, closed, and never substituted', async () => {
  const session = makeFakeSession({
    add_known_product: async (r) => ({ product_ref: r, added: false, reason: 'unavailable', title: 'Out of stock' }),
  });
  const { runner, logs } = scenario({ plan: [PLAN[0]], session });
  const res = await runner.run({});
  assert.strictEqual(res.summary.unavailable_items, 1);
  assert.strictEqual(res.summary.regulars_added, 0);
  assert.ok(logs.some((l) => /never swaps an item/.test(l)));
});

test('a favourite the browser could not add becomes a durable pending_action, not a silent loss', async () => {
  const session = makeFakeSession({ add_to_favourites: async (r) => ({ product_ref: r, ok: false, reason: 'favourite control not found' }) });
  const { runner, query } = scenario({ plan: [{ step_id: 'f1', command: 'add_to_favourites', product_ref: '489747' }], session });
  const res = await runner.run({});
  assert.strictEqual(res.summary.pending_favourite_actions, 1);
  assert.strictEqual(query.state.pendingActions.length, 1);
  assert.strictEqual(query.state.pendingActions[0][2], 'add_favourite');
});

test('the runner refuses a plan naming anything off the allowlist rather than partially executing it', async () => {
  const { runner, session } = scenario({ plan: [PLAN[0], { step_id: 'bad', command: 'checkout' }] });
  const res = await runner.run({});
  assert.strictEqual(res.outcome, 'failed');
  assert.match(res.error, /not on the allowlist/);
  assert.deepStrictEqual(commandsIssued(session), [], 'validation happens before ANY step runs');
});

test('a step whose item is ALREADY in the trolley converges rather than failing', async () => {
  const session = makeFakeSession({
    add_known_product: async (r) => ({ product_ref: r, added: false, reason: 'already-in-trolley', qty: 1 }),
  });
  const { runner, logs } = scenario({ plan: [PLAN[0]], session });
  const res = await runner.run({});
  assert.strictEqual(res.summary.failed_actions, 0, 'a retried add that already landed is not an error');
  assert.strictEqual(res.summary.regulars_added, 1);
  assert.ok(logs.some((l) => /not added twice/.test(l)));
});

test('being throttled leaves the request queued for later rather than marking it failed', async () => {
  const session = makeFakeSession({ open_groceries: async () => { throw new RateLimitedError(); } });
  const { runner, query } = scenario({ session });
  const res = await runner.run({});
  assert.strictEqual(res.outcome, 'rate_limited');
  const row = query.state.requests[0];
  assert.strictEqual(row.status, 'queued', 'still queued - no human has to re-create work that was fine');
  assert.strictEqual(row.claimed_by, null, 'and the lease is given back');
});

// =====================================================================
// AC6(f) - THE PRODUCER/CONSUMER KEY MISMATCH
//
// The Wayfinder recorded this as "openHandoff writes progress.handoff while
// runner.js reconstruct() reads progress.plan, so a CDP arm can still ignore
// the payload." The measured behaviour was worse than "ignore": an absent
// progress.plan validated to an EMPTY plan, the step loop never entered, and
// run() fell through to finishBasketReady() - marking the request complete and
// the shop BASKET_READY with an empty trolley.
//
// These tests drive the REAL producer (handoff/claim.js openHandoff, over its
// own offline fake) into the REAL consumer, so nothing about the payload shape
// is guessed at here. If either end changes its key, the first test fails.
// =====================================================================

const os = require('node:os');
const path = require('node:path');
const fs = require('node:fs');
const { buildHandoff } = require('../handoff/buildHandoff.js');
const { openHandoff } = require('../handoff/claim.js');
const { basePacket } = require('../handoff/test/fixtures.js');
const { makeFakeStore: makeHandoffStore } = require('../handoff/test/fakeRequestStore.js');

/** The progress block the PIPELINE actually writes, produced by the real producer. */
async function pipelineWrittenProgress() {
  const store = makeHandoffStore({ requests: [], now: () => new Date() });
  const opened = await openHandoff(store.query, {
    shopId: 1, handoff: buildHandoff(basePacket()), openedBy: 'asdair:pipeline',
  });
  return opened.request.progress;
}

test('AC6(f): the producer writes progress.handoff and no progress.plan - the mismatch is real', async () => {
  const progress = await pipelineWrittenProgress();
  assert.ok(progress.handoff, 'openHandoff must write the artefact under progress.handoff');
  assert.ok(progress.handoff.packet_fingerprint, 'and it must carry the packet fingerprint');
  assert.ok(!Array.isArray(progress.plan),
    'openHandoff writes no progress.plan. This assertion IS the mismatch: the CDP arm reads that key. '
    + 'If a later change starts synthesising a plan here, read reconstruct()\'s header before deleting this.');
});

test('AC6(f): an arm handed a supervised handoff REFUSES - it never reports a basket it did not build', async () => {
  const progress = await pipelineWrittenProgress();
  const { runner, query, session } = scenario({ plan: [], progress });

  const res = await runner.run({});

  // THE PROPERTY. Before the fix this returned { outcome: 'basket_ready' }.
  assert.strictEqual(res.outcome, 'failed', 'an unexecutable request must fail loudly, not succeed quietly');
  assert.match(res.error, /NoExecutablePlanError/);
  assert.match(res.error, /progress\.plan/, 'the reason must name the key it could not find');

  assert.deepStrictEqual(commandsIssued(session), [], 'not one browser command may be issued');
  const row = query.state.requests[0];
  assert.notStrictEqual(row.status, 'complete', 'the request must NOT be completed');
  assert.strictEqual(row.status, 'failed', 'it is parked FAILED, visibly, with a reason');
  assert.ok(/NoExecutablePlanError/.test(String(row.last_error)), 'and the reason is durable on the row');
  assert.strictEqual(query.state.shops[0].status, 'WAITING_FOR_BROWSER',
    'the SHOP must not be moved - BASKET_READY on an empty trolley is the defect this closes');
});

test('AC6(f): --plan-file remains the explicit way to give this arm real work', async () => {
  const progress = await pipelineWrittenProgress();
  const { runner, session } = scenario({ plan: [], progress });
  const planFile = path.join(os.tmpdir(), `asdair-plan-${process.pid}.json`);
  fs.writeFileSync(planFile, JSON.stringify(PLAN), 'utf8');
  try {
    const res = await runner.run({ planFile });
    assert.strictEqual(res.outcome, 'basket_ready', 'an explicitly supplied plan still runs');
    assert.deepStrictEqual(commandsIssued(session),
      ['add_known_product', 'select_search_result', 'set_quantity', 'read_basket']);
  } finally {
    fs.unlinkSync(planFile);
  }
});

// =====================================================================
// WP-B15-12 - A BASKET IS NEVER REPORTED BUILT WHEN IT IS EMPTY
//
// AC6(f) above put the guard at the PLAN layer: a request carrying nothing
// executable is refused before a single click. This block puts it at the
// OUTCOME layer, which had none at all - finishBasketReady() read the trolley,
// logged the count, recorded it into progress, and then declared BASKET_READY
// without ever comparing it to anything.
//
// The two failures are reached differently, which is why one guard cannot cover
// both. A plan CAN execute in full and still leave an empty trolley: every add
// rejected, every item out of stock, or a session that was never on the trolley
// it thought it was. The plan guard cannot see any of that. Only the read-back
// can, and only if something looks at it.
// =====================================================================

/** A trolley that reads back EMPTY - the outcome the plan guard cannot see. */
const emptyBasketSession = (over = {}) => makeFakeSession({
  read_basket: async () => ({ product_count: '0', order_total: '0.00', item_count: '0', products: [] }),
  ...over,
});

test('AC1: a plan that EXECUTES but reads back an EMPTY trolley is refused, never reported BASKET_READY', async () => {
  const session = emptyBasketSession();
  const { runner, query } = scenario({ session });

  const res = await runner.run({});

  // THE PROPERTY. Before this guard existed, this exact scenario returned
  // { outcome: 'basket_ready' }, marked the request complete, and moved the shop.
  assert.strictEqual(res.outcome, 'failed', 'an empty trolley must fail loudly, not succeed quietly');
  assert.match(res.error, /EmptyBasketError/);
  assert.match(res.error, /empty/i, 'the reason must say what it found');

  const row = query.state.requests[0];
  assert.notStrictEqual(row.status, 'complete', 'the request must NOT be completed');
  assert.strictEqual(row.status, 'failed', 'it is parked FAILED, visibly, with a reason');
  assert.ok(/EmptyBasketError/.test(String(row.last_error)), 'and the reason is durable on the row');
  assert.strictEqual(query.state.shops[0].status, 'SHOPPING',
    'the SHOP must not reach BASKET_READY - that is the whole defect this closes');

  // The evidence of what it attempted survives the refusal.
  assert.strictEqual(row.progress.basket_product_count, 0, 'the read-back it refused on is durable');
  assert.strictEqual(row.progress.basket_shortfall.intended, 2, 'and what it had intended to add');
});

/** The shop_event rows written by noteShopEvent (3 params) - not the transition rows (4). */
const notes = (query) => query.state.events.filter((e) => e.length === 3).map((e) => String(e[2]));

test('AC1: the all-unavailable trolley is refused too, and the reason says ASDA had none of it', async () => {
  const session = emptyBasketSession({
    add_known_product: async (r) => ({ product_ref: r, added: false, reason: 'unavailable', title: 'Out of stock' }),
  });
  const { runner, query } = scenario({ plan: [PLAN[0]], session });

  const res = await runner.run({});

  assert.strictEqual(res.outcome, 'failed', 'zero products is not a basket, whatever the reason');
  assert.match(res.error, /ASDA had none of it/,
    'it must read as "ASDA had none of it", never as "the runner broke"');
  assert.strictEqual(query.state.shops[0].status, 'SHOPPING');
  // Nothing is lost by refusing: the durable evidence is still on the row.
  assert.strictEqual(query.state.requests[0].progress.unavailable_items.length, 1);
});

test('AC2: a SHORTFALL still reaches BASKET_READY, and is recorded where Warwick can see it', async () => {
  const session = makeFakeSession({
    select_search_result: async (r) => ({ product_ref: r, added: false, reason: 'unavailable', title: 'Out of stock' }),
    read_basket: async () => ({ product_count: '1', order_total: '2.25', item_count: '1', products: [] }),
  });
  const { runner, query } = scenario({ plan: [PLAN[0], PLAN[1]], session });

  const res = await runner.run({});

  // Out of stock is ordinary shopping. It is NOT a refusal - no threshold exists.
  assert.strictEqual(res.outcome, 'basket_ready');
  assert.strictEqual(query.state.shops[0].status, 'BASKET_READY');

  const sf = res.summary.basket_shortfall;
  assert.strictEqual(sf.intended, 2);
  assert.strictEqual(sf.added, 1);
  assert.strictEqual(sf.missing, 1, 'the DIFFERENCE is computed, not smoothed away');
  assert.strictEqual(sf.unavailable, 1, 'and explained');

  // Visible WITHOUT reading a runner log: the shop_event ledger the Cockpit reads.
  assert.ok(notes(query).some((d) => /basket is SHORT: 1 of 2/.test(d)),
    'the shortfall must reach the shop_event ledger, not only stdout');
  assert.strictEqual(query.state.requests[0].progress.basket_shortfall.missing, 1, 'and be durable on the row');
});

test('AC3: a plan that intended NO adds is not refused for an empty trolley - the guard must not fire on the honest case', async () => {
  const session = emptyBasketSession();
  const { runner, query } = scenario({ plan: [{ step_id: 'r1', command: 'read_basket_line_count' }], session });

  const res = await runner.run({});

  assert.strictEqual(res.outcome, 'basket_ready', 'a read-only plan legitimately leaves the trolley as it found it');
  assert.strictEqual(query.state.shops[0].status, 'BASKET_READY');
  assert.strictEqual(res.summary.basket_shortfall.intended, 0);
});

test('DRY RUN moves no real shop state and claims no basket - a rehearsal builds nothing', async () => {
  const { runner, query, session } = scenario();

  const res = await runner.run({ dryRun: true });

  assert.strictEqual(res.outcome, 'dry_run', 'not basket_ready - it never went and looked at a trolley');
  assert.deepStrictEqual(commandsIssued(session), [], 'not one browser command was issued');

  const row = query.state.requests[0];
  assert.notStrictEqual(row.status, 'complete', 'a rehearsal must not complete the request');
  assert.strictEqual(row.status, 'queued', 'the work still exists and has not been done');
  assert.strictEqual(row.claimed_by, null, 'and the lease is given back');
  assert.strictEqual(query.state.shops[0].status, 'WAITING_FOR_BROWSER',
    'the SHOP is untouched in BOTH directions - no SHOPPING, no BASKET_READY');
  assert.strictEqual(row.progress._completed_steps.length, 3, 'while the rehearsal itself is still recorded');
});

test('AC4: the PLAN guard does not regress - an empty plan with no handoff still refuses', async () => {
  const { runner, query, session } = scenario({ plan: [] });

  const res = await runner.run({});

  assert.strictEqual(res.outcome, 'failed');
  assert.match(res.error, /NoExecutablePlanError/);
  assert.match(res.error, /progress\.plan/, 'the reason names the key it could not find');
  assert.deepStrictEqual(commandsIssued(session), []);
  assert.strictEqual(query.state.requests[0].status, 'failed');
  assert.strictEqual(query.state.shops[0].status, 'WAITING_FOR_BROWSER');
});

test('argument parsing carries only known switches', () => {
  const a = parseArgs(['--request', '7', '--lease-ms', '1000', '--dry-run', '--plan-file', 'p.json']);
  assert.strictEqual(a.requestId, '7');
  assert.strictEqual(a.options.leaseMs, 1000);
  assert.strictEqual(a.dryRun, true);
  assert.strictEqual(a.planFile, 'p.json');
});
