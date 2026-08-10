// =====================================================================
// BUILD-015 AsdAIr - handoff/handoffCli.test.js
//
// WP-B15-19. THE SUPERVISED OPERATOR CAN REPORT THE BASKET BACK, AND THE SHOP
// MOVES ON THE PIPELINE'S OWN PASS.
//
// WHAT THIS PROVES THAT NOTHING ELSE DID. Before this Work Order the supervised
// leg ended in a cul-de-sac: `stages.js` was already waiting for
// `progress.report`, and NOTHING IN THE ESTATE EVER WROTE IT. `completeHandoff`
// existed, was correct, was fenced - and had zero production callers. The
// nearest existing proof, `pipeline/runPipeline.test.js`, HAND-WROTE the row
// state with a helper literally commented "what claim.js completeHandoff leaves
// behind". That proves the pipeline reacts to a shape; it does not prove
// anything ever produces it.
//
// So the two simulations are replaced here by the real thing: the real
// `claimHandoff` takes the lease, the real delivered route writes the report,
// and the real `runPipeline` reads what they left and takes the hop. Nothing in
// the chain is a stand-in except the database.
//
// -- A TEST-ONLY DEPENDENCY, DECLARED OUT LOUD (WO AMENDMENT 1, RULING 1) -----
// This file imports `../pipeline/test/harness.js` and `../pipeline/runPipeline.js`.
// That is a deliberate, TEST-ONLY coupling from the handoff package to the
// pipeline package, authorised because the join is exactly what is under proof
// and no smaller surface can demonstrate it. `handoffCli.js` itself imports
// nothing from the pipeline. The pipeline is ESM and this package is CommonJS,
// hence the dynamic `import()`.
//
// FULLY OFFLINE. No database, no network, no model, no credentials file. The
// row store is the pipeline's own in-memory fake; claim.js's six lifecycle
// statements are answered by `test/fakeRequestStore.js` `makeClaimQuery` over
// that same array, so the operator's write and the pipeline's read meet over
// ONE durable state.
// =====================================================================
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const { claimHandoff, peekHandoff, LeaseLostError } = require('./claim');
const { CompletionContractError } = require('./completion');
const { makeClaimQuery } = require('./test/fakeRequestStore');
const cli = require('./handoffCli');

const HOUSEHOLD_ID = 1;
const REF = 'SHOP-2026-08-03';
const ACTOR = 'telegram:555';
const HANDLE = { shopRef: REF };
const OPERATOR = 'supervised:warwick';

// ---------------------------------------------------------------------
// Wiring
// ---------------------------------------------------------------------

/** The pipeline is ESM; this package is CommonJS. Loaded once, reused. */
let PIPE = null;
async function pipeline() {
  if (!PIPE) {
    const [harness, run, commands, stages, store] = await Promise.all([
      import('../pipeline/test/harness.js'),
      import('../pipeline/runPipeline.js'),
      import('../pipeline/commands.js'),
      import('../pipeline/stages.js'),
      import('../pipeline/store.js'),
    ]);
    PIPE = { harness, run, commands, stages, store };
  }
  return PIPE;
}

/**
 * A pipeline harness whose browser_build_request rows ALSO answer claim.js.
 *
 * `makeClaimQuery` owns the six lifecycle statements and delegates everything
 * else - including openHandoff's four, which fakePg already models - straight
 * back to the pipeline's own client. One row array, two callers.
 */
async function wire(seed) {
  const { harness } = await pipeline();
  const h = seed === undefined ? harness.makeHarness() : harness.makeHarness({ seed });
  const query = makeClaimQuery({
    rows: h.db.browser_build_request,
    now: () => new Date('2026-08-03T12:00:00.000Z'),
    delegate: (text, params) => h.client.query(text, params),
  });
  return { ...h, query };
}

/** Run the REAL product journey up to a shop that is WAITING_FOR_BROWSER. */
async function toWaitingForBrowser(h) {
  const { commands, run } = await pipeline();
  await commands.receiveList({
    householdId: HOUSEHOLD_ID, listDate: '2026-08-03', sourceKind: 'text',
    rawText: '3 gourmet cat food\n1 weetabix protein', actor: ACTOR,
    telegramChatId: '555', telegramMessageId: '900',
  }, h.deps);
  await commands.buildShop({ shopRef: REF, actor: ACTOR }, h.deps);
  for (let i = 0; i < 12; i += 1) {
    const r = await run.runPipeline(HANDLE, h.deps);
    if (!r.stepped) break;
  }
  assert.equal(h.db.shop[0].status, 'READY_TO_SHOP');
  await commands.requestBasketBuild({ shopRef: REF, actor: ACTOR }, h.deps);
  const queued = await run.runPipeline(HANDLE, h.deps);
  assert.equal(queued.to, 'WAITING_FOR_BROWSER');
  assert.equal(h.db.browser_build_request.length, 1, 'exactly one live request');
  assert.ok(h.db.browser_build_request[0].progress.handoff, 'the product wrote the handoff artefact');
  return h.db.browser_build_request[0];
}

/**
 * The operator's report, built from the handoff THE PRODUCT wrote onto the
 * durable request. Nothing in it is invented here: the seqs, the fingerprint
 * and the quantities are the packet's own.
 */
function reportFor(handoff, statusFor = () => 'added') {
  return {
    packet_fingerprint: handoff.packet_fingerprint,
    shop_ref: handoff.shop_ref,
    lines: handoff.lines.map((l) => {
      const status = statusFor(l);
      const entry = { seq: l.seq, status };
      if (status === 'added' || status === 'out_of_stock') entry.quantity = l.required_quantity;
      return entry;
    }),
    confirmations: {
      no_checkout: true, no_payment: true, no_delivery_slot: true,
      no_password_entry: true, no_automatic_substitution: true,
    },
    notes: [],
  };
}

const shopStatus = (h) => h.db.shop[0].status;
const failureEvents = (h) => h.db.shop_event.filter((e) => e.event_type === 'failure');

// =====================================================================
// AC3 - THE HEADLINE. The shop advances on the PIPELINE's own pass.
// AC2 - and `progress.handoff` is still there afterwards, byte-identical.
// =====================================================================

test('AC3/AC2: the operator reports through the route and the PIPELINE takes the hop', async () => {
  const h = await wire();
  const { run, stages } = await pipeline();
  const request = await toWaitingForBrowser(h);

  // What the packet looked like BEFORE anyone reported anything. Kept as a
  // string so the comparison later is genuinely byte-for-byte and cannot be
  // satisfied by an object that merely looks similar.
  const handoffBefore = JSON.stringify(request.progress.handoff);

  // ---- the operator picks the work up, for real -------------------------
  const claimed = await claimHandoff(h.query, { requestId: request.id, writerId: OPERATOR });
  assert.ok(claimed, 'claimHandoff should hand the lease to the operator');

  const started = await run.runPipeline(HANDLE, h.deps);
  assert.equal(started.step, stages.STEPS.RECORD_BUILD_STARTED);
  assert.equal(shopStatus(h), 'SHOPPING');

  // ---- the operator reports the basket THROUGH THE DELIVERED ROUTE ------
  const report = reportFor(request.progress.handoff);
  const result = await cli.reportBasket(h.query, { requestId: request.id, writerId: OPERATOR, report });
  assert.equal(result.reported, true);
  assert.equal(result.request.status, 'complete');

  // AC2. THE TRAP, CLOSED. shopStore.updateBrowserProgress would have replaced
  // the whole object and destroyed this.
  const after = await peekHandoff(h.query, { requestId: request.id });
  assert.ok(after.progress.handoff, 'progress.handoff was DESTROYED by the report');
  assert.equal(JSON.stringify(after.progress.handoff), handoffBefore,
    'progress.handoff must survive the report byte-identical');
  assert.ok(after.progress.report, 'the report must be where completionReport() reads it');
  assert.equal(stages.completionReport({ browser: after }).packet_fingerprint,
    request.progress.handoff.packet_fingerprint);

  // ---- AC3. A BRAND NEW deps container over the SAME database -----------
  // Nothing is carried in memory: this is the pipeline's own next pass, from
  // durable state alone, exactly as runtime.js would find it after a restart.
  const restarted = await wire(h.db);
  const ready = await run.runPipeline(HANDLE, restarted.deps);
  assert.equal(ready.step, stages.STEPS.RECORD_BASKET_READY,
    'the hop must come from decideNextStep, not from anybody calling a transition');
  assert.equal(ready.to, 'BASKET_READY');
  assert.equal(restarted.db.shop[0].status, 'BASKET_READY',
    'THIS is the work package: a supervised operator reported, and the shop moved');

  // The checkout boundary has not moved by a millimetre.
  assert.equal(restarted.db.order_confirmation.length, 0,
    'nothing may be ordered, paid for or checked out here');
  assert.equal(failureEvents(restarted).length, 0);
});

test('AC3: nothing in the delivered route transitions the shop itself', async () => {
  const h = await wire();
  const request = await toWaitingForBrowser(h);
  await claimHandoff(h.query, { requestId: request.id, writerId: OPERATOR });
  const before = shopStatus(h);

  await cli.reportBasket(h.query, {
    requestId: request.id, writerId: OPERATOR, report: reportFor(request.progress.handoff),
  });

  assert.equal(shopStatus(h), before,
    'the route must write durable state and NOTHING else - the pipeline owns the transition');

  // And it cannot move a shop even in principle: it reaches for no state
  // machine, no pipeline and no transition writer.
  const source = fs.readFileSync(path.join(__dirname, 'handoffCli.js'), 'utf8');
  for (const forbidden of ["require('../pipeline", "require('./..", 'shopState', 'applyTransition', '.transition(']) {
    assert.equal(source.includes(forbidden), false, `handoffCli.js must not reach for "${forbidden}"`);
  }
});

// =====================================================================
// AC4 - A BASKET THAT WAS NOT BUILT IS NEVER REPORTED AS BUILT
// =====================================================================

test('AC4: a report for a SUPERSEDED packet is refused and NOTHING is written', async () => {
  const h = await wire();
  const { run } = await pipeline();
  const request = await toWaitingForBrowser(h);
  await claimHandoff(h.query, { requestId: request.id, writerId: OPERATOR });
  await run.runPipeline(HANDLE, h.deps);
  assert.equal(shopStatus(h), 'SHOPPING');

  // The operator shopped from a packet this row no longer carries.
  const stale = reportFor({ ...request.progress.handoff, packet_fingerprint: 'deadbeef-not-this-packet' });

  await assert.rejects(
    () => cli.reportBasket(h.query, { requestId: request.id, writerId: OPERATOR, report: stale }),
    (e) => {
      assert.match(String(e.message), /supersed/i, `expected a supersession refusal, got: ${e.message}`);
      return true;
    },
  );

  const after = await peekHandoff(h.query, { requestId: request.id });
  assert.equal(after.progress.report, undefined, 'a refused report must write NOTHING');
  assert.notEqual(after.status, 'complete');

  const { stages } = await pipeline();
  const next = await run.runPipeline(HANDLE, h.deps);
  assert.notEqual(next.step, stages.STEPS.RECORD_BASKET_READY,
    'a refused report must leave the pipeline with nothing to advance on');
  assert.notEqual(shopStatus(h), 'BASKET_READY', 'the shop must NOT move on a refused report');
});

test('AC4: a truthful EMPTY basket is recorded, and the pipeline refuses it LOUDLY', async () => {
  const h = await wire();
  const { run } = await pipeline();
  const request = await toWaitingForBrowser(h);
  await claimHandoff(h.query, { requestId: request.id, writerId: OPERATOR });
  await run.runPipeline(HANDLE, h.deps);

  // Every line not found. This report is HONEST and must be recorded - the
  // refusal belongs to the pipeline, where it reaches Warwick's phone. A route
  // that silently discarded it would replace a loud refusal with silence.
  await cli.reportBasket(h.query, {
    requestId: request.id, writerId: OPERATOR, report: reportFor(request.progress.handoff, () => 'not_found'),
  });

  const refused = await run.runPipeline(HANDLE, h.deps);
  assert.equal(refused.ok, false, 'the refusal must be LOUD, not a quiet park');
  assert.notEqual(shopStatus(h), 'BASKET_READY',
    'a basket that was not built is NEVER reported as built');
  assert.match(String(h.db.shop[0].last_error), /never built|trolley/i);
  assert.equal(failureEvents(h).length, 1);
});

test('AC4: a MALFORMED report is refused before a single byte is written', async () => {
  const h = await wire();
  const request = await toWaitingForBrowser(h);
  await claimHandoff(h.query, { requestId: request.id, writerId: OPERATOR });
  const handoff = request.progress.handoff;

  const cases = [
    ['REPORT_BAD_STATUS', reportFor(handoff, () => 'substituted')],
    ['REPORT_MISSING_QUANTITY', (() => {
      const r = reportFor(handoff);
      delete r.lines[0].quantity;
      return r;
    })()],
    ['REPORT_DUPLICATE_SEQ', (() => {
      const r = reportFor(handoff);
      r.lines.push({ ...r.lines[0] });
      return r;
    })()],
  ];

  for (const [code, report] of cases) {
    await assert.rejects(
      () => cli.reportBasket(h.query, { requestId: request.id, writerId: OPERATOR, report }),
      (e) => {
        assert.ok(e instanceof CompletionContractError, `${code}: expected a contract error, got ${e.name}`);
        assert.equal(e.code, code);
        return true;
      },
    );
    const after = await peekHandoff(h.query, { requestId: request.id });
    assert.equal(after.progress.report, undefined, `${code}: nothing may be written`);
    assert.notEqual(after.status, 'complete');
  }
});

// =====================================================================
// AC5 - A LOST OR ABSENT LEASE FAILS LOUDLY
// =====================================================================

test('AC5: another writer holds the lease - the route refuses and writes nothing', async () => {
  const h = await wire();
  const request = await toWaitingForBrowser(h);
  const other = await claimHandoff(h.query, { requestId: request.id, writerId: 'sonnet-someone-else' });
  assert.ok(other);

  await assert.rejects(
    () => cli.reportBasket(h.query, {
      requestId: request.id, writerId: OPERATOR, report: reportFor(request.progress.handoff),
    }),
    (e) => {
      assert.match(String(e.message), /sonnet-someone-else|another writer|holds/i,
        `the operator must be TOLD who holds it, got: ${e.message}`);
      return true;
    },
  );

  const after = await peekHandoff(h.query, { requestId: request.id });
  assert.equal(after.progress.report, undefined);
  assert.equal(after.claimed_by, 'sonnet-someone-else', 'the other writer keeps its lease');
});

test('AC5: a lease lost BETWEEN the claim and the completion surfaces, not swallowed', async () => {
  const h = await wire();
  const request = await toWaitingForBrowser(h);
  await claimHandoff(h.query, { requestId: request.id, writerId: OPERATOR });

  // The lease is stolen after this operator holds it. completeHandoff's fence
  // matches zero rows and claim.js raises LeaseLostError; the route must let it
  // out rather than reporting a cheerful no-op.
  const stolen = (text, params) => {
    if (String(text).includes("jsonb_build_object('report'")) {
      h.db.browser_build_request[0].claimed_by = 'someone-else';
      h.db.browser_build_request[0].progress._lease.runner_id = 'someone-else';
    }
    return h.query(text, params);
  };

  await assert.rejects(
    () => cli.reportBasket(stolen, {
      requestId: request.id, writerId: OPERATOR, report: reportFor(request.progress.handoff), reclaim: false,
    }),
    (e) => {
      assert.ok(e instanceof LeaseLostError, `expected LeaseLostError, got ${e.name}: ${e.message}`);
      return true;
    },
  );

  const after = await peekHandoff(h.query, { requestId: request.id });
  assert.equal(after.progress.report, undefined, 'a lost lease must write NOTHING - not even partially');
  assert.notEqual(after.status, 'complete');
});

// =====================================================================
// AC1 - A REAL, DURABLE ROUTE. Connection from the environment ONLY.
// =====================================================================

test('AC1: the connection comes from ASDAIR_WRITE_DB_URL and from nowhere else', () => {
  const source = fs.readFileSync(path.join(__dirname, 'handoffCli.js'), 'utf8');

  assert.equal(source.includes('ASDAIR_DB_URL'), false,
    'ASDAIR_DB_URL is the SELECT-only role. A writer on it is the exact W02 defect.');
  assert.ok(source.includes('ASDAIR_WRITE_DB_URL'),
    'the write connection must be named, so a missing value fails loudly rather than silently');

  // Never assembled here, never taken as an argument, never read out of a
  // credentials file by this module. (`process.env` is of course present - that
  // is the whole point; what must be absent is anything that BYPASSES it.)
  for (const forbidden of ['connectionString', 'postgres://', 'postgresql://', 'dotenv', "'.env", '".env', 'new Pool', "require('pg')"]) {
    assert.equal(source.includes(forbidden), false,
      `handoffCli.js must never carry "${forbidden}" - the connection is the environment's job, through shopStore's pool`);
  }

  // The one place a connection may come from, stated once.
  assert.ok(source.includes("require('../shop/shopStore.js')"),
    'the client must come from shopStore\'s existing transaction seam, not from a new pool');
});

test('AC1: a missing write connection fails loudly, before anything is attempted', () => {
  assert.throws(() => cli._internal.requireWriteUrl({}), /ASDAIR_WRITE_DB_URL/);
  assert.throws(() => cli._internal.requireWriteUrl({ ASDAIR_WRITE_DB_URL: '   ' }), /ASDAIR_WRITE_DB_URL/);
  assert.equal(cli._internal.requireWriteUrl({ ASDAIR_WRITE_DB_URL: 'x' }), true,
    'it returns a BOOLEAN, never the value - a connection string is never handed around');
});

test('AC1: every command is declared, and --dry-run opens no connection', () => {
  assert.deepEqual(Object.keys(cli.COMMANDS).sort(), ['claim', 'peek', 'release', 'report-basket']);

  const dry = cli.COMMANDS['report-basket'].dry({
    request_id: 3, writer_id: OPERATOR,
    report: { packet_fingerprint: 'abc', shop_ref: REF, lines: [{ seq: 1, status: 'added', quantity: 2 }] },
  });
  assert.equal(dry.would_complete_request, 3);
  assert.equal(dry.lines_reported, 1);
  assert.match(String(dry.note), /cannot be checked without a read|fingerprint/i,
    'a dry run must say plainly what it could NOT check');
});

test('AC1: a report is rejected on shape before the route touches the database', async () => {
  let called = 0;
  const spy = async (...args) => { called += 1; return { rows: [] }; };
  await assert.rejects(() => cli.reportBasket(spy, { requestId: 3, writerId: OPERATOR, report: null }));
  await assert.rejects(() => cli.reportBasket(spy, { requestId: 3, writerId: '', report: { lines: [] } }));
  assert.equal(called, 0, 'a malformed invocation must not open a single statement');
});
