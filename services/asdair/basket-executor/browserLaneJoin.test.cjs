// =====================================================================
// BUILD-015 AsdAIr - basket-executor/browserLaneJoin.test.cjs
//
// THE BROWSER LANE, EXECUTED. Closing Veritas Gate 2, defect 6.
//
// ── WHAT WAS ACTUALLY WRONG, AND HOW LONG IT LASTED ───────────────────────
// `consume-request.cjs` builds the manifest in memory from durable rows and
// calls `runBasket({ manifest, ... })`. `run-basket.cjs` treated that argument
// as a FILE PATH and did `JSON.parse(fs.readFileSync(args.manifest))`, which
// throws, verbatim:
//
//   TypeError: The "path" argument must be of type string or an instance of
//   Buffer or URL. Received an instance of Object
//
// `runtime.log` carried that message 291 times between 2026-07-28 and the Gate 2
// review, every pass, with the request released back to `queued` each time. So
// THE BROWSER LANE HAD NEVER EXECUTED A SINGLE REQUEST since it was wired: every
// claim died on that line before a browser was ever launched.
//
// ── WHY IT SURVIVED THREE WEEKS: NOTHING COULD RUN THE LANE ───────────────
// `ensureChrome` and `new Session()` were reached by direct construction, so
// executing `runBasket` at all required a real Chrome and a real signed-in ASDA
// account. A defect on the FIRST line of the function was therefore only ever
// observable in production. The injection seam this suite uses exists to end
// that, and it defaults to the real implementations so production is unchanged.
//
// ── WHAT THIS SUITE DOES AND DOES NOT PROVE ──────────────────────────────
// PROVES, by execution: the manifest object now reaches a built plan; the run
// completes through the REAL plan / ladder / judge / reconcile code; and
// reverting the join reproduces the exact logged TypeError.
//
// DOES NOT PROVE: that a real ASDA trolley gets filled. The session here is a
// fake. Under `network: none` no browser can run, and the first real execution
// of this lane belongs to the joined live run. That is stated rather than
// implied, because "the browser lane works now" is precisely the kind of claim
// this build has been burned by.
// =====================================================================
'use strict';

const test = require('node:test');
const assert = require('node:assert');
const path = require('node:path');
const fs = require('node:fs');

const { buildManifest } = require('./consume-request.cjs');
const { runBasket } = require('./run-basket.cjs');

const HERE = __dirname;

// ── THE FAKES. Everything the lane needs that is not the code under test. ──

/** A fake browser session: records what it was asked to do, buys nothing. */
function fakeSession(calls) {
  return {
    async open() { calls.push('open'); },
    close() { calls.push('close'); },
    async evaluate() { return 'signed in'; },
    async read_regulars() { calls.push('read_regulars'); return []; },
    async add_known_product(ref) { calls.push(`add:${ref}`); return { ok: true }; },
    async select_search_result(term) { calls.push(`search:${term}`); return { ok: true }; },
    async set_quantity(ref, qty) { calls.push(`qty:${ref}=${qty}`); return { ok: true }; },
    async read_basket() { calls.push('read_basket'); return { lines: [], total: null }; },
  };
}

const fakeChrome = async () => ({ endpoint: 'ws://offline/none', reused: true, version: { Browser: 'offline-fake' } });

/**
 * The manifest, built by the REAL `buildManifest` from durable-row-shaped input.
 *
 * Deliberately not hand-written: a hand-written fixture would be my guess at
 * the object the production caller passes, and the defect under test is
 * precisely a mismatch between what one side sends and what the other expects.
 * A test carrying its own idea of the shape could not have caught it.
 */
function manifestObject() {
  return buildManifest({
    shop: { id: 4242, shop_ref: 'SHOP-TEST-JOIN', household_id: 1 },
    lines: [
      { line_no: 1, raw_reading: '2 pkts ASDA plain toffees', canonical_name: 'ASDA Dairy Toffee 180g', quantity: 2, status: 'matched', matched_regular_id: 33 },
      { line_no: 2, raw_reading: '2 Lurpak butter', canonical_name: 'Lurpak Slightly Salted Butter 200g', quantity: 1, status: 'matched', matched_regular_id: 11, asda_product_id: '1234' },
    ],
    catalogue: { rows: [{ id: 33, name: 'ASDA Dairy Toffee 180g' }, { id: 11, name: 'Lurpak Slightly Salted Butter 200g', asda_product_id: '1234' }] },
  });
}

function runOptions(extra) {
  const outDir = fs.mkdtempSync(path.join(require('node:os').tmpdir(), 'asdair-lane-'));
  return Object.assign({
    manifest: manifestObject(),
    outDir,
    state: path.join(outDir, 'state.json'),
    ensureChrome: fakeChrome,
    makeSession: fakeSession([]),
    dryRun: false,
    reconcileOnly: true,        // no trolley writes; the join is what is under test
  }, extra || {});
}

// =====================================================================

test('THE JOIN: a manifest OBJECT reaches a built plan - the lane executes at all', async () => {
  const calls = [];
  const result = await runBasket(Object.assign(runOptions(), {
    makeSession: () => fakeSession(calls),
  }));

  assert.ok(result, 'runBasket returned nothing');
  assert.equal(result.shopRef, 'SHOP-TEST-JOIN',
    'the manifest object was not read - the lane still cannot start');
  assert.ok(calls.includes('open'),
    'the run never reached the browser session: it died before the lane began, which is the '
    + '291-failure defect');
  assert.ok(calls.includes('read_basket'),
    'the run never reached reconciliation');
});

test('THE MUTATION: revert the join and the exact logged TypeError comes back', async () => {
  // The old line, reproduced literally rather than described: this is what
  // run-basket.cjs did with the object it was handed.
  let thrown = null;
  try {
    const manifestPath = manifestObject();          // the OBJECT, as consume-request passes it
    JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  } catch (e) {
    thrown = e;
  }
  assert.ok(thrown, 'the reverted join did not fail - this mutation proves nothing');
  assert.match(String(thrown.message),
    /The "path" argument must be of type string or an instance of Buffer or URL\. Received an instance of Object/,
    'the reproduced failure is not the one runtime.log recorded 291 times');
});

test('THE JOIN REFUSES an unreadable manifest rather than reporting an empty basket', async () => {
  await assert.rejects(
    () => runBasket(Object.assign(runOptions(), { manifest: { shop_ref: 'SHOP-NO-LINES' } })),
    /carries no `lines` array/,
    'a manifest with no lines was accepted, so an empty trolley could be reported as a shop',
  );
});

// =====================================================================
// THE CEILING - defect 6's second half
// =====================================================================

const lease = require('../browser-runner/lease.cjs');

// ⚠️ THE LITERAL BOUND, HELD OUTSIDE THE SOURCE IT CHECKS.
//
// The first version of these tests looped `lease.MAX_ATTEMPTS` times and then
// asserted the request had gone terminal at `lease.MAX_ATTEMPTS` - which is the
// constant under test on BOTH sides of the assertion. Raising the ceiling to
// 100000 (i.e. removing it, which is the state that produced 291 failures) left
// the suite GREEN. A control that moves with the thing it is checking is not a
// control, so the bound below is a literal this file owns.
const CEILING_MUST_BE_AT_MOST = 10;
const CEILING_MUST_BE_AT_LEAST = 2;

test('CEILING: the ceiling is a real, small number - not "eventually"', () => {
  assert.ok(Number.isInteger(lease.MAX_ATTEMPTS), 'the ceiling is not a whole number of attempts');
  assert.ok(lease.MAX_ATTEMPTS <= CEILING_MUST_BE_AT_MOST,
    `the retry ceiling is ${lease.MAX_ATTEMPTS}. Request id 1 failed 291 times between 2026-07-28 `
    + 'and the Gate 2 review; a ceiling this high is the same defect wearing a number');
  assert.ok(lease.MAX_ATTEMPTS >= CEILING_MUST_BE_AT_LEAST,
    'a single transient failure would terminate the browser lane, which is worse than the loop');
});

/**
 * A fake of the one row `release` updates.
 *
 * ⚠️ HONEST SCOPE. This executes the real `release()` function and the real
 * policy CHOICE (count, back off, go terminal), but NOT the SQL - the statement
 * is a single Postgres UPDATE whose CASE expression cannot run without a
 * database, and this Work Order may not touch one. The statement-level
 * assertions below cover what the fake cannot, and the residual is stated in the
 * return: the SQL is proven by reading, not by executing.
 */
function fakeRow(attempts) {
  const row = { id: 1, status: 'running', progress: { _attempts: attempts }, claimed_by: 'r1' };
  return {
    row,
    async query(text, params) {
      const counts = params[3] === true;                 // $4 = countAttempt
      const ceiling = Number(params[4]);                 // $5 = MAX_ATTEMPTS, as the module passes it
      const next = (row.progress._attempts || 0) + (counts ? 1 : 0);
      row.progress._attempts = next;
      if (counts) {
        row.status = next >= ceiling ? 'failed' : 'queued';
        row.progress._retry_after = new Date(Date.now() + 60_000).toISOString();
      }
      row.progress._released_reason = params[2];
      return { rows: [{ id: 1, status: row.status, attempts: next, retry_after: row.progress._retry_after }] };
    },
  };
}

test('CEILING: a request stops re-claiming forever - terminal within the LITERAL bound', async () => {
  const f = fakeRow(0);
  let last = null;
  // Driven by the literal, never by the constant under test.
  for (let i = 0; i < CEILING_MUST_BE_AT_MOST; i += 1) {
    last = await lease.release(f.query, {
      requestId: 1, runnerId: 'r1', countAttempt: true, reason: 'the same failure again',
    });
  }
  assert.equal(last.status, 'failed',
    `after ${CEILING_MUST_BE_AT_MOST} identical failures the request was still asking. Request id 1 `
    + 'did exactly this 291 times, and nothing ever gave up on it');
});

test('CEILING: a RELEASE is not a failure - a pause or a human takeover consumes no attempt', async () => {
  // The default matters: `release` also runs on human takeover, pause, re-auth
  // and throttling. Counting those would terminate the lane for behaving well.
  // The browser-runner suite failed ten proofs when this defaulted to counting.
  const f = fakeRow(0);
  for (let i = 0; i < CEILING_MUST_BE_AT_MOST + 3; i += 1) {
    await lease.release(f.query, { requestId: 1, runnerId: 'r1', reason: 'human took the browser' });
  }
  assert.equal(f.row.status, 'running',
    'an ordinary release consumed a retry, so a well-behaved pause can terminate the browser lane');
  assert.equal(f.row.progress._attempts, 0, 'a non-failure release counted as an attempt');
});

test('CEILING: the backoff GROWS, so a failing request stops occupying every pass', () => {
  const steps = [1, 2, 3, 4, 5].map(lease.backoffMsFor);
  assert.equal(steps[0], 60_000, 'the first retry is not one minute');
  assert.ok(steps[1] > steps[0] && steps[2] > steps[1],
    'the backoff does not grow, so a permanent failure costs the same as a transient one');
  assert.ok(steps[steps.length - 1] <= 16 * 60_000, 'the backoff is unbounded');
});

test('CEILING: the SQL carries the ceiling and the terminal transition, not just the JS', () => {
  // What the fake above cannot execute, asserted on the statement itself.
  const src = fs.readFileSync(path.join(HERE, '..', 'browser-runner', 'lease.cjs'), 'utf8');
  const releaseBody = src.slice(src.indexOf('async function release('), src.indexOf('async function finish('));
  assert.match(releaseBody, /then 'failed'/,
    'the release statement never transitions to a terminal state, so the ceiling exists only in prose');
  assert.match(releaseBody, /_attempts/,
    'the release statement does not record the attempt count it is supposed to be bounding');
  assert.match(releaseBody, /_retry_after/,
    'the release statement writes no retry window, so the next pass re-claims immediately');
});

test('CEILING: the claim query refuses a request inside its retry window', () => {
  // Asserted on the statement, because the behaviour lives in SQL a fake cannot
  // execute. The `_retry_after` guard must be IN the claim, not merely intended.
  const src = fs.readFileSync(path.join(HERE, '..', 'browser-runner', 'lease.cjs'), 'utf8');
  const claimBody = src.slice(src.indexOf('async function claim('), src.indexOf('async function claimOrWait('));
  assert.match(claimBody, /_retry_after/,
    'the claim does not consult the retry window, so backoff is written and never read - a '
    + 'recorded limit that does not move the decision is not a limit');
});
